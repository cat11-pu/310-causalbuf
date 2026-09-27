// causalrun.js：按处理预算处理并留账
import { depsMet, drain } from "./causal.js";

function fail(code, message) {
  const error = new Error(message);
  error.code = code;
  throw error;
}

function codesOf(spec) {
  return {
    dup: spec.dup_error_code || "E_DUP_MSG",
    self: spec.self_error_code || "E_SELF_DEP",
    event: spec.event_error_code || "E_BAD_EVENT"
  };
}

function isValidEvent(event) {
  return event !== null && typeof event === "object"
    && event.kind === "send"
    && typeof event.msg === "number" && Number.isInteger(event.msg)
    && Array.isArray(event.deps)
    && event.deps.every(function (dep) { return typeof dep === "number" && Number.isInteger(dep); });
}

function copyState(state) {
  const src = state || {};
  return {
    delivered: (src.delivered || []).slice(),
    pending: (src.pending || []).map(function (row) { return [row[0], row[1].slice()]; }),
    ledger: (src.ledger || []).map(function (row) { return [row[0], row[1], row[2].slice()]; }),
    applied: (src.applied || []).slice()
  };
}

function known(state, msg) {
  if (state.delivered.indexOf(msg) !== -1) return true;
  return state.pending.some(function (row) { return row[0] === msg; });
}

function applyEvent(state, msg, deps, codes) {
  if (deps.indexOf(msg) !== -1) fail(codes.self, "message depends on itself: " + msg);
  if (known(state, msg)) fail(codes.dup, "duplicate message: " + msg);
  if (depsMet(state.delivered, deps)) {
    state.delivered.push(msg);
    const drained = drain(state.delivered, state.pending);
    state.delivered = drained.delivered;
    state.pending = drained.pending;
  } else {
    state.pending.push([msg, deps.slice()]);
  }
  state.applied.push(msg);
}

export function step(spec) {
  const codes = codesOf(spec);
  const events = spec.events || [];
  events.forEach(function (event) {
    if (!isValidEvent(event)) fail(codes.event, "bad event: " + JSON.stringify(event));
  });
  const state = copyState(spec.state);
  let budget = typeof spec.budget === "number" ? spec.budget : 0;
  let served = 0;
  events.forEach(function (event) {
    if (state.applied.indexOf(event.msg) !== -1) return;
    if (budget <= 0) {
      state.ledger.push([event.kind, event.msg, event.deps.slice()]);
      return;
    }
    budget -= 1;
    served += 1;
    applyEvent(state, event.msg, event.deps, codes);
  });
  return {
    state: state,
    served: served,
    ledger_before: state.ledger.length,
    ledger: state.ledger.map(function (row) { return [row[0], row[1], row[2].slice()]; }),
    judged: served,
    judged_bound: events.length
  };
}

export function close(spec) {
  const codes = codesOf(spec);
  const state = copyState(spec.state);
  const backlog = state.ledger;
  state.ledger = [];
  let catchup = 0;
  backlog.forEach(function (row) {
    if (state.applied.some(function (msg) { return msg === row[1]; })) return;
    catchup += 1;
    applyEvent(state, row[1], row[2], codes);
  });
  return { state: state, catchup: catchup };
}

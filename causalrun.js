// causalrun.js：按处理预算处理并留账
import { depsMet, drain } from "./causal.js";

function fail(code, message) {
  const error = new Error(message);
  error.code = code;
  throw error;
}

function codes(spec) {
  return {
    dup: spec.dup_error_code || "E_DUP_MSG",
    self: spec.self_error_code || "E_SELF_DEP",
    event: spec.event_error_code || "E_BAD_EVENT"
  };
}

function validEvent(event) {
  return !!event && typeof event === "object"
    && event.kind === "send"
    && typeof event.msg === "number" && Number.isFinite(event.msg)
    && Array.isArray(event.deps)
    && event.deps.every(function (dep) { return typeof dep === "number" && Number.isFinite(dep); });
}

function copyState(state) {
  return {
    delivered: (state.delivered || []).slice(),
    pending: (state.pending || []).map(function (row) { return [row[0], row[1].slice()]; }),
    ledger: (state.ledger || []).map(function (row) { return row.slice(); }),
    applied: (state.applied || []).slice()
  };
}

// 处理一条事件：重放跳过、查重、查自依赖，就绪即投递并级联，否则进缓冲。
function applyEvent(state, event, code) {
  if (state.applied.indexOf(event.msg) !== -1) return false;
  const seen = state.delivered.indexOf(event.msg) !== -1
    || state.pending.some(function (row) { return row[0] === event.msg; });
  if (seen) fail(code.dup, "duplicate msg " + event.msg);
  if (event.deps.indexOf(event.msg) !== -1) fail(code.self, "self dependency " + event.msg);
  if (depsMet(state.delivered, event.deps)) {
    state.delivered.push(event.msg);
    const drained = drain(state.delivered, state.pending);
    state.delivered = drained.delivered;
    state.pending = drained.pending;
  } else {
    state.pending.push([event.msg, event.deps.slice()]);
  }
  state.applied.push(event.msg);
  return true;
}

export function step(spec) {
  const code = codes(spec);
  const events = spec.events || [];
  events.forEach(function (event) {
    if (!validEvent(event)) fail(code.event, "bad event " + JSON.stringify(event));
  });
  const state = copyState(spec.state || {});
  let budget = typeof spec.budget === "number" ? spec.budget : 0;
  let served = 0;
  let judged = 0;
  const queue = state.ledger.map(function (row) {
    return { kind: row[0], msg: row[1], deps: row[2] };
  }).concat(events);
  state.ledger = [];
  queue.forEach(function (event) {
    if (state.applied.indexOf(event.msg) !== -1) return;
    if (budget <= 0) {
      state.ledger.push([event.kind, event.msg, event.deps.slice()]);
      return;
    }
    budget -= 1;
    if (applyEvent(state, event, code)) { served += 1; judged += 1; }
  });
  return {
    state: state,
    served: served,
    ledger_before: state.ledger.length,
    ledger: state.ledger.map(function (row) { return row.slice(); }),
    judged: judged,
    judged_bound: events.length + (spec.state && spec.state.ledger ? spec.state.ledger.length : 0)
  };
}

export function close(spec) {
  const code = codes(spec);
  const state = copyState(spec.state || {});
  const queue = state.ledger.map(function (row) {
    return { kind: row[0], msg: row[1], deps: row[2] };
  });
  state.ledger = [];
  let catchup = 0;
  queue.forEach(function (event) {
    if (applyEvent(state, event, code)) catchup += 1;
  });
  return { state: state, catchup: catchup };
}

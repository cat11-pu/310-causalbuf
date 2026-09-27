import assert from "node:assert";
import { depsMet, drain } from "../causal.js";
import { step, close } from "../causalrun.js";
import { render } from "../app.js";

const base = {
  budget: 1,
  state: { delivered: [], pending: [], ledger: [], applied: [] },
  events: [{ id: 1, kind: "send", msg: 1, deps: [] }],
  dup_error_code: "E_DUP_MSG", self_error_code: "E_SELF_DEP",
  event_error_code: "E_BAD_EVENT"
};

let failed = 0;
function check(name, fn) {
  try { fn(); console.log("ok " + name); } catch (e) { failed += 1; console.log("FAIL " + name + " :: " + e.message); }
}

check("depsMet returns a boolean", () => {
  assert.strictEqual(typeof depsMet([1], [1]), "boolean");
});

check("drain returns delivered and pending", () => {
  const got = drain([], []);
  assert.ok(Array.isArray(got.delivered) && Array.isArray(got.pending));
});

check("step returns a state", () => {
  assert.strictEqual(typeof step(base).state, "object");
});

check("close returns a state", () => {
  assert.strictEqual(typeof close(base).state, "object");
});

check("render counts events", () => {
  assert.strictEqual(typeof render(base).count, "number");
});

console.log("5 cases, " + failed + " failed");
process.exit(failed === 0 ? 0 : 1);

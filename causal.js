// causal.js：因果就绪与级联投递
export function depsMet(delivered, deps) {
  return deps.every(function (dep) { return delivered.indexOf(dep) !== -1; });
}

export function drain(delivered, pending) {
  const out = delivered.slice();
  let rest = pending.map(function (row) { return [row[0], row[1].slice()]; });
  for (;;) {
    const ready = rest.filter(function (row) { return depsMet(out, row[1]); });
    if (ready.length === 0) break;
    ready.sort(function (a, b) { return a[0] - b[0]; });
    const next = ready[0];
    out.push(next[0]);
    rest = rest.filter(function (row) { return row[0] !== next[0]; });
  }
  return { delivered: out, pending: rest };
}

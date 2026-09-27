// causal.js：因果就绪与级联投递
export function depsMet(delivered, deps) {
  return deps.every(function (dep) { return delivered.indexOf(dep) !== -1; });
}

export function drain(delivered, pending) {
  const out = delivered.slice();
  const waiting = pending.map(function (row) { return [row[0], row[1].slice()]; });
  for (;;) {
    let pick = -1;
    for (let i = 0; i < waiting.length; i += 1) {
      if (!depsMet(out, waiting[i][1])) continue;
      if (pick === -1 || waiting[i][0] < waiting[pick][0]) pick = i;
    }
    if (pick === -1) break;
    out.push(waiting[pick][0]);
    waiting.splice(pick, 1);
  }
  return { delivered: out, pending: waiting };
}

// causal.js：因果就绪与级联投递（基线：一律原样返回）
export function depsMet(delivered, deps) {
  return false;
}

export function drain(delivered, pending) {
  return { delivered: delivered, pending: pending };
}

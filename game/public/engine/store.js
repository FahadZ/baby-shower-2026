// A very small observable store: set() merges, subscribe() gets every change.
export function createStore(initial = {}) {
  const state = { ...initial };
  const subs = new Set();
  return {
    get: () => state,
    set(patch) { Object.assign(state, patch); subs.forEach((fn) => fn(state, patch)); },
    subscribe(fn) { subs.add(fn); return () => subs.delete(fn); }
  };
}

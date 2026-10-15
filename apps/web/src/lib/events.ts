/**
 * Tiny in-app event bus. Run creation emits `runCreated`; the promo popup listens (09 § Run
 * progress). This replaces v1's sessionStorage polling.
 */
export interface AppEvents {
  runCreated: { runId: string };
}

type Listener<K extends keyof AppEvents> = (payload: AppEvents[K]) => void;

const listeners: { [K in keyof AppEvents]?: Set<Listener<K>> } = {};

export function emit<K extends keyof AppEvents>(event: K, payload: AppEvents[K]): void {
  for (const listener of listeners[event] ?? []) listener(payload);
}

/** Subscribes; returns the unsubscribe function (fits `useEffect` cleanup). */
export function on<K extends keyof AppEvents>(event: K, listener: Listener<K>): () => void {
  const set = (listeners[event] ??= new Set<Listener<K>>() as never) as Set<Listener<K>>;
  set.add(listener);
  return () => set.delete(listener);
}

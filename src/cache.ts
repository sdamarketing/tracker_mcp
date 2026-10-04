// Simple in-memory TTL cache for rarely-changing catalog endpoints
// (priorities, statuses, issue types, resolutions, global fields).

interface CacheEntry {
  data: unknown;
  expiresAt: number;
}

const store = new Map<string, CacheEntry>();

const DEFAULT_TTL_MS = 10 * 60 * 1000; // 10 minutes

export function cacheTtlMs(): number {
  const raw = process.env.TRACKER_CACHE_TTL_MS;
  if (raw) {
    const n = Number(raw);
    if (Number.isFinite(n) && n >= 0) return n;
  }
  return DEFAULT_TTL_MS;
}

export async function cached<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const ttl = cacheTtlMs();
  if (ttl === 0) return fetcher(); // caching disabled
  const hit = store.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.data as T;
  const data = await fetcher();
  store.set(key, { data, expiresAt: Date.now() + ttl });
  return data;
}

/** Drop all entries whose key starts with the prefix (e.g. after a create/patch). */
export function invalidatePrefix(prefix: string): void {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}

export function clearCache(): void {
  store.clear();
}

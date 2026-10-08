// The app-layer cache. Same three calls whether the bytes live in this process or in Redis,
// so the route code on the slides does not change when you move to a shared cache.

export function memoryStore(now = () => Date.now()) {
  const entries = new Map();
  return {
    kind: "memory",
    async get(key) {
      const entry = entries.get(key);
      if (!entry) return null;
      if (entry.expiresAt <= now()) {
        entries.delete(key);
        return null;
      }
      return entry.value;
    },
    async setEx(key, seconds, value) {
      entries.set(key, { value, expiresAt: now() + seconds * 1000 });
    },
    async del(key) {
      entries.delete(key);
    },
    async close() {},
  };
}

// REDIS_URL=redis://127.0.0.1:6379 selects Redis; every replica then shares one cache
// and one invalidation. Without it, each process keeps its own private copy.
export async function createStore(url = process.env.REDIS_URL) {
  if (!url) return memoryStore();
  const { createClient } = await import("redis");
  const client = createClient({ url });
  client.on("error", (error) => console.error(`redis: ${error.message}`));
  await client.connect();
  return {
    kind: "redis",
    get: (key) => client.get(key),
    setEx: (key, seconds, value) => client.setEx(key, seconds, value),
    del: (key) => client.del(key),
    close: () => client.quit(),
  };
}

// Shared Redis cache. Caches expensive Ollama/retrieval results so identical
// inputs return instantly. Degrades gracefully: if Redis is unreachable, every
// operation becomes a no-op and callers just recompute — nothing crashes.
import { createClient } from "redis";
import { createHash } from "node:crypto";
import { config } from "./ollama.js";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
const DEFAULT_TTL = Number(process.env.CACHE_TTL_SECONDS || 86400); // 24h

let client = null;
let disabled = false;
let connecting = null;

async function getClient() {
  if (disabled) return null;
  if (client?.isReady) return client;
  if (connecting) return connecting;

  connecting = (async () => {
    try {
      const c = createClient({ url: REDIS_URL });
      // Swallow runtime errors (e.g. server restart) instead of crashing the app.
      c.on("error", () => {});
      await c.connect();
      client = c;
      console.log(`[cache] connected to ${REDIS_URL}`);
      return c;
    } catch (err) {
      disabled = true;
      console.warn(`[cache] disabled (no Redis at ${REDIS_URL}): ${err.message}`);
      return null;
    } finally {
      connecting = null;
    }
  })();
  return connecting;
}

/** Build a stable cache key: "<namespace>:<model>:<sha256(payload)>". */
export function cacheKey(namespace, payload) {
  const body = typeof payload === "string" ? payload : JSON.stringify(payload);
  const hash = createHash("sha256").update(body).digest("hex").slice(0, 32);
  return `${namespace}:${config.OLLAMA_MODEL}:${hash}`;
}

/**
 * Return cached JSON for `key`, else run `producer()`, cache its result, return it.
 * Cache misses and Redis outages both fall through to `producer()`.
 */
export async function withCache(key, producer, { ttl = DEFAULT_TTL } = {}) {
  const c = await getClient();
  if (c) {
    try {
      const hit = await c.get(key);
      if (hit != null) {
        const val = JSON.parse(hit);
        return { value: val, cached: true };
      }
    } catch { /* fall through to recompute */ }
  }

  const value = await producer();

  if (c) {
    try {
      await c.set(key, JSON.stringify(value), { EX: ttl });
    } catch { /* best-effort write */ }
  }
  return { value, cached: false };
}

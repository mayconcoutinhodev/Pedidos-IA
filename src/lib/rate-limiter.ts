interface RateLimitEntry {
  count: number;
  windowStart: number;
}

const store = new Map<string, RateLimitEntry>();
const WINDOW_MS = 60 * 1000; // janela de 1 minuto
const MAX_REQUESTS = 30;

// Limpa entradas expiradas a cada 5 minutos
setInterval(() => {
  const now = Date.now();
  Array.from(store.entries()).forEach(([key, entry]) => {
    if (now - entry.windowStart > WINDOW_MS) {
      store.delete(key);
    }
  });
}, 5 * 60 * 1000);

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetInMs: number;
}

export function checkRateLimit(ip: string): RateLimitResult {
  const now = Date.now();
  const entry = store.get(ip);

  if (!entry || now - entry.windowStart > WINDOW_MS) {
    store.set(ip, { count: 1, windowStart: now });
    return { allowed: true, remaining: MAX_REQUESTS - 1, resetInMs: WINDOW_MS };
  }

  entry.count += 1;
  const remaining = Math.max(0, MAX_REQUESTS - entry.count);
  const resetInMs = WINDOW_MS - (now - entry.windowStart);

  return { allowed: entry.count <= MAX_REQUESTS, remaining, resetInMs };
}

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return "unknown";
}

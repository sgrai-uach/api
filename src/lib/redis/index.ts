import Redis, { type RedisOptions } from "ioredis";

let redisClient: Redis | null = null;

const DEFAULT_REDIS_OPTIONS: RedisOptions = {
  maxRetriesPerRequest: 3,
  retryStrategy(times: number) {
    // Reintento exponencial con tope de 3 segundos
    const delay = Math.min(times * 150, 3000);
    return delay;
  },
  lazyConnect: true,
};

/**
 * Retorna la instancia compartida de cliente Redis para operaciones de caché y almacenamiento rápido.
 * Si Redis no está configurado o falla la conexión, retorna null permitiendo degradación elegante.
 */
export function getRedisClient(): Redis | null {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    return null;
  }

  if (!redisClient) {
    try {
      redisClient = new Redis(redisUrl, {
        ...DEFAULT_REDIS_OPTIONS,
      });

      redisClient.on("error", (err) => {
        // Log silencioso para evitar caídas de servidor si Redis se reinicia
        console.warn("[Redis Client Warning]:", err?.message || err);
      });

      redisClient.on("connect", () => {
        console.log("> Cliente Redis de caché conectado exitosamente.");
      });
    } catch (error) {
      console.warn("[Redis Init Error]:", error);
      redisClient = null;
    }
  }

  return redisClient;
}

/**
 * Crea una nueva conexión Redis independiente (ideal para suscriptores Pub/Sub dedicados).
 */
export function createRedisClient(customOptions?: RedisOptions): Redis | null {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    return null;
  }

  try {
    const client = new Redis(redisUrl, {
      ...DEFAULT_REDIS_OPTIONS,
      ...customOptions,
    });
    client.on("error", (err) => {
      console.warn("[Redis Dedicated Client Warning]:", err?.message || err);
    });
    return client;
  } catch (error) {
    console.warn("[Redis Dedicated Client Init Error]:", error);
    return null;
  }
}

/**
 * Cierra la conexión del cliente Redis compartido.
 */
export async function closeRedisClient(): Promise<void> {
  if (redisClient) {
    try {
      await redisClient.quit();
    } catch {
      redisClient.disconnect();
    } finally {
      redisClient = null;
    }
  }
}

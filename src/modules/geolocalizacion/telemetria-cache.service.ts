import { getRedisClient } from "@/lib/redis";
import type { TelemetriaPosicionDTO, PosicionUnidadActivaDTO } from "./telemetria.schema";

const TTL_SEGUNDOS_TELEMETRIA = 300; // 5 minutos de vigencia
const REDIS_SET_UNIDADES_ACTIVAS = "telemetria:unidades_activas";

// Fallback en memoria si Redis no está disponible o durante pruebas locales
const memoriaPosiciones = new Map<string, { data: PosicionUnidadActivaDTO; expiresAt: number }>();

function generarClaveUnidad(tipoUnidad: string, unidadId: string): string {
  return `telemetria:posicion:${tipoUnidad}:${unidadId}`;
}

/**
 * Guarda o actualiza la última posición conocida de una unidad en Redis con expiración automática.
 */
export async function guardarPosicionUnidad(
  posicion: TelemetriaPosicionDTO
): Promise<PosicionUnidadActivaDTO> {
  const recibidoEn = new Date().toISOString();
  const registro: PosicionUnidadActivaDTO = {
    ...posicion,
    recibidoEn,
  };

  const redis = getRedisClient();
  const clave = generarClaveUnidad(posicion.tipoUnidad, posicion.unidadId);
  const identificadorUnidad = `${posicion.tipoUnidad}:${posicion.unidadId}`;

  if (redis) {
    try {
      const pipeline = redis.pipeline();
      pipeline.set(clave, JSON.stringify(registro), "EX", TTL_SEGUNDOS_TELEMETRIA);
      pipeline.sadd(REDIS_SET_UNIDADES_ACTIVAS, identificadorUnidad);
      await pipeline.exec();
    } catch (err) {
      console.warn("[Telemetria Redis Error]: Error al persistir posición en Redis:", err);
      // Fallback en memoria
      memoriaPosiciones.set(identificadorUnidad, {
        data: registro,
        expiresAt: Date.now() + TTL_SEGUNDOS_TELEMETRIA * 1000,
      });
    }
  } else {
    memoriaPosiciones.set(identificadorUnidad, {
      data: registro,
      expiresAt: Date.now() + TTL_SEGUNDOS_TELEMETRIA * 1000,
    });
  }

  return registro;
}

/**
 * Obtiene la última posición conocida de una unidad específica.
 */
export async function obtenerPosicionUnidad(
  tipoUnidad: string,
  unidadId: string
): Promise<PosicionUnidadActivaDTO | null> {
  const redis = getRedisClient();
  const clave = generarClaveUnidad(tipoUnidad, unidadId);
  const identificadorUnidad = `${tipoUnidad}:${unidadId}`;

  if (redis) {
    try {
      const valor = await redis.get(clave);
      if (valor) {
        return JSON.parse(valor) as PosicionUnidadActivaDTO;
      }
      return null;
    } catch (err) {
      console.warn("[Telemetria Redis Error]: Error al consultar posición en Redis:", err);
    }
  }

  // Fallback memoria
  const enMemoria = memoriaPosiciones.get(identificadorUnidad);
  if (enMemoria) {
    if (Date.now() < enMemoria.expiresAt) {
      return enMemoria.data;
    }
    memoriaPosiciones.delete(identificadorUnidad);
  }

  return null;
}

/**
 * Obtiene todas las posiciones activas vigentes registradas para hidratación del mapa.
 */
export async function obtenerTodasLasPosicionesActivas(): Promise<PosicionUnidadActivaDTO[]> {
  const redis = getRedisClient();

  if (redis) {
    try {
      const identificadores = await redis.smembers(REDIS_SET_UNIDADES_ACTIVAS);
      if (!identificadores || identificadores.length === 0) {
        return [];
      }

      const claves = identificadores.map((id) => `telemetria:posicion:${id}`);
      const valores = await redis.mget(...claves);

      const posiciones: PosicionUnidadActivaDTO[] = [];
      const expirados: string[] = [];

      for (let i = 0; i < valores.length; i++) {
        const val = valores[i];
        if (val) {
          try {
            posiciones.push(JSON.parse(val) as PosicionUnidadActivaDTO);
          } catch {
            expirados.push(identificadores[i]);
          }
        } else {
          // La clave expiró en Redis por TTL
          expirados.push(identificadores[i]);
        }
      }

      // Limpieza perezosa de IDs expirados del Set
      if (expirados.length > 0) {
        redis.srem(REDIS_SET_UNIDADES_ACTIVAS, ...expirados).catch(() => {});
      }

      return posiciones;
    } catch (err) {
      console.warn("[Telemetria Redis Error]: Error al consultar todas las posiciones activas:", err);
    }
  }

  // Fallback memoria
  const ahora = Date.now();
  const posicionesMemoria: PosicionUnidadActivaDTO[] = [];
  for (const [key, item] of memoriaPosiciones.entries()) {
    if (ahora < item.expiresAt) {
      posicionesMemoria.push(item.data);
    } else {
      memoriaPosiciones.delete(key);
    }
  }

  return posicionesMemoria;
}

/**
 * Limpia la caché en memoria y en Redis (útil para suites de pruebas).
 */
export async function limpiarCacheTelemetria(): Promise<void> {
  memoriaPosiciones.clear();
  const redis = getRedisClient();
  if (redis) {
    try {
      const identificadores = await redis.smembers(REDIS_SET_UNIDADES_ACTIVAS);
      if (identificadores && identificadores.length > 0) {
        const claves = identificadores.map((id) => `telemetria:posicion:${id}`);
        await redis.del(...claves, REDIS_SET_UNIDADES_ACTIVAS);
      }
    } catch {
      // Ignorar en test
    }
  }
}

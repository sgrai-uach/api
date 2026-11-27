import { getRedisClient } from "@/lib/redis";
import type {
  TelemetriaPosicionDTO,
  PosicionUnidadActivaDTO,
  TipoUnidadTelemetria,
} from "./telemetria.schema";

export const TTL_SEGUNDOS_TELEMETRIA = 300; // 5 minutos de vigencia
export const REDIS_SET_UNIDADES_ACTIVAS = "telemetria:unidades_activas";

// Fallback en memoria si Redis no está disponible o durante pruebas locales
const memoriaPosiciones = new Map<string, { data: PosicionUnidadActivaDTO; expiresAt: number }>();

export interface GuardarPosicionResult {
  actualizada: boolean;
  posicion: PosicionUnidadActivaDTO;
}

function generarClaveUnidad(tipoUnidad: string, unidadId: string): string {
  return `telemetria:posicion:${tipoUnidad}:${unidadId}`;
}

async function asegurarConexionRedis(redis: NonNullable<ReturnType<typeof getRedisClient>>): Promise<void> {
  if (redis.status === "wait") {
    await redis.connect();
  }
}

function guardarEnMemoria(identificadorUnidad: string, registro: PosicionUnidadActivaDTO): void {
  memoriaPosiciones.set(identificadorUnidad, {
    data: registro,
    expiresAt: Date.now() + TTL_SEGUNDOS_TELEMETRIA * 1000,
  });
}

function leerDeMemoria(identificadorUnidad: string): PosicionUnidadActivaDTO | null {
  const enMemoria = memoriaPosiciones.get(identificadorUnidad);
  if (!enMemoria) {
    return null;
  }
  if (Date.now() < enMemoria.expiresAt) {
    return enMemoria.data;
  }
  memoriaPosiciones.delete(identificadorUnidad);
  return null;
}

/**
 * Guarda o actualiza la última posición conocida de una unidad en Redis con expiración automática.
 * Protege contra paquetes GPS desordenados: si el timestamp entrante es más antiguo que el
 * último almacenado para la misma unidad, no sobrescribe la posición vigente.
 */
export async function guardarPosicionUnidad(
  posicion: TelemetriaPosicionDTO
): Promise<GuardarPosicionResult> {
  const existente = await obtenerPosicionUnidad(posicion.tipoUnidad, posicion.unidadId);
  if (existente) {
    const tsEntrante = new Date(posicion.timestamp).getTime();
    const tsExistente = new Date(existente.timestamp).getTime();
    if (!Number.isNaN(tsEntrante) && !Number.isNaN(tsExistente) && tsEntrante < tsExistente) {
      return {
        actualizada: false,
        posicion: existente,
      };
    }
  }

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
      await asegurarConexionRedis(redis);
      const pipeline = redis.pipeline();
      pipeline.set(clave, JSON.stringify(registro), "EX", TTL_SEGUNDOS_TELEMETRIA);
      pipeline.sadd(REDIS_SET_UNIDADES_ACTIVAS, identificadorUnidad);
      const resultados = await pipeline.exec();

      const comandoFallido = !resultados || resultados.some(([err]) => err !== null);
      if (comandoFallido) {
        throw new Error("Uno o más comandos del pipeline de Redis devolvieron error.");
      }

      // Evitar divergencia entre memoria y Redis cuando Redis opera correctamente
      memoriaPosiciones.delete(identificadorUnidad);
    } catch (err) {
      console.warn("[Telemetria Redis Error]: Error al persistir posición en Redis:", err);
      guardarEnMemoria(identificadorUnidad, registro);
    }
  } else {
    guardarEnMemoria(identificadorUnidad, registro);
  }

  return {
    actualizada: true,
    posicion: registro,
  };
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
      await asegurarConexionRedis(redis);
      const valor = await redis.get(clave);
      if (valor) {
        return JSON.parse(valor) as PosicionUnidadActivaDTO;
      }
      // Si no está en Redis, verificar si quedó en fallback local tras corte transitorio
      return leerDeMemoria(identificadorUnidad);
    } catch (err) {
      console.warn("[Telemetria Redis Error]: Error al consultar posición en Redis:", err);
    }
  }

  return leerDeMemoria(identificadorUnidad);
}

/**
 * Elimina inmediatamente la última posición conocida de una unidad al finalizar su misión
 * o volver a estado DISPONIBLE (CA-4), evitando marcadores fantasma en el mapa.
 */
export async function eliminarPosicionUnidad(
  tipoUnidad: string,
  unidadId: string
): Promise<boolean> {
  const clave = generarClaveUnidad(tipoUnidad, unidadId);
  const identificadorUnidad = `${tipoUnidad}:${unidadId}`;

  let eliminada = memoriaPosiciones.delete(identificadorUnidad);

  const redis = getRedisClient();
  if (redis) {
    try {
      await asegurarConexionRedis(redis);
      const pipeline = redis.pipeline();
      pipeline.del(clave);
      pipeline.srem(REDIS_SET_UNIDADES_ACTIVAS, identificadorUnidad);
      const resultados = await pipeline.exec();
      if (resultados && resultados[0] && !resultados[0][0] && Number(resultados[0][1]) > 0) {
        eliminada = true;
      }
    } catch (err) {
      console.warn("[Telemetria Redis Error]: Error al eliminar posición en Redis:", err);
    }
  }

  return eliminada;
}

/**
 * Obtiene todas las posiciones activas vigentes registradas para hidratación del mapa,
 * ordenadas de más reciente a más antigua y con soporte de filtros opcionales.
 */
export async function obtenerTodasLasPosicionesActivas(filtros?: {
  tipoUnidad?: TipoUnidadTelemetria;
  unidadId?: string;
}): Promise<PosicionUnidadActivaDTO[]> {
  const mapaConsolidado = new Map<string, PosicionUnidadActivaDTO>();
  const redis = getRedisClient();

  if (redis) {
    try {
      await asegurarConexionRedis(redis);
      const identificadores = await redis.smembers(REDIS_SET_UNIDADES_ACTIVAS);
      if (identificadores && identificadores.length > 0) {
        const claves = identificadores.map((id) => `telemetria:posicion:${id}`);
        const valores = await redis.mget(...claves);

        const expirados: string[] = [];

        for (let i = 0; i < valores.length; i++) {
          const val = valores[i];
          if (val) {
            try {
              const parsed = JSON.parse(val) as PosicionUnidadActivaDTO;
              mapaConsolidado.set(identificadores[i], parsed);
            } catch {
              expirados.push(identificadores[i]);
            }
          } else {
            expirados.push(identificadores[i]);
          }
        }

        if (expirados.length > 0) {
          redis.srem(REDIS_SET_UNIDADES_ACTIVAS, ...expirados).catch(() => {});
        }
      }
    } catch (err) {
      console.warn(
        "[Telemetria Redis Error]: Error al consultar todas las posiciones activas:",
        err
      );
    }
  }

  // Incorporar entradas vigentes del fallback en memoria si no están ya en Redis
  const ahora = Date.now();
  for (const [key, item] of memoriaPosiciones.entries()) {
    if (ahora < item.expiresAt) {
      if (!mapaConsolidado.has(key)) {
        mapaConsolidado.set(key, item.data);
      }
    } else {
      memoriaPosiciones.delete(key);
    }
  }

  let posiciones = Array.from(mapaConsolidado.values());

  if (filtros?.tipoUnidad) {
    posiciones = posiciones.filter((p) => p.tipoUnidad === filtros.tipoUnidad);
  }
  if (filtros?.unidadId) {
    posiciones = posiciones.filter((p) => p.unidadId === filtros.unidadId);
  }

  posiciones.sort(
    (a, b) => new Date(b.recibidoEn).getTime() - new Date(a.recibidoEn).getTime()
  );

  return posiciones;
}

/**
 * Limpia la caché en memoria y en Redis (útil para suites de pruebas).
 */
export async function limpiarCacheTelemetria(): Promise<void> {
  memoriaPosiciones.clear();
  const redis = getRedisClient();
  if (redis) {
    try {
      await asegurarConexionRedis(redis);
      const identificadores = await redis.smembers(REDIS_SET_UNIDADES_ACTIVAS);
      if (identificadores && identificadores.length > 0) {
        const claves = identificadores.map((id) => `telemetria:posicion:${id}`);
        await redis.del(...claves, REDIS_SET_UNIDADES_ACTIVAS);
      }
    } catch {
      // Ignorar si Redis no está disponible durante pruebas aisladas
    }
  }
}

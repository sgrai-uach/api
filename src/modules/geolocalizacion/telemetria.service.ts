import { verificarPermiso } from "@/modules/seguridad/auth.service";
import { PERMISO_LEER_MISION } from "@/modules/seguridad/permisos.constants";
import {
  notificarTelemetriaPosicion,
  notificarTelemetriaInactiva,
} from "@/lib/socket";
import {
  TelemetriaPosicionPayloadSchema,
  DetenerTelemetriaPayloadSchema,
  type PosicionUnidadActivaDTO,
  type TipoUnidadTelemetria,
  type ListarPosicionesQuery,
} from "./telemetria.schema";
import {
  guardarPosicionUnidad,
  eliminarPosicionUnidad,
  obtenerTodasLasPosicionesActivas,
} from "./telemetria-cache.service";
import {
  verificarHabilitacionTelemetriaUnidadRepo,
  verificarPertenenciaUnidadRepo,
} from "./telemetria.repository";

export interface ContextoSocketTelemetria {
  usuarioId?: string;
  rolCodigo?: string;
}

export interface ResultadoProcesamientoTelemetria {
  ok: boolean;
  codigo?: string;
  error?: string;
  omitidaPorObsoleta?: boolean;
  data?: PosicionUnidadActivaDTO;
}

/**
 * Procesa una trama entrante de telemetría GPS (`telemetria:posicion`) aplicando:
 * 1. Exigencia de sesión JWT autenticada (evita spoofing anónimo).
 * 2. Validación estricta de payload WGS84 / timestamp con Zod.
 * 3. Verificación en BD de pertenencia a la unidad y misión activa en estado EN_CURSO (CA-1 / CA-4).
 * 4. Persistencia volátil en Redis (TTL 300s) con control de monotonicidad temporal.
 * 5. Retransmisión a la sala 'mapa' (local + broker Redis Pub/Sub multi-instancia).
 */
export async function procesarTelemetriaPosicionService(
  rawPayload: unknown,
  contexto: ContextoSocketTelemetria
): Promise<ResultadoProcesamientoTelemetria> {
  if (!contexto.usuarioId) {
    return {
      ok: false,
      codigo: "NO_AUTENTICADO",
      error: "Se requiere autenticación JWT válida para transmitir telemetría GPS.",
    };
  }

  const validacion = TelemetriaPosicionPayloadSchema.safeParse(rawPayload);
  if (!validacion.success) {
    const detalle = validacion.error.issues.map((i) => i.message).join(" ");
    console.warn("[Socket Telemetria]: Payload inválido recibido:", validacion.error.issues);
    return {
      ok: false,
      codigo: "PAYLOAD_INVALIDO",
      error: detalle || "Payload de telemetría inválido.",
    };
  }

  const dto = validacion.data;
  const habilitacion = await verificarHabilitacionTelemetriaUnidadRepo({
    usuarioId: contexto.usuarioId,
    unidadId: dto.unidadId,
    tipoUnidad: dto.tipoUnidad,
  });

  if (!habilitacion.habilitada) {
    // Si la unidad volvió a DISPONIBLE o ya no tiene misión EN_CURSO, purgar cualquier marcador residual
    if (
      habilitacion.codigo === "UNIDAD_DISPONIBLE" ||
      habilitacion.codigo === "MISION_NO_EN_CURSO"
    ) {
      await detenerTelemetriaUnidadService(dto.tipoUnidad, dto.unidadId, habilitacion.codigo);
    }

    return {
      ok: false,
      codigo: habilitacion.codigo,
      error: habilitacion.mensaje,
    };
  }

  const { actualizada, posicion } = await guardarPosicionUnidad(dto);
  if (!actualizada) {
    return {
      ok: true,
      omitidaPorObsoleta: true,
      data: posicion,
    };
  }

  notificarTelemetriaPosicion(posicion);

  return {
    ok: true,
    omitidaPorObsoleta: false,
    data: posicion,
  };
}

/**
 * Purga inmediatamente la posición de una unidad desde la caché Redis y notifica
 * a la sala 'mapa' (`telemetria:inactiva`) cuando la unidad finaliza su misión o vuelve a DISPONIBLE.
 */
export async function detenerTelemetriaUnidadService(
  tipoUnidad: TipoUnidadTelemetria,
  unidadId: string,
  motivo = "MISION_FINALIZADA"
): Promise<{ eliminada: boolean }> {
  const eliminada = await eliminarPosicionUnidad(tipoUnidad, unidadId);

  if (eliminada) {
    notificarTelemetriaInactiva({
      unidadId,
      tipoUnidad,
      motivo,
      detenidoEn: new Date().toISOString(),
    });
  }

  return { eliminada };
}

/**
 * Procesa el evento explícito `telemetria:detener` emitido desde la PWA al cerrar o pausar misión.
 */
export async function procesarDetencionTelemetriaClienteService(
  rawPayload: unknown,
  contexto: ContextoSocketTelemetria
): Promise<{ ok: boolean; codigo?: string; error?: string }> {
  if (!contexto.usuarioId) {
    return {
      ok: false,
      codigo: "NO_AUTENTICADO",
      error: "Se requiere autenticación JWT válida para detener telemetría GPS.",
    };
  }

  const validacion = DetenerTelemetriaPayloadSchema.safeParse(rawPayload);
  if (!validacion.success) {
    return {
      ok: false,
      codigo: "PAYLOAD_INVALIDO",
      error: "Payload inválido para detener telemetría.",
    };
  }

  const { unidadId, tipoUnidad, motivo } = validacion.data;
  const pertenencia = await verificarPertenenciaUnidadRepo({
    usuarioId: contexto.usuarioId,
    unidadId,
    tipoUnidad,
  });

  if (!pertenencia.autorizada) {
    return {
      ok: false,
      codigo: pertenencia.codigo,
      error: pertenencia.mensaje,
    };
  }

  await detenerTelemetriaUnidadService(tipoUnidad, unidadId, motivo ?? "PAUSA_CLIENTE_PWA");
  return { ok: true };
}

/**
 * Consulta las últimas posiciones GPS vigentes en Redis/caché aplicando verificación RBAC
 * (`misiones:leer` o perfil Administrador) y filtros opcionales.
 */
export async function listarPosicionesActivasService(
  usuarioId?: string | null,
  filtros?: ListarPosicionesQuery
): Promise<PosicionUnidadActivaDTO[]> {
  await verificarPermiso(usuarioId, PERMISO_LEER_MISION);
  return obtenerTodasLasPosicionesActivas(filtros);
}


import { verificarPermiso } from "@/modules/seguridad/auth.service";
import { PERMISO_LEER_MISION } from "@/modules/seguridad/permisos.constants";
import { buildPaginationMeta } from "@/lib/shared/pagination.schema";
import { notificarPatrullaActualizada } from "@/lib/socket";
import {
  listarPatrullasRepo,
  obtenerPatrullaPorIdRepo,
  actualizarEstadoPatrullaRepo,
  type FilaPatrullaConsulta,
  type FilaIntegranteConsulta,
} from "./patrulla.repository";
import type {
  ListarPatrullasQuery,
  ListarPatrullasResponseDTO,
  PatrullaItemResponseDTO,
  PatrullaDetalleResponseDTO,
  ActualizarEstadoPatrullaInputDTO,
  ActualizarEstadoPatrullaResponseDTO,
  IntegrantePatrullaDTO,
} from "./patrulla.schema";

function formatearIso(fecha: Date | string | null | undefined): string | null {
  if (!fecha) return null;
  return typeof fecha === "string" ? new Date(fecha).toISOString() : fecha.toISOString();
}

function mapearFilaAPatrullaDTO(
  fila: FilaPatrullaConsulta,
  integrantesRaw: FilaIntegranteConsulta[] = []
): PatrullaItemResponseDTO {
  const lider = fila.lider_id
    ? {
        id: fila.lider_id,
        nombre: fila.lider_nombre ?? "Sin nombre",
        email: fila.lider_email ?? "",
        telefono: fila.lider_telefono ?? null,
        rut: fila.lider_rut ?? null,
      }
    : null;

  const delegacion = fila.delegacion_id
    ? {
        id: fila.delegacion_id,
        nombre: fila.delegacion_nombre ?? "Delegación Municipal",
        codigo: fila.delegacion_codigo ?? null,
      }
    : null;

  const misionActiva = fila.mision_id
    ? {
        id: fila.mision_id,
        codigo: fila.mision_codigo ?? "",
        titulo: fila.mision_titulo ?? "",
        tipoMision: fila.mision_tipo ?? "VERIFICACION",
        estado: fila.mision_estado ?? "EN_CURSO",
        prioridad: fila.mision_prioridad ?? "MEDIA",
        incidenteId: fila.incidente_id ?? null,
        incidenteCodigo: fila.incidente_codigo ?? null,
        incidenteFolio: fila.incidente_folio ?? null,
        incidenteTipoAfectacion: fila.incidente_tipo_afectacion ?? null,
        incidenteDireccion: fila.incidente_direccion ?? null,
      }
    : null;

  const integrantes: IntegrantePatrullaDTO[] = integrantesRaw.map((it) => ({
    id: it.personal_id,
    usuarioId: it.usuario_id,
    nombre: it.nombre,
    email: it.email,
    telefono: it.telefono ?? null,
    rut: it.rut ?? null,
    cargo: it.cargo ?? null,
    especialidad: it.especialidad ?? null,
    rolEnPatrulla: it.rol_en_patrulla,
    estadoOperativo: it.estado_operativo,
  }));

  return {
    id: fila.patrulla_id,
    nombre: fila.patrulla_nombre,
    estado: fila.patrulla_estado,
    latitud: fila.patrulla_latitud !== null ? Number(fila.patrulla_latitud) : null,
    longitud: fila.patrulla_longitud !== null ? Number(fila.patrulla_longitud) : null,
    ultimaActualizacionUbicacion: formatearIso(fila.patrulla_ultima_actualizacion_ubicacion),
    delegacion,
    lider,
    integrantes,
    misionActiva,
    creadoEn: formatearIso(fila.patrulla_creado_en) || new Date().toISOString(),
    actualizadoEn: formatearIso(fila.patrulla_actualizado_en) || new Date().toISOString(),
  };
}

/**
 * Servicio para listar patrullas verificadoras con paginación estricta y filtros multicriterio.
 * Requiere permiso RBAC 'misiones:leer' (Encargado, Administrador, Supervisor).
 */
export async function listarPatrullasService(
  filtros: ListarPatrullasQuery,
  usuarioId?: string | null
): Promise<ListarPatrullasResponseDTO> {
  // 1. Validar autorización RBAC
  await verificarPermiso(usuarioId, PERMISO_LEER_MISION);

  // 2. Consultar repositorio
  const { total, filas, integrantesMap } = await listarPatrullasRepo(filtros);

  // 3. Mapear entidades al contrato de presentación
  const data: PatrullaItemResponseDTO[] = filas.map((fila) => {
    const integrantes = integrantesMap.get(fila.patrulla_id) || [];
    return mapearFilaAPatrullaDTO(fila, integrantes);
  });

  const page = filtros.page || 1;
  const limit = filtros.limit || 20;
  const meta = buildPaginationMeta(total, page, limit);

  return {
    message: "Listado de patrullas verificadoras obtenido exitosamente.",
    data,
    meta,
  };
}

/**
 * Servicio para obtener el detalle estructurado de una patrulla verificadora.
 */
export async function obtenerDetallePatrullaService(
  id: string,
  usuarioId?: string | null
): Promise<PatrullaDetalleResponseDTO | null> {
  await verificarPermiso(usuarioId, PERMISO_LEER_MISION);

  const resultado = await obtenerPatrullaPorIdRepo(id);
  if (!resultado) {
    return null;
  }

  const data = mapearFilaAPatrullaDTO(resultado.fila, resultado.integrantes);

  return {
    message: "Detalle de patrulla verificadora obtenido exitosamente.",
    data,
  };
}

/**
 * Servicio para actualizar el estado operativo de una patrulla verificadora y emitir Socket.io.
 */
export async function actualizarEstadoPatrullaService(
  id: string,
  input: ActualizarEstadoPatrullaInputDTO,
  usuarioId?: string | null
): Promise<ActualizarEstadoPatrullaResponseDTO | null> {
  await verificarPermiso(usuarioId, PERMISO_LEER_MISION);

  const existe = await obtenerPatrullaPorIdRepo(id);
  if (!existe) {
    return null;
  }

  const actualizada = await actualizarEstadoPatrullaRepo(
    id,
    input.estado,
    input.latitud,
    input.longitud
  );

  if (!actualizada) {
    return null;
  }

  const detalleActualizado = await obtenerPatrullaPorIdRepo(id);
  if (!detalleActualizado) {
    return null;
  }

  const data = mapearFilaAPatrullaDTO(
    detalleActualizado.fila,
    detalleActualizado.integrantes
  );

  // Notificar cambio de estado en tiempo real vía WebSocket a la sala 'encargado' y 'supervisor'
  notificarPatrullaActualizada({
    patrullaId: data.id,
    nombre: data.nombre,
    estado: data.estado,
    delegacionId: data.delegacion?.id ?? null,
    usuarioLiderId: data.lider?.id ?? null,
    misionActivaId: data.misionActiva?.id ?? null,
    incidenteId: data.misionActiva?.incidenteId ?? null,
    actualizadoEn: data.actualizadoEn,
  });

  return {
    message: "Estado de la patrulla verificadora actualizado exitosamente.",
    data,
  };
}

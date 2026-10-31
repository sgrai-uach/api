import { verificarPermiso } from "@/modules/seguridad/auth.service";
import {
  PERMISO_LEER_MISION,
  PERMISO_CREAR_RECURSO,
} from "@/modules/seguridad/permisos.constants";
import {
  ConflictError,
  NotFoundError,
  BadRequestError,
} from "@/modules/seguridad/errors";
import { buildPaginationMeta } from "@/lib/shared/pagination.schema";
import { notificarPatrullaActualizada, notificarPatrullaCreada } from "@/lib/socket";
import {
  listarPatrullasRepo,
  obtenerPatrullaPorIdRepo,
  actualizarEstadoPatrullaRepo,
  buscarPatrullaPorCodigoRepo,
  obtenerVehiculoPorIdRepo,
  obtenerPersonalParaPatrullaRepo,
  obtenerDelegacionPorIdRepo,
  crearPatrullaTransaccionalRepo,
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
  CrearPatrullaInputDTO,
  CrearPatrullaResponseDTO,
  IntegrantePatrullaDTO,
  VehiculoPatrullaDTO,
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

  const vehiculo: VehiculoPatrullaDTO | null = fila.vehiculo_id
    ? {
        id: fila.vehiculo_id,
        nombre: fila.vehiculo_nombre ?? "Vehículo Institucional",
        detalles: (fila.vehiculo_detalles ?? {}) as Record<string, unknown>,
        estado: fila.vehiculo_estado ?? "ASIGNADO",
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
    codigo: fila.patrulla_codigo ?? fila.patrulla_nombre,
    nombre: fila.patrulla_nombre,
    estado: fila.patrulla_estado,
    latitud: fila.patrulla_latitud !== null ? Number(fila.patrulla_latitud) : null,
    longitud: fila.patrulla_longitud !== null ? Number(fila.patrulla_longitud) : null,
    ultimaActualizacionUbicacion: formatearIso(fila.patrulla_ultima_actualizacion_ubicacion),
    delegacion,
    vehiculo,
    lider,
    integrantes,
    misionActiva,
    creadoEn: formatearIso(fila.patrulla_creado_en) || new Date().toISOString(),
    actualizadoEn: formatearIso(fila.patrulla_actualizado_en) || new Date().toISOString(),
  };
}

/**
 * Servicio para registrar una nueva patrulla verificadora.
 * Valida unicidad de código, existencia de delegación, disponibilidad del vehículo,
 * pertenencia al rol PATRULLA_VERIFICADORA y permiso RBAC 'recursos:crear'.
 */
export async function crearPatrullaService(
  input: CrearPatrullaInputDTO,
  usuarioId?: string | null
): Promise<CrearPatrullaResponseDTO> {
  // 1. Validar autorización RBAC (requiere permiso recursos:crear)
  await verificarPermiso(usuarioId, PERMISO_CREAR_RECURSO);

  // 2. Validar unicidad del código identificador
  const patrullaExistente = await buscarPatrullaPorCodigoRepo(input.codigo);
  if (patrullaExistente) {
    throw new ConflictError(
      `El código identificador '${input.codigo}' ya se encuentra registrado para otra patrulla verificadora.`
    );
  }

  // 3. Validar existencia de la delegación base
  const delegacion = await obtenerDelegacionPorIdRepo(input.delegacionId);
  if (!delegacion) {
    throw new NotFoundError(
      `La delegación municipal con ID '${input.delegacionId}' no existe o no se encuentra disponible.`
    );
  }

  // 4. Validar vehículo institucional asignado (si se especificó)
  let latitud: number | null = null;
  let longitud: number | null = null;

  if (input.vehiculoId) {
    const vehiculo = await obtenerVehiculoPorIdRepo(input.vehiculoId);
    if (!vehiculo) {
      throw new NotFoundError(
        `El vehículo institucional con ID '${input.vehiculoId}' no existe en el inventario.`
      );
    }

    if (!vehiculo.es_individual) {
      throw new BadRequestError(
        `El recurso '${vehiculo.nombre}' no es un recurso individual (vehículo o maquinaria serializada).`
      );
    }

    if (vehiculo.estado !== "DISPONIBLE" || (vehiculo.cantidad_en_uso ?? 0) > 0) {
      throw new ConflictError(
        `El vehículo institucional '${vehiculo.nombre}' no se encuentra disponible (estado actual: ${vehiculo.estado}).`
      );
    }

    latitud = vehiculo.latitud !== null ? Number(vehiculo.latitud) : null;
    longitud = vehiculo.longitud !== null ? Number(vehiculo.longitud) : null;
  }

  // 5. Validar funcionarios asignados a la dotación
  const personalFilas = await obtenerPersonalParaPatrullaRepo(input.personalIds);
  if (personalFilas.length !== input.personalIds.length) {
    throw new BadRequestError(
      "Uno o más funcionarios especificados para la patrulla no existen o se encuentran inactivos."
    );
  }

  // Validar que tengan rol PATRULLA_VERIFICADORA
  const personalSinRol = personalFilas.filter(
    (p) => p.rol_codigo !== "PATRULLA_VERIFICADORA"
  );
  if (personalSinRol.length > 0) {
    throw new BadRequestError(
      `Los siguientes funcionarios no cuentan con el rol operativo 'PATRULLA_VERIFICADORA': ${personalSinRol
        .map((p) => p.nombre)
        .join(", ")}.`
    );
  }

  // Validar disponibilidad operativa (deben estar 'disponible' según norma ICS)
  const personalNoDisponible = personalFilas.filter(
    (p) => p.estado_operativo !== "disponible"
  );
  if (personalNoDisponible.length > 0) {
    throw new ConflictError(
      `Los siguientes funcionarios no se encuentran disponibles: ${personalNoDisponible
        .map((p) => p.nombre)
        .join(", ")}.`
    );
  }

  // Determinar usuario líder
  let usuarioLiderId = input.usuarioLiderId;
  if (usuarioLiderId) {
    const liderValido = personalFilas.find((p) => p.usuario_id === usuarioLiderId);
    if (!liderValido) {
      throw new BadRequestError(
        "El funcionario designado como líder debe pertenecer a la dotación asignada a la patrulla."
      );
    }
  } else {
    usuarioLiderId = personalFilas[0].usuario_id;
  }

  const nombreFinal =
    input.nombre && input.nombre.trim() !== ""
      ? input.nombre.trim()
      : input.codigo.trim().toUpperCase();

  // 6. Transacción atómica de creación
  const patrullaId = await crearPatrullaTransaccionalRepo({
    codigo: input.codigo,
    nombre: nombreFinal,
    delegacionId: input.delegacionId,
    vehiculoId: input.vehiculoId ?? null,
    usuarioLiderId,
    latitud,
    longitud,
    personalIds: input.personalIds,
    personalFilas: personalFilas.map((p) => ({
      personal_id: p.personal_id,
      usuario_id: p.usuario_id,
    })),
  });

  // 7. Recuperar la entidad recién creada con relaciones completas
  const detalleRecienCreado = await obtenerPatrullaPorIdRepo(patrullaId);
  if (!detalleRecienCreado) {
    throw new Error("Error interno al recuperar la patrulla verificadora recién creada.");
  }

  const data = mapearFilaAPatrullaDTO(
    detalleRecienCreado.fila,
    detalleRecienCreado.integrantes
  );

  // 8. Emitir evento Socket.io para visualización inmediata en Centro de Mando
  notificarPatrullaCreada({
    patrullaId: data.id,
    codigo: data.codigo,
    nombre: data.nombre,
    estado: data.estado,
    delegacionId: data.delegacion?.id ?? null,
    vehiculoId: data.vehiculo?.id ?? null,
    usuarioLiderId: data.lider?.id ?? null,
    creadoEn: data.creadoEn,
  });

  return {
    message: "Patrulla verificadora registrada exitosamente.",
    data,
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
    message: "Estado operativo de patrulla verificadora actualizado exitosamente.",
    data,
  };
}

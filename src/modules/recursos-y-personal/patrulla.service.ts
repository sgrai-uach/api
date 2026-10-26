import { verificarPermiso } from "@/modules/seguridad/auth.service";
import { seguridadService } from "@/modules/seguridad/service";
import {
  PERMISO_LEER_MISION,
  PERMISO_CREAR_RECURSO,
  PERMISO_EDITAR_RECURSO,
  PERMISO_ELIMINAR_RECURSO,
} from "@/modules/seguridad/permisos.constants";
import {
  ConflictError,
  NotFoundError,
  BadRequestError,
} from "@/modules/seguridad/errors";
import { buildPaginationMeta } from "@/lib/shared/pagination.schema";
import {
  notificarPatrullaActualizada,
  notificarPatrullaCreada,
  notificarPatrullaDesactivada,
  emitirRecursoActualizado,
} from "@/lib/socket";
import {
  listarPatrullasRepo,
  obtenerPatrullaPorIdRepo,
  actualizarEstadoPatrullaRepo,
  buscarPatrullaPorCodigoRepo,
  obtenerVehiculoPorIdRepo,
  obtenerPersonalParaPatrullaRepo,
  obtenerDelegacionPorIdRepo,
  crearPatrullaTransaccionalRepo,
  modificarPatrullaTransaccionalRepo,
  verificarMisionesActivasPatrullaRepo,
  desactivarPatrullaTransaccionalRepo,
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
  ModificarPatrullaInputDTO,
  ModificarPatrullaResponseDTO,
  DesactivarPatrullaResponseDTO,
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
  // 1. Validar autorización RBAC (requiere permiso recursos:crear o perfil Administrador)
  await seguridadService.validarAccesoAdministrador(usuarioId, [PERMISO_CREAR_RECURSO]);

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

/**
 * Servicio para modificar una patrulla verificadora registrada (HU-84).
 * Permite reasignar delegación base, vehículo institucional y dotación de funcionarios.
 * Bloquea modificaciones si la patrulla se encuentra en estado EN_VERIFICACION o con misión táctica activa (409 Conflict).
 * Requiere autorización RBAC: permiso 'recursos:editar' o perfil Administrador.
 */
export async function modificarPatrullaService(
  id: string,
  input: ModificarPatrullaInputDTO,
  usuarioId?: string | null
): Promise<ModificarPatrullaResponseDTO> {
  // 1. Validar autorización RBAC (requiere permiso recursos:editar o perfil Administrador)
  await seguridadService.validarAccesoAdministrador(usuarioId, [PERMISO_EDITAR_RECURSO]);

  // 2. Validar existencia de la patrulla
  const patrullaExistente = await obtenerPatrullaPorIdRepo(id);
  if (!patrullaExistente) {
    throw new NotFoundError(
      `La patrulla verificadora con ID '${id}' no existe o ha sido eliminada.`
    );
  }

  // 3. Regla crítica de conflicto: si la patrulla se encuentra en EN_VERIFICACION o tiene misión activa
  if (
    patrullaExistente.fila.patrulla_estado === "EN_VERIFICACION" ||
    patrullaExistente.fila.mision_id !== null
  ) {
    throw new ConflictError(
      "No es posible modificar una patrulla verificadora que se encuentra en estado 'EN_VERIFICACION' o con una misión táctica activa en terreno."
    );
  }

  // 4. Validar existencia de la delegación base
  const delegacion = await obtenerDelegacionPorIdRepo(input.delegacionId);
  if (!delegacion) {
    throw new NotFoundError(
      `La delegación municipal con ID '${input.delegacionId}' no existe o no se encuentra disponible.`
    );
  }

  // 5. Validar vehículo institucional (si se especificó y si es diferente al que ya tiene)
  let latitud: number | null | undefined = undefined;
  let longitud: number | null | undefined = undefined;

  if (input.vehiculoId) {
    // Si es un vehículo distinto al actual, validar disponibilidad
    if (patrullaExistente.fila.vehiculo_id !== input.vehiculoId) {
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
  } else {
    // Se desasigna el vehículo
    latitud = null;
    longitud = null;
  }

  // 6. Validar funcionarios asignados a la dotación
  const personalFilas = await obtenerPersonalParaPatrullaRepo(input.personalIds);
  if (personalFilas.length !== input.personalIds.length) {
    throw new BadRequestError(
      "Uno o más funcionarios especificados para la patrulla no existen o se encuentran inactivos."
    );
  }

  // Validar rol PATRULLA_VERIFICADORA
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

  // 7. Modificación transaccional
  await modificarPatrullaTransaccionalRepo({
    id,
    nombre: input.nombre,
    delegacionId: input.delegacionId,
    vehiculoId: input.vehiculoId ?? null,
    usuarioLiderId,
    latitud,
    longitud,
    personalIds: input.personalIds,
  });

  // 8. Recuperar la entidad actualizada
  const detalleActualizado = await obtenerPatrullaPorIdRepo(id);
  if (!detalleActualizado) {
    throw new Error("Error interno al recuperar la patrulla verificadora actualizada.");
  }

  const data = mapearFilaAPatrullaDTO(
    detalleActualizado.fila,
    detalleActualizado.integrantes
  );

  // 9. Emitir evento Socket.io
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
    message: "Patrulla verificadora modificada exitosamente.",
    data,
  };
}

/**
 * Servicio para desactivar mediante baja lógica una patrulla verificadora (HU-85).
 * - Valida autorización RBAC (requiere perfil Administrador o permiso 'recursos:eliminar').
 * - Verifica existencia de la patrulla y que no haya sido eliminada previamente (404 Not Found).
 * - Bloquea la acción con 409 Conflict si la patrulla se encuentra en estado 'EN_VERIFICACION' o con misiones activas.
 * - Ejecuta la transacción atómica de baja lógica liberando vehículo y dotación de personal a disponibilidad comunal.
 * - Emite notificaciones en tiempo real vía WebSocket a las salas pertinentes.
 */
export async function desactivarPatrullaService(
  id: string,
  usuarioId?: string | null
): Promise<DesactivarPatrullaResponseDTO> {
  // 1. Validar autorización RBAC (requiere permiso recursos:eliminar o perfil Administrador)
  const usuario = await seguridadService.validarAccesoAdministrador(usuarioId, [
    PERMISO_ELIMINAR_RECURSO,
  ]);

  // 2. Validar existencia de la patrulla
  const patrullaExistente = await obtenerPatrullaPorIdRepo(id);
  if (!patrullaExistente) {
    throw new NotFoundError(
      `La patrulla verificadora con ID '${id}' no existe o ya ha sido desactivada.`
    );
  }

  // 3. Regla crítica de conflicto: estado EN_VERIFICACION
  if (patrullaExistente.fila.patrulla_estado === "EN_VERIFICACION") {
    throw new ConflictError(
      `No es posible desactivar la patrulla verificadora '${patrullaExistente.fila.patrulla_nombre}' porque se encuentra actualmente en terreno en estado 'EN_VERIFICACION'.`
    );
  }

  // 4. Regla crítica de conflicto: misiones tácticas activas
  const misionesActivas = await verificarMisionesActivasPatrullaRepo(id);
  if (misionesActivas.length > 0 || patrullaExistente.fila.mision_id !== null) {
    const codigosMisiones = misionesActivas.map((m) => m.codigo || m.titulo).join(", ");
    throw new ConflictError(
      `No es posible desactivar la patrulla verificadora '${patrullaExistente.fila.patrulla_nombre}' porque cuenta con misiones tácticas activas en curso (${codigosMisiones || "misión en terreno"}).`
    );
  }

  // 5. Ejecutar la desactivación transaccional con liberación de recursos y personal
  const resultado = await desactivarPatrullaTransaccionalRepo(id, usuario.id);

  // 6. Notificar en tiempo real a las salas de Centro de Mando
  notificarPatrullaDesactivada({
    patrullaId: resultado.id,
    nombre: resultado.nombre,
    eliminadoPorId: resultado.eliminadoPorId,
    eliminadoEn: resultado.eliminadoEn,
  });

  // Notificar también cambio de estado para componentes que escuchan patrulla:actualizada
  notificarPatrullaActualizada({
    patrullaId: resultado.id,
    nombre: resultado.nombre,
    estado: resultado.estado,
    delegacionId: null,
    usuarioLiderId: null,
    misionActivaId: null,
    incidenteId: null,
    actualizadoEn: resultado.eliminadoEn,
  });

  // Si se liberó un vehículo, notificar al inventario comunal
  if (resultado.vehiculoLiberadoId) {
    emitirRecursoActualizado({
      id: resultado.vehiculoLiberadoId,
      estado: "DISPONIBLE",
      cantidadEnUso: 0,
      actualizadoEn: resultado.eliminadoEn,
    });
  }

  return {
    message: "Patrulla verificadora desactivada exitosamente.",
    data: resultado,
  };
}


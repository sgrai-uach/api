import { seguridadService } from "@/modules/seguridad/service";
import {
  PERMISO_CREAR_RECURSO,
  PERMISO_LEER_RECURSO,
  PERMISO_EDITAR_RECURSO,
  PERMISO_ELIMINAR_CUADRILLA,
} from "@/modules/seguridad/permisos.constants";
import {
  BadRequestError,
  NotFoundError,
  ConflictError,
} from "@/modules/seguridad/errors";
import {
  emitirCuadrillaCreada,
  emitirCuadrillaActualizada,
  emitirCuadrillaDesactivada,
} from "@/lib/socket";
import {
  buscarCuadrillaPorNombre,
  obtenerCuadrillaPorIdParaEdicion,
  obtenerCuadrillaDetalleUnitario,
  listarCuadrillasPaginadas,
  insertarCuadrillaConDelegado,
  verificarMisionesActivasCuadrilla,
  buscarCuadrillaPorNombreExcluyendoId,
  obtenerDelegacionPorId,
  obtenerUsuarioPorId,
  obtenerRolPorCodigo,
  obtenerPersonalParaAsignacion,
  obtenerRecursosParaAsignacion,
  obtenerRecursosIndividualesAsignadosAOtrasCuadrillas,
  verificarDelegadoAsignadoAOtraCuadrilla,
  obtenerTrabajadoresAsignadosAOtrasCuadrillas,
  actualizarCuadrillaConDotacionTransaccional,
  desactivarCuadrillaTransaccional,
} from "./cuadrilla.repository";
import type {
  CrearCuadrillaInput,
  EditarCuadrillaInput,
  ListarCuadrillasQuery,
  CuadrillaResponse,
  ListarCuadrillasResponse,
  DesactivarCuadrillaResponse,
} from "./cuadrilla.schema";

const PERMISOS_LECTURA = [PERMISO_LEER_RECURSO, "recursos:gestionar"];

/**
 * Roles institucionales aptos para la delegación de una cuadrilla operativa.
 * - BRIGADISTA: se promueve automáticamente a DELEGADO_CUADRILLA al crear la cuadrilla.
 * - DELEGADO_CUADRILLA: conserva su rol y asume el liderazgo de la nueva unidad.
 */
const ROLES_APTOS_PARA_DELEGADO = ["BRIGADISTA", "DELEGADO_CUADRILLA"] as const;

/**
 * Valida que el funcionario seleccionado como delegado tenga un rol institucional apto.
 * Evita promover roles ajenos (por ejemplo ENCARGADO o SUPERVISOR) por invocación directa de la API.
 */
function validarRolAptoParaDelegado(rolCodigo: string | null | undefined): void {
  const rol = (rolCodigo ?? "").trim().toUpperCase();
  if (!rol) return;
  if (!(ROLES_APTOS_PARA_DELEGADO as readonly string[]).includes(rol)) {
    throw new BadRequestError(
      `El funcionario designado como delegado debe tener rol 'BRIGADISTA' o 'DELEGADO_CUADRILLA' (rol actual: '${rol}').`
    );
  }
}

/**
 * Consulta el listado paginado de cuadrillas operativas aplicando filtros y control RBAC.
 */
export async function listarCuadrillas(
  query: ListarCuadrillasQuery,
  usuarioId: string | null | undefined
): Promise<ListarCuadrillasResponse> {
  // 1. Validar autorización RBAC (requiere recursos:leer, recursos:gestionar o Administrador)
  await seguridadService.validarAccesoAdministrador(usuarioId, PERMISOS_LECTURA);

  // 2. Normalizar parámetros de paginación y filtros
  const pagina = query.pagina ?? query.page ?? 1;
  const limite = query.limite ?? query.limit ?? 10;
  const busqueda = query.busqueda ?? query.q;
  const delegacionId = query.delegacionId;
  const estado = query.estado;

  // 3. Ejecutar consulta en repositorio
  const { cuadrillas, total } = await listarCuadrillasPaginadas({
    pagina,
    limite,
    busqueda,
    delegacionId,
    estado,
    activo: query.activo,
    incluirInactivas: query.incluir_inactivas ?? query.incluirInactivas,
  });

  const totalPages = total > 0 ? Math.ceil(total / limite) : 0;
  const paginasTotales = Math.ceil(total / limite) || 1;

  // 4. Mapear datos al contrato de respuesta
  const data = cuadrillas.map((c) => ({
    id: c.id,
    nombre: c.nombre,
    estado: c.estado,
    delegacion: {
      id: c.delegacion_id,
      nombre: c.delegacion_nombre,
      codigo: c.delegacion_codigo ?? null,
    },
    delegado: {
      id: c.delegado_id,
      nombre: c.delegado_nombre,
      email: c.delegado_email,
      rut: c.delegado_rut ?? null,
    },
    recursos: c.recursos.map((r) => ({
      id: r.id,
      recursoId: r.recurso_id,
      nombre: r.nombre,
      cantidadAsignada: r.cantidad_asignada,
      esIndividual: r.es_individual,
    })),
    trabajadores: c.trabajadores.map((t) => ({
      id: t.id,
      personalId: t.personal_id,
      usuarioId: t.usuario_id,
      nombre: t.nombre,
      rut: t.rut,
      cargo: t.cargo,
      especialidad: t.especialidad,
      asignadoEn:
        t.asignado_en instanceof Date
          ? t.asignado_en.toISOString()
          : String(t.asignado_en),
    })),
    totalRecursos: c.recursos.length,
    totalTrabajadores: c.trabajadores.length,
    activo: c.activo !== undefined ? c.activo : c.eliminado_en == null,
    creadoEn:
      c.creado_en instanceof Date ? c.creado_en.toISOString() : String(c.creado_en),
    eliminadoEn:
      c.eliminado_en instanceof Date
        ? c.eliminado_en.toISOString()
        : c.eliminado_en
        ? String(c.eliminado_en)
        : null,
    actualizadoEn:
      c.actualizado_en instanceof Date
        ? c.actualizado_en.toISOString()
        : c.actualizado_en
        ? String(c.actualizado_en)
        : null,
  }));

  return {
    message: "Listado de cuadrillas obtenido exitosamente",
    data,
    meta: {
      total,
      pagina,
      limite,
      paginasTotales,
      page: pagina,
      limit: limite,
      totalPages,
      hasNext: pagina < totalPages,
      hasPrev: pagina > 1,
    },
  };
}

/**
 * Consulta el detalle unitario consolidado de una cuadrilla por su UUID.
 */
export async function obtenerCuadrillaPorId(
  id: string,
  usuarioId: string | null | undefined
): Promise<CuadrillaResponse> {
  // 1. Validar autorización RBAC (requiere recursos:leer o Administrador)
  await seguridadService.validarAccesoAdministrador(usuarioId, PERMISOS_LECTURA);

  // 2. Obtener cuadrilla consolidada
  const cuadrilla = await obtenerCuadrillaDetalleUnitario(id);
  if (!cuadrilla) {
    throw new NotFoundError("La cuadrilla operativa especificada no existe.");
  }

  // 3. Mapear a contrato estructurado de respuesta
  return {
    id: cuadrilla.id,
    nombre: cuadrilla.nombre,
    estado: cuadrilla.estado,
    activo: cuadrilla.activo !== undefined ? cuadrilla.activo : cuadrilla.eliminado_en == null,
    delegacion: {
      id: cuadrilla.delegacion_id,
      nombre: cuadrilla.delegacion_nombre,
      codigo: cuadrilla.delegacion_codigo ?? null,
    },
    delegado: {
      id: cuadrilla.delegado_id,
      nombre: cuadrilla.delegado_nombre,
      email: cuadrilla.delegado_email,
      rut: cuadrilla.delegado_rut ?? null,
    },
    recursos: cuadrilla.recursos.map((r) => ({
      id: r.id,
      recursoId: r.recurso_id,
      nombre: r.nombre,
      cantidadAsignada: r.cantidad_asignada,
      esIndividual: r.es_individual,
    })),
    trabajadores: cuadrilla.trabajadores.map((t) => ({
      id: t.id,
      personalId: t.personal_id,
      usuarioId: t.usuario_id,
      nombre: t.nombre,
      rut: t.rut,
      cargo: t.cargo,
      especialidad: t.especialidad,
      asignadoEn:
        t.asignado_en instanceof Date
          ? t.asignado_en.toISOString()
          : String(t.asignado_en),
    })),
    totalRecursos: cuadrilla.recursos.length,
    totalTrabajadores: cuadrilla.trabajadores.length,
    creadoEn:
      cuadrilla.creado_en instanceof Date
        ? cuadrilla.creado_en.toISOString()
        : String(cuadrilla.creado_en),
    actualizadoEn:
      cuadrilla.actualizado_en instanceof Date
        ? cuadrilla.actualizado_en.toISOString()
        : cuadrilla.actualizado_en
        ? String(cuadrilla.actualizado_en)
        : null,
    actualizadoPorId: cuadrilla.actualizado_por_id,
    creadoPorId: cuadrilla.creado_por_id,
    eliminadoEn:
      cuadrilla.eliminado_en instanceof Date
        ? cuadrilla.eliminado_en.toISOString()
        : cuadrilla.eliminado_en
        ? String(cuadrilla.eliminado_en)
        : null,
    eliminadoPorId: cuadrilla.eliminado_por_id ?? null,
  };
}

/**
 * Servicio para registrar una nueva cuadrilla operativa en el sistema (H79).
 */
export async function crearCuadrilla(
  input: CrearCuadrillaInput,
  usuarioId: string | null | undefined
): Promise<CuadrillaResponse> {
  // 1. Validar autorización RBAC (requiere permiso recursos:crear o Administrador)
  const usuarioAutenticado = await seguridadService.validarAccesoAdministrador(
    usuarioId,
    [PERMISO_CREAR_RECURSO]
  );

  // 2. Validar unicidad de nombre (insensible a mayúsculas y espacios superfluos)
  const cuadrillaDuplicada = await buscarCuadrillaPorNombre(input.nombre);
  if (cuadrillaDuplicada) {
    throw new ConflictError("Ya existe una cuadrilla operativa con el nombre ingresado.");
  }

  // 3. Validar existencia y vigencia de la delegación base
  const delegacion = await obtenerDelegacionPorId(input.delegacionId);
  if (!delegacion) {
    throw new NotFoundError("La delegación municipal especificada no existe.");
  }
  if (delegacion.activo === false) {
    throw new BadRequestError("La delegación municipal seleccionada se encuentra inactiva.");
  }

  // 4. Validar existencia y vigencia del usuario delegado
  const usuarioDelegado = await obtenerUsuarioPorId(input.usuarioDelegadoId);
  if (!usuarioDelegado) {
    throw new NotFoundError("El usuario designado como delegado de cuadrilla no existe.");
  }
  if (usuarioDelegado.activo === false) {
    throw new BadRequestError("El usuario designado como delegado de cuadrilla se encuentra inactivo.");
  }
  validarRolAptoParaDelegado(usuarioDelegado.rol_codigo);

  // 4.1. Regla ICS: el delegado no puede liderar ni integrar otra cuadrilla operativa activa
  const estadoDelegadoAlCrear = await verificarDelegadoAsignadoAOtraCuadrilla(
    input.usuarioDelegadoId,
    null
  );
  if (estadoDelegadoAlCrear.asignado) {
    throw new ConflictError(
      `El usuario designado como Delegado ya se encuentra asignado a otra cuadrilla operativa activa ('${estadoDelegadoAlCrear.cuadrillaNombre}').`
    );
  }

  // 5. Obtener el rol institucional DELEGADO_CUADRILLA para asignación
  const rolDelegado = await obtenerRolPorCodigo("DELEGADO_CUADRILLA");
  if (!rolDelegado) {
    throw new BadRequestError("El rol de sistema 'DELEGADO_CUADRILLA' no se encuentra configurado.");
  }

  // 6. Insertar cuadrilla y promover delegado atómicamente
  const resultado = await insertarCuadrillaConDelegado(
    {
      nombre: input.nombre,
      delegacionId: input.delegacionId,
      usuarioDelegadoId: input.usuarioDelegadoId,
      creadoPorId: usuarioAutenticado.id,
    },
    rolDelegado.id,
    usuarioDelegado.rol_codigo ?? undefined
  );

  // 7. Mapear a la respuesta estructurada de dominio
  const respuesta: CuadrillaResponse = {
    id: resultado.id,
    nombre: resultado.nombre,
    estado: resultado.estado,
    delegacion: {
      id: resultado.delegacion_id,
      nombre: resultado.delegacion_nombre,
      codigo: resultado.delegacion_codigo ?? null,
    },
    delegado: {
      id: resultado.delegado_id,
      nombre: resultado.delegado_nombre,
      email: resultado.delegado_email,
      rut: resultado.delegado_rut ?? null,
    },
    recursos: [],
    trabajadores: [],
    totalRecursos: 0,
    totalTrabajadores: 0,
    creadoEn:
      resultado.creado_en instanceof Date
        ? resultado.creado_en.toISOString()
        : String(resultado.creado_en),
    actualizadoEn: null,
    creadoPorId: resultado.creado_por_id,
    actualizadoPorId: null,
  };

  // 8. Emitir evento WebSocket para sincronización en tiempo real
  try {
    emitirCuadrillaCreada(respuesta);
  } catch (error) {
    console.error("Error al emitir evento Socket.io cuadrilla:creada:", error);
  }

  return respuesta;
}

/**
 * Servicio para modificar datos, reasignar delegado y ajustar dotación de una cuadrilla (H81).
 */
export async function editarCuadrilla(
  id: string,
  input: EditarCuadrillaInput,
  usuarioId: string | null | undefined
): Promise<CuadrillaResponse> {
  // 1. Validar autorización RBAC (requiere permiso recursos:editar o Administrador)
  const usuarioAutenticado = await seguridadService.validarAccesoAdministrador(
    usuarioId,
    [PERMISO_EDITAR_RECURSO]
  );

  // 2. Obtener cuadrilla actual y validar existencia
  const cuadrillaActual = await obtenerCuadrillaPorIdParaEdicion(id);
  if (!cuadrillaActual) {
    throw new NotFoundError("La cuadrilla operativa especificada no existe.");
  }

  // 3. Regla de negocio crítica: Bloquear modificación si se encuentra EN_MISION, EN_TRANSITO o EN_OPERACION (409 Conflict)
  const estadoCuadrilla = String(cuadrillaActual.estado);
  if (
    estadoCuadrilla === "EN_MISION" ||
    estadoCuadrilla === "EN_TRANSITO" ||
    estadoCuadrilla === "EN_OPERACION"
  ) {
    throw new ConflictError(
      "No es posible modificar los datos ni la dotación de una cuadrilla que se encuentra actualmente en misión activa en terreno."
    );
  }

  // Comprobar misiones activas asociadas (doble capa de integridad operativa)
  const tieneMisionesActivas = await verificarMisionesActivasCuadrilla(id);
  if (tieneMisionesActivas) {
    throw new ConflictError(
      "No es posible modificar los datos ni la dotación de una cuadrilla que se encuentra actualmente en misión activa en terreno."
    );
  }

  // 4. Validar unicidad de nombre si fue modificado (insensible a mayúsculas y espacios)
  const nombreLimpio = input.nombre.trim();
  if (nombreLimpio.toLowerCase() !== cuadrillaActual.nombre.trim().toLowerCase()) {
    const cuadrillaDuplicada = await buscarCuadrillaPorNombreExcluyendoId(nombreLimpio, id);
    if (cuadrillaDuplicada) {
      throw new ConflictError("Ya existe otra cuadrilla operativa con el nombre ingresado.");
    }
  }

  // 5. Validar existencia y vigencia de la delegación base
  const delegacion = await obtenerDelegacionPorId(input.delegacionId);
  if (!delegacion) {
    throw new NotFoundError("La delegación municipal especificada no existe.");
  }
  if (delegacion.activo === false) {
    throw new BadRequestError("La delegación municipal seleccionada se encuentra inactiva.");
  }

  // 6. Validar existencia y vigencia del usuario delegado
  const usuarioDelegado = await obtenerUsuarioPorId(input.usuarioDelegadoId);
  if (!usuarioDelegado) {
    throw new NotFoundError("El usuario designado como delegado de cuadrilla no existe.");
  }
  if (usuarioDelegado.activo === false) {
    throw new BadRequestError("El usuario designado como delegado de cuadrilla se encuentra inactivo.");
  }
  validarRolAptoParaDelegado(usuarioDelegado.rol_codigo);

  // 7. Roles del sistema para gestión de delegados y brigadistas
  const rolDelegado = await obtenerRolPorCodigo("DELEGADO_CUADRILLA");
  if (!rolDelegado) {
    throw new BadRequestError("El rol de sistema 'DELEGADO_CUADRILLA' no se encuentra configurado.");
  }

  const rolBrigadista = await obtenerRolPorCodigo("BRIGADISTA");

  // 8. Validaciones ICS de Dotación y Personal (BUG-H81-API-03)
  // 8.1 Verificar asignación multicuadrilla del Delegado
  const estadoDelegadoOtra = await verificarDelegadoAsignadoAOtraCuadrilla(input.usuarioDelegadoId, id);
  if (estadoDelegadoOtra.asignado) {
    throw new ConflictError(
      `El usuario designado como Delegado ya se encuentra asignado a otra cuadrilla operativa activa ('${estadoDelegadoOtra.cuadrillaNombre}').`
    );
  }

  // 8.2 Validar trabajadores operativos (personal)
  const personalIds = input.trabajadores.map((t) => t.personalId);
  const setPersonalIds = new Set(personalIds);
  if (setPersonalIds.size !== personalIds.length) {
    throw new BadRequestError("No se puede asignar repetidas veces al mismo funcionario en la cuadrilla.");
  }

  if (personalIds.length > 0) {
    const personalEncontrado = await obtenerPersonalParaAsignacion(personalIds);
    if (personalEncontrado.length !== personalIds.length) {
      const encontradosIds = new Set(personalEncontrado.map((p) => p.id));
      const faltantes = personalIds.filter((pid) => !encontradosIds.has(pid));
      throw new NotFoundError(
        `Uno o más funcionarios operativos no existen: ${faltantes.join(", ")}`
      );
    }

    // Regla ICS: Asignación dual (el delegado no puede figurar en la dotación de operarios bajo su propio mando)
    const delegadoPersonal = personalEncontrado.find((p) => p.usuario_id === input.usuarioDelegadoId);
    if (delegadoPersonal) {
      throw new BadRequestError(
        "El funcionario designado como Delegado no puede formar parte de la dotación de trabajadores de la cuadrilla."
      );
    }

    for (const p of personalEncontrado) {
      if (!p.usuario_activo) {
        throw new BadRequestError(`El funcionario '${p.nombre}' se encuentra inactivo en el sistema.`);
      }
      if (!p.disponible_terreno) {
        throw new BadRequestError(`El funcionario '${p.nombre}' no se encuentra habilitado para labores en terreno.`);
      }
      if (p.estado_operativo !== "disponible") {
        throw new BadRequestError(
          `El funcionario '${p.nombre}' no se encuentra disponible (estado operativo actual: '${p.estado_operativo}').`
        );
      }
    }

    // Regla ICS: Asignación multicuadrilla de trabajadores
    const trabajadoresEnOtras = await obtenerTrabajadoresAsignadosAOtrasCuadrillas(personalIds, id);
    if (trabajadoresEnOtras.length > 0) {
      throw new ConflictError(
        `El funcionario '${trabajadoresEnOtras[0].nombre}' ya se encuentra asignado a otra cuadrilla operativa activa ('${trabajadoresEnOtras[0].cuadrilla_nombre}').`
      );
    }
  }

  // 9. Validar recursos materiales, vehículos y maquinarias
  const recursoIds = input.recursos.map((r) => r.recursoId);
  const setRecursoIds = new Set(recursoIds);
  if (setRecursoIds.size !== recursoIds.length) {
    throw new BadRequestError("No se puede especificar el mismo recurso en múltiples líneas de la dotación.");
  }

  if (recursoIds.length > 0) {
    const recursosEncontrados = await obtenerRecursosParaAsignacion(recursoIds);
    if (recursosEncontrados.length !== recursoIds.length) {
      const encontradosIds = new Set(recursosEncontrados.map((r) => r.id));
      const faltantes = recursoIds.filter((rid) => !encontradosIds.has(rid));
      throw new NotFoundError(
        `Uno o más recursos logísticos solicitados no existen en el inventario: ${faltantes.join(", ")}`
      );
    }

    const mapaRecursosEncontrados = new Map(recursosEncontrados.map((r) => [r.id, r]));

    for (const item of input.recursos) {
      const recurso = mapaRecursosEncontrados.get(item.recursoId);
      if (!recurso) continue;

      if (recurso.estado !== "DISPONIBLE") {
        throw new BadRequestError(
          `El recurso '${recurso.nombre}' no se encuentra en estado DISPONIBLE (estado actual: ${recurso.estado}).`
        );
      }

      if (recurso.es_individual && item.cantidad > 1) {
        throw new BadRequestError(
          `El recurso individual o vehículo '${recurso.nombre}' solo admite una cantidad asignada de 1 unidad.`
        );
      }

      const enUso = Number(recurso.cantidad_en_uso ?? 0);
      const disponible = Number(recurso.cantidad_inventario) - enUso;

      if (item.cantidad > disponible) {
        throw new BadRequestError(
          `Stock insuficiente para el recurso '${recurso.nombre}' (solicitado: ${item.cantidad}, disponible en bodega: ${disponible}).`
        );
      }
    }

    // Verificar si algún recurso individual ya está asignado a otra cuadrilla activa
    const colisionesIndividuales = await obtenerRecursosIndividualesAsignadosAOtrasCuadrillas(
      recursoIds,
      id
    );

    if (colisionesIndividuales.length > 0) {
      throw new ConflictError(
        "El recurso individual ya se encuentra asignado a otra cuadrilla operativa."
      );
    }
  }

  // 10. Persistencia atómica de datos y dotación en Kysely
  const resultado = await actualizarCuadrillaConDotacionTransaccional(
    {
      id,
      nombre: nombreLimpio,
      delegacionId: input.delegacionId,
      usuarioDelegadoId: input.usuarioDelegadoId,
      delegadoAnteriorId: cuadrillaActual.usuario_delegado_id,
      actualizadoPorId: usuarioAutenticado.id,
      recursos: input.recursos.map((r) => ({
        recursoId: r.recursoId,
        cantidad: r.cantidad,
      })),
      trabajadores: input.trabajadores.map((t) => ({
        personalId: t.personalId,
      })),
    },
    rolDelegado.id,
    rolBrigadista?.id ?? null
  );

  // 11. Mapear a formato estandarizado de respuesta
  const respuesta: CuadrillaResponse = {
    id: resultado.id,
    nombre: resultado.nombre,
    estado: resultado.estado,
    delegacion: {
      id: resultado.delegacion_id,
      nombre: resultado.delegacion_nombre,
      codigo: resultado.delegacion_codigo ?? null,
    },
    delegado: {
      id: resultado.delegado_id,
      nombre: resultado.delegado_nombre,
      email: resultado.delegado_email,
      rut: resultado.delegado_rut ?? null,
    },
    recursos: resultado.recursos.map((r) => ({
      id: r.id,
      recursoId: r.recurso_id,
      nombre: r.nombre,
      cantidadAsignada: r.cantidad_asignada,
      esIndividual: r.es_individual,
    })),
    trabajadores: resultado.trabajadores.map((t) => ({
      id: t.id,
      personalId: t.personal_id,
      usuarioId: t.usuario_id,
      nombre: t.nombre,
      rut: t.rut,
      cargo: t.cargo,
      especialidad: t.especialidad,
      asignadoEn:
        t.asignado_en instanceof Date
          ? t.asignado_en.toISOString()
          : String(t.asignado_en),
    })),
    totalRecursos: resultado.recursos.length,
    totalTrabajadores: resultado.trabajadores.length,
    creadoEn:
      resultado.creado_en instanceof Date
        ? resultado.creado_en.toISOString()
        : String(resultado.creado_en),
    actualizadoEn:
      resultado.actualizado_en instanceof Date
        ? resultado.actualizado_en.toISOString()
        : resultado.actualizado_en
        ? String(resultado.actualizado_en)
        : null,
    actualizadoPorId: resultado.actualizado_por_id,
    creadoPorId: resultado.creado_por_id,
  };

  // 12. Emitir evento WebSocket en tiempo real
  try {
    emitirCuadrillaActualizada(respuesta);
  } catch (error) {
    console.error("Error al emitir evento Socket.io cuadrilla:actualizada:", error);
  }

  return respuesta;
}

/**
 * Desactiva mediante baja lógica una cuadrilla operativa liberando su dotación de recursos y brigadistas (H82).
 * 
 * Reglas de negocio:
 * 1. Requiere permiso específico 'cuadrillas:eliminar' o rol Administrador.
 * 2. Verifica la existencia de la cuadrilla y que se encuentre activa.
 * 3. Si posee misiones en estado PLANIFICADA, DESPACHADA o EN_CURSO, rechaza con 409 Conflict.
 * 4. Si se encuentra actualmente en estado EN_MISION, rechaza con 409 Conflict.
 * 5. Ejecuta baja lógica (activo = false, eliminado_en = CURRENT_TIMESTAMP), desvincula dotación histórica
 *    y revierte el rol del delegado a BRIGADISTA si no lidera otra cuadrilla activa.
 * 6. Emite evento en tiempo real cuadrilla:desactivada vía Socket.io.
 */
export async function desactivarCuadrilla(
  id: string,
  usuarioId: string | null | undefined
): Promise<DesactivarCuadrillaResponse> {
  // 1. Validar autorización RBAC (requiere permiso cuadrillas:eliminar o Administrador)
  const usuarioAutenticado = await seguridadService.validarAccesoAdministrador(
    usuarioId,
    [PERMISO_ELIMINAR_CUADRILLA]
  );

  // 2. Obtener cuadrilla actual y validar existencia
  const cuadrillaActual = await obtenerCuadrillaPorIdParaEdicion(id);
  if (!cuadrillaActual) {
    throw new NotFoundError("La cuadrilla operativa especificada no existe o ya fue desactivada.");
  }

  // 3. Regla crítica de negocio: Bloquear si se encuentra EN_MISION o tiene misiones activas (409 Conflict)
  const estadoCuadrilla = String(cuadrillaActual.estado);
  if (
    estadoCuadrilla === "EN_MISION" ||
    estadoCuadrilla === "EN_TRANSITO" ||
    estadoCuadrilla === "EN_OPERACION"
  ) {
    throw new ConflictError(
      "No es posible desactivar una cuadrilla que se encuentra actualmente en misión activa en terreno."
    );
  }

  const tieneMisionesActivas = await verificarMisionesActivasCuadrilla(id);
  if (tieneMisionesActivas) {
    throw new ConflictError(
      "No es posible desactivar la cuadrilla porque posee misiones activas en curso (PLANIFICADA, DESPACHADA o EN_CURSO)."
    );
  }

  // 4. Obtener rol BRIGADISTA para eventual reversión de rol del delegado
  const rolBrigadista = await obtenerRolPorCodigo("BRIGADISTA");

  // 5. Ejecutar desactivación transaccional con desvinculación histórica y bloqueo atómico (BUG-H82-API-05)
  let resultado;
  try {
    resultado = await desactivarCuadrillaTransaccional(
      id,
      usuarioAutenticado.id,
      rolBrigadista ? rolBrigadista.id : null
    );
  } catch (error: unknown) {
    if (error instanceof ConflictError || error instanceof NotFoundError) {
      throw error;
    }
    const mensaje = error instanceof Error ? error.message : String(error);
    if (mensaje.startsWith("CONFLICT:")) {
      throw new ConflictError(mensaje.replace("CONFLICT:", ""));
    }
    if (mensaje.includes("no existe o ya fue desactivada")) {
      throw new NotFoundError(mensaje);
    }
    throw error;
  }

  // 6. Formatear respuesta de dominio
  const eliminadoEnStr =
    resultado.eliminadoEn instanceof Date
      ? resultado.eliminadoEn.toISOString()
      : String(resultado.eliminadoEn);

  const respuesta: DesactivarCuadrillaResponse = {
    message: "Cuadrilla operativa desactivada exitosamente",
    data: {
      id: resultado.id,
      nombre: resultado.nombre,
      activo: false,
      estado: resultado.estado,
      recursosDesvinculados: resultado.recursosDesvinculados,
      trabajadoresDesvinculados: resultado.trabajadoresDesvinculados,
      delegadoRevertido: resultado.delegadoRevertido,
      eliminadoEn: eliminadoEnStr,
      eliminadoPorId: resultado.eliminadoPorId,
    },
  };

  // 7. Emitir evento WebSocket para actualización en tiempo real
  try {
    emitirCuadrillaDesactivada(respuesta.data);
  } catch (error) {
    console.error("Error al emitir evento Socket.io cuadrilla:desactivada:", error);
  }

  return respuesta;
}


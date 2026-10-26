import { seguridadService } from "@/modules/seguridad/service";
import { PERMISO_EDITAR_RECURSO } from "@/modules/seguridad/permisos.constants";
import {
  BadRequestError,
  NotFoundError,
  ConflictError,
} from "@/modules/seguridad/errors";
import { emitirCuadrillaActualizada } from "@/lib/socket";
import {
  obtenerCuadrillaPorIdParaEdicion,
  verificarMisionesActivasCuadrilla,
  buscarCuadrillaPorNombreExcluyendoId,
  obtenerDelegacionPorId,
  obtenerUsuarioPorId,
  obtenerRolPorCodigo,
  obtenerPersonalParaAsignacion,
  obtenerRecursosParaAsignacion,
  obtenerRecursosIndividualesAsignadosAOtrasCuadrillas,
  actualizarCuadrillaConDotacionTransaccional,
} from "./cuadrilla.repository";
import type {
  EditarCuadrillaInput,
  CuadrillaResponse,
} from "./cuadrilla.schema";

/**
 * Servicio para modificar datos, reasignar delegado y ajustar dotación de una cuadrilla (H81).
 * Aplica control RBAC ('recursos:editar'), valida que la cuadrilla no esté EN_MISION (409 Conflict),
 * verifica unicidad de nombre, disponibilidad operativa de trabajadores y recursos, y persiste
 * atómicamente emitiendo sincronización en tiempo real vía WebSocket.
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

  // 3. Regla de negocio crítica: Bloquear modificación si se encuentra EN_MISION (409 Conflict)
  if (cuadrillaActual.estado === "EN_MISION") {
    throw new ConflictError(
      "No es posible modificar los datos ni la dotación de una cuadrilla que se encuentra actualmente en misión activa."
    );
  }

  // Comprobar misiones activas asociadas (doble capa de integridad operativa)
  const tieneMisionesActivas = await verificarMisionesActivasCuadrilla(id);
  if (tieneMisionesActivas) {
    throw new ConflictError(
      "No es posible modificar la dotación de una cuadrilla con misiones operativas activas en terreno."
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

  // 7. Roles del sistema para gestión de delegados y brigadistas
  const rolDelegado = await obtenerRolPorCodigo("DELEGADO_CUADRILLA");
  if (!rolDelegado) {
    throw new BadRequestError("El rol de sistema 'DELEGADO_CUADRILLA' no se encuentra configurado.");
  }

  const rolBrigadista = await obtenerRolPorCodigo("BRIGADISTA");

  // 8. Validar trabajadores operativos (personal)
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

      if (recurso.es_individual && item.cantidad > 1) {
        throw new BadRequestError(
          `El recurso individual o vehículo '${recurso.nombre}' solo admite una cantidad asignada de 1 unidad.`
        );
      }

      if (item.cantidad > recurso.cantidad_inventario) {
        throw new BadRequestError(
          `Stock insuficiente para el recurso '${recurso.nombre}' (solicitado: ${item.cantidad}, inventario total: ${recurso.cantidad_inventario}).`
        );
      }
    }

    // Verificar si algún recurso individual ya está asignado a otra cuadrilla activa
    const colisionesIndividuales = await obtenerRecursosIndividualesAsignadosAOtrasCuadrillas(
      recursoIds,
      id
    );

    if (colisionesIndividuales.length > 0) {
      const colision = colisionesIndividuales[0];
      throw new ConflictError(
        `El recurso individual '${colision.recurso_nombre}' ya se encuentra asignado a la cuadrilla activa '${colision.cuadrilla_nombre}'.`
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

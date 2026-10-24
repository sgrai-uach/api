import { seguridadService } from "@/modules/seguridad/service";
import { PERMISO_CREAR_RECURSO } from "@/modules/seguridad/permisos.constants";
import {
  BadRequestError,
  NotFoundError,
  ConflictError,
} from "@/modules/seguridad/errors";
import { emitirCuadrillaCreada } from "@/lib/socket";
import {
  buscarCuadrillaPorNombre,
  obtenerDelegacionPorId,
  obtenerUsuarioPorId,
  obtenerRolDelegadoCuadrilla,
  insertarCuadrillaConDelegado,
} from "./cuadrilla.repository";
import type {
  CrearCuadrillaInput,
  CuadrillaResponse,
} from "./cuadrilla.schema";

/**
 * Servicio para registrar una nueva cuadrilla operativa en el sistema (H79).
 * Valida permisos RBAC, unicidad de nombre, existencia y vigencia de la delegación y el delegado,
 * promueve atómicamente al usuario a 'DELEGADO_CUADRILLA' si aún no lo es y emite notificación WebSocket.
 */
export async function crearCuadrilla(
  input: CrearCuadrillaInput,
  usuarioId: string | null | undefined
): Promise<CuadrillaResponse> {
  // 1. Validar autorización RBAC (requiere permiso recursos:crear o rol Administrador)
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

  // 5. Obtener el rol institucional DELEGADO_CUADRILLA para asignación
  const rolDelegado = await obtenerRolDelegadoCuadrilla();
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
    },
    delegado: {
      id: resultado.delegado_id,
      nombre: resultado.delegado_nombre,
      email: resultado.delegado_email,
      rut: resultado.delegado_rut ?? null,
    },
    creadoEn:
      resultado.creado_en instanceof Date
        ? resultado.creado_en.toISOString()
        : String(resultado.creado_en),
    creadoPorId: resultado.creado_por_id,
  };

  // 8. Emitir evento WebSocket para sincronización en tiempo real
  try {
    emitirCuadrillaCreada(respuesta);
  } catch (error) {
    console.error("Error al emitir evento Socket.io cuadrilla:creada:", error);
  }

  return respuesta;
}

import { verificarPermiso } from "@/modules/seguridad/auth.service";
import { PERMISO_CREAR_RECURSO } from "@/modules/seguridad/permisos.constants";
import { determinarEstadoRecurso } from "./recurso.utils";
import { insertarRecurso, type DatosInsertarRecurso } from "./recurso.repository";
import type { CrearRecursoInput, RecursoResponse } from "./recurso.schema";

export async function crearRecurso(
  input: CrearRecursoInput,
  usuarioId: string | null | undefined
): Promise<RecursoResponse> {
  // 1. Validar autenticación y permiso RBAC
  const usuario = await verificarPermiso(usuarioId, PERMISO_CREAR_RECURSO);

  // 2. Determinar estado automático según stock e inventario
  const estado = determinarEstadoRecurso(input.cantidadInventario, input.cantidadMinima);

  // 3. Preparar entidad a insertar
  const datosParaInsertar: DatosInsertarRecurso = {
    nombre: input.nombre,
    es_individual: input.esIndividual,
    estado,
    cantidad_inventario: input.cantidadInventario,
    cantidad_en_uso: 0,
    cantidad_minima: input.cantidadMinima,
    latitud: input.latitud,
    longitud: input.longitud,
    descripcion: input.descripcion ?? null,
    detalles: (input.detalles ?? {}) as Record<string, unknown>,
    creado_por_id: usuario.id,
  };

  // 4. Persistir en base de datos
  const fila = await insertarRecurso(datosParaInsertar);

  // 5. Mapear a contrato de respuesta
  return {
    id: fila.id,
    nombre: fila.nombre,
    esIndividual: fila.es_individual,
    estado: fila.estado,
    cantidadInventario: Number(fila.cantidad_inventario),
    cantidadEnUso: Number(fila.cantidad_en_uso),
    cantidadMinima: Number(fila.cantidad_minima),
    latitud: Number(fila.latitud),
    longitud: Number(fila.longitud),
    descripcion: fila.descripcion,
    detalles: (fila.detalles ?? {}) as Record<string, unknown>,
    creadoPorId: fila.creado_por_id,
    creadoEn: typeof fila.creado_en === "string" ? fila.creado_en : fila.creado_en.toISOString(),
    actualizadoEn: typeof fila.actualizado_en === "string" ? fila.actualizado_en : fila.actualizado_en.toISOString(),
  };
}

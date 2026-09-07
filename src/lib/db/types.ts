import type { Generated, ColumnType } from "kysely";

export type EstadoRecurso = "DISPONIBLE" | "NO_DISPONIBLE" | "BAJO_STOCK";

export interface RecursoTable {
  id: Generated<string>;
  nombre: string;
  es_individual: boolean;
  estado: EstadoRecurso;
  cantidad_inventario: number;
  cantidad_en_uso: ColumnType<number, number | undefined, number>;
  cantidad_minima: ColumnType<number, number | undefined, number>;
  latitud: number;
  longitud: number;
  ubicacion: ColumnType<unknown, unknown, unknown>;
  descripcion: string | null;
  detalles: ColumnType<Record<string, unknown>, Record<string, unknown> | undefined, Record<string, unknown>>;
  creado_por_id: string;
  creado_en: Generated<Date>;
  actualizado_en: Generated<Date>;
}

export interface PermisoTable {
  id: Generated<string>;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  creado_en: Generated<Date>;
}

export interface RolTable {
  id: Generated<string>;
  nombre: string;
  descripcion: string | null;
  creado_en: Generated<Date>;
}

export interface RolPermisoTable {
  rol_id: string;
  permiso_id: string;
}

export interface UsuarioTable {
  id: Generated<string>;
  rut: string;
  nombre: string;
  email: string;
  rol_id: string;
  creado_en: Generated<Date>;
}

export interface Database {
  recurso: RecursoTable;
  permiso: PermisoTable;
  rol: RolTable;
  rol_permiso: RolPermisoTable;
  usuario: UsuarioTable;
}

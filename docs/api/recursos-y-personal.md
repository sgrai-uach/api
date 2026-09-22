# Módulo de Recursos y Personal — Documentación Técnica

## 1. Contexto y Responsabilidad
El módulo **Recursos y Personal** es responsable de administrar el personal operativo disponible para atención de emergencias, conformación de cuadrillas y patrullas verificadoras, y la gestión territorial mediante delegaciones municipales.

De acuerdo a las reglas de negocio del SGRAI:
- **Todos los involucrados son empleados/usuarios:** La entidad `usuarios` modela a cualquier funcionario del sistema (Administrador, Encargado, Supervisor, Call Center, Asistente Social, Personal Operativo). A cada usuario se le asocia un rol con permisos específicos.
- **Personal como especialización operativa para terreno:** La entidad `personal` representa a los usuarios habilitados para labores de campo (patrullas de verificación rápida, miembros de cuadrillas, delegados de cuadrilla y operadores de maquinaria/herramientas). Cuenta con atributos de estado operativo en tiempo real (`disponible`, `en_mision`, `en_patrulla`, `descanso`, etc.) y coordenadas geográficas (`ultima_ubicacion` PostGIS).
- **Delegaciones Municipales:** Unidades territoriales operativas de la comuna de Valdivia (`DEL_NORTE`, `DEL_SUR`, `DEL_COSTA`, `DEL_CALLE_CALLE`). Tanto los usuarios como el personal operativo están adscritos a una delegación.

---

## 2. Modelo de Datos Relacional

### 2.1 Tabla `delegaciones`
| Columna | Tipo | Restricciones | Descripción |
|---|---|---|---|
| `id` | `UUID` | `PRIMARY KEY`, default `uuid_generate_v4()` | Identificador único de delegación |
| `codigo` | `VARCHAR(50)` | `UNIQUE NOT NULL` | Código identificador (ej: `DEL_NORTE`) |
| `nombre` | `VARCHAR(100)` | `NOT NULL` | Nombre formal de la delegación |
| `direccion` | `VARCHAR(255)` | `NULL` | Dirección física de la sede |
| `activo` | `BOOLEAN` | `DEFAULT TRUE NOT NULL` | Indicador de delegación activa |
| `created_at` | `TIMESTAMPTZ` | `DEFAULT CURRENT_TIMESTAMP` | Fecha de creación |
| `updated_at` | `TIMESTAMPTZ` | `DEFAULT CURRENT_TIMESTAMP` | Fecha de última modificación |

### 2.2 Tabla `personal`
| Columna | Tipo | Restricciones | Descripción |
|---|---|---|---|
| `id` | `UUID` | `PRIMARY KEY`, default `uuid_generate_v4()` | Identificador único de la ficha de personal |
| `usuario_id` | `UUID` | `UNIQUE NOT NULL`, FK -> `usuarios(id)` ON DELETE CASCADE | Usuario del sistema asociado |
| `delegacion_id` | `UUID` | `NOT NULL`, FK -> `delegaciones(id)` ON DELETE RESTRICT | Delegación de pertenencia operativa |
| `especialidad` | `VARCHAR(100)` | `NULL` | Especialidad técnica (ej. Conductor, Motosierrista, Verificador) |
| `cargo` | `VARCHAR(100)` | `NULL` | Cargo funcional en terreno |
| `estado_operativo` | `ENUM` | `NOT NULL DEFAULT 'disponible'` | `disponible`, `en_mision`, `en_patrulla`, `descanso`, `licencia`, `inactivo` |
| `disponible_terreno` | `BOOLEAN` | `DEFAULT TRUE NOT NULL` | Flag para indicar si puede ser convocado a terreno |
| `ultima_ubicacion` | `GEOMETRY(Point, 4326)` | `NULL`, GIST Index | Última posición GPS registrada por la app PWA |
| `ultima_actualizacion_ubicacion` | `TIMESTAMPTZ` | `NULL` | Marca de tiempo del último reporte GPS |
| `observaciones` | `TEXT` | `NULL` | Notas operativas o médicas relevantes |
| `created_at` | `TIMESTAMPTZ` | `DEFAULT CURRENT_TIMESTAMP` | Fecha de creación |
| `updated_at` | `TIMESTAMPTZ` | `DEFAULT CURRENT_TIMESTAMP` | Fecha de última modificación |

---

## 4. Endpoints del Módulo

### 4.1 Modificar Datos de Empleado (Usuarios y Personal)
- **Método:** `PATCH`
- **Ruta:** `/api/personal/:id`
- **Propósito:** Modifica los datos de un empleado en el sistema. Actualiza tanto la información de usuario general (`usuarios`) como la información operativa de terreno (`personal`) dentro de una misma transacción relacional atómica.
- **Parámetro `:id`:** Puede ser el UUID de `personal` o el UUID de `usuarios`.

#### Request Body (`application/json`)
Todos los campos son opcionales (actualización parcial):
```json
{
  "nombres": "Juan Carlos",
  "apellidos": "Pérez González",
  "email": "juan.perez@valdivia.cl",
  "telefono": "+56912345678",
  "rol_id": "6e206d80-b1ab-4b5a-8dda-c65e9e1fce68",
  "delegacion_id": "3bccea9e-289a-4fcc-88aa-50386c8e59fa",
  "activo": true,
  "especialidad": "Motosierrista y Conductor",
  "cargo": "Brigadista Terreno",
  "estado_operativo": "disponible",
  "disponible_terreno": true,
  "observaciones": "Apto para faenas pesadas"
}
```

#### Respuestas
- **`200 OK`**: Datos actualizados exitosamente. Retorna el objeto consolidado del empleado:
  ```json
  {
    "mensaje": "Datos del empleado actualizados exitosamente",
    "data": {
      "usuario_id": "c9a4057f-c4ad-44ab-a1b2-a28c5b62ebd7",
      "rut": "11222333-4",
      "nombres": "Juan Carlos",
      "apellidos": "Pérez González",
      "email": "juan.perez@valdivia.cl",
      "telefono": "+56912345678",
      "usuario_activo": true,
      "rol_id": "6e206d80-b1ab-4b5a-8dda-c65e9e1fce68",
      "rol_codigo": "BRIGADISTA",
      "rol_nombre": "Personal de Terreno / Brigadista",
      "delegacion_id": "3bccea9e-289a-4fcc-88aa-50386c8e59fa",
      "delegacion_codigo": "DEL_NORTE",
      "delegacion_nombre": "Delegación Norte",
      "personal_id": "b9afbb7d-de72-4810-8a69-7f10cdb3498a",
      "especialidad": "Motosierrista y Conductor",
      "cargo": "Brigadista Terreno",
      "estado_operativo": "disponible",
      "disponible_terreno": true,
      "observaciones": "Apto para faenas pesadas",
      "usuario_updated_at": "2026-09-21T18:43:55.821Z",
      "personal_updated_at": "2026-09-21T18:43:55.821Z"
    }
  }
  ```
- **`400 Bad Request`**: Rol o delegación inexistente en el sistema.
- **`404 Not Found`**: El identificador de empleado no existe en la base de datos.
- **`409 Conflict`**: El correo electrónico especificado ya pertenece a otro usuario registrado.
- **`422 Unprocessable Entity`**: Formato o tipo de datos inválido según el esquema Zod (ej. email inválido, UUID malformado).


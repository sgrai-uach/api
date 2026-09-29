# Módulo: Recursos y Personal

Documentación técnica de los endpoints y lógica del módulo de **Recursos y Personal** del backend del SGRAI.

---

## 1. Reglas de Negocio Aplicadas

- **Gestión Logística y Sección de Operaciones (ICS):** El módulo administra el inventario logístico del sistema que posteriormente podrá ser asignado a cuadrillas o desplegado en terreno ante incidentes o eventos de prevención/recuperación.
- **Modelo Híbrido Granel vs. Serializado:** 
  - Los recursos a granel (`esIndividual: false`, ej. sacos de arena, raciones) se controlan por volumen agregado (`cantidadInventario`).
  - Los recursos individuales o maquinaria (`esIndividual: true`, ej. camionetas, grúas, motobombas) se gestionan por unidades singulares y contienen especificaciones técnicas adicionales en el objeto `detalles` (kilometraje, patente, capacidad de levante en kg, alcance en metros, caudal en LPM, diámetro de pulgadas, horómetro, etc.).
- **Control de Stock y Determinación de Estados:**
  - `NO_DISPONIBLE`: Se asigna automáticamente cuando la `cantidadInventario` es `0`.
  - `BAJO_STOCK`: Se asigna automáticamente cuando `cantidadMinima > 0` y la `cantidadInventario <= cantidadMinima` (alertando necesidad de reposición).
  - `DISPONIBLE`: Se asigna cuando hay stock disponible por encima de la cantidad mínima (o cuando `cantidadMinima` es `0` y hay al menos 1 unidad).
- **Geolocalización Espacial (PostGIS):** Todo recurso almacena sus coordenadas geográficas en EPSG:4326 (`latitud`, `longitud`) y genera una columna geométrica `ubicacion` de tipo `Point` indexada mediante GIST para consultas espaciales en mapa y proximidad a eventos.
- **Seguridad y Control de Acceso Basado en Roles (RBAC):**
  - La creación de recursos requiere que el usuario autenticado posea el permiso explícito **`recursos:crear`** asignado a su rol.
  - La cabecera provisional `X-User-Id` identifica al usuario y registra la trazabilidad de auditoría en `creado_por_id` y `creado_en`.

---

## 2. Endpoints del Módulo

| Método | Endpoint | Propósito |
|---|---|---|
| `POST` | `/api/recursos` | Registrar un nuevo recurso en el inventario logístico con validación de stock, geolocalización y atributos técnicos. |

*(Nota: La consulta y listado del inventario `GET /api/recursos` se encuentra documentada en su propia historia de usuario).*

---

## 3. Códigos de Estado y Errores Esperables

- **`201 Created`:** El recurso fue validado, el estado fue calculado, las coordenadas fueron convertidas a punto PostGIS y el registro fue insertado con éxito junto a su auditoría.
- **`400 Bad Request`:**
  - El cuerpo JSON es inválido o no cumple con el esquema Zod (ej. `nombre` menor a 3 caracteres, `cantidadInventario` o `cantidadMinima` negativas, `latitud` fuera del rango [-90, 90], `longitud` fuera del rango [-180, 180], o valores numéricos inválidos en `detalles` como `kilometraje < 0`).
- **`401 Unauthorized`:**
  - La cabecera `X-User-Id` está ausente o vacía.
  - El usuario indicado en `X-User-Id` no existe en la base de datos.
- **`403 Forbidden`:**
  - El usuario existe y está autenticado, pero el rol asociado no cuenta con el permiso `recursos:crear` en la tabla de asignaciones `rol_permiso`.
- **`500 Internal Server Error`:**
  - Falla de conexión a la base de datos PostgreSQL o error inesperado del servidor.

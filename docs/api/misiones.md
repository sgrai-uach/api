# Módulo: Misiones (Operaciones Tácticas, Puestos de Mando y Reportes de Terreno)

Documentación técnica de los endpoints, contratos de datos y reglas de negocio del módulo de **Misiones**, dirigida a desarrolladores de `sgrai-web` (Encargado de Operaciones, Administrador) y `sgrai-pwa` (Patrullas Verificadoras y Cuadrillas Operativas).

---

## 1. Reglas de Negocio y Modelo de Datos (ICS y ERD Alignment)

El módulo de **Misiones** articula las acciones tácticas en terreno ejecutadas por personal operativo, patrullas verificadoras y cuadrillas municipales bajo la estructura del **Sistema de Comando de Incidentes (ICS)**:

1. **Alineación con Diagrama Entidad-Relación Maestro:**
   - Las entidades principales de persistencia son **`Misión`** (`mision`), **`Cuadrilla`** (`cuadrilla`), **`Patrulla Verificadora`** (`patrulla_verificadora`), **`Reporte Terreno`** (`reporte_terreno`) y **`Adjunto`** (`adjunto`).
   - La relación entre `mision` y `reporte_terreno` es **1:N**: una misión puede admitir múltiples informes de evolución técnica (preliminar, avance y repliegue/final).
   - La relación entre `reporte_terreno` y `adjunto` es **1:N**: cada evidencia fotográfica o documental levantada en terreno se vincula a su correspondiente informe mediante la clave foránea `adjunto.reporte_terreno_id`.

2. **Ciclo de Vida y Estados de Misión:**
   - Los estados válidos son: `PLANIFICADA`, `DESPACHADA`, `EN_CURSO`, `COMPLETADA`, `CANCELADA`, `RECHAZADA`.
   - En caso de rechazo por parte de una cuadrilla o patrulla, el atributo `justificacion_rechazo` almacena el motivo obligatorio documentado.

3. **Evaluación Primaria por Patrulla Verificadora:**
   - La evaluación inicial de terreno la efectúa una patrulla verificadora (`tipoMision: VERIFICACION`).
   - Al confirmarse la emergencia y escalarse despachando una cuadrilla de mitigación (`tipoMision: ATENCION_CUADRILLA`), la patrulla verificadora debe quedar liberada en el sistema para nueva asignación.

4. **Misiones Autónomas de Prevención y Mitigación (Puntos Críticos):**
   - Conforme a la Sección 6 de `GEMINI.md`, las misiones de **prevención** (`tipoMision: PREVENCION`) o **recuperación** (`tipoMision: RECUPERACION`) pueden generarse directamente para monitorear puntos críticos comunales sin requerir un incidente formal previo (`incidente_id` es opcional en el modelo).
   - Cuando una misión es de origen preventivo, el objeto `incidente` retorna `null` y se expone el objeto `prevencion` con la identificación geográfica y territorial del sector.

5. **Relación Territorial por Delegaciones:**
   - Las misiones se vinculan territorialmente a una delegación municipal a través del incidente atendido o de la base de la cuadrilla/patrulla asignada (`COALESCE(incidente.delegacion_id, cuadrilla.delegacion_id, patrulla_verificadora.delegacion_id)`).

6. **Resolución de Archivos Multimedia en Arquitectura On-Premise con Caddy:**
   - Las URLs expuestas en el array de adjuntos (`url`) utilizan rutas relativas canónicas (ej. `/uploads/evidencia/...`).
   - Bajo el reverse proxy Caddy, los clientes web y PWA acceden al recurso sin riesgo de bloqueos por CORS o discrepancias de host/puerto.

7. **Manejo de Estados Vacíos Amigables (Criterio de Aceptación HU-17):**
   - Cuando una misión recién despachada o en curso aún no cuente con reportes de terreno o archivos multimedia, la API retorna explícitamente arrays vacíos `reportesTerreno: []` (y para cada reporte sin fotos `adjuntos: []`), permitiendo que el componente UI renderice su estado vacío (ej. *"Sin reportes aún"* o *"Sin adjuntos"*).

---

## 2. Matriz de Endpoints del Módulo

| Método | Endpoint | Permiso Requerido | Propósito |
|---|---|---|---|
| `GET` | `/api/misiones` | `misiones:leer` / Sesión válida | Listar misiones tácticas con paginación estándar, metadatos `meta` y filtros multicriterio (H34). |
| `GET` | `/api/misiones/{id}` | `misiones:leer` | Consultar detalle exhaustivo de una misión por su ID (incidente, cuadrilla/patrulla, tiempos y reportes con adjuntos - HU-17). |
| `POST` | `/api/misiones/{id}/llegada` | `misiones:terreno:ejecutar` | Reportar arribo a terreno de la brigada operativa, registrar hito `LLEGADA_TERRENO`, actualizar ubicación de miembros y habilitar cálculo de tiempos de respuesta (HU-42). |

---

## 3. Especificación de Endpoints

### 3.1. `GET /api/misiones` (H34: Listado de Misiones con Filtros para el Encargado)

Permite al Encargado consultar el catálogo de misiones operativas desplegadas o planificadas en la comuna, filtrando simultáneamente por múltiples criterios combinados con lógica conjuntiva (`AND`).

- **Autenticación requerida:** `Authorization: Bearer <token_jwt>` (requiere sesión de usuario válida en SGRAI).

#### Parámetros de Consulta (Query Params)

| Parámetro | Tipo | Requerido | Descripción | Ejemplo |
|---|---|---|---|---|
| `page` | `number` | No (default: 1) | Número de página (inicia en 1). | `1` |
| `limit` | `number` | No (default: 20) | Cantidad de elementos por página (máximo 100). | `20` |
| `estado` | `string` | No | Estado operativo (`PLANIFICADA`, `DESPACHADA`, `EN_CURSO`, `COMPLETADA`, `CANCELADA`, `RECHAZADA`). | `EN_CURSO` |
| `tipoMision` | `string` | No | Tipo táctico (`VERIFICACION`, `ATENCION_CUADRILLA`, `PREVENCION`, `RECUPERACION`, `ASISTENCIA_SOCIAL`). | `ATENCION_CUADRILLA` |
| `prioridad` | `string` | No | Severidad de la misión (`BAJA`, `MEDIA`, `ALTA`, `CRITICA`). | `ALTA` |
| `delegacionId` | `UUID` | No | UUID de la delegación territorial asociada. | `30000000-0000-4000-8000-000000000001` |
| `incidenteId` | `UUID` | No | UUID del incidente específico atendido. | `a0000000-0000-4000-8000-000000000001` |
| `cuadrillaId` | `UUID` | No | UUID de la cuadrilla asignada. | `c0000000-0000-4000-8000-000000000001` |
| `patrullaId` | `UUID` | No | UUID de la patrulla verificadora asignada. | `p0000000-0000-4000-8000-000000000001` |
| `busqueda` | `string` | No | Búsqueda insensible a mayúsculas sobre código, título o descripción. | `Inundación` |
| `ordenarPor` | `string` | No (default: `creadoEn`) | Atributo de ordenamiento (`creadoEn`, `codigo`, `prioridad`). | `creadoEn` |
| `orden` | `string` | No (default: `desc`) | Dirección (`asc` o `desc`). | `desc` |

#### Ejemplo de Respuesta Exitosa (`HTTP 200 OK`)

```json
{
  "message": "Listado de misiones obtenido exitosamente",
  "data": [
    {
      "id": "m0000000-0000-4000-8000-000000000001",
      "codigo": "MIS-58291045",
      "titulo": "Despeje de sumidero y calzada",
      "descripcion": "Limpieza urgente de rejillas con camión desobstructor",
      "tipoMision": "ATENCION_CUADRILLA",
      "estado": "EN_CURSO",
      "prioridad": "ALTA",
      "justificacionRechazo": null,
      "incidenteId": "a0000000-0000-4000-8000-000000000001",
      "incidenteCodigo": "INC-58291045",
      "cuadrillaId": "c0000000-0000-4000-8000-000000000001",
      "cuadrillaNombre": "Cuadrilla Vías y Canales 1",
      "patrullaId": null,
      "patrullaNombre": null,
      "delegacionId": "30000000-0000-4000-8000-000000000001",
      "delegacionNombre": "Delegación Municipal Norte",
      "fechaInicio": "2026-10-04T12:00:00.000Z",
      "fechaCierre": null,
      "creadoEn": "2026-10-04T11:30:00.000Z",
      "actualizadoEn": "2026-10-04T12:00:00.000Z"
    }
  ],
  "meta": {
    "total": 42,
    "page": 1,
    "limit": 20,
    "totalPages": 3,
    "hasNext": true,
    "hasPrev": false
  }
}
```

---

### 3.2. `GET /api/misiones/{id}` (HU-17: Detalle Completo de Misión)

Obtiene la información exhaustiva de una misión operativa específica, incluyendo el incidente asociado o punto de prevención, la cuadrilla o patrulla asignada con sus recursos, la bitácora de tiempos y los reportes de terreno levantados con su evidencia multimedia.

#### Cabeceras Obligatorias (Headers)
| Cabecera | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `Authorization` | Bearer Token | Sí* | Token JWT de sesión o cabecera `X-User-Id`. |
| `X-User-Id` | UUID | Opcional/Compat | Identificador del usuario que realiza la consulta. Debe poseer permiso `misiones:leer`. |

#### Parámetros de Ruta (Path Parameters)
| Parámetro | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `id` | UUID | Sí | Identificador único de la misión operativa a consultar. |

#### Ejemplo de Respuesta Exitosa (`HTTP 200 OK`)

```json
{
  "message": "Detalle de misión obtenido exitosamente.",
  "data": {
    "id": "60000000-0000-4000-8000-000000000001",
    "codigo": "MIS-2026-001",
    "titulo": "Despeje de vía por caída de árbol mayor",
    "descripcion": "Retirar ramas que obstaculizan la calzada y verificar tendido eléctrico",
    "tipoMision": "ATENCION_CUADRILLA",
    "estado": "EN_CURSO",
    "prioridad": "ALTA",
    "justificacionRechazo": null,
    "fechaInicio": "2026-10-02T10:00:00.000Z",
    "fechaCierre": null,
    "creadoEn": "2026-10-02T09:30:00.000Z",
    "actualizadoEn": "2026-10-02T10:05:00.000Z",
    "creadoPor": {
      "id": "00000000-0000-4000-8000-000000000002",
      "nombre": "Operador Call Center",
      "email": "callcenter@valdivia.cl"
    },
    "encargado": {
      "id": "00000000-0000-4000-8000-000000000003",
      "nombre": "Encargado de Operaciones",
      "email": "encargado@valdivia.cl"
    },
    "incidente": {
      "id": "a0000000-0000-4000-8000-000000000001",
      "codigo": "INC-2026-001",
      "codigoSeguimiento": "58291045",
      "tipoAfectacion": "Caída de Árbol",
      "descripcion": "Árbol de gran tamaño sobre vía principal",
      "direccion": "Av. Ramón Picarte 1500, Valdivia",
      "latitud": -39.825,
      "longitud": -73.238,
      "estado": "EN_ATENCION",
      "prioridad": "ALTA",
      "requiereAsistenciaSocial": false,
      "delegacionNombre": "Sur"
    },
    "prevencion": null,
    "cuadrilla": {
      "id": "50000000-0000-4000-8000-000000000001",
      "nombre": "Cuadrilla Árboles y Vías 1",
      "estado": "EN_MISION",
      "delegacionNombre": "Sur",
      "delegado": {
        "id": "d0000000-0000-4000-8000-000000000001",
        "nombre": "Carlos Gómez",
        "email": "carlos.gomez@valdivia.cl"
      },
      "recursos": [
        {
          "id": "b0000000-0000-4000-8000-000000000001",
          "nombre": "Motosierra Stihl MS 382",
          "tipo": "INDIVIDUAL",
          "cantidadAsignada": 2
        }
      ]
    },
    "patrulla": null,
    "bitacoraTiempos": [
      {
        "hito": "CREACION",
        "fecha": "2026-10-02",
        "hora": "09:30:00",
        "timestamp": "2026-10-02T09:30:00.000Z",
        "descripcion": "Misión planificada y registrada en el sistema"
      },
      {
        "hito": "DESPLIEGUE_INICIO",
        "fecha": "2026-10-02",
        "hora": "10:00:00",
        "timestamp": "2026-10-02T10:00:00.000Z",
        "descripcion": "Inicio formal de operaciones y traslado a terreno"
      }
    ],
    "reportesTerreno": [
      {
        "id": "e0000000-0000-4000-8000-000000000001",
        "misionId": "60000000-0000-4000-8000-000000000001",
        "evaluador": {
          "id": "d0000000-0000-4000-8000-000000000001",
          "nombre": "Carlos Gómez",
          "email": "carlos.gomez@valdivia.cl",
          "rut": "12345678-9"
        },
        "resumenTecnico": "Troceado principal terminado; calzada despejada al 50%",
        "accionesRealizadas": "Uso de motosierra y retiro manual de ramas menores",
        "requiereApoyoAdicional": false,
        "danosEstimados": "Sin daños a tendido de baja tensión",
        "observaciones": "Pavimento húmedo",
        "personasAfectadas": 0,
        "estadoTerreno": "EN_PROCESO",
        "adjuntos": [
          {
            "id": "f0000000-0000-4000-8000-000000000001",
            "nombreArchivo": "corte_rama_1.jpg",
            "url": "/uploads/evidencia/corte_rama_1.jpg",
            "tipoMime": "image/jpeg",
            "tamanoBytes": 1845000,
            "creadoEn": "2026-10-02T10:25:00.000Z"
          }
        ],
        "creadoEn": "2026-10-02T10:30:00.000Z",
        "actualizadoEn": "2026-10-02T10:30:00.000Z"
      }
    ]
  }
}
```

### 3.3. `POST /api/misiones/{id}/llegada` (HU-42: Reporte de Llegada a Terreno por Delegado de Cuadrilla)

Permite al Delegado de cuadrilla notificar a la central que la brigada operativa se encuentra físicamente en el lugar de los trabajos, capturando las coordenadas GPS y hora actual del arribo.

- **Autenticación requerida:** `Authorization: Bearer <token_jwt>` (o cabecera `X-User-Id` en entornos de prueba interna).
- **Permiso RBAC requerido:** `misiones:terreno:ejecutar`.
- **Regla de pertenencia táctica:** El usuario autenticado debe ser el **delegado asignado a la cuadrilla** de la misión (`cuadrilla.usuario_delegado_id`) o poseer el rol `ADMIN`.

#### Cuerpo de la Petición (`Content-Type: application/json`)

```json
{
  "latitud": -39.81422,
  "longitud": -73.24591,
  "observaciones": "Equipo en el sector, evaluando afectación y despeje de calzada."
}
```

#### Parámetros del Cuerpo

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `latitud` | `number` | Sí | Latitud WGS84 capturada mediante la Geolocation API (rango: -90 a 90). |
| `longitud` | `number` | Sí | Longitud WGS84 capturada mediante la Geolocation API (rango: -180 a 180). |
| `observaciones` | `string` | No | Comentarios u observaciones adicionales de arribo (máximo 500 caracteres). |

#### Efectos Operativos y de Negocio
1. **Bitácora Inmutable (`mision_hito`):** Inserta un registro de tipo `LLEGADA_TERRENO` con las coordenadas PostGIS `ST_SetSRID(ST_MakePoint(longitud, latitud), 4326)` y el usuario responsable en sesión.
2. **Ciclo de Vida de Misión:** Si la misión se encuentra en `PLANIFICADA` o `DESPACHADA`, transiciona automáticamente su estado a `EN_CURSO`.
3. **Cálculo de Tiempos de Respuesta:** Si `mision.fecha_inicio` es nula, se fija con `CURRENT_TIMESTAMP`, permitiendo calcular el tiempo transcurrido desde el despacho hasta el arribo efectivo.
4. **Telemetría de la Cuadrilla (`personal`):** Actualiza en lote `personal.ultima_ubicacion` y `personal.ultima_actualizacion_ubicacion` para todos los miembros activos vinculados en `cuadrilla_personal` y para el delegado responsable.
5. **Notificación en Tiempo Real:** Emite el evento WebSocket `mision:hito_registrado` impactando la línea de tiempo vertical del Encargado (H23) y la sala `mision:{id}`.

#### Ejemplo de Respuesta Exitosa (`HTTP 201 Created`)

```json
{
  "message": "Llegada a terreno reportada exitosamente.",
  "data": {
    "hitoId": "80000000-0000-4000-8000-000000000001",
    "misionId": "60000000-0000-4000-8000-000000000001",
    "codigoMision": "MIS-2026-001",
    "hito": "LLEGADA_TERRENO",
    "descripcion": "Llegada a terreno reportada. Equipo en el sector, evaluando afectación y despeje de calzada.",
    "latitud": -39.81422,
    "longitud": -73.24591,
    "registradoEn": "2026-11-08T19:40:00.000Z",
    "registradoPor": {
      "id": "00000000-0000-4000-8000-000000000005",
      "nombre": "Pedro Delegado"
    },
    "estadoMision": "EN_CURSO",
    "miembrosActualizados": 4
  }
}
```

---

## 4. Códigos de Estado y Errores Esperables

- **`400 Bad Request`:**
  - En `GET /api/misiones`: Parámetros de consulta no conformes al esquema Zod (ej. `page < 1`, `limit > 100`, valores de enum desconocidos o `delegacionId` no UUID).
  - En `GET /api/misiones/{id}`: El parámetro `id` no cumple el estándar UUID versión 4.
  - En `POST /api/misiones/{id}/llegada`: Coordenadas geográficas fuera de rango (-90 a 90 / -180 a 180), JSON mal formado o la misión carece de cuadrilla asignada.
- **`401 Unauthorized`:**
  - Petición sin token JWT Bearer, sesión expirada o cabecera `X-User-Id` no asociada a un usuario activo.
- **`403 Forbidden`:**
  - Falta de permiso requerido (`misiones:leer` o `misiones:terreno:ejecutar`).
  - En `POST /api/misiones/{id}/llegada`: El usuario no es el delegado asignado a la cuadrilla de esa misión en particular (y no posee rol de Administrador).
- **`404 Not Found`:**
  - La misión consultada no existe en el sistema.
- **`409 Conflict`:**
  - En `POST /api/misiones/{id}/llegada`: La llegada a terreno ya fue reportada previamente para esta misión (`hito = 'LLEGADA_TERRENO'` existente) o la misión se encuentra en un estado terminal que no admite arribo (`COMPLETADA`, `CANCELADA` o `RECHAZADA`).
- **`500 Internal Server Error`:**
  - Error inesperado de persistencia o fallo de base de datos.


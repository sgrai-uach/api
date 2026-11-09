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
| `POST` | `/api/misiones` | `misiones:asignar` | Despachar patrulla verificadora disponible a un incidente formal en estado REPORTADO (HU-20). |
| `POST` | `/api/misiones/{id}/rechazar` | `misiones:terreno:verificar` | Rechazar asignación de misión por patrulla verificadora en terreno con justificación obligatoria (HU-69). |

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

---

### 3.3. `POST /api/misiones` (HU-20: Asignación de Patrulla Verificadora a Incidente)

Permite al Encargado de Operaciones despachar de inmediato una patrulla verificadora disponible hacia un incidente en estado `REPORTADO` para realizar el diagnóstico y evaluación preliminar en terreno.

- **Autenticación requerida:** `Authorization: Bearer <token_jwt>`
- **Permiso RBAC requerido:** `misiones:asignar` (perfiles `ENCARGADO` y `ADMIN`).

#### Transacción Atómica Ejecutada
1. Verifica que el incidente exista y su estado sea exactamente `REPORTADO`.
2. Actualiza atómicamente la patrulla verificadora seleccionada a `estado = 'EN_VERIFICACION'` verificando que se encuentre en estado `DISPONIBLE` y activa (`eliminado_en IS NULL`). Si fue tomada concurrentemente por otro operador, aborta la transacción con `HTTP 409 Conflict`.
3. Crea el registro en `mision` con `tipo_mision = 'VERIFICACION'`, `estado = 'DESPACHADA'` y código autogenerado correlativo único (`MIS-YYYY-NNNN`).
4. Mantiene el incidente en `estado = 'REPORTADO'` (pendiente de confirmación de la patrulla).
5. Inserta el hito inicial en la bitácora `mision_hito` (`hito = 'DESPACHADA'`).
6. Emite notificaciones WebSocket reactivas a través del broker Redis.

#### Cuerpo de la Petición (Request Body)

```json
{
  "incidenteId": "50000000-0000-4000-8000-000000000001",
  "patrullaId": "f1000000-0000-4000-8000-000000000001",
  "tipoMision": "VERIFICACION",
  "titulo": "Verificación técnica de anegamiento en Las Ánimas",
  "descripcion": "Acudir al punto para evaluar riesgo de ingreso de agua a viviendas y requerimiento de motobomba.",
  "prioridad": "ALTA"
}
```

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `incidenteId` | `UUID` | **Sí** | Identificador único del incidente a verificar. Debe encontrarse en estado `REPORTADO`. |
| `patrullaId` | `UUID` | **Sí** | Identificador único de la patrulla verificadora a despachar. Debe encontrarse en estado `DISPONIBLE`. |
| `tipoMision` | `string` | No (default: `VERIFICACION`) | Tipo de misión táctica. |
| `titulo` | `string` | No | Título descriptivo (3 a 150 caracteres). Si se omite, se autogenera: `"Verificación de Incidente [CODIGO]"`. |
| `descripcion` | `string` | No | Instrucciones tácticas preliminares para la patrulla (máx. 1000 caracteres). |
| `prioridad` | `string` | No | Severidad (`BAJA`, `MEDIA`, `ALTA`, `CRITICA`). Si se omite, hereda la prioridad del incidente. |

#### Ejemplo de Respuesta Exitosa (`HTTP 201 Created`)

```json
{
  "message": "Misión de verificación creada y patrulla despachada exitosamente.",
  "data": {
    "mision": {
      "id": "60000000-0000-4000-8000-000000000050",
      "codigo": "MIS-2026-8341",
      "titulo": "Verificación técnica de anegamiento en Las Ánimas",
      "descripcion": "Acudir al punto para evaluar riesgo de ingreso de agua a viviendas y requerimiento de motobomba.",
      "tipoMision": "VERIFICACION",
      "estado": "DESPACHADA",
      "prioridad": "ALTA",
      "incidenteId": "50000000-0000-4000-8000-000000000001",
      "patrullaId": "f1000000-0000-4000-8000-000000000001",
      "encargadoId": "00000000-0000-4000-8000-000000000003",
      "fechaInicio": "2026-10-27T17:00:00.000Z",
      "creadoEn": "2026-10-27T17:00:00.000Z"
    },
    "incidente": {
      "id": "50000000-0000-4000-8000-000000000001",
      "codigo": "INC-2026-1042",
      "estado": "REPORTADO"
    },
    "patrulla": {
      "id": "f1000000-0000-4000-8000-000000000001",
      "nombre": "Patrulla Ánimas Norte 1",
      "estado": "EN_VERIFICACION"
    },
    "hitoInicial": {
      "id": "70000000-0000-4000-8000-000000000001",
      "hito": "DESPACHADA",
      "descripcion": "Misión de verificación asignada y despachada a la patrulla Patrulla Ánimas Norte 1.",
      "creadoEn": "2026-10-27T17:00:00.000Z"
    }
  }
}
```

---

### 3.4. `POST /api/misiones/{id}/rechazar` (HU-69: Rechazo de Misión por Patrulla Verificadora)

Permite a la patrulla verificadora en terreno rechazar una misión táctica despachada, ingresando de forma obligatoria el motivo del rechazo conforme a la **Regla de Negocio Crítica §3.3** (mínimo 5 caracteres).

- **Autenticación requerida:** `Authorization: Bearer <token_jwt>` (o `x-user-id` en cabeceras).
- **Permiso requerido:** `misiones:terreno:verificar` y pertenencia a la patrulla asignada (o rol `Administrador`).

#### Parámetros de Ruta (`Path Params`)

| Parámetro | Tipo | Requerido | Descripción |
|---|---|---|---|
| `id` | `UUID` | **Sí** | Identificador único de la misión táctica asignada. |

#### Cuerpo de la Solicitud (`Request Body`)

```json
{
  "justificacion_rechazo": "Desperfecto mecánico en el neumático delantero del vehículo institucional.",
  "latitud": -39.81422,
  "longitud": -73.24589
}
```

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `justificacion_rechazo` (o `justificacionRechazo`) | `string` | **Sí** | Motivo obligatorio del rechazo. Tras aplicar `.trim()`, debe contener al menos 5 caracteres. |
| `latitud` | `number` | No | Latitud WGS84 de la patrulla al registrar el rechazo. |
| `longitud` | `number` | No | Longitud WGS84 de la patrulla al registrar el rechazo. |

#### Comportamiento Transaccional Atómico

1. `mision.estado` transiciona a `'RECHAZADA'`.
2. Se persiste `mision.justificacion_rechazo` y se fija `fecha_cierre = CURRENT_TIMESTAMP`.
3. `patrulla_verificadora.estado` transiciona a `'DISPONIBLE'` (liberada para nuevas asignaciones).
4. `incidente.estado` revierte a `'REPORTADO'` para que el Encargado pueda reasignar de inmediato.
5. Se inserta un nuevo registro en `mision_hito` (`hito = 'RECHAZADA'`).

#### Ejemplo de Respuesta Exitosa (`HTTP 200 OK`)

```json
{
  "message": "Misión rechazada exitosamente. El incidente ha vuelto a estado REPORTADO para su reasignación.",
  "data": {
    "mision": {
      "id": "60000000-0000-4000-8000-000000000050",
      "codigo": "MIS-2026-8341",
      "estado": "RECHAZADA",
      "justificacionRechazo": "Desperfecto mecánico en el neumático delantero del vehículo institucional.",
      "actualizadoEn": "2026-11-03T18:45:00.000Z"
    },
    "patrulla": {
      "id": "f1000000-0000-4000-8000-000000000001",
      "nombre": "Patrulla Ánimas Norte 1",
      "estado": "DISPONIBLE"
    },
    "incidente": {
      "id": "50000000-0000-4000-8000-000000000001",
      "codigo": "INC-2026-1042",
      "estado": "REPORTADO"
    },
    "hito": {
      "id": "70000000-0000-4000-8000-000000000002",
      "hito": "RECHAZADA",
      "descripcion": "Misión rechazada por patrulla: Desperfecto mecánico en el neumático delantero del vehículo institucional.",
      "creadoEn": "2026-11-03T18:45:00.000Z"
    }
  }
}
```

---

## 4. Códigos de Estado y Errores Esperables

- **`400 Bad Request`:**
  - En `GET /api/misiones`: Parámetros de consulta no conformes al esquema Zod (ej. `page < 1`, `limit > 100`, valores de enum desconocidos o `delegacionId` no UUID).
  - En `GET /api/misiones/{id}`: El parámetro `id` no cumple el estándar UUID versión 4.
  - En `POST /api/misiones`: Body no es JSON válido o los identificadores no son UUIDs válidos.
  - En `POST /api/misiones/{id}/rechazar`: Motivo de rechazo ausente o con menos de 5 caracteres útiles, formato JSON inválido o UUID no válido.
- **`401 Unauthorized`:**
  - Petición sin token JWT Bearer o sesión expirada.
- **`403 Forbidden`:**
  - El usuario no cuenta con el permiso requerido (`misiones:leer`, `misiones:asignar` o `misiones:terreno:verificar`).
  - En `POST /api/misiones/{id}/rechazar`: El usuario autenticado no pertenece a la patrulla verificadora asignada a la misión.
- **`404 Not Found`:**
  - En `GET /api/misiones/{id}` y `POST /api/misiones/{id}/rechazar`: No existe ninguna misión con el UUID proporcionado.
  - En `POST /api/misiones`: El `incidenteId` o la `patrullaId` proporcionada no existe en la base de datos o la patrulla ha sido desactivada lógicamente.
- **`409 Conflict`:**
  - En `POST /api/misiones`:
    1. **Patrulla no disponible concurrentemente:** La patrulla seleccionada fue despachada o cambió de estado concurrentemente (`estado != 'DISPONIBLE'`).
    2. **Incidente no en estado REPORTADO:** El incidente ya no se encuentra en estado `REPORTADO` (ej. ya está `VERIFICANDO`, `EN_ATENCION` o `RESUELTO`), por lo que no puede asignarse una patrulla verificadora.
  - En `POST /api/misiones/{id}/rechazar`:
    1. La misión ya fue previamente rechazada.
    2. La misión no se encuentra en estado `DESPACHADA` (ej. ya está `EN_CURSO`, `COMPLETADA` o `CANCELADA`).
- **`500 Internal Server Error`:**
  - Error inesperado de persistencia o fallo de base de datos.

---

## 5. Eventos en Tiempo Real (Socket.io & Broker Redis)

Al confirmarse eventos sobre misiones, el backend emite los siguientes eventos:

1. **`mision:asignada`**:
   - **Salas destino:** `patrulla:{patrullaId}`, `encargado` y `sala:encargados`.
   - **Propósito:** Notificar en tiempo real a la unidad en terreno su orden de verificación con georreferenciación e instrucciones tácticas.
2. **`mision:rechazada` (HU-69)**:
   - **Salas destino:** `encargado` y `sala:encargados`.
   - **Propósito:** Alerta inmediata al Centro de Mando sobre la imposibilidad de atención por parte de la patrulla asignada junto con el motivo justificado.
3. **`incidente:actualizado`**:
   - **Salas destino:** `encargado`, `sala:encargados` y `mapa`.
   - **Propósito:** Permite que el tablero Kanban del Encargado en `sgrai-web` mueva automáticamente la tarjeta del incidente (a `VERIFICANDO` al despachar, o devuelta a `REPORTADO` al rechazar) sin requerir recarga manual.
4. **`patrulla:actualizada`**:
   - **Salas destino:** `encargado`, `supervisor` y `mapa`.
   - **Propósito:** Actualiza en vivo el marcador del mapa y las tablas de disponibilidad operativa cambiando el estado de la patrulla (`EN_VERIFICACION` al asignar, `DISPONIBLE` al rechazar).



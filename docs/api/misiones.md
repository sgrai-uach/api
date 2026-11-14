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
| `POST` | `/api/misiones` | `misiones:asignar` | Despacho y asignación de misión operativa a terreno: verificación primaria con patrulla (HU-20) o atención técnica con cuadrilla liberando la patrulla previa (HU-21 / Regla ICS §3.2). |
| `POST` | `/api/misiones/{id}/aceptar` | `misiones:terreno:verificar` | Confirmar y aceptar misión asignada desde terreno (PWA), transicionando de `DESPACHADA` a `EN_CURSO`, registrando `fecha_inicio` y el hito `'Misión Aceptada por Patrulla'` en `mision_hito` (HU-36). |
| `PATCH` | `/api/terreno/notificaciones/{id}/estado` | `misiones:terreno:verificar` | Confirmar de forma idempotente acuse de recibo técnico ('RECIBIDA') o lectura operativa ('LEIDA') desde terreno (HU-35). |
| `GET` | `/api/terreno/misiones/pendientes` | `misiones:terreno:verificar` | Consultar misiones asignadas con notificaciones en PENDIENTE_ENVIO o ENVIADA para reconciliación offline (HU-35). |

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
      "trazabilidadNotificacion": null,
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
    "trazabilidadNotificacion": null,
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
4. Actualiza el incidente a `estado = 'VERIFICANDO'`.
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
      "codigo": "MIS-2026-0001",
      "titulo": "Verificación técnica de anegamiento en Las Ánimas",
      "descripcion": "Acudir al punto para evaluar riesgo de ingreso de agua a viviendas y requerimiento de motobomba.",
      "tipoMision": "VERIFICACION",
      "estado": "DESPACHADA",
      "prioridad": "ALTA",
      "incidenteId": "50000000-0000-4000-8000-000000000001",
      "patrullaId": "f1000000-0000-4000-8000-000000000001",
      "encargadoId": "00000000-0000-4000-8000-000000000003",
      "fechaInicio": null,
      "creadoEn": "2026-10-27T17:00:00.000Z"
    },
    "incidente": {
      "id": "50000000-0000-4000-8000-000000000001",
      "codigo": "INC-2026-1042",
      "estado": "VERIFICANDO"
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
    },
    "notificacion": {
      "id": "80000000-0000-4000-8000-000000000001",
      "misionId": "60000000-0000-4000-8000-000000000050",
      "patrullaId": "f1000000-0000-4000-8000-000000000001",
      "estado": "ENVIADA",
      "intentosEnvio": 1,
      "creadaAt": "2026-10-27T17:00:00.000Z",
      "enviadaAt": "2026-10-27T17:00:01.000Z",
      "recibidaAt": null,
      "leidaAt": null
    }
  }
}
```

---

### 3.4. `POST /api/misiones` (HU-21: Asignar Cuadrilla a Incidente y Liberar Patrulla Verificadora)

Permite al **Encargado de Operaciones** (o Administrador) desplegar una cuadrilla operativa para la intervención táctica y pesada de un incidente verificado, liberando de forma atómica e inmediata a la patrulla verificadora previa conforme a los protocolos del Sistema de Comando de Incidentes (ICS).

- **Autenticación requerida:** `Authorization: Bearer <token_jwt>`
- **Permiso RBAC requerido:** `misiones:asignar` (asignado a roles Encargado y Administrador).

#### Reglas de Negocio Críticas Aplicadas
1. **Validación de Estados de Entrada y Evaluación Previa en Terreno (Regla ICS):**
   - El incidente debe existir y encontrarse en estado canónico `REPORTADO` o `VERIFICANDO`. Si ya se encuentra en `EN_ATENCION`, `RESUELTO` o `NO_ABORDABLE`, la API responde con `409 Conflict`.
   - **Evaluación técnica obligatoria antes del relevo:** Si el incidente está en `VERIFICANDO` y cuenta con una patrulla verificadora asignada, la patrulla **debe haber emitido previamente su informe técnico en terreno (`reporte_terreno`)** o registrado el hito de evaluación. Si aún se encuentra en traslado o sin emitir dicho informe, el despacho es bloqueado con `409 Conflict` y código de negocio `'VERIFICACION_EN_CURSO'`.
   - Si el incidente se encuentra en `REPORTADO` (despacho directo sin patrullaje previo), esta validación no aplica y se permite la asignación directa de cuadrilla.
   - La cuadrilla seleccionada debe encontrarse en estado `DISPONIBLE` y activa (`activo = true`, `eliminado_en IS NULL`). Si está en `EN_MISION` o `NO_DISPONIBLE`, se rechaza con `409 Conflict`.
2. **Transacción Atómica Kysely:**
   - Adquiere bloqueo pesimista (`FOR UPDATE`) sobre el incidente y la cuadrilla.
   - Serializa la generación de correlativo mediante `pg_advisory_xact_lock(hashtext('mision_codigo_seq'))`.
   - Crea la nueva misión operativa con `tipo_mision = 'ATENCION_CUADRILLA'`, `estado = 'DESPACHADA'`, código correlativo oficial `MIS-YYYY-XXXX` y `fecha_inicio = null` (permanece en null hasta que la cuadrilla acepte e inicie trayecto en terreno).
   - Actualiza `cuadrilla.estado = 'EN_MISION'` condicionando `WHERE estado = 'DISPONIBLE'`.
   - Transiciona el incidente a `incidente.estado = 'EN_ATENCION'` (reflejándose en la columna correspondiente del tablero Kanban).
3. **Regla de Negocio Crítica §3.2 (Liberación Automática de Patrulla Verificadora):**
   - Si el incidente contaba con una misión de verificación activa (`tipo_mision = 'VERIFICACION'` en estado `DESPACHADA` o `EN_CURSO`) con una patrulla verificadora asignada:
     - La misión de verificación se cierra atómicamente transicionando a `estado = 'COMPLETADA'` y fijando `fecha_cierre = CURRENT_TIMESTAMP`.
     - Se registra en la bitácora `mision_hito` de dicha misión el hito `'VERIFICACION_FINALIZADA'` con la glosa explicativa del relevo táctico.
     - La patrulla verificadora previa queda liberada transicionando a `estado = 'DISPONIBLE'` (siempre que no cuente con otra misión activa concurrentemente y no esté desactivada).
4. **Herencia de Prioridad Operativa:**
   - Si en el cuerpo de la petición no se envía una prioridad explícita, se hereda prioritariamente de la misión de verificación activa de la patrulla; si no existía patrulla previa, se hereda de la prioridad del incidente (por defecto `MEDIA`).
5. **Registro de Bitácora (`mision_hito`):**
   - Para la nueva misión de cuadrilla se registra el hito `'CUADRILLA_DESPACHADA'` con la descripción *"Cuadrilla despachada a terreno para resolución táctica del incidente"*.
6. **Notificaciones WebSocket en Tiempo Real:**
   - `mision:asignada`: Emitido a las salas `cuadrilla:{cuadrillaId}`, `encargado` y `supervisor`.
   - `cuadrilla:actualizada`: Emitido a `operaciones`, `encargado` y `supervisor` con el estado `EN_MISION`.
   - `patrulla:liberada`: Emitido a las salas `patrulla:{patrullaId}`, `encargado` y `supervisor`, con payload `{ patrullaId, nombre, misionPreviaId, incidenteId, estado: 'DISPONIBLE', liberadaEn }`.
   - `patrulla:actualizada`: Emitido a las salas de monitoreo con el estado `DISPONIBLE`.
   - `incidente:actualizado`: Emitido a la sala `encargado` y `mapa` informando la transición a `EN_ATENCION`.

#### Cuerpo de la Solicitud (JSON Request Body)

```json
{
  "tipoMision": "ATENCION_CUADRILLA",
  "incidenteId": "30000000-0000-4000-8000-000000000001",
  "cuadrillaId": "50000000-0000-4000-8000-000000000001",
  "titulo": "Despeje de árbol caído y calzada - Sector Collico",
  "descripcion": "Intervención con motosierras y camión tolva para habilitar tránsito vehicular.",
  "prioridad": "ALTA"
}
```

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `tipoMision` | `string` | **Sí** | Literal `"ATENCION_CUADRILLA"`. |
| `incidenteId` | `UUID` | **Sí** | Identificador único del incidente a atender (`REPORTADO` o `VERIFICANDO`). |
| `cuadrillaId` | `UUID` | **Sí** | Identificador único de la cuadrilla operativa disponible a despachar. |
| `titulo` | `string` | No | Título descriptivo (3 a 150 caracteres). Si se omite, se genera automáticamente. |
| `descripcion` | `string` | No | Instrucciones tácticas de intervención para la cuadrilla (máx. 1000 caracteres). |
| `prioridad` | `string` | No | Prioridad táctica (`BAJA`, `MEDIA`, `ALTA`, `CRITICA`). Heredada si se omite. |

#### Ejemplo de Respuesta Exitosa (`HTTP 201 Created`)

```json
{
  "message": "Cuadrilla 'Cuadrilla Vías y Canales 1' asignada exitosamente al incidente INC-2026-0001. La patrulla verificadora previa ha sido liberada a estado DISPONIBLE.",
  "data": {
    "mision": {
      "id": "70000000-0000-4000-8000-000000000001",
      "codigo": "MIS-2026-0005",
      "titulo": "Despeje de árbol caído y calzada - Sector Collico",
      "descripcion": "Intervención con motosierras y camión tolva para habilitar tránsito vehicular.",
      "tipoMision": "ATENCION_CUADRILLA",
      "estado": "DESPACHADA",
      "prioridad": "ALTA",
      "incidenteId": "30000000-0000-4000-8000-000000000001",
      "cuadrillaId": "50000000-0000-4000-8000-000000000001",
      "encargadoId": "10000000-0000-4000-8000-000000000002",
      "creadoPorId": "10000000-0000-4000-8000-000000000002",
      "fechaInicio": null,
      "creadoEn": "2026-10-04T12:30:00.000Z"
    },
    "cuadrilla": {
      "id": "50000000-0000-4000-8000-000000000001",
      "nombre": "Cuadrilla Vías y Canales 1",
      "estado": "EN_MISION"
    },
    "incidente": {
      "id": "30000000-0000-4000-8000-000000000001",
      "codigo": "INC-2026-0001",
      "estado": "EN_ATENCION",
      "prioridad": "ALTA"
    },
    "patrullaLiberada": {
      "id": "f1000000-0000-4000-8000-000000000001",
      "nombre": "Patrulla Rápida Costa-1",
      "estado": "DISPONIBLE",
      "misionPreviaId": "60000000-0000-4000-8000-000000000001"
    },
    "hitoCuadrilla": {
      "id": "80000000-0000-4000-8000-000000000001",
      "misionId": "70000000-0000-4000-8000-000000000001",
      "hito": "CUADRILLA_DESPACHADA",
      "descripcion": "Cuadrilla despachada a terreno para resolución táctica del incidente",
      "creadoEn": "2026-10-04T12:30:00.000Z"
    },
    "hitoPatrulla": {
      "id": "80000000-0000-4000-8000-000000000002",
      "misionId": "60000000-0000-4000-8000-000000000001",
      "hito": "VERIFICACION_FINALIZADA",
      "descripcion": "Misión de verificación concluida automáticamente por asignación y relevo de cuadrilla operativa",
      "creadoEn": "2026-10-04T12:30:00.000Z"
    }
  }
}
```

### 3.5. `POST /api/misiones/{id}/aceptar` (HU-36: Aceptación de Misión por Patrulla Verificadora en PWA)

Permite a la patrulla verificadora en terreno confirmar desde su dispositivo móvil (`sgrai-pwa`) que ha tomado conocimiento de la misión asignada y se dirige al lugar para iniciar la evaluación primaria.

#### Reglas de Negocio y Transición Atómica
1. **Validación de Estado Inicial (`DESPACHADA`) y Pertenencia:** Solo se pueden aceptar misiones con patrulla verificadora asignada que se encuentren en estado `DESPACHADA`. El operador debe ser el líder de la patrulla o integrante activo en `patrulla_personal` (salvo `ADMIN`).
2. **Transición Atómica (Kysely Transaction con `FOR UPDATE OF mision`):**
   - Actualiza `mision.estado` de `DESPACHADA` a `EN_CURSO`.
   - Fija `mision.fecha_inicio = CURRENT_TIMESTAMP` y `mision.actualizado_en = CURRENT_TIMESTAMP`.
   - Inserta en la tabla `mision_hito` el registro con código `hito = 'MISION_ACEPTADA'`, glosa `descripcion = 'Misión Aceptada por Patrulla'`, `registrado_por_id` del funcionario en sesión y coordenadas GPS opcionales (`latitud` y `longitud` en paridad).
3. **Invariantes del Sistema de Comando de Incidentes (ICS):**
   - La patrulla verificadora asignada debe estar activa (`eliminado_en IS NULL`) y mantenerse en estado `EN_VERIFICACION`.
   - El incidente asociado permanece en `VERIFICANDO` (nunca se utiliza el estado ambiguo no canónico `'En camino'`).
4. **Tiempo Real (Socket.io / Redis):**
   - Emite el evento `mision:actualizada` hacia las salas `encargado`, `sala:encargados` y `supervisor` del Centro de Mando.

#### Cuerpo de la Petición (Opcional)
```json
{
  "latitud": -39.819588,
  "longitud": -73.245209
}
```

#### Ejemplo de Respuesta Exitosa (`HTTP 200 OK`)
```json
{
  "message": "Misión aceptada exitosamente. La patrulla se encuentra en trayecto para iniciar la evaluación.",
  "data": {
    "mision": {
      "id": "60000000-0000-4000-8000-000000000001",
      "codigo": "MIS-2026-0001",
      "titulo": "Verificación de Incidente INC-2026-001",
      "descripcion": "Evaluar caída de árbol y riesgo eléctrico",
      "tipoMision": "VERIFICACION",
      "estado": "EN_CURSO",
      "prioridad": "ALTA",
      "incidenteId": "a0000000-0000-4000-8000-000000000001",
      "patrullaId": "f1000000-0000-4000-8000-000000000001",
      "fechaInicio": "2026-11-01T21:00:00.000Z",
      "actualizadoEn": "2026-11-01T21:00:00.000Z"
    },
    "patrulla": {
      "id": "f1000000-0000-4000-8000-000000000001",
      "nombre": "Patrulla Rápida Costa-1",
      "estado": "EN_VERIFICACION"
    },
    "incidente": {
      "id": "a0000000-0000-4000-8000-000000000001",
      "codigo": "INC-2026-001",
      "estado": "VERIFICANDO"
    },
    "hito": {
      "id": "70000000-0000-4000-8000-000000000001",
      "misionId": "60000000-0000-4000-8000-000000000001",
      "hito": "MISION_ACEPTADA",
      "descripcion": "Misión Aceptada por Patrulla",
      "registradoPorId": "00000000-0000-4000-8000-000000000004",
      "latitud": -39.819588,
      "longitud": -73.245209,
      "creadoEn": "2026-11-01T21:00:00.000Z"
    }
  }
}
```

---

### 3.6. `PATCH /api/terreno/notificaciones/{id}/estado` (HU-35: Acuse de Recibo y Lectura)

Permite al cliente de terreno (`sgrai-pwa`) emitir de forma inmediata y transparente el acuse de recibo técnico (`RECIBIDA`) apenas ingresa el payload al dispositivo, o el acuse de lectura operativo (`LEIDA`) cuando el usuario toca la alerta o abre el detalle de la misión.

- **Autenticación requerida:** `Authorization: Bearer <token_jwt>`
- **Permiso RBAC requerido:** `misiones:terreno:verificar` (asignado a `PATRULLA_VERIFICADORA` y `ADMIN`).
- **Control de Acceso por Propiedad:** Valida que la notificación pertenezca a la patrulla asignada (el usuario debe ser el líder o integrante en `patrulla_personal`, salvo perfil `ADMIN`).

#### Parámetros de Ruta (Path Parameters)
| Parámetro | Tipo | Requerido | Descripción |
|---|---|---|---|
| `id` | `UUID` | **Sí** | Identificador único de la notificación de despacho (`notificaciones_mision.id`). |

#### Cuerpo de la Petición (Request Body)
```json
{
  "estado": "RECIBIDA"
}
```

| Campo | Tipo | Requerido | Valores Permitidos | Descripción |
|---|---|---|---|---|
| `estado` | `string` | **Sí** | `"RECIBIDA"`, `"LEIDA"` | Nuevo estado de confirmación reportado. |

#### Reglas de Idempotencia y No Retroceso
1. **Idempotencia:** Si el dispositivo reenvía un acuse al mismo estado (ej. `RECIBIDA` dos veces por cortes de red), el backend retorna `200 OK` **sin modificar los timestamps originales** (`recibida_at`).
2. **Prohibición de Retroceso:** Si la notificación ya transitó a `LEIDA`, enviar un acuse `RECIBIDA` retorna `200 OK` manteniendo el estado `LEIDA` intacto.
3. **Completado Cronológico:** Si se recibe un acuse directo a `LEIDA`, se autocompleta `recibida_at = COALESCE(recibida_at, NOW())` y `enviada_at = COALESCE(enviada_at, NOW())`.

#### Ejemplo de Respuesta Exitosa (`HTTP 200 OK`)
```json
{
  "message": "Estado de notificación actualizado exitosamente.",
  "data": {
    "id": "80000000-0000-4000-8000-000000000001",
    "misionId": "60000000-0000-4000-8000-000000000050",
    "patrullaId": "f1000000-0000-4000-8000-000000000001",
    "estado": "RECIBIDA",
    "intentosEnvio": 1,
    "creadaAt": "2026-10-27T17:00:00.000Z",
    "enviadaAt": "2026-10-27T17:00:01.000Z",
    "recibidaAt": "2026-10-27T17:00:04.000Z",
    "leidaAt": null
  }
}
```

---

### 3.7. `GET /api/terreno/misiones/pendientes` (HU-35: Reconciliación Offline)

Permite al cliente móvil (`sgrai-pwa`) consultar las misiones asignadas cuyas notificaciones se encuentran en `PENDIENTE_ENVIO` o `ENVIADA` (no confirmadas) al momento de recuperar la cobertura de red tras operar en modo avión o fuera de señal.

- **Autenticación requerida:** `Authorization: Bearer <token_jwt>`
- **Permiso RBAC requerido:** `misiones:terreno:verificar`

#### Ejemplo de Respuesta Exitosa (`HTTP 200 OK`)
```json
{
  "message": "Misiones pendientes obtenidas exitosamente.",
  "total": 1,
  "data": [
    {
      "notificacionId": "80000000-0000-4000-8000-000000000001",
      "misionId": "60000000-0000-4000-8000-000000000050",
      "codigoMision": "MIS-2026-0001",
      "titulo": "Verificación técnica de anegamiento",
      "descripcion": "Acudir al punto para evaluar riesgo de ingreso de agua",
      "tipoMision": "VERIFICACION",
      "prioridad": "ALTA",
      "estadoMision": "DESPACHADA",
      "estadoNotificacion": "PENDIENTE_ENVIO",
      "patrullaId": "f1000000-0000-4000-8000-000000000001",
      "incidenteId": "50000000-0000-4000-8000-000000000001",
      "incidenteCodigo": "INC-2026-1042",
      "incidenteFolio": "FOL-1042",
      "tipoAfectacion": "Anegamiento de calzada",
      "direccion": "Av. Ramón Picarte 1500",
      "latitud": -39.819588,
      "longitud": -73.245209,
      "creadaAt": "2026-10-27T17:00:00.000Z",
      "enviadaAt": null
    }
  ]
}
```

---

## 4. Códigos de Estado y Errores Esperables

- **`400 Bad Request`:**
  - En `GET /api/misiones`: Parámetros de consulta no conformes al esquema Zod (ej. `page < 1`, `limit > 100`, valores de enum desconocidos o `delegacionId` no UUID).
  - En `GET /api/misiones/{id}` y `POST /api/misiones/{id}/aceptar`: El parámetro `id` no cumple el estándar UUID versión 4 o se envía una coordenada GPS incompleta (`latitud` sin `longitud` o viceversa).
  - En `GET /api/misiones/{id}`: El parámetro `id` no cumple el estándar UUID versión 4.
  - En `PATCH /api/terreno/notificaciones/{id}/estado`: El parámetro `id` no cumple el estándar UUID versión 4; el body no es JSON válido o el estado no es `"RECIBIDA"` ni `"LEIDA"`.
  - En `POST /api/misiones`: Body no es JSON válido o los identificadores no son UUIDs válidos.
- **`401 Unauthorized`:**
  - Petición sin token JWT Bearer o sesión expirada.
- **`403 Forbidden`:**
  - El usuario no cuenta con el permiso requerido (`misiones:leer` para consulta, `misiones:asignar` para despacho, `misiones:terreno:verificar` para la aceptación en terreno y para los endpoints de terreno `PATCH /api/terreno/notificaciones/{id}/estado` y `GET /api/terreno/misiones/pendientes`), o intenta aceptar una misión asignada a otra patrulla verificadora.
  - Pertenencia a patrulla ajena: En `PATCH /api/terreno/notificaciones/{id}/estado`, si la notificación pertenece a otra patrulla y el usuario no es `ADMIN`.
- **`404 Not Found`:**
  - En `GET /api/misiones/{id}` y `POST /api/misiones/{id}/aceptar`: No existe ninguna misión con el UUID proporcionado.
  - En `PATCH /api/terreno/notificaciones/{id}/estado`: No existe ninguna notificación con el UUID proporcionado.
  - En `POST /api/misiones`: El `incidenteId`, la `patrullaId` o la `cuadrillaId` proporcionada no existe en la base de datos o ha sido desactivada lógicamente.
- **`409 Conflict`:**
  - En `POST /api/misiones`:
    1. **`VERIFICACION_EN_CURSO`:** La patrulla verificadora asignada al incidente aún no ha finalizado la evaluación técnica en terreno (no se ha emitido el `reporte_terreno` correspondiente).
      ```json
      {
        "statusCode": 409,
        "error": "Conflict",
        "codigo": "VERIFICACION_EN_CURSO",
        "message": "No es posible despachar una cuadrilla operativa: la patrulla verificadora asignada ('Patrulla Alfa-1') aún no ha finalizado la evaluación técnica en terreno.",
        "detalles": {
          "incidenteId": "UUID_DEL_INCIDENTE",
          "misionVerificacionId": "UUID_MISION_VERIFICACION",
          "patrullaId": "UUID_DE_LA_PATRULLA",
          "patrullaNombre": "Patrulla Alfa-1",
          "estadoMision": "EN_CURSO"
        }
      }
      ```
    2. **Unidad no disponible concurrentemente:** La patrulla o cuadrilla seleccionada no se encuentra en estado `DISPONIBLE` (ej. asignada concurrentemente a otra misión).
    3. **Incidente no en estado apto:** Para verificación con patrulla, el incidente no está en `REPORTADO`. Para despacho de cuadrilla, el incidente no está en `REPORTADO` ni `VERIFICANDO` (ej. ya en `EN_ATENCION` o `RESUELTO`).
  - En `POST /api/misiones/{id}/aceptar`:
    1. La misión no se encuentra en estado `DESPACHADA` (ej. ya está `EN_CURSO` o `COMPLETADA`) o no tiene una patrulla verificadora asignada.
    2. La patrulla verificadora fue desactivada o no está en estado `EN_VERIFICACION`, o el incidente asociado no se encuentra en estado `VERIFICANDO`.
  - En `PATCH /api/terreno/notificaciones/{id}/estado`:
    1. **Notificación en estado terminal:** En `PATCH /api/terreno/notificaciones/{id}/estado` no se bloquea el acuse por retroceso de estado: un `RECIBIDA` tardío sobre una notificación en `LEIDA` se ignora y responde `200 OK` manteniendo el estado original (idempotencia por `COALESCE` de timestamps).
- **`500 Internal Server Error`:**
  - Error inesperado de persistencia o fallo de base de datos.

---

## 5. Eventos en Tiempo Real (Socket.io & Broker Redis)

Al confirmarse la asignación de misiones operativas mediante `POST /api/misiones`, el backend emite los siguientes eventos:

1. **`mision:asignada`**:
   - **Salas destino:** `patrulla:{patrullaId}` (app PWA del líder de patrulla en terreno) o `cuadrilla:{cuadrillaId}`, `sala:encargados`, `encargado`, `supervisor` y `mapa`.
   - **Payload:** `{ notificacionId, misionId, codigo, tipoMision, patrullaId, cuadrillaId, incidenteId, incidenteCodigo, incidenteFolio, tipoAfectacion, direccion, prioridad, asignadoEn }`.
   - **Propósito:** Notificar en tiempo real a la unidad en terreno su orden táctica con georreferenciación e instrucciones.
2. **`notificacion:trazabilidad_actualizada`**:
   - **Salas destino:** `sala:encargados`, `encargado`, `supervisor`.
   - **Payload:** `{ notificacionId, misionId, patrullaId, estado, intentosEnvio, creadaAt, enviadaAt, recibidaAt, leidaAt, actualizadoEn }`.
   - **Propósito:** Informa a la Central de Operaciones si el dispositivo de terreno cuenta con señal (`RECIBIDA`), si fue leída por el operador (`LEIDA`), o si permanece fuera de cobertura (`PENDIENTE_ENVIO`).
3. **`notificacion:ack` (Client to Server)**:
   - **Emitido por:** Cliente `sgrai-pwa` conectado al WebSocket hacia el servidor.
   - **Payload:** `{ notificacionId, estado: "RECIBIDA" | "LEIDA" }`.
   - **Propósito:** Permite enviar el acuse en tiempo real con callback de respuesta sin requerir llamada HTTP REST adicional.
4. **`cuadrilla:actualizada`**:
   - **Salas destino:** `operaciones`, `encargado` y `supervisor`.
   - **Propósito:** Informar el cambio de estado de la cuadrilla a `EN_MISION`.
5. **`patrulla:liberada`** y **`patrulla:actualizada`**:
   - **Salas destino:** `patrulla:{patrullaId}`, `encargado`, `supervisor` y `mapa`.
   - **Propósito:** Notificar el relevo y la disponibilidad operativa (`DISPONIBLE`) de la patrulla verificadora previa.
6. **`incidente:actualizado`**:
   - **Salas destino:** `encargado` y `mapa`.
   - **Propósito:** Mover automáticamente la tarjeta del incidente en el tablero Kanban (`VERIFICANDO` o `EN_ATENCION`) sin recarga.
7. **`mision:actualizada`**:
   - **Salas destino:** `encargado`, `sala:encargados` y `supervisor`.
   - **Propósito:** Notificar al Centro de Mando la aceptación en terreno de una misión (`DESPACHADA` → `EN_CURSO`) junto con el hito `MISION_ACEPTADA` registrado en `mision_hito` (HU-36).


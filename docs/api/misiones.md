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
| `POST` | `/api/misiones/{id}/aceptar` | `misiones:terreno:ejecutar` / `misiones:terreno:verificar` | Confirmar y aceptar misión asignada desde terreno (PWA), transicionando de `DESPACHADA` a `EN_CURSO`, registrando `fecha_inicio` y el hito `'Asignación Aceptada por Cuadrilla'` (HU-40, pasando cuadrilla a `EN_MISION` e incidente a `EN_ATENCION`) o `'Misión Aceptada por Patrulla'` (HU-36) en `mision_hito`. |
| `POST` | `/api/misiones/{id}/llegada` | `misiones:terreno:ejecutar` | Reportar arribo a terreno de la brigada operativa, registrar hito `LLEGADA_TERRENO`, actualizar ubicación de miembros y habilitar cálculo de tiempos de respuesta (HU-42). |
| `POST` | `/api/misiones/{id}/apoyo` | `reportes:crear` | Indicar en el reporte de terreno de una misión con cuadrilla operativa asignada (`EN_CURSO`) si se requiere apoyo adicional de recursos materiales o humanos (mín. 5 caracteres en `detalleApoyoRequerido` si aplica) y si requiere despachar una cuadrilla adicional con una misión distinta (`requiereCuadrillaAdicional`, default `false`), registrando el hito `APOYO_SOLICITADO` y emitiendo alerta prioritaria `mision:apoyo_solicitado` hacia la sala `encargado` (HU-44). No aplica a misiones de `VERIFICACION`. |
| `POST` | `/api/misiones/{id}/rechazar` | `misiones:terreno:ejecutar` / `misiones:terreno:verificar` | Rechazar asignación de misión por Delegado de Cuadrilla (HU-41) o Patrulla Verificadora (HU-69) con justificación técnica obligatoria (≥ 5 caracteres, Regla §3.3), devolviendo la unidad a `DISPONIBLE` y el incidente a `VERIFICANDO` o `REPORTADO`. |
| `POST` | `/api/misiones/{id}/cerrar` | `misiones:terreno:ejecutar` | Enviar informe técnico final de resolución de emergencia por Delegado de Cuadrilla, descontar materiales consumidos, cerrar la misión (`COMPLETADA`) y devolver la cuadrilla a `DISPONIBLE` (HU-68). |
| `POST` | `/api/incidentes/{id}/prioridad/calcular` | `misiones:terreno:verificar` | Calcular la `prioridad_sugerida` y factores gatillantes en base al formulario de evaluación técnica en terreno de la patrulla verificadora (HU-38). |
| `PATCH` | `/api/incidentes/{id}/prioridad` | `misiones:terreno:verificar` | Confirmar o modificar la prioridad del incidente y enviar el reporte de evaluación en terreno versionado (`versionReporte: 1, 2...`) al Centro de Mando, registrando el hito `PRIORIDAD_ASIGNADA` o `PRIORIDAD_RECTIFICADA` en `mision_hito` (HU-38). |
| `POST` | `/api/misiones/{id}/reporte` | `reportes:crear` | Enviar el informe técnico consolidado de verificación en terreno (`VERIFICACION_CIERRE`), cerrar la misión (`COMPLETADA`), liberar la patrulla (`DISPONIBLE`), gestionar la solicitud de Ficha FIBE (`requiere_asistencia_social`) y ejecutar el descarte fundado (`NO_ABORDABLE`) si corresponde (HU-39). |
| `PATCH` | `/api/terreno/notificaciones/{id}/estado` | `misiones:terreno:verificar` | Confirmar de forma idempotente acuse de recibo técnico ('RECIBIDA') o lectura operativa ('LEIDA') desde terreno (HU-35). |
| `GET` | `/api/terreno/misiones/pendientes` | `misiones:terreno:verificar` | Consultar misiones asignadas con notificaciones en PENDIENTE_ENVIO o ENVIADA para reconciliación offline (HU-35). |
| `GET` | `/api/geolocalizacion/posiciones` | Sesión válida | Consultar snapshot de últimas posiciones GPS activas de unidades en terreno desde caché Redis (HU-70). |

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
| `latitud` | `number` | No | Latitud WGS84 de la patrulla al registrar el rechazo (entre -90 y 90). |
| `longitud` | `number` | No | Longitud WGS84 de la patrulla al registrar el rechazo (entre -180 y 180). |

#### Comportamiento Transaccional Atómico

1. `mision.estado` transiciona a `'RECHAZADA'`.
2. Se persiste `mision.justificacion_rechazo` y se fija `fecha_cierre = CURRENT_TIMESTAMP`.
3. `patrulla_verificadora.estado` transiciona a `'DISPONIBLE'` (liberada para nuevas asignaciones) siempre que se encuentre activa.
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
      "estado": "REPORTADO",
      "prioridad": "ALTA"
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

### 3.5. `POST /api/misiones` (HU-21: Asignar Cuadrilla a Incidente y Liberar Patrulla Verificadora)

Permite al **Encargado de Operaciones** (o Administrador) desplegar una cuadrilla operativa para la intervención táctica y pesada de un incidente verificado, liberando de forma atómica e inmediata a la patrulla verificadora previa conforme a los protocolos del Sistema de Comando de Incidentes (ICS).

- **Autenticación requerida:** `Authorization: Bearer <token_jwt>`
- **Permiso RBAC requerido:** `misiones:asignar` (asignado a roles Encargado y Administrador).

#### Reglas de Negocio Críticas Aplicadas
1. **Validación de Estados de Entrada y Evaluación Previa en Terreno (Regla ICS):**
   - El incidente debe existir y encontrarse en estado canónico `REPORTADO`, `VERIFICANDO` o `EN_ATENCION` (despacho adicional o de relevo para apoyo en terreno). Si se encuentra en `RESUELTO` o `NO_ABORDABLE`, la API responde con `409 Conflict`.
   - **Evaluación técnica obligatoria antes del relevo:** Si el incidente está en `VERIFICANDO` y cuenta con una patrulla verificadora asignada, la patrulla **debe haber emitido previamente su informe técnico en terreno (`reporte_terreno`)** o registrado el hito de evaluación. Si aún se encuentra en traslado o sin emitir dicho informe, el despacho es bloqueado con `409 Conflict` y código de negocio `'VERIFICACION_EN_CURSO'`.
   - Si el incidente se encuentra en `REPORTADO` (despacho directo sin patrullaje previo) o en `EN_ATENCION` (despacho de cuadrilla adicional), esta validación no aplica y se permite la asignación de cuadrilla generando una misión nueva (`Apoyo táctico - Incidente [CODIGO]` como título fallback en `EN_ATENCION`).
   - La cuadrilla seleccionada debe encontrarse en estado `DISPONIBLE` y activa (`activo = true`, `eliminado_en IS NULL`). Si está en `EN_MISION` o `NO_DISPONIBLE`, se rechaza con `409 Conflict`.
   - **Recursos adicionales permanentes (`recursosAdicionales`):** Admite opcionalmente un arreglo `{ recursoId, cantidad }` (sin duplicados) que se vincula de forma permanente en `cuadrilla_recurso` (`activo = true`, `desvinculado_en = null`), validando estado operable, stock disponible y unicidad para recursos individuales (`es_individual = true`), actualizando `recurso.cantidad_en_uso` y `recurso.estado`, y emitiendo `recurso:actualizado`.
   - **Apagado de alertas previas de apoyo (Regla A3):** Al despacharse la nueva misión de cuadrilla, las solicitudes de apoyo anteriores pasan a considerarse atendidas a nivel de incidente (`apoyoSolicitado: false`, `requiereCuadrillaAdicional: false`), preservando el registro histórico en `reporte_terreno`. Si esa misión es rechazada posteriormente, la alerta previa se reactiva automáticamente.
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
| `incidenteId` | `UUID` | **Sí** | Identificador único del incidente a atender (`REPORTADO`, `VERIFICANDO` o `EN_ATENCION`). |
| `cuadrillaId` | `UUID` | **Sí** | Identificador único de la cuadrilla operativa disponible a despachar. |
| `titulo` | `string` | No | Título descriptivo (3 a 150 caracteres). Si se omite, se genera automáticamente. |
| `descripcion` | `string` | No | Instrucciones tácticas de intervención para la cuadrilla (máx. 1000 caracteres). |
| `prioridad` | `string` | No | Prioridad táctica (`BAJA`, `MEDIA`, `ALTA`, `CRITICA`). Heredada si se omite. |
| `recursosAdicionales` | `Array<{ recursoId: UUID, cantidad: number }>` | No | Recursos adicionales a incorporar permanentemente en la dotación activa de la cuadrilla. |

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

### 3.6. `POST /api/misiones/{id}/aceptar` (HU-36 / HU-40: Aceptación de Misión por Cuadrilla o Patrulla Verificadora en PWA)

Permite al **Delegado de Cuadrilla (HU-40)** o a la **Patrulla Verificadora (HU-36)** confirmar desde su dispositivo móvil (`sgrai-pwa`) que acepta la misión asignada e inicia el desplazamiento hacia la emergencia.

- **Autenticación requerida:** `Authorization: Bearer <token_jwt>`
- **Permiso RBAC requerido:**
  - `misiones:terreno:ejecutar` para misiones de cuadrilla (`ATENCION_CUADRILLA`, HU-40).
  - `misiones:terreno:verificar` para misiones de patrulla (`VERIFICACION`, HU-36).

#### Reglas de Negocio y Transición Atómica
1. **Validación de Estado Inicial (`DESPACHADA`):** Solo se pueden aceptar misiones que se encuentren actualmente en estado `DESPACHADA`. Si la misión ya está `EN_CURSO` o en otro estado, responde `409 Conflict`.
2. **Transición Atómica para Cuadrilla (`ATENCION_CUADRILLA` — HU-40):**
   - Valida pertenencia del usuario a la cuadrilla (`cuadrilla.usuario_delegado_id` o integrante activo en `cuadrilla_personal`, salvo `ADMIN`).
   - (1) Actualiza `mision.estado` de `DESPACHADA` a `EN_CURSO` fijando `fecha_inicio = CURRENT_TIMESTAMP`.
   - (2) Actualiza `cuadrilla.estado = 'EN_MISION'` y sincroniza `usuario.estado_operativo = 'en_mision'` para la dotación.
   - (3) Actualiza `incidente.estado = 'EN_ATENCION'`.
   - (4) Inserta en `mision_hito` el hito `hito = 'MISION_ACEPTADA'` con `descripcion = 'Asignación Aceptada por Cuadrilla'`.
   - Emite `mision:actualizada`, `incidente:actualizado` (`EN_ATENCION`) y `cuadrilla:actualizada` (`EN_MISION`) hacia el Centro de Mando.
3. **Transición Atómica para Patrulla Verificadora (`VERIFICACION` — HU-36):**
   - Actualiza `mision.estado` de `DESPACHADA` a `EN_CURSO`, fija `fecha_inicio = CURRENT_TIMESTAMP` y registra `'Misión Aceptada por Patrulla'` (`MISION_ACEPTADA`).
   - Mantiene `patrulla_verificadora.estado = 'EN_VERIFICACION'` e `incidente.estado = 'VERIFICANDO'` (nunca se utiliza `'En camino'`).
   - Emite el evento `mision:actualizada` hacia las salas del Centro de Mando.

#### Cuerpo de la Petición (Opcional)
```json
{
  "latitud": -39.819588,
  "longitud": -73.245209
}
```

#### Ejemplo de Respuesta Exitosa para Cuadrilla (`HTTP 200 OK` — HU-40)
```json
{
  "message": "Asignación de misión aceptada exitosamente. La cuadrilla inicia el desplazamiento y asume la atención del incidente.",
  "data": {
    "mision": {
      "id": "70000000-0000-4000-8000-000000000001",
      "codigo": "MIS-2026-0005",
      "titulo": "Atención táctica - Incidente INC-2026-0001",
      "descripcion": "Despeje de árbol caído y calzada",
      "tipoMision": "ATENCION_CUADRILLA",
      "estado": "EN_CURSO",
      "prioridad": "ALTA",
      "incidenteId": "30000000-0000-4000-8000-000000000001",
      "patrullaId": null,
      "cuadrillaId": "50000000-0000-4000-8000-000000000001",
      "fechaInicio": "2026-11-22T14:00:00.000Z",
      "actualizadoEn": "2026-11-22T14:00:00.000Z"
    },
    "cuadrilla": {
      "id": "50000000-0000-4000-8000-000000000001",
      "nombre": "Cuadrilla Vías y Canales 1",
      "estado": "EN_MISION",
      "delegacionId": "30000000-0000-4000-8000-000000000002"
    },
    "patrulla": null,
    "incidente": {
      "id": "30000000-0000-4000-8000-000000000001",
      "codigo": "INC-2026-0001",
      "estado": "EN_ATENCION",
      "prioridad": "ALTA"
    },
    "hito": {
      "id": "80000000-0000-4000-8000-000000000010",
      "misionId": "70000000-0000-4000-8000-000000000001",
      "hito": "MISION_ACEPTADA",
      "descripcion": "Asignación Aceptada por Cuadrilla",
      "registradoPorId": "d0000000-0000-4000-8000-000000000001",
      "latitud": -39.819588,
      "longitud": -73.245209,
      "creadoEn": "2026-11-22T14:00:00.000Z"
    }
  }
}
```

---

### 3.7. `PATCH /api/terreno/notificaciones/{id}/estado` (HU-35: Acuse de Recibo y Lectura)

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

### 3.8. `GET /api/terreno/misiones/pendientes` (HU-35: Reconciliación Offline)

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

### 3.5. `POST /api/misiones/{id}/aceptar` (HU-36 / HU-40: Aceptación de Misión por Cuadrilla o Patrulla Verificadora en PWA)

Permite al **Delegado de Cuadrilla (HU-40)** o a la **Patrulla Verificadora (HU-36)** confirmar desde su dispositivo móvil (`sgrai-pwa`) que acepta la misión asignada e inicia el desplazamiento hacia la emergencia.

- **Autenticación requerida:** `Authorization: Bearer <token_jwt>`
- **Permiso RBAC requerido:**
  - `misiones:terreno:ejecutar` para misiones de cuadrilla (`ATENCION_CUADRILLA`, HU-40).
  - `misiones:terreno:verificar` para misiones de patrulla (`VERIFICACION`, HU-36).

#### Reglas de Negocio y Transición Atómica
1. **Validación de Estado Inicial (`DESPACHADA`):** Solo se pueden aceptar misiones que se encuentren actualmente en estado `DESPACHADA`. Si la misión ya está `EN_CURSO` o en otro estado, responde `409 Conflict`.
2. **Transición Atómica para Cuadrilla (`ATENCION_CUADRILLA` — HU-40):**
   - Valida pertenencia del usuario a la cuadrilla (`cuadrilla.usuario_delegado_id` o integrante activo en `cuadrilla_personal`, salvo `ADMIN`).
   - (1) Actualiza `mision.estado` de `DESPACHADA` a `EN_CURSO` fijando `fecha_inicio = CURRENT_TIMESTAMP`.
   - (2) Actualiza `cuadrilla.estado = 'EN_MISION'` y sincroniza `usuario.estado_operativo = 'en_mision'` para la dotación.
   - (3) Actualiza `incidente.estado = 'EN_ATENCION'`.
   - (4) Inserta en `mision_hito` el hito `hito = 'MISION_ACEPTADA'` con `descripcion = 'Asignación Aceptada por Cuadrilla'`.
   - Emite `mision:actualizada`, `incidente:actualizado` (`EN_ATENCION`) y `cuadrilla:actualizada` (`EN_MISION`) hacia el Centro de Mando.
3. **Transición Atómica para Patrulla Verificadora (`VERIFICACION` — HU-36):**
   - Actualiza `mision.estado` de `DESPACHADA` a `EN_CURSO`, fija `fecha_inicio = CURRENT_TIMESTAMP` y registra `'Misión Aceptada por Patrulla'` (`MISION_ACEPTADA`).
   - Mantiene `patrulla_verificadora.estado = 'EN_VERIFICACION'` e `incidente.estado = 'VERIFICANDO'` (nunca se utiliza `'En camino'`).
   - Emite el evento `mision:actualizada` hacia las salas del Centro de Mando.

#### Cuerpo de la Petición (Opcional)
```json
{
  "latitud": -39.819588,
  "longitud": -73.245209
}
```

#### Ejemplo de Respuesta Exitosa para Cuadrilla (`HTTP 200 OK` — HU-40)
```json
{
  "message": "Asignación de misión aceptada exitosamente. La cuadrilla inicia el desplazamiento y asume la atención del incidente.",
  "data": {
    "mision": {
      "id": "70000000-0000-4000-8000-000000000001",
      "codigo": "MIS-2026-0005",
      "titulo": "Atención táctica - Incidente INC-2026-0001",
      "descripcion": "Despeje de árbol caído y calzada",
      "tipoMision": "ATENCION_CUADRILLA",
      "estado": "EN_CURSO",
      "prioridad": "ALTA",
      "incidenteId": "30000000-0000-4000-8000-000000000001",
      "patrullaId": null,
      "cuadrillaId": "50000000-0000-4000-8000-000000000001",
      "fechaInicio": "2026-11-22T14:00:00.000Z",
      "actualizadoEn": "2026-11-22T14:00:00.000Z"
    },
    "cuadrilla": {
      "id": "50000000-0000-4000-8000-000000000001",
      "nombre": "Cuadrilla Vías y Canales 1",
      "estado": "EN_MISION",
      "delegacionId": "30000000-0000-4000-8000-000000000002"
    },
    "patrulla": null,
    "incidente": {
      "id": "30000000-0000-4000-8000-000000000001",
      "codigo": "INC-2026-0001",
      "estado": "EN_ATENCION",
      "prioridad": "ALTA"
    },
    "hito": {
      "id": "80000000-0000-4000-8000-000000000010",
      "misionId": "70000000-0000-4000-8000-000000000001",
      "hito": "MISION_ACEPTADA",
      "descripcion": "Asignación Aceptada por Cuadrilla",
      "registradoPorId": "d0000000-0000-4000-8000-000000000001",
      "latitud": -39.819588,
      "longitud": -73.245209,
      "creadoEn": "2026-11-22T14:00:00.000Z"
    }
  }
}
```

---

### 3.6. `POST /api/misiones/{id}/reporte` (HU-39 / HU-86: Enviar Informe Técnico de Verificación y Cerrar Misión)

Permite a la patrulla verificadora enviar el informe técnico consolidado de verificación en terreno y cerrar su misión inicial de patrullaje. Absorbe la declaración fundada de no abordabilidad (fusión H39/H86).

- **Autenticación requerida:** `Authorization: Bearer <token_jwt>` (o `X-User-Id` en entorno interno/QA)
- **Permiso RBAC requerido:** `reportes:crear`

#### Reglas de Negocio y Transición Atómica
1. **Validación de Misión Activa y Pertenencia:** La misión debe existir, encontrarse en estado `EN_CURSO` (si está en `DESPACHADA` o ya `COMPLETADA`, retorna `409 Conflict`) y pertenecer a la patrulla asignada al usuario autenticado (salvo rol `ADMIN`, en otro caso `403 Forbidden`).
2. **Dictamen Operativo y No Abordabilidad (`NO_ABORDABLE`):**
   - `dictamen`: obligatorio (`'REQUIERE_CUADRILLA'` o `'NO_ABORDABLE'`).
   - Si `dictamen === 'NO_ABORDABLE'`, exige `motivo_no_abordable` de al menos 15 caracteres (`400 Bad Request` si falta o es menor).
   - `resumen_tecnico`: obligatorio de al menos 10 caracteres.
3. **Rescate y Modificación de Personas Damnificadas (`personas_afectadas`):**
   - El endpoint `GET /api/misiones/{id}` expone `evaluaciones.personasAfectadasPrevias` (rescatado del último reporte de prioridad de HU-38) para precargar el formulario en la PWA.
   - Si en `POST /api/misiones/{id}/reporte` el usuario envía `personas_afectadas` (manteniendo o modificando el valor previo), se persiste ese monto y se registra la trazabilidad de modificación en `detalles_evaluacion`; si se omite, el backend rescata automáticamente el valor del reporte previo de prioridad.
4. **Ficha FIBE (`requiere_asistencia_social`) y Evidencia Fotográfica (HU-43):**
   - La solicitud de Ficha FIBE (`requiere_asistencia_social`) reside exclusivamente en este informe de cierre (trasladada desde HU-38). Si se marca `true`, actualiza `incidente.requiere_asistencia_social = true`.
   - El payload acepta `adjuntoIds` y/o `adjuntos` para asociar fotografías en `adjunto.reporte_terreno_id`, dejando lista la integración con HU-43.
5. **Transacción Atómica (Kysely Transaction):**
   - Inserta un nuevo registro en `reporte_terreno` con `evaluador_id = usuario.id`, `tipo_reporte = 'VERIFICACION_CIERRE'`, `dictamen`, `motivo_no_abordable` y `requiere_asistencia_social`.
   - Actualiza `mision.estado = 'COMPLETADA'` y `mision.fecha_cierre = CURRENT_TIMESTAMP`.
   - Libera `patrulla_verificadora.estado = 'DISPONIBLE'` (si no tiene otra misión activa concurrente).
   - Si `dictamen === 'NO_ABORDABLE'`, transiciona `incidente.estado = 'NO_ABORDABLE'` fijando `incidente.fecha_cierre = CURRENT_TIMESTAMP` e `incidente.motivo_no_abordable`. Si es `'REQUIERE_CUADRILLA'`, mantiene el incidente en `'VERIFICANDO'` listo para despacho de cuadrilla (HU-21).
   - Registra el hito `'VERIFICACION_COMPLETADA'` en `mision_hito`.
6. **Tiempo Real (Socket.io / Redis):**
   - Emite `mision:actualizada`, `incidente:actualizado` y `patrulla:actualizada` / `patrulla:liberada` hacia la sala `encargado` del Centro de Mando.

---

### 3.8. `POST /api/misiones/{id}/rechazar` (HU-41: Rechazo Motivado de Misión por Cuadrilla)

Permite al **Delegado de Cuadrilla** rechazar la solicitud de asignación a una misión ingresando una justificación técnica obligatoria cuando existan motivos de fuerza mayor que impidan la atención.

- **Autenticación requerida:** `Authorization: Bearer <token_jwt>` (o `x-user-id` en entorno de pruebas)
- **Permiso RBAC requerido:** `misiones:terreno:ejecutar` (asignado a `DELEGADO_CUADRILLA` y `ADMIN` mediante migración `057_permiso_misiones_terreno_ejecutar.ts`).
- **Control de Pertenencia:** El usuario autenticado debe ser el delegado asignado a la cuadrilla (`cuadrilla.usuario_delegado_id`) o un integrante activo en `cuadrilla_personal` (salvo rol `ADMIN`).

#### Regla de Negocio §3.3 y Transacción Atómica
1. **Validación estricta de justificación:** El campo `justificacion_rechazo` (o `justificacionRechazo`) debe contener al menos **5 caracteres útiles** tras aplicar `.trim()`. De lo contrario, la API responde `400 Bad Request`.
2. **Transacción Atómica Kysely (`FOR UPDATE OF mision`):**
   - Actualiza `mision.estado = 'RECHAZADA'`, persiste `justificacion_rechazo` y estampa `fecha_cierre = CURRENT_TIMESTAMP`.
   - Devuelve la cuadrilla activa a estado `DISPONIBLE` (si no posee otra misión activa) y restaura `usuario.estado_operativo = 'disponible'` para su dotación.
   - Retorna el incidente asociado a `VERIFICANDO` (si contaba con una misión previa `VERIFICACION` en estado `COMPLETADA`) o a `REPORTADO` (si fue despacho directo) para habilitar su reasignación inmediata en el Centro de Mando.
   - Registra el hito `'RECHAZADA'` con la justificación y coordenadas GPS opcionales en `mision_hito`.

#### Cuerpo de la Petición (Request Body)
```json
{
  "justificacion_rechazo": "Camión tolva presenta falla hidráulica en ruta de salida desde base.",
  "latitud": -39.81422,
  "longitud": -73.24589
}
```

---

### 3.9. `POST /api/misiones/{id}/cerrar` (HU-68: Informe Técnico Final y Cierre de Misión de Cuadrilla)

Permite al **Delegado de Cuadrilla** completar y enviar desde la aplicación de terreno (`sgrai-pwa`) el informe técnico final de resolución de la emergencia al culminar los trabajos, documentando las faenas ejecutadas, los materiales consumidos, las horas hombre invertidas y el estado final del terreno.

- **Autenticación requerida:** `Authorization: Bearer <token_jwt>` (o `X-User-Id` en entorno de pruebas)
- **Permiso RBAC requerido:** `misiones:terreno:ejecutar` (asignado a `DELEGADO_CUADRILLA` y `ADMIN` en migración `057` / `059`).
- **Control de Pertenencia:** El usuario autenticado debe ser el delegado asignado a la cuadrilla (`cuadrilla.usuario_delegado_id`) o un integrante activo en `cuadrilla_personal` (salvo rol `ADMIN`).
- **Trazabilidad Manual de Usuario:** Consultar el manual operativo en `sgrai-web` / `sgrai-pwa` (`web-app/docs/manuales-usuario/H68-cierre-mision-cuadrilla.md`).

#### Reglas de Negocio y Transacción Atómica
1. **Validación de Estado de Entrada:** La misión debe tener una cuadrilla asignada y encontrarse en estado `EN_CURSO` (si está en `DESPACHADA` o ya fue `COMPLETADA`, retorna `409 Conflict`).
2. **Validación de Campos Técnicos:**
   - `resumen_faenas`: obligatorio, mínimo **15 caracteres** útiles tras `.trim()`.
   - `horas_hombre`: obligatorio, número finito mayor a `0` y hasta `1000` (admite decimales, redondeado a 2 decimales).
   - `estado_terreno`: obligatorio (`CONTROLADO`, `ESTABLE`, `FINALIZADO`, `REQUIERE_SEGUIMIENTO`, `CRITICO`, `INACCESIBLE`).
   - `materiales_consumidos`: arreglo opcional de `{ recurso_id, cantidad, unidad?, observacion? }` sin `recurso_id` duplicados.
3. **Contabilidad Atómica de Inventario (`recurso` y `cuadrilla_recurso`):**
   - Los recursos individuales (`es_individual = true`, ej. vehículos o maquinaria) no pueden reportarse como consumibles (`400 Bad Request`).
   - Para cada insumo consumible, descuenta `recurso.cantidad_inventario`, ajusta `recurso.cantidad_en_uso` protegiendo reservas de otras cuadrillas y recalcula `recurso.estado` (`DISPONIBLE`, `BAJO_STOCK`, `ASIGNADO`, `NO_DISPONIBLE`).
   - En `cuadrilla_recurso`, decrementa `cantidad_asignada` o desvincula lógicamente (`activo = false, desvinculado_en = CURRENT_TIMESTAMP`) cuando el consumo agota el total asignado (respetando `CHECK (cantidad_asignada > 0)`). Si el consumo excede el stock disponible, revierte la transacción con `409 Conflict`.
4. **Cierre de Misión, Liberación de Cuadrilla y No Cierre del Incidente:**
   - Inserta en `reporte_terreno` (`tipo_reporte = 'REPORTE_CUADRILLA'`, `horas_hombre`, `materiales_consumidos`) y vincula adjuntos opcionales (`adjunto_ids` / `adjuntos`, HU-43).
   - Actualiza `mision.estado = 'COMPLETADA'` con `fecha_cierre = CURRENT_TIMESTAMP`.
   - Transiciona `cuadrilla.estado = 'DISPONIBLE'` y restaura `usuario.estado_operativo = 'disponible'` para su dotación (si no posee otra misión activa).
   - **El incidente no se cierra automáticamente:** permanece en su estado vigente (`EN_ATENCION`) para evaluación final del Encargado (H86); únicamente actualiza `actualizado_en` y marca `requiere_asistencia_social = true` si se solicitó Ficha FIBE.
   - Registra el hito `'MISION_COMPLETADA'` en `mision_hito`.

#### Cuerpo de la Petición (Request Body)
```json
{
  "resumen_faenas": "Despeje completo de sumidero obstruido e instalación de barrera perimetral de contención.",
  "materiales_consumidos": [
    {
      "recurso_id": "b0000000-0000-4000-8000-000000000010",
      "cantidad": 15,
      "unidad": "sacos",
      "observacion": "Utilizados en acceso norte"
    }
  ],
  "horas_hombre": 6.5,
  "estado_terreno": "CONTROLADO",
  "observaciones": "Calzada habilitada para tránsito normal.",
  "requiere_apoyo_adicional": false,
  "requiere_asistencia_social": false
}
```

#### Ejemplo de Respuesta Exitosa (`HTTP 201 Created`)
```json
{
  "message": "Informe técnico final registrado, misión cerrada y cuadrilla disponible exitosamente.",
  "data": {
    "reporteTerreno": {
      "id": "e0000000-0000-4000-8000-000000000020",
      "misionId": "70000000-0000-4000-8000-000000000001",
      "tipoReporte": "REPORTE_CUADRILLA",
      "estadoTerreno": "CONTROLADO",
      "horasHombre": 6.5,
      "materialesConsumidos": [
        {
          "recursoId": "b0000000-0000-4000-8000-000000000010",
          "nombre": "Sacos de arena 25kg",
          "cantidad": 15,
          "unidad": "sacos",
          "observacion": "Utilizados en acceso norte",
          "stockAnterior": 100,
          "stockPosterior": 85
        }
      ],
      "resumenTecnico": "Despeje completo de sumidero obstruido e instalación de barrera perimetral de contención.",
      "adjuntos": []
    },
    "mision": {
      "id": "70000000-0000-4000-8000-000000000001",
      "codigo": "MIS-2026-0005",
      "estado": "COMPLETADA",
      "fechaCierre": "2026-11-18T19:30:00.000Z"
    },
    "cuadrilla": {
      "id": "50000000-0000-4000-8000-000000000001",
      "nombre": "Cuadrilla Vías y Canales 1",
      "estado": "DISPONIBLE"
    },
    "incidente": {
      "id": "30000000-0000-4000-8000-000000000001",
      "codigo": "INC-2026-0042",
      "estado": "EN_ATENCION",
      "prioridad": "ALTA",
      "requiereAsistenciaSocial": false
    },
    "recursosActualizados": [
      {
        "id": "b0000000-0000-4000-8000-000000000010",
        "nombre": "Sacos de arena 25kg",
        "cantidadConsumida": 15,
        "cantidadInventarioAnterior": 100,
        "cantidadInventarioActual": 85,
        "cantidadEnUsoActual": 15,
        "estado": "DISPONIBLE"
      }
    ],
    "hito": {
      "id": "71000000-0000-4000-8000-000000000001",
      "misionId": "70000000-0000-4000-8000-000000000001",
      "hito": "MISION_COMPLETADA",
      "creadoEn": "2026-11-18T19:30:00.000Z"
    }
  }
}
```

---

### 3.5. `GET /api/geolocalizacion/posiciones` (HU-70: Posiciones GPS Activas de Unidades en Terreno)

Permite al Centro de Mando (`sgrai-web`) consultar de forma instantánea el snapshot de últimas posiciones GPS conocidas de todas las patrullas y cuadrillas operativas en misión activa que se encuentren vigentes en la caché de Redis.

- **Autenticación requerida:** `Authorization: Bearer <token_jwt>` (requiere sesión de usuario válida en SGRAI).

#### Ejemplo de Respuesta Exitosa (`HTTP 200 OK`)

```json
{
  "message": "Posiciones activas obtenidas exitosamente.",
  "data": [
    {
      "unidadId": "f1000000-0000-4000-8000-000000000001",
      "tipoUnidad": "PATRULLA",
      "lat": -39.81422,
      "lng": -73.24589,
      "timestamp": "2026-11-12T15:00:00.000Z",
      "rumbo": 180.5,
      "precision": 10.5,
      "velocidad": 4.2,
      "recibidoEn": "2026-11-12T15:00:01.000Z"
    }
  ]
}
```

---

## 4. Códigos de Estado y Errores Esperables

- **`400 Bad Request`:**
  - En `GET /api/misiones`: Parámetros de consulta no conformes al esquema Zod (ej. `page < 1`, `limit > 100`, valores de enum desconocidos o `delegacionId` no UUID).
  - En `GET /api/misiones/{id}` y `POST /api/misiones/{id}/aceptar`: El parámetro `id` no cumple el estándar UUID versión 4 o se envía una coordenada GPS incompleta (`latitud` sin `longitud` o viceversa).
  - En `POST /api/misiones/{id}/llegada`: Coordenadas geográficas fuera de rango (-90 a 90 / -180 a 180), JSON mal formado o la misión carece de cuadrilla asignada.
  - En `POST /api/misiones/{id}/rechazar`: `justificacion_rechazo` ausente, vacía o con menos de 5 caracteres útiles (Regla §3.3), UUID no válido, JSON mal formado o coordenadas GPS fuera de rango WGS84 / sin paridad.
  - En `POST /api/misiones/{id}/cerrar`: `resumen_faenas` menor a 15 caracteres, `horas_hombre` menor o igual a 0 (o > 1000), `estado_terreno` inválido, `recurso_id` duplicado en `materiales_consumidos`, intento de consumir un recurso individual (`es_individual = true`), o coordenadas GPS sin paridad.
  - En `POST /api/misiones/{id}/apoyo`: `requiereApoyoAdicional = true` sin `detalleApoyoRequerido` válido (mínimo 5 caracteres), UUID no válido o JSON mal formado.
  - En `PATCH /api/terreno/notificaciones/{id}/estado`: El parámetro `id` no cumple el estándar UUID versión 4; el body no es JSON válido o el estado no es `"RECIBIDA"` ni `"LEIDA"`.
  - En `POST /api/misiones`: Body no es JSON válido o los identificadores no son UUIDs válidos.
- **`401 Unauthorized`:**
  - Petición sin token JWT Bearer o sesión expirada.
- **`403 Forbidden`:**
  - El usuario no cuenta con el permiso requerido (`misiones:leer` para consulta, `misiones:asignar` para despacho, `reportes:crear` para el envío de informe técnico en `POST /api/misiones/{id}/reporte` y solicitud de apoyo adicional en `POST /api/misiones/{id}/apoyo`, `misiones:terreno:ejecutar` para aceptación, rechazo, llegada y cierre por cuadrilla en HU-40/HU-41/HU-42/HU-68, `misiones:terreno:verificar` para la aceptación/rechazo por patrulla y para los endpoints de terreno `PATCH /api/terreno/notificaciones/{id}/estado` y `GET /api/terreno/misiones/pendientes`), o intenta operar sobre una misión asignada a otra patrulla verificadora o cuadrilla operativa.
  - En `POST /api/misiones/{id}/llegada`: El usuario no es el delegado asignado a la cuadrilla de esa misión en particular (y no posee rol de Administrador).
  - Pertenencia a patrulla ajena: En `PATCH /api/terreno/notificaciones/{id}/estado`, si la notificación pertenece a otra patrulla y el usuario no es `ADMIN`.
- **`404 Not Found`:**
  - En `GET /api/misiones/{id}`, `POST /api/misiones/{id}/aceptar`, `POST /api/misiones/{id}/llegada`, `POST /api/misiones/{id}/apoyo`, `POST /api/misiones/{id}/rechazar`, `POST /api/misiones/{id}/reporte` y `POST /api/misiones/{id}/cerrar`: No existe ninguna misión (o recurso material en `cerrar`) con el UUID proporcionado.
  - En `PATCH /api/terreno/notificaciones/{id}/estado`: No existe ninguna notificación con el UUID proporcionado.
  - En `POST /api/misiones`: El `incidenteId`, la `patrullaId` o la `cuadrillaId` proporcionada no existe en la base de datos o ha sido desactivada lógicamente.
- **`409 Conflict`:**
  - En `POST /api/misiones/{id}/aceptar`: La misión no se encuentra en estado `DESPACHADA` (ej. ya fue aceptada previamente y está `EN_CURSO`, o fue `CANCELADA`).
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
    3. **Incidente no en estado apto:** Para verificación con patrulla, el incidente no está en `REPORTADO`. Para despacho de cuadrilla, el incidente no está en `REPORTADO`, `VERIFICANDO` ni `EN_ATENCION` (ej. `RESUELTO` o `NO_ABORDABLE`).
    4. **Recurso adicional no disponible o sin stock:** En `POST /api/misiones` con `recursosAdicionales`, algún recurso está en mantención/no disponible, carece de stock suficiente, o un recurso individual ya pertenece a una cuadrilla activa.
  - En `POST /api/misiones/{id}/aceptar`:
    1. La misión no se encuentra en estado `DESPACHADA` (ej. ya está `EN_CURSO` o `COMPLETADA`) o no tiene una unidad (cuadrilla o patrulla) asignada.
    2. La unidad asignada (cuadrilla o patrulla verificadora) fue desactivada o está en estado incompatible (`NO_DISPONIBLE`, o patrulla no `EN_VERIFICACION`), o el incidente asociado está en estado terminal (`RESUELTO`, `NO_ABORDABLE`) o distinto de `VERIFICANDO` para verificación.
  - En `POST /api/misiones/{id}/llegada`:
    1. La llegada a terreno ya fue reportada previamente para esta misión (`hito = 'LLEGADA_TERRENO'` existente) o la misión se encuentra en un estado terminal que no admite arribo (`COMPLETADA`, `CANCELADA` o `RECHAZADA`).
  - En `PATCH /api/terreno/notificaciones/{id}/estado`:
    1. **Notificación en estado terminal:** En `PATCH /api/terreno/notificaciones/{id}/estado` no se bloquea el acuse por retroceso de estado: un `RECIBIDA` tardío sobre una notificación en `LEIDA` se ignora y responde `200 OK` manteniendo el estado original (idempotencia por `COALESCE` de timestamps).
  - En `POST /api/misiones/{id}/cerrar`:
    1. La misión no tiene una cuadrilla operativa asignada, aún está en estado `DESPACHADA` (sin llegada/inicio en terreno) o ya fue `COMPLETADA` / `RECHAZADA` / `CANCELADA`.
    2. El stock disponible del recurso material reportado en `materiales_consumidos` es insuficiente respecto a lo consumido.
  - En `POST /api/misiones/{id}/apoyo`:
    1. La misión no se encuentra en estado `EN_CURSO` (ej. está `DESPACHADA` o ya fue `COMPLETADA`/`CANCELADA`/`RECHAZADA`).
- **`500 Internal Server Error`:**
  - Error inesperado de persistencia o fallo de base de datos.

---

## 5. Eventos en Tiempo Real (Socket.io & Broker Redis)

Al confirmarse la asignación y operación de misiones mediante los endpoints del módulo, el backend emite los siguientes eventos:

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
   - **Salas destino:** `operaciones`, `encargado`, `sala:encargados`, `supervisor` y `mapa`.
   - **Propósito:** Informar el cambio de estado de la cuadrilla a `EN_MISION` al despachar (HU-21) o aceptar asignación (HU-40), o su retorno a `DISPONIBLE` al cerrar la misión (HU-68).
5. **`patrulla:liberada`** y **`patrulla:actualizada`**:
   - **Salas destino:** `patrulla:{patrullaId}`, `encargado`, `supervisor` y `mapa`.
   - **Propósito:** Notificar el relevo y la disponibilidad operativa (`DISPONIBLE`) de la patrulla verificadora previa.
6. **`incidente:actualizado`**:
   - **Salas destino:** `encargado`, `sala:encargados` y `mapa`.
   - **Propósito:** Mover automáticamente la tarjeta del incidente en el tablero Kanban (`VERIFICANDO` o `EN_ATENCION`) o reflejar el informe técnico final de cuadrilla sin recarga.
7. **`mision:actualizada`**:
   - **Salas destino:** `encargado`, `sala:encargados`, `supervisor`, `mapa` y sala de la unidad (`cuadrilla:{cuadrillaId}` o `patrulla:{patrullaId}`).
   - **Payload:** `{ misionId, codigo, estado, tipoMision, patrullaId, patrullaNombre, cuadrillaId, cuadrillaNombre, incidenteId, incidenteCodigo, prioridad, fechaInicio, fechaCierre, hito, reporteTerreno, actualizadoEn }`.
   - **Propósito:** Notificar al Centro de Mando y al mapa en tiempo real la aceptación en terreno de una misión por patrulla (HU-36) o por cuadrilla (`DESPACHADA` → `EN_CURSO`, hito `MISION_ACEPTADA` con glosa `'Asignación Aceptada por Cuadrilla'`, HU-40), su cierre con informe técnico de verificación (HU-39), el registro de llegada a terreno (`LLEGADA_TERRENO`, HU-42), o el cierre final de cuadrilla (`EN_CURSO` → `COMPLETADA`, hito `MISION_COMPLETADA`, `reporteTerreno`, HU-68). Incluye metadatos (`cuadrillaNombre`, `patrullaNombre`, `incidenteCodigo`, `prioridad`) para renderizar notificaciones tipo Toast enriquecidas en el Centro de Mando.
8. **`mision:rechazada` (HU-41 / HU-69)**:
   - **Salas destino:** `encargado`, `sala:encargados`, `supervisor`, `cuadrilla:{cuadrillaId}`, `patrulla:{patrullaId}` y difusión global.
   - **Payload:** `{ misionId, codigo, tipoMision, motivo, justificacionRechazo, cuadrillaId, cuadrillaNombre, patrullaId, patrullaNombre, incidenteId, incidenteCodigo, rechazadoPorId, rechazadoEn }`.
   - **Propósito:** Emitir alerta prioritaria inmediata al Centro de Mando cuando una cuadrilla (HU-41) o patrulla verificadora (HU-69) rechaza una asignación, permitiendo la reasignación inmediata del incidente.
9. **`mision:hito_registrado` (HU-42)**:
   - **Salas destino:** `encargado`, `sala:encargados`, `supervisor`, `mision:{misionId}`.
   - **Payload:** `{ misionId, codigoMision, hito, descripcion, latitud, longitud, registradoPor, registradoEn, nuevoEstadoMision }`.
   - **Propósito:** Impactar la línea de tiempo vertical del Encargado y Centro de Mando al reportarse hitos georreferenciados en terreno como `LLEGADA_TERRENO`.
10. **`recurso:actualizado` (HU-68)**:
    - **Salas destino:** `encargado` y `supervisor`.
    - **Propósito:** Actualizar en tiempo real el stock (`cantidadInventario`, `cantidadEnUso`) y el estado operativo del recurso material tras descontar insumos consumidos en terreno.
11. **`mision:apoyo_solicitado` (HU-44)**:
    - **Salas destino:** `encargado`, `sala:encargados` y `supervisor`.
    - **Payload:** `{ reporteId, misionId, misionCodigo, incidenteId, incidenteCodigo, cuadrillaId, cuadrillaNombre, evaluadorId, evaluadorNombre, requiereApoyoAdicional: true, requiereCuadrillaAdicional, detalleApoyoRequerido, prioridadAlerta: "ALTA", solicitadoEn }`.
    - **Propósito:** Emitir alerta visual prioritaria inmediata hacia el Centro de Mando cuando una cuadrilla u unidad en terreno solicita apoyo adicional material o humano, indicando si requiere despachar una cuadrilla adicional sin interrumpir la faena en curso.
12. **`telemetria:posicion` (HU-70: Transmisión y Retransmisión GPS en Terreno)**:
    - **Evento de Entrada (Client-to-Server):** Emitido periódicamente (cada 30 a 60 segundos) por la app PWA móvil de patrullas y delegados de cuadrilla cuando se encuentran en misión activa (`EN_CURSO`).
      - **Payload:**
        ```json
        {
          "unidadId": "f1000000-0000-4000-8000-000000000001",
          "tipoUnidad": "PATRULLA",
          "lat": -39.81422,
          "lng": -73.24589,
          "timestamp": "2026-11-12T15:00:00.000Z",
          "rumbo": 180.5,
          "precision": 10.5,
          "velocidad": 4.2
        }
        ```
      - **Atributos:**
        - `unidadId` (UUID): Identificador de la patrulla o cuadrilla.
        - `tipoUnidad` (`PATRULLA` | `CUADRILLA`): Clasificación de la unidad operativa.
        - `lat`, `lng` (número decimal WGS84): Coordenadas geográficas.
        - `timestamp` (ISO 8601 o epoch): Marca temporal de captura.
        - `rumbo` (opcional, grados 0-360): Orientación del desplazamiento para rotar el icono en el mapa.
        - `precision` (opcional, metros): Radio de exactitud provisto por `GeolocationCoordinates.accuracy`.
        - `velocidad` (opcional, m/s): Velocidad instantánea de desplazamiento.
    - **Almacenamiento en Caché Redis:** Cada posición válida recibida se almacena con clave `telemetria:posicion:{tipoUnidad}:{unidadId}` y expiración TTL de 300 segundos (5 minutos), asegurando que si la unidad se desconecta o culmina su turno, expire naturalmente sin sobrecargar PostgreSQL.
    - **Evento de Salida (Server-to-Client):**
      - **Sala destino:** `mapa`.
      - **Propósito:** Retransmitir en tiempo real las coordenadas hacia el Centro de Mando en `sgrai-web` para actualizar la posición de los marcadores dinámicos sin refrescar la vista.
    - **Resiliencia ante Conectividad:** Si el dispositivo móvil pierde señal, la PWA reintenta de forma transparente sin bloquear la interfaz de usuario. Al recuperar conectividad, el flujo de telemetría se reanuda de inmediato.

---

## 6. Estado de Evaluaciones y Sincronización de Tipología (`GET /api/misiones` y `GET /api/misiones/{id}`)

- En `GET /api/misiones`, cada ítem incluye `incidenteTipoAfectacion` y proyecta `titulo` sincronizado con la tipología actual del incidente para misiones `VERIFICACION`.
- En `GET /api/misiones/{id}`, el objeto `evaluaciones` (`{ tipologiaEvaluada, tipologiaEvaluadaEn, prioridadEvaluada, prioridadEvaluadaEn, versionReportePrioridad, personasAfectadasPrevias, reporteVerificacionEnviado, reporteVerificacionEnviadoEn, dictamenVerificacion, reporteCuadrillaEnviado, reporteCuadrillaEnviadoEn }`) expone el estado persistido en servidor de las secciones de evaluación y cierre en terreno, permitiendo que la aplicación web y la PWA precarguen `personasAfectadasPrevias` e indiquen como completados los reportes ya enviados sin depender del almacenamiento local del dispositivo.
- Cada hito de `bitacoraTiempos` incluye `id` y `metadatos` opcionales para vincular directamente el reporte de reclasificación (`reclasificacion-{hitoId}`).

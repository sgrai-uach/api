# Módulo: Incidentes (Avisos, Ingreso Manual, Verificación Call Center y Tablero Kanban)

Documentación técnica de los endpoints, eventos en tiempo real y lógica de negocio del módulo de **Incidentes**, dirigida a desarrolladores de `sgrai-web` (Call Center, Encargado) y `sgrai-pwa` (Patrullas y Cuadrillas).

---

## 1. Reglas de Negocio y Modelo de Datos (ICS y ERD Alignment)

- **Alineación con Diagrama Entidad-Relación:**
  - Las entidades principales de persistencia son **`Informante`** (ciudadano o testigo) e **`Incidente`** (entidad operativa central del SGRAI).
  - En la recepción preliminar de avisos del Call Center (HU-52), los avisos pueden listarse, verificarse y promoverse a incidente formal o descartarse motivadamente.

- **Ciclo de Vida de los Incidentes (ICS) - Sección 6 de GEMINI.md:**
  - Todo reporte ingresado al sistema se registra con estado inicial **`REPORTADO`**.
  - Al asignarse una patrulla verificadora en terreno, el estado avanza a **`VERIFICANDO`**.
  - Al confirmarse la emergencia y despacharse cuadrillas o recursos logísticos, avanza a **`EN_ATENCION`**.
  - Si la situación fue mitigada satisfactoriamente, culmina en **`RESUELTO`**.
  - Si tras la verificación se constata que no corresponde al ámbito municipal o fue una falsa alarma, se clasifica como **`NO_ABORDABLE`**.

- **Priorización y Tiempos de Espera (HU-52 / HU-54):**
  - La consulta de avisos para el Call Center calcula dinámicamente los minutos en espera (`minutosEnEspera`) para que el frontend resalte los reportes con mayor tiempo sin atención mediante un semáforo de urgencia (`<15m`, `15-30m`, `>30m`).

- **Filtrado Multicriterio en Bandeja de Call Center (HU-54):**
  - Admite filtros combinados con lógica conjuntiva (`AND`):
    - **Delegación Territorial:** `Norte`, `Sur`, `Costa`, `Calle Calle` o `TODAS`. Resuelve tanto delegación asignada formalmente (`delegacion_id`) como manual o inferida por sector, retornando el atributo canónico `delegacionNombre: string | null`. Admite alias como `Calle-Calle`.
    - **Estado Operativo:** `NO_VERIFICADO` (retorna avisos en `NO_VERIFICADO` y `PENDIENTE_VERIFICACION`), `VERIFICADO`, `DESCARTADO` o `TODOS` (omite filtro).
    - **Canal de Origen:** `WEB`, `CHATBOT`, `LLAMADA_TELEFONICA`.
    - **Búsqueda Textual:** Coincidencia libre parcial insensitiva (`busqueda` o `q`) sobre dirección, descripción, nombre de informante o código de seguimiento.
  - Metadatos de paginación (`total`, `totalPages`, `hasNext`, `hasPrev`) reflejan con precisión los filtros aplicados.
  - Respuestas vacías retornan `200 OK` con `data: []` y `total: 0`.

- **Descarte Justificado:**
  - Todo descarte de un aviso exige obligatoriamente un motivo justificado de al menos 5 caracteres.

- **Detección Espacial de Duplicados en Valdivia:**
  - Detección espacial de reportes similares en un radio de 300 metros y ventana de 24 horas vía PostGIS.
  - La API permite verificar duplicados previos (`POST /api/incidentes/verificar-duplicado`) o forzar la creación (`forzarCreacion: true`).

- **Catálogo de Estados y Descripciones Ciudadanas (Sin Jerga Técnica):**
  Para el panel de seguimiento de informantes (`GET /api/incidentes/avisos/seguimiento/{codigo}`), los estados se traducen a explicaciones comprensibles sin tecnicismos ni exposición de datos privados (RUT o teléfono).

- **Contadores Rápidos y Panorama del Día para Encargado (HU-18):**
  - El endpoint `GET /api/incidentes/kpis` consolida los 5 estados canónicos del ICS (`REPORTADO`, `VERIFICANDO`, `EN_ATENCION`, `NO_ABORDABLE`, `RESUELTO`) calculados dinámicamente mediante agregación condicional SQL sobre la tabla `incidente`.
  - El corte temporal del día opera estrictamente bajo la zona horaria chilena (`America/Santiago`), evitando desajustes de fecha con respecto a UTC.
  - Admite filtrado opcional por delegación territorial (`delegacionId`) para segmentar los contadores por sector (Norte, Sur, Costa, Calle Calle) o consolidar el total comunal de Valdivia si no se especifica.
  - Para permitir la navegación fluida desde las tarjetas del dashboard (CA-4), el listado paginado `GET /api/incidentes` admite los parámetros `fecha` (YYYY-MM-DD), `soloHoy` (boolean) y `delegacionId` (UUID).

- **Evaluación en Terreno, Matriz de Prioridad Sugerida y Reporte Versionado al Centro de Mando (HU-38):**
  - Una vez que la patrulla verificadora acepta la misión (`estado = EN_CURSO`), completa el formulario de evaluación técnica en terreno indicando: tamaño del núcleo familiar afectado (`nucleoFamiliarTotal`), niños (`cantidadNinos`), adultos mayores (`cantidadAdultosMayores`), personas con discapacidad (`personasDiscapacitadas`), electrodependientes (`personasElectrodependientes`), mascotas (`mascotasAfectadas`), viviendas afectadas (`viviendasAfectadas`), nivel de compromiso de vivienda (`SIN_DANO`, `LEVE`, `MODERADO`, `GRAVE_INHABITABLE`), riesgos activos (`riesgoElectrico`, `riesgoEstructural`, `riesgoQuimicoSanitario`, `aislamientoVial`) y detalles adicionales (`detallesAdicionales`).
  - **Matriz de Cálculo de `prioridad_sugerida`:**
    - **Reglas de disparo directo a `CRITICA`:** `personasElectrodependientes > 0` o `requiereEvacuacion === true` con presencia de niños, adultos mayores, personas con discapacidad o vivienda `GRAVE_INHABITABLE`.
    - **Puntaje acumulativo:** Núcleo familiar (`1-3`: +5, `4-7`: +12, `>=8`: +20), Niños (+6 c/u, máx 24), Adultos mayores (+7 c/u, máx 28), Discapacitados (+12 c/u, máx 36), Mascotas (`1-3`: +2 c/u, `>=4`: +5 a +10), Compromiso vivienda (`LEVE`: +8, `MODERADO`: +22, `GRAVE_INHABITABLE`: +45), Múltiples viviendas (`3-5`: +10, `>=6`: +20), Evacuación (+35), Riesgo estructural (+25), Riesgo eléctrico (+20), Riesgo químico/sanitario (+15), Aislamiento vial (+15).
    - **Umbrales:** `0-14 pts` = `BAJA` | `15-34 pts` = `MEDIA` | `35-59 pts` = `ALTA` | `>= 60 pts` = `CRITICA`.
  - **Discrepancia y Justificación Obligatoria:** Si la patrulla decide asignar una prioridad distinta de `prioridad_sugerida`, debe ingresar obligatoriamente `justificacion_prioridad` de al menos 5 caracteres (`400 Bad Request` en caso contrario).
  - **Reenvío y Versionado de Reportes:** Si las condiciones cambian en terreno, la patrulla puede modificar y reenviar el reporte; cada envío inserta un nuevo registro en `reporte_terreno` con correlativo `version_reporte` (`1`, `2`, `3`...) y `es_rectificacion` (`true` para envíos $\ge 2$), quedando registro explícito en el Centro de Mando de que se trata de un reporte distinto (`PRIORIDAD_ASIGNADA` en el envío #1 y `PRIORIDAD_RECTIFICADA` en envíos posteriores).

---

## 2. Endpoints del Módulo

| Método | Endpoint | Permiso Requerido | Propósito |
|---|---|---|---|
| `GET` | `/api/incidentes/avisos` | `incidentes:avisos:leer` | Listar avisos paginados con soporte multicriterio: `delegacionId` (UUID, prioritario), `delegacion` (nombre legado), `estado`, `origen` (`WEB`, `CHATBOT`, `LLAMADA_TELEFONICA`), `busqueda`/`q`, `page`, `limit`. Retorna `data`, `meta` y `pagination`. |
| `POST` | `/api/incidentes/avisos` | Público | Registrar reporte ciudadano (Chatbot o Web) con código de seguimiento numérico. |
| `GET` | `/api/incidentes/avisos/{id}` | Call Center / Admin | Obtener el detalle completo de un aviso para su evaluación. |
| `POST` | `/api/incidentes/avisos/{id}/verificar` | `incidentes:avisos:verificar` | Verificar y promover un aviso preliminar a incidente formal ICS (`REPORTADO`). |
| `POST` | `/api/incidentes/avisos/{id}/descartar` | `incidentes:avisos:descartar` | Descartar un aviso con justificación obligatoria. |
| `GET` | `/api/incidentes/avisos/seguimiento/{codigo}` | Público | Consultar estado amigable de seguimiento ciudadano por código de 8 dígitos. |
| `GET` | `/api/incidentes/tipos` | Público | Catálogo oficial de tipos de afectación. Sin parámetros retorna array de nombres (`string[]`); con `?catalogo=true` retorna objetos completos con `id`, `nombre`, `descripcion` y `activo` (HU-37). |
| `PATCH` | `/api/incidentes/{id}/tipologia` | `misiones:terreno:verificar` | Reclasificar técnicamente la tipología del incidente tras la evaluación presencial en terreno (HU-37). Requiere que la misión esté en `EN_CURSO` y justificación obligatoria. |
| `POST` | `/api/incidentes/{id}/prioridad/calcular` | `misiones:terreno:verificar` | Pre-calcular `prioridadSugerida`, puntaje y `factoresGatillantes` a partir del formulario de evaluación en terreno (HU-38). |
| `PATCH` | `/api/incidentes/{id}/prioridad` | `misiones:terreno:verificar` | Asignar o modificar la prioridad del incidente en terreno, validando `justificacion_prioridad` ($\ge 5$ caracteres) si difiere de `prioridad_sugerida`, emitiendo un reporte versionado en `reporte_terreno` (`versionReporte: 1, 2...`), registrando el hito en `mision_hito` y notificando `incidente:actualizado` al Centro de Mando (HU-38). |
| `POST` | `/api/incidentes/manual` | `crear_incidente_manual` | Ingreso manual de incidente desde Call Center o terreno. |
| `POST` | `/api/incidentes/verificar-duplicado` | `crear_incidente_manual` | Consultar coincidencias de incidentes cercanos en Valdivia. |
| `GET` | `/api/incidentes/kpis` | `incidentes:kanban` | Contadores numéricos de incidentes del día agrupados por estado para el panel del Encargado (HU-18). |
| `GET` | `/api/incidentes` | `incidentes:kanban` | Listado paginado de incidentes con filtros para el tablero Kanban del Encargado. Admite: `estado`, `prioridad`, `tipoAfectacion`, `delegacionId` (UUID), `fuenteOrigen` (`CHATBOT`, `LLAMADA_TELEFONICA`, `FUNCIONARIO_TERRENO`, `WEB`), `fecha` (YYYY-MM-DD), `soloHoy`, `busqueda`, `page`, `limit`. Retorna `data` y `meta` (estándar H34 / HU-18). |
| `GET` | `/api/incidentes/{id}` | `incidentes:kanban` | Detalle exhaustivo de incidente para puesto de mando (informante, misiones, cuadrillas). |

---

## 3. Códigos de Estado y Errores Esperables

- **`409 Conflict`:**
  - En `POST /api/incidentes/manual`: Se detectaron reportes similares en la zona (requiere confirmación `forzarCreacion: true`).
  - En `POST /api/incidentes/avisos/{id}/verificar` o `descartar`: El aviso ya fue gestionado concurrentemente por otro operador.
  - En `PATCH /api/incidentes/{id}/tipologia`: La patrulla debe haber aceptado la misión previamente (`estado = EN_CURSO`). Si la misión está en `DESPACHADA` o no existe misión de verificación para el incidente, se rechaza la operación.
- **`400 Bad Request`:**
  - Cuerpo JSON inválido, datos requeridos ausentes, o motivo de descarte menor a 5 caracteres.
  - En `PATCH /api/incidentes/{id}/tipologia`: Justificación ausente o menor a 5 caracteres, o tipo de incidente inactivo en base de datos.
- **`401 Unauthorized`:**
  - Cabecera `Authorization: Bearer <token>` o `X-User-Id` ausente o no registrada en el sistema.
- **`403 Forbidden`:**
  - El usuario no posee el rol ni permiso necesario para la operación solicitada (`misiones:terreno:verificar`).
  - En `PATCH /api/incidentes/{id}/tipologia`: El funcionario autenticado no forma parte de la patrulla verificadora asignada a la misión.
- **`404 Not Found`:**
  - No existe el recurso o código de seguimiento consultado.
  - En `PATCH /api/incidentes/{id}/tipologia`: Incidente, tipo de incidente o misión especificada no existen.
- **`500 Internal Server Error`:**
  - Error no controlado o fallo de conexión a la base de datos.

---

## 4. Integración y Eventos en Tiempo Real (Socket.io)

- **`sala:call-center`:**
  - `aviso:nuevo`: Notifica nuevo aviso preliminar para refrescar la grilla de pendientes.
  - `aviso:verificado`: Notifica promoción a incidente formal `{ avisoId, incidenteId, folio }`.
  - `aviso:descartado`: Notifica descarte del aviso `{ avisoId, motivoDescarte }`.
- **`sala:encargados`:**
  - `incidente:creado`: Nueva tarjeta para la columna "Reportado" en el tablero Kanban. Invalida la caché del dashboard y gatilla el refresco automático de `GET /api/incidentes/kpis`.
  - `incidente:actualizado`: Notifica cambio de estado o reclasificación tipológica en tiempo real (`REPORTADO`, `VERIFICANDO`, `EN_ATENCION`, etc.). Incluye `{ id, codigo, nuevoEstado, prioridad, tipoIncidenteId, tipoAfectacion, justificacion, actualizadoEn }` para actualizar reactivamente la tarjeta en el tablero Kanban.
- **Campos enriquecidos en `GET /api/incidentes/{id}`:**
  - `reclasificacionTipologia`: `{ hitoId, misionId, misionCodigo, tipoAnterior, tipoNuevo, justificacion, registradoPor, creadoEn } | null` con la trazabilidad del último cambio de afectación en terreno.
  - `ultimoReporte`: `{ origen, reporteId, misionId, misionCodigo, evaluadorNombre, creadoEn, resumen, prioridadAsignada, versionReporte, esRectificacion } | null` con el reporte o constatación más reciente enviado por alguna misión del incidente.
  - Los títulos de misiones `VERIFICACION` se sincronizan automáticamente con `incidente.tipo_afectacion` al reclasificar.
- **`sala:seguimiento:{codigoSeguimiento}`:**
  - `incidente:estado_actualizado`: Actualiza el panel ciudadano con la nueva descripción y etiqueta comprensible.

---

## 5. Cómo Probar (Criterio CA-7 y Pruebas Operativas)

13. **Enriquecimiento dinámico de tiempos de espera y delegación (`200 OK` - CA-7):**
    ```bash
    curl -i "http://localhost:3000/api/incidentes/avisos?estado=TODOS&limit=10" \
      -H "X-User-Id: c1111111-1111-4111-8111-111111111111"
    ```
    *Respuesta esperada: HTTP 200 donde cada objeto retornado en `data` incluye el atributo `minutosEnEspera` (número entero $\ge 0$ calculado en tiempo real según la fecha de creación para alimentar el semáforo de urgencia del Call Center) y la propiedad `delegacionNombre: string | null` debidamente resuelta a partir de la relación territorial (`Norte`, `Sur`, `Costa`, `Calle Calle`).*

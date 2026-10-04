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
    - **Canal de Origen:** `WEB`, `CHATBOT`, `TELEFONO`.
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

---

## 2. Endpoints del Módulo

| Método | Endpoint | Permiso Requerido | Propósito |
|---|---|---|---|
| `GET` | `/api/incidentes/avisos` | `incidentes:avisos:leer` | Listar avisos paginados con soporte multicriterio (delegación, estado, canal, búsqueda) y cálculo de tiempos de espera para el Call Center. |
| `POST` | `/api/incidentes/avisos` | Público | Registrar reporte ciudadano (Chatbot o Web) con código de seguimiento numérico. |
| `GET` | `/api/incidentes/avisos/{id}` | Call Center / Admin | Obtener el detalle completo de un aviso para su evaluación. |
| `POST` | `/api/incidentes/avisos/{id}/verificar` | `incidentes:avisos:verificar` | Verificar y promover un aviso preliminar a incidente formal ICS (`REPORTADO`). |
| `POST` | `/api/incidentes/avisos/{id}/descartar` | `incidentes:avisos:descartar` | Descartar un aviso con justificación obligatoria. |
| `GET` | `/api/incidentes/avisos/seguimiento/{codigo}` | Público | Consultar estado amigable de seguimiento ciudadano por código de 8 dígitos. |
| `GET` | `/api/incidentes/tipos` | Público | Catálogo oficial de tipos de afectación. |
| `POST` | `/api/incidentes/manual` | `crear_incidente_manual` | Ingreso manual de incidente desde Call Center o terreno. |
| `POST` | `/api/incidentes/verificar-duplicado` | `crear_incidente_manual` | Consultar coincidencias de incidentes cercanos en Valdivia. |
| `GET` | `/api/incidentes/kpis` | `incidentes:kanban` | Contadores numéricos de incidentes del día agrupados por estado para el panel del Encargado (HU-18). |
| `GET` | `/api/incidentes` | `incidentes:kanban` | Listado paginado de incidentes con filtros (estado, prioridad, fecha, soloHoy, delegación) para el tablero Kanban. |
| `GET` | `/api/incidentes/{id}` | `incidentes:kanban` | Detalle exhaustivo de incidente para puesto de mando (informante, misiones, cuadrillas). |

---

## 3. Códigos de Estado y Errores Esperables

- **`409 Conflict`:**
  - En `POST /api/incidentes/manual`: Se detectaron reportes similares en la zona (requiere confirmación `forzarCreacion: true`).
  - En `POST /api/incidentes/avisos/{id}/verificar` o `descartar`: El aviso ya fue gestionado concurrentemente por otro operador.
- **`400 Bad Request`:**
  - Cuerpo JSON inválido, datos requeridos ausentes, o motivo de descarte menor a 5 caracteres.
- **`401 Unauthorized`:**
  - Cabecera `X-User-Id` ausente o no registrada en el sistema.
- **`403 Forbidden`:**
  - El usuario no posee el rol ni permiso necesario para la operación solicitada.
- **`404 Not Found`:**
  - No existe el recurso o código de seguimiento consultado.
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
  - `incidente:actualizado`: Notifica cambio de estado en tiempo real (`REPORTADO`, `VERIFICANDO`, `EN_ATENCION`, etc.). Invalida y actualiza los contadores de `GET /api/incidentes/kpis` (patrón reactivo SWR) y mueve la tarjeta en el tablero.
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

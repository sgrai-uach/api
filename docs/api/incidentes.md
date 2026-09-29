# Módulo de Incidentes — Documentación Técnica de API

Este documento describe la operativa técnica del módulo de **Incidentes y Avisos** en `sgrai-api`, dirigido a los desarrolladores de `sgrai-web` (específicamente la interfaz del Call Center y Encargado) y `sgrai-pwa`.

---

## 1. Reglas de negocio aplicadas

El módulo implementa las siguientes reglas del **Sistema de Comando de Incidentes (ICS)** y del proyecto:

1. **Ciclo de vida del reporte:**
   - Todo reporte preliminar ingresa a la entidad `aviso_incidente` con estado `'NO_VERIFICADO'`.
   - La evaluación y filtrado primario la realiza un **Operador de Call Center**.
   - Al ejecutarse la acción *"Verificar y Enviar"*, el registro se transforma atómicamente a la entidad formal `incidente`, iniciando en estado **`'Reportado'`** y quedando visible para el rol **Encargado**.
   - Ciclo formal posterior del incidente: `Reportado → Verificando → En Atención → No Abordable / Resuelto`.
2. **Priorización por tiempo de espera:**
   - La consulta de avisos pendientes ordena por defecto de forma ascendente por fecha de creación (`creado_en ASC`).
   - La API computa dinámicamente el campo `minutosEnEspera` para que `sgrai-web` resalte visualmente los reportes más antiguos.
3. **Descarte justificado:**
   - Todo descarte de aviso requiere obligatoriamente un `motivoDescarte` con un mínimo de 5 caracteres.
4. **Vulnerabilidad y Asistencia Social (FIBE):**
   - La verificación permite marcar `requiereAsistenciaSocial` (boolean). No existen módulos de albergues; esta bandera permite derivar el incidente a Asistencia Social para levantar la Ficha Básica de Emergencia (FIBE).
5. **Transaccionalidad ACID con PostGIS:**
   - La transición a `incidente` se ejecuta bajo una transacción Kysely con bloqueo pesimista `FOR UPDATE` y generación de coordenadas espaciales `Point(4326)`.

---

## 2. Lista de Endpoints

| Método | Ruta | Propósito |
|---|---|---|
| `GET` | `/api/incidentes/avisos` | Listar avisos paginados pendientes de revisión para el Call Center (ordenados por antigüedad). |
| `POST` | `/api/incidentes/avisos` | Registrar un aviso preliminar de informante (dispara evento `aviso:nuevo` vía Socket.io). |
| `GET` | `/api/incidentes/avisos/{id}` | Obtener el detalle completo de un aviso (coordenadas, datos del informante y adjuntos). |
| `POST` | `/api/incidentes/avisos/{id}/verificar` | Verificar y promover atómicamente un aviso a la tabla `incidente` (estado `'Reportado'`). |
| `POST` | `/api/incidentes/avisos/{id}/descartar` | Descartar un aviso por información falsa o duplicada con justificación obligatoria. |

> Nota: La especificación completa y los tipos de request/response se derivan automáticamente desde los esquemas Zod en `GET /openapi.json`.

---

## 3. Códigos de error esperables no obvios

- **`409 Conflict` en `POST /api/incidentes/avisos/{id}/verificar`**:
  Ocurre cuando dos operadores intentan verificar o descartar el mismo aviso en simultáneo. La transacción aplica bloqueo pesimista `FOR UPDATE`; el segundo operador recibirá un `409` indicando que el aviso ya no se encuentra en estado `'NO_VERIFICADO'`.
- **`409 Conflict` en `POST /api/incidentes/avisos/{id}/descartar`**:
  Indica que el aviso ya fue verificado o descartado previamente por otro operador.
- **`401 Unauthorized` en endpoints de verificación o descarte**:
  Falta la cabecera `X-User-Id` requerida para identificar y auditar al operador responsable de la acción.
- **`400 Bad Request` en `POST /api/incidentes/avisos/{id}/descartar`**:
  Indica que el campo `motivoDescarte` no fue provisto o no cumple con el mínimo de 5 caracteres.

---

## 4. Eventos en Tiempo Real (Socket.io)

El backend emite los siguientes eventos:

- **`aviso:nuevo`**: Emitido a la sala `call-center` al registrarse un nuevo reporte de informante. Permite actualizar la tabla o grilla sin recargar la página.
- **`aviso:verificado`**: Notifica a `call-center` y `encargado` con `{ avisoId, incidenteId, folio }`.
- **`aviso:descartado`**: Notifica a `call-center` con `{ avisoId, motivoDescarte }` para retirar el aviso de la grilla de pendientes en los clientes conectados.

# Guía de Puesta al Día: Recepción y Verificación de Avisos por Call Center (HU-52)
**Repositorio:** `sgrai-api` (Backend Monolítico Modular)  
**Rama:** `feature/H52-recepcion-avisos` (basada en `develop`)  
**Versión SemVer:** `0.2.0`  

---

## 1. Contexto y Alcance de la Historia de Usuario

### ¿Qué problema resuelve esta HU?
El **Operador de Call Center** necesita visualizar los reportes/avisos de incidentes ingresados por los informantes (ciudadanos o canales automatizados) para:
1. Revisarlos en una bandeja de entrada pendientes en tiempo real.
2. Identificar cuáles llevan más tiempo esperando revisión para priorizarlos.
3. Ver su detalle completo (descripción, datos del informante, coordenadas y multimedia adjunta).
4. **Descartarlos** si son bromas, información falsa o duplicados (con justificación obligatoria).
5. **Verificarlos y enviarlos**: Acción atómica que convierte el aviso preliminar en un **Incidente formal**, haciéndolo visible para el rol **Encargado** (Sección de Operaciones).

### Delimitación de responsabilidades:
- **`sgrai-api` (este repo):** Implementa toda la lógica de negocio, base de datos, persistencia atómica, sockets y contrato OpenAPI.
- **`sgrai-web` (otro repo):** Implementa las vistas UI (tablas, modales, alertas visuales de tiempo de espera) consumiendo los endpoints y sockets de esta API.

---

## 2. Modelo de Datos y Base de Datos (PostgreSQL + PostGIS + Kysely)

Para esta historia de usuario nos acotamos estrictamente a las **4 tablas implicadas**:

1. **`tipo_incidente`**:
   - Catálogo maestro de clasificaciones de incidentes (Inundación, Deslizamiento, Caída de árbol, Anegamiento, etc.).
2. **`aviso_incidente`**:
   - Bandeja de entrada de reportes de informantes.
   - Campos clave: `descripcion`, `latitud`, `longitud`, `ubicacion` (PostGIS `GEOMETRY(Point, 4326)`), `datos_informante` (JSONB), `origen_reporte` (`WEB` | `CHATBOT` | `TELEFONO`), `estado` (`NO_VERIFICADO` | `VERIFICADO` | `DESCARTADO`), `motivo_descarte`, `operador_id`, `incidente_id`.
   - Índices optimizados en `(estado, creado_en ASC)` y GiST en `ubicacion`.
3. **`incidente`**:
   - Entidad formal operativa del Sistema de Comando de Incidentes (ICS).
   - Campos clave: `folio` (autogenerado, ej. `INC-2026-0001`), `tipo_incidente_id`, `estado` (inicia en `'Reportado'`), `requiere_asistencia_social` (boolean para derivación a FIBE según `GEMINI.md`), `aviso_id`, `creado_por_id`.
4. **`adjunto`**:
   - Almacenamiento de multimedia (fotos, videos) con claves foráneas `aviso_id` e `incidente_id`.

> **Gestor de migraciones:** Implementamos un runner programático en `src/lib/db/migrator.ts`. La migración inicial vive en `src/lib/db/migrations/001_initial_schema.ts` y se ejecuta con:
> ```bash
> npm run db:migrate
> ```

---

## 3. Reglas de Negocio Críticas Implementadas

1. **Transaccionalidad Atómica ("Verificar y Enviar"):**
   - Se ejecuta dentro de una transacción Kysely (`db.transaction().execute(...)`).
   - Aplica bloqueo pesimista de fila (`FOR UPDATE`) sobre `aviso_incidente` para evitar condiciones de carrera si dos operadores intentan procesar el mismo aviso al mismo tiempo.
   - Si el aviso ya no está en `NO_VERIFICADO`, responde `409 Conflict`.
   - Inserta el registro formal en `incidente` con estado `'Reportado'`, genera el folio secuencial, traspasa los adjuntos del aviso al nuevo incidente y actualiza el aviso a `'VERIFICADO'`.
2. **Descarte Justificado Obligatorio:**
   - La acción de descarte exige `motivoDescarte` con un mínimo de 5 caracteres. Pasa el aviso a estado `'DESCARTADO'` y registra el `operador_id`.
3. **Priorización por Tiempo de Espera:**
   - El listado de avisos ordena por defecto por `creado_en ASC` (los más antiguos primero).
   - El servicio computa dinámicamente el campo numérico `minutosEnEspera` para facilitar que el frontend destaque en colores (ej. amarillo/rojo) los reportes críticos.
4. **Identificación y Auditoría de Operadores:**
   - Se recibe y audita al operador a través de la cabecera HTTP `X-User-Id: <UUID>`. Si no viene en endpoints protegidos, responde `401 Unauthorized`.

---

## 4. Estructura de Carpetas y Convenciones de Código

### ¿Por qué los archivos de endpoints se llaman `route.ts`?
En Next.js App Router (`src/app`), **es una convención obligatoria del framework**. La ruta URL está dada por las carpetas que contienen al archivo `route.ts`. Por ejemplo:
- `src/app/api/incidentes/avisos/route.ts` $\rightarrow$ `/api/incidentes/avisos`
- `src/app/api/incidentes/avisos/[id]/verificar/route.ts` $\rightarrow$ `/api/incidentes/avisos/:id/verificar`

### Arquitectura en capas limpia:
Los archivos `route.ts` son solo adaptadores HTTP. La verdadera lógica está desacoplada en:
- `src/modules/incidentes/types.ts`: Interfaces de dominio y DTOs.
- `src/modules/incidentes/schema.ts`: Validación estricta con **Zod** y metadatos OpenAPI.
- `src/modules/incidentes/repository.ts`: Consultas de datos con **Kysely**, PostGIS y transacciones.
- `src/modules/incidentes/service.ts`: Lógica de negocio, tiempos de espera y disparo de sockets.

---

## 5. Tiempo Real con Socket.io

Para que el Call Center y el Encargado vean las actualizaciones sin recargar página:
- Se implementó un servidor personalizado en `src/server.ts` que monta Socket.io y Next.js en el mismo puerto (`3000`).
- Helpers en `src/lib/socket/index.ts`:
  - `aviso:nuevo`: Se emite a la sala `call-center` al registrarse un nuevo aviso.
  - `aviso:verificado`: Se emite con `{ avisoId, incidenteId, folio }` a las salas `call-center` y `encargado`.
  - `aviso:descartado`: Se emite con `{ avisoId, motivoDescarte }` a la sala `call-center`.

---

## 6. Contrato de API para Frontend (OpenAPI)

El archivo `src/lib/openapi/index.ts` genera automáticamente la especificación OpenAPI 3.0 desde los esquemas Zod.
- **Ruta pública del spec:** `GET /openapi.json`
- `sgrai-web` y `sgrai-pwa` pueden consumir este JSON para generar automáticamente sus tipos TypeScript con herramientas como `openapi-typescript`.

### Endpoints disponibles:

| Método | Endpoint | Cabeceras | Parámetros / Body | Códigos HTTP |
|---|---|---|---|---|
| `GET` | `/api/incidentes/avisos` | Opcional | Query: `page`, `limit`, `estado` | `200`, `400`, `500` |
| `POST` | `/api/incidentes/avisos` | Opcional | Body: `descripcion`, `latitud`, `longitud`, `tipoPreliminarId`, `datosInformante` | `201`, `400`, `500` |
| `GET` | `/api/incidentes/avisos/{id}` | Opcional | Path: `id` (UUID) | `200`, `404`, `500` |
| `POST` | `/api/incidentes/avisos/{id}/verificar` | `X-User-Id: <UUID>` | Body: `tipoIncidenteId`, `descripcion` (opcional), `requiereAsistenciaSocial` (boolean) | `201`, `400`, `401`, `404`, `409`, `500` |
| `POST` | `/api/incidentes/avisos/{id}/descartar` | `X-User-Id: <UUID>` | Body: `motivoDescarte` (mín. 5 caracteres) | `200`, `400`, `401`, `404`, `409`, `500` |

---

## 7. Pruebas Automatizadas (Vitest)

Se configuró **Vitest** en `vitest.config.ts`.
- **Ubicación:** `src/modules/incidentes/__tests__/incidentes.test.ts`
- **Cobertura:** 13 pruebas unitarias completas:
  - Validaciones de esquemas Zod (coordenadas, textos mínimos, motivos).
  - Cálculo de `minutosEnEspera`.
  - Excepciones de dominio `NotFoundError` y `ConflictError` ante concurrencia.
  - Promoción atómica a `incidente` con estado `'Reportado'`.
  - Integridad del documento generado en `GET /openapi.json`.
- **Ejecución:**
  ```bash
  npm test
  ```

---

## 8. Guía Rápida para Levantar el Proyecto Localmente

1. **Posicionarse en la rama:**
   ```bash
   git checkout feature/H52-recepcion-avisos
   ```
2. **Instalar dependencias:**
   ```bash
   npm install
   ```
3. **Levantar PostgreSQL + PostGIS:**
   ```bash
   docker compose up -d postgres
   ```
4. **Ejecutar migraciones:**
   ```bash
   npm run db:migrate
   ```
5. **Correr pruebas unitarias:**
   ```bash
   npm test
   ```
6. **Iniciar el servidor:**
   ```bash
   npm run dev
   # o con soporte completo de WebSockets:
   npx tsx src/server.ts
   ```

---

## 9. Historial de Commits Realizados

Siguiendo **Conventional Commits** y **Gitflow**:
1. `fed9024` `chore(db): configurar kysely, postgis y migracion de tablas de avisos e incidentes`
2. `ab89206` `feat(socket): configurar servidor socket.io y eventos para call center`
3. `f515110` `feat(incidentes): implementar esquemas zod, repositorio y servicio de avisos`
4. `e8638c5` `feat(api): crear endpoints de consulta paginada, verificacion atomica y descarte`
5. `7b94616` `build: actualizar package-lock.json con dependencias de desarrollo`
6. `727fa66` `feat(openapi): registrar rutas y exponer especificacion en /openapi.json`
7. `893112f` `test(incidentes): agregar suites de pruebas unitarias en vitest`
8. `1a23094` `docs(api): documentar modulo de incidentes en docs/api/incidentes.md`

---

## 10. Próximos Pasos en Equipo

1. **Pair Review:** Revisión cruzada de código con otro desarrollador del equipo.
2. **Integración con Frontend (`sgrai-web`):**
   - Consumir `GET /api/incidentes/avisos` para poblar la tabla del Call Center.
   - Escuchar `aviso:nuevo` y `aviso:descartado` en el cliente Socket.io para refrescar en vivo.
   - Implementar el modal de detalle consumiendo `GET /api/incidentes/avisos/:id` y los botones de acción para invocar `/verificar` y `/descartar`.
3. **PO Review:** Demostración al Product Owner de la transición de aviso a incidente.
4. **Merge:** Una vez aprobada la PR, fusionar hacia `develop`.

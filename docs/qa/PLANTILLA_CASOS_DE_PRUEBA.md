# Plantilla Estándar de Casos de Prueba (QA) — SGRAI

Esta plantilla define el formato estándar para el diseño, ejecución y registro de evidencias de pruebas de software en el proyecto SGRAI (Dirección de Gestión de Riesgos de Desastres - Municipalidad de Valdivia), basada en las directrices de la norma **IEEE 829 / ISO/IEC/IEEE 29119**.

---

## 1. Ficha Técnica de la Historia de Usuario

| Parámetro | Detalle |
|---|---|
| **Proyecto** | Sistema de Gestión de Recursos para Atención de Incidentes (SGRAI) |
| **Módulo** | [Nombre del Módulo, ej. Recursos y Personal / Seguridad / Incidentes] |
| **Historia de Usuario (HU)** | [Código y Título, ej. HU-7: Listar Recursos de Inventario Logístico] |
| **QA Responsable** | [Nombre del Estudiante / Ingeniero QA] |
| **Desarrollador / Rama** | [Rama Git, ej. `feature/H7-listar-recursos`] |
| **Commit Bajo Prueba (Hash)** | [Hash corto de Git, ej. `4b288a9`] |
| **Entorno de Pruebas** | Local (Docker PostgreSQL 16 + PostGIS + Redis / Node.js v20+) |
| **Fecha de Ejecución** | [DD/MM/AAAA] |
| **Estado Global** | [🟢 CERTIFICADO / 🟡 BLOQUEADO / 🔴 RECHAZADO] |

---

## 2. Resumen Ejecutivo de Ejecución

| Métrica | Valor |
|---|:---:|
| Total Casos de Prueba Diseñados | 0 |
| Casos Aprobados (Passed) | 0 |
| Casos Fallidos (Failed) | 0 |
| Casos Bloqueados (Blocked) | 0 |
| **Porcentaje de Éxito (% Pass)** | **0%** |

---

## 3. Matriz Detallada de Casos de Prueba

### Formato Tabular (Ideal para exportar o copiar a Google Sheets / Excel)

| ID Caso | Título del Caso de Prueba | Tipo de Prueba | Nivel | Prioridad | Precondición | Pasos de Ejecución | Datos de Prueba (Payload / Params) | Resultado Esperado | Resultado Obtenido | Estado |
|---|---|---|---|---|---|---|---|---|---|:---:|
| `CP-[HU]-01` | [Título breve del caso] | Funcional / Seguridad / Límite | Unitaria / API / E2E | Alta / Media / Baja | [Estado previo del sistema] | 1. [Paso 1]<br>2. [Paso 2] | [Headers, body o query] | [Status code, JSON o comportamiento] | [Status code o mensaje recibido] | ✅ APROBADO / ❌ FALLIDO |

---

## 4. Ficha Extendida por Caso de Prueba (Detalle de Ejecución)

### `CP-[HU]-[XX]`: [Título Descriptivo del Caso de Prueba]

* **Criterio de Aceptación Vinculado:** [Referencia al criterio de aceptación de la HU en Jira/Backlog].
* **Tipo de Prueba:** [Unitaria / Integración / API REST / Seguridad RBAC / Rendimiento / Caja Negra].
* **Prioridad:** [Crítica / Alta / Media / Baja].
* **Precondiciones:**
  1. Base de datos con migración ejecutada.
  2. Servicio backend activo en puerto configurado.
  3. [Usuario o sesión disponible].

* **Pasos de Ejecución:**
  1. Enviar petición HTTP [GET/POST/PUT/DELETE] hacia el endpoint `[URL]`.
  2. Incluir cabecera `[Header: Valor]`.
  3. Enviar parámetros / cuerpo JSON:
     ```json
     {
       "campo": "valor"
     }
     ```
  4. Inspeccionar código de respuesta HTTP, cabeceras y estructura del cuerpo JSON.

* **Resultado Esperado:**
  * Código de estado: `[200 / 201 / 400 / 401 / 403]`.
  * Estructura de respuesta: `[data, meta, message, errors]`.
  * Comportamiento en base de datos: [Registro insertado, campo actualizado, etc.].

* **Resultado Obtenido:**
  * Código de estado obtenido: `[Código]`.
  * Respuesta recibida: `[Resumen del payload recibido]`.

* **Estado:** **APROBADO (PASSED)** / **FALLIDO (FAILED)** / **BLOQUEADO (BLOCKED)**.
* **Evidencia Técnica:**
  ```bash
  [Comando de prueba, salida de Vitest o cURL]
  ```

---

## 5. Registro de Defectos (Bugs Encontrados)

*(Completar únicamente si algún caso resulta FALLIDO)*

| ID Defecto | Caso Asociado | Severidad | Descripción del Defecto | Pasos para Reproducir | Estado | Desarrollador Asignado |
|---|---|---|---|---|---|---|
| `BUG-01` | `CP-[HU]-02` | Bloqueante / Mayor / Menor | [Explicación del error] | 1. ... 2. ... | Abierto / Corregido | [Nombre] |

# Informe y Matriz de Casos de Prueba (QA): HU-6 — Crear Recurso

> **Documento Oficial de Aseguramiento de Calidad (QA)**  
> **Proyecto:** Sistema de Gestión de Recursos para Atención de Incidentes (SGRAI) — Municipalidad de Valdivia.  
> **Módulo:** Recursos y Personal (Logística / Operaciones ICS).  
> **Historia de Usuario:** HU-6 — *"Como Administrador Quiero registrar un nuevo recurso en el inventario logístico Para que esté disponible para asignación a cuadrillas o atención de emergencias"*.  
> **Versión API:** `v0.2.0` | **Rama Git:** `feature/H6-crear-recurso` | **Commit Evaluado:** `aca6932`  
> **Entorno:** Local (PostgreSQL 16 + PostGIS en Docker, Node.js v20.x, Next.js v16.3.4, Vitest v2.1.9).  
> **Fecha de Certificación:** 21 de Septiembre de 2026.  
> **Estado de Certificación:** 🟢 **APROBADO PARA PULL REQUEST (100% PASS)**.

---

## 1. Resumen Ejecutivo de Pruebas

| Métrica | Resultado |
|---|:---:|
| **Total de Casos de Prueba Diseñados y Ejecutados** | **14** |
| **Casos Aprobados (Passed)** | **14** |
| **Casos Fallidos (Failed)** | **0** |
| **Casos Bloqueados (Blocked)** | **0** |
| **Defectos Críticos Detectados (Bugs)** | **0** |
| **Tasa de Aprobación (% Pass)** | **100%** |
| **Suite Automatizada de Pruebas (Vitest)** | **18/18 tests exitosos** |
| **Chequeo de Tipos Estáticos (TypeScript)** | **0 errores (`npx tsc --noEmit`)** |
| **Análisis Estático de Código (ESLint)** | **0 advertencias / 0 errores** |

---

## 2. Matriz Consolidada de Casos de Prueba (HU-6)

*(Esta tabla puede ser exportada o copiada directamente a Google Sheets o Microsoft Excel para revisión del equipo).*

| ID Caso | Título del Caso de Prueba | Tipo de Prueba | Nivel | Prioridad | Precondición | Datos de Prueba (Payload / Headers / Query) | Resultado Esperado | Resultado Obtenido | Estado |
|---|---|---|---|---|---|---|---|---|:---:|
| `CP-HU06-01` | Bloqueo de acceso por ausencia de cabecera de autenticación | Seguridad | API | Crítica | API en ejecución | `POST /api/recursos` sin cabecera `X-User-Id` | HTTP 401 Unauthorized | HTTP 401 `"Cabecera X-User-Id requerida..."` | ✅ APROBADO |
| `CP-HU06-02` | Bloqueo de acceso a usuario sin permiso `recursos:crear` | Seguridad (RBAC) | API / Servicio | Crítica | Usuario existente pero con rol sin permiso logístico | `X-User-Id` de rol sin `recursos:crear` | HTTP 403 Forbidden | HTTP 403 `"No cuenta con permisos..."` | ✅ APROBADO |
| `CP-HU06-03` | Creación exitosa de recurso a granel con alerta de `BAJO_STOCK` | Funcional | Unitaria / API | Alta | Usuario con permiso de creación | `nombre: "Sacos de Arena"`, `esIndividual: false`, `cantidadInventario: 50`, `cantidadMinima: 100`, coords Valdivia | HTTP 201 Created con `estado: "BAJO_STOCK"` | HTTP 201 Created, estado calculado automáticamente | ✅ APROBADO |
| `CP-HU06-04` | Creación exitosa de recurso a granel con disponibilidad normal | Funcional | Unitaria / API | Alta | Usuario con permiso de creación | `nombre: "Raciones de Combate"`, `cantidadInventario: 500`, `cantidadMinima: 100` | HTTP 201 Created con `estado: "DISPONIBLE"` | HTTP 201 Created, stock suficiente verificado | ✅ APROBADO |
| `CP-HU06-05` | Registro de maquinaria serializada: Camioneta Operativa 4x4 | Funcional | Unitaria / API | Alta | Especificaciones vehiculares provistas | `esIndividual: true`, `detalles: { patente: "ABCD-12", kilometraje: 45000, tipoCombustible: "DIESEL", capacidadPasajeros: 5 }` | HTTP 201 Created con objeto `detalles` íntegro | HTTP 201 Created, JSONB persistido correctamente | ✅ APROBADO |
| `CP-HU06-06` | Registro de maquinaria pesada: Grúa Pluma 50T | Funcional | Unitaria / API | Alta | Parámetros de carga y alcance | `esIndividual: true`, `detalles: { capacidadCargaKg: 50000, alcanceMaximoMetros: 38, horometro: 1200 }` | HTTP 201 Created con validación de atributos técnicos | HTTP 201 Created con campos técnicos validados | ✅ APROBADO |
| `CP-HU06-07` | Registro de equipo de bombeo: Motobomba de Achique 3 Pulgadas | Funcional | Unitaria / API | Alta | Parámetros de caudal y diámetro | `esIndividual: true`, `detalles: { caudalMaximoLpm: 1200, diametroPulgadas: 3, potenciaHp: 8.5 }` | HTTP 201 Created con caudal y diámetro validados | HTTP 201 Created con métricas de fluidos correctas | ✅ APROBADO |
| `CP-HU06-08` | Asignación automática de estado `NO_DISPONIBLE` con stock en 0 | Regla de Negocio | Unitaria | Alta | Registro de recurso agotado o recién adquirido | `cantidadInventario: 0`, `cantidadMinima: 10` | HTTP 201 Created con `estado: "NO_DISPONIBLE"` | HTTP 201 Created con estado calculado correctamente | ✅ APROBADO |
| `CP-HU06-09` | Rechazo por nombre menor a 3 caracteres | Validación (Zod) | Unitaria / API | Media | Payload con nombre inválido | `{ nombre: "AB", cantidadInventario: 1, latitud: -39.81, longitud: -73.24 }` | HTTP 400 Bad Request con mensaje descriptivo Zod | HTTP 400 `"El nombre debe tener al menos 3 caracteres"` | ✅ APROBADO |
| `CP-HU06-10` | Rechazo por cantidad de inventario negativa | Validación (Zod) | Unitaria / API | Media | Payload con stock menor a 0 | `{ nombre: "Generador 5kVA", cantidadInventario: -1 }` | HTTP 400 Bad Request | HTTP 400 `"La cantidad en inventario no puede ser negativa"` | ✅ APROBADO |
| `CP-HU06-11` | Rechazo por coordenadas geográficas fuera de rango [-90,90] / [-180,180] | Validación (Zod) | Unitaria / API | Media | Latitud 95.0 o Longitud -185.0 | Coordenadas fuera de la proyección espacial EPSG:4326 | HTTP 400 Bad Request | HTTP 400 `"La latitud/longitud debe estar entre..."` | ✅ APROBADO |
| `CP-HU06-12` | Rechazo por atributos técnicos numéricos negativos en `detalles` | Validación (Zod) | Unitaria | Media | Kilometraje -100, horómetro -1 o caudal 0 | `detalles: { kilometraje: -100, horometro: -1, caudalMaximoLpm: 0 }` | Error de parseo Zod en `DetallesRecursoSchema` | `safeParse` retorna `false` con mensajes específicos | ✅ APROBADO |
| `CP-HU06-13` | Rechazo de solicitud con cuerpo no JSON o malformado | Robustez API | API | Media | Petición con cuerpo de texto plano inválido | `POST /api/recursos` con body `"esto no es json"` | HTTP 400 Bad Request | HTTP 400 `"El cuerpo de la solicitud debe ser un JSON válido."` | ✅ APROBADO |
| `CP-HU06-14` | Exposición de especificación OpenAPI 3.0 con ruta `/api/recursos` | Contrato de API | API / OpenAPI | Alta | Servidor activo | `GET /openapi.json` | HTTP 200 OK con definición del método `POST` de `/api/recursos` | HTTP 200 OK con contrato completo sincronizado | ✅ APROBADO |

---

## 3. Detalle de Casos de Prueba con Evidencias de Ejecución

### `CP-HU06-01`: Bloqueo de acceso por ausencia de cabecera de autenticación
* **Criterio de Aceptación:** La creación de recursos exige autenticación mediante la cabecera `X-User-Id`.
* **Tipo de Prueba:** Seguridad / HTTP 401.
* **Prioridad:** Crítica.
* **Comando / Petición:**
  ```http
  POST /api/recursos HTTP/1.1
  Host: localhost:3000
  Content-Type: application/json

  {
    "nombre": "Generador 5kVA",
    "cantidadInventario": 1,
    "latitud": -39.8142,
    "longitud": -73.2459
  }
  ```
* **Resultado Esperado:** Código HTTP 401 Unauthorized.
* **Resultado Obtenido:**
  ```json
  {
    "message": "Cabecera X-User-Id requerida para autenticación provisional."
  }
  ```
* **Estado:** ✅ APROBADO (PASSED).

---

### `CP-HU06-03`: Creación exitosa de recurso a granel con alerta de `BAJO_STOCK`
* **Criterio de Aceptación:** Si `cantidadInventario <= cantidadMinima` y `cantidadMinima > 0`, el recurso debe crearse automáticamente en estado `BAJO_STOCK`.
* **Tipo de Prueba:** Funcional / Positiva.
* **Prioridad:** Alta.
* **Petición Enviada:**
  ```http
  POST /api/recursos HTTP/1.1
  Host: localhost:3000
  Content-Type: application/json
  X-User-Id: 00000000-0000-4000-8000-000000000001

  {
    "nombre": "Sacos de Arena",
    "esIndividual": false,
    "cantidadInventario": 50,
    "cantidadMinima": 100,
    "latitud": -39.8142,
    "longitud": -73.2459,
    "descripcion": "Sacos de contención para crecida del Río Calle-Calle"
  }
  ```
* **Resultado Obtenido (HTTP 201 Created):**
  ```json
  {
    "message": "Recurso creado exitosamente",
    "data": {
      "id": "7f8b1a20-3b4c-4d5e-9f0a-1b2c3d4e5f60",
      "nombre": "Sacos de Arena",
      "esIndividual": false,
      "estado": "BAJO_STOCK",
      "cantidadInventario": 50,
      "cantidadEnUso": 0,
      "cantidadMinima": 100,
      "latitud": -39.8142,
      "longitud": -73.2459,
      "descripcion": "Sacos de contención para crecida del Río Calle-Calle",
      "detalles": {},
      "creadoPorId": "00000000-0000-4000-8000-000000000001"
    }
  }
  ```
* **Estado:** ✅ APROBADO (PASSED).

---

### `CP-HU06-05`: Registro de maquinaria serializada (Camioneta Operativa)
* **Criterio de Aceptación:** Los recursos individuales deben admitir atributos técnicos en `detalles` (patente, combustible, kilometraje).
* **Tipo de Prueba:** Funcional / Positiva.
* **Prioridad:** Alta.
* **Petición Enviada:**
  ```http
  POST /api/recursos HTTP/1.1
  Host: localhost:3000
  Content-Type: application/json
  X-User-Id: 00000000-0000-4000-8000-000000000001

  {
    "nombre": "Camioneta Operaciones 4x4",
    "esIndividual": true,
    "cantidadInventario": 1,
    "cantidadMinima": 0,
    "latitud": -39.8170,
    "longitud": -73.2420,
    "detalles": {
      "patente": "ABCD-12",
      "marca": "Toyota",
      "modelo": "Hilux",
      "anio": 2023,
      "kilometraje": 45000,
      "tipoCombustible": "DIESEL",
      "capacidadPasajeros": 5
    }
  }
  ```
* **Resultado Obtenido (HTTP 201 Created):**
  * `data.esIndividual`: `true`
  * `data.estado`: `"DISPONIBLE"`
  * `data.detalles.patente`: `"ABCD-12"`
  * `data.detalles.kilometraje`: `45000`
* **Estado:** ✅ APROBADO (PASSED).

---

### `CP-HU06-09` y `CP-HU06-11`: Validaciones Zod de Frontera y Tipos Inválidos
* **Criterio de Aceptación:** El sistema debe rechazar nombres menores a 3 caracteres o coordenadas fuera del rango [-90, 90] / [-180, 180].
* **Tipo de Prueba:** Negativa / Validación.
* **Petición con Coordenadas Inválidas:**
  ```http
  POST /api/recursos HTTP/1.1
  Host: localhost:3000
  Content-Type: application/json
  X-User-Id: 00000000-0000-4000-8000-000000000001

  {
    "nombre": "Motosierra Stihl",
    "cantidadInventario": 2,
    "latitud": 95.0,
    "longitud": -73.2459
  }
  ```
* **Resultado Obtenido (HTTP 400 Bad Request):**
  ```json
  {
    "message": "Datos de entrada inválidos.",
    "errors": [
      {
        "campo": "latitud",
        "mensaje": "La latitud debe estar entre -90 y 90"
      }
    ]
  }
  ```
* **Estado:** ✅ APROBADO (PASSED).

---

## 4. Evidencia de Ejecución Automatizada

Ejecución de la suite completa de pruebas en la rama `feature/H6-crear-recurso`:

```bash
$ npm test

npm notice run api@0.2.0 test
npm notice run vitest run

 RUN  v2.1.9 /home/ds2fery/Documentos/Proyecto/sgrai-uach/api

 ✓ src/app/openapi.json/__tests__/route.test.ts (1)              
 ✓ src/modules/recursos-y-personal/__tests__/recurso.test.ts (14)
 ✓ src/app/api/recursos/__tests__/route.test.ts (3)

 Test Files  3 passed (3)
      Tests  18 passed (18)
   Start at  23:12:56
   Duration  879ms
```

Compilación y comprobación estática de tipos de TypeScript:
```bash
$ npx tsc --noEmit
# 0 errores detectados.
```

Linter de estilos del proyecto:
```bash
$ npm run lint
# 0 advertencias / 0 errores detectados.
```

---

## 5. Conclusión y Veredicto de QA

El módulo implementado en la rama **`feature/H6-crear-recurso`** satisface todos los criterios de aceptación técnicos y funcionales definidos para la **HU-6**. No se identificaron defectos abiertos ni regresiones en contratos existentes.

**Dictamen:** 🟢 **CERTIFICADO PARA MERGE A DEVELOP**.

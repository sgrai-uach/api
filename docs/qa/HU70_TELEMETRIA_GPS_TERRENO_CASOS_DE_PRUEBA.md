# Matriz de Casos de Prueba y Certificación Técnica (QA): HU-70 — Transmisión y Retransmisión de Telemetría GPS en Terreno (Backend API)

> **Documento Oficial de Aseguramiento de Calidad (QA) — Backend API**  
> **Proyecto:** Sistema de Gestión de Recursos para Atención de Incidentes (SGRAI) — Dirección de Gestión de Riesgos de Desastres, Municipalidad de Valdivia.  
> **Módulo:** Geolocalización, Misiones y Tiempo Real (`sgrai-api` — Socket.io, Redis Cache y `GET /api/geolocalizacion/posiciones`).  
> **Historia de Usuario:** HU-70 — *"Como Delegado de cuadrilla / Patrulla verificadora Quiero que mi dispositivo móvil transmita automáticamente mis coordenadas geográficas en segundo plano mientras me encuentro en misión activa Para que el Centro de Mando visualice la posición en tiempo real de las unidades en el mapa y optimice los tiempos de respuesta y despacho."*  
> **Servicio Backend Evaluado:** `sgrai-api` (Next.js 16 + TypeScript + Socket.io 4.8 + ioredis 6.0 + Zod + OpenAPI 3.0 + Vitest 3.2.7).  
> **Rama Git Evaluada:** `feature/H70-telemetria-gps-terreno`  
> **Estado de Certificación:** 🟢 **CERTIFICADO / APROBADO (100% Criterios de Aceptación Cumplidos)**.  

---

## 1. Resumen Ejecutivo de Pruebas

Se ejecutó la verificación técnica integral del protocolo de telemetría GPS para unidades operativas en terreno, validando:
1. **Contratos y Validación de Coordenadas:** Validación estricta con Zod bajo estándar WGS84 (`[-90, 90]` y `[-180, 180]`), discriminación de tipo de unidad (`PATRULLA` y `CUADRILLA`) y soporte de atributos opcionales de precisión (`accuracy` en metros), rumbo (`heading` en grados 0-360) y velocidad instantánea.
2. **Persistencia Eficiente en Redis (Sin I/O innecesario en PostgreSQL):** Almacenamiento rápido en clave `telemetria:posicion:{tipoUnidad}:{unidadId}` con TTL automático de 300 segundos (5 minutos) y registro en Set indexado `telemetria:unidades_activas` para expiración natural de unidades inactivas.
3. **Capa en Tiempo Real (Socket.io & Broker Redis):** Listener para evento de entrada `telemetria:posicion`, retransmisión local inmediata hacia la sala `mapa` y canalización por Redis Pub/Sub (`REDIS_SOCKET_CHANNEL`) para entornos multi-instancia.
4. **Hidratación Inicial del Mapa (Endpoint REST):** Endpoint `GET /api/geolocalizacion/posiciones` protegido con autenticación de sesión para permitir que el Centro de Mando en `sgrai-web` obtenga la última posición de todas las unidades activas al abrir la interfaz.
5. **Documentación de API y OpenAPI 3.0:** Registro de la ruta en la especificación OpenAPI y documentación exhaustiva del protocolo en `docs/api/misiones.md`.

---

## 2. Matriz Detallada de Casos de Prueba (QA)

| ID Caso | Componente / Capa | Descripción del Escenario de Prueba | Entrada / Payload | Resultado Esperado | Estado |
|---|---|---|---|---|:---:|
| **CP-H70-API-01** | Esquema Zod | Validación de reporte completo de patrulla con rumbo, precisión y velocidad | `{ unidadId: UUID, tipoUnidad: "PATRULLA", lat: -39.81422, lng: -73.24589, rumbo: 180.5, precision: 12.3, velocidad: 4.5, timestamp: ISO }` | Parse exitoso con campos tipados correctamente | 🟢 Pass |
| **CP-H70-API-02** | Esquema Zod | Validación de reporte mínimo de cuadrilla sin campos opcionales | `{ unidadId: UUID, tipoUnidad: "CUADRILLA", lat: -39.825, lng: -73.238, timestamp: epochNum }` | Parse exitoso; timestamp transformado a ISO 8601 canónico | 🟢 Pass |
| **CP-H70-API-03** | Esquema Zod | Rechazo de identificador de unidad con formato no UUID | `{ unidadId: "patrulla-123", tipoUnidad: "PATRULLA", ... }` | Error de validación Zod (`unidadId` debe ser UUID válido) | 🟢 Pass |
| **CP-H70-API-04** | Esquema Zod | Rechazo de tipo de unidad no soportado | `{ unidadId: UUID, tipoUnidad: "AMBULANCIA", ... }` | Error de validación Zod (enum inválido) | 🟢 Pass |
| **CP-H70-API-05** | Esquema Zod | Rechazo de latitud fuera del estándar WGS84 (< -90 o > 90) | `{ ... lat: -95.0, lng: -73.2 }` | Error de validación Zod | 🟢 Pass |
| **CP-H70-API-06** | Esquema Zod | Rechazo de longitud fuera del estándar WGS84 (< -180 o > 180) | `{ ... lat: -39.8, lng: 185.0 }` | Error de validación Zod | 🟢 Pass |
| **CP-H70-API-07** | Esquema Zod | Rechazo de valores negativos en rumbo o precisión | `{ ... rumbo: -10, precision: -5 }` | Error de validación Zod | 🟢 Pass |
| **CP-H70-API-08** | Cache Redis | Guardar y recuperar la posición de una unidad en Redis | Inserción mediante `guardarPosicionUnidad` | Registro almacenado con fecha `recibidoEn` y recuperable con `obtenerPosicionUnidad` | 🟢 Pass |
| **CP-H70-API-09** | Cache Redis | Consulta de unidad inexistente o expirada | Consulta `obtenerPosicionUnidad` con UUID inexistente | Retorna `null` sin lanzar excepción | 🟢 Pass |
| **CP-H70-API-10** | Cache Redis | Listar todas las posiciones activas de múltiples unidades | Guardar 1 patrulla y 1 cuadrilla activa | Retorna array con 2 elementos conteniendo ambas unidades | 🟢 Pass |
| **CP-H70-API-11** | Socket.io | Emisión de evento `telemetria:posicion` hacia la sala `mapa` | Invocación `notificarTelemetriaPosicion` con posición válida | `io.to("mapa").emit("telemetria:posicion", posicion)` ejecutado | 🟢 Pass |
| **CP-H70-API-12** | Socket.io | Descarte silencioso ante payload malformado | Cliente emite `telemetria:posicion` con JSON inválido o sin latitud | Servidor no colapsa, loguea advertencia y descarta el evento sin afectar la conexión | 🟢 Pass |
| **CP-H70-API-13** | REST API | Petición no autenticada a `GET /api/geolocalizacion/posiciones` | Request sin cabecera `Authorization` | HTTP `401 Unauthorized` | 🟢 Pass |
| **CP-H70-API-14** | REST API | Petición con token expirado o inválido | Request con token JWT corrupto | HTTP `401 Unauthorized` | 🟢 Pass |
| **CP-H70-API-15** | REST API | Petición exitosa a `GET /api/geolocalizacion/posiciones` con sesión válida | Request con token válido | HTTP `200 OK` con listado de posiciones activas y mensaje de éxito | 🟢 Pass |
| **CP-H70-API-16** | REST API | Manejo de excepción no prevista en almacenamiento | Error en capa de persistencia | HTTP `500 Internal Server Error` con mensaje estructurado | 🟢 Pass |
| **CP-H70-API-17** | OpenAPI | Exposición de la ruta en la especificación OpenAPI 3.0 | `GET /openapi.json` | Ruta `/api/geolocalizacion/posiciones` presente con tags y esquema de respuesta `200` y `401` | 🟢 Pass |
| **CP-H70-API-18** | Arquitectura | Aislamiento estricto de responsabilidades | Inspección de repositorio | Cero dependencias de UI en la API; contratos expuestos vía OpenAPI y WebSockets para `sgrai-web` y `sgrai-pwa` | 🟢 Pass |

---

## 3. Cobertura de Criterios de Aceptación (HU-70)

1. **[X] Activación y captura en misión `EN_CURSO`:** Contrato tipado en backend listo para recibir y procesar las transmisiones periódicas de la PWA.
2. **[X] Emisión periódica de evento WebSocket `telemetria:posicion`:** Listener configurado en `src/server.ts` y tipos actualizados en `src/lib/socket/types.ts`.
3. **[X] Retransmisión hacia la sala `mapa`:** Servidor retransmite las posiciones validadas exclusivamente a la sala `mapa` e incorpora persistencia volátil en Redis.
4. **[X] Pausa y expiración automática:** Mecanismo de TTL (300s) en Redis que expira las coordenadas si la unidad finaliza misión o pasa a `DISPONIBLE`.
5. **[X] Tolerancia a desconexión y fallos:** Fallback automático en memoria cuando Redis no está disponible y manejo resiliente sin caída de sockets.


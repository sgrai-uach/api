# Manual de Operaciones DevOps e Infraestructura — SGRAI

**Dirección de Gestión de Riesgos de Desastres (DGRD) • Ilustre Municipalidad de Valdivia**  
*Sistema de Gestión de Recursos para Atención de Incidentes · sgrai.inf.uach.cl*

---

## Índice General

1. [Arquitectura de Despliegue y Topología de Servicios (API + Web)](#1-arquitectura-de-despliegue-y-topología-de-servicios-api--web)
2. [Configuración de Entornos y Gestión de Variables (.env)](#2-configuración-de-entornos-y-gestión-de-variables-env)
3. [Contenedorización con Docker (Multi-Stage Build)](#3-contenedorización-con-docker-multi-stage-build)
4. [Orquestación con Docker Compose (Local vs. Producción)](#4-orquestación-con-docker-compose-local-vs-producción)
5. [Contrato de Interoperabilidad y Catálogo de Endpoints de la API](#5-contrato-de-interoperabilidad-y-catálogo-de-endpoints-de-la-api)
6. [Pipeline de Integración y Entrega Continua (CI/CD)](#6-pipeline-de-integración-y-entrega-continua-cicd)
7. [Operación y Mantenimiento de Base de Datos (PostGIS + Kysely)](#7-operación-y-mantenimiento-de-base-de-datos-postgis--kysely)
8. [Monitoreo, Telemetría y Diagnóstico Operativo](#8-monitoreo-telemetría-y-diagnóstico-operativo)
9. [Matrices Consolidadas de Referencia Operativa](#9-matrices-consolidadas-de-referencia-operativa)

---

## 1. Arquitectura de Despliegue y Topología de Servicios (API + Web)

### 1.1 Componentes del Sistema: Monolito Backend y Frontend Web
El Sistema de Gestión de Recursos para Atención de Incidentes (SGRAI) opera como una plataforma modular desacoplada en dos servicios principales contenerizados:

1. **`sgrai-api` (Backend Monolítico Modular):**  
   Concentra toda la lógica de negocio, validaciones territoriales, reglas de despacho, cálculo de disponibilidad de cuadrillas y persistencia de datos. Expone una API REST y un canal de WebSockets (Socket.io) sobre una base de datos relacional PostgreSQL con extensión espacial PostGIS y una caché Redis.
2. **`sgrai-web` (Plataforma Web de Escritorio):**  
   Cliente de presentación en Next.js (React 19) que agrupa todos los roles que interactúan desde navegadores de escritorio:
   - **Portal Informante:** Reporte ciudadano guiado y seguimiento público sin autenticación.
   - **Centro Call Center:** Recepción, filtrado y formalización manual de alertas telefónicas (14XX).
   - **Centro de Mando (Encargado):** Tablero Kanban táctico, mapa cartográfico interactivo (Leaflet), despacho de patrullas/cuadrillas y eventos preventivos (ATP).
   - **Dashboard Estratégico (Supervisor):** Indicadores de gestión, consulta de inventario y reportería SENAPRED.
   - **Panel Administrador:** Catastro de puntos críticos, gestión de personal y seguridad RBAC.
   - **Panel Asistente Social:** Fichas Básicas de Emergencia (FIBE) y asistencia social prioritaria.

> **Regla de Arquitectura:** `sgrai-web` no posee lógica de negocio propia; consume exclusivamente `sgrai-api` vía HTTPS/REST (`openapi-fetch`) y Socket.io para sincronización cartográfica en vivo.

### 1.2 Topología Docker Conjunta y Red Compartida (`red_taller_software`)
Ambos servicios y sus dependencias se orquestan en contenedores Docker comunicados mediante una red bridge compartida:

```text
================ [ RED DOCKER COMPARTIDA: red_taller_software ] ===================
           |                                                  |
           | /api/* y /socket.io/*                            | /* (Vistas Web)
           v                                                  v
+-------------------------------+             +----------------------------------+
|  grupo1_backend               |             |  grupo1_frontend                 |
|  Next.js + Socket.io (:4001)  |             |  Next.js Standalone (:3001)      |
+-------------------------------+             +----------------------------------+
     | (Kysely SQL)      | (ioredis)
     v                   v
+-------------------+  +-------------------+
|  grupo1_postgres  |  |  grupo1_redis     |
|  PostGIS 16 (:5432)|  |  Redis 7 (:6379)  |
+-------------------+  +-------------------+
===================================================================================
```

- **Punto de Entrada Institucional:** Cualquier reverse proxy externo (ej. Caddy o balanceador municipal) enruta el tráfico hacia la red Docker: peticiones `/api/*` y `/socket.io/*` a `grupo1_backend:4001` y rutas web `/*` a `grupo1_frontend:3001`.
- **Aislamiento Interno:** Los contenedores `grupo1_postgres` y `grupo1_redis` operan exclusivamente dentro de la red privada, inaccesibles desde el exterior.

---

## 2. Configuración de Entornos y Gestión de Variables (.env)

Toda la configuración se gestiona mediante variables de entorno bajo los principios de Twelve-Factor App. En desarrollo local se utilizan archivos `.env.local` y en producción un único archivo `.env` en el host.

### 2.1 Variables del Backend (`sgrai-api`)

```bash
# Conexión a Base de Datos (en Docker de servidor se usa el nombre del contenedor)
DATABASE_URL=postgresql://sgrai:sgrai_secret_2026@grupo1_postgres:5432/sgrai

# Memoria Caché y Mensajería Redis
REDIS_URL=redis://grupo1_redis:6379

# Puerto de Escucha HTTP y WebSockets
PORT=4001
NODE_ENV=production

# Seguridad y Firma Criptográfica JWT (mínimo 32 caracteres)
JWT_SECRET=super-secreto-seguridad-sgrai-valdivia-2026-min-32-chars
JWT_EXPIRES_IN=8h
AUTH_MAX_FAILED_ATTEMPTS=5
AUTH_LOCKOUT_MINUTES=15

# Variables del contenedor PostgreSQL (Compose)
POSTGRES_USER=sgrai
POSTGRES_PASSWORD=sgrai_secret_2026
POSTGRES_DB=sgrai
```

### 2.2 Variables del Frontend (`sgrai-web`)

```bash
# URL base pública de la API REST (consumida por el navegador del cliente)
NEXT_PUBLIC_API_URL=https://sgrai.inf.uach.cl/api

# URL pública del servidor Socket.io para eventos de tiempo real
NEXT_PUBLIC_SOCKET_URL=https://sgrai.inf.uach.cl

# Teléfono municipal de emergencias (botón de pánico del Informante)
NEXT_PUBLIC_EMERGENCY_PHONE=1451

# Puerto interno en contenedor de producción (en compose server se fija en 3001)
PORT=3001

# Enlaces institucionales oficiales
NEXT_PUBLIC_NEWS_URL=https://munivaldivia.cl/noticias/
NEXT_PUBLIC_FACEBOOK_URL=https://www.facebook.com/municipalidaddevaldivia/
NEXT_PUBLIC_X_URL=https://x.com/munivaldivia
NEXT_PUBLIC_INSTAGRAM_URL=https://www.instagram.com/munivaldivia/
```

---

## 3. Contenedorización con Docker (Multi-Stage Build)

Ambos repositorios implementan compilación multi-etapa sobre `node:24-alpine` para minimizar el tamaño de las imágenes y ejecutar procesos con usuarios no root (`UID 1001`).

### 3.1 Comparativa de Arquitectura de Contenedores

| Característica | `sgrai-api` (`grupo1_backend`) | `sgrai-web` (`grupo1_frontend`) |
|---|---|---|
| **Imagen Base** | `node:24-alpine` | `node:24-alpine` |
| **Etapas de Build** | `deps` &rarr; `builder` &rarr; `runner` | `deps` &rarr; `builder` &rarr; `runner` |
| **Punto de Arranque** | Servidor custom TSX: `npx tsx src/server.ts` | Servidor standalone: `node server.js` |
| **Puerto Expuesto** | `4001` (HTTP REST + Socket.io unificados) | `3000` (local) / `3001` (servidor) |
| **Build Arguments** | Ninguno (configuración 100% en runtime) | `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SOCKET_URL` |
| **Usuario de Ejecución**| `nextjs:nodejs` (UID/GID 1001) | `nextjs:nodejs` (UID/GID 1001) |

### 3.2 Peculiaridades Operativas de Runtime
- **Backend Híbrido:** `sgrai-api` requiere `tsx` en el contenedor para ejecutar `src/server.ts`, permitiendo inicializar Next.js programáticamente y montar el servidor de WebSockets en el mismo puerto HTTP 4001.
- **Frontend Standalone:** `sgrai-web` compila mediante `output: 'standalone'` en Next.js, copiando únicamente los bundles necesarios y la carpeta `./public` al contenedor de producción.

---

## 4. Orquestación con Docker Compose (Local vs. Producción)

El despliegue se organiza en dos configuraciones según el entorno operativo:

### 4.1 Entorno de Desarrollo Local (`docker-compose.yml`)
Diseñado para compilar el código fuente localmente y exponer puertos directamente al host para facilitar la depuración con herramientas como DBeaver, Postman o RedisInsight:

```bash
# 1. Levantar base de datos y caché en segundo plano
docker compose up -d postgres redis

# 2. Ejecutar migraciones y semillas
npm run db:migrate && npm run seed

# 3. Levantar la API y la Web
docker compose up -d
```

- **Mapeo de Puertos al Host:**
  - `grupo1_backend`: `4001:4001`
  - `grupo1_frontend`: `3000:3000`
  - `grupo1_postgres`: `5001:5432`
  - `grupo1_redis`: `6001:6379`

### 4.2 Servidor de Producción On-Premise (`docker-compose.server.yml`)
En producción, los servicios consumen imágenes inmutables publicadas en GitHub Container Registry (GHCR) sin publicar puertos al host:

```bash
# 1. Asegurar la existencia de la red Docker compartida
docker network inspect red_taller_software >/dev/null 2>&1 || docker network create red_taller_software

# 2. Descargar las imágenes oficiales publicadas
docker compose -f docker-compose.server.yml pull

# 3. Iniciar los contenedores en segundo plano
docker compose -f docker-compose.server.yml up -d --remove-orphans

# 4. Verificar salud operativa
docker compose -f docker-compose.server.yml ps
```

- **Imágenes consumidas:**
  - `ghcr.io/sgrai-uach/api:${IMAGE_TAG:-develop}`
  - `ghcr.io/sgrai-uach/web:${IMAGE_TAG:-develop}`

---

## 5. Contrato de Interoperabilidad y Catálogo de Endpoints de la API

### 5.1 Generación Automática de Tipos en `sgrai-web`
Para garantizar que el frontend y el backend nunca diverjan en sus tipos de datos, `sgrai-api` publica automáticamente su especificación OpenAPI en `/openapi.json` generada desde esquemas Zod. 

En `sgrai-web`, los desarrolladores ejecutan:
```bash
npm run generate-api-types
```
Este script invoca `openapi-typescript` apuntando a `${API_SPEC_URL:-http://localhost:3001/openapi.json}` y genera de forma automática el archivo `src/types/api-generated.d.ts`, alimentando el cliente tipado `openapi-fetch`.

### 5.2 Catálogo Consolidado de Endpoints de la API REST (42 Endpoints)

#### A. Infraestructura y Salud
| Método | Ruta Canónica | Autenticación | Propósito Operativo | Códigos HTTP |
|---|---|---|---|---|
| `GET` | `/api/health` | Pública | Sondeo de salud del backend para sondas Docker. | `200`, `503` |
| `GET` | `/openapi.json` | Pública | Especificación OpenAPI 3.0 auto-generada desde esquemas Zod. | `200` |

#### B. Seguridad y Control de Acceso (RBAC)
| Método | Ruta Canónica | Autenticación | Propósito Operativo | Códigos HTTP |
|---|---|---|---|---|
| `POST` | `/api/seguridad/login` | Pública | Autenticación institucional por RUT/Email; emisión de token JWT. | `200`, `400`, `401`, `423` |
| `GET` | `/api/seguridad/usuario-activo` | JWT Bearer | Consulta de sesión activa, rol y permisos del usuario conectado. | `200`, `401` |
| `GET` | `/api/seguridad/roles` | JWT Bearer | Nómina completa de roles institucionales configurados. | `200`, `401`, `403` |
| `GET` | `/api/seguridad/roles/{id}` | JWT Bearer | Detalle de rol y matriz granular de permisos asignados. | `200`, `401`, `403`, `404` |
| `GET` | `/api/seguridad/permisos` | JWT Bearer | Catálogo maestro de permisos granulares del sistema. | `200`, `401`, `403` |
| `PUT` | `/api/seguridad/roles/{id}/permisos` | JWT (`roles:admin`) | Modificación granular de permisos asignados a un rol. | `200`, `400`, `401`, `403`, `404` |

#### C. Incidentes, Avisos Ciudadanos y Cartografía
| Método | Ruta Canónica | Autenticación | Propósito Operativo | Códigos HTTP |
|---|---|---|---|---|
| `GET` | `/api/incidentes/avisos` | JWT Bearer | Bandeja de avisos del Call Center con filtros por URL. | `200`, `401`, `403` |
| `POST` | `/api/incidentes/avisos` | Pública | Reporte ciudadano de emergencia con georreferenciación WGS84. | `201`, `400` |
| `GET` | `/api/incidentes/avisos/{id}` | JWT Bearer | Ficha técnica de aviso ciudadano con adjuntos multimedia. | `200`, `401`, `404` |
| `POST` | `/api/incidentes/avisos/{id}/verificar` | JWT (`avisos:verificar`) | Aprobación de aviso y elevación a incidente táctico formal. | `200`, `401`, `403`, `404`, `409` |
| `POST` | `/api/incidentes/avisos/{id}/descartar` | JWT (`avisos:descartar`) | Descarte formal justificado de aviso con motivo obligatorio. | `200`, `400`, `401`, `403`, `404` |
| `GET` | `/api/incidentes/avisos/seguimiento/{codigo}` | Pública | Consulta pública del avance de aviso mediante código único. | `200`, `404` |
| `POST` | `/api/incidentes/manual` | JWT (`incidentes:crear`) | Ingreso manual directo de incidente por operador de turno. | `201`, `400`, `401`, `403` |
| `POST` | `/api/incidentes/verificar-duplicado` | JWT Bearer | Detección espacial de proximidad para alertar duplicados. | `200`, `400`, `401` |
| `GET` | `/api/incidentes/tipos` | Pública / JWT | Catálogo oficial de tipologías de incidentes y factores de riesgo. | `200` |
| `GET` | `/api/incidentes` | JWT Bearer | Listado táctico para tablero Kanban y mapa interactivo. | `200`, `401`, `403` |
| `GET` | `/api/incidentes/{id}` | JWT Bearer | Expediente completo de incidente con misiones y recursos. | `200`, `401`, `404` |
| `GET` | `/api/incidentes/kpis` | JWT (`incidentes:kpis`) | Métricas consolidadas de gestión para el Encargado de Mando. | `200`, `401`, `403` |

#### D. Operaciones Tácticas y Misiones
| Método | Ruta Canónica | Autenticación | Propósito Operativo | Códigos HTTP |
|---|---|---|---|---|
| `GET` | `/api/misiones` | JWT Bearer | Listado de misiones asignadas a patrullas y cuadrillas. | `200`, `401`, `403` |
| `GET` | `/api/misiones/{id}` | JWT Bearer | Detalle técnico de misión, bitácora y cuadrilla asignada. | `200`, `401`, `404` |

#### E. Recursos Logísticos y Personal Municipal
| Método | Ruta Canónica | Autenticación | Propósito Operativo | Códigos HTTP |
|---|---|---|---|---|
| `GET` | `/api/recursos` | JWT Bearer | Inventario logístico de insumos, herramientas y maquinaria. | `200`, `401`, `403` |
| `POST` | `/api/recursos` | JWT (`recursos:crear`) | Alta de nuevo recurso material en bodega municipal. | `201`, `400`, `401`, `403` |
| `GET` | `/api/recursos/{id}` | JWT Bearer | Ficha técnica de existencias, stock en uso y disponibilidad. | `200`, `401`, `404` |
| `PUT` | `/api/recursos/{id}` | JWT (`recursos:editar`) | Modificación de stock o datos de recurso logístico. | `200`, `400`, `401`, `403`, `404` |
| `DELETE` | `/api/recursos/{id}` | JWT (`recursos:eliminar`)| Baja lógica de recurso municipal. | `200`, `401`, `403`, `404`, `409` |
| `GET` | `/api/personal` | JWT Bearer | Nómina de personal municipal, operadores y brigadistas. | `200`, `401`, `403` |
| `POST` | `/api/personal` | JWT (`personal:crear`) | Registro de nuevo funcionario y vinculación a delegación. | `201`, `400`, `401`, `403` |
| `GET` | `/api/personal/{id}` | JWT Bearer | Ficha de funcionario con rol institucional y cuadrilla. | `200`, `401`, `404` |
| `PATCH` | `/api/personal/{id}` | JWT (`personal:editar`)| Edición parcial de datos o estado de funcionario. | `200`, `400`, `401`, `403`, `404` |
| `DELETE` | `/api/personal/{id}` | JWT (`personal:eliminar`)| Desactivación de funcionario en el sistema. | `200`, `401`, `403`, `404` |

#### F. Puntos Críticos y Prevención Territorial (ATP)
| Método | Ruta Canónica | Autenticación | Propósito Operativo | Códigos HTTP |
|---|---|---|---|---|
| `GET` | `/api/puntos-criticos` | JWT Bearer | Catastro de sectores vulnerables con coordenadas y radio. | `200`, `401`, `403` |
| `POST` | `/api/puntos-criticos` | JWT (`puntos_criticos:crear`) | Alta guiada de punto crítico con correlativo automático. | `201`, `400`, `401`, `403` |
| `GET` | `/api/puntos-criticos/{id}` | JWT Bearer | Detalle de punto crítico, amenaza y radio de afectación. | `200`, `401`, `404` |
| `PUT` | `/api/puntos-criticos/{id}` | JWT (`puntos_criticos:editar`) | Actualización de prioridad, amenaza o georreferenciación. | `200`, `400`, `401`, `403`, `404` |
| `DELETE` | `/api/puntos-criticos/{id}` | JWT (`puntos_criticos:eliminar`) | Baja lógica de punto crítico catastrado. | `200`, `401`, `403`, `404` |
| `POST` | `/api/eventos-atp/prevencion` | JWT (`eventos_atp:crear`) | Despacho preventivo y mitigación sin requerir incidente previo. | `201`, `400`, `401`, `403` |

#### G. Recuperación y Asistencia Social (FIBE)
| Método | Ruta Canónica | Autenticación | Propósito Operativo | Códigos HTTP |
|---|---|---|---|---|
| `POST` | `/api/eventos-atp/recuperacion` | JWT (`eventos_atp:crear`) | Evento de recuperación y despacho de insumos/cuadrillas. | `201`, `400`, `401`, `403` |
| `GET` | `/api/eventos-atp/asistencia-social` | JWT (`asistencia_social:leer`) | Listado de casos sociales para levantamiento de ficha FIBE. | `200`, `401`, `403` |
| `POST` | `/api/eventos-atp/asistencia-social` | JWT (`asistencia_social:crear`) | Registro prioritario de caso social con correlativo anual. | `201`, `400`, `401`, `403` |

#### H. Catálogos Maestros
| Método | Ruta Canónica | Autenticación | Propósito Operativo | Códigos HTTP |
|---|---|---|---|---|
| `GET` | `/api/catalogos` | Pública / JWT | Catálogo maestro de delegaciones territoriales, estados y prioridades. | `200` |

---

## 6. Pipeline de Integración y Entrega Continua (CI/CD)

Ambos proyectos automatizan su integración continua mediante GitHub Actions, compilando con Docker Buildx y publicando imágenes en GitHub Container Registry (GHCR).

### 6.1 Esquema de Pipelines en GitHub Actions
- **`sgrai-api` (`.github/workflows/build.yml`):**  
  Publica en `ghcr.io/sgrai-uach/api`. No utiliza build args de frontend.
- **`sgrai-web` (`.github/workflows/build.yml`):**  
  Publica en `ghcr.io/sgrai-uach/web`. Inyecta `NEXT_PUBLIC_API_URL` y `NEXT_PUBLIC_SOCKET_URL` mediante variables del repositorio (`vars.*`).

### 6.2 Estrategia de Versionado y Etiquetas (Tags)
- Rama `main` &rarr; Etiquetas `latest` y `stable`.
- Rama `develop` &rarr; Etiqueta `develop`.
- Commits &rarr; Etiqueta `sha-{hash}` para rollbacks deterministas.

### 6.3 Procedimiento Unificado de Despliegue en Servidor

```bash
# 1. Ingresar al directorio de infraestructura
cd /srv/sgrai

# 2. Descargar las imágenes más recientes de ambos servicios
docker compose -f api/docker-compose.server.yml pull
docker compose -f web/docker-compose.server.yml pull

# 3. Recrear los contenedores actualizados
docker compose -f api/docker-compose.server.yml up -d --remove-orphans
docker compose -f web/docker-compose.server.yml up -d --remove-orphans

# 4. Ejecutar migraciones pendientes de la API
docker exec -it grupo1_backend npx tsx src/lib/db/migrator.ts
```

---

## 7. Operación y Mantenimiento de Base de Datos (PostGIS + Kysely)

### 7.1 Migraciones y Semillas
- **Motor:** `postgis/postgis:16-3.4-alpine`, con tipos geométricos espaciales SRID 4326 (WGS84).
- **Ejecución de migraciones:** `npm run db:migrate` (gestión Kysely).
- **Semillas de inicio:** `npm run seed`, `npm run db:seed`, `npm run seed:puntos-criticos`.

### 7.2 Respaldos Lógicos y Restauración

```bash
# Generar respaldo binario comprimido con extensiones PostGIS
FECHA=$(date +%Y%m%d_%H%M%S)
docker exec -t grupo1_postgres pg_dump -U sgrai -d sgrai -Fc -Z 9 -f /tmp/sgrai_backup_${FECHA}.dump
docker cp grupo1_postgres:/tmp/sgrai_backup_${FECHA}.dump /srv/backups/

# Restauración ante contingencia
docker exec -i grupo1_postgres pg_restore -U sgrai -d sgrai --clean --if-exists /tmp/sgrai_backup_${FECHA}.dump
```

---

## 8. Monitoreo, Telemetría y Diagnóstico Operativo

```bash
# Inspección de logs en tiempo real
docker compose -f docker-compose.server.yml logs -f --tail=100 grupo1_backend
docker compose -f docker-compose.server.yml logs -f --tail=100 grupo1_frontend

# Estadísticas de uso de recursos
docker stats --no-stream
```

### Protocolo Rápido de Rollback
1. Configurar `IMAGE_TAG=sha-previo` en `.env`.
2. Re-desplegar: `docker compose -f docker-compose.server.yml up -d --force-recreate <servicio>`.
3. Validar estado con `docker compose -f docker-compose.server.yml ps`.

---

## 9. Matrices Consolidadas de Referencia Operativa

### 9.1 Matriz de Variables de Entorno (API + Web)
| Variable | Ámbito | Valor por Defecto / Ejemplo | Propósito Técnico |
|---|---|---|---|
| `DATABASE_URL` | `sgrai-api` | `postgresql://sgrai:clave@postgres:5432/sgrai` | Conexión Kysely a PostgreSQL espacial. |
| `REDIS_URL` | `sgrai-api` | `redis://redis:6379` | Instancia Redis para caché y mensajería. |
| `PORT` | `sgrai-api` | `4001` (Docker) / `3000` (Local) | Puerto TCP de escucha del servidor HTTP/Socket.io. |
| `JWT_SECRET` | `sgrai-api` | `<secreto_min_32_chars>` | Clave criptográfica para firmado de tokens JWT. |
| `JWT_EXPIRES_IN` | `sgrai-api` | `8h` | Duración de sesión de funcionarios. |
| `NEXT_PUBLIC_API_URL` | `sgrai-web` | `https://sgrai.inf.uach.cl/api` | Endpoint público de la API consumido por la Web. |
| `NEXT_PUBLIC_SOCKET_URL` | `sgrai-web` | `https://sgrai.inf.uach.cl` | Servidor WebSocket consumido por `socket.io-client`. |
| `NEXT_PUBLIC_EMERGENCY_PHONE`| `sgrai-web` | `1451` | Teléfono municipal de emergencias. |
| `PORT` | `sgrai-web` | `3001` (Servidor) / `3000` (Local) | Puerto de escucha de la plataforma web. |
| `IMAGE_TAG` | DevOps | `develop` / `latest` / `sha-*` | Tag de las imágenes en `docker-compose.server.yml`. |

### 9.2 Matriz de Servicios y Puertos en Docker
| Contenedor | Repositorio | Puerto Interno | Puerto Host (Dev) | Red Docker | Propósito |
|---|---|---|---|---|---|
| `grupo1_backend` | `sgrai-api` | `4001/TCP` | `4001:4001` | `red_taller_software` | API REST y WebSockets |
| `grupo1_frontend` | `sgrai-web` | `3001/TCP` | `3000:3000` | `red_taller_software` | UI Web y SSR Next.js |
| `grupo1_postgres` | `sgrai-api` | `5432/TCP` | `5001:5432` | `red_taller_software` | PostgreSQL 16 + PostGIS 3.4 |
| `grupo1_redis` | `sgrai-api` | `6379/TCP` | `6001:6379` | `red_taller_software` | Memoria caché y colas |

### 9.3 Guía Rápida de Mitigación de Incidentes
| Síntoma | Causa Probable | Mitigación Inmediata |
|---|---|---|
| **API caída o reiniciando** | Falla de inicio o dependencia de Postgres/Redis. | `docker compose -f docker-compose.server.yml restart grupo1_backend` |
| **Web no conecta con la API** | `NEXT_PUBLIC_API_URL` incorrecta o API inaccesible. | Verificar conectividad a `/api/health` y variable de entorno en frontend. |
| **Error Kysely de conexión** | Postgres aún inicializando o fallo en red Docker. | `docker exec grupo1_postgres pg_isready -U sgrai -d sgrai` |
| **Divergencia de tipos Web** | Endpoints modificados en API sin regenerar tipos. | Ejecutar en `sgrai-web`: `npm run generate-api-types` |
| **Disco lleno en host** | Capas de imágenes antiguas o logs acumulados. | `docker system prune -f && find /var/lib/docker/containers -name '*.log' -size +500M` |
| **Fallo tras actualización** | Regresión en la nueva versión desplegada. | Fijar `IMAGE_TAG=sha-previo` en `.env` y ejecutar `docker compose up -d` |

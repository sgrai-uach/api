# sgrai-api

Backend monolitico del Sistema de Gestion de Recursos para Atencion de Incidentes (SGRAI), desarrollado para la Direccion de Gestion de Riesgos de Desastres de la Municipalidad de Valdivia.

Este repositorio concentra toda la logica de negocio del sistema. Los clientes de presentacion (`sgrai-web` y `sgrai-pwa`) consumen esta API exclusivamente por HTTPS/REST y Socket.io, sin implementar logica de negocio propia.

---

## Stack tecnologico

| Componente | Tecnologia |
|---|---|
| Framework | Next.js (API Routes / Route Handlers) con TypeScript |
| Base de datos | PostgreSQL con extension PostGIS (datos espaciales) |
| Query builder | Kysely |
| Validacion | Zod |
| Cache y colas | Redis (ioredis) |
| Tiempo real | Socket.io |
| Especificacion API | OpenAPI generado automaticamente desde Zod (zod-to-openapi) |
| Infraestructura | Docker + Docker Compose, Caddy como reverse proxy |

---

## Requisitos previos

- Node.js 20 o superior
- npm
- Docker y Docker Compose (para levantar PostgreSQL y Redis)

---

## Inicio rapido

1. Clonar el repositorio:

```bash
git clone git@github.com:sgrai-uach/api.git
cd api
```

2. Instalar dependencias:

```bash
npm install
```

3. Configurar variables de entorno:

```bash
cp .env.example .env.local
```

Editar `.env.local` con los valores correspondientes al entorno local.

4. Levantar servicios de infraestructura (PostgreSQL + Redis):

```bash
docker compose up -d postgres redis
```

5. Iniciar el servidor de desarrollo:

```bash
npm run dev
```

El servidor estara disponible en `http://localhost:3000`. Verificar con `GET /api/health`.

---

## Estructura del proyecto

```
src/
  app/
    api/
      health/route.ts         Endpoint de health check
  lib/
    db/                       Configuracion de Kysely (PostgreSQL + PostGIS)
    redis/                    Configuracion de ioredis
    socket/                   Configuracion de Socket.io
    openapi/                  Generacion del spec OpenAPI desde Zod
  modules/
    incidentes/               Registro, clasificacion y gestion de incidentes
    misiones/                 Asignacion de misiones, bitacora, informes finales
    recursos-y-personal/      Gestion de recursos, personal, cuadrillas y delegaciones
    eventos-atp/              Eventos de recuperacion, prevencion y asistencia social
    evidencia/                Adjuntos y reportes de terreno
    notificaciones/           Envio de notificaciones
    geolocalizacion/          Ubicacion y mapa interactivo
    seguridad/                Autenticacion, roles, permisos e informantes
    reporteria-y-analitica/   Informes y estadisticas (incluye Informe Alfa 37G)
docs/
  api/                        Documentacion tecnica de la API por modulo
```

---

## Infraestructura con Docker

Para levantar todo el stack (API + PostgreSQL + Redis):

```bash
docker compose up --build
```

Para levantar solo los servicios de infraestructura durante desarrollo local:

```bash
docker compose up -d postgres redis
```

---

## Flujo de trabajo de desarrollo

- **Ramas:** Gitflow (`main`, `develop`, `feature/*`, `release/*`, `hotfix/*`).
- **Versionado:** SemVer.
- **Commits:** Conventional Commits.
- **Integracion:** toda funcionalidad nace en una rama `feature/*` desde `develop`, pasa por PR con Pair Review y PO Review obligatorias antes de merge.

---

## Contrato con los frontends

Los clientes `sgrai-web` y `sgrai-pwa` dependen de esta API. El contrato se mantiene mediante:

1. Esquemas Zod en cada endpoint que validan request/response.
2. Spec OpenAPI generado automaticamente desde esos esquemas.
3. El spec se expone en `GET /openapi.json` para que los frontends generen tipos automaticamente.

Cualquier cambio breaking requiere coordinacion explicita con los equipos de frontend antes de mergear.

---

## Documentacion de la API

La documentacion tecnica de cada modulo se encuentra en `docs/api/`. Se crea y actualiza como parte del mismo PR que agrega o modifica endpoints.

---

## Licencia

Uso interno. Municipalidad de Valdivia -- Direccion de Gestion de Riesgos de Desastres.

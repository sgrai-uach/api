# Guía de Handover Técnico para Frontend (`sgrai-web` / `sgrai-pwa`): Detalle de Misión (HU-17)

> **Destinatario:** Equipo de desarrollo frontend (`sgrai-web` y `sgrai-pwa`) y Asistente IA.  
> **Origen:** Backend monolítico modular `sgrai-api` (`feature/H17-detalle-mision`).  
> **Especificación OpenAPI:** `GET http://localhost:3000/openapi.json` (o puerto activo).  
> **Endpoint:** `GET /api/misiones/{id}`.

---

## 1. Contexto de la Historia de Usuario y Criterios de Aceptación Frontend

### Historia de Usuario
> **Como** Encargado  
> **Quiero** desplegar información específica de cada misión con un botón  
> **Para** poder analizar el incidente al detalle a cada momento.

### Criterios de Aceptación a Implementar en el Frontend:
1. **Botón de Acción en Filas/Tarjetas de Misión:**
   - En el listado o panel de misiones (y en las tarjetas del tablero Kanban del Encargado), incluir un botón claramente visible: **"Ver Detalles"** (o ícono de ojo/inspección).
2. **Despliegue sin Pérdida de Contexto:**
   - Al hacer clic, desplegar la vista detallada en un **Modal** o **Panel Lateral (Drawer / Sheet)** para que el usuario no pierda su posición ni filtros en el listado principal.
3. **Secciones Estructuradas en la Vista Detallada:**
   - **Incidente o Punto Preventivo Asociado:** Código (`INC-XXXX`), tipo de emergencia, dirección, prioridad, estado y si requiere asistencia social (`requiereAsistenciaSocial`). Si es misión de prevención sin incidente formal, mostrar el punto crítico (`prevencion`).
   - **Equipo Asignado:** Nombre de la cuadrilla (con delegado y recursos materiales/vehículos asignados) o patrulla verificadora (con líder).
   - **Estado Actual y Prioridad de la Misión:** Badges con colores semánticos (`PLANIFICADA`, `DESPACHADA`, `EN_CURSO`, `COMPLETADA`, `CANCELADA`, `RECHAZADA`). Si fue rechazada, mostrar la justificación de rechazo (`justificacionRechazo`).
   - **Bitácora de Tiempos:** Lista cronológica con fecha (`YYYY-MM-DD`) y hora (`HH:MM:SS`) de hitos como creación, despacho/inicio, cierre o última actualización.
   - **Reportes de Terreno:** Diagnóstico técnico (`resumenTecnico`), acciones ejecutadas (`accionesRealizadas`), daños estimados, personas afectadas y funcionario evaluador.
4. **Previsualización de Evidencia Multimedia (Galería / Visor):**
   - Para cada reporte de terreno, mostrar miniaturas clicables de los archivos adjuntos (`fotos/videos/documentos`).
   - Al pulsar una imagen, abrir un visor ampliado (lightbox o modal de imagen).
5. **Manejo de Estados Vacíos (*Empty State*):**
   - Si la misión aún no tiene reportes de terreno (`reportesTerreno: []`), desplegar un contenedor amigable con el mensaje: **"Sin reportes aún"** (ej. *"La unidad aún no ha emitido informes técnicos en terreno"*).
   - Si un reporte no tiene archivos adjuntos (`adjuntos: []`), indicar amigablemente *"Sin evidencias fotográficas adjuntas"*.
6. **Diseño Responsivo:**
   - Adaptable tanto a pantallas de escritorio (panel de Encargado en `sgrai-web`) como a pantallas móviles o tablets en terreno (`sgrai-pwa`).

---

## 2. Contrato de API y Autenticación RBAC

### Endpoint
```http
GET /api/misiones/{id}
```

### Cabeceras (Headers)
| Cabecera | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `X-User-Id` | UUID | Sí | ID del usuario autenticado. Debe poseer rol de `ENCARGADO`, `ADMIN` o `SUPERVISOR` (permiso `misiones:leer`). |

### Usuarios de Prueba Sembrados en Base de Datos

| Perfil | UUID (`X-User-Id`) | Email | Acceso al Detalle |
|---|---|---|---|
| **Encargado de Operaciones** | `00000000-0000-4000-8000-000000000003` | `encargado@valdivia.cl` | **Permitido (`200 OK`)** |
| **Administrador General** | `00000000-0000-4000-8000-000000000001` | `admin@valdivia.cl` | **Permitido (`200 OK`)** |
| **Operador Call Center** | `00000000-0000-4000-8000-000000000002` | `callcenter@valdivia.cl` | **Denegado (`403 Forbidden`)** |

---

## 3. Tipos TypeScript Recomendados para el Frontend

Puedes importar estos tipos o generarlos automáticamente desde `GET /openapi.json`:

```typescript
export interface AdjuntoEvidencia {
  id: string;
  nombreArchivo: string;
  url: string;
  tipoMime: string;
  tamanoBytes: number;
  creadoEn: string;
}

export interface EvaluadorTerreno {
  id: string;
  nombre: string;
  email: string;
  rut?: string | null;
}

export interface ReporteTerrenoDetalle {
  id: string;
  misionId: string;
  evaluador: EvaluadorTerreno;
  resumenTecnico: string;
  accionesRealizadas: string | null;
  requiereApoyoAdicional: boolean;
  danosEstimados: string | null;
  observaciones: string | null;
  personasAfectadas: number;
  estadoTerreno: string;
  adjuntos: AdjuntoEvidencia[];
  creadoEn: string;
  actualizadoEn: string;
}

export interface MisionBitacoraHito {
  hito: string;
  fecha: string;
  hora: string;
  timestamp: string;
  descripcion: string;
}

export interface IncidenteMisionResumen {
  id: string;
  codigo: string;
  codigoSeguimiento: string;
  tipoAfectacion: string;
  descripcion: string | null;
  direccion: string;
  latitud: number;
  longitud: number;
  estado: string;
  prioridad: string;
  requiereAsistenciaSocial: boolean;
  delegacionNombre: string | null;
}

export interface PrevencionMisionResumen {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  latitud: number;
  longitud: number;
  delegacionNombre: string | null;
}

export interface RecursoAsignadoMision {
  id: string;
  nombre: string;
  tipo: string;
  cantidadAsignada: number;
}

export interface CuadrillaMisionDetalle {
  id: string;
  nombre: string;
  estado: string;
  delegacionNombre: string | null;
  delegado: {
    id: string;
    nombre: string;
    email: string;
  } | null;
  recursos: RecursoAsignadoMision[];
}

export interface PatrullaMisionDetalle {
  id: string;
  nombre: string;
  estado: string;
  delegacionNombre: string | null;
  lider: {
    id: string;
    nombre: string;
    email: string;
  } | null;
}

export interface MisionDetalleCompleto {
  id: string;
  codigo: string;
  titulo: string;
  descripcion: string | null;
  tipoMision: "VERIFICACION" | "ATENCION_CUADRILLA" | "PREVENCION" | "RECUPERACION" | "ASISTENCIA_SOCIAL";
  estado: "PLANIFICADA" | "DESPACHADA" | "EN_CURSO" | "COMPLETADA" | "CANCELADA" | "RECHAZADA";
  prioridad: "BAJA" | "MEDIA" | "ALTA" | "CRITICA";
  justificacionRechazo: string | null;
  fechaInicio: string | null;
  fechaCierre: string | null;
  creadoEn: string;
  actualizadoEn: string;
  creadoPor: { id: string; nombre: string; email: string } | null;
  encargado: { id: string; nombre: string; email: string } | null;
  incidente: IncidenteMisionResumen | null;
  prevencion: PrevencionMisionResumen | null;
  cuadrilla: CuadrillaMisionDetalle | null;
  patrulla: PatrullaMisionDetalle | null;
  bitacoraTiempos: MisionBitacoraHito[];
  reportesTerreno: ReporteTerrenoDetalle[];
}

export interface MisionDetalleResponse {
  message: string;
  data: MisionDetalleCompleto;
}
```

---

## 4. Resolución de Multimedia bajo Caddy (On-Premise)

La API devuelve URLs relativas normalizadas (ejemplo: `/uploads/evidencia/foto_1.jpg`).

En el frontend:
- Si la aplicación y la API operan bajo el mismo host a través del reverse proxy Caddy (ej. `http://sgrai.local/api` y `http://sgrai.local/uploads`), basta con usar la URL directa: `<img src={adjunto.url} alt={adjunto.nombreArchivo} />`.
- Si estás en desarrollo local con puertos separados (Frontend en `:3000`, API en `:3001`):
  ```typescript
  const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
  const mediaUrl = adjunto.url.startsWith("http") ? adjunto.url : `${API_BASE}${adjunto.url}`;
  ```

---

## 5. Estados de Carga y Manejo de Errores

- **Carga (`isLoading`):** Renderizar *Skeleton Loader* mientras se resuelve la petición GET al abrir el Drawer o Modal.
- **Error 404:** Mostrar mensaje amigable: *"La misión solicitada no existe o fue eliminada"*.
- **Error 403:** Mostrar aviso: *"No tienes permisos de Encargado o Administrador para visualizar el detalle de esta misión"*.

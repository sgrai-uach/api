# Guía de Handover Técnico para Frontend (`sgrai-web`): Listado y Monitoreo de Puntos Críticos (HU-57)

> **Destinatario:** Equipo de desarrollo frontend (`sgrai-web`) y Asistente IA.  
> **Origen:** Backend monolítico modular `sgrai-api` (`feature/H57-listado-puntos-criticos`).  
> **Versión API:** `v0.7.0` (SemVer).  
> **Especificación OpenAPI:** `GET http://localhost:3000/openapi.json`.  
> **Ruta del Frontend Sugerida:** `/puntos-criticos` (o `app/(admin)/puntos-criticos/page.tsx`).

---

## 1. Contexto y Objetivos de la Historia de Usuario

### Historia de Usuario
> **Como** Administrador  
> **Quiero** visualizar un listado de los puntos críticos  
> **Para** monitorear el estado e información de estos.

### Criterios de Aceptación a Implementar en `sgrai-web`:
1. **Acceso a la vista y tabla completa:**
   - La plataforma web debe desplegar una tabla responsiva con los puntos críticos y sectores vulnerables almacenados en la base de datos municipal de Valdivia.
2. **Columnas de información esencial desplegadas:**
   - **Identificador / Código:** Código único institucional (ej. `PC-ANG-01`).
   - **Nombre / Sector:** Nombre descriptivo del sector monitoreado (ej. *Sector Humedal Angachilla*).
   - **Tipo de Riesgo:** Amenaza recurrente (ej. *Inundación y desborde*, *Remoción en masa*).
   - **Prioridad / Gravedad:** Badge de color (`BAJA`: gris/verde, `MEDIA`: amarillo, `ALTA`: naranja, `CRITICA`: rojo).
   - **Coordenadas / Ubicación:** Coordenadas latitud y longitud formateadas (`latitud`, `longitud`).
   - **Delegación Asociada:** Nombre de la delegación territorial correspondiente (*Norte, Sur, Costa o Calle Calle*), o *"Central Comunal"* si no tiene asignada.
   - **Estado Actual:** Badge legible con `estadoTexto` (*"Activo"* o *"Inactivo"*).
3. **Manejo de Lista Vacía (Empty State):**
   - Si no existen puntos críticos registrados (o los filtros devuelven 0 resultados), mostrar un componente visual claro indicando: **"No hay puntos críticos registrados"**.
4. **Control de Acceso (RBAC):**
   - La vista y la llamada a la API son exclusivas para el rol **Administrador**. Si un usuario sin este rol intenta acceder, el frontend debe mostrar la pantalla o alerta de acceso restringido (`403 Forbidden`).

---

## 2. Contrato de API y Consumo HTTP

### Dirección Base y Cabeceras
La API corre por defecto en:
```
http://localhost:3000
```
(o `http://localhost:3001` si el frontend utiliza el puerto 3000).

Todas las peticiones deben incluir la cabecera de autenticación con el identificador del usuario:
```http
X-User-Id: <UUID-DEL-USUARIO>
```
*(O alternativamente: `Authorization: Bearer <UUID-DEL-USUARIO>`)*.

### Usuarios de Prueba Sembrados en Base de Datos

| Perfil | UUID (`X-User-Id`) | Email | Acceso al Listado |
|---|---|---|---|
| **Administrador General** | `00000000-0000-4000-8000-000000000001` | `admin@valdivia.cl` | **Permitido (`200 OK`)** |
| **Operador Call Center** | `00000000-0000-4000-8000-000000000002` | `callcenter@valdivia.cl` | **Denegado (`403 Forbidden`)** |

---

## 3. Endpoint: `GET /api/puntos-criticos`

### Parámetros de Consulta (Query Params)

| Parámetro | Tipo | Requerido | Default | Descripción |
|---|---|---|---|---|
| `pagina` | `number` | No | `1` | Número de página (inicia en 1). |
| `limite` | `number` | No | `10` | Cantidad de registros por página (máx. 100). |
| `delegacionId` | `UUID` | No | - | Filtrar por UUID de delegación territorial. |
| `activo` | `boolean` | No | - | `true` o `false`. |
| `prioridad` | `string` | No | - | `BAJA`, `MEDIA`, `ALTA`, `CRITICA`. |
| `busqueda` | `string` | No | - | Búsqueda por texto (código, nombre, tipo de riesgo, descripción). |

### Estructura de Respuesta Exitosa (`200 OK`)

```typescript
export interface PuntoCriticoItem {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  tipoRiesgo: string | null;
  prioridad: "BAJA" | "MEDIA" | "ALTA" | "CRITICA";
  activo: boolean;
  estadoTexto: "Activo" | "Inactivo";
  latitud: number;
  longitud: number;
  delegacion: {
    id: string;
    codigo: string;
    nombre: string;
  } | null;
  creadoEn: string;
}

export interface ListarPuntosCriticosResponse {
  data: PuntoCriticoItem[];
  meta: {
    total: number;
    pagina: number;
    limite: number;
    totalPaginas: number;
  };
}
```

### Respuestas de Error
* **`400 Bad Request`:** Parámetros de consulta no válidos.
* **`401 Unauthorized`:** Falta cabecera de autenticación `X-User-Id`.
* **`403 Forbidden`:** Usuario activo pero no posee rol `Administrador`.

# Documentación del Modelo de Datos y Base de Datos (SGRAI-API)

Este documento es la **fuente de verdad técnica y arquitectónica** de la base de datos relacional del Sistema de Gestión de Recursos para Atención de Incidentes (**SGRAI**), Dirección de Gestión de Riesgos de Desastres de la Ilustre Municipalidad de Valdivia.

> [!NOTE]
> **Para Asistentes de IA y Desarrolladores:**
> Toda consulta, migración, repositorio o servicio que interactúe con la base de datos debe adherirse estrictamente a las convenciones, nombres de tablas, columnas, tipos de datos, claves foráneas y enumerados documentados aquí.

---

## 1. Arquitectura y Stack de Persistencia

- **Motor de Base de Datos:** PostgreSQL 16 con extensión espacial **PostGIS 3.4** (EPSG:4326 WGS 84).
- **Capa de Acceso a Datos (DAL):** **Kysely** (Query Builder con tipado estricto en TypeScript). **No se utiliza ORM** (evitar Prisma, TypeORM, etc.).
- **Convenciones de Nombres:**
  - **Tablas:** Nombres canónicos en **minúsculas, singular y snake_case** (ej. `incidente`, `aviso_incidente`, `usuario`, `recurso`, `mision`).
  - **Vistas de compatibilidad:** Existen vistas en plural (`usuarios`, `roles`, `permisos`, `incidentes`, etc.) creadas por retrocompatibilidad con queries legadas, pero **el código nuevo debe consultar las tablas canónicas en singular**.
  - **Columnas:** En `snake_case` (ej. `tipo_afectacion`, `direccion_texto`, `creado_en`, `codigo_seguimiento`).
  - **Identificadores (PK):** UUID v4 generados automáticamente mediante `gen_random_uuid()`.
  - **Campos temporales:** `creado_en` y `actualizado_en` de tipo `TIMESTAMPTZ` con valor por defecto `CURRENT_TIMESTAMP`.
  - **Campos geoespaciales:** Columnas escalares `latitud` y `longitud` (tipo `NUMERIC(10, 7)`), acompañadas por la columna espacial `ubicacion` de tipo `GEOMETRY(Point, 4326)` e indexadas mediante índices espaciales **GiST**.

---

## 2. Modelo Entidad-Relación Maestro y Arquitectura Conceptual

### 2.1 Diagrama Entidad-Relación Original (SGRAI)

La fuente de verdad arquitectónica del sistema es el **Diagrama Entidad-Relación Maestro** desarrollado en el diseño fundacional del SGRAI para la Dirección de Gestión de Riesgos de Desastres de la Municipalidad de Valdivia.

- **Diagrama Gráfico Oficial (PNG):** [`Diagrama Entidad-Relación - SGRAI.png`](./Diagrama%20Entidad-Relación%20-%20SGRAI.png)
- **Modelo Fuente Editable (Draw.io):** [`Diagrama Entidad-Relación - SGRAI.drawio.png`](./Diagrama%20Entidad-Relación%20-%20SGRAI.drawio.png)

![Diagrama Entidad-Relación Maestro SGRAI](./Diagrama%20Entidad-Relación%20-%20SGRAI.png)

### 2.2 Entidades Fundacionales del Modelo (Concebidas desde el Inicio)

A diferencia de un sistema administrativo tradicional, el SGRAI fue modelado desde el inicio para dar cobertura al ciclo completo de atención de emergencias comunales conforme al **Sistema de Comando de Incidentes (ICS)**: prevención, recepción y triage, verificación en terreno, intervención pesada, bitácora de misión y recuperación / asistencia social:

1. **Incidentes, Informantes y Factores de Riesgo:**
   - **`Incidente`:** Núcleo operacional formal de la emergencia. Maneja ciclo de vida ICS (`REPORTADO`, `VERIFICANDO`, `EN_ATENCION`, `NO_ABORDABLE`, `RESUELTO`).
   - **`Informante`:** Registro del ciudadano que reporta la emergencia.
   - **`Chatbot`:** Interfaz conversacional directa e interactiva con el informante para la captura de reportes georreferenciados.
   - **`Fuente del incidente` (`fuente_incidente`):** Canal oficial de ingreso (`CHATBOT`, `LLAMADA_TELEFONICA`, `FUNCIONARIO_TERRENO`, `SENAPRED`).
   - **`Tipo Incidente` (`tipo_incidente`):** Catálogo estandarizado de tipologías (Inundación, Caída de árbol, Deslizamiento, Daño estructural, etc.).
   - **`Factores de Riesgo (Niveles)`:** Factores de criticidad y riesgo agravante asociados al incidente o sector (riesgo eléctrico, anegamiento domiciliario, electrodependientes, adultos mayores aislados).
   - **`Aviso Incidente` (`aviso_incidente`):** Bandeja de entrada preliminar para filtrado, deduplicación geoespacial y triage por Call Center antes de promover a incidente formal.
   - **`Adjunto` (`adjunto`):** Evidencia multimedia (fotografías, audios, documentos) vinculada a avisos, incidentes o reportes de terreno.

2. **Eventos Mayores, Prevención y Mitigación:**
   - **`EventoATP`:** Macro-eventos adversos, temporales o climáticos mayores que agrupan o provocan múltiples incidentes y movilizan capacidades comunales a gran escala.
   - **`Prevención` (Puntos Críticos):** Zonas identificadas de alto riesgo recurrente (quebradas, esteros, colectores de aguas lluvia) donde se programan misiones periódicas de mitigación sin requerir un incidente previo.

3. **Operaciones Tácticas y Despliegue en Terreno:**
   - **`Misión`:** Orden táctica de trabajo despachada a unidades de terreno. Conecta prevención, verificación, intervención y recuperación.
   - **`Patrulla Verificadora`:** Unidad ágil de terreno para triage y evaluación preliminar (queda liberada al escalar a cuadrilla).
   - **`Cuadrilla`:** Unidad táctica pesada con brigadistas y operarios municipales para resolver y mitigar la emergencia.
   - **`Recurso`:** Maquinaria pesada, motobombas, herramientas y vehículos inventariados.
   - **`Cuadrilla Recurso` (`cuadrilla_recurso`):** Asignación temporal de equipamiento e insumos a una cuadrilla para una misión.
   - **`Log de Misión` (`log_mision`):** Bitácora cronológica inmutable de avances, estados, tiempos de respuesta e hitos de la misión en terreno.
   - **`Reporte Terreno` (`reporte_terreno`):** Informe técnico consolidado levantado por la patrulla o cuadrilla al término o repliegue de la misión.

4. **Recuperación y Asistencia Social:**
   - **`Recuperación` (ex: Asistencia Social):** Fase posterior al control del evento crítico para tareas de normalización, despeje de escombros y apoyo a damnificados.
   - **`Beneficio`:** Asignación y entrega de subsidios, materiales de construcción, techumbres, canastas o ayudas de emergencia articuladas con DIDECO mediante la Ficha Básica de Emergencia (FIBE).

5. **Organización, Seguridad y Notificaciones:**
   - **`Delegación`:** Sede territorial operativa (Norte, Sur, Costa, Calle Calle).
   - **`Usuario`:** Cuenta de acceso institucional con credenciales y rol RBAC.
   - **`Personal`:** Ficha técnica y funcional del trabajador municipal (especialidad, estado operativo).
   - **`Rol` / `Permiso` / `RolPermiso`:** Matriz de control de acceso basada en roles.
   - **`Log Cambios Usuarios`:** Registro de auditoría de modificaciones a cuentas de usuario.
   - **`Notificaciones`:** Sistema de alertas push y eventos WebSocket en tiempo real hacia usuarios, encargados y brigadistas.

### 2.3 Matriz de Trazabilidad: Modelo Conceptual Maestro vs. Tablas Físicas Implementadas (Kysely)

| Entidad Original (ERD Maestro) | Tabla Física Kysely | Estado de Implementación | Módulo de Dominio | Descripción / Rol en el Sistema |
|---|---|---|---|---|
| **Usuario** | `usuario` | Migración 001 | Seguridad | Cuenta de acceso, rol y credenciales. |
| **Rol** | `rol` | Migración 001 | Seguridad | Roles RBAC del sistema. |
| **Permisos** | `permiso` | Migración 001 | Seguridad | Facultades y permisos granulares. |
| **RolPermiso** | `rol_permiso` | Migración 001 | Seguridad | Pivote N:M entre roles y permisos. |
| **Delegación** | `delegacion` | Migración 001 | Organización | 4 delegaciones comunales de Valdivia. |
| **Personal** | `personal` | Migración 002 | Operaciones | Ficha operativa 1:1 con usuario. |
| *(Auditoría)* | `log_cambios_usuarios` | Migración 002 | Seguridad | Traza histórica de cambios a usuarios. |
| **Informante** | `informante` | Migración 003 | Incidentes | Ciudadanos que reportan incidentes. |
| **Fuente del incidente** | `fuente_incidente` | Migración 003 | Incidentes | Canales de ingreso estandarizados. |
| **Tipo Incidente** | `tipo_incidente` | Migración 003 | Incidentes | Catálogo de tipos de emergencia. |
| *(Triage Call Center)* | `aviso_incidente` | Migración 003 | Incidentes | Bandeja de avisos preliminares y detección de duplicados. |
| **Incidente** | `incidente` | Migración 004 | Incidentes | Registro central formal bajo metodología ICS. |
| **Adjunto** | `adjunto` | Migración 004 / 011 | Evidencia | Archivos y fotos vinculadas a avisos, incidentes o reportes de terreno. |
| **Recurso** | `recurso` | Migración 005 | Recursos | Maquinaria, motobombas y vehículos. |
| **Patrulla Verificadora** | `patrulla_verificadora`| Migración 006 | Operaciones | Unidades tácticas de evaluación preliminar. |
| **Cuadrilla** | `cuadrilla` | Migración 006 | Operaciones | Unidades tácticas operativas de intervención. |
| *(Asignación Logística)* | `cuadrilla_recurso` | Migración 006 | Recursos | Asignación N:M de recursos a cuadrillas. |
| **Prevención (Puntos Críticos)**| `prevencion` | Migración 006 / 012 / 015 / 016 | Eventos ATP | Puntos críticos, factores de riesgo, edición (HU-55) y borrado lógico (HU-56). |
| **Misión** | `mision` | Migración 006 | Operaciones | Despacho y seguimiento táctico en terreno. |
| **Reporte Terreno** | `reporte_terreno` | Migración 011 | Evidencia / Misiones | Informe técnico estructurado y evolución tras intervención de patrulla/cuadrilla. |
| **EventoATP** | *`evento_atp`* | Hoja de Ruta (Roadmap) | Eventos ATP | Agrupación macro de incidentes / eventos climáticos mayores. |
| **Log de Misión** | *`log_mision`* | Hoja de Ruta (Roadmap) | Misiones | Bitácora cronológica detallada de hitos de misión. |
| **Recuperación** | *`recuperacion`* | Hoja de Ruta (Roadmap) | Asistencia Social | Puntos e intervenciones de recuperación post-emergencia. |
| **Beneficio** | *`beneficio`* | Hoja de Ruta (Roadmap) | Asistencia Social | Ayudas sociales entregadas a damnificados (FIBE / DIDECO). |
| **Factores de Riesgo (Niveles)**| *`factor_riesgo`* | Hoja de Ruta (Roadmap) | Incidentes | Parámetros de evaluación de riesgo y severidad. |
| **Notificaciones** | *`notificacion`* | Hoja de Ruta (Roadmap) | Notificaciones | Registro de notificaciones push / WebSocket generadas. |

### 2.4 Diagrama Entidad-Relación Integral (Mermaid)

El siguiente diagrama refleja la arquitectura relacional activa y su articulación con los módulos en desarrollo:

```mermaid
erDiagram
    DELEGACION ||--o{ USUARIO : "pertenece_a"
    DELEGACION ||--o{ PERSONAL : "asignado_a"
    DELEGACION ||--o{ PATRULLA_VERIFICADORA : "opera_en"
    DELEGACION ||--o{ CUADRILLA : "opera_en"
    DELEGACION ||--o{ RECURSO : "almacenado_en"
    DELEGACION ||--o{ INCIDENTE : "ocurre_en"
    DELEGACION ||--o{ PREVENCION : "situa_en"

    ROL ||--o{ USUARIO : "asigna_rol"
    ROL ||--o{ ROL_PERMISO : "contiene"
    PERMISO ||--o{ ROL_PERMISO : "es_otorgado"
    USUARIO ||--o{ ROL_PERMISO : "asignado_por"

    USUARIO ||--|| PERSONAL : "perfil_humano"
    USUARIO ||--o{ LOG_CAMBIOS_USUARIOS : "usuario_modificado"
    USUARIO ||--o{ LOG_CAMBIOS_USUARIOS : "modificado_por"
    USUARIO ||--o{ CUADRILLA : "usuario_delegado"
    USUARIO ||--o{ PATRULLA_VERIFICADORA : "usuario_lider"
    USUARIO ||--o{ MISION : "despachador_o_encargado"
    USUARIO ||--o{ RECURSO : "creado_por"
    USUARIO ||--o{ INCIDENTE : "operador_o_encargado"
    USUARIO ||--o{ AVISO_INCIDENTE : "operador_atencion"
    USUARIO ||--o{ NOTIFICACIONES : "recibe_alertas"

    INFORMANTE ||--o{ INCIDENTE : "declara"
    CHATBOT ||--o{ INFORMANTE : "interactua"
    TIPO_INCIDENTE ||--o{ INCIDENTE : "clasifica"
    FUENTE_INCIDENTE ||--o{ INCIDENTE : "canal_origen"
    INCIDENTE ||--o{ FACTORES_RIESGO : "posee_riesgos"

    AVISO_INCIDENTE ||--o| INCIDENTE : "promovido_a"
    AVISO_INCIDENTE ||--o{ AVISO_INCIDENTE : "duplicado_de"
    AVISO_INCIDENTE ||--o{ ADJUNTO : "contiene_adjuntos"
    INCIDENTE ||--o{ ADJUNTO : "evidencia_adjunta"

    INCIDENTE ||--o{ EVENTO_ATP : "provoca_o_deriva_en"
    INCIDENTE ||--o{ MISION : "origina_mision"
    PREVENCION ||--o{ MISION : "origina_mision_preventiva"

    PATRULLA_VERIFICADORA ||--o{ MISION : "ejecuta_verificacion"
    CUADRILLA ||--o{ MISION : "ejecuta_intervencion"
    CUADRILLA ||--o{ CUADRILLA_RECURSO : "utiliza"
    RECURSO ||--o{ CUADRILLA_RECURSO : "asignado_en"

    MISION ||--o{ LOG_MISION : "registra_bitacora"
    MISION ||--o{ REPORTE_TERRENO : "emite_informe"
    REPORTE_TERRENO ||--o{ ADJUNTO : "incluye_evidencia"
    MISION ||--o{ RECUPERACION : "deriva_recuperacion"
    RECUPERACION ||--o{ BENEFICIO : "asigna_ayuda_fibe"
    MISION ||--o{ NOTIFICACIONES : "despacha_notificacion"
```

---

## 3. Módulos de Dominio y Diccionario de Datos

### 3.1 Módulo: Seguridad y Organización

#### Tabla: `rol`
Almacena los roles del sistema de control de acceso basado en roles (RBAC).

| Columna | Tipo | Nulo | Por Defecto | Descripción |
|---|---|---|---|---|
| `id` | `UUID` | NO | `gen_random_uuid()` | Identificador único del rol. |
| `codigo` | `VARCHAR(50)` | NO | — | Clave única del rol (ej. `ADMIN`, `CALL_CENTER`, `ENCARGADO`). Unique. |
| `nombre` | `VARCHAR(100)` | NO | — | Nombre legible (ej. `Administrador`, `Call Center`). Unique. |
| `descripcion` | `TEXT` | SÍ | `NULL` | Detalle de responsabilidades del rol. |
| `activo` | `BOOLEAN` | NO | `true` | Estado activo/inactivo. |
| `es_sistema` | `BOOLEAN` | NO | `false` | Indica si es un rol inmutable de fábrica del sistema. |
| `creado_en` | `TIMESTAMPTZ` | NO | `CURRENT_TIMESTAMP` | Fecha de creación. |
| `actualizado_en`| `TIMESTAMPTZ` | NO | `CURRENT_TIMESTAMP` | Fecha de última modificación. |

#### Tabla: `permiso`
Define las facultades granulares asignables a roles.

| Columna | Tipo | Nulo | Por Defecto | Descripción |
|---|---|---|---|---|
| `id` | `UUID` | NO | `gen_random_uuid()` | Identificador único del permiso. |
| `codigo` | `VARCHAR(50)` | NO | — | Código canónico del permiso (ej. `incidentes:kanban`, `recursos:leer`). Unique. |
| `nombre` | `VARCHAR(100)` | NO | — | Nombre descriptivo del permiso. |
| `descripcion` | `TEXT` | SÍ | `NULL` | Explicación de la acción permitida. |
| `modulo` | `VARCHAR(50)` | NO | — | Módulo al que pertenece (`Seguridad`, `Incidentes`, `Misiones`, `Recursos y Personal`). |
| `creado_en` | `TIMESTAMPTZ` | NO | `CURRENT_TIMESTAMP` | Fecha de registro. |

#### Tabla: `rol_permiso`
Pivote N:M entre roles y permisos.

| Columna | Tipo | Nulo | Por Defecto | Descripción / Relación |
|---|---|---|---|---|
| `rol_id` | `UUID` | NO | — | FK a `rol.id` (ON DELETE CASCADE). |
| `permiso_id` | `UUID` | NO | — | FK a `permiso.id` (ON DELETE CASCADE). |
| `asignado_por_id`| `UUID` | SÍ | `NULL` | FK a `usuario.id` que otorgó el permiso. |
| `asignado_en` | `TIMESTAMPTZ` | NO | `CURRENT_TIMESTAMP` | Momento de asignación. |
| **PK** | `(rol_id, permiso_id)` | | | Llave primaria compuesta. |

#### Tabla: `delegacion`
Representa las cuatro delegaciones territoriales de la Municipalidad de Valdivia.

| Columna | Tipo | Nulo | Por Defecto | Descripción |
|---|---|---|---|---|
| `id` | `UUID` | NO | `gen_random_uuid()` | Identificador único de la delegación. |
| `codigo` | `VARCHAR(50)` | NO | — | Código canónico (`DEL_NORTE`, `DEL_SUR`, `DEL_COSTA`, `DEL_CALLE_CALLE`). Unique. |
| `nombre` | `VARCHAR(100)` | NO | — | Nombre institucional oficial. Unique. |
| `direccion` | `TEXT` | SÍ | `NULL` | Dirección física de la sede. |
| `descripcion` | `TEXT` | SÍ | `NULL` | Sectores o cuadrantes que abarca. |
| `activo` | `BOOLEAN` | NO | `true` | Estado operativo de la delegación. |
| `creado_en` | `TIMESTAMPTZ` | NO | `CURRENT_TIMESTAMP` | Fecha de creación. |
| `actualizado_en`| `TIMESTAMPTZ` | NO | `CURRENT_TIMESTAMP` | Fecha de última modificación. |

#### Tabla: `usuario`
Cuentas de usuario de funcionarios y operadores municipales.

| Columna | Tipo | Nulo | Por Defecto | Descripción / Relación |
|---|---|---|---|---|
| `id` | `UUID` | NO | `gen_random_uuid()` | Identificador único del usuario. |
| `rut` | `VARCHAR(20)` | NO | — | Identificador fiscal chileno (RUT con guion y DV). Unique. |
| `nombres` | `VARCHAR(100)` | NO | — | Nombres de pila. |
| `apellidos` | `VARCHAR(100)` | NO | — | Apellidos paterno y materno. |
| `nombre` | `VARCHAR(255)` | SÍ | `NULL` | Nombre completo consolidado. |
| `email` | `VARCHAR(150)` | NO | — | Correo electrónico corporativo. Unique. |
| `telefono` | `VARCHAR(50)` | SÍ | `NULL` | Teléfono de contacto institucional o móvil. |
| `password_hash`| `VARCHAR(255)` | NO | `$2b$10$...` | Hash bcrypt de la contraseña (contraseña unificada para pruebas locales: `Valdivia2026!`). |
| `intentos_fallidos` | `INTEGER` | NO | `0` | Contador acumulativo de contraseñas erróneas consecutivas (protección contra ataques de fuerza bruta). |
| `bloqueado_hasta`| `TIMESTAMPTZ` | SÍ | `NULL` | Marca temporal de inhabilitación temporal tras 5 intentos fallidos (bloqueo por 15 minutos). |
| `rol_id` | `UUID` | NO | — | FK a `rol.id` (ON DELETE RESTRICT). |
| `delegacion_id`| `UUID` | SÍ | `NULL` | FK a `delegacion.id` (ON DELETE SET NULL). |
| `activo` | `BOOLEAN` | NO | `true` | Habilitación de acceso al sistema. |
| `ultimo_acceso`| `TIMESTAMPTZ` | SÍ | `NULL` | Fecha y hora del último login exitoso. |
| `fecha_ingreso`| `DATE` | SÍ | `NULL` | Fecha de inicio de funciones. |
| `fecha_salida` | `DATE` | SÍ | `NULL` | Fecha de desvinculación o cese de funciones. |
| `creado_en` | `TIMESTAMPTZ` | NO | `CURRENT_TIMESTAMP` | Fecha de registro. |
| `actualizado_en`| `TIMESTAMPTZ` | NO | `CURRENT_TIMESTAMP` | Fecha de última actualización. |

#### Tabla: `personal`
Ficha técnica operativa del personal de terreno (vinculada 1:1 al usuario).

| Columna | Tipo | Nulo | Por Defecto | Descripción / Relación |
|---|---|---|---|---|
| `id` | `UUID` | NO | `gen_random_uuid()` | Identificador de la ficha de personal. |
| `usuario_id` | `UUID` | NO | — | FK a `usuario.id` (ON DELETE CASCADE). Unique 1:1. |
| `delegacion_id`| `UUID` | NO | — | FK a `delegacion.id` (ON DELETE RESTRICT). |
| `especialidad` | `VARCHAR(100)`| SÍ | `NULL` | Oficio/especialidad (motosierrista, electricista, etc.). |
| `cargo` | `VARCHAR(100)`| SÍ | `NULL` | Cargo funcional en la cuadrilla o delegación. |
| `estado_operativo`| `VARCHAR(50)`| NO | `'disponible'` | Estado (`disponible`, `en_mision`, `en_patrulla`, `descanso`, `licencia`, `inactivo`). |
| `disponible_terreno`| `BOOLEAN`| NO | `true` | Aptitud médica/técnica para salir a emergencias. |
| `ultima_ubicacion` | `TEXT` | SÍ | `NULL` | Última referencia geográfica reportada. |
| `ultima_actualizacion_ubicacion`| `TIMESTAMPTZ` | SÍ | `NULL` | Timestamp del último reporte GPS. |
| `observaciones`| `TEXT` | SÍ | `NULL` | Notas operativas o de salud ocupacional. |
| `created_at` | `TIMESTAMPTZ` | NO | `CURRENT_TIMESTAMP` | Fecha de creación. |
| `updated_at` | `TIMESTAMPTZ` | NO | `CURRENT_TIMESTAMP` | Fecha de modificación. |

#### Tabla: `log_cambios_usuarios`
Auditoría estricta de cambios sobre las cuentas de usuario.

| Columna | Tipo | Nulo | Por Defecto | Descripción / Relación |
|---|---|---|---|---|
| `id` | `UUID` | NO | `gen_random_uuid()` | Identificador de la traza de auditoría. |
| `usuario_modificado_id` | `UUID` | NO | — | FK a `usuario.id` modificado (ON DELETE CASCADE). |
| `modificado_por_id` | `UUID` | SÍ | `NULL` | FK a `usuario.id` que ejecutó la modificación. |
| `campos_modificados` | `TEXT` | NO | — | Resumen o payload serializado de las diferencias. |
| `created_at` | `TIMESTAMPTZ` | NO | `CURRENT_TIMESTAMP` | Momento exacto del cambio. |

---

### 3.2 Módulo: Incidentes, Avisos y Evidencia

#### Tabla: `informante`
Registro de ciudadanos que notifican situaciones de emergencia.

| Columna | Tipo | Nulo | Por Defecto | Descripción |
|---|---|---|---|---|
| `id` | `UUID` | NO | `gen_random_uuid()` | Identificador único del informante. |
| `rut` | `VARCHAR(20)` | SÍ | `NULL` | RUT del informante si fue proporcionado. |
| `nombre` | `VARCHAR(150)`| SÍ | `NULL` | Nombre de pila o contacto. |
| `telefono` | `VARCHAR(50)` | SÍ | `NULL` | Teléfono para retorno de llamadas o WhatsApp. |
| `creado_en` | `TIMESTAMPTZ` | NO | `CURRENT_TIMESTAMP` | Fecha de primer registro. |

#### Tabla: `tipo_incidente`
Catálogo estandarizado de tipologías de emergencia municipal.

| Columna | Tipo | Nulo | Por Defecto | Descripción |
|---|---|---|---|---|
| `id` | `UUID` | NO | `gen_random_uuid()` | Identificador único del tipo de incidente. |
| `nombre` | `VARCHAR(100)`| NO | — | Nombre oficial (ej. `Anegamiento`, `Caída de árbol`, `Inundación`, `Deslizamiento`). Unique. |
| `descripcion` | `TEXT` | SÍ | `NULL` | Protocolo breve de atención o alcance. |
| `activo` | `BOOLEAN` | NO | `true` | Habilitación en listas desplegables. |
| `creado_en` | `TIMESTAMPTZ` | NO | `CURRENT_TIMESTAMP` | Fecha de registro. |

#### Tabla: `fuente_incidente`
Canal de ingreso del reporte.

| Columna | Tipo | Nulo | Por Defecto | Descripción |
|---|---|---|---|---|
| `id` | `UUID` | NO | `gen_random_uuid()` | Identificador del canal. |
| `nombre` | `VARCHAR(50)` | NO | — | Canal canónico (`CHATBOT`, `LLAMADA_TELEFONICA`, `FUNCIONARIO_TERRENO`, `SENAPRED`). Unique. |
| `descripcion` | `TEXT` | SÍ | `NULL` | Notas de integración del canal. |
| `creado_en` | `TIMESTAMPTZ` | NO | `CURRENT_TIMESTAMP` | Fecha de creación. |

#### Tabla: `aviso_incidente`
Bandeja de entrada de reportes ciudadanos antes de ser clasificados formalmente por el Call Center.

| Columna | Tipo | Nulo | Por Defecto | Descripción / Relación |
|---|---|---|---|---|
| `id` | `UUID` | NO | `gen_random_uuid()` | Identificador único del aviso. |
| `codigo_seguimiento` | `VARCHAR(50)` | NO | — | Código numérico de 8 dígitos entregado al informante. |
| `tipo_afectacion` | `VARCHAR(100)`| NO | — | Tipología descrita en el reporte inicial. |
| `descripcion` | `TEXT` | SÍ | `NULL` | Relato ciudadano de la situación. |
| `direccion_texto` | `TEXT` | NO | — | Dirección o punto de referencia en Valdivia. |
| `latitud` | `NUMERIC(10, 7)`| NO | — | Coordenada Y (WGS 84). |
| `longitud` | `NUMERIC(10, 7)`| NO | — | Coordenada X (WGS 84). |
| `ubicacion` | `GEOMETRY` | SÍ | — | Geometría PostGIS `Point(lng, lat)`. |
| `informante_nombre`| `VARCHAR(150)`| NO | — | Nombre del informante. |
| `informante_rut` | `VARCHAR(20)` | NO | — | RUT del informante. |
| `informante_telefono`| `VARCHAR(50)`| SÍ | `NULL` | Teléfono de contacto. |
| `origen_reporte` | `VARCHAR(50)` | NO | `'CHATBOT'` | Canal de origen (`WEB`, `CHATBOT`, `TELEFONO`). |
| `estado` | `VARCHAR(50)` | NO | `'PENDIENTE_VERIFICACION'` | Estado del aviso (`PENDIENTE_VERIFICACION`, `NO_VERIFICADO`, `VERIFICADO`, `DESCARTADO`). |
| `es_duplicado` | `BOOLEAN` | NO | `false` | Indica si coincide espacial/temporalmente con otro reporte. |
| `aviso_original_id`| `UUID` | SÍ | `NULL` | FK autorreferencial a `aviso_incidente.id` en caso de duplicidad. |
| `motivo_descarte` | `TEXT` | SÍ | `NULL` | Justificación obligatoria si el operador descarta el aviso. |
| `operador_id` | `UUID` | SÍ | `NULL` | FK a `usuario.id` (Operador que verificó o descartó). |
| `incidente_id` | `UUID` | SÍ | `NULL` | FK a `incidente.id` formal generado tras verificación. |
| `creado_en` | `TIMESTAMPTZ` | NO | `CURRENT_TIMESTAMP` | Momento de ingreso del reporte. |
| `actualizado_en`| `TIMESTAMPTZ` | NO | `CURRENT_TIMESTAMP` | Momento de última gestión. |

#### Tabla: `incidente`
Registro formal de incidente de emergencia gestionado bajo la metodología del Sistema de Comando de Incidentes (**ICS**).

| Columna | Tipo | Nulo | Por Defecto | Descripción / Relación |
|---|---|---|---|---|
| `id` | `UUID` | NO | `gen_random_uuid()` | Identificador único del incidente formal. |
| `codigo` | `VARCHAR(50)` | SÍ | — | Código oficial de incidente (ej. `INC-2026-8869`). Unique. |
| `folio` | `VARCHAR(50)` | SÍ | — | Folio único institucional correlativo. Unique. |
| `codigo_seguimiento` | `VARCHAR(50)` | SÍ | — | Código de 8 dígitos para seguimiento público ciudadano. |
| `informante_id` | `UUID` | SÍ | `NULL` | FK a `informante.id` (ON DELETE SET NULL). |
| `tipo_incidente_id` | `UUID` | SÍ | `NULL` | FK a `tipo_incidente.id` (ON DELETE SET NULL). |
| `aviso_id` | `UUID` | SÍ | `NULL` | FK a `aviso_incidente.id` de origen (ON DELETE SET NULL). |
| `delegacion_id` | `UUID` | SÍ | `NULL` | FK a `delegacion.id` territorial (ON DELETE SET NULL). |
| `fuente_incidente_id`| `UUID` | SÍ | `NULL` | FK a `fuente_incidente.id` (ON DELETE SET NULL). |
| `tipo_afectacion` | `VARCHAR(100)`| SÍ | — | Categoría textual de la afectación principal. |
| `descripcion` | `TEXT` | SÍ | `NULL` | Descripción operativa y técnica del incidente. |
| `direccion_texto` | `TEXT` | SÍ | — | Dirección estandarizada en la comuna. |
| `latitud` | `NUMERIC(10, 7)`| NO | — | Coordenada Y (latitud). |
| `longitud` | `NUMERIC(10, 7)`| NO | — | Coordenada X (longitud). |
| `ubicacion` | `GEOMETRY` | NO | — | Geometría PostGIS `Point(lng, lat)`, SRID 4326. Indexada con GiST. |
| `estado` | `VARCHAR(50)` | NO | `'REPORTADO'` | Estado canónico ICS (`REPORTADO`, `VERIFICANDO`, `EN_ATENCION`, `NO_ABORDABLE`, `RESUELTO`). |
| `prioridad` | `VARCHAR(20)` | NO | `'MEDIA'` | Severidad ICS (`BAJA`, `MEDIA`, `ALTA`, `CRITICA`). |
| `requiere_asistencia_social`| `BOOLEAN` | NO | `false` | Indica si requiere derivación a DIDECO para Ficha FIBE. |
| `fuente_origen` | `VARCHAR(50)` | NO | `'CHATBOT'` | Canal original (`CHATBOT`, `LLAMADA_TELEFONICA`, `FUNCIONARIO_TERRENO`, `SENAPRED`). |
| `asterisk_call_id`| `VARCHAR(100)`| SÍ | `NULL` | Identificador de llamada telefónica IVR si aplica. |
| `asterisk_caller_phone`| `VARCHAR(30)`| SÍ | `NULL` | Número de teléfono entrante de la llamada IVR. |
| `creado_por_id` | `UUID` | SÍ | `NULL` | FK a `usuario.id` que creó o registró el caso. |
| `operador_id` | `UUID` | SÍ | `NULL` | FK a `usuario.id` operador responsable. |
| `encargado_id` | `UUID` | SÍ | `NULL` | FK a `usuario.id` encargado de operaciones asignado. |
| `creado_en` | `TIMESTAMPTZ` | NO | `CURRENT_TIMESTAMP` | Fecha de creación. |
| `actualizado_en`| `TIMESTAMPTZ` | NO | `CURRENT_TIMESTAMP` | Fecha de última actualización. |

#### Tabla: `adjunto`
Evidencia digital (fotos, audios, documentos) vinculada a avisos o incidentes.

| Columna | Tipo | Nulo | Por Defecto | Descripción / Relación |
|---|---|---|---|---|
| `id` | `UUID` | NO | `gen_random_uuid()` | Identificador del archivo adjunto. |
| `nombre_archivo`| `VARCHAR(255)`| NO | — | Nombre original del archivo en el cliente. |
| `url` | `TEXT` | NO | — | URL o ruta de almacenamiento del objeto/archivo. |
| `tipo_mime` | `VARCHAR(100)`| NO | — | Formato MIME (ej. `image/jpeg`, `audio/ogg`, `application/pdf`). |
| `tamano_bytes` | `BIGINT` | NO | — | Peso del archivo en bytes. |
| `aviso_id` | `UUID` | SÍ | `NULL` | FK a `aviso_incidente.id` (ON DELETE CASCADE). |
| `incidente_id` | `UUID` | SÍ | `NULL` | FK a `incidente.id` (ON DELETE SET NULL). |
| `creado_en` | `TIMESTAMPTZ` | NO | `CURRENT_TIMESTAMP` | Fecha de subida. |

---

### 3.3 Módulo: Operaciones, Logística y Terreno

#### Tabla: `recurso`
Inventario de equipamiento, vehículos y maquinaria disponible para emergencias.

| Columna | Tipo | Nulo | Por Defecto | Descripción / Relación |
|---|---|---|---|---|
| `id` | `UUID` | NO | `gen_random_uuid()` | Identificador del recurso logístico. |
| `nombre` | `VARCHAR(255)`| NO | — | Nombre del recurso (ej. `Motobomba 4 pulgadas`, `Camioneta 4x4`). |
| `es_individual` | `BOOLEAN` | NO | `false` | `true` si es maquinaria con patente/número de serie; `false` si es a granel. |
| `estado` | `VARCHAR(50)` | NO | `'DISPONIBLE'` | Estado (`DISPONIBLE`, `ASIGNADO`, `EN_MANTENCION`, `BAJO_STOCK`, `NO_DISPONIBLE`). |
| `cantidad_inventario`| `INTEGER` | NO | — | Stock total inventariado. |
| `cantidad_en_uso`| `INTEGER` | NO | `0` | Cantidad actualmente despachada en misiones. |
| `cantidad_minima`| `INTEGER` | NO | `0` | Umbral para alerta de bajo stock. |
| `latitud` | `NUMERIC(10, 7)`| NO | — | Coordenada Y de su base/almacén. |
| `longitud` | `NUMERIC(10, 7)`| NO | — | Coordenada X de su base/almacén. |
| `ubicacion` | `GEOMETRY` | SÍ | — | Geometría PostGIS del almacén o base. |
| `descripcion` | `TEXT` | SÍ | `NULL` | Especificaciones técnicas o marca/modelo. |
| `detalles` | `JSONB` | NO | `'{}'` | Metadatos adicionales (número de serie, ficha de mantención). |
| `delegacion_id` | `UUID` | SÍ | `NULL` | FK a `delegacion.id` donde se almacena el recurso. |
| `creado_por_id` | `UUID` | NO | — | FK a `usuario.id` responsable del inventario. |
| `actualizado_por_id` | `UUID` | SÍ | `NULL` | FK a `usuario.id` que modificó el recurso. |
| `eliminado_por_id` | `UUID` | SÍ | `NULL` | FK a `usuario.id` que ejecutó la baja lógica (HU-9). |
| `creado_en` | `TIMESTAMPTZ` | NO | `CURRENT_TIMESTAMP` | Fecha de alta en inventario. |
| `actualizado_en`| `TIMESTAMPTZ` | NO | `CURRENT_TIMESTAMP` | Fecha de actualización. |
| `eliminado_en` | `TIMESTAMPTZ` | SÍ | `NULL` | Fecha y hora de baja lógica / soft delete (HU-9). |

#### Tabla: `patrulla_verificadora`
Unidades tácticas ligeras de terreno destinadas a la verificación primaria del incidente.

| Columna | Tipo | Nulo | Por Defecto | Descripción / Relación |
|---|---|---|---|---|
| `id` | `UUID` | NO | `gen_random_uuid()` | Identificador de la patrulla verificadora. |
| `nombre` | `VARCHAR(100)`| NO | — | Nombre identificador (ej. `Patrulla Alfa 1`). |
| `estado` | `VARCHAR(50)` | NO | `'DISPONIBLE'` | Estado operativo (`DISPONIBLE`, `EN_VERIFICACION`, `NO_DISPONIBLE`). |
| `delegacion_id` | `UUID` | SÍ | `NULL` | FK a `delegacion.id` base. |
| `usuario_lider_id`| `UUID` | SÍ | `NULL` | FK a `usuario.id` líder de patrulla. |
| `creado_en` | `TIMESTAMPTZ` | NO | `CURRENT_TIMESTAMP` | Fecha de conformación. |

#### Tabla: `cuadrilla`
Cuadrillas operativas municipales pesadas de intervención en terreno.

| Columna | Tipo | Nulo | Por Defecto | Descripción / Relación |
|---|---|---|---|---|
| `id` | `UUID` | NO | `gen_random_uuid()` | Identificador de la cuadrilla. |
| `nombre` | `VARCHAR(100)`| NO | — | Nombre de la cuadrilla (ej. `Cuadrilla Vías y Calles`). |
| `estado` | `VARCHAR(50)` | NO | `'DISPONIBLE'` | Estado operativo (`DISPONIBLE`, `EN_MISION`, `NO_DISPONIBLE`). |
| `delegacion_id` | `UUID` | SÍ | `NULL` | FK a `delegacion.id` de adscripción. |
| `usuario_delegado_id`| `UUID` | SÍ | `NULL` | FK a `usuario.id` Delegado de Cuadrilla. |
| `creado_en` | `TIMESTAMPTZ` | NO | `CURRENT_TIMESTAMP` | Fecha de registro. |

#### Tabla: `cuadrilla_recurso`
Asignación temporal de recursos a cuadrillas para ejecución de tareas.

| Columna | Tipo | Nulo | Por Defecto | Descripción / Relación |
|---|---|---|---|---|
| `id` | `UUID` | NO | `gen_random_uuid()` | Identificador de la asignación. |
| `cuadrilla_id` | `UUID` | NO | — | FK a `cuadrilla.id` (ON DELETE CASCADE). |
| `recurso_id` | `UUID` | NO | — | FK a `recurso.id` (ON DELETE RESTRICT). |
| `cantidad_asignada`| `INTEGER` | NO | `1` | Cantidad entregada a la cuadrilla. |
| `asignado_en` | `TIMESTAMPTZ` | NO | `CURRENT_TIMESTAMP` | Fecha y hora de despacho del recurso. |

#### Tabla: `prevencion`
Puntos críticos de mitigación y prevención geográfica comunal (Migraciones 006, 011 y 013).

| Columna | Tipo | Nulo | Por Defecto | Descripción / Relación |
|---|---|---|---|---|
| `id` | `UUID` | NO | `gen_random_uuid()` | Identificador del punto crítico preventivo. |
| `codigo` | `VARCHAR(20)` | NO | — | Código del punto crítico (ej. `PC-ANG-01`). Unique. |
| `nombre` | `VARCHAR(150)`| NO | — | Nombre descriptivo del punto de prevención o sector vulnerable. |
| `descripcion` | `TEXT` | SÍ | `NULL` | Detalle situacional y medidas mitigadoras a realizar. |
| `tipo_riesgo` | `VARCHAR(100)`| SÍ | `NULL` | Clasificación de la amenaza recurrente (Migración 011 / HU-57). |
| `prioridad` | `VARCHAR(20)` | NO | `'MEDIA'` | Gravedad/prioridad operativa (`BAJA`, `MEDIA`, `ALTA`, `CRITICA`) (Migración 011 / HU-57). |
| `latitud` | `NUMERIC(10, 7)`| NO | — | Coordenada Y (latitud EPSG:4326) del punto crítico. |
| `longitud` | `NUMERIC(10, 7)`| NO | — | Coordenada X (longitud EPSG:4326) del punto crítico. |
| `ubicacion` | `GEOMETRY` | SÍ | — | Geometría PostGIS Point. |
| `delegacion_id` | `UUID` | SÍ | `NULL` | FK a `delegacion.id` correspondiente. |
| `activo` | `BOOLEAN` | NO | `true` | Estado operativo de vigencia. Se actualiza a `false` en baja lógica (HU-56). |
| `creado_en` | `TIMESTAMPTZ` | NO | `CURRENT_TIMESTAMP` | Fecha de alta en el sistema. |
| `eliminado_en` | `TIMESTAMPTZ` | SÍ | `NULL` | Fecha y hora de baja lógica / soft delete (Migración 013 / HU-56). |
| `eliminado_por_id` | `UUID` | SÍ | `NULL` | FK a `usuario.id` que ejecutó la desactivación (Migración 013 / HU-56). |

#### Tabla: `mision`
Misiones tácticas despachadas a patrullas verificadoras o cuadrillas operativas.

| Columna | Tipo | Nulo | Por Defecto | Descripción / Relación |
|---|---|---|---|---|
| `id` | `UUID` | NO | `gen_random_uuid()` | Identificador único de la misión. |
| `codigo` | `VARCHAR(50)` | NO | — | Código oficial (ej. `MIS-2026-0001`). Unique. |
| `titulo` | `VARCHAR(150)`| NO | — | Título descriptivo de la orden operativa. |
| `descripcion` | `TEXT` | SÍ | `NULL` | Instrucciones detalladas de trabajo en terreno. |
| `tipo_mision` | `VARCHAR(50)` | NO | — | Tipo (`VERIFICACION`, `ATENCION_CUADRILLA`, `PREVENCION`, `RECUPERACION`, `ASISTENCIA_SOCIAL`). |
| `estado` | `VARCHAR(50)` | NO | `'PLANIFICADA'` | Estado (`PLANIFICADA`, `DESPACHADA`, `EN_CURSO`, `COMPLETADA`, `CANCELADA`, `RECHAZADA`). |
| `prioridad` | `VARCHAR(20)` | NO | `'MEDIA'` | Prioridad (`BAJA`, `MEDIA`, `ALTA`, `CRITICA`). |
| `justificacion_rechazo`| `TEXT`| SÍ | `NULL` | Justificación obligatoria si la cuadrilla rechaza la misión. |
| `incidente_id` | `UUID` | SÍ | `NULL` | FK a `incidente.id` (ON DELETE SET NULL). Nullable si es preventiva. |
| `prevencion_id` | `UUID` | SÍ | `NULL` | FK a `prevencion.id` (ON DELETE SET NULL). Nullable si responde a incidente. |
| `cuadrilla_id` | `UUID` | SÍ | `NULL` | FK a `cuadrilla.id` (ON DELETE SET NULL). |
| `patrulla_id` | `UUID` | SÍ | `NULL` | FK a `patrulla_verificadora.id` (ON DELETE SET NULL). |
| `encargado_id` | `UUID` | SÍ | `NULL` | FK a `usuario.id` Encargado supervisor. |
| `creado_por_id` | `UUID` | NO | — | FK a `usuario.id` que despachó la orden. |
| `fecha_inicio` | `TIMESTAMPTZ` | SÍ | `NULL` | Inicio de labores en terreno. |
| `fecha_cierre` | `TIMESTAMPTZ` | SÍ | `NULL` | Término o finalización de trabajos. |
| `creado_en` | `TIMESTAMPTZ` | NO | `CURRENT_TIMESTAMP` | Fecha de creación. |
| `actualizado_en`| `TIMESTAMPTZ` | NO | `CURRENT_TIMESTAMP` | Fecha de última actualización. |

#### Tabla: `reporte_terreno` (Reporte Técnico de Terreno - HU-17 / Migración 011)
Informes técnicos y diagnósticos estructurados levantados por patrullas verificadoras o cuadrillas tras su intervención o evaluación en terreno. Admite múltiples reportes por misión (1:N) para reflejar su evolución temporal.

| Columna | Tipo | Nullable | Default | Descripción / Restricciones |
|---|---|---|---|---|
| `id` | `UUID` | NO | `gen_random_uuid()` | Clave primaria única. |
| `mision_id` | `UUID` | NO | — | FK a `mision.id` (ON DELETE CASCADE). Misión asociada. |
| `evaluador_id` | `UUID` | NO | — | FK a `usuario.id` (ON DELETE RESTRICT). Funcionario autor del informe. |
| `resumen_tecnico` | `TEXT` | NO | — | Diagnóstico y detalle técnico consolidado de la intervención. |
| `acciones_realizadas` | `TEXT` | SÍ | `NULL` | Maniobras operativas ejecutadas en terreno. |
| `requiere_apoyo_adicional` | `BOOLEAN` | NO | `false` | Indicador de necesidad de escalamiento de recursos. |
| `danos_estimados` | `TEXT` | SÍ | `NULL` | Estimación descriptiva o cuantitativa de daños. |
| `observaciones` | `TEXT` | SÍ | `NULL` | Condiciones climáticas o notas de seguridad. |
| `personas_afectadas` | `INTEGER` | NO | `0` | Cantidad estimada de damnificados en el punto. |
| `estado_terreno` | `VARCHAR(50)` | NO | `'FINALIZADO'` | Estado operativo del reporte (`PRELIMINAR`, `EN_PROCESO`, `FINALIZADO`). |
| `creado_en` | `TIMESTAMPTZ` | NO | `CURRENT_TIMESTAMP` | Fecha y hora de emisión del informe. |
| `actualizado_en` | `TIMESTAMPTZ` | NO | `CURRENT_TIMESTAMP` | Última modificación del informe. |

---

### 3.4 Entidades del Modelo Maestro en Hoja de Ruta (Roadmap de Persistencia)

Las siguientes entidades forman parte del diseño conceptual inicial del sistema (ver `Diagrama Entidad-Relación - SGRAI.png`) y se proyectan para su incorporación física en base de datos mediante futuras migraciones Kysely a medida que los módulos respectivos se desarrollen:

#### Entidad: `evento_atp` (Eventos ATP)
- **Propósito:** Agrupar incidentes y recursos bajo un marco operativo común para eventos adversos mayores (temporales de viento y lluvia, desbordes fluviales, emergencias comunales) o planes preventivos territoriales.
- **Relaciones:** Relación 1:N con `incidente` (un incidente puede ser provocado por o derivar de un evento ATP) y con `mision` (misiones masivas de despliegue preventivo o de contingencia).
- **Campos proyectados:** `id` (UUID), `codigo`, `nombre`, `descripcion`, `tipo_evento` (`TEMPORAL_VIENTO`, `TEMPORAL_LLUVIA`, `DESBORDE`, `PREVENTIVO`), `estado` (`ACTIVO`, `FINALIZADO`), `fecha_inicio`, `fecha_termino`, `creado_en`.

#### Entidad: `log_mision` (Bitácora / Log de Misión)
- **Propósito:** Registro cronológico inmutable de hitos, cambios de estado y notas de terreno emitidas por la patrulla o cuadrilla durante el ciclo de vida de la misión.
- **Relaciones:** Relación N:1 con `mision` (una misión genera múltiples entradas de log), y N:1 con `usuario` (autor del registro).
- **Campos proyectados:** `id` (UUID), `mision_id` (FK a `mision`), `usuario_id` (FK a `usuario`), `estado_anterior`, `nuevo_estado`, `mensaje_bitacora`, `latitud`, `longitud`, `creado_en`.

#### Entidad: `recuperacion` (Puntos y Eventos de Recuperación)
- **Propósito:** Gestión de la fase posterior a la emergencia para labores de despeje de vías, remoción de escombros, sanitización y coordinación con DIDECO para asistencia social.
- **Relaciones:** Derivada desde `mision` (misiones de tipo `RECUPERACION`), relación 1:N con `beneficio`, vinculada a `delegacion`.
- **Campos proyectados:** `id` (UUID), `mision_id` (FK a `mision`), `delegacion_id` (FK a `delegacion`), `sector`, `estado` (`EN_EVALUACION`, `EN_EJECUCION`, `FINALIZADO`), `familias_afectadas`, `creado_en`.

#### Entidad: `beneficio` (Asistencia Social / Ayuda Humanitaria)
- **Propósito:** Registro y entrega de insumos, techumbres, canastas familiares o subsidios de arriendo a familias damnificadas tras el levantamiento de la Ficha Básica de Emergencia (FIBE).
- **Relaciones:** Relación N:1 con `recuperacion` o con `incidente` (cuando `requiere_asistencia_social = true`), relación N:1 con `usuario` (asistente social responsable).
- **Campos proyectados:** `id` (UUID), `recuperacion_id` (FK a `recuperacion`), `tipo_beneficio` (`TECHUMBRE`, `CANASTA_ALIMENTOS`, `COLCHONES_FRAZADAS`, `MATERIALES_CONSTRUCCION`), `cantidad`, `rut_beneficiario`, `nombre_beneficiario`, `direccion_entrega`, `entregado_en`.

#### Entidad: `factor_riesgo` (Factores de Riesgo y Criticidad)
- **Propósito:** Catálogo estructurado de agravantes que ponderan el nivel de urgencia del incidente (riesgo vital, electrocución, adultos mayores postrados, aislamiento geográfico).
- **Relaciones:** Relación N:M con `incidente`.
- **Campos proyectados:** `id` (UUID), `codigo`, `nombre`, `nivel_gravedad` (`LEVE`, `MODERADO`, `GRAVE`, `VITAL`), `activo`.

#### Entidad: `notificacion` (Sistema de Notificaciones y Alertas)
- **Propósito:** Auditoría y trazabilidad de notificaciones push, mensajes WhatsApp y alertas WebSocket dirigidas a usuarios, patrullas y cuadrillas.
- **Relaciones:** Relación N:1 con `usuario` destinatario, referencia opcional a `mision_id` o `incidente_id`.
- **Campos proyectados:** `id` (UUID), `usuario_id` (FK a `usuario`), `tipo_notificacion` (`ALERTA_MISION`, `CAMBIO_ESTADO`, `AVISO_CALL_CENTER`), `titulo`, `cuerpo`, `leida`, `creada_en`.

---

## 4. Enumerados y Constantes de Dominio

| Enumerado | Valores Válidos | Ubicación en Código |
|---|---|---|
| **EstadoIncidente** | `'REPORTADO'`, `'VERIFICANDO'`, `'EN_ATENCION'`, `'NO_ABORDABLE'`, `'RESUELTO'` | `src/modules/incidentes/incidente-kanban.schema.ts` |
| **PrioridadIncidente** | `'BAJA'`, `'MEDIA'`, `'ALTA'`, `'CRITICA'` | `src/modules/incidentes/incidente-kanban.schema.ts` |
| **EstadoAviso** | `'PENDIENTE_VERIFICACION'`, `'NO_VERIFICADO'`, `'VERIFICADO'`, `'DESCARTADO'` | `src/modules/incidentes/types.ts` |
| **OrigenReporte** | `'CHATBOT'`, `'LLAMADA_TELEFONICA'`, `'FUNCIONARIO_TERRENO'`, `'WEB'`, `'TELEFONO'` | `src/lib/db/types.ts` |
| **EstadoMision** | `'PLANIFICADA'`, `'DESPACHADA'`, `'EN_CURSO'`, `'COMPLETADA'`, `'CANCELADA'`, `'RECHAZADA'` | `src/lib/db/types.ts` |
| **TipoMision** | `'VERIFICACION'`, `'ATENCION_CUADRILLA'`, `'PREVENCION'`, `'RECUPERACION'`, `'ASISTENCIA_SOCIAL'` | `src/lib/db/types.ts` |
| **EstadoRecurso** | `'DISPONIBLE'`, `'ASIGNADO'`, `'EN_MANTENCION'`, `'BAJO_STOCK'`, `'NO_DISPONIBLE'` | `src/lib/db/types.ts` |
| **EstadoPatrulla** | `'DISPONIBLE'`, `'EN_VERIFICACION'`, `'NO_DISPONIBLE'` | `src/lib/db/types.ts` |
| **EstadoCuadrilla** | `'DISPONIBLE'`, `'EN_MISION'`, `'NO_DISPONIBLE'` | `src/lib/db/types.ts` |
| **EstadoOperativoPersonal** | `'disponible'`, `'en_mision'`, `'en_patrulla'`, `'descanso'`, `'licencia'`, `'inactivo'` | `src/lib/db/types.ts` |

---

## 5. Datos Semilla Predefinidos (Seeds Oficiales)

Para mantener la integridad referencial y permitir pruebas end-to-end homogéneas entre `sgrai-api`, `sgrai-web` y `sgrai-pwa`, se han sembrado los siguientes registros canónicos:

### 5.1 Roles RBAC (`rol`)
- `20000000-0000-4000-8000-000000000001` — `ADMIN` (Administrador)
- `20000000-0000-4000-8000-000000000002` — `CALL_CENTER` (Call Center)
- `20000000-0000-4000-8000-000000000003` — `ENCARGADO` (Encargado)
- `20000000-0000-4000-8000-000000000004` — `PATRULLA_VERIFICADORA` (Patrulla Verificadora)
- `20000000-0000-4000-8000-000000000005` — `DELEGADO_CUADRILLA` (Delegado de Cuadrilla)
- `20000000-0000-4000-8000-000000000006` — `ASISTENTE_SOCIAL` (Asistente Social)
- `20000000-0000-4000-8000-000000000007` — `INFORMANTE` (Informante)
- `20000000-0000-4000-8000-000000000008` — `OBSERVADOR` (Observador Sin Permisos)
- `20000000-0000-4000-8000-000000000009` — `BRIGADISTA` (Personal de Terreno / Brigadista)
- `20000000-0000-4000-8000-000000000010` — `SUPERVISOR` (Supervisor Estratégico)

### 5.2 Usuarios Predefinidos (`usuario`)
> **Nota de Seguridad en Entornos de Desarrollo/QA:** Todos los usuarios predefinidos cuentan con la contraseña estandarizada **`Valdivia2026!`**, correspondiente al hash bcrypt `$2b$10$dMlhpX4QFpPonWcTHVNo0usyfRLusunVKj6LsxLc9PaZ9JZkN5asm` sembrado en la migración `010_autenticacion_bloqueo_usuarios.ts`.

- `00000000-0000-4000-8000-000000000001` — `admin@valdivia.cl` (Administrador General, RUT: `11111111-1`)
- `00000000-0000-4000-8000-000000000002` — `callcenter@valdivia.cl` (Operador Call Center Genérico, RUT: `22222222-2`)
- `c1111111-1111-4111-8111-111111111111` — `carlos.miranda@valdivia.cl` (Carlos Miranda - Call Center Mesa 1, RUT: `14111111-1`)
- `c2222222-2222-4222-8222-222222222222` — `patricia.valenzuela@valdivia.cl` (Patricia Valenzuela - Call Center Mesa 2, RUT: `15222222-2`)
- `a0000000-0000-4000-8000-000000000001` — `operador.qa@valdivia.cl` (Operador QA Call Center, RUT: `99999999-9`)
- `00000000-0000-4000-8000-000000000003` — `encargado@valdivia.cl` (Encargado de Operaciones Centro de Mando, RUT: `33333333-3`)
- `00000000-0000-4000-8000-000000000010` — `supervisor@valdivia.cl` (Supervisor Estratégico, RUT: `44444444-4`)

### 5.3 Delegaciones Municipales (`delegacion`)
- `30000000-0000-4000-8000-000000000001` — `DEL_NORTE` (Delegación Municipal Norte)
- `30000000-0000-4000-8000-000000000002` — `DEL_SUR` (Delegación Municipal Sur)
- `30000000-0000-4000-8000-000000000003` — `DEL_COSTA` (Delegación Municipal Costa)
- `30000000-0000-4000-8000-000000000004` — `DEL_CALLE_CALLE` (Delegación Municipal Calle Calle)

### 5.4 Tipos de Incidente (`tipo_incidente`)
- `a0000000-0000-4000-8000-000000000001` — `Anegamiento`
- `a0000000-0000-4000-8000-000000000003` — `Corte de energía`
- `a0000000-0000-4000-8000-000000000004` — `Deslizamiento`
- `a0000000-0000-4000-8000-000000000005` — `Daño estructural`
- `a0000000-0000-4000-8000-000000000006` — `Corte de agua potable`
- `40000000-0000-4000-8000-000000000001` — `Inundación`
- `40000000-0000-4000-8000-000000000002` — `Deslizamiento de tierra`
- `40000000-0000-4000-8000-000000000003` — `Caída de árbol`
- `40000000-0000-4000-8000-000000000004` — `Anegamiento de calzada`
- `40000000-0000-4000-8000-000000000005` — `Incendio estructural / forestal`
- `40000000-0000-4000-8000-000000000006` — `Otro`

---

## 6. Reglas de Negocio con Impacto en Base de Datos

1. **Ciclo de Vida ICS en Mayúsculas Estrictas:**
   - La columna `incidente.estado` **siempre** debe persistirse en mayúsculas canónicas (`'REPORTADO'`, `'VERIFICANDO'`, `'EN_ATENCION'`, `'RESUELTO'`, `'NO_ABORDABLE'`). No usar minúsculas (`'Reportado'`), ya que los filtros SQL del Tablero Kanban comparan por igualdad exacta.
2. **Promoción Atómica Aviso → Incidente:**
   - La acción "Verificar y Enviar" del Call Center se ejecuta dentro de una transacción Kysely (`trx`).
   - Inserta el registro en `incidente`, actualiza `aviso_incidente.estado = 'VERIFICADO'`, asocia `aviso_incidente.incidente_id` y reasigna los registros existentes en `adjunto` actualizando `adjunto.incidente_id = nuevoIncidente.id`.
3. **Misiones sin Incidente Previo:**
   - En `mision`, la columna `incidente_id` es **nullable**.
   - Se pueden planificar y despachar misiones de tipo `PREVENCION` o `RECUPERACION` vinculadas a un punto crítico en `prevencion_id` sin necesidad de que exista un incidente formal reportado.
4. **Liberación de Patrulla Verificadora:**
   - La patrulla verificadora realiza el triage primario. Al escalar y despachar una cuadrilla operativa para la atención en terreno, la patrulla verificadora debe quedar liberada en el sistema (`patrulla_verificadora.estado = 'DISPONIBLE'`).
5. **Rechazo Justificado de Misiones:**
   - Si una cuadrilla rechaza una misión (`mision.estado = 'RECHAZADA'`), la columna `mision.justificacion_rechazo` es **estrictamente obligatoria** (no puede ser `NULL` ni string vacío).
6. **Manejo de Vulnerabilidad Social (FIBE / DIDECO):**
   - No existe tabla de "Albergues". La vulnerabilidad social se señaliza mediante el booleano `incidente.requiere_asistencia_social = true`. Esto habilita su derivación al equipo de Asistentes Sociales para levantar la Ficha Básica de Emergencia (FIBE).

---

## 7. Ejecución de Migraciones y Gestión de Esquema

### 7.1 Correr Migraciones
```bash
npm run db:migrate
```
El runner Kysely (`src/lib/db/migrator.ts`) detecta los archivos en `src/lib/db/migrations/` y los aplica en estricto orden correlativo (`001_...` a `019_indices_filtros_listados.ts`).

### 7.2 Sembrar Datos para Tablero Kanban
```bash
npm run db:seed
```
Ejecuta el script `src/lib/db/seed-kanban.ts` insertando incidentes, patrullas, cuadrillas y misiones para pruebas de desarrollo local.

### 7.3 Reglas para Nuevas Migraciones
1. Crear un archivo numerado correlativamente en `src/lib/db/migrations/XXX_nombre_descriptivo.ts`.
2. Exportar funciones asíncronas `up(db: Kysely<unknown>): Promise<void>` y `down(db: Kysely<unknown>): Promise<void>`.
3. Utilizar el constructor de esquemas de Kysely (`db.schema.createTable(...)`, `db.schema.alterTable(...)`).
4. Si se agregan columnas o tablas nuevas, actualizar obligatoriamente la interfaz correspondiente en `src/lib/db/types.ts`.
5. Mantener la consistencia con las reglas y nombres de este documento.

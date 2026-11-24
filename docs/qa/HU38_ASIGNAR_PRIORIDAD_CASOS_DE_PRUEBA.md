# Casos de Prueba HU-38 — Evaluar Terreno y Asignar/Modificar Prioridad

**Historia de Usuario:** H38 — Asignar o modificar la prioridad del incidente basándose en la sugerencia del sistema y la evaluación técnica en terreno.

## 1. Preparación del entorno

```bash
cd api
npm run db:migrate
npm run seed -- --only=h38
```

El orquestador `scripts/seed/index.ts` crea un fixture aislado e idempotente. Para limpiar y recrear solo H38:

```bash
npm run seed -- --only=h38 --clean
```

## 2. Credenciales y datos del fixture

| Elemento | Valor |
|---|---|
| Usuario | `patrulla.h38@valdivia.cl` |
| Contraseña | `Valdivia2026!` |
| Rol | `PATRULLA_VERIFICADORA` |
| Patrulla | `PV-H38-01` (`e3800000-0000-4000-8000-000000000001`) |

### Caso A — Evaluación inicial

| Campo | Valor |
|---|---|
| Incidente | `INC-H38-QA-001` (`a3800000-0000-4000-8000-000000000001`) |
| Misión | `MIS-H38-0001` (`f3800000-0000-4000-8000-000000000001`) |
| Estado | Misión `EN_CURSO`, incidente `VERIFICANDO` |
| Reportes previos | 0 |

**Resultado esperado:** la PWA muestra el formulario H38 vacío. Al enviar una evaluación, se crea el reporte versión 1 y el hito `PRIORIDAD_ASIGNADA`.

### Caso B — Rectificación con historial

| Campo | Valor |
|---|---|
| Incidente | `INC-H38-QA-002` (`a3800000-0000-4000-8000-000000000002`) |
| Misión | `MIS-H38-0002` (`f3800000-0000-4000-8000-000000000002`) |
| Estado | Misión `EN_CURSO`, incidente `VERIFICANDO` |
| Reportes previos | 1 (versión 1: sugerida `ALTA`, asignada `CRITICA`) |

**Resultado esperado:** la PWA muestra la evaluación previa y permite reenviar una rectificación. El nuevo reporte debe quedar como versión 2 y registrar el hito `PRIORIDAD_RECTIFICADA`.

## 3. Prueba directa del endpoint

```bash
TOKEN=$(curl -s -X POST http://localhost:3001/api/seguridad/login \
  -H 'Content-Type: application/json' \
  -d '{"identificador":"patrulla.h38@valdivia.cl","password":"Valdivia2026!"}' \
  | jq -r '.data.token')

curl -X PATCH http://localhost:3001/api/incidentes/a3800000-0000-4000-8000-000000000001/prioridad \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "prioridad": "ALTA",
    "evaluacion": {
      "nucleoFamiliarTotal": 4,
      "nivelCompromisoVivienda": "MODERADO",
      "riesgoElectrico": true,
      "requiereEvacuacion": false
    },
    "justificacionPrioridad": "Riesgo eléctrico activo y filtración sobre dormitorio."
  }'
```

### Verificaciones esperadas

1. `PATCH` responde `200` con `reporteTerreno.versionReporte = 1`.
2. Un segundo `PATCH` sobre el mismo incidente responde `200` con `versionReporte = 2` y `esRectificacion = true`.
3. Si la prioridad asignada difiere de la sugerida y no se envía justificación (o tiene menos de 5 caracteres), el endpoint responde `400`.
4. La misión y el incidente quedan con la prioridad asignada y el hito correspondiente en `mision_hito`.

## 4. Comprobaciones SQL

```sql
SELECT m.codigo, m.estado, i.codigo AS incidente,
       i.prioridad, i.prioridad_sugerida,
       (SELECT count(*) FROM reporte_terreno r WHERE r.mision_id = m.id) AS reportes
FROM mision m
JOIN incidente i ON i.id = m.incidente_id
WHERE m.codigo LIKE 'MIS-H38-%'
ORDER BY m.codigo;

SELECT r.version_reporte, r.es_rectificacion,
       r.prioridad_sugerida, r.prioridad_asignada,
       r.justificacion_prioridad
FROM reporte_terreno r
JOIN mision m ON m.id = r.mision_id
WHERE m.codigo LIKE 'MIS-H38-%'
ORDER BY r.version_reporte;
```

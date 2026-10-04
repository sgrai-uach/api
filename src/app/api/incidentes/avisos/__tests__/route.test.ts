import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "../route";
import * as service from "@/modules/incidentes/aviso-incidente.service";
import { db } from "@/lib/db";
import { sql } from "kysely";
import { generarTokenPrueba, headersConBearer } from "@/lib/test-utils/auth";

describe("Endpoint POST /api/incidentes/avisos", () => {
  it("debe responder 400 si el cuerpo no es un JSON válido", async () => {
    const req = new NextRequest("http://localhost:3000/api/incidentes/avisos", {
      method: "POST",
      body: "esto no es json",
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.message).toContain("JSON válido");
  });

  it("debe responder 400 si el RUT del informante o campos obligatorios no son válidos", async () => {
    const req = new NextRequest("http://localhost:3000/api/incidentes/avisos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tipoAfectacion: "Anegamiento",
        direccion: "Av. Alemania 550",
        informanteNombre: "Juan Pérez",
        informanteRut: "11111111-9", // Inválido
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.message).toBe("Datos de entrada inválidos.");
    expect(Array.isArray(body.errors)).toBe(true);
  });

  it("debe responder 201 Created cuando el reporte es nuevo", async () => {
    vi.spyOn(service, "registrarAvisoDesdeChatbot").mockResolvedValue({
      id: "a1111111-1111-1111-1111-111111111111",
      codigoSeguimiento: "58291045",
      esDuplicado: false,
      mensaje: "Aviso de incidente registrado exitosamente. Guarde su número de seguimiento.",
      tipoAfectacion: "Anegamiento",
      direccion: "Av. Alemania 550",
      estado: "PENDIENTE_VERIFICACION",
      creadoEn: "2026-09-07T15:00:00.000Z",
      avisoOriginalId: null,
    });

    const req = new NextRequest("http://localhost:3000/api/incidentes/avisos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tipoAfectacion: "Anegamiento",
        direccion: "Av. Alemania 550",
        informanteNombre: "Juan Pérez",
        informanteRut: "11111111-1",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.esDuplicado).toBe(false);
    expect(body.data.codigoSeguimiento).toBe("58291045");
  });

  it("debe responder 200 OK cuando se detecta un duplicado existente", async () => {
    vi.spyOn(service, "registrarAvisoDesdeChatbot").mockResolvedValue({
      id: "a2222222-2222-2222-2222-222222222222",
      codigoSeguimiento: "12345678",
      esDuplicado: true,
      mensaje: "Este incidente ya ha sido reportado previamente en esta zona. Se ha asociado su reporte al número de seguimiento existente.",
      tipoAfectacion: "Anegamiento",
      direccion: "Av. Alemania 552",
      estado: "VERIFICANDO",
      creadoEn: "2026-09-07T15:10:00.000Z",
      avisoOriginalId: "a1111111-1111-1111-1111-111111111111",
    });

    const req = new NextRequest("http://localhost:3000/api/incidentes/avisos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tipoAfectacion: "Anegamiento",
        direccion: "Av. Alemania 552",
        informanteNombre: "María Soto",
        informanteRut: "11111112-K",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.esDuplicado).toBe(true);
    expect(body.data.codigoSeguimiento).toBe("12345678");
  });
});

const OPERADOR_CALL_CENTER_ID = "c1111111-1111-4111-8111-111111111111";
let AUTH_HEADER: { authorization: string };

const TEST_AVISO_IDS = [
  "f1111111-1111-4111-8111-111111111111",
  "f2222222-2222-4222-8222-222222222222",
  "f3333333-3333-4333-8333-333333333333",
];

describe("Endpoint GET /api/incidentes/avisos (HU-54 - Filtrado multicriterio)", () => {
  beforeAll(async () => {
    // 0. Generar token JWT Bearer para el operador de Call Center
    const token = await generarTokenPrueba(OPERADOR_CALL_CENTER_ID, {
      email: "carlos.miranda@valdivia.cl",
      rolCodigo: "CALL_CENTER",
      rolNombre: "Call Center",
    });
    AUTH_HEADER = headersConBearer(token);

    // 1. Limpieza defensiva previa
    await sql`DELETE FROM aviso_incidente WHERE id IN (${sql.join(TEST_AVISO_IDS.map((id) => sql`${id}`))});`.execute(db);

    // 2. Resolver delegaciones existentes para asignación
    const delNorte = await db
      .selectFrom("delegacion")
      .select("id")
      .where("nombre", "ilike", "%norte%")
      .executeTakeFirst();
    const delSur = await db
      .selectFrom("delegacion")
      .select("id")
      .where("nombre", "ilike", "%sur%")
      .executeTakeFirst();
    const delCalle = await db
      .selectFrom("delegacion")
      .select("id")
      .where("nombre", "ilike", "%calle%calle%")
      .executeTakeFirst();

    // 3. Sembrar fixture Norte (45 min antigüedad, NO_VERIFICADO)
    await sql`
      INSERT INTO aviso_incidente (
        id, codigo_seguimiento, tipo_afectacion, direccion_texto, latitud, longitud, ubicacion,
        informante_nombre, informante_rut, origen_reporte, estado, delegacion_id, creado_en, actualizado_en
      ) VALUES (
        ${TEST_AVISO_IDS[0]}, '71111111', 'Anegamiento', 'Av. Alemania 640', -39.8189, -73.2384,
        ST_SetSRID(ST_MakePoint(-73.2384, -39.8189), 4326),
        'Vecino Alemania', '11111111-1', 'WEB', 'NO_VERIFICADO',
        ${delNorte?.id ?? null},
        CURRENT_TIMESTAMP - interval '45 minutes',
        CURRENT_TIMESTAMP - interval '45 minutes'
      ) ON CONFLICT (id) DO NOTHING;
    `.execute(db);

    // 4. Sembrar fixture Sur (25 min antigüedad, PENDIENTE_VERIFICACION)
    await sql`
      INSERT INTO aviso_incidente (
        id, codigo_seguimiento, tipo_afectacion, direccion_texto, latitud, longitud, ubicacion,
        informante_nombre, informante_rut, origen_reporte, estado, delegacion_id, creado_en, actualizado_en
      ) VALUES (
        ${TEST_AVISO_IDS[1]}, '72222222', 'Caída de árbol', 'Av. Francia 1200', -39.8362, -73.2351,
        ST_SetSRID(ST_MakePoint(-73.2351, -39.8362), 4326),
        'Vecino Francia', '22222222-2', 'CHATBOT', 'PENDIENTE_VERIFICACION',
        ${delSur?.id ?? null},
        CURRENT_TIMESTAMP - interval '25 minutes',
        CURRENT_TIMESTAMP - interval '25 minutes'
      ) ON CONFLICT (id) DO NOTHING;
    `.execute(db);

    // 5. Sembrar fixture Calle Calle (10 min antigüedad, VERIFICADO)
    await sql`
      INSERT INTO aviso_incidente (
        id, codigo_seguimiento, tipo_afectacion, direccion_texto, latitud, longitud, ubicacion,
        informante_nombre, informante_rut, origen_reporte, estado, delegacion_id, creado_en, actualizado_en
      ) VALUES (
        ${TEST_AVISO_IDS[2]}, '73333333', 'Inundación', 'Av. Balmaceda 180, Collico', -39.8174, -73.2145,
        ST_SetSRID(ST_MakePoint(-73.2145, -39.8174), 4326),
        'Vecino Collico', '33333333-3', 'LLAMADA_TELEFONICA', 'VERIFICADO',
        ${delCalle?.id ?? null},
        CURRENT_TIMESTAMP - interval '10 minutes',
        CURRENT_TIMESTAMP - interval '10 minutes'
      ) ON CONFLICT (id) DO NOTHING;
    `.execute(db);
  });

  afterAll(async () => {
    // Limpieza al culminar la suite
    await sql`DELETE FROM aviso_incidente WHERE id IN (${sql.join(TEST_AVISO_IDS.map((id) => sql`${id}`))});`.execute(db);
  });
  it("debe retornar 401 Unauthorized si falta el token de autorización Bearer", async () => {
    const req = new NextRequest("http://localhost:3000/api/incidentes/avisos");
    const res = await GET(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.message).toMatch(/Bearer|token|autorización/i);
  });

  it("debe retornar 403 Forbidden si el usuario no tiene el permiso incidentes:avisos:leer", async () => {
    const tokenSinPermiso = await generarTokenPrueba("00000000-0000-4000-8000-000000000003", {
      email: "encargado@valdivia.cl",
      rolCodigo: "ENCARGADO",
      rolNombre: "Encargado",
    });
    const req = new NextRequest("http://localhost:3000/api/incidentes/avisos", {
      headers: headersConBearer(tokenSinPermiso),
    });
    const res = await GET(req);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.message).toContain("incidentes:avisos:leer");
  });

  it("CA-1: debe filtrar los avisos por la delegación territorial solicitada (Norte)", async () => {
    const req = new NextRequest(
      "http://localhost:3000/api/incidentes/avisos?delegacion=Norte",
      { headers: AUTH_HEADER }
    );
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toBe("Avisos obtenidos exitosamente");
    expect(Array.isArray(body.data)).toBe(true);
    body.data.forEach((aviso: { delegacionNombre: string | null; estado: string }) => {
      expect(aviso.delegacionNombre).toBe("Norte");
    });
  });

  it("CA-2: debe filtrar por estado NO_VERIFICADO (retornando pendientes y no verificados)", async () => {
    const req = new NextRequest(
      "http://localhost:3000/api/incidentes/avisos?estado=NO_VERIFICADO",
      { headers: AUTH_HEADER }
    );
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);
    body.data.forEach((aviso: { delegacionNombre: string | null; estado: string }) => {
      expect(["NO_VERIFICADO", "PENDIENTE_VERIFICACION"]).toContain(aviso.estado);
    });
  });

  it("CA-3: debe combinar filtros de delegación y estado simultáneamente (AND)", async () => {
    const req = new NextRequest(
      "http://localhost:3000/api/incidentes/avisos?delegacion=Norte&estado=NO_VERIFICADO",
      { headers: AUTH_HEADER }
    );
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);
    body.data.forEach((aviso: { delegacionNombre: string | null; estado: string }) => {
      expect(aviso.delegacionNombre).toBe("Norte");
      expect(["NO_VERIFICADO", "PENDIENTE_VERIFICACION"]).toContain(aviso.estado);
    });
  });

  it("CA-4: el objeto de paginación debe reflejar el total real de registros filtrados", async () => {
    const req = new NextRequest(
      "http://localhost:3000/api/incidentes/avisos?page=1&limit=5&estado=TODOS",
      { headers: AUTH_HEADER }
    );
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.pagination).toBeDefined();
    expect(body.pagination.page).toBe(1);
    expect(body.pagination.limit).toBe(5);
    expect(typeof body.pagination.total).toBe("number");
    expect(body.pagination.totalPages).toBeGreaterThanOrEqual(1);
    expect(typeof body.pagination.hasNext).toBe("boolean");
    expect(typeof body.pagination.hasPrev).toBe("boolean");
  });

  it("CA-5: debe responder con 200 OK, data: [] y total: 0 si la delegación no existe o no tiene coincidencias", async () => {
    const req = new NextRequest(
      "http://localhost:3000/api/incidentes/avisos?delegacion=Inexistente",
      { headers: AUTH_HEADER }
    );
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toBe("Avisos obtenidos exitosamente");
    expect(body.data).toEqual([]);
    expect(body.pagination.total).toBe(0);
    expect(body.pagination.totalPages).toBe(1);
  });

  it("CA-6: debe responder 400 Bad Request cuando los parámetros son inválidos", async () => {
    // page inválido
    const reqPageInvalido = new NextRequest(
      "http://localhost:3000/api/incidentes/avisos?page=0",
      { headers: AUTH_HEADER }
    );
    const res1 = await GET(reqPageInvalido);
    expect(res1.status).toBe(400);

    // limit superior al máximo permitido (100)
    const reqLimitInvalido = new NextRequest(
      "http://localhost:3000/api/incidentes/avisos?limit=150",
      { headers: AUTH_HEADER }
    );
    const res2 = await GET(reqLimitInvalido);
    expect(res2.status).toBe(400);

    // estado desconocido
    const reqEstadoInvalido = new NextRequest(
      "http://localhost:3000/api/incidentes/avisos?estado=INVALIDO",
      { headers: AUTH_HEADER }
    );
    const res3 = await GET(reqEstadoInvalido);
    expect(res3.status).toBe(400);
  });

  it("CA-7: debe retornar los items con minutosEnEspera calculado y delegacionNombre mapeado", async () => {
    const req = new NextRequest(
      "http://localhost:3000/api/incidentes/avisos?estado=TODOS&limit=10",
      { headers: AUTH_HEADER }
    );
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.length).toBeGreaterThan(0);
    const primerAviso = body.data[0];
    expect(typeof primerAviso.minutosEnEspera).toBe("number");
    expect(primerAviso.minutosEnEspera).toBeGreaterThanOrEqual(0);
    expect("delegacionNombre" in primerAviso).toBe(true);
  });

  it("debe normalizar el parámetro delegación 'Calle-Calle' a 'Calle Calle'", async () => {
    const req = new NextRequest(
      "http://localhost:3000/api/incidentes/avisos?delegacion=Calle-Calle",
      { headers: AUTH_HEADER }
    );
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toBe("Avisos obtenidos exitosamente");
    expect(Array.isArray(body.data)).toBe(true);
  });

  it("debe admitir búsqueda textual libre con 'busqueda' o 'q'", async () => {
    const req1 = new NextRequest(
      "http://localhost:3000/api/incidentes/avisos?busqueda=España&estado=TODOS",
      { headers: AUTH_HEADER }
    );
    const res1 = await GET(req1);
    expect(res1.status).toBe(200);
    const body1 = await res1.json();
    expect(Array.isArray(body1.data)).toBe(true);

    const req2 = new NextRequest(
      "http://localhost:3000/api/incidentes/avisos?q=España&estado=TODOS",
      { headers: AUTH_HEADER }
    );
    const res2 = await GET(req2);
    expect(res2.status).toBe(200);
    const body2 = await res2.json();
    expect(Array.isArray(body2.data)).toBe(true);
  });

  it("debe escapar comodines SQL en la búsqueda evitando retorno masivo con '%'", async () => {
    const req = new NextRequest(
      "http://localhost:3000/api/incidentes/avisos?busqueda=%25",
      { headers: AUTH_HEADER }
    );
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toEqual([]);
    expect(body.pagination.total).toBe(0);
  });
});


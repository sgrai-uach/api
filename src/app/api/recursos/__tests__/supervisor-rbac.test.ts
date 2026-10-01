import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET as getRecursos, POST as postRecursos } from "../route";
import { GET as getRecursoDetalle, PUT as putRecurso } from "../[id]/route";
import * as authGuard from "@/modules/seguridad/auth.guard";
import * as recursoRepository from "@/modules/recursos-y-personal/recurso.repository";
import { seguridadService } from "@/modules/seguridad/service";
import { ForbiddenError } from "@/modules/seguridad/errors";

describe("HU-50: Listado de Recursos para Supervisor — Control de Acceso y RBAC", () => {
  const supervisorId = "00000000-0000-4000-8000-000000000010";

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("1. Visualización de recursos (GET /api/recursos)", () => {
    it("debe permitir al perfil Supervisor listar recursos (200 OK) con permiso 'recursos:leer'", async () => {
      // Mock de autenticación exitosa como supervisor
      vi.spyOn(authGuard, "extraerUsuarioId").mockResolvedValue(supervisorId);
      vi.spyOn(seguridadService, "validarAccesoAdministrador").mockResolvedValue({
        id: supervisorId,
        rut: "44444444-4",
        nombre: "Supervisor Estratégico",
        email: "supervisor@valdivia.cl",
        rolId: "20000000-0000-4000-8000-000000000010",
        rolNombre: "Supervisor Estratégico",
        activo: true,
      });

      const mockFilas = [
        {
          id: "e1000000-0000-4000-8000-000000000001",
          nombre: "Motobomba Caudal 4\"",
          es_individual: true,
          estado: "DISPONIBLE" as const,
          cantidad_inventario: 3,
          cantidad_en_uso: 1,
          cantidad_minima: 1,
          latitud: -39.8142,
          longitud: -73.2459,
          descripcion: "Motobomba diésel de alta succión",
          detalles: {},
          delegacion_id: "30000000-0000-4000-8000-000000000001",
          delegacion_codigo: "DEL_NORTE",
          delegacion_nombre: "Delegación Municipal Norte",
          creado_por_id: supervisorId,
          creado_en: new Date("2026-10-01T10:00:00Z"),
          actualizado_en: new Date("2026-10-01T10:00:00Z"),
        },
      ];

      vi.spyOn(recursoRepository, "listarRecursosPaginados").mockResolvedValueOnce(
        mockFilas as unknown as Awaited<ReturnType<typeof recursoRepository.listarRecursosPaginados>>
      );
      vi.spyOn(recursoRepository, "contarRecursos").mockResolvedValueOnce(1);

      const req = new NextRequest("http://localhost:3000/api/recursos?pagina=1&limite=10&soloLectura=true", {
        headers: { authorization: "Bearer token-supervisor-valido" },
      });

      const res = await getRecursos(req);

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data).toHaveLength(1);
      expect(body.data[0].nombre).toBe("Motobomba Caudal 4\"");
      expect(body.data[0].estado).toBe("DISPONIBLE");
      expect(body.data[0].delegacion?.nombre).toBe("Delegación Municipal Norte");
      expect(body.meta.total).toBe(1);
    });

    it("debe retornar listado vacío cuando no existan recursos en el inventario (Empty State)", async () => {
      vi.spyOn(authGuard, "extraerUsuarioId").mockResolvedValue(supervisorId);
      vi.spyOn(seguridadService, "validarAccesoAdministrador").mockResolvedValue({
        id: supervisorId,
        rut: "44444444-4",
        nombre: "Supervisor Estratégico",
        email: "supervisor@valdivia.cl",
        rolId: "20000000-0000-4000-8000-000000000010",
        rolNombre: "Supervisor Estratégico",
        activo: true,
      });

      vi.spyOn(recursoRepository, "listarRecursosPaginados").mockResolvedValueOnce([]);
      vi.spyOn(recursoRepository, "contarRecursos").mockResolvedValueOnce(0);

      const req = new NextRequest("http://localhost:3000/api/recursos?pagina=1&limite=10", {
        headers: { authorization: "Bearer token-supervisor-valido" },
      });

      const res = await getRecursos(req);

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data).toEqual([]);
      expect(body.meta.total).toBe(0);
      expect(body.meta.totalPaginas).toBe(0);
    });
  });

  describe("2. Ficha de detalle para lectura (GET /api/recursos/[id])", () => {
    it("debe permitir al Supervisor visualizar el detalle del recurso (200 OK)", async () => {
      vi.spyOn(authGuard, "extraerUsuarioId").mockResolvedValue(supervisorId);
      vi.spyOn(seguridadService, "validarAccesoAdministrador").mockResolvedValue({
        id: supervisorId,
        rut: "44444444-4",
        nombre: "Supervisor Estratégico",
        email: "supervisor@valdivia.cl",
        rolId: "20000000-0000-4000-8000-000000000010",
        rolNombre: "Supervisor Estratégico",
        activo: true,
      });

      const mockFila = {
        id: "e1000000-0000-4000-8000-000000000001",
        nombre: "Motobomba Caudal 4\"",
        es_individual: true,
        estado: "DISPONIBLE" as const,
        cantidad_inventario: 3,
        cantidad_en_uso: 1,
        cantidad_minima: 1,
        latitud: -39.8142,
        longitud: -73.2459,
        descripcion: "Motobomba diésel",
        detalles: {},
        delegacion_id: "30000000-0000-4000-8000-000000000001",
        delegacion_codigo: "DEL_NORTE",
        delegacion_nombre: "Delegación Municipal Norte",
        creado_por_id: supervisorId,
        actualizado_por_id: null,
        creado_en: new Date("2026-10-01T10:00:00Z"),
        actualizado_en: new Date("2026-10-01T10:00:00Z"),
      };

      vi.spyOn(recursoRepository, "obtenerRecursoPorId").mockResolvedValueOnce(
        mockFila as unknown as Awaited<ReturnType<typeof recursoRepository.obtenerRecursoPorId>>
      );

      const req = new NextRequest("http://localhost:3000/api/recursos/e1000000-0000-4000-8000-000000000001", {
        headers: { authorization: "Bearer token-supervisor-valido" },
      });

      const res = await getRecursoDetalle(req, {
        params: Promise.resolve({ id: "e1000000-0000-4000-8000-000000000001" }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.nombre).toBe("Motobomba Caudal 4\"");
      expect(body.cantidadDisponible).toBe(2);
    });
  });

  describe("3. Restricción de mutaciones para Supervisor (Solo Lectura)", () => {
    it("debe rechazar la creación de recursos para Supervisor con 403 Forbidden (no posee recursos:crear)", async () => {
      vi.spyOn(authGuard, "extraerUsuarioId").mockResolvedValue(supervisorId);
      vi.spyOn(seguridadService, "validarAccesoAdministrador").mockRejectedValueOnce(
        new ForbiddenError("Acceso denegado. Se requiere el perfil de Administrador o permiso recursos:crear.")
      );

      const req = new NextRequest("http://localhost:3000/api/recursos", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          authorization: "Bearer token-supervisor-valido",
        },
        body: JSON.stringify({
          nombre: "Nuevo Generador",
          esIndividual: true,
          cantidadInventario: 1,
          cantidadMinima: 0,
          latitud: -39.8142,
          longitud: -73.2459,
        }),
      });

      const res = await postRecursos(req);

      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.message).toContain("Acceso denegado");
    });

    it("debe rechazar la edición de recursos para Supervisor con 403 Forbidden (no posee recursos:editar)", async () => {
      vi.spyOn(authGuard, "extraerUsuarioId").mockResolvedValue(supervisorId);
      vi.spyOn(seguridadService, "validarAccesoAdministrador").mockRejectedValueOnce(
        new ForbiddenError("Acceso denegado. Se requiere el perfil de Administrador o permiso recursos:editar.")
      );

      const req = new NextRequest("http://localhost:3000/api/recursos/e1000000-0000-4000-8000-000000000001", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          authorization: "Bearer token-supervisor-valido",
        },
        body: JSON.stringify({
          nombre: "Modificación de recurso",
          cantidadInventario: 2,
          cantidadMinima: 1,
          latitud: -39.8142,
          longitud: -73.2459,
        }),
      });

      const res = await putRecurso(req, {
        params: Promise.resolve({ id: "e1000000-0000-4000-8000-000000000001" }),
      });

      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.message).toContain("Acceso denegado");
    });
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET as getRecursos } from "../route";
import * as authGuard from "@/modules/seguridad/auth.guard";
import { seguridadService } from "@/modules/seguridad/service";
import * as recursoRepository from "@/modules/recursos-y-personal/recurso.repository";
import { ForbiddenError, UnauthorizedError } from "@/modules/seguridad/errors";

describe("HU-14: Visualización de Recursos Disponibles y Asignados (Encargado API)", () => {
  const encargadoId = "00000000-0000-4000-8000-000000000003";

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("CA-1: Presentación de listado o tabla centralizada de recursos en inventario", () => {
    it("debe retornar listado centralizado con 200 OK y metadatos de paginación para Encargado", async () => {
      vi.spyOn(authGuard, "extraerUsuarioId").mockResolvedValue(encargadoId);
      vi.spyOn(seguridadService, "validarAccesoAdministrador").mockResolvedValue({
        id: encargadoId,
        rut: "33333333-3",
        nombre: "Encargado de Operaciones",
        email: "encargado@valdivia.cl",
        rolId: "20000000-0000-4000-8000-000000000003",
        rolNombre: "Encargado",
        activo: true,
      });

      const mockFilas = [
        {
          id: "rec-001",
          nombre: "Camioneta Rescate 4x4",
          es_individual: true,
          estado: "DISPONIBLE" as const,
          cantidad_inventario: 1,
          cantidad_en_uso: 0,
          cantidad_minima: 0,
          latitud: -39.8142,
          longitud: -73.2459,
          descripcion: "Vehículo 4x4 todoterreno",
          detalles: { patente: "ABCD-12" },
          delegacion_id: "30000000-0000-4000-8000-000000000001",
          delegacion_codigo: "DEL_NORTE",
          delegacion_nombre: "Delegación Municipal Norte",
          creado_por_id: "admin-id",
          creado_en: new Date("2026-09-15T08:00:00Z"),
          actualizado_en: new Date("2026-09-15T08:00:00Z"),
        },
      ];

      vi.spyOn(recursoRepository, "listarRecursosPaginados").mockResolvedValueOnce(
        mockFilas as unknown as Awaited<ReturnType<typeof recursoRepository.listarRecursosPaginados>>
      );
      vi.spyOn(recursoRepository, "contarRecursos").mockResolvedValueOnce(1);

      const req = new NextRequest("http://localhost:3000/api/recursos?pagina=1&limite=10", {
        headers: { "x-user-id": encargadoId },
      });

      const res = await getRecursos(req);

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data).toHaveLength(1);
      expect(body.data[0].nombre).toBe("Camioneta Rescate 4x4");
      expect(body.data[0].tipo).toBe("Vehículo o Maquinaria");
      expect(body.data[0].cantidadDisponible).toBe(1);
      expect(body.meta.total).toBe(1);
      expect(body.meta.pagina).toBe(1);
    });

    it("debe soportar respuesta de Empty State con arreglo vacío cuando no hay recursos", async () => {
      vi.spyOn(authGuard, "extraerUsuarioId").mockResolvedValue(encargadoId);
      vi.spyOn(seguridadService, "validarAccesoAdministrador").mockResolvedValue({
        id: encargadoId,
        rut: "33333333-3",
        nombre: "Encargado de Operaciones",
        email: "encargado@valdivia.cl",
        rolId: "20000000-0000-4000-8000-000000000003",
        rolNombre: "Encargado",
        activo: true,
      });

      vi.spyOn(recursoRepository, "listarRecursosPaginados").mockResolvedValueOnce([]);
      vi.spyOn(recursoRepository, "contarRecursos").mockResolvedValueOnce(0);

      const req = new NextRequest("http://localhost:3000/api/recursos?pagina=1&limite=10", {
        headers: { "x-user-id": encargadoId },
      });

      const res = await getRecursos(req);

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data).toEqual([]);
      expect(body.meta.total).toBe(0);
      expect(body.meta.totalPaginas).toBe(0);
    });
  });

  describe("CA-2: Visualización del estado de disponibilidad actual ('Disponible', 'Asignado', etc.)", () => {
    it("debe derivar estado 'DISPONIBLE' cuando el recurso cuenta con unidades libres", async () => {
      vi.spyOn(authGuard, "extraerUsuarioId").mockResolvedValue(encargadoId);
      vi.spyOn(seguridadService, "validarAccesoAdministrador").mockResolvedValue({
        id: encargadoId,
        rut: "33333333-3",
        nombre: "Encargado de Operaciones",
        email: "encargado@valdivia.cl",
        rolId: "20000000-0000-4000-8000-000000000003",
        rolNombre: "Encargado",
        activo: true,
      });

      const mockFilas = [
        {
          id: "rec-001",
          nombre: "Sacos de Arena",
          es_individual: false,
          estado: "DISPONIBLE" as const,
          cantidad_inventario: 100,
          cantidad_en_uso: 20,
          cantidad_minima: 30,
          latitud: -39.8142,
          longitud: -73.2459,
          descripcion: "Sacos de contención",
          detalles: {},
          delegacion_id: null,
          delegacion_codigo: null,
          delegacion_nombre: null,
          creado_por_id: "admin-id",
          creado_en: new Date("2026-09-15T08:00:00Z"),
          actualizado_en: new Date("2026-09-15T08:00:00Z"),
        },
      ];

      vi.spyOn(recursoRepository, "listarRecursosPaginados").mockResolvedValueOnce(
        mockFilas as unknown as Awaited<ReturnType<typeof recursoRepository.listarRecursosPaginados>>
      );
      vi.spyOn(recursoRepository, "contarRecursos").mockResolvedValueOnce(1);

      const req = new NextRequest("http://localhost:3000/api/recursos?pagina=1&limite=10", {
        headers: { "x-user-id": encargadoId },
      });

      const res = await getRecursos(req);
      const body = await res.json();

      expect(body.data[0].estado).toBe("DISPONIBLE");
      expect(body.data[0].cantidadDisponible).toBe(80);
      expect(body.data[0].cantidadEnUso).toBe(20);
    });

    it("debe derivar estado 'ASIGNADO' cuando todas las unidades están ocupadas en misiones", async () => {
      vi.spyOn(authGuard, "extraerUsuarioId").mockResolvedValue(encargadoId);
      vi.spyOn(seguridadService, "validarAccesoAdministrador").mockResolvedValue({
        id: encargadoId,
        rut: "33333333-3",
        nombre: "Encargado de Operaciones",
        email: "encargado@valdivia.cl",
        rolId: "20000000-0000-4000-8000-000000000003",
        rolNombre: "Encargado",
        activo: true,
      });

      const mockFilas = [
        {
          id: "rec-002",
          nombre: "Motobomba de Achique 3\"",
          es_individual: true,
          estado: "DISPONIBLE" as const,
          cantidad_inventario: 1,
          cantidad_en_uso: 1,
          cantidad_minima: 0,
          latitud: -39.8142,
          longitud: -73.2459,
          descripcion: "Motobomba asignada a cuadrilla",
          detalles: {},
          delegacion_id: null,
          delegacion_codigo: null,
          delegacion_nombre: null,
          creado_por_id: "admin-id",
          creado_en: new Date("2026-09-15T08:00:00Z"),
          actualizado_en: new Date("2026-09-15T08:00:00Z"),
        },
      ];

      vi.spyOn(recursoRepository, "listarRecursosPaginados").mockResolvedValueOnce(
        mockFilas as unknown as Awaited<ReturnType<typeof recursoRepository.listarRecursosPaginados>>
      );
      vi.spyOn(recursoRepository, "contarRecursos").mockResolvedValueOnce(1);

      const req = new NextRequest("http://localhost:3000/api/recursos?pagina=1&limite=10", {
        headers: { "x-user-id": encargadoId },
      });

      const res = await getRecursos(req);
      const body = await res.json();

      expect(body.data[0].estado).toBe("ASIGNADO");
      expect(body.data[0].cantidadDisponible).toBe(0);
      expect(body.data[0].cantidadEnUso).toBe(1);
    });

    it("debe preservar estado 'EN_MANTENCION' cuando el recurso se encuentra en reparación técnica", async () => {
      vi.spyOn(authGuard, "extraerUsuarioId").mockResolvedValue(encargadoId);
      vi.spyOn(seguridadService, "validarAccesoAdministrador").mockResolvedValue({
        id: encargadoId,
        rut: "33333333-3",
        nombre: "Encargado de Operaciones",
        email: "encargado@valdivia.cl",
        rolId: "20000000-0000-4000-8000-000000000003",
        rolNombre: "Encargado",
        activo: true,
      });

      const mockFilas = [
        {
          id: "rec-003",
          nombre: "Retroexcavadora JCB",
          es_individual: true,
          estado: "EN_MANTENCION" as const,
          cantidad_inventario: 1,
          cantidad_en_uso: 0,
          cantidad_minima: 0,
          latitud: -39.8142,
          longitud: -73.2459,
          descripcion: "En taller por falla hidráulica",
          detalles: {},
          delegacion_id: null,
          delegacion_codigo: null,
          delegacion_nombre: null,
          creado_por_id: "admin-id",
          creado_en: new Date("2026-09-15T08:00:00Z"),
          actualizado_en: new Date("2026-09-15T08:00:00Z"),
        },
      ];

      vi.spyOn(recursoRepository, "listarRecursosPaginados").mockResolvedValueOnce(
        mockFilas as unknown as Awaited<ReturnType<typeof recursoRepository.listarRecursosPaginados>>
      );
      vi.spyOn(recursoRepository, "contarRecursos").mockResolvedValueOnce(1);

      const req = new NextRequest("http://localhost:3000/api/recursos?pagina=1&limite=10", {
        headers: { "x-user-id": encargadoId },
      });

      const res = await getRecursos(req);
      const body = await res.json();

      expect(body.data[0].estado).toBe("EN_MANTENCION");
    });
  });

  describe("CA-3: Filtrado de recursos por disponibilidad ('Disponibles' o 'Asignados')", () => {
    it("debe aplicar filtro ?estado=DISPONIBLE y propagarlo al repositorio de datos", async () => {
      vi.spyOn(authGuard, "extraerUsuarioId").mockResolvedValue(encargadoId);
      vi.spyOn(seguridadService, "validarAccesoAdministrador").mockResolvedValue({
        id: encargadoId,
        rut: "33333333-3",
        nombre: "Encargado de Operaciones",
        email: "encargado@valdivia.cl",
        rolId: "20000000-0000-4000-8000-000000000003",
        rolNombre: "Encargado",
        activo: true,
      });

      const spyListar = vi
        .spyOn(recursoRepository, "listarRecursosPaginados")
        .mockResolvedValueOnce([]);
      const spyContar = vi
        .spyOn(recursoRepository, "contarRecursos")
        .mockResolvedValueOnce(0);

      const req = new NextRequest("http://localhost:3000/api/recursos?estado=DISPONIBLE", {
        headers: { "x-user-id": encargadoId },
      });

      const res = await getRecursos(req);

      expect(res.status).toBe(200);
      expect(spyListar).toHaveBeenCalledWith(
        expect.objectContaining({ estado: "DISPONIBLE" }),
        expect.anything()
      );
      expect(spyContar).toHaveBeenCalledWith(
        expect.objectContaining({ estado: "DISPONIBLE" })
      );
    });

    it("debe aplicar filtro ?estado=ASIGNADO y aislar recursos ocupados en misiones", async () => {
      vi.spyOn(authGuard, "extraerUsuarioId").mockResolvedValue(encargadoId);
      vi.spyOn(seguridadService, "validarAccesoAdministrador").mockResolvedValue({
        id: encargadoId,
        rut: "33333333-3",
        nombre: "Encargado de Operaciones",
        email: "encargado@valdivia.cl",
        rolId: "20000000-0000-4000-8000-000000000003",
        rolNombre: "Encargado",
        activo: true,
      });

      const spyListar = vi
        .spyOn(recursoRepository, "listarRecursosPaginados")
        .mockResolvedValueOnce([]);
      const spyContar = vi
        .spyOn(recursoRepository, "contarRecursos")
        .mockResolvedValueOnce(0);

      const req = new NextRequest("http://localhost:3000/api/recursos?estado=ASIGNADO", {
        headers: { "x-user-id": encargadoId },
      });

      const res = await getRecursos(req);

      expect(res.status).toBe(200);
      expect(spyListar).toHaveBeenCalledWith(
        expect.objectContaining({ estado: "ASIGNADO" }),
        expect.anything()
      );
      expect(spyContar).toHaveBeenCalledWith(
        expect.objectContaining({ estado: "ASIGNADO" })
      );
    });
  });

  describe("CA-4: Control de acceso restringido para usuario con rol 'Encargado'", () => {
    it("debe responder 401 Unauthorized si la petición carece de identificación de usuario", async () => {
      vi.spyOn(authGuard, "extraerUsuarioId").mockRejectedValueOnce(
        new UnauthorizedError("No se ha proporcionado autenticación válida.")
      );

      const req = new NextRequest("http://localhost:3000/api/recursos");
      const res = await getRecursos(req);

      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.message).toContain("No se ha proporcionado autenticación válida.");
    });

    it("debe responder 403 Forbidden si el usuario carece del permiso 'recursos:leer' (ej. Informante)", async () => {
      vi.spyOn(authGuard, "extraerUsuarioId").mockResolvedValue("usr-informante");
      vi.spyOn(seguridadService, "validarAccesoAdministrador").mockRejectedValueOnce(
        new ForbiddenError("Acceso denegado. Se requiere el perfil de Administrador o permiso recursos:leer.")
      );

      const req = new NextRequest("http://localhost:3000/api/recursos", {
        headers: { "x-user-id": "usr-informante" },
      });
      const res = await getRecursos(req);

      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.message).toContain("Acceso denegado");
    });
  });

  describe("CA-5: Reflejo reactivo y dinámico de datos al asignarse un recurso", () => {
    it("debe calcular dinámicamente el cambio de estado cuando un recurso pasa a uso en terreno", async () => {
      vi.spyOn(authGuard, "extraerUsuarioId").mockResolvedValue(encargadoId);
      vi.spyOn(seguridadService, "validarAccesoAdministrador").mockResolvedValue({
        id: encargadoId,
        rut: "33333333-3",
        nombre: "Encargado de Operaciones",
        email: "encargado@valdivia.cl",
        rolId: "20000000-0000-4000-8000-000000000003",
        rolNombre: "Encargado",
        activo: true,
      });

      // Recurso recién asignado en misión: inventario=1, uso=1
      const filaAsignada = [
        {
          id: "rec-despachado",
          nombre: "Camión Aljibe 10.000L",
          es_individual: true,
          estado: "DISPONIBLE" as const,
          cantidad_inventario: 1,
          cantidad_en_uso: 1,
          cantidad_minima: 0,
          latitud: -39.8142,
          longitud: -73.2459,
          descripcion: "Despachado a emergencia Collico",
          detalles: { patente: "JL-8899" },
          delegacion_id: null,
          delegacion_codigo: null,
          delegacion_nombre: null,
          creado_por_id: "admin-id",
          creado_en: new Date("2026-09-15T08:00:00Z"),
          actualizado_en: new Date("2026-09-15T11:00:00Z"),
        },
      ];

      vi.spyOn(recursoRepository, "listarRecursosPaginados").mockResolvedValueOnce(
        filaAsignada as unknown as Awaited<ReturnType<typeof recursoRepository.listarRecursosPaginados>>
      );
      vi.spyOn(recursoRepository, "contarRecursos").mockResolvedValueOnce(1);

      const req = new NextRequest("http://localhost:3000/api/recursos?pagina=1&limite=10", {
        headers: { "x-user-id": encargadoId },
      });

      const res = await getRecursos(req);
      const body = await res.json();

      // Debe reflejar inmediatamente estado ASIGNADO y 0 disponible
      expect(body.data[0].estado).toBe("ASIGNADO");
      expect(body.data[0].cantidadDisponible).toBe(0);
      expect(body.data[0].cantidadEnUso).toBe(1);
    });
  });
});

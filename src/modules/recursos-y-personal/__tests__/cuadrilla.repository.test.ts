import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockTrx, mockDb } = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mockTrx: any = {
    selectFrom: vi.fn(),
    updateTable: vi.fn(),
    insertInto: vi.fn(),
    where: vi.fn(),
    set: vi.fn(),
    values: vi.fn(),
    forUpdate: vi.fn(),
    select: vi.fn(),
    innerJoin: vi.fn(),
    execute: vi.fn(),
    executeTakeFirst: vi.fn(),
    executeTakeFirstOrThrow: vi.fn(),
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mockDb: any = {
    selectFrom: vi.fn(),
    updateTable: vi.fn(),
    insertInto: vi.fn(),
    innerJoin: vi.fn(),
    leftJoin: vi.fn(),
    where: vi.fn(),
    set: vi.fn(),
    values: vi.fn(),
    select: vi.fn(),
    orderBy: vi.fn(),
    limit: vi.fn(),
    offset: vi.fn(),
    execute: vi.fn(),
    executeTakeFirst: vi.fn(),
    executeTakeFirstOrThrow: vi.fn(),
    transaction: vi.fn(),
  };

  return { mockTrx, mockDb };
});

vi.mock("@/lib/db", () => ({
  db: mockDb,
}));

import {
  desactivarCuadrillaTransaccional,
  obtenerCuadrillaPorIdParaEdicion,
  contarOtrasCuadrillasActivasPorDelegado,
  obtenerCuadrillaDetalleUnitario,
  listarCuadrillasPaginadas,
} from "../cuadrilla.repository";

describe("Capa de Persistencia Kysely - Cuadrillas (HU-82 / QA Bug Fixes)", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Configurar encadenamiento de mockTrx
    mockTrx.selectFrom.mockReturnValue(mockTrx);
    mockTrx.updateTable.mockReturnValue(mockTrx);
    mockTrx.insertInto.mockReturnValue(mockTrx);
    mockTrx.where.mockReturnValue(mockTrx);
    mockTrx.set.mockReturnValue(mockTrx);
    mockTrx.values.mockReturnValue(mockTrx);
    mockTrx.forUpdate.mockReturnValue(mockTrx);
    mockTrx.select.mockReturnValue(mockTrx);
    mockTrx.innerJoin.mockReturnValue(mockTrx);
    mockTrx.execute.mockResolvedValue([]);
    mockTrx.executeTakeFirst.mockResolvedValue(null);
    mockTrx.executeTakeFirstOrThrow.mockResolvedValue({});

    // Configurar encadenamiento de mockDb
    mockDb.selectFrom.mockReturnValue(mockDb);
    mockDb.updateTable.mockReturnValue(mockDb);
    mockDb.insertInto.mockReturnValue(mockDb);
    mockDb.innerJoin.mockReturnValue(mockDb);
    mockDb.leftJoin.mockReturnValue(mockDb);
    mockDb.where.mockReturnValue(mockDb);
    mockDb.set.mockReturnValue(mockDb);
    mockDb.values.mockReturnValue(mockDb);
    mockDb.select.mockReturnValue(mockDb);
    mockDb.orderBy.mockReturnValue(mockDb);
    mockDb.limit.mockReturnValue(mockDb);
    mockDb.offset.mockReturnValue(mockDb);
    mockDb.execute.mockResolvedValue([]);
    mockDb.executeTakeFirst.mockResolvedValue(null);
    mockDb.executeTakeFirstOrThrow.mockResolvedValue({});

    // db.transaction().execute(cb) ejecuta el callback con mockTrx
    mockDb.transaction.mockReturnValue({
      execute: (cb: (trx: typeof mockTrx) => Promise<unknown>) => cb(mockTrx),
    });
  });

  describe("1. desactivarCuadrillaTransaccional (BUG-H82-API-01, BUG-H82-API-04, BUG-H82-API-05)", () => {
    const cuadrillaId = "11111111-1111-4111-8111-111111111111";
    const usuarioAdminId = "22222222-2222-4222-8222-222222222222";
    const delegadoId = "33333333-3333-4333-8333-333333333333";
    const rolBrigadistaId = "44444444-4444-4444-8444-444444444444";

    it("debe aplicar bloqueo FOR UPDATE sobre la fila de cuadrilla para evitar condiciones de carrera (BUG-H82-API-05)", async () => {
      mockTrx.executeTakeFirst
        .mockResolvedValueOnce({
          id: cuadrillaId,
          nombre: "Cuadrilla Centro",
          estado: "DISPONIBLE",
          activo: true,
          usuario_delegado_id: delegadoId,
          eliminado_en: null,
        })
        .mockResolvedValueOnce(null) // misionActiva = null
        .mockResolvedValueOnce({ total: 0 }); // otrasCuadrillas = 0

      await desactivarCuadrillaTransaccional(cuadrillaId, usuarioAdminId, rolBrigadistaId);

      expect(mockTrx.forUpdate).toHaveBeenCalledTimes(1);
    });

    it("debe rechazar con error si la cuadrilla posee misiones activas detectadas dentro del bloqueo (BUG-H82-API-05)", async () => {
      mockTrx.executeTakeFirst
        .mockResolvedValueOnce({
          id: cuadrillaId,
          nombre: "Cuadrilla Centro",
          estado: "DISPONIBLE",
          activo: true,
          usuario_delegado_id: delegadoId,
          eliminado_en: null,
        })
        .mockResolvedValueOnce({ id: "mis-1", codigo: "MIS-001", estado: "EN_CURSO" }); // Misión activa concurrente

      await expect(
        desactivarCuadrillaTransaccional(cuadrillaId, usuarioAdminId, rolBrigadistaId)
      ).rejects.toThrow(/CONFLICT:No es posible desactivar la cuadrilla porque posee misiones activas/);
    });

    it("debe decrementar cantidad_en_uso en la tabla recurso para cada equipo desvinculado (CA-5 / BUG-H82-API-01)", async () => {
      mockTrx.executeTakeFirst
        .mockResolvedValueOnce({
          id: cuadrillaId,
          nombre: "Cuadrilla Centro",
          estado: "DISPONIBLE",
          activo: true,
          usuario_delegado_id: delegadoId,
          eliminado_en: null,
        })
        .mockResolvedValueOnce(null) // sin misiones activas
        .mockResolvedValueOnce({ total: 0 }) // otras cuadrillas delegado = 0
        .mockResolvedValueOnce(null) // delegado en otra cuadrilla = null
        .mockResolvedValueOnce(null); // delegado en otra patrulla = null

      // Recursos activos a desvincular
      mockTrx.execute
        .mockResolvedValueOnce([]) // update cuadrilla
        .mockResolvedValueOnce([
          { id: "cr-1", recurso_id: "rec-motobomba", cantidad_asignada: 2 },
          { id: "cr-2", recurso_id: "rec-motosierra", cantidad_asignada: 1 },
        ]) // recursosActivos select
        .mockResolvedValueOnce([]) // update recurso motobomba
        .mockResolvedValueOnce([]) // update recurso motosierra
        .mockResolvedValueOnce([]) // update cuadrilla_recurso
        .mockResolvedValueOnce([]) // trabajadoresActivos select
        .mockResolvedValueOnce([]); // update usuario

      const resultado = await desactivarCuadrillaTransaccional(
        cuadrillaId,
        usuarioAdminId,
        rolBrigadistaId
      );

      expect(resultado.recursosDesvinculados).toBe(2);
      expect(mockTrx.updateTable).toHaveBeenCalledWith("recurso");
      expect(mockTrx.updateTable).toHaveBeenCalledWith("cuadrilla_recurso");
    });

    it("debe restaurar usuario.estado_operativo = 'disponible' para trabajadores y delegado liberados (BUG-H82-API-04)", async () => {
      const personalTrabajadorId = "pers-trabajador-1";
      const usuarioTrabajadorId = "user-trabajador-1";

      mockTrx.executeTakeFirst
        .mockResolvedValueOnce({
          id: cuadrillaId,
          nombre: "Cuadrilla Norte",
          estado: "DISPONIBLE",
          activo: true,
          usuario_delegado_id: delegadoId,
          eliminado_en: null,
        })
        .mockResolvedValueOnce(null) // sin misiones activas
        .mockResolvedValueOnce(null) // trabajador no es delegado en otra cuadrilla
        .mockResolvedValueOnce(null) // trabajador no es líder patrulla
        .mockResolvedValueOnce(null) // trabajador no es personal en otra cuadrilla
        .mockResolvedValueOnce(null) // trabajador no es personal en patrulla
        .mockResolvedValueOnce({ total: 0 }) // otras cuadrillas delegado = 0
        .mockResolvedValueOnce({ id: "pers-delegado-1" }) // personalDelegado
        .mockResolvedValueOnce(null) // delegado no lidera otra cuadrilla
        .mockResolvedValueOnce(null) // delegado no lidera patrulla
        .mockResolvedValueOnce(null) // delegado no es personal en otra cuadrilla
        .mockResolvedValueOnce(null); // delegado no es personal en patrulla

      mockTrx.execute
        .mockResolvedValueOnce([]) // update cuadrilla
        .mockResolvedValueOnce([]) // recursosActivos (0)
        .mockResolvedValueOnce([
          {
            id: "cp-1",
            personal_id: personalTrabajadorId,
            usuario_id: usuarioTrabajadorId,
          },
        ]) // trabajadoresActivos
        .mockResolvedValueOnce([]) // update cuadrilla_personal
        .mockResolvedValueOnce([]) // update usuario trabajador disponible
        .mockResolvedValueOnce([]) // update rol delegado
        .mockResolvedValueOnce([]) // insert log_cambios_usuarios
        .mockResolvedValueOnce([]); // update usuario delegado disponible

      const resultado = await desactivarCuadrillaTransaccional(
        cuadrillaId,
        usuarioAdminId,
        rolBrigadistaId
      );

      expect(resultado.trabajadoresDesvinculados).toBe(1);
      expect(resultado.delegadoRevertido).toBe(true);
      expect(mockTrx.updateTable).toHaveBeenCalledWith("usuario");
      expect(mockTrx.set).toHaveBeenCalledWith({ estado_operativo: "disponible" });
    });
  });

  describe("2. obtenerCuadrillaPorIdParaEdicion y contarOtrasCuadrillasActivasPorDelegado (BUG-H82-API-05)", () => {
    it("obtenerCuadrillaPorIdParaEdicion debe filtrar activo = true y eliminado_en IS NULL", async () => {
      mockDb.executeTakeFirst.mockResolvedValueOnce({
        id: "cuad-1",
        nombre: "Cuadrilla Costa",
        estado: "DISPONIBLE",
        activo: true,
        delegacion_id: "del-1",
        usuario_delegado_id: "del-user-1",
        eliminado_en: null,
      });

      const res = await obtenerCuadrillaPorIdParaEdicion("cuad-1");

      expect(mockDb.selectFrom).toHaveBeenCalledWith("cuadrilla");
      expect(mockDb.where).toHaveBeenCalledWith("activo", "=", true);
      expect(mockDb.where).toHaveBeenCalledWith("eliminado_en", "is", null);
      expect(res?.activo).toBe(true);
    });

    it("contarOtrasCuadrillasActivasPorDelegado debe filtrar activo = true y eliminado_en IS NULL", async () => {
      mockDb.executeTakeFirst.mockResolvedValueOnce({ total: 1 });

      const total = await contarOtrasCuadrillasActivasPorDelegado("user-delegado", "cuad-1");

      expect(mockDb.where).toHaveBeenCalledWith("activo", "=", true);
      expect(mockDb.where).toHaveBeenCalledWith("eliminado_en", "is", null);
      expect(total).toBe(1);
    });
  });

  describe("3. Consultas históricas de cuadrillas desactivadas (BUG-H82-API-03)", () => {
    it("obtenerCuadrillaDetalleUnitario debe permitir consultar cuadrillas desactivadas proyectando activo y eliminado_en", async () => {
      mockDb.executeTakeFirst.mockResolvedValueOnce({
        id: "cuad-inactiva",
        nombre: "Cuadrilla Disuelta",
        estado: "NO_DISPONIBLE",
        activo: false,
        creado_en: new Date("2026-10-01"),
        actualizado_en: new Date("2026-10-26"),
        creado_por_id: "admin-1",
        actualizado_por_id: "admin-1",
        eliminado_en: new Date("2026-10-26"),
        eliminado_por_id: "admin-1",
        delegacion_id: "del-1",
        delegacion_nombre: "Norte",
        delegacion_codigo: "DEL-NORTE",
        delegado_id: "del-1",
        delegado_nombre: "Juan",
        delegado_email: "juan@valdivia.cl",
        delegado_rut: "12345678-9",
      });

      mockDb.execute
        .mockResolvedValueOnce([]) // recursos activos (vacío)
        .mockResolvedValueOnce([
          {
            id: "cr-hist-1",
            recurso_id: "rec-1",
            nombre: "Camioneta",
            cantidad_asignada: 1,
            es_individual: true,
          },
        ]) // recursos históricos
        .mockResolvedValueOnce([]) // trabajadores activos (vacío)
        .mockResolvedValueOnce([]); // trabajadores históricos

      const detalle = await obtenerCuadrillaDetalleUnitario("cuad-inactiva");

      expect(detalle).toBeDefined();
      expect(detalle?.activo).toBe(false);
      expect(detalle?.eliminado_en).toBeDefined();
      expect(detalle?.recursos).toHaveLength(1);
    });

    it("listarCuadrillasPaginadas debe consultar cuadrillas inactivas cuando estado = 'INACTIVAS' o activo = false", async () => {
      mockDb.executeTakeFirst.mockResolvedValueOnce({ total: 1 });
      mockDb.execute
        .mockResolvedValueOnce([
          {
            id: "cuad-1",
            nombre: "Cuadrilla Inactiva",
            estado: "NO_DISPONIBLE",
            activo: false,
            creado_en: new Date(),
            actualizado_en: new Date(),
            creado_por_id: null,
            actualizado_por_id: null,
            eliminado_en: new Date(),
            eliminado_por_id: null,
            delegacion_id: "del-1",
            delegacion_nombre: "Norte",
            delegacion_codigo: "NOR",
            delegado_id: "del-1",
            delegado_nombre: "Pedro",
            delegado_email: "pedro@valdivia.cl",
            delegado_rut: "11111111-1",
          },
        ])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const resultado = await listarCuadrillasPaginadas({
        pagina: 1,
        limite: 10,
        estado: "INACTIVAS",
      });

      expect(resultado.cuadrillas).toHaveLength(1);
      expect(resultado.cuadrillas[0].activo).toBe(false);
      expect(resultado.cuadrillas[0].eliminado_en).toBeDefined();
    });
  });
});

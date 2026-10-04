import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  ListarPuntosCriticosQuerySchema,
  PuntoCriticoItemResponseSchema,
  ActualizarPuntoCriticoBodySchema,
  PuntoCriticoDetalleResponseSchema,
  PuntoCriticoIdParamSchema,
} from "../punto-critico.schema";
import {
  listarPuntosCriticos,
  mapearFilaPuntoCritico,
  mapearFilaPuntoCriticoDetalle,
  obtenerDetallePuntoCritico,
  editarPuntoCritico,
} from "../punto-critico.service";
import * as puntoCriticoRepository from "../punto-critico.repository";
import { seguridadService } from "@/modules/seguridad/service";
import {
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  BadRequestError,
  ConflictError,
} from "@/modules/seguridad/errors";
import {
  PERMISO_LISTAR_PUNTOS_CRITICOS,
  PERMISO_EDITAR_PUNTO_CRITICO,
} from "@/modules/seguridad/permisos.constants";

describe("Módulo Eventos ATP / Puntos Críticos (HU-57) - Pruebas Unitarias", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("1. Validación de Esquemas Zod", () => {
    it("debe validar y normalizar parámetros por defecto de paginación", () => {
      const parsed = ListarPuntosCriticosQuerySchema.parse({});
      expect(parsed.pagina).toBe(1);
      expect(parsed.limite).toBe(10);
      expect(parsed.delegacionId).toBeUndefined();
      expect(parsed.activo).toBeUndefined();
      expect(parsed.prioridad).toBeUndefined();
    });

    it("debe transformar el parámetro activo tipo string ('true' / 'false') a boolean", () => {
      const parsedTrue = ListarPuntosCriticosQuerySchema.parse({ activo: "true" });
      expect(parsedTrue.activo).toBe(true);

      const parsedFalse = ListarPuntosCriticosQuerySchema.parse({ activo: "false" });
      expect(parsedFalse.activo).toBe(false);
    });

    it("debe rechazar prioridades no reconocidas por el catálogo", () => {
      const resultado = ListarPuntosCriticosQuerySchema.safeParse({
        prioridad: "URGENTE_NO_VALIDO",
      });
      expect(resultado.success).toBe(false);
    });

    it("debe validar un esquema de item de punto crítico completo", () => {
      const itemValido = {
        id: "40000000-0000-4000-8000-000000000001",
        codigo: "PC-ANG-01",
        nombre: "Sector Humedal Angachilla",
        descripcion: "Zona baja con riesgo de anegamiento",
        tipoRiesgo: "Inundación fluvial",
        prioridad: "ALTA",
        activo: true,
        estadoTexto: "Activo",
        latitud: -39.8456,
        longitud: -73.2389,
        delegacion: {
          id: "30000000-0000-4000-8000-000000000001",
          codigo: "DEL-SUR",
          nombre: "Delegación Municipal Sur",
        },
        creadoEn: "2026-06-15T12:00:00.000Z",
      };

      const resultado = PuntoCriticoItemResponseSchema.safeParse(itemValido);
      expect(resultado.success).toBe(true);
    });
  });

  describe("2. Mapeo de Fila a DTO (mapearFilaPuntoCritico)", () => {
    it("debe convertir coordenadas a números y formatear estado y delegación", () => {
      const fecha = new Date("2026-07-01T10:00:00.000Z");
      const fila: puntoCriticoRepository.FilaPuntoCriticoConDelegacion = {
        id: "40000000-0000-4000-8000-000000000001",
        codigo: "PC-CALLE-01",
        nombre: "Costanera Arturo Prat - Feria Fluvial",
        descripcion: "Riesgo de pleamar y desborde",
        tipo_riesgo: "Marejada fluvial",
        prioridad: "CRITICA",
        activo: true,
        latitud: "-39.8142",
        longitud: "-73.2459",
        creado_en: fecha,
        delegacion_id: "30000000-0000-4000-8000-000000000002",
        delegacion_codigo: "DEL-CC",
        delegacion_nombre: "Delegación Municipal Calle Calle",
      };

      const dto = mapearFilaPuntoCritico(fila);

      expect(dto.id).toBe(fila.id);
      expect(dto.codigo).toBe(fila.codigo);
      expect(dto.latitud).toBe(-39.8142);
      expect(dto.longitud).toBe(-73.2459);
      expect(dto.activo).toBe(true);
      expect(dto.estadoTexto).toBe("Activo");
      expect(dto.delegacion).toEqual({
        id: "30000000-0000-4000-8000-000000000002",
        codigo: "DEL-CC",
        nombre: "Delegación Municipal Calle Calle",
      });
      expect(dto.creadoEn).toBe(fecha.toISOString());
    });

    it("debe asignar delegación null si no tiene asignada y estadoTexto 'Inactivo' si activo es false", () => {
      const fila: puntoCriticoRepository.FilaPuntoCriticoConDelegacion = {
        id: "40000000-0000-4000-8000-000000000002",
        codigo: "PC-GEN-02",
        nombre: "Sector Inactivo Sin Delegación",
        descripcion: null,
        tipo_riesgo: null,
        prioridad: "BAJA",
        activo: false,
        latitud: -39.8,
        longitud: -73.2,
        creado_en: new Date(),
        delegacion_id: null,
        delegacion_codigo: null,
        delegacion_nombre: null,
      };

      const dto = mapearFilaPuntoCritico(fila);
      expect(dto.delegacion).toBeNull();
      expect(dto.activo).toBe(false);
      expect(dto.estadoTexto).toBe("Inactivo");
      expect(dto.tipoRiesgo).toBeNull();
    });
  });

  describe("3. Servicio listarPuntosCriticos - Control de Acceso (RBAC)", () => {
    it("debe rechazar con UnauthorizedError si no se envía usuarioId", async () => {
      vi.spyOn(seguridadService, "validarAccesoAdministrador").mockRejectedValueOnce(
        new UnauthorizedError("Cabecera X-User-Id requerida para autenticación.")
      );

      await expect(listarPuntosCriticos({}, null)).rejects.toThrow(UnauthorizedError);
    });

    it("debe rechazar con ForbiddenError si el usuario no tiene rol Administrador", async () => {
      vi.spyOn(seguridadService, "validarAccesoAdministrador").mockRejectedValueOnce(
        new ForbiddenError("Acceso denegado. Se requiere el perfil de Administrador.")
      );

      await expect(
        listarPuntosCriticos({}, "00000000-0000-4000-8000-000000000002")
      ).rejects.toThrow(ForbiddenError);
    });

    it("debe invocar a validarAccesoAdministrador pasando explícitamente [PERMISO_LISTAR_PUNTOS_CRITICOS]", async () => {
      const spy = vi
        .spyOn(seguridadService, "validarAccesoAdministrador")
        .mockResolvedValueOnce({
          id: "00000000-0000-4000-8000-000000000001",
          rut: "11111111-1",
          nombre: "Admin SGRAI",
          email: "admin@valdivia.cl",
          activo: true,
          rolId: "20000000-0000-4000-8000-000000000001",
          rolNombre: "Administrador",
        });

      vi.spyOn(puntoCriticoRepository, "listarPuntosCriticosPaginados").mockResolvedValueOnce([]);
      vi.spyOn(puntoCriticoRepository, "contarPuntosCriticos").mockResolvedValueOnce(0);

      await listarPuntosCriticos({}, "00000000-0000-4000-8000-000000000001");

      expect(spy).toHaveBeenCalledWith("00000000-0000-4000-8000-000000000001", [
        PERMISO_LISTAR_PUNTOS_CRITICOS,
      ]);
    });
  });

  describe("4. Servicio listarPuntosCriticos - Casos de Uso y Negocio", () => {
    it("Criterio de Aceptación 3: debe retornar lista vacía y total 0 cuando no hay puntos críticos", async () => {
      vi.spyOn(seguridadService, "validarAccesoAdministrador").mockResolvedValueOnce({
        id: "00000000-0000-4000-8000-000000000001",
        rut: "11111111-1",
        nombre: "Admin SGRAI",
        email: "admin@valdivia.cl",
        activo: true,
        rolId: "20000000-0000-4000-8000-000000000001",
        rolNombre: "Administrador",
      });

      vi.spyOn(puntoCriticoRepository, "listarPuntosCriticosPaginados").mockResolvedValueOnce([]);
      vi.spyOn(puntoCriticoRepository, "contarPuntosCriticos").mockResolvedValueOnce(0);

      const respuesta = await listarPuntosCriticos(
        { pagina: 1, limite: 10 },
        "00000000-0000-4000-8000-000000000001"
      );

      expect(respuesta.data).toEqual([]);
      expect(respuesta.meta).toEqual({
        total: 0,
        pagina: 1,
        limite: 10,
        totalPaginas: 0,
      });
    });

    it("Criterio de Aceptación 1 y 2: debe retornar lista con datos completos y paginación calculada", async () => {
      vi.spyOn(seguridadService, "validarAccesoAdministrador").mockResolvedValueOnce({
        id: "00000000-0000-4000-8000-000000000001",
        rut: "11111111-1",
        nombre: "Admin SGRAI",
        email: "admin@valdivia.cl",
        activo: true,
        rolId: "20000000-0000-4000-8000-000000000001",
        rolNombre: "Administrador",
      });

      const filasMock: puntoCriticoRepository.FilaPuntoCriticoConDelegacion[] = [
        {
          id: "40000000-0000-4000-8000-000000000001",
          codigo: "PC-ANG-01",
          nombre: "Sector Humedal Angachilla",
          descripcion: "Desborde de estero en invierno",
          tipo_riesgo: "Inundación",
          prioridad: "ALTA",
          activo: true,
          latitud: -39.8456,
          longitud: -73.2389,
          creado_en: new Date("2026-05-10T14:30:00.000Z"),
          delegacion_id: "30000000-0000-4000-8000-000000000001",
          delegacion_codigo: "DEL-SUR",
          delegacion_nombre: "Delegación Municipal Sur",
        },
      ];

      vi.spyOn(puntoCriticoRepository, "listarPuntosCriticosPaginados").mockResolvedValueOnce(filasMock);
      vi.spyOn(puntoCriticoRepository, "contarPuntosCriticos").mockResolvedValueOnce(1);

      const respuesta = await listarPuntosCriticos(
        { pagina: 1, limite: 10, prioridad: "ALTA", activo: true },
        "00000000-0000-4000-8000-000000000001"
      );

      expect(respuesta.data).toHaveLength(1);
      expect(respuesta.data[0].codigo).toBe("PC-ANG-01");
      expect(respuesta.data[0].prioridad).toBe("ALTA");
      expect(respuesta.data[0].delegacion?.nombre).toBe("Delegación Municipal Sur");
      expect(respuesta.meta).toEqual({
        total: 1,
        pagina: 1,
        limite: 10,
        totalPaginas: 1,
      });
    });
  });

  describe("4. Edición de Punto Crítico (HU-55) - Esquemas Zod", () => {
    it("debe validar un cuerpo de edición con datos válidos", () => {
      const payload = {
        nombre: "Sector Humedal Angachilla - Editado",
        descripcion: "Monitoreo reforzado de caudal",
        tipoRiesgo: "Anegamiento severo",
        prioridad: "CRITICA",
        delegacionId: "30000000-0000-4000-8000-000000000001",
        latitud: -39.8456,
        longitud: -73.2389,
      };

      const resultado = ActualizarPuntoCriticoBodySchema.safeParse(payload);
      expect(resultado.success).toBe(true);
    });

    it("debe rechazar nombres de menos de 3 caracteres", () => {
      const payload = {
        nombre: "ab",
        prioridad: "MEDIA",
        latitud: -39.8,
        longitud: -73.2,
      };

      const resultado = ActualizarPuntoCriticoBodySchema.safeParse(payload);
      expect(resultado.success).toBe(false);
      if (!resultado.success) {
        expect(resultado.error.issues[0].message).toContain("al menos 3 caracteres");
      }
    });

    it("debe rechazar coordenadas fuera de rango (latitud > 90 o longitud > 180)", () => {
      const payloadLatInvalida = {
        nombre: "Punto Inválido",
        prioridad: "ALTA",
        latitud: 95.5,
        longitud: -73.2,
      };
      expect(ActualizarPuntoCriticoBodySchema.safeParse(payloadLatInvalida).success).toBe(false);

      const payloadLngInvalida = {
        nombre: "Punto Inválido",
        prioridad: "ALTA",
        latitud: -39.8,
        longitud: 185.0,
      };
      expect(ActualizarPuntoCriticoBodySchema.safeParse(payloadLngInvalida).success).toBe(false);
    });

    it("debe validar ID de parámetro UUID correcto", () => {
      expect(
        PuntoCriticoIdParamSchema.safeParse({ id: "40000000-0000-4000-8000-000000000001" }).success
      ).toBe(true);
      expect(PuntoCriticoIdParamSchema.safeParse({ id: "id-invalido" }).success).toBe(false);
    });

    it("debe validar el esquema de respuesta de detalle con auditoría", () => {
      const detalleValido = {
        id: "40000000-0000-4000-8000-000000000001",
        codigo: "PC-ANG-01",
        nombre: "Sector Humedal Angachilla",
        descripcion: "Zona baja con riesgo de anegamiento",
        tipoRiesgo: "Inundación fluvial",
        prioridad: "ALTA",
        activo: true,
        estadoTexto: "Activo",
        latitud: -39.8456,
        longitud: -73.2389,
        delegacion: {
          id: "30000000-0000-4000-8000-000000000001",
          codigo: "DEL-SUR",
          nombre: "Delegación Municipal Sur",
        },
        creadoEn: "2026-06-15T12:00:00.000Z",
        actualizadoEn: "2026-10-04T19:00:00.000Z",
        actualizadoPorId: "00000000-0000-4000-8000-000000000001",
      };

      const resultado = PuntoCriticoDetalleResponseSchema.safeParse(detalleValido);
      expect(resultado.success).toBe(true);
    });

    it("debe verificar que la constante de permiso de edición coincida con el catálogo", () => {
      expect(PERMISO_EDITAR_PUNTO_CRITICO).toBe("puntos_criticos:editar");
    });

    it("debe mapear correctamente una fila con auditoría de edición mediante mapearFilaPuntoCriticoDetalle", () => {
      const fila: puntoCriticoRepository.FilaPuntoCriticoConDelegacion = {
        id: "40000000-0000-4000-8000-000000000001",
        codigo: "PC-ANG-01",
        nombre: "Sector Humedal Angachilla",
        descripcion: "Zona baja",
        tipo_riesgo: "Inundación",
        prioridad: "ALTA",
        activo: true,
        latitud: -39.8456,
        longitud: -73.2389,
        creado_en: new Date("2026-06-15T12:00:00.000Z"),
        actualizado_en: new Date("2026-10-04T19:00:00.000Z"),
        actualizado_por_id: "00000000-0000-4000-8000-000000000001",
        delegacion_id: "30000000-0000-4000-8000-000000000001",
        delegacion_codigo: "DEL-SUR",
        delegacion_nombre: "Delegación Municipal Sur",
      };

      const dto = mapearFilaPuntoCriticoDetalle(fila);
      expect(dto.id).toBe(fila.id);
      expect(dto.actualizadoPorId).toBe(fila.actualizado_por_id);
      expect(dto.actualizadoEn).toBe(new Date("2026-10-04T19:00:00.000Z").toISOString());
    });
  });

  describe("5. Edición de Punto Crítico (HU-55) - Lógica de Servicio", () => {
    const adminMock = {
      id: "00000000-0000-4000-8000-000000000001",
      rut: "11111111-1",
      nombre: "Admin SGRAI",
      email: "admin@valdivia.cl",
      activo: true,
      rolId: "20000000-0000-4000-8000-000000000001",
      rolNombre: "Administrador",
    };

    const puntoExistenteMock: puntoCriticoRepository.FilaPuntoCriticoConDelegacion = {
      id: "40000000-0000-4000-8000-000000000001",
      codigo: "PC-ANG-01",
      nombre: "Sector Humedal Angachilla",
      descripcion: "Zona baja vulnerable",
      tipo_riesgo: "Inundación",
      prioridad: "ALTA",
      activo: true,
      latitud: -39.8456,
      longitud: -73.2389,
      creado_en: new Date("2026-05-10T14:30:00.000Z"),
      actualizado_en: null,
      actualizado_por_id: null,
      delegacion_id: "30000000-0000-4000-8000-000000000001",
      delegacion_codigo: "DEL-SUR",
      delegacion_nombre: "Delegación Municipal Sur",
    };

    it("debe rechazar edición si el usuario no es Administrador", async () => {
      vi.spyOn(seguridadService, "validarAccesoAdministrador").mockRejectedValueOnce(
        new ForbiddenError("Acceso denegado. Se requiere perfil de Administrador.")
      );

      await expect(
        editarPuntoCritico(
          "40000000-0000-4000-8000-000000000001",
          {
            nombre: "Nombre nuevo",
            prioridad: "ALTA",
            latitud: -39.84,
            longitud: -73.23,
          },
          "no-admin-id"
        )
      ).rejects.toThrow(ForbiddenError);
    });

    it("debe lanzar NotFoundError si el punto crítico no existe", async () => {
      vi.spyOn(seguridadService, "validarAccesoAdministrador").mockResolvedValueOnce(adminMock);
      vi.spyOn(puntoCriticoRepository, "obtenerPuntoCriticoDetallePorId").mockResolvedValueOnce(null);

      await expect(
        editarPuntoCritico(
          "99999999-9999-4999-8999-999999999999",
          {
            nombre: "Punto Inexistente",
            prioridad: "ALTA",
            latitud: -39.84,
            longitud: -73.23,
          },
          adminMock.id
        )
      ).rejects.toThrow(NotFoundError);
    });

    it("debe lanzar ConflictError si el punto crítico está desactivado (borrado lógico previo)", async () => {
      vi.spyOn(seguridadService, "validarAccesoAdministrador").mockResolvedValueOnce(adminMock);
      vi.spyOn(puntoCriticoRepository, "obtenerPuntoCriticoDetallePorId").mockResolvedValueOnce({
        ...puntoExistenteMock,
        activo: false,
      });

      await expect(
        editarPuntoCritico(
          puntoExistenteMock.id,
          {
            nombre: "Intento en Inactivo",
            prioridad: "MEDIA",
            latitud: -39.84,
            longitud: -73.23,
          },
          adminMock.id
        )
      ).rejects.toThrow(ConflictError);
    });

    it("debe lanzar BadRequestError si la delegación proporcionada no existe", async () => {
      vi.spyOn(seguridadService, "validarAccesoAdministrador").mockResolvedValueOnce(adminMock);
      vi.spyOn(puntoCriticoRepository, "obtenerPuntoCriticoDetallePorId").mockResolvedValueOnce(
        puntoExistenteMock
      );
      vi.spyOn(puntoCriticoRepository, "verificarDelegacionExiste").mockResolvedValueOnce(false);

      await expect(
        editarPuntoCritico(
          puntoExistenteMock.id,
          {
            nombre: "Nombre nuevo",
            prioridad: "MEDIA",
            delegacionId: "50000000-0000-4000-8000-000000000001",
            latitud: -39.8456,
            longitud: -73.2389,
          },
          adminMock.id
        )
      ).rejects.toThrow(BadRequestError);
    });

    it("Regla Opción A: debe permitir reubicar coordenadas aun cuando existan misiones activas en curso", async () => {
      vi.spyOn(seguridadService, "validarAccesoAdministrador").mockResolvedValueOnce(adminMock);
      vi.spyOn(puntoCriticoRepository, "obtenerPuntoCriticoDetallePorId")
        .mockResolvedValueOnce(puntoExistenteMock)
        .mockResolvedValueOnce({
          ...puntoExistenteMock,
          nombre: "Sector Trasladado",
          latitud: -39.8200,
          longitud: -73.2100,
          actualizado_en: new Date("2026-10-04T19:00:00.000Z"),
          actualizado_por_id: adminMock.id,
        });
      vi.spyOn(puntoCriticoRepository, "verificarDelegacionExiste").mockResolvedValueOnce(true);

      const actualizarSpy = vi
        .spyOn(puntoCriticoRepository, "actualizarPuntoCritico")
        .mockResolvedValueOnce({} as unknown as Awaited<ReturnType<typeof puntoCriticoRepository.actualizarPuntoCritico>>);

      const resultado = await editarPuntoCritico(
        puntoExistenteMock.id,
        {
          nombre: "Sector Trasladado",
          prioridad: "ALTA",
          latitud: -39.8200, // Coordenada modificada
          longitud: -73.2100,
        },
        adminMock.id
      );

      expect(actualizarSpy).toHaveBeenCalledTimes(1);
      expect(resultado.latitud).toBe(-39.82);
      expect(resultado.longitud).toBe(-73.21);
    });

    it("Regla Opción B: debe permitir editar campos descriptivos con misiones activas si las coordenadas no cambian", async () => {
      vi.spyOn(seguridadService, "validarAccesoAdministrador").mockResolvedValueOnce(adminMock);
      vi.spyOn(puntoCriticoRepository, "obtenerPuntoCriticoDetallePorId")
        .mockResolvedValueOnce(puntoExistenteMock)
        .mockResolvedValueOnce({
          ...puntoExistenteMock,
          nombre: "Sector Humedal Angachilla - Actualizado",
          descripcion: "Nueva descripción operativa",
          prioridad: "CRITICA",
          actualizado_en: new Date("2026-10-04T19:00:00.000Z"),
          actualizado_por_id: adminMock.id,
        });

      const actualizarSpy = vi
        .spyOn(puntoCriticoRepository, "actualizarPuntoCritico")
        .mockResolvedValueOnce({} as unknown as Awaited<ReturnType<typeof puntoCriticoRepository.actualizarPuntoCritico>>);

      const resultado = await editarPuntoCritico(
        puntoExistenteMock.id,
        {
          nombre: "Sector Humedal Angachilla - Actualizado",
          descripcion: "Nueva descripción operativa",
          prioridad: "CRITICA",
          latitud: -39.8456, // Misma latitud
          longitud: -73.2389, // Misma longitud
        },
        adminMock.id
      );

      expect(actualizarSpy).toHaveBeenCalledTimes(1);
      expect(resultado.nombre).toBe("Sector Humedal Angachilla - Actualizado");
      expect(resultado.prioridad).toBe("CRITICA");
      expect(resultado.codigo).toBe("PC-ANG-01"); // Inmutable
    });

    it("Flujo Feliz: debe actualizar datos y ubicación si no hay misiones activas y retornar auditoría", async () => {
      vi.spyOn(seguridadService, "validarAccesoAdministrador").mockResolvedValueOnce(adminMock);
      vi.spyOn(puntoCriticoRepository, "obtenerPuntoCriticoDetallePorId")
        .mockResolvedValueOnce(puntoExistenteMock)
        .mockResolvedValueOnce({
          ...puntoExistenteMock,
          nombre: "Sector Humedal Angachilla - Reubicado",
          latitud: -39.8500,
          longitud: -73.2400,
          actualizado_en: new Date("2026-10-04T19:15:00.000Z"),
          actualizado_por_id: adminMock.id,
        });

      vi.spyOn(puntoCriticoRepository, "verificarMisionesActivasPuntoCritico").mockResolvedValueOnce({
        tieneMisionesActivas: false,
        totalMisiones: 0,
        codigos: [],
      });

      const actualizarSpy = vi
        .spyOn(puntoCriticoRepository, "actualizarPuntoCritico")
        .mockResolvedValueOnce({} as unknown as Awaited<ReturnType<typeof puntoCriticoRepository.actualizarPuntoCritico>>);

      const resultado = await editarPuntoCritico(
        puntoExistenteMock.id,
        {
          nombre: "Sector Humedal Angachilla - Reubicado",
          prioridad: "ALTA",
          latitud: -39.8500,
          longitud: -73.2400,
        },
        adminMock.id
      );

      expect(actualizarSpy).toHaveBeenCalledTimes(1);
      expect(resultado.latitud).toBe(-39.85);
      expect(resultado.longitud).toBe(-73.24);
      expect(resultado.actualizadoPorId).toBe(adminMock.id);
    });

    it("debe retornar detalle de punto crítico para precarga mediante obtenerDetallePuntoCritico", async () => {
      vi.spyOn(seguridadService, "validarAccesoAdministrador").mockResolvedValueOnce(adminMock);
      vi.spyOn(puntoCriticoRepository, "obtenerPuntoCriticoDetallePorId").mockResolvedValueOnce(
        puntoExistenteMock
      );

      const detalle = await obtenerDetallePuntoCritico(puntoExistenteMock.id, adminMock.id);
      expect(detalle.id).toBe(puntoExistenteMock.id);
      expect(detalle.codigo).toBe(puntoExistenteMock.codigo);
      expect(detalle.delegacion?.codigo).toBe("DEL-SUR");
    });
  });
});

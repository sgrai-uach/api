import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  ListarPuntosCriticosQuerySchema,
  PuntoCriticoItemResponseSchema,
  PuntoCriticoIdParamSchema,
  EliminarPuntoCriticoResponseSchema,
  ActualizarPuntoCriticoBodySchema,
  PuntoCriticoDetalleResponseSchema,
} from "../punto-critico.schema";
import {
  listarPuntosCriticos,
  mapearFilaPuntoCritico,
  mapearFilaPuntoCriticoDetalle,
  obtenerDetallePuntoCritico,
  editarPuntoCritico,
  eliminarPuntoCritico,
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
  PERMISO_ELIMINAR_PUNTO_CRITICO,
} from "@/modules/seguridad/permisos.constants";
import * as socketModule from "@/lib/socket";

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

  describe("2. Mapeo de Fila a Objeto de Dominio (mapearFilaPuntoCritico)", () => {
    it("debe formatear campos correctamente y manejar delegación nula", () => {
      const filaDb: puntoCriticoRepository.FilaPuntoCriticoConDelegacion = {
        id: "40000000-0000-4000-8000-000000000002",
        codigo: "PC-COL-02",
        nombre: "Ladera Collico",
        descripcion: "Peligro de remoción en masa",
        tipo_riesgo: "Derrumbe",
        prioridad: "CRITICA",
        activo: true,
        latitud: "-39.8189",
        longitud: "-73.2123",
        creado_en: new Date("2026-06-18T09:30:00.000Z"),
        delegacion_id: null,
        delegacion_codigo: null,
        delegacion_nombre: null,
      };

      const resultado = mapearFilaPuntoCritico(filaDb);

      expect(resultado.id).toBe("40000000-0000-4000-8000-000000000002");
      expect(resultado.codigo).toBe("PC-COL-02");
      expect(resultado.latitud).toBe(-39.8189);
      expect(resultado.longitud).toBe(-73.2123);
      expect(resultado.delegacion).toBeNull();
      expect(resultado.estadoTexto).toBe("Activo");
      expect(resultado.creadoEn).toBe("2026-06-18T09:30:00.000Z");
    });

    it("debe asignar 'Inactivo' cuando activo es falso", () => {
      const filaDb: puntoCriticoRepository.FilaPuntoCriticoConDelegacion = {
        id: "40000000-0000-4000-8000-000000000005",
        codigo: "PC-COR-05",
        nombre: "Población Corvi",
        descripcion: null,
        tipo_riesgo: null,
        prioridad: "BAJA",
        activo: false,
        latitud: -39.8277,
        longitud: -73.2245,
        creado_en: new Date("2026-08-01T16:45:00.000Z"),
        delegacion_id: "30000000-0000-4000-8000-000000000004",
        delegacion_codigo: "DEL-CALLE",
        delegacion_nombre: "Delegación Municipal Calle Calle",
      };

      const resultado = mapearFilaPuntoCritico(filaDb);
      expect(resultado.activo).toBe(false);
      expect(resultado.estadoTexto).toBe("Inactivo");
      expect(resultado.delegacion?.nombre).toBe("Delegación Municipal Calle Calle");
    });
  });

  describe("3. Listado Paginado de Puntos Críticos (HU-57) - Lógica de Servicio", () => {
    const adminUser = {
      id: "00000000-0000-4000-8000-000000000001",
      rut: "11111111-1",
      nombre: "Admin SGRAI",
      email: "admin@valdivia.cl",
      activo: true,
      rolId: "20000000-0000-4000-8000-000000000001",
      rolNombre: "Administrador",
    };

    it("Criterio RBAC: debe rechazar acceso a usuarios no administradores (403 Forbidden)", async () => {
      const spyValidar = vi
        .spyOn(seguridadService, "validarAccesoAdministrador")
        .mockRejectedValueOnce(
          new ForbiddenError("Acceso denegado. Se requiere el perfil de Administrador.")
        );

      await expect(
        listarPuntosCriticos({ pagina: 1, limite: 10 }, "00000000-0000-4000-8000-000000000002")
      ).rejects.toThrow(ForbiddenError);

      expect(spyValidar).toHaveBeenCalledWith("00000000-0000-4000-8000-000000000002", [
        PERMISO_LISTAR_PUNTOS_CRITICOS,
      ]);
    });

    it("Criterio RBAC: debe rechazar acceso si no se suministra identificador de usuario (401 Unauthorized)", async () => {
      vi.spyOn(seguridadService, "validarAccesoAdministrador").mockRejectedValueOnce(
        new UnauthorizedError("Cabecera X-User-Id requerida para autenticación.")
      );

      await expect(listarPuntosCriticos({ pagina: 1, limite: 10 }, null)).rejects.toThrow(
        UnauthorizedError
      );
    });

    it("Criterio 3: debe retornar lista vacía con status 200 si no existen registros", async () => {
      vi.spyOn(seguridadService, "validarAccesoAdministrador").mockResolvedValueOnce(adminUser);
      vi.spyOn(puntoCriticoRepository, "listarPuntosCriticosPaginados").mockResolvedValueOnce([]);
      vi.spyOn(puntoCriticoRepository, "contarPuntosCriticos").mockResolvedValueOnce(0);

      const respuesta = await listarPuntosCriticos(
        { pagina: 1, limite: 10 },
        adminUser.id
      );

      expect(respuesta.data).toEqual([]);
      expect(respuesta.meta).toEqual({
        total: 0,
        pagina: 1,
        limite: 10,
        totalPaginas: 0,
      });
    });

    it("Criterios 1, 2 y 4: debe retornar colección paginada con metadatos calculados", async () => {
      const mockFilas: puntoCriticoRepository.FilaPuntoCriticoConDelegacion[] = [
        {
          id: "40000000-0000-4000-8000-000000000001",
          codigo: "PC-ANG-01",
          nombre: "Sector Humedal Angachilla",
          descripcion: "Anegamiento recurrente",
          tipo_riesgo: "Inundación",
          prioridad: "ALTA",
          activo: true,
          latitud: -39.8456,
          longitud: -73.2389,
          creado_en: new Date("2026-06-15T12:00:00.000Z"),
          delegacion_id: "30000000-0000-4000-8000-000000000002",
          delegacion_codigo: "DEL-SUR",
          delegacion_nombre: "Delegación Municipal Sur",
        },
      ];

      vi.spyOn(seguridadService, "validarAccesoAdministrador").mockResolvedValueOnce(adminUser);
      vi.spyOn(puntoCriticoRepository, "listarPuntosCriticosPaginados").mockResolvedValueOnce(
        mockFilas
      );
      vi.spyOn(puntoCriticoRepository, "contarPuntosCriticos").mockResolvedValueOnce(1);

      const respuesta = await listarPuntosCriticos(
        { pagina: 1, limite: 10, busqueda: "Angachilla" },
        adminUser.id
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

  describe("4. Edición de Punto Crítico (HU-55) y Eliminación (HU-56) - Esquemas Zod", () => {
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

    it("debe validar esquema PuntoCriticoIdParamSchema correctamente con UUID", () => {
      const valid = PuntoCriticoIdParamSchema.safeParse({
        id: "40000000-0000-4000-8000-000000000001",
      });
      expect(valid.success).toBe(true);

      const invalid = PuntoCriticoIdParamSchema.safeParse({ id: "id-invalido" });
      expect(invalid.success).toBe(false);
    });

    it("debe validar esquema EliminarPuntoCriticoResponseSchema", () => {
      const valid = EliminarPuntoCriticoResponseSchema.safeParse({
        message: "Punto crítico desactivado exitosamente del sistema.",
        id: "40000000-0000-4000-8000-000000000001",
        codigo: "PC-ANG-01",
        nombre: "Sector Humedal Angachilla",
        activo: false,
        eliminadoEn: "2026-10-04T00:30:00.000Z",
        eliminadoPorId: "00000000-0000-4000-8000-000000000001",
      });
      expect(valid.success).toBe(true);
    });

    it("debe verificar que la constante de permiso de eliminación coincida con el catálogo", () => {
      expect(PERMISO_ELIMINAR_PUNTO_CRITICO).toBe("puntos_criticos:eliminar");
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

  describe("6. Eliminación / Desactivación Lógica de Punto Crítico (HU-56) - Lógica de Servicio", () => {
    const adminUser = {
      id: "00000000-0000-4000-8000-000000000001",
      rut: "11111111-1",
      nombre: "Admin SGRAI",
      email: "admin@valdivia.cl",
      activo: true,
      rolId: "20000000-0000-4000-8000-000000000001",
      rolNombre: "Administrador",
    };

    it("Criterio RBAC: debe rechazar la desactivación si el usuario no tiene permisos", async () => {
      const spyValidar = vi
        .spyOn(seguridadService, "validarAccesoAdministrador")
        .mockRejectedValueOnce(
          new ForbiddenError("Acceso denegado. Se requiere perfil de Administrador.")
        );

      await expect(
        eliminarPuntoCritico("40000000-0000-4000-8000-000000000001", "no-admin")
      ).rejects.toThrow(ForbiddenError);

      expect(spyValidar).toHaveBeenCalledWith("no-admin", [
        PERMISO_ELIMINAR_PUNTO_CRITICO,
      ]);
    });

    it("debe lanzar NotFoundError si el punto crítico no existe", async () => {
      vi.spyOn(seguridadService, "validarAccesoAdministrador").mockResolvedValueOnce(adminUser);
      vi.spyOn(puntoCriticoRepository, "obtenerPuntoCriticoPorId").mockResolvedValueOnce(undefined);

      await expect(
        eliminarPuntoCritico("40000000-0000-4000-8000-000000000099", adminUser.id)
      ).rejects.toThrow(NotFoundError);
    });

    it("debe lanzar ConflictError si el punto crítico ya está inactivo", async () => {
      vi.spyOn(seguridadService, "validarAccesoAdministrador").mockResolvedValueOnce(adminUser);
      vi.spyOn(puntoCriticoRepository, "obtenerPuntoCriticoPorId").mockResolvedValueOnce({
        id: "40000000-0000-4000-8000-000000000001",
        codigo: "PC-ANG-01",
        nombre: "Sector Humedal Angachilla",
        descripcion: "Zona baja",
        tipo_riesgo: "Inundación",
        prioridad: "ALTA",
        activo: false,
        latitud: -39.84,
        longitud: -73.23,
        ubicacion: null,
        delegacion_id: null,
        creado_en: new Date(),
        actualizado_en: null,
        actualizado_por_id: null,
        eliminado_en: new Date(),
        eliminado_por_id: adminUser.id,
      });

      await expect(
        eliminarPuntoCritico("40000000-0000-4000-8000-000000000001", adminUser.id)
      ).rejects.toThrow(ConflictError);
    });

    it("Criterio 3: debe bloquear la eliminación con ConflictError si tiene misiones preventivas activas", async () => {
      vi.spyOn(seguridadService, "validarAccesoAdministrador").mockResolvedValueOnce(adminUser);
      vi.spyOn(puntoCriticoRepository, "obtenerPuntoCriticoPorId").mockResolvedValueOnce({
        id: "40000000-0000-4000-8000-000000000001",
        codigo: "PC-ANG-01",
        nombre: "Sector Humedal Angachilla",
        descripcion: "Zona baja",
        tipo_riesgo: "Inundación",
        prioridad: "ALTA",
        activo: true,
        latitud: -39.84,
        longitud: -73.23,
        ubicacion: null,
        delegacion_id: null,
        creado_en: new Date(),
        actualizado_en: null,
        actualizado_por_id: null,
        eliminado_en: null,
        eliminado_por_id: null,
      });

      vi.spyOn(puntoCriticoRepository, "verificarMisionesActivasPuntoCritico").mockResolvedValueOnce({
        tieneMisionesActivas: true,
        totalMisiones: 2,
        codigos: ["MIS-2026-001", "MIS-2026-002"],
      });

      await expect(
        eliminarPuntoCritico("40000000-0000-4000-8000-000000000001", adminUser.id)
      ).rejects.toThrowError(
        /No es posible eliminar el punto crítico 'Sector Humedal Angachilla' porque cuenta con 2 misión\(es\) preventivas activas o patrullas asignadas/
      );
    });

    it("Criterios 4, 5 y 6: debe aplicar borrado lógico, registrar auditoría y emitir evento Socket.io", async () => {
      vi.spyOn(seguridadService, "validarAccesoAdministrador").mockResolvedValueOnce(adminUser);
      vi.spyOn(puntoCriticoRepository, "obtenerPuntoCriticoPorId").mockResolvedValueOnce({
        id: "40000000-0000-4000-8000-000000000001",
        codigo: "PC-ANG-01",
        nombre: "Sector Humedal Angachilla",
        descripcion: "Zona baja",
        tipo_riesgo: "Inundación",
        prioridad: "ALTA",
        activo: true,
        latitud: -39.84,
        longitud: -73.23,
        ubicacion: null,
        delegacion_id: null,
        creado_en: new Date(),
        actualizado_en: null,
        actualizado_por_id: null,
        eliminado_en: null,
        eliminado_por_id: null,
      });

      vi.spyOn(puntoCriticoRepository, "verificarMisionesActivasPuntoCritico").mockResolvedValueOnce({
        tieneMisionesActivas: false,
        totalMisiones: 0,
        codigos: [],
      });

      const fechaEliminacion = new Date("2026-10-04T00:30:00.000Z");
      vi.spyOn(puntoCriticoRepository, "marcarPuntoCriticoEliminado").mockResolvedValueOnce({
        id: "40000000-0000-4000-8000-000000000001",
        codigo: "PC-ANG-01",
        nombre: "Sector Humedal Angachilla",
        activo: false,
        eliminado_en: fechaEliminacion,
        eliminado_por_id: adminUser.id,
      });

      const spySocket = vi.spyOn(socketModule, "emitirPuntoCriticoEliminado").mockReturnValue(undefined);

      const resultado = await eliminarPuntoCritico(
        "40000000-0000-4000-8000-000000000001",
        adminUser.id
      );

      expect(resultado.activo).toBe(false);
      expect(resultado.id).toBe("40000000-0000-4000-8000-000000000001");
      expect(resultado.codigo).toBe("PC-ANG-01");
      expect(resultado.eliminadoPorId).toBe(adminUser.id);
      expect(resultado.eliminadoEn).toBe(fechaEliminacion.toISOString());
      expect(spySocket).toHaveBeenCalledTimes(1);
      expect(spySocket).toHaveBeenCalledWith({
        id: "40000000-0000-4000-8000-000000000001",
        codigo: "PC-ANG-01",
        nombre: "Sector Humedal Angachilla",
        eliminadoPorId: adminUser.id,
        eliminadoEn: fechaEliminacion.toISOString(),
      });
    });
  });
});

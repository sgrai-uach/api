import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  ListarPuntosCriticosQuerySchema,
  PuntoCriticoItemResponseSchema,
  CrearPuntoCriticoBodySchema,
  TIPOS_RIESGO_PUNTO_CRITICO,
} from "../punto-critico.schema";
import {
  listarPuntosCriticos,
  mapearFilaPuntoCritico,
  crearPuntoCritico,
} from "../punto-critico.service";
import * as puntoCriticoRepository from "../punto-critico.repository";
import * as socketLib from "@/lib/socket";
import { seguridadService } from "@/modules/seguridad/service";
import {
  UnauthorizedError,
  ForbiddenError,
  BadRequestError,
} from "@/modules/seguridad/errors";
import { PERMISO_LISTAR_PUNTOS_CRITICOS } from "@/modules/seguridad/permisos.constants";

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

  describe("5. Creación de Puntos Críticos (HU-58)", () => {
    describe("5.1 Validación de CrearPuntoCriticoBodySchema", () => {
      it("debe validar un payload de creación completo y válido", () => {
        const bodyValido = {
          nombre: "Nuevo Sector Las Ánimas",
          descripcion: "Monitoreo por riesgo de remoción en ladera",
          tipoRiesgo: "Deslizamiento / Remoción en masa",
          prioridad: "ALTA",
          delegacionId: "30000000-0000-4000-8000-000000000001",
          latitud: -39.815,
          longitud: -73.235,
        };

        const parsed = CrearPuntoCriticoBodySchema.safeParse(bodyValido);
        expect(parsed.success).toBe(true);
        if (parsed.success) {
          expect(parsed.data.nombre).toBe("Nuevo Sector Las Ánimas");
          expect(parsed.data.prioridad).toBe("ALTA");
          expect(parsed.data.tipoRiesgo).toBe("Deslizamiento / Remoción en masa");
        }
      });

      it("debe aplicar prioridad MEDIA por defecto si no es especificada", () => {
        const bodyMinimo = {
          nombre: "Punto de Monitoreo Puente Calle Calle",
          latitud: -39.8123,
          longitud: -73.2289,
        };

        const parsed = CrearPuntoCriticoBodySchema.safeParse(bodyMinimo);
        expect(parsed.success).toBe(true);
        if (parsed.success) {
          expect(parsed.data.prioridad).toBe("MEDIA");
          expect(parsed.data.tipoRiesgo).toBeUndefined();
          expect(parsed.data.descripcion).toBeUndefined();
        }
      });

      it("debe rechazar nombres con menos de 3 caracteres", () => {
        const resultado = CrearPuntoCriticoBodySchema.safeParse({
          nombre: "AB",
          latitud: -39.8,
          longitud: -73.2,
        });

        expect(resultado.success).toBe(false);
      });

      it("debe rechazar coordenadas de latitud o longitud fuera de rango", () => {
        const latInvalida = CrearPuntoCriticoBodySchema.safeParse({
          nombre: "Coordenada fuera de rango",
          latitud: -95,
          longitud: -73.2,
        });
        expect(latInvalida.success).toBe(false);

        const lngInvalida = CrearPuntoCriticoBodySchema.safeParse({
          nombre: "Coordenada fuera de rango",
          latitud: -39.8,
          longitud: 190,
        });
        expect(lngInvalida.success).toBe(false);
      });

      it("debe admitir opciones sugeridas de TIPOS_RIESGO_PUNTO_CRITICO y opción Otro (VARCHAR)", () => {
        expect(TIPOS_RIESGO_PUNTO_CRITICO).toContain("Otro");
        expect(TIPOS_RIESGO_PUNTO_CRITICO).toContain("Inundación y anegamiento");

        const resultadoOtro = CrearPuntoCriticoBodySchema.safeParse({
          nombre: "Punto de prueba riesgo personalizado",
          tipoRiesgo: "Afloramiento de aguas subterráneas",
          latitud: -39.8,
          longitud: -73.2,
        });
        expect(resultadoOtro.success).toBe(true);
      });
    });

    describe("5.2 Servicio crearPuntoCritico", () => {
      const adminMock = {
        id: "00000000-0000-4000-8000-000000000001",
        rut: "11111111-1",
        nombre: "Admin SGRAI",
        email: "admin@valdivia.cl",
        activo: true,
        rolId: "20000000-0000-4000-8000-000000000001",
        rolNombre: "Administrador",
      };

      it("Flujo Feliz: debe autogenerar código PC-VAL-001, insertar y emitir notificación Socket.io", async () => {
        vi.spyOn(seguridadService, "validarAccesoAdministrador").mockResolvedValueOnce(adminMock);
        vi.spyOn(puntoCriticoRepository, "generarSiguienteCodigoPuntoCritico").mockResolvedValueOnce("PC-VAL-001");

        const filaMock: puntoCriticoRepository.FilaPuntoCriticoConDelegacion = {
          id: "40000000-0000-4000-8000-000000000099",
          codigo: "PC-VAL-001",
          nombre: "Punto Costanera Norte",
          descripcion: "Oleaje fluvial alto",
          tipo_riesgo: "Inundación y anegamiento",
          prioridad: "MEDIA",
          activo: true,
          latitud: -39.81,
          longitud: -73.24,
          creado_en: new Date("2026-10-05T00:00:00.000Z"),
          creado_por_id: adminMock.id,
          delegacion_id: null,
          delegacion_codigo: null,
          delegacion_nombre: null,
        };

        const insertarSpy = vi
          .spyOn(puntoCriticoRepository, "insertarPuntoCritico")
          .mockResolvedValueOnce(filaMock);

        const socketSpy = vi.spyOn(socketLib, "emitirPuntoCriticoCreado");

        const resultado = await crearPuntoCritico(
          {
            nombre: "Punto Costanera Norte",
            descripcion: "Oleaje fluvial alto",
            tipoRiesgo: "Inundación y anegamiento",
            prioridad: "MEDIA",
            latitud: -39.81,
            longitud: -73.24,
          },
          adminMock.id
        );

        expect(insertarSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            codigo: "PC-VAL-001",
            nombre: "Punto Costanera Norte",
            latitud: -39.81,
            longitud: -73.24,
          }),
          adminMock.id
        );

        expect(socketSpy).toHaveBeenCalledTimes(1);
        expect(resultado.codigo).toBe("PC-VAL-001");
        expect(resultado.creadoPorId).toBe(adminMock.id);
        expect(resultado.activo).toBe(true);
      });

      it("Flujo Feliz con Delegación: debe consultar delegación y generar código con prefijo territorial", async () => {
        vi.spyOn(seguridadService, "validarAccesoAdministrador").mockResolvedValueOnce(adminMock);
        vi.spyOn(puntoCriticoRepository, "obtenerDelegacionPorId").mockResolvedValueOnce({
          id: "30000000-0000-4000-8000-000000000002",
          codigo: "DEL_SUR",
          nombre: "Delegación Municipal Sur",
        });
        vi.spyOn(puntoCriticoRepository, "generarSiguienteCodigoPuntoCritico").mockResolvedValueOnce("PC-SUR-005");

        const filaMock: puntoCriticoRepository.FilaPuntoCriticoConDelegacion = {
          id: "40000000-0000-4000-8000-000000000088",
          codigo: "PC-SUR-005",
          nombre: "Sector Guacamayo Sur",
          descripcion: null,
          tipo_riesgo: "Desborde de cauce / humedal",
          prioridad: "ALTA",
          activo: true,
          latitud: -39.85,
          longitud: -73.25,
          creado_en: new Date("2026-10-05T00:00:00.000Z"),
          creado_por_id: adminMock.id,
          delegacion_id: "30000000-0000-4000-8000-000000000002",
          delegacion_codigo: "DEL_SUR",
          delegacion_nombre: "Delegación Municipal Sur",
        };

        vi.spyOn(puntoCriticoRepository, "insertarPuntoCritico").mockResolvedValueOnce(filaMock);
        const socketSpy = vi.spyOn(socketLib, "emitirPuntoCriticoCreado");

        const resultado = await crearPuntoCritico(
          {
            nombre: "Sector Guacamayo Sur",
            tipoRiesgo: "Desborde de cauce / humedal",
            prioridad: "ALTA",
            delegacionId: "30000000-0000-4000-8000-000000000002",
            latitud: -39.85,
            longitud: -73.25,
          },
          adminMock.id
        );

        expect(resultado.codigo).toBe("PC-SUR-005");
        expect(resultado.delegacion?.codigo).toBe("DEL_SUR");
        expect(socketSpy).toHaveBeenCalledTimes(1);
      });

      it("debe lanzar BadRequestError si la delegación territorial proporcionada no existe", async () => {
        vi.spyOn(seguridadService, "validarAccesoAdministrador").mockResolvedValueOnce(adminMock);
        vi.spyOn(puntoCriticoRepository, "obtenerDelegacionPorId").mockResolvedValueOnce(null);

        await expect(
          crearPuntoCritico(
            {
              nombre: "Punto con delegación inexistente",
              delegacionId: "30000000-0000-4000-8000-999999999999",
              latitud: -39.8,
              longitud: -73.2,
            },
            adminMock.id
          )
        ).rejects.toThrow(BadRequestError);
      });

      it("debe rechazar con ForbiddenError si el usuario no tiene rol Administrador", async () => {
        vi.spyOn(seguridadService, "validarAccesoAdministrador").mockRejectedValueOnce(
          new ForbiddenError("Acceso denegado. Se requiere el perfil de Administrador.")
        );

        await expect(
          crearPuntoCritico(
            {
              nombre: "Punto sin permiso",
              latitud: -39.8,
              longitud: -73.2,
            },
            "00000000-0000-4000-8000-000000000002"
          )
        ).rejects.toThrow(ForbiddenError);
      });

      it("debe rechazar con UnauthorizedError si no se provee usuario", async () => {
        vi.spyOn(seguridadService, "validarAccesoAdministrador").mockRejectedValueOnce(
          new UnauthorizedError("Cabecera X-User-Id requerida para autenticación.")
        );

        await expect(
          crearPuntoCritico({
            nombre: "Punto anónimo",
            latitud: -39.8,
            longitud: -73.2,
          })
        ).rejects.toThrow(UnauthorizedError);
      });
    });
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  validarRutChileno,
  normalizarRutChileno,
  generarCodigoSeguimientoNumerico,
} from "../aviso-incidente.utils";
import {
  CrearAvisoIncidenteInputSchema,
  TIPOS_AFECTACION,
  DETALLE_ESTADOS_SEGUIMIENTO,
} from "../aviso-incidente.schema";
import { geocodificarDireccion } from "@/modules/geolocalizacion/geocoding.service";
import * as repository from "../aviso-incidente.repository";
import * as socket from "@/lib/socket";
import {
  registrarAvisoDesdeChatbot,
  consultarAvisoPorSeguimiento,
  cambiarEstadoIncidente,
} from "../aviso-incidente.service";

describe("Módulo Incidentes - Avisos e Incidentes (ERD Alignment)", () => {
  describe("1. Validación de RUT Chileno (Módulo 11)", () => {
    it("debe validar correctamente RUTs chilenos reales con formato estándar o puntos", () => {
      expect(validarRutChileno("11111111-1")).toBe(true);
      expect(validarRutChileno("12.345.678-5")).toBe(true);
      expect(validarRutChileno("12345678-5")).toBe(true);
      expect(validarRutChileno("7654321-6")).toBe(true);
      expect(validarRutChileno("19876543-0")).toBe(true);
    });

    it("debe validar correctamente RUTs que terminan en dígito verificador 'K' (mayúscula o minúscula)", () => {
      expect(validarRutChileno("11111112-K")).toBe(true);
      expect(validarRutChileno("11.111.112-k")).toBe(true);
    });

    it("debe rechazar RUTs con dígito verificador incorrecto", () => {
      expect(validarRutChileno("11111111-2")).toBe(false);
      expect(validarRutChileno("12345678-9")).toBe(false);
      expect(validarRutChileno("11111112-0")).toBe(false);
    });

    it("debe rechazar cadenas vacías o con formato no numérico en el cuerpo", () => {
      expect(validarRutChileno("")).toBe(false);
      expect(validarRutChileno("ABCDEFGH-1")).toBe(false);
      expect(validarRutChileno("123")).toBe(false);
    });

    it("debe normalizar el RUT al formato estándar XXXXXXXX-Y", () => {
      expect(normalizarRutChileno("12.345.678-5")).toBe("12345678-5");
      expect(normalizarRutChileno("11111112-k")).toBe("11111112-K");
    });
  });

  describe("2. Generador de Código de Seguimiento Numérico", () => {
    it("debe generar un código estrictamente numérico de 8 dígitos", () => {
      const codigo = generarCodigoSeguimientoNumerico();
      expect(codigo).toMatch(/^\d{8}$/);
      expect(Number(codigo)).toBeGreaterThanOrEqual(10000000);
      expect(Number(codigo)).toBeLessThanOrEqual(99999999);
    });

    it("debe generar códigos con variación aleatoria", () => {
      const codigo1 = generarCodigoSeguimientoNumerico();
      const codigo2 = generarCodigoSeguimientoNumerico();
      expect(codigo1).not.toBe(codigo2);
    });
  });

  describe("3. Validación de Esquema Zod (CrearAvisoIncidenteInputSchema)", () => {
    it("debe aceptar un reporte válido con todos los tipos de afectación soportados", () => {
      for (const tipo of TIPOS_AFECTACION) {
        const payload = {
          tipoAfectacion: tipo,
          direccion: "Av. Alemania 550, Valdivia",
          descripcion: "Crecida de agua afectando el acceso vehicular",
          informanteNombre: "Juan Pérez",
          informanteRut: "11111111-1",
          informanteTelefono: "+56912345678",
        };

        const resultado = CrearAvisoIncidenteInputSchema.safeParse(payload);
        expect(resultado.success).toBe(true);
      }
    });

    it("debe rechazar un reporte con RUT inválido", () => {
      const payload = {
        tipoAfectacion: "Anegamiento",
        direccion: "Av. Alemania 550",
        informanteNombre: "Juan Pérez",
        informanteRut: "11111111-9",
      };

      const resultado = CrearAvisoIncidenteInputSchema.safeParse(payload);
      expect(resultado.success).toBe(false);
      if (!resultado.success) {
        expect(resultado.error.issues[0].message).toContain("dígito verificador");
      }
    });

    it("debe rechazar direcciones demasiado cortas (< 5 caracteres)", () => {
      const payload = {
        tipoAfectacion: "Anegamiento",
        direccion: "Val",
        informanteNombre: "Juan Pérez",
        informanteRut: "11111111-1",
      };

      const resultado = CrearAvisoIncidenteInputSchema.safeParse(payload);
      expect(resultado.success).toBe(false);
    });

    it("debe rechazar tipos de afectación no catalogados", () => {
      const payload = {
        tipoAfectacion: "Ataque extraterrestre",
        direccion: "Calle Picarte 1200",
        informanteNombre: "Juan Pérez",
        informanteRut: "11111111-1",
      };

      const resultado = CrearAvisoIncidenteInputSchema.safeParse(payload);
      expect(resultado.success).toBe(false);
    });
  });

  describe("4. Servicio de Geocodificación (geocodificarDireccion)", () => {
    it("debe resolver sectores conocidos de Valdivia a coordenadas locales", async () => {
      const coordAlemania = await geocodificarDireccion("Av. Alemania 550");
      expect(coordAlemania.latitud).toBeCloseTo(-39.8175, 2);
      expect(coordAlemania.longitud).toBeCloseTo(-73.2412, 2);

      const coordNiebla = await geocodificarDireccion("Camino a Niebla km 5");
      expect(coordNiebla.latitud).toBeCloseTo(-39.8667, 2);
      expect(coordNiebla.longitud).toBeCloseTo(-73.3986, 2);

      const coordTeja = await geocodificarDireccion("Los Robles, Isla Teja");
      expect(coordTeja.latitud).toBeCloseTo(-39.8089, 2);
      expect(coordTeja.longitud).toBeCloseTo(-73.2534, 2);
    });

    it("debe entregar las coordenadas del centro cívico de Valdivia como fallback seguro ante direcciones desconocidas", async () => {
      const coordDesconocida = await geocodificarDireccion("Sector Inexistente 9999");
      expect(coordDesconocida.latitud).toBeCloseTo(-39.81422, 2);
      expect(coordDesconocida.longitud).toBeCloseTo(-73.24589, 2);
    });
  });

  describe("5. Servicio de Registro de Incidentes desde Chatbot", () => {
    beforeEach(() => {
      vi.restoreAllMocks();
    });

    it("debe registrar un nuevo reporte cuando NO existe duplicado previo", async () => {
      vi.spyOn(repository, "buscarIncidenteDuplicadoCercano").mockResolvedValue(undefined);

      vi.spyOn(repository, "insertarIncidenteDesdeChatbot").mockResolvedValue({
        id: "a0000000-0000-0000-0000-000000000001",
        codigo: "INC-84920194",
        codigo_seguimiento: "84920194",
        tipo_afectacion: "Caída de árbol",
        direccion_texto: "Calle Picarte 2000",
        latitud: -39.8256,
        longitud: -73.2321,
        ubicacion: null,
        descripcion: "Árbol bloqueando pista derecha",
        informante_nombre: "María Soto",
        informante_rut: "11111111-1",
        informante_telefono: null,
        informante_id: "inf-1",
        origen_reporte: "CHATBOT" as const,
        fuente_origen: "CHATBOT",
        asterisk_call_id: null,
        asterisk_caller_phone: null,
        operador_id: null,
        tipo_incidente_id: null,
        delegacion_id: null,
        fuente_incidente_id: null,
        creado_por_id: null,
        encargado_id: null,
        estado: "REPORTADO",
        prioridad: "MEDIA",
        requiere_asistencia_social: false,
        es_duplicado: false,
        aviso_original_id: null,
        creado_en: new Date("2026-09-07T12:00:00Z"),
        actualizado_en: new Date("2026-09-07T12:00:00Z"),
      } as unknown as Awaited<ReturnType<typeof repository.insertarIncidenteDesdeChatbot>>);

      const input = {
        tipoAfectacion: "Caída de árbol" as const,
        direccion: "Calle Picarte 2000",
        descripcion: "Árbol bloqueando pista derecha",
        informanteNombre: "María Soto",
        informanteRut: "11.111.111-1",
      };

      const respuesta = await registrarAvisoDesdeChatbot(input);

      expect(respuesta.esDuplicado).toBe(false);
      expect(respuesta.codigoSeguimiento).toBe("84920194");
      expect(respuesta.estado).toBe("REPORTADO");
      expect(respuesta.avisoOriginalId).toBeNull();
      expect(respuesta.mensaje).toContain("registrado exitosamente");
    });

    it("debe detectar un duplicado cercano, vincularlo al original y devolver el código existente", async () => {
      const reporteOriginal = {
        id: "original-0000-0000-0000-000000000001",
        codigo: "INC-12345678",
        codigo_seguimiento: "12345678",
        tipo_afectacion: "Caída de árbol",
        direccion_texto: "Calle Picarte 2000",
        latitud: -39.8256,
        longitud: -73.2321,
        ubicacion: null,
        descripcion: "Primer reporte del árbol",
        informante_id: "inf-original",
        informante_nombre: "Pedro González",
        informante_rut: "11111112-K",
        informante_telefono: null,
        origen_reporte: "CHATBOT" as const,
        operador_id: null,
        estado: "VERIFICANDO" as const,
        prioridad: "MEDIA" as const,
        requiere_asistencia_social: false,
        fuente_origen: "CHATBOT",
        asterisk_call_id: null,
        asterisk_caller_phone: null,
        tipo_incidente_id: null,
        delegacion_id: null,
        fuente_incidente_id: null,
        creado_por_id: null,
        encargado_id: null,
        creado_en: new Date("2026-09-07T11:00:00Z"),
        actualizado_en: new Date("2026-09-07T11:00:00Z"),
      };

      vi.spyOn(repository, "buscarIncidenteDuplicadoCercano").mockResolvedValue(reporteOriginal);

      vi.spyOn(repository, "insertarIncidenteDesdeChatbot").mockResolvedValue({
        id: "duplicado-0000-0000-0000-000000000002",
        codigo: "INC-12345678",
        codigo_seguimiento: "12345678",
        tipo_afectacion: "Caída de árbol",
        direccion_texto: "Picarte 2010",
        latitud: -39.8256,
        longitud: -73.2321,
        ubicacion: null,
        descripcion: "Mismo árbol caído",
        informante_nombre: "Ana Gómez",
        informante_rut: "11111111-1",
        informante_telefono: null,
        informante_id: "inf-2",
        origen_reporte: "CHATBOT" as const,
        operador_id: null,
        estado: "VERIFICANDO",
        prioridad: "MEDIA",
        requiere_asistencia_social: false,
        fuente_origen: "CHATBOT",
        asterisk_call_id: null,
        asterisk_caller_phone: null,
        tipo_incidente_id: null,
        delegacion_id: null,
        fuente_incidente_id: null,
        creado_por_id: null,
        encargado_id: null,
        es_duplicado: true,
        aviso_original_id: "original-0000-0000-0000-000000000001",
        creado_en: new Date("2026-09-07T11:30:00Z"),
        actualizado_en: new Date("2026-09-07T11:30:00Z"),
      } as unknown as Awaited<ReturnType<typeof repository.insertarIncidenteDesdeChatbot>>);

      const input = {
        tipoAfectacion: "Caída de árbol" as const,
        direccion: "Picarte 2010",
        descripcion: "Mismo árbol caído",
        informanteNombre: "Ana Gómez",
        informanteRut: "11111111-1",
      };

      const respuesta = await registrarAvisoDesdeChatbot(input);

      expect(respuesta.esDuplicado).toBe(true);
      expect(respuesta.codigoSeguimiento).toBe("12345678");
      expect(respuesta.avisoOriginalId).toBe("original-0000-0000-0000-000000000001");
      expect(respuesta.mensaje).toContain("ya ha sido reportado previamente");
    });
  });

  describe("6. Consulta de Estado de Seguimiento Ciudadano con Descripciones Claras", () => {
    beforeEach(() => {
      vi.restoreAllMocks();
    });

    it("debe retornar los datos del incidente y descripciones comprensibles si el código existe", async () => {
      vi.spyOn(repository, "buscarIncidentePorCodigoSeguimiento").mockResolvedValue({
        id: "00000000-0000-0000-0000-000000000001",
        codigo: "INC-88776655",
        codigo_seguimiento: "88776655",
        informante_id: "inf-1",
        tipo_afectacion: "Deslizamiento",
        direccion_texto: "Camino a Niebla",
        latitud: -39.8667,
        longitud: -73.3986,
        ubicacion: null,
        descripcion: "Deslizamiento menor de tierra",
        informante_nombre: "Carlos Vega",
        informante_rut: "11111111-1",
        informante_telefono: null,
        origen_reporte: "CHATBOT" as const,
        operador_id: null,
        estado: "EN_ATENCION",
        prioridad: "MEDIA",
        requiere_asistencia_social: false,
        fuente_origen: "CHATBOT",
        asterisk_call_id: null,
        asterisk_caller_phone: null,
        tipo_incidente_id: null,
        delegacion_id: null,
        fuente_incidente_id: null,
        creado_por_id: null,
        encargado_id: null,
        creado_en: new Date("2026-09-07T10:00:00Z"),
        actualizado_en: new Date("2026-09-07T11:00:00Z"),
      } as unknown as Awaited<ReturnType<typeof repository.buscarIncidentePorCodigoSeguimiento>>);

      const resultado = await consultarAvisoPorSeguimiento("88776655");
      expect(resultado).not.toBeNull();
      expect(resultado?.codigoSeguimiento).toBe("88776655");
      expect(resultado?.estado).toBe("EN_ATENCION");
      expect(resultado?.estadoEtiqueta).toBe("En Atención");
      expect(resultado?.estadoDescripcion).toContain("cuadrilla operativa municipal");
      expect(resultado?.tipoAfectacion).toBe("Deslizamiento");
      expect(resultado?.direccionAproximada).toBe("Camino a Niebla");

      // Verificación de sanitización estricta: datos personales no deben estar en el resultado público
      // @ts-expect-error verificación de campo confidencial ausente
      expect(resultado?.informanteRut).toBeUndefined();
      // @ts-expect-error verificación de campo confidencial ausente
      expect(resultado?.informanteTelefono).toBeUndefined();
    });

    it("debe retornar la descripción ciudadana correcta para el estado NO_ABORDABLE", async () => {
      vi.spyOn(repository, "buscarIncidentePorCodigoSeguimiento").mockResolvedValue({
        id: "00000000-0000-0000-0000-000000000002",
        codigo: "INC-11223344",
        codigo_seguimiento: "11223344",
        informante_id: "inf-2",
        tipo_afectacion: "Corte de energía",
        direccion_texto: "Isla Teja, Los Robles",
        latitud: -39.8089,
        longitud: -73.2534,
        ubicacion: null,
        descripcion: "Falla eléctrica domiciliaria",
        estado: "NO_ABORDABLE",
        prioridad: "BAJA",
        requiere_asistencia_social: false,
        fuente_origen: "CHATBOT",
        asterisk_call_id: null,
        asterisk_caller_phone: null,
        tipo_incidente_id: null,
        delegacion_id: null,
        fuente_incidente_id: null,
        creado_por_id: null,
        encargado_id: null,
        creado_en: new Date("2026-09-07T10:00:00Z"),
        actualizado_en: new Date("2026-09-07T11:00:00Z"),
      } as unknown as Awaited<ReturnType<typeof repository.buscarIncidentePorCodigoSeguimiento>>);

      const resultado = await consultarAvisoPorSeguimiento("11223344");
      expect(resultado).not.toBeNull();
      expect(resultado?.estado).toBe("NO_ABORDABLE");
      expect(resultado?.estadoEtiqueta).toBe("No Abordable");
      expect(resultado?.estadoDescripcion).toBe(
        DETALLE_ESTADOS_SEGUIMIENTO.NO_ABORDABLE.descripcion
      );
    });

    it("debe retornar null si el código numérico no existe", async () => {
      vi.spyOn(repository, "buscarIncidentePorCodigoSeguimiento").mockResolvedValue(undefined);

      const resultado = await consultarAvisoPorSeguimiento("99999999");
      expect(resultado).toBeNull();
    });

    it("debe emitir actualización por Socket.io a la sala del código de seguimiento y a la sala de encargados al cambiar de estado", async () => {
      const socketSpy = vi.spyOn(socket, "notificarActualizacionSeguimiento").mockReturnValue(true);
      const socketKanbanSpy = vi.spyOn(socket, "notificarIncidenteActualizado").mockReturnValue(true);

      vi.spyOn(repository, "actualizarEstadoIncidente").mockResolvedValue({
        id: "00000000-0000-0000-0000-000000000003",
        codigo: "INC-55443322",
        codigo_seguimiento: "55443322",
        informante_id: "inf-3",
        tipo_afectacion: "Anegamiento",
        direccion_texto: "Av. Ramón Picarte 1500",
        latitud: -39.8256,
        longitud: -73.2321,
        ubicacion: null,
        descripcion: null,
        estado: "RESUELTO",
        prioridad: "MEDIA",
        requiere_asistencia_social: false,
        fuente_origen: "CHATBOT",
        asterisk_call_id: null,
        asterisk_caller_phone: null,
        tipo_incidente_id: null,
        delegacion_id: null,
        fuente_incidente_id: null,
        creado_por_id: null,
        encargado_id: null,
        creado_en: new Date("2026-09-07T10:00:00Z"),
        actualizado_en: new Date("2026-09-07T14:30:00Z"),
      } as unknown as Awaited<ReturnType<typeof repository.actualizarEstadoIncidente>>);

      const incidenteActualizado = await cambiarEstadoIncidente("55443322", "RESUELTO");

      expect(incidenteActualizado).not.toBeNull();
      expect(socketSpy).toHaveBeenCalledTimes(1);
      expect(socketSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          codigoSeguimiento: "55443322",
          estado: "RESUELTO",
          estadoEtiqueta: "Resuelto",
          estadoDescripcion: DETALLE_ESTADOS_SEGUIMIENTO.RESUELTO.descripcion,
        })
      );
      expect(socketKanbanSpy).toHaveBeenCalledTimes(1);
      expect(socketKanbanSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "00000000-0000-0000-0000-000000000003",
          codigo: "INC-55443322",
          nuevoEstado: "RESUELTO",
          prioridad: "MEDIA",
        })
      );
    });
  });
});

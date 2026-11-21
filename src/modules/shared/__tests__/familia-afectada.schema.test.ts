import { describe, it, expect } from "vitest";
import { z } from "zod";
import {
  validarRutChileno,
  validarCoherenciaFamilia,
  validarContactosFamiliasFibe,
  consolidarFamiliasCanonicas,
  extraerContactoPrincipalDesdeFamilias,
  FamiliaAfectadaInputSchema,
} from "../familia-afectada.schema";

describe("familia-afectada.schema (contrato compartido preliminar)", () => {
  it("valida RUT chileno con Módulo 11 (con y sin puntos/guion y dígito K)", () => {
    expect(validarRutChileno("12.345.678-5")).toBe(true);
    expect(validarRutChileno("123456785")).toBe(true);
    expect(validarRutChileno("11.111.111-1")).toBe(true);
    expect(validarRutChileno("12.345.678-9")).toBe(false);
    expect(validarRutChileno("abc")).toBe(false);
  });

  it("acepta 5 integrantes con 2 niños, 1 adulto mayor y 1 discapacidad (subgrupos no disjuntos) sin inflar total", () => {
    const esquema = z
      .object({ familia: FamiliaAfectadaInputSchema })
      .superRefine((d, ctx) => {
        validarCoherenciaFamilia(d.familia, ctx, ["familia"], {
          minimoIntegrantes: 1,
        });
      });

    const parsed = esquema.safeParse({
      familia: {
        referencia: "Familia Veas",
        nucleoFamiliarTotal: 5,
        cantidadNinos: 2,
        cantidadAdultosMayores: 1,
        personasDiscapacitadas: 1,
        personasElectrodependientes: 1,
        mascotasAfectadas: 8,
        contactoNombre: "Ana Veas",
        contactoTelefono: "+56912345678",
        contactoRut: "11.111.111-1",
      },
    });
    expect(parsed.success).toBe(true);

    const consolidado = consolidarFamiliasCanonicas([
      {
        referencia: "Familia Veas",
        nucleoFamiliarTotal: 5,
        cantidadNinos: 2,
        cantidadAdultosMayores: 1,
        personasDiscapacitadas: 1,
        personasElectrodependientes: 1,
        mascotasAfectadas: 8,
        contactoNombre: "Ana Veas",
        contactoTelefono: "+56912345678",
        contactoRut: "11.111.111-1",
      },
    ]);
    expect(consolidado.nucleoFamiliarTotal).toBe(5);
    expect(consolidado.familias[0].nucleoFamiliarTotal).toBe(5);
    expect(consolidado.familias[0].contactoNombre).toBe("Ana Veas");
  });

  it("rechaza niños > total, discapacidad > total y electrodependientes > total", () => {
    const esquema = z
      .object({ familia: FamiliaAfectadaInputSchema })
      .superRefine((d, ctx) => {
        validarCoherenciaFamilia(d.familia, ctx, ["familia"], {
          minimoIntegrantes: 1,
        });
      });

    expect(
      esquema.safeParse({
        familia: { nucleoFamiliarTotal: 5, cantidadNinos: 6 },
      }).success
    ).toBe(false);

    expect(
      esquema.safeParse({
        familia: { nucleoFamiliarTotal: 5, personasDiscapacitadas: 10 },
      }).success
    ).toBe(false);

    expect(
      esquema.safeParse({
        familia: { nucleoFamiliarTotal: 5, personasElectrodependientes: 6 },
      }).success
    ).toBe(false);
  });

  it("exige al menos 1 familia y contactoNombre + contactoTelefono por cada familia cuando requiere asistencia social", () => {
    const esquema = z
      .object({
        familias: z.array(FamiliaAfectadaInputSchema).optional(),
      })
      .superRefine((d, ctx) => {
        validarContactosFamiliasFibe(d.familias, ctx, ["familias"]);
      });

    expect(esquema.safeParse({ familias: [] }).success).toBe(false);
    expect(
      esquema.safeParse({
        familias: [{ nucleoFamiliarTotal: 3, contactoNombre: "Juan" }],
      }).success
    ).toBe(false);
    expect(
      esquema.safeParse({
        familias: [
          {
            nucleoFamiliarTotal: 3,
            contactoNombre: "Juan Pérez",
            contactoTelefono: "+56987654321",
          },
        ],
      }).success
    ).toBe(true);
  });

  it("extrae el contacto principal desde la primera familia que registre contacto", () => {
    expect(
      extraerContactoPrincipalDesdeFamilias([
        { nucleoFamiliarTotal: 2, contactoNombre: null, contactoTelefono: null },
        {
          nucleoFamiliarTotal: 4,
          contactoNombre: "María Carrillo",
          contactoTelefono: "+56911112222",
          contactoRut: null,
        },
      ])
    ).toEqual({
      contactoNombre: "María Carrillo",
      contactoTelefono: "+56911112222",
      contactoRut: null,
    });
  });
});

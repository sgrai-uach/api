import { z } from "zod";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";

extendZodWithOpenApi(z);

export const NivelCompromisoViviendaSchema = z.enum([
  "SIN_DANO",
  "LEVE",
  "MODERADO",
  "GRAVE_INHABITABLE",
]);

export type NivelCompromisoVivienda = z.infer<typeof NivelCompromisoViviendaSchema>;

/**
 * Valida dígito verificador chileno (Módulo 11).
 * Acepta formatos con o sin puntos/guiones y dígito 'k'/'K'.
 */
export function validarRutChileno(rut: string): boolean {
  const limpio = rut.replace(/\./g, "").replace(/-/g, "").trim().toUpperCase();
  if (!/^\d{7,8}[0-9K]$/.test(limpio)) {
    return false;
  }

  const cuerpo = limpio.slice(0, -1);
  const dvIngresado = limpio.slice(-1);

  let suma = 0;
  let multiplicador = 2;

  for (let i = cuerpo.length - 1; i >= 0; i--) {
    suma += Number(cuerpo[i]) * multiplicador;
    multiplicador = multiplicador === 7 ? 2 : multiplicador + 1;
  }

  const resto = 11 - (suma % 11);
  const dvEsperado =
    resto === 11 ? "0" : resto === 10 ? "K" : String(resto);

  return dvIngresado === dvEsperado;
}

/**
 * Esquema de entrada de una familia afectada preliminar (compartido entre H38, H39 y H28/H31).
 * Estos antecedentes son estrictamente preliminares y NO corresponden a la FIBE formal.
 */
export const FamiliaAfectadaInputSchema = z
  .object({
    id: z.string().trim().max(100).optional(),
    referencia: z
      .string()
      .trim()
      .max(120, "La referencia del hogar no puede superar 120 caracteres.")
      .optional(),
    nucleoFamiliarTotal: z
      .number()
      .int("El total de integrantes debe ser un número entero.")
      .min(0, "El total de integrantes no puede ser negativo.")
      .max(5000, "El total de integrantes excede el máximo permitido.")
      .optional(),
    nucleo_familiar_total: z.number().int().min(0).max(5000).optional(),
    cantidadNinos: z
      .number()
      .int("La cantidad de niños debe ser un número entero.")
      .min(0, "La cantidad de niños no puede ser negativa.")
      .max(1000)
      .optional(),
    cantidad_ninos: z.number().int().min(0).max(1000).optional(),
    cantidadAdultosMayores: z
      .number()
      .int("La cantidad de adultos mayores debe ser un número entero.")
      .min(0, "La cantidad de adultos mayores no puede ser negativa.")
      .max(1000)
      .optional(),
    cantidad_adultos_mayores: z.number().int().min(0).max(1000).optional(),
    personasDiscapacitadas: z
      .number()
      .int("La cantidad de personas con discapacidad debe ser un número entero.")
      .min(0, "La cantidad de personas con discapacidad no puede ser negativa.")
      .max(1000)
      .optional(),
    personas_discapacitadas: z.number().int().min(0).max(1000).optional(),
    personasElectrodependientes: z
      .number()
      .int("La cantidad de electrodependientes debe ser un número entero.")
      .min(0, "La cantidad de personas electrodependientes no puede ser negativa.")
      .max(500)
      .optional(),
    personas_electrodependientes: z.number().int().min(0).max(500).optional(),
    mascotasAfectadas: z
      .number()
      .int("La cantidad de mascotas debe ser un número entero.")
      .min(0, "La cantidad de mascotas afectadas no puede ser negativa.")
      .max(1000)
      .optional(),
    mascotas_afectadas: z.number().int().min(0).max(1000).optional(),
    nivelCompromisoVivienda: NivelCompromisoViviendaSchema.nullable().optional(),
    nivel_compromiso_vivienda: NivelCompromisoViviendaSchema.nullable().optional(),
    contactoNombre: z
      .string()
      .trim()
      .max(150, "El nombre de contacto preliminar no puede superar 150 caracteres.")
      .nullable()
      .optional(),
    contacto_nombre: z.string().trim().max(150).nullable().optional(),
    contactoTelefono: z
      .string()
      .trim()
      .max(50, "El teléfono de contacto preliminar no puede superar 50 caracteres.")
      .nullable()
      .optional(),
    contacto_telefono: z.string().trim().max(50).nullable().optional(),
    contactoRut: z
      .string()
      .trim()
      .max(20, "El RUT de contacto preliminar no puede superar 20 caracteres.")
      .nullable()
      .optional(),
    contacto_rut: z.string().trim().max(20).nullable().optional(),
  })
  .openapi("FamiliaAfectadaInput");

export type FamiliaAfectadaInput = z.infer<typeof FamiliaAfectadaInputSchema>;

export const FamiliaAfectadaCanonicaSchema = z.object({
  id: z.string().optional(),
  referencia: z.string().optional(),
  nucleoFamiliarTotal: z.number().int().min(0),
  cantidadNinos: z.number().int().min(0),
  cantidadAdultosMayores: z.number().int().min(0),
  personasDiscapacitadas: z.number().int().min(0),
  personasElectrodependientes: z.number().int().min(0),
  mascotasAfectadas: z.number().int().min(0),
  nivelCompromisoVivienda: NivelCompromisoViviendaSchema.nullable().optional(),
  contactoNombre: z.string().nullable().optional(),
  contactoTelefono: z.string().nullable().optional(),
  contactoRut: z.string().nullable().optional(),
});

export type FamiliaAfectadaCanonica = z.infer<typeof FamiliaAfectadaCanonicaSchema>;

function leerEntero(val: unknown, fallback = 0): number {
  if (typeof val === "number" && Number.isFinite(val)) {
    return Math.max(0, Math.trunc(val));
  }
  if (typeof val === "string" && val.trim() !== "") {
    const parsed = Number(val);
    if (Number.isFinite(parsed)) {
      return Math.max(0, Math.trunc(parsed));
    }
  }
  return fallback;
}

function leerTextoOpcional(val: unknown): string | null {
  if (typeof val !== "string") return null;
  const limpio = val.trim();
  return limpio.length > 0 ? limpio : null;
}

export interface OpcionesCoherenciaFamilia {
  minimoIntegrantes?: number;
  validarRutSiExiste?: boolean;
}

/**
 * Valida la coherencia demográfica estricta de una familia preliminar:
 * - nucleoFamiliarTotal >= minimoIntegrantes
 * - cantidadNinos + cantidadAdultosMayores <= nucleoFamiliarTotal
 * - personasDiscapacitadas <= nucleoFamiliarTotal
 * - personasElectrodependientes <= nucleoFamiliarTotal
 * - mascotasAfectadas >= 0 (sin tope por integrantes)
 * - Si se ingresa contactoRut no vacío, valida dígito verificador Módulo 11.
 */
export function validarCoherenciaFamilia(
  familia: Record<string, unknown>,
  ctx: z.RefinementCtx,
  pathPrefix: Array<string | number>,
  opciones: OpcionesCoherenciaFamilia = {}
): void {
  const minimoIntegrantes = opciones.minimoIntegrantes ?? 0;
  const validarRutSiExiste = opciones.validarRutSiExiste ?? true;

  const total = leerEntero(
    familia.nucleoFamiliarTotal ?? familia.nucleo_familiar_total,
    0
  );
  const ninos = leerEntero(familia.cantidadNinos ?? familia.cantidad_ninos, 0);
  const adultosMayores = leerEntero(
    familia.cantidadAdultosMayores ?? familia.cantidad_adultos_mayores,
    0
  );
  const discapacitadas = leerEntero(
    familia.personasDiscapacitadas ?? familia.personas_discapacitadas,
    0
  );
  const electrodependientes = leerEntero(
    familia.personasElectrodependientes ?? familia.personas_electrodependientes,
    0
  );

  if (total < minimoIntegrantes) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: [...pathPrefix, "nucleoFamiliarTotal"],
      message: `Cada familia debe registrar al menos ${minimoIntegrantes} integrante(s).`,
    });
  }

  if (ninos + adultosMayores > total) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: [...pathPrefix, "cantidadNinos"],
      message: `La suma de niños (${ninos}) y adultos mayores (${adultosMayores}) no puede superar el total de integrantes del hogar (${total}).`,
    });
  }

  if (discapacitadas > total) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: [...pathPrefix, "personasDiscapacitadas"],
      message: `La cantidad de personas con discapacidad (${discapacitadas}) no puede superar el total de integrantes del hogar (${total}).`,
    });
  }

  if (electrodependientes > total) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: [...pathPrefix, "personasElectrodependientes"],
      message: `La cantidad de personas electrodependientes (${electrodependientes}) no puede superar el total de integrantes del hogar (${total}).`,
    });
  }

  if (validarRutSiExiste) {
    const rut = leerTextoOpcional(familia.contactoRut ?? familia.contacto_rut);
    if (rut && !validarRutChileno(rut)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [...pathPrefix, "contactoRut"],
        message: "El RUT preliminar ingresado no es válido.",
      });
    }
  }
}

/**
 * Valida obligatoriedad condicional de familias y contacto preliminar cuando la patrulla
 * constata que el caso requerirá evaluación social / levantamiento posterior de FIBE (H39).
 * Estos datos son estrictamente preliminares y no constituyen una FIBE.
 */
export function validarContactosFamiliasFibe(
  familias: Array<Record<string, unknown>> | undefined | null,
  ctx: z.RefinementCtx,
  pathBase: Array<string | number> = ["familias"]
): void {
  if (!Array.isArray(familias) || familias.length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: pathBase,
      message:
        "Cuando se indica requerimiento de asistencia social / FIBE, debe declarar al menos una familia afectada con sus datos de contacto preliminares.",
    });
    return;
  }

  familias.forEach((fam, idx) => {
    validarCoherenciaFamilia(fam, ctx, [...pathBase, idx], {
      minimoIntegrantes: 1,
      validarRutSiExiste: true,
    });

    const nombre = leerTextoOpcional(fam.contactoNombre ?? fam.contacto_nombre);
    if (!nombre || nombre.length < 2) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [...pathBase, idx, "contactoNombre"],
        message: `Familia #${idx + 1}: el nombre de contacto preliminar es obligatorio (mínimo 2 caracteres) cuando requiere asistencia social.`,
      });
    }

    const telefono = leerTextoOpcional(
      fam.contactoTelefono ?? fam.contacto_telefono
    );
    if (!telefono || telefono.length < 7) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [...pathBase, idx, "contactoTelefono"],
        message: `Familia #${idx + 1}: el teléfono de contacto preliminar es obligatorio (mínimo 7 caracteres) cuando requiere asistencia social.`,
      });
    }
  });
}

const COMPROMISOS_VALIDOS: NivelCompromisoVivienda[] = [
  "SIN_DANO",
  "LEVE",
  "MODERADO",
  "GRAVE_INHABITABLE",
];

const ORDEN_COMPROMISO: Record<NivelCompromisoVivienda, number> = {
  SIN_DANO: 0,
  LEVE: 1,
  MODERADO: 2,
  GRAVE_INHABITABLE: 3,
};

export interface ConsolidadoFamiliasCanonicas {
  familias: FamiliaAfectadaCanonica[];
  familiasAfectadas: number;
  nucleoFamiliarTotal: number;
  cantidadNinos: number;
  cantidadAdultosMayores: number;
  personasDiscapacitadas: number;
  personasElectrodependientes: number;
  mascotasAfectadas: number;
  nivelCompromisoVivienda: NivelCompromisoVivienda;
}

/**
 * Normaliza un listado de familias preliminares sin inflar `nucleoFamiliarTotal`
 * con la suma de subgrupos vulnerables no disjuntos.
 */
export function consolidarFamiliasCanonicas(
  familiasRaw: Array<Record<string, unknown>>
): ConsolidadoFamiliasCanonicas {
  let nucleoFamiliarTotal = 0;
  let cantidadNinos = 0;
  let cantidadAdultosMayores = 0;
  let personasDiscapacitadas = 0;
  let personasElectrodependientes = 0;
  let mascotasAfectadas = 0;
  let nivelCompromisoVivienda: NivelCompromisoVivienda = "SIN_DANO";

  const familias: FamiliaAfectadaCanonica[] = familiasRaw.map((f, idx) => {
    const fTotal = leerEntero(f.nucleoFamiliarTotal ?? f.nucleo_familiar_total, 0);
    const fNinos = leerEntero(f.cantidadNinos ?? f.cantidad_ninos, 0);
    const fAdultos = leerEntero(
      f.cantidadAdultosMayores ?? f.cantidad_adultos_mayores,
      0
    );
    const fDiscap = leerEntero(
      f.personasDiscapacitadas ?? f.personas_discapacitadas,
      0
    );
    const fElectro = leerEntero(
      f.personasElectrodependientes ?? f.personas_electrodependientes,
      0
    );
    const fMascotas = leerEntero(
      f.mascotasAfectadas ?? f.mascotas_afectadas,
      0
    );

    const compRaw = String(
      f.nivelCompromisoVivienda ?? f.nivel_compromiso_vivienda ?? "SIN_DANO"
    ).toUpperCase();
    const fComp: NivelCompromisoVivienda = COMPROMISOS_VALIDOS.includes(
      compRaw as NivelCompromisoVivienda
    )
      ? (compRaw as NivelCompromisoVivienda)
      : "SIN_DANO";

    const id = leerTextoOpcional(f.id) ?? `fam-${idx + 1}`;
    const referencia = leerTextoOpcional(f.referencia) ?? undefined;
    const contactoNombre = leerTextoOpcional(
      f.contactoNombre ?? f.contacto_nombre
    );
    const contactoTelefono = leerTextoOpcional(
      f.contactoTelefono ?? f.contacto_telefono
    );
    const contactoRut = leerTextoOpcional(f.contactoRut ?? f.contacto_rut);

    nucleoFamiliarTotal += fTotal;
    cantidadNinos += fNinos;
    cantidadAdultosMayores += fAdultos;
    personasDiscapacitadas += fDiscap;
    personasElectrodependientes += fElectro;
    mascotasAfectadas += fMascotas;
    if (ORDEN_COMPROMISO[fComp] > ORDEN_COMPROMISO[nivelCompromisoVivienda]) {
      nivelCompromisoVivienda = fComp;
    }

    return {
      id,
      ...(referencia ? { referencia } : {}),
      nucleoFamiliarTotal: fTotal,
      cantidadNinos: fNinos,
      cantidadAdultosMayores: fAdultos,
      personasDiscapacitadas: fDiscap,
      personasElectrodependientes: fElectro,
      mascotasAfectadas: fMascotas,
      nivelCompromisoVivienda: fComp,
      contactoNombre,
      contactoTelefono,
      contactoRut,
    };
  });

  return {
    familias,
    familiasAfectadas: familias.length,
    nucleoFamiliarTotal,
    cantidadNinos,
    cantidadAdultosMayores,
    personasDiscapacitadas,
    personasElectrodependientes,
    mascotasAfectadas,
    nivelCompromisoVivienda,
  };
}

/**
 * Obtiene los datos de contacto preliminar de la primera familia que registre
 * al menos nombre, teléfono o RUT, para compatibilidad con columnas raíz en listados.
 */
export function extraerContactoPrincipalDesdeFamilias(
  familias?: Array<Partial<FamiliaAfectadaCanonica>> | null
): {
  contactoNombre: string | null;
  contactoTelefono: string | null;
  contactoRut: string | null;
} {
  if (!Array.isArray(familias) || familias.length === 0) {
    return { contactoNombre: null, contactoTelefono: null, contactoRut: null };
  }

  for (const fam of familias) {
    const nombre = leerTextoOpcional(fam.contactoNombre);
    const telefono = leerTextoOpcional(fam.contactoTelefono);
    const rut = leerTextoOpcional(fam.contactoRut);
    if (nombre || telefono || rut) {
      return {
        contactoNombre: nombre,
        contactoTelefono: telefono,
        contactoRut: rut,
      };
    }
  }

  return { contactoNombre: null, contactoTelefono: null, contactoRut: null };
}

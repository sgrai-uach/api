/**
 * Utilidades para el módulo de Incidentes y Avisos de Incidentes.
 */

/**
 * Valida un RUT chileno utilizando el algoritmo de módulo 11.
 * Admite formatos: '12.345.678-5', '12345678-5', '12345678-k', '123456785'.
 */
export function validarRutChileno(rut: string): boolean {
  if (!rut || typeof rut !== "string") return false;

  const limpio = rut.replace(/[\.\-\s]/g, "").toUpperCase();
  if (limpio.length < 8 || limpio.length > 9) return false;

  const cuerpo = limpio.slice(0, -1);
  const dv = limpio.slice(-1);

  if (!/^\d+$/.test(cuerpo)) return false;

  let suma = 0;
  let multiplicador = 2;

  for (let i = cuerpo.length - 1; i >= 0; i--) {
    suma += parseInt(cuerpo[i], 10) * multiplicador;
    multiplicador = multiplicador === 7 ? 2 : multiplicador + 1;
  }

  const resto = 11 - (suma % 11);
  let dvEsperado = "";

  if (resto === 11) {
    dvEsperado = "0";
  } else if (resto === 10) {
    dvEsperado = "K";
  } else {
    dvEsperado = resto.toString();
  }

  return dv === dvEsperado;
}

/**
 * Normaliza un RUT chileno a formato estándar 'XXXXXXXX-Y'.
 */
export function normalizarRutChileno(rut: string): string {
  const limpio = rut.replace(/[\.\-\s]/g, "").toUpperCase();
  const cuerpo = limpio.slice(0, -1);
  const dv = limpio.slice(-1);
  return `${cuerpo}-${dv}`;
}

/**
 * Genera un código de seguimiento estrictamente numérico de 8 dígitos.
 * Ejemplo: "48201943"
 */
export function generarCodigoSeguimientoNumerico(): string {
  const numero = Math.floor(10000000 + Math.random() * 90000000);
  return numero.toString();
}

/**
 * Normaliza y mapea el tipo de afectación reportado (desde chatbot o llamadas)
 * hacia los valores canónicos del catálogo de emergencias de Valdivia.
 */
export function normalizarTipoAfectacion(valor: unknown): string {
  if (typeof valor !== "string") return "";
  const normalizado = valor.trim();

  // 1. Normalización de minúsculas y sin acentos
  const clean = normalizado
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (clean.includes("inunda")) return "Inundación";
  if (clean.includes("anega")) {
    return clean.includes("calzada") ? "Anegamiento de calzada" : "Anegamiento";
  }
  if (clean.includes("arbol") || clean.includes("rama")) return "Caída de árbol";
  if (clean.includes("desliza") || clean.includes("derrumbe")) {
    return clean.includes("tierra") ? "Deslizamiento de tierra" : "Deslizamiento";
  }
  if (clean.includes("incendio") || clean.includes("fuego")) {
    return clean.includes("estructural") || clean.includes("forestal")
      ? "Incendio estructural / forestal"
      : "Incendio";
  }
  if (clean.includes("luz") || clean.includes("energia") || clean.includes("electr")) {
    return "Corte de energía";
  }
  if (clean.includes("agua")) return "Corte de agua potable";
  if (clean.includes("dan") || clean.includes("colapso") || clean.includes("estructur")) {
    return "Daño estructural";
  }
  if (
    clean.includes("derrame") ||
    clean.includes("ambiental") ||
    clean.includes("quimic") ||
    clean.includes("gas") ||
    clean.includes("sustancia")
  ) {
    return "Otro";
  }
  if (clean === "otro" || clean === "otra" || clean === "otros") return "Otro";

  // Si coincide con alguna opción canónica conocida
  const TIPOS_VALIDOS = [
    "Anegamiento",
    "Inundación",
    "Caída de árbol",
    "Corte de energía",
    "Deslizamiento",
    "Deslizamiento de tierra",
    "Daño estructural",
    "Corte de agua potable",
    "Anegamiento de calzada",
    "Incendio estructural / forestal",
    "Incendio",
    "Otro",
  ];

  const encontrada = TIPOS_VALIDOS.find((t) => t.toLowerCase() === normalizado.toLowerCase());
  if (encontrada) return encontrada;

  return normalizado;
}


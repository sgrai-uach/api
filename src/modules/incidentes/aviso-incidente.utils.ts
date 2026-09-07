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

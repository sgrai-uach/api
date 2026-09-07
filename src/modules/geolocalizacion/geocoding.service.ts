export interface Coordenadas {
  latitud: number;
  longitud: number;
}

// Coordenadas base representativas de sectores conocidos de Valdivia para resolución rápida y pruebas sin red
const REFERENCIAS_VALDIVIA: Record<string, Coordenadas> = {
  centro: { latitud: -39.81422, longitud: -73.24589 },
  picarte: { latitud: -39.8256, longitud: -73.2321 },
  alemania: { latitud: -39.8175, longitud: -73.2412 },
  teja: { latitud: -39.8089, longitud: -73.2534 },
  niebla: { latitud: -39.8667, longitud: -73.3986 },
  collico: { latitud: -39.8055, longitud: -73.2189 },
  animas: { latitud: -39.7995, longitud: -73.2356 },
  corvi: { latitud: -39.8312, longitud: -73.2285 },
  angachilla: { latitud: -39.8456, longitud: -73.2398 },
  costanera: { latitud: -39.8122, longitud: -73.2485 },
};

/**
 * Normaliza un texto eliminando tildes y caracteres especiales.
 */
function limpiarTexto(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

/**
 * Geocodifica una dirección textual a coordenadas geográficas (latitud, longitud).
 * Si no se puede resolver vía servicio externo (ej. sin conexión a internet),
 * utiliza coincidencias con sectores de Valdivia o retorna el centro comunal.
 */
export async function geocodificarDireccion(direccion: string): Promise<Coordenadas> {
  const direccionLimpia = limpiarTexto(direccion);

  // 1. Detección rápida por sectores o calles icónicas de Valdivia
  for (const [clave, coord] of Object.entries(REFERENCIAS_VALDIVIA)) {
    if (direccionLimpia.includes(clave)) {
      return coord;
    }
  }

  // 2. Intento de geocodificación mediante API de OpenStreetMap (Nominatim)
  try {
    const query = `${direccion}, Valdivia, Region de Los Rios, Chile`;
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
      query
    )}&limit=1&countrycodes=cl`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "sgrai-api/0.3.0 (geocodificacion@valdivia.cl)",
      },
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = (await res.json()) as Array<{ lat: string; lon: string }>;
      if (data && data.length > 0 && data[0].lat && data[0].lon) {
        return {
          latitud: parseFloat(data[0].lat),
          longitud: parseFloat(data[0].lon),
        };
      }
    }
  } catch {
    // Si falla la red o el servicio de georreferenciación externa, se continúa con el fallback
  }

  // 3. Fallback: Coordenadas del Centro Cívico de la Municipalidad de Valdivia
  return REFERENCIAS_VALDIVIA.centro;
}

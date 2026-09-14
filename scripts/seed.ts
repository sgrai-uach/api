/**
 * Script para insertar N cantidad de avisos / incidentes vía API REST.
 * 
 * Uso:
 *   npx tsx scripts/seed.ts [cantidad] [--promover]
 * 
 * Ejemplos:
 *   npx tsx scripts/seed.ts 5              # Crea 5 avisos pendientes para el Call Center
 *   npx tsx scripts/seed.ts 3 --promover   # Crea 3 avisos y los promueve a la tabla incidente
 */

const API_BASE_URL = process.env.API_BASE_URL || "http://localhost:3000";

// Datos georreferenciados realistas en Valdivia
const UBICACIONES_VALDIVIA = [
  { direccion: "Av. Ramón Picarte 1520", latitud: -39.8245, longitud: -73.2312 },
  { direccion: "Av. Alemania 640", latitud: -39.8189, longitud: -73.2384 },
  { direccion: "Los Robles con Los Laureles, Isla Teja", latitud: -39.8105, longitud: -73.2511 },
  { direccion: "Costanera Arturo Prat 420", latitud: -39.8123, longitud: -73.2467 },
  { direccion: "Av. Pedro Montt con Simpson", latitud: -39.8310, longitud: -73.2289 },
  { direccion: "Av. España con Circunvalación, Las Ánimas", latitud: -39.8052, longitud: -73.2295 },
  { direccion: "Av. Francia con San Jorge", latitud: -39.8362, longitud: -73.2351 },
  { direccion: "General Lagos 1190", latitud: -39.8221, longitud: -73.2498 },
  { direccion: "Camino a Niebla Km 3, Torobayo", latitud: -39.8451, longitud: -73.2812 },
  { direccion: "Av. Balmaceda 180, Collico", latitud: -39.8174, longitud: -73.2145 },
];

const TIPOS_Y_DESCRIPCIONES = [
  {
    tipo: "Caída de árbol",
    descripcion: "Árbol de gran tamaño desplomado sobre el tendido eléctrico obstaculizando ambas pistas.",
  },
  {
    tipo: "Anegamiento de calzada",
    descripcion: "Colapso de sumideros y acumulación importante de aguas lluvias impidiendo el paso peatonal.",
  },
  {
    tipo: "Inundación",
    descripcion: "Desborde de estero cercano provocando ingreso de agua a antejardines de viviendas.",
  },
  {
    tipo: "Deslizamiento de tierra",
    descripcion: "Desprendimiento de material rocoso y barro en ladera cerca de la calzada principal.",
  },
  {
    tipo: "Incendio estructural / forestal",
    descripcion: "Foco de fuego en pastizales secos con riesgo de propagación a viviendas aledañas.",
  },
];

const NOMBRES = [
  "Juan Pérez", "Camila Soto", "Rodrigo Fuentes", "María González",
  "Cristián Muñoz", "Javiera Morales", "Andrés Castro", "Valentina Rojas"
];

const ORIGENES = ["WEB", "CHATBOT", "TELEFONO"] as const;

// UUID por defecto para auditar operador en acciones ICS
const OPERADOR_ID = "a0000000-0000-0000-0000-000000000001";

// Catálogo de tipos de incidente en DB (consultados automáticamente si se promueve)
const TIPO_INCIDENTE_DEFAULT = "161cdae6-360e-4add-bf79-936255c8e349"; // Caída de árbol

function randomChoice<T>(array: readonly T[] | T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

function generarRutAleatorio(): string {
  const num = Math.floor(10000000 + Math.random() * 12000000);
  const dv = Math.floor(Math.random() * 10);
  return `${num}-${dv === 10 ? "K" : dv}`;
}

async function main() {
  const args = process.argv.slice(2);
  const countArg = args.find((a) => !a.startsWith("--"));
  const count = countArg ? parseInt(countArg, 10) : 5;
  const promoverAIncidente = args.includes("--promover");

  if (isNaN(count) || count <= 0) {
    console.error("❌ Por favor indica una cantidad válida mayor a 0.");
    process.exit(1);
  }

  console.log(`\n🚀 Iniciando inserción de ${count} registros vía API (${API_BASE_URL})...\n`);

  let creadosExito = 0;
  let promovidosExito = 0;

  for (let i = 1; i <= count; i++) {
    const ubicacion = randomChoice(UBICACIONES_VALDIVIA);
    const tipo = randomChoice(TIPOS_Y_DESCRIPCIONES);
    const informante = randomChoice(NOMBRES);
    const origen = randomChoice(ORIGENES);

    const payloadAviso = {
      tipoAfectacion: tipo.tipo,
      direccion: ubicacion.direccion,
      descripcion: `${tipo.descripcion} (Generado automáticamente #${i})`,
      informanteNombre: informante,
      informanteRut: generarRutAleatorio(),
      informanteTelefono: `+569${Math.floor(10000000 + Math.random() * 90000000)}`,
      latitud: ubicacion.latitud + (Math.random() - 0.5) * 0.005,
      longitud: ubicacion.longitud + (Math.random() - 0.5) * 0.005,
      origenReporte: origen,
    };

    try {
      // 1. Crear Aviso preliminar (POST /api/incidentes/avisos)
      const resAviso = await fetch(`${API_BASE_URL}/api/incidentes/avisos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payloadAviso),
      });

      if (!resAviso.ok) {
        const errorText = await resAviso.text();
        console.error(`❌ [${i}/${count}] Error creando aviso: ${resAviso.status} - ${errorText}`);
        continue;
      }

      const jsonAviso = await resAviso.json();
      const aviso = jsonAviso.data;
      creadosExito++;

      console.log(
        `✅ [${i}/${count}] Aviso creado: ID=${aviso.id.slice(0, 8)}... | Código=${aviso.codigoSeguimiento} | Tipo: "${aviso.tipoAfectacion}" | Lugar: "${aviso.direccionTexto}"`
      );

      // 2. Si se solicitó --promover, verificar y transformar a Incidente formal
      if (promoverAIncidente) {
        const resVerificar = await fetch(`${API_BASE_URL}/api/incidentes/avisos/${aviso.id}/verificar`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-User-Id": OPERADOR_ID,
          },
          body: JSON.stringify({
            tipoIncidenteId: TIPO_INCIDENTE_DEFAULT,
            descripcion: `Incidente formal verificado: ${aviso.descripcion}`,
            requiereAsistenciaSocial: Math.random() > 0.7,
          }),
        });

        if (!resVerificar.ok) {
          const errorText = await resVerificar.text();
          console.error(`   ⚠️ Error promoviendo a Incidente formal: ${resVerificar.status} - ${errorText}`);
        } else {
          const jsonVerif = await resVerificar.json();
          promovidosExito++;
          console.log(
            `   🎉 Promovido a Incidente Formal -> Folio: ${jsonVerif.incidente.folio} (Estado: ${jsonVerif.incidente.estado})`
          );
        }
      }
    } catch (err: unknown) {
      console.error(`❌ [${i}/${count}] Error de conexión:`, (err as Error).message);
    }
  }

  console.log(`\n-----------------------------------------------------`);
  console.log(`Resumen:`);
  console.log(`- Avisos registrados con éxito: ${creadosExito}/${count}`);
  if (promoverAIncidente) {
    console.log(`- Promovidos a tabla Incidente: ${promovidosExito}/${count}`);
  } else {
    console.log(`- Estado de los avisos: PENDIENTE_VERIFICACION (visibles en /callcenter)`);
  }
  console.log(`-----------------------------------------------------\n`);
}

main().catch(console.error);

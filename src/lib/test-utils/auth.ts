import { SignJWT } from "jose";

const JWT_SECRET =
  process.env.JWT_SECRET ||
  "super-secreto-seguridad-sgrai-valdivia-2026-min-32-chars";
const secretKey = new TextEncoder().encode(JWT_SECRET);

/**
 * Genera un token JWT válido para uso en suites de pruebas unitarias y de integración.
 */
export async function generarTokenPrueba(
  usuarioId = "00000000-0000-4000-8000-000000000001",
  claims: Partial<{
    rut: string;
    email: string;
    rolId: string;
    rolCodigo: string;
    rolNombre: string;
    delegacionId: string | null;
  }> = {}
): Promise<string> {
  return await new SignJWT({
    sub: usuarioId,
    rut: claims.rut || "11111111-1",
    email: claims.email || "admin@valdivia.cl",
    rolId: claims.rolId || "20000000-0000-4000-8000-000000000001",
    rolCodigo: claims.rolCodigo || "ADMIN",
    rolNombre: claims.rolNombre || "Administrador",
    delegacionId: claims.delegacionId ?? null,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("2h")
    .sign(secretKey);
}

/**
 * Retorna las cabeceras HTTP configuradas con el Bearer token correspondiente.
 */
export function headersConBearer(token: string): { authorization: string } {
  return { authorization: `Bearer ${token}` };
}

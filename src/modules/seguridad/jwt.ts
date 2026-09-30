import { SignJWT, jwtVerify } from "jose";

export interface TokenPayload {
  sub: string;
  rut: string;
  email: string;
  rolId: string;
  rolCodigo: string;
  rolNombre: string;
  delegacionId: string | null;
  [key: string]: unknown;
}

function obtenerClaveSecreta(): Uint8Array {
  const secret =
    process.env.JWT_SECRET ||
    "super-secreto-seguridad-sgrai-valdivia-2026-min-32-chars";
  return new TextEncoder().encode(secret);
}

function obtenerTiempoExpiracion(): string {
  return process.env.JWT_EXPIRES_IN || "8h";
}

/**
 * Genera un token JWT firmado criptográficamente (HS256) con los claims del usuario y fecha de expiración.
 */
export async function generarTokenJwt(
  payload: TokenPayload,
  expiresIn?: string
): Promise<{ token: string; expiraEn: string }> {
  const secretKey = obtenerClaveSecreta();
  const duracion = expiresIn || obtenerTiempoExpiracion();

  const jwt = await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(duracion)
    .sign(secretKey);

  const { payload: verified } = await jwtVerify(jwt, secretKey);
  const expiraEn = verified.exp
    ? new Date(verified.exp * 1000).toISOString()
    : new Date(Date.now() + 8 * 3600 * 1000).toISOString();

  return { token: jwt, expiraEn };
}

/**
 * Verifica la firma y vigencia de un token JWT y retorna su payload tipado.
 * Lanza error si el token es inválido, manipulado o ha expirado.
 */
export async function verificarTokenJwt(token: string): Promise<TokenPayload> {
  const secretKey = obtenerClaveSecreta();
  const { payload } = await jwtVerify(token, secretKey);

  return {
    sub: payload.sub as string,
    rut: (payload.rut as string) ?? "",
    email: (payload.email as string) ?? "",
    rolId: (payload.rolId as string) ?? "",
    rolCodigo: (payload.rolCodigo as string) ?? "",
    rolNombre: (payload.rolNombre as string) ?? "",
    delegacionId: (payload.delegacionId as string | null) ?? null,
  };
}

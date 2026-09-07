export class UnauthorizedError extends Error {
  constructor(message = "No autorizado. Se requiere cabecera de autenticación válida.") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends Error {
  constructor(message = "Acceso denegado. No posee los permisos requeridos.") {
    super(message);
    this.name = "ForbiddenError";
  }
}

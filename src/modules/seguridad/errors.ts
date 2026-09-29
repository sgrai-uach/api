export class UnauthorizedError extends Error {
  constructor(message = "No autorizado. Se requiere cabecera de autenticación válida.") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends Error {
  constructor(message = "Acceso denegado. Se requiere rol de Administrador.") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export class NotFoundError extends Error {
  constructor(message = "Recurso no encontrado.") {
    super(message);
    this.name = "NotFoundError";
  }
}

export class BadRequestError extends Error {
  constructor(message = "Solicitud inválida.") {
    super(message);
    this.name = "BadRequestError";
  }
}

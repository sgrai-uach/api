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

export class ConflictError extends Error {
  public codigo?: string;
  public detalles?: Record<string, unknown>;

  constructor(
    message = "Conflicto en la operación solicitada.",
    codigo?: string,
    detalles?: Record<string, unknown>
  ) {
    super(message);
    this.name = "ConflictError";
    this.codigo = codigo;
    this.detalles = detalles;
  }
}

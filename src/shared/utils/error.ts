export class AppError extends Error {
    constructor(public code: string, message: string) {
        super(message);
        // Preserve class name for checks like `err.name === "NotFoundError"`
        this.name = this.constructor.name;
    }
}

export class NotFoundError extends AppError {
    constructor(message: string) {
        super('NOT_FOUND', message);
    }
}

export class ForbiddenError extends AppError {
    constructor(message: string) {
        super('FORBIDDEN', message);
    }
}

export class ValidationError extends AppError {
    constructor(message: string) {
        super('VALIDATION_ERROR', message);
    }
}

/**
 * La escritura llegó bien formada y el recurso existe: lo que falla es que
 * alguien escribió antes. Se traduce a 409 y no a 422 porque el cliente no
 * tiene que corregir nada, tiene que releer y reintentar.
 */
export class ConflictError extends AppError {
    constructor(message: string) {
        super('CONFLICT', message);
    }
}

// src/shared/utils/errors.ts                                                                                                                                                                               
export class AppError extends Error {
    constructor(public code: string, message: string) {
        super(message);
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

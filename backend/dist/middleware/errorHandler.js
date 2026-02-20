"use strict";
/**
 * Global error handler middleware
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = exports.ApiError = void 0;
const logger_1 = require("../utils/logger");
class ApiError extends Error {
    statusCode;
    constructor(statusCode, message) {
        super(message);
        this.statusCode = statusCode;
    }
}
exports.ApiError = ApiError;
const errorHandler = (err, req, res, next) => {
    // Log error (redact sensitive paths)
    const sanitizedPath = req.path.replace(/\/\d+/g, '/:id');
    logger_1.logger.error(`Error on ${req.method} ${sanitizedPath}: ${err.message}`, {
        stack: err.stack
    });
    if (err instanceof ApiError) {
        return res.status(err.statusCode).json({
            error: err.message
        });
    }
    // Don't leak error details in production
    const message = process.env.NODE_ENV === 'production'
        ? 'Internal server error'
        : err.message;
    return res.status(500).json({
        error: message
    });
};
exports.errorHandler = errorHandler;
//# sourceMappingURL=errorHandler.js.map
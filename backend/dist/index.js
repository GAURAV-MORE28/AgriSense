"use strict";
/**
 * KRISHI-AI Backend API Server
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const compression_1 = __importDefault(require("compression"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const dotenv_1 = __importDefault(require("dotenv"));
const logger_1 = require("./utils/logger");
const errorHandler_1 = require("./middleware/errorHandler");
const auth_1 = __importDefault(require("./routes/auth"));
const profile_1 = __importDefault(require("./routes/profile"));
const schemes_1 = __importDefault(require("./routes/schemes"));
const documents_1 = __importDefault(require("./routes/documents"));
const applications_1 = __importDefault(require("./routes/applications"));
const mockGov_1 = __importDefault(require("./routes/mockGov"));
const sync_1 = __importDefault(require("./routes/sync"));
const health_1 = __importDefault(require("./routes/health"));
const admin_1 = __importDefault(require("./routes/admin"));
const aiChat_1 = __importDefault(require("./routes/aiChat"));
// Load environment variables
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 4000;
// Security middleware
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true
}));
// Rate limiting
const limiter = (0, express_rate_limit_1.default)({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000'),
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
    message: { error: 'Too many requests, please try again later' }
});
app.use('/api/', limiter);
// Body parsing
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true }));
app.use((0, compression_1.default)());
// Request logging (redact sensitive data)
app.use((req, res, next) => {
    const sanitizedBody = { ...req.body };
    if (sanitizedBody.password)
        sanitizedBody.password = '[REDACTED]';
    if (sanitizedBody.otp)
        sanitizedBody.otp = '[REDACTED]';
    logger_1.logger.info(`${req.method} ${req.path}`, {
        query: req.query,
        ip: req.ip
    });
    next();
});
// Routes
app.use('/api/v1/auth', auth_1.default);
app.use('/api/v1/profile', profile_1.default);
app.use('/api/v1/schemes', schemes_1.default);
app.use('/api/v1/documents', documents_1.default);
app.use('/api/v1/application', applications_1.default);
app.use('/api/v1/mock/gov', mockGov_1.default);
app.use('/api/v1/sync', sync_1.default);
app.use('/api/v1/admin', admin_1.default);
app.use('/api/v1/ai', aiChat_1.default);
app.use('/health', health_1.default);
app.use('/healthz', health_1.default);
// Root endpoint
app.get('/', (req, res) => {
    res.json({
        service: 'KRISHI-AI Backend API',
        version: '1.0.0',
        status: 'running',
        docs: '/api-docs'
    });
});
// Error handling
app.use(errorHandler_1.errorHandler);
// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Not Found' });
});
// Start server
app.listen(PORT, () => {
    logger_1.logger.info(`KRISHI-AI Backend running on port ${PORT}`);
    logger_1.logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
exports.default = app;
//# sourceMappingURL=index.js.map
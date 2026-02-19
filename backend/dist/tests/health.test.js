"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supertest_1 = __importDefault(require("supertest"));
const express_1 = __importDefault(require("express"));
// Simple health endpoint for testing
const app = (0, express_1.default)();
app.get('/api/v1/health', (req, res) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});
describe('Health Endpoint', () => {
    it('should return healthy status', async () => {
        const response = await (0, supertest_1.default)(app).get('/api/v1/health');
        expect(response.status).toBe(200);
        expect(response.body.status).toBe('healthy');
        expect(response.body.timestamp).toBeDefined();
    });
});
describe('API Structure', () => {
    it('should have correct response format', async () => {
        const response = await (0, supertest_1.default)(app).get('/api/v1/health');
        expect(response.headers['content-type']).toMatch(/json/);
        expect(typeof response.body).toBe('object');
    });
});
//# sourceMappingURL=health.test.js.map
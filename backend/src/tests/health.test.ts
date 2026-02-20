import request from 'supertest';
import express from 'express';

// Simple health endpoint for testing
const app = express();
app.get('/api/v1/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

describe('Health Endpoint', () => {
  it('should return healthy status', async () => {
    const response = await request(app).get('/api/v1/health');
    
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('healthy');
    expect(response.body.timestamp).toBeDefined();
  });
});

describe('API Structure', () => {
  it('should have correct response format', async () => {
    const response = await request(app).get('/api/v1/health');
    
    expect(response.headers['content-type']).toMatch(/json/);
    expect(typeof response.body).toBe('object');
  });
});

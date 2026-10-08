import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from './server.js';

describe('API Integration Tests', () => {
  it('GET /healthz returns 200 and ok status', async () => {
    const res = await request(app).get('/healthz');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('GET /readyz returns 200 and database connected', async () => {
    const res = await request(app).get('/readyz');
    expect(res.status).toBe(200);
    expect(res.body.database).toBe('connected');
  });

  it('GET /api/v1/maps/autocomplete returns Bangalore place suggestions', async () => {
    const res = await request(app).get('/api/v1/maps/autocomplete?query=Indiranagar');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.suggestions)).toBe(true);
    expect(res.body.suggestions.length).toBeGreaterThan(0);
  });

  it('POST /api/v1/rides/estimate calculates fare options for all vehicle types', async () => {
    const payload = {
      pickup: { address: 'MG Road', lat: 12.9756, lng: 77.6066 },
      dropoff: { address: 'Indiranagar 100ft Rd', lat: 12.9784, lng: 77.6408 },
    };

    const res = await request(app).post('/api/v1/rides/estimate').send(payload);
    expect(res.status).toBe(200);
    expect(res.body.estimates).toBeDefined();
    expect(res.body.estimates.length).toBe(5); // BIKE, AUTO, MINI, SEDAN, SUV
    expect(res.body.estimates[0].estimatedFare).toBeGreaterThan(0);
  });

  it('POST /api/v1/promos/validate validates promo code properly', async () => {
    const res = await request(app)
      .post('/api/v1/promos/validate')
      .set('Authorization', 'Bearer demo_rider')
      .send({
        code: 'WELCOME50',
        vehicleType: 'SEDAN',
        estimatedFare: 200,
      });

    expect(res.status).toBe(200);
    expect(res.body.valid).toBe(true);
    expect(res.body.promo.discount).toBeGreaterThan(0);
  });
});

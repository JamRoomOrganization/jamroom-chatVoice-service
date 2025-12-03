/**
 * Metrics Routes E2E Tests
 *
 * End-to-end tests for metrics endpoints.
 */

// Set test env vars BEFORE any imports
process.env.LIVEKIT_API_KEY = 'test-api-key';
process.env.LIVEKIT_API_SECRET = 'test-api-secret-with-enough-length-32chars';
process.env.LIVEKIT_URL = 'wss://test.livekit.cloud';

import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../src/app';
import { metrics } from '../src/services/metrics';
import * as voiceSessionStore from '../src/services/voiceSessionStore';

describe('Metrics Routes', () => {
  let app: Express;

  beforeEach(() => {
    // Reset metrics and store before each test
    metrics.resetAll();
    voiceSessionStore.clearAll();
    app = createApp();
  });

  describe('GET /metrics', () => {
    it('should return 200 with Prometheus text format', async () => {
      const response = await request(app)
        .get('/metrics')
        .expect(200)
        .expect('Content-Type', /text\/plain/);

      expect(response.text).toContain('# HELP voice_sessions_created_total');
      expect(response.text).toContain('# TYPE voice_sessions_created_total counter');
    });

    it('should include all counter metrics', async () => {
      const response = await request(app).get('/metrics').expect(200);

      expect(response.text).toContain('voice_sessions_created_total');
      expect(response.text).toContain('voice_sessions_renewed_total');
      expect(response.text).toContain('voice_sessions_deleted_total');
      expect(response.text).toContain('voice_sessions_renewal_failed_total');
    });

    it('should include histogram metrics', async () => {
      const response = await request(app).get('/metrics').expect(200);

      expect(response.text).toContain('livekit_token_issuance_duration_ms');
      expect(response.text).toContain('voice_session_create_duration_ms');
    });

    it('should reflect actual metric values', async () => {
      // Create a session to increment metrics
      await request(app)
        .post('/api/v1/voice/sessions')
        .send({
          roomId: 'room-1',
          userId: 'user-1',
        })
        .expect(201);

      const response = await request(app).get('/metrics').expect(200);

      // Session created counter should be 1
      expect(response.text).toContain('voice_sessions_created_total 1');
    });

    it('should track session deletion metrics', async () => {
      // Create and then delete a session
      const createRes = await request(app)
        .post('/api/v1/voice/sessions')
        .send({
          roomId: 'room-1',
          userId: 'user-1',
        })
        .expect(201);

      const sessionId = createRes.body.data.sessionId;

      await request(app)
        .delete(`/api/v1/voice/sessions/${sessionId}`)
        .expect(204);

      const response = await request(app).get('/metrics').expect(200);

      expect(response.text).toContain('voice_sessions_created_total 1');
      expect(response.text).toContain('voice_sessions_deleted_total 1');
    });
  });

  describe('GET /metrics/json', () => {
    it('should return 200 with JSON format', async () => {
      const response = await request(app)
        .get('/metrics/json')
        .expect(200)
        .expect('Content-Type', /json/);

      expect(response.body.data).toBeDefined();
      expect(response.body.error).toBeNull();
      expect(response.body.meta).toBeDefined();
    });

    it('should include counters object', async () => {
      const response = await request(app).get('/metrics/json').expect(200);

      expect(response.body.data.counters).toBeDefined();
      expect(response.body.data.counters.voice_sessions_created_total).toBe(0);
      expect(response.body.data.counters.voice_sessions_renewed_total).toBe(0);
      expect(response.body.data.counters.voice_sessions_deleted_total).toBe(0);
    });

    it('should include histograms object', async () => {
      const response = await request(app).get('/metrics/json').expect(200);

      expect(response.body.data.histograms).toBeDefined();
      expect(response.body.data.histograms.livekit_token_issuance_duration_ms).toBeDefined();
      expect(response.body.data.histograms.voice_session_create_duration_ms).toBeDefined();
    });

    it('should include requestId in meta', async () => {
      const response = await request(app)
        .get('/metrics/json')
        .set('x-request-id', 'test-metrics-123')
        .expect(200);

      expect(response.body.meta.requestId).toBe('test-metrics-123');
    });

    it('should reflect actual values after operations', async () => {
      // Create two sessions
      await request(app)
        .post('/api/v1/voice/sessions')
        .send({ roomId: 'room-1', userId: 'user-1' })
        .expect(201);

      await request(app)
        .post('/api/v1/voice/sessions')
        .send({ roomId: 'room-2', userId: 'user-2' })
        .expect(201);

      const response = await request(app).get('/metrics/json').expect(200);

      expect(response.body.data.counters.voice_sessions_created_total).toBe(2);
      
      // Latency should have been recorded
      expect(response.body.data.histograms.voice_session_create_duration_ms.count).toBe(2);
      expect(response.body.data.histograms.voice_session_create_duration_ms.sum).toBeGreaterThan(0);
    });
  });

  describe('Metrics integration with voice operations', () => {
    it('should track token issuance latency', async () => {
      await request(app)
        .post('/api/v1/voice/sessions')
        .send({ roomId: 'room-1', userId: 'user-1' })
        .expect(201);

      const response = await request(app).get('/metrics/json').expect(200);

      const tokenLatency = response.body.data.histograms.livekit_token_issuance_duration_ms;
      expect(tokenLatency.count).toBe(1);
      expect(tokenLatency.avg).toBeGreaterThan(0);
    });

    it('should track create session latency', async () => {
      await request(app)
        .post('/api/v1/voice/sessions')
        .send({ roomId: 'room-1', userId: 'user-1' })
        .expect(201);

      const response = await request(app).get('/metrics/json').expect(200);

      const createLatency = response.body.data.histograms.voice_session_create_duration_ms;
      expect(createLatency.count).toBe(1);
      expect(createLatency.avg).toBeGreaterThan(0);
    });

    it('should record metrics on session renewal', async () => {
      // Create a session that will expire soon
      const expiresIn5Min = new Date(Date.now() + 5 * 60 * 1000).toISOString();
      voiceSessionStore.createOrUpdateSession(
        { roomId: 'room-1', userId: 'user-1', canPublishAudio: true, canSubscribe: true },
        { roomName: 'jamroom:room-1', identity: 'user-1', token: 'token', url: 'wss://test', expiresAt: expiresIn5Min }
      );

      // Trigger renewal
      await request(app)
        .post('/internal/voice/sessions/renew')
        .send({ thresholdSeconds: 600 })
        .expect(200);

      const response = await request(app).get('/metrics/json').expect(200);

      // Note: voiceSessionsCreated tracks store operations, not API calls
      // The renewal itself calls the token issuer which is tracked
      expect(response.body.data.counters.voice_sessions_renewed_total).toBe(1);
    });
  });
});

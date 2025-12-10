/**
 * Internal Routes E2E Tests
 *
 * End-to-end tests for internal maintenance endpoints.
 * 
 * Note: These tests set LiveKit env vars before importing modules to ensure
 * proper configuration.
 */

// Set test env vars BEFORE any imports
process.env.LIVEKIT_API_KEY = 'test-api-key';
process.env.LIVEKIT_API_SECRET = 'test-api-secret-with-enough-length-32chars';
process.env.LIVEKIT_URL = 'wss://test.livekit.cloud';

import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../src/app';
import * as voiceSessionStore from '../src/services/voiceSessionStore';

describe('Internal Routes', () => {
  let app: Express;

  beforeEach(() => {
    // Clear store before each test
    voiceSessionStore.clearAll();
    app = createApp();
  });

  describe('POST /internal/voice/sessions/renew', () => {
    it('should return 200 with renewal stats when no sessions exist', async () => {
      const response = await request(app)
        .post('/internal/voice/sessions/renew')
        .send({})
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body.data).toEqual({
        renewed: 0,
        totalExpiring: 0,
        failed: 0,
        thresholdSeconds: 600, // default
      });
      expect(response.body.error).toBeNull();
      expect(response.body.meta).toHaveProperty('requestId');
    });

    it('should use default thresholdSeconds when not provided', async () => {
      const response = await request(app)
        .post('/internal/voice/sessions/renew')
        .send({})
        .expect(200);

      expect(response.body.data.thresholdSeconds).toBe(600);
    });

    it('should use custom thresholdSeconds when provided', async () => {
      const response = await request(app)
        .post('/internal/voice/sessions/renew')
        .send({ thresholdSeconds: 300 })
        .expect(200);

      expect(response.body.data.thresholdSeconds).toBe(300);
    });

    it('should renew expiring sessions', async () => {
      // Create session expiring in 5 minutes
      const expiresIn5Min = new Date(Date.now() + 5 * 60 * 1000).toISOString();
      const session = voiceSessionStore.createOrUpdateSession(
        { roomId: 'room-1', userId: 'user-1', canPublishAudio: true, canSubscribe: true },
        { roomName: 'jamroom:room-1', identity: 'user-1', token: 'old-token', url: 'wss://test', expiresAt: expiresIn5Min }
      );

      const response = await request(app)
        .post('/internal/voice/sessions/renew')
        .send({ thresholdSeconds: 600 })
        .expect(200);

      expect(response.body.data.totalExpiring).toBe(1);
      expect(response.body.data.renewed).toBe(1);
      expect(response.body.data.failed).toBe(0);

      // Verify session was updated
      const updatedSession = voiceSessionStore.getSession(session.sessionId);
      expect(updatedSession?.livekit.token).not.toBe('old-token');
    });

    it('should not renew sessions not expiring within threshold', async () => {
      // Create session expiring in 1 hour
      const expiresIn1Hour = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      voiceSessionStore.createOrUpdateSession(
        { roomId: 'room-1', userId: 'user-1', canPublishAudio: true, canSubscribe: true },
        { roomName: 'jamroom:room-1', identity: 'user-1', token: 'token', url: 'wss://test', expiresAt: expiresIn1Hour }
      );

      const response = await request(app)
        .post('/internal/voice/sessions/renew')
        .send({ thresholdSeconds: 600 }) // 10 minutes
        .expect(200);

      expect(response.body.data.totalExpiring).toBe(0);
      expect(response.body.data.renewed).toBe(0);
    });

    it('should validate thresholdSeconds is positive', async () => {
      const response = await request(app)
        .post('/internal/voice/sessions/renew')
        .send({ thresholdSeconds: -100 })
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should validate thresholdSeconds does not exceed 24 hours', async () => {
      const response = await request(app)
        .post('/internal/voice/sessions/renew')
        .send({ thresholdSeconds: 100000 }) // > 86400
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should validate thresholdSeconds is an integer', async () => {
      const response = await request(app)
        .post('/internal/voice/sessions/renew')
        .send({ thresholdSeconds: 600.5 })
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /internal/voice/sessions/stats', () => {
    it('should return stats when no sessions exist', async () => {
      const response = await request(app)
        .get('/internal/voice/sessions/stats')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body.data).toEqual({
        total: 0,
        expired: 0,
        expiringIn5Min: 0,
        expiringIn10Min: 0,
        expiringIn30Min: 0,
      });
      expect(response.body.error).toBeNull();
    });

    it('should return correct stats for sessions', async () => {
      // Create various sessions
      // Expired
      voiceSessionStore.createOrUpdateSession(
        { roomId: 'room-1', userId: 'user-1', canPublishAudio: true, canSubscribe: true },
        { roomName: 'jamroom:room-1', identity: 'user-1', token: 'token', url: 'wss://test', 
          expiresAt: new Date(Date.now() - 1000).toISOString() }
      );

      // Expiring in 3 min
      voiceSessionStore.createOrUpdateSession(
        { roomId: 'room-2', userId: 'user-2', canPublishAudio: true, canSubscribe: true },
        { roomName: 'jamroom:room-2', identity: 'user-2', token: 'token', url: 'wss://test', 
          expiresAt: new Date(Date.now() + 3 * 60 * 1000).toISOString() }
      );

      // Expiring in 1 hour
      voiceSessionStore.createOrUpdateSession(
        { roomId: 'room-3', userId: 'user-3', canPublishAudio: true, canSubscribe: true },
        { roomName: 'jamroom:room-3', identity: 'user-3', token: 'token', url: 'wss://test', 
          expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString() }
      );

      const response = await request(app)
        .get('/internal/voice/sessions/stats')
        .expect(200);

      expect(response.body.data.total).toBe(3);
      expect(response.body.data.expired).toBe(1);
      expect(response.body.data.expiringIn5Min).toBe(1);
    });

    it('should include requestId in response', async () => {
      const response = await request(app)
        .get('/internal/voice/sessions/stats')
        .set('x-request-id', 'test-request-123')
        .expect(200);

      expect(response.body.meta.requestId).toBe('test-request-123');
    });
  });

  describe('Internal routes workflow', () => {
    it('should support a typical cron-based renewal workflow', async () => {
      // 1. Check stats initially
      let response = await request(app)
        .get('/internal/voice/sessions/stats')
        .expect(200);
      expect(response.body.data.total).toBe(0);

      // 2. Create some sessions (some expiring soon, some not)
      const expiresIn5Min = new Date(Date.now() + 5 * 60 * 1000).toISOString();
      const expiresIn1Hour = new Date(Date.now() + 60 * 60 * 1000).toISOString();

      voiceSessionStore.createOrUpdateSession(
        { roomId: 'room-1', userId: 'user-1', canPublishAudio: true, canSubscribe: true },
        { roomName: 'jamroom:room-1', identity: 'user-1', token: 'token-1', url: 'wss://test', expiresAt: expiresIn5Min }
      );

      voiceSessionStore.createOrUpdateSession(
        { roomId: 'room-2', userId: 'user-2', canPublishAudio: true, canSubscribe: true },
        { roomName: 'jamroom:room-2', identity: 'user-2', token: 'token-2', url: 'wss://test', expiresAt: expiresIn1Hour }
      );

      // 3. Check stats after creating sessions
      response = await request(app)
        .get('/internal/voice/sessions/stats')
        .expect(200);
      expect(response.body.data.total).toBe(2);
      expect(response.body.data.expiringIn10Min).toBe(1); // Only the 5min one

      // 4. Renew expiring sessions
      response = await request(app)
        .post('/internal/voice/sessions/renew')
        .send({ thresholdSeconds: 600 })
        .expect(200);
      expect(response.body.data.totalExpiring).toBe(1);
      expect(response.body.data.renewed).toBe(1);

      // 5. Check stats after renewal - session should no longer be expiring soon
      response = await request(app)
        .get('/internal/voice/sessions/stats')
        .expect(200);
      expect(response.body.data.total).toBe(2);
      // After renewal with 1 hour TTL, none should be expiring in 10 min
      expect(response.body.data.expiringIn10Min).toBe(0);
    });
  });
});

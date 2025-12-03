/**
 * VoiceSession E2E Tests
 *
 * End-to-end tests for voice session REST endpoints.
 * 
 * Note: These tests set LiveKit env vars before importing modules to ensure
 * proper configuration. The app module caches config on first import, so we
 * must set env vars before any import of app or services.
 */

// Set test env vars BEFORE any imports
process.env.LIVEKIT_API_KEY = 'test-api-key';
process.env.LIVEKIT_API_SECRET = 'test-api-secret-with-enough-length-32chars';
process.env.LIVEKIT_URL = 'wss://test.livekit.cloud';

import request from 'supertest';
import { createApp } from '../src/app';
import * as voiceSessionStore from '../src/services/voiceSessionStore';
import { Express } from 'express';

describe('Voice Session Routes', () => {
  let app: Express;

  beforeEach(() => {
    // Clear store before each test
    voiceSessionStore.clearAll();
    app = createApp();
  });

  describe('POST /api/v1/voice/sessions', () => {
    it('should create a new voice session', async () => {
      const response = await request(app)
        .post('/api/v1/voice/sessions')
        .send({
          roomId: 'room-123',
          userId: 'user-456',
          username: 'TestUser',
          canPublishAudio: true,
          canSubscribe: true,
        });

      expect(response.status).toBe(201);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.sessionId).toMatch(/^vs_/);
      expect(response.body.data.roomId).toBe('room-123');
      expect(response.body.data.userId).toBe('user-456');
      expect(response.body.data.username).toBe('TestUser');
      expect(response.body.data.canPublishAudio).toBe(true);
      expect(response.body.data.canSubscribe).toBe(true);
      expect(response.body.data.livekit).toBeDefined();
      expect(response.body.data.livekit.roomName).toBe('jamroom:room-123');
      expect(response.body.data.livekit.token).toBeDefined();
      expect(response.body.data.livekit.url).toBe('wss://test.livekit.cloud');
      expect(response.body.error).toBeNull();
      expect(response.body.meta).toBeDefined();
    });

    it('should return 200 when updating existing session (upsert)', async () => {
      // Create first session
      await request(app)
        .post('/api/v1/voice/sessions')
        .send({
          roomId: 'room-123',
          userId: 'user-456',
          canPublishAudio: false,
          canSubscribe: false,
        });

      // Update same room/user
      const response = await request(app)
        .post('/api/v1/voice/sessions')
        .send({
          roomId: 'room-123',
          userId: 'user-456',
          username: 'UpdatedName',
          canPublishAudio: true,
          canSubscribe: true,
        });

      expect(response.status).toBe(200);
      expect(response.body.data.username).toBe('UpdatedName');
      expect(response.body.data.canPublishAudio).toBe(true);
    });

    it('should use default values for optional fields', async () => {
      const response = await request(app)
        .post('/api/v1/voice/sessions')
        .send({
          roomId: 'room-123',
          userId: 'user-456',
        });

      expect(response.status).toBe(201);
      expect(response.body.data.canPublishAudio).toBe(true);
      expect(response.body.data.canSubscribe).toBe(true);
    });

    it('should return 400 for missing roomId', async () => {
      const response = await request(app)
        .post('/api/v1/voice/sessions')
        .send({
          userId: 'user-456',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 for missing userId', async () => {
      const response = await request(app)
        .post('/api/v1/voice/sessions')
        .send({
          roomId: 'room-123',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 for empty roomId', async () => {
      const response = await request(app)
        .post('/api/v1/voice/sessions')
        .send({
          roomId: '',
          userId: 'user-456',
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should include requestId in meta', async () => {
      const response = await request(app)
        .post('/api/v1/voice/sessions')
        .set('x-request-id', 'custom-request-id')
        .send({
          roomId: 'room-123',
          userId: 'user-456',
        });

      expect(response.body.meta.requestId).toBe('custom-request-id');
    });
  });

  describe('GET /api/v1/voice/sessions/:sessionId', () => {
    it('should return session by sessionId', async () => {
      // Create a session first
      const createResponse = await request(app)
        .post('/api/v1/voice/sessions')
        .send({
          roomId: 'room-123',
          userId: 'user-456',
        });

      const sessionId = createResponse.body.data.sessionId;

      const response = await request(app)
        .get(`/api/v1/voice/sessions/${sessionId}`);

      expect(response.status).toBe(200);
      expect(response.body.data.sessionId).toBe(sessionId);
      expect(response.body.data.roomId).toBe('room-123');
      expect(response.body.data.userId).toBe('user-456');
    });

    it('should return 404 for non-existent session', async () => {
      const response = await request(app)
        .get('/api/v1/voice/sessions/vs_nonexistent_12345');

      expect(response.status).toBe(404);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.code).toBe('NOT_FOUND');
      expect(response.body.error.message).toBe('Voice session not found');
    });
  });

  describe('DELETE /api/v1/voice/sessions/:sessionId', () => {
    it('should delete session and return 204', async () => {
      // Create a session first
      const createResponse = await request(app)
        .post('/api/v1/voice/sessions')
        .send({
          roomId: 'room-123',
          userId: 'user-456',
        });

      const sessionId = createResponse.body.data.sessionId;

      const response = await request(app)
        .delete(`/api/v1/voice/sessions/${sessionId}`);

      expect(response.status).toBe(204);
      expect(response.body).toEqual({});

      // Verify deletion
      const getResponse = await request(app)
        .get(`/api/v1/voice/sessions/${sessionId}`);
      expect(getResponse.status).toBe(404);
    });

    it('should return 404 for non-existent session', async () => {
      const response = await request(app)
        .delete('/api/v1/voice/sessions/vs_nonexistent_12345');

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('GET /api/v1/voice/rooms/:roomId/sessions', () => {
    it('should return all sessions in a room', async () => {
      // Create sessions for different users in same room
      await request(app)
        .post('/api/v1/voice/sessions')
        .send({
          roomId: 'room-123',
          userId: 'user-A',
          username: 'UserA',
        });

      await request(app)
        .post('/api/v1/voice/sessions')
        .send({
          roomId: 'room-123',
          userId: 'user-B',
          username: 'UserB',
        });

      // Create session in different room
      await request(app)
        .post('/api/v1/voice/sessions')
        .send({
          roomId: 'other-room',
          userId: 'user-C',
        });

      const response = await request(app)
        .get('/api/v1/voice/rooms/room-123/sessions');

      expect(response.status).toBe(200);
      expect(response.body.data.sessions).toHaveLength(2);
      expect(response.body.data.count).toBe(2);

      const userIds = response.body.data.sessions.map((s: { userId: string }) => s.userId);
      expect(userIds).toContain('user-A');
      expect(userIds).toContain('user-B');
      expect(userIds).not.toContain('user-C');
    });

    it('should return empty array for room with no sessions', async () => {
      const response = await request(app)
        .get('/api/v1/voice/rooms/empty-room/sessions');

      expect(response.status).toBe(200);
      expect(response.body.data.sessions).toEqual([]);
      expect(response.body.data.count).toBe(0);
    });

    it('should include meta with requestId', async () => {
      const response = await request(app)
        .get('/api/v1/voice/rooms/room-123/sessions')
        .set('x-request-id', 'test-request-id');

      expect(response.body.meta.requestId).toBe('test-request-id');
      expect(response.body.meta.timestamp).toBeDefined();
    });
  });

  describe('Voice session workflow', () => {
    it('should support full session lifecycle', async () => {
      // 1. Create session
      const createResponse = await request(app)
        .post('/api/v1/voice/sessions')
        .send({
          roomId: 'workflow-room',
          userId: 'workflow-user',
          username: 'WorkflowUser',
        });

      expect(createResponse.status).toBe(201);
      const sessionId = createResponse.body.data.sessionId;

      // 2. Get session
      const getResponse = await request(app)
        .get(`/api/v1/voice/sessions/${sessionId}`);

      expect(getResponse.status).toBe(200);
      expect(getResponse.body.data.sessionId).toBe(sessionId);

      // 3. List sessions in room
      const listResponse = await request(app)
        .get('/api/v1/voice/rooms/workflow-room/sessions');

      expect(listResponse.status).toBe(200);
      expect(listResponse.body.data.count).toBe(1);

      // 4. Update session (upsert with same room/user)
      const updateResponse = await request(app)
        .post('/api/v1/voice/sessions')
        .send({
          roomId: 'workflow-room',
          userId: 'workflow-user',
          username: 'UpdatedWorkflowUser',
          canPublishAudio: false,
        });

      expect(updateResponse.status).toBe(200);
      expect(updateResponse.body.data.sessionId).toBe(sessionId);
      expect(updateResponse.body.data.username).toBe('UpdatedWorkflowUser');
      expect(updateResponse.body.data.canPublishAudio).toBe(false);

      // 5. Delete session
      const deleteResponse = await request(app)
        .delete(`/api/v1/voice/sessions/${sessionId}`);

      expect(deleteResponse.status).toBe(204);

      // 6. Verify deletion
      const verifyResponse = await request(app)
        .get(`/api/v1/voice/sessions/${sessionId}`);

      expect(verifyResponse.status).toBe(404);
    });
  });
});

// Note: Testing without LiveKit config is complex due to module caching.
// The config is loaded once at startup. To test missing config, we would need
// to run a separate test file that doesn't set the env vars.
// For now, we skip this test suite as it would require significant test infrastructure changes.

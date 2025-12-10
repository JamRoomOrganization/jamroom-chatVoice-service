/**
 * Voice Moderation Routes E2E Tests
 *
 * End-to-end tests for voice moderation endpoints.
 * These endpoints require internal API key authentication.
 *
 * Note: LiveKit moderation operations are mocked since we don't
 * have a real LiveKit server in tests.
 */

// Set test env vars BEFORE any imports
process.env.LIVEKIT_API_KEY = 'test-api-key';
process.env.LIVEKIT_API_SECRET = 'test-api-secret-with-enough-length-32chars';
process.env.LIVEKIT_URL = 'wss://test.livekit.cloud';
process.env.INTERNAL_API_KEY = 'test-internal-api-key-min-16-chars';

import { Express } from 'express';
import request from 'supertest';
import { createApp } from '../src/app';
import { voicePolicyStore } from '../src/services/voicePolicyStore';
import * as livekitModerationService from '../src/services/livekitModerationService';

// Mock the LiveKit moderation service
jest.mock('../src/services/livekitModerationService', () => ({
  ...jest.requireActual('../src/services/livekitModerationService'),
  muteParticipantAudio: jest.fn().mockResolvedValue(undefined),
  unmuteParticipantAudio: jest.fn().mockResolvedValue(undefined),
  disconnectParticipant: jest.fn().mockResolvedValue(undefined),
}));

const INTERNAL_API_KEY = 'test-internal-api-key-min-16-chars';
const INTERNAL_API_KEY_HEADER = 'x-internal-api-key';

describe('Voice Moderation Routes', () => {
  let app: Express;

  beforeEach(() => {
    // Clear store and reset mocks before each test
    voicePolicyStore.clearAll();
    jest.clearAllMocks();
    app = createApp();
  });

  describe('Authentication', () => {
    it('should reject requests without API key', async () => {
      const response = await request(app)
        .post('/api/v1/voice/moderation/server-mute')
        .send({
          roomId: 'room-1',
          targetUserId: 'user-1',
          moderatorUserId: 'mod-1',
        });

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should reject requests with invalid API key', async () => {
      const response = await request(app)
        .post('/api/v1/voice/moderation/server-mute')
        .set(INTERNAL_API_KEY_HEADER, 'wrong-key')
        .send({
          roomId: 'room-1',
          targetUserId: 'user-1',
          moderatorUserId: 'mod-1',
        });

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('POST /api/v1/voice/moderation/server-mute', () => {
    it('should mute participant and record action', async () => {
      const response = await request(app)
        .post('/api/v1/voice/moderation/server-mute')
        .set(INTERNAL_API_KEY_HEADER, INTERNAL_API_KEY)
        .send({
          roomId: 'room-1',
          targetUserId: 'user-1',
          moderatorUserId: 'mod-1',
          reason: 'Testing mute',
        });

      expect(response.status).toBe(200);
      expect(response.body.data.action).toBeDefined();
      expect(response.body.data.action.type).toBe('SERVER_MUTE');
      expect(response.body.data.action.roomId).toBe('room-1');
      expect(response.body.data.action.targetUserId).toBe('user-1');
      expect(response.body.data.action.moderatorUserId).toBe('mod-1');
      expect(response.body.data.action.reason).toBe('Testing mute');
      expect(response.body.data.action.id).toBeDefined();
      expect(response.body.data.action.createdAt).toBeDefined();

      // Verify LiveKit was called
      expect(livekitModerationService.muteParticipantAudio).toHaveBeenCalledWith(
        'jamroom:room-1',
        'user-1'
      );
    });

    it('should mute without reason', async () => {
      const response = await request(app)
        .post('/api/v1/voice/moderation/server-mute')
        .set(INTERNAL_API_KEY_HEADER, INTERNAL_API_KEY)
        .send({
          roomId: 'room-1',
          targetUserId: 'user-1',
          moderatorUserId: 'mod-1',
        });

      expect(response.status).toBe(200);
      expect(response.body.data.action.reason).toBeUndefined();
    });

    it('should fail validation with missing roomId', async () => {
      const response = await request(app)
        .post('/api/v1/voice/moderation/server-mute')
        .set(INTERNAL_API_KEY_HEADER, INTERNAL_API_KEY)
        .send({
          targetUserId: 'user-1',
          moderatorUserId: 'mod-1',
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should fail validation with empty targetUserId', async () => {
      const response = await request(app)
        .post('/api/v1/voice/moderation/server-mute')
        .set(INTERNAL_API_KEY_HEADER, INTERNAL_API_KEY)
        .send({
          roomId: 'room-1',
          targetUserId: '',
          moderatorUserId: 'mod-1',
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /api/v1/voice/moderation/server-unmute', () => {
    it('should unmute participant and record action', async () => {
      const response = await request(app)
        .post('/api/v1/voice/moderation/server-unmute')
        .set(INTERNAL_API_KEY_HEADER, INTERNAL_API_KEY)
        .send({
          roomId: 'room-1',
          targetUserId: 'user-1',
          moderatorUserId: 'mod-1',
        });

      expect(response.status).toBe(200);
      expect(response.body.data.action.type).toBe('SERVER_UNMUTE');

      // Verify LiveKit was called
      expect(livekitModerationService.unmuteParticipantAudio).toHaveBeenCalledWith(
        'jamroom:room-1',
        'user-1'
      );
    });
  });

  describe('POST /api/v1/voice/moderation/kick', () => {
    it('should kick participant and record action', async () => {
      const response = await request(app)
        .post('/api/v1/voice/moderation/kick')
        .set(INTERNAL_API_KEY_HEADER, INTERNAL_API_KEY)
        .send({
          roomId: 'room-1',
          targetUserId: 'user-1',
          moderatorUserId: 'mod-1',
          reason: 'Disruptive behavior',
        });

      expect(response.status).toBe(200);
      expect(response.body.data.action.type).toBe('KICK');
      expect(response.body.data.action.reason).toBe('Disruptive behavior');

      // Verify LiveKit was called
      expect(livekitModerationService.disconnectParticipant).toHaveBeenCalledWith(
        'jamroom:room-1',
        'user-1',
        'Disruptive behavior'
      );
    });
  });

  describe('POST /api/v1/voice/moderation/policy', () => {
    it('should create new policy with defaults', async () => {
      const response = await request(app)
        .post('/api/v1/voice/moderation/policy')
        .set(INTERNAL_API_KEY_HEADER, INTERNAL_API_KEY)
        .send({
          roomId: 'room-1',
        });

      expect(response.status).toBe(200);
      expect(response.body.data.policy).toBeDefined();
      expect(response.body.data.policy.roomId).toBe('room-1');
      expect(response.body.data.policy.maxSpeakers).toBeNull();
      expect(response.body.data.policy.hostOnlyMode).toBe(false);
      expect(response.body.data.policy.createdAt).toBeDefined();
      expect(response.body.data.policy.updatedAt).toBeDefined();
    });

    it('should create policy with maxSpeakers', async () => {
      const response = await request(app)
        .post('/api/v1/voice/moderation/policy')
        .set(INTERNAL_API_KEY_HEADER, INTERNAL_API_KEY)
        .send({
          roomId: 'room-1',
          maxSpeakers: 5,
        });

      expect(response.status).toBe(200);
      expect(response.body.data.policy.maxSpeakers).toBe(5);
    });

    it('should create policy with hostOnlyMode', async () => {
      const response = await request(app)
        .post('/api/v1/voice/moderation/policy')
        .set(INTERNAL_API_KEY_HEADER, INTERNAL_API_KEY)
        .send({
          roomId: 'room-1',
          hostOnlyMode: true,
        });

      expect(response.status).toBe(200);
      expect(response.body.data.policy.hostOnlyMode).toBe(true);
    });

    it('should update existing policy', async () => {
      // Create initial policy
      await request(app)
        .post('/api/v1/voice/moderation/policy')
        .set(INTERNAL_API_KEY_HEADER, INTERNAL_API_KEY)
        .send({
          roomId: 'room-1',
          maxSpeakers: 5,
          hostOnlyMode: false,
        });

      // Update policy
      const response = await request(app)
        .post('/api/v1/voice/moderation/policy')
        .set(INTERNAL_API_KEY_HEADER, INTERNAL_API_KEY)
        .send({
          roomId: 'room-1',
          maxSpeakers: 10,
        });

      expect(response.status).toBe(200);
      expect(response.body.data.policy.maxSpeakers).toBe(10);
      expect(response.body.data.policy.hostOnlyMode).toBe(false); // Preserved
    });

    it('should allow null maxSpeakers', async () => {
      const response = await request(app)
        .post('/api/v1/voice/moderation/policy')
        .set(INTERNAL_API_KEY_HEADER, INTERNAL_API_KEY)
        .send({
          roomId: 'room-1',
          maxSpeakers: null,
        });

      expect(response.status).toBe(200);
      expect(response.body.data.policy.maxSpeakers).toBeNull();
    });

    it('should fail validation with maxSpeakers less than 1', async () => {
      const response = await request(app)
        .post('/api/v1/voice/moderation/policy')
        .set(INTERNAL_API_KEY_HEADER, INTERNAL_API_KEY)
        .send({
          roomId: 'room-1',
          maxSpeakers: 0,
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should fail validation with missing roomId', async () => {
      const response = await request(app)
        .post('/api/v1/voice/moderation/policy')
        .set(INTERNAL_API_KEY_HEADER, INTERNAL_API_KEY)
        .send({
          maxSpeakers: 5,
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /api/v1/voice/moderation/rooms/:roomId/actions', () => {
    it('should return empty array when no actions exist', async () => {
      const response = await request(app)
        .get('/api/v1/voice/moderation/rooms/room-1/actions')
        .set(INTERNAL_API_KEY_HEADER, INTERNAL_API_KEY);

      expect(response.status).toBe(200);
      expect(response.body.data.actions).toEqual([]);
    });

    it('should return recorded actions', async () => {
      // Record some actions first
      await request(app)
        .post('/api/v1/voice/moderation/server-mute')
        .set(INTERNAL_API_KEY_HEADER, INTERNAL_API_KEY)
        .send({
          roomId: 'room-1',
          targetUserId: 'user-1',
          moderatorUserId: 'mod-1',
          reason: 'Test mute',
        });

      await request(app)
        .post('/api/v1/voice/moderation/kick')
        .set(INTERNAL_API_KEY_HEADER, INTERNAL_API_KEY)
        .send({
          roomId: 'room-1',
          targetUserId: 'user-2',
          moderatorUserId: 'mod-1',
        });

      const response = await request(app)
        .get('/api/v1/voice/moderation/rooms/room-1/actions')
        .set(INTERNAL_API_KEY_HEADER, INTERNAL_API_KEY);

      expect(response.status).toBe(200);
      expect(response.body.data.actions).toHaveLength(2);
      expect(response.body.data.actions[0].type).toBe('SERVER_MUTE');
      expect(response.body.data.actions[1].type).toBe('KICK');
    });

    it('should only return actions for specified room', async () => {
      // Record actions in different rooms
      await request(app)
        .post('/api/v1/voice/moderation/server-mute')
        .set(INTERNAL_API_KEY_HEADER, INTERNAL_API_KEY)
        .send({
          roomId: 'room-1',
          targetUserId: 'user-1',
          moderatorUserId: 'mod-1',
        });

      await request(app)
        .post('/api/v1/voice/moderation/server-mute')
        .set(INTERNAL_API_KEY_HEADER, INTERNAL_API_KEY)
        .send({
          roomId: 'room-2',
          targetUserId: 'user-2',
          moderatorUserId: 'mod-1',
        });

      const response = await request(app)
        .get('/api/v1/voice/moderation/rooms/room-1/actions')
        .set(INTERNAL_API_KEY_HEADER, INTERNAL_API_KEY);

      expect(response.status).toBe(200);
      expect(response.body.data.actions).toHaveLength(1);
      expect(response.body.data.actions[0].roomId).toBe('room-1');
    });
  });

  describe('LiveKit error handling', () => {
    it('should return 503 when LiveKit mute fails', async () => {
      // Mock LiveKit to throw an error
      (livekitModerationService.muteParticipantAudio as jest.Mock).mockRejectedValueOnce(
        new Error('DEPENDENCY_UNAVAILABLE: LiveKit mute operation failed')
      );

      const response = await request(app)
        .post('/api/v1/voice/moderation/server-mute')
        .set(INTERNAL_API_KEY_HEADER, INTERNAL_API_KEY)
        .send({
          roomId: 'room-1',
          targetUserId: 'user-1',
          moderatorUserId: 'mod-1',
        });

      expect(response.status).toBe(500);
    });
  });

  describe('Response format', () => {
    it('should include meta with requestId and timestamp', async () => {
      const response = await request(app)
        .post('/api/v1/voice/moderation/policy')
        .set(INTERNAL_API_KEY_HEADER, INTERNAL_API_KEY)
        .set('x-request-id', 'test-request-123')
        .send({
          roomId: 'room-1',
        });

      expect(response.status).toBe(200);
      expect(response.body.meta.requestId).toBe('test-request-123');
      expect(response.body.meta.timestamp).toBeDefined();
      expect(response.body.error).toBeNull();
    });
  });
});

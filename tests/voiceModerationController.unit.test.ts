/**
 * VoiceModerationController Unit Tests
 *
 * Tests for the voice moderation controller handlers.
 * Verifies Zod validation, correct usage of voicePolicyStore and LiveKit service,
 * and proper API key handling.
 */

// Set test env vars BEFORE any imports
process.env.LIVEKIT_API_KEY = 'test-api-key';
process.env.LIVEKIT_API_SECRET = 'test-api-secret-with-enough-length-32chars';
process.env.LIVEKIT_URL = 'wss://test.livekit.cloud';
process.env.INTERNAL_API_KEY = 'test-internal-api-key-min-16-chars';

import express, { Express, Router } from 'express';
import request from 'supertest';
import { requestIdMiddleware } from '../src/middleware/requestId';
import { errorHandler } from '../src/middleware/errorHandler';
import { validateRequest } from '../src/middleware/validation';
import { requireInternalApiKey, INTERNAL_API_KEY_HEADER } from '../src/middleware/internalAuth';
import { voicePolicyStore } from '../src/services/voicePolicyStore';
import {
  serverMute,
  serverUnmute,
  kick,
  updatePolicy,
  listModerationActions,
} from '../src/controllers/voiceModeration.controller';
import {
  ServerMuteBodySchema,
  ServerUnmuteBodySchema,
  KickBodySchema,
  UpdatePolicyBodySchema,
  ListModerationActionsParamsSchema,
} from '../src/controllers/voiceModeration.schemas';

// Mock LiveKit moderation service
jest.mock('../src/services/livekitModerationService', () => ({
  muteParticipantAudio: jest.fn().mockResolvedValue(undefined),
  unmuteParticipantAudio: jest.fn().mockResolvedValue(undefined),
  disconnectParticipant: jest.fn().mockResolvedValue(undefined),
  toRoomName: jest.fn((roomId: string) => `jamroom:${roomId}`),
}));

const VALID_API_KEY = 'test-internal-api-key-min-16-chars';

describe('VoiceModerationController', () => {
  let app: Express;

  /**
   * Creates a test app with moderation routes.
   */
  function createTestApp(): Express {
    const testApp = express();
    testApp.use(requestIdMiddleware);
    testApp.use(express.json());

    const router = Router();

    // Server mute route
    router.post(
      '/server-mute',
      requireInternalApiKey,
      validateRequest({ body: ServerMuteBodySchema }),
      serverMute
    );

    // Server unmute route
    router.post(
      '/server-unmute',
      requireInternalApiKey,
      validateRequest({ body: ServerUnmuteBodySchema }),
      serverUnmute
    );

    // Kick route
    router.post(
      '/kick',
      requireInternalApiKey,
      validateRequest({ body: KickBodySchema }),
      kick
    );

    // Policy route
    router.post(
      '/policy',
      requireInternalApiKey,
      validateRequest({ body: UpdatePolicyBodySchema }),
      updatePolicy
    );

    // List actions route
    router.get(
      '/rooms/:roomId/actions',
      requireInternalApiKey,
      validateRequest({ params: ListModerationActionsParamsSchema }),
      listModerationActions
    );

    testApp.use('/moderation', router);
    testApp.use(errorHandler);

    return testApp;
  }

  beforeEach(() => {
    jest.clearAllMocks();
    voicePolicyStore.clearAll();
    app = createTestApp();
  });

  describe('Authentication', () => {
    describe('when no API key is provided', () => {
      it('should return 401 UNAUTHORIZED for server-mute', async () => {
        const response = await request(app)
          .post('/moderation/server-mute')
          .send({
            roomId: 'room-1',
            targetUserId: 'user-1',
            moderatorUserId: 'mod-1',
          });

        expect(response.status).toBe(401);
        expect(response.body.error.code).toBe('UNAUTHORIZED');
        expect(response.body.error.message).toBe('MISSING_INTERNAL_API_KEY');
      });

      it('should return 401 UNAUTHORIZED for kick', async () => {
        const response = await request(app)
          .post('/moderation/kick')
          .send({
            roomId: 'room-1',
            targetUserId: 'user-1',
            moderatorUserId: 'mod-1',
          });

        expect(response.status).toBe(401);
      });

      it('should return 401 UNAUTHORIZED for policy', async () => {
        const response = await request(app)
          .post('/moderation/policy')
          .send({ roomId: 'room-1' });

        expect(response.status).toBe(401);
      });

      it('should return 401 UNAUTHORIZED for list actions', async () => {
        const response = await request(app).get('/moderation/rooms/room-1/actions');

        expect(response.status).toBe(401);
      });
    });

    describe('when invalid API key is provided', () => {
      it('should return 401 UNAUTHORIZED', async () => {
        const response = await request(app)
          .post('/moderation/server-mute')
          .set(INTERNAL_API_KEY_HEADER, 'wrong-api-key')
          .send({
            roomId: 'room-1',
            targetUserId: 'user-1',
            moderatorUserId: 'mod-1',
          });

        expect(response.status).toBe(401);
        expect(response.body.error.code).toBe('UNAUTHORIZED');
        expect(response.body.error.message).toBe('INVALID_INTERNAL_API_KEY');
      });

      it('should return 401 for empty API key', async () => {
        const response = await request(app)
          .post('/moderation/server-mute')
          .set(INTERNAL_API_KEY_HEADER, '')
          .send({
            roomId: 'room-1',
            targetUserId: 'user-1',
            moderatorUserId: 'mod-1',
          });

        expect(response.status).toBe(401);
      });
    });
  });

  describe('Zod Validation', () => {
    describe('ServerMuteBodySchema', () => {
      it('should pass with valid body', async () => {
        const response = await request(app)
          .post('/moderation/server-mute')
          .set(INTERNAL_API_KEY_HEADER, VALID_API_KEY)
          .send({
            roomId: 'room-1',
            targetUserId: 'user-1',
            moderatorUserId: 'mod-1',
          });

        expect(response.status).toBe(200);
      });

      it('should fail with missing roomId', async () => {
        const response = await request(app)
          .post('/moderation/server-mute')
          .set(INTERNAL_API_KEY_HEADER, VALID_API_KEY)
          .send({
            targetUserId: 'user-1',
            moderatorUserId: 'mod-1',
          });

        expect(response.status).toBe(400);
        expect(response.body.error.code).toBe('VALIDATION_ERROR');
      });

      it('should fail with missing targetUserId', async () => {
        const response = await request(app)
          .post('/moderation/server-mute')
          .set(INTERNAL_API_KEY_HEADER, VALID_API_KEY)
          .send({
            roomId: 'room-1',
            moderatorUserId: 'mod-1',
          });

        expect(response.status).toBe(400);
        expect(response.body.error.code).toBe('VALIDATION_ERROR');
      });

      it('should fail with missing moderatorUserId', async () => {
        const response = await request(app)
          .post('/moderation/server-mute')
          .set(INTERNAL_API_KEY_HEADER, VALID_API_KEY)
          .send({
            roomId: 'room-1',
            targetUserId: 'user-1',
          });

        expect(response.status).toBe(400);
        expect(response.body.error.code).toBe('VALIDATION_ERROR');
      });

      it('should fail with empty roomId', async () => {
        const response = await request(app)
          .post('/moderation/server-mute')
          .set(INTERNAL_API_KEY_HEADER, VALID_API_KEY)
          .send({
            roomId: '',
            targetUserId: 'user-1',
            moderatorUserId: 'mod-1',
          });

        expect(response.status).toBe(400);
      });

      it('should accept optional reason', async () => {
        const response = await request(app)
          .post('/moderation/server-mute')
          .set(INTERNAL_API_KEY_HEADER, VALID_API_KEY)
          .send({
            roomId: 'room-1',
            targetUserId: 'user-1',
            moderatorUserId: 'mod-1',
            reason: 'Disruptive behavior',
          });

        expect(response.status).toBe(200);
        expect(response.body.data.action.reason).toBe('Disruptive behavior');
      });
    });

    describe('KickBodySchema', () => {
      it('should pass with valid body', async () => {
        const response = await request(app)
          .post('/moderation/kick')
          .set(INTERNAL_API_KEY_HEADER, VALID_API_KEY)
          .send({
            roomId: 'room-1',
            targetUserId: 'user-1',
            moderatorUserId: 'mod-1',
          });

        expect(response.status).toBe(200);
      });

      it('should fail with missing required fields', async () => {
        const response = await request(app)
          .post('/moderation/kick')
          .set(INTERNAL_API_KEY_HEADER, VALID_API_KEY)
          .send({});

        expect(response.status).toBe(400);
        expect(response.body.error.code).toBe('VALIDATION_ERROR');
        expect(response.body.error.details.issues).toBeDefined();
      });
    });

    describe('UpdatePolicyBodySchema', () => {
      it('should pass with only roomId', async () => {
        const response = await request(app)
          .post('/moderation/policy')
          .set(INTERNAL_API_KEY_HEADER, VALID_API_KEY)
          .send({ roomId: 'room-1' });

        expect(response.status).toBe(200);
      });

      it('should pass with maxSpeakers', async () => {
        const response = await request(app)
          .post('/moderation/policy')
          .set(INTERNAL_API_KEY_HEADER, VALID_API_KEY)
          .send({ roomId: 'room-1', maxSpeakers: 5 });

        expect(response.status).toBe(200);
        expect(response.body.data.policy.maxSpeakers).toBe(5);
      });

      it('should pass with null maxSpeakers', async () => {
        const response = await request(app)
          .post('/moderation/policy')
          .set(INTERNAL_API_KEY_HEADER, VALID_API_KEY)
          .send({ roomId: 'room-1', maxSpeakers: null });

        expect(response.status).toBe(200);
        expect(response.body.data.policy.maxSpeakers).toBeNull();
      });

      it('should fail with maxSpeakers less than 1', async () => {
        const response = await request(app)
          .post('/moderation/policy')
          .set(INTERNAL_API_KEY_HEADER, VALID_API_KEY)
          .send({ roomId: 'room-1', maxSpeakers: 0 });

        expect(response.status).toBe(400);
        expect(response.body.error.code).toBe('VALIDATION_ERROR');
      });

      it('should fail with negative maxSpeakers', async () => {
        const response = await request(app)
          .post('/moderation/policy')
          .set(INTERNAL_API_KEY_HEADER, VALID_API_KEY)
          .send({ roomId: 'room-1', maxSpeakers: -1 });

        expect(response.status).toBe(400);
      });

      it('should pass with hostOnlyMode', async () => {
        const response = await request(app)
          .post('/moderation/policy')
          .set(INTERNAL_API_KEY_HEADER, VALID_API_KEY)
          .send({ roomId: 'room-1', hostOnlyMode: true });

        expect(response.status).toBe(200);
        expect(response.body.data.policy.hostOnlyMode).toBe(true);
      });
    });

    describe('ListModerationActionsParamsSchema', () => {
      it('should pass with valid roomId param', async () => {
        const response = await request(app)
          .get('/moderation/rooms/room-123/actions')
          .set(INTERNAL_API_KEY_HEADER, VALID_API_KEY);

        expect(response.status).toBe(200);
      });
    });
  });

  describe('serverMute handler', () => {
    it('should record action in voicePolicyStore', async () => {
      await request(app)
        .post('/moderation/server-mute')
        .set(INTERNAL_API_KEY_HEADER, VALID_API_KEY)
        .send({
          roomId: 'room-1',
          targetUserId: 'user-1',
          moderatorUserId: 'mod-1',
          reason: 'Test mute',
        });

      const actions = voicePolicyStore.listModerationActions('room-1');
      expect(actions).toHaveLength(1);
      expect(actions[0].type).toBe('SERVER_MUTE');
      expect(actions[0].targetUserId).toBe('user-1');
      expect(actions[0].reason).toBe('Test mute');
    });

    it('should return action in response', async () => {
      const response = await request(app)
        .post('/moderation/server-mute')
        .set(INTERNAL_API_KEY_HEADER, VALID_API_KEY)
        .send({
          roomId: 'room-1',
          targetUserId: 'user-1',
          moderatorUserId: 'mod-1',
        });

      expect(response.body.data.action).toBeDefined();
      expect(response.body.data.action.type).toBe('SERVER_MUTE');
      expect(response.body.data.action.id).toBeDefined();
      expect(response.body.data.action.createdAt).toBeDefined();
    });
  });

  describe('serverUnmute handler', () => {
    it('should record SERVER_UNMUTE action', async () => {
      await request(app)
        .post('/moderation/server-unmute')
        .set(INTERNAL_API_KEY_HEADER, VALID_API_KEY)
        .send({
          roomId: 'room-1',
          targetUserId: 'user-1',
          moderatorUserId: 'mod-1',
        });

      const actions = voicePolicyStore.listModerationActions('room-1');
      expect(actions).toHaveLength(1);
      expect(actions[0].type).toBe('SERVER_UNMUTE');
    });
  });

  describe('kick handler', () => {
    it('should record KICK action with reason', async () => {
      const response = await request(app)
        .post('/moderation/kick')
        .set(INTERNAL_API_KEY_HEADER, VALID_API_KEY)
        .send({
          roomId: 'room-1',
          targetUserId: 'user-1',
          moderatorUserId: 'mod-1',
          reason: 'Disruptive',
        });

      expect(response.status).toBe(200);
      expect(response.body.data.action.type).toBe('KICK');
      expect(response.body.data.action.reason).toBe('Disruptive');
    });
  });

  describe('updatePolicy handler', () => {
    it('should create policy via voicePolicyStore', async () => {
      await request(app)
        .post('/moderation/policy')
        .set(INTERNAL_API_KEY_HEADER, VALID_API_KEY)
        .send({
          roomId: 'room-1',
          maxSpeakers: 5,
          hostOnlyMode: true,
        });

      const policy = voicePolicyStore.getPolicy('room-1');
      expect(policy).not.toBeNull();
      expect(policy!.maxSpeakers).toBe(5);
      expect(policy!.hostOnlyMode).toBe(true);
    });

    it('should update existing policy (idempotent upsert)', async () => {
      // Create initial policy
      await request(app)
        .post('/moderation/policy')
        .set(INTERNAL_API_KEY_HEADER, VALID_API_KEY)
        .send({
          roomId: 'room-1',
          maxSpeakers: 5,
        });

      // Update policy
      await request(app)
        .post('/moderation/policy')
        .set(INTERNAL_API_KEY_HEADER, VALID_API_KEY)
        .send({
          roomId: 'room-1',
          maxSpeakers: 10,
        });

      const policy = voicePolicyStore.getPolicy('room-1');
      expect(policy!.maxSpeakers).toBe(10);
      expect(voicePolicyStore.countPolicies()).toBe(1);
    });

    it('should return policy in response', async () => {
      const response = await request(app)
        .post('/moderation/policy')
        .set(INTERNAL_API_KEY_HEADER, VALID_API_KEY)
        .send({ roomId: 'room-1' });

      expect(response.body.data.policy).toBeDefined();
      expect(response.body.data.policy.roomId).toBe('room-1');
      expect(response.body.data.policy.createdAt).toBeDefined();
      expect(response.body.data.policy.updatedAt).toBeDefined();
    });
  });

  describe('listModerationActions handler', () => {
    it('should return empty array when no actions exist', async () => {
      const response = await request(app)
        .get('/moderation/rooms/room-1/actions')
        .set(INTERNAL_API_KEY_HEADER, VALID_API_KEY);

      expect(response.status).toBe(200);
      expect(response.body.data.actions).toEqual([]);
    });

    it('should return actions from voicePolicyStore', async () => {
      // Record some actions via API
      await request(app)
        .post('/moderation/server-mute')
        .set(INTERNAL_API_KEY_HEADER, VALID_API_KEY)
        .send({
          roomId: 'room-1',
          targetUserId: 'user-1',
          moderatorUserId: 'mod-1',
        });

      await request(app)
        .post('/moderation/kick')
        .set(INTERNAL_API_KEY_HEADER, VALID_API_KEY)
        .send({
          roomId: 'room-1',
          targetUserId: 'user-2',
          moderatorUserId: 'mod-1',
        });

      const response = await request(app)
        .get('/moderation/rooms/room-1/actions')
        .set(INTERNAL_API_KEY_HEADER, VALID_API_KEY);

      expect(response.status).toBe(200);
      expect(response.body.data.actions).toHaveLength(2);
    });

    it('should only return actions for the specified room', async () => {
      // Record action in room-1
      await request(app)
        .post('/moderation/server-mute')
        .set(INTERNAL_API_KEY_HEADER, VALID_API_KEY)
        .send({
          roomId: 'room-1',
          targetUserId: 'user-1',
          moderatorUserId: 'mod-1',
        });

      // Record action in room-2
      await request(app)
        .post('/moderation/server-mute')
        .set(INTERNAL_API_KEY_HEADER, VALID_API_KEY)
        .send({
          roomId: 'room-2',
          targetUserId: 'user-2',
          moderatorUserId: 'mod-1',
        });

      // List room-1 actions
      const response = await request(app)
        .get('/moderation/rooms/room-1/actions')
        .set(INTERNAL_API_KEY_HEADER, VALID_API_KEY);

      expect(response.body.data.actions).toHaveLength(1);
      expect(response.body.data.actions[0].roomId).toBe('room-1');
    });
  });

  describe('Response format', () => {
    it('should include meta with requestId and timestamp', async () => {
      const response = await request(app)
        .post('/moderation/policy')
        .set(INTERNAL_API_KEY_HEADER, VALID_API_KEY)
        .set('x-request-id', 'test-request-id-123')
        .send({ roomId: 'room-1' });

      expect(response.body.meta).toBeDefined();
      expect(response.body.meta.requestId).toBe('test-request-id-123');
      expect(response.body.meta.timestamp).toBeDefined();
      expect(response.body.error).toBeNull();
    });

    it('should have data: null on error responses', async () => {
      const response = await request(app)
        .post('/moderation/server-mute')
        .send({
          roomId: 'room-1',
          targetUserId: 'user-1',
          moderatorUserId: 'mod-1',
        });

      expect(response.status).toBe(401);
      expect(response.body.data).toBeNull();
      expect(response.body.error).not.toBeNull();
    });
  });
});

/**
 * VoicePolicyStore Unit Tests
 *
 * Tests for the voice policy store including policies and moderation actions.
 */

import { voicePolicyStore } from '../src/services/voicePolicyStore';

describe('VoicePolicyStore', () => {
  // Clear store before each test
  beforeEach(() => {
    voicePolicyStore.clearAll();
  });

  describe('upsertPolicy', () => {
    it('should create a new policy with defaults when none exists', () => {
      const policy = voicePolicyStore.upsertPolicy({ roomId: 'room-1' });

      expect(policy.roomId).toBe('room-1');
      expect(policy.maxSpeakers).toBeNull();
      expect(policy.hostOnlyMode).toBe(false);
      expect(policy.createdAt).toBeDefined();
      expect(policy.updatedAt).toBeDefined();
    });

    it('should create policy with specified maxSpeakers', () => {
      const policy = voicePolicyStore.upsertPolicy({
        roomId: 'room-1',
        maxSpeakers: 5,
      });

      expect(policy.maxSpeakers).toBe(5);
      expect(policy.hostOnlyMode).toBe(false);
    });

    it('should create policy with hostOnlyMode true', () => {
      const policy = voicePolicyStore.upsertPolicy({
        roomId: 'room-1',
        hostOnlyMode: true,
      });

      expect(policy.maxSpeakers).toBeNull();
      expect(policy.hostOnlyMode).toBe(true);
    });

    it('should create policy with both settings', () => {
      const policy = voicePolicyStore.upsertPolicy({
        roomId: 'room-1',
        maxSpeakers: 3,
        hostOnlyMode: true,
      });

      expect(policy.maxSpeakers).toBe(3);
      expect(policy.hostOnlyMode).toBe(true);
    });

    it('should update existing policy and preserve unchanged fields', () => {
      // Create initial policy
      voicePolicyStore.upsertPolicy({
        roomId: 'room-1',
        maxSpeakers: 5,
        hostOnlyMode: false,
      });

      // Update only maxSpeakers
      const updated = voicePolicyStore.upsertPolicy({
        roomId: 'room-1',
        maxSpeakers: 10,
      });

      expect(updated.maxSpeakers).toBe(10);
      expect(updated.hostOnlyMode).toBe(false); // Preserved
    });

    it('should update existing policy hostOnlyMode only', () => {
      // Create initial policy
      voicePolicyStore.upsertPolicy({
        roomId: 'room-1',
        maxSpeakers: 5,
        hostOnlyMode: false,
      });

      // Update only hostOnlyMode
      const updated = voicePolicyStore.upsertPolicy({
        roomId: 'room-1',
        hostOnlyMode: true,
      });

      expect(updated.maxSpeakers).toBe(5); // Preserved
      expect(updated.hostOnlyMode).toBe(true);
    });

    it('should update updatedAt on update', async () => {
      const initial = voicePolicyStore.upsertPolicy({ roomId: 'room-1' });

      // Small delay to ensure different timestamp
      await new Promise((resolve) => setTimeout(resolve, 10));

      const updated = voicePolicyStore.upsertPolicy({
        roomId: 'room-1',
        maxSpeakers: 5,
      });

      expect(updated.createdAt).toBe(initial.createdAt);
      expect(new Date(updated.updatedAt).getTime()).toBeGreaterThanOrEqual(
        new Date(initial.updatedAt).getTime()
      );
    });

    it('should allow setting maxSpeakers to null', () => {
      // Create with maxSpeakers
      voicePolicyStore.upsertPolicy({
        roomId: 'room-1',
        maxSpeakers: 5,
      });

      // Update to null (unlimited)
      const updated = voicePolicyStore.upsertPolicy({
        roomId: 'room-1',
        maxSpeakers: null,
      });

      expect(updated.maxSpeakers).toBeNull();
    });

    it('should be idempotent - calling upsert twice with same data should not create duplicates', () => {
      voicePolicyStore.upsertPolicy({ roomId: 'room-1', maxSpeakers: 5 });
      voicePolicyStore.upsertPolicy({ roomId: 'room-1', maxSpeakers: 5 });
      voicePolicyStore.upsertPolicy({ roomId: 'room-1', maxSpeakers: 5 });

      expect(voicePolicyStore.countPolicies()).toBe(1);
    });

    it('should be idempotent - same roomId always updates same policy', () => {
      const policy1 = voicePolicyStore.upsertPolicy({
        roomId: 'room-1',
        maxSpeakers: 5,
      });
      const policy2 = voicePolicyStore.upsertPolicy({
        roomId: 'room-1',
        maxSpeakers: 10,
      });

      // Same createdAt means same policy
      expect(policy1.createdAt).toBe(policy2.createdAt);
      expect(policy2.maxSpeakers).toBe(10);
    });
  });

  describe('getPolicy', () => {
    it('should return null for non-existent policy', () => {
      const policy = voicePolicyStore.getPolicy('non-existent');
      expect(policy).toBeNull();
    });

    it('should return existing policy', () => {
      voicePolicyStore.upsertPolicy({
        roomId: 'room-1',
        maxSpeakers: 5,
      });

      const policy = voicePolicyStore.getPolicy('room-1');
      expect(policy).not.toBeNull();
      expect(policy!.roomId).toBe('room-1');
      expect(policy!.maxSpeakers).toBe(5);
    });
  });

  describe('deletePolicy', () => {
    it('should return false for non-existent policy', () => {
      const deleted = voicePolicyStore.deletePolicy('non-existent');
      expect(deleted).toBe(false);
    });

    it('should delete existing policy and return true', () => {
      voicePolicyStore.upsertPolicy({ roomId: 'room-1' });

      const deleted = voicePolicyStore.deletePolicy('room-1');
      expect(deleted).toBe(true);

      const policy = voicePolicyStore.getPolicy('room-1');
      expect(policy).toBeNull();
    });
  });

  describe('countPolicies', () => {
    it('should return 0 when no policies exist', () => {
      expect(voicePolicyStore.countPolicies()).toBe(0);
    });

    it('should return correct count', () => {
      voicePolicyStore.upsertPolicy({ roomId: 'room-1' });
      voicePolicyStore.upsertPolicy({ roomId: 'room-2' });
      voicePolicyStore.upsertPolicy({ roomId: 'room-3' });

      expect(voicePolicyStore.countPolicies()).toBe(3);
    });
  });

  describe('getAllPolicyRoomIds', () => {
    it('should return empty array when no policies exist', () => {
      expect(voicePolicyStore.getAllPolicyRoomIds()).toEqual([]);
    });

    it('should return all room IDs', () => {
      voicePolicyStore.upsertPolicy({ roomId: 'room-1' });
      voicePolicyStore.upsertPolicy({ roomId: 'room-2' });

      const roomIds = voicePolicyStore.getAllPolicyRoomIds();
      expect(roomIds).toHaveLength(2);
      expect(roomIds).toContain('room-1');
      expect(roomIds).toContain('room-2');
    });
  });

  describe('recordModerationAction', () => {
    it('should create action with generated id and createdAt', () => {
      const action = voicePolicyStore.recordModerationAction({
        roomId: 'room-1',
        targetUserId: 'user-1',
        moderatorUserId: 'mod-1',
        type: 'SERVER_MUTE',
      });

      expect(action.id).toBeDefined();
      expect(action.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      );
      expect(action.createdAt).toBeDefined();
      expect(action.roomId).toBe('room-1');
      expect(action.targetUserId).toBe('user-1');
      expect(action.moderatorUserId).toBe('mod-1');
      expect(action.type).toBe('SERVER_MUTE');
    });

    it('should include reason when provided', () => {
      const action = voicePolicyStore.recordModerationAction({
        roomId: 'room-1',
        targetUserId: 'user-1',
        moderatorUserId: 'mod-1',
        type: 'KICK',
        reason: 'Disruptive behavior',
      });

      expect(action.reason).toBe('Disruptive behavior');
    });

    it('should support all action types', () => {
      const types = ['SERVER_MUTE', 'SERVER_UNMUTE', 'KICK', 'BLOCK_SPEAKING'] as const;

      types.forEach((type) => {
        const action = voicePolicyStore.recordModerationAction({
          roomId: 'room-1',
          targetUserId: 'user-1',
          moderatorUserId: 'mod-1',
          type,
        });

        expect(action.type).toBe(type);
      });
    });

    it('should limit actions per room to 100', () => {
      // Create 105 actions
      for (let i = 0; i < 105; i++) {
        voicePolicyStore.recordModerationAction({
          roomId: 'room-1',
          targetUserId: `user-${i}`,
          moderatorUserId: 'mod-1',
          type: 'SERVER_MUTE',
        });
      }

      const actions = voicePolicyStore.listModerationActions('room-1');
      expect(actions).toHaveLength(100);

      // First 5 actions should have been removed
      const targetUserIds = actions.map((a) => a.targetUserId);
      expect(targetUserIds).not.toContain('user-0');
      expect(targetUserIds).not.toContain('user-4');
      expect(targetUserIds).toContain('user-5');
      expect(targetUserIds).toContain('user-104');
    });
  });

  describe('listModerationActions', () => {
    it('should return empty array for room with no actions', () => {
      const actions = voicePolicyStore.listModerationActions('non-existent');
      expect(actions).toEqual([]);
    });

    it('should return actions in chronological order', async () => {
      voicePolicyStore.recordModerationAction({
        roomId: 'room-1',
        targetUserId: 'user-1',
        moderatorUserId: 'mod-1',
        type: 'SERVER_MUTE',
      });

      // Small delay
      await new Promise((resolve) => setTimeout(resolve, 5));

      voicePolicyStore.recordModerationAction({
        roomId: 'room-1',
        targetUserId: 'user-2',
        moderatorUserId: 'mod-1',
        type: 'KICK',
      });

      const actions = voicePolicyStore.listModerationActions('room-1');
      expect(actions).toHaveLength(2);
      expect(actions[0].targetUserId).toBe('user-1');
      expect(actions[1].targetUserId).toBe('user-2');
    });

    it('should only return actions for specified room', () => {
      voicePolicyStore.recordModerationAction({
        roomId: 'room-1',
        targetUserId: 'user-1',
        moderatorUserId: 'mod-1',
        type: 'SERVER_MUTE',
      });

      voicePolicyStore.recordModerationAction({
        roomId: 'room-2',
        targetUserId: 'user-2',
        moderatorUserId: 'mod-1',
        type: 'KICK',
      });

      const room1Actions = voicePolicyStore.listModerationActions('room-1');
      expect(room1Actions).toHaveLength(1);
      expect(room1Actions[0].roomId).toBe('room-1');

      const room2Actions = voicePolicyStore.listModerationActions('room-2');
      expect(room2Actions).toHaveLength(1);
      expect(room2Actions[0].roomId).toBe('room-2');
    });
  });

  describe('countModerationActions', () => {
    it('should return 0 for room with no actions', () => {
      expect(voicePolicyStore.countModerationActions('non-existent')).toBe(0);
    });

    it('should return correct count', () => {
      voicePolicyStore.recordModerationAction({
        roomId: 'room-1',
        targetUserId: 'user-1',
        moderatorUserId: 'mod-1',
        type: 'SERVER_MUTE',
      });

      voicePolicyStore.recordModerationAction({
        roomId: 'room-1',
        targetUserId: 'user-2',
        moderatorUserId: 'mod-1',
        type: 'KICK',
      });

      expect(voicePolicyStore.countModerationActions('room-1')).toBe(2);
    });
  });

  describe('clearModerationActions', () => {
    it('should return 0 for room with no actions', () => {
      expect(voicePolicyStore.clearModerationActions('non-existent')).toBe(0);
    });

    it('should clear all actions for room and return count', () => {
      voicePolicyStore.recordModerationAction({
        roomId: 'room-1',
        targetUserId: 'user-1',
        moderatorUserId: 'mod-1',
        type: 'SERVER_MUTE',
      });

      voicePolicyStore.recordModerationAction({
        roomId: 'room-1',
        targetUserId: 'user-2',
        moderatorUserId: 'mod-1',
        type: 'KICK',
      });

      const cleared = voicePolicyStore.clearModerationActions('room-1');
      expect(cleared).toBe(2);

      expect(voicePolicyStore.listModerationActions('room-1')).toEqual([]);
    });
  });

  describe('clearAll', () => {
    it('should clear all policies and actions', () => {
      voicePolicyStore.upsertPolicy({ roomId: 'room-1' });
      voicePolicyStore.upsertPolicy({ roomId: 'room-2' });
      voicePolicyStore.recordModerationAction({
        roomId: 'room-1',
        targetUserId: 'user-1',
        moderatorUserId: 'mod-1',
        type: 'SERVER_MUTE',
      });

      voicePolicyStore.clearAll();

      expect(voicePolicyStore.countPolicies()).toBe(0);
      expect(voicePolicyStore.listModerationActions('room-1')).toEqual([]);
    });
  });
});

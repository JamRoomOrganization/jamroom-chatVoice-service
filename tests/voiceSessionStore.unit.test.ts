/**
 * VoiceSessionStore Unit Tests
 *
 * Tests for the in-memory voice session store.
 */

import * as voiceSessionStore from '../src/services/voiceSessionStore';
import type { LivekitTokenInfo } from '../src/services/livekitAdapter';

describe('VoiceSessionStore', () => {
  // Clear store before each test
  beforeEach(() => {
    voiceSessionStore.clearAll();
  });

  describe('createOrUpdateSession', () => {
    const mockLivekitInfo: LivekitTokenInfo = {
      roomName: 'jamroom:room-123',
      identity: 'user-456',
      token: 'mock-jwt-token',
      url: 'wss://test.livekit.cloud',
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
    };

    it('should create a new session', () => {
      const session = voiceSessionStore.createOrUpdateSession(
        {
          roomId: 'room-123',
          userId: 'user-456',
          username: 'TestUser',
          canPublishAudio: true,
          canSubscribe: true,
        },
        mockLivekitInfo
      );

      expect(session.sessionId).toBeDefined();
      expect(session.sessionId).toMatch(/^vs_/);
      expect(session.roomId).toBe('room-123');
      expect(session.userId).toBe('user-456');
      expect(session.username).toBe('TestUser');
      expect(session.canPublishAudio).toBe(true);
      expect(session.canSubscribe).toBe(true);
      expect(session.livekit).toEqual(mockLivekitInfo);
      expect(session.createdAt).toBeDefined();
      expect(session.updatedAt).toBeDefined();
    });

    it('should create session without optional username', () => {
      const session = voiceSessionStore.createOrUpdateSession(
        {
          roomId: 'room-123',
          userId: 'user-456',
          canPublishAudio: true,
          canSubscribe: true,
        },
        mockLivekitInfo
      );

      expect(session.username).toBeUndefined();
    });

    it('should update existing session for same roomId/userId', () => {
      // Create first session
      const first = voiceSessionStore.createOrUpdateSession(
        {
          roomId: 'room-123',
          userId: 'user-456',
          username: 'OldName',
          canPublishAudio: false,
          canSubscribe: false,
        },
        mockLivekitInfo
      );

      const firstSessionId = first.sessionId;
      const firstCreatedAt = first.createdAt;

      // Wait a bit to ensure different timestamps
      const updatedLivekitInfo: LivekitTokenInfo = {
        ...mockLivekitInfo,
        token: 'updated-jwt-token',
      };

      // Update with same roomId/userId
      const updated = voiceSessionStore.createOrUpdateSession(
        {
          roomId: 'room-123',
          userId: 'user-456',
          username: 'NewName',
          canPublishAudio: true,
          canSubscribe: true,
        },
        updatedLivekitInfo
      );

      // Should keep same sessionId
      expect(updated.sessionId).toBe(firstSessionId);
      // Should keep original createdAt
      expect(updated.createdAt).toBe(firstCreatedAt);
      // Should update other fields
      expect(updated.username).toBe('NewName');
      expect(updated.canPublishAudio).toBe(true);
      expect(updated.canSubscribe).toBe(true);
      expect(updated.livekit.token).toBe('updated-jwt-token');
      // updatedAt should be >= createdAt
      expect(new Date(updated.updatedAt).getTime()).toBeGreaterThanOrEqual(
        new Date(updated.createdAt).getTime()
      );

      // Should only have one session
      expect(voiceSessionStore.countSessions()).toBe(1);
    });

    it('should create separate sessions for different users in same room', () => {
      voiceSessionStore.createOrUpdateSession(
        {
          roomId: 'room-123',
          userId: 'user-A',
          canPublishAudio: true,
          canSubscribe: true,
        },
        mockLivekitInfo
      );

      const livekitInfoB: LivekitTokenInfo = {
        ...mockLivekitInfo,
        identity: 'user-B',
      };

      voiceSessionStore.createOrUpdateSession(
        {
          roomId: 'room-123',
          userId: 'user-B',
          canPublishAudio: true,
          canSubscribe: true,
        },
        livekitInfoB
      );

      expect(voiceSessionStore.countSessions()).toBe(2);
      expect(voiceSessionStore.countSessionsInRoom('room-123')).toBe(2);
    });
  });

  describe('getSession', () => {
    it('should return session by sessionId', () => {
      const created = voiceSessionStore.createOrUpdateSession(
        {
          roomId: 'room-123',
          userId: 'user-456',
          canPublishAudio: true,
          canSubscribe: true,
        },
        {
          roomName: 'jamroom:room-123',
          identity: 'user-456',
          token: 'mock-token',
          url: 'wss://test.livekit.cloud',
          expiresAt: new Date().toISOString(),
        }
      );

      const found = voiceSessionStore.getSession(created.sessionId);
      expect(found).toEqual(created);
    });

    it('should return null for non-existent sessionId', () => {
      const found = voiceSessionStore.getSession('non-existent-id');
      expect(found).toBeNull();
    });
  });

  describe('findByRoomAndUser', () => {
    it('should find session by roomId and userId', () => {
      const created = voiceSessionStore.createOrUpdateSession(
        {
          roomId: 'room-123',
          userId: 'user-456',
          canPublishAudio: true,
          canSubscribe: true,
        },
        {
          roomName: 'jamroom:room-123',
          identity: 'user-456',
          token: 'mock-token',
          url: 'wss://test.livekit.cloud',
          expiresAt: new Date().toISOString(),
        }
      );

      const found = voiceSessionStore.findByRoomAndUser('room-123', 'user-456');
      expect(found).toEqual(created);
    });

    it('should return null for non-existent room/user combo', () => {
      const found = voiceSessionStore.findByRoomAndUser('room-999', 'user-999');
      expect(found).toBeNull();
    });
  });

  describe('deleteSession', () => {
    it('should delete session by sessionId', () => {
      const created = voiceSessionStore.createOrUpdateSession(
        {
          roomId: 'room-123',
          userId: 'user-456',
          canPublishAudio: true,
          canSubscribe: true,
        },
        {
          roomName: 'jamroom:room-123',
          identity: 'user-456',
          token: 'mock-token',
          url: 'wss://test.livekit.cloud',
          expiresAt: new Date().toISOString(),
        }
      );

      const deleted = voiceSessionStore.deleteSession(created.sessionId);
      expect(deleted).toBe(true);

      // Verify deletion
      expect(voiceSessionStore.getSession(created.sessionId)).toBeNull();
      expect(voiceSessionStore.findByRoomAndUser('room-123', 'user-456')).toBeNull();
      expect(voiceSessionStore.countSessions()).toBe(0);
      expect(voiceSessionStore.countSessionsInRoom('room-123')).toBe(0);
    });

    it('should return false for non-existent sessionId', () => {
      const deleted = voiceSessionStore.deleteSession('non-existent-id');
      expect(deleted).toBe(false);
    });

    it('should not affect other sessions in same room', () => {
      const sessionA = voiceSessionStore.createOrUpdateSession(
        { roomId: 'room-123', userId: 'user-A', canPublishAudio: true, canSubscribe: true },
        { roomName: 'jamroom:room-123', identity: 'user-A', token: 'a', url: 'wss://test', expiresAt: new Date().toISOString() }
      );

      const sessionB = voiceSessionStore.createOrUpdateSession(
        { roomId: 'room-123', userId: 'user-B', canPublishAudio: true, canSubscribe: true },
        { roomName: 'jamroom:room-123', identity: 'user-B', token: 'b', url: 'wss://test', expiresAt: new Date().toISOString() }
      );

      voiceSessionStore.deleteSession(sessionA.sessionId);

      expect(voiceSessionStore.getSession(sessionB.sessionId)).toBeTruthy();
      expect(voiceSessionStore.countSessionsInRoom('room-123')).toBe(1);
    });
  });

  describe('listSessionsByRoom', () => {
    it('should return all sessions in a room', () => {
      voiceSessionStore.createOrUpdateSession(
        { roomId: 'room-123', userId: 'user-A', canPublishAudio: true, canSubscribe: true },
        { roomName: 'jamroom:room-123', identity: 'user-A', token: 'a', url: 'wss://test', expiresAt: new Date().toISOString() }
      );

      voiceSessionStore.createOrUpdateSession(
        { roomId: 'room-123', userId: 'user-B', canPublishAudio: true, canSubscribe: true },
        { roomName: 'jamroom:room-123', identity: 'user-B', token: 'b', url: 'wss://test', expiresAt: new Date().toISOString() }
      );

      voiceSessionStore.createOrUpdateSession(
        { roomId: 'other-room', userId: 'user-C', canPublishAudio: true, canSubscribe: true },
        { roomName: 'jamroom:other-room', identity: 'user-C', token: 'c', url: 'wss://test', expiresAt: new Date().toISOString() }
      );

      const sessions = voiceSessionStore.listSessionsByRoom('room-123');
      expect(sessions).toHaveLength(2);
      expect(sessions.map(s => s.userId).sort()).toEqual(['user-A', 'user-B']);
    });

    it('should return empty array for room with no sessions', () => {
      const sessions = voiceSessionStore.listSessionsByRoom('empty-room');
      expect(sessions).toEqual([]);
    });
  });

  describe('deleteSessionsByRoom', () => {
    it('should delete all sessions in a room', () => {
      voiceSessionStore.createOrUpdateSession(
        { roomId: 'room-123', userId: 'user-A', canPublishAudio: true, canSubscribe: true },
        { roomName: 'jamroom:room-123', identity: 'user-A', token: 'a', url: 'wss://test', expiresAt: new Date().toISOString() }
      );

      voiceSessionStore.createOrUpdateSession(
        { roomId: 'room-123', userId: 'user-B', canPublishAudio: true, canSubscribe: true },
        { roomName: 'jamroom:room-123', identity: 'user-B', token: 'b', url: 'wss://test', expiresAt: new Date().toISOString() }
      );

      voiceSessionStore.createOrUpdateSession(
        { roomId: 'other-room', userId: 'user-C', canPublishAudio: true, canSubscribe: true },
        { roomName: 'jamroom:other-room', identity: 'user-C', token: 'c', url: 'wss://test', expiresAt: new Date().toISOString() }
      );

      const deletedCount = voiceSessionStore.deleteSessionsByRoom('room-123');
      expect(deletedCount).toBe(2);

      expect(voiceSessionStore.listSessionsByRoom('room-123')).toEqual([]);
      expect(voiceSessionStore.countSessions()).toBe(1);
      expect(voiceSessionStore.listSessionsByRoom('other-room')).toHaveLength(1);
    });

    it('should return 0 for room with no sessions', () => {
      const deletedCount = voiceSessionStore.deleteSessionsByRoom('empty-room');
      expect(deletedCount).toBe(0);
    });
  });

  describe('updateSession', () => {
    it('should update specific fields of a session', () => {
      const created = voiceSessionStore.createOrUpdateSession(
        { roomId: 'room-123', userId: 'user-456', username: 'OldName', canPublishAudio: false, canSubscribe: false },
        { roomName: 'jamroom:room-123', identity: 'user-456', token: 'token', url: 'wss://test', expiresAt: new Date().toISOString() }
      );

      const updated = voiceSessionStore.updateSession(created.sessionId, {
        username: 'NewName',
        canPublishAudio: true,
      });

      expect(updated).toBeTruthy();
      expect(updated!.username).toBe('NewName');
      expect(updated!.canPublishAudio).toBe(true);
      expect(updated!.canSubscribe).toBe(false); // unchanged
    });

    it('should return null for non-existent session', () => {
      const updated = voiceSessionStore.updateSession('non-existent', { username: 'Test' });
      expect(updated).toBeNull();
    });
  });

  describe('countSessions', () => {
    it('should return correct total count', () => {
      expect(voiceSessionStore.countSessions()).toBe(0);

      voiceSessionStore.createOrUpdateSession(
        { roomId: 'room-1', userId: 'user-1', canPublishAudio: true, canSubscribe: true },
        { roomName: 'jamroom:room-1', identity: 'user-1', token: 'token', url: 'wss://test', expiresAt: new Date().toISOString() }
      );

      expect(voiceSessionStore.countSessions()).toBe(1);

      voiceSessionStore.createOrUpdateSession(
        { roomId: 'room-2', userId: 'user-2', canPublishAudio: true, canSubscribe: true },
        { roomName: 'jamroom:room-2', identity: 'user-2', token: 'token', url: 'wss://test', expiresAt: new Date().toISOString() }
      );

      expect(voiceSessionStore.countSessions()).toBe(2);
    });
  });

  describe('clearAll', () => {
    it('should clear all sessions', () => {
      voiceSessionStore.createOrUpdateSession(
        { roomId: 'room-1', userId: 'user-1', canPublishAudio: true, canSubscribe: true },
        { roomName: 'jamroom:room-1', identity: 'user-1', token: 'token', url: 'wss://test', expiresAt: new Date().toISOString() }
      );

      voiceSessionStore.createOrUpdateSession(
        { roomId: 'room-2', userId: 'user-2', canPublishAudio: true, canSubscribe: true },
        { roomName: 'jamroom:room-2', identity: 'user-2', token: 'token', url: 'wss://test', expiresAt: new Date().toISOString() }
      );

      expect(voiceSessionStore.countSessions()).toBe(2);

      voiceSessionStore.clearAll();

      expect(voiceSessionStore.countSessions()).toBe(0);
      expect(voiceSessionStore.getAllSessionIds()).toEqual([]);
    });
  });

  describe('getAllSessionIds', () => {
    it('should return all session IDs', () => {
      const session1 = voiceSessionStore.createOrUpdateSession(
        { roomId: 'room-1', userId: 'user-1', canPublishAudio: true, canSubscribe: true },
        { roomName: 'jamroom:room-1', identity: 'user-1', token: 'token', url: 'wss://test', expiresAt: new Date().toISOString() }
      );

      const session2 = voiceSessionStore.createOrUpdateSession(
        { roomId: 'room-2', userId: 'user-2', canPublishAudio: true, canSubscribe: true },
        { roomName: 'jamroom:room-2', identity: 'user-2', token: 'token', url: 'wss://test', expiresAt: new Date().toISOString() }
      );

      const ids = voiceSessionStore.getAllSessionIds();
      expect(ids).toContain(session1.sessionId);
      expect(ids).toContain(session2.sessionId);
      expect(ids).toHaveLength(2);
    });
  });

  describe('listExpiringSessions', () => {
    it('should return empty array when no sessions exist', () => {
      const expiring = voiceSessionStore.listExpiringSessions(600);
      expect(expiring).toEqual([]);
    });

    it('should return sessions expiring within threshold', () => {
      // Session expiring in 5 minutes (300 seconds)
      const expiresIn5Min = new Date(Date.now() + 5 * 60 * 1000).toISOString();
      voiceSessionStore.createOrUpdateSession(
        { roomId: 'room-1', userId: 'user-1', canPublishAudio: true, canSubscribe: true },
        { roomName: 'jamroom:room-1', identity: 'user-1', token: 'token', url: 'wss://test', expiresAt: expiresIn5Min }
      );

      // Session expiring in 15 minutes (900 seconds)
      const expiresIn15Min = new Date(Date.now() + 15 * 60 * 1000).toISOString();
      voiceSessionStore.createOrUpdateSession(
        { roomId: 'room-2', userId: 'user-2', canPublishAudio: true, canSubscribe: true },
        { roomName: 'jamroom:room-2', identity: 'user-2', token: 'token', url: 'wss://test', expiresAt: expiresIn15Min }
      );

      // Threshold of 10 minutes (600 seconds) should only return first session
      const expiring = voiceSessionStore.listExpiringSessions(600);
      expect(expiring).toHaveLength(1);
      expect(expiring[0].roomId).toBe('room-1');
    });

    it('should return all sessions when all are expiring within threshold', () => {
      // Both sessions expire in 5 minutes
      const expiresIn5Min = new Date(Date.now() + 5 * 60 * 1000).toISOString();
      
      voiceSessionStore.createOrUpdateSession(
        { roomId: 'room-1', userId: 'user-1', canPublishAudio: true, canSubscribe: true },
        { roomName: 'jamroom:room-1', identity: 'user-1', token: 'token', url: 'wss://test', expiresAt: expiresIn5Min }
      );

      voiceSessionStore.createOrUpdateSession(
        { roomId: 'room-2', userId: 'user-2', canPublishAudio: true, canSubscribe: true },
        { roomName: 'jamroom:room-2', identity: 'user-2', token: 'token', url: 'wss://test', expiresAt: expiresIn5Min }
      );

      // Threshold of 10 minutes should return both
      const expiring = voiceSessionStore.listExpiringSessions(600);
      expect(expiring).toHaveLength(2);
    });

    it('should return empty array when no sessions are expiring within threshold', () => {
      // Session expires in 1 hour
      const expiresIn1Hour = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      voiceSessionStore.createOrUpdateSession(
        { roomId: 'room-1', userId: 'user-1', canPublishAudio: true, canSubscribe: true },
        { roomName: 'jamroom:room-1', identity: 'user-1', token: 'token', url: 'wss://test', expiresAt: expiresIn1Hour }
      );

      // Threshold of 10 minutes should return nothing
      const expiring = voiceSessionStore.listExpiringSessions(600);
      expect(expiring).toEqual([]);
    });

    it('should include already expired sessions', () => {
      // Session already expired 5 minutes ago
      const expiredAt = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      voiceSessionStore.createOrUpdateSession(
        { roomId: 'room-1', userId: 'user-1', canPublishAudio: true, canSubscribe: true },
        { roomName: 'jamroom:room-1', identity: 'user-1', token: 'token', url: 'wss://test', expiresAt: expiredAt }
      );

      const expiring = voiceSessionStore.listExpiringSessions(600);
      expect(expiring).toHaveLength(1);
      expect(expiring[0].roomId).toBe('room-1');
    });

    it('should handle edge case at exact threshold boundary', () => {
      // Session expiring exactly at threshold (10 minutes from now)
      const expiresAtThreshold = new Date(Date.now() + 600 * 1000).toISOString();
      voiceSessionStore.createOrUpdateSession(
        { roomId: 'room-1', userId: 'user-1', canPublishAudio: true, canSubscribe: true },
        { roomName: 'jamroom:room-1', identity: 'user-1', token: 'token', url: 'wss://test', expiresAt: expiresAtThreshold }
      );

      // Should include session at exact threshold
      const expiring = voiceSessionStore.listExpiringSessions(600);
      expect(expiring).toHaveLength(1);
    });
  });

  describe('getAllSessions', () => {
    it('should return all sessions', () => {
      voiceSessionStore.createOrUpdateSession(
        { roomId: 'room-1', userId: 'user-1', canPublishAudio: true, canSubscribe: true },
        { roomName: 'jamroom:room-1', identity: 'user-1', token: 'token', url: 'wss://test', expiresAt: new Date().toISOString() }
      );

      voiceSessionStore.createOrUpdateSession(
        { roomId: 'room-2', userId: 'user-2', canPublishAudio: true, canSubscribe: true },
        { roomName: 'jamroom:room-2', identity: 'user-2', token: 'token', url: 'wss://test', expiresAt: new Date().toISOString() }
      );

      const sessions = voiceSessionStore.getAllSessions();
      expect(sessions).toHaveLength(2);
    });

    it('should return empty array when no sessions exist', () => {
      const sessions = voiceSessionStore.getAllSessions();
      expect(sessions).toEqual([]);
    });
  });
});

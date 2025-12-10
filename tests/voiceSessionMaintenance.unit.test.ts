/**
 * VoiceSessionMaintenance Unit Tests
 *
 * Tests for the voice session maintenance service.
 */

import * as voiceSessionStore from '../src/services/voiceSessionStore';
import {
  renewExpiringSessions,
  getSessionExpirationStats,
  type TokenIssuer,
} from '../src/services/voiceSessionMaintenance';
import type { LivekitTokenInfo } from '../src/services/livekitAdapter';

describe('VoiceSessionMaintenance', () => {
  // Clear store before each test
  beforeEach(() => {
    voiceSessionStore.clearAll();
  });

  describe('renewExpiringSessions', () => {
    const createMockTokenIssuer = (): jest.MockedFunction<TokenIssuer> => {
      return jest.fn().mockImplementation(async (params) => {
        const newExpiresAt = new Date(Date.now() + 3600 * 1000).toISOString();
        return {
          roomName: `jamroom:${params.roomId}`,
          identity: params.userId,
          token: `new-token-${Date.now()}`,
          url: 'wss://test.livekit.cloud',
          expiresAt: newExpiresAt,
        } as LivekitTokenInfo;
      });
    };

    it('should return 0 when no sessions are expiring', async () => {
      // Create session expiring in 1 hour (not within 10 min threshold)
      const expiresIn1Hour = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      voiceSessionStore.createOrUpdateSession(
        { roomId: 'room-1', userId: 'user-1', canPublishAudio: true, canSubscribe: true },
        { roomName: 'jamroom:room-1', identity: 'user-1', token: 'token', url: 'wss://test', expiresAt: expiresIn1Hour }
      );

      const mockIssuer = createMockTokenIssuer();
      const result = await renewExpiringSessions(600, mockIssuer);

      expect(result.totalExpiring).toBe(0);
      expect(result.renewed).toBe(0);
      expect(result.failed).toBe(0);
      expect(mockIssuer).not.toHaveBeenCalled();
    });

    it('should renew sessions expiring within threshold', async () => {
      // Create session expiring in 5 minutes
      const expiresIn5Min = new Date(Date.now() + 5 * 60 * 1000).toISOString();
      const session = voiceSessionStore.createOrUpdateSession(
        { roomId: 'room-1', userId: 'user-1', username: 'TestUser', canPublishAudio: true, canSubscribe: false },
        { roomName: 'jamroom:room-1', identity: 'user-1', token: 'old-token', url: 'wss://test', expiresAt: expiresIn5Min }
      );

      const mockIssuer = createMockTokenIssuer();
      const result = await renewExpiringSessions(600, mockIssuer);

      expect(result.totalExpiring).toBe(1);
      expect(result.renewed).toBe(1);
      expect(result.failed).toBe(0);
      expect(mockIssuer).toHaveBeenCalledTimes(1);
      expect(mockIssuer).toHaveBeenCalledWith({
        roomId: 'room-1',
        userId: 'user-1',
        username: 'TestUser',
        canPublishAudio: true,
        canSubscribe: false,
      });

      // Verify session was updated
      const updatedSession = voiceSessionStore.getSession(session.sessionId);
      expect(updatedSession?.livekit.token).toMatch(/^new-token-/);
    });

    it('should renew multiple sessions', async () => {
      const expiresIn5Min = new Date(Date.now() + 5 * 60 * 1000).toISOString();
      
      voiceSessionStore.createOrUpdateSession(
        { roomId: 'room-1', userId: 'user-1', canPublishAudio: true, canSubscribe: true },
        { roomName: 'jamroom:room-1', identity: 'user-1', token: 'old-token-1', url: 'wss://test', expiresAt: expiresIn5Min }
      );

      voiceSessionStore.createOrUpdateSession(
        { roomId: 'room-2', userId: 'user-2', canPublishAudio: true, canSubscribe: true },
        { roomName: 'jamroom:room-2', identity: 'user-2', token: 'old-token-2', url: 'wss://test', expiresAt: expiresIn5Min }
      );

      const mockIssuer = createMockTokenIssuer();
      const result = await renewExpiringSessions(600, mockIssuer);

      expect(result.totalExpiring).toBe(2);
      expect(result.renewed).toBe(2);
      expect(result.failed).toBe(0);
      expect(mockIssuer).toHaveBeenCalledTimes(2);
    });

    it('should handle partial failures gracefully', async () => {
      const expiresIn5Min = new Date(Date.now() + 5 * 60 * 1000).toISOString();
      
      voiceSessionStore.createOrUpdateSession(
        { roomId: 'room-1', userId: 'user-1', canPublishAudio: true, canSubscribe: true },
        { roomName: 'jamroom:room-1', identity: 'user-1', token: 'token-1', url: 'wss://test', expiresAt: expiresIn5Min }
      );

      const session2 = voiceSessionStore.createOrUpdateSession(
        { roomId: 'room-2', userId: 'user-2', canPublishAudio: true, canSubscribe: true },
        { roomName: 'jamroom:room-2', identity: 'user-2', token: 'token-2', url: 'wss://test', expiresAt: expiresIn5Min }
      );

      // Mock issuer that fails for second session
      let callCount = 0;
      const mockIssuer: TokenIssuer = jest.fn().mockImplementation(async (params) => {
        callCount++;
        if (params.roomId === 'room-2') {
          throw new Error('Token generation failed');
        }
        return {
          roomName: `jamroom:${params.roomId}`,
          identity: params.userId,
          token: 'new-token',
          url: 'wss://test.livekit.cloud',
          expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
        };
      });

      const result = await renewExpiringSessions(600, mockIssuer);

      expect(result.totalExpiring).toBe(2);
      expect(result.renewed).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.failedSessionIds).toContain(session2.sessionId);
    });

    it('should preserve session permissions during renewal', async () => {
      const expiresIn5Min = new Date(Date.now() + 5 * 60 * 1000).toISOString();
      const session = voiceSessionStore.createOrUpdateSession(
        { roomId: 'room-1', userId: 'user-1', canPublishAudio: false, canSubscribe: true },
        { roomName: 'jamroom:room-1', identity: 'user-1', token: 'old-token', url: 'wss://test', expiresAt: expiresIn5Min }
      );

      const mockIssuer = createMockTokenIssuer();
      await renewExpiringSessions(600, mockIssuer);

      // Verify permissions were passed correctly
      expect(mockIssuer).toHaveBeenCalledWith(
        expect.objectContaining({
          canPublishAudio: false,
          canSubscribe: true,
        })
      );

      // Verify session still has same permissions
      const updatedSession = voiceSessionStore.getSession(session.sessionId);
      expect(updatedSession?.canPublishAudio).toBe(false);
      expect(updatedSession?.canSubscribe).toBe(true);
    });

    it('should update updatedAt timestamp', async () => {
      const expiresIn5Min = new Date(Date.now() + 5 * 60 * 1000).toISOString();
      const session = voiceSessionStore.createOrUpdateSession(
        { roomId: 'room-1', userId: 'user-1', canPublishAudio: true, canSubscribe: true },
        { roomName: 'jamroom:room-1', identity: 'user-1', token: 'old-token', url: 'wss://test', expiresAt: expiresIn5Min }
      );

      const originalUpdatedAt = session.updatedAt;

      // Small delay to ensure timestamp changes
      await new Promise(resolve => setTimeout(resolve, 10));

      const mockIssuer = createMockTokenIssuer();
      await renewExpiringSessions(600, mockIssuer);

      const updatedSession = voiceSessionStore.getSession(session.sessionId);
      expect(new Date(updatedSession!.updatedAt).getTime())
        .toBeGreaterThan(new Date(originalUpdatedAt).getTime());
    });

    it('should handle empty session store', async () => {
      const mockIssuer = createMockTokenIssuer();
      const result = await renewExpiringSessions(600, mockIssuer);

      expect(result.totalExpiring).toBe(0);
      expect(result.renewed).toBe(0);
      expect(result.failed).toBe(0);
      expect(mockIssuer).not.toHaveBeenCalled();
    });
  });

  describe('getSessionExpirationStats', () => {
    it('should return zeros when no sessions exist', () => {
      const stats = getSessionExpirationStats();

      expect(stats.total).toBe(0);
      expect(stats.expired).toBe(0);
      expect(stats.expiringIn5Min).toBe(0);
      expect(stats.expiringIn10Min).toBe(0);
      expect(stats.expiringIn30Min).toBe(0);
    });

    it('should count expired sessions', () => {
      // Create expired session
      const expiredAt = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      voiceSessionStore.createOrUpdateSession(
        { roomId: 'room-1', userId: 'user-1', canPublishAudio: true, canSubscribe: true },
        { roomName: 'jamroom:room-1', identity: 'user-1', token: 'token', url: 'wss://test', expiresAt: expiredAt }
      );

      const stats = getSessionExpirationStats();

      expect(stats.total).toBe(1);
      expect(stats.expired).toBe(1);
    });

    it('should categorize sessions by expiration time', () => {
      // Expired
      voiceSessionStore.createOrUpdateSession(
        { roomId: 'room-1', userId: 'user-1', canPublishAudio: true, canSubscribe: true },
        { roomName: 'jamroom:room-1', identity: 'user-1', token: 'token', url: 'wss://test', 
          expiresAt: new Date(Date.now() - 1000).toISOString() }
      );

      // Expiring in 3 minutes (within 5 min)
      voiceSessionStore.createOrUpdateSession(
        { roomId: 'room-2', userId: 'user-2', canPublishAudio: true, canSubscribe: true },
        { roomName: 'jamroom:room-2', identity: 'user-2', token: 'token', url: 'wss://test', 
          expiresAt: new Date(Date.now() + 3 * 60 * 1000).toISOString() }
      );

      // Expiring in 8 minutes (within 10 min but not 5 min)
      voiceSessionStore.createOrUpdateSession(
        { roomId: 'room-3', userId: 'user-3', canPublishAudio: true, canSubscribe: true },
        { roomName: 'jamroom:room-3', identity: 'user-3', token: 'token', url: 'wss://test', 
          expiresAt: new Date(Date.now() + 8 * 60 * 1000).toISOString() }
      );

      // Expiring in 20 minutes (within 30 min but not 10 min)
      voiceSessionStore.createOrUpdateSession(
        { roomId: 'room-4', userId: 'user-4', canPublishAudio: true, canSubscribe: true },
        { roomName: 'jamroom:room-4', identity: 'user-4', token: 'token', url: 'wss://test', 
          expiresAt: new Date(Date.now() + 20 * 60 * 1000).toISOString() }
      );

      // Expiring in 1 hour (not in any warning category)
      voiceSessionStore.createOrUpdateSession(
        { roomId: 'room-5', userId: 'user-5', canPublishAudio: true, canSubscribe: true },
        { roomName: 'jamroom:room-5', identity: 'user-5', token: 'token', url: 'wss://test', 
          expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString() }
      );

      const stats = getSessionExpirationStats();

      expect(stats.total).toBe(5);
      expect(stats.expired).toBe(1);
      // Cumulative counting:
      // - 3min session counts in 5min, 10min, 30min
      // - 8min session counts in 10min, 30min  
      // - 20min session counts in 30min
      expect(stats.expiringIn5Min).toBe(1);  // Only the 3 min one
      expect(stats.expiringIn10Min).toBe(2); // 3 min + 8 min
      expect(stats.expiringIn30Min).toBe(3); // 3 min + 8 min + 20 min
    });
  });
});

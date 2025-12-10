/**
 * Unit tests for livekitModerationService
 *
 * Tests moderation operations with mocked LiveKit RoomServiceClient.
 * Uses isolateModules to ensure fresh imports for each test.
 */

describe('livekitModerationService', () => {
  // Mock functions accessible in test scope
  let mockMutePublishedTrack: jest.Mock;
  let mockRemoveParticipant: jest.Mock;
  let mockInc: jest.Mock;
  let mockObserve: jest.Mock;

  // Service functions (re-imported for each test)
  let muteParticipantAudio: (roomName: string, identity: string) => Promise<void>;
  let unmuteParticipantAudio: (roomName: string, identity: string) => Promise<void>;
  let disconnectParticipant: (roomName: string, identity: string, reason?: string) => Promise<void>;
  let toRoomName: (roomId: string) => string;
  let resetRoomServiceClient: () => void;

  beforeEach(() => {
    jest.resetModules();

    // Create fresh mocks for each test
    mockMutePublishedTrack = jest.fn();
    mockRemoveParticipant = jest.fn();
    mockInc = jest.fn();
    mockObserve = jest.fn();

    // Mock livekit-server-sdk
    jest.doMock('livekit-server-sdk', () => ({
      RoomServiceClient: jest.fn().mockImplementation(() => ({
        mutePublishedTrack: mockMutePublishedTrack,
        removeParticipant: mockRemoveParticipant,
      })),
    }));

    // Mock config
    jest.doMock('../src/config', () => ({
      config: {
        livekit: {
          apiKey: 'test-api-key',
          apiSecret: 'test-api-secret',
          wsUrl: 'wss://test.livekit.cloud',
        },
        server: { port: 3002 },
      },
    }));

    // Mock metrics
    jest.doMock('../src/services/metrics', () => ({
      metrics: {
        voiceModerationActions: { inc: mockInc },
        moderationLatency: { observe: mockObserve },
      },
      startTimer: () => ({ end: () => 100 }),
    }));

    // Mock logger
    jest.doMock('../src/middleware/logger', () => ({
      logger: {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      },
    }));
  });

  // Helper to load the module with fresh mocks
  async function loadModule() {
    const mod = await import('../src/services/livekitModerationService');
    muteParticipantAudio = mod.muteParticipantAudio;
    unmuteParticipantAudio = mod.unmuteParticipantAudio;
    disconnectParticipant = mod.disconnectParticipant;
    toRoomName = mod.toRoomName;
    resetRoomServiceClient = mod.resetRoomServiceClient;
  }

  // ==========================================================================
  // toRoomName Helper Tests
  // ==========================================================================
  describe('toRoomName', () => {
    beforeEach(async () => {
      await loadModule();
    });

    it('converts room ID to jamroom format', () => {
      expect(toRoomName('abc123')).toBe('jamroom:abc123');
    });

    it('handles empty string', () => {
      expect(toRoomName('')).toBe('jamroom:');
    });

    it('handles special characters in room ID', () => {
      expect(toRoomName('room-with-dashes_123')).toBe('jamroom:room-with-dashes_123');
    });

    it('handles UUID-style room ID', () => {
      const uuid = '550e8400-e29b-41d4-a716-446655440000';
      expect(toRoomName(uuid)).toBe(`jamroom:${uuid}`);
    });
  });

  // ==========================================================================
  // muteParticipantAudio Tests
  // ==========================================================================
  describe('muteParticipantAudio', () => {
    const roomName = 'jamroom:test-room';
    const identity = 'user-123';

    beforeEach(async () => {
      await loadModule();
    });

    it('calls mutePublishedTrack with correct parameters', async () => {
      mockMutePublishedTrack.mockResolvedValueOnce(undefined);

      await muteParticipantAudio(roomName, identity);

      expect(mockMutePublishedTrack).toHaveBeenCalledWith(roomName, identity, 'audio', true);
    });

    it('records success metrics on successful mute', async () => {
      mockMutePublishedTrack.mockResolvedValueOnce(undefined);

      await muteParticipantAudio(roomName, identity);

      expect(mockInc).toHaveBeenCalledWith({ type: 'SERVER_MUTE', result: 'success' });
      expect(mockObserve).toHaveBeenCalled();
    });

    it('handles not found error gracefully', async () => {
      mockMutePublishedTrack.mockRejectedValueOnce(new Error('participant not found'));

      await muteParticipantAudio(roomName, identity);

      expect(mockInc).toHaveBeenCalledWith({ type: 'SERVER_MUTE', result: 'not_found' });
    });

    it('handles room not found error gracefully', async () => {
      mockMutePublishedTrack.mockRejectedValueOnce(new Error('room not found'));

      await muteParticipantAudio(roomName, identity);

      expect(mockInc).toHaveBeenCalledWith({ type: 'SERVER_MUTE', result: 'not_found' });
    });

    it('handles 404 error gracefully', async () => {
      mockMutePublishedTrack.mockRejectedValueOnce(new Error('404'));

      await muteParticipantAudio(roomName, identity);

      expect(mockInc).toHaveBeenCalledWith({ type: 'SERVER_MUTE', result: 'not_found' });
    });

    it('throws AppError on other errors', async () => {
      mockMutePublishedTrack.mockRejectedValueOnce(new Error('Connection refused'));

      await expect(muteParticipantAudio(roomName, identity)).rejects.toThrow(
        'LiveKit mute operation failed'
      );
      expect(mockInc).toHaveBeenCalledWith({ type: 'SERVER_MUTE', result: 'error' });
    });

    it('records error metrics before throwing', async () => {
      mockMutePublishedTrack.mockRejectedValueOnce(new Error('Network error'));

      await expect(muteParticipantAudio(roomName, identity)).rejects.toThrow();

      expect(mockObserve).toHaveBeenCalled();
      expect(mockInc).toHaveBeenCalledWith({ type: 'SERVER_MUTE', result: 'error' });
    });
  });

  // ==========================================================================
  // unmuteParticipantAudio Tests
  // ==========================================================================
  describe('unmuteParticipantAudio', () => {
    const roomName = 'jamroom:test-room';
    const identity = 'user-456';

    beforeEach(async () => {
      await loadModule();
    });

    it('calls mutePublishedTrack with muted=false', async () => {
      mockMutePublishedTrack.mockResolvedValueOnce(undefined);

      await unmuteParticipantAudio(roomName, identity);

      expect(mockMutePublishedTrack).toHaveBeenCalledWith(roomName, identity, 'audio', false);
    });

    it('records success metrics on successful unmute', async () => {
      mockMutePublishedTrack.mockResolvedValueOnce(undefined);

      await unmuteParticipantAudio(roomName, identity);

      expect(mockInc).toHaveBeenCalledWith({ type: 'SERVER_UNMUTE', result: 'success' });
      expect(mockObserve).toHaveBeenCalled();
    });

    it('handles not found error gracefully', async () => {
      mockMutePublishedTrack.mockRejectedValueOnce(new Error('participant not found'));

      await unmuteParticipantAudio(roomName, identity);

      expect(mockInc).toHaveBeenCalledWith({ type: 'SERVER_UNMUTE', result: 'not_found' });
    });

    it('throws AppError on other errors', async () => {
      mockMutePublishedTrack.mockRejectedValueOnce(new Error('Service unavailable'));

      await expect(unmuteParticipantAudio(roomName, identity)).rejects.toThrow(
        'LiveKit unmute operation failed'
      );
      expect(mockInc).toHaveBeenCalledWith({ type: 'SERVER_UNMUTE', result: 'error' });
    });

    it('includes error details in thrown AppError', async () => {
      mockMutePublishedTrack.mockRejectedValueOnce(new Error('Timeout'));

      try {
        await unmuteParticipantAudio(roomName, identity);
        fail('Should have thrown');
      } catch (error: unknown) {
        expect((error as Error).message).toBe('LiveKit unmute operation failed');
      }
    });
  });

  // ==========================================================================
  // disconnectParticipant Tests
  // ==========================================================================
  describe('disconnectParticipant', () => {
    const roomName = 'jamroom:test-room';
    const identity = 'user-789';

    beforeEach(async () => {
      await loadModule();
    });

    it('calls removeParticipant with correct parameters', async () => {
      mockRemoveParticipant.mockResolvedValueOnce(undefined);

      await disconnectParticipant(roomName, identity);

      expect(mockRemoveParticipant).toHaveBeenCalledWith(roomName, identity);
    });

    it('records success metrics on successful kick', async () => {
      mockRemoveParticipant.mockResolvedValueOnce(undefined);

      await disconnectParticipant(roomName, identity);

      expect(mockInc).toHaveBeenCalledWith({ type: 'KICK', result: 'success' });
      expect(mockObserve).toHaveBeenCalled();
    });

    it('accepts optional reason parameter', async () => {
      mockRemoveParticipant.mockResolvedValueOnce(undefined);

      await disconnectParticipant(roomName, identity, 'Violation of rules');

      expect(mockRemoveParticipant).toHaveBeenCalledWith(roomName, identity);
    });

    it('handles not found error gracefully', async () => {
      mockRemoveParticipant.mockRejectedValueOnce(new Error('participant not found'));

      await disconnectParticipant(roomName, identity);

      expect(mockInc).toHaveBeenCalledWith({ type: 'KICK', result: 'not_found' });
    });

    it('throws AppError on other errors', async () => {
      mockRemoveParticipant.mockRejectedValueOnce(new Error('Connection failed'));

      await expect(disconnectParticipant(roomName, identity)).rejects.toThrow(
        'LiveKit kick operation failed'
      );
      expect(mockInc).toHaveBeenCalledWith({ type: 'KICK', result: 'error' });
    });

    it('records error metrics before throwing', async () => {
      mockRemoveParticipant.mockRejectedValueOnce(new Error('Internal error'));

      await expect(disconnectParticipant(roomName, identity, 'test')).rejects.toThrow();

      expect(mockObserve).toHaveBeenCalled();
      expect(mockInc).toHaveBeenCalledWith({ type: 'KICK', result: 'error' });
    });
  });

  // ==========================================================================
  // Edge Cases
  // ==========================================================================
  describe('edge cases', () => {
    beforeEach(async () => {
      await loadModule();
    });

    it('handles non-Error thrown objects in mute', async () => {
      mockMutePublishedTrack.mockRejectedValueOnce('string error');

      await expect(muteParticipantAudio('room', 'user')).rejects.toThrow();
    });

    it('handles non-Error thrown objects in unmute', async () => {
      mockMutePublishedTrack.mockRejectedValueOnce({ code: 500 });

      await expect(unmuteParticipantAudio('room', 'user')).rejects.toThrow();
    });

    it('handles non-Error thrown objects in disconnect', async () => {
      mockRemoveParticipant.mockRejectedValueOnce(null);

      await expect(disconnectParticipant('room', 'user')).rejects.toThrow();
    });
  });
});

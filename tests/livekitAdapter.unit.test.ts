/**
 * LiveKit Adapter Unit Tests
 *
 * Tests for the LiveKit integration service.
 * Note: These tests require LiveKit environment variables to be set,
 * or they test the error handling when config is missing.
 */

import { AppError } from '../src/types/http';

// Store original env values
const originalEnv = {
  LIVEKIT_API_KEY: process.env.LIVEKIT_API_KEY,
  LIVEKIT_API_SECRET: process.env.LIVEKIT_API_SECRET,
  LIVEKIT_URL: process.env.LIVEKIT_URL,
};

describe('LivekitAdapter', () => {
  // Helper to reset module cache for config changes
  const resetModules = () => {
    jest.resetModules();
  };

  afterEach(() => {
    // Restore original env
    process.env.LIVEKIT_API_KEY = originalEnv.LIVEKIT_API_KEY;
    process.env.LIVEKIT_API_SECRET = originalEnv.LIVEKIT_API_SECRET;
    process.env.LIVEKIT_URL = originalEnv.LIVEKIT_URL;
    resetModules();
  });

  describe('issueTokenForUser', () => {
    describe('with LiveKit config', () => {
      beforeEach(() => {
        // Set test env vars
        process.env.LIVEKIT_API_KEY = 'test-api-key';
        process.env.LIVEKIT_API_SECRET = 'test-api-secret-with-enough-length';
        process.env.LIVEKIT_URL = 'wss://test.livekit.cloud';
      });

      it('should generate token with correct room name format', async () => {
        resetModules();
        const { issueTokenForUser } = await import('../src/services/livekitAdapter');

        const tokenInfo = await issueTokenForUser({
          roomId: 'room-123',
          userId: 'user-456',
          canPublishAudio: true,
          canSubscribe: true,
        });

        expect(tokenInfo.roomName).toBe('jamroom:room-123');
        expect(tokenInfo.identity).toBe('user-456');
        expect(tokenInfo.url).toBe('wss://test.livekit.cloud');
        expect(tokenInfo.token).toBeDefined();
        expect(tokenInfo.token.length).toBeGreaterThan(0);
        expect(tokenInfo.expiresAt).toBeDefined();
        // expiresAt should be in the future
        expect(new Date(tokenInfo.expiresAt).getTime()).toBeGreaterThan(Date.now());
      });

      it('should include username in token when provided', async () => {
        resetModules();
        const { issueTokenForUser } = await import('../src/services/livekitAdapter');

        const tokenInfo = await issueTokenForUser({
          roomId: 'room-123',
          userId: 'user-456',
          username: 'John Doe',
          canPublishAudio: true,
          canSubscribe: true,
        });

        // Token should be generated (we can't easily decode it without the SDK)
        expect(tokenInfo.token).toBeDefined();
        expect(tokenInfo.identity).toBe('user-456');
      });

      it('should handle canPublishAudio: false', async () => {
        resetModules();
        const { issueTokenForUser } = await import('../src/services/livekitAdapter');

        const tokenInfo = await issueTokenForUser({
          roomId: 'room-123',
          userId: 'user-456',
          canPublishAudio: false,
          canSubscribe: true,
        });

        // Token should still be generated
        expect(tokenInfo.token).toBeDefined();
        expect(tokenInfo.roomName).toBe('jamroom:room-123');
      });

      it('should calculate expiration based on token TTL', async () => {
        resetModules();
        const { issueTokenForUser } = await import('../src/services/livekitAdapter');

        const beforeCall = Date.now();
        const tokenInfo = await issueTokenForUser({
          roomId: 'room-123',
          userId: 'user-456',
          canPublishAudio: true,
          canSubscribe: true,
        });
        const afterCall = Date.now();

        const expiresAtMs = new Date(tokenInfo.expiresAt).getTime();
        // Default TTL is 3600 seconds (1 hour)
        const expectedMinMs = beforeCall + 3600 * 1000;
        const expectedMaxMs = afterCall + 3600 * 1000;

        expect(expiresAtMs).toBeGreaterThanOrEqual(expectedMinMs);
        expect(expiresAtMs).toBeLessThanOrEqual(expectedMaxMs);
      });
    });

    describe('without LiveKit config', () => {
      beforeEach(() => {
        // Clear LiveKit env vars
        delete process.env.LIVEKIT_API_KEY;
        delete process.env.LIVEKIT_API_SECRET;
        delete process.env.LIVEKIT_URL;
      });

      it('should throw DEPENDENCY_UNAVAILABLE when config is missing', async () => {
        resetModules();
        const { issueTokenForUser } = await import('../src/services/livekitAdapter');

        try {
          await issueTokenForUser({
            roomId: 'room-123',
            userId: 'user-456',
            canPublishAudio: true,
            canSubscribe: true,
          });
          fail('Should have thrown');
        } catch (error) {
          // Check error properties instead of toBeInstanceOf (class identity differs after resetModules)
          const appError = error as AppError;
          expect(appError.name).toBe('AppError');
          expect(appError.code).toBe('DEPENDENCY_UNAVAILABLE');
          expect(appError.httpStatus).toBe(503);
          expect(appError.details).toHaveProperty('missingFields');
        }
      });

      it('should list missing config fields in error details', async () => {
        resetModules();
        const { issueTokenForUser } = await import('../src/services/livekitAdapter');

        try {
          await issueTokenForUser({
            roomId: 'room-123',
            userId: 'user-456',
            canPublishAudio: true,
            canSubscribe: true,
          });
          fail('Should have thrown');
        } catch (error) {
          const appError = error as AppError;
          const missingFields = appError.details?.missingFields as string[];
          expect(missingFields).toContain('LIVEKIT_API_KEY');
          expect(missingFields).toContain('LIVEKIT_API_SECRET');
          expect(missingFields).toContain('LIVEKIT_URL');
        }
      });
    });

    describe('with partial LiveKit config', () => {
      it('should throw when only API key is set', async () => {
        process.env.LIVEKIT_API_KEY = 'test-api-key';
        delete process.env.LIVEKIT_API_SECRET;
        delete process.env.LIVEKIT_URL;
        resetModules();

        const { issueTokenForUser } = await import('../src/services/livekitAdapter');

        try {
          await issueTokenForUser({
            roomId: 'room-123',
            userId: 'user-456',
            canPublishAudio: true,
            canSubscribe: true,
          });
          fail('Should have thrown');
        } catch (error) {
          const appError = error as AppError;
          expect(appError.code).toBe('DEPENDENCY_UNAVAILABLE');
          const missingFields = appError.details?.missingFields as string[];
          expect(missingFields).not.toContain('LIVEKIT_API_KEY');
          expect(missingFields).toContain('LIVEKIT_API_SECRET');
          expect(missingFields).toContain('LIVEKIT_URL');
        }
      });
    });
  });

  describe('LivekitTokenInfo type', () => {
    it('should be exported from the module', async () => {
      // Reset env vars to valid values before importing
      process.env.LIVEKIT_API_KEY = 'test-api-key';
      process.env.LIVEKIT_API_SECRET = 'test-api-secret';
      process.env.LIVEKIT_URL = 'wss://test.livekit.cloud';
      resetModules();

      // LivekitTokenInfo is a type, so we verify the module exports properly
      // by checking that issueTokenForUser is a function
      const { issueTokenForUser } = await import('../src/services/livekitAdapter');
      expect(typeof issueTokenForUser).toBe('function');
    });
  });
});

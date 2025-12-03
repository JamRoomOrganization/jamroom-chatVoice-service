/**
 * Services barrel export.
 *
 * This module re-exports all service modules for convenient imports.
 *
 * Usage:
 * ```typescript
 * import { runReadinessChecks, defaultReadinessChecks } from './services';
 * import { issueTokenForUser } from './services';
 * import * as voiceSessionStore from './services';
 * ```
 *
 * As the service grows, add more exports here:
 * - chatService - Chat message handling
 * - roomService - Room lifecycle management
 */

// Health service - readiness checks
export {
  runReadinessChecks,
  defaultReadinessChecks,
  selfCheck,
  createLiveKitCheck,
  type ReadinessCheck,
} from './health.service';

// LiveKit adapter - token generation for voice sessions
export { issueTokenForUser, type LivekitTokenInfo } from './livekitAdapter';

// Voice session store - in-memory session management
export * as voiceSessionStore from './voiceSessionStore';

// Voice session maintenance - token renewal and lifecycle
export {
  renewExpiringSessions,
  getSessionExpirationStats,
  type RenewalResult,
  type TokenIssuer,
} from './voiceSessionMaintenance';

// Metrics - observability and monitoring
export { metrics, startTimer, createTimer, type Timer } from './metrics';

// Voice policy store - room policies and moderation actions
export {
  voicePolicyStore,
  type UpdateVoiceRoomPolicyParams,
  type RecordModerationActionParams,
} from './voicePolicyStore';

// LiveKit moderation service - server-side moderation
export {
  muteParticipantAudio,
  unmuteParticipantAudio,
  disconnectParticipant,
  toRoomName,
  resetRoomServiceClient,
} from './livekitModerationService';

// Future service exports:
// export * from './chatService';
// export * from './roomService';
// export * from './userService';

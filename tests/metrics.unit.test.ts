/**
 * Metrics Service Unit Tests
 *
 * Tests for the metrics service including counters, histograms, and export.
 */

import { metrics, startTimer } from '../src/services/metrics';

describe('Metrics Service', () => {
  // Reset all metrics before each test
  beforeEach(() => {
    metrics.resetAll();
  });

  describe('Counters', () => {
    describe('voiceSessionsCreated', () => {
      it('should start at 0', () => {
        expect(metrics.voiceSessionsCreated.value()).toBe(0);
      });

      it('should increment by 1 when inc() is called', () => {
        metrics.voiceSessionsCreated.inc();
        expect(metrics.voiceSessionsCreated.value()).toBe(1);
      });

      it('should increment correctly after multiple calls', () => {
        metrics.voiceSessionsCreated.inc();
        metrics.voiceSessionsCreated.inc();
        metrics.voiceSessionsCreated.inc();
        expect(metrics.voiceSessionsCreated.value()).toBe(3);
      });

      it('should add specific value', () => {
        metrics.voiceSessionsCreated.add(5);
        expect(metrics.voiceSessionsCreated.value()).toBe(5);
      });

      it('should throw on negative add value', () => {
        expect(() => metrics.voiceSessionsCreated.add(-1)).toThrow(
          'Counter values must be non-negative'
        );
      });

      it('should reset to 0', () => {
        metrics.voiceSessionsCreated.inc();
        metrics.voiceSessionsCreated.inc();
        metrics.voiceSessionsCreated.reset();
        expect(metrics.voiceSessionsCreated.value()).toBe(0);
      });
    });

    describe('voiceSessionsRenewed', () => {
      it('should track renewals', () => {
        metrics.voiceSessionsRenewed.inc();
        metrics.voiceSessionsRenewed.inc();
        expect(metrics.voiceSessionsRenewed.value()).toBe(2);
      });
    });

    describe('voiceSessionsDeleted', () => {
      it('should track deletions', () => {
        metrics.voiceSessionsDeleted.inc();
        expect(metrics.voiceSessionsDeleted.value()).toBe(1);
      });
    });

    describe('voiceSessionsRenewalFailed', () => {
      it('should track renewal failures', () => {
        metrics.voiceSessionsRenewalFailed.inc();
        metrics.voiceSessionsRenewalFailed.inc();
        expect(metrics.voiceSessionsRenewalFailed.value()).toBe(2);
      });
    });
  });

  describe('Histograms', () => {
    describe('tokenIssuanceLatency', () => {
      it('should start with count 0', () => {
        const data = metrics.tokenIssuanceLatency.data();
        expect(data.count).toBe(0);
        expect(data.sum).toBe(0);
      });

      it('should record single observation', () => {
        metrics.tokenIssuanceLatency.observe(50);
        const data = metrics.tokenIssuanceLatency.data();

        expect(data.count).toBe(1);
        expect(data.sum).toBe(50);
        expect(data.min).toBe(50);
        expect(data.max).toBe(50);
        expect(data.avg).toBe(50);
      });

      it('should record multiple observations', () => {
        metrics.tokenIssuanceLatency.observe(10);
        metrics.tokenIssuanceLatency.observe(20);
        metrics.tokenIssuanceLatency.observe(30);

        const data = metrics.tokenIssuanceLatency.data();

        expect(data.count).toBe(3);
        expect(data.sum).toBe(60);
        expect(data.min).toBe(10);
        expect(data.max).toBe(30);
        expect(data.avg).toBe(20);
      });

      it('should bucket values correctly', () => {
        // Bucket boundaries: [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000]
        metrics.tokenIssuanceLatency.observe(3);   // <= 5
        metrics.tokenIssuanceLatency.observe(7);   // <= 10
        metrics.tokenIssuanceLatency.observe(15);  // <= 25
        metrics.tokenIssuanceLatency.observe(150); // <= 250

        const data = metrics.tokenIssuanceLatency.data();

        // Each value goes into all buckets >= its value
        expect(data.buckets.get(5)).toBe(1);   // 3
        expect(data.buckets.get(10)).toBe(2);  // 3, 7
        expect(data.buckets.get(25)).toBe(3);  // 3, 7, 15
        expect(data.buckets.get(250)).toBe(4); // 3, 7, 15, 150
        expect(data.buckets.get(Infinity)).toBe(4);
      });

      it('should reset correctly', () => {
        metrics.tokenIssuanceLatency.observe(100);
        metrics.tokenIssuanceLatency.observe(200);
        metrics.tokenIssuanceLatency.reset();

        const data = metrics.tokenIssuanceLatency.data();
        expect(data.count).toBe(0);
        expect(data.sum).toBe(0);
      });
    });

    describe('createSessionLatency', () => {
      it('should track session creation latency', () => {
        metrics.createSessionLatency.observe(123.45);
        const data = metrics.createSessionLatency.data();

        expect(data.count).toBe(1);
        expect(data.sum).toBe(123.45);
      });
    });
  });

  describe('Timer', () => {
    it('should measure elapsed time', async () => {
      const timer = startTimer();
      
      // Wait a small amount
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const duration = timer.end();
      
      // Should be at least 10ms (allowing some tolerance)
      expect(duration).toBeGreaterThanOrEqual(5);
      expect(duration).toBeLessThan(100); // Sanity check
    });

    it('should return duration in milliseconds', () => {
      const timer = startTimer();
      const duration = timer.end();
      
      // Duration should be a positive number (even if very small)
      expect(typeof duration).toBe('number');
      expect(duration).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Export', () => {
    describe('Prometheus format', () => {
      it('should export metrics in Prometheus text format', () => {
        metrics.voiceSessionsCreated.inc();
        metrics.voiceSessionsCreated.inc();
        metrics.tokenIssuanceLatency.observe(50);

        const output = metrics.export();

        // Check counters
        expect(output).toContain('# HELP voice_sessions_created_total');
        expect(output).toContain('# TYPE voice_sessions_created_total counter');
        expect(output).toContain('voice_sessions_created_total 2');

        // Check histogram
        expect(output).toContain('# HELP livekit_token_issuance_duration_ms');
        expect(output).toContain('# TYPE livekit_token_issuance_duration_ms histogram');
        expect(output).toContain('livekit_token_issuance_duration_ms_count 1');
        expect(output).toContain('livekit_token_issuance_duration_ms_sum 50');
      });

      it('should include histogram buckets', () => {
        metrics.tokenIssuanceLatency.observe(50);
        const output = metrics.export();

        expect(output).toContain('livekit_token_issuance_duration_ms_bucket{le="50"} 1');
        expect(output).toContain('livekit_token_issuance_duration_ms_bucket{le="100"} 1');
        expect(output).toContain('livekit_token_issuance_duration_ms_bucket{le="+Inf"} 1');
      });
    });

    describe('JSON summary', () => {
      it('should export metrics as JSON summary', () => {
        metrics.voiceSessionsCreated.inc();
        metrics.voiceSessionsRenewed.add(5);
        metrics.tokenIssuanceLatency.observe(100);

        const summary = metrics.summary();

        expect(summary.counters).toEqual({
          voice_sessions_created_total: 1,
          voice_sessions_renewed_total: 5,
          voice_sessions_deleted_total: 0,
          voice_sessions_renewal_failed_total: 0,
          voice_moderation_actions_total: {}, // Moderation actions counter with labels
        });

        expect(summary.histograms).toBeDefined();
        const tokenLatency = summary.histograms as Record<string, unknown>;
        expect(tokenLatency['livekit_token_issuance_duration_ms']).toEqual({
          count: 1,
          sum: 100,
          min: 100,
          max: 100,
          avg: 100,
        });
      });
    });
  });

  describe('Moderation Metrics', () => {
    describe('voiceModerationActions (LabeledCounter)', () => {
      it('should start with empty values', () => {
        const values = metrics.voiceModerationActions.values();
        expect(values.size).toBe(0);
      });

      it('should increment counter for specific labels', () => {
        metrics.voiceModerationActions.inc({ type: 'SERVER_MUTE', result: 'success' });

        expect(metrics.voiceModerationActions.value({ type: 'SERVER_MUTE', result: 'success' })).toBe(1);
        expect(metrics.voiceModerationActions.value({ type: 'SERVER_MUTE', result: 'error' })).toBe(0);
      });

      it('should track multiple label combinations independently', () => {
        metrics.voiceModerationActions.inc({ type: 'SERVER_MUTE', result: 'success' });
        metrics.voiceModerationActions.inc({ type: 'SERVER_MUTE', result: 'success' });
        metrics.voiceModerationActions.inc({ type: 'SERVER_MUTE', result: 'error' });
        metrics.voiceModerationActions.inc({ type: 'SERVER_UNMUTE', result: 'success' });
        metrics.voiceModerationActions.inc({ type: 'KICK', result: 'not_found' });

        expect(metrics.voiceModerationActions.value({ type: 'SERVER_MUTE', result: 'success' })).toBe(2);
        expect(metrics.voiceModerationActions.value({ type: 'SERVER_MUTE', result: 'error' })).toBe(1);
        expect(metrics.voiceModerationActions.value({ type: 'SERVER_UNMUTE', result: 'success' })).toBe(1);
        expect(metrics.voiceModerationActions.value({ type: 'KICK', result: 'not_found' })).toBe(1);
      });

      it('should return all values as map', () => {
        metrics.voiceModerationActions.inc({ type: 'SERVER_MUTE', result: 'success' });
        metrics.voiceModerationActions.inc({ type: 'KICK', result: 'error' });

        const values = metrics.voiceModerationActions.values();
        expect(values.size).toBe(2);
        expect(values.get('type="SERVER_MUTE",result="success"')).toBe(1);
        expect(values.get('type="KICK",result="error"')).toBe(1);
      });

      it('should reset all label combinations', () => {
        metrics.voiceModerationActions.inc({ type: 'SERVER_MUTE', result: 'success' });
        metrics.voiceModerationActions.inc({ type: 'KICK', result: 'not_found' });

        metrics.voiceModerationActions.reset();

        expect(metrics.voiceModerationActions.values().size).toBe(0);
        expect(metrics.voiceModerationActions.value({ type: 'SERVER_MUTE', result: 'success' })).toBe(0);
      });
    });

    describe('moderationLatency', () => {
      it('should track moderation operation latency', () => {
        metrics.moderationLatency.observe(15.5);
        metrics.moderationLatency.observe(25.3);

        const data = metrics.moderationLatency.data();
        expect(data.count).toBe(2);
        expect(data.sum).toBeCloseTo(40.8, 1);
        expect(data.min).toBeCloseTo(15.5, 1);
        expect(data.max).toBeCloseTo(25.3, 1);
      });
    });

    describe('Prometheus export with moderation metrics', () => {
      it('should export labeled counter in Prometheus format', () => {
        metrics.voiceModerationActions.inc({ type: 'SERVER_MUTE', result: 'success' });
        metrics.voiceModerationActions.inc({ type: 'KICK', result: 'error' });
        metrics.moderationLatency.observe(50);

        const output = metrics.export();

        expect(output).toContain('# HELP voice_moderation_actions_total');
        expect(output).toContain('# TYPE voice_moderation_actions_total counter');
        expect(output).toContain('voice_moderation_actions_total{type="SERVER_MUTE",result="success"} 1');
        expect(output).toContain('voice_moderation_actions_total{type="KICK",result="error"} 1');

        expect(output).toContain('# HELP voice_moderation_duration_ms');
        expect(output).toContain('# TYPE voice_moderation_duration_ms histogram');
        expect(output).toContain('voice_moderation_duration_ms_count 1');
      });
    });

    describe('JSON summary with moderation metrics', () => {
      it('should include moderation metrics in summary', () => {
        metrics.voiceModerationActions.inc({ type: 'SERVER_UNMUTE', result: 'success' });
        metrics.voiceModerationActions.inc({ type: 'SERVER_UNMUTE', result: 'success' });
        metrics.moderationLatency.observe(30);

        const summary = metrics.summary();

        const counters = summary.counters as Record<string, unknown>;
        expect(counters.voice_moderation_actions_total).toEqual({
          'type="SERVER_UNMUTE",result="success"': 2,
        });

        const histograms = summary.histograms as Record<string, Record<string, number>>;
        expect(histograms.voice_moderation_duration_ms.count).toBe(1);
        expect(histograms.voice_moderation_duration_ms.sum).toBe(30);
      });
    });
  });

  describe('resetAll', () => {
    it('should reset all counters and histograms', () => {
      // Set some values
      metrics.voiceSessionsCreated.inc();
      metrics.voiceSessionsRenewed.inc();
      metrics.voiceSessionsDeleted.inc();
      metrics.voiceSessionsRenewalFailed.inc();
      metrics.tokenIssuanceLatency.observe(100);
      metrics.createSessionLatency.observe(50);

      // Reset all
      metrics.resetAll();

      // Verify counters are reset
      expect(metrics.voiceSessionsCreated.value()).toBe(0);
      expect(metrics.voiceSessionsRenewed.value()).toBe(0);
      expect(metrics.voiceSessionsDeleted.value()).toBe(0);
      expect(metrics.voiceSessionsRenewalFailed.value()).toBe(0);

      // Verify histograms are reset
      expect(metrics.tokenIssuanceLatency.data().count).toBe(0);
      expect(metrics.createSessionLatency.data().count).toBe(0);
    });

    it('should reset moderation metrics', () => {
      metrics.voiceModerationActions.inc({ type: 'SERVER_MUTE', result: 'success' });
      metrics.voiceModerationActions.inc({ type: 'KICK', result: 'error' });
      metrics.moderationLatency.observe(100);

      metrics.resetAll();

      expect(metrics.voiceModerationActions.values().size).toBe(0);
      expect(metrics.moderationLatency.data().count).toBe(0);
    });
  });
});

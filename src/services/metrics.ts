/**
 * @module metrics
 * @description Prometheus-style metrics service for observability.
 *
 * Provides counters and histograms for tracking:
 * - Voice session lifecycle (created, renewed, deleted)
 * - Operation latencies (token issuance, API endpoints)
 *
 * Metrics can be exported via GET /metrics endpoint in Prometheus format.
 *
 * @example
 * ```typescript
 * import { metrics } from './services/metrics';
 *
 * // Increment counter
 * metrics.voiceSessionsCreated.inc();
 *
 * // Record histogram value
 * metrics.tokenIssuanceLatency.observe(123.45);
 *
 * // Get all metrics in Prometheus format
 * const output = metrics.export();
 * ```
 */

import { logger } from '../middleware/logger';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Counter metric - monotonically increasing value.
 */
interface Counter {
  /** Increment counter by 1 */
  inc(): void;
  /** Increment counter by a specific amount */
  add(value: number): void;
  /** Get current value */
  value(): number;
  /** Reset counter to 0 (useful for testing) */
  reset(): void;
}

/**
 * Histogram metric - tracks distribution of values.
 * Records values in buckets for percentile calculations.
 */
interface Histogram {
  /** Record a value in milliseconds */
  observe(value: number): void;
  /** Get histogram data */
  data(): HistogramData;
  /** Reset histogram (useful for testing) */
  reset(): void;
}

/**
 * Histogram data for export.
 */
interface HistogramData {
  count: number;
  sum: number;
  buckets: Map<number, number>;
  min: number;
  max: number;
  avg: number;
}

/**
 * Labels for metrics (optional key-value pairs).
 */
interface MetricLabels {
  [key: string]: string;
}

/**
 * Moderation action types for metrics labels.
 */
export type ModerationActionType = 'SERVER_MUTE' | 'SERVER_UNMUTE' | 'KICK';

/**
 * Moderation result types for metrics labels.
 */
export type ModerationResultType = 'success' | 'error' | 'not_found';

/**
 * Labels for moderation counter.
 * Using index signature to satisfy Record<string, string> constraint.
 */
export interface ModerationLabels {
  type: ModerationActionType;
  result: ModerationResultType;
  [key: string]: string; // Index signature for Record<string, string> compatibility
}

// ============================================================================
// COUNTER IMPLEMENTATION
// ============================================================================

/**
 * Creates a counter metric.
 *
 * @param name - Metric name
 * @param help - Description of the metric
 * @returns Counter instance
 */
function createCounter(name: string, help: string): Counter {
  let _value = 0;

  return {
    inc(): void {
      _value++;
      logger.debug({ metric: name, value: _value }, `Counter ${name} incremented`);
    },
    add(value: number): void {
      if (value < 0) {
        throw new Error('Counter values must be non-negative');
      }
      _value += value;
      logger.debug({ metric: name, value: _value, added: value }, `Counter ${name} added`);
    },
    value(): number {
      return _value;
    },
    reset(): void {
      _value = 0;
    },
  };
}

// ============================================================================
// LABELED COUNTER IMPLEMENTATION
// ============================================================================

/**
 * Labeled counter metric - counter with multiple label combinations.
 */
interface LabeledCounter<T extends Record<string, string>> {
  /** Increment counter by 1 for given labels */
  inc(labels: T): void;
  /** Get current value for given labels */
  value(labels: T): number;
  /** Get all values as a map of label string to value */
  values(): Map<string, number>;
  /** Reset all counters (useful for testing) */
  reset(): void;
}

/**
 * Creates a labeled counter metric.
 *
 * @param name - Metric name
 * @param help - Description of the metric
 * @param labelNames - Array of label names
 * @returns LabeledCounter instance
 */
function createLabeledCounter<T extends Record<string, string>>(
  name: string,
  help: string,
  labelNames: (keyof T)[]
): LabeledCounter<T> {
  const _values = new Map<string, number>();

  const labelsToKey = (labels: T): string => {
    return labelNames.map((k) => `${String(k)}="${labels[k]}"`).join(',');
  };

  return {
    inc(labels: T): void {
      const key = labelsToKey(labels);
      const current = _values.get(key) || 0;
      _values.set(key, current + 1);
      logger.debug(
        { metric: name, labels, value: current + 1 },
        `Counter ${name}{${key}} incremented`
      );
    },
    value(labels: T): number {
      const key = labelsToKey(labels);
      return _values.get(key) || 0;
    },
    values(): Map<string, number> {
      return new Map(_values);
    },
    reset(): void {
      _values.clear();
    },
  };
}

// ============================================================================
// HISTOGRAM IMPLEMENTATION
// ============================================================================

/**
 * Default bucket boundaries for latency histograms (in milliseconds).
 * Covers typical API latencies from 5ms to 10s.
 */
const DEFAULT_BUCKETS = [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000];

/**
 * Creates a histogram metric.
 *
 * @param name - Metric name
 * @param help - Description of the metric
 * @param buckets - Bucket boundaries (default: latency buckets in ms)
 * @returns Histogram instance
 */
function createHistogram(
  name: string,
  help: string,
  buckets: number[] = DEFAULT_BUCKETS
): Histogram {
  let _count = 0;
  let _sum = 0;
  let _min = Infinity;
  let _max = -Infinity;
  const _buckets = new Map<number, number>();

  // Initialize buckets
  for (const bound of buckets) {
    _buckets.set(bound, 0);
  }
  _buckets.set(Infinity, 0); // +Inf bucket

  return {
    observe(value: number): void {
      _count++;
      _sum += value;
      _min = Math.min(_min, value);
      _max = Math.max(_max, value);

      // Increment appropriate buckets
      for (const [bound, count] of _buckets) {
        if (value <= bound) {
          _buckets.set(bound, count + 1);
        }
      }

      logger.debug(
        { metric: name, value, count: _count, avg: _sum / _count },
        `Histogram ${name} observed`
      );
    },
    data(): HistogramData {
      return {
        count: _count,
        sum: _sum,
        buckets: new Map(_buckets),
        min: _count > 0 ? _min : 0,
        max: _count > 0 ? _max : 0,
        avg: _count > 0 ? _sum / _count : 0,
      };
    },
    reset(): void {
      _count = 0;
      _sum = 0;
      _min = Infinity;
      _max = -Infinity;
      for (const bound of _buckets.keys()) {
        _buckets.set(bound, 0);
      }
    },
  };
}

// ============================================================================
// TIMER UTILITY
// ============================================================================

/**
 * Timer for measuring operation duration.
 *
 * @example
 * ```typescript
 * const timer = metrics.startTimer();
 * // ... do work ...
 * const durationMs = timer.end();
 * histogram.observe(durationMs);
 * ```
 */
export interface Timer {
  /** End the timer and return duration in milliseconds */
  end(): number;
}

/**
 * Starts a timer for measuring operation duration.
 *
 * @returns Timer instance
 */
export function startTimer(): Timer {
  const start = process.hrtime.bigint();
  return {
    end(): number {
      const end = process.hrtime.bigint();
      const durationNs = Number(end - start);
      return durationNs / 1_000_000; // Convert to milliseconds
    },
  };
}

// ============================================================================
// METRICS REGISTRY
// ============================================================================

/**
 * Application metrics registry.
 *
 * All application metrics should be defined here for centralized management.
 */
export const metrics = {
  // -------------------------------------------------------------------------
  // VOICE SESSION COUNTERS
  // -------------------------------------------------------------------------

  /**
   * Total number of voice sessions created.
   */
  voiceSessionsCreated: createCounter(
    'voice_sessions_created_total',
    'Total number of voice sessions created'
  ),

  /**
   * Total number of voice sessions renewed (token refresh).
   */
  voiceSessionsRenewed: createCounter(
    'voice_sessions_renewed_total',
    'Total number of voice sessions renewed'
  ),

  /**
   * Total number of voice sessions deleted.
   */
  voiceSessionsDeleted: createCounter(
    'voice_sessions_deleted_total',
    'Total number of voice sessions deleted'
  ),

  /**
   * Total number of voice session renewal failures.
   */
  voiceSessionsRenewalFailed: createCounter(
    'voice_sessions_renewal_failed_total',
    'Total number of voice session renewal failures'
  ),

  // -------------------------------------------------------------------------
  // LATENCY HISTOGRAMS
  // -------------------------------------------------------------------------

  /**
   * Latency histogram for LiveKit token issuance.
   * Measures time to generate a LiveKit access token.
   */
  tokenIssuanceLatency: createHistogram(
    'livekit_token_issuance_duration_ms',
    'Latency of LiveKit token issuance in milliseconds'
  ),

  /**
   * Latency histogram for POST /api/v1/voice/sessions endpoint.
   * Measures total request processing time.
   */
  createSessionLatency: createHistogram(
    'voice_session_create_duration_ms',
    'Latency of voice session creation endpoint in milliseconds'
  ),

  // -------------------------------------------------------------------------
  // MODERATION METRICS
  // -------------------------------------------------------------------------

  /**
   * Total number of voice moderation actions.
   * Labels: type (SERVER_MUTE, SERVER_UNMUTE, KICK), result (success, error, not_found)
   */
  voiceModerationActions: createLabeledCounter<ModerationLabels>(
    'voice_moderation_actions_total',
    'Total number of voice moderation actions',
    ['type', 'result']
  ),

  /**
   * Latency histogram for LiveKit moderation operations.
   * Measures time to execute moderation actions (mute, unmute, kick).
   */
  moderationLatency: createHistogram(
    'voice_moderation_duration_ms',
    'Latency of voice moderation operations in milliseconds'
  ),

  // -------------------------------------------------------------------------
  // UTILITY METHODS
  // -------------------------------------------------------------------------

  /**
   * Exports all metrics in Prometheus text format.
   *
   * @returns Prometheus-formatted metrics string
   */
  export(): string {
    const lines: string[] = [];

    // Helper to format counter
    const formatCounter = (name: string, help: string, value: number): void => {
      lines.push(`# HELP ${name} ${help}`);
      lines.push(`# TYPE ${name} counter`);
      lines.push(`${name} ${value}`);
      lines.push('');
    };

    // Helper to format histogram
    const formatHistogram = (name: string, help: string, data: HistogramData): void => {
      lines.push(`# HELP ${name} ${help}`);
      lines.push(`# TYPE ${name} histogram`);

      // Bucket lines
      const sortedBuckets = Array.from(data.buckets.entries())
        .filter(([bound]) => bound !== Infinity)
        .sort((a, b) => a[0] - b[0]);

      for (const [bound, count] of sortedBuckets) {
        lines.push(`${name}_bucket{le="${bound}"} ${count}`);
      }
      lines.push(`${name}_bucket{le="+Inf"} ${data.buckets.get(Infinity) || 0}`);
      lines.push(`${name}_sum ${data.sum}`);
      lines.push(`${name}_count ${data.count}`);
      lines.push('');
    };

    // Helper to format labeled counter
    const formatLabeledCounter = (
      name: string,
      help: string,
      values: Map<string, number>
    ): void => {
      lines.push(`# HELP ${name} ${help}`);
      lines.push(`# TYPE ${name} counter`);
      for (const [labels, value] of values.entries()) {
        lines.push(`${name}{${labels}} ${value}`);
      }
      lines.push('');
    };

    // Export counters
    formatCounter(
      'voice_sessions_created_total',
      'Total number of voice sessions created',
      metrics.voiceSessionsCreated.value()
    );
    formatCounter(
      'voice_sessions_renewed_total',
      'Total number of voice sessions renewed',
      metrics.voiceSessionsRenewed.value()
    );
    formatCounter(
      'voice_sessions_deleted_total',
      'Total number of voice sessions deleted',
      metrics.voiceSessionsDeleted.value()
    );
    formatCounter(
      'voice_sessions_renewal_failed_total',
      'Total number of voice session renewal failures',
      metrics.voiceSessionsRenewalFailed.value()
    );

    // Export histograms
    formatHistogram(
      'livekit_token_issuance_duration_ms',
      'Latency of LiveKit token issuance in milliseconds',
      metrics.tokenIssuanceLatency.data()
    );
    formatHistogram(
      'voice_session_create_duration_ms',
      'Latency of voice session creation endpoint in milliseconds',
      metrics.createSessionLatency.data()
    );

    // Export moderation metrics
    formatLabeledCounter(
      'voice_moderation_actions_total',
      'Total number of voice moderation actions',
      metrics.voiceModerationActions.values()
    );
    formatHistogram(
      'voice_moderation_duration_ms',
      'Latency of voice moderation operations in milliseconds',
      metrics.moderationLatency.data()
    );

    return lines.join('\n');
  },

  /**
   * Resets all metrics to initial state.
   * Primarily used for testing.
   */
  resetAll(): void {
    metrics.voiceSessionsCreated.reset();
    metrics.voiceSessionsRenewed.reset();
    metrics.voiceSessionsDeleted.reset();
    metrics.voiceSessionsRenewalFailed.reset();
    metrics.tokenIssuanceLatency.reset();
    metrics.createSessionLatency.reset();
    metrics.voiceModerationActions.reset();
    metrics.moderationLatency.reset();
  },

  /**
   * Gets a summary of all metrics as a plain object.
   * Useful for JSON export or debugging.
   */
  summary(): Record<string, unknown> {
    const tokenLatency = metrics.tokenIssuanceLatency.data();
    const createLatency = metrics.createSessionLatency.data();
    const moderationLatencyData = metrics.moderationLatency.data();

    // Convert moderation actions to object
    const moderationActions: Record<string, number> = {};
    for (const [labels, value] of metrics.voiceModerationActions.values()) {
      moderationActions[labels] = value;
    }

    return {
      counters: {
        voice_sessions_created_total: metrics.voiceSessionsCreated.value(),
        voice_sessions_renewed_total: metrics.voiceSessionsRenewed.value(),
        voice_sessions_deleted_total: metrics.voiceSessionsDeleted.value(),
        voice_sessions_renewal_failed_total: metrics.voiceSessionsRenewalFailed.value(),
        voice_moderation_actions_total: moderationActions,
      },
      histograms: {
        livekit_token_issuance_duration_ms: {
          count: tokenLatency.count,
          sum: tokenLatency.sum,
          min: tokenLatency.min,
          max: tokenLatency.max,
          avg: tokenLatency.avg,
        },
        voice_session_create_duration_ms: {
          count: createLatency.count,
          sum: createLatency.sum,
          min: createLatency.min,
          max: createLatency.max,
          avg: createLatency.avg,
        },
        voice_moderation_duration_ms: {
          count: moderationLatencyData.count,
          sum: moderationLatencyData.sum,
          min: moderationLatencyData.min,
          max: moderationLatencyData.max,
          avg: moderationLatencyData.avg,
        },
      },
    };
  },
};

// Re-export startTimer for convenience
export { startTimer as createTimer };

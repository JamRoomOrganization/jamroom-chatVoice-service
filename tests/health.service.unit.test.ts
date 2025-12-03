import {
  runReadinessChecks,
  selfCheck,
  createLiveKitCheck,
  ReadinessCheck,
} from '../src/services/health.service';
import { CheckStatus, HealthCheckResult } from '../src/types/health';

describe('Health Service', () => {
  describe('selfCheck', () => {
    it('should have correct name', () => {
      expect(selfCheck.name).toBe('self');
    });

    it('should return pass status when check is called', async () => {
      const result = await selfCheck.check();

      expect(result.name).toBe('self');
      expect(result.status).toBe('pass');
    });

    it('should include details in result', async () => {
      const result = await selfCheck.check();

      expect(result.details).toBeDefined();
      expect(result.details?.message).toBe('Service is operational');
    });
  });

  describe('createLiveKitCheck', () => {
    it('should create a check with correct name', () => {
      const check = createLiveKitCheck();

      expect(check.name).toBe('livekit');
    });

    it('should return pass status (pending implementation)', async () => {
      const check = createLiveKitCheck();
      const result = await check.check();

      expect(result.status).toBe('pass');
      expect(result.details?.implemented).toBe(false);
    });
  });

  describe('runReadinessChecks', () => {
    it('should return pass status when all checks pass', async () => {
      const passingChecks: ReadinessCheck[] = [
        { name: 'check1', check: async () => ({ name: 'check1', status: 'pass' as CheckStatus }) },
        { name: 'check2', check: async () => ({ name: 'check2', status: 'pass' as CheckStatus }) },
      ];

      const result = await runReadinessChecks(passingChecks);

      expect(result.status).toBe('pass');
      expect(result.checks).toHaveLength(2);
      expect(result.checks[0].status).toBe('pass');
      expect(result.checks[1].status).toBe('pass');
    });

    it('should return fail status when any check fails', async () => {
      const mixedChecks: ReadinessCheck[] = [
        { name: 'healthy', check: async () => ({ name: 'healthy', status: 'pass' as CheckStatus }) },
        { name: 'unhealthy', check: async () => ({ name: 'unhealthy', status: 'fail' as CheckStatus, details: { error: 'Connection refused' } }) },
      ];

      const result = await runReadinessChecks(mixedChecks);

      expect(result.status).toBe('fail');
      expect(result.checks).toHaveLength(2);
    });

    it('should return warn status when checks have warnings but no failures', async () => {
      const warnChecks: ReadinessCheck[] = [
        { name: 'fast', check: async () => ({ name: 'fast', status: 'pass' as CheckStatus }) },
        { name: 'slow', check: async () => ({ name: 'slow', status: 'warn' as CheckStatus, details: { message: 'Response time degraded' } }) },
      ];

      const result = await runReadinessChecks(warnChecks);

      expect(result.status).toBe('warn');
    });

    it('should prioritize fail over warn', async () => {
      const allStatusesChecks: ReadinessCheck[] = [
        { name: 'ok', check: async () => ({ name: 'ok', status: 'pass' as CheckStatus }) },
        { name: 'slow', check: async () => ({ name: 'slow', status: 'warn' as CheckStatus }) },
        { name: 'broken', check: async () => ({ name: 'broken', status: 'fail' as CheckStatus, details: { error: 'Service unavailable' } }) },
      ];

      const result = await runReadinessChecks(allStatusesChecks);

      expect(result.status).toBe('fail');
    });

    it('should handle empty checks array', async () => {
      const result = await runReadinessChecks([]);

      expect(result.status).toBe('pass');
      expect(result.checks).toHaveLength(0);
    });

    it('should handle check that throws an error', async () => {
      const errorCheck: ReadinessCheck[] = [
        {
          name: 'failing',
          check: async () => {
            throw new Error('Unexpected error in check');
          },
        },
      ];

      const result = await runReadinessChecks(errorCheck);

      expect(result.status).toBe('fail');
      expect(result.checks[0].status).toBe('fail');
      expect(result.checks[0].details?.error).toContain('Unexpected error');
    });

    it('should run checks in parallel', async () => {
      const startTime = Date.now();
      const delayMs = 50;

      const parallelChecks: ReadinessCheck[] = [
        {
          name: 'check1',
          check: async () => {
            await new Promise((resolve) => setTimeout(resolve, delayMs));
            return { name: 'check1', status: 'pass' as CheckStatus };
          },
        },
        {
          name: 'check2',
          check: async () => {
            await new Promise((resolve) => setTimeout(resolve, delayMs));
            return { name: 'check2', status: 'pass' as CheckStatus };
          },
        },
        {
          name: 'check3',
          check: async () => {
            await new Promise((resolve) => setTimeout(resolve, delayMs));
            return { name: 'check3', status: 'pass' as CheckStatus };
          },
        },
      ];

      await runReadinessChecks(parallelChecks);
      const elapsed = Date.now() - startTime;

      // If parallel, should take ~50ms. If sequential, would take ~150ms
      expect(elapsed).toBeLessThan(delayMs * 2);
    });

    it('should preserve check order in results', async () => {
      const orderedChecks: ReadinessCheck[] = [
        { name: 'alpha', check: async () => ({ name: 'alpha', status: 'pass' as CheckStatus }) },
        { name: 'beta', check: async () => ({ name: 'beta', status: 'pass' as CheckStatus }) },
        { name: 'gamma', check: async () => ({ name: 'gamma', status: 'pass' as CheckStatus }) },
      ];

      const result = await runReadinessChecks(orderedChecks);

      expect(result.checks.map((c) => c.name)).toEqual(['alpha', 'beta', 'gamma']);
    });
  });

  describe('Health Check Result Structure', () => {
    it('should return correct HealthResponseData structure', async () => {
      const checks: ReadinessCheck[] = [
        { name: 'test', check: async () => ({ name: 'test', status: 'pass' as CheckStatus }) },
      ];

      const result = await runReadinessChecks(checks);

      // Validate structure
      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('checks');
      expect(['pass', 'warn', 'fail']).toContain(result.status);
      expect(Array.isArray(result.checks)).toBe(true);
    });

    it('should include optional details only when provided', async () => {
      const checksWithDetails: ReadinessCheck[] = [
        { name: 'no-details', check: async () => ({ name: 'no-details', status: 'pass' as CheckStatus }) },
        { name: 'with-details', check: async () => ({ name: 'with-details', status: 'warn' as CheckStatus, details: { message: 'Slow response' } }) },
      ];

      const result = await runReadinessChecks(checksWithDetails);

      expect(result.checks[0].details).toBeUndefined();
      expect(result.checks[1].details?.message).toBe('Slow response');
    });
  });
});

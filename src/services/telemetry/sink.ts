import type { AnalyticsSink, CrashReport } from '@/services/analytics';

import type { TelemetryQueue } from './queue';
import type { TelemetryContext } from './types';

/** iOS gives "18.2", Android the API level (35). Only the major number is sent. */
export function osMajor(version: string | number): number | null {
  const major = typeof version === 'number' ? Math.trunc(version) : Number.parseInt(String(version), 10);
  return Number.isInteger(major) && major >= 0 && major <= 1000 ? major : null;
}

export function toPlatform(os: string): TelemetryContext['platform'] {
  return os === 'ios' || os === 'android' ? os : 'web';
}

/**
 * The analytics sink for Supabase mode: events and crash reports (already scrubbed by
 * src/services/analytics.ts) go into the queue with the app context. `onCrash` lets the
 * service send handled errors soon (OBS-01).
 */
export function createTelemetrySink(
  queue: TelemetryQueue,
  context: TelemetryContext,
  { log = false, onCrash }: { log?: boolean; onCrash?: (report: CrashReport) => void } = {},
): AnalyticsSink {
  return {
    capture(event, props, kpi) {
      if (log) console.log(`[analytics] ${event} (${kpi})`, props);
      queue.push({ type: 'event', name: event, props, ...context });
    },
    captureCrash(report) {
      if (log) console.log('[crash]', report);
      queue.push({
        type: 'crash',
        name: report.name,
        message: report.message,
        stack: report.stack,
        fatal: report.fatal,
        ...context,
      });
      onCrash?.(report);
    },
  };
}

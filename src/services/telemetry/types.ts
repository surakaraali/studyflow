/**
 * What the app sends to the telemetry Edge Function (supabase/functions/_shared/telemetry.ts).
 * No ids, no timestamps, no device model: only the event, the app version, the platform and
 * the OS major version (ADR-006, PRIV-04).
 */

export type TelemetryContext = {
  /** "1.0.0 (42)" */
  app_version: string;
  platform: 'ios' | 'android' | 'web';
  os_major: number | null;
};

export type TelemetryEvent = TelemetryContext & {
  type: 'event';
  name: string;
  props: Record<string, string | number | boolean>;
};

export type TelemetryCrash = TelemetryContext & {
  type: 'crash';
  name: string;
  message: string;
  stack: string;
  fatal: boolean;
};

export type TelemetryItem = TelemetryEvent | TelemetryCrash;

/** 'sent' and 'drop' remove the batch from the queue; 'retry' keeps it and waits. */
export type SendResult = 'sent' | 'drop' | 'retry';

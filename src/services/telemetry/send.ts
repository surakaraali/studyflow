import { config } from '@/services/config';

import { classifyStatus } from './flush';
import type { SendResult, TelemetryItem } from './types';

const TIMEOUT_MS = 15_000;

/** POSTs one batch to the telemetry Edge Function with the user's access token. */
export async function sendTelemetry(items: TelemetryItem[], token: string): Promise<SendResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(`${config.supabaseUrl}/functions/v1/telemetry`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: config.supabaseAnonKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ items }),
      signal: controller.signal,
    });
    return classifyStatus(response.status);
  } catch {
    return 'retry';
  } finally {
    clearTimeout(timer);
  }
}

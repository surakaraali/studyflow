/**
 * First-party telemetry (ADR-006, US-06, OBS-01): in Supabase mode, product events and JS crash
 * reports go to our own backend (the telemetry Edge Function); no third-party SDK is involved.
 *
 * - The sink is set when this module loads (boot.ts imports it right after analytics), so
 *   errors in later start-up code are kept too.
 * - Items wait in a device-wide queue (at most 500) and are sent only while someone is signed
 *   in: at start, on sign-in, every minute while the app is open, when it comes to the
 *   foreground or goes to the background, and a few seconds after a handled error.
 * - Local mode changes nothing: events stay in the dev console (silent in release builds).
 */

import Storage from 'expo-sqlite/kv-store';
import { AppState, Platform } from 'react-native';

import { appVersionLabel } from '@/lib/app-version';
import { setAnalyticsSink } from '@/services/analytics';
import { registerAppService } from '@/services/app-services';
import { backendMode } from '@/services/config';
import { supabase } from '@/services/supabase';
import { onSignedIn } from '@/stores/session';

import { createFlusher } from './flush';
import { createTelemetryQueue } from './queue';
import { sendTelemetry } from './send';
import { createTelemetrySink, osMajor, toPlatform } from './sink';

const PERIOD_MS = 60_000;
const AFTER_ERROR_MS = 5_000;

async function accessToken(): Promise<string | null> {
  const client = supabase();
  if (!client) return null;
  const { data } = await client.auth.getSession();
  return data.session?.access_token ?? null;
}

function start() {
  const queue = createTelemetryQueue(Storage);
  const flusher = createFlusher({ queue, send: sendTelemetry, getToken: accessToken });
  const flush = () => {
    flusher.flush().catch(() => {});
  };

  let soon: ReturnType<typeof setTimeout> | null = null;
  const flushSoon = () => {
    if (soon) return;
    soon = setTimeout(() => {
      soon = null;
      flush();
    }, AFTER_ERROR_MS);
  };

  setAnalyticsSink(
    createTelemetrySink(
      queue,
      { app_version: appVersionLabel(), platform: toPlatform(Platform.OS), os_major: osMajor(Platform.Version) },
      // A fatal crash ends the app; its report goes out on the next launch.
      {
        log: __DEV__,
        onCrash: (report) => {
          if (!report.fatal) flushSoon();
        },
      },
    ),
  );

  registerAppService(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    const startTimer = () => {
      timer ??= setInterval(flush, PERIOD_MS);
    };
    const stopTimer = () => {
      if (timer) clearInterval(timer);
      timer = null;
    };

    onSignedIn(flush);
    AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        startTimer();
        flush();
      } else if (state === 'background') {
        stopTimer();
        flush();
      }
    });
    if (AppState.currentState !== 'background') startTimer();
    flush();
  });
}

if (backendMode === 'supabase') start();

/**
 * POST /functions/v1/consent-maintenance   (pg_cron, daily; BR-04, BR-25, US-17)
 * Authorization: Bearer <CRON_SECRET>   (the same value is in Vault as 'cron_secret')
 *
 * Tasks (public.maintenance_due decides who is due; each run is safe to repeat):
 *   consent_reminder_7 / _25   under-13 accounts still waiting: new link + reminder to the parent
 *   consent_delete             under-13 accounts without consent 30 days after sign-up: delete
 *   inactivity_warning         no activity for 12 months: warn by e-mail
 *   inactivity_delete          warned 30+ days ago and still inactive: delete
 * Also: subscriptions whose expiry passed without a webhook drop back to free, expired data is
 * purged (public.purge_expired_data: soft-deleted rows after 90 days, retained records after
 * their retention date) and unused consent links older than 30 days are removed (decisions
 * live in consent_records).
 *
 * Body (optional): { dryRun: true } lists what would happen without changing anything.
 */

import 'jsr:@supabase/functions-js@2.118.0/edge-runtime.d.ts';

import { deleteAccountCompletely } from '../_shared/account.ts';
import { adminClient, type SupabaseClient } from '../_shared/admin.ts';
import { requireSecret } from '../_shared/auth.ts';
import { addDays, CONSENT_DEADLINE_DAYS, consentPageUrl, issueConsentToken } from '../_shared/consent.ts';
import { sendEmail } from '../_shared/email.ts';
import { accountDeletedEmail, consentReminderEmail, inactivityWarningEmail } from '../_shared/email-templates.ts';
import { errorResponse, json, readJson, requireMethod } from '../_shared/http.ts';

type DueRow = {
  user_id: string;
  task: 'consent_reminder_7' | 'consent_reminder_25' | 'consent_delete' | 'inactivity_warning' | 'inactivity_delete';
  email: string | null;
  parent_email: string | null;
  nickname: string | null;
  account_created_at: string;
};

const INACTIVITY_GRACE_DAYS = 30;

async function mark(admin: SupabaseClient, userId: string, task: string) {
  const { error } = await admin.rpc('maintenance_mark', { p_user: userId, p_task: task });
  if (error) throw error;
}

async function runTask(admin: SupabaseClient, row: DueRow, now: Date): Promise<void> {
  switch (row.task) {
    case 'consent_reminder_7':
    case 'consent_reminder_25': {
      if (row.parent_email) {
        // The first link expired on day 7, so every reminder carries a fresh one.
        const { token, expiresAt } = await issueConsentToken(admin, {
          userId: row.user_id,
          parentEmail: row.parent_email,
          source: 'reminder',
          now,
        });
        await sendEmail(
          consentReminderEmail({
            to: row.parent_email,
            nickname: row.nickname,
            link: consentPageUrl(token),
            expiresAt,
            deleteOn: addDays(new Date(row.account_created_at), CONSENT_DEADLINE_DAYS),
          }),
        );
      }
      await mark(admin, row.user_id, row.task);
      return;
    }
    case 'inactivity_warning': {
      if (row.email) {
        await sendEmail(
          inactivityWarningEmail({ to: row.email, deleteOn: addDays(now, INACTIVITY_GRACE_DAYS) }),
        );
      }
      await mark(admin, row.user_id, row.task);
      return;
    }
    case 'consent_delete':
    case 'inactivity_delete': {
      await deleteAccountCompletely(admin, row.user_id);
      if (row.email) {
        await sendEmail(
          accountDeletedEmail({ to: row.email, reason: row.task === 'consent_delete' ? 'consent' : 'inactivity' }),
        ).catch((error) => console.error('deletion email failed', error instanceof Error ? error.message : ''));
      }
      return;
    }
  }
}

Deno.serve(async (req) => {
  try {
    requireMethod(req, 'POST');
    requireSecret(req, Deno.env.get('CRON_SECRET'));
    const body = await readJson<{ dryRun: unknown }>(req);
    const dryRun = body.dryRun === true;

    const admin = adminClient();
    const now = new Date();
    const { data, error } = await admin.rpc('maintenance_due', { p_limit: 200 });
    if (error) throw error;
    // Deletions first, so a deleted account gets no reminder or warning in the same run.
    const due = ((data ?? []) as DueRow[]).sort(
      (a, b) => Number(b.task.endsWith('_delete')) - Number(a.task.endsWith('_delete')),
    );

    const summary: Record<string, { done: number; failed: number }> = {};
    if (!dryRun) {
      const deleted = new Set<string>();
      for (const row of due) {
        if (deleted.has(row.user_id)) continue;
        const entry = (summary[row.task] ??= { done: 0, failed: 0 });
        try {
          await runTask(admin, row, now);
          entry.done += 1;
          if (row.task.endsWith('_delete')) deleted.add(row.user_id);
        } catch (taskError) {
          // One failure must not stop the others; tomorrow's run picks it up again.
          entry.failed += 1;
          console.error(`maintenance ${row.task} failed`, taskError instanceof Error ? taskError.message : '');
        }
      }

      const { data: lapsed, error: lapsedError } = await admin.rpc('refresh_lapsed_plans');
      if (lapsedError) console.error('refresh_lapsed_plans failed', lapsedError.message);
      summary.lapsed_plans = { done: Number(lapsed ?? 0), failed: lapsedError ? 1 : 0 };

      const { data: purged, error: purgeError } = await admin.rpc('purge_expired_data');
      if (purgeError) console.error('purge_expired_data failed', purgeError.message);
      else summary.purged = { done: Object.values((purged ?? {}) as Record<string, number>).reduce((a, b) => a + b, 0), failed: 0 };

      const { error: cleanupError } = await admin
        .from('consent_tokens')
        .delete()
        .is('used_at', null)
        .lt('expires_at', addDays(now, -30).toISOString());
      if (cleanupError) console.error('token cleanup failed', cleanupError.message);
    }

    const counts = due.reduce<Record<string, number>>((acc, row) => {
      acc[row.task] = (acc[row.task] ?? 0) + 1;
      return acc;
    }, {});
    return json({ ok: true, dryRun, due: counts, summary });
  } catch (error) {
    return errorResponse(error);
  }
});

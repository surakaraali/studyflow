import { useEffect } from 'react';

import { syncOfficialExams } from '@/features/exams/official';
import { useSession } from '@/stores/session';

/**
 * Keeps the official exam rows in line with the profile's target exam and track.
 * Onboarding and the profile screen call syncOfficialExams too; this catches every other
 * path (sync from another device, a track change). The sync writes nothing when up to date.
 */
export function useOfficialExamSync() {
  const ready = useSession((s) => s.profile?.onboarding_done === 1);
  const target = useSession((s) => s.profile?.target_exam ?? null);
  const track = useSession((s) => s.profile?.track ?? null);

  useEffect(() => {
    if (!ready) return;
    syncOfficialExams(target, track).catch((error) => console.warn('Official exam sync failed', error));
  }, [ready, target, track]);
}

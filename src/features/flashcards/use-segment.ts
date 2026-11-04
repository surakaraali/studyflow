import { segmentForGrade, type Segment } from '@/domain/rules';
import { useProfile } from '@/stores/session';

/** The student's school segment; middle school until the profile says otherwise. */
export function useSegment(): Segment {
  const { profile } = useProfile();
  if (profile?.segment) return profile.segment;
  if (profile?.grade) return segmentForGrade(profile.grade);
  return 'ortaokul';
}

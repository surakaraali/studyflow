import { router } from 'expo-router';
import { useEffect, useRef } from 'react';

import { markCoursesOffered, shouldOfferCourses } from './repo';

/**
 * US-74: Today calls this. The first time it sees a student without courses it opens the
 * course picker (/setup) once; the kv flag is set before opening, so closing the picker any
 * way at all counts as "seen" and it never comes back.
 */
export function useFirstRunSetup(hasCourses: boolean | undefined) {
  const checked = useRef(false);

  useEffect(() => {
    if (hasCourses !== false || checked.current) return;
    checked.current = true;
    (async () => {
      if (!(await shouldOfferCourses())) return;
      await markCoursesOffered();
      router.push('/setup');
    })().catch((error) => console.warn('First-run setup could not open', error));
  }, [hasCourses]);
}

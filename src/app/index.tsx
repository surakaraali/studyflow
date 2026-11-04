import { Redirect } from 'expo-router';

import { homeHref, useSession } from '@/stores/session';

/** "/" is not a screen: it sends the student to the group that fits their state. */
export default function Index() {
  const status = useSession((s) => s.status);
  const profile = useSession((s) => s.profile);
  return <Redirect href={homeHref(status, profile)} />;
}

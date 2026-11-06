import { useEffect, useState } from 'react';

import { auth, type SignInMethods } from '@/services/auth';
import { useSession } from '@/stores/session';

/**
 * How the signed-in account can sign in (US-72: Apple-only accounts have no password or
 * editable e-mail). Null while loading. If the check fails we assume a password account;
 * the change screens then report any error themselves.
 */
export function useSignInMethods(): SignInMethods | null {
  const userId = useSession((s) => s.user?.id ?? null);
  const [methods, setMethods] = useState<{ userId: string | null; value: SignInMethods } | null>(null);

  useEffect(() => {
    let alive = true;
    auth
      .signInMethods()
      .catch((): SignInMethods => ({ password: true, apple: false }))
      .then((value) => {
        if (alive) setMethods({ userId, value });
      });
    return () => {
      alive = false;
    };
  }, [userId]);

  return methods && methods.userId === userId ? methods.value : null;
}

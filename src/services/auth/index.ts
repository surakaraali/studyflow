import { backendMode } from '@/services/config';
import { localAuth } from './local';
import { supabaseAuth } from './supabase';
import type { AuthAdapter } from './types';

export * from './types';
export { markEmailVerifiedLocally } from './local';

export const auth: AuthAdapter = backendMode === 'supabase' ? supabaseAuth : localAuth;

/**
 * Imports every module that registers an app service (registerAppService) so their
 * start-up work runs. Order: analytics first so it sees errors from the rest.
 */
import '@/services/analytics';
import '@/services/notifications';
import '@/services/sync';
import '@/services/ai/runner';
import '@/services/purchases';
import '@/features/plan/regenerate';
import '@/features/plan/runner';

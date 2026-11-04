/**
 * Starts long-lived services once, before the first render.
 * Each feature registers its own start-up work here (sync, notifications, AI jobs, analytics).
 */

type Service = () => void;

const services: Service[] = [];
let started = false;

export function registerAppService(service: Service) {
  services.push(service);
  if (started) service();
}

export function startAppServices() {
  if (started) return;
  started = true;
  for (const service of services) service();
}

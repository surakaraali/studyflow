#!/usr/bin/env bash
# Sets up a hosted Supabase project (EU) for StudyFlow: analysis/go_live.md, step 2.
#
#   npm run go-live:supabase -- --env-file ../studyflow-secrets/supabase.prod.env            # dry run
#   npm run go-live:supabase -- --env-file ../studyflow-secrets/supabase.prod.env --apply    # do it
#
# Dry run by default: checks the env file and prints every command without running it.
# --apply     runs the commands (link, db push, config push, secrets, functions, checks)
# --vault     with --apply, also writes the Vault secrets (otherwise the SQL is only printed)
# --use-api   deploy functions without Docker (bundled by Supabase)
# --skip-config / --skip-functions / --skip-db   leave that part out
#
# Safe to run again: every step creates or updates, nothing is deleted. Secret values are never
# printed; the Vault SQL is shown with the secret masked.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

ENV_FILE=""
APPLY=0
VAULT=0
USE_API=0
SKIP_CONFIG=0
SKIP_FUNCTIONS=0
SKIP_DB=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --env-file) ENV_FILE="${2:-}"; shift 2 ;;
    --apply) APPLY=1; shift ;;
    --vault) VAULT=1; shift ;;
    --use-api) USE_API=1; shift ;;
    --skip-config) SKIP_CONFIG=1; shift ;;
    --skip-functions) SKIP_FUNCTIONS=1; shift ;;
    --skip-db) SKIP_DB=1; shift ;;
    -h|--help) sed -n '2,16p' "$0"; exit 0 ;;
    *) echo "Unknown option: $1" >&2; exit 2 ;;
  esac
done

if [[ -z "$ENV_FILE" || ! -f "$ENV_FILE" ]]; then
  echo "Pass --env-file <file> (see analysis/go_live.md). Keep the file outside the repository." >&2
  exit 2
fi
ENV_FILE="$(cd "$(dirname "$ENV_FILE")" && pwd)/$(basename "$ENV_FILE")"
case "$ENV_FILE" in
  "$ROOT"/*)
    if ! git -C "$ROOT" check-ignore -q "$ENV_FILE" 2>/dev/null; then
      echo "Refusing: $ENV_FILE is inside the repository and not gitignored." >&2
      exit 2
    fi ;;
esac

TSX=(npx --no-install tsx)
TMP="$(mktemp -d)"
chmod 700 "$TMP"
trap 'rm -rf "$TMP"' EXIT

step() { printf '\n== %s\n' "$1"; }
run() {
  # Prints the command; runs it only with --apply.
  printf '  $ %s\n' "$*"
  if [[ $APPLY -eq 1 ]]; then "$@"; fi
}

if [[ $APPLY -eq 1 ]]; then echo "Mode: APPLY (changes the linked project)"; else echo "Mode: dry run (nothing is changed; add --apply)"; fi

step "1. Check the env file"
if ! "${TSX[@]}" scripts/go-live/check-env.ts --target supabase --env-file "$ENV_FILE"; then
  if [[ $APPLY -eq 1 ]]; then
    echo "Fix the env file first." >&2
    exit 1
  fi
  echo "  (dry run continues; --apply would stop here)"
fi

# CLI settings only; function secrets stay in files.
eval "$("${TSX[@]}" scripts/go-live/env-tool.ts exports "$ENV_FILE" \
  SUPABASE_PROJECT_REF,SUPABASE_ACCESS_TOKEN,SUPABASE_DB_PASSWORD,SUPABASE_AUTH_EXTERNAL_APPLE_CLIENT_ID,SUPABASE_AUTH_EXTERNAL_APPLE_SECRET)"
REF="${SUPABASE_PROJECT_REF:-<project-ref>}"
# config.toml reads these with env(); an empty value is fine for the native Apple flow.
export SUPABASE_AUTH_EXTERNAL_APPLE_SECRET="${SUPABASE_AUTH_EXTERNAL_APPLE_SECRET:-}"
[[ -n "${SUPABASE_ACCESS_TOKEN:-}" ]] || echo "  note: SUPABASE_ACCESS_TOKEN not set; the CLI uses your \`supabase login\` session."
[[ -n "${SUPABASE_DB_PASSWORD:-}" ]] || echo "  note: SUPABASE_DB_PASSWORD not set; the CLI will ask for the database password."

step "2. Link the project"
run supabase link --project-ref "$REF"

if [[ $SKIP_DB -eq 0 ]]; then
  step "3. Database: migrations and reference data (seed.sql is idempotent)"
  run supabase migration list --remote
  run supabase db push --remote --include-seed --dry-run
  run supabase db push --remote --include-seed
fi

if [[ $SKIP_CONFIG -eq 0 ]]; then
  step "4. Auth and API settings from supabase/config.toml (asks once before writing)"
  run supabase config diff
  run supabase config push
fi

step "5. Function secrets"
"${TSX[@]}" scripts/go-live/env-tool.ts secrets "$ENV_FILE" "$TMP/secrets.env"
run supabase secrets set --env-file "$TMP/secrets.env"
run supabase secrets list

if [[ $SKIP_FUNCTIONS -eq 0 ]]; then
  step "6. Deploy every Edge Function (verify_jwt comes from config.toml)"
  FUNCTIONS=()
  for dir in supabase/functions/*/; do
    name="$(basename "$dir")"
    [[ "$name" == _* || ! -f "$dir/index.ts" ]] && continue
    FUNCTIONS+=("$name")
  done
  echo "  functions: ${FUNCTIONS[*]}"
  if [[ $USE_API -eq 1 ]]; then run supabase functions deploy --use-api; else run supabase functions deploy; fi
  run supabase functions list
fi

step "7. Vault secrets for pg_cron (project_url, cron_secret)"
echo "  SQL (secret masked):"
"${TSX[@]}" scripts/go-live/env-tool.ts vault "$ENV_FILE" "$TMP/vault.sql" | sed 's/^/    /'
if [[ $APPLY -eq 1 && $VAULT -eq 1 ]]; then
  run supabase db query --remote --file "$TMP/vault.sql"
else
  echo "  Run it in the SQL editor with the real CRON_SECRET, or re-run with --apply --vault."
fi

step "8. Checks"
CRONS="$("${TSX[@]}" scripts/go-live/env-tool.ts crons | paste -sd ',' -)"
echo "  expected cron jobs: $CRONS"
run supabase db query --remote --read-only \
  "select jobname, schedule, active from cron.job order by jobname"
run supabase db query --remote --read-only \
  "select name from vault.secrets where name in ('project_url', 'cron_secret') order by name"
run supabase db query --remote --read-only \
  "select j.jobname, d.status, d.start_time from cron.job_run_details d join cron.job j using (jobid) order by d.start_time desc limit 10"
URL="https://$REF.supabase.co/functions/v1/consent?token=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
printf '  $ curl -s -o /dev/null -w "%%{http_code}" %s   # expect 404 (deployed, unknown token)\n' "$URL"
if [[ $APPLY -eq 1 && "$REF" != "<project-ref>" ]]; then
  code="$(curl -s -o /dev/null -w '%{http_code}' "$URL" || true)"
  echo "  consent function answered HTTP $code"
  [[ "$code" == "404" ]] || echo "  WARNING: expected 404; check \`supabase functions list\` and the function logs."
fi

echo
if [[ $APPLY -eq 1 ]]; then
  echo "Done. Next: analysis/go_live.md (Auth SMTP, Apple provider and backups in the dashboard)."
else
  echo "Dry run finished. Nothing was changed."
fi

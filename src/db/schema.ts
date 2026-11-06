/**
 * On-device database (one SQLite file per signed-in user).
 *
 * Mirrors the Postgres schema in supabase/migrations. Conventions:
 * - ids are client-generated UUIDs, so offline writes sync without duplicates (US-05);
 * - timestamps are ISO strings, dates are "YYYY-MM-DD", times are "HH:MM";
 * - synced tables carry `updated_at` and soft-delete with `deleted_at`;
 * - `consent_records` and `card_reviews` are append-only (US-04).
 *
 * Add a new entry to MIGRATIONS for every change. Never edit a shipped entry.
 */

export const MIGRATIONS: string[] = [
  /* 1: R1 data model */ `
  CREATE TABLE IF NOT EXISTS profile (
    id TEXT PRIMARY KEY NOT NULL,
    email TEXT,
    nickname TEXT,
    birth_year INTEGER,
    grade INTEGER,
    segment TEXT,
    track TEXT,
    target_exam TEXT,
    daily_goal_min INTEGER,
    block_min INTEGER,
    break_min INTEGER,
    daily_cap_override INTEGER,
    bedtime TEXT,
    wake_time TEXT,
    consent_status TEXT NOT NULL DEFAULT 'not_required',
    parent_email TEXT,
    ai_notice_accepted_at TEXT,
    onboarding_done INTEGER NOT NULL DEFAULT 0,
    plan TEXT NOT NULL DEFAULT 'free',
    notif_plan INTEGER NOT NULL DEFAULT 1,
    notif_exam INTEGER NOT NULL DEFAULT 1,
    notif_homework INTEGER NOT NULL DEFAULT 1,
    notif_ai INTEGER NOT NULL DEFAULT 1,
    notif_permission_asked INTEGER NOT NULL DEFAULT 0,
    waitlist_parent_email TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS consent_requests (
    id TEXT PRIMARY KEY NOT NULL,
    parent_email TEXT NOT NULL,
    token TEXT NOT NULL,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS consent_records (
    id TEXT PRIMARY KEY NOT NULL,
    parent_email TEXT NOT NULL,
    action TEXT NOT NULL,
    purposes TEXT NOT NULL DEFAULT '[]',
    text_version TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS courses (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    color TEXT NOT NULL,
    catalog_key TEXT,
    archived_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT
  );

  CREATE TABLE IF NOT EXISTS timetable_slots (
    id TEXT PRIMARY KEY NOT NULL,
    course_id TEXT,
    weekday INTEGER NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT
  );

  CREATE TABLE IF NOT EXISTS availability (
    id TEXT PRIMARY KEY NOT NULL,
    day_type TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT
  );

  CREATE TABLE IF NOT EXISTS topics (
    id TEXT PRIMARY KEY NOT NULL,
    course_id TEXT NOT NULL,
    name TEXT NOT NULL,
    difficulty INTEGER NOT NULL DEFAULT 2,
    sort INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT
  );

  CREATE TABLE IF NOT EXISTS exams (
    id TEXT PRIMARY KEY NOT NULL,
    course_id TEXT,
    kind TEXT NOT NULL,
    title TEXT NOT NULL,
    date TEXT NOT NULL,
    time TEXT,
    topic_ids TEXT NOT NULL DEFAULT '[]',
    official_key TEXT,
    score REAL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT
  );

  CREATE TABLE IF NOT EXISTS homework (
    id TEXT PRIMARY KEY NOT NULL,
    course_id TEXT NOT NULL,
    description TEXT NOT NULL,
    due_date TEXT NOT NULL,
    done_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT
  );

  CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY NOT NULL,
    course_id TEXT NOT NULL,
    topic_id TEXT,
    title TEXT NOT NULL,
    file_uri TEXT,
    storage_path TEXT,
    size_bytes INTEGER NOT NULL DEFAULT 0,
    page_count INTEGER NOT NULL DEFAULT 0,
    page_from INTEGER NOT NULL DEFAULT 1,
    page_to INTEGER NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'queued',
    error_code TEXT,
    attempts INTEGER NOT NULL DEFAULT 0,
    next_attempt_at TEXT,
    quota_month TEXT NOT NULL,
    counted INTEGER NOT NULL DEFAULT 1,
    under_review INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT
  );

  CREATE TABLE IF NOT EXISTS summaries (
    id TEXT PRIMARY KEY NOT NULL,
    document_id TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT
  );

  CREATE TABLE IF NOT EXISTS quizzes (
    id TEXT PRIMARY KEY NOT NULL,
    document_id TEXT,
    course_id TEXT NOT NULL,
    title TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT
  );

  CREATE TABLE IF NOT EXISTS questions (
    id TEXT PRIMARY KEY NOT NULL,
    quiz_id TEXT NOT NULL,
    stem TEXT NOT NULL,
    options TEXT NOT NULL,
    correct_index INTEGER NOT NULL,
    explanation TEXT NOT NULL DEFAULT '',
    source_page INTEGER,
    topic TEXT,
    sort INTEGER NOT NULL DEFAULT 0,
    edited INTEGER NOT NULL DEFAULT 0,
    hidden INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT
  );

  CREATE TABLE IF NOT EXISTS quiz_attempts (
    id TEXT PRIMARY KEY NOT NULL,
    quiz_id TEXT NOT NULL,
    question_ids TEXT NOT NULL,
    answers TEXT NOT NULL DEFAULT '{}',
    current_index INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'in_progress',
    correct INTEGER NOT NULL DEFAULT 0,
    wrong INTEGER NOT NULL DEFAULT 0,
    blank INTEGER NOT NULL DEFAULT 0,
    duration_sec INTEGER NOT NULL DEFAULT 0,
    retry_of TEXT,
    started_at TEXT NOT NULL,
    finished_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT
  );

  CREATE TABLE IF NOT EXISTS decks (
    id TEXT PRIMARY KEY NOT NULL,
    course_id TEXT NOT NULL,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT
  );

  CREATE TABLE IF NOT EXISTS cards (
    id TEXT PRIMARY KEY NOT NULL,
    deck_id TEXT NOT NULL,
    document_id TEXT,
    front TEXT NOT NULL,
    back TEXT NOT NULL,
    source_page INTEGER,
    ai_generated INTEGER NOT NULL DEFAULT 0,
    edited INTEGER NOT NULL DEFAULT 0,
    hidden INTEGER NOT NULL DEFAULT 0,
    due TEXT NOT NULL,
    stability REAL NOT NULL DEFAULT 0,
    difficulty REAL NOT NULL DEFAULT 0,
    elapsed_days INTEGER NOT NULL DEFAULT 0,
    scheduled_days INTEGER NOT NULL DEFAULT 0,
    learning_steps INTEGER NOT NULL DEFAULT 0,
    reps INTEGER NOT NULL DEFAULT 0,
    lapses INTEGER NOT NULL DEFAULT 0,
    state INTEGER NOT NULL DEFAULT 0,
    last_review TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT
  );

  CREATE TABLE IF NOT EXISTS card_reviews (
    id TEXT PRIMARY KEY NOT NULL,
    card_id TEXT NOT NULL,
    rating INTEGER NOT NULL,
    was_new INTEGER NOT NULL DEFAULT 0,
    state INTEGER NOT NULL,
    due TEXT NOT NULL,
    stability REAL NOT NULL,
    difficulty REAL NOT NULL,
    scheduled_days INTEGER NOT NULL,
    reviewed_at TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS content_reports (
    id TEXT PRIMARY KEY NOT NULL,
    item_type TEXT NOT NULL,
    item_id TEXT NOT NULL,
    document_id TEXT,
    reason TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT
  );

  CREATE TABLE IF NOT EXISTS plan_items (
    id TEXT PRIMARY KEY NOT NULL,
    date TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    minutes INTEGER NOT NULL,
    break_min INTEGER NOT NULL DEFAULT 0,
    kind TEXT NOT NULL,
    course_id TEXT,
    topic_id TEXT,
    exam_id TEXT,
    homework_id TEXT,
    status TEXT NOT NULL DEFAULT 'planned',
    source TEXT NOT NULL DEFAULT 'auto',
    carried_from TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT
  );

  CREATE TABLE IF NOT EXISTS study_sessions (
    id TEXT PRIMARY KEY NOT NULL,
    course_id TEXT,
    topic_id TEXT,
    plan_item_id TEXT,
    date TEXT NOT NULL,
    minutes INTEGER NOT NULL,
    source TEXT NOT NULL,
    started_at TEXT,
    ended_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT
  );

  CREATE TABLE IF NOT EXISTS streak_freezes (
    id TEXT PRIMARY KEY NOT NULL,
    week TEXT NOT NULL,
    date TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT
  );

  CREATE TABLE IF NOT EXISTS ai_usage (
    id TEXT PRIMARY KEY NOT NULL,
    document_id TEXT,
    task TEXT NOT NULL,
    model TEXT NOT NULL,
    input_tokens INTEGER NOT NULL DEFAULT 0,
    output_tokens INTEGER NOT NULL DEFAULT 0,
    cache_read_tokens INTEGER NOT NULL DEFAULT 0,
    cache_write_tokens INTEGER NOT NULL DEFAULT 0,
    duration_ms INTEGER NOT NULL DEFAULT 0,
    cost_usd REAL NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS feedback (
    id TEXT PRIMARY KEY NOT NULL,
    kind TEXT NOT NULL,
    payload TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT
  );

  CREATE TABLE IF NOT EXISTS outbox (
    seq INTEGER PRIMARY KEY AUTOINCREMENT,
    table_name TEXT NOT NULL,
    row_id TEXT NOT NULL,
    op TEXT NOT NULL,
    payload TEXT NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS kv (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_plan_items_date ON plan_items(date);
  CREATE INDEX IF NOT EXISTS idx_cards_deck_due ON cards(deck_id, due);
  CREATE INDEX IF NOT EXISTS idx_questions_quiz ON questions(quiz_id, sort);
  CREATE INDEX IF NOT EXISTS idx_reviews_time ON card_reviews(reviewed_at);
  CREATE INDEX IF NOT EXISTS idx_sessions_date ON study_sessions(date);
  CREATE INDEX IF NOT EXISTS idx_exams_date ON exams(date);
  CREATE INDEX IF NOT EXISTS idx_homework_due ON homework(due_date);
  `,
  /* 2: first-run journey (US-75) */ `
  ALTER TABLE profile ADD COLUMN birth_year_corrected_at TEXT;
  `,
];

/** Tables that are synced to Supabase. Order matters: parents before children. */
export const SYNCED_TABLES = [
  'profile',
  'consent_records',
  'courses',
  'timetable_slots',
  'availability',
  'topics',
  'exams',
  'homework',
  'documents',
  'summaries',
  'quizzes',
  'questions',
  'quiz_attempts',
  'decks',
  'cards',
  'card_reviews',
  'content_reports',
  'plan_items',
  'study_sessions',
  'streak_freezes',
  'feedback',
] as const;

export type SyncedTable = (typeof SYNCED_TABLES)[number];

/** Insert-only tables: no updates, no deletes (US-04). */
export const APPEND_ONLY_TABLES: readonly SyncedTable[] = ['consent_records', 'card_reviews'];

export type TableName =
  | SyncedTable
  | 'consent_requests'
  | 'ai_usage'
  | 'outbox'
  | 'kv';

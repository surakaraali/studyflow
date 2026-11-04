/** Row types for the on-device database (see schema.ts). SQLite booleans are 0 | 1. */

import type { ConsentStatus, Plan, Segment, TargetExam, Track } from '@/domain/rules';

type Bool = 0 | 1;

type Synced = {
  id: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type Profile = {
  id: string;
  email: string | null;
  nickname: string | null;
  birth_year: number | null;
  grade: number | null;
  segment: Segment | null;
  track: Track | null;
  target_exam: TargetExam | null;
  daily_goal_min: number | null;
  block_min: number | null;
  break_min: number | null;
  daily_cap_override: number | null;
  bedtime: string | null;
  wake_time: string | null;
  consent_status: ConsentStatus;
  parent_email: string | null;
  ai_notice_accepted_at: string | null;
  onboarding_done: Bool;
  plan: Plan;
  notif_plan: Bool;
  notif_exam: Bool;
  notif_homework: Bool;
  notif_ai: Bool;
  notif_permission_asked: Bool;
  waitlist_parent_email: string | null;
  created_at: string;
  updated_at: string;
};

export type ConsentRequest = {
  id: string;
  parent_email: string;
  token: string;
  created_at: string;
  expires_at: string;
};

export type ConsentAction = 'requested' | 'granted' | 'revoked';
export type ConsentPurpose = 'ai' | 'notifications';

export type ConsentRecord = {
  id: string;
  parent_email: string;
  action: ConsentAction;
  /** JSON array of ConsentPurpose */
  purposes: string;
  text_version: string;
  created_at: string;
};

export type Course = Synced & {
  name: string;
  color: string;
  catalog_key: string | null;
  archived_at: string | null;
};

export type TimetableSlot = Synced & {
  course_id: string | null;
  /** 1 = Monday … 7 = Sunday */
  weekday: number;
  start_time: string;
  end_time: string;
};

export type DayType = 'weekday' | 'weekend';

export type AvailabilityRange = Synced & {
  day_type: DayType;
  start_time: string;
  end_time: string;
};

export type Topic = Synced & {
  course_id: string;
  name: string;
  /** 1 easy, 2 medium, 3 hard */
  difficulty: number;
  sort: number;
};

export type ExamKind = 'yazili' | 'quiz' | 'sozlu' | 'proje' | 'official';

export type Exam = Synced & {
  course_id: string | null;
  kind: ExamKind;
  title: string;
  date: string;
  time: string | null;
  /** JSON array of topic ids */
  topic_ids: string;
  official_key: string | null;
  score: number | null;
};

export type Homework = Synced & {
  course_id: string;
  description: string;
  due_date: string;
  done_at: string | null;
};

export type DocumentStatus = 'queued' | 'processing' | 'ready' | 'error';

export type DocumentRow = Synced & {
  course_id: string;
  topic_id: string | null;
  title: string;
  /** Local copy of the (possibly page-trimmed) PDF */
  file_uri: string | null;
  storage_path: string | null;
  size_bytes: number;
  page_count: number;
  page_from: number;
  page_to: number;
  status: DocumentStatus;
  error_code: string | null;
  attempts: number;
  next_attempt_at: string | null;
  quota_month: string;
  /** 1 while it counts toward the monthly quota; failed jobs are refunded (BR-14). */
  counted: Bool;
  under_review: Bool;
};

export type SummarySection = {
  heading: string;
  paragraphs: string[];
  key_terms: string[];
  pages: number[];
};

export type Summary = Synced & {
  document_id: string;
  /** JSON: { sections: SummarySection[] } */
  content: string;
};

export type Quiz = Synced & {
  document_id: string | null;
  course_id: string;
  title: string;
};

export type Question = Synced & {
  quiz_id: string;
  stem: string;
  /** JSON array of strings */
  options: string;
  correct_index: number;
  explanation: string;
  source_page: number | null;
  topic: string | null;
  sort: number;
  edited: Bool;
  hidden: Bool;
};

export type QuizAttempt = Synced & {
  quiz_id: string;
  /** JSON array of question ids, in the order they are asked */
  question_ids: string;
  /** JSON object: question id → chosen option index, or null for blank */
  answers: string;
  current_index: number;
  status: 'in_progress' | 'done';
  correct: number;
  wrong: number;
  blank: number;
  duration_sec: number;
  retry_of: string | null;
  started_at: string;
  finished_at: string | null;
};

export type Deck = Synced & {
  course_id: string;
  name: string;
};

export type CardRow = Synced & {
  deck_id: string;
  document_id: string | null;
  front: string;
  back: string;
  source_page: number | null;
  ai_generated: Bool;
  edited: Bool;
  hidden: Bool;
  due: string;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  learning_steps: number;
  reps: number;
  lapses: number;
  /** ts-fsrs State: 0 New, 1 Learning, 2 Review, 3 Relearning */
  state: number;
  last_review: string | null;
};

export type CardReview = {
  id: string;
  card_id: string;
  rating: number;
  was_new: Bool;
  state: number;
  due: string;
  stability: number;
  difficulty: number;
  scheduled_days: number;
  reviewed_at: string;
  created_at: string;
};

export type ReportReason = 'wrong_answer' | 'unclear' | 'inappropriate';
export type ReportStatus = 'open' | 'removed' | 'fixed' | 'valid';

export type ContentReport = Synced & {
  item_type: 'question' | 'card' | 'summary';
  item_id: string;
  document_id: string | null;
  reason: ReportReason;
  status: ReportStatus;
};

export type PlanItemKind = 'study' | 'review' | 'homework';
export type PlanItemStatus = 'planned' | 'done' | 'skipped';

export type PlanItem = Synced & {
  date: string;
  start_time: string;
  end_time: string;
  minutes: number;
  break_min: number;
  kind: PlanItemKind;
  course_id: string | null;
  topic_id: string | null;
  exam_id: string | null;
  homework_id: string | null;
  status: PlanItemStatus;
  source: 'auto' | 'manual';
  carried_from: string | null;
};

export type StudySession = Synced & {
  course_id: string | null;
  topic_id: string | null;
  plan_item_id: string | null;
  date: string;
  minutes: number;
  source: 'timer' | 'manual';
  started_at: string | null;
  ended_at: string | null;
};

export type StreakFreeze = Synced & {
  /** ISO week, "2026-W45" */
  week: string;
  date: string;
};

export type AiUsage = {
  id: string;
  document_id: string | null;
  task: 'summary' | 'quiz' | 'cards';
  model: string;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_write_tokens: number;
  duration_ms: number;
  cost_usd: number;
  created_at: string;
};

export type Feedback = Synced & {
  kind: 'feedback' | 'sus' | 'support';
  /** JSON payload; never contains document content */
  payload: string;
};

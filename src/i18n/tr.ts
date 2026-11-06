import account from './tr/account';
import common from './tr/common';
import courses from './tr/courses';
import plan from './tr/plan';
import progress from './tr/progress';
import quiz from './tr/quiz';
import settings from './tr/settings';
import setup from './tr/setup';
import study from './tr/study';

/**
 * Turkish is the source language. Each feature owns one file in ./tr and its own top-level
 * keys, so features can grow their strings without touching each other.
 */
const tr = {
  ...common,
  ...account,
  ...courses,
  ...study,
  ...quiz,
  ...plan,
  ...progress,
  ...settings,
  ...setup,
};

export type Translation = typeof tr;

export default tr;

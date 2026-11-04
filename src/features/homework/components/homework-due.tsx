import { useTranslation } from 'react-i18next';

import { Section } from '@/components/ui/section';
import { useDbQuery } from '@/db/use-query';
import { HomeworkRow } from '@/features/homework/components/homework-row';
import { listHomeworkDue } from '@/features/homework/repo';
import { todayString } from '@/lib/dates';

/**
 * CONTRACT (owned by the homework feature): homework due today and tomorrow (US-28).
 * Each row has a check box that marks it done. Renders nothing when there is none.
 * Brings its own heading.
 */
export function HomeworkDue() {
  const { t } = useTranslation();
  const today = todayString();
  const { data: items } = useDbQuery(`homework:due:${today}`, () => listHomeworkDue(today), [
    'homework',
    'courses',
  ]);

  if (!items || items.length === 0) return null;

  return (
    <Section title={t('homework.dueTitle')}>
      {items.map((item) => (
        <HomeworkRow key={item.id} homework={item} today={today} />
      ))}
    </Section>
  );
}

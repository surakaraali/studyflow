import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useTranslation } from 'react-i18next';

import { ListRow } from '@/components/ui/list-row';
import { countdown, countdownText } from '@/features/exams/countdown';
import { isEstimatedOfficialDate } from '@/features/exams/official-exams';
import type { ExamWithCourse } from '@/features/exams/repo';
import { useTheme } from '@/hooks/use-theme';
import { formatShortDate, localeTag } from '@/lib/dates';

type ExamRowProps = {
  exam: ExamWithCourse;
  today: string;
  /** Hide the course name (inside a course's own screen). */
  showCourse?: boolean;
};

/**
 * One exam with its countdown. Exams within 7 days get the exam color on the countdown
 * plus a warning icon, so the state never depends on color alone (US-28).
 */
export function ExamRow({ exam, today, showCourse = true }: ExamRowProps) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const tag = localeTag(i18n.language);
  const value = countdown(exam.date, today);
  const date = formatShortDate(exam.date, tag);
  const when = exam.time ? t('exams.dateTime', { date, time: exam.time }) : date;
  const official = exam.kind === 'official';

  const subtitle = [
    [showCourse && !official ? exam.course_name : null, when].filter(Boolean).join(' · '),
    official && isEstimatedOfficialDate(exam.official_key) ? t('exams.estimated') : null,
  ]
    .filter(Boolean)
    .join('\n');

  return (
    <ListRow
      title={exam.title}
      subtitle={subtitle}
      detail={countdownText(value, t)}
      detailColor={value.soon ? 'exam' : 'inkSoft'}
      color={exam.course_color ?? undefined}
      icon={official ? { ios: 'flag', android: 'flag', web: 'flag' } : undefined}
      trailing={
        value.soon ? (
          <SymbolView
            name={{ ios: 'exclamationmark.circle.fill', android: 'error', web: 'error' }}
            size={18}
            tintColor={colors.exam}
            accessibilityLabel={t('exams.soon')}
          />
        ) : null
      }
      accessibilityHint={value.soon ? t('exams.soon') : undefined}
      onPress={() => router.push({ pathname: '/exam/[id]', params: { id: exam.id } })}
    />
  );
}

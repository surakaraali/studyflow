import { router, type Href } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { HighlightMark } from '@/components/highlight-mark';
import { Card } from '@/components/ui/card';
import { IconButton } from '@/components/ui/icon-button';
import { AppText } from '@/components/ui/text';
import { Space } from '@/constants/theme';
import { useDbQuery } from '@/db/use-query';
import { useNotificationsAllowed } from '@/features/permissions/notifications-allowed';
import { useTheme } from '@/hooks/use-theme';

import {
  checklistProgress,
  checklistSteps,
  nextChecklistStep,
  showChecklist,
  type ChecklistStep,
  type ChecklistStepKey,
} from '../checklist';
import { CHECKLIST_TABLES, dismissChecklist, loadChecklistData } from '../repo';
import { useNotificationPermission } from '../use-notification-permission';

const LETTERS = ['A', 'B', 'C', 'D', 'E'] as const;

const STEP_HREF: Record<ChecklistStepKey, Href> = {
  courses: '/course/new',
  timetable: '/timetable',
  availability: '/availability',
  exam: '/exam/new',
  notifications: '/settings/notifications',
};

/**
 * US-74: "Dersler · Ders programı · Müsait saatler · İlk sınav · Bildirimler" on Today.
 * Each step is a row on a little answer sheet: its bubble fills when the step is done, and
 * the row opens the screen that does it. Hides itself when everything is done or closed.
 */
export function SetupChecklist() {
  const { t } = useTranslation();
  const { data } = useDbQuery('setup:checklist', () => loadChecklistData(), CHECKLIST_TABLES);
  const granted = useNotificationPermission();
  // US-76: without the parent's OK for notifications the step is left out.
  const notifications = useNotificationsAllowed();

  if (!data || granted == null || !notifications.loaded) return null;
  const steps = checklistSteps({
    hasCourses: data.hasCourses,
    hasTimetable: data.hasTimetable,
    availabilitySaved: data.availabilitySaved,
    hasSchoolExam: data.hasSchoolExam,
    notificationsGranted: granted,
    notificationsAllowed: notifications.allowed,
  });
  if (!showChecklist(steps, data.dismissed)) return null;

  const progress = checklistProgress(steps);
  const next = nextChecklistStep(steps);

  return (
    <Card>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <AppText variant="title" accessibilityRole="header">
            {t('checklist.title')}
          </AppText>
          <AppText variant="footnote" color="inkSoft">
            {t('checklist.progress', { done: progress.done, total: progress.total })}
          </AppText>
        </View>
        <IconButton
          icon={{ ios: 'xmark', android: 'close', web: 'close' }}
          label={t('checklist.close')}
          tone="inkSoft"
          size={18}
          onPress={() => void dismissChecklist()}
        />
      </View>
      <View>
        {steps.map((step, index) => (
          <StepRow
            key={step.key}
            step={step}
            letter={LETTERS[index]}
            isNext={step.key === next}
            onPress={() => router.push(STEP_HREF[step.key])}
          />
        ))}
      </View>
    </Card>
  );
}

function StepRow({
  step,
  letter,
  isNext,
  onPress,
}: {
  step: ChecklistStep;
  letter: string;
  isNext: boolean;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const title = t(`checklist.steps.${step.key}.title`);
  const hint = step.done ? t('checklist.done') : t(`checklist.steps.${step.key}.hint`);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('checklist.rowA11y', {
        letter,
        title,
        state: step.done ? t('checklist.done') : t('checklist.todo'),
      })}
      accessibilityHint={step.done ? undefined : t(`checklist.steps.${step.key}.hint`)}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.sunken }]}>
      <View
        style={[
          styles.bubble,
          {
            borderColor: step.done ? colors.pen : colors.bubble,
            backgroundColor: step.done ? colors.pen : 'transparent',
          },
        ]}>
        <AppText
          variant="bubble"
          color={step.done ? 'onPen' : 'exam'}
          maxFontSizeMultiplier={1}
          style={styles.letter}>
          {letter}
        </AppText>
      </View>
      <View style={styles.text}>
        <HighlightMark active={isNext} style={styles.mark}>
          <AppText variant="body" color={isNext ? 'onHighlight' : step.done ? 'inkSoft' : 'ink'}>
            {title}
          </AppText>
        </HighlightMark>
        <View style={styles.hint}>
          {step.done ? (
            <SymbolView
              name={{ ios: 'checkmark', android: 'check', web: 'check' }}
              size={12}
              weight="semibold"
              tintColor={colors.success}
            />
          ) : null}
          <AppText variant="footnote" color={step.done ? 'success' : 'inkSoft'}>
            {hint}
          </AppText>
        </View>
      </View>
      <SymbolView
        name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
        size={13}
        weight="semibold"
        tintColor={colors.inkFaint}
      />
    </Pressable>
  );
}

const BUBBLE = 30;

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Space.sm,
    marginBottom: -Space.sm,
  },
  headerText: {
    flex: 1,
    gap: Space.xs,
  },
  row: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.md,
    paddingVertical: Space.sm,
    marginHorizontal: -Space.sm,
    paddingHorizontal: Space.sm,
    borderRadius: 8,
  },
  bubble: {
    width: BUBBLE,
    height: BUBBLE,
    borderRadius: BUBBLE / 2,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  letter: {
    fontSize: 12,
    lineHeight: 15,
  },
  text: {
    flex: 1,
    gap: 2,
    alignItems: 'flex-start',
  },
  mark: {
    // The highlighter sits behind the text without shifting it.
    marginLeft: -7,
  },
  hint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.xs,
  },
});

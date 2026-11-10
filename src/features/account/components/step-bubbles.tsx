import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/text';
import { Space } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type StepBubblesProps = {
  /** 1-based */
  current: number;
  total: number;
};

/**
 * Onboarding progress as a row of answer-sheet bubbles: finished steps are filled in,
 * the current one carries the highlighter.
 */
export function StepBubbles({ current, total }: StepBubblesProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={t('onboarding.progress', { current, total })}
      accessibilityValue={{ min: 1, max: total, now: current }}
      style={styles.row}>
      {Array.from({ length: total }, (_, index) => {
        const step = index + 1;
        const done = step < current;
        const active = step === current;
        return (
          <View
            key={step}
            style={[
              styles.bubble,
              {
                borderColor: done ? colors.pen : colors.bubble,
                backgroundColor: done ? colors.pen : active ? colors.highlight : 'transparent',
              },
            ]}>
            <AppText
              variant="bubble"
              maxFontSizeMultiplier={1}
              color={done ? 'onPen' : active ? 'onHighlight' : 'exam'}>
              {step}
            </AppText>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: Space.sm,
  },
  bubble: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

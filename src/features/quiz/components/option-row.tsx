import { SymbolView } from 'expo-symbols';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/text';
import { Radius, Space } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { optionLetter } from '../scoring';

export type OptionState = 'idle' | 'selected' | 'correct' | 'wrong' | 'dimmed';

type OptionRowProps = {
  index: number;
  text: string;
  state: OptionState;
  /** The student's pick (before or after checking). */
  chosen: boolean;
  /** False after "Kontrol et": the answer is locked. */
  enabled: boolean;
  onPress: () => void;
};

const CHECK = { ios: 'checkmark.circle.fill', android: 'check_circle', web: 'check_circle' } as const;
const CROSS = { ios: 'xmark.circle.fill', android: 'cancel', web: 'cancel' } as const;

/**
 * One answer option, drawn like a row on an optik answer sheet: a lettered bubble, then
 * the text. After checking, the right and wrong options also say so with an icon and words
 * (never color alone, ACC-05).
 */
export function OptionRow({ index, text, state, chosen, enabled, onPress }: OptionRowProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const letter = optionLetter(index);

  const tone =
    state === 'correct' ? colors.success : state === 'wrong' ? colors.exam : state === 'selected' ? colors.pen : null;
  const bubbleFill = tone ?? 'transparent';
  const bubbleBorder = tone ?? colors.exam;

  const mark =
    state === 'correct'
      ? { icon: CHECK, label: t('quiz.markCorrect'), color: 'success' as const }
      : state === 'wrong'
        ? { icon: CROSS, label: t('quiz.markWrong'), color: 'exam' as const }
        : null;

  const a11yState =
    state === 'correct'
      ? [t('quiz.optionCorrectA11y'), chosen ? t('quiz.markWrong') : null].filter(Boolean).join(', ')
      : state === 'wrong'
        ? t('quiz.optionWrongA11y')
        : undefined;

  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={[t('quiz.optionA11y', { letter, text }), a11yState].filter(Boolean).join(', ')}
      accessibilityState={{
        checked: chosen,
        disabled: !enabled,
      }}
      disabled={!enabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: colors.surface,
          borderColor: tone ?? colors.line,
          borderWidth: tone ? 2 : 1,
        },
        state === 'dimmed' && styles.dimmed,
        pressed && enabled && { backgroundColor: colors.sunken },
      ]}>
      <View style={[styles.bubble, { borderColor: bubbleBorder, backgroundColor: bubbleFill }]}>
        <AppText
          variant="bubble"
          color={tone ? 'onPen' : 'exam'}
          maxFontSizeMultiplier={1.2}
          style={styles.letter}>
          {letter}
        </AppText>
      </View>
      <View style={styles.text}>
        <AppText variant="body">{text}</AppText>
        {mark ? (
          <View style={styles.mark}>
            <SymbolView name={mark.icon} size={16} tintColor={colors[mark.color]} />
            <AppText variant="footnote" color={mark.color} style={styles.markText}>
              {mark.label}
            </AppText>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.md,
    paddingHorizontal: Space.md + 2,
    paddingVertical: Space.md,
    borderRadius: Radius.md,
  },
  dimmed: {
    opacity: 0.6,
  },
  bubble: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  letter: {
    fontSize: 14,
    lineHeight: 17,
  },
  text: {
    flex: 1,
    gap: Space.xs,
  },
  mark: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.xs,
  },
  markText: {
    fontWeight: '600',
  },
});

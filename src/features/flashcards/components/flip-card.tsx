import type { ReactNode } from 'react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AccessibilityInfo, Animated, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/text';
import { Radius, Space } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { useReduceMotion } from '../use-reduce-motion';

type FlipCardProps = {
  front: string;
  back: string;
  /** Called as soon as the student asks for the answer. */
  onFlip: () => void;
  /** Labels and actions under the text (AI label, source page, report). */
  footer?: ReactNode;
};

const HALF_MS = 130;

/**
 * A flashcard that turns over on tap. With "reduce motion" on it crossfades instead.
 * Mount it with `key={card.id}` so every new card starts on its front, without animation.
 */
export function FlipCard({ front, back, onFlip, footer }: FlipCardProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const reduceMotion = useReduceMotion();
  const [face, setFace] = useState<'front' | 'back'>('front');
  // 0 = front flat, 1 = edge-on (the face swaps here), 2 = back flat.
  const [turn] = useState(() => new Animated.Value(0));

  const flip = () => {
    if (face === 'back') return;
    onFlip();
    AccessibilityInfo.announceForAccessibility(back);
    Animated.timing(turn, { toValue: 1, duration: reduceMotion ? 90 : HALF_MS, useNativeDriver: true }).start(
      () => {
        setFace('back');
        Animated.timing(turn, {
          toValue: 2,
          duration: reduceMotion ? 90 : HALF_MS,
          useNativeDriver: true,
        }).start();
      },
    );
  };

  const motion = reduceMotion
    ? { opacity: turn.interpolate({ inputRange: [0, 1, 2], outputRange: [1, 0, 1] }) }
    : {
        transform: [
          { perspective: 1000 },
          { rotateY: turn.interpolate({ inputRange: [0, 1, 2], outputRange: ['0deg', '90deg', '0deg'] }) },
        ],
      };

  return (
    <Animated.View
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: face === 'back' ? colors.pen : colors.line },
        motion,
      ]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={face === 'front' ? `${t('review.front')}: ${front}` : `${t('review.back')}: ${back}`}
        accessibilityHint={face === 'front' ? t('review.flipHint') : undefined}
        accessibilityState={{ disabled: face === 'back' }}
        disabled={face === 'back'}
        onPress={flip}
        style={styles.face}>
        <AppText variant="footnote" color="inkSoft">
          {face === 'front' ? t('review.front') : t('review.back')}
        </AppText>

        {face === 'front' ? (
          <View style={styles.body}>
            <AppText variant="title" style={styles.center}>
              {front}
            </AppText>
            <AppText variant="callout" color="pen" style={styles.center}>
              {t('review.tapToFlip')}
            </AppText>
          </View>
        ) : (
          <View style={styles.body}>
            <AppText variant="callout" color="inkSoft" style={styles.center}>
              {front}
            </AppText>
            <View style={[styles.rule, { backgroundColor: colors.line }]} />
            <AppText variant="title" style={styles.center}>
              {back}
            </AppText>
          </View>
        )}
      </Pressable>

      {/* Outside the pressable face so its buttons stay reachable for screen readers. */}
      {footer}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    padding: Space.xl,
    gap: Space.lg,
  },
  face: {
    minHeight: 220,
    gap: Space.lg,
  },
  body: {
    flexGrow: 1,
    justifyContent: 'center',
    gap: Space.lg,
  },
  center: {
    textAlign: 'center',
  },
  rule: {
    height: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
  },
});

import { SymbolView } from 'expo-symbols';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { create } from 'zustand';

import { Button } from '@/components/ui/button';
import { AppText } from '@/components/ui/text';
import { Fonts, Gutter, Radius, Space } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import {
  attemptsLeft,
  capitalizeTr,
  initialGateLock,
  isCorrectAnswer,
  lockRemainingMs,
  makeGateQuestion,
  numberToTurkishWords,
  registerWrongAnswer,
  type GateLock,
  type GateQuestion,
} from './question';

/** Lives outside the modal so closing and reopening it doesn't reset the 1-minute lock. */
const useGateLock = create<GateLock>(() => initialGateLock);

const MAX_DIGITS = 4;
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'submit'] as const;

/**
 * CONTRACT (owned by the account feature): the parent gate (US-19, BR-19).
 *
 * ```tsx
 * const { requestGate, gateElement } = useParentGate();
 * requestGate(() => openStore());   // runs the callback only after a correct answer
 * return <>{...}{gateElement}</>;
 * ```
 */
export function useParentGate(): { requestGate: (onPass: () => void) => void; gateElement: ReactNode } {
  const [pending, setPending] = useState<{ onPass: () => void } | null>(null);
  const passed = useRef<(() => void) | null>(null);

  const requestGate = (onPass: () => void) => setPending({ onPass });

  const handlePass = () => {
    const callback = pending?.onPass ?? null;
    setPending(null);
    // iOS: wait until the sheet is gone so the next screen (e.g. the store sheet) can present.
    if (Platform.OS === 'ios') passed.current = callback;
    else callback?.();
  };

  const handleDismiss = () => {
    const callback = passed.current;
    passed.current = null;
    callback?.();
  };

  const gateElement = (
    <ParentGateModal
      visible={pending != null}
      onPass={handlePass}
      onCancel={() => setPending(null)}
      onDismiss={handleDismiss}
    />
  );

  return { requestGate, gateElement };
}

type ParentGateModalProps = {
  visible: boolean;
  onPass: () => void;
  onCancel: () => void;
  onDismiss: () => void;
};

function ParentGateModal({ visible, onPass, onCancel, onDismiss }: ParentGateModalProps) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onCancel}
      onDismiss={onDismiss}>
      {visible ? <GateBody onPass={onPass} onCancel={onCancel} /> : null}
    </Modal>
  );
}

function GateBody({ onPass, onCancel }: { onPass: () => void; onCancel: () => void }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const lock = useGateLock();
  const [question, setQuestion] = useState<GateQuestion>(() => makeGateQuestion());
  const [typed, setTyped] = useState('');
  const [wrong, setWrong] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const remainingMs = lockRemainingMs(lock, now);
  const locked = remainingMs > 0;

  // Tick once a second while locked so the countdown updates and the keypad comes back.
  useEffect(() => {
    if (lock.lockedUntil == null) return;
    const timer = setInterval(() => {
      const current = Date.now();
      setNow(current);
      const { lockedUntil } = useGateLock.getState();
      if (lockedUntil != null && current >= lockedUntil) useGateLock.setState(initialGateLock);
    }, 1000);
    return () => clearInterval(timer);
  }, [lock.lockedUntil]);

  const press = (key: (typeof KEYS)[number]) => {
    if (locked) return;
    if (key === 'clear') {
      setTyped((v) => v.slice(0, -1));
      return;
    }
    if (key === 'submit') {
      submit();
      return;
    }
    setWrong(false);
    setTyped((v) => (v.length >= MAX_DIGITS ? v : v + key));
  };

  const submit = () => {
    if (!typed) return;
    if (isCorrectAnswer(question, typed)) {
      useGateLock.setState(initialGateLock);
      onPass();
      return;
    }
    const at = Date.now();
    const next = registerWrongAnswer(lock, at);
    useGateLock.setState(next);
    setNow(at);
    // Once locked, the countdown replaces the "wrong" message.
    setWrong(next.lockedUntil == null);
    setTyped('');
    // A new question after every miss, so answers can't be guessed one by one.
    setQuestion(makeGateQuestion());
  };

  const questionText = t('parentGate.question', {
    a: capitalizeTr(numberToTurkishWords(question.a)),
    b: numberToTurkishWords(question.b),
  });

  return (
    <View style={[styles.flex, { backgroundColor: colors.paper }]}>
      <View style={[styles.bar, { borderBottomColor: colors.line }]}>
        <Button label={t('parentGate.cancel')} variant="plain" onPress={onCancel} />
      </View>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Space.xl }]}>
        <View style={styles.header}>
          <SymbolView
            name={{ ios: 'person.2.fill', android: 'family_restroom', web: 'family_restroom' }}
            size={28}
            tintColor={colors.pen}
          />
          <AppText variant="display" accessibilityRole="header">
            {t('parentGate.title')}
          </AppText>
          <AppText variant="callout" color="inkSoft">
            {t('parentGate.intro')}
          </AppText>
        </View>

        <AppText variant="title" accessibilityLiveRegion="polite">
          {questionText}
        </AppText>

        <View
          accessible
          accessibilityLabel={`${t('parentGate.answer')}: ${typed || t('parentGate.answerEmpty')}`}
          style={[styles.answer, { backgroundColor: colors.surface, borderColor: wrong ? colors.exam : colors.line }]}>
          <AppText
            maxFontSizeMultiplier={1.3}
            style={[styles.answerText, { color: typed ? colors.ink : colors.inkFaint }]}>
            {typed || '?'}
          </AppText>
        </View>

        {locked ? (
          <AppText variant="callout" color="exam" accessibilityRole="alert">
            {t('parentGate.locked', { seconds: Math.ceil(remainingMs / 1000) })}
          </AppText>
        ) : wrong ? (
          <AppText variant="callout" color="exam" accessibilityRole="alert">
            {t('parentGate.wrong', { count: attemptsLeft(lock) })}
          </AppText>
        ) : null}

        <View style={styles.keypad}>
          {[0, 1, 2, 3].map((row) => (
            <View key={row} style={styles.keyRow}>
              {KEYS.slice(row * 3, row * 3 + 3).map((key) => (
                <Key key={key} value={key} disabled={locked || (key === 'submit' && !typed)} onPress={press} />
              ))}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

function Key({
  value,
  disabled,
  onPress,
}: {
  value: (typeof KEYS)[number];
  disabled: boolean;
  onPress: (key: (typeof KEYS)[number]) => void;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const isSubmit = value === 'submit';
  const label = value === 'clear' ? t('parentGate.clear') : isSubmit ? t('parentGate.submit') : value;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={() => onPress(value)}
      style={({ pressed }) => [
        styles.key,
        {
          backgroundColor: isSubmit ? colors.pen : colors.surface,
          borderColor: isSubmit ? colors.pen : colors.line,
        },
        disabled && styles.disabled,
        pressed && { opacity: 0.7 },
      ]}>
      {value === 'clear' ? (
        <SymbolView
          name={{ ios: 'delete.left', android: 'backspace', web: 'backspace' }}
          size={22}
          tintColor={colors.ink}
        />
      ) : isSubmit ? (
        <SymbolView name={{ ios: 'checkmark', android: 'check', web: 'check' }} size={22} weight="bold" tintColor={colors.onPen} />
      ) : (
        <AppText maxFontSizeMultiplier={1.3} style={[styles.keyText, { color: colors.ink }]}>
          {value}
        </AppText>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  bar: {
    alignItems: 'flex-end',
    paddingHorizontal: Space.sm,
    paddingTop: Space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  content: {
    paddingHorizontal: Gutter,
    paddingTop: Space.xl,
    gap: Space.xl,
  },
  header: {
    gap: Space.sm,
  },
  answer: {
    minHeight: 72,
    borderWidth: 2,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  answerText: {
    fontFamily: Fonts.display,
    fontSize: 36,
    lineHeight: 44,
    letterSpacing: 4,
  },
  keypad: {
    gap: Space.sm,
  },
  keyRow: {
    flexDirection: 'row',
    gap: Space.sm,
  },
  key: {
    flex: 1,
    minHeight: 60,
    borderWidth: 1,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyText: {
    fontFamily: Fonts.display,
    fontSize: 26,
    lineHeight: 32,
  },
  disabled: {
    opacity: 0.4,
  },
});

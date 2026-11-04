import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { Page } from '@/components/ui/page';
import { Segmented } from '@/components/ui/segmented';
import { AppText } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { Radius, Space } from '@/constants/theme';
import { FEEDBACK_TEXT_MAX, FEEDBACK_TEXT_MIN, saveFeedbackText, saveSus } from '@/features/feedback/save';
import { SUS_ITEMS, SUS_SCALE, isSusComplete, type SusAnswer } from '@/features/feedback/sus';
import { useTheme } from '@/hooks/use-theme';

type Mode = 'text' | 'sus';

function SusQuestion({
  item,
  value,
  onChange,
}: {
  item: (typeof SUS_ITEMS)[number];
  value: SusAnswer | null;
  onChange: (value: SusAnswer) => void;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const text = t(`sus.items.q${item}`);

  return (
    <View style={[styles.question, { backgroundColor: colors.surface, borderColor: colors.line }]}>
      <AppText variant="body">{t('sus.itemLabel', { number: item, text })}</AppText>
      <Segmented
        value={value}
        onChange={onChange}
        options={SUS_SCALE.map((answer) => ({
          value: answer,
          label: String(answer),
          a11yLabel: `${text} ${t('sus.optionA11y', { value: answer, label: t(`sus.scale.s${answer}`) })}`,
        }))}
      />
      <View style={styles.scaleEnds} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        <AppText variant="footnote" color="inkSoft">
          {t('sus.scale.s1')}
        </AppText>
        <AppText variant="footnote" color="inkSoft" style={styles.right}>
          {t('sus.scale.s5')}
        </AppText>
      </View>
    </View>
  );
}

/** US-70: beta feedback as free text, and the 10-item SUS questionnaire. */
export default function FeedbackScreen() {
  const { t } = useTranslation();
  const [mode, setMode] = useState<Mode>('text');
  const [text, setText] = useState('');
  const [answers, setAnswers] = useState<(SusAnswer | null)[]>(() => SUS_ITEMS.map(() => null));
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const [sent, setSent] = useState<Mode | null>(null);

  const answered = answers.filter((a) => a != null).length;
  const textTooShort = text.trim().length < FEEDBACK_TEXT_MIN;

  const switchMode = (next: Mode) => {
    setMode(next);
    setSubmitted(false);
    setFailed(false);
  };

  const send = async () => {
    setSubmitted(true);
    setFailed(false);
    if (mode === 'text' ? textTooShort : !isSusComplete(answers)) return;
    setSaving(true);
    try {
      if (mode === 'text') await saveFeedbackText(text);
      else await saveSus(answers as number[]);
      setSent(mode);
    } catch {
      setFailed(true);
    } finally {
      setSaving(false);
    }
  };

  const again = () => {
    setText('');
    setSubmitted(false);
    setSent(null);
    setMode('text');
  };

  if (sent) {
    return (
      <>
        <Stack.Screen options={{ title: t('feedback.title') }} />
        <Page
          footer={
            <>
              <Button label={t('feedback.back')} onPress={() => router.back()} block />
              {sent === 'text' ? (
                <Button label={t('feedback.again')} variant="plain" onPress={again} block />
              ) : null}
            </>
          }>
          <View style={styles.done} accessibilityLiveRegion="polite">
            <AppText variant="display" accessibilityRole="header">
              {sent === 'sus' ? t('sus.sentTitle') : t('feedback.sentTitle')}
            </AppText>
            <AppText variant="body">{sent === 'sus' ? t('sus.sentBody') : t('feedback.sentBody')}</AppText>
          </View>
        </Page>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: t('feedback.title') }} />
      <Page
        intro={t('feedback.intro')}
        footer={
          <Button
            label={mode === 'text' ? t('feedback.send') : t('sus.send')}
            onPress={send}
            loading={saving}
            block
          />
        }>
        <Segmented
          value={mode}
          onChange={switchMode}
          options={[
            { value: 'text', label: t('feedback.modes.text') },
            { value: 'sus', label: t('feedback.modes.sus') },
          ]}
        />
        {failed ? <Banner tone="warning" message={t('feedback.error')} /> : null}

        {mode === 'text' ? (
          <TextField
            label={t('feedback.textLabel')}
            hint={t('feedback.textHint')}
            error={submitted && textTooShort ? t('feedback.textError', { min: FEEDBACK_TEXT_MIN }) : null}
            value={text}
            onChangeText={setText}
            multiline
            maxLength={FEEDBACK_TEXT_MAX}
          />
        ) : (
          <View style={styles.sus}>
            <View style={styles.susHead}>
              <AppText variant="title" accessibilityRole="header">
                {t('sus.title')}
              </AppText>
              <AppText variant="callout" color="inkSoft">
                {t('sus.intro')}
              </AppText>
            </View>
            {SUS_ITEMS.map((item, index) => (
              <SusQuestion
                key={item}
                item={item}
                value={answers[index]}
                onChange={(value) =>
                  setAnswers((current) => current.map((a, i) => (i === index ? value : a)))
                }
              />
            ))}
            <AppText variant="footnote" color="inkSoft">
              {t('sus.progress', { answered })}
            </AppText>
            {submitted && !isSusComplete(answers) ? (
              <AppText variant="footnote" color="exam" accessibilityLiveRegion="polite">
                {t('sus.missing')}
              </AppText>
            ) : null}
          </View>
        )}
      </Page>
    </>
  );
}

const styles = StyleSheet.create({
  sus: {
    gap: Space.md,
  },
  susHead: {
    gap: Space.xs,
  },
  question: {
    gap: Space.sm + 2,
    padding: Space.lg,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  scaleEnds: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Space.md,
  },
  right: {
    textAlign: 'right',
  },
  done: {
    gap: Space.lg,
  },
});

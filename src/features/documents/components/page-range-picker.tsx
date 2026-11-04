import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Stepper } from '@/components/ui/stepper';
import { AppText } from '@/components/ui/text';
import { Space } from '@/constants/theme';
import { clampPageRange, rangeLength, type PageRange } from '@/features/quota/quota';

type PageRangePickerProps = {
  pageCount: number;
  maxPages: number;
  value: PageRange;
  onChange: (range: PageRange) => void;
};

/** First and last page, kept inside the plan's page limit (BR-14, FR-AI-02). */
export function PageRangePicker({ pageCount, maxPages, value, onChange }: PageRangePickerProps) {
  const { t } = useTranslation();
  const set = (next: PageRange, moved: 'from' | 'to') => onChange(clampPageRange(next, pageCount, maxPages, moved));

  return (
    <View style={styles.wrap}>
      <Stepper
        label={t('upload.rangeFrom')}
        value={value.from}
        min={1}
        max={pageCount}
        step={1}
        onChange={(from) => set({ ...value, from }, 'from')}
      />
      <Stepper
        label={t('upload.rangeTo')}
        value={value.to}
        min={1}
        max={pageCount}
        step={1}
        onChange={(to) => set({ ...value, to }, 'to')}
      />
      <AppText variant="footnote" color="inkSoft" accessibilityLiveRegion="polite">
        {t('upload.rangeSummary', { from: value.from, to: value.to, count: rangeLength(value) })}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: Space.sm,
  },
});

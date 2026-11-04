import { useTranslation } from 'react-i18next';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { ListRow } from '@/components/ui/list-row';
import { Section } from '@/components/ui/section';
import { AppText } from '@/components/ui/text';
import { Gutter, Radius, Space } from '@/constants/theme';
import type { ReportReason } from '@/db/types';
import { useReduceMotion } from '@/features/flashcards/use-reduce-motion';
import { useTheme } from '@/hooks/use-theme';

import { REPORT_REASONS } from './logic';

type ReportSheetProps = {
  visible: boolean;
  onClose: () => void;
  onSelect: (reason: ReportReason) => void;
};

const REASON_ICONS = {
  wrong_answer: { ios: 'xmark.circle', android: 'cancel', web: 'cancel' },
  unclear: { ios: 'questionmark.circle', android: 'help', web: 'help' },
  inappropriate: { ios: 'hand.raised', android: 'back_hand', web: 'back_hand' },
} as const;

/** US-37: bottom sheet that asks why a question or card is being reported. */
export function ReportSheet({ visible, onClose, onSelect }: ReportSheetProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();

  return (
    <Modal
      visible={visible}
      transparent
      animationType={reduceMotion ? 'fade' : 'slide'}
      onRequestClose={onClose}
      statusBarTranslucent>
      <View style={styles.backdrop}>
        <Pressable
          style={StyleSheet.absoluteFill}
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
          onPress={onClose}
        />
        <View
          accessibilityViewIsModal
          style={[
            styles.sheet,
            { backgroundColor: colors.paper, paddingBottom: Math.max(insets.bottom, Space.lg) },
          ]}>
          <View style={styles.header}>
            <AppText variant="title" accessibilityRole="header">
              {t('reports.sheetTitle')}
            </AppText>
            <AppText variant="callout" color="inkSoft">
              {t('reports.sheetBody')}
            </AppText>
          </View>
          <Section>
            {REPORT_REASONS.map((reason) => (
              <ListRow
                key={reason}
                title={t(`reports.reasons.${reason}`)}
                icon={REASON_ICONS[reason]}
                chevron={false}
                onPress={() => onSelect(reason)}
              />
            ))}
          </Section>
          <Button label={t('common.cancel')} variant="secondary" block onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(14, 18, 38, 0.45)',
  },
  sheet: {
    paddingHorizontal: Gutter,
    paddingTop: Space.xl,
    gap: Space.lg,
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
  },
  header: {
    gap: Space.xs,
  },
});

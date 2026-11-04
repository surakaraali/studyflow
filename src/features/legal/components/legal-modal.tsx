import { useTranslation } from 'react-i18next';
import { Modal, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Gutter, Space } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { LEGAL_DOCUMENTS, type LegalDocId } from '../texts';
import { LegalDocumentView } from './legal-document-view';

type LegalModalProps = {
  doc: LegalDocId | null;
  onClose: () => void;
};

/**
 * Legal text in a sheet, for screens outside the signed-in app (sign-up, welcome, parent page)
 * where the /settings/legal routes can't be reached.
 */
export function LegalModal({ doc, onClose }: LegalModalProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const document = doc ? LEGAL_DOCUMENTS[doc] : null;

  return (
    <Modal
      visible={document != null}
      animationType="slide"
      presentationStyle="pageSheet"
      allowSwipeDismissal
      onRequestClose={onClose}>
      <View style={[styles.flex, { backgroundColor: colors.paper }]}>
        <View style={[styles.bar, { borderBottomColor: colors.line }]}>
          <Button label={t('common.close')} variant="plain" onPress={onClose} />
        </View>
        <ScrollView
          style={styles.flex}
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Space.xxxl }]}>
          {document ? <LegalDocumentView doc={document} showTitle /> : null}
        </ScrollView>
      </View>
    </Modal>
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
  },
});

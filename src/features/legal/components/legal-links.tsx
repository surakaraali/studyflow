import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/text';
import { Space } from '@/constants/theme';

import { LEGAL_DOCUMENTS, LEGAL_DOC_IDS, type LegalDocId } from '../texts';
import { LegalModal } from './legal-modal';

/**
 * "By continuing you accept…" with links that open each legal text in a sheet.
 * Used before sign-in, where the settings routes are out of reach.
 */
export function LegalLinks({ context = 'continue' }: { context?: 'continue' | 'signUp' }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState<LegalDocId | null>(null);

  return (
    <View style={styles.wrap}>
      <AppText variant="footnote" color="inkSoft" style={styles.center}>
        {context === 'signUp' ? t('auth.legalLineSignUp') : t('auth.legalLine')}
      </AppText>
      <View style={styles.links}>
        {LEGAL_DOC_IDS.map((id) => (
          <Pressable
            key={id}
            accessibilityRole="link"
            accessibilityLabel={LEGAL_DOCUMENTS[id].title}
            onPress={() => setOpen(id)}
            hitSlop={6}
            style={({ pressed }) => [styles.link, pressed && { opacity: 0.6 }]}>
            <AppText variant="footnote" color="pen" style={styles.linkText}>
              {LEGAL_DOCUMENTS[id].title}
            </AppText>
          </Pressable>
        ))}
      </View>
      <LegalModal doc={open} onClose={() => setOpen(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: Space.xs,
    alignItems: 'center',
  },
  center: {
    textAlign: 'center',
  },
  links: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    columnGap: Space.lg,
  },
  link: {
    minHeight: 44,
    justifyContent: 'center',
  },
  linkText: {
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});

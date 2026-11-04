import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/text';
import { Radius, Space } from '@/constants/theme';
import { formatFullDate } from '@/features/account/format';
import { useTheme } from '@/hooks/use-theme';

import { LEGAL_DATE, LEGAL_DRAFT, LEGAL_VERSION, type LegalDocument } from '../texts';

type LegalDocumentViewProps = {
  doc: LegalDocument;
  /** Show the document title inside the body (modals); pushed screens use the header. */
  showTitle?: boolean;
};

/** A legal text with its version and date (US-20). */
export function LegalDocumentView({ doc, showTitle = false }: LegalDocumentViewProps) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();

  return (
    <View style={styles.wrap}>
      <View style={styles.meta}>
        {showTitle ? (
          <AppText variant="display" accessibilityRole="header">
            {doc.title}
          </AppText>
        ) : null}
        <AppText variant="footnote" color="inkSoft">
          {t('legal.version', {
            version: LEGAL_VERSION,
            date: formatFullDate(LEGAL_DATE, i18n.language),
          })}
        </AppText>
        {LEGAL_DRAFT ? (
          <View style={[styles.draft, { backgroundColor: colors.highlight }]}>
            <AppText variant="footnote" color="onHighlight" style={styles.draftText}>
              {t('legal.draft')}
            </AppText>
          </View>
        ) : null}
      </View>

      {doc.sections.map((section) => (
        <View key={section.heading} style={styles.section}>
          <AppText variant="heading" accessibilityRole="header">
            {section.heading}
          </AppText>
          {section.paragraphs?.map((paragraph) => (
            <AppText key={paragraph} variant="callout">
              {paragraph}
            </AppText>
          ))}
          {section.bullets?.map((bullet) => (
            <View key={bullet} style={styles.bullet}>
              <AppText variant="callout" color="inkSoft" accessibilityElementsHidden importantForAccessibility="no">
                •
              </AppText>
              <AppText variant="callout" style={styles.bulletText}>
                {bullet}
              </AppText>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: Space.xl,
  },
  meta: {
    gap: Space.sm,
  },
  draft: {
    alignSelf: 'flex-start',
    paddingHorizontal: Space.sm + 2,
    paddingVertical: Space.xs,
    borderRadius: Radius.sm,
  },
  draftText: {
    fontWeight: '600',
  },
  section: {
    gap: Space.sm,
  },
  bullet: {
    flexDirection: 'row',
    gap: Space.sm,
    paddingRight: Space.sm,
  },
  bulletText: {
    flex: 1,
  },
});

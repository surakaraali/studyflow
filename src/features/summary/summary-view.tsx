import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { HighlightMark } from '@/components/highlight-mark';
import { AiLabel } from '@/components/ui/ai-label';
import { AppText } from '@/components/ui/text';
import { Radius, Space } from '@/constants/theme';
import type { SummarySection } from '@/db/types';
import { useTheme } from '@/hooks/use-theme';

import { formatPageList, splitByTerms } from './format';

function Paragraph({ text, terms }: { text: string; terms: string[] }) {
  const { colors } = useTheme();
  const pieces = splitByTerms(text, terms);

  return (
    <AppText variant="body">
      {pieces.map((piece, index) =>
        piece.term ? (
          <AppText
            key={index}
            variant="body"
            color="onHighlight"
            style={[styles.term, { backgroundColor: colors.highlight }]}>
            {piece.text}
          </AppText>
        ) : (
          piece.text
        ),
      )}
    </AppText>
  );
}

function Section({ section }: { section: SummarySection }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const pages = formatPageList(section.pages);

  return (
    <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.line }]}>
      <View style={styles.sectionHeader}>
        <AppText variant="title" accessibilityRole="header" style={styles.heading}>
          {section.heading}
        </AppText>
        {pages ? (
          <AppText variant="footnote" color="inkSoft" accessibilityLabel={t('summary.pagesA11y', { pages })}>
            {`${t('summary.pagePrefix')} ${pages}`}
          </AppText>
        ) : null}
      </View>

      {section.paragraphs.map((paragraph, index) => (
        <Paragraph key={index} text={paragraph} terms={section.key_terms} />
      ))}

      {section.key_terms.length > 0 ? (
        <View style={styles.terms}>
          <AppText variant="footnote" color="inkSoft">
            {t('summary.keyTerms')}
          </AppText>
          <View style={styles.termRow}>
            {section.key_terms.map((term) => (
              <HighlightMark key={term} active>
                <AppText variant="callout" color="onHighlight">
                  {term}
                </AppText>
              </HighlightMark>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

/** The AI summary of a document (US-33): headings, short paragraphs, key terms, source pages. */
export function SummaryView({ sections }: { sections: SummarySection[] }) {
  const { t } = useTranslation();

  return (
    <View style={styles.wrap}>
      <View style={styles.titleRow}>
        <AppText variant="title" accessibilityRole="header">
          {t('summary.title')}
        </AppText>
        <AiLabel />
      </View>
      {sections.length === 0 ? (
        <AppText variant="callout" color="inkSoft">
          {t('summary.empty')}
        </AppText>
      ) : (
        sections.map((section, index) => <Section key={index} section={section} />)
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: Space.lg,
  },
  titleRow: {
    gap: Space.sm,
  },
  section: {
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Space.lg + 4,
    gap: Space.md,
  },
  sectionHeader: {
    gap: Space.xs,
  },
  heading: {
    fontSize: 19,
    lineHeight: 25,
  },
  term: {
    fontWeight: '600',
  },
  terms: {
    gap: Space.xs + 2,
  },
  termRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Space.sm,
  },
});

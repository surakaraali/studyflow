import { formatPageList, splitByTerms } from '../format';

describe('formatPageList', () => {
  it.each([
    [[3], '3'],
    [[3, 4], '3–4'],
    [[4, 3, 3, 5, 8], '3–5, 8'],
    [[1, 3, 5], '1, 3, 5'],
    [[], ''],
    [[0, -1, 2.5], ''],
  ])('%p → %p', (pages, expected) => {
    expect(formatPageList(pages)).toBe(expected);
  });
});

describe('splitByTerms', () => {
  it('marks key terms, ignoring case', () => {
    expect(splitByTerms('Fotosentez bitkide olur. fotosentez için ışık gerekir.', ['fotosentez', 'ışık'])).toEqual([
      { text: 'Fotosentez', term: true },
      { text: ' bitkide olur. ', term: false },
      { text: 'fotosentez', term: true },
      { text: ' için ', term: false },
      { text: 'ışık', term: true },
      { text: ' gerekir.', term: false },
    ]);
  });

  it('prefers the longer term when two overlap', () => {
    expect(splitByTerms('Hücre zarı korur.', ['hücre', 'hücre zarı'])).toEqual([
      { text: 'Hücre zarı', term: true },
      { text: ' korur.', term: false },
    ]);
  });

  it('uses Turkish casing for İ and I', () => {
    expect(splitByTerms('İklim ve ısı', ['iklim', 'ISI']).filter((p) => p.term).map((p) => p.text)).toEqual(['İklim', 'ısı']);
  });

  it('returns the text unchanged without terms', () => {
    expect(splitByTerms('Metin', [])).toEqual([{ text: 'Metin', term: false }]);
  });
});

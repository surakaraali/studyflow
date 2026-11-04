import {
  cleanPage,
  cleanText,
  minimumUsable,
  stripOptionLabels,
  validateCards,
  validateQuestions,
  validateSummary,
} from '../../supabase/functions/_shared/ai/validate.ts';

const q = (over: Record<string, unknown> = {}) => ({
  stem: 'Fotosentez nerede gerçekleşir?',
  options: ['Kloroplast', 'Mitokondri', 'Ribozom', 'Çekirdek'],
  correct_index: 0,
  explanation: 'Kloroplastta gerçekleşir.',
  source_page: 2,
  topic: 'Fotosentez',
  ...over,
});

describe('validateQuestions (BR-12)', () => {
  const rules = { optionCount: 4, max: 10, pageCount: 5 };

  it('keeps a valid question and trims its text', () => {
    const { questions, dropped } = validateQuestions([q({ stem: '  Fotosentez   nerede gerçekleşir? ' })], rules);
    expect(dropped).toBe(0);
    expect(questions).toHaveLength(1);
    expect(questions[0].stem).toBe('Fotosentez nerede gerçekleşir?');
  });

  it('drops questions whose option count does not match the segment', () => {
    const { questions, dropped } = validateQuestions(
      [q({ options: ['A', 'B', 'C'] }), q({ stem: 'Beş şık?', options: ['A', 'B', 'C', 'D', 'E'] })],
      rules,
    );
    expect(questions).toHaveLength(0);
    expect(dropped).toBe(2);
  });

  it('accepts 5 options for lise and 3 for ilkokul', () => {
    expect(validateQuestions([q({ options: ['a', 'b', 'c', 'd', 'e'] })], { ...rules, optionCount: 5 }).questions).toHaveLength(1);
    expect(validateQuestions([q({ options: ['a', 'b', 'c'] })], { ...rules, optionCount: 3 }).questions).toHaveLength(1);
  });

  it.each([[-1], [4], [1.5], ['0'], [null]])('drops correct_index %p', (correct) => {
    expect(validateQuestions([q({ correct_index: correct })], rules).questions).toHaveLength(0);
  });

  it('drops empty or repeated options', () => {
    expect(validateQuestions([q({ options: ['Kloroplast', ' ', 'Ribozom', 'Çekirdek'] })], rules).questions).toHaveLength(0);
    expect(validateQuestions([q({ options: ['Kloroplast', 'kloroplast', 'Ribozom', 'Çekirdek'] })], rules).questions).toHaveLength(0);
  });

  it('removes repeated stems', () => {
    const { questions } = validateQuestions([q(), q({ stem: 'fotosentez nerede gerçekleşir' })], rules);
    expect(questions).toHaveLength(1);
  });

  it('stops at the requested number', () => {
    const many = Array.from({ length: 15 }, (_, i) => q({ stem: `Soru ${i}` }));
    expect(validateQuestions(many, rules).questions).toHaveLength(10);
  });

  it('nulls a source page outside the document', () => {
    expect(validateQuestions([q({ source_page: 9 })], rules).questions[0].source_page).toBeNull();
  });

  it('removes A) B) labels only when every option has its letter', () => {
    const { questions } = validateQuestions([q({ options: ['A) Kloroplast', 'B) Mitokondri', 'C) Ribozom', 'D) Çekirdek'] })], rules);
    expect(questions[0].options).toEqual(['Kloroplast', 'Mitokondri', 'Ribozom', 'Çekirdek']);
    expect(stripOptionLabels(['E. coli', 'Maya', 'Amip', 'Öglena'])).toEqual(['E. coli', 'Maya', 'Amip', 'Öglena']);
  });

  it('survives garbage input', () => {
    expect(validateQuestions(null, rules).questions).toEqual([]);
    expect(validateQuestions([null, 3, 'x'], rules).questions).toEqual([]);
  });
});

describe('validateCards', () => {
  it('drops empty and repeated cards and limits the count', () => {
    const { cards } = validateCards(
      [
        { front: 'Hücre', back: 'Canlının en küçük birimi', source_page: 1 },
        { front: ' hücre ', back: 'Tekrar', source_page: 1 },
        { front: '', back: 'Boş', source_page: 1 },
        { front: 'Doku', back: '', source_page: 1 },
        { front: 'Organ', back: 'Dokuların birleşmesi', source_page: 40 },
      ],
      { max: 15, pageCount: 3 },
    );
    expect(cards.map((c) => c.front)).toEqual(['Hücre', 'Organ']);
    expect(cards[1].source_page).toBeNull();
  });
});

describe('validateSummary', () => {
  it('keeps sections with a heading and paragraphs, dedupes terms and sorts pages', () => {
    const { sections } = validateSummary(
      [
        { heading: 'Hücre', paragraphs: [' Hücre canlının birimidir. ', ''], key_terms: ['hücre', 'Hücre', 'zar'], pages: [3, 1, 3, 99] },
        { heading: '', paragraphs: ['başlıksız'], key_terms: [], pages: [] },
        { heading: 'Boş', paragraphs: [], key_terms: [], pages: [] },
      ],
      { pageCount: 5 },
    );
    expect(sections).toEqual([
      { heading: 'Hücre', paragraphs: ['Hücre canlının birimidir.'], key_terms: ['hücre', 'zar'], pages: [1, 3] },
    ]);
  });
});

describe('helpers', () => {
  it('cleanText and cleanPage', () => {
    expect(cleanText('  a \n b ')).toBe('a b');
    expect(cleanText(5)).toBe('');
    expect(cleanPage(0, 5)).toBeNull();
    expect(cleanPage(5, 5)).toBe(5);
    expect(cleanPage(6, 0)).toBe(6);
  });

  it('minimumUsable asks for 60% of what was requested', () => {
    expect(minimumUsable(10)).toBe(6);
    expect(minimumUsable(15)).toBe(9);
    expect(minimumUsable(1)).toBe(1);
  });
});

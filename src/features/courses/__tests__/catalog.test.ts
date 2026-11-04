import { COURSE_CATALOG, gradeHasTracks, suggestedCourses } from '../catalog';

const keys = (grade: number | null, track: Parameters<typeof suggestedCourses>[1] = null) =>
  suggestedCourses(grade, track).map((c) => c.key);

describe('US-21 course catalog', () => {
  it('has unique keys and names', () => {
    const allKeys = COURSE_CATALOG.map((c) => c.key);
    expect(new Set(allKeys).size).toBe(allKeys.length);
    const names = COURSE_CATALOG.map((c) => c.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('suggests nothing without a grade', () => {
    expect(keys(null)).toEqual([]);
  });

  it.each([5, 6, 7, 8, 9, 10, 11, 12])('suggests courses for grade %i', (grade) => {
    expect(keys(grade).length).toBeGreaterThan(5);
  });

  it('follows the ortaokul schedule', () => {
    expect(keys(5)).toEqual(
      expect.arrayContaining(['turkce', 'matematik', 'fen', 'sosyal', 'ingilizce', 'din', 'bilisim']),
    );
    expect(keys(5)).not.toContain('inkilap');
    expect(keys(5)).not.toContain('teknoloji');
    expect(keys(7)).toContain('teknoloji');
    expect(keys(7)).not.toContain('bilisim');
    expect(keys(8)).toContain('inkilap');
    expect(keys(8)).not.toContain('sosyal');
    expect(keys(8)).not.toContain('edebiyat');
  });

  it('follows the lise schedule', () => {
    expect(keys(9)).toEqual(
      expect.arrayContaining(['edebiyat', 'matematik', 'fizik', 'kimya', 'biyoloji', 'tarih', 'cografya', 'saglik']),
    );
    expect(keys(9)).not.toContain('turkce');
    expect(keys(9)).not.toContain('felsefe');
    expect(keys(10)).toContain('felsefe');
    expect(keys(10)).not.toContain('saglik');
    expect(keys(12)).toContain('inkilap');
  });

  it('ignores the track before grade 11', () => {
    expect(keys(10, 'sozel')).toEqual(keys(10));
    expect(keys(10, 'sozel')).toContain('fizik');
  });

  it('filters field courses by track in grades 11–12', () => {
    const sayisal = keys(11, 'sayisal');
    expect(sayisal).toEqual(expect.arrayContaining(['matematik', 'fizik', 'kimya', 'biyoloji']));
    expect(sayisal).not.toContain('cografya');
    expect(sayisal).not.toContain('psikoloji');

    const esit = keys(11, 'esit');
    expect(esit).toEqual(expect.arrayContaining(['matematik', 'edebiyat', 'tarih', 'cografya']));
    expect(esit).not.toContain('fizik');

    const sozel = keys(12, 'sozel');
    expect(sozel).toEqual(
      expect.arrayContaining(['edebiyat', 'tarih', 'cografya', 'psikoloji', 'sosyoloji', 'mantik']),
    );
    expect(sozel).not.toContain('matematik');
    expect(sozel).not.toContain('kimya');

    const dil = keys(12, 'dil');
    expect(dil).toEqual(expect.arrayContaining(['ingilizce', 'edebiyat']));
    expect(dil).not.toContain('matematik');
    expect(dil).not.toContain('cografya');
  });

  it('keeps compulsory Tarih for every track in grade 11 but not in grade 12', () => {
    expect(keys(11, 'sayisal')).toContain('tarih');
    expect(keys(12, 'sayisal')).not.toContain('tarih');
    expect(keys(12, 'esit')).toContain('tarih');
  });

  it('keeps core courses for every track', () => {
    for (const track of ['sayisal', 'esit', 'sozel', 'dil'] as const) {
      expect(keys(12, track)).toEqual(expect.arrayContaining(['edebiyat', 'din', 'ingilizce', 'beden']));
    }
  });

  it('shows every field course when the track is not set', () => {
    expect(keys(11)).toEqual(
      expect.arrayContaining(['matematik', 'fizik', 'cografya', 'psikoloji', 'tarih']),
    );
  });

  it('knows which grades have tracks', () => {
    expect(gradeHasTracks(10)).toBe(false);
    expect(gradeHasTracks(11)).toBe(true);
    expect(gradeHasTracks(12)).toBe(true);
    expect(gradeHasTracks(null)).toBe(false);
  });
});

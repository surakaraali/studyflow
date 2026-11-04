import { sameCourseName, validateCourseName } from '../validation';

describe('US-22 course name', () => {
  const others = [
    { id: 'a', name: 'Matematik' },
    { id: 'b', name: 'İngilizce' },
  ];

  it('is required', () => {
    expect(validateCourseName('', others)).toBe('required');
    expect(validateCourseName('   ', others)).toBe('required');
  });

  it('is at most 40 characters', () => {
    expect(validateCourseName('x'.repeat(40), others)).toBeNull();
    expect(validateCourseName('x'.repeat(41), others)).toBe('tooLong');
  });

  it('cannot repeat another course name', () => {
    expect(validateCourseName(' matematik ', others)).toBe('duplicate');
    expect(validateCourseName('ingilizce', others)).toBe('duplicate');
  });

  it('may keep its own name when editing', () => {
    expect(validateCourseName('Matematik', others, 'a')).toBeNull();
  });

  it('compares names with Turkish casing and spacing', () => {
    expect(sameCourseName('İNGİLİZCE', 'ingilizce')).toBe(true);
    expect(sameCourseName('Din  Kültürü', 'din kültürü')).toBe(true);
    expect(sameCourseName('Fizik', 'Kimya')).toBe(false);
  });
});

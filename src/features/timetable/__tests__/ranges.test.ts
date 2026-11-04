import {
  formatRanges,
  nextRange,
  rangesAreValid,
  rangesOverlap,
  sortRanges,
  totalMinutes,
  validateRanges,
} from '../ranges';

const r = (start: string, end: string) => ({ start, end });

describe('US-23 time ranges', () => {
  it('detects overlaps but lets ranges touch', () => {
    expect(rangesOverlap(r('08:30', '09:10'), r('09:00', '09:40'))).toBe(true);
    expect(rangesOverlap(r('08:30', '09:10'), r('09:10', '09:50'))).toBe(false);
    expect(rangesOverlap(r('08:00', '15:00'), r('10:00', '11:00'))).toBe(true);
  });

  it('needs the end after the start', () => {
    expect(validateRanges([r('09:00', '09:00')])).toEqual(['endBeforeStart']);
    expect(validateRanges([r('10:00', '09:00')])).toEqual(['endBeforeStart']);
    expect(validateRanges([r('09:00', '09:40')])).toEqual([null]);
  });

  it('flags both slots of an overlap and leaves the others alone', () => {
    expect(
      validateRanges([r('08:30', '09:10'), r('09:00', '09:40'), r('10:00', '10:40')]),
    ).toEqual(['overlap', 'overlap', null]);
  });

  it('does not count a broken range as an overlap', () => {
    expect(validateRanges([r('08:30', '09:10'), r('12:00', '08:00')])).toEqual([
      null,
      'endBeforeStart',
    ]);
  });

  it('accepts a full school day as one or many rows', () => {
    expect(rangesAreValid([r('08:30', '15:10')])).toBe(true);
    expect(rangesAreValid([r('08:30', '09:10'), r('09:20', '10:00'), r('10:10', '10:50')])).toBe(true);
    expect(rangesAreValid([])).toBe(true);
  });

  it('suggests the next slot after the last one', () => {
    const options = { first: r('08:30', '09:10'), length: 40, gap: 10 };
    expect(nextRange([], options)).toEqual(r('08:30', '09:10'));
    expect(nextRange([r('08:30', '09:10')], options)).toEqual(r('09:20', '10:00'));
    expect(nextRange([r('09:20', '10:00'), r('08:30', '09:10')], options)).toEqual(r('10:10', '10:50'));
  });

  it('never suggests a slot past midnight', () => {
    const next = nextRange([r('22:00', '23:50')], { first: r('08:30', '09:10'), length: 40, gap: 10 });
    expect(next).toEqual(r('23:20', '24:00'));
  });

  it('sorts, sums and formats', () => {
    const list = [r('14:00', '19:00'), r('10:00', '12:30')];
    expect(sortRanges(list)).toEqual([r('10:00', '12:30'), r('14:00', '19:00')]);
    expect(totalMinutes(list)).toBe(450);
    expect(formatRanges(list)).toBe('10:00–12:30, 14:00–19:00');
  });
});

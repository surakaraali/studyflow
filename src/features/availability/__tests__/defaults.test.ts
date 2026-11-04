import { rangesAreValid } from '@/features/timetable/ranges';

import { defaultAvailability } from '../defaults';

describe('US-47 default availability', () => {
  it('starts later on weekdays for lise', () => {
    expect(defaultAvailability('lise').weekday).toEqual([{ start: '16:00', end: '21:30' }]);
    expect(defaultAvailability('ortaokul').weekday).toEqual([{ start: '15:30', end: '20:30' }]);
  });

  it('splits the weekend around lunch', () => {
    expect(defaultAvailability('lise').weekend).toEqual([
      { start: '10:00', end: '12:30' },
      { start: '14:00', end: '19:00' },
    ]);
  });

  it('gives valid ranges for every segment', () => {
    for (const segment of ['ilkokul', 'ortaokul', 'lise'] as const) {
      const value = defaultAvailability(segment);
      expect(rangesAreValid(value.weekday)).toBe(true);
      expect(rangesAreValid(value.weekend)).toBe(true);
    }
  });
});

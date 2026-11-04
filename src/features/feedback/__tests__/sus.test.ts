/// <reference types="jest" />
import { isSusComplete, susScore } from '../sus';

describe('SUS score (US-70)', () => {
  it('is 100 for the best possible answers', () => {
    expect(susScore([5, 1, 5, 1, 5, 1, 5, 1, 5, 1])).toBe(100);
  });

  it('is 0 for the worst possible answers', () => {
    expect(susScore([1, 5, 1, 5, 1, 5, 1, 5, 1, 5])).toBe(0);
  });

  it('is 50 when every answer is neutral', () => {
    expect(susScore([3, 3, 3, 3, 3, 3, 3, 3, 3, 3])).toBe(50);
  });

  it('scores a typical set of answers', () => {
    // Odd: 4,5,4,4,5 → 3+4+3+3+4 = 17; even: 2,1,2,2,1 → 3+4+3+3+4 = 17; (17 + 17) × 2.5 = 85
    expect(susScore([4, 2, 5, 1, 4, 2, 4, 2, 5, 1])).toBe(85);
  });

  it('needs all ten answers between 1 and 5', () => {
    expect(susScore([5, 1, 5, 1, 5, 1, 5, 1, 5])).toBeNull();
    expect(susScore([5, 1, 5, 1, 5, 1, 5, 1, 5, null])).toBeNull();
    expect(susScore([5, 1, 5, 1, 5, 1, 5, 1, 5, 6])).toBeNull();
    expect(susScore([5, 1, 5, 1, 5, 1, 5, 1, 5, 2.5])).toBeNull();
    expect(isSusComplete([3, 3, 3, 3, 3, 3, 3, 3, 3, 3])).toBe(true);
    expect(isSusComplete([])).toBe(false);
  });
});

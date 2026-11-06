import { CONSENT_REMINDER_TIME, consentReminderDates } from '../build';

function local(year: number, month: number, day: number, hour = 0, minute = 0) {
  return new Date(year, month - 1, day, hour, minute);
}

describe('consentReminderDates (US-76, BR-04)', () => {
  const signUp = local(2026, 11, 1, 21, 45).toISOString();

  it('schedules day 7 and day 25 after sign-up at the reminder time', () => {
    const dates = consentReminderDates(signUp, local(2026, 11, 1, 22, 0));
    expect(CONSENT_REMINDER_TIME).toBe('18:00');
    expect(dates.map((d) => d.day)).toEqual([7, 25]);
    expect(dates[0].date).toEqual(local(2026, 11, 8, 18, 0));
    expect(dates[1].date).toEqual(local(2026, 11, 26, 18, 0));
  });

  it('keeps only the reminders still ahead', () => {
    expect(consentReminderDates(signUp, local(2026, 11, 8, 18, 0)).map((d) => d.day)).toEqual([25]);
    expect(consentReminderDates(signUp, local(2026, 11, 8, 17, 59)).map((d) => d.day)).toEqual([7, 25]);
    expect(consentReminderDates(signUp, local(2026, 11, 27))).toEqual([]);
  });

  it('crosses month ends', () => {
    const late = local(2026, 1, 20, 9).toISOString();
    const dates = consentReminderDates(late, local(2026, 1, 20, 10));
    expect(dates[0].date).toEqual(local(2026, 1, 27, 18));
    expect(dates[1].date).toEqual(local(2026, 2, 14, 18));
  });

  it('ignores a broken sign-up date', () => {
    expect(consentReminderDates('not a date', local(2026, 11, 1))).toEqual([]);
  });
});

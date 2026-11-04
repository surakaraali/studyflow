import type { Translation } from './tr';

type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] };

/** English is partial for now; missing keys fall back to Turkish. */
const en: DeepPartial<Translation> = {
  tabs: {
    today: 'Today',
    calendar: 'Calendar',
    courses: 'Subjects',
    study: 'Study',
    progress: 'Progress',
  },
  greeting: {
    morning: 'Good morning',
    day: 'Good afternoon',
    evening: 'Good evening',
    night: 'Good night',
  },
  actions: {
    addCourse: 'Add subject',
    uploadPdf: 'Upload PDF',
    startStudying: 'Start studying',
  },
  bubbles: {
    a11y: '{{done}} of {{total}} blocks done',
  },
  today: {
    planTitle: "Today's plan",
    planEmpty:
      'Add your subjects and exam dates to see your daily study blocks here. Each block you finish fills a bubble.',
    examsTitle: 'Upcoming exams',
    examsEmpty: 'Add an exam date to see the countdown here.',
  },
  calendar: {
    emptyTitle: 'No plan this week',
    emptyBody: 'Add your exam dates and free hours. We will build your weekly study plan.',
  },
  courses: {
    emptyTitle: 'No subjects yet',
    emptyBody: 'Add your subjects. You can attach exam dates, homework and a topic list to each one.',
  },
  study: {
    emptyTitle: 'Turn your notes into a quiz',
    emptyBody:
      'Upload your class notes or a chapter from your book as a PDF. We will prepare a summary, a quiz and flashcards.',
  },
  progress: {
    weekTitle: 'This week',
    emptyTitle: 'No study sessions yet',
    emptyBody:
      'After your first study session, your study time, correct answer rate and streak show up here.',
  },
};

export default en;

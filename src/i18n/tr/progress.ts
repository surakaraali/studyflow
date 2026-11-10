/** Progress screen (US-57). */
const progress = {
  progress: {
    weekTitle: 'Bu hafta',
    emptyTitle: 'Henüz çalışma kaydın yok',
    emptyBody:
      'İlk çalışma oturumunu tamamladığında çalışma süren, doğru cevap oranın ve serin burada görünür.',
    weekRange: '{{from}} – {{to}}',
    loadError: 'İlerleme bilgilerin yüklenemedi. Ekranı kapatıp yeniden aç.',
    settingsLink: 'Ayarlar',
    settingsHint: 'Plan, bildirimler, yardım ve hesap',

    tiles: {
      streak: 'Seri',
      streakValue_one: '{{count}} gün',
      streakValue_other: '{{count}} gün',
      streakA11y_one: 'Seri: {{count}} gündür düzenli çalışıyorsun',
      streakA11y_other: 'Seri: {{count}} gündür düzenli çalışıyorsun',
      streakZero: 'Bugün 10 dakika çalış ya da bir blok bitir, seri başlasın.',
      minutes: 'Bu hafta',
      minutesA11y: 'Bu hafta toplam {{minutes}} dakika çalıştın',
      adherence: 'Plan uyumu',
      adherenceNone: '—',
      adherenceA11y: 'Plan uyumu yüzde {{percent}}',
      adherenceNoneA11y: 'Plan uyumu: bu hafta henüz planlanmış blok yok',
    },

    grid: {
      more: '+{{count}}',
      dayA11y_one: '{{day}}: {{count}} blok tamamlandı',
      dayA11y_other: '{{day}}: {{count}} blok tamamlandı',
      footnote: 'Her dolu baloncuk tamamlanan bir plan bloğu',
    },

    time: {
      title: 'Çalışma süresi',
      weeksTitle: 'Son 4 hafta',
      weekLabel: '{{date}} haftası',
      thisWeek: 'Bu hafta',
      vsLastWeekUp: 'Geçen haftadan {{minutes}} dk fazla',
      vsLastWeekDown: 'Geçen haftadan {{minutes}} dk az',
      vsLastWeekSame: 'Geçen haftayla aynı',
      vsLastWeekNone: 'Geçen hafta kayıt yok',
      weeksA11y: 'Son 4 haftanın çalışma süreleri: {{list}}',
      weekItemA11y: '{{label}} {{minutes}} dakika',
      byCourse: 'Derslere göre (bu hafta)',
      byCourseEmpty: 'Bu hafta henüz çalışma kaydın yok. Zamanlayıcıyı başlattığında ya da oturum eklediğinde burada görünür.',
      noCourse: 'Ders seçilmemiş',
      lastWeek: 'geçen hafta {{minutes}} dk',
      courseA11y: '{{course}}: bu hafta {{minutes}} dakika, geçen hafta {{lastWeek}} dakika',
    },

    plan: {
      title: 'Plan uyumu',
      summary: 'Bu hafta bugüne kadar planlanan {{planned}} bloğun {{done}} tanesini tamamladın.',
      remaining_one: 'Bu hafta {{count}} blok daha var.',
      remaining_other: 'Bu hafta {{count}} blok daha var.',
      empty: 'Bu hafta bugüne kadar planlanmış blok yok.',
      barA11y: 'Plan uyumu: {{planned}} bloğun {{done}} tanesi tamamlandı',
    },

    accuracy: {
      title: 'Doğru oranı',
      intro: 'Son 4 haftada çözdüğün quizlere göre. Yanlışları tekrar çözdüğün denemeler sayılmaz.',
      empty: 'Son 4 haftada çözülmüş quiz yok. Bir belgeden quiz çözdüğünde ders ve konu bazında doğru oranın burada görünür.',
      questions_one: '{{count}} soru',
      questions_other: '{{count}} soru',
      up: '{{points}} puan arttı',
      down: '{{points}} puan düştü',
      same: 'Değişmedi',
      noTrend: 'Değişim için en az 2 haftalık sonuç gerekir',
      a11y: '{{name}}: yüzde {{percent}} doğru, {{questions}}. {{trend}}',
      weeksA11y: 'Haftalık doğru oranları: {{list}}',
      weekNone: 'sonuç yok',
      topicsTitle: 'Konular',
    },
  },
};

export default progress;

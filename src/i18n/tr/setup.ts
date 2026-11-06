/** First-run setup guide, setup checklist, new school year prompt and plan-change notices. */
const setup = {
  setup: {
    title: 'Derslerini seç',
    intro:
      '{{grade}}. sınıfın derslerini senin için işaretledik. Okulunda almadığın dersleri kaldır, sonra devam et.',
    introNoGrade: 'Derslerini Dersler sekmesinden ekleyebilirsin.',
    continue: 'Devam et',
    skip: 'Şimdilik atla',
    selectedCount_one: '{{count}} ders seçili.',
    selectedCount_other: '{{count}} ders seçili.',
    noneSelected: 'Devam etmek için en az bir ders seç ya da şimdilik atla.',
    later: 'Derslerini istediğin zaman Dersler sekmesinden değiştirebilirsin.',
    shortcuts: {
      availability: 'Müsait saatleri ayarla',
      addExam: 'Sınav ekle',
      addHomework: 'Ödev ekle',
      calendarTitle: 'Hızlı ekle',
      examHint: 'Yazılı, quiz, sözlü ya da proje',
      homeworkHint: 'Teslim tarihini unutma',
    },
  },
  checklist: {
    title: 'Planını kur',
    progress: '{{total}} adımdan {{done}} tanesi tamam',
    close: 'Kurulum listesini kapat',
    done: 'Tamam',
    todo: 'Yapılmadı',
    rowA11y: '{{letter}}: {{title}}, {{state}}',
    steps: {
      courses: { title: 'Dersler', hint: 'Okulda aldığın dersleri seç' },
      timetable: { title: 'Ders programı', hint: 'Okul saatlerine çalışma konmasın' },
      availability: { title: 'Müsait saatler', hint: 'Ne zaman çalışabileceğini söyle' },
      exam: { title: 'İlk sınav', hint: 'Yaklaşan bir yazılını ekle' },
      notifications: { title: 'Bildirimler', hint: 'Çalışma saatlerini hatırlatalım' },
    },
  },
  newYear: {
    title: {
      september: 'Yeni eğitim yılı başladı',
      examPassed: 'Sınavın geride kaldı',
    },
    question: '{{grade}}. sınıfa geçtin mi?',
    body: 'Evet dersen planın, hedef sınavın ve önerilen derslerin yeni sınıfına göre ayarlanır.',
    yes: 'Evet, {{grade}}. sınıftayım',
    no: 'Hayır, {{grade}}. sınıftayım',
    archiveTitle: 'Bu dersler {{grade}}. sınıfta yok',
    archiveBody:
      'Arşive aldığın dersler planından çıkar. Sınavları ve kartları silinmez, istersen Dersler sekmesinden geri getirebilirsin.',
    archive_one: '{{count}} dersi arşive al',
    archive_other: '{{count}} dersi arşive al',
    keepAll: 'Hepsi kalsın',
    doneTitle: 'Artık {{grade}}. sınıftasın!',
    doneBody: 'Yeni sınıfının derslerini ekle, planın onlara göre kurulsun.',
    addCourses: 'Yeni derslerimi ekle',
  },
  planChange: {
    title: 'Pro aboneliğin sona erdi',
    body: 'Artık ücretsiz plandasın: her ay {{documents}} belge yükleyebilirsin. Belgelerin, özetlerin ve kartların yerinde duruyor.',
    renew: "Pro'ya yeniden geç",
    dismiss: 'Tamam',
    dismissA11y: 'Bu notu kapat',
  },
};

export default setup;

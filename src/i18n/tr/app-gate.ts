/** Forced update and maintenance screens (remote app config). */
const appGate = {
  appGate: {
    update: {
      greeting: 'Yeni sürüm hazır',
      title: 'Önce uygulamayı güncelle',
      body: 'StudyFlow’un bu sürümü artık çalışmıyor. Devam etmek için yeni sürümü yükle.',
      safe: 'Planın, kartların ve notların yerinde kalır.',
      buttonIos: 'App Store’da güncelle',
      buttonAndroid: 'Google Play’de güncelle',
      openFailed: 'Mağaza açılamadı. Mağazada StudyFlow’u bulup güncelleyebilirsin.',
    },
    maintenance: {
      greeting: 'Biraz bekle',
      title: 'Kısa bir bakım yapıyoruz',
      body: 'StudyFlow’u daha iyi yapmak için çalışıyoruz. Birazdan tekrar açılacak.',
      safe: 'Planın, kartların ve notların güvende.',
      retry: 'Tekrar dene',
      stillOn: 'Bakım hâlâ sürüyor. Biraz sonra tekrar dene.',
      offline: 'İnternete bağlanamadık. Bağlantını kontrol edip tekrar dene.',
    },
    available: {
      title: 'Yeni sürüm hazır',
      body: 'StudyFlow’un yeni sürümü çıktı. Şimdi güncellemek ister misin?',
      later: 'Sonra',
      update: 'Güncelle',
    },
  },
};

export default appGate;

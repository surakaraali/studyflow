/** Settings hub, subscription and paywall, FAQ, support and beta feedback. */
const settings = {
  settings: {
    title: 'Ayarlar',
    account: {
      title: 'Hesap',
      profile: 'Profil',
      profileHint: 'Rumuz, sınıf, uyku saatleri, günlük hedef',
      account: 'Hesap ve silme',
      accountHint: 'E-posta, şifre, hesabı silme',
      dataCopy: 'Verilerimin kopyası',
      dataCopyHint: 'Hazır bir talep gönder, kopyan e-postayla gelsin',
    },
    plan: {
      title: 'Plan',
      current: 'Şu anki planın',
      free: 'Ücretsiz',
      pro: 'Pro',
      freeQuota: 'Ayda 3 belge, belge başına en çok 20 sayfa',
      proQuota: 'Ayda 40 belge, belge başına en çok 100 sayfa',
      upgrade: 'Pro’ya geç',
      manage: 'Aboneliği yönet',
      restore: 'Satın alımları geri yükle',
      testCancel: 'Test aboneliğini bitir',
      testCancelTitle: 'Test aboneliği bitirilsin mi?',
      testCancelBody: 'Planın Ücretsiz’e döner. Bu bir test aboneliğiydi, ödeme alınmadı.',
      testCancelConfirm: 'Bitir',
      manageError:
        'Abonelik ekranı açılamadı. Aboneliğini mağazanın abonelik ayarlarından yönetebilirsin.',
      limited: 'Velin onay verene kadar satın alma kapalı.',
    },
    app: {
      title: 'Uygulama',
      notifications: 'Bildirimler',
      appearance: 'Görünüm',
      aiNotice: 'Yapay zekâ bilgilendirmesi',
      consent: 'Veli onayı',
      consentStatus: {
        not_required: 'Gerekmiyor',
        pending: 'Onay bekleniyor',
        granted: 'Onaylandı',
        revoked: 'Geri alındı',
      },
      legal: 'Yasal metinler',
      legalHint: 'Aydınlatma metni, gizlilik politikası, kullanım koşulları',
    },
    help: {
      title: 'Yardım',
      faq: 'Sık sorulan sorular',
      support: 'Destek',
      supportHint: 'Ekibe yaz, e-postayla cevap verelim',
      feedback: 'Geri bildirim',
      feedbackHint: 'Görüşünü yaz ya da kısa anketi doldur',
      about: 'Hakkında',
    },
    sync: {
      title: 'Eşitleme',
      row: 'Verilerin',
      local: 'Bu cihazda saklanıyor',
      localFooter: 'Geliştirme modundasın: verilerin sunucuya gönderilmez, yalnızca bu cihazda durur.',
      last: 'Son eşitleme: {{time}}',
      never: 'Henüz eşitlenmedi',
      today: 'bugün {{time}}',
      yesterday: 'dün {{time}}',
      pending_one: '{{count}} değişiklik gönderilmeyi bekliyor',
      pending_other: '{{count}} değişiklik gönderilmeyi bekliyor',
      upToDate: 'Bütün değişikliklerin gönderildi',
      state: {
        idle: 'Güncel',
        waiting: 'Bekliyor',
        syncing: 'Eşitleniyor',
        offline: 'Çevrimdışı',
        error: 'Sorun var',
        auth: 'Durdu',
      },
      now: 'Şimdi eşitle',
      offline: 'İnternet gelince değişikliklerin kendiliğinden gönderilir.',
      stuck_one:
        '{{count}} değişiklik sunucuya kabul edilmedi. Bu cihazda saklanıyor; sorun sürerse Destek’ten bize yaz.',
      stuck_other:
        '{{count}} değişiklik sunucuya kabul edilmedi. Bu cihazda saklanıyor; sorun sürerse Destek’ten bize yaz.',
      auth: 'Oturumun yenilenemediği için eşitleme durdu. Çıkış yapıp tekrar giriş yap; bekleyen değişikliklerin silinmez.',
    },
    appearance: {
      title: 'Görünüm',
      intro: 'Uygulamanın açık mı koyu mu görüneceğini seç. Seçimin bu cihazda saklanır.',
      label: 'Tema',
      options: {
        system: 'Sistem',
        light: 'Açık',
        dark: 'Koyu',
      },
      systemHint: 'Telefonunun ayarına uyar. Şu an: {{current}}.',
      fixedHint: 'Telefonunun ayarı ne olursa olsun bu tema kullanılır.',
    },
    about: {
      title: 'Hakkında',
      tagline: 'Dersler, sınavlar ve ödevler için çalışma planlayıcın.',
      version: 'Sürüm',
      build: 'Derleme',
      data: 'Verilerin',
      dataLocal: 'Yalnızca bu cihazda',
      dataServer: 'Cihazda ve sunucuda',
      legalTitle: 'Yasal metinler',
      contact: 'Bize yaz',
      licensesTitle: 'Açık kaynak lisanslar',
      licensesFooter:
        'StudyFlow bu açık kaynak yazılımlarla yapıldı. Her birinin lisans metni kendi paketinde yer alır. Emeği geçen herkese teşekkürler!',
    },
    signOut: 'Çıkış yap',
    signOutTitle: 'Çıkış yapılsın mı?',
    signOutBody: 'Verilerin silinmez. Aynı hesapla giriş yapınca kaldığın yerden devam edersin.',
    version: 'Sürüm {{version}} ({{build}})',
    dev: {
      title: 'Geliştirme modu',
      body: 'Uygulama bir sunucuya bağlı değil. Hesabın ve verilerin yalnızca bu cihazda tutulur, yapay zekâ işleri geliştirme sunucusunda çalışır. Satın almalar test içindir, ücret alınmaz.',
      reports: 'İçerik bildirimleri',
      reportsHint: 'Ekip inceleme sırası',
    },
  },

  paywall: {
    title: 'StudyFlow Pro',
    intro:
      'Pro ile ayda daha çok belge yükler, daha uzun belgelerle çalışırsın. Plan, quiz, kartlar ve zamanlayıcı iki planda da var.',
    close: 'Kapat',
    compare: {
      title: 'Planları karşılaştır',
      feature: 'Özellik',
      free: 'Ücretsiz',
      pro: 'Pro',
      documents: 'Aylık belge hakkı',
      pages: 'Belge başına en çok sayfa',
      ai: 'Belgeden özet, quiz ve kart',
      plan: 'Akıllı çalışma planı',
      review: 'Kartlarla aralıklı tekrar',
      tracking: 'Zamanlayıcı, seri ve ilerleme',
      noAds: 'Reklamsız',
      included: 'Var',
      rowA11y: '{{feature}}: ücretsiz planda {{free}}, Pro planda {{pro}}',
      quotaNote:
        'Belge hakkı her ayın 1’inde yenilenir. İşlenemeyen belgeler hakkından düşülmez.',
    },
    packages: {
      title: 'Dönem seç',
      monthly: 'Aylık',
      annual: 'Yıllık',
      other: 'Pro',
      perMonth: '{{price}} / ay',
      perYear: '{{price}} / yıl',
      loading: 'Fiyatlar yükleniyor',
      loadError:
        'Fiyatlar şu an yüklenemedi. İnternet bağlantını kontrol edip tekrar dene. Fiyat, ödeme öncesinde mağazanın ekranında da gösterilir.',
      unavailable: 'Satın alma şu an kullanılamıyor. Daha sonra tekrar dene.',
    },
    test: {
      title: 'Test satın alma',
      body: 'Geliştirme modundasın. Gerçek ödeme alınmaz, yalnızca hesabının planı Pro’ya geçer.',
      price: 'Test, ücret alınmaz',
    },
    buy: 'Pro’ya geç',
    restore: 'Satın alımları geri yükle',
    renewalIos:
      'Abonelik, dönem bitmeden en az 24 saat önce iptal edilmezse aynı süre ve fiyatla kendiliğinden yenilenir. Ödeme, satın almayı onayladığında Apple hesabından alınır.',
    cancelIos:
      'İptal etmek için iPhone’da Ayarlar > adın > Abonelikler bölümüne git. İptal edersen Pro, dönemin sonuna kadar açık kalır. Uygulamayı silmek aboneliği iptal etmez.',
    renewalAndroid:
      'Abonelik, dönem bitmeden iptal edilmezse aynı süre ve fiyatla kendiliğinden yenilenir. Ödeme, satın almayı onayladığında Google Play hesabından alınır.',
    cancelAndroid:
      'İptal etmek için Google Play’de Ödemeler ve abonelikler > Abonelikler bölümüne git. İptal edersen Pro, dönemin sonuna kadar açık kalır. Uygulamayı silmek aboneliği iptal etmez.',
    underAge:
      '18 yaşından küçük olduğun için ödeme ekranı açılmadan önce velinin kısa bir soruyu cevaplaması gerekir. Mağazanın aile onayı (Satın Almak İçin Sor) da ayrıca geçerlidir.',
    limited: {
      title: 'Satın alma şimdilik kapalı',
      body: 'Velin onay verene kadar satın alma yapılamaz. Onay gelince bu ekrandan Pro’ya geçebilirsin.',
      action: 'Veli onayına git',
    },
    current: {
      title: 'Pro planındasın',
      body: 'Ayda 40 belge, belge başına en çok 100 sayfa hakkın var.',
      manage: 'Aboneliği yönet',
    },
    success: {
      title: 'Pro planındasın',
      body: 'Teşekkürler! Yeni belge hakların hemen geçerli.',
    },
    pending:
      'Ödeme onay bekliyor. Velin mağazada onaylayınca Pro planın kendiliğinden açılır.',
    errors: {
      cancelled: 'Satın almayı iptal ettin. Ücret alınmadı.',
      pending: 'Ödeme onay bekliyor. Onaylanınca Pro planın kendiliğinden açılır.',
      not_allowed:
        'Bu cihazda satın alma kapalı. Ekran Süresi gibi bir kısıtlama açık olabilir.',
      network: 'İnternet bağlantısı yok. Bağlanınca tekrar dene.',
      unavailable: 'Satın alma şu an kullanılamıyor. Daha sonra tekrar dene.',
      unknown: 'Satın alma tamamlanamadı. Tekrar dene, sorun sürerse Destek’ten bize yaz.',
    },
    restoreDone: 'Pro aboneliğin geri yüklendi.',
    restoreNone: 'Bu hesapta geri yüklenecek bir abonelik bulunamadı.',
    legal: {
      terms: 'Kullanım koşulları',
      privacy: 'Gizlilik politikası',
    },
  },

  faq: {
    title: 'Sık sorulan sorular',
    intro: 'Aradığın cevap burada yoksa Destek’ten bize yaz.',
    contact: 'Destek’e yaz',
    expandHint: 'Cevabı açar ya da kapatır',
    items: {
      plan: {
        q: 'Çalışma planım nasıl oluşuyor?',
        a: 'Derslerine, sınav tarihlerine, ödevlerine ve müsait saatlerine bakarak önümüzdeki 14 gün için çalışma blokları hazırlıyoruz. Sınavı yaklaşan ve doğru oranı düşük konular daha sık gelir. Okul saatlerine ve uyku saatlerine blok konmaz, günlük çalışma süresi de yaşına uygun bir sınırı geçmez.',
      },
      missed: {
        q: 'Bir bloğu kaçırırsam ne olur?',
        a: 'Kaçırdığın blok, günlük sınırı aşmadan sonraki 3 güne dağıtılır. Sığmazsa sana planı güncellemeni öneririz; blok silinmez.',
      },
      streak: {
        q: 'Seri nasıl sayılıyor?',
        a: 'Bir günde en az bir plan bloğunu tamamlarsan ya da en az 10 dakika çalışma kaydedersen o gün serine sayılır. Haftada bir gün “dondurma” hakkın var; o gün çalışamasan da serin bozulmaz.',
      },
      ai: {
        q: 'Yapay zekâ belgemle ne yapıyor?',
        a: 'Yüklediğin PDF’ten özet, quiz ve kart hazırlar. Yapay zekâya yalnızca belgenin içeriği, sınıf seviyen ve ders adı gider; adın, e-postan, okulun ya da doğum yılın gönderilmez. Hazırlanan her içerikte “Yapay zekâ ile üretildi” etiketi bulunur.',
      },
      aiWrong: {
        q: 'Yapay zekâ yanlış bir şey yazarsa?',
        a: 'Yapay zekâ hata yapabilir; her soru ve kartta kaynak sayfa yazar, kontrol edebilirsin. Yanlış ya da uygunsuz bir içeriği “Bildir” ile işaretle: senden hemen gizlenir ve ekibimiz inceler. İçeriği kendin de düzenleyebilirsin.',
      },
      quota: {
        q: 'Ayda kaç belge yükleyebilirim?',
        a: 'Ücretsiz planda ayda 3 belge, belge başına en çok 20 sayfa; Pro planda ayda 40 belge, belge başına en çok 100 sayfa. Hakkın her ayın 1’inde yenilenir, işlenemeyen belgeler hakkından düşülmez. Yalnızca en çok 25 MB’lık PDF dosyaları yüklenebilir.',
      },
      consent: {
        q: 'Neden veli onayı gerekiyor?',
        a: '18 yaşından küçük kullanıcıların verileri için velinin onayı gerekir. Onay gelene kadar 13–17 yaş arasında dersler, plan ve kartlar çalışır; yapay zekâ ve satın alma kapalıdır. 13 yaşından küçüksen onay gelene kadar uygulama açılmaz. Onay bağlantısı 7 gün geçerlidir, gerekirse yeniden gönderebilirsin.',
      },
      offline: {
        q: 'İnternet olmadan kullanabilir miyim?',
        a: 'Evet. Planın, kartların, zamanlayıcı ve çalışma kayıtların internetsiz de çalışır; değişiklikler bağlantı gelince eşitlenir. Belgeden özet, quiz ve kart hazırlamak için internet gerekir.',
      },
      notifications: {
        q: 'Bildirimler ne zaman gelir?',
        a: 'Plan bloğun başlarken, sınavına 7, 3 ve 1 gün kala, ödev tesliminden 1 gün önce ve belgen hazır olunca. Gece saatlerinde bildirim gönderilmez. Hangi bildirimleri alacağını Ayarlar > Bildirimler’den seçebilirsin. 18 yaşından küçüksen bildirimler, velin onay verirken bildirimlere de izin verdiyse açılır.',
      },
      subscription: {
        q: 'Pro aboneliğimi nasıl iptal ederim?',
        a: 'Aboneliği mağaza yönetir. iPhone’da Ayarlar > adın > Abonelikler bölümünden iptal edebilirsin. İptal edersen Pro, ödediğin dönemin sonuna kadar açık kalır. Uygulamayı silmek aboneliği iptal etmez.',
      },
      restore: {
        q: 'Pro’yu yeni telefonumda nasıl açarım?',
        a: 'Aynı hesapla giriş yap; Pro kendiliğinden açılır. Açılmazsa Ayarlar > Satın alımları geri yükle’ye dokun.',
      },
      deleteAccount: {
        q: 'Hesabımı nasıl silerim?',
        a: 'Ayarlar > Hesap ve silme bölümünden hesabını silebilirsin. Belgelerin hemen, diğer kişisel verilerin en geç 30 gün içinde silinir. Veli onayı ve ödeme kayıtları yasal süre boyunca saklanır. Aboneliğin varsa önce mağazadan iptal etmeyi unutma.',
      },
    },
  },

  support: {
    title: 'Destek',
    intro: 'Yaşadığın sorunu ya da merak ettiğin şeyi kısaca yaz. Ekibimiz e-postayla cevap verir.',
    email: 'Cevap için e-posta adresin',
    emailHint: 'Bu formda istediğimiz tek kişisel bilgi bu.',
    emailError: 'Geçerli bir e-posta adresi yaz, örneğin ad@ornek.com.',
    topic: 'Konu',
    topics: {
      account: 'Hesap',
      subscription: 'Abonelik',
      ai: 'Yapay zekâ',
      plan: 'Plan',
      bug: 'Hata',
      other: 'Diğer',
    },
    topicError: 'Bir konu seç.',
    message: 'Mesajın',
    messageHint: 'Şifreni, belge içeriğini ya da başka kişisel bilgileri yazma.',
    messageError: 'Mesajın en az {{min}} karakter olsun.',
    auto: 'Mesajına kendiliğinden eklenir: uygulama sürümü {{version}}, {{os}}.',
    send: 'Gönder',
    sentTitle: 'Mesajın alındı',
    sentBody: 'Ekibimiz {{email}} adresine e-postayla cevap verecek.',
    sentQueued: 'Şu an sunucuya ulaşılamadı. Mesajın kaydedildi, bağlantı gelince gönderilecek.',
    sentLocal: 'Geliştirme modundasın: mesaj yalnızca bu cihaza kaydedildi.',
    back: 'Ayarlara dön',
    error: 'Mesajın kaydedilemedi. Tekrar dene.',
    dataCopy: {
      title: 'Verilerimin kopyası',
      intro:
        'Hesabındaki verilerin bir kopyasını istemek için bu talebi gönder. Kopyan en geç 30 gün içinde, indirilebilir bir dosya olarak e-posta adresine gelir.',
      message:
        'Merhaba, hesabımdaki verilerin bir kopyasını istiyorum. Kopyayı bu e-posta adresine gönderebilir misiniz? Teşekkürler.',
      sentBody: 'Talebin alındı. Verilerinin kopyası en geç 30 gün içinde {{email}} adresine gelecek.',
    },
  },

  feedback: {
    title: 'Geri bildirim',
    intro:
      'Beta sürümünü denediğin için teşekkürler. Görüşlerin uygulamayı daha iyi yapmamıza yardım eder.',
    modes: {
      text: 'Görüş yaz',
      sus: 'Kısa anket',
    },
    textLabel: 'Ne iyi gitti, seni ne zorladı?',
    textHint: 'Kişisel bilgi ya da belge içeriği yazma.',
    textError: 'En az {{min}} karakter yaz.',
    send: 'Gönder',
    sentTitle: 'Teşekkürler',
    sentBody: 'Görüşün kaydedildi. Ekip her hafta beta görüşlerini okuyor.',
    again: 'Bir görüş daha yaz',
    back: 'Ayarlara dön',
    error: 'Kaydedilemedi. Tekrar dene.',
  },

  sus: {
    title: 'Kullanım kolaylığı anketi',
    intro:
      'Her cümleye ne kadar katıldığını seç: 1 kesinlikle katılmıyorum, 5 kesinlikle katılıyorum demek. 10 cümle, yaklaşık 2 dakika.',
    scale: {
      s1: 'Kesinlikle katılmıyorum',
      s2: 'Katılmıyorum',
      s3: 'Kararsızım',
      s4: 'Katılıyorum',
      s5: 'Kesinlikle katılıyorum',
    },
    optionA11y: '{{value}}: {{label}}',
    itemLabel: '{{number}}. {{text}}',
    progress: '10 cümleden {{answered}} tanesi cevaplandı',
    missing: 'Göndermek için 10 cümlenin hepsini cevapla.',
    send: 'Anketi gönder',
    sentTitle: 'Teşekkürler',
    sentBody: 'Anketin kaydedildi.',
    items: {
      q1: 'Bu uygulamayı sık sık kullanmak isterim.',
      q2: 'Uygulamayı gereksiz yere karmaşık buldum.',
      q3: 'Uygulamanın kullanımı kolaydı.',
      q4: 'Bu uygulamayı kullanabilmek için teknik bilgisi olan birinin yardımına ihtiyaç duyarım.',
      q5: 'Uygulamanın farklı bölümleri birbiriyle iyi uyum içinde.',
      q6: 'Uygulamada çok fazla tutarsızlık var.',
      q7: 'Çoğu kişinin bu uygulamayı çok çabuk öğreneceğini düşünüyorum.',
      q8: 'Uygulamayı kullanmak çok zahmetliydi.',
      q9: 'Uygulamayı kullanırken kendime güvendim.',
      q10: 'Bu uygulamayı kullanmaya başlamadan önce birçok şey öğrenmem gerekti.',
    },
  },
};

export default settings;

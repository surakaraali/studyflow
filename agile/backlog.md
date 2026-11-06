# StudyFlow — Ürün Backlog'u

| Alan | Değer |
|---|---|
| Doküman | Ürün backlog'u (epic → kullanıcı hikâyesi → kabul kriterleri) |
| Sürüm | 0.1 (taslak) |
| Tarih | 3 Kasım 2026 |
| Hazırlayan | İş Analisti, Tech Lead ile birlikte tahminlendi |
| İlgili | [01_brd.md](../analysis/01_brd.md) · [02_nfr.md](../analysis/02_nfr.md) · [Proje planı](project_plan.md) |

## 1. Okuma rehberi

- **Hikâye kalıbı:** "Bir _[rol]_ olarak _[ihtiyaç]_ istiyorum, böylece _[fayda]_."
- **Tahmin:** Fibonacci hikâye puanı (SP: 1, 2, 3, 5, 8, 13). 13 SP'lik hikâye sprint planlamada bölünmek zorundadır.
- **Öncelik:** BRD'deki MoSCoW değeri. Must hikâyeler R1'e sprint bazında atanmıştır; Should/Could hikâyeler kapasite oldukça sprintlere çekilir, kalanlar **R1.1** (Nisan–Mayıs 2027) ile çıkar.
- **Kabul kriterleri:** Karmaşık hikâyelerde Gherkin (Türkçe anahtar kelimeler: _Senaryo, Diyelim ki, Eğer ki, O zaman, Ve_), diğerlerinde kontrol listesi.
- **Hazır olma (DoR) ve bitti (DoD) tanımları:** [Proje planı §9](project_plan.md#9-hazır-olma-ve-bitti-tanımları).
- **Kimlikler:** E = epic · US = kullanıcı hikâyesi · SP-xx = spike (araştırma). FR/BR/NFR kimlikleri BRD ve NFR dokümanlarındandır.

## 2. Epic özeti

| Epic | Ad | Sürüm | Hikâye | Must SP | Should/Could SP |
|---|---|---|---|---|---|
| E01 | Temel altyapı (teknik) | R1 | US-01–US-07 | 34 | 3 |
| E02 | Hesap ve onboarding | R1 | US-08–US-14 | 21 | 5 |
| E03 | Veli onayı ve rıza | R1 | US-15–US-20 | 21 | — |
| E04 | Dersler ve ders programı | R1 | US-21–US-25 | 13 | 5 |
| E05 | Sınavlar ve ödevler | R1 | US-26–US-30 | 12 | 2 |
| E06 | Belge işleme ve yapay zekâ | R1 | US-31–US-40, SP-01, SP-02 | 45 | 5 |
| E07 | Quiz | R1 | US-41–US-43 | 8 | 2 |
| E08 | Flashcard ve tekrar | R1 | US-44–US-46 | 11 | — |
| E09 | Akıllı plan | R1 | US-47–US-53 | 26 | 9 |
| E10 | Çalışma takibi ve ilerleme | R1 | US-54–US-59 | 15 | 5 |
| E11 | Bildirimler | R1 | US-60–US-62 | 9 | — |
| E12 | Abonelik | R1 | US-63–US-65 | 11 | 1 |
| E13 | Destek ve yayın hazırlığı | R1 | US-66–US-70 | 20 | — |
| E19 | İlk kullanım yolculuğu | R1 eki | US-71–US-80 | 14 | 14 |
| **R1 toplam** | | | **70 + 2 spike** | **246** | **37** |
| E14 | Android ve R1.1 iyileştirmeleri | R2a | §5 | — | — |
| E15 | Deneme sınavı takibi | R2a | §5 | — | — |
| E16 | İlkokul modu ve veli paneli | R2b | §5 | — | — |
| E17 | Aile paketi ve oyunlaştırma | R2b | §5 | — | — |
| E18 | Öğretmen ve yapay zekâ sohbeti | R3 | §5 | — | — |

## 3. Sprint ataması (R1, yalnızca Must)

| Sprint | Tarih | Hedef | Hikâyeler | SP |
|---|---|---|---|---|
| S0 | 9–27 Kas 2026 | Keşif, tasarım, altyapı, model değerlendirmesi | US-01, US-02, US-03, SP-01 | 18 |
| S1 | 30 Kas–11 Ara | Veri modeli ve giriş | US-04, US-08, US-09, US-11, US-15 | 24 |
| S2 | 14–25 Ara | Veli onayı, dersler, ders programı | US-16, US-17, US-20, US-21, US-22, US-23, SP-02 | 30 |
| S3 | 28 Ara–8 Oca | Sınavlar, belge yükleme, işleme hattı | US-06, US-26, US-27, US-31, US-32 | 24 |
| S4 | 11–22 Oca | Yapay zekâ üretimi, quiz, çevrimdışı katman | US-05, US-18, US-33, US-34, US-35, US-36, US-41, US-42, US-62 | 33 |
| S5 | 25 Oca–5 Şub | Plan motoru, flashcard, içerik bildirme | US-37, US-44, US-45, US-46, US-47, US-48 | 32 |
| S6 | 8–19 Şub | Bugün ekranı, takip, bildirimler | US-28, US-29, US-49, US-50, US-54, US-55, US-56, US-60, US-61 | 34 |
| S7 | 22 Şub–5 Mar | İlerleme, kota, abonelik, hesap silme, beta | US-12, US-13, US-19, US-38, US-57, US-63, US-64, US-70 | 34 |
| S8 | 8–19 Mar | Sertleştirme, erişilebilirlik, güvenlik, mağaza | US-66, US-67, US-68, US-69 | 17 |
| | | | **Toplam** | **246** |

> S3'te yılbaşı, S8'de Ramazan Bayramı nedeniyle kapasite düşük planlandı. Ayrıntılı takvim ve
> kapasite hesabı [proje planı §5](project_plan.md#5-sprint-planı)'tedir.

## 4. Kullanıcı hikâyeleri (R1)

### E01 · Temel altyapı (teknik)

#### US-01 · Uygulama iskeleti ve tasarım sistemi
Bir **geliştirici** olarak hazır bir iskelet ve tasarım sistemi istiyorum, böylece ekranları tutarlı ve hızlı geliştirebilirim.
`Must · 3 SP · S0 · NFR: MAIN-01, MAIN-05, L10N-01, COMP-04`
- [ ] Expo SDK 58 + TypeScript strict + expo-router; beş sekme (Bugün, Takvim, Dersler, Çalış, İlerleme).
- [ ] Renk, yazı ve boşluk belirteçleri açık/koyu tema için tanımlı; metinler i18n dosyalarında.
- [ ] Temel bileşenler (metin, düğme, ekran, boş durum) ve optik baloncuk bileşeni hazır.
- [ ] iOS simülatöründe beş sekme iki temada hatasız açılıyor.

#### US-02 · Sürekli entegrasyon ve derleme profilleri
Bir **geliştirici** olarak her PR'da otomatik kontrol istiyorum, böylece hatalar ana dala girmez.
`Must · 5 SP · S0 · NFR: MAIN-01, SEC-07`
- [ ] PR'da lint, tip kontrolü, birim testler ve bağımlılık taraması çalışır; biri başarısızsa birleştirme engellenir.
- [ ] EAS derleme profilleri: `development`, `preview` (iç test), `production`.
- [ ] `main` dalına birleşen her değişiklik `preview` kanalına derlenir.
- [ ] İlk geliştirme derlemesinde BUG-01 yeniden test edilir (§9).

#### US-03 · Ortamlar ve veritabanı süreci
Bir **geliştirici** olarak ayrı geliştirme, test ve üretim ortamları istiyorum, böylece gerçek kullanıcı verisine dokunmadan çalışabilirim.
`Must · 5 SP · S0 · NFR: MAIN-03, SEC-03, SEC-09`
- [ ] Supabase'te `dev`, `staging`, `prod` projeleri (AB bölgesi); erişimler iki adımlı doğrulamalı.
- [ ] Migration'lar sürüm kontrolünde; CI `staging`'e otomatik, `prod`'a onayla uygular.
- [ ] RLS testleri için altyapı (yetkisiz kullanıcıyla okuma/yazma denemeleri) hazır.

#### US-04 · Veri modeli v1
Bir **geliştirici** olarak R1 veri modelini istiyorum, böylece özellikler aynı şemaya dayanır.
`Must · 8 SP · S1 · BRD §10 · NFR: SEC-03, PRIV-01, PRIV-06`
- [ ] PLAN.md §4'teki tablolar ve rıza kayıtları migration ile oluşturulur.
- [ ] Her tabloda RLS açık ve testleri yeşil.
- [ ] Rıza ve tekrar kayıtları yalnızca eklemeye açık (güncelleme/silme engelli).

#### US-05 · Çevrimdışı veri katmanı
Bir **öğrenci** olarak internet yokken de plana ve kartlara erişmek istiyorum, böylece yolda ya da evde bağlantı sorununda çalışmam aksamaz.
`Must · 8 SP · S4 · NFR: OFF-01, OFF-03, REL-05`
```gherkin
Senaryo: Çevrimdışı kayıtların eşitlenmesi
  Diyelim ki cihaz çevrimdışı
  Ve 12 kart tekrar ettim ve 1 oturum kaydettim
  Eğer ki bağlantı geri gelirse
  O zaman 30 saniye içinde eşitleme başlar
  Ve sunucuda 12 tekrar kaydı ve 1 oturum bulunur
  Ve hiçbir kayıt çift oluşmaz
```

#### US-06 · Hata izleme ve ürün analitiği
Bir **ürün ekibi** olarak çökmeleri ve temel kullanım verisini görmek istiyorum, böylece sorunları ve KPI'ları takip edebilirim.
`Must · 5 SP · S3 · NFR: OBS-01, OBS-04, PRIV-04, PRIV-05 · Açık soru: Q-04`
- [ ] Çökme raporları kişisel veri ve cihaz kimliği olmadan gönderilir.
- [ ] Olay sözlüğü yazılı; her olay bir KPI'ya bağlı (G-01–G-05).
- [ ] Reklam kimliği toplanmaz; ATT izni istenmez.

#### US-07 · Özellik anahtarları ve zorunlu güncelleme
Bir **ürün ekibi** olarak bir özelliği uzaktan kapatabilmek istiyorum, böylece sorunlu bir özelliği mağaza sürümü beklemeden durdurabilirim.
`Should · 3 SP · R1.1 · FR-ADM-04`
- [ ] Özellik anahtarları uygulama açılışında okunur, önbelleğe alınır.
- [ ] En düşük desteklenen sürümün altındaki uygulamada güncelleme ekranı gösterilir.

### E02 · Hesap ve onboarding

#### US-08 · E-posta ile kayıt ve giriş
Bir **öğrenci** olarak e-posta adresimle kayıt olmak istiyorum, böylece Apple veya Google hesabım olmadan da uygulamayı kullanabilirim.
`Must · 5 SP · S1 · FR-ACC-01`
```gherkin
Senaryo: Başarılı kayıt
  Diyelim ki kayıt ekranındayım
  Eğer ki geçerli bir e-posta ve en az 8 karakterli bir şifre girersem
  O zaman doğrulama e-postası gönderilir
  Ve "E-postanı doğrula" ekranını görürüm

Senaryo: Kayıtlı e-posta
  Diyelim ki bu e-posta ile daha önce kayıt olunmuş
  Eğer ki aynı e-posta ile kayıt olmaya çalışırsam
  O zaman "Bu e-posta ile hesap var. Giriş yap ya da şifreni sıfırla." mesajını görürüm
```
- [ ] Şifre sıfırlama e-postası gönderilebilir.

#### US-09 · Apple ile giriş
Bir **öğrenci** olarak Apple hesabımla tek dokunuşla giriş yapmak istiyorum, böylece şifre hatırlamak zorunda kalmam.
`Must · 3 SP · S1 · FR-ACC-02`
- [ ] "E-postamı gizle" seçeneğiyle gelen adres desteklenir.
- [ ] İlk girişte onboarding'e, sonraki girişlerde Bugün ekranına yönlendirilir.

#### US-10 · Google ile giriş
`Should · 3 SP · R1.1 · FR-ACC-03` — Bir **öğrenci** olarak Google hesabımla giriş yapmak istiyorum.
- [ ] Apple ile girişle aynı akış ve yönlendirme kuralları geçerlidir.

#### US-11 · Onboarding: sınıf, doğum yılı, hedef sınav
Bir **öğrenci** olarak sınıfımı ve hedef sınavımı söylemek istiyorum, böylece uygulama bana uygun dersleri ve kuralları kullanır.
`Must · 5 SP · S1 · FR-ACC-04 · BR-01`
```gherkin
Senaryo: Lise öğrencisi onboarding'i
  Diyelim ki ilk kez giriş yaptım
  Eğer ki sınıf olarak 12'yi ve doğum yılı olarak 2009'u seçersem
  O zaman segmentim "lise" olarak kaydedilir
  Ve hedef sınav adımında YKS önerilir
  Ve 18 yaş altında olduğum için veli e-postası adımına geçerim

Senaryo: İlkokul seçimi (R1'de desteklenmez)
  Diyelim ki sınıf olarak 3'ü seçtim
  O zaman ilkokul sürümünün yakında geleceği söylenir
  Ve velinin e-postası "haber ver" listesi için istenir
```

#### US-12 · Profil ve tercihler
`Must · 3 SP · S7 · FR-ACC-05` — Bir **öğrenci** olarak rumuzumu, sınıfımı, uyku saatlerimi ve günlük hedefimi değiştirmek istiyorum.
- [ ] Sınıf değişirse segment ve varsayılan kurallar (BR-07, BR-08, BR-12) yeniden uygulanır.
- [ ] Uyku saati değişikliği planı yeniden üretir.

#### US-13 · Hesap silme
Bir **kullanıcı** olarak hesabımı uygulamadan silmek istiyorum, böylece verilerimin kalmadığından emin olurum.
`Must · 5 SP · S7 · FR-ACC-06 · BR-18 · NFR: PRIV-07, STORE-03`
```gherkin
Senaryo: Hesabın silinmesi
  Diyelim ki Ayarlar > Hesap ekranındayım
  Eğer ki "Hesabı sil"e dokunur ve onay kutusuna "SİL" yazarsam
  O zaman oturumum kapanır
  Ve belgelerim depodan hemen silinir
  Ve diğer verilerim en geç 30 gün içinde silinir
  Ve silme tamamlanınca e-posta alırım
```
- [ ] Aktif abonelik varsa iptalin mağazadan yapılacağı ve nasıl yapılacağı gösterilir.
- [ ] Aynı işlem web sayfasındaki formdan da başlatılabilir.

#### US-14 · Veri kopyası talebi
`Should · 2 SP · R1.1 · FR-ACC-07` — Bir **kullanıcı** olarak verilerimin bir kopyasını istemek istiyorum.
- [ ] Talep kaydı oluşur; kopya 30 gün içinde e-postayla, indirilebilir dosya olarak iletilir.

### E03 · Veli onayı ve rıza

#### US-15 · Yaş kontrolü ve veli e-postası
`Must · 3 SP · S1 · FR-CON-01` — Bir **18 yaş altı öğrenci** olarak velimin e-postasını girmek istiyorum, böylece onay süreci başlar.
- [ ] Yaş doğum yılından hesaplanır; 18 yaş altında veli e-postası zorunludur.
- [ ] Öğrencinin kendi e-postası veli e-postası olarak girilemez.

#### US-16 · Veli onay sayfası ve rıza kaydı
Bir **veli** olarak çocuğumun hesabını ne için onayladığımı anlamak ve onaylamak istiyorum, böylece verilerinin nasıl kullanıldığını bilirim.
`Must · 8 SP · S2 · FR-CON-02, FR-CON-04 · BR-04, BR-05 · NFR: PRIV-06, PRIV-09`
```gherkin
Senaryo: Velinin onay vermesi
  Diyelim ki veli onay e-postasındaki bağlantıyı açtı
  Ve bağlantı 7 günden eski değil
  Eğer ki veli aydınlatma metnini görüp "Yapay zekâ ile içerik üretimi" ve "Bildirimler" için onay verirse
  O zaman rıza kaydı veli e-postası, zaman, metin sürümü ve onaylanan amaçlarla saklanır
  Ve öğrencinin hesabı tam moda geçer
  Ve öğrenciye "Velin onayladı" bildirimi gelir

Senaryo: Süresi dolmuş bağlantı
  Diyelim ki bağlantı 7 günden eski
  Eğer ki veli bağlantıyı açarsa
  O zaman "Bu bağlantının süresi doldu" mesajını ve öğrenciden yeni bağlantı istemesi gerektiğini görür

Senaryo: Rızanın geri alınması
  Diyelim ki veli daha önce onay verdi
  Eğer ki veli e-postadaki "Onayımı geri al" bağlantısını kullanırsa
  O zaman yeni bir rıza kaydı eklenir
  Ve öğrencinin yapay zekâ özellikleri kapanır
```

#### US-17 · Onay beklerken kısıtlı mod
Bir **öğrenci** olarak velim onaylayana kadar neleri kullanabileceğimi bilmek istiyorum, böylece beklerken de başlayabilirim.
`Must · 5 SP · S2 · FR-CON-03 · BR-02, BR-03, BR-04`
- [ ] 13–17 yaş: ders, plan ve kart açık; yapay zekâ ve satın alma kapalı ve nedeni yazıyor.
- [ ] 13 yaş altı: yalnızca karşılama ve onay ekranları.
- [ ] "Bağlantıyı yeniden gönder" en çok günde 3 kez kullanılabilir.
- [ ] 30 gün içinde onaylanmayan 13 yaş altı hesap silinir; 7. ve 25. günde hatırlatma gönderilir.

#### US-18 · Yapay zekâ bilgilendirme ekranı
`Must · 2 SP · S4 · FR-CON-05 · BR-05, BR-06` — Bir **öğrenci** olarak belgemin nereye gönderildiğini bilmek istiyorum.
- [ ] İlk yapay zekâ kullanımında gösterilir: belge içeriği gönderilir, kişisel bilgi gönderilmez, içerik hatalı olabilir.
- [ ] Onay verilmeden yükleme yapılamaz; ekran Ayarlar'dan yeniden açılabilir.

#### US-19 · Veli kapısı
`Must · 2 SP · S7 · FR-CON-06 · BR-19` — Bir **veli** olarak satın alma ve dış bağlantıların çocuğun tek başına geçemeyeceği bir adımla korunmasını istiyorum.
- [ ] Rastgele bir yetişkin sorusu (ör. yazıyla verilen iki basamaklı çarpma) doğru cevaplanmadan devam edilemez.
- [ ] 3 yanlış denemede 1 dakika bekleme.

#### US-20 · Yasal metinler
`Must · 1 SP · S2 · FR-CON-07` — Bir **kullanıcı** olarak aydınlatma metni, gizlilik politikası ve kullanım koşullarını uygulama içinden okumak istiyorum.
- [ ] Metinler sürüm numarası ve tarihle gösterilir; uygulama dışına çıkmadan okunur.

### E04 · Dersler ve ders programı

#### US-21 · Sınıfa göre ders önerisi
Bir **öğrenci** olarak sınıfımın derslerini listeden seçmek istiyorum, böylece hepsini tek tek yazmam gerekmez.
`Must · 5 SP · S2 · FR-CRS-01`
- [ ] 5–12. sınıflar için MEB haftalık ders çizelgesindeki dersler listelenir (veri eğitim danışmanınca onaylanır).
- [ ] Lise 11–12'de alan derslerine göre filtre (sayısal, eşit ağırlık, sözel, dil).
- [ ] Seçilen her derse otomatik renk atanır; renkler birbirinden ayırt edilebilir.

#### US-22 · Özel ders, düzenleme ve arşiv
`Must · 3 SP · S2 · FR-CRS-02, FR-CRS-06` — Bir **öğrenci** olarak listede olmayan bir dersi eklemek, derslerimi düzenlemek ve arşivlemek istiyorum.
- [ ] Ad zorunlu (en çok 40 karakter), renk seçilebilir.
- [ ] Arşivlenen ders plana girmez ama geçmiş verisi İlerleme'de kalır.
- [ ] Silme, bağlı sınav/ödev/belge sayısını göstererek onay ister.

#### US-23 · Haftalık okul ders programı
Bir **öğrenci** olarak okul ders programımı girmek istiyorum, böylece plan okul saatlerime blok koymaz.
`Must · 5 SP · S2 · FR-CRS-03 · BR-09`
```gherkin
Senaryo: Okul saatlerinin plana kapanması
  Diyelim ki pazartesi 08:30–15:10 arasını okul ders programına girdim
  Eğer ki plan üretilirse
  O zaman pazartesi 08:30–15:10 arasında hiçbir çalışma bloğu bulunmaz
```
- [ ] Gün, başlangıç-bitiş saati ve ders seçilerek satır eklenir; bir günü diğer günlere kopyalama vardır.

#### US-24 · Dış etkinlikler
`Should · 2 SP · R1.1 · FR-CRS-04` — Bir **öğrenci** olarak dershane, kurs ve spor gibi tekrarlayan etkinliklerimi eklemek istiyorum.
- [ ] Etkinlik saatleri plana kapalıdır.

#### US-25 · Konu listesi ve şablon
`Should · 3 SP · R1.1 · FR-CRS-05` — Bir **öğrenci** olarak her dersin konularını listelemek istiyorum.
- [ ] Sınıf ve derse göre konu şablonu önerilir; konular elle eklenip sıralanabilir.

### E05 · Sınavlar ve ödevler

#### US-26 · Okul sınavı ekleme
Bir **öğrenci** olarak yazılı tarihlerimi ve konularını eklemek istiyorum, böylece plan sınava göre ayarlanır.
`Must · 3 SP · S3 · FR-EXM-01`
- [ ] Ders, tarih, saat (isteğe bağlı), tür ve konular girilir; geçmiş tarih girilemez.
- [ ] Sınav eklenince plan yeniden üretilir.

#### US-27 · Hedef sınav ve resmi tarihler
`Must · 3 SP · S3 · FR-EXM-02, FR-ADM-05` — Bir **8. sınıf veya lise öğrencisi** olarak LGS/YKS'yi hedef sınav olarak seçmek istiyorum.
- [ ] LGS yalnızca 8. sınıfta, YKS oturumları 11–12. sınıfta önerilir.
- [ ] Resmi tarih ekip tarafından yönetim tablosundan güncellenir; değişince kullanıcıya bildirilir.

#### US-28 · Bugün ekranında sınavlar ve ödevler
`Must · 3 SP · S6 · FR-EXM-03` — Bir **öğrenci** olarak yaklaşan sınavlarımı ve bugünkü ödevlerimi açılışta görmek istiyorum.
- [ ] En yakın 3 sınav geri sayımla ("3 gün kaldı") gösterilir; 7 günden yakın olanlar sınav rengiyle vurgulanır.
- [ ] Bugün ve yarın teslim edilecek ödevler listelenir.

#### US-29 · Ödev takibi
`Must · 3 SP · S6 · FR-EXM-04` — Bir **öğrenci** olarak ödevlerimi ve teslim tarihlerini tutmak istiyorum.
- [ ] Ödev ders, açıklama ve teslim tarihiyle eklenir; tamamlandı olarak işaretlenir.
- [ ] Ödev plana "ödev bloğu" olarak girer (FR-PL-03).

#### US-30 · Sınav sonucu
`Should · 2 SP · R1.1 · FR-EXM-05` — Bir **öğrenci** olarak sınav notumu girmek istiyorum, böylece ilerlememde görebilirim.

### E06 · Belge işleme ve yapay zekâ

#### SP-01 · Spike: Model seçimi ve değerlendirme seti
Ekip olarak hangi modelin hangi işte yeterli olduğunu ölçmek istiyoruz, böylece kalite ve maliyet dengesini veriyle kurarız.
`Must · 5 SP · S0 · NFR: AIQ-01, AIQ-07 · Varsayım: A-04`
- [ ] Her segment ve ana ders için gerçek belgelerden oluşan ilk değerlendirme seti (en az 30 belge) ve puanlama ölçütü.
- [ ] Opus, Sonnet ve Haiku sınıfı modeller için doğruluk, yaşa uygunluk, süre ve maliyet tablosu.
- [ ] Karar ADR olarak yazılır (hangi iş hangi modelde).

#### SP-02 · Spike: Uygunsuz içerik denetimi
`Must · 3 SP · S2 · NFR: AIQ-04` — Ekip olarak girdi ve çıktıyı denetleme yaklaşımını seçmek istiyoruz.
- [ ] Seçenekler (model içi talimat, ayrı sınıflandırma çağrısı, kelime listesi) karşılaştırılır; karar ADR'ye yazılır.

#### US-31 · PDF yükleme
Bir **öğrenci** olarak ders notumu PDF olarak yüklemek istiyorum, böylece ondan soru ve kart üretebilirim.
`Must · 5 SP · S3 · FR-AI-01, FR-AI-02 · BR-14, BR-15`
```gherkin
Senaryo: Sınır aşan belge
  Diyelim ki ücretsiz plandayım
  Eğer ki 48 sayfalık bir PDF seçersem
  O zaman en çok 20 sayfa seçebileceğim söylenir
  Ve sayfa aralığı seçicisi açılır

Senaryo: Şifreli PDF
  Eğer ki şifreli bir PDF seçersem
  O zaman "Bu PDF şifreli. Şifresini kaldırıp tekrar yükle." mesajını görürüm
```
- [ ] Dosyalar, iCloud Drive ve paylaşım menüsünden yükleme; yükleme ilerlemesi görünür.
- [ ] Belge bir derse (zorunlu) ve konuya (isteğe bağlı) bağlanır.

#### US-32 · Belge işleme hattı
Bir **öğrenci** olarak belgem işlenirken uygulamayı kullanmaya devam etmek istiyorum, böylece beklemek zorunda kalmam.
`Must · 8 SP · S3 · FR-AI-03 · NFR: PERF-05, REL-03, REL-06, PRIV-02`
- [ ] Yükleme sonrası iş kuyruğa alınır; durum: sırada → işleniyor → hazır / hata.
- [ ] Hata durumunda 3 otomatik yeniden deneme; kalıcı hatada sade mesaj ve kota iadesi.
- [ ] İsteklerde kişisel veri olmadığını doğrulayan otomatik test.
- [ ] Aynı belgeden yapılan özet, quiz ve kart istekleri önbellekten (prompt caching) yararlanır.

#### US-33 · Özet üretimi
`Must · 3 SP · S4 · FR-AI-04 · BR-06, BR-21` — Bir **öğrenci** olarak belgemin özetini okumak istiyorum.
- [ ] Başlıklı, kısa paragraflı, anahtar kavramları vurgulanmış özet; kaynak sayfalar belirtilir.
- [ ] "Yapay zekâ ile üretildi, hata içerebilir" etiketi görünür.

#### US-34 · Quiz üretimi
Bir **öğrenci** olarak notlarımdan quiz üretmek istiyorum, böylece konuyu ne kadar bildiğimi görürüm.
`Must · 5 SP · S4 · FR-AI-05 · BR-12, BR-21 · NFR: AIQ-02, AIQ-03`
```gherkin
Senaryo: Ortaokul öğrencisi için quiz
  Diyelim ki 8. sınıftayım ve Fen Bilimleri belgem işlendi
  Eğer ki 10 soruluk quiz istersem
  O zaman 10 soru üretilir
  Ve her soruda 4 şık ve tam bir doğru cevap bulunur
  Ve her sorunun açıklaması ve kaynak sayfası vardır
```

#### US-35 · Flashcard üretimi
`Must · 3 SP · S4 · FR-AI-06` — Bir **öğrenci** olarak belgemden kart üretmek istiyorum.
- [ ] Ön yüz soru/kavram, arka yüz kısa cevap; kaynak sayfa; derse ait desteye eklenir.

#### US-36 · Üretilen içeriği düzenleme
`Must · 3 SP · S4 · FR-AI-07` — Bir **öğrenci** olarak üretilen soruları ve kartları düzeltmek veya silmek istiyorum.
- [ ] Soru metni, şıklar, doğru cevap ve açıklama düzenlenebilir; düzenlenen öğe "düzenlendi" olarak işaretlenir.

#### US-37 · İçerik bildirme ve inceleme
Bir **öğrenci** olarak yanlış ya da uygunsuz bir soruyu bildirmek istiyorum, böylece bir daha karşıma çıkmaz ve düzeltilir.
`Must · 5 SP · S5 · FR-AI-08, FR-ADM-02 · BR-23 · NFR: AIQ-06`
- [ ] Bildirim nedeni seçilir (yanlış cevap, anlaşılmıyor, uygunsuz); öğe bildirenden hemen gizlenir.
- [ ] Ekip iç ekrandan inceler: kaldır / düzelt / geçerli; karar kaydedilir.
- [ ] Aynı belgede 3'ten fazla bildirim belgeyi incelemeye alır.

#### US-38 · Kota, kullanım ve maliyet takibi
`Must · 5 SP · S7 · FR-AI-09, FR-ADM-03 · BR-14 · NFR: AIQ-07, OBS-02` — Bir **öğrenci** olarak kalan hakkımı, **ekip** olarak kullanıcı başına maliyeti görmek istiyoruz.
- [ ] Çalış ekranında "Bu ay 2/3 belge" göstergesi; kota dolunca Pro önerisi.
- [ ] Her iş için token, süre ve maliyet kaydı; aylık bütçe %80'de uyarı.

#### US-39 · Taranmış PDF
`Should · 2 SP · R1.1 · FR-AI-10` — Bir **öğrenci** olarak taranmış notlarımı da işlemek istiyorum.

#### US-40 · Konu çıkarma
`Should · 3 SP · R1.1 · FR-AI-11` — Bir **öğrenci** olarak belgedeki konuların derse eklenmesini istiyorum.

### E07 · Quiz

#### US-41 · Quiz çözme
Bir **öğrenci** olarak soruları tek tek çözüp hemen geri bildirim almak istiyorum, böylece hatamı o anda öğrenirim.
`Must · 5 SP · S4 · FR-QZ-01 · NFR: ACC-02, ACC-05`
```gherkin
Senaryo: Yanlış cevap
  Diyelim ki quizin 3. sorusundayım
  Eğer ki yanlış şıkkı seçip "Kontrol et"e dokunursam
  O zaman seçtiğim şık yanlış olarak, doğru şık doğru olarak ikon ve metinle işaretlenir
  Ve açıklama ve kaynak sayfa gösterilir
  Ve "Sonraki soru" düğmesi etkinleşir
```
- [ ] Quiz yarıda bırakılırsa kaldığı yerden devam edilir.

#### US-42 · Sonuç ve yanlışları tekrar
`Must · 3 SP · S4 · FR-QZ-02, FR-QZ-03` — Bir **öğrenci** olarak quiz sonucumu görmek ve yalnızca yanlışlarımı yeniden çözmek istiyorum.
- [ ] Doğru, yanlış, boş, süre ve konu bazında sonuç; "Yanlışları tekrar çöz" düğmesi.
- [ ] Sonuç ilerleme verisine (FR-AN-02) yazılır.

#### US-43 · Yanlıştan kart önerisi
`Should · 2 SP · R1.1 · FR-QZ-04` — Bir **öğrenci** olarak yanlış yaptığım sorulardan kart oluşturmak istiyorum.

### E08 · Flashcard ve tekrar

#### US-44 · Desteler ve elle kart
`Must · 3 SP · S5 · FR-FC-01` — Bir **öğrenci** olarak kartlarımı derslere göre destelerde görmek ve kendi kartlarımı eklemek istiyorum.
- [ ] Deste listesinde kart sayısı ve bugün tekrar edilecek kart sayısı görünür.

#### US-45 · Aralıklı tekrar oturumu
Bir **öğrenci** olarak kartlarımı doğru zamanda tekrar etmek istiyorum, böylece bilgiyi uzun süre hatırlarım.
`Must · 5 SP · S5 · FR-FC-02, FR-FC-05 · BR-22 · NFR: PERF-04`
```gherkin
Senaryo: Kartın değerlendirilmesi
  Diyelim ki bugün tekrar edilecek 15 kartım var
  Eğer ki bir kartı çevirip "İyi"yi seçersem
  O zaman kartın sonraki tekrar tarihi FSRS ile hesaplanır ve kaydedilir
  Ve sıradaki kart 100 ms içinde gösterilir

Senaryo: Günlük yeni kart sınırı
  Diyelim ki lise öğrencisiyim ve bugün 30 yeni kart gördüm
  O zaman bugün başka yeni kart gösterilmez
  Ve yalnızca tekrarı gelen kartlar gösterilir
```

#### US-46 · Çevrimdışı tekrar
`Must · 3 SP · S5 · FR-FC-04 · Bağımlılık: US-05` — Bir **öğrenci** olarak internet yokken kart tekrarı yapmak istiyorum.
- [ ] Tekrar kayıtları cihazda tutulur ve bağlantı gelince eşitlenir (US-05 senaryosu).

### E09 · Akıllı plan

#### US-47 · Müsaitlik
`Must · 3 SP · S5 · FR-PL-01 · BR-09` — Bir **öğrenci** olarak hangi saatlerde çalışabileceğimi söylemek istiyorum.
- [ ] Hafta içi ve hafta sonu için ayrı saat aralıkları; uyku saati varsayılanı segmentten gelir.

#### US-48 · Plan motoru v1
Bir **öğrenci** olarak sınavlarıma ve boş saatlerime göre günlük çalışma planımın kendiliğinden çıkmasını istiyorum, böylece ne çalışacağımı düşünmekle vakit kaybetmem.
`Must · 13 SP · S5 · FR-PL-02, FR-PL-03 · BR-07–BR-11 · NFR: PERF-07, MAIN-02`
> 13 SP: sprint planlamada "kural motoru + testler" ve "plan üretimi + ekrana bağlama" olarak ikiye bölünecek.
```gherkin
Senaryo: Yaklaşan sınav önceliği
  Diyelim ki 11. sınıftayım ve 4 gün sonra Fizik yazılım var
  Ve 20 gün sonra Kimya yazılım var
  Eğer ki plan üretilirse
  O zaman önümüzdeki 3 günde Fizik blokları Kimya bloklarından fazladır
  Ve sınavdan önceki gün yalnızca Fizik tekrar blokları bulunur
  Ve sınav gününe Fizik bloğu konmaz

Senaryo: Günlük üst sınır
  Diyelim ki ortaokul öğrencisiyim
  Eğer ki plan üretilirse
  O zaman hiçbir hafta içi günün toplam blok süresi 150 dakikayı geçmez
  Ve her blok 25 dakika çalışma ve 5 dakika moladan oluşur
```
- [ ] Plan 14 günü kapsar; ders, sınav, ödev ya da müsaitlik değişince yeniden üretilir.
- [ ] Kural motorunun birim test kapsamı ≥ %80.

#### US-49 · Bloğu tamamla, atla, ertele
Bir **öğrenci** olarak bir bloğu kaçırdığımda planın kendini düzeltmesini istiyorum, böylece her şeyi baştan planlamam gerekmez.
`Must · 5 SP · S6 · FR-PL-04 · BR-10`
```gherkin
Senaryo: Kaçırılan blokların dağıtılması
  Diyelim ki salı günkü 3 bloğu tamamlamadım
  Eğer ki çarşamba sabahı uygulamayı açarsam
  O zaman bu 3 blok günlük üst sınırı aşmadan çarşamba–cuma arasına dağıtılmıştır

Senaryo: Sığmayan bloklar
  Diyelim ki kaçırılan bloklar sonraki 3 güne sığmıyor
  O zaman "Planın sıkıştı. Müsait saat ekle ya da bazı blokları kaldır." uyarısını görürüm
  Ve hiçbir blok kendiliğinden silinmez
```

#### US-50 · Bugün planı ve haftalık takvim
Bir **öğrenci** olarak bugünkü bloklarımı ve haftamı bir bakışta görmek istiyorum.
`Must · 5 SP · S6 · FR-PL-08, FR-FC-03`
- [ ] Bugün ekranında bloklar optik form baloncuklarıyla gösterilir; tamamlanan blok baloncuğu dolar.
- [ ] Bugün tekrar edilecek kart sayısı görünür.
- [ ] Takvim sekmesinde haftalık görünüm; bugün fosforlu kalem vurgusuyla işaretli; güne dokununca o günün blokları açılır.

#### US-51 · Plan açıklamaları
`Should · 3 SP · R1.1 · FR-PL-05` — Bir **öğrenci** olarak planın neden değiştiğini kısa bir cümleyle görmek istiyorum.

#### US-52 · Elle blok ekleme ve taşıma
`Should · 3 SP · R1.1 · FR-PL-06` — Bir **öğrenci** olarak kendi bloğumu eklemek ve bir bloğu başka güne taşımak istiyorum.

#### US-53 · Performansa göre ağırlık
`Should · 3 SP · R1.1 · FR-PL-07` — Bir **öğrenci** olarak zayıf olduğum konuların plana daha sık girmesini istiyorum.

### E10 · Çalışma takibi ve ilerleme

#### US-54 · Odak zamanlayıcı
Bir **öğrenci** olarak bloğumu zamanlayıcıyla çalışmak istiyorum, böylece ne kadar çalıştığımı ölçerim.
`Must · 5 SP · S6 · FR-TR-01 · NFR: PERF-09, USE-08`
- [ ] Süre blok uzunluğundan gelir; duraklat/devam; bitince mola bildirimi.
- [ ] Uygulama arka plandayken süre doğru işler; ekran kilitliyken kalan süre görünür.
- [ ] Bitince oturum kaydı oluşur ve blok tamamlanır.

#### US-55 · Oturum kaydı
`Must · 2 SP · S6 · FR-TR-02` — Bir **öğrenci** olarak zamanlayıcı kullanmadan yaptığım çalışmayı elle eklemek istiyorum.
- [ ] Ders, konu (isteğe bağlı), süre (5–240 dk) ve tarih girilir.

#### US-56 · Seri ve günlük hedef
`Must · 3 SP · S6 · FR-TR-03 · BR-17` — Bir **öğrenci** olarak kaç gündür düzenli çalıştığımı görmek istiyorum.
- [ ] Gün sayılma kuralı ve haftalık 1 dondurma hakkı uygulanır; günlük hedef ilerlemesi Bugün ekranında.

#### US-57 · İlerleme ekranı
Bir **öğrenci** olarak haftalık çalışma süremi, doğru oranımı ve plana ne kadar uyduğumu görmek istiyorum.
`Must · 5 SP · S7 · FR-AN-01, FR-AN-02, FR-AN-03 · NFR: ACC-05`
- [ ] Ders bazında haftalık süre; ders/konu bazında doğru oranı ve son 4 haftadaki değişimi; tamamlanan/planlanan blok oranı.
- [ ] Haftalık görünüm optik form ızgarasıyla (gün başına satır, blok başına baloncuk).
- [ ] Veri yokken boş durum ve "Çalışmaya başla" eylemi.

#### US-58 · Zayıf konular
`Should · 2 SP · R1.1 · FR-AN-04` — Bir **öğrenci** olarak doğru oranı en düşük konularımı görmek istiyorum.

#### US-59 · Veliye haftalık e-posta özeti
`Should · 3 SP · R1.1 · FR-AN-06 · BR-24` — Bir **veli** olarak çocuğumun haftasını kısa bir e-postayla görmek istiyorum.
- [ ] Toplam süre, tamamlanan blok oranı ve seri; belge içeriği ve cevaplar yer almaz.

### E11 · Bildirimler

#### US-60 · Bildirim altyapısı ve tercihler
Bir **öğrenci** olarak hangi bildirimleri alacağımı seçmek istiyorum, böylece gereksiz bildirimle rahatsız olmam.
`Must · 5 SP · S6 · FR-NT-05 · BR-16`
```gherkin
Senaryo: Sessiz saatler
  Diyelim ki 12 yaşındayım
  Ve bir plan bloğum 20:45'te başlıyor
  O zaman bu blok için bildirim gönderilmez
```
- [ ] Bildirim izni, değer anlatıldıktan sonra (ilk plan oluşunca) istenir.
- [ ] Türlere göre aç/kapa: plan, sınav, ödev, yapay zekâ.

#### US-61 · Plan, sınav ve ödev hatırlatmaları
`Must · 3 SP · S6 · FR-NT-01, FR-NT-02, FR-NT-04` — Bir **öğrenci** olarak bloklarımı, sınavlarımı ve ödevlerimi zamanında hatırlamak istiyorum.
- [ ] Blok başında; sınava 7, 3 ve 1 gün kala; ödev tesliminden 1 gün önce. Plan değişince eski bildirimler iptal edilir.

#### US-62 · Yapay zekâ işi bildirimi
`Must · 1 SP · S4 · FR-NT-03` — Bir **öğrenci** olarak belgem hazır olunca ya da işlenemezse haber almak istiyorum.
- [ ] Bildirime dokununca ilgili belge ekranı açılır.

### E12 · Abonelik

#### US-63 · Plan karşılaştırma ekranı
`Must · 3 SP · S7 · FR-SUB-01 · NFR: STORE-04, USE-08` — Bir **öğrenci veya veli** olarak ücretsiz ve Pro planın farkını açıkça görmek istiyorum.
- [ ] Fiyat, dönem, otomatik yenileme ve iptal bilgisi; geri yükleme düğmesi; kapatma düğmesi her zaman görünür.

#### US-64 · Satın alma, veli kapısı ve geri yükleme
Bir **veli** olarak çocuğum adına Pro aboneliği güvenle almak istiyorum.
`Must · 8 SP · S7 · FR-SUB-02, FR-SUB-03 · BR-19 · Bağımlılık: US-19`
```gherkin
Senaryo: 18 yaş altında satın alma
  Diyelim ki 15 yaşında bir öğrencinin hesabıyım
  Eğer ki "Pro'ya geç"e dokunursam
  O zaman önce veli kapısı açılır
  Ve doğru cevaplanırsa mağazanın ödeme ekranı açılır

Senaryo: Aboneliğin başka cihazda görünmesi
  Diyelim ki iPhone'da Pro aldım
  Eğer ki aynı hesapla başka bir cihazda giriş yaparsam
  O zaman Pro özellikleri açık olur
```
- [ ] Abonelik durumu mağaza sunucu bildirimleriyle güncellenir; iptal ve yenileme yansır.

#### US-65 · Ücretsiz deneme
`Could · 1 SP · R1.1 · FR-SUB-05` — Bir **kullanıcı** olarak Pro'yu 7 gün ücretsiz denemek istiyorum.

### E13 · Destek ve yayın hazırlığı

#### US-66 · SSS ve destek formu
`Must · 2 SP · S8 · FR-ADM-01` — Bir **kullanıcı** olarak sık sorulan soruları okumak ve ekibe yazmak istiyorum.
- [ ] Destek formunda kişisel veri olarak yalnızca yanıt için e-posta istenir; uygulama sürümü otomatik eklenir.

#### US-67 · Erişilebilirlik geçişi
`Must · 5 SP · S8 · NFR: ACC-01–ACC-05, USE-03` — Bir **görme veya motor güçlüğü olan öğrenci** olarak uygulamayı rahatça kullanmak istiyorum.
- [ ] Ana akışlar VoiceOver ile baştan sona test edilir; bulgular kapatılır.
- [ ] En büyük yazı boyutunda ekranlar bozulmaz; kontrast ölçümleri raporlanır.

#### US-68 · Güvenlik ve gizlilik incelemesi
`Must · 5 SP · S8 · NFR: SEC-08, PRIV-01–PRIV-08, SEC-02` — **Ekip** olarak yayın öncesi güvenlik ve gizlilik kontrollerini tamamlamak istiyoruz.
- [ ] OWASP MASVS L1 kontrol listesi; paket içinde gizli anahtar taraması; RLS testleri; SDK veri listesi.
- [ ] Hukuk danışmanı metinleri ve akışları onaylar.

#### US-69 · Mağaza hazırlığı
`Must · 5 SP · S8 · NFR: STORE-01–STORE-04` — **Ekip** olarak App Store gönderimine hazır olmak istiyoruz.
- [ ] Uygulama adı, alt başlık, açıklama, anahtar kelimeler, ekran görüntüleri (6,9" ve 6,1"), gizlilik etiketi, yaş derecelendirmesi.
- [ ] İnceleme notu: deneme hesabı, veli onayı akışının nasıl test edileceği, yapay zekâ kullanımı açıklaması.

#### US-70 · Beta programı
`Must · 3 SP · S7` — **Ekip** olarak gerçek öğrencilerle beta yapmak istiyoruz, böylece yayından önce sorunları buluruz.
- [ ] TestFlight dış test grubu (hedef 40 öğrenci, 15 veli), veli onaylı katılım.
- [ ] Uygulama içi geri bildirim, SUS anketi, haftalık beta raporu.

### E19 · İlk kullanım yolculuğu (R1 eki)

> 5 Kasım 2026: yeni bir öğrencinin uygulamayı indirdiği andan itibaren izlediği yol baştan sona
> denetlendi; bulunan boşluklar aşağıdaki hikâyelere dönüştürüldü.

#### US-71 · E-posta bağlantısıyla uygulamaya dönüş ve yeni şifre
Bir **öğrenci** olarak e-postadaki doğrulama ya da şifre sıfırlama bağlantısına dokunduğumda uygulamada doğru ekrana gelmek istiyorum, böylece şifremi unutsam da hesabıma dönebilirim.
`Must · 3 SP · FR-ACC-01`
- [x] `studyflow://auth/callback` kodu oturuma çevirir; doğrulamada "E-postan doğrulandı" görünür.
- [x] Sıfırlama bağlantısı "Yeni şifre belirle" ekranını açar (en az 8 karakter); kaydedince Bugün'e geçilir.
- [x] Süresi dolmuş ya da geçersiz bağlantıda açıklama ve "Yeni bağlantı iste" gösterilir; bilinmeyen bağlantılar için "bulunamadı" ekranı vardır.

#### US-72 · Şifre ve e-posta değiştirme
Bir **öğrenci** olarak şifremi ve e-posta adresimi Ayarlar'dan değiştirmek istiyorum, böylece hesabımı güvende tutarım.
`Should · 3 SP · FR-ACC-05 · NFR: STORE-03`
- [x] Şifre değişimi mevcut şifreyi ister; yeni e-posta doğrulanana kadar eski adres geçerli kalır.
- [x] Apple ile girişte bu satırlar gizlenir; hesap silinirken Apple belirteci iptal edilir.

#### US-73 · Yarım kalan onboarding'e devam
Bir **öğrenci** olarak uygulama kapansa da onboarding'e kaldığım yerden devam etmek istiyorum, böylece cevapları baştan girmem.
`Should · 2 SP · FR-ACC-04`
- [x] Cevaplar her adımda cihaza, kullanıcıya bağlı kaydedilir; yeniden açılışta ilk cevaplanmamış adıma gidilir.
- [x] Çıkış yapınca taslak silinir. 9–10. sınıfa isteğe bağlı YKS hedefi önerilir.

#### US-74 · İlk gün kurulum rehberi
Bir **öğrenci** olarak onboarding biter bitmez derslerimi seçmek ve planım için gerekenleri sırayla tamamlamak istiyorum, böylece boş bir ekranla kalmam.
`Must · 5 SP · FR-CRS-01, FR-PL-01`
- [x] Onboarding sonunda sınıfa göre önerilen dersler çoklu seçimle sunulur (atlanabilir).
- [x] Bugün'de "Dersler · Ders programı · Müsait saatler · İlk sınav · Bildirimler" kontrol listesi kartı vardır; tamamlanan adım işaretlenir, kart kapatılabilir.
- [x] Bugün ve Takvim'de müsait saat, ödev ve sınav ekleme kısayolları bulunur.

#### US-75 · Yanlış doğum yılını düzeltme ve kilitli ekrandan çıkış
Bir **öğrenci** olarak yanlış girdiğim doğum yılını düzeltmek ya da hesabımı silmek istiyorum, böylece yanlışlıkla kilitli kalmam.
`Must · 3 SP · BR-02, BR-03`
- [x] Doğum yılı bir kez düzeltilebilir; erişim düzeyi yeniden hesaplanır ve düzeltme kayda geçer.
- [x] Kilitli ekranda "Doğum yılım yanlış" ve "Hesabı sil" seçenekleri vardır.
- [x] 18 yaşına giren öğrencide onay durumu açılışta "gerekmiyor" olur.
- [x] Veli onayı bekleyen hesap kendini 18 yaş ve üstüne düzeltemez (yaş kapısı); bu durumda destek adresi gösterilir. Kural hem uygulamada hem sunucu tetikleyicisinde (`protect_profile`) uygulanır.

#### US-76 · Veli onayına uyan bildirimler
Bir **veli** olarak bildirim onayı vermediysem çocuğuma bildirim gitmemesini istiyorum, böylece verdiğim karar geçerli olur.
`Must · 3 SP · FR-CON-02, FR-NT-05 · BR-04`
- [x] Bildirim amacı onaylanmadıysa ya da onay bekleniyorsa anahtarlar kapalıdır ve nedeni yazar; hatırlatmalar zamanlanmaz, izin kartı gösterilmez.
- [x] Yerel modda 7. ve 25. gün onay hatırlatmaları yerel bildirimle gönderilir.

#### US-77 · Oturum ve eşitleme durumu
Bir **öğrenci** olarak oturumum başka cihazda kapandığında ya da verilerim eşitlenemediğinde bunu bilmek istiyorum, böylece çalışmalarım kaybolmaz.
`Should · 3 SP · NFR: OFF-03, REL-05`
- [x] Yenilenemeyen oturumda kullanıcı karşılama ekranına "Oturumun sona erdi" notuyla döner; bekleyen değişiklikler korunur.
- [x] Ayarlar'da son eşitleme zamanı ve bekleyen değişiklik sayısı görünür.

#### US-78 · Yeni eğitim yılına geçiş
Bir **öğrenci** olarak yeni okul yılında sınıfımı kolayca güncellemek istiyorum, böylece plan ve sınavlar yeni sınıfıma uyar.
`Should · 3 SP · BR-01`
- [x] Eylül'de ya da hedef sınav geçtikten sonra "X. sınıfa geçtin mi?" sorulur.
- [x] Onaylanırsa segment kuralları, hedef sınav ve önerilen dersler güncellenir; eski dersler arşive alınabilir.

#### US-79 · Pro bitiş bildirimi
`Could · 1 SP · FR-SUB-02` — Bir **öğrenci** olarak aboneliğim bittiğinde bunu görmek istiyorum, böylece kotamın neden düştüğünü anlarım.
- [x] Pro'dan ücretsize geçişte bir kez bilgi bandı ve yenileme bağlantısı gösterilir.

#### US-80 · Görünüm, veri kopyası ve hakkında
`Could · 2 SP · FR-ACC-07` — Bir **öğrenci** olarak tema seçmek, verilerimin kopyasını istemek ve uygulama bilgisini görmek istiyorum.
- [x] Görünüm: Sistem, Açık ya da Koyu. "Verilerimin kopyası" hazır destek talebi oluşturur (US-14). Hakkında ekranında sürüm ve lisanslar yer alır.

## 5. R2 ve R3 epic'leri (özellik düzeyi)

Bu epic'ler R1 sırasında ayrıntılandırılacak. Büyüklükler tişört ölçüsüyle tahminlenmiştir
(S ≈ 1 sprintten az, M ≈ 1 sprint, L ≈ 2 sprint, XL ≈ 3+ sprint).

| Epic | Özellik | Gereksinim | Büyüklük |
|---|---|---|---|
| E14 Android ve R1.1 | Android derlemesi, cihaz matrisi testi, Play Console, Veri güvenliği formu, 14 günlük kapalı test | COMP-02 | L |
| | R1.1: R1'de kalan Should/Could hikâyeler (§6) | — | L |
| | Fotoğraftan not okuma | FR-AI-12 | M |
| | Sınıf atlama önerisi | FR-ACC-08 | S |
| E15 Deneme sınavı | Deneme sonucu girişi, net hesabı, trend grafiği | FR-EXM-06, BR-13 | M |
| | Süreli sınav modu | FR-QZ-05 | M |
| | Sınava hazırlık göstergesi | FR-AN-05 | M |
| E16 İlkokul ve veli | Veli hesabı ve çocuk profilleri | FR-ACC-09 | L |
| | İlkokul arayüzü (büyük dokunma alanları, sesli yönerge, sade akış) | USE-03 | XL |
| | Uygulama içi veli paneli | FR-AN-06 | L |
| E17 Aile ve oyunlaştırma | Aile paketi | FR-SUB-04 | M |
| | Rozetler ve oyunlaştırma | FR-TR-04 | M |
| E18 Öğretmen ve sohbet | Öğretmen hesabı, sınıf, belge atama | — | XL |
| | Yapay zekâ ile soru-cevap (moderasyonlu) | FR-AI-13 | XL |
| | Takvim senkronu, widget, iPad düzeni | COMP-03 | L |

## 6. R1.1 adayları (Should / Could)

| Hikâye | SP | Not |
|---|---|---|
| US-07 Özellik anahtarları | 3 | Beta'da ihtiyaç doğarsa S8'e çekilir |
| US-10 Google ile giriş | 3 | Android öncesi gerekli (R2a) |
| US-14 Veri kopyası talebi | 2 | R1'de e-postayla elle karşılanır |
| US-24 Dış etkinlikler | 2 | |
| US-25 Konu şablonu | 3 | Eğitim danışmanı verisine bağlı |
| US-30 Sınav sonucu | 2 | |
| US-39 Taranmış PDF | 2 | SP-01 sonucuna göre maliyeti netleşir |
| US-40 Konu çıkarma | 3 | |
| US-43 Yanlıştan kart | 2 | |
| US-51 Plan açıklamaları | 3 | |
| US-52 Elle blok | 3 | Beta geri bildirimine göre öne alınabilir |
| US-53 Performans ağırlığı | 3 | |
| US-58 Zayıf konular | 2 | |
| US-59 Veliye haftalık özet | 3 | Veli onay oranını artırabilir; öne alınmaya aday |
| US-65 Ücretsiz deneme | 1 | Fiyat kararına (Q-05) bağlı |
| **Toplam** | **37** | |

## 7. İzlenebilirlik matrisi (FR → hikâye)

| Modül | Eşleme |
|---|---|
| ACC | FR-ACC-01 → US-08 · FR-ACC-02 → US-09 · FR-ACC-03 → US-10 · FR-ACC-04 → US-11 · FR-ACC-05 → US-12 · FR-ACC-06 → US-13 · FR-ACC-07 → US-14 · FR-ACC-08 → E14 · FR-ACC-09 → E16 |
| CON | FR-CON-01 → US-15 · FR-CON-02 → US-16 · FR-CON-03 → US-17 · FR-CON-04 → US-16 · FR-CON-05 → US-18 · FR-CON-06 → US-19 · FR-CON-07 → US-20 |
| CRS | FR-CRS-01 → US-21 · FR-CRS-02 → US-22 · FR-CRS-03 → US-23 · FR-CRS-04 → US-24 · FR-CRS-05 → US-25 · FR-CRS-06 → US-22 |
| EXM | FR-EXM-01 → US-26 · FR-EXM-02 → US-27 · FR-EXM-03 → US-28 · FR-EXM-04 → US-29 · FR-EXM-05 → US-30 · FR-EXM-06 → E15 · FR-EXM-07 → (Won't) |
| AI | FR-AI-01 → US-31 · FR-AI-02 → US-31 · FR-AI-03 → US-32 · FR-AI-04 → US-33 · FR-AI-05 → US-34 · FR-AI-06 → US-35 · FR-AI-07 → US-36 · FR-AI-08 → US-37 · FR-AI-09 → US-38 · FR-AI-10 → US-39 · FR-AI-11 → US-40 · FR-AI-12 → E14 · FR-AI-13 → E18 |
| QZ | FR-QZ-01 → US-41 · FR-QZ-02 → US-42 · FR-QZ-03 → US-42 · FR-QZ-04 → US-43 · FR-QZ-05 → E15 |
| FC | FR-FC-01 → US-44 · FR-FC-02 → US-45 · FR-FC-03 → US-50 · FR-FC-04 → US-46 · FR-FC-05 → US-45 |
| PL | FR-PL-01 → US-47 · FR-PL-02 → US-48 · FR-PL-03 → US-48 · FR-PL-04 → US-49 · FR-PL-05 → US-51 · FR-PL-06 → US-52 · FR-PL-07 → US-53 · FR-PL-08 → US-50 |
| TR | FR-TR-01 → US-54 · FR-TR-02 → US-55 · FR-TR-03 → US-56 · FR-TR-04 → E17 |
| AN | FR-AN-01 → US-57 · FR-AN-02 → US-57 · FR-AN-03 → US-57 · FR-AN-04 → US-58 · FR-AN-05 → E15 · FR-AN-06 → US-59, E16 |
| NT | FR-NT-01 → US-61 · FR-NT-02 → US-61 · FR-NT-03 → US-62 · FR-NT-04 → US-61 · FR-NT-05 → US-60 |
| SUB | FR-SUB-01 → US-63 · FR-SUB-02 → US-64 · FR-SUB-03 → US-64 · FR-SUB-04 → E17 · FR-SUB-05 → US-65 |
| ADM | FR-ADM-01 → US-66 · FR-ADM-02 → US-37 · FR-ADM-03 → US-38 · FR-ADM-04 → US-07 · FR-ADM-05 → US-27 |

Her iş kuralı (BR-01–BR-25) en az bir hikâyenin kabul kriterinde ya da referansında yer alır;
kontrol için bkz. §8.

## 8. İş kuralı kapsamı

| Kural | Hikâye |
|---|---|
| BR-01 | US-11, US-12 |
| BR-02, BR-03 | US-17 |
| BR-04 | US-16, US-17 |
| BR-05 | US-16, US-18, US-32 |
| BR-06 | US-18, US-33 |
| BR-07, BR-08 | US-48, US-12 |
| BR-09 | US-23, US-47 |
| BR-10 | US-49 |
| BR-11 | US-48 |
| BR-12 | US-34, US-12 |
| BR-13 | E15 |
| BR-14 | US-31, US-38, US-32 |
| BR-15 | US-31 |
| BR-16 | US-60 |
| BR-17 | US-56 |
| BR-18 | US-13 |
| BR-19 | US-19, US-64 |
| BR-20 | US-04 (RLS) |
| BR-21 | US-33, US-34 |
| BR-22 | US-45 |
| BR-23 | US-37 |
| BR-24 | US-59 |
| BR-25 | US-13 (silme altyapısı), US-68 |

## 9. Bilinen hatalar

#### BUG-01 · İlk açılışta sekme adları kesik görünüyor
`Orta · Görsel · Bulunduğu yer: US-01 iskeleti · Tarih: 3 Kasım 2026`
- **Ortam:** Expo Go, iPhone 17 Pro simülatörü, iOS 26.0, Expo SDK 58, react-native-screens 4.30.1.
- **Adımlar:** Uygulamayı kapatıp yeniden aç; alttaki sekme çubuğuna bak.
- **Beklenen:** Bugün, Takvim, Dersler, Çalış, İlerleme adları tam görünür.
- **Gerçekleşen:** Adlar "Bug…", "Tak…", "Der…", "Ilerl…" diye kesik görünür. Herhangi bir sekmeye ilk dokunuşta çubuk yeniden çizilir ve adlar düzelir; geçiş normal çalışır. Açık ve koyu temada aynı.
- **Denenen:** Sekmeleri yazı tipi yüklenmeden önce oluşturmak sorunu çözmedi (geri alındı). 4 Kasım 2026: açılıştan kısa süre sonra sekme etiket stilini değiştirmek de çözmedi (geri alındı). Sekme çubuğu bileşeni baştan takıldığında (ör. Fast Refresh) adlar düzeliyor; ama bunu kodla yapmak bütün sekme ekranlarını iki kez açacağı için seçilmedi.
- **Olası neden:** iOS 26 sekme çubuğunun ilk yerleşimiyle ilgili bir sorun. react-native-bottom-tabs kütüphanesinde benzer bir kayıt var (iOS 26'da ilk açılışta kesik sekme adları). Expo Go'nun uygulamayı kendi ekranı içinde çalıştırması da etkili olabilir.
- **Sonraki adım:** US-02'deki ilk geliştirme derlemesinde test et. Orada da görülürse react-native-screens / expo-router güncellemelerini izle ve sorunu üst projeye bildir. Yayın engeli değildir, ama R1 öncesi kapanmalıdır.

## 10. Uygulama durumu (4 Kasım 2026)

S0–S8'in bütün "Must" hikâyeleri kodlandı. Doğrulama düzeyleri:

| Düzey | Anlamı |
|---|---|
| **Test** | Saf iş mantığı Jest ile test edildi (iş kuralları, plan motoru, FSRS, seri, quiz puanlama, kota, kişisel veri testi, eşitleme, veli kapısı, SUS…). |
| **Simülatör** | iPhone 17 Pro / iOS 26 simülatöründe, Expo Go'da, yerel modda ekranda denendi. |
| **Hazır, hesap bekliyor** | Kod yazıldı; çalışması için Supabase, Apple, RevenueCat, e-posta ya da EAS hesabı gerekiyor. |
| **Yerel Supabase** | Docker'daki yerel Supabase'e karşı denendi (4 Kasım 2026): migration'lar, 203 RLS testi, SQL denetimi, Edge Functions tip denetimi, veli onayı ve hesap silme akışı (16 kontrol), eşitlemede 195 kaydın gidiş-dönüşü. |

| Sprint | Hikâyeler | Durum |
|---|---|---|
| S0 | US-01, US-02, US-03, SP-01 | US-01 simülatör. US-02/US-03: CI iş akışları, EAS profilleri, Supabase projesi ve migration'lar hazır, hesap bekliyor. SP-01: değerlendirme iskeleti ve ADR-002 yazıldı; 30 belgelik set ekipçe toplanacak. |
| S1 | US-04, US-08, US-09, US-11, US-15 | Yerel veri modeli test + simülatör. Kayıt, doğrulama, giriş ve onboarding simülatörde denendi. Postgres şeması ve RLS testleri yerel Supabase'te geçti; canlı proje hesap bekliyor. Apple ile giriş geliştirme derlemesinde denenecek. |
| S2 | US-16, US-17, US-20, US-21, US-22, US-23, SP-02 | Yerel modda veli onay sayfası, kısıtlı ve kilitli mod, yasal metinler (taslak, hukuk onayı bekliyor), ders önerisi ve ders programı. Veli onayı sunucu akışı yerel Supabase'te uçtan uca denendi; gerçek e-posta gönderimi Resend hesabı bekliyor. SP-02 kararı ADR-003. |
| S3 | US-06, US-26, US-27, US-31, US-32 | Sınavlar ve resmi sınav tarihleri (tahmini) simülatörde. PDF yükleme ve işleme kuyruğu yazıldı; geliştirme sunucusu örnek içerikle denendi. Gerçek model ve Supabase Storage hesap bekliyor. Analitik sözlüğü: `analysis/analytics_events.md`. |
| S4 | US-05, US-18, US-33, US-34, US-35, US-36, US-41, US-42, US-62 | Özet, quiz çözme, geri bildirim ve düzenleme simülatörde. Eşitleme yerel Supabase'e karşı gidiş-dönüş testinden geçti; canlı proje hesap bekliyor. |
| S5 | US-37, US-44, US-45, US-46, US-47, US-48 | Plan motoru testte (%97,9 satır kapsamı, US-48 senaryoları birebir), Bugün/Takvim simülatörde. Desteler ve FSRS tekrar test + simülatör. Bildirme ve inceleme kuyruğu yazıldı. |
| S6 | US-28, US-29, US-49, US-50, US-54, US-55, US-56, US-60, US-61 | Bugün, Takvim, sınav ve ödev kutuları, seri simülatörde. Zamanlayıcı ve hatırlatmalar yazıldı; bildirimlerin gerçek teslimi ve kilit ekranı sayacı (Live Activity) geliştirme derlemesinde denenecek. |
| S7 | US-12, US-13, US-19, US-38, US-57, US-63, US-64, US-70 | İlerleme ekranı simülatörde. Profil, hesap silme, veli kapısı, kota ve abonelik ekranları yazıldı; gerçek satın alma RevenueCat ve App Store Connect hesabı bekliyor. |
| S8 | US-66, US-67, US-68, US-69 | SSS ve destek formu yazıldı. Güvenlik incelemesi `analysis/security_review.md`, mağaza metinleri `store/`. Erişilebilirlik: bileşenler etiketli ve büyük yazıya uygun; VoiceOver ile baştan sona test ve kontrast raporu ekipçe yapılacak. |
| E19 | US-71 … US-80 | 5 Kasım 2026'da eklendi. Simülatörde yerel modda baştan sona denendi: kayıt → doğrulama → onboarding (yarıda kapatıp kaldığı yerden devam, 10. sınıfa isteğe bağlı YKS adımı) → ders seçimi → Bugün'de kurulum listesi ve kısayollar; veli onayı beklerken bildirimlerin kapalı olması; kilitli ekranda doğum yılı düzeltme (yetişkin yılı reddedilir) ve "Hesabı sil" seçeneği; görünüm (açık/koyu), Hakkında, eşitleme satırı, bulunamadı ekranı. Test: taslak, doğum yılı kuralları, bağlantı ayrıştırma, kontrol listesi, yeni yıl tarihleri, plan geçişi, bildirim izni, 401 sınıflandırması. Yerel Supabase: doğum yılı migration'ı ve 6 yeni RLS testi. E-posta bağlantıları, oturum sona ermesi ve Apple belirteci iptali canlı Supabase/Apple hesabı bekliyor. |

Simülatörde yerel demo verisiyle denemek için: `exp://127.0.0.1:8081/--/dev-seed?mode=full` (README).

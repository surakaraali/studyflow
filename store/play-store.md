# StudyMark — Google Play Taslağı (R2a'da kullanılacak)

| Alan | Değer |
|---|---|
| Doküman | Google Play Console: Aile Politikası, kapalı test, Veri güvenliği, içerik derecelendirmesi, mağaza girişi |
| Sürüm | 0.2 (taslak) |
| Tarih | 7 Kasım 2026 |
| Hazırlayan | İş Analisti ve Tech Lead |
| Durum | Taslak; R2a (Mayıs 2027) öncesi güncellenecek |
| İlgili | [App Store taslağı](app-store.md) · [Güvenlik incelemesi](../analysis/security_review.md) §6 · [ADR-006](../analysis/adr/ADR-006-birinci-taraf-telemetri.md) · [Yayına çıkış runbook'u](../analysis/go_live.md) · [01_brd.md](../analysis/01_brd.md) §12 · [02_nfr.md](../analysis/02_nfr.md) §13 |

Bu doküman R1'de kullanılmaz; veri envanteri ve metinler App Store taslağıyla aynı kaynaktan türetildiği için
şimdiden yazıldı (STORE-02). Android'e özgü kod henüz yok; aşağıdaki teknik maddeler R2a'da kontrol edilir.

## 1. Hesap ve kapalı test
- **Kişisel geliştirici hesabı:** üretime çıkmadan önce **en az 12 test kullanıcısı, kesintisiz 14 gün** kapalı
  testte kalmalı (PLAN.md §6, BRD §12). Bırakanlara karşı 15–20 kişi davet edilir; R1 beta grubundan
  (veli onaylı öğrenciler ve veliler, US-70) seçilir.
- **Takvim önerisi:** 14 gün + üretim erişimi incelemesi için kapalı test en geç 1 Mayıs 2027'de başlar.
- **Açık madde (Ürün sahibi, A-06):** Play hesabı kişisel mi kurumsal mı açılacak? Kurumsal hesap (D-U-N-S
  numarası gerekir) 12 kişi / 14 gün şartına tabi değildir.

## 2. Aile Politikası
Hedef kitle: ortaokul ve lise (Play yaş grupları **9–12, 13–15, 16–17**). 13 yaş altı dahil olduğu için Aile
Politikası şartları geçerlidir.

| Şart | StudyMark | Durum |
|---|---|---|
| Gizlilik politikası Play Console'da ve uygulamada | Uygulama içi metinler var (`src/features/legal/texts.ts`); aynı metin `https://studymark.app/gizlilik/` sayfasına üretiliyor (`npm run web:build`); hukuk onayı bekliyor (H-01) | ❌ |
| Reklam | Yok. Reklam beyanı "Hayır"; Families Self-Certified Ads SDK şartı bu yüzden uygulanmaz | ✅ |
| Çocuklardan cihaz kimliği (AAID, IMEI, MAC, SSID vb.) iletilmez | Kod toplamıyor. Bağımlılıklar `AD_ID` iznini manifest'e ekleyebilir: `app.json`'da `android.blockedPermissions` ile engellenir, birleşik manifest kontrol edilir | 🔍 |
| Konum izni yok | Yok | ✅ |
| SDK'lar Aile Politikasına uygun | RevenueCat, Expo Notifications (FCM), Supabase: sağlayıcıların Families beyanları kontrol edilecek | 🔍 |
| Yapay zekâ içeriği politikası | Uygulama içi bildirme (FR-AI-08, içerik hemen gizlenir); yaşa uygun olmayan belge işlenmez (`_shared/ai/prompts.ts`); her öğede yapay zekâ etiketi (BR-06) | ✅ |
| Satın alma | Google Play Faturalandırma (RevenueCat); 18 yaş altında veli kapısı (BR-19); Family Link onayı ayrıca geçerli | ✅ |
| Teacher Approved | İsteğe bağlı; başvuruyla alınmaz, Google uygun uygulamalar arasından seçer. Hedef değil | — |

Giriş yöntemleri: Android'de e-posta + şifre ve Google ile giriş (US-10, R2a). Apple ile giriş Android'de sunulmaz.

## 3. İçerik derecelendirmesi (IARC anketi)

| Soru | Cevap |
|---|---|
| Kategori | Eğitim / başvuru amaçlı uygulama (oyun değil) |
| Şiddet, cinsellik, küfür, uyuşturucu, kumar | Yok |
| Kullanıcılar birbiriyle etkileşebilir veya içerik paylaşabilir | Hayır (BR-20) |
| Kullanıcının konumunu paylaşır | Hayır |
| Dijital ürün satın alma | Evet (Pro abonelik) |
| Sınırsız internet erişimi | Hayır |
| Yapay zekâ ile üretilen içerik (soru varsa) | Evet; yalnızca kullanıcının kendi belgesinden, bildirilebilir |

Beklenen sonuç: PEGI 3 / ESRB Everyone (🔍 anket sonucu). Anket her önemli özellik değişikliğinde yenilenir.

## 4. Veri güvenliği formu
Kaynak: [güvenlik incelemesi §6](../analysis/security_review.md#6-sdk-ve-servis-veri-envanteri-priv-05-store-02),
[ADR-006](../analysis/adr/ADR-006-birinci-taraf-telemetri.md) (telemetri) ve Apple gizlilik etiketi
([app-store.md](app-store.md) §8). Aynı veri iki formda kendi tanımlarıyla beyan edilir; App Store §8'deki
"manifest sahibiyle karar verilecek" türler kapanınca bu tablo da gözden geçirilir.

| Google veri türü | Toplanıyor | Paylaşılıyor | Zorunlu mu | Amaç | StudyMark'daki karşılığı | Apple §8 karşılığı |
|---|---|---|---|---|---|---|
| Kişisel bilgiler → E-posta adresi | Evet | Hayır | Zorunlu | Uygulama işlevselliği, hesap yönetimi | Hesap e-postası, veli e-postası, destek yanıt adresi | E-posta Adresi |
| Kişisel bilgiler → Ad | Evet | Hayır | İsteğe bağlı | Uygulama işlevselliği | Rumuz (Google "takma ad"ı bu türde sayar) | Kullanıcı Kimliği (rumuz) |
| Kişisel bilgiler → Kullanıcı kimlikleri | Evet | Hayır | Zorunlu | Uygulama işlevselliği, hesap yönetimi | Hesap UUID'si (RevenueCat'te de aynı) | Kullanıcı Kimliği |
| Kişisel bilgiler → Diğer bilgiler | Evet | Hayır | Zorunlu | Uygulama işlevselliği | Doğum yılı, sınıf, hedef sınav, uyku saatleri | Diğer Veri Türleri |
| Finansal bilgiler → Satın alma geçmişi | Evet | Hayır | İsteğe bağlı | Uygulama işlevselliği | Abonelik durumu ve işlem kimliği | Satın Alma Geçmişi |
| Uygulama etkinliği → Kullanıcının oluşturduğu diğer içerik | Evet | Hayır | Zorunlu | Uygulama işlevselliği | Dersler, plan, quiz cevapları, kartlar, oturumlar, içerik bildirimi, destek mesajı | Diğer Kullanıcı İçeriği |
| Uygulama etkinliği → Uygulama etkileşimleri | Evet | Hayır | Zorunlu (kapatma ayarı yok) 🔍 | Analiz | Kimliksiz ürün olayları: olay adı, izinli özellikler, uygulama sürümü, platform, OS ana sürümü (ADR-006) | Ürün Etkileşimi (ilişkilendirilmeyen) |
| Dosyalar ve dokümanlar | Evet | Hayır | İsteğe bağlı | Uygulama işlevselliği | Yüklenen PDF sayfaları (yapay zekâ işi) | Diğer Kullanıcı İçeriği |
| Uygulama bilgileri ve performansı → Kilitlenme günlükleri | Evet | Hayır | Zorunlu (kapatma ayarı yok) 🔍 | Uygulama işlevselliği, analiz | Kimliksiz JavaScript çökme raporları (ADR-006); yerel çökmeler Play Console Android vitals'tan | Çökme Verileri (ilişkilendirilmeyen) |
| Uygulama bilgileri ve performansı → Diğer uygulama performansı verileri | Evet | Hayır | İsteğe bağlı | Uygulama işlevselliği | Yalnızca destek kaydına eklenen uygulama ve Android sürümü | App Store §8 açık maddesi (Diğer Teşhis Verileri) |
| Cihaz veya diğer kimlikler | Evet | Hayır | İsteğe bağlı | Uygulama işlevselliği | Push token (FCM, Expo); bildirim izni verilirse | App Store §8: Cihaz Kimliği olarak beyan edildi |

- **Toplanmayanlar:** konum, kişiler, fotoğraf ve video, ses, sağlık, mesajlar, takvim, web geçmişi, yüklü
  uygulamalar, reklam kimliği.
- **Kimliksiz telemetri yine "toplanıyor" sayılır:** Google'ın tanımında cihazdan çıkan her veri toplanmış
  sayılır; "ilişkilendirilmeyen" ayrımı yalnızca Apple formunda vardır. Kayıtlarda kullanıcı, cihaz, kurulum
  kimliği ve IP yoktur (ADR-006); bu bilgi Play'in "Veri işleme" açıklamasına da yazılır.
- **"Paylaşılıyor: Hayır" koşulu:** Google, hizmet sağlayıcıya (veri işleyene) aktarımı paylaşım saymaz. Supabase,
  Anthropic, Resend, RevenueCat ve Expo için veri işleme sözleşmesi şarttır (H-10); sözleşme yoksa ilgili tür
  "paylaşılıyor" işaretlenir. Telemetri kendi Supabase projemizde kalır, yeni bir veri işleyen eklemez.
- **Güvenlik uygulamaları:** aktarım sırasında şifreleme **Evet** (SEC-01); silme talebi **Evet**, uygulama içi ve
  web; Aile Politikasına uyum taahhüdü **Evet**; bağımsız güvenlik incelemesi (MASA) **Hayır** (isteğe bağlı).

## 5. Hesap silme URL'si
Play Console, uygulamayı yeniden kurmadan silme talebi yapılabilen bir web adresi ister (STORE-03):
`https://studymark.app/hesap-silme/` (alan adı Q-08 ile kesinleşir; form `web/delete-account/index.html`,
`npm run web:build` ile bu adrese üretilir ve `.github/workflows/web.yml` ile GitHub Pages'te yayımlanır).
Sayfada uygulama ve geliştirici adı, adımlar, silinen ve saklanan veriler (veli onay ve ödeme kayıtları yasal
süre, H-03) ve süre (en geç 30 gün, PRIV-07) yazar. Açık kalan: hesap sahipliğini doğrulama süreci (T-16, H-12).
Gizlilik politikası alanına `https://studymark.app/gizlilik/`, web sitesi alanına `https://studymark.app/` girilir.

## 6. Mağaza girişi

| Alan | Değer | Not |
|---|---|---|
| Uygulama adı (≤ 30) | StudyMark | Q-08; yedekler App Store §1'de |
| Kısa açıklama (≤ 80) | Sınavına göre plan, notundan özet ve quiz, internetsiz kart tekrarı. | 68 karakter |
| Tam açıklama (≤ 4000) | App Store §4 metni | Değişiklikler aşağıda |
| Kategori | Eğitim | — |
| İletişim e-postası | `destek@studymark.app` | Zorunlu alan |
| Grafikler | Simge 512×512, öne çıkan görsel 1024×500, telefon ekran görüntüleri | App Store §10 listesi Android cihazda yeniden çekilir |

Tam açıklamadaki değişiklikler: "Ödeme Apple Kimliği hesabından alınır" → "Ödeme Google Play hesabından alınır";
"App Store hesap ayarlarından" → "Google Play'deki Abonelikler bölümünden". R2a ile gelen özellikler (ör. deneme
sınavı neti, FR-EXM-06) yalnızca yayına girerse eklenir.

## 7. Android'e özgü teknik kontroller (R2a)

| Madde | Not | Sahip |
|---|---|---|
| `AD_ID` izni engeli | §2; birleşik manifest'te izin kalmamalı | Tech lead |
| FCM V1 hizmet hesabı anahtarı | EAS kimlik bilgilerinde tutulur, depoya girmez | Tech lead |
| Oturum Android Keystore'da | Güvenlik incelemesi T-01 Android'de de geçerli | Tech lead |
| Yedekleme | `allowBackup` kararı (T-24'ün Android karşılığı) | Tech lead |
| Şifresiz trafik | Yayın derlemesinde kapalı; yerel geliştirme sunucusu yalnızca geliştirme derlemesinde | Tech lead |
| Hedef API seviyesi | Play'in güncel şartı; COMP-02 (Android 10+) | Tech lead |
| Veri güvenliği formu | SDK listesi değişirse §4 ve App Store §8 birlikte güncellenir (STORE-02) | İş Analisti |

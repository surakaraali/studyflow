# StudyFlow — Ürün Analitiği Olay Sözlüğü ve Çökme Raporlama

| Alan | Değer |
|---|---|
| Doküman | Olay sözlüğü, KPI eşlemesi ve gizlilik kuralları |
| Sürüm | 0.1 (taslak) |
| Tarih | 4 Kasım 2026 |
| Hazırlayan | Ürün ekibi |
| Durum | İnceleme bekliyor |
| İlgili | [01_brd.md §3](01_brd.md) · [02_nfr.md](02_nfr.md) (OBS-01, OBS-04, PRIV-04, PRIV-05) · [Backlog US-06](../agile/backlog.md) · Kod: `src/services/analytics.ts` |

## 1. Amaç

Bu doküman uygulamanın gönderdiği her ürün analitiği olayını, olayın hangi iş hedefine (KPI,
BRD §3 G-01–G-05) hizmet ettiğini ve çocuk kullanıcılar nedeniyle uyguladığımız gizlilik
kurallarını tanımlar (US-06, OBS-04). Sözlükte olmayan bir olay gönderilemez. Kod tarafındaki
tek kaynak `src/services/analytics.ts` içindeki `EVENTS` nesnesidir; bu doküman onunla aynı
tutulur.

## 2. Gizlilik kuralları

| Kural | Nasıl uygulanıyor | NFR |
|---|---|---|
| Kimlik yok | Olaylara kullanıcı kimliği, cihaz kimliği, kurulum kimliği veya oturum kimliği eklenmez. Sağlayıcıya da anonim/kimliksiz modda gönderilir. | PRIV-04, Q-04 |
| Reklam kimliği yok | IDFA/AAID okunmaz, uygulama takip izni (ATT) istenmez. Analitik kodu hiçbir reklam SDK'sı içermez. | PRIV-04 |
| İzin listesi | `track()` yalnızca sözlükte o olay için tanımlı özellikleri, doğru türdeyse gönderir; diğerlerini sessizce atar. | OBS-04 |
| Serbest metin yok | Metin özellikleri yalnızca sabit bir değer listesinden seçilebilir (ör. `kind: study \| review \| homework`). E-posta, rumuz, belge adı, belge içeriği, quiz cevabı bu yüzden hiçbir yoldan geçemez. | PRIV-04 |
| Kaba sayılar | Sayılar 2 ondalığa yuvarlanır. Kayıttan bu yana geçen gün 60'ta kesilir. Doğum yılı, sınıf, okul gibi alanlar hiç yoktur; yalnızca segment (ortaokul/lise) vardır. | BR-05 ruhu |
| Günde bir açılış | `app_opened` hesap başına günde en çok bir kez gönderilir; böylece kimlik olmadan günlük aktif öğrenci sayılabilir. | G-01 |
| Sağlayıcı | Q-04 açık. Geliştirmede olaylar konsola yazılır, yayın derlemesinde hiçbir yere gönderilmez. Sağlayıcı seçilince `setAnalyticsSink()` ile bağlanır. | PRIV-05 |

Sağlayıcı (PostHog, Sentry veya başka bir araç) seçildiğinde şu yapılandırma şarttır:
otomatik olay yakalama ve ekran kaydı kapalı, kişi profili kapalı, IP adresi saklama kapalı,
cihaz ve reklam kimliği toplama kapalı, veri bölgesi AB. Seçilen araç PRIV-05 kapsamındaki SDK
listesine ve mağaza gizlilik formlarına eklenir.

## 3. Olay sözlüğü

Özellik türleri: **sayı**, **evet/hayır**, **liste** (yalnızca yazılan değerlerden biri).
"Gönderen" sütunu olayı kimin tetiklediğini gösterir; ilgili özellik ekibi kendi ekranından
`track()` çağırır.

### G-01 · Öğrenciler uygulamayı düzenli kullanır (D7 geri dönüş)

| Olay | Ne zaman | Özellikler | Gönderen |
|---|---|---|---|
| `app_opened` | Giriş yapıldığında ve uygulama öne geldiğinde, hesap başına günde en çok bir kez | `days_since_signup` (sayı, 0–60) | Analitik servisi |
| `onboarding_completed` | Onboarding bittiğinde | `segment` (ortaokul, lise, ilkokul), `has_target_exam` (evet/hayır), `needs_consent` (evet/hayır) | Hesap |
| `progress_viewed` | İlerleme sekmesi her açıldığında | — | İlerleme |

### G-02 · Plan gerçekten uygulanır (blok tamamlama oranı)

| Olay | Ne zaman | Özellikler | Gönderen |
|---|---|---|---|
| `plan_generated` | Plan (yeniden) üretildiğinde | `blocks` (sayı), `days` (sayı) | Plan |
| `plan_block_completed` | Blok tamamlandığında | `kind` (study, review, homework), `minutes` (sayı) | Plan |
| `plan_block_skipped` | Blok atlandığında | `kind` (study, review, homework) | Plan |
| `study_session_saved` | Zamanlayıcı ya da elle oturum kaydedildiğinde | `source` (timer, manual), `minutes` (sayı) | Plan |

### G-03 · Öğrenme ölçülebilir şekilde artar (4 haftada doğru oranı artışı)

| Olay | Ne zaman | Özellikler | Gönderen |
|---|---|---|---|
| `quiz_completed` | Quiz bitirildiğinde | `questions`, `correct`, `wrong`, `blank` (sayı), `is_retry` (evet/hayır) | Quiz |
| `cards_reviewed` | Tekrar oturumu bittiğinde | `cards` (sayı), `new_cards` (sayı) | Kartlar |

### G-04 · Yapay zekâ özelliği değer üretir (PDF yükleyen aktif kullanıcı oranı)

| Olay | Ne zaman | Özellikler | Gönderen |
|---|---|---|---|
| `document_uploaded` | PDF yüklemesi başladığında | `pages` (sayı), `plan` (free, pro) | Belgeler |
| `document_ready` | Özet, quiz ve kartlar hazır olduğunda | `pages` (sayı), `duration_sec` (sayı) | Belgeler |
| `document_failed` | Belge işlenemediğinde | `reason` (encrypted, not_pdf, too_large, too_many_pages, no_text, timeout, ai_error, network, unknown) | Belgeler |
| `content_reported` | Bir yapay zekâ içeriği bildirildiğinde | `item` (question, card, summary), `reason` (wrong_answer, unclear, inappropriate) | Quiz / Kartlar |

### G-05 · Ürün sürdürülebilir (ücretsizden Pro'ya geçiş oranı)

| Olay | Ne zaman | Özellikler | Gönderen |
|---|---|---|---|
| `quota_reached` | Aylık belge hakkı dolduğunda | `plan` (free, pro) | Belgeler |
| `paywall_viewed` | Plan karşılaştırma ekranı açıldığında | `source` (settings, quota, other), `test` (evet/hayır) | Abonelik |
| `purchase_started` | "Pro'ya geç"e dokunulup (gerekirse veli kapısı geçildikten sonra) ödeme başladığında | `period` (monthly, annual, other), `under_18` (evet/hayır) | Abonelik |
| `purchase_completed` | Pro hakkı açıldığında | `period` (monthly, annual, other), `test` (evet/hayır) | Abonelik |
| `purchase_failed` | Satın alma tamamlanmadığında | `reason` (cancelled, pending, not_allowed, network, unavailable, unknown) | Abonelik |
| `purchase_restored` | Satın alımları geri yükleme bittiğinde | `active` (evet/hayır) | Abonelik |

Ücretli abonelik sayısının asıl kaynağı mağaza sunucu bildirimleri ve RevenueCat'tir; bu
olaylar huniyi (görüntüleme → başlatma → tamamlama) görmek içindir. `test: evet` olan olaylar
geliştirme modundaki test satın almalarıdır ve KPI'lardan çıkarılır.

## 4. KPI'ların hesaplanması

| KPI | Hesap | Olaylar |
|---|---|---|
| G-01 D7 geri dönüş | 7. gündeki `app_opened` sayısı (`days_since_signup = 7`) ÷ ilgili kohortta `onboarding_completed` sayısı. Günde bir açılış kuralı sayesinde olay sayısı öğrenci sayısına eşittir. | `app_opened`, `onboarding_completed` |
| G-02 Blok tamamlama | Haftalık `plan_block_completed` ÷ (`plan_block_completed` + `plan_block_skipped`). Uygulama içi karşılığı İlerleme ekranındaki "Plan uyumu"dur. | `plan_block_*` |
| G-03 Doğru oranı artışı | Uygulama, ders ve konu bazındaki 4 haftalık değişimi İlerleme ekranında öğrenciye gösterir. Ekip düzeyinde: `quiz_completed` (`is_retry = hayır`) olaylarında haftalık doğru ÷ soru oranının 4 haftadaki farkı. Konu bazında ölçüm sunucudaki quiz verisinden (anonim istatistik, BR-18) yapılır, analitiğe konu adı gönderilmez. | `quiz_completed` |
| G-04 PDF yükleyen aktif kullanıcı | Günlük `document_uploaded` gönderen öğrenci oranı; kimlik olmadığı için sunucudaki belge tablosundan (hesap başına sayım, anonimleştirilmiş) doğrulanır. | `document_uploaded`, `app_opened` |
| G-05 Pro'ya geçiş | RevenueCat'teki aktif abonelik ÷ aktif hesap. Huni için `paywall_viewed` → `purchase_started` → `purchase_completed`. | `paywall_viewed`, `purchase_*` |

## 5. Çökme ve hata raporları (OBS-01)

Global JavaScript hata yakalayıcısı (`ErrorUtils.setGlobalHandler`) uygulama açılırken kurulur
ve önceki yakalayıcıyı da çağırır (geliştirmede kırmızı ekran, yayında çökme davranışı değişmez).
Yakalanan ve kullanıcıya gösterilmeyen hatalar için `captureError(error)` kullanılır.

Rapor alanları:

| Alan | İçerik | Temizleme |
|---|---|---|
| `name` | Hata türü (ör. `TypeError`) | 60 karakter |
| `message` | Hata mesajı | E-posta → `<email>`, UUID → `<id>`, 6+ haneli sayı → `<n>`, dosya yolu ve URL → yalnızca kod dosyasının adı, diğer yollar `<path>`; 300 karakter |
| `stack` | Fonksiyon adları ve kod dosyası konumları (ör. `main.jsbundle:1:9876`) | Satır başına aynı temizleme, en çok 25 satır; kullanıcı dosyalarının yolları ve Metro adres seçenekleri silinir |
| `fatal` | Uygulamanın kapanıp kapanmadığı | — |
| `platform`, `os_version` | ios/android ve sürüm numarası | Cihaz modeli ve kimliği yok |
| `app_version` | Uygulama sürümü ve derleme numarası | — |

## 6. Yeni olay ekleme

1. Olayı ve hangi KPI'ya hizmet ettiğini bu dokümana ekle; KPI'ya bağlanamayan olay eklenmez.
2. `src/services/analytics.ts` içindeki `EVENTS` nesnesine aynı adla ekle. Metin özellikleri için
   her zaman sabit bir değer listesi yaz; kimlik, ad, e-posta veya serbest metin taşıyan özellik
   eklenmez (birim testi bu adları reddeder).
3. Ekrandan çağır: `track('quiz_completed', { questions: 10, correct: 7, wrong: 2, blank: 1, is_retry: false })`.
4. `npx jest src/services/__tests__/analytics.test.ts` çalıştır.

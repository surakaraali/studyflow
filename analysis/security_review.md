# StudyFlow — Güvenlik ve Gizlilik İncelemesi (MASVS L1)

| Alan | Değer |
|---|---|
| Doküman | Güvenlik ve gizlilik incelemesi |
| Sürüm | 0.1 (taslak) |
| Tarih | 4 Kasım 2026 |
| Hazırlayan | Tech Lead ve İş Analisti |
| Durum | İnceleme bekliyor (tech lead, hukuk danışmanı) |
| İlgili | [02_nfr.md](02_nfr.md) · [01_brd.md](01_brd.md) · [Proje planı](../agile/project_plan.md) · [App Store taslağı](../store/app-store.md) · [Google Play taslağı](../store/play-store.md) |

## 1. Amaç ve kapsam

Bu doküman US-68'in çıktısıdır: yayın öncesi OWASP MASVS L1 kontrol listesi (SEC-08), gizlilik
gereksinimleri (PRIV-01–PRIV-08) ve mağaza formlarının dayandığı SDK veri envanteri (PRIV-05, STORE-02).

- **Kapsam:** iOS uygulaması (R1), Supabase backend (migration'lar, RLS, Edge Functions), veli onay
  sayfası (`web/consent/index.html`) ve CI. Android (R2a) yalnızca [play-store.md](../store/play-store.md)'de notlanır.
- **Yöntem:** 4 Kasım 2026 tarihli kod tabanının incelemesi. Dinamik test (trafik izleme, cihaz dosya
  sistemi, yayın derlemesinin `Info.plist`'i) henüz yapılmadı; S8'de yayın adayı derlemesiyle tekrarlanır.
- **MASVS v2 notu:** v2'de seviyeler kontrollerden test profillerine (L1, L2, R, P) taşındı. Liste L1 ve
  gizlilik (P) profiline göre seçildi. RESILIENCE (R profili) L1'de zorunlu değildir; bilgi için listelenir.
- **Durum işaretleri:** ✅ Karşılandı · ⚠️ Kısmen · ❌ Açık · 🔍 Doğrulanacak · — Uygulanmaz.
  `T-xx` teknik açık madde (§11), `H-xx` hukuk açık maddesi (§10).

## 2. Özet

| Grup | ✅ | ⚠️ | ❌ | 🔍 |
|---|---|---|---|---|
| STORAGE | 2 | 2 | 0 | 2 |
| CRYPTO | 2 | 1 | 0 | 1 |
| AUTH | 5 | 2 | 1 | 0 |
| NETWORK | 1 | 2 | 0 | 2 |
| PLATFORM | 5 | 0 | 1 | 0 |
| CODE | 2 | 2 | 1 | 1 |
| PRIVACY | 3 | 4 | 1 | 1 |

**Yayından önce kapanması gerekenler:** oturumun güvenli depoya taşınması (T-01), şifre sıfırlama
bağlantısının uygulamada karşılanması (T-08), web'den hesap silme talebinde sahiplik doğrulaması
(T-16, H-12), yapay zekâ bilgilendirmesinde üçüncü tarafın adı (T-21) ve hukuk onayları
(H-01, H-02, H-09, H-10). T-10, T-12, T-18, T-19 ve T-20'nin sunucu kısmı bu incelemeden sonra
kapatıldı (aşağıda ✅ ile işaretli).

## 3. MASVS kontrol listesi

### 3.1 MASVS-STORAGE

| Kontrol | StudyFlow'da nasıl karşılanıyor | Durum |
|---|---|---|
| STORAGE-1 · Oturum bilgisi güvenli depoda (SEC-05) | Supabase modunda supabase-js oturumu `expo-sqlite/localStorage` ile SQLite dosyasında tutuyor (`src/services/supabase.ts`); Keychain kullanılmıyor. Yerel (geliştirme) modunda yalnızca hesap kimliği `expo-secure-store`'da (`src/services/auth/local.ts`). | ⚠️ T-01 |
| STORAGE-1 · Cihazdaki kullanıcı verisi | Her hesap için ayrı `user-<id>.db` (`src/db/client.ts`); PDF'ler `Documents/documents/<id>/` altında. Uygulama düzeyinde şifreleme yok; yalnızca iOS Veri Koruması (varsayılan sınıf: ilk kilit açılışından sonra erişilebilir). | ⚠️ T-02 |
| STORAGE-1 · Pakette sunucu sırrı yok (SEC-02) | Pakete yalnızca `EXPO_PUBLIC_*` değerleri girer (`src/services/config.ts`): Supabase URL ve anon anahtarı, RevenueCat genel SDK anahtarları, onay sayfası ve destek adresi. `scripts/check-secrets.mjs`, başka bir ortam değişkeni okunursa ya da servis rolü, Anthropic, Resend, özel anahtar desenleri bulunursa CI'ı durdurur. | ✅ |
| STORAGE-2 · Loglarda kişisel veri yok | Analitik ve çökme raporları kimliksizdir; metinler cihazda `scrubText`/`scrubStack` (`src/services/analytics.ts`), sunucuda yeniden `_shared/telemetry.ts` ile temizlenir (ADR-006). Cihazdaki gönderim kuyruğu (`expo-sqlite/kv-store`) yalnızca bu temizlenmiş kayıtları tutar. Uygulamadaki `console.warn` çağrıları (hata nesneleriyle) yayın derlemesinde de çalışır. | 🔍 T-20 |
| STORAGE-2 · Çıkışta ve yedeklerde veri | Çıkışta veritabanı kapanır ama dosya cihazda kalır (`endSession`, `src/stores/session.ts`); hesap silmede DB ve PDF'ler silinir (`src/features/account/service.ts`). DB, oturum deposu ve PDF'ler cihaz yedeğine (iCloud/bilgisayar) dahil. | 🔍 T-03, T-24 |
| STORAGE-2 · Klavye önbelleği | Şifre alanı `secureTextEntry` (`src/features/account/components/password-field.tsx`). | ✅ |

### 3.2 MASVS-CRYPTO

| Kontrol | StudyFlow'da nasıl karşılanıyor | Durum |
|---|---|---|
| CRYPTO-1 · Standart kripto, kendi algoritması yok | TLS platformdan. Veli onay bağlantısı 32 bayt `crypto.getRandomValues`, saklanan yalnızca SHA-256 özeti (`supabase/functions/_shared/consent.ts`). Kimlikler `expo-crypto` ile rastgele UUID (`src/db/ids.ts`). | ✅ |
| CRYPTO-1 · Parola saklama | Üretimde parolaları Supabase Auth saklar (uygulama görmez). Yerel modda tuzlu, tek turlu SHA-256 (`src/services/auth/local.ts`): zayıf ama yalnızca geliştirme modunda, veri cihazdan çıkmaz. Yayın derlemesinin yerel moda düşmemesi gerekir. | ⚠️ T-05 |
| CRYPTO-2 · Anahtar yönetimi | Uygulamada gizli anahtar yok. Sunucu sırları `supabase secrets set` ve Vault'ta (§5); paylaşılan sırlar sabit zamanlı karşılaştırılır (`safeEqual`, `_shared/http.ts`). | ✅ |
| CRYPTO-2 · Sunucuda depolama şifrelemesi | Supabase disk şifrelemesi sağlayıcı beyanına dayanıyor. Yasal metin "depoda şifrelenerek saklanır" diyor (`src/features/legal/texts.ts`); sağlayıcı dokümanıyla teyit edilecek. | 🔍 |

### 3.3 MASVS-AUTH

| Kontrol | StudyFlow'da nasıl karşılanıyor | Durum |
|---|---|---|
| AUTH-1 · Kimlik doğrulama | Supabase Auth: e-posta + şifre (e-posta doğrulaması zorunlu, en az 8 karakter, `double_confirm_changes`, `secure_password_change`; `supabase/config.toml`) ve Apple ile giriş (yerel kimlik belirteci, `signInWithIdToken`). Anonim giriş kapalı. Google ile giriş R2a'ya kaldı (US-10). | ✅ |
| AUTH-1 · Oturum yönetimi | JWT 1 saat; yenileme belirteci rotasyonu açık (10 sn tekrar aralığı); çıkışta `auth.signOut()` (`src/services/auth/supabase.ts`). | ✅ |
| AUTH-1 · Apple ile girişte tekrar oynatma koruması | `skip_nonce_check = false`, ancak uygulama Apple'a nonce göndermiyor (`src/features/account/service.ts`); belirteç nonce'suz kabul ediliyor. | ⚠️ T-09 |
| AUTH-1 · E-posta bağlantıları | Doğrulama ve şifre sıfırlama `studyflow://auth/callback`'e yönleniyor; uygulamada bu rota ve kod/oturum değişimi yok. Şifre sıfırlama e-postası gidiyor ama yeni şifre uygulamada belirlenemiyor. Özel şemayı başka bir uygulama da kaydedebilir. | ❌ T-08 |
| AUTH-1 · Sunucuda yetki | Her tabloda RLS (§4.1). Kullanıcı çağrılı fonksiyonlar JWT'yi `auth.getUser` ile doğrular (`_shared/auth.ts`); sunucudan sunucuya çağrılar paylaşılan sırla (`CRON_SECRET`, `REVENUECAT_WEBHOOK_SECRET`). | ✅ |
| AUTH-1 · Kamuya açık veli onay uç noktası | 256 bit rastgele bağlantı, yalnızca SHA-256 saklanır, 7 gün geçerli; öğrenci başka veli adresi yazınca eski bağlantılar geçersiz (`supabase/functions/consent/index.ts`). Kullanılmış bağlantı, amaç değiştirme ve geri alma için süresiz geçerli kalır. | ✅ (H-04) |
| AUTH-1 · Yaş kuralları sunucuda | `consent_status` sunucuda doğum yılından türetilir (`private.protect_profile`). Onboarding bittikten sonra `pending` bir hesap doğum yılını değiştirerek onaydan kurtulamaz (pgTAP testi var; T-10 kapandı). BR-02 (13 yaş altı onaysız veri giremez) yalnızca uygulamada uygulanıyor; RLS onay durumuna bakmıyor. Yapay zekâ sunucuda engelli (`process-document`, `canUseAi`). | ⚠️ T-11 |
| AUTH-2 · Yerel kimlik doğrulama | Biyometri kullanılmıyor. | — |
| AUTH-3 · Hassas işlemde ek adım | Hesap silme "SİL" yazılarak onaylanır. 18 yaş altında satın alma ve abonelik yönetimi veli kapısının arkasında (`src/features/subscription/use-plan-actions.ts`). | ✅ |

### 3.4 MASVS-NETWORK

| Kontrol | StudyFlow'da nasıl karşılanıyor | Durum |
|---|---|---|
| NETWORK-1 · Tüm trafik HTTPS (SEC-01) | Uygulama yalnızca Supabase, RevenueCat, Expo (push token) ve Apple ile konuşur. Resend, Anthropic ve Expo Push Service'e yalnızca Edge Functions HTTPS ile gider. | ✅ |
| NETWORK-1 · ATS istisnası yok | `app.json`'da `NSAppTransportSecurity` istisnası yok. Prebuild'in eklediği değerler (ör. `NSAllowsLocalNetworking`) yayın derlemesinin `Info.plist`'inde kontrol edilecek. | 🔍 T-05 |
| NETWORK-1 · Geliştirme sunucusu yayına çıkmaz | Yerel modda yapay zekâ isteği geliştirme sunucusuna gider. 7 Kasım 2026: yayın derlemesinde (`!__DEV__`) bu adres boş; yerel modda ya da `https://` olmayan Supabase adresiyle açılan yayın derlemesi yalnızca "Bu sürüm eksik" ekranını gösterir (`src/features/release/`); EAS preview/production derlemesi bu değişkenler yoksa `app.config.ts`'de durur. | ✅ T-05 |
| NETWORK-1 · TLS 1.2+ | Supabase uç noktaları ve onay sayfası barındırması SSL Labs ile kontrol edilecek. | 🔍 |
| NETWORK-1 · Veli onay sayfası | `no-referrer`, `noindex`, sıkı CSP, `form-action 'none'`; token yalnızca kendi API'sine gider. 7 Kasım 2026: Literata sayfayla birlikte barındırılıyor (Google Fonts isteği yok); prod CSP'nin `connect-src`'si derlemede yalnızca fonksiyon adresine daraltılıyor (`npm run web:build -- --strict`); çerçeve içinde açılınca sayfa kendini gizliyor. Kalan: GitHub Pages HTTP başlığı (`frame-ancestors`, HSTS) gönderemez; `CORS_ALLOWED_ORIGIN` canlıda tanımlanacak. | ⚠️ T-15 |
| NETWORK-2 · Sertifika sabitleme | Planlanmıyor; L2 kontrolü (gerekçe T-04). | — |

### 3.5 MASVS-PLATFORM

| Kontrol | StudyFlow'da nasıl karşılanıyor | Durum |
|---|---|---|
| PLATFORM-1 · Derin bağlantılar | Şema `studyflow`. `dev-seed` yalnızca `__DEV__` ve yerel modda çalışır (`src/features/dev/seed.ts`); `parent-consent` rotası yalnızca yerel modda (`src/app/parent-consent.tsx`); bildirimden gelen yol yalnızca oturum açıksa açılır (`src/services/notifications.ts`). | ✅ |
| PLATFORM-1 · Kimlik bağlantısı özel şemada | Bkz. AUTH-1 · E-posta bağlantıları. Evrensel bağlantı (associated domains) önerilir. | ❌ T-08 |
| PLATFORM-2 · WebView | Uygulamada WebView yok. | ✅ |
| PLATFORM-3 · İzinler | Yalnızca bildirim izni, gerekçesi gösterildikten sonra istenir (US-60). Kamera, konum, kişiler ve ATT yok. | ✅ |
| PLATFORM-3 · Veli kapısı (BR-19) | 18 yaş altında satın alma ve mağaza abonelik bağlantıları yazıyla verilen çarpma sorusunun arkasında; 3 yanlışta 1 dk kilit (`src/features/parent-gate/`). Uygulamada başka dış bağlantı yok; yasal metinler uygulama içinde. Tek istisna bildirim izni için iOS Ayarlar'ı açan düğme. | ✅ |
| PLATFORM-3 · Kilit ekranında içerik | "Belgen hazır" push'u öğrencinin verdiği belge adını içerir (`process-document`); düşük risk. | ✅ |

### 3.6 MASVS-CODE

| Kontrol | StudyFlow'da nasıl karşılanıyor | Durum |
|---|---|---|
| CODE-1 · Güncel platform | COMP-01 iOS 17+. `app.json`'da dağıtım hedefi ayarlı değil; Expo SDK 58 varsayılanı geçerli. | 🔍 |
| CODE-2 · Güncelleme zorlaması | FR-ADM-04: `public.app_config` (en düşük ve en yeni sürüm, bakım modu) ve `src/features/app-gate` (`AppGate`: zorunlu güncelleme ve bakım ekranı, bir kerelik "yeni sürüm" sorusu) yazıldı; kök düzene bağlanması bekleniyor. `expo-updates` yüklü değil; `eas.json` kanalları ve `preview.yml`'deki `eas update` derlemeye bağlanmamış (proje planı §11.3 geri alma buna dayanıyor). | ❌ T-25 |
| CODE-3 · Bilinen açığı olan bileşen yok (SEC-07) | Her PR'da `npm audit --audit-level=high` ve gitleaks. Edge Functions bağımlılıkları (`supabase/functions/deno.json`) denetlenmiyor; Actions sürüm etiketiyle, Supabase CLI ve EAS CLI `latest` ile çalışıyor. | ⚠️ T-07 |
| CODE-4 · Sunucuda girdi doğrulama (SEC-06) | `readJson` boyut sınırı (16 KB; webhook 64 KB), e-posta normalizasyonu, UUID ve token desenleri, konu ve amaç izin listeleri, mesaj uzunluğu; tablolarda CHECK kısıtları; e-posta şablonlarında HTML kaçışı (`_shared/email-templates.ts`). | ✅ |
| CODE-4 · Yüklenen dosya doğrulaması (SEC-10) | Bucket yalnızca `application/pdf` (istemcinin bildirdiği tür) ve ≤ 25 MiB kabul eder. `process-document` boyutu yeniden kontrol eder; sayfa sayısını PDF'ten değil satırdaki `page_from`/`page_to`'dan alır; dosya imzası kontrolü görülmedi. | ⚠️ T-14 |
| CODE-4 · SQL enjeksiyonu | Sorgular supabase-js ile parametreli; `security definer` fonksiyonlar `search_path = ''` ile. | ✅ |

### 3.7 MASVS-RESILIENCE (L1'de zorunlu değil)

| Kontrol | Durum ve gerekçe |
|---|---|
| RESILIENCE-1 · Jailbreak tespiti | Yok (T-06). Kota, onay ve abonelik kuralları sunucuda zorlanıyor. |
| RESILIENCE-2 · Kurcalama önleme | Yok. Değiştirilmiş istemci sunucu kurallarını aşamaz (RLS, tetikleyiciler, fonksiyon kontrolleri). |
| RESILIENCE-3 · Statik analizi zorlaştırma | Hermes bayt kodu (varsayılan), karartma yok. Pakette sır olmadığı için ek fayda düşük. |
| RESILIENCE-4 · Dinamik analizi zorlaştırma | Yok. |

### 3.8 MASVS-PRIVACY

| Kontrol | StudyFlow'da nasıl karşılanıyor | Durum |
|---|---|---|
| PRIVACY-1 · Veri en aza indirme (PRIV-01) | Ad-soyad, okul, telefon, konum istenmez; doğum yılı alınır, rumuz isteğe bağlı. Apple ile girişte yalnızca e-posta kapsamı istenir. | ✅ |
| PRIVACY-1 · Yapay zekâya kişisel veri gitmez (PRIV-02, BR-05) | Sistem istemi yalnızca sınıf, segment ve ders adını alır (`_shared/ai/prompts.ts`); istek gövdeleri ve belge metni loglanmaz. İstemci istek testi e-posta ve ad alanlarını arar (`src/services/ai/__tests__/request.test.ts`); sunucu istemi için otomatik test yok. Belgenin kendisi kişisel veri içerebilir (H-11). | ⚠️ |
| PRIVACY-2 · Tanımlamayı önleme (PRIV-04) | IDFA/AAID ve ATT yok; analitik hiçbir kimlik taşımaz ve üçüncü tarafa gitmez (ADR-006): sunucu kullanıcı kimliği ve IP saklamaz, olay zamanını saate yuvarlar. RevenueCat'te kullanıcı kimliği rastgele hesap UUID'si, `automaticDeviceIdentifierCollectionEnabled: false`, `diagnosticsEnabled: false` (`src/services/purchases.ts`). | ✅ |
| PRIVACY-3 · Yasal metinler (PRIV-09) | Aydınlatma, gizlilik, koşullar uygulama içinde ve sürümlü (`src/features/legal/texts.ts`); hâlâ taslak (`LEGAL_DRAFT = true`, yer tutucular). | ❌ H-01 |
| PRIVACY-3 · Yapay zekâ bilgilendirmesi (FR-CON-05, US-18) | İlk yüklemeden önce gönderilen ve gönderilmeyen veriler gösterilip onay alınır (`src/app/(app)/ai-notice.tsx`); 18 yaş altında velinin "yapay zekâ" amacı ayrıca gerekir. Metin sağlayıcının üçüncü taraf olduğunu ve adını söylemiyor (Apple 5.1.2(i)). | ⚠️ T-21 |
| PRIVACY-3 · Mağaza etiketleri SDK listesiyle tutarlı (PRIV-05, STORE-02) | §6 envanteri; [app-store.md](../store/app-store.md) ve [play-store.md](../store/play-store.md) bu tablodan türetildi. RevenueCat'in topladığı cihaz bilgisi teyit bekliyor. | 🔍 |
| PRIVACY-4 · Hesap silme (PRIV-07, STORE-03) | Uygulama içi: Ayarlar > Hesap ve silme > Hesabımı sil. Web: `web/delete-account/index.html` → `support` (`account_deletion`); ekip sahipliği e-postayla doğrulayıp siler. Doğrulama adımı yazılı süreç olarak eksik. | ⚠️ T-16, H-12 |
| PRIVACY-4 · Rıza yönetimi (PRIV-06) | Veli onay sayfasında amaç seçer (yapay zekâ, bildirim) ve onayı geri alabilir; kayıtlar yalnızca eklenir. | ✅ |
| PRIVACY-4 · Veri kopyası (FR-ACC-07) | US-14 R1.1'de. R1'de KVKK başvurusu destek formuyla elle yanıtlanır. Ayarlar'daki "veri kopyası" ipucu metni var, özellik yok. | ⚠️ H-12 |

## 4. Sunucu tarafı

### 4.1 Veritabanı (`supabase/migrations/20261104000001_init.sql`)
- **RLS her tabloda açık.** Kullanıcı tablolarında sahip politikaları (`auth.uid() = user_id`); `anon` rolünün
  tüm tablo yetkileri ve `authenticated` rolünün TRUNCATE yetkisi geri alınmış; `public` fonksiyonların
  çalıştırma yetkisi `anon`'dan alınmış, sunucu RPC'leri yalnızca `service_role`'e açık.
- **Yalnızca ekleme:** `consent_records` ve `card_reviews` üzerindeki `private.append_only` tetikleyicisi
  güncelleme ve silmeyi servis rolü için de engeller. Tek istisna hesap silme zinciri (`studyflow.purge_user`).
  Uygulama yalnızca `requested` kaydı ekleyebilir; `granted`/`revoked` yalnızca `consent` fonksiyonundan gelir.
- **Sunucuya ait sütunlar tetikleyiciyle korunur:** `profiles.plan`, `email`, `consent_status`
  (`protect_profile`); `documents` iş durumu ve kota (`guard_document`); `content_reports` inceleme alanları
  (`protect_report`). Onboarding sonrası doğum yılı değişikliği onay durumunu değiştirmez.
- **Özel şema:** `private.account_activity`, `subscription_events`, `retained_consent_records`,
  `retained_subscriptions`. API yalnızca `public` ve `graphql_public` şemalarını açar (`supabase/config.toml`).
- **Telemetri ve izleme (`20261107000001_telemetry_and_ops.sql`, ADR-006):** `private.telemetry_events`,
  `crash_reports`, `telemetry_daily`, `crash_daily`, `telemetry_rate`, `function_requests`, `ops_alerts`.
  Hiçbirinde kullanıcı, cihaz, kurulum, oturum kimliği veya IP sütunu yok (pgTAP bunu denetler). Yazma
  yalnızca servis rolüne açık RPC'lerle (`telemetry_ingest`, `ops_record_request`, `ops_alert_save`);
  `anon` ve `authenticated` için çalıştırma yetkisi geri alındı. Hız sınırı sayacının anahtarı
  kullanıcı kimliği + saatin HMAC özetidir, 2 saat sonra silinir. İzleme görünümleri ayrı `ops`
  şemasında (API'ye kapalı, `security_invoker`), yalnızca SQL editöründen okunur. Sütun kısıtları
  (ad deseni, platform listesi, `props` ≤ 1 KB, metin uzunlukları) fonksiyondaki doğrulamanın ikinci hattı.
- **Uzak uygulama ayarı (`20261107000002_app_config.sql`):** `public.app_config` tek satır (`id = 1`);
  `anon` ve `authenticated` yalnızca okur (RLS + yalnızca `select` yetkisi), yazma yalnızca servis rolü.
  Sürümler desenle, mağaza bağlantıları `https://` ile sınırlı; bakım mesajı ≤ 300 karakter. Kişisel veri yok.
- **Depolama:** özel `documents` bucket'ı, `<user id>/` klasörüne sahip politikaları, 25 MiB ve yalnızca PDF.
  Uygulama PDF indirmez, imzalı bağlantı (SEC-04) şu an kullanılmıyor. Başka cihazda PDF görüntüleme gelirse
  ≤ 10 dk imzalı bağlantı şart.
- **Servis rolü yalnızca Edge Functions'ta** (`_shared/admin.ts`); `check-secrets.mjs` uygulama kodunda
  `SUPABASE_SERVICE_ROLE` geçerse CI'ı durdurur.
- **Testler:** `supabase/tests/telemetry_ops.test.sql` (pgTAP, 62 kontrol): telemetri, izleme ve
  `app_config` tablolarına kullanıcı ve `anon` erişimi, sunucu RPC yetkileri, saatlik sınır, saklama
  süreleri, kimlik sütunu olmaması, izleme görünümleri ve pg_cron işleri.
  `supabase/tests/rls.test.sql` (pgTAP, 203 kontrol): her tabloda başka kullanıcının okuma, ekleme,
  güncelleme, silme denemesi; depolama klasörleri; sunucuya ait tablolar; yalnızca ekleme; sunucu sütunları;
  BR-14 kotası; BR-18 saklama kopyası. CI'da Supabase CLI ile her PR'da çalışır. Eksik: `anon` rolüyle
  erişim testi ve doğum yılı değişikliği testi.

### 4.2 Edge Functions

| Fonksiyon | Çağıran ve doğrulama | Girdi kontrolü | Notlar |
|---|---|---|---|
| `consent-request` | Öğrenci, JWT (`verify_jwt = true` + `requireUser`) | E-posta normalizasyonu, kendi e-postası olamaz, 16 KB | Gönderim başarısızsa token geri silinir. |
| `consent` | Herkese açık; bağlantı token'ı tek kimlik | Token deseni, amaç izin listesi | IP ve tarayıcı bilgisi rıza kaydına yazılır (H-05). IP önce platformun `cf-connecting-ip` / `x-real-ip` başlığından, yoksa `X-Forwarded-For`'un ilk değerinden alınır (son seçenek istemcice yazılabilir; yalnızca kanıt, erişim kararı değil). |
| `delete-account` | Kullanıcı, JWT | — | Önce Storage, sonra auth kullanıcısı (zincirleme silme), sonra e-posta. |
| `revenuecat-webhook` | Paylaşılan sır (Authorization) | 64 KB, olay kimliği | Olay kimliğiyle tekrarlar etkisiz. Sandbox olayları da Pro verir (App Review için bilinçli). |
| `consent-maintenance` | `CRON_SECRET` (pg_cron, Vault) | — | `dryRun` destekler; hatalar diğer işleri durdurmaz. |
| `support` | İsteğe bağlı JWT; herkese açık web formu | E-posta, 5–5000 karakter, konu izin listesi, UUID | Ekibe e-posta, Reply-To kullanıcı adresi. |
| `process-document` | Öğrenci, JWT (anon istemci + `getUser`); belge RLS ile okunur | UUID, kota, sayfa sınırı | Sahibi başka ekip (yalnızca okundu). Onay ve "yapay zekâ" amacı sunucuda kontrol edilir. |
| `telemetry` | Giriş yapmış kullanıcı, JWT (`verify_jwt = true` + `requireUser`); kimlik kayda yazılmaz | 64 KB, en çok 50 kayıt, olay sözlüğü izin listesi (`_shared/telemetry.ts`, `EVENTS` ile Jest testiyle eşit), çökme metni yeniden temizlenir | Bilinmeyen olay ve özellik atlanır; saatte 300 kayıt sınırı (429). |
| `ops-alerts` | `CRON_SECRET` (pg_cron, 5 dakikada bir, Vault) | — | `dryRun` destekler; ekibe yalnızca sayılar gider. Durum `private.ops_alerts`'ta; aynı uyarı tekrar e-posta atmaz. |

Her fonksiyon `withMetrics` (`_shared/metrics.ts`) ile sarılır: yanıtlar dakika ve durum sınıfına göre
sayılır (`private.function_requests`, istek içeriği yok); `ops-alerts` OBS-03 hata oranını buradan hesaplar.

CORS, `CORS_ALLOWED_ORIGIN` ile onay sayfasının kökenine daraltılmalı; tanımsızsa `*` (çerez kullanılmadığı için
kabul edilebilir, yine de staging ve prod'da tanımlanır).

### 4.3 Hız sınırları (SEC-06)

| Uç nokta | Sınır | Durum |
|---|---|---|
| `consent-request` | İlk bağlantı serbest, sonra İstanbul gününe 3 gönderim, hesap başına | ✅ |
| `support` | Adres başına 24 saatte 5 | ⚠️ IP sınırı yok; farklı adreslerle ekip posta kutusu doldurulabilir (T-13) |
| `consent` (açık) | Yok; 256 bit token tahmin edilemez | ✅ |
| `telemetry` | Kullanıcı başına saatte 300 kayıt; sayaç kimliksiz (HMAC anahtar, 2 saat) | ✅ |
| `process-document` | Aylık kota (BR-14, `document_quota` + `guard_document`). SEC-06'daki "saatte 10 yükleme" kodda görülmedi | 🔍 T-13 |
| Supabase Auth | E-posta gönderimi en sık dakikada bir (`max_frequency`); panel hız sınırları | 🔍 |

### 4.4 Supabase panel ayarları (her barındırılan proje: dev, staging, prod)
`supabase/config.toml` yalnızca yerel yığını ayarlar; aşağıdakiler panelde elle yapılır ve kaydedilir.
- [ ] Bölge AB (Frankfurt, eu-central-1).
- [ ] Auth: Site URL ve yönlendirme adresleri `config.toml` ile aynı; e-posta doğrulaması açık; en az 8 karakter; sızdırılmış parola koruması (planda varsa) açık; anonim giriş kapalı; JWT 3600 sn; rotasyon açık.
- [ ] Auth SMTP: Resend; gönderen alan adında SPF, DKIM, DMARC.
- [ ] Apple sağlayıcısı: client ID = `com.cobanov.studyflow`.
- [ ] Vault: `project_url` ve `cron_secret` (= `CRON_SECRET`).
- [ ] Fonksiyon sırları §5'teki listeyle tam; `CORS_ALLOWED_ORIGIN` tanımlı.
- [ ] GraphQL kullanılmıyorsa `pg_graphql` kapalı.
- [ ] Veritabanı: SSL zorunlu; ağ kısıtlaması değerlendirildi.
- [ ] Yedek ve PITR ayarı kaydedildi (REL-04, H-07); log saklama ≤ 30 gün (PRIV-08).
- [ ] Ekip üyeleri en az yetkiyle, iki adımlı doğrulama açık (SEC-09); prod erişimi olanlar listelendi.

## 5. Gizli bilgi yönetimi

Kural: uygulamada sır yoktur (SEC-02). `EXPO_PUBLIC_*` değerleri herkese açık kabul edilir.

| Gizli bilgi | Kullanan | Nerede durur |
|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY` | Edge Functions | Edge runtime'ın kendisi sağlar; depoda ve uygulamada yok |
| `ANTHROPIC_API_KEY` | `process-document`; yerelde `server/dev-ai.ts` | `supabase secrets set`; yerelde `.env.local` (git dışı) |
| `RESEND_API_KEY` | `_shared/email.ts`; Auth SMTP parolası | `supabase secrets set`; Supabase Auth SMTP ayarı |
| `CRON_SECRET` | `consent-maintenance`, `ops-alerts` | `supabase secrets set` + Vault `cron_secret` (aynı değer) |
| `TELEMETRY_HASH_SALT` | `telemetry` (hız sınırı anahtarı, en az 16 karakter) | `supabase secrets set`; yoksa fonksiyon 500 döner. Değiştirmek yalnızca o saatin sayaçlarını sıfırlar |
| `REVENUECAT_WEBHOOK_SECRET` | `revenuecat-webhook` | `supabase secrets set` + RevenueCat panelindeki Authorization değeri |
| `EXPO_ACCESS_TOKEN` (isteğe bağlı) | `_shared/push.ts` | `supabase secrets set`; Expo'da "push güvenliği" açılırsa zorunlu |
| `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD` | `supabase.yml` | GitHub ortamları `staging` ve `production` (prod onaylı) |
| `EXPO_TOKEN` | `preview.yml` | GitHub depo sırrı |
| `GITLEAKS_LICENSE` | `ci.yml` | GitHub sırrı (yalnızca organizasyon deposunda) |
| Apple imza sertifikaları, App Store Connect API anahtarı | EAS Build/Submit | EAS kimlik bilgileri; `.gitignore` `*.p8`, `*.p12`, `*.key` dışarıda tutar |
| Apple Sign in secret (yalnızca web akışı) | Supabase Auth | Gerekmiyor (yerel akış); kullanılırsa panelde |

Gizli olmayan yapılandırma: `EMAIL_FROM`, `EMAIL_REPLY_TO`, `SUPPORT_TEAM_EMAIL`, `CONSENT_WEB_URL`,
`CONSENT_TEXT_VERSION`, `CORS_ALLOWED_ORIGIN`, `EMAIL_PROVIDER`, `AI_MODEL`, `AI_MONTHLY_BUDGET_USD`
(`process-document` uyarısı ve `ops-alerts` bütçe eşiği, varsayılan 250), `OPS_ALERT_EMAIL` (`ops-alerts`
alıcısı; yoksa uyarılar yalnızca fonksiyon loguna yazılır). Bunlar da `supabase secrets set` ile girilir.
Not: `.gitignore` yalnızca `.env*.local` dosyalarını dışlıyor; `.env` dışlanmıyor (T-22).

## 6. SDK ve servis veri envanteri (PRIV-05, STORE-02)

Mağaza formları ([app-store.md](../store/app-store.md) §8, [play-store.md](../store/play-store.md) §4) bu tablodan
türetilir. Yeni SDK veya veri alanı eklenince önce bu tablo, sonra iki form güncellenir.

| SDK / servis | Ne için | Gönderilen / alınan veri | Nereye | Kimlikle ilişkili | Takip |
|---|---|---|---|---|---|
| `@supabase/supabase-js` (Auth, Postgres, Storage, Functions) | Hesap, eşitleme, belge deposu | E-posta, şifre (Auth), rumuz, doğum yılı, sınıf, hedef sınav, uyku saatleri, veli e-postası, tüm çalışma verisi, seçilen PDF sayfaları, içerik bildirimleri, destek mesajı | Supabase, AB (Frankfurt) | Evet | Hayır |
| `expo-sqlite` (+ `expo-sqlite/localStorage`, `expo-sqlite/kv-store`) | Cihazda veri ve oturum; telemetri kuyruğu ve uzak ayar önbelleği (cihaz geneli, kimliksiz) | Dışarı göndermez | Cihaz | — | Hayır |
| `expo-secure-store` | Yerel modda oturum | Dışarı göndermez | Cihaz (Keychain) | — | Hayır |
| `expo-notifications` | Yerel hatırlatmalar; push token | Expo push token alınır ve `push_tokens` tablosuna yazılır | Expo → Supabase | Evet (token hesaba bağlı) | Hayır |
| Expo Push Service (sunucu) | "Velin onayladı", "Belgen hazır" | Push token, bildirim başlığı ve metni (belge adı olabilir) | Expo (ABD) → APNs | Token üzerinden | Hayır |
| `expo-application` | Destek kaydında sürüm | Uygulama sürümü ve derleme no; `Platform` ile iOS sürümü | Supabase (`support_tickets`), Resend (ekibe) | Evet (destek kaydı) | Hayır |
| `expo-network` | Bağlantı durumu | Dışarı göndermez | Cihaz | — | Hayır |
| `expo-document-picker`, `expo-file-system`, `pdf-lib` | PDF seçme, sayfa aralığını kesme | PDF cihazda kalır; yalnızca yapay zekâ işi başlayınca seçilen sayfalar yüklenir | Supabase Storage | Evet | Hayır |
| `expo-apple-authentication` | Apple ile giriş | Apple kimlik belirteci; yalnızca e-posta kapsamı (gizli röle adresi olabilir), ad istenmez | Apple → Supabase Auth | Evet | Hayır |
| `expo-crypto` | UUID, yerel modda parola özeti | Dışarı göndermez | Cihaz | — | Hayır |
| `expo-constants` | Push token için EAS proje kimliği | Dışarı göndermez | Cihaz | — | Hayır |
| `react-native-purchases` (RevenueCat) | Abonelik | App user id = hesap UUID; satın alma ve makbuz bilgisi; SDK'nın temel cihaz/OS bilgisi (platform, OS ve uygulama sürümü, bölge — RevenueCat dokümantasyonuyla teyit edilecek). IDFA toplanmaz | RevenueCat (ABD) | Evet | Hayır |
| RevenueCat webhook (sunucu) | Abonelik durumu | App user id, ürün, durum, mağaza işlem kimliği, bitiş tarihi | Supabase (`subscriptions`, `private.subscription_events`) | Evet | Hayır |
| Resend (sunucu) | İşlem e-postası | Veli onayı ve hatırlatma: veli e-postası + rumuz; onay sonucu: veli e-postası; hesap silindi ve hareketsizlik: hesap e-postası; destek: ekibe mesaj, Reply-To kullanıcı adresi, sürüm bilgisi; Auth e-postaları (SMTP) | Resend (bölge teyit edilecek) | Evet | Hayır |
| Anthropic Claude API (sunucu) | Özet, quiz, kart | Seçilen PDF sayfaları, sınıf, segment, ders adı. Kullanıcı kimliği gönderilmez | Anthropic (ABD) | Hayır | Hayır |
| Analitik / çökme raporu (kendi sunucumuz, ADR-006) | Ürün analitiği (KPI), JS çökme ve hata raporları | Olay adı, sözlükteki özellikler, uygulama sürümü, platform, OS ana sürümü; çökmede temizlenmiş hata türü, mesajı ve stack. JWT yalnızca hız sınırı için doğrulanır; kimlik, IP ve zaman damgası saklanmaz | Supabase, AB (Frankfurt) | Hayır | Hayır |
| Apple çökme raporları (Xcode Organizer, App Store Connect) | Yerel (native) çökmeler | Kullanıcının cihaz ayarında paylaşmayı seçtiği çökme ve teşhis verisi | Apple | Hayır | Hayır |

Veri işlemeyen modüller: `expo-haptics`, `expo-font` ve `@expo-google-fonts/literata` (yazı tipi pakete gömülü),
`expo-router`, `expo-symbols`, `expo-glass-effect`, `@expo/ui`, `ts-fsrs`, `i18next`, `zustand`. `expo-sharing`
(eklenti listesinde), `expo-device`, `expo-web-browser` ve `expo-image` yüklü ama `src/` içinde kullanılmıyor (T-26).

## 7. Veri saklama ve silme (BR-04, BR-18, BR-25, PRIV-07)

| Veri | Saklama | Silme | Durum |
|---|---|---|---|
| PDF (Storage) | Hesap veya belge silinene kadar | Hesap silmede hemen (`_shared/account.ts`); belge silmede uygulama nesneyi kaldırır (en iyi çaba, `src/services/ai/client.ts`) | ✅ |
| Kullanıcı tabloları | Hesap var oldukça | Auth kullanıcısı silinince zincirleme, hemen (BR-18'deki 30 günden sıkı). Kullanıcının sildiği satırlar eşitleme için 90 gün `deleted_at` ile kalır, sonra `public.purge_expired_data` (günlük) kalıcı siler | ✅ |
| Rıza kayıtları | Hesap silinince `private.retained_consent_records`'a kopya; `retain_until` = kayıt tarihi + 10 yıl (varsayım) | Süresi dolan `purge_expired_data` ile silinir | ⚠️ H-03 |
| Abonelik kayıtları | `private.retained_subscriptions`; `retain_until` = silme tarihi + 10 yıl (rıza kayıtlarından farklı başlangıç); `subscription_events` 10 yıl | Süresi dolan `purge_expired_data` ile silinir | ⚠️ H-03 |
| `private.subscription_events` | Yabancı anahtar yok, hesap silinince kalır (ödeme logu) | Süre tanımsız | ⚠️ H-03 |
| `consent_tokens` | Kullanılmamış ve süresi dolalı 30 günü geçmiş bağlantılar her gün silinir | Kullanılanlar hesapla silinir | ✅ |
| `support_tickets` | Hesaplı kayıt hesapla silinir | Web formundan gelen (hesapsız) kayıtlar için süre yok | ⚠️ H-03 |
| 13 yaş altı, onay bekleyen | Gün 7 ve 25'te veliye yeni bağlantıyla hatırlatma; gün 30'da hesap silinir ve e-posta | `consent-maintenance`, pg_cron her gün 07:00 UTC | ✅ |
| 13 yaş altı, onayı geri alınmış | Silinmiyor; yalnızca hareketsizlik kuralı uygulanır | — | 🔍 H-06 |
| Hareketsiz hesap (BR-25) | 12 ay işlem yoksa uyarı e-postası; 30 gün içinde giriş yoksa silme | Aynı iş; etkinlik `touch_activity` (günde bir) ve son girişten | ✅ |
| Cihaz verisi | Hesap silmede DB ve PDF'ler silinir | Çıkışta silinmez | ⚠️ T-03 |
| Yedekler | Supabase günlük yedekleri sağlayıcı takvimiyle düşer (plana göre ~7 gün; teyit) | Silinen veri bu süre boyunca yedekte kalır | 🔍 H-07 |
| Üçüncü taraf kopyaları | RevenueCat müşteri kaydı, Resend gönderim logları, Expo push makbuzları, Anthropic API saklaması | Hesap silmede bunlara silme isteği gitmiyor | ⚠️ H-10, T-17 |
| Telemetri (ADR-006) | Çökme raporları 30 gün (PRIV-08); ham olaylar 180 gün (bir okul dönemi); günlük sayımlar 2 yıl; hız sınırı sayaçları 2 saat; fonksiyon yanıt sayaçları 30 gün; uyarı durumu son değişiklikten 90 gün | `private.telemetry_housekeeping`, pg_cron saatte bir. Kimlik olmadığı için hesap silmede ayrıca silinecek kayıt yoktur | ✅ |
| Cihazdaki telemetri kuyruğu | En çok 500 kayıt (50 çökme), gönderilince silinir | Cihaz geneli; çıkışta kalır ama kimlik içermez | ✅ |

## 8. Loglama (PRIV-08)
- **Edge Functions:** e-posta adresleri `maskEmail` ile (`a***@alan.com`) loglanır; Resend hata gövdesi
  (alıcıyı içerebilir) loglanmaz, yalnızca durum kodu; `process-document` istek gövdesini ve belge metnini
  loglamaz, yalnızca belge kimliği ve hata kodunu yazar; `ai_usage` yalnızca token, süre ve maliyet tutar.
- `errorResponse` beklenmeyen hatanın mesajını loglarken içindeki e-posta adreslerini `maskEmails` ile
  maskeler (Postgres hata mesajları değer içerebilir).
- **Uygulama:** Supabase modunda analitik ve çökme raporları kimliksiz olarak kendi sunucumuza gider
  (ADR-006); yerel modun yayın derlemesinde sink sessiz. `console.warn` çağrıları kalıyor (T-20).
- **Telemetri:** çökme raporları log sayılır ve 30 gün tutulur; mesaj ve stack cihazda ve sunucuda iki kez
  temizlenir (e-posta, UUID, IP, 6+ haneli sayı, dosya yolu). `ops-alerts` e-postaları yalnızca sayı,
  hata türü ve uygulama sürümü içerir.
- **Saklama:** Supabase fonksiyon ve API loglarının süresi plana bağlı; ≤ 30 gün olduğu panelde teyit edilecek.
  Resend ve Expo log süreleri sözleşmeyle teyit edilecek (H-10).

## 9. CI güvenlik kontrolleri

| Kontrol | Nerede | Ne zaman | Durum |
|---|---|---|---|
| ESLint, TypeScript, Jest | `.github/workflows/ci.yml` (`checks`) | Her PR ve `main` | ✅ |
| Bağımlılık taraması (yüksek ve kritik) | `npm audit --audit-level=high` | Her PR ve `main` | ⚠️ Deno bağımlılıkları kapsam dışı |
| Paket sır taraması | `scripts/check-secrets.mjs`; ayrıca `preview.yml`'de OTA'dan önce | Her PR, her önizleme | ⚠️ Dışa aktarılmış paket (`expo export`) taranmıyor, yalnızca `src/` ve `app.json` |
| Geçmiş sır taraması | gitleaks (`secrets` işi, tüm geçmiş) | Her PR ve `main` | ✅ |
| RLS testleri | `supabase test db` (`database` işi) | Her PR ve `main` | ✅ |
| SQL lint | `supabase db lint --fail-on error` | Her PR ve `main` | ✅ |
| Edge Function testleri | Jest: `telemetry` doğrulaması ve `ops-alerts` kuralları; diğerleri yok | Proje planı §10.1'de her PR | ⚠️ T-27 |
| Prod dağıtım onayı | `supabase.yml`, `production` ortamı | Tech lead onayı | 🔍 GitHub'da zorunlu gözden geçiren ayarı |
| Dal koruması | `checks`, `secrets`, `database` zorunlu | — | 🔍 GitHub ayarı |
| Otomatik bağımlılık güncellemesi | — | — | ❌ T-07 |
| Actions sabitleme | Sürüm etiketleri (`@v4`), CLI'lar `latest` | — | ⚠️ T-07 |

## 10. Hukuk danışmanı için açık maddeler

Sahip: Hukuk danışmanı (aksi yazılmadıkça). Gereken tarih: yayın adayı (19 Mart 2027) öncesi; H-01 ve H-02
mağaza materyallerinden (12 Mart) önce.

1. **H-01 · Metinlerin onayı:** aydınlatma metni, gizlilik politikası, kullanım koşulları ve veli rıza sayfası
   metni (`src/features/legal/texts.ts`, `web/consent/index.html`). Yer tutucular: şirket unvanı ve adresi,
   KVKK başvuru adresi, sağlayıcı adları. PRIV-09 (çocuk ve veli için ayrı, sade dil).
2. **H-02 · Yurt dışına aktarım (Q-03):** veri Supabase AB'de; Anthropic, RevenueCat, Expo, Resend ve Google
   Fonts (onay sayfası) için hangi KVKK m. 9 mekanizması (açık rıza, standart sözleşme ve Kurul'a bildirim vb.)
   kullanılacak; aydınlatma metnindeki "Aktarım" bölümüne yansıması.
3. **H-03 · Saklama süreleri:** rıza kayıtları ve ödeme kayıtları için 10 yıl varsayımı (`private.before_user_deleted`);
   `subscription_events` ve hesapsız destek kayıtlarının süresi; iki tablodaki farklı başlangıç tarihi.
4. **H-04 · E-posta ile veli doğrulamasının yeterliliği:** öğrenci kendi ikinci e-posta adresini veli olarak
   yazabilir (yalnızca hesap e-postasıyla aynı adres engelleniyor). Ek önlem gerekip gerekmediği; kullanılmış
   bağlantının süresiz geçerli kalması.
5. **H-05 · IP adresi ve tarayıcı bilgisi:** rıza kaydında saklanıyor (`consent_records.ip`, `user_agent`);
   BRD §10.1'de var ama aydınlatma metninde yok. Metne eklenmesi ve delil değeri (IP istemcice değiştirilebilir başlıktan).
6. **H-06 · Rızası geri alınan 13 yaş altı hesaplar:** otomatik silinmiyor, kısıtlı modda kalıyor. Silinmeli mi,
   ne zaman?
7. **H-07 · Yedeklerde kalan veri:** silinen veri sağlayıcı yedek süresi boyunca yedekte kalır. Aydınlatma
   metnine ve "Hesabın silindi" e-postasına eklenmeli mi?
8. **H-08 · VERBİS:** kayıt yükümlülüğü değerlendirmesi.
9. **H-09 · Anthropic sözleşmesi (PRIV-03):** API verisinin model eğitiminde kullanılmadığı, saklama süresi,
   reşit olmayanların kullandığı ürünler için kullanım politikası şartları (BRD §12).
10. **H-10 · Veri işleme sözleşmeleri (DPA):** Supabase, RevenueCat, Resend, Expo. Hesap silindiğinde bu
    sağlayıcılardaki kopyaların (RevenueCat müşteri kaydı, e-posta logları) silinmesi.
11. **H-11 · Belge içeriğindeki kişisel veri:** yüklenen PDF öğrencinin veya üçüncü kişilerin adını içerebilir ve
    yapay zekâ sağlayıcısına gider. Aydınlatma metninde ve yükleme ekranında uyarı gerekir mi?
12. **H-12 · KVKK başvuruları ve veri kopyası:** R1'de destek formuyla elle yanıt (30 gün) yeterli mi; web'den
    hesap silme talebinde başvuranın hesap sahibi olduğunun nasıl doğrulanacağı.
13. **H-13 · Apple 5.1.4 ve 13 yaş altı kilit:** onaysız 13 yaş altı kullanıcı uygulamayı hiç kullanamıyor (BR-02).
    Mağaza reddi riski ile KVKK gereği arasındaki denge (Ürün sahibi ile birlikte).

## 11. Teknik açık maddeler

| ID | Madde | Öneri | Sahip | Ne zaman |
|---|---|---|---|---|
| T-01 | Oturum Keychain'de değil (SEC-05) | supabase-js için `expo-secure-store` tabanlı depo adaptörü. SecureStore 2048 bayttan büyük değerlerde uyarı veriyor; Supabase oturumu bunu aşar. İki yol: (a) değeri parçalara bölüp numaralı anahtarlarla saklamak, (b) rastgele AES-256 anahtarını SecureStore'da tutup şifreli oturumu SQLite'ta saklamak (Supabase'in Expo örneğindeki yaklaşım). Erişilebilirlik: `AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY` (arka planda yenileme için). Mevcut oturumu taşıyan geçiş. | Tech lead | Yayın öncesi (S8) |
| T-02 | Cihaz veritabanı şifresiz | `expo-sqlite`'ın SQLCipher seçeneği değerlendirilir (anahtar SecureStore'da; PERF-04 ölçülür). Seçilmezse iOS Veri Koruması'na dayanıldığı ADR ile kaydedilir. | Tech lead | R1 kararı S6 |
| T-03 | Çıkışta cihaz verisi kalıyor | Çıkışta `user-<id>.db` ve PDF'lerin silinmesi ya da "bu cihazdan verilerimi sil" seçeneği; eşitlenmemiş değişiklik varsa uyarı. | Tech lead + Ürün sahibi | S8 |
| T-04 | Sertifika sabitleme | L1'de planlanmıyor. Gerekçe: L2 kontrolü; Supabase ve RevenueCat sertifikalarını biz yönetmiyoruz, rotasyonda uygulama tümden kesilebilir; ATS + TLS 1.2 yeterli. L2 hedeflenirse yeniden değerlendirilir. | Tech lead | — |
| T-05 | Yayın derlemesinde yerel mod ve ATS | Yapıldı (7 Kasım 2026): `app.config.ts` preview/production EAS derlemesini Supabase değişkenleri ya da `https://` adres yoksa durdurur; yayın derlemesi yerel modda açılmaz (`src/features/release/`). Kalan: ilk EAS derlemesinin `Info.plist`'inde `NSAllowsArbitraryLoads` olmadığı ve `NSAllowsLocalNetworking`'in yalnızca debug'da kaldığı kontrol edilir. | Tech lead | İlk TestFlight derlemesi |
| T-06 | Jailbreak tespiti | L1'de yok (RESILIENCE, R profili). Kurallar sunucuda; istemci tespiti kolay atlatılır. | Tech lead | — |
| T-07 | Bağımlılık denetimi (SEC-07) | Haftalık Dependabot/Renovate; `deno.json` npm bağımlılıkları için denetim; Actions'ı commit SHA ile, Supabase ve EAS CLI'ı sürümle sabitleme. Kritik 7 gün, yüksek 30 gün; takip sorumlusu tech lead. | Tech lead | S6 |
| T-08 | E-posta bağlantısı akışı | `flowType: 'pkce'`, `auth/callback` rotası (`exchangeCodeForSession`), yeni şifre ekranı; evrensel bağlantı (associated domains) ile özel şema yerine `https` bağlantısı. | Tech lead | Yayın öncesi |
| T-09 | Apple girişinde nonce yok | Rastgele nonce üret, SHA-256'sını Apple'a, ham değerini `signInWithIdToken`'a ver. | Tech lead | S8 |
| T-10 | ✅ Doğum yılıyla onay atlama | Kapandı: `protect_profile` onboarding bittikten sonra `pending` hesabı doğum yılı değişse de `pending` tutar; pgTAP testi `supabase/tests/rls.test.sql`'de. | Tech lead | — |
| T-11 | BR-02 yalnızca istemcide | Onay bekleyen 13 yaş altı için çalışma tablolarına yazmayı RLS'te engellemek ya da riski kabul edip kaydetmek. | Tech lead + Hukuk danışmanı | S8 |
| T-12 | ✅ Push token çıkışta silinmiyor | Kapandı: eşitleme servisi çıkışta (oturum kapanmadan önce) bu cihazın token'ını `push_tokens`'tan siler (`src/services/sync/index.ts`). | Tech lead | — |
| T-13 | Genel hız sınırı (SEC-06) | `process-document` için saatte 10 sınırını doğrula (C1 kapsamı); `support` için IP başına sınır veya basit bot koruması; Auth hız sınırlarını panelde kaydet. | Tech lead | S8 |
| T-14 | Sunucuda PDF doğrulaması (SEC-10) | `process-document`: `%PDF` imzası, gerçek sayfa sayısı ve `page_from`/`page_to` tutarlılığı (C1 kapsamı). | Tech lead | S8 |
| T-15 | Veli onay sayfası | Yapıldı: Literata sayfayla birlikte, prod CSP'de yerel adres yok, çerçeve koruması. Kalan: `CORS_ALLOWED_ORIGIN` tanımla; `frame-ancestors`/HSTS başlığı gerekiyorsa sayfaları başlık gönderebilen bir barındırmaya (ör. Cloudflare Pages) taşı. | Tech lead | Yayın öncesi |
| T-16 | Web'den hesap silme (STORE-03) | Form yazıldı ve `web.yml` ile `/hesap-silme/` adresinde yayımlanacak (`analysis/go_live.md`). Kalan: hesap sahipliğini doğrulama süreci (H-12). | Tech lead + Ürün sahibi | Yayın öncesi |
| T-17 | RevenueCat kaydı silinmiyor | `delete-account` içinde RevenueCat REST API ile müşteri silme ya da saklamanın H-10 ile belgelenmesi. | Tech lead | S8 |
| T-18 | ✅ Silinen satırlar sunucuda kalıyor | Kapandı: `public.purge_expired_data` (`consent-maintenance` her gün çağırır) 90 günü geçen `deleted_at` satırlarını siler. | Tech lead | — |
| T-19 | Saklama süresi dolanları silme | Silme işi eklendi (`purge_expired_data`: `retained_*`, `subscription_events`, kapanmış destek talepleri 2 yıl). Kalan: iki tablonun `retain_until` başlangıcını H-03 kararına göre eşitlemek. | Tech lead | R1.1 |
| T-20 | Loglarda kişisel veri | Sunucu kısmı kapandı (`errorResponse` e-postaları maskeler). Kalan: yayın derlemesinde `console.*` çağrılarını kaldır ya da sustur. | Tech lead | S8 |
| T-21 | Yapay zekâ bilgilendirmesi | Metne "üçüncü taraf yapay zekâ sağlayıcısı (Anthropic)" ifadesi ve açık izin düğmesi (Apple 5.1.2(i)). | Ürün sahibi + Hukuk danışmanı | Yayın öncesi |
| T-22 | `.env` git'e girebilir | `.gitignore`'a `.env` ekle (gitleaks ikinci savunma). | Tech lead | Hemen |
| T-23 | Privacy manifest | Yayın derlemesinde `PrivacyInfo.xcprivacy` ve Xcode gizlilik raporu kontrolü; gerekirse `ios.privacyManifests`. | Tech lead | S8 |
| T-24 | Cihaz yedeği | DB ve PDF'lerin iCloud yedeğine girmesi kabul mü, dışlansın mı (yedekten dönen cihazda oturum da gelir; T-01 ile `THIS_DEVICE_ONLY` çözer). | Tech lead | S8 |
| T-25 | Güncelleme zorlaması ve OTA | `expo-updates` kurulumu ve kanal bağlantısı (STORE-05, §11.3). FR-ADM-04 zorunlu güncelleme ve bakım: `app_config` + `AppGate` hazır; `ios_store_url` App Store kimliği alınınca doldurulur. | Tech lead | S7 |
| T-26 | Kullanılmayan bağımlılıklar | `expo-sharing` eklentisi, `expo-device`, `expo-web-browser`, `expo-image` gerçekten gerekmiyorsa kaldırılır (saldırı yüzeyi ve envanter sadeleşir). | Tech lead | S8 |
| T-27 | Edge Function testleri | Yetki, girdi doğrulama, hız sınırı ve hata yanıtları için Deno testleri; CI'a iş olarak eklenir. Kısmen: `telemetry` doğrulaması ve `ops-alerts` kuralları saf modüllerde, Jest'te test ediliyor (`src/services/telemetry/__tests__`); `scripts/integration/functions-smoke.ts` ikisini yerel yığında dener. | Tech lead | S6 |

## 12. Onay

| Rol | Ad | Tarih | Karar |
|---|---|---|---|
| Tech lead (§3–§9, §11) | | | |
| Hukuk danışmanı (§6, §7, §10) | | | |
| Ürün sahibi (H-13, T-03, T-16, T-21) | | | |

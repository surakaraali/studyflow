# StudyFlow — Yayına çıkış runbook'u (R1, iOS)

| Alan | Değer |
|---|---|
| Doküman | Hesapları açmaktan App Store'a göndermeye kadar sıralı adımlar |
| Sürüm | 1.0 |
| Tarih | 7 Kasım 2026 |
| Sahip | Tech lead (adımları yürütür); kararlar §1'deki sahiplerde |
| İlgili | [Güvenlik incelemesi](security_review.md) §4.4 ve §5 · [ADR-004](adr/ADR-004-e-posta-saglayicisi.md) · [ADR-006](adr/ADR-006-birinci-taraf-telemetri.md) · [App Store taslağı](../store/app-store.md) · [Google Play taslağı](../store/play-store.md) · [Proje planı](../agile/project_plan.md) §11 · [PLAN.md](../PLAN.md) §6 |

Kod, şema, fonksiyonlar, web sayfaları ve mağaza metinleri hazır. Yayına çıkmak; hesapları açmak, anahtarları
dosyalara yazmak ve aşağıdaki adımları sırayla çalıştırmaktır. Her adımda dört şey yazar:
**Hesap** (nerede işlem yapılır), **Komut**, **Gizli bilgi** (hangi değer nereye gider) ve **Kontrol**
(işe yaradığını nasıl anlarsın).

## 0. Başlamadan önce

**Ortamlar.** İki Supabase projesi vardır: `staging` (TestFlight iç testi, preview derlemeleri) ve
`production`. Her adımı önce staging'de, sonra production'da yap; komutlar aynı, yalnızca env dosyası değişir.
Aşağıdaki örnekler production içindir.

**Gizli bilgiler depoya girmez.** Hepsini deponun dışındaki bir klasörde tut, ör.
`../studyflow-secrets/` (depo herkese açık). `supabase-setup.sh` depo içindeki ve gitignore'da olmayan bir
dosyayı reddeder.

| Dosya | İçerik | Kontrol komutu |
|---|---|---|
| `../studyflow-secrets/supabase.prod.env` | Supabase CLI ayarları ve bütün fonksiyon sırları | `npm run go-live:check-env -- --target supabase --env-file ../studyflow-secrets/supabase.prod.env` |
| `../studyflow-secrets/supabase.staging.env` | Aynısı, staging için | aynı komut, staging dosyasıyla |
| `../studyflow-secrets/app.production.env` | `eas env:pull` çıktısı (yalnızca `EXPO_PUBLIC_*`) | `npm run go-live:check-env -- --target app --env-file ../studyflow-secrets/app.production.env` |

Hangi anahtarların gerektiğini ezbere bilmen gerekmez: `npm run go-live:check-env -- --list` hepsini, nerede
kullanıldıklarıyla listeler. Liste her çalıştırmada `.env.example`, [güvenlik incelemesi §5](security_review.md#5-gizli-bilgi-yönetimi),
fonksiyon kodu, uygulama kodu, `supabase/config.toml` ve iş akışlarından yeniden çıkarılır; koda yeni bir
anahtar eklenirse kontrol onu "eksik" diye gösterir. Değerler hiçbir zaman ekrana yazılmaz.

**Araçlar:** Node.js 22, `npm ci`, Supabase CLI 3.0.0 (`supabase --version`), Docker (ör. Colima; yoksa
fonksiyonlar `--use-api` ile yüklenir), Xcode ve iOS simülatörü, `npx eas-cli@latest`. Başlamadan
`npm test` ve `npx tsc --noEmit` temiz olmalı.

**Yer tutucular.** Bu dokümanda `https://studyflow.app` alan adı (Q-08 kesinleşene kadar), `<prod-ref>` ve
`<staging-ref>` (Supabase proje kimlikleri, 20 küçük harf) yer tutucudur. Gerçek değerler §2'deki listede
tek tek değiştirilir.

## 1. Engeller ve sahipleri

Bu kararlar kapanmadan **mağazaya gönderim yapılmaz** (adım 11). Teknik adımlar (1–10) beklemeden yürür;
kararlar geldikçe ilgili değer güncellenir.

| ID | Karar | Sahip | Etkilediği adımlar | Gereken tarih |
|---|---|---|---|---|
| Q-02 | Veli onayı hangi yaş aralığında zorunlu (taslak: 18 altı; 13–17 kısıtlı mod) | Hukuk danışmanı | Yasal metinler, veli onay sayfası, inceleme notu (adım 9, 11) | Hukuk onayıyla birlikte |
| Q-03 | Yurt dışına aktarım için KVKK mekanizması (Anthropic, Resend, RevenueCat, Expo; H-02) | Hukuk danışmanı | Aydınlatma metni "Aktarım" bölümü, veri işleme sözleşmeleri (H-10), adım 1–3, 7 | 12 Mart 2027 öncesi |
| Q-05 | Pro fiyatı ve ücretsiz kota | Ürün sahibi | App Store Connect abonelik fiyatları (adım 6), RevenueCat ürünleri (adım 7), mağaza açıklaması | Adım 6 öncesi |
| Q-07 | App Store kategorisi: Kids (9–11) mi, Eğitim mi | Ürün sahibi + Hukuk danışmanı | Yaş derecelendirmesi ve kategori ([app-store.md §7](../store/app-store.md#7-kategori-ve-yaş-derecelendirmesi-q-07)), adım 6 ve 11 | Adım 6 öncesi |
| Q-08 | "StudyFlow" adı ve alan adı müsait mi | Ürün sahibi | §2'deki **bütün** URL'ler, Resend alan adı, `EMAIL_FROM`, uygulama adı (adım 1, 5, 6) | Adım 1 öncesi |
| H-01 | Yasal metinlerin hukuk onayı (aydınlatma, gizlilik, koşullar, veli rıza sayfası) | Hukuk danışmanı | `src/features/legal/texts.ts` (`LEGAL_DRAFT = false`, gerekirse `LEGAL_VERSION`), web sayfaları, gizlilik URL'si (adım 5, 11) | 12 Mart 2027 öncesi |

Onaylandığında: `texts.ts`'de `LEGAL_DRAFT` `false` yapılır, köşeli parantezli yer tutucular doldurulur,
metnin anlamı değiştiyse `LEGAL_VERSION` artırılır ve aynı değer fonksiyon sırrı `CONSENT_TEXT_VERSION`'a
yazılır. Web sayfaları bir sonraki dağıtımda taslak uyarısı olmadan çıkar (aynı kaynaktan üretilir).

Q-06 (e-posta sağlayıcısı) ADR-004 ile geçici olarak Resend kabul edildi; runbook Resend'i varsayar.

## 2. Son adrese bağlı yerler

Alan adı kesinleşince (Q-08) ya da değişince bu tablodaki her yer güncellenir. Alan adı bağlanana kadar
site `https://surakaraali.github.io/studyflow/` altında da çalışır (bütün iç bağlantılar göreli); o dönemde
aşağıdaki değerlerde `https://studyflow.app` yerine bu adres, köken olarak da `https://surakaraali.github.io`
kullanılır.

| Ne | Değer (yer tutucu) | Nerede ayarlanır | Adım |
|---|---|---|---|
| Site kökü | `https://studyflow.app/` | GitHub → Settings → Pages → Custom domain; repo değişkeni `WEB_BASE_URL` | 5 |
| Veli onay sayfası | `https://studyflow.app/veli-onayi/` | Fonksiyon sırrı `CONSENT_WEB_URL` (e-postalardaki bağlantı); EAS değişkeni `EXPO_PUBLIC_CONSENT_WEB_URL`; kod varsayılanları `src/services/config.ts` ve `supabase/functions/_shared/consent.ts` (`/veli-onayi/`) | 4, 8 |
| Web kökeni (CORS) | `https://studyflow.app` (yol ve `/` yok) | Fonksiyon sırrı `CORS_ALLOWED_ORIGIN` | 4 |
| Gizlilik politikası | `https://studyflow.app/gizlilik/` | App Store Connect → App Privacy → Privacy Policy URL; mağaza açıklaması (app-store.md §4); Play Console | 6, 11 |
| Kullanım koşulları | `https://studyflow.app/kosullar/` | Mağaza açıklaması (EULA satırı) ya da App Store Connect → License Agreement | 6, 11 |
| Destek | `https://studyflow.app/destek/` | App Store Connect → Support URL; Play Console | 6, 11 |
| Pazarlama | `https://studyflow.app/` | App Store Connect → Marketing URL | 6 |
| Web'den hesap silme | `https://studyflow.app/hesap-silme/` | Play Console → Veri güvenliği → hesap silme URL'si; inceleme notu; uygulamadaki "web sitemizdeki form" metni (`account.webForm`) | 11 |
| Aydınlatma metni | `https://studyflow.app/aydinlatma-metni/` | Veli onay ve silme sayfaları göreli bağlantıyla açar; ayar gerekmez | — |
| Destek e-postası | `destek@studyflow.app` | EAS `EXPO_PUBLIC_SUPPORT_EMAIL`; fonksiyon sırları `SUPPORT_TEAM_EMAIL`, `EMAIL_REPLY_TO`; repo değişkeni `EXPO_PUBLIC_SUPPORT_EMAIL` (web) | 4, 5, 8 |
| Gönderen adres | `StudyFlow <no-reply@studyflow.app>` | Fonksiyon sırrı `EMAIL_FROM`; Supabase Auth SMTP gönderen adresi; Resend alan adı | 1, 4 |
| KVKK başvuru adresi | `[kvkk@studyflow.app — kesinleşecek]` | `src/features/legal/texts.ts` (`KVKK_CONTACT`), H-01 ile | H-01 |
| Uyarı e-postası | ekip posta kutusu | Fonksiyon sırrı `OPS_ALERT_EMAIL` | 4 |
| RevenueCat webhook | `https://<prod-ref>.supabase.co/functions/v1/revenuecat-webhook` | RevenueCat → Integrations → Webhooks | 7 |
| Web sayfalarının API'si | `https://<prod-ref>.supabase.co/functions/v1` | Repo değişkeni `WEB_FUNCTIONS_URL` (staging: `WEB_STAGING_FUNCTIONS_URL`) | 5 |
| App Store bağlantısı | `https://apps.apple.com/tr/app/studyflow/id<App Store id>` | `public.app_config.ios_store_url`; repo değişkeni `WEB_APP_STORE_URL` (tanıtım sayfasındaki düğme) | 6, 12 |
| EAS gönderim | App Store Connect uygulama kimliği, takım kimliği | `eas.json` → `submit.production.ios.ascAppId`, `appleTeamId` (`REPLACE_WITH_…`) | 8 |

Supabase Auth'un yönlendirme adresleri web'e değil uygulamaya döner (`studyflow://`, `config.toml`); Apple ile
giriş yerel akış olduğu için web dönüş adresi gerekmez.

## 3. Adımlar

### Adım 1 · Alan adı ve e-posta (Resend: SPF, DKIM, DMARC)

| Hesap | Komut | Gizli bilgi | Kontrol |
|---|---|---|---|
| Alan adı kayıt firması; resend.com | `dig` ile DNS kontrolü | `RESEND_API_KEY`, `EMAIL_FROM` | Resend'de alan adı "Verified"; kendine test e-postası |

1. Alan adını al (Q-08). `.app` uzantısı yalnızca HTTPS ile açılır; GitHub Pages sertifikayı kendisi verir.
2. Resend'de hesap aç, **Domains → Add domain**: `studyflow.app`, bölge **EU (Ireland)**.
3. Resend'in verdiği kayıtları DNS'e gir: `send` alt alan adı için MX ve SPF (TXT), DKIM için
   `resend._domainkey` (TXT). DMARC'ı kendin ekle: `_dmarc` TXT
   `v=DMARC1; p=none; rua=mailto:destek@studyflow.app` (iki hafta rapor izlenir, sonra `p=quarantine`).
4. Resend → **API Keys → Create**: izin "Sending access", alan adı `studyflow.app`. Fonksiyonlar için bir,
   Supabase Auth SMTP için ayrı bir anahtar oluştur (birini değiştirmek diğerini bozmasın).
5. `supabase.prod.env` dosyasına: `RESEND_API_KEY=re_…`, `EMAIL_FROM="StudyFlow <no-reply@studyflow.app>"`,
   `EMAIL_REPLY_TO=destek@studyflow.app`, `SUPPORT_TEAM_EMAIL=destek@studyflow.app`.

Kontrol:
```bash
dig +short TXT resend._domainkey.studyflow.app
```
```bash
dig +short TXT send.studyflow.app
```
```bash
dig +short TXT _dmarc.studyflow.app
```
Üçü de değer döndürmeli ve Resend panelinde alan adı **Verified** görünmeli. Gerçek gönderim adım 4'teki
SMTP testinde denenir.

### Adım 2 · Anthropic API anahtarı ve bütçe

| Hesap | Komut | Gizli bilgi | Kontrol |
|---|---|---|---|
| console.anthropic.com (şirket hesabı) | — | `ANTHROPIC_API_KEY`, `AI_MONTHLY_BUDGET_USD`, isteğe bağlı `AI_MODEL` | Konsolda harcama sınırı görünür; adım 10'da ilk belge işlenir |

1. Organizasyonu ve faturalamayı aç; veri işleme sözleşmesini (H-10) hukuk danışmanına ilet.
2. **Workspaces**: `studyflow-staging` ve `studyflow-prod`. Her birinde **API keys → Create key**.
3. Her workspace'e **aylık harcama sınırı** koy; `AI_MONTHLY_BUDGET_USD` ile aynı değer (varsayılan 250).
   Uygulama %80'de uyarı gönderir (`ops-alerts`), konsoldaki sınır ise son emniyettir.
4. `supabase.prod.env`: `ANTHROPIC_API_KEY=sk-ant-…`, `AI_MONTHLY_BUDGET_USD=250`. Model varsayılanı
   `claude-opus-5-5` (ADR-002); değiştirmek için `AI_MODEL`.

### Adım 3 · Apple Developer: App ID ve Sign in with Apple anahtarı

| Hesap | Komut | Gizli bilgi | Kontrol |
|---|---|---|---|
| developer.apple.com (Account Holder ya da Admin) | — | `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY`, `APPLE_CLIENT_ID`; `SUPABASE_AUTH_EXTERNAL_APPLE_CLIENT_ID` | `check-env` bu dört anahtarı "ok" gösterir; adım 10'da Apple hesabı silinince izin kalkar |

Bu anahtarlar `supabase/functions/delete-account/apple.ts` içindir: hesap silinince Apple ile giriş izni
Apple'da da geri alınır (App Store kuralı 5.1.1(v)). Yoksa hesap yine silinir, yalnızca geri alma atlanır.

1. **Membership details** → Team ID → `APPLE_TEAM_ID` (10 karakter).
2. **Certificates, Identifiers & Profiles → Identifiers → +** → App IDs → App → Explicit Bundle ID
   `com.cobanov.studyflow`; yetenekler: **Sign In with Apple**, **Push Notifications**. (EAS ilk derlemede de
   oluşturur; elle açmak yeteneklerin doğru olduğunu görmeyi kolaylaştırır.)
3. **Keys → +** → ad "StudyFlow Sign in with Apple" → **Sign in with Apple** → Configure → Primary App ID
   `com.cobanov.studyflow` → Register → **Download**. `.p8` dosyası yalnızca bir kez indirilir; depoya değil
   `../studyflow-secrets/`'a koy (`.gitignore` `*.p8`'i zaten dışlar).
4. `supabase.prod.env`:
   ```
   APPLE_TEAM_ID=ABCDE12345
   APPLE_KEY_ID=<Key ID>
   APPLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----
   …dosyanın içeriği…
   -----END PRIVATE KEY-----"
   APPLE_CLIENT_ID=com.cobanov.studyflow
   SUPABASE_AUTH_EXTERNAL_APPLE_CLIENT_ID=com.cobanov.studyflow
   ```
   Son satır fonksiyon sırrı değildir: `supabase config push` Apple sağlayıcısını açarken `config.toml`'dan okur.
   Web OAuth akışı kullanılmadığı için `SUPABASE_AUTH_EXTERNAL_APPLE_SECRET` boş kalabilir.
5. Push bildirimi anahtarı (APNs) adım 8'de EAS tarafından oluşturulur.

### Adım 4 · Supabase EU projesi

| Hesap | Komut | Gizli bilgi | Kontrol |
|---|---|---|---|
| supabase.com (organizasyon sahibi, iki adımlı doğrulama açık) | `npm run go-live:supabase -- --env-file …` (önce kuru çalıştırma, sonra `--apply`) | `supabase.prod.env`'deki her şey; Vault `project_url`, `cron_secret` | Betiğin 8. bölümü; `cron.job` listesi; onay fonksiyonu 404 döner |

1. **New project**: ad `studyflow-prod`, bölge **Central EU (Frankfurt)** (sonradan değişmez), güçlü veritabanı
   şifresi → `SUPABASE_DB_PASSWORD`. Proje kimliği (`<prod-ref>`) → `SUPABASE_PROJECT_REF`.
2. **Account → Access Tokens** → `SUPABASE_ACCESS_TOKEN` (ya da bir kez `supabase login`).
3. Yeni rastgele sırlar üret ve dosyaya yaz (her biri için ayrı çalıştır):
   ```bash
   openssl rand -hex 32
   ```
   `CRON_SECRET`, `REVENUECAT_WEBHOOK_SECRET`, `TELEMETRY_HASH_SALT` (en az 16 karakter, 32+ önerilir).
   Ayrıca: `CONSENT_WEB_URL=https://studyflow.app/veli-onayi/`, `CORS_ALLOWED_ORIGIN=https://studyflow.app`,
   `OPS_ALERT_EMAIL=<ekip posta kutusu>`. `OPS_ALERT_EMAIL` ve `AI_MONTHLY_BUDGET_USD` önerilir: yoksa
   uyarılar yalnızca fonksiyon günlüğüne düşer ve bütçe 250 sayılır. Üçü de staging dosyasına da yazılır
   (staging'de ayrı değerlerle).
4. Dosyayı kontrol et; "Ready" yazmalı:
   ```bash
   npm run go-live:check-env -- --target supabase --env-file ../studyflow-secrets/supabase.prod.env
   ```
5. Kuru çalıştırma: ne yapılacağını gösterir, hiçbir şeyi değiştirmez.
   ```bash
   npm run go-live:supabase -- --env-file ../studyflow-secrets/supabase.prod.env
   ```
6. Uygula. CLI bazı adımlarda onay ister (`y`). Sırasıyla: proje bağlanır, migration'lar ve referans veri
   (`seed.sql`, tekrar çalıştırılabilir) uygulanır, `config.toml`'daki Auth ve API ayarları gönderilir
   (`config diff` önce farkı gösterir), fonksiyon sırları yazılır, bütün fonksiyonlar yüklenir:
   ```bash
   npm run go-live:supabase -- --env-file ../studyflow-secrets/supabase.prod.env --apply --vault
   ```
   `--vault` pg_cron'un okuduğu Vault sırlarını (`project_url`, `cron_secret` = `CRON_SECRET`) yazar. İstersen
   onu atlayıp betiğin yazdırdığı SQL'i (sır maskeli) SQL editöründe gerçek değerle çalıştırabilirsin.
   Docker çalışmıyorsa `--use-api` ekle. Betik tekrar çalıştırılabilir; hiçbir şey silmez.

   **Hesapların hepsi açılmadan staging:** TestFlight iç testi Resend ve Apple anahtarları gelmeden başlayabilir.
   Eksik bırakılacak anahtarlar `--allow-missing` ile söylenir. Yalnızca boş bırakılanlar geçer; girilmiş ama
   yanlış bir değer betiği yine durdurur. Bu anahtarlar gelene kadar şunlar çalışmaz: veli onayı, destek ve uyarı
   e-postaları; Apple ile girişte hesap silinirken Apple bağlantısının kaldırılması. Fonksiyonlar bunlar için hata
   vermez, olayı günlüğe yazar. Kayıt doğrulama e-postası Supabase'in kendi e-posta servisinden gider; bu servis saatte
   birkaç e-postayla sınırlıdır ve yalnızca proje ekibindeki adreslere gönderir, bu yüzden testçiler Supabase
   organizasyonuna eklenir.
   ```bash
   npm run go-live:supabase -- --env-file ../studyflow-secrets/supabase.staging.env --use-api \
     --allow-missing RESEND_API_KEY,EMAIL_FROM,SUPPORT_TEAM_EMAIL,APPLE_TEAM_ID,APPLE_KEY_ID,APPLE_PRIVATE_KEY --apply --vault
   ```
   Anahtarlar gelince dosyaya eklenip betik `--allow-missing` olmadan yeniden çalıştırılır.
7. Panelde elle yapılanlar ([güvenlik incelemesi §4.4](security_review.md#44-supabase-panel-ayarları-her-barındırılan-proje-dev-staging-prod)):
   - **Authentication → Emails → SMTP Settings**: host `smtp.resend.com`, port `465`, kullanıcı `resend`,
     şifre = SMTP için açılan Resend anahtarı, gönderen `no-reply@studyflow.app`, ad `StudyFlow`.
     (`config.toml`'daki SMTP bölümü yorumda olduğu için `config push` bunu yapmaz.)
   - **Authentication → Providers → Apple**: açık, Client IDs `com.cobanov.studyflow` (config push'tan gelir; kontrol et).
   - Sızdırılmış şifre koruması (planda varsa), `pg_graphql` kullanılmıyorsa kapalı, SSL zorunlu, yedek ve
     PITR, log saklama ≤ 30 gün, ekip üyeleri en az yetkiyle.
8. **Uzaktan yapılandırma:** `public.app_config` tek satırdır (`id = 1`) ve yalnızca servis rolüyle yazılır
   (SQL editörü). Başlangıç değerleri: `ios_min_version = '1.0.0'`, `maintenance = false`. App Store kimliği
   çıkınca (adım 6) `ios_store_url` yazılır:
   ```sql
   update public.app_config set ios_store_url = 'https://apps.apple.com/tr/app/studyflow/id<App Store id>' where id = 1;
   ```

Kontrol (betik `--apply` ile bunları kendisi çalıştırır):
- `supabase secrets list` → §5'teki adların hepsi var.
- `supabase functions list` → `consent`, `consent-request`, `consent-maintenance`, `delete-account`,
  `ops-alerts`, `process-document`, `revenuecat-webhook`, `support`, `telemetry`.
- `cron.job` → `consent-maintenance-daily`, `ops-alerts-5min`, `telemetry-housekeeping-hourly`. 5 dakika
  sonra `ops-alerts-5min` için `cron.job_run_details`'ta `succeeded` görünür:
  ```bash
  supabase db query --remote --read-only "select j.jobname, d.status, d.start_time from cron.job_run_details d join cron.job j using (jobid) order by d.start_time desc limit 5"
  ```
- Onay fonksiyonu yayında: rastgele bir bağlantıya 404 döner (betik bunu `curl` ile dener).
- SMTP: uygulamadan değil, panelden **Authentication → Users → Invite user** ile kendine bir davet gönder;
  e-posta `no-reply@studyflow.app`'tan gelmeli ve Gmail'de "SPF/DKIM/DMARC: PASS" görünmeli
  ("Orijinali göster").

### Adım 5 · Web sayfaları (GitHub Pages)

| Hesap | Komut | Gizli bilgi | Kontrol |
|---|---|---|---|
| GitHub depo yöneticisi; alan adı DNS'i | Actions → **Web** → Run workflow | Yok (yalnızca herkese açık değerler) | Sayfalar açılır; sahte bağlantıyla onay sayfası "Bu bağlantı geçerli değil" der |

Sayfalar: tanıtım (`/`), gizlilik (`/gizlilik/`), kullanım koşulları (`/kosullar/`), aydınlatma metni
(`/aydinlatma-metni/`), destek ve SSS (`/destek/`), veli onayı (`/veli-onayi/`), hesap silme (`/hesap-silme/`).
Yasal metinler ve SSS uygulamadaki kaynaklardan üretilir (`npm run web:build`); `npm run web:check` ve Jest
testi bir bölüm eksikse ya da çıktı eskiyse başarısız olur. Yerelde bakmak için:
```bash
npm run web:build
```
```bash
python3 -m http.server 8099 -d web/dist
```

1. **Settings → Pages → Build and deployment → Source: GitHub Actions.**
2. **Settings → Secrets and variables → Actions → Variables** (repo düzeyi):
   `WEB_FUNCTIONS_URL=https://<prod-ref>.supabase.co/functions/v1`; isteğe bağlı
   `WEB_STAGING_FUNCTIONS_URL=https://<staging-ref>.supabase.co/functions/v1` (staging e-postaları için
   `/staging/veli-onayi/` ve `/staging/hesap-silme/` de üretilir; staging'de `CONSENT_WEB_URL` bu adres olur),
   `EXPO_PUBLIC_SUPPORT_EMAIL=destek@studyflow.app`, sonra `WEB_DEPLOY=true`.
3. **Actions → Web → Run workflow.** Derleme yer tutucu ya da yerel adresle dağıtım yapmayı reddeder.
4. **Özel alan adı.** Önce alan adını hesaba doğrula (ele geçirilmeye karşı): GitHub → profil **Settings →
   Pages → Add a domain** → verilen `_github-pages-challenge-…` TXT kaydını DNS'e gir → Verify. Sonra DNS:
   - `studyflow.app` için A: `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`;
     AAAA: `2606:50c0:8000::153`, `2606:50c0:8001::153`, `2606:50c0:8002::153`, `2606:50c0:8003::153`
   - `www` için CNAME: `surakaraali.github.io`

   Depo **Settings → Pages → Custom domain** `studyflow.app` → Save → DNS kontrolü bitince **Enforce HTTPS**.
   Bu dağıtım türünde `CNAME` dosyası kullanılmaz; ayar Pages ekranındadır. Sonra `WEB_BASE_URL=https://studyflow.app/`
   değişkenini ekleyip iş akışını yeniden çalıştır.
5. Geçici `github.io` adresiyle başladıysan `CONSENT_WEB_URL`, `CORS_ALLOWED_ORIGIN` (adım 4) ve
   `EXPO_PUBLIC_CONSENT_WEB_URL`'i (adım 8) yeni adrese çevir.

Kontrol:
```bash
curl -sI https://studyflow.app/gizlilik/ | head -1
```
```bash
curl -s https://studyflow.app/veli-onayi/ | grep -c "functionsUrl: 'https://<prod-ref>.supabase.co/functions/v1'"
```
Tarayıcıda `https://studyflow.app/veli-onayi/?token=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA` açılınca
"Bu bağlantı geçerli değil" görünmeli: bu, sayfanın production fonksiyonuna ulaştığını (CSP ve CORS doğru)
gösterir. "Sayfa yüklenemedi" görünürse `CORS_ALLOWED_ORIGIN` ya da `WEB_FUNCTIONS_URL` yanlıştır.

Kısıt: GitHub Pages HTTP başlığı gönderemez; `frame-ancestors` ve HSTS başlık olarak verilemez. Onay ve silme
sayfaları çerçeve içinde açılınca kendini gizler; `.app` uzantısı tarayıcılarda zaten yalnızca HTTPS'dir.

### Adım 6 · App Store Connect: uygulama ve abonelikler

| Hesap | Komut | Gizli bilgi | Kontrol |
|---|---|---|---|
| appstoreconnect.apple.com (Admin) | — | App Store Connect API anahtarı (EAS Submit), In-App Purchase anahtarı (RevenueCat) | Uygulama kaydı ve iki abonelik "Ready to Submit"; sandbox test hesabı var |

1. **Business → Agreements, Tax, and Banking**: Paid Apps sözleşmesi, vergi ve banka bilgisi (abonelik
   satmak için şart).
2. **Apps → + New App**: iOS, ad (Q-08, [app-store.md §1](../store/app-store.md#1-uygulama-adı)), birincil dil
   Türkçe, bundle ID `com.cobanov.studyflow`, SKU `studyflow-ios`. App Store kimliği (`id…`) ve "Apple ID"
   numarası → `eas.json` `ascAppId` ve `app_config.ios_store_url` (adım 4.8).
3. **App Information**: kategori ve yaş derecelendirmesi (Q-07, [app-store.md §7](../store/app-store.md#7-kategori-ve-yaş-derecelendirmesi-q-07));
   **App Privacy**: [app-store.md §8](../store/app-store.md#8-gizlilik-etiketi-app-privacy) ve gizlilik URL'si.
4. **Pricing and Availability**: ücretsiz; bölge kararı Ürün sahibinde (R1 Türkçe ve KVKK için öneri: Türkiye).
5. **Monetization → Subscriptions**: grup "StudyFlow Pro"; ürünler `com.cobanov.studyflow.pro.monthly`
   (1 ay) ve `com.cobanov.studyflow.pro.annual` (1 yıl). Fiyat Q-05; Türkçe görünen ad ve açıklama; inceleme
   için paywall ekran görüntüsü ve not. İlk abonelikler uygulamanın ilk sürümüyle birlikte gönderilir.
6. **Users and Access → Integrations**:
   - **App Store Connect API → Team Keys → +** (rol App Manager): Issuer ID, Key ID, `.p8` → EAS Submit
     (adım 8'de `eas credentials` sorar).
   - **In-App Purchase → Generate** → `.p8` → RevenueCat (adım 7).
7. **Users and Access → Sandbox → Test Accounts**: ekip için bir sandbox hesabı (App Review kendi sandbox
   hesabını kullanır; nota yazılmaz).

### Adım 7 · RevenueCat: proje, ürünler, entitlement, webhook

| Hesap | Komut | Gizli bilgi | Kontrol |
|---|---|---|---|
| app.revenuecat.com | — | `EXPO_PUBLIC_REVENUECAT_IOS_KEY` (herkese açık), `REVENUECAT_WEBHOOK_SECRET` | Webhook testi 200; sandbox satın alımdan sonra `profiles.plan = 'pro'` |

1. Proje "StudyFlow" → **Apps → + App Store app**: bundle ID `com.cobanov.studyflow`; In-App Purchase
   anahtarını (adım 6.6) yükle. RevenueCat'in verdiği **App Store Server Notifications** adresini App Store
   Connect → App Information → App Store Server Notifications'a (Production ve Sandbox, Version 2) gir.
2. **Products**: iki ürünü içe aktar (`…pro.monthly`, `…pro.annual`).
3. **Entitlements → +** kimliği **`pro`** (koddaki `PRO_ENTITLEMENT`); iki ürünü bağla.
4. **Offerings**: `default` (current), paketler **Monthly** (`$rc_monthly`) ve **Annual** (`$rc_annual`).
   Uygulama paketleri bu türlere göre sıralar.
5. **Integrations → Webhooks → +**: URL `https://<prod-ref>.supabase.co/functions/v1/revenuecat-webhook`,
   **Authorization header** = `REVENUECAT_WEBHOOK_SECRET` (adım 4'teki değer), ortam: hem production hem
   sandbox (App Review sandbox'ta satın alır), bütün olaylar. Staging projesi için ayrı bir webhook.
6. **Project settings → API keys** → iOS public SDK anahtarı (`appl_…`) → EAS değişkeni
   `EXPO_PUBLIC_REVENUECAT_IOS_KEY` (adım 8).
7. RevenueCat'in App Privacy rehberine bak; SDK'nın gönderdiği cihaz bilgisi etikette ek tür gerektiriyorsa
   [app-store.md §8](../store/app-store.md#8-gizlilik-etiketi-app-privacy) güncellenir.

Kontrol: webhook ekranındaki **Send test event** → 200 (test olayının kullanıcısı yoktur; fonksiyon 200 döner,
bir abonelik yazmaz). Yanlış başlıkta 401 döner. Gerçek kontrol adım 12'deki sandbox satın almadır.

Not: `react-native-purchases` 10.16.0'a sabitlendi; 11.x, CocoaPods'ta henüz olmayan PurchasesHybridCommon
20.x istiyor. CocoaPods'a geldiğinde güncelleme ayrı bir iş olarak yapılır (backlog'a not).

### Adım 8 · EAS: proje, ortam değişkenleri, derlemeler, TestFlight

| Hesap | Komut | Gizli bilgi | Kontrol |
|---|---|---|---|
| expo.dev (organizasyon); Apple Developer girişi (sertifikalar için) | `npx eas-cli@latest …` | EAS ortam değişkenleri, `EAS_PROJECT_ID`, `EXPO_TOKEN` (CI) | `check-env --target app` "Ready"; TestFlight'ta derleme; uygulama yerel modda açılmaz |

1. Giriş ve proje:
   ```bash
   npx eas-cli@latest login
   ```
   ```bash
   npx eas-cli@latest init
   ```
   `app.config.ts` dinamik olduğu için `eas init` kimliği dosyaya yazamaz; yazdırdığı proje kimliğini sakla.
   EAS CLI `.env` dosyalarını okumaz: `eas build` ve `eas update` çalıştırdığın her kabukta
   ```bash
   export EAS_PROJECT_ID=<proje kimliği>
   ```
   ve GitHub'da repo değişkeni `EAS_PROJECT_ID` (adım 10). Bulut derleme makineleri `EAS_BUILD_PROJECT_ID`'yi
   kendileri verir.
2. Ortam değişkenleri (her ortam için; `development`, `preview` → staging, `production` → prod). `EXPO_PUBLIC_*`
   değerleri uygulamaya gömülür, gizli değildir: görünürlük `plaintext` ya da `sensitive`, asla sunucu sırrı değil.
   ```bash
   npx eas-cli@latest env:create --environment production --name EXPO_PUBLIC_SUPABASE_URL --value https://<prod-ref>.supabase.co --visibility plaintext
   ```
   Aynı biçimde: `EXPO_PUBLIC_SUPABASE_ANON_KEY` (Project settings → API keys → anon/publishable; `sensitive`),
   `EXPO_PUBLIC_REVENUECAT_IOS_KEY`, `EXPO_PUBLIC_CONSENT_WEB_URL=https://studyflow.app/veli-onayi/`,
   `EXPO_PUBLIC_SUPPORT_EMAIL=destek@studyflow.app`. `preview` ortamına staging değerleri girilir: Preview iş
   akışı `eas update --environment preview` ile değerleri buradan okur (GitHub'dan değil).
3. Kontrol: preview ve production için çek ve denetle.
   ```bash
   npx eas-cli@latest env:pull --environment production --path ../studyflow-secrets/app.production.env
   ```
   ```bash
   npm run go-live:check-env -- --target app --env-file ../studyflow-secrets/app.production.env
   ```
   Preview ve production derlemeleri Supabase değerleri yoksa kendiliğinden durur; yayın derlemesi yerel moda
   düşmez (`app.config.ts`).
4. `eas.json` → `submit.production.ios`: `ascAppId` (adım 6.2) ve `appleTeamId` (adım 3.1) yer tutucularını
   doldur.
5. İlk geliştirme derlemesi (kendi iPhone'una; önce `npx eas-cli@latest device:create`):
   ```bash
   npx eas-cli@latest build --profile development --platform ios
   ```
   İlk derlemede EAS Apple hesabına girmeni ister; dağıtım sertifikasını, provisioning profilini ve push
   anahtarını (APNs) oluşturmasına izin ver. Simülatör için `--profile development-simulator`.
6. TestFlight derlemesi ve gönderim:
   ```bash
   npx eas-cli@latest build --profile production --platform ios
   ```
   ```bash
   npx eas-cli@latest submit --platform ios --profile production --latest
   ```
   Derleme işlenince TestFlight'ın iç test grubu "Team"e kendiliğinden düşer. Şifreleme sorusu çıkmaz
   (`ITSAppUsesNonExemptEncryption: false`, [app-store.md §9](../store/app-store.md#9-şifreleme-beyanı-export-compliance)).
   Sonraki TestFlight derlemeleri: GitHub → Actions → **TestFlight** → Run workflow (`testflight.yml`). Derleme
   kimlik bilgileri ve App Store Connect API anahtarı EAS'te (`@studyflow-app`) durduğu için Apple girişi gerekmez.

Kontrol: TestFlight derlemesinde "Geliştirme modu" şeridi görünmez, kayıt olunca doğrulama e-postası gelir
(adım 4 SMTP) ve Supabase → Authentication → Users'ta yeni kullanıcı görünür.

### Adım 9 · App Review hesapları

| Hesap | Komut | Gizli bilgi | Kontrol |
|---|---|---|---|
| Supabase production (servis rolü anahtarı, yalnızca bu adım için) | `npm run go-live:seed-review` | `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`, `REVIEW_PASSWORD` | Betik her tabloyu "ok" gösterir; TestFlight'ta hesapla giriş yapılır |

Yetişkin deneme hesabını `scripts/go-live/seed-review-account.ts` açar: doğrulanmış e-posta, 19 yaş, 12. sınıf,
veli onayı gerekmez, Ücretsiz plan. İçine dev-seed demo verisini uygulamanın eşitleme yoluyla yükler; tarihleri
geçmiş dün bitecek şekilde kaydırır, örnek belgeyi işlenmiş ve kota dışı işaretler. Tekrar çalıştırmak güvenli:
aynı satırlar yenilenir, şifre yenilenir. Hesap `app_metadata.review_account = true` ile işaretlenir.

1. Demo verisini üret (bir kez): uygulamayı yerel modda (Supabase değişkenleri olmadan) simülatörde aç
   (`npm start`, `i`), sonra:
   ```bash
   xcrun simctl openurl booted "exp://127.0.0.1:8081/--/dev-seed?mode=full"
   ```
   Betik simülatördeki en yeni "demo-full" veritabanını kendisi bulur (başkası için `--from-db <dosya>`).
2. Anahtarları yalnızca bu kabuk için ver (Project settings → API keys); şifreyi ekrana yazmadan oku:
   ```bash
   export SUPABASE_URL=https://<prod-ref>.supabase.co SUPABASE_ANON_KEY=<anon key> SUPABASE_SERVICE_ROLE_KEY=<service role key> REVIEW_EMAIL=<ekibin okuduğu adres>
   ```
   ```bash
   read -rs REVIEW_PASSWORD && export REVIEW_PASSWORD
   ```
3. Önce kuru çalıştırma, sonra gerçek:
   ```bash
   npm run go-live:seed-review -- --dry-run
   ```
   ```bash
   npm run go-live:seed-review
   ```
   ```bash
   unset SUPABASE_SERVICE_ROLE_KEY REVIEW_PASSWORD
   ```
   Baştan kurmak için `--reset` (hesap silinip yeniden açılır, kullanıcı kimliği değişir). Yerel denemede
   `--local` yerel yığının anahtarlarını kullanır.
4. Reşit olmayan hesap (14 yaş, onay bekliyor) elle açılır ve onay bağlantısı nota yazılır
   ([app-store.md §10](../store/app-store.md#10-app-review-notları)); bağlantı 7 gün geçerlidir, gönderimden en
   fazla 7 gün önce üretilir.

Kontrol: betik sonunda her tablo `ok`, profil `consent not_required, plan free`, belge `processed`. TestFlight
derlemesinde bu hesapla giriş: Bugün'de plan, İlerleme'de iki haftalık geçmiş, Çalış'ta işlenmiş belge görünür.
Gönderimden 1–2 gün önce betik yeniden çalıştırılır (tarihler tazelenir).

### Adım 10 · GitHub: kapalı iş akışlarını açan ayarlar

| Hesap | Komut | Gizli bilgi | Kontrol |
|---|---|---|---|
| GitHub depo yöneticisi | — | Aşağıdaki tablo | Actions'ta Supabase, Preview ve Web iş akışları "skipped" değil yeşil |

**Settings → Environments**:
- `staging`: sırlar `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD` (staging); değişken `SUPABASE_PROJECT_ID=<staging-ref>`.
- `production`: aynı adlar prod değerleriyle; **Required reviewers**: Tech lead.
- `github-pages`: Pages ilk dağıtımda kendisi oluşturur.

**Settings → Secrets and variables → Actions** (repo düzeyi):

| Ad | Tür | Değer | İş akışı |
|---|---|---|---|
| `EXPO_TOKEN` | Sır | expo.dev → studyflow-app → Access tokens → robot `github-actions` | `preview.yml`, `testflight.yml` |
| `EAS_PROJECT_ID` | Değişken | adım 8.1 | `preview.yml`, `testflight.yml` |
| `WEB_FUNCTIONS_URL`, `WEB_STAGING_FUNCTIONS_URL`, `WEB_BASE_URL`, `EXPO_PUBLIC_SUPPORT_EMAIL`, `WEB_APP_STORE_URL` | Değişken | adım 5 | `web.yml` |
| `WEB_DEPLOY` | Değişken | `true` | `web.yml` |
| `EAS_PREVIEW` | Değişken | `true` (EAS kurulunca) | `preview.yml` |
| `SUPABASE_DEPLOY` | Değişken | `true` | `supabase.yml` |

`supabase.yml`, Supabase CLI 3'ün istediği `db push --remote --include-seed --yes` ve `functions deploy --yes`
biçimini kullanır. Fonksiyonların ortak içe aktarma haritası `config.toml`'da tanımlıdır.

Ana dal koruması: `checks`, `secrets`, `database`, `functions` zorunlu kontroller (ci.yml'deki not).

### Adım 11 · Mağazaya gönderim

| Hesap | Komut | Gizli bilgi | Kontrol |
|---|---|---|---|
| App Store Connect (App Manager) | `npx eas-cli@latest submit …` (adım 8) | İnceleme notundaki hesap şifreleri (yalnızca Connect'e girilir) | Durum "Waiting for Review" |

Ön koşul: §1'deki bütün engeller kapalı.
1. Metinler: [app-store.md §1–§6](../store/app-store.md) (ad, alt başlık, promosyon, açıklama, anahtar kelimeler, URL'ler).
2. Ekran görüntüleri: 6,9" 1320×2868, 8 adet, [app-store.md §11](../store/app-store.md#11-ekran-görüntüleri)'deki sıra.
3. Yaş derecelendirmesi (§7), App Privacy (§8), şifreleme (§9).
4. **App Review Information**: [app-store.md §10](../store/app-store.md#10-app-review-notları)'daki not, yetişkin
   ve reşit olmayan hesap, onay bağlantısı (7 gün içinde üretilmiş), örnek PDF adresi, iletişim bilgisi.
5. Sürüme derlemeyi ve iki aboneliği ekle; **Version Release**: "Manually release" ve **Phased release** açık
   (proje planı §11.1, 7 gün).
6. Submit for Review.

### Adım 12 · Son kontroller (go/no-go)

Hepsi tamam değilse gönderim yapılmaz (proje planı §10.3, §11.2).

| # | Kontrol | Nasıl |
|---|---|---|
| 1 | Sırlar tam | `check-env --target supabase` (staging ve prod) ve `--target app` (preview ve production) "Ready" |
| 2 | Testler yeşil | GitHub Actions CI; yerelde `npm test`, `npx tsc --noEmit`, `npx eslint .`, `npm run web:check` |
| 3 | Web yayında | adım 5'teki `curl` ve sahte bağlantı kontrolü |
| 4 | Veli onayı uçtan uca (staging) | TestFlight/preview derlemesinde 14 yaş hesap → veli e-postası gelir → bağlantı → "Onaylıyorum" → uygulama birkaç saniyede açılır; geri alma da denenir |
| 5 | Hesap silme (staging) | Apple ile girilmiş hesabı sil → onay e-postası; fonksiyon günlüğünde Apple geri alma `revoked`; iPhone Ayarlar → Apple Kimliği → Apple ile Giriş listesinden StudyFlow kalkar |
| 6 | Satın alma (sandbox) | Yetişkin hesapla aylık Pro → RevenueCat olayı → webhook 200 → `profiles.plan = 'pro'`; geri yükleme çalışır |
| 7 | Yapay zekâ | Örnek PDF yüklenir, özet/quiz/kart üretilir; Anthropic konsolunda kullanım görünür |
| 8 | Uyarılar | `ops-alerts-5min` `succeeded`; ops-alerts kuru çalıştırması: `curl -s -X POST https://<prod-ref>.supabase.co/functions/v1/ops-alerts -H "Authorization: Bearer $CRON_SECRET" -H 'content-type: application/json' -d '{"dryRun":true}'` (değeri kabukta `read -rs CRON_SECRET` ile ver) |
| 9 | Telemetri | Uygulama kullanıldıktan sonra SQL editöründe `select count(*) from private.telemetry_events` > 0; kayıtlarda kullanıcı ya da cihaz kimliği sütunu yok |
| 10 | Uzaktan yapılandırma | `select * from public.app_config` → `maintenance = false`, `ios_min_version = '1.0.0'`, `ios_store_url` dolu |
| 11 | Yasal metinler | H-01 onaylı, `LEGAL_DRAFT = false`, web sayfalarında taslak uyarısı yok, `CONSENT_TEXT_VERSION` = `LEGAL_VERSION` |
| 12 | Mağaza listesi | [app-store.md §12](../store/app-store.md#12-app-store-kontrol-listesi-store-01-proje-planı-112) her madde tamam |

## 4. Bilinen sınırlar

- GitHub Pages HTTP başlığı ayarlayamaz (CSP `frame-ancestors`, HSTS). Sayfalar CSP'yi meta etiketiyle verir ve
  çerçevede gizlenir; daha sıkı başlık gerekirse önüne başlık ekleyebilen bir CDN konur.
- Expo SDK 58 yerel iOS derlemesi için Xcode 26.4 ya da üstünü ister. Bu Mac'te Xcode 26.0.1 var; yerel
  `expo run:ios` çalışmaz. Xcode güncellenene kadar geliştirme ve TestFlight derlemeleri EAS'te yapılır (adım 8).
- `react-native-purchases` 10.16.0'da sabit (adım 7 notu).

## 5. Geri alma

| Sorun | Ne yapılır | Komut / yer |
|---|---|---|
| Web sayfası bozuk | Son sağlam çalıştırmayı yeniden çalıştır ya da değişikliği geri al ve push et | Actions → Web → son yeşil çalıştırma → Re-run all jobs |
| Uygulamada yalnızca JavaScript hatası | Önceki OTA güncellemesini yeniden yayımla (STORE-05: OTA yalnızca hata düzeltme) | `npx eas-cli@latest update:list --branch production`, sonra `npx eas-cli@latest update:republish --group <önceki grup kimliği>` |
| Yerel (native) hata | Kademeli yayını durdur, düzeltilmiş sürümü hızlandırılmış incelemeyle gönder | App Store Connect → Phased Release → Pause |
| Uygulamayı geçici kapatmak | Bakım modu (uygulama yeniden dene ekranı gösterir) | `update public.app_config set maintenance = true, maintenance_message = '…' where id = 1;` geri almak için `false` |
| Eski sürümü durdurmak | Zorunlu güncelleme | `update public.app_config set ios_min_version = '1.0.1' where id = 1;` |
| Fonksiyon hatası | Önceki sağlam commit'ten aynı fonksiyonu yeniden yükle | ayrı bir çalışma kopyasında (`git worktree add ../sf-rollback <sha>`) `supabase functions deploy <ad>` |
| Veritabanı | Migration'lar ileriye doğru düzeltilir (önce ekle, sonra kaldır); son çare PITR | Supabase → Database → Backups |
| Yapay zekâ kalitesi ya da maliyeti | Modeli önceki sürüme çevir; gerekirse Anthropic workspace sınırını düşür | `supabase secrets set AI_MODEL=<model>` |
| Sır sızdı | İlgili sağlayıcıda iptal et, yenisini üret, `supabase-setup.sh --apply` ile yeniden yaz; `CRON_SECRET` değişirse `--vault` da; `REVENUECAT_WEBHOOK_SECRET` değişirse RevenueCat'teki başlık da | adım 1–4, 7 |

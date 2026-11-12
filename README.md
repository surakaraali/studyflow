# StudyMark

Ortaokul ve lise öğrencileri için yapay zekâ destekli çalışma planlayıcısı. Öğrenci derslerini,
okul programını, sınavlarını ve ödevlerini girer; uygulama 14 günlük çalışma planını kendisi
kurar. Ders notlarından (PDF) özet, quiz ve kart üretir; kart tekrarlarını aralıklı tekrarla
(FSRS) zamanlar. iOS ve Android için tek kod tabanı.

- Ürün kapsamı, teknoloji ve yol haritası: [PLAN.md](PLAN.md)
- Gereksinimler: [analysis/01_brd.md](analysis/01_brd.md), [analysis/02_nfr.md](analysis/02_nfr.md)
- Backlog ve proje planı: [agile/backlog.md](agile/backlog.md), [agile/project_plan.md](agile/project_plan.md)
- Mimari kararlar: [analysis/adr/](analysis/adr/)

## Durum

R1'in (Sprint 0–8) bütün "Must" hikâyeleri kodlandı. Ardından yeni bir kullanıcının uygulamayı
indirdiği andan ilk günlerine kadarki yolculuğu tamamlandı (E19, US-71–US-80:
[agile/backlog.md](agile/backlog.md)). Uygulama **yerel modda** uçtan uca
çalışır: hesap, veri ve veli onayı cihazda tutulur, yapay zekâ işleri geliştirme sunucusuna
gider. Supabase, App Store, RevenueCat ve e-posta hesapları açılınca aynı kod sunucuya bağlanır
(adımlar: [analysis/go_live.md](analysis/go_live.md)).

| Alan | İçerik |
|---|---|
| Hesap | E-posta ve Apple ile giriş, e-posta bağlantıları (doğrulama, şifre sıfırlama), onboarding (sınıf, doğum yılı, hedef sınav, alan), veli onayı ve kısıtlı mod, veli kapısı, yasal metinler, profil, şifre ve e-posta değiştirme, doğum yılını bir kez düzeltme, oturum süresi dolunca yeniden giriş, hesap silme |
| İlk kurulum | Onboarding'e kaldığı yerden devam, ilk açılışta ders seçimi, Bugün'de kurulum listesi ve kısayollar, yeni okul yılı kartı, Pro bitince uyarı |
| Ayarlar | Görünüm (Sistem/Açık/Koyu), veli onayına göre açılan bildirimler, eşitleme durumu, Hakkında, veri kopyası talebi |
| Dersler | Sınıfa göre MEB ders önerisi, özel ders, arşiv, okul ders programı, müsait saatler, konular, sınavlar (LGS/YKS tahmini tarihleri dahil), ödevler |
| Çalış | PDF yükleme (sayfa aralığı, şifreli PDF kontrolü), kota, işleme kuyruğu, özet, quiz üretimi ve çözme, yanlışları tekrar, içerik düzenleme ve bildirme, desteler ve FSRS tekrar |
| Plan | Kural tabanlı plan motoru (sınav önceliği, günlük üst sınır, okul ve uyku saatleri, kaçırılan blokların dağıtılması), Bugün ve Takvim, odak zamanlayıcı, elle oturum, seri, hatırlatmalar |
| İlerleme | Haftalık süre, plan uyumu, ders ve konu bazında doğru oranı, optik form ızgarası |
| Abonelik ve destek | Ücretsiz/Pro karşılaştırma, satın alma ve geri yükleme (RevenueCat), SSS, destek formu, beta geri bildirimi ve SUS anketi |
| Backend | Supabase şeması ve RLS, Edge Functions (belge işleme, veli onayı, hesap silme, abonelik, bakım, destek), eşitleme, veli onay web sayfası |
| Teslim | CI (lint, tip, test, bağımlılık ve gizli anahtar taraması), EAS profilleri, güvenlik incelemesi, mağaza metinleri, web sayfaları (GitHub Pages), yayına çıkış runbook'u ve betikleri |

Bilinen hata: [BUG-01](agile/backlog.md#9-bilinen-hatalar) (ilk açılışta sekme adları kesik).

## Teknolojiler

- Expo SDK 58, React Native 0.88, React 19, TypeScript (strict), React Compiler
- expo-router (dosya tabanlı yönlendirme, iOS'ta yerel sekmeler)
- expo-sqlite (cihazdaki veri, kullanıcı başına ayrı dosya), Zustand (oturum)
- ts-fsrs (aralıklı tekrar), pdf-lib (PDF sayfa sayısı ve kırpma)
- expo-notifications, expo-apple-authentication, react-native-purchases (RevenueCat)
- Supabase (Postgres + RLS, Auth, Storage, Edge Functions), Anthropic Claude API (yalnızca sunucuda)
- i18next (Türkçe; İngilizce dosyası hazır)
- Jest (jest-expo), ESLint

## Çalıştırma

Gerekenler: Node.js 22.13+ (Homebrew: `node@22`), Xcode ve iOS simülatörü. Hesap ya da anahtar
gerekmez: Supabase anahtarları girilmediği sürece uygulama yerel modda açılır.

```bash
npm install
```

```bash
npm start
```

`npm start` Expo Go'yu açar. Geliştirme derlemesi (Apple ile giriş, gerçek bildirimler) için
`npm run start:dev-client` kullanılır; bu derlemeyi yerelde yapmak Xcode 26.4 ya da üstünü ister
(Expo SDK 58). Daha eski Xcode'da derleme EAS ile bulutta yapılır ([analysis/go_live.md](analysis/go_live.md)).

Simülatörde Expo Go ile açın (`i` tuşu ya da `xcrun simctl openurl booted exp://127.0.0.1:8081`).

Uygulamayı yerel mod yerine barındırılan staging Supabase projesiyle açmak için `npm run start:staging`
kullanılır. Komut `EXPO_PUBLIC_SUPABASE_URL` ve `EXPO_PUBLIC_SUPABASE_ANON_KEY` değerlerini proje dışındaki
`../studyflow-secrets/app.staging.env` dosyasından okur; başka bir yol `STAGING_ENV_FILE` ile verilir. Dosya
proje klasörüne konmaz, çünkü Metro proje kökündeki fazladan `.env` dosyalarını paketlemeye çalışır. Expo Go
e-posta bağlantısının döndüğü `studyflow://` adresini açamaz: doğrulama bağlantısı hesabı yine doğrular,
ardından uygulamada şifreyle giriş yapılır.

Yapay zekâ işleri için geliştirme sunucusunu ayrı bir terminalde başlatın. Örnek içerikle
(anahtar gerekmez):

```bash
npm run ai:mock
```

Gerçek modelle çalıştırmak için `.env.local` dosyasına `ANTHROPIC_API_KEY` ekleyip `npm run ai:dev`
kullanın. Ayrıntılar: [server/README.md](server/README.md).

### Demo verisi

Yerel geliştirme modunda, örnek verili bir hesapla açmak için:

```bash
xcrun simctl openurl booted "exp://127.0.0.1:8081/--/dev-seed?mode=full"
```

`mode` değerleri: `full` (11. sınıf, dersler, sınavlar, ödevler, işlenmiş bir belge, iki haftalık
geçmiş), `limited` (veli onayı bekleyen 16 yaş), `locked` (veli onayı bekleyen 11 yaş), `fresh`
(onboarding'i bekleyen boş hesap). Bu rota yayın derlemelerinde çalışmaz.

### Sunucuya bağlamak

`.env.example` dosyasını `.env.local` olarak kopyalayıp Supabase adresini ve anon anahtarını
girin. Anahtarlar girilince uygulama yerel moddan çıkar; girişler, veriler ve yapay zekâ işleri
Supabase üzerinden yürür.

### Yayına çıkış

Hesapların açılması, anahtarlar, Supabase kurulumu, web sayfaları, EAS derlemeleri ve App Store gönderimi
sırasıyla [analysis/go_live.md](analysis/go_live.md)'de. Yardımcı betikler:

```bash
npm run go-live:check-env -- --list
```

`go-live:check-env` bir env dosyasında eksik ya da hatalı anahtarları listeler, `go-live:supabase`
Supabase projesini kurar (varsayılan olarak yalnızca gösterir, `--apply` ile uygular),
`go-live:seed-review` App Review deneme hesabını demo verisiyle açar. Mağaza metinleri [store/](store/)
klasöründe.

### Web sayfaları

Tanıtım, gizlilik politikası, kullanım koşulları, aydınlatma metni, destek (SSS), veli onayı ve hesap silme
sayfaları `web/` ve uygulamadaki metinlerden üretilir; yasal metinler ve SSS uygulamayla aynı kaynaktan gelir.

```bash
npm run web:build
```

```bash
python3 -m http.server 8099 -d web/dist
```

Çıktı `web/dist/` klasörüne yazılır (git dışı). `npm run web:check` çıktı eskiyse ya da bir bölüm eksikse
hata verir.

### GitHub Actions

`CI` her push'ta çalışır. `Supabase` (staging/production dağıtımı), `Preview` (EAS güncellemesi) ve `Web`
(GitHub Pages) hesaplar kurulana kadar atlanır. Açmak için GitHub'da Settings → Secrets and variables →
Actions → Variables altına `SUPABASE_DEPLOY=true`, `EAS_PREVIEW=true` ve `WEB_DEPLOY=true` ekleyin; gereken
anahtarlar iş akışı dosyalarının başında ve [analysis/go_live.md](analysis/go_live.md) adım 10'da yazılı.

## Kontroller

```bash
npm run typecheck
```

```bash
npx eslint .
```

```bash
npm test
```

### Uçtan uca testler (Maestro)

`.maestro/` altındaki akışlar uygulamayı simülatördeki Expo Go'da gerçek bir kullanıcı gibi dolaşır:
kayıt ve onboarding, Bugün planı, ders ve sınav ekleme, kilitli hesapta doğum yılı düzeltme, ayarlar.
Her akış demo hesabı aynı verilerle sıfırdan açar (`/dev-seed?mode=…&reset=1`, yalnızca geliştirme
modunda). Gerekenler: [Maestro](https://maestro.mobile.dev) ve Java 17 (Homebrew: `openjdk@17`),
`npm start` ile açık geliştirme sunucusu ve açık bir iOS simülatörü.

```bash
JAVA_HOME=/opt/homebrew/opt/openjdk@17 npm run e2e
```

Expo Go'da ilk dokunuşlar ve klavye zaman zaman kaybolduğu için kayıt ve sınav akışları kararsızdır;
geliştirme derlemesinde (`appId: com.cobanov.studyflow`) çalıştırılması planlanıyor.

### Yerel Supabase ile entegrasyon testleri

Docker (ör. Colima), Supabase CLI ve Deno kuruluyken:

```bash
supabase start -x studio,imgproxy,realtime,logflare,vector,supavisor
```

```bash
supabase test db
```

```bash
supabase functions serve --env-file <dosya>
```

Fonksiyon sunucusu için dosyada `EMAIL_PROVIDER=console`, `EMAIL_CONSOLE_BODY=1`,
`CONSENT_WEB_URL=http://localhost:8099/veli-onayi/` (web sayfaları yukarıdaki gibi sunulurken) ve
`CRON_SECRET=<herhangi>` olmalı. Sunucunun
çıktısını bir dosyaya yönlendirip o dosyayla testi çalıştırın:

```bash
npm run test:functions -- <functions-serve-çıktısı.log>
```

Bir cihaz veritabanının (ör. demo hesabın SQLite dosyası) sunucuya gidip geri gelişini denemek için:

```bash
npm run test:sync-roundtrip -- <cihaz.db>
```

`supabase test db` satır güvenliği (RLS) kurallarını, `test:functions` veli onayı ve hesap silme
akışlarını, `test:sync-roundtrip` eşitleme servisini gerçek Postgres'e karşı dener. Edge Functions
tip denetimi: `cd supabase/functions && deno check */index.ts && deno lint`.

## Klasör yapısı

```
src/
  app/          Ekranlar (her dosya bir rota): (auth), onboarding, (locked), (app)
  components/   Ortak bileşenler; ui/ altında temel parçalar
  constants/    Tasarım değerleri (renk, yazı, boşluk)
  db/           Cihazdaki veritabanı: şema, canlı sorgular, yazma ve eşitleme kuyruğu
  domain/       Saf iş kuralları: BRD kuralları, plan motoru, seri, FSRS
  features/     Özellikler (dersler, sınavlar, belgeler, quiz, kartlar, plan, ilerleme…)
  i18n/         Arayüz metinleri (tr/ altında özellik başına bir dosya)
  services/     Giriş, bildirim, yapay zekâ kuyruğu, eşitleme, satın alma, analitik
  stores/       Oturum durumu
server/         Yerel modda yapay zekâ işlerini yapan geliştirme sunucusu
supabase/       Postgres şeması, RLS testleri, Edge Functions
web/            Web sayfaları: veli onayı, hesap silme, ortak stil (scripts/web üretir)
scripts/        Web derlemesi, yayına çıkış betikleri (go-live), entegrasyon testleri
evals/          Model değerlendirme seti iskeleti
store/          App Store ve Google Play metinleri
```

## Lisans

Tüm hakları saklıdır. Repo, kodu ve belgeleri portföy olarak incelenebilsin diye herkese açık;
herhangi bir bölümünü kullanmak için yazılı izin gerekir. Ayrıntılar: [LICENSE](LICENSE).

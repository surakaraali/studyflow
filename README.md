# StudyFlow

Ortaokul ve lise öğrencileri için yapay zekâ destekli çalışma planlayıcısı. Öğrenci derslerini,
okul programını, sınavlarını ve ödevlerini girer; uygulama 14 günlük çalışma planını kendisi
kurar. Ders notlarından (PDF) özet, quiz ve kart üretir; kart tekrarlarını aralıklı tekrarla
(FSRS) zamanlar. iOS ve Android için tek kod tabanı.

- Ürün kapsamı, teknoloji ve yol haritası: [PLAN.md](PLAN.md)
- Gereksinimler: [analysis/01_brd.md](analysis/01_brd.md), [analysis/02_nfr.md](analysis/02_nfr.md)
- Backlog ve proje planı: [agile/backlog.md](agile/backlog.md), [agile/project_plan.md](agile/project_plan.md)
- Mimari kararlar: [analysis/adr/](analysis/adr/)

## Durum

R1'in (Sprint 0–8) bütün "Must" hikâyeleri kodlandı. Uygulama **yerel modda** uçtan uca
çalışır: hesap, veri ve veli onayı cihazda tutulur, yapay zekâ işleri geliştirme sunucusuna
gider. Supabase, App Store, RevenueCat ve e-posta hesapları açılınca aynı kod sunucuya bağlanır
(adımlar: [analysis/adr/](analysis/adr/) ve [store/app-store.md](store/app-store.md)).

| Alan | İçerik |
|---|---|
| Hesap | E-posta ve Apple ile giriş, onboarding (sınıf, doğum yılı, hedef sınav, alan), veli onayı ve kısıtlı mod, veli kapısı, yasal metinler, profil, hesap silme |
| Dersler | Sınıfa göre MEB ders önerisi, özel ders, arşiv, okul ders programı, müsait saatler, konular, sınavlar (LGS/YKS tahmini tarihleri dahil), ödevler |
| Çalış | PDF yükleme (sayfa aralığı, şifreli PDF kontrolü), kota, işleme kuyruğu, özet, quiz üretimi ve çözme, yanlışları tekrar, içerik düzenleme ve bildirme, desteler ve FSRS tekrar |
| Plan | Kural tabanlı plan motoru (sınav önceliği, günlük üst sınır, okul ve uyku saatleri, kaçırılan blokların dağıtılması), Bugün ve Takvim, odak zamanlayıcı, elle oturum, seri, hatırlatmalar |
| İlerleme | Haftalık süre, plan uyumu, ders ve konu bazında doğru oranı, optik form ızgarası |
| Abonelik ve destek | Ücretsiz/Pro karşılaştırma, satın alma ve geri yükleme (RevenueCat), SSS, destek formu, beta geri bildirimi ve SUS anketi |
| Backend | Supabase şeması ve RLS, Edge Functions (belge işleme, veli onayı, hesap silme, abonelik, bakım, destek), eşitleme, veli onay web sayfası |
| Teslim | CI (lint, tip, test, bağımlılık ve gizli anahtar taraması), EAS profilleri, güvenlik incelemesi, mağaza metinleri |

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

Gerekenler: Node.js 22.13+ (Homebrew: `node@22`), Xcode ve iOS simülatörü.

```bash
npm install
```

```bash
npm start
```

Simülatörde Expo Go ile açın (`i` tuşu ya da `xcrun simctl openurl booted exp://127.0.0.1:8081`).

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
Supabase üzerinden yürür. Supabase kurulumu, gizli anahtarlar ve mağaza adımları
[analysis/adr/](analysis/adr/) altındaki kararlarda ve [store/](store/) klasöründe anlatılır.

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
`CONSENT_WEB_URL=http://localhost:8099/consent/` ve `CRON_SECRET=<herhangi>` olmalı. Sunucunun
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
web/            Veli onay sayfası
evals/          Model değerlendirme seti iskeleti
store/          App Store ve Google Play metinleri
```

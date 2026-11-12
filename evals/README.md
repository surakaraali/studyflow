# Yapay zekâ değerlendirme seti

Bu klasör, belge işleme hattının (özet, quiz, kart) kalitesini, süresini ve maliyetini gerçek
belgelerle ölçer.

- **SP-01:** Opus, Sonnet ve Haiku sınıfı modelleri aynı belgelerde karşılaştırır. Sonuç
  ADR-002'ye (`analysis/adr/ADR-002-model-secimi.md`) yazılır.
- **AIQ-05:** model ya da istem değişikliği bu setten geçmeden yayına alınmaz.

`run-eval.ts`, üretimdeki hattın kendisini çağırır (`supabase/functions/_shared/ai/process.ts` →
`processDocument`). İstemler, JSON şeması, doğrulama, önbellek ve fiyatlar ortak koddan gelir; set
için ayrı istem yazılmaz. İstek, uygulamadaki gibi kurulur: PDF (seçilen sayfalar), sınıf, segment,
ders adı, şık sayısı (BR-12), 10 soru, 15 kart.

| Dosya | Ne işe yarar |
|---|---|
| `run-eval.ts` | Kuru çalıştırma, gerçek çalıştırma ve puan okuma (`--score`) |
| `rubric.md` | Eğitim danışmanı için puanlama ölçütü |
| `manifest.example.json` | Manifest örneği |
| `documents/` | PDF'ler (git'e girmez) |
| `results/<zaman>/` | Çalıştırma çıktıları (git'e girmez) |

## 1. Belge seti

### Matris

İlk set (SP-01) **en az 30 gerçek belgeden** oluşur ve her segment × ana ders hücresini kapsar:
2 segment × 5 ana ders = 10 hücre, **hücre başına en az 3 belge**. Belgeleri BA ve eğitim danışmanı
toplar (project_plan §17, 4. madde, 20 Kasım).

| `subject` | Ortaokul (5–8) | Lise (9–12) |
|---|---|---|
| `turkce` | Türkçe | Türk Dili ve Edebiyatı |
| `matematik` | Matematik | Matematik |
| `fen` | Fen Bilimleri | Fizik, Kimya, Biyoloji |
| `sosyal` | Sosyal Bilgiler, T.C. İnkılap Tarihi ve Atatürkçülük | Tarih, Coğrafya |
| `ingilizce` | İngilizce | İngilizce |

- Lisenin `fen` ve `sosyal` hücrelerinde alt dersleri dağıtın (ör. Fizik, Kimya ve Biyoloji'den
  birer belge).
- Sınıfları hücre içinde yayın; 8. sınıf (LGS) ve 11–12. sınıf (YKS) en az birer belgeyle bulunsun.
- Belge türlerini karıştırın: ders kitabı bölümü, öğretmen notu, çalışma kâğıdı, öğrencinin
  temiz tuttuğu bir not (izinle). Taranmış PDF (US-39, R1.1) zorunlu değil; eklerseniz `source`
  alanına "taranmış" yazın.
- Uzunluk: çoğu 5–20 sayfa (ücretsiz plan sınırı 20), birkaçı 20–40 sayfa (Pro).
- İlkokul (1–4) R2b'de gelir; şimdilik sete eklemeyin.
- SP-02 / AIQ-04 için ekip uygunsuz içerikli birkaç **sentetik** test belgesi hazırlar ve
  `expect_flagged: true` ile işaretler. Bunlar matrise sayılmaz. Gerçek kişilerden alıntı ya da
  gerçek öğrenci verisi kullanmayın.

> **Açık soru:** AIQ-01 "her segment ve ana ders için en az 30 gerçek belge" diyor. Bu, hücre başına
> 30 (toplam 300) diye de okunabilir. SP-01 için toplam 30 (hücre başına ≥ 3) hedefleniyor; beta
> öncesi hedefin hangisi olduğunu BA ve PO netleştirmeli.

### Lisans, izin ve kişisel veri

- Belgeler Claude API'ye gönderilir; **BR-05 burada da geçerlidir.** Belgede öğrenci kişisel verisi
  olmamalı: ad, okul, sınıf listesi, okul numarası, fotoğraf, imza, el yazısıyla isim.
- Öncelik: MEB'in ücretsiz yayımladığı ders kitapları ve yardımcı kaynaklar ile öğretmenlerin
  **yazılı izniyle** verdiği notlar. Kullanım koşullarını hukuk danışmanıyla teyit edin; amaç
  "ürün içi kalite değerlendirmesi" olarak yazılsın.
- Öğrenci notu ancak veli ve öğrencinin yazılı izniyle, kişisel bilgiler silinerek kullanılır;
  mümkünse kullanmayın.
- Her belgenin kaynağı (`source`) ve lisans/izin notu (`licence`) manifestte zorunludur.
- Betik, PDF üst verisinde yazar adı görürse uyarır: sayfa aralığı verilmeyen belgede bu bilgi de
  sağlayıcıya gider. Üst veriyi PDF düzenleyicide (Belge Özellikleri) temizleyin.

### Belgeler nerede durur

- PDF'ler **git'e girmez**. Ekibin erişimi kısıtlı, paylaşılan özel klasöründe durur (ör. Google
  Drive'da "StudyMark / SP-01 değerlendirme seti"). Çalıştırırken klasörü `--docs` ile gösterin ya
  da dosyaları `evals/documents/` altına kopyalayın.
- Kök `.gitignore` dosyasına şu satırları ekleyin (bu klasör eklemez):

  ```gitignore
  evals/documents/*.pdf
  evals/results/
  ```

- `results/` da git'e girmez: içinde lisanslı belgelerden üretilmiş metinler vardır. `summary.md`
  ve `scores.md` paylaşılan klasöre konur; ADR'de çalıştırma adı ve sayılar anılır.
- `evals/manifest.json` kişisel veri içermediği sürece git'e girebilir; böylece set ve lisans
  notları sürüm kontrolünde kalır.

## 2. Manifest

```bash
cp evals/manifest.example.json evals/manifest.json
```

| Alan | Zorunlu | Açıklama |
|---|---|---|
| `id` | evet | Küçük harf, rakam, `-`, `_` (ör. `ort-fen-7-hucre`) |
| `file` | evet | PDF'in `--docs` klasörüne göre yolu |
| `grade` | evet | 5–12 |
| `segment` | evet | 5–8 `ortaokul`, 9–12 `lise` (BR-01; betik denetler) |
| `course` | evet | Uygulamadaki ders adı (ör. "Fen Bilimleri"); modele belgeyle birlikte yalnızca bu ad gider |
| `subject` | evet | Matris anahtarı: `turkce`, `matematik`, `fen`, `sosyal`, `ingilizce` |
| `source` | evet | Kaynak: kitap, ünite, sayfalar ya da öğretmen |
| `licence` | evet | Lisans ya da izin notu |
| `pages` | hayır | `[ilk, son]`: yalnızca bu sayfalar gönderilir (uygulamadaki sayfa seçici gibi) |
| `reference_notes` | hayır | Puanlayıcı için beklenen ana bilgiler; modele gitmez |
| `expect_flagged` | hayır | `true`: SP-02 uygunsuz içerik test belgesi |

## 3. Çalıştırma

Komutlar depo kökünden çalışır. Anahtar `ANTHROPIC_API_KEY` ortam değişkeninden ya da geliştirme
sunucusu gibi `.env.local` dosyasından okunur ve hiçbir çıktıya yazılmaz. Değerlendirme için ayrı
bir anahtar (Console'da ayrı çalışma alanı ve harcama sınırı) önerilir.

```bash
# 1. Kuru çalıştırma: manifest, PDF'ler, sayfa sayıları, kapsam matrisi ve kaba maliyet tahmini.
#    API çağrısı yapmaz, anahtar gerekmez.
npx tsx evals/run-eval.ts --dry-run

# 2. Duman testi: 2 belge, en ucuz model
npx tsx evals/run-eval.ts --limit 2 --models claude-haiku-5-5

# 3. Tam çalıştırma: bütün belgeler × üç model
npx tsx evals/run-eval.ts

# 4. Puanlama bittikten sonra (doldurulmuş CSV çalıştırma klasöründe olmalı)
npx tsx evals/run-eval.ts --score evals/results/<zaman>/scoring-sheet.csv
#    Çift puanlamayla: birinci dosya kesin puanlar, sonrakiler uyum için
npx tsx evals/run-eval.ts --score evals/results/<zaman>/scoring-sheet.csv,evals/results/<zaman>/ikinci.csv
```

| Seçenek | Varsayılan | Açıklama |
|---|---|---|
| `--dry-run` | | Denetim ve tahmin; API çağrısı yok |
| `--models a,b,c` | `claude-opus-5-5,claude-sonnet-5-5,claude-haiku-5-5` | Fiyatı `pricing.ts` içinde olan modeller |
| `--docs <klasör>` | `evals/documents` | PDF klasörü |
| `--manifest <dosya>` | `evals/manifest.json` | Manifest |
| `--out <klasör>` | `evals/results/<zaman>` | Çıktı klasörü |
| `--limit N` | hepsi | Yalnızca ilk N belge |
| `--reps N` | 1 | Belge × model başına tekrar (süre, maliyet ve otomatik kontrollerin dağılımı için) |
| `--concurrency N` | 2 | Aynı anda çalışan iş |
| `--timeout SN` | 300 | İş başına süre sınırı |
| `--budget USD` | 25 | Harcama sınırı (§9) |
| `--score a.csv[,b.csv]` | | Puanları oku, eşikleri denetle |

## 4. Çıktılar (`results/<zaman>/`)

| Dosya | İçerik |
|---|---|
| `results.json` | Her belge × model × tekrar için süre, token, maliyet, hata kodu, sunan model, otomatik kontroller ve üretilen içerik. `meta`: ayarlar ve hat sürümü (istem, şema, doğrulama ve hat dosyalarının özeti) |
| `summary.md` | Model başına tablo: başarı, süre ortalaması ve p95, belge başına ve 20 sayfa başına maliyet, otomatik kontroller, hatalar, belge kapsamı |
| `scoring-sheet.csv` | Kör puanlama sayfası (ilk tekrar). Noktalı virgüllü UTF-8; Türkçe Excel'de doğrudan açılır |
| `scoring-key.json` | `item_id` → model eşlemesi. Puanlama bitene kadar puanlayıcıyla paylaşmayın |
| `scores.md` | `--score` sonucu |

## 5. Otomatik kontroller

İnsan gerektirmeyen ölçümler `summary.md` içindedir. **Doğruluk, yaşa uygunluk ve belge dışı bilgi
otomatik ölçülmez;** bunlar için insan puanı gerekir (§6).

| Kontrol | Ne ölçer | Bağlantı |
|---|---|---|
| Başarı | Hatasız biten iş oranı. Model hataları (`invalid_output`, `truncated`, `refused`, `empty`, `bad_request`) ve altyapı hataları (`provider_unavailable`, `timeout`, `server_config`, …) ayrı sayılır. Başarısız iş tekrarlanmaz; ilk deneme kalitesi ölçülür | AIQ-02 |
| Sayılar | 10 soru, 15 kart ve 3–8 özet bölümü geldi mi (hattın attığı öğeler bu sayıyı düşürür) | AIQ-02 |
| Şıklar | Her soruda segmentin şık sayısı (ortaokul 4, lise 5), geçerli `correct_index`, "Hepsi / Hiçbiri" yok | BR-12 |
| Açıklama | Her sorunun açıklaması var | US-34 |
| Kaynak sayfa | Her soru ve kartta 1 ile sayfa sayısı arasında sayfa; her özet bölümünde sayfa | AIQ-03 |
| Yakın tekrar | Kelimelerinin ≥ %80'i ortak soru ya da kart çiftleri | |
| Doğru şık dağılımı | Hiçbir şık konumu soruların yarısından fazlasında doğru değil | |
| Türkçe | Metinlerin ≥ %95'i Türkçe görünüyor (sezgisel; İngilizce dersinde atlanır) | BR-21 |
| Maliyet / 20 sayfa | Belgelerin sayfa sayısı ve maliyetinden doğru uydurularak 20 sayfalık belge tahmini | AIQ-07 |
| Önbellek okuma | İstem token'larının önbellekten okunan payı | US-32 |
| Yedek model | Sunucu taraflı yedeğe düşen iş sayısı; bu işler istenen modeli ölçmez | |
| Kişisel veri | İstekte yalnızca izinli 8 alan var, ders adında e-posta ya da numara yok. Değilse istek gönderilmez (`pii_blocked`) | BR-05 |
| Yanlış / kaçan işaret | Okul belgesinin uygunsuz işaretlenmesi / test belgesinin işaretlenmemesi | AIQ-04 |

## 6. İnsan puanlaması

- Ölçüt: [rubric.md](rubric.md). Puanlama kördür; satırlar belgeye göre gruplanır, belge içinde
  modeller karışıktır.
- Satırların yaklaşık %20'si `cift_puan = E` ile işaretlidir; bunlar ikinci puanlayıcıya gider
  (rubric §7).
- **Yük:** 30 belge × 3 model ≈ 2.340 öğe (900 soru, 1.350 kart, 90 özet). Soru başına 1 dk, kart
  başına 20 sn, özet başına 3 dk ile ≈ 27 saat eder; eğitim danışmanının ayda ≈ 2 günü var. Öneri:
  1. Otomatik sonuçlara ve maliyete göre açıkça elenen modeli puanlamaya almayın. Koordinatör
     (puanlayıcı değil) `scoring-key.json` ile o modelin satırlarını sayfadan silebilir.
  2. Soruların **tamamını** puanlayın; AIQ-01 doğruluğu sorulardan hesaplanır ve puansız soru
     sonucu "EKSİK" yapar.
  3. Zaman yetmezse kart ve özetlerden belge başına bir örneklem puanlayın; puansız kart ve
     özetler raporlanır ama sonucu engellemez.

## 7. ADR-002'ye bağlantı

ADR-002'yi başka biri yazar; bu set ona şunları verir:

- `summary.md`: model başına başarı, süre (ortalama, p95), belge başına ve 20 sayfa başına maliyet
  (AIQ-07), otomatik kontroller.
- `scores.md`: soru doğruluğu ve %95 alt sınırı, yaşa uygunluk ihlali, belge dışı bilgi oranı,
  kaynak sayfa doğruluğu, puanlayıcı uyumu.
- Çalıştırma klasörünün adı ve `summary.md`'deki **hat sürümü**: karar hangi istem ve şemayla
  ölçüldüyse ADR'de o yazılır.
- **"Hangi iş hangi modelde":** hat bugün özet, quiz ve kartı aynı modelle çalıştırır. İş başına
  token, süre ve maliyet `results.json` → `usage[]` (`task` alanı) içinde var; ancak işleri farklı
  modellere dağıtmayı ölçmek için hatta iş başına model seçeneği gerekir (§10).
- Karar ancak insan puanları ve otomatik tablolar birlikte okunduktan sonra verilir. Öneri: bütün
  eşikleri geçen modeller arasından 20 sayfa maliyeti en düşük olanı seçmek.

## 8. Ne zaman yeniden çalıştırılır (AIQ-05)

- `supabase/functions/_shared/ai/` altında `process.ts`, `prompts.ts`, `schemas.ts` ya da
  `validate.ts` değiştiğinde (`summary.md`'deki hat sürümü de değişir).
- `AI_MODEL`, effort, `max_tokens` ya da yedek model ayarı değiştiğinde; Anthropic SDK büyük sürüm
  yükseltmesinde; sağlayıcı yeni model sürümü çıkardığında.
- Her sprint, demo öncesi "Yapay zekâ kalite incelemesi" toplantısından önce (project_plan §3,
  §7.4, §10.1).
- Eşikleri geçemeyen değişiklik yayına alınmaz (project_plan §7.4, 3. madde).
- İnsan puanı: istem, model ya da şema değişikliğinde tam puanlama; yalnızca altyapı
  değişikliğinde otomatik kontroller ve küçük bir örneklem (ör. 50 soru) yeterli (ekip önerisi).

## 9. Maliyet korkulukları

- **Önce `--dry-run`.** Tahmin kabadır: sayfa başına ≈ 3.000 girdi token'ı, belge başına ≈ 13.000
  çıktı token'ı (düşünme dahil) ve PDF'in iki istekte önbellekten okunduğu varsayılır. İlk gerçek
  çalıştırmadan sonra `results.json`'daki gerçek token'larla karşılaştırın; gerekirse
  `run-eval.ts` içindeki `ESTIMATE` değerlerini güncelleyin.
- **`--budget` (varsayılan $25):** tahmin bütçeyi aşarsa çalıştırma başlamaz. Çalışırken harcama
  bütçeye ulaşınca yeni iş başlatılmaz; çalışan işler bittiği için bütçe biraz aşılabilir.
- **Ölçek:** tahmine göre 20 sayfalık bir belge Opus'ta ≈ $0,60, Sonnet'te ≈ $0,31, Haiku'da
  ≈ $0,02 tutar; ortalama 12 sayfalık 30 belge × 3 model ≈ $20 eder. project_plan §14.2'ye göre
  beta için toplam Claude API bütçesi ≈ $25–50; tam çalıştırmaları buna göre planlayın.
- Duman testini `--limit 2 --models claude-haiku-5-5` ile yapın.
- `--concurrency` küçük kalsın (varsayılan 2): hız sınırına takılmayı azaltır. SDK, 429 ve 5xx
  yanıtlarını 4 kez yeniden dener; bu bekleme süreye dahildir.
- Ctrl+C: yeni iş başlamaz, çalışan işler kesilir, biten işler kaydedilir. İkinci Ctrl+C hemen çıkar.
- CI'da her push'ta otomatik çalıştırmayın; elle başlatılır.

## 10. Bilinen sınırlar

- Hat, ham model çıktısını ve doğrulamada atılan öğe sayısını dışarı vermez. AIQ-02 için yalnızca
  "istenen / gelen" sayısı görülür; hata olan işte ham çıktı kaybolur.
- Aralık dışı kaynak sayfası hatta `null` olur; "sayfa yok" ile "yanlış sayfa" ayrılamaz.
- Effort ve `max_tokens` `process.ts` içinde sabittir; farklı effort düzeyleri bu betikle
  karşılaştırılamaz.
- Üç iş tek modelle çalışır; iş başına farklı model denenemez.
- Bir iş hata verirse başarılı alt isteklerin içeriği kaybolur (yalnızca kullanım ve maliyet döner).
- `pricing.ts` Haiku 5.5'in 100K token üstü istem fiyatını içermez; çok uzun belgelerde Haiku
  maliyeti düşük görünebilir.
- Türkçe kontrolü sezgiseldir; dil bilgisi ve dil düzeyi insan puanıyla ölçülür.
- İnsanlar yalnızca ilk tekrarı puanlar; `--reps` süre, maliyet ve otomatik kontrollerin
  dağılımını ölçmek içindir.

# ADR-002 · Yapay zekâ modeli seçimi ve değerlendirme

- **Durum:** Önerildi — değerlendirme seti sonuçları bekleniyor (SP-01)
- **Tarih:** 4 Kasım 2026
- **İlgili:** SP-01, AIQ-01, AIQ-02, AIQ-03, AIQ-05, AIQ-07, BR-05, BR-12, BR-21, PLAN.md §5

## Bağlam

Belge başına özet, quiz ve kart üretiyoruz (`supabase/functions/_shared/ai/process.ts`). Kalite
hedefleri: soruların ≥ %95'i doğru, yaşa uygunluk ihlali 0, belge dışı bilgi ≤ %2, her öğede kaynak
sayfa (AIQ-01, AIQ-03). Maliyet hedefi: 20 sayfalık belge başına ortalama ≤ $0,05 (AIQ-07).
Fiyatlar (`pricing.ts`, 1M token başına girdi/çıktı): Opus 5.5 $4/$20, Sonnet 5.5 $2/$10,
Haiku 5.5 $0,10/$0,50. Kuru çalıştırma tahmini (20 sayfa): Opus ≈ $0,60, Sonnet ≈ $0,31,
Haiku ≈ $0,016. Bu tahmine göre maliyet hedefini yalnızca Haiku sınıfı karşılıyor; kaliteyi
karşılayıp karşılamadığı ölçülmeden karar verilemez (varsayım A-04).

## Seçenekler

1. **Her iş için Opus.** En yüksek kalite beklentisi; maliyet hedefinin ~12 katı.
2. **Her iş için Haiku.** Maliyet hedefi tutar; Türkçe ve sınıf düzeyine uygun soru kalitesi belirsiz.
3. **İşe göre model.** Örneğin özet ve kartlar Haiku, soru üretimi Sonnet/Opus. Hat şu an tek
   `model` alıyor; iş başına model seçeneği gerekir (`options.models: { summary, quiz, cards }`).
4. **Kademeli:** Haiku ile üret, otomatik kontrolü geçemeyen belgeyi daha büyük modelle yeniden üret.

## Karar (geçici)

- Geliştirme ve iç betada varsayılan model **Opus 5.5** (`AI_MODEL`), çünkü kalite ölçülmeden
  en düşük riskli seçenek budur. Kota (BR-14) ve aylık bütçe alarmı (AIQ-07) maliyeti sınırlar.
- **Nihai karar SP-01 değerlendirmesinden sonra** bu ADR'ye yazılacak: hangi iş hangi modelde,
  hangi çaba (effort) düzeyinde. Karar ölçütü sırasıyla: (1) AIQ-01/AIQ-03 eşiklerini geçen,
  (2) 20 sayfa başına maliyeti en düşük, (3) p95 süresi en kısa yapılandırma.
- Model veya istem değişikliği değerlendirme setini geçmeden yayına alınmaz (AIQ-05).

## Değerlendirme yöntemi

- Araç: `evals/run-eval.ts` (kuru çalıştırma, gerçek çalıştırma, `--score` ile puan okuma).
  Üretimdeki hattı (`processDocument`) aynen çağırır; ayrı istem yazılmaz.
- Ölçüt: `evals/rubric.md` (eğitim danışmanı puanlar: doğruluk, tek doğru şık, belge dışı bilgi,
  kaynak sayfa, yaşa uygunluk, dil düzeyi). Puanlama kör yapılır (model gizli), %20'si çift puanlanır.
- Otomatik kontroller: şema uyumu, şık sayısı (BR-12), kaynak sayfa aralığı, tekrar eden soru,
  Türkçe oranı, BR-05 (istekte kişisel veri yok), süre ve maliyet.
- **Belge seti ekip tarafından toplanmalıdır:** en az 30 gerçek belge, ortaokul ve lise × ana
  dersler matrisinden (hücre başına en az 3). Belgelerde öğrenci kişisel verisi olmamalı; MEB açık
  ders kitapları veya izinli öğretmen materyali tercih edilir. Ayrıntılar `evals/README.md`.
  Bu set hazır olmadan SP-01 kapanmaz.

## Hattın değerlendirmeyi zorlaştıran yanları (C1 için iyileştirme önerileri)

- `processDocument` doğrulamada atılan öğe sayısını ve ham çıktıyı döndürmüyor; AIQ-02 yalnızca
  "istenen / dönen" olarak ölçülebiliyor.
- Aralık dışı kaynak sayfa `null`'a çevriliyor; "sayfa yok" ile "yanlış sayfa" ayrılamıyor.
- Çaba (`effort`) ve `MAX_TOKENS` sabit; en önemli maliyet kolu karşılaştırılamıyor.
- Tek model üç işi birden yapıyor; iş başına model seçeneği (Seçenek 3) için gerekli.
- Bir iş başarısız olunca başarılı işlerin içeriği kayboluyor.
- `pricing.ts`, Haiku'nun uzun istemlerdeki yüksek fiyat kademesini içermiyor; uzun belgeler
  olduğundan ucuz görünebilir.

## Sonuçlar

- (+) Karar ölçülen veriye dayanır; model değişikliği her zaman aynı setle sınanır.
- (−) Gerçek çalıştırma maliyeti (30 belge × 3 model ≈ $20) ve insan puanlama yükü (≈ 27 saat)
  planlanmalı; puanlama önce soruların tamamına, kart ve özetlerde örnekleme ile yapılabilir.
- Açık soru: AIQ-01 "her segment ve ana ders için en az 30 belge" ifadesi hücre başına 30 (toplam
  300) olarak da okunabilir; BA ve ürün sahibi netleştirmeli.

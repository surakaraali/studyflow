# ADR-003 · Uygunsuz içerik denetimi

- **Durum:** Kabul edildi (R1 için)
- **Tarih:** 4 Kasım 2026
- **İlgili:** SP-02, AIQ-04, AIQ-06, BR-06, BR-21, BR-23, FR-ADM-02, BRD §12 (yapay zekâ sağlayıcı kuralları)

## Bağlam

Kullanıcılar 10–17 yaşında. Yüklenen belge uygunsuz olabilir (şiddet, cinsellik, nefret söylemi)
ya da model uygunsuz/yanlış içerik üretebilir. AIQ-04: girdi ve çıktı denetlenir; uygunsuz belge
işlenmez ve nötr bir mesaj gösterilir. Sağlayıcının reşit olmayanlara yönelik ürün kuralları da
filtreleme, izleme ve bildirim kanalı ister.

## Seçenekler

1. **Model içi talimat + yapılandırılmış `flagged` alanı.** Sistem istemi yaş grubunu ve kuralları
   söyler; çıktı şeması `flagged` ve `flag_reason` alanlarını zorunlu tutar. Ek çağrı yok.
2. **Ayrı sınıflandırma çağrısı** (ucuz bir modelle girdi ve/veya çıktı için "uygun mu?" sorusu).
   Bağımsız ikinci görüş; ama her belgede ek gecikme ve maliyet, PDF'in ikinci kez gönderilmesi.
3. **Kelime listesi.** Ucuz ve öngörülebilir; Türkçede ekler ve bağlam yüzünden çok yanlış alarm
   ve kaçırma üretir (ör. biyoloji ve tarih konuları).
4. **Kullanıcı bildirimi + insan incelemesi.** Her durumda gerekli son savunma hattı.

## Karar

R1'de **1 + 4**:

- **Model içi talimat:** `supabase/functions/_shared/ai/prompts.ts` yaş grubunu, sınıf düzeyine uygun
  dili, belge dışı bilgi eklememeyi ve uygunsuz belgede üretim yapmamayı söyler.
- **`flagged` çıktısı:** şema (`schemas.ts`) `flagged` + `flag_reason` içerir. Özet adımı belgeyi
  işaretlerse quiz ve kart istekleri iptal edilir (tek isteğin maliyeti), belge `error` olur ve
  öğrenciye nötr mesaj gösterilir; içerik kaydedilmez.
- **Sağlayıcının kendi güvenlik katmanı:** politika gereği reddedilen istekler ayrı hata kodu olarak
  kaydedilir.
- **Kullanıcı bildirimi:** her soru, kart ve özette "Bildir" vardır (`content_reports`). Bildirilen
  soru bildiren kullanıcıdan hemen gizlenir; aynı belgede 3'ten fazla bildirim belgeyi incelemeye
  alır (BR-23).
- **İnsan incelemesi:** ekip bildirilenleri 3 iş günü içinde inceler (AIQ-06). İnceleme alanları
  (`status, reviewed_at, reviewed_by, review_note`) yalnızca sunucuda değiştirilebilir.
- Her yapay zekâ öğesi "Yapay zekâ ile üretildi, hata içerebilir" etiketi taşır (BR-06).

### Neden şimdilik ayrı sınıflandırıcı yok

- Özet adımı belgeyi zaten okuyor; aynı çağrıda karar vermek ek gecikme ve ek PDF gönderimi
  gerektirmiyor. Ayrı çağrı belge başına maliyeti artırır; maliyet hedefi (AIQ-07) zaten zor.
- Uygunsuz belge oranı ve modelin kaçırma oranı henüz bilinmiyor. Önce ölçüyoruz: değerlendirme
  setine bilerek uygunsuz test belgeleri eklenir (`evals/manifest.example.json`, `expect_flagged`)
  ve betada bildirim oranı izlenir.
- **Yeniden değerlendirme tetikleri:** değerlendirme setinde tek bir yaşa uygunluk ihlalinin
  kaçması, betada "inappropriate" bildirimlerinin binde 1'i geçmesi ya da hukuk danışmanının AIQ-04'ü
  "bağımsız filtre" olarak yorumlaması. Bu durumda Seçenek 2 (yalnızca çıktı metni üzerinde, ucuz
  modelle) eklenir.

## Sonuçlar

- (+) Ek maliyet ve gecikme yok; uygunsuz belge tek istekte durdurulur.
- (+) Bildirim + insan incelemesi, modelin kaçırdığını yakalar ve veri üretir.
- (−) Denetim ile üretim aynı modelde; model hem üretip hem kendini denetliyor. Bağımsız ikinci
  görüş yok. Bu risk güvenlik incelemesinde açık madde olarak izlenir (`analysis/security_review.md`).
- (−) Girdi metni üzerinde, modelden önce çalışan bir ön filtre yok.

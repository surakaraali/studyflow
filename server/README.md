# Geliştirme yapay zekâ sunucusu

Yerel modda (Supabase anahtarı yokken) uygulama, PDF işleme isteklerini bu bilgisayarda çalışan
küçük bir sunucuya gönderir. Sunucu yapay zekâ sağlayıcısının API'sini çağırır ve özet, quiz ve kartları geri döner.
API anahtarı yalnızca bu bilgisayarda durur; uygulamanın içine hiçbir zaman girmez.

Canlı ortamda aynı iş `supabase/functions/process-document` Edge Function'ında yapılır. İki taraf da
`supabase/functions/_shared/ai/` altındaki ortak kodu (istemler, şemalar, doğrulama, fiyat) kullanır.

## Çalıştırma

```bash
# Örnek içerikle (anahtar gerekmez): akışları denemek için
npm run ai:mock

# Gerçek modelle: önce anahtarı ekle
echo 'ANTHROPIC_API_KEY=sk-ant-...' >> .env.local
npm run ai:dev
```

Sunucu varsayılan olarak `http://127.0.0.1:8787` adresinde dinler. Uygulama bu adresi
`EXPO_PUBLIC_AI_DEV_URL` değişkeninden okur (varsayılanı aynı adres).

- **iOS simülatörü:** ek ayar gerekmez.
- **Gerçek telefon:** telefon ve bilgisayar aynı Wi-Fi'da olmalı. Sunucuyu
  `AI_DEV_HOST=0.0.0.0 npm run ai:dev` ile başlat ve `.env.local` içinde
  `EXPO_PUBLIC_AI_DEV_URL=http://<bilgisayarın-yerel-IP'si>:8787` yaz. Anahtar ağdaki herkesin
  kullanımına açılacağı için bunu yalnızca güvendiğin ağda yap.
- **Android emülatörü:** `EXPO_PUBLIC_AI_DEV_URL=http://10.0.2.2:8787`.

## Ortam değişkenleri

| Değişken | Varsayılan | Açıklama |
|---|---|---|
| `ANTHROPIC_API_KEY` | — | Gerçek mod için gerekli. `.env.local` dosyasından da okunur. |
| `AI_MODEL` | `claude-opus-5-5` | Kullanılacak model. |
| `AI_DEV_PORT` | `8787` | Port. |
| `AI_DEV_HOST` | `127.0.0.1` | Telefondan erişmek için `0.0.0.0`. |

Anahtar yokken ve `--mock` verilmemişken sunucu yine açılır, ama her isteğe açıklamalı bir `503`
döner; uygulama bunu "sunucu hazır değil" olarak gösterir ve daha sonra tekrar dener.

## Uç noktalar

`GET /health` → `{ ok, mode: "mock" | "live" | "no_key", model }`

`POST /v1/process` — gövde (yalnızca bu alanlar kabul edilir, BR-05):

```json
{
  "pdf": "<base64 PDF>",
  "grade": 8,
  "segment": "ortaokul",
  "courseName": "Fen Bilimleri",
  "optionCount": 4,
  "quizCount": 10,
  "cardCount": 15,
  "pageCount": 12
}
```

Yanıt: `{ summary: { sections }, quiz: { questions }, cards: { cards }, usage: [...], flagged }`.
Belge çocuklar için uygun değilse `flagged: { reason }` döner ve listeler boştur (SP-02).

Hata yanıtı: `{ error: { code, message, retryable } }` — yeniden denenebilir hatalar `503`,
kalıcı hatalar `422`. İstek gövdeleri ve belge metni hiçbir zaman log'a yazılmaz (PRIV-02);
konsolda yalnızca sayfa sayısı, süre ve maliyet görünür.

## Örnek modunda başka sonuçları denemek

Ders adına şu işaretlerden birini ekle (ör. "Deneme #hata" adında bir ders oluştur):

| İşaret | Sonuç |
|---|---|
| `#uygunsuz` | Belge uygunsuz olarak işaretlenir; uygulama nötr bir mesaj gösterir ve hakkı iade eder. |
| `#hata` | Sağlayıcı kesintisi taklit edilir (`503`); uygulama 30 sn, 2 dk ve 8 dk sonra tekrar dener. |

## Nasıl çalışır

1. Özet, quiz ve kart için üç istek gider. Üçü de aynı sistem istemini, aynı PDF bloğunu
   (önbellek işaretiyle) ve aynı çıktı şemasını kullanır; böylece 2. ve 3. istek PDF'i
   önbellekten okur. Önbellek ilk yanıt akmaya başlayınca okunabilir olduğu için quiz ve kart
   istekleri özetin ilk olayından sonra başlar.
2. Çıktı JSON şemasına uymak zorundadır (structured outputs). Ardından `validate.ts` şık sayısı
   yanlış (BR-12) ya da doğru cevabı geçersiz soruları atar, tekrarları ve boşlukları temizler.
   Yeterli soru veya kart kalmazsa iş yeniden denenir (AIQ-02).
3. Her isteğin token, süre ve maliyeti `usage` içinde döner; uygulama bunları `ai_usage`
   tablosuna yazar (US-38).

Testler: `npx jest server` · Tip kontrolü: `npx tsc -p server`

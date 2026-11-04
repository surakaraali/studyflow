# ADR-005 · Backend hesapları olmadan geliştirme: yerel mod

- **Durum:** Kabul edildi
- **Tarih:** 4 Kasım 2026
- **İlgili:** US-03, PLAN.md §8 (Supabase ve Apple hesapları açık), SEC-02

## Bağlam

Supabase projeleri, Apple Developer ayarları, RevenueCat ve e-posta sağlayıcısı henüz açılmadı.
Buna rağmen ekip; kayıt, veli onayı, PDF işleme, quiz, plan ve satın alma akışlarını simülatörde
uçtan uca deneyebilmeli. Yapay zekâ anahtarı hiçbir koşulda uygulama paketine girmemeli (SEC-02).

## Seçenekler

1. Herkes için paylaşılan bir geliştirme Supabase projesi. Hesap ve maliyet gerektirir; şu an yok.
2. Her geliştiricide yerel Supabase (`supabase start`, Docker). Doğru ama ağır; Docker her makinede yok.
3. **Uygulama içinde "yerel mod":** Supabase anahtarları yoksa her şey cihazda çalışır.

## Karar

Seçenek 3, Seçenek 2 ile birlikte:

- `src/services/config.ts`: `EXPO_PUBLIC_SUPABASE_URL` ve `EXPO_PUBLIC_SUPABASE_ANON_KEY` yoksa
  `backendMode = 'local'`. Hesaplar (`src/services/auth/local.ts`, şifre özeti cihazda), veriler
  (SQLite), veli onayı (`parent-consent` ekranı web sayfasının yerine geçer) ve satın alma (açıkça
  etiketlenmiş test mağazası) cihazda çalışır. Outbox doldurulmaz, eşitleme servisi başlamaz.
- Yapay zekâ işleri yerel geliştirme sunucusuna gider (`server/dev-ai.ts`, `npm run ai:dev`;
  anahtarsız denemeler için `npm run ai:mock`). Anahtar yalnızca bu sunucunun ortamında durur;
  uygulama yalnızca `EXPO_PUBLIC_*` değişkenlerini okur ve `scripts/check-secrets.mjs` bunu CI'da
  denetler.
- Supabase hazır olduğunda aynı kod `backendMode = 'supabase'` ile çalışır: Edge Functions,
  RLS ve eşitleme devreye girer. Docker'ı olan geliştirici `supabase start` ile yerel bir
  backend'e de bağlanabilir (`EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321`).

## Sonuçlar

- (+) Hesaplar açılmadan bütün akışlar denenebilir; demo ve kullanılabilirlik testleri bekletilmez.
- (+) Uygulama kodu iki modda aynı ekranları kullanır; fark servis katmanındadır.
- (−) İki yol bakımı: yerel moddaki onay, kota ve abonelik mantığı sunucudakiyle aynı kalmalı
  (iş kuralları `src/domain/rules.ts`'te tek yerde; sunucudaki kopyalar yorumlarla işaretli).
- (−) Yerel mod güvenlik sınırı değildir: cihazdaki veriler korunmasız sayılır. Mağaza derlemeleri
  her zaman Supabase anahtarlarıyla yapılır; anahtarsız sürüm derlemesinde satın alma kapalıdır.
- (−) RLS, rıza ve e-posta davranışı yalnızca Supabase modunda sınanır (pgTAP testleri ve staging).

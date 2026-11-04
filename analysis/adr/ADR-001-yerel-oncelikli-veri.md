# ADR-001 · Yerel öncelikli veri: SQLite + outbox eşitleme

- **Durum:** Kabul edildi
- **Tarih:** 4 Kasım 2026
- **İlgili:** US-04, US-05, US-46, OFF-01, OFF-03, REL-05, SEC-03, PLAN.md §2–§4
- **Not:** project_plan §7.3'teki ADR tablosu bu numaralandırmaya göre güncellenmelidir
  (çevrimdışı eşitleme kararı bu belgededir).

## Bağlam

Öğrenci planını, kartlarını ve zamanlayıcıyı yolda ya da bağlantısız evde de kullanmalı (OFF-01).
Çevrimdışı yapılan tekrar ve oturum kayıtları kaybolmamalı, bağlantı gelince 30 saniye içinde
eşitlenmeli ve çift kayıt oluşmamalı (US-05, OFF-03, REL-05). PLAN.md §2 sunucu verisi için
TanStack Query öngörüyordu; bu, verinin asıl kaynağının sunucu olduğu bir modeldir.

## Seçenekler

1. **Sunucu öncelikli + TanStack Query önbelleği.** Basit okuma; ama çevrimdışı yazma, kuyruk ve
   çakışma yönetimi ayrıca yazılmalı. Önbellek kalıcı değil; uygulama kapanınca bekleyen değişiklik
   kaybolabilir.
2. **Hazır eşitleme motoru (PowerSync, ElectricSQL, WatermelonDB sync).** Güçlü; fakat ek servis,
   ek maliyet ve çocuk verisi için yeni bir veri işleyen demek. Expo SDK 58 uyumu ayrıca doğrulanmalı.
3. **Yerel öncelikli: cihazda SQLite asıl kaynak, değişiklikler outbox tablosundan Supabase'e
   gönderilir, sunucudaki değişiklikler imleçle çekilir.** Az bağımlılık, tam kontrol, test edilebilir.

## Karar

Seçenek 3. Ayrıntılar:

- **Cihaz:** her kullanıcı için ayrı SQLite dosyası (`src/db/client.ts`). Yazmalar yalnızca
  `upsert / patch / softDelete` (`src/db/write.ts`) ile yapılır; bunlar `updated_at`'i damgalar,
  satırın tamamını `outbox`'a yazar ve canlı sorguları yeniler. Kimlikler istemcide üretilen UUID'dir.
- **Gönderme (push):** outbox sırasıyla okunur, satır başına birleştirilir (son tam satır + sonraki
  silme), tablo tablo 200'lük gruplar hâlinde gönderilir. Düzenlenebilir tablolar `upsert(id)`,
  yalnızca-ekleme tabloları (`consent_records`, `card_reviews`) `insert … on conflict do nothing`
  kullanır; aynı grup iki kez gitse bile çift kayıt oluşmaz. Ağ/sunucu hatasında her şey kuyrukta
  kalır ve üstel beklemeyle yeniden denenir. Sunucunun reddettiği satır tek tek denenerek ayrılır,
  `attempts` artar; 5 retten sonra otomatik denemelerden çıkar ama silinmez (uygulama her açılışta
  bir kez daha dener).
- **Çekme (pull):** her tablo için `synced_at > imleç` olan satırlar sayfa sayfa çekilir. `synced_at`
  sunucunun yazma saatidir (tetikleyici `clock_timestamp()`), bu yüzden cihaz saatleri imleci bozmaz;
  geç kaydedilen işlemler için imleçten 30 sn geriye bakılır. Çekilen satırlar outbox'a girmeden ham
  SQL ile yazılır ve ardından `notifyTables` çağrılır. Outbox'ta bekleyen değişikliği olan satır
  atlanır (önce gönderilir).
- **Çakışma:** son yazan kazanır, ölçüt `updated_at` (istemcinin düzenleme zamanı). Sunucu da aynı
  kuralı uygular: daha eski bir düzenleme daha yeni satırın üzerine yazılamaz (`private.sync_row`).
  Sunucu tarafı yazmalar (Edge Functions) `updated_at`'i ileri alır ki cihazlar kabul etsin.
- **Sunucuya ait sütunlar:** `profiles.plan`, `profiles.consent_status`, `profiles.email`,
  `documents` iş durumu (`status, error_code, attempts, next_attempt_at, counted`) ve
  `content_reports.status` cihazdan gönderilmez, çekmede her zaman sunucudaki değer alınır.
  Veritabanı tetikleyicileri de istemcinin bu sütunları değiştirmesine izin vermez.
- **Tetikleyiciler:** giriş, uygulamanın öne gelmesi, bağlantının geri gelmesi (1 sn içinde),
  aktifken 60 sn'de bir ve yerel yazmadan 2 sn sonra (`src/services/sync/scheduler.ts`). Bekleyen
  ve takılı değişiklik sayısı `useSyncStatus` ile ekranda gösterilebilir (OFF-03).

### Veri tipi eşlemesi (SQLite ↔ Postgres)

Sütun adları iki tarafta aynıdır; satırlar olduğu gibi kopyalanır. Farklar tek yerde,
`src/services/sync/mapping.ts` içindedir:

| Konu | SQLite | Postgres | Eşleme |
|---|---|---|---|
| Tablo adı | `profile` | `profiles` (id = `auth.uid()`) | ad çevrilir, `user_id` eklenmez |
| Sahiplik | — | `user_id uuid not null default auth.uid()` | gönderirken eklenir, çekerken atılır |
| Boolean | `INTEGER 0/1` | `smallint 0/1` + `check` | dönüşüm yok (tek kural: her iki tarafta 0/1) |
| JSON | `TEXT` | `jsonb` | gönderirken `JSON.parse`, çekerken `JSON.stringify`; sunucuda metin olarak saklanmış JSON olduğu gibi alınır |
| Zaman damgası | ISO metin (`…Z`) | `timestamptz` | çekerken `…Z` biçimine normalleştirilir (metin karşılaştırmaları bozulmasın) |
| Saat | `"HH:MM"` | `time` | çekerken `HH:MM:SS` → `HH:MM` |
| Tarih | `"YYYY-MM-DD"` | `date` | dönüşüm yok |
| Cihaza özel | `documents.file_uri` | yok | gönderilmez, çekmede üzerine yazılmaz |
| Sunucuya özel | — | `synced_at`, rıza kaydında `ip`, `user_agent`, inceleme alanları | çekerken cihazda olmayan sütunlar atılır |

Postgres'te çalışma tabloları arasında yabancı anahtar yoktur: cihazlar çevrimdışı ve herhangi bir
sırayla yazar, ebeveyni silinmiş satırlar olabilir. Bütünlük uygulamanın, izolasyon RLS'nin işidir.

### TanStack Query neden şimdilik yok

Ekranlar veriyi zaten cihazdaki SQLite'tan okuyor (`useDbQuery`, tablo olaylarıyla canlı).
Sunucudan doğrudan okunan az sayıda şey (rıza durumu, kota kontrolü, yapay zekâ işi) tek seferlik
çağrılardır. TanStack Query ikinci bir önbellek katmanı ve "hangisi doğru" sorusu getirirdi.
Sunucu öncelikli ekranlar (ör. R2b veli paneli, paylaşılan desteler) geldiğinde yeniden
değerlendirilecek; PLAN.md §2 bu karara göre güncellenmelidir.

## Sonuçlar

- (+) Plan, kart, zamanlayıcı ve dersler internetsiz çalışır; US-05 senaryosu birim testle
  doğrulanır (`src/services/sync/__tests__/engine.test.ts`: 12 tekrar + 1 oturum, tekrar
  çalıştırmada çift kayıt yok, kaybolan yanıt, başarısız gönderimin yeniden denenmesi).
- (+) Ek servis ve ek veri işleyen yok; RLS tek güvenlik sınırı.
- (−) Her SQLite migration'ı için aynı değişikliği yapan bir Postgres migration'ı gerekir; aksi
  hâlde gönderim reddedilir ve değişiklikler kuyrukta takılır. PR kontrol listesine eklenmeli.
- (−) Ham SQL ile yapılan toplu yazmalar outbox'a girmez, eşitlenmez. Toplu işlemler ya yardımcıları
  kullanmalı ya da bilinçli olarak yalnızca cihazda kalmalıdır (ör. belgeleri `src/services/ai`
  kendisi yükler).
- (−) Son yazan kazanır, alan düzeyinde birleştirme yapmaz; iki cihazda aynı anda aynı satırı
  düzenleyen öğrencinin bir değişikliği kaybolabilir. R1 için kabul edilebilir (tek cihaz yaygın).
- (−) Silinen satırlar sunucuda 90 gün `deleted_at` ile kalır, sonra `purge_expired_data` ile
  kalıcı silinir; 90 günden uzun bağlanmayan cihaz silmeyi öğrenmez.

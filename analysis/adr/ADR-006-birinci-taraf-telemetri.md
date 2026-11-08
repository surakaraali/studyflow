# ADR-006 · Ürün analitiği ve çökme raporları: üçüncü taraf SDK yok, kendi sunucumuz

- **Durum:** Kabul edildi
- **Tarih:** 7 Kasım 2026
- **İlgili:** Q-04, Q-07, US-06, OBS-01, OBS-02, OBS-03, OBS-04, PRIV-04, PRIV-05, PRIV-08, SEC-06,
  BRD §11 ve §12, [analytics_events.md](../analytics_events.md), [security_review.md](../security_review.md)
- **Not:** project_plan §7.3'teki ADR tablosunda bu konu "007" olarak planlanmıştı; numara bu
  belgeye göre güncellenmelidir (plan motoru kararı için sıradaki numara kullanılır).

## Bağlam

Uygulamanın kullanıcıları 10–18 yaş arası öğrenciler. Uygulama Apple'ın Kids kategorisine girebilir
(Q-07); bu kategoride üçüncü taraf analitik ve reklam SDK'ları neredeyse hiç kabul edilmez (App Store
kuralı 1.3). Veri KVKK kapsamında ve AB'de tutuluyor (BRD §10.2). PLAN.md §2 hata için Sentry, kullanım
için PostHog öngörüyordu; ama hangi aracın çocuk politikalarıyla uyumlu olduğu (Q-04) kapanmadı.

Buna rağmen yayından önce şunlar gerekli:
- çökme ve hata raporları kişisel veri olmadan 5 dakika içinde görünmeli (OBS-01);
- yapay zekâ işlerinin süresi, başarı oranı, token ve maliyeti izlenmeli (OBS-02);
- hata oranı, yapay zekâ başarısızlığı ve maliyet eşiklerinde uyarı gitmeli (OBS-03);
- KPI'lar (G-01–G-05) olay sözlüğüyle ölçülebilmeli (OBS-04).

Olay sözlüğü ve temizleme kuralları (`src/services/analytics.ts`) zaten hazır: kimlik yok, serbest
metin yok, yalnızca listelenmiş özellikler. Eksik olan, olayların gideceği yer.

## Seçenekler

| Seçenek | Artı | Eksi |
|---|---|---|
| Sentry + PostHog (AB bulutu, kimliksiz yapılandırma) | Hazır panolar, kaynak eşleme, oturum analizi | İki yeni veri işleyen ve SDK; Kids kategorisinde risk; varsayılan olarak cihaz bilgisi ve IP toplarlar, her sürümde yeniden doğrulamak gerekir; DPA ve yurt dışı aktarım (Q-03) |
| Kendi barındırdığımız PostHog/Sentry | Veri bizde kalır | İşletme yükü (sunucu, güncelleme, yedek); SDK yine uygulamada |
| **Kendi Supabase'imiz: olaylar ve JS çökme raporları bir Edge Function'a, yerel çökmeler Apple'ın raporlarına** | Yeni SDK ve yeni veri işleyen yok; veri AB'de, aynı RLS ve yedek düzeni; şema bizim kontrolümüzde | Panolar ve sembolleştirme yok; sorgular SQL ile; yerel (native) çökmeler bu yolla gelmez |

## Karar

Üçüncü taraf analitik veya çökme SDK'sı kullanılmaz. Olaylar ve JavaScript çökme raporları kendi
AB Supabase projemize gider; kullanıcı, cihaz, kurulum, oturum kimliği ve IP adresi saklanmaz.

- **Uygulama (`src/services/telemetry/`):** `setAnalyticsSink` ile bağlanan bir sink. Olaylar cihaz
  genelindeki bir kuyrukta bekler (`expo-sqlite/kv-store`, en çok 500 kayıt, çökme raporu en çok 50);
  uygulama arka plana geçince, öne gelince, girişte ve açıkken dakikada bir gönderilir. Yalnızca Supabase
  modunda ve giriş yapılmışken gönderilir; yerel modda olaylar eskisi gibi konsola yazılır. Gönderilen
  kayıtta yalnızca olay adı, izinli özellikler, uygulama sürümü, platform ve işletim sistemi ana sürümü
  vardır; sıra numarası ve zaman damgası gönderilmez.
- **Sunucu (`supabase/functions/telemetry`):** giriş yapmış kullanıcının JWT'si istenir ama kayda
  yazılmaz. En çok 50 kayıt ve 64 KB; olay adları ve özellikler sunucudaki izin listesiyle
  (`_shared/telemetry.ts`) yeniden süzülür, çökme metni yeniden temizlenir. Bu liste `EVENTS` ile
  aynı olmazsa Jest testi kırılır. Hız sınırı kullanıcı başına saatte 300 kayıttır; sayaç anahtarı
  kullanıcı kimliği ve saatin gizli tuzla (`TELEMETRY_HASH_SALT`) HMAC özetidir, 2 saat sonra silinir.
  Yazma `public.telemetry_ingest` ile servis rolünden yapılır.
- **Tablolar (`private` şeması, API'ye kapalı):** `telemetry_events`, `crash_reports`, günlük sayımlar
  (`telemetry_daily`, `crash_daily`). Olay zamanı saate yuvarlanır; böylece aynı istekle gelen kayıtlar
  o saatteki diğerlerinden ayırt edilemez. Çökme raporu zamanı tam tutulur (5 dakika hedefi ve ani
  artış uyarısı için).
- **Saklama:** çökme raporları 30 gün (PRIV-08, log sayılır); ham olaylar 180 gün, yani bir okul dönemi:
  dönem başı ve sonu karşılaştırılabilir, D7 ve 4 haftalık hedefler (G-01, G-03) için fazlasıyla yeter.
  Günlük sayımlar 2 yıl kalır (yıldan yıla karşılaştırma); bunlarda yalnızca liste ve evet/hayır
  özellikleri tutulur, sayılar tutulmaz. Silme işi pg_cron ile saatte bir çalışır.
- **Yerel çökmeler:** Apple'ın kendi raporları (Xcode Organizer, App Store Connect → TestFlight ve
  Çökmeler). Kullanıcı bunları cihaz ayarından paylaşır; ek SDK gerekmez. Android (R2a) için Play
  Console "Android vitals" aynı işi görür.
- **İzleme ve uyarı:** `ops` şemasındaki görünümler (yapay zekâ işleri günlük, aylık maliyet, çökme ve
  hata oranları, fonksiyon yanıtları) ve 5 dakikada bir pg_cron ile çalışan `ops-alerts` fonksiyonu.
  OBS-03 eşikleri, çökme raporlarında ani artış ve aylık yapay zekâ bütçesinin %80'i aşılınca
  `OPS_ALERT_EMAIL` adresine e-posta gider; aynı durum tekrar tekrar e-posta göndermez (6 saatte bir
  hatırlatma, düzelince bir "düzeldi" e-postası).

## Sonuçlar

- (+) PRIV-04/05: yeni SDK yok. Mağaza formlarında yine de "Teşhis → Çökme verileri" ve "Kullanım
  verileri → Ürün etkileşimi" işaretlenmeli: kimliğe bağlı değil, izleme için değil, amaç analitik
  (`store/app-store.md` ve `store/play-store.md` bu karara göre güncellenir).
- (+) Kids kategorisi kapısı açık kalır (Q-07); veri işleyen ve yurt dışı aktarım listesi büyümez (Q-03).
- (+) Analitik verisi kişisel veri değildir: kimlik, IP ve serbest metin yok. İstek sırasında JWT
  doğrulanır ama yalnızca hız sınırı için kullanılır. Hukuk danışmanı bu değerlendirmeyi teyit etmeli.
- (−) Pano yok: KPI'lar ve çökmeler SQL ile okunur (`ops.*` görünümleri, Supabase SQL editörü).
  İhtiyaç büyürse bir BI aracı bu görünümlere salt okunur bağlanabilir.
- (−) JS stack izleri sembolleştirilmez (Hermes bayt kodu konumları). Gerekirse EAS'ın kaynak eşleme
  dosyalarıyla elle çözülür.
- (−) Edge Functions dışındaki backend hataları (PostgREST eşitleme, Auth) bu uyarıya girmez;
  onlar için Supabase panelindeki raporlar ve log gezgini kullanılır.
- (−) Kimlik olmadığı için kullanıcı başına huni veya kohort izlenemez; KPI hesapları
  [analytics_events.md §4](../analytics_events.md) bu sınırla yazılmıştır.
- Yeniden değerlendirme: aylık aktif öğrenci 10.000'i geçerse, sembolleştirilmiş çökme raporu şart
  olursa veya Q-07 Kids kategorisi dışında kapanır ve ekip hazır bir araç isterse.

# StudyFlow – AI Study Planner · Proje Planı

Ders programı, sınav ve çalışma takibi yapan, yapay zekâ destekli mobil çalışma asistanı.
Hedef: önce App Store (iOS), ardından aynı kod tabanıyla Google Play (Android).
Kullanıcılar: ilkokul, ortaokul ve lise öğrencileri ile velileri. İlk sürüm (R1) ortaokul ve lise
öğrencilerine yöneliktir; ilkokul modu ve veli paneli R2b'de gelir.

_Son güncelleme: 3 Kasım 2026_

### Dokümanlar
| Doküman | İçerik |
|---|---|
| [analysis/01_brd.md](analysis/01_brd.md) | İş gereksinimleri: hedefler, paydaşlar, personalar, kapsam, 85 fonksiyonel gereksinim, 25 iş kuralı, açık sorular |
| [analysis/02_nfr.md](analysis/02_nfr.md) | 81 fonksiyonel olmayan gereksinim (performans, güvenlik, çocuk verisi, erişilebilirlik, yapay zekâ kalitesi) |
| [agile/backlog.md](agile/backlog.md) | 18 epic, 70 kullanıcı hikâyesi + 2 spike, kabul kriterleri, sprint ataması, izlenebilirlik |
| [agile/project_plan.md](agile/project_plan.md) | Ekip ve RACI, sprint ve sürüm planı, CI/CD, test stratejisi, yayın, operasyon, risk kaydı, bütçe |

---

## 1. Ürün kapsamı

### İlk sürüm (MVP)
| Alan | İçerik |
|---|---|
| Ders ve sınav takvimi | Ders ekleme, sınav tarihi, konu listesi |
| PDF → özet, quiz, flashcard | PDF yükle, yapay zekâ ile üret, sonucu düzenle |
| Flashcard çalışma | Aralıklı tekrar (FSRS), internetsiz çalışır |
| Akıllı çalışma takvimi | Sınav tarihine ve müsait saatlere göre otomatik plan |
| Çalışma takibi | Zamanlayıcı, toplam süre, seri (streak) |
| Performans analizi | Doğru oranı, çalışma süresi, ders bazında ilerleme |
| Hatırlatmalar | Yerel bildirim + push |
| Abonelik | Ücretsiz kota + Pro plan (yapay zekâ maliyeti nedeniyle şart) |

### Sonraki sürümler
Fotoğraftan not okuma · yapay zekâ ile sohbet (öğretmen modu) · Google/Apple takvim senkronu ·
performansa göre kendini yeniden planlayan takvim · zayıf konu tespiti ve hazırlık skoru ·
Pomodoro / odak modu · widget · paylaşılan desteler.

---

## 2. Teknoloji kararları

| Katman | Seçim | Neden |
|---|---|---|
| Mobil | **Expo SDK 58** (React Native 0.88, TypeScript) | Tek kod tabanı → iOS + Android. EAS ile bulutta derleme, mağazaya gönderme ve OTA güncelleme |
| Navigasyon | expo-router (dosya tabanlı, `src/app/`), yerel sekmeler (NativeTabs) | iOS ve Android'de platformun kendi sekme çubuğu |
| Sunucu verisi | Cihazda SQLite + eşitleme kuyruğu (outbox) | Uygulama çevrimdışı öncelikli: ekranlar cihazdaki veriyi okur, değişiklikler arka planda Supabase'e eşitlenir. TanStack Query şimdilik gerekmedi ([ADR-001](analysis/adr/ADR-001-yerel-oncelikli-veri.md)) |
| Uygulama durumu | Zustand | Küçük, sade, öğrenmesi kolay |
| Cihazda veri | expo-sqlite | Flashcard tekrarı ve takvim internetsiz çalışır |
| Backend | **Supabase** (Postgres, Auth, Storage, Edge Functions) | Veri ilişkisel (ders → sınav → konu → kart); giriş, dosya ve sunucu fonksiyonları tek yerde; satır bazlı güvenlik (RLS) |
| Yapay zekâ | **Claude API**, yalnızca Edge Functions üzerinden | PDF'yi doğrudan okur (600 sayfa / 32 MB), çıktıyı JSON şemasına uydurur (structured outputs) |
| Aralıklı tekrar | FSRS (`ts-fsrs`) | Modern, açık kaynak algoritma; yapay zekâ gerektirmez, cihazda çalışır |
| Çoklu dil | i18next + expo-localization | Arayüz Türkçe; İngilizce eklemeye hazır |
| Bildirim | expo-notifications | Hatırlatmalar ve "Quiz'in hazır" bildirimleri |
| Abonelik | RevenueCat | App Store + Google Play aboneliklerini tek yerden yönetir |
| İzleme | Kendi Supabase'imiz (ürün olayları, JS çökme raporları, uyarılar); yerel çökmeler için Apple'ın raporları | Çocuk uygulaması: üçüncü taraf analitik/çökme SDK'sı yok (Q-04 → [ADR-006](analysis/adr/ADR-006-birinci-taraf-telemetri.md)) |
| Derleme / yayın | EAS Build + EAS Submit, TestFlight | Bulutta derleme; gerekirse yerelde Xcode |

**Uygulama kimliği:** `com.cobanov.studyflow`

---

## 3. Mimari

```
┌──────────────────────┐        ┌──────────────────────────────────────┐
│  Mobil uygulama      │        │  Supabase                            │
│  (Expo / RN)         │        │                                      │
│                      │  HTTPS │  Auth ─ Postgres (RLS) ─ Storage     │
│  Ekranlar            │◄──────►│              │                       │
│  SQLite + outbox     │ eşitle │  Edge Functions                      │
│  Zustand (oturum)    │        │   ├─ process-document  ──► Claude API│
│  Plan motoru (cihaz) │        │   ├─ consent / consent-request       │
│  FSRS (cihazda)      │        │   ├─ delete-account, support         │
│                      │        │   └─ revenuecat-webhook, bakım (cron)│
└──────────┬───────────┘        └──────────────────────────────────────┘
           │ push bildirimi ◄── iş bitince
```

### Temel kurallar
1. **Yapay zekâ anahtarı uygulamada asla yer almaz.** Tüm çağrılar Edge Functions üzerinden yapılır; kullanıcı başına kota burada uygulanır.
2. **Akıllı takvimi bir algoritma kurar, yapay zekâ destekler.** Planlayıcı; sınav tarihi, müsait saatler, konu ağırlığı ve son performansa göre günlük çalışma blokları üretir. Yapay zekâ konuları çıkarır, zorluk tahmin eder ve planı açıklar. Sebep: tutarlılık, test edilebilirlik, düşük maliyet.
3. **PDF işleme arka planda çalışır.** Yükle → Storage → Edge Function → Claude → sonuç veritabanına → push bildirimi.
4. **PDF bir kez okunur, çok kez kullanılır.** Aynı PDF'den özet, quiz ve flashcard üretirken prompt caching kullanılır (önbellekten okuma ≈ %95 daha ucuz).
5. **Çevrimdışı öncelikli çalışma:** flashcard tekrarı ve plan görüntüleme cihazda; yapay zekâ işlemleri çevrimiçi.

---

## 4. Veri modeli (taslak)

| Tablo | Amaç |
|---|---|
| `profiles` | Kullanıcı bilgisi, dil, günlük çalışma hedefi |
| `courses` | Dersler (ad, renk, dönem) |
| `exams` | Sınavlar (ders, tarih, tür, ağırlık) |
| `topics` | Konular (ders, sınav, zorluk, tahmini süre) |
| `documents` | Yüklenen PDF'ler ve işlenme durumu |
| `quizzes` / `questions` | Üretilen quizler ve sorular |
| `quiz_attempts` | Quiz denemeleri ve sonuçları |
| `decks` / `cards` | Flashcard desteleri ve kartlar |
| `card_reviews` | Kart tekrar geçmişi ve FSRS durumu |
| `study_sessions` | Çalışma oturumları (süre, ders, konu) |
| `plan_items` | Akıllı takvimin ürettiği çalışma blokları |
| `ai_usage` | Yapay zekâ kullanımı ve kota takibi |

---

## 5. Yapay zekâ ve maliyet

Örnek iş: 30 sayfalık PDF'den quiz + flashcard (≈ 45–90 bin token girdi, ≈ 5 bin token çıktı).

| Model | Fiyat (girdi / çıktı, 1M token) | PDF başına (yaklaşık) |
|---|---|---|
| Claude Opus 5.5 | $4 / $20 | $0.30–0.50 |
| Claude Sonnet 5.5 | $2 / $10 | $0.15–0.25 |
| Claude Haiku 5.5 | $0.10 / $0.50 | ≈ $0.01 |

- Başlangıç: en yüksek kalite (Opus 5.5). Gerçek ders PDF'leriyle Haiku 5.5 karşılaştırılacak; kalite yeterliyse yoğun işler ucuz modele taşınacak.
- Acil olmayan toplu işlerde Batch API (%50 indirim).
- Ücretsiz planda aylık PDF kotası; Pro planda geniş kota.
- Kullanıcının PDF'i yapay zekâ servisine gönderilmeden önce açık izin alınır (Apple kuralı + KVKK); 18 yaş altında veli onayı gerekir.
- Yapay zekâya kişisel veri (ad, e-posta, okul, doğum yılı) gönderilmez; yalnızca belge içeriği, sınıf seviyesi ve ders adı gider (BRD BR-05).

---

## 6. Mağaza gereksinimleri

- [ ] Apple Developer Program ($99/yıl)
- [ ] Google Play Console ($25, tek seferlik) — kişisel hesapta yayından önce **12 test kullanıcısıyla 14 gün kapalı test** zorunlu
- [ ] Uygulama içinden hesap silme (iki mağaza da zorunlu tutuyor)
- [ ] Apple ile giriş (Google ile giriş sunulacaksa)
- [ ] Abonelikler mağaza ödeme sistemiyle (RevenueCat)
- [ ] Gizlilik politikası, Apple gizlilik etiketi, Google "Data safety" formu
- [ ] Yapay zekâya veri gönderimi için açık izin ekranı
- [ ] 13 yaş altı kullanıcılar olduğu için: veli onayı, veli kapısı, Apple çocuk kuralları ve Google Aile Politikası (BRD §12)
- [ ] Hata izleme ve analitikte kişisel veri ve reklam kimliği gönderilmez (NFR PRIV-04)
- [ ] App Store'da uygulama adının müsait olduğunu kontrol et ("StudyFlow" alınmış olabilir)

---

## 7. Yol haritası

### Faz 0 — Hazırlık
- [x] Teknoloji kararları
- [x] Expo iskeleti (SDK 58, TypeScript, expo-router)
- [x] Tasarım temeli (renkler, yazı tipleri, boşluklar) ve çoklu dil altyapısı
- [x] Sekme yapısı ve başlangıç ekranları
- [x] İş gereksinimleri, NFR, backlog ve uçtan uca proje planı
- [ ] Supabase projesi (şema, RLS ve fonksiyonlar `supabase/` altında hazır; proje açılınca uygulanacak)
- [ ] Android geliştirme ortamı (Android Studio, Java)

### Faz 1 — Temel
- [x] Giriş (e-posta, Apple) — Google R1.1
- [x] Ders / sınav / konu yönetimi
- [x] Takvim görünümü
- [x] Çalışma zamanlayıcı ve oturum kaydı
- [x] Hatırlatma bildirimleri

### Faz 2 — Yapay zekâ
- [x] PDF yükleme ve arka planda işleme
- [x] Özet, quiz ve flashcard üretimi
- [x] Quiz çözme ekranı
- [x] FSRS ile kart tekrarı

### Faz 3 — Akıllı takvim ve analiz
- [x] Otomatik çalışma planı
- [x] Performans ekranı

### Faz 4 — Yayın hazırlığı
- [x] RevenueCat ve kota (mağaza ürünleri tanımlanınca canlı)
- [x] Hesap silme, gizlilik metinleri (taslak), izin ekranları
- [x] Hata ve kullanım izleme (Q-04 → [ADR-006](analysis/adr/ADR-006-birinci-taraf-telemetri.md): kendi sunucumuz, üçüncü taraf SDK yok)

### Faz 5 — Beta ve yayın
- [ ] TestFlight
- [ ] Play kapalı testi (14 gün)
- [ ] Mağaza görselleri ve metinleri (metin taslakları `store/` altında)
- [ ] Yayın

---

R1 kodlamasının hikâye bazında durumu: [agile/backlog.md §10](agile/backlog.md#10-uygulama-durumu-4-kasım-2026).

Ayrıntılı sprint takvimi, tarihler ve sürüm planı: [agile/project_plan.md](agile/project_plan.md).
Özet: R1 (iOS) 31 Mart 2027 · R1.1 ve Android (R2a) 24 Mayıs 2027 · İlkokul ve veli (R2b) 13 Eylül 2027.

---

## 8. Kararlar ve açık sorular

**Alınan kararlar (3 Kasım 2026):**
- Proje hem portföy hem gerçek ürün.
- Analiz ve plan dokümanları Türkçe; uygulama arayüzü Türkçe, İngilizceye hazır.
- Hedef kitle: ilkokul, ortaokul ve lise öğrencileri + veliler. R1 ortaokul ve lise.
- Önce iOS; Google Play hesabı R2a öncesi açılacak.

**Açık sorular:** BRD [§17](analysis/01_brd.md#17-açık-sorular) (Q-01–Q-08): ilkokulun R2b'ye ertelenmesi,
veli onayı yaş eşiği, KVKK yurt dışı aktarım, çocuk politikalarına uygun analitik (Q-04, kapandı:
[ADR-006](analysis/adr/ADR-006-birinci-taraf-telemetri.md)), fiyat, e-posta
sağlayıcısı, App Store kategorisi, ad müsaitliği. Ayrıca: Apple Developer hesabı (ayikla'daki takım)
ve Supabase hesabı.

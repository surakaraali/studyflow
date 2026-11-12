# StudyMark — Fonksiyonel Olmayan Gereksinimler (NFR)

| Alan | Değer |
|---|---|
| Doküman | 02 · Fonksiyonel Olmayan Gereksinimler |
| Sürüm | 0.1 (taslak) |
| Tarih | 3 Kasım 2026 |
| Hazırlayan | İş Analisti, Tech Lead ile birlikte |
| Durum | İnceleme bekliyor |
| İlgili | [01_brd.md](01_brd.md) · [PLAN.md](../PLAN.md) · [Proje planı](../agile/project_plan.md) |

Gereksinimler ISO/IEC 25010 kalite özelliklerine göre gruplanmıştır. Her gereksinim ölçülebilir
bir hedef ve doğrulama yöntemi içerir. Aksi belirtilmedikçe **R1** için geçerlidir.

**Doğrulama yöntemleri:** Test = otomatik/elle test · Ölçüm = üretim veya beta metriği ·
İnceleme = kod/tasarım/doküman incelemesi · Denetim = kontrol listesi.

## 1. Performans (PERF)
| ID | Gereksinim ve hedef | Doğrulama |
|---|---|---|
| PERF-01 | Soğuk açılış: iPhone 12 ve üstünde ≤ 2,5 sn, en eski desteklenen cihazda ≤ 4 sn (yayın derlemesi, 10 ölçümün medyanı). | Test |
| PERF-02 | Sekme geçişi ve ekran açılışı p95 ≤ 300 ms. | Test |
| PERF-03 | 500 öğeli listelerde kaydırma 60 fps; düşen kare oranı ≤ %1. | Test |
| PERF-04 | Kart çevirme ve değerlendirme tepkisi ≤ 100 ms (yerel işlem). | Test |
| PERF-05 | Belge işleme (özet + quiz + kart): 20 sayfa p95 ≤ 3 dk; 100 sayfa p95 ≤ 10 dk. | Ölçüm |
| PERF-06 | Okuma API'leri Türkiye'den p95 ≤ 500 ms. | Ölçüm |
| PERF-07 | 14 günlük plan üretimi ≤ 2 sn. | Test |
| PERF-08 | Mağazadan indirme boyutu ≤ 60 MB. | Ölçüm |
| PERF-09 | 30 dakikalık zamanlayıcı oturumu ekran kapalıyken ≤ %5 pil tüketir. | Test |

## 2. Güvenilirlik (REL)
| ID | Gereksinim ve hedef | Doğrulama |
|---|---|---|
| REL-01 | Backend aylık erişilebilirliği ≥ %99,5. | Ölçüm |
| REL-02 | Çökmesiz oturum ≥ %99,5; çökmesiz kullanıcı ≥ %99. | Ölçüm |
| REL-03 | Başarısız yapay zekâ işi üstel beklemeyle 3 kez yeniden denenir; kalıcı hatada anlaşılır mesaj gösterilir ve kota iade edilir (BR-14). | Test |
| REL-04 | Günlük yedek; veri kaybı penceresi (RPO) ≤ 24 saat, geri dönüş süresi (RTO) ≤ 8 saat. Geri yükleme her çeyrekte bir kez denenir. | Denetim |
| REL-05 | Çevrimdışı yapılan tekrar ve oturum kayıtları kaybolmaz. Kayıtlar yalnızca eklenir (append-only); profil gibi düzenlenebilir alanlarda son yazan kazanır. | Test |
| REL-06 | Yapay zekâ sağlayıcısı erişilemezken diğer özellikler çalışır; işler en çok 24 saat kuyrukta bekler. | Test |

## 3. Güvenlik (SEC)
| ID | Gereksinim ve hedef | Doğrulama |
|---|---|---|
| SEC-01 | Tüm ağ trafiği TLS 1.2+ ile şifrelenir. | Test |
| SEC-02 | Yapay zekâ ve servis anahtarları uygulama paketinde bulunmaz; yalnızca sunucu ortam değişkenlerindedir. Paket taramasıyla doğrulanır. | Test |
| SEC-03 | Tüm tablolarda satır bazlı güvenlik (RLS) açıktır; kullanıcı yalnızca kendi verisine erişir. Her tablo için yetkisiz erişim testi vardır. | Test |
| SEC-04 | Belgeler özel depolama alanında tutulur; erişim ≤ 10 dk geçerli imzalı bağlantıyla verilir. | Test |
| SEC-05 | Oturum bilgileri cihazın güvenli deposunda (Keychain / Keystore) saklanır. | İnceleme |
| SEC-06 | Sunucu fonksiyonları kimlik doğrular, girdiyi şemayla doğrular ve hız sınırı uygular (ör. belge yükleme saatte 10). | Test |
| SEC-07 | Bağımlılık taraması her PR'da çalışır; kritik açıklar 7 gün, yüksek açıklar 30 gün içinde kapatılır. | Denetim |
| SEC-08 | Yayın öncesi OWASP MASVS L1 kontrol listesi tamamlanır. | Denetim |
| SEC-09 | Yönetim panellerine erişim en az yetki ilkesiyle ve iki adımlı doğrulamayla yapılır. | Denetim |
| SEC-10 | Yüklenen dosyanın türü, boyutu ve sayfa sayısı sunucuda da doğrulanır. | Test |

## 4. Gizlilik ve çocuk verisi (PRIV)
| ID | Gereksinim ve hedef | Doğrulama |
|---|---|---|
| PRIV-01 | Toplanan veriler BRD §10.1 ile sınırlıdır; yeni bir kişisel veri alanı gizlilik incelemesi olmadan eklenemez. | İnceleme |
| PRIV-02 | Yapay zekâ isteklerinde kişisel veri bulunmaz (BR-05). İstek gövdeleri loglanmaz. Otomatik test, isteklerde e-posta ve ad desenlerini arar. | Test |
| PRIV-03 | Yapay zekâ sağlayıcısının API verilerini model eğitiminde kullanmadığı ve saklama süresi sözleşmeyle teyit edilir. | Denetim |
| PRIV-04 | Reklam kimliği (IDFA/AAID), kesin konum ve kişiler listesi toplanmaz; uygulama takip izni (ATT) istenmez. | İnceleme |
| PRIV-05 | Üçüncü taraf SDK listesi ve her birinin topladığı veri belgelenir; mağaza formlarıyla tutarlıdır. | Denetim |
| PRIV-06 | Rıza kayıtları değiştirilemez (yalnızca ekleme) ve yasal süre boyunca saklanır. | Test |
| PRIV-07 | Hesap silme en geç 30 günde tamamlanır ve e-postayla bildirilir. | Test |
| PRIV-08 | Loglarda kişisel veri maskelenir; log saklama ≤ 30 gün. | İnceleme |
| PRIV-09 | Aydınlatma ve rıza metinleri çocuk ve veli için ayrı, sade dilde hazırlanır. | İnceleme |

## 5. Kullanılabilirlik ve yaşa uygunluk (USE)
| ID | Gereksinim ve hedef | Doğrulama |
|---|---|---|
| USE-01 | Yeni kullanıcı ilk planını ≤ 5 dakikada oluşturur (beta gözleminde 10 kullanıcıdan en az 8'i). | Ölçüm |
| USE-02 | Arayüz metinleri 5. sınıf okuma düzeyindedir; teknik terim kullanılmaz. | İnceleme |
| USE-03 | Dokunma hedefleri ≥ 44×44 pt; ilkokul arayüzünde ≥ 56×56 pt. | İnceleme |
| USE-04 | Her boş ekran ne yapılacağını söyler ve tek bir ana eylem sunar. | İnceleme |
| USE-05 | Hata mesajları ne olduğunu ve nasıl düzeltileceğini söyler; suçlayıcı dil kullanılmaz. | İnceleme |
| USE-06 | Silme gibi geri alınamaz işlemler onay ister; mümkün olan yerlerde geri alma sunulur. | Test |
| USE-07 | Beta anketinde SUS skoru ≥ 75. | Ölçüm |
| USE-08 | Zamanlayıcı ekranında dikkat dağıtan öğe yoktur. Abonelik ekranında yanıltıcı tasarım (gizli iptal, sahte geri sayım) kullanılmaz. | İnceleme |

## 6. Erişilebilirlik (ACC)
| ID | Gereksinim ve hedef | Doğrulama |
|---|---|---|
| ACC-01 | Renk kontrastı WCAG 2.2 AA: normal metin ≥ 4,5:1, büyük metin ≥ 3:1. | Test |
| ACC-02 | Ana akışlar VoiceOver ve TalkBack ile baştan sona tamamlanabilir; her etkileşimli öğenin etiketi vardır. | Test |
| ACC-03 | Dinamik yazı boyutu en büyük erişilebilirlik boyutuna kadar düzeni bozmaz. | Test |
| ACC-04 | "Hareketi azalt" ayarı açıkken animasyonlar kapatılır. | Test |
| ACC-05 | Renk tek başına anlam taşımaz (doğru/yanlış ikon ve metinle de gösterilir). | İnceleme |

## 7. Uyumluluk ve platform (COMP)
| ID | Gereksinim ve hedef | Doğrulama |
|---|---|---|
| COMP-01 | iOS 17 ve üstü; iPhone SE (3. nesil) ile Pro Max arası tüm ekran boyutları. | Test |
| COMP-02 | Android 10 (API 29) ve üstü (R2a). | Test |
| COMP-03 | iPad'de iPhone düzeniyle sorunsuz çalışır; iPad'e özel düzen R3. | Test |
| COMP-04 | Açık ve koyu tema desteklenir. | Test |
| COMP-05 | Expo SDK yılda en az bir kez güncellenir; desteği biten SDK'da kalınmaz. | Denetim |

## 8. Çevrimdışı çalışma (OFF)
| ID | Gereksinim ve hedef | Doğrulama |
|---|---|---|
| OFF-01 | Çevrimdışıyken Bugün planı, kart tekrarı, zamanlayıcı ve ders/sınav görüntüleme çalışır. | Test |
| OFF-02 | Çevrimdışıyken yapay zekâ ve satın alma kapalıdır ve bu açıkça gösterilir. | Test |
| OFF-03 | Bağlantı geldikten sonra 30 sn içinde eşitleme başlar; bekleyen öğe sayısı görünür. | Test |

## 9. Yapay zekâ kalitesi ve güvenliği (AIQ)
| ID | Gereksinim ve hedef | Doğrulama |
|---|---|---|
| AIQ-01 | Değerlendirme seti: her segment ve ana ders için en az 30 gerçek belge. Eğitim danışmanı puanlamasında soruların ≥ %95'i doğru; yaşa uygunluk ihlali 0. | Test |
| AIQ-02 | Çıktılar JSON şemasına uyar (structured outputs). Uymayan çıktı gösterilmez, yeniden üretilir. | Test |
| AIQ-03 | Her soru ve kart kaynak sayfa içerir; değerlendirme setinde belge dışı bilgi oranı ≤ %2. | Test |
| AIQ-04 | Girdi ve çıktı uygunsuz içerik denetiminden geçer; uygunsuz belge işlenmez ve nötr bir mesaj gösterilir. | Test |
| AIQ-05 | Model veya istem (prompt) değişikliği değerlendirme setini geçmeden yayına alınmaz. | Denetim |
| AIQ-06 | Bildirilen içeriklerin %90'ı 3 iş günü içinde incelenir. | Ölçüm |
| AIQ-07 | 20 sayfalık belge başına ortalama yapay zekâ maliyeti hedefi ≤ $0,05; aylık bütçenin %80'inde alarm. | Ölçüm |

## 10. Bakım kolaylığı (MAIN)
| ID | Gereksinim ve hedef | Doğrulama |
|---|---|---|
| MAIN-01 | TypeScript strict modda; lint ve tip kontrolü CI'da zorunludur. | Test |
| MAIN-02 | İş mantığı modüllerinde (plan motoru, FSRS katmanı, net hesabı, kota) birim test kapsamı ≥ %80. | Test |
| MAIN-03 | Veritabanı değişiklikleri yalnızca sürümlü migration dosyalarıyla yapılır. | İnceleme |
| MAIN-04 | Önemli mimari kararlar ADR (Architecture Decision Record) olarak kaydedilir. | İnceleme |
| MAIN-05 | Kullanıcıya görünen metinler kodda değil i18n dosyalarındadır. | İnceleme |

## 11. Gözlemlenebilirlik (OBS)
| ID | Gereksinim ve hedef | Doğrulama |
|---|---|---|
| OBS-01 | Çökme ve hata raporları kişisel veri içermeden 5 dk içinde görünür. | Test |
| OBS-02 | Yapay zekâ işleri için süre, başarı oranı, token ve maliyet panoda izlenir. | İnceleme |
| OBS-03 | Uyarılar: backend hata oranı > %2 (5 dk), yapay zekâ başarısızlığı > %5 (15 dk), maliyet bütçenin %80'i. | Test |
| OBS-04 | Ürün analitiği olay sözlüğü tanımlıdır ve her olay bir KPI'ya (G-01–G-05) bağlıdır. | İnceleme |

## 12. Yerelleştirme (L10N)
| ID | Gereksinim ve hedef | Doğrulama |
|---|---|---|
| L10N-01 | Arayüz Türkçedir; tüm metinler i18n anahtarlarıyla yönetilir; İngilizce dosyası yapısal olarak eksiksizdir. | Test |
| L10N-02 | Tarih, saat ve sayılar tr-TR biçimindedir; hafta pazartesi başlar; 24 saat biçimi kullanılır. | Test |
| L10N-03 | Türkçe karakterler arama ve sıralamada doğru işlenir (ı/I, i/İ dönüşümleri tr-TR kurallarıyla). | Test |

## 13. Mağaza uyumu (STORE)
| ID | Gereksinim ve hedef | Doğrulama |
|---|---|---|
| STORE-01 | Her mağaza gönderiminden önce App Store ve Google Play kontrol listesi doldurulur (çocuk kuralları, gizlilik, ödeme, hesap silme). | Denetim |
| STORE-02 | Apple gizlilik etiketi ve Google Veri güvenliği formu SDK listesiyle tutarlıdır. | Denetim |
| STORE-03 | Hesap silme uygulama içinden ve bir web sayfasından yapılabilir. | Test |
| STORE-04 | Abonelik ekranında fiyat, dönem, otomatik yenileme ve iptal bilgisi ile geri yükleme düğmesi bulunur. | İnceleme |
| STORE-05 | OTA güncellemeler yalnızca hata düzeltme ve küçük iyileştirmeler için kullanılır; yeni özellik mağaza sürümüyle gelir. | Denetim |

## 14. Maliyet (COST)
| ID | Gereksinim ve hedef | Doğrulama |
|---|---|---|
| COST-01 | 1.000 aylık aktif kullanıcıya kadar altyapı maliyeti (yapay zekâ hariç) ≤ $150/ay. | Ölçüm |
| COST-02 | Kullanıcı başına yapay zekâ maliyeti G-06'yı iki ay üst üste aşarsa model ve kota ayarı gözden geçirilir. | Ölçüm |

## 15. Özet

| Grup | Adet |
|---|---|
| Performans | 9 |
| Güvenilirlik | 6 |
| Güvenlik | 10 |
| Gizlilik ve çocuk verisi | 9 |
| Kullanılabilirlik | 8 |
| Erişilebilirlik | 5 |
| Uyumluluk | 5 |
| Çevrimdışı | 3 |
| Yapay zekâ kalitesi | 7 |
| Bakım kolaylığı | 5 |
| Gözlemlenebilirlik | 4 |
| Yerelleştirme | 3 |
| Mağaza uyumu | 5 |
| Maliyet | 2 |
| **Toplam** | **81** |

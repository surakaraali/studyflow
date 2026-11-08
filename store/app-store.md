# StudyFlow — App Store Connect Taslağı (R1)

| Alan | Değer |
|---|---|
| Doküman | App Store Connect metinleri, URL'ler, yaş derecelendirmesi, gizlilik etiketi, şifreleme beyanı, inceleme notu, ekran görüntüleri |
| Sürüm | 0.2 (taslak) |
| Tarih | 7 Kasım 2026 |
| Hazırlayan | İş Analisti, Tech Lead ve tasarım ile birlikte |
| Durum | İnceleme bekliyor; Q-05, Q-07, Q-08 kararlarına ve yasal metinlerin hukuk onayına (H-01) bağlı |
| İlgili | [Yayına çıkış runbook'u](../analysis/go_live.md) · [01_brd.md](../analysis/01_brd.md) · [02_nfr.md](../analysis/02_nfr.md) §13 · [Güvenlik incelemesi](../analysis/security_review.md) · [ADR-006](../analysis/adr/ADR-006-birinci-taraf-telemetri.md) · [Proje planı](../agile/project_plan.md) §11 · [Google Play taslağı](play-store.md) |

Hikâye: US-69. Teslim: 12 Mart 2027 (proje planı §11.1). Karakter sayıları Unicode karakteridir; Türkçe
harfler UTF-8'de 2 bayt tuttuğu için bayt sayısı da verildi. Sayılar metin değişince yeniden ölçülür.

## 1. Uygulama adı

| Seçenek | Metin | Karakter |
|---|---|---|
| Ana | StudyFlow | 9 |
| Yedek 1 | StudyFlow: Ders Planlayıcı | 26 |
| Yedek 2 | Ders Akışı: Çalışma Planı | 25 |

**Açık madde (Q-08, Ürün sahibi):** "StudyFlow" adı App Store'da ve marka tescilinde müsait mi? Yedek 1 aynı
markayı korur, yalnızca mağazada benzersizlik sağlar; marka sorunu varsa Yedek 2 (Türkçe yeni ad) kullanılır.
`studyflow.app` alan adı da aynı kararla teyit edilir; aşağıdaki URL'ler buna bağlı ve değişirse güncellenecek
yerlerin tam listesi [go_live.md §2](../analysis/go_live.md#2-son-adrese-bağlı-yerler)'de.

## 2. Alt başlık (≤ 30 karakter)

| Seçenek | Metin | Karakter |
|---|---|---|
| A (öneri) | Sınav planı, quiz ve kartlar | 28 |
| B | LGS ve YKS için çalışma planı | 29 |
| C | Notundan quiz, sınavına plan | 28 |

A üç ana değeri sayar; B arama için güçlüdür ama ortaokulun yazılı hazırlığını dışarıda bırakıyor gibi okunur.
Alt başlıktaki kelimeler anahtar kelimelerde tekrar edilmez (§5).

## 3. Promosyon metni (≤ 170 karakter, 144)

> Ders notunu yükle, yapay zekâ özet, quiz ve kart hazırlasın. Planın sınav tarihine göre kurulsun, kartların internetsiz de çalışsın. Reklam yok.

## 4. Açıklama (≤ 4000 karakter, 2797)

Yalnızca kodda olan özellikler yazıldı. Android, Google ile giriş, deneme sınavı neti, veli paneli, haftalık veli
e-postası ve fotoğraftan not okuma **yazılmaz** (R1'de yok). Kota ve abonelik satırları Q-05 kararıyla teyit edilir.

```text
StudyFlow, ortaokul ve lise öğrencileri için bir ders çalışma planlayıcısıdır. Derslerini, sınav tarihlerini ve boş saatlerini girersin; StudyFlow her gün ne çalışacağını söyler. Ders notunu yüklersen yapay zekâ özet, quiz ve çalışma kartı hazırlar.

BUGÜN NE ÇALIŞACAĞIN HAZIR
• Okul ders programını ve müsait saatlerini gir. Plan okul saatlerine ve uyku saatine blok koymaz.
• Plan; sınavına kalan güne, konuların zorluğuna ve son sonuçlarına göre önümüzdeki 14 günü kurar.
• Kaçırdığın blok silinmez, sonraki günlere taşınır.
• Okul sınavlarını ve ödevlerini ekle; yaklaşan sınavlar geri sayımla görünür. LGS ve YKS tarihleri hazır gelir.

NOTUNDAN ÖZET, QUIZ VE KART
• PDF ders notunu yükle, sayfa aralığını seç.
• Yapay zekâ sınıf seviyene uygun bir özet, açıklamalı test soruları ve çalışma kartları hazırlar. Her soru ve kart kaynak sayfasını gösterir.
• Yapay zekânın hazırladığı her içerikte "Yapay zekâ ile üretildi, hata içerebilir" etiketi bulunur. Yanlış bulduğun içeriği düzeltebilir ya da bize bildirebilirsin.
• Yapay zekâya yalnızca belgenin içeriği, sınıf seviyen ve dersin adı gider. Adın, e-posta adresin ve doğum yılın gönderilmez.
• Quizde yanlış yaptığın soruları yeniden çözebilirsin.

KARTLARLA TEKRAR, İNTERNETSİZ DE
• Kartların FSRS aralıklı tekrar yöntemiyle, unutmaya başladığın zamanda karşına çıkar.
• Kendi kartlarını da ekleyebilirsin.
• Kart tekrarı, günün planı ve zamanlayıcı internet yokken de çalışır; bağlantı gelince verilerin eşitlenir.

ODAKLAN, İLERLEMENİ GÖR
• Odak zamanlayıcı blok süresine göre çalışır ve molanı hatırlatır.
• Haftalık çalışma süreni, ders bazında doğru oranını, plan uyumunu ve serini gör.
• Hatırlatmalar sessiz saatlere uyar; hangi bildirimleri alacağını sen seçersin.

VELİ ONAYI VE GİZLİLİK
• 18 yaşından küçük kullanıcılar için veliye e-postayla onay bağlantısı gönderilir. Onay gelene kadar yapay zekâ ve satın alma kapalıdır. 13 yaşından küçükler uygulamayı veli onayından sonra kullanmaya başlar.
• Veli onayını istediği zaman geri alabilir.
• Satın alma ekranı bir veli doğrulama adımıyla korunur.
• Reklam yok. Reklam kimliği toplamayız, seni başka uygulamalarda takip etmeyiz.
• Hesabını istediğin zaman uygulamadan silebilirsin.

ÜCRETSİZ VE PRO
• Plan, quiz, kart tekrarı, zamanlayıcı ve ilerleme iki planda da var.
• Ücretsiz planda ayda 3 belge işleyebilirsin (belge başına en çok 20 sayfa).
• StudyFlow Pro ile ayda 40 belge işleyebilirsin (belge başına en çok 100 sayfa). Pro aylık ve yıllık abonelikle alınır.
• Abonelik, dönem sonundan en az 24 saat önce iptal edilmezse otomatik yenilenir. Ödeme Apple Kimliği hesabından alınır. Aboneliğini App Store hesap ayarlarından yönetebilir ve iptal edebilirsin.

Kullanım koşulları: [https://studyflow.app/kosullar/]
Gizlilik politikası: [https://studyflow.app/gizlilik/]
```

## 5. Anahtar kelimeler (≤ 100; 92 karakter, 98 bayt)

```text
lgs,yks,tyt,ayt,ders programı,çalışma,flashcard,özet,ödev,odak,pomodoro,tekrar,ortaokul,lise
```

Virgülden sonra boşluk yok. Ad ("StudyFlow") ve alt başlık A'daki kelimeler (sınav, plan, quiz, kart) tekrar
edilmedi. Sınır App Store Connect'te bayt olarak sayılırsa da 100'ün altında kalır. "deneme", "net" gibi R2a
özelliklerini çağrıştıran kelimeler kullanılmaz.

## 6. URL'ler ve diğer alanlar

Sayfalar `web/` ve uygulamanın kendi metinlerinden üretilir (`npm run web:build`, yayın: `.github/workflows/web.yml`,
GitHub Pages). Alan adı Q-08 ile kesinleşene kadar `https://studyflow.app` **yer tutucudur**; özel alan adı
bağlanmadan önce aynı sayfalar `https://surakaraali.github.io/studyflow/…` altında açılır. Sondaki `/`
yönlendirmeyi önler; App Store Connect'e bu biçimde girilir.

| App Store Connect alanı | Değer | Durum |
|---|---|---|
| Destek URL'si (zorunlu) | `https://studyflow.app/destek/` | Sayfa hazır: SSS (uygulamadaki SSS'nin aynısı), destek e-postası, veli yardımı, hesap silme |
| Pazarlama URL'si | `https://studyflow.app/` | Sayfa hazır (tanıtım) |
| Gizlilik politikası URL'si (zorunlu) | `https://studyflow.app/gizlilik/` | Sayfa hazır; metin H-01 onayı bekliyor, sayfada "taslak" uyarısı var ve arama motorlarına kapalı |
| Kullanım koşulları (EULA) | `https://studyflow.app/kosullar/` (açıklamanın sonunda) ya da Apple standart EULA | Sayfa hazır; hangisinin kullanılacağına Ürün sahibi + Hukuk danışmanı karar verir |
| Web'den hesap silme | `https://studyflow.app/hesap-silme/` | Form hazır (`web/delete-account/index.html` → `support`); sahiplik doğrulama süreci bekliyor (T-16, H-12) |
| Telif hakkı | `© 2027 [Şirket unvanı]` | Unvan H-01 ile kesinleşir |
| Birincil dil | Türkçe | — |
| Abonelik grubu | "StudyFlow Pro": aylık ve yıllık; görünen ad ve açıklama Türkçe; fiyat Q-05 | İnceleme için paywall ekran görüntüsü yüklenir |

Mağazaya girilmeyen ama aynı alan adına bağlı sayfalar: veli onayı `https://studyflow.app/veli-onayi/`
(fonksiyon sırrı `CONSENT_WEB_URL` ve EAS değişkeni `EXPO_PUBLIC_CONSENT_WEB_URL`) ve aydınlatma metni
`https://studyflow.app/aydinlatma-metni/` (onay sayfası buna bağlanır).

## 7. Kategori ve yaş derecelendirmesi (Q-07)

**Karar bekleniyor — Ürün sahibi + Hukuk danışmanı (BRD §17).** Bu karar gönderimi engeller
([go_live.md §1](../analysis/go_live.md#1-engeller-ve-sahipleri)). İki seçenek:

- **A · Kids kategorisi, 9–11 yaş bandı.** "Made for Kids" seçilir.
- **B · Eğitim (Education) birincil kategori.** Yaş derecelendirmesi anketle belirlenir, "Made for Kids" seçilmez.

| Konu | A: Kids (9–11) | B: Eğitim |
|---|---|---|
| Hedef kitleye uyum | Yalnızca 9–11 bandı; R1'in 12–17 yaş öğrencileri bandın dışında | R1 kitlesinin tamamı (5–12. sınıf) |
| Üçüncü taraflara veri | Kurallar (1.3, 5.1.4) üçüncü taraflara kişisel veya cihaz bilgisi gönderilmemesini ister. Anthropic'e belge içeriği, Resend'e veli e-postası ve rumuz, RevenueCat'e hesap kimliği gidiyor: yüksek inceleme riski | Açık bilgilendirme ve izinle mümkün (FR-CON-05, gizlilik etiketi) |
| Analitik | Uygun: ADR-006 ile üçüncü taraf analitik SDK'sı yok; olaylar kimliksiz ve kendi sunucumuzda (1.3 birinci taraf analitiği yasaklamaz) | Aynı yapı |
| Veli kapısı | Dış bağlantı, satın alma ve dikkat dağıtıcı her şey için zorunlu | BR-19 ile zaten uygulanıyor (satın alma, mağaza bağlantıları) |
| İnceleme | Her sürümde Kids kurallarıyla daha sıkı | Standart inceleme + çocuk verisi ve yapay zekâ soruları |
| Geri dönüş | Kids kategorisinden sonra çıkmak kolay değil; sonraki sürümler de Kids kurallarına bağlı (App Store Connect yardımıyla teyit) | R2b'de (ilkokul) yeniden değerlendirilebilir |
| Görünürlük | Kids bölümü; ebeveyne güven sinyali | Eğitim kategorisi ve LGS/YKS aramaları |

**Öneri: B.** Gerekçe: R1'in ana kitlesi 12–17 yaş ve Kids bandına girmiyor; ürünün çekirdeği olan yapay zekâ
özelliği ve veli onay e-postaları Kids kategorisinin üçüncü taraf kuralıyla çatışıyor; Kids'ten sonradan
çıkmak zor. Çocuk koruma önlemleri (veli onayı, veli kapısı, reklam ve takip yok) B'de de aynen kalır. Kids
seçeneği, veli yönetimli ilkokul modunun geldiği R2b'de yeniden ele alınır.

### 7.1 Yaş derecelendirmesi anketi

Apple 2025'te dereceleri 4+, 9+, 13+, 16+, 18+ olarak güncelledi ve ankete uygulama içi denetimler ve
yetenekler bölümlerini ekledi. Soruların sırası ve adları gönderim günü App Store Connect'teki listeyle
birebir eşleştirilir (🔍). İçerik cevapları iki seçenekte aynıdır; farklar son tabloda.

| Soru | Cevap (A ve B) | Not |
|---|---|---|
| Karikatür/fantastik şiddet, gerçekçi şiddet, ağır ya da uzun şiddet, silahlar | Yok | — |
| Küfür veya kaba mizah | Yok | — |
| Olgun/müstehcen temalar, korku temaları | Yok | — |
| Alkol, tütün, uyuşturucu kullanımı veya göndermesi | Yok | Ders notlarında biyoloji ve sağlık konuları geçebilir; yapay zekâ özendirici içerikli belgeyi işlemez (`_shared/ai/prompts.ts`) |
| Cinsel içerik veya çıplaklık | Yok | Aynı not |
| Tıbbi bilgi; sağlık ve iyi yaşam konuları | Yok | — |
| Kumar, simüle kumar, yarışmalar, ganimet kutuları | Yok | — |
| Sınırsız web erişimi | Hayır | Uygulamada tarayıcı veya WebView yok |
| Kullanıcı tarafından üretilen içerik | Hayır | PDF ve üretilen içerik yalnızca yükleyene görünür; kullanıcılar arası paylaşım yok (BR-20). Yapay zekâ içeriği yalnızca öğrencinin kendi belgesinden üretilir, bildirilebilir |
| Mesajlaşma ve sohbet | Hayır | Yapay zekâ sohbeti R3 |
| Reklam | Hayır | — |
| Ebeveyn denetimleri (uygulama içi denetimler) | Evet | Veli onayı: amaç seçimi (yapay zekâ, bildirim) ve geri alma; satın almada veli kapısı. Apple'ın tanımıyla örtüştüğü teyit edilecek |
| Yaş doğrulama (age assurance) | Hayır | Doğum yılı beyanla alınır, doğrulanmaz |

| Alan | A: Kids | B: Eğitim |
|---|---|---|
| Birincil kategori | Eğitim (Kids bölümü "Made for Kids" ile açılır) | Eğitim |
| İkincil kategori | Yok | Verimlilik (isteğe bağlı) |
| Made for Kids | **Evet**, yaş bandı **9–11** | **Hayır** |
| Beklenen derece | 9+ (Kids bandına göre; Connect'in hesapladığı değer teyit edilir 🔍) | **4+** (içerik cevaplarının sonucu) |
| Ek şartlar | Satın alma ve dış bağlantılarda veli kapısı (var), üçüncü taraf reklam ve analitik yok (var, ADR-006), veri aktarımları için Apple'a açıklama (Anthropic, Resend, RevenueCat) | Yok |

Yaş derecesi hedef kitle değildir; uygulama içi yaş kuralları (BR-02, BR-03) iki seçenekte de geçerlidir.

## 8. Gizlilik etiketi (App Privacy)

Kaynaklar: iOS privacy manifest (`app.config.ts` → `ios.privacyManifests.NSPrivacyCollectedDataTypes`),
[ADR-006](../analysis/adr/ADR-006-birinci-taraf-telemetri.md) (telemetri) ve
[güvenlik incelemesi §6](../analysis/security_review.md#6-sdk-ve-servis-veri-envanteri-priv-05-store-02).
Etiket manifest'le **birebir aynıdır**; biri değişirse diğeri de aynı gün değişir (STORE-02).

**Sizi takip etmek için kullanılan veriler:** Yok. Reklam kimliği yok, ATT istenmez (PRIV-04). Manifest:
`NSPrivacyTracking = false`, takip alan adı yok.

**Sizinle ilişkilendirilen veriler** (takip: hayır):

| Apple kategorisi → türü | Amaç | Ne | Manifest anahtarı |
|---|---|---|---|
| İletişim Bilgileri → E-posta Adresi | Uygulama İşlevselliği | Hesap e-postası (Apple ile girişte gizli röle adresi olabilir), veli e-postası, destek formundaki yanıt adresi, ilkokul bekleme listesi için veli e-postası | `EmailAddress` |
| Tanımlayıcılar → Kullanıcı Kimliği | Uygulama İşlevselliği | Hesap UUID'si (RevenueCat app user id ile aynı) ve rumuz | `UserID` |
| Kullanıcı İçeriği → Diğer Kullanıcı İçeriği | Uygulama İşlevselliği | PDF'ler, dersler, ders programı, sınav ve ödevler, konular, üretilen özet/quiz/kartlar, quiz cevapları, kart tekrarları, çalışma oturumları, plan blokları, içerik bildirimleri | `OtherUserContent` |
| Satın Alımlar → Satın Alma Geçmişi | Uygulama İşlevselliği | Abonelik ürünü, durumu, mağaza işlem kimliği (RevenueCat SDK ve webhook) | `PurchaseHistory` |
| Diğer Veriler → Diğer Veri Türleri | Uygulama İşlevselliği | Doğum yılı, sınıf seviyesi, hedef sınav, uyku saatleri | `OtherDataTypes` |
| Kullanıcı İçeriği → Müşteri Desteği | Uygulama İşlevselliği | Destek formu mesajı ve konusu (`support_tickets`) | `CustomerSupport` |
| Tanımlayıcılar → Cihaz Kimliği | Uygulama İşlevselliği | Expo push token (`push_tokens`); hatırlatma ve veli onayı bildirimleri için | `DeviceID` |
| Teşhis → Diğer Teşhis Verileri | Uygulama İşlevselliği | Destek kaydına eklenen uygulama ve iOS sürümü | `OtherDiagnosticData` |

**Sizinle ilişkilendirilmeyen veriler** (takip: hayır; ADR-006):

| Apple kategorisi → türü | Amaç | Ne | Manifest anahtarı |
|---|---|---|---|
| Kullanım Verileri → Ürün Etkileşimi | Analiz | Olay adı ve izinli özellikler (olay sözlüğü), uygulama sürümü, platform, iOS ana sürümü. Kullanıcı, cihaz, kurulum, oturum kimliği ve IP saklanmaz; zaman saate yuvarlanır | `ProductInteraction` |
| Teşhis → Çökme Verileri | Uygulama İşlevselliği | JavaScript çökme raporu (temizlenmiş yığın izi), uygulama ve iOS sürümü; kimlik yok | `CrashData` |

Kararların gerekçesi:
- **Rumuz → Kullanıcı Kimliği:** Apple "ekran adı" ve "kullanıcı adı"nı Kullanıcı Kimliği altında sayar;
  manifest de rumuzu `UserID` altında beyan eder. (Google'ın formunda "takma ad" açıkça "Ad" türündedir;
  [play-store.md §4](play-store.md#4-veri-güvenliği-formu) bu yüzden "Ad" der. İki form aynı veriyi kendi
  tanımına göre beyan eder.)
- **Telemetri "ilişkilendirilmeyen":** istek JWT'si yalnızca hız sınırı için doğrulanır, kayda yazılmaz;
  sayaç anahtarı gizli tuzlu HMAC'tir ve 2 saatte silinir (ADR-006).
- **Yerel (native) çökmeler:** Apple'ın kendi çökme raporlarıdır (kullanıcı cihaz ayarından paylaşır);
  uygulama ek veri toplamaz. Apple'ın topladığı bu veri için ayrı beyan gerekmediği teyit edilir (🔍).
- **Toplanmayanlar:** konum (veli onayındaki IP adresi web sayfasında rıza kanıtı olarak alınır, konum
  çıkarılmaz), kişiler, sağlık, finansal bilgi (ödemeyi Apple alır), fotoğraf, ses, tarama/arama geçmişi,
  hassas bilgiler, reklam verisi, performans verisi.

**Ek üç tür (7 Kasım 2026 kararı):** Müşteri Desteği, Cihaz Kimliği ve Diğer Teşhis Verileri ihtiyatlı
olarak beyan edildi; manifest'e de aynı gün eklendi. Fazla beyan incelemede sorun çıkarmaz, eksik beyan
ret sebebidir. Google formundaki "Cihaz veya diğer kimlikler" beyanıyla da tutarlıdır.

Teyit (🔍): RevenueCat'in App Privacy rehberi; SDK'nın gönderdiği temel cihaz bilgisinin ek bir tür gerektirip
gerektirmediği (güvenlik incelemesi §6).

## 9. Şifreleme beyanı (export compliance)

| Soru | Cevap | Dayanak |
|---|---|---|
| `ITSAppUsesNonExemptEncryption` | `false` (`app.config.ts` → `ios.infoPlist`) | App Store Connect her derlemede soru sormaz |
| Uygulama şifreleme kullanıyor mu? | Yalnızca Apple'ın işletim sistemindeki şifrelemeyi: HTTPS/TLS (Supabase, RevenueCat, Expo), Keychain (`expo-secure-store`), SHA-256 ve UUID (`expo-crypto`, şifreleme değil özetleme) | Kendi şifreleme algoritması yok; `expo-sqlite` SQLCipher olmadan kullanılıyor |
| Muafiyet | Evet: standart, işletim sistemi sağlayan şifreleme (kategori 5, kısım 2 muafiyeti) | Apple "Complying with Encryption Export Regulations" |
| Fransa beyanı | Gerekmez (muaf şifreleme) | — |
| Yıllık self-classification raporu | Gerekmez (yalnızca işletim sistemi şifrelemesi) | Gönderim öncesi Apple'ın güncel rehberiyle teyit 🔍 |

Bir derlemede soru yine çıkarsa cevap: "Uygulamam şifreleme kullanıyor mu? → Evet; Muafiyetlerden birine uyuyor
mu? → Evet (yalnızca işletim sistemindeki şifreleme)". `app.json` → `app.config.ts` geçişinde anahtarın
korunduğu derlemenin Info.plist'inde kontrol edilir.

## 10. App Review notları

İnceleme ekibi İngilizce okur; not İngilizce yazıldı (yer tutucularla 3684 karakter; alan sınırı 4000, gerçek
adres ve bağlantıyla yeniden ölçülür). Gönderimden önce yapılacaklar (Tech lead):
- **Yetişkin deneme hesabı prod'da** `scripts/go-live/seed-review-account.ts` ile açılır
  ([go_live.md adım 9](../analysis/go_live.md#adım-9--app-review-hesapları)): doğrulanmış e-posta, 19 yaş, 12.
  sınıf, veli onayı gerekmez, Ücretsiz plan; içinde dev-seed demo verisi (dersler, ders programı, yaklaşan
  sınavlar, ödevler, iki haftalık geçmiş, işlenmiş "Örnek belge: Hücre bölünmesi"). Betik her çalıştığında
  tarihleri bugüne kaydırır ve şifreyi yeniler; gönderimden 1–2 gün önce yeniden çalıştırılır. Gerçek çocuk
  verisi kullanılmaz.
- **Reşit olmayan deneme hesabı (14 yaş, onay bekliyor)** uygulamadan açılır: doğum yılı 14 yaşa göre seçilir,
  veli adresi olarak ekibin kontrol ettiği bir posta kutusu yazılır; e-postadaki onay bağlantısı nota yazılır.
  **Bağlantı 7 gün geçerlidir:** gönderimden en fazla 7 gün önce üretilir, ret sonrası yeniden gönderimde
  uygulamadaki "Bağlantıyı yeniden gönder" ile yenilenir. İnceleme onay verirse hesap açılır; sonraki
  gönderim için yeni bir reşit olmayan hesap açılır.
- Ekipçe yazılmış, telif sorunu olmayan örnek PDF (ör. 3 sayfalık "Fotosentez" notu) herkese açık bir adrese
  konur ve bağlantısı nota yazılır.
- Yetişkin hesabın planı Ücretsiz bırakılır ki satın alma sandbox'ta denenebilsin.

```text
Thank you for reviewing StudyFlow, a study planner for Turkish middle and high school students (grades 5-12). The interface is in Turkish. Key labels: Bugün = Today, Takvim = Calendar, Dersler = Courses, Çalış = Study, İlerleme = Progress, Ayarlar = Settings (gear icon on Today), Hesap ve silme = Account and deletion, Pro'ya geç = Upgrade to Pro.

DEMO ACCOUNTS
1) Adult account (18+), every feature available, no parental consent needed:
   E-mail: [review account e-mail]   Password: [set before submission]
   It already has courses, a school timetable, upcoming exams, homework, two weeks of study history and a processed document ("Örnek belge: Hücre bölünmesi") with a summary, a quiz and flashcards. It is on the free plan, so the subscription can be bought in the sandbox.
2) Minor account (age 14), parental consent PENDING, to see the restricted mode (AI processing and purchases locked until a parent consents):
   E-mail: [minor account e-mail]   Password: [set before submission]

PARENTAL CONSENT (users under 18)
- At sign-up the app asks for the birth year. Under 18 it asks for a parent's e-mail address and e-mails the parent a link to a consent web page (Turkish data protection law, KVKK).
- To act as the parent for the minor account, open this link (valid until [date, 7 days after it was sent]):
  [https://studyflow.app/veli-onayi/?token=...]
  The page lets the parent allow AI and/or notifications, or revoke consent. Then bring the app to the foreground; the account unlocks within a few seconds.
- Users under 13 cannot use the app until a parent consents. This is why we provide the adult account for a full review.

AI FEATURES (third-party AI)
- Students upload a PDF of their own study notes (Çalış tab). The selected pages are sent from our server to a third-party AI provider (Anthropic) to create a summary, quiz questions and flashcards.
- Sent: the content of the selected pages, the grade level and the course name. Not sent: name, e-mail, birth year, school, device information or any account identifier.
- Before the first upload an in-app screen explains this and the student must accept it. It can be reopened in Settings > Yapay zekâ bilgilendirmesi. Under 18, the parent must also allow AI on the consent page.
- Every AI-generated item is labelled "Yapay zekâ ile üretildi, hata içerebilir" (AI-generated, may contain errors). Students can edit or report any item; a reported item is hidden at once and reviewed by our team.
- Sample PDF for testing: [URL].

PARENTAL GATE
- For users under 18, purchases and subscription management are behind a parental gate: a multiplication question written in Turkish words (e.g. "yedi çarpı on iki" = 7 x 12); three wrong answers lock it for one minute. The adult account does not see the gate.
- There are no other links out of the app; legal texts open inside the app. The only exception is a button that opens iOS Settings for the notification permission.

SUBSCRIPTIONS
- Auto-renewable monthly and annual "StudyFlow Pro" subscriptions (In-App Purchase, via RevenueCat). Pro only raises the monthly document and page limits. The paywall shows price, period, auto-renewal and cancellation terms, Restore Purchases, Terms of Use and Privacy Policy.

ACCOUNT DELETION
- In the app: Settings > Hesap ve silme > Hesabımı sil (type SİL to confirm). Documents are removed at once, the account and its data are deleted, and Sign in with Apple is revoked. On the web: https://studyflow.app/hesap-silme/

PRIVACY
- No ads, no tracking, no App Tracking Transparency prompt. Anonymous usage and crash events go to our own server without any user or device identifier; there is no third-party analytics SDK.
```

## 11. Ekran görüntüleri

Ekran görüntülerini Ürün sahibi çeker; bu bölüm neyin, hangi sırayla ve nasıl çekileceğini tanımlar.

**Boyut:** **6,9" iPhone, 1320×2868 piksel, dikey** (App Store Connect'in zorunlu tuttuğu tek iPhone boyutu;
küçük ekranlar bundan ölçeklenir). PNG ya da JPEG, saydamlık (alfa) yok, en çok 10 görsel; 8 kullanılır.
`supportsTablet: false` olduğu için iPad görüntüsü gerekmez (COMP-03). US-69'daki 6,1" (1179×2556) seti
isteğe bağlıdır; Connect'te ayrı yuva istenirse aynı sırayla çekilir (🔍 gönderim öncesi teyit).

**Cihaz ve veri:**
- Simülatör: **iPhone 17 Pro Max** (yerel çözünürlüğü 1320×2868); staging'e bağlı preview derlemesi.
  Geliştirme ya da "test mağazası" etiketi görünmez.
- Hesap: staging'de `seed-review-account.ts` ile açılan demo hesap (rumuz "Deniz", 12. sınıf, YKS sayısal;
  dersler Matematik, Fizik, Kimya, Biyoloji, Edebiyat, İngilizce; belge "Örnek belge: Hücre bölünmesi").
  Kurgusal veridir; gerçek çocuk verisi ve telifli ders kitabı sayfası kullanılmaz.
- Durum çubuğu: `xcrun simctl status_bar booted override --time 9:41 --batteryState charged --batteryLevel 100 --cellularBars 4 --wifiBars 3`
- Çekim: `xcrun simctl io booted screenshot 01-bugun.png`. Koyu tema için
  `xcrun simctl ui booted appearance dark`; en az bir görsel koyu temada (COMP-04, öneri: 5 numara).

| # | Ekran | Başlık (görselin üstündeki metin) | Gösterilecek veri | Tema |
|---|---|---|---|---|
| 1 | Bugün | Bugün ne çalışacağın hazır | 3 blok (ör. Fizik 40 dk, Matematik 40 dk, kart tekrarı), yaklaşan Fizik yazılısı geri sayımı, günlük hedef ve seri | Açık |
| 2 | Takvim (haftalık plan) | Plan, sınavına göre kurulur | Bir haftalık bloklar; okul saatleri kapalı; yaklaşan yazılı işaretli | Açık |
| 3 | Belge özeti | Notundan özet çıkar | "Hücre bölünmesi" özeti, kaynak sayfa numaraları, yapay zekâ etiketi görünür | Açık |
| 4 | Quiz sorusu | Açıklamalı sorularla dene | 5 şıklı soru (lise), doğru cevap ve açıklama, yapay zekâ etiketi | Açık |
| 5 | Kart tekrarı | Kartlar internetsiz de çalışır | Kartın arka yüzü, Tekrar/Zor/İyi/Kolay düğmeleri, bugün kalan kart sayısı | Koyu |
| 6 | Odak zamanlayıcı | Odaklan, molanı unutma | Matematik bloğu, 40 dakikalık sayaç çalışırken | Açık |
| 7 | İlerleme | İlerlemeni haftalık gör | Ders bazında haftalık süre, doğru oranı, plan uyumu, seri | Açık |
| 8 | Yapay zekâ bilgilendirmesi | Neyin gönderildiği açık | "Gönderilenler / Gönderilmeyenler" listesi (FR-CON-05) | Açık |

Dosya adları sırayı taşır: `01-bugun.png` … `08-yapay-zeka.png`. Başlıkların görsel düzeni tasarımla
kesinleşir; başlıklar App Store açıklamasıyla çelişmemelidir. Abonelik incelemesi için paywall'un ayrıca bir
ekran görüntüsü abonelik ürününe yüklenir (görünür olması gerekmez).

## 12. App Store kontrol listesi (STORE-01, proje planı §11.2)

| # | Madde | Kaynak | Durum |
|---|---|---|---|
| 1 | Yaş derecelendirmesi ve kategori kararı uygulandı | Q-07, §7 | Karar bekleniyor; iki seçeneğin cevapları hazır |
| 2 | Veli kapısı satın almayı ve mağaza bağlantılarını koruyor; rıza kararları yalnızca veli sayfasında | BR-19, US-19 | Kodda var |
| 3 | Gizlilik etiketi manifest ve SDK listesiyle tutarlı; reklam kimliği ve takip yok | STORE-02, PRIV-04, PRIV-05, §8 | Etiket manifest'le aynı; RevenueCat teyidi açık |
| 4 | Üçüncü taraf yapay zekâya gönderim uygulamada açıkça anlatılıyor ve izin alınıyor | FR-CON-05, Apple 5.1.2(i) | Ekran var; sağlayıcı adı eklenecek (T-21) |
| 5 | Hesap silme uygulamadan ve web'den yapılabiliyor | STORE-03, PRIV-07 | Uygulama içi var; web formu hazır, yayın web.yml ile (T-16 sahiplik doğrulama süreci açık) |
| 6 | Abonelik ekranında fiyat, dönem, yenileme, iptal, geri yükleme, koşullar ve gizlilik bağlantısı | STORE-04, US-63, US-64 | Kodda var; fiyat Q-05 |
| 7 | OTA yalnızca hata düzeltme için | STORE-05 | `expo-updates` eklendi; kural geri alma planında (go_live.md §5) |
| 8 | İnceleme notunda deneme hesapları ve veli onayı testi; bağlantı 7 gün içinde üretildi | §10 | Yetişkin hesap betikle; reşit olmayan hesap elle |
| 9 | Apple ile giriş çalışıyor; şifre sıfırlama akışı uygulamada tamam | FR-ACC-02, T-08 | TestFlight'ta denenecek |
| 10 | Yasal metinler hukuk onaylı, uygulamadaki sürümle aynı | H-01, US-20 | Taslak; web sayfaları aynı kaynaktan üretiliyor ve taslak uyarısı taşıyor |
| 11 | Gizlilik politikası, destek ve koşullar URL'leri yayında | §6 | Sayfalar hazır; alan adı Q-08, yayın WEB_DEPLOY |
| 12 | Ekran görüntüleri (6,9"), promosyon metni, anahtar kelimeler hazır | US-69, §2–§5, §11 | Metinler taslak; görseller çekilecek |
| 13 | Privacy manifest ve şifreleme beyanı kontrol edildi | T-23, §8, §9 | Manifest `app.config.ts`'de; derlemenin Xcode gizlilik raporuyla karşılaştırılacak |

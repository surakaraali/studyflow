# StudyFlow — App Store Connect Taslağı (R1)

| Alan | Değer |
|---|---|
| Doküman | App Store Connect metinleri, gizlilik etiketi, inceleme notu, ekran görüntüleri |
| Sürüm | 0.1 (taslak) |
| Tarih | 4 Kasım 2026 |
| Hazırlayan | İş Analisti, Tech Lead ve tasarım ile birlikte |
| Durum | İnceleme bekliyor; Q-05, Q-07, Q-08 kararlarına bağlı |
| İlgili | [01_brd.md](../analysis/01_brd.md) · [02_nfr.md](../analysis/02_nfr.md) §13 · [Güvenlik incelemesi](../analysis/security_review.md) · [Proje planı](../agile/project_plan.md) §11 · [Google Play taslağı](play-store.md) |

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
`studyflow.app` alan adı da aynı kararla teyit edilir (aşağıdaki URL'ler buna bağlı).

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

## 4. Açıklama (≤ 4000 karakter, 2795)

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

Kullanım koşulları: [https://studyflow.app/kosullar]
Gizlilik politikası: [https://studyflow.app/gizlilik]
```

## 5. Anahtar kelimeler (≤ 100; 92 karakter, 98 bayt)

```text
lgs,yks,tyt,ayt,ders programı,çalışma,flashcard,özet,ödev,odak,pomodoro,tekrar,ortaokul,lise
```

Virgülden sonra boşluk yok. Ad ("StudyFlow") ve alt başlık A'daki kelimeler (sınav, plan, quiz, kart) tekrar
edilmedi. Sınır App Store Connect'te bayt olarak sayılırsa da 100'ün altında kalır. "deneme", "net" gibi R2a
özelliklerini çağrıştıran kelimeler kullanılmaz.

## 6. URL'ler ve diğer alanlar

| Alan | Değer | Durum |
|---|---|---|
| Destek URL'si | `https://studyflow.app/destek` | Yer tutucu; sayfa yok (SSS + destek e-postası) |
| Pazarlama URL'si | `https://studyflow.app` | Yer tutucu; isteğe bağlı |
| Gizlilik politikası URL'si | `https://studyflow.app/gizlilik` | Yer tutucu; metin H-01 onayı bekliyor |
| Kullanım koşulları (EULA) | `https://studyflow.app/kosullar` ya da Apple standart EULA | Ürün sahibi + Hukuk danışmanı karar verir |
| Web'den hesap silme | `https://studyflow.app/hesap-silme` | Form hazır (`web/delete-account/index.html`); barındırma ve sahiplik doğrulama süreci bekliyor (T-16) |
| Telif hakkı | `© 2027 [Şirket unvanı]` | Unvan H-01 ile kesinleşir |
| Birincil dil | Türkçe | — |
| Abonelik grubu | "StudyFlow Pro": aylık ve yıllık; görünen ad ve açıklama Türkçe; fiyat Q-05 | İnceleme için paywall ekran görüntüsü yüklenir |

Onay sayfası (`https://studyflow.app/veli-onayi`) ve aydınlatma metni (`/aydinlatma-metni`) adresleri de
`src/services/config.ts` ve `web/consent/index.html`'de bu alan adını varsayar.

## 7. Kategori ve yaş derecelendirmesi (Q-07)

**Karar bekleniyor — Ürün sahibi + Hukuk danışmanı (BRD §17, Sprint 0 sonu).** İki seçenek:

- **A · Kids kategorisi, 9–11 yaş bandı.** "Made for Kids" seçilir.
- **B · Eğitim (Education) birincil kategori.** Yaş derecelendirmesi anketle belirlenir, "Made for Kids" seçilmez.

| Konu | A: Kids (9–11) | B: Eğitim |
|---|---|---|
| Hedef kitleye uyum | Yalnızca 9–11 bandı; R1'in 12–17 yaş öğrencileri bandın dışında | R1 kitlesinin tamamı (5–12. sınıf) |
| Üçüncü taraflara veri | Kurallar (1.3, 5.1.4) üçüncü taraflara kişisel veya cihaz bilgisi gönderilmemesini ister. Anthropic'e belge içeriği, Resend'e veli e-postası ve rumuz, RevenueCat'e hesap kimliği gidiyor: yüksek inceleme riski | Açık bilgilendirme ve izinle mümkün (FR-CON-05, gizlilik etiketi) |
| Analitik (Q-04) | Pratikte yok; yalnızca 1.3'teki dar istisnayla | Mümkün; çocuklara yönelik olduğu için yine kimliksiz yapılandırma (PRIV-04) |
| Veli kapısı | Dış bağlantı, satın alma ve dikkat dağıtıcı her şey için zorunlu | BR-19 ile zaten uygulanıyor (satın alma, mağaza bağlantıları) |
| İnceleme | Her sürümde Kids kurallarıyla daha sıkı | Standart inceleme + çocuk verisi ve yapay zekâ soruları |
| Geri dönüş | Kids kategorisinden sonra çıkmak kolay değil; sonraki sürümler de Kids kurallarına bağlı (App Store Connect yardımıyla teyit) | R2b'de (ilkokul) yeniden değerlendirilebilir |
| Görünürlük | Kids bölümü; ebeveyne güven sinyali | Eğitim kategorisi ve LGS/YKS aramaları |

**Öneri: B.** Gerekçe: R1'in ana kitlesi 12–17 yaş ve Kids bandına girmiyor; ürünün çekirdeği olan yapay zekâ
özelliği ve veli onay e-postaları Kids kategorisinin üçüncü taraf kuralıyla çatışıyor; Kids'ten sonradan
çıkmak zor. Çocuk koruma önlemleri (veli onayı, veli kapısı, reklam ve takip yok) B'de de aynen kalır. Kids
seçeneği, veli yönetimli ilkokul modunun geldiği R2b'de yeniden ele alınır.

### 7.1 Yaş derecelendirmesi anketi (seçenek B)

Apple 2025'te dereceleri 4+, 9+, 13+, 16+, 18+ olarak güncelledi ve ankete yeni sorular ekledi. Sorular
App Store Connect'teki güncel listeyle birebir eşleştirilecek (🔍).

| Soru | Cevap | Not |
|---|---|---|
| Karikatür/fantastik şiddet, gerçekçi şiddet, ağır şiddet, silahlar | Yok | — |
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
| Ebeveyn denetimleri | Evet | Veli onayı: amaç seçimi (yapay zekâ, bildirim) ve geri alma; satın almada veli kapısı. Apple'ın tanımıyla örtüştüğü teyit edilecek |
| Yaş doğrulama | Hayır | Doğum yılı beyanla alınır, doğrulanmaz |
| Made for Kids | Seçilmez | Seçenek B |

**Beklenen derece: 4+.** Yaş derecesi hedef kitle değildir; uygulama içi yaş kuralları (BR-02, BR-03) ayrıca geçerlidir.

## 8. Gizlilik etiketi (App Privacy)

Kaynak: [güvenlik incelemesi §6](../analysis/security_review.md#6-sdk-ve-servis-veri-envanteri-priv-05-store-02).
Etiket, üçüncü taraf SDK'ların topladıklarını da kapsar. Şüphede ihtiyatlı (beyan eden) seçenek alındı.

**Sizi takip etmek için kullanılan veriler:** Yok. Reklam kimliği yok, ATT istenmez (PRIV-04).
**Sizinle ilişkilendirilmeyen veriler:** Yok (toplanan her şey hesapla ilişkili).

**Sizinle ilişkilendirilen veriler** (hepsinde amaç: Uygulama İşlevselliği; takip: hayır):

| Apple kategorisi → türü | Ne | Kaynak / SDK |
|---|---|---|
| İletişim Bilgileri → E-posta Adresi | Hesap e-postası (Apple ile girişte gizli röle adresi olabilir); veli e-postası; destek formundaki yanıt adresi; ilkokul bekleme listesi için veli e-postası | Supabase Auth ve `profiles`; Resend ile e-posta gönderimi |
| İletişim Bilgileri → Ad | Rumuz (isteğe bağlı) | `profiles.nickname`; veli e-postalarında çocuğun adı olarak geçer (Resend) |
| Kullanıcı İçeriği → Diğer Kullanıcı İçeriği | PDF'ler, dersler, ders programı, sınav ve ödevler, konular, üretilen özet/quiz/kartlar, quiz cevapları, kart tekrarları, çalışma oturumları, plan blokları, içerik bildirimleri | Supabase (Postgres, Storage); belge içeriği işlenmek üzere Anthropic'e |
| Kullanıcı İçeriği → Müşteri Desteği | Destek formu mesajı | `support_tickets`; ekibe Resend ile |
| Tanımlayıcılar → Kullanıcı Kimliği | Hesap UUID'si; RevenueCat app user id (aynı UUID) | Supabase, RevenueCat |
| Tanımlayıcılar → Cihaz Kimliği | Expo push token | `push_tokens`; Expo Push Service |
| Satın Alımlar → Satın Alma Geçmişi | Abonelik ürünü, durumu, mağaza işlem kimliği | RevenueCat SDK ve webhook, `subscriptions` |
| Teşhis → Diğer Teşhis Verileri | Uygulama ve iOS sürümü (yalnızca destek kaydına eklenir) | `expo-application`, `support_tickets` |
| Diğer Veriler → Diğer Veri Türleri | Doğum yılı, sınıf seviyesi, hedef sınav, uyku saatleri | `profiles` |

Kararların gerekçesi:
- **Rumuz → "Ad":** Apple "ekran adı/kullanıcı adı"nı Kullanıcı Kimliği altında sayar; ancak rumuz benzersiz değil,
  hesabı tanımlamak için kullanılmıyor ve pratikte çoğu öğrenci gerçek adını yazıyor; veli e-postasında çocuğun adı
  olarak geçiyor. En dürüst karşılık "Ad". Kullanıcı Kimliği zaten ayrıca beyan edildi.
- **Push token → "Cihaz Kimliği":** cihaz düzeyinde bir adres ve hesapla ilişkili saklanıyor. Google formunda da
  "Cihaz veya diğer kimlikler" olarak beyan edilir (STORE-02 tutarlılığı).
- **Teşhis:** çökme ve kullanım analitiği toplanmıyor (`src/services/analytics.ts` yayında sessiz). Destek
  kaydındaki sürüm bilgisi için "Diğer Teşhis Verileri" ihtiyatlı olarak işaretlendi.
- **Toplanmayanlar:** konum (veli onayındaki IP adresi web sayfasında alınır, konum çıkarılmaz), kişiler,
  sağlık, finansal bilgi (ödemeyi Apple alır), fotoğraf, ses, tarama/arama geçmişi, hassas bilgiler,
  Kullanım Verileri (ürün etkileşimi, reklam verisi).
- **Teyit (🔍):** RevenueCat'in kendi App Privacy rehberi; SDK'nın gönderdiği cihaz bilgisinin ek bir tür
  gerektirip gerektirmediği.
- **Q-04 kararı uygulanınca güncellenir:** PostHog/Sentry gelirse Teşhis → Çökme Verileri ve Performans Verileri,
  Kullanım Verileri → Ürün Etkileşimi eklenir. `analytics.ts` kimlik göndermediği için bunlar "ilişkilendirilmeyen
  veriler" altına girer.

## 9. App Review notları

İnceleme ekibi İngilizce okur; not İngilizce yazıldı (3649 karakter; alan sınırı 4000). Gönderimden önce
yapılacaklar (Tech lead):
- İki deneme hesabı **prod** ortamında açılır; yetişkin hesapta örnek veri ve işlenmiş bir belge hazır olur.
  Gerçek çocuk verisi kullanılmaz.
- Reşit olmayan deneme hesabı (14 yaş, onay bekliyor) için uygulamadan onay bağlantısı ekibin kontrol ettiği
  bir veli adresine gönderilir; e-postadaki bağlantı nota yazılır. **Bağlantı 7 gün geçerlidir:** gönderimden
  en fazla 7 gün önce üretilir, ret sonrası yeniden gönderimde yenilenir. İnceleme onayı verirse hesap açılır;
  sonraki gönderim için yeni bir reşit olmayan hesap açılır.
- Ekipçe yazılmış, telif sorunu olmayan örnek PDF (ör. 3 sayfalık "Fotosentez" notu) herkese açık bir adrese konur.
- Yetişkin hesabın planı Ücretsiz bırakılır ki satın alma sandbox'ta denenebilsin.

```text
Thank you for reviewing StudyFlow, a study planner for Turkish middle and high school students (grades 5-12).
The interface is in Turkish. Key labels: Bugün = Today, Takvim = Calendar, Dersler = Courses, Çalış = Study,
İlerleme = Progress, Ayarlar = Settings (gear icon on Today), Hesap ve silme = Account and deletion,
Pro'ya geç = Upgrade to Pro.

DEMO ACCOUNTS
1) Adult account (18+). No parental consent needed; every feature is available.
   E-mail: [review-adult@studyflow.app]   Password: [set before submission]
2) Minor account (age 14), parental consent PENDING. Shows the restricted mode:
   AI document processing and purchases stay locked until a parent consents.
   E-mail: [review-minor@studyflow.app]   Password: [set before submission]

PARENTAL CONSENT (users under 18)
- At sign-up the app asks for the birth year. Under 18 it asks for a parent's e-mail address and e-mails
  the parent a link to a consent web page (Turkish data protection law, KVKK).
- To act as the parent for the minor account, open this link (valid until [date, 7 days after it was sent]):
  [https://studyflow.app/veli-onayi?token=...]
  The page lets the parent allow AI and/or notifications, or revoke consent. Then bring the app to the
  foreground; the account unlocks within a few seconds.
- Users under 13 cannot use the app until a parent consents. This is why we provide the adult account
  for a full review.

AI FEATURES (third-party AI)
- Students upload a PDF of their own study notes (Çalış tab). The selected pages are sent from our server
  to a third-party AI provider (Anthropic) to create a summary, quiz questions and flashcards.
- Sent: the content of the selected pages, the grade level and the course name. Not sent: name, e-mail,
  birth year, school, device information or any account identifier.
- Before the first upload an in-app screen explains this and the student must accept it. It can be
  reopened in Settings > Yapay zekâ bilgilendirmesi. Under 18, the parent must also allow AI on the
  consent page.
- Every AI-generated item is labelled "Yapay zekâ ile üretildi, hata içerebilir" (AI-generated, may contain
  errors). Students can edit or report any item; a reported item is hidden at once and reviewed by our team.
- Sample PDF for testing: [URL]. The adult account already contains a processed document.

PARENTAL GATE
- For users under 18, purchases and subscription management are behind a parental gate: a multiplication
  question written in Turkish words (e.g. "yedi çarpı on iki" = 7 x 12); three wrong answers lock it for
  one minute. The adult account does not see the gate.
- There are no other links out of the app; legal texts open inside the app. The only exception is a
  button that opens iOS Settings for the notification permission.
- Consent choices can only be made by the parent on the web page opened from the e-mail.

SUBSCRIPTIONS
- Auto-renewable monthly and annual "StudyFlow Pro" subscriptions (In-App Purchase, via RevenueCat).
  Pro only raises the monthly document and page limits; all other features are free. The paywall shows price,
  period, auto-renewal and cancellation terms, Restore Purchases, Terms of Use and Privacy Policy.
  Sandbox purchases work with the adult account.

ACCOUNT DELETION
- In the app: Settings > Hesap ve silme > Hesabımı sil (type SİL to confirm). Uploaded documents are
  removed at once, the account and its data are deleted, and a confirmation e-mail is sent.
- On the web: [https://studyflow.app/hesap-silme]

SIGN IN
- E-mail and password (e-mail verification required) and Sign in with Apple.

No ads, no tracking, no App Tracking Transparency prompt.
```

## 10. Ekran görüntüleri

Boyutlar (🔍 App Store Connect'te gönderim öncesi teyit): **6,9"** 1320×2868 dikey (güncel kurala göre zorunlu
olan tek iPhone boyutu; küçükler bundan ölçeklenir) ve US-69 gereği **6,1"** sınıfı 1179×2556 dikey (Connect'te
hangi yuvaya düştüğü kontrol edilir). `app.json`'da iPad desteği açık değil; iPad görüntüsü gerekmez (COMP-03).

Veri kuralları: kurgusal demo verisi (rumuz "Deniz", 8. sınıf, LGS hedefi; dersler Matematik, Fen Bilimleri,
Türkçe, T.C. İnkılap Tarihi). Gerçek çocuk verisi ve telifli ders kitabı sayfası kullanılmaz; belge, ekipçe
yazılmış örnek nottur. Durum çubuğu temiz (9:41, tam pil). Geliştirme ya da "test mağazası" etiketi görünmez.
Demo verisi geliştirme derlemesinde `studyflow://dev-seed?mode=full` ile kurulabilir; son çekim staging derlemesiyle yapılır.

| # | Ekran | Başlık | Gösterilecek veri |
|---|---|---|---|
| 1 | Bugün | Bugün ne çalışacağın hazır | 3 blok (Matematik 25 dk, Fen 25 dk, kart tekrarı), LGS geri sayımı, günlük hedef ve seri |
| 2 | Takvim (haftalık plan) | Plan, sınavına göre kurulur | Bir haftalık bloklar; okul saatleri kapalı; yaklaşan Fen yazılısı işaretli |
| 3 | Belge özeti | Notundan özet çıkar | "Fotosentez" notunun özeti, kaynak sayfa numaraları, yapay zekâ etiketi görünür |
| 4 | Quiz sorusu | Açıklamalı sorularla dene | 4 şıklı soru (ortaokul, BR-12), doğru cevap ve açıklama, yapay zekâ etiketi |
| 5 | Kart tekrarı | Kartlar internetsiz de çalışır | Kartın arka yüzü, Tekrar/Zor/İyi/Kolay düğmeleri, bugün kalan kart sayısı |
| 6 | Odak zamanlayıcı | Odaklan, molanı unutma | Matematik bloğu, 25 dakikalık sayaç çalışırken |
| 7 | İlerleme | İlerlemeni haftalık gör | Ders bazında haftalık süre, doğru oranı, plan uyumu, seri |
| 8 | Yapay zekâ bilgilendirmesi | Neyin gönderildiği açık | "Gönderilenler / Gönderilmeyenler" listesi (FR-CON-05) |

Sıra ve görsel düzen tasarımla kesinleşir; en az biri koyu temada çekilir (COMP-04). Başlıklar görselin üstündeki
metindir; App Store açıklamasıyla çelişmemelidir.

## 11. App Store kontrol listesi (STORE-01, proje planı §11.2)

| # | Madde | Kaynak | Durum |
|---|---|---|---|
| 1 | Yaş derecelendirmesi ve kategori kararı uygulandı | Q-07, §7 | Karar bekleniyor |
| 2 | Veli kapısı satın almayı ve mağaza bağlantılarını koruyor; rıza kararları yalnızca veli sayfasında | BR-19, US-19 | Kodda var |
| 3 | Gizlilik etiketi SDK listesiyle tutarlı; reklam kimliği ve takip yok | STORE-02, PRIV-04, PRIV-05, §8 | Taslak; RevenueCat teyidi |
| 4 | Üçüncü taraf yapay zekâya gönderim uygulamada açıkça anlatılıyor ve izin alınıyor | FR-CON-05, Apple 5.1.2(i) | Ekran var; sağlayıcı adı eklenecek (T-21) |
| 5 | Hesap silme uygulamadan ve web'den yapılabiliyor | STORE-03, PRIV-07 | Uygulama içi var; web formu hazır, barındırılmadı (T-16) |
| 6 | Abonelik ekranında fiyat, dönem, yenileme, iptal, geri yükleme, koşullar ve gizlilik bağlantısı | STORE-04, US-63, US-64 | Kodda var; fiyat Q-05 |
| 7 | OTA yalnızca hata düzeltme için | STORE-05 | `expo-updates` henüz kurulu değil (T-25) |
| 8 | İnceleme notunda deneme hesapları ve veli onayı testi; bağlantı 7 gün içinde üretildi | §9 | Taslak |
| 9 | Apple ile giriş çalışıyor; şifre sıfırlama akışı uygulamada tamam | FR-ACC-02, T-08 | Sıfırlama akışı eksik |
| 10 | Yasal metinler hukuk onaylı, uygulamadaki sürümle aynı | H-01, US-20 | Taslak |
| 11 | Gizlilik politikası, destek ve koşullar URL'leri yayında | §6 | Yer tutucu |
| 12 | Ekran görüntüleri (6,9" ve 6,1"), promosyon metni, anahtar kelimeler hazır | US-69, §2–§5, §10 | Taslak |
| 13 | Privacy manifest ve şifreleme beyanı (`ITSAppUsesNonExemptEncryption: false`) kontrol edildi | T-23, `app.json` | Doğrulanacak |

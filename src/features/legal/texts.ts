/**
 * Legal texts shown in the app (US-20, FR-CON-07). Versioned: the consent record stores
 * LEGAL_VERSION, so change the version whenever the meaning of a text changes.
 *
 * These are drafts written from the BRD (§9, §10) and must be reviewed by legal counsel
 * before release. Placeholders are in [square brackets].
 */

export const LEGAL_VERSION = '1.0';
export const LEGAL_DATE = '2026-11-04';
export const LEGAL_DRAFT = true;

export type LegalDocId = 'aydinlatma' | 'gizlilik' | 'kosullar';

export type LegalSection = {
  heading: string;
  paragraphs?: string[];
  bullets?: string[];
};

export type LegalDocument = {
  id: LegalDocId;
  title: string;
  /** One line for the list screen. */
  summary: string;
  sections: LegalSection[];
};

const CONTROLLER = '[Şirket unvanı], [adres]';
const KVKK_CONTACT = '[kvkk@studymark.app — kesinleşecek]';

const aydinlatma: LegalDocument = {
  id: 'aydinlatma',
  title: 'Aydınlatma metni',
  summary: 'Hangi bilgileri, neden topladığımızı ve haklarını anlatır.',
  sections: [
    {
      heading: 'Öğrenci için kısaca',
      bullets: [
        'Adını, okulunu, telefonunu ve konumunu sormuyoruz. Doğum gününü değil, yalnızca doğum yılını soruyoruz.',
        'Derslerini, sınav tarihlerini ve çalışma sürelerini planını hazırlamak için kullanıyoruz.',
        'Yüklediğin notları yapay zekâya gönderdiğimizde yalnızca notun içeriği, sınıfın ve dersin adı gider. Adın ya da e-postan gitmez.',
        '18 yaşından küçüksen velin onay verir. Velin onayını istediği zaman geri alabilir.',
        'Hesabını istediğin zaman uygulamadan silebilirsin.',
      ],
    },
    {
      heading: '1. Veri sorumlusu',
      paragraphs: [
        `6698 sayılı Kişisel Verilerin Korunması Kanunu (KVKK) uyarınca veri sorumlusu: ${CONTROLLER} ("StudyMark").`,
      ],
    },
    {
      heading: '2. İşlenen kişisel veriler',
      bullets: [
        'Hesap bilgileri: e-posta adresi (Apple ile girişte Apple’ın verdiği adres), rumuz (isteğe bağlı), doğum yılı, sınıf seviyesi.',
        'Veli bilgileri: veli e-posta adresi, onay zamanı, onaylanan amaçlar ve onaylanan metnin sürümü.',
        'Eğitim verileri: dersler, ders programı, sınav ve ödev tarihleri, konular, çalışma oturumları, quiz cevapları ve tekrar kartlarının durumu.',
        'Kullanıcı içeriği: yüklenen PDF belgeler ve bunlardan üretilen özet, quiz ve kartlar.',
        'Abonelik bilgileri: plan, abonelik durumu ve mağaza işlem kimliği. Kart bilgileri bize ulaşmaz; ödemeyi mağaza alır.',
        'Teknik veriler: çökme kayıtları ve kişisel veri içermeyen kullanım istatistikleri. Reklam kimliği, kesin konum ve kişiler listesi toplanmaz.',
      ],
    },
    {
      heading: '3. İşleme amaçları ve hukuki sebepler',
      bullets: [
        'Hesabın açılması ve çalışma planının hazırlanması: sözleşmenin kurulması ve ifası (KVKK m. 5/2-c).',
        'Yüklenen belgelerden yapay zekâ ile özet, quiz ve kart üretilmesi: açık rıza (18 yaş altında velinin açık rızası).',
        'Çalışma, sınav ve ödev hatırlatma bildirimleri: açık rıza; bildirimler ayrıca cihaz ayarlarından kapatılabilir.',
        'Veli onayı ve rıza kayıtlarının saklanması: hukuki yükümlülük (KVKK m. 5/2-ç).',
        'Hizmetin güvenliği ve hataların giderilmesi: meşru menfaat (KVKK m. 5/2-f).',
      ],
      paragraphs: [
        'Veriler reklam, profil satışı veya pazarlama için kullanılmaz. Performans verileri yalnızca plan ve ilerleme ekranları için kullanılır.',
      ],
    },
    {
      heading: '4. Aktarım',
      bullets: [
        'Barındırma: veriler Avrupa Birliği bölgesindeki sunucularda saklanır ([barındırma sağlayıcısı]).',
        'Yapay zekâ sağlayıcısı: yalnızca belge içeriği, sınıf seviyesi ve ders adı gönderilir. Ad, e-posta, okul, doğum yılı ve cihaz bilgisi gönderilmez. Sağlayıcı bu verileri model eğitiminde kullanmaz ([sağlayıcı adı ve sözleşme bilgisi]).',
        'E-posta gönderimi: doğrulama ve veli onay e-postaları için [e-posta sağlayıcısı].',
        'Yurt dışına aktarım KVKK m. 9 kapsamında açık rızaya veya Kanun’daki diğer güvencelere dayanır.',
      ],
    },
    {
      heading: '5. Saklama süreleri',
      bullets: [
        'Hesap silinince belgeler depodan hemen, diğer kişisel veriler en geç 30 gün içinde silinir.',
        'Veli onay kayıtları ve ödeme kayıtları yasal süre boyunca saklanır.',
        '12 ay boyunca giriş yapılmayan hesaba uyarı e-postası gönderilir; ardından 30 gün içinde giriş yapılmazsa hesap silinir.',
        '13 yaşından küçük kullanıcının hesabı 30 gün içinde veli onayı gelmezse silinir.',
        'Kimliği belirlenemeyen istatistikler saklanabilir.',
      ],
    },
    {
      heading: '6. Veli olarak haklarınız',
      paragraphs: [
        'Onayınızı istediğiniz zaman, size gönderilen e-postadaki "Onayımı geri al" bağlantısıyla geri alabilirsiniz. Geri alma, o tarihten sonraki işlemleri etkiler; yapay zekâ özellikleri hemen kapanır.',
      ],
    },
    {
      heading: '7. KVKK m. 11 kapsamındaki haklar',
      bullets: [
        'Kişisel verilerin işlenip işlenmediğini öğrenme ve bilgi isteme,',
        'İşleme amacını ve amaca uygun kullanılıp kullanılmadığını öğrenme,',
        'Verilerin aktarıldığı üçüncü kişileri bilme,',
        'Eksik veya yanlış işlenmiş verilerin düzeltilmesini, silinmesini veya yok edilmesini isteme,',
        'Otomatik sistemlerle analiz sonucunda aleyhe bir sonuç çıkmasına itiraz etme,',
        'Kanuna aykırı işleme nedeniyle zarara uğranması hâlinde zararın giderilmesini talep etme.',
      ],
      paragraphs: [`Başvurular için: ${KVKK_CONTACT}. Başvurular en geç 30 gün içinde cevaplanır.`],
    },
  ],
};

const gizlilik: LegalDocument = {
  id: 'gizlilik',
  title: 'Gizlilik politikası',
  summary: 'Verilerini nasıl koruduğumuzu ve kimlerle paylaştığımızı anlatır.',
  sections: [
    {
      heading: 'Kısaca',
      paragraphs: [
        'StudyMark bir ders çalışma uygulamasıdır. Yalnızca uygulamanın çalışması için gereken bilgileri toplarız, reklam göstermeyiz ve verilerini satmayız.',
      ],
    },
    {
      heading: 'Topladığımız bilgiler',
      bullets: [
        'E-posta adresi, isteğe bağlı rumuz, doğum yılı ve sınıf seviyesi.',
        '18 yaşından küçük kullanıcılar için velinin e-posta adresi ve onay kaydı.',
        'Girdiğin dersler, sınavlar, ödevler, çalışma süreleri ve yüklediğin belgeler.',
        'Kişisel veri içermeyen çökme ve kullanım istatistikleri.',
      ],
    },
    {
      heading: 'Toplamadıklarımız',
      bullets: [
        'Ad-soyad, okul adı, telefon numarası, adres veya konum.',
        'Reklam kimliği (IDFA/AAID) ve kişiler listesi. Uygulama seni başka uygulamalarda takip etmez.',
      ],
    },
    {
      heading: 'Yapay zekâ',
      paragraphs: [
        'Bir belge yüklediğinde, özet, quiz ve kart hazırlamak için belgenin içeriği, sınıf seviyen ve dersin adı yapay zekâ sağlayıcısına gönderilir. Kişisel bilgilerin gönderilmez. Üretilen her içerik "Yapay zekâ ile üretildi, hata içerebilir" etiketi taşır. 18 yaşından küçüksen bu özellik ancak velin onay verirse açılır.',
      ],
    },
    {
      heading: 'Nerede saklıyoruz',
      paragraphs: [
        'Veriler Avrupa Birliği bölgesindeki sunucularda, aktarım sırasında ve depoda şifrelenerek saklanır. Her kullanıcı yalnızca kendi verisine erişebilir.',
      ],
    },
    {
      heading: 'Ne kadar saklıyoruz',
      bullets: [
        'Hesabını sildiğinde belgelerin hemen, diğer verilerin en geç 30 gün içinde silinir; silme bitince e-posta alırsın.',
        'Veli onay kayıtları ve ödeme kayıtları yasal süre boyunca saklanır.',
        '12 ay giriş yapılmayan hesaplar, uyarı e-postasından 30 gün sonra silinir.',
      ],
    },
    {
      heading: 'Çocuklar ve veliler',
      paragraphs: [
        '18 yaşından küçük kullanıcılar için veli onayı istenir. 13 yaşından küçük kullanıcılar veli onayı gelene kadar uygulamayı kullanamaz; 13–17 yaş kullanıcılar onay beklerken yapay zekâ ve satın alma dışındaki özellikleri kullanabilir. Satın alma ekranı bir veli doğrulama adımıyla korunur.',
      ],
    },
    {
      heading: 'Haklar ve iletişim',
      paragraphs: [
        `Verilerine erişme, düzeltme ve silme hakların vardır. Hesabını uygulamadaki Ayarlar > Hesap ekranından silebilirsin. Sorular ve KVKK başvuruları için: ${KVKK_CONTACT}.`,
        'Bu politikada önemli bir değişiklik olursa uygulama içinde haber veririz.',
      ],
    },
  ],
};

const kosullar: LegalDocument = {
  id: 'kosullar',
  title: 'Kullanım koşulları',
  summary: 'Uygulamayı kullanırken uyulacak kuralları anlatır.',
  sections: [
    {
      heading: '1. Taraflar ve kabul',
      paragraphs: [
        `Bu koşullar ${CONTROLLER} ile StudyMark’u kullanan kişi arasındadır. Hesap oluşturarak bu koşulları kabul etmiş olursun. 18 yaşından küçüksen hesabın velinin onayıyla açılır.`,
      ],
    },
    {
      heading: '2. Hizmet',
      paragraphs: [
        'StudyMark ders, sınav ve ödevlerine göre çalışma planı hazırlar; yüklediğin belgelerden özet, quiz ve tekrar kartları üretir. Plan ve içerikler öneri niteliğindedir; okulunun ve öğretmenlerinin yerine geçmez.',
      ],
    },
    {
      heading: '3. Yapay zekâ ile üretilen içerik',
      paragraphs: [
        'Özet, quiz ve kartlar yapay zekâ ile hazırlanır ve hata içerebilir. Önemli bilgileri ders kitabından veya öğretmeninden kontrol et. Hatalı bir içerik görürsen uygulamadaki "Bildir" seçeneğiyle bize haber ver.',
      ],
    },
    {
      heading: '4. Yüklediğin belgeler',
      bullets: [
        'Yalnızca kendi kişisel çalışman için belge yükle. Yüklediğin belgeler başka kullanıcılarla paylaşılmaz.',
        'Başkasına ait bir eseri yalnızca yasaların izin verdiği ölçüde kullanabilirsin (5846 sayılı Fikir ve Sanat Eserleri Kanunu).',
        'Bir eserin hakkının ihlal edildiğini düşünen kişiler [telif bildirim adresi] üzerinden bize bildirebilir; bildirilen içerik incelenir ve gerekirse kaldırılır.',
      ],
    },
    {
      heading: '5. Hesap güvenliği',
      paragraphs: [
        'Şifreni kimseyle paylaşma. Hesabını başkasının kullandığını düşünüyorsan şifreni değiştir ve bize yaz.',
      ],
    },
    {
      heading: '6. Ücretsiz plan ve Pro abonelik',
      bullets: [
        'Ücretsiz planda ayda 3 belge (belge başına 20 sayfa), Pro planda ayda 40 belge (belge başına 100 sayfa) işlenir.',
        'Pro abonelik App Store veya Google Play üzerinden alınır; fiyat, yenileme ve iptal bilgisi satın almadan önce gösterilir.',
        'Abonelik, dönem bitmeden en az 24 saat önce iptal edilmezse kendiliğinden yenilenir. İptal mağaza ayarlarından yapılır; hesabı silmek aboneliği iptal etmez.',
        '18 yaşından küçükken satın alma ekranına geçmek için bir veli doğrulama adımı vardır.',
      ],
    },
    {
      heading: '7. Yasaklı kullanım',
      bullets: [
        'Uygunsuz, şiddet içeren veya yasa dışı içerik yüklemek,',
        'Uygulamanın güvenliğini aşmaya veya başkalarının verilerine erişmeye çalışmak,',
        'Hizmeti otomatik araçlarla aşırı yüklemek.',
      ],
    },
    {
      heading: '8. Hesabın kapatılması',
      paragraphs: [
        'Hesabını istediğin zaman uygulamadan silebilirsin. Bu koşullara ciddi biçimde aykırı davranılırsa hesap uyarıdan sonra kapatılabilir.',
      ],
    },
    {
      heading: '9. Sorumluluk',
      paragraphs: [
        'Hizmeti kesintisiz sunmak için çalışırız ama sınav sonuçları veya planın uygulanması konusunda garanti vermeyiz. Yasaların izin verdiği ölçüde sorumluluğumuz ödediğin abonelik bedeliyle sınırlıdır.',
      ],
    },
    {
      heading: '10. Değişiklikler ve uygulanacak hukuk',
      paragraphs: [
        'Koşullar değişirse uygulama içinde haber veririz. Bu koşullara Türkiye Cumhuriyeti hukuku uygulanır. Tüketici olarak tüketici hakem heyetlerine ve tüketici mahkemelerine başvurma hakkın saklıdır.',
        `İletişim: ${KVKK_CONTACT}`,
      ],
    },
  ],
};

export const LEGAL_DOCUMENTS: Record<LegalDocId, LegalDocument> = { aydinlatma, gizlilik, kosullar };
export const LEGAL_DOC_IDS: readonly LegalDocId[] = ['aydinlatma', 'gizlilik', 'kosullar'];

export function isLegalDocId(value: unknown): value is LegalDocId {
  return typeof value === 'string' && (LEGAL_DOC_IDS as readonly string[]).includes(value);
}

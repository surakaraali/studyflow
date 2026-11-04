# ADR-004 · İşlem e-postası sağlayıcısı

- **Durum:** Kabul edildi (geçici) — Q-06 açık
- **Tarih:** 4 Kasım 2026
- **İlgili:** Q-06, FR-CON-02, US-13, US-16, US-17, US-66, BR-04, BR-25, PRIV-05, PRIV-08

## Bağlam

Sunucu şu e-postaları gönderir: veli onay isteği ve hatırlatmaları (7. ve 25. gün), onay/geri alma
teyidi, hesap silindi, hareketsizlik uyarısı, destek talebinin ekibe iletilmesi. Ayrıca Supabase
Auth'un doğrulama ve şifre sıfırlama e-postaları için özel SMTP gerekir (yerleşik gönderici
üretimde hız sınırlıdır). Alıcıların bir kısmı veliler; e-postada öğrencinin rumuzu geçer.
Sağlayıcı seçimi (Q-06) henüz kesinleşmedi.

## Seçenekler

| Sağlayıcı | Artı | Eksi |
|---|---|---|
| Resend | Basit HTTP API, SMTP de var, AB bölgesi seçeneği, ücretsiz katman yeterli | Görece yeni şirket |
| Postmark | İşlem e-postasında yüksek teslim oranı | AB veri konumu ayrıca teyit edilmeli, ücretli |
| Amazon SES | Çok ucuz | Kurulum ve itibar yönetimi ağır |
| SendGrid / Mailgun | Yaygın | Pazarlama odaklı, karmaşık panel |

## Karar

- Varsayılan **Resend** (HTTP API: `RESEND_API_KEY`, gönderen `EMAIL_FROM`, isteğe bağlı
  `EMAIL_REPLY_TO`). Auth e-postaları için aynı hesabın SMTP'si.
- Kod sağlayıcıya bağlanmaz: `supabase/functions/_shared/email.ts` tek bir `EmailProvider`
  arayüzü (`send(message)`) sunar; fonksiyonlar yalnızca `sendEmail()` çağırır. Başka sağlayıcıya
  geçmek tek adaptör eklemek ve `EMAIL_PROVIDER` değişkenini değiştirmektir. Yerelde
  `EMAIL_PROVIDER=console` gönderim yapmadan maskeli adresle log yazar.
- Şablonlar Türkçe ve ayrı dosyada (`_shared/email-templates.ts`); kullanıcıdan gelen her değer
  HTML'e kaçışlanarak girer. Veliye "siz", öğrenciye "sen" diye hitap edilir.
- Loglarda e-posta adresi maskelenir (`a***@alan.com`, PRIV-08); sağlayıcı yanıt gövdesi loglanmaz.

## Sonuçlar

- (+) Q-06 kapanınca sağlayıcı değişikliği küçük ve yerel bir iş.
- (−) Resend bir veri işleyendir: veri işleme sözleşmesi (DPA), AB bölgesi ve log saklama süresi
  hukuk danışmanıyla teyit edilmeli; SDK veri envanterine (`analysis/security_review.md`) eklendi.
- Yapılacaklar: alan adı doğrulaması (SPF, DKIM, DMARC), `no-reply@` ve `destek@` adresleri,
  hemen çıkma/şikâyet bildirimlerinin izlenmesi.

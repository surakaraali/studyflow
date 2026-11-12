/**
 * Turkish e-mail templates. Parents are addressed formally ("siz"), students informally ("sen"),
 * like the app. Every value that comes from a user is escaped.
 * Legal wording (aydınlatma, rıza) must be approved by legal counsel before launch (US-68).
 */

import type { EmailMessage } from './email.ts';

export type Purpose = 'ai' | 'notifications';

export const PURPOSE_LABELS: Record<Purpose, string> = {
  ai: 'Yapay zekâ ile içerik üretimi',
  notifications: 'Bildirimler',
};

const COLORS = { paper: '#F4F6FB', ink: '#161C3A', muted: '#5B6281', pen: '#2A3FD1', exam: '#C72A62' };

export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function formatDateTr(date: Date): string {
  return new Intl.DateTimeFormat('tr-TR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/Istanbul',
  }).format(date);
}

/** "Ada" or "Çocuğunuz" — the nickname is the only student detail parents see. */
function childName(nickname: string | null, capital = true): string {
  const name = nickname?.trim();
  if (name) return escapeHtml(name);
  return capital ? 'Çocuğunuz' : 'çocuğunuz';
}

function plainChildName(nickname: string | null, capital = true): string {
  return nickname?.trim() || (capital ? 'Çocuğunuz' : 'çocuğunuz');
}

type Block = { kind: 'p'; html: string } | { kind: 'button'; label: string; href: string } | { kind: 'list'; items: string[] } | { kind: 'note'; html: string };

function layout(title: string, blocks: Block[]): string {
  const body = blocks
    .map((block) => {
      switch (block.kind) {
        case 'p':
          return `<p style="margin:0 0 16px;font-size:16px;line-height:1.55;color:${COLORS.ink}">${block.html}</p>`;
        case 'note':
          return `<p style="margin:0 0 16px;font-size:14px;line-height:1.5;color:${COLORS.muted}">${block.html}</p>`;
        case 'list':
          return `<ul style="margin:0 0 16px;padding-left:20px;font-size:16px;line-height:1.55;color:${COLORS.ink}">${block.items
            .map((item) => `<li style="margin-bottom:6px">${item}</li>`)
            .join('')}</ul>`;
        case 'button':
          return `<p style="margin:24px 0"><a href="${escapeHtml(block.href)}" style="display:inline-block;background:${COLORS.pen};color:#FFFFFF;text-decoration:none;font-weight:600;font-size:16px;padding:14px 22px;border-radius:12px">${escapeHtml(block.label)}</a></p>
<p style="margin:0 0 16px;font-size:13px;line-height:1.5;color:${COLORS.muted}">Düğme çalışmazsa bu adresi tarayıcınıza yapıştırın:<br><span style="word-break:break-all">${escapeHtml(block.href)}</span></p>`;
      }
    })
    .join('\n');

  return `<!doctype html>
<html lang="tr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title></head>
<body style="margin:0;padding:0;background:${COLORS.paper}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COLORS.paper}">
<tr><td align="center" style="padding:24px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FFFFFF;border-radius:16px;border-top:4px solid ${COLORS.exam}">
<tr><td style="padding:28px 24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
<p style="margin:0 0 4px;font-size:14px;letter-spacing:0.02em;color:${COLORS.pen};font-weight:600">StudyMark</p>
<h1 style="margin:0 0 20px;font-family:Georgia,'Times New Roman',serif;font-size:24px;line-height:1.3;color:${COLORS.ink}">${escapeHtml(title)}</h1>
${body}
<p style="margin:24px 0 0;font-size:13px;line-height:1.5;color:${COLORS.muted}">Bu e-posta StudyMark hesabıyla ilgili olduğu için gönderildi. Sorunuz varsa bu e-postayı yanıtlayabilirsiniz.</p>
</td></tr></table>
</td></tr></table>
</body></html>`;
}

function textBody(lines: string[]): string {
  return `${lines.join('\n\n')}\n\nStudyMark`;
}

// ---------------------------------------------------------------------------------------------
// Parent consent
// ---------------------------------------------------------------------------------------------

export function consentRequestEmail(input: {
  to: string;
  nickname: string | null;
  link: string;
  expiresAt: Date;
  under13: boolean;
}): EmailMessage {
  const name = childName(input.nickname);
  const subject = `${plainChildName(input.nickname)} StudyMark için onayınızı bekliyor`;
  const expires = formatDateTr(input.expiresAt);
  const blocks: Block[] = [
    { kind: 'p', html: `Merhaba,` },
    {
      kind: 'p',
      html: `${name}, ders çalışmasını planlamak için StudyMark uygulamasını kullanmak istiyor ve bu e-posta adresini veli adresi olarak yazdı. 18 yaşından küçükler için sizin onayınız gerekiyor.`,
    },
    {
      kind: 'p',
      html: `Onay sayfasında hangi bilgilerin işlendiğini okuyabilir ve şu iki amaç için ayrı ayrı karar verebilirsiniz:`,
    },
    { kind: 'list', items: [PURPOSE_LABELS.ai, PURPOSE_LABELS.notifications] },
    { kind: 'button', label: 'Onay sayfasını aç', href: input.link },
    { kind: 'note', html: `Bağlantı ${escapeHtml(expires)} tarihine kadar geçerlidir.` },
  ];
  if (input.under13) {
    blocks.push({
      kind: 'note',
      html: `Onay verilmezse 13 yaşından küçük kullanıcıların hesabı ve verileri, hesap açıldıktan 30 gün sonra silinir.`,
    });
  }
  blocks.push({
    kind: 'note',
    html: 'Bu isteği siz beklemiyorsanız e-postayı dikkate almayın; onay vermediğiniz sürece hesap kısıtlı kalır.',
  });

  return {
    to: input.to,
    subject,
    tag: 'consent_request',
    html: layout('Veli onayı', blocks),
    text: textBody([
      'Merhaba,',
      `${plainChildName(input.nickname)}, ders çalışmasını planlamak için StudyMark uygulamasını kullanmak istiyor ve bu e-posta adresini veli adresi olarak yazdı. 18 yaşından küçükler için sizin onayınız gerekiyor.`,
      `Onay sayfası (${expires} tarihine kadar geçerli): ${input.link}`,
      `Ayrı ayrı karar vereceğiniz amaçlar: ${PURPOSE_LABELS.ai}, ${PURPOSE_LABELS.notifications}.`,
      input.under13
        ? 'Onay verilmezse 13 yaşından küçük kullanıcıların hesabı ve verileri, hesap açıldıktan 30 gün sonra silinir.'
        : '',
      'Bu isteği siz beklemiyorsanız e-postayı dikkate almayın.',
    ].filter(Boolean)),
  };
}

export function consentDecisionEmail(input: {
  to: string;
  nickname: string | null;
  action: 'granted' | 'revoked';
  purposes: Purpose[];
  /** The consent page with the same token; works after the 7-day window for changes. */
  manageLink: string;
}): EmailMessage {
  const name = childName(input.nickname);
  if (input.action === 'granted') {
    const granted = input.purposes.map((p) => PURPOSE_LABELS[p]);
    const purposesHtml = granted.length
      ? [{ kind: 'p', html: 'İzin verdiğiniz amaçlar:' } as Block, { kind: 'list', items: granted.map(escapeHtml) } as Block]
      : [{ kind: 'p', html: 'Ek amaçlar için izin vermediniz; yapay zekâ ve bildirim özellikleri kapalı kalır.' } as Block];
    const revokeLink = `${input.manageLink}&action=revoke`;
    return {
      to: input.to,
      subject: 'Onayınız kaydedildi',
      tag: 'consent_granted',
      html: layout('Onayınız kaydedildi', [
        { kind: 'p', html: `Teşekkürler. ${name} artık StudyMark'u kullanabilir.` },
        ...purposesHtml,
        { kind: 'p', html: 'Tercihlerinizi istediğiniz zaman değiştirebilir ya da onayınızı tamamen geri alabilirsiniz.' },
        { kind: 'button', label: 'Onayımı geri al', href: revokeLink },
        { kind: 'note', html: 'Bu e-postayı saklayın: geri alma bağlantısı süresiz geçerlidir.' },
      ]),
      text: textBody([
        `Teşekkürler. ${plainChildName(input.nickname)} artık StudyMark'u kullanabilir.`,
        granted.length ? `İzin verdiğiniz amaçlar: ${granted.join(', ')}.` : 'Ek amaçlar için izin vermediniz.',
        `Onayınızı geri almak için: ${revokeLink}`,
      ]),
    };
  }

  return {
    to: input.to,
    subject: 'Onayınız geri alındı',
    tag: 'consent_revoked',
    html: layout('Onayınız geri alındı', [
      {
        kind: 'p',
        html: `İsteğiniz kaydedildi. ${name} için yapay zekâ ve bildirim özellikleri kapatıldı ve hesap kısıtlı moda geçti.`,
      },
      { kind: 'p', html: 'Fikrinizi değiştirirseniz aynı sayfadan yeniden onay verebilirsiniz.' },
      { kind: 'button', label: 'Onay sayfasını aç', href: input.manageLink },
    ]),
    text: textBody([
      `İsteğiniz kaydedildi. ${plainChildName(input.nickname)} için yapay zekâ ve bildirim özellikleri kapatıldı ve hesap kısıtlı moda geçti.`,
      `Yeniden onay vermek için: ${input.manageLink}`,
    ]),
  };
}

export function consentReminderEmail(input: {
  to: string;
  nickname: string | null;
  link: string;
  expiresAt: Date;
  deleteOn: Date;
}): EmailMessage {
  const name = childName(input.nickname);
  const deleteOn = formatDateTr(input.deleteOn);
  return {
    to: input.to,
    subject: `Hatırlatma: ${plainChildName(input.nickname)} onayınızı bekliyor`,
    tag: 'consent_reminder',
    html: layout('Onayınızı bekliyoruz', [
      { kind: 'p', html: `${name} StudyMark'u kullanmak için hâlâ onayınızı bekliyor.` },
      {
        kind: 'p',
        html: `Onay verilmezse hesap ve tüm verileri <strong>${escapeHtml(deleteOn)}</strong> tarihinde silinecek.`,
      },
      { kind: 'button', label: 'Onay sayfasını aç', href: input.link },
      { kind: 'note', html: `Yeni bağlantı ${escapeHtml(formatDateTr(input.expiresAt))} tarihine kadar geçerlidir.` },
    ]),
    text: textBody([
      `${plainChildName(input.nickname)} StudyMark'u kullanmak için hâlâ onayınızı bekliyor.`,
      `Onay verilmezse hesap ve tüm verileri ${deleteOn} tarihinde silinecek.`,
      `Onay sayfası: ${input.link}`,
    ]),
  };
}

// ---------------------------------------------------------------------------------------------
// Account lifecycle (sent to the account's own address; the student reads these)
// ---------------------------------------------------------------------------------------------

export type DeletionReason = 'user' | 'consent' | 'inactivity';

export function accountDeletedEmail(input: { to: string; reason: DeletionReason }): EmailMessage {
  const why = {
    user: 'İsteğin üzerine StudyMark hesabını sildik.',
    consent: 'Velin 30 gün içinde onay vermediği için StudyMark hesabını sildik.',
    inactivity: 'Bir yıldan uzun süredir giriş yapılmadığı için StudyMark hesabını sildik.',
  }[input.reason];
  const details =
    'Yüklediğin belgeler, derslerin, planın, kartların ve çalışma kayıtların silindi. Yasal olarak saklamamız gereken veli onayı ve ödeme kayıtları, yasal süre dolunca silinir.';
  return {
    to: input.to,
    subject: 'Hesabın silindi',
    tag: `account_deleted_${input.reason}`,
    html: layout('Hesabın silindi', [
      { kind: 'p', html: why },
      { kind: 'p', html: details },
      {
        kind: 'note',
        html: 'Aktif bir aboneliğin varsa App Store ayarlarından iptal etmeyi unutma; mağaza aboneliği hesapla birlikte kapanmaz.',
      },
    ]),
    text: textBody([why, details, 'Aktif bir aboneliğin varsa App Store ayarlarından iptal etmeyi unutma.']),
  };
}

export function inactivityWarningEmail(input: { to: string; deleteOn: Date }): EmailMessage {
  const deleteOn = formatDateTr(input.deleteOn);
  return {
    to: input.to,
    subject: 'StudyMark hesabın silinmek üzere',
    tag: 'inactivity_warning',
    html: layout('Seni özledik', [
      { kind: 'p', html: 'Bir yıldır StudyMark hesabına giriş yapmadın.' },
      {
        kind: 'p',
        html: `Hesabını korumak istiyorsan <strong>${escapeHtml(deleteOn)}</strong> tarihine kadar uygulamayı açman yeterli. Açmazsan hesabın ve verilerin silinecek.`,
      },
    ]),
    text: textBody([
      'Bir yıldır StudyMark hesabına giriş yapmadın.',
      `Hesabını korumak istiyorsan ${deleteOn} tarihine kadar uygulamayı açman yeterli. Açmazsan hesabın ve verilerin silinecek.`,
    ]),
  };
}

// ---------------------------------------------------------------------------------------------
// Support (to the team)
// ---------------------------------------------------------------------------------------------

export function supportTicketEmail(input: {
  to: string;
  replyTo: string;
  ticketId: string;
  topic: string;
  message: string;
  appVersion: string | null;
  platform: string | null;
  osVersion: string | null;
  signedIn: boolean;
}): EmailMessage {
  const meta = [
    `Konu: ${input.topic}`,
    `Uygulama sürümü: ${input.appVersion ?? '—'}`,
    `Platform: ${input.platform ?? '—'} ${input.osVersion ?? ''}`.trim(),
    `Hesap: ${input.signedIn ? 'giriş yapılmış' : 'giriş yok (web formu)'}`,
    `Kayıt: ${input.ticketId}`,
  ];
  return {
    to: input.to,
    replyTo: input.replyTo,
    subject: `[Destek] ${input.topic} · ${input.ticketId.slice(0, 8)}`,
    tag: 'support_ticket',
    html: layout('Yeni destek talebi', [
      { kind: 'list', items: meta.map(escapeHtml) },
      { kind: 'p', html: escapeHtml(input.message).replaceAll('\n', '<br>') },
      { kind: 'note', html: 'Yanıtla dediğinde e-posta kullanıcının yazdığı adrese gider. 2 iş günü içinde yanıt ver.' },
    ]),
    text: textBody([...meta, input.message]),
  };
}

// ---------------------------------------------------------------------------------------------
// Ops alerts (to the team, ADR-006). Numbers only, never personal data.
// ---------------------------------------------------------------------------------------------

export type OpsAlertItem = { action: 'fire' | 'remind' | 'resolve'; title: string; lines: string[] };

const OPS_ACTION_LABELS: Record<OpsAlertItem['action'], string> = {
  fire: 'Yeni',
  remind: 'Sürüyor',
  resolve: 'Düzeldi',
};

export function opsAlertEmail(input: { to: string; project: string; items: OpsAlertItem[] }): EmailMessage {
  const open = input.items.filter((item) => item.action !== 'resolve');
  const first = open[0] ?? input.items[0];
  const subject =
    open.length > 0
      ? `[StudyMark ops] ${first.title}${open.length > 1 ? ` (+${open.length - 1})` : ''}`
      : `[StudyMark ops] Düzeldi: ${first.title}`;
  const sections = input.items.map((item) => ({
    heading: `${OPS_ACTION_LABELS[item.action]} · ${item.title}`,
    lines: item.lines,
  }));
  return {
    to: input.to,
    subject,
    tag: 'ops_alert',
    html: layout('Operasyon uyarısı', [
      { kind: 'note', html: `Proje: ${escapeHtml(input.project)}` },
      ...sections.flatMap((section): Block[] => [
        { kind: 'p', html: `<strong>${escapeHtml(section.heading)}</strong>` },
        { kind: 'list', items: section.lines.map(escapeHtml) },
      ]),
      { kind: 'note', html: 'Durum sürerse 6 saatte bir hatırlatılır. Görünümler: ops şeması (SQL editörü).' },
    ]),
    text: textBody([
      `Proje: ${input.project}`,
      ...sections.map((section) => [section.heading, ...section.lines.map((line) => `- ${line}`)].join('\n')),
    ]),
  };
}

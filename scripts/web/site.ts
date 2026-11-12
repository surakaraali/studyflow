/// <reference types="node" />
/**
 * Public web pages: landing, legal texts, support (FAQ), parent consent and account deletion.
 *
 * Legal texts and the FAQ are rendered from the app's own sources (src/features/legal/texts.ts,
 * src/i18n/tr/settings.ts) and colors from src/constants/theme.ts, so the site never drifts from
 * the app. The consent and deletion pages are static files in web/ whose scripts are copied as
 * they are; only their config block, CSP origin, header and footer are filled in here.
 */

import fs from 'node:fs';
import path from 'node:path';

import {
  LEGAL_DATE,
  LEGAL_DOC_IDS,
  LEGAL_DOCUMENTS,
  LEGAL_DRAFT,
  LEGAL_VERSION,
  type LegalDocId,
  type LegalDocument,
} from '../../src/features/legal/texts';
import account from '../../src/i18n/tr/account';
import settings from '../../src/i18n/tr/settings';

export const ROOT = path.resolve(__dirname, '../..');
export const DEFAULT_OUT_DIR = path.join(ROOT, 'web', 'dist');

/** Published paths (directory style, so /gizlilik and /gizlilik/ both work on any static host). */
export const ROUTES = {
  home: '',
  aydinlatma: 'aydinlatma-metni',
  gizlilik: 'gizlilik',
  kosullar: 'kosullar',
  support: 'destek',
  consent: 'veli-onayi',
  deleteAccount: 'hesap-silme',
} as const;

const LEGAL_ROUTES: Record<LegalDocId, string> = {
  aydinlatma: ROUTES.aydinlatma,
  gizlilik: ROUTES.gizlilik,
  kosullar: ROUTES.kosullar,
};

/** The source still says this until the build fills in a real project. */
export const FUNCTIONS_PLACEHOLDER = 'https://YOUR-PROJECT-REF.supabase.co/functions/v1';
const DEFAULT_SUPPORT_EMAIL = 'destek@studymark.app';

export type SiteOptions = {
  /** Production functions base, e.g. https://<ref>.supabase.co/functions/v1. Null keeps the placeholder. */
  functionsUrl: string | null;
  /** When set, also builds /staging/veli-onayi/ and /staging/hesap-silme/ against staging. */
  stagingFunctionsUrl: string | null;
  supportEmail: string;
  /** Public anon key for the two forms. Optional: the functions they call do not verify a JWT. */
  anonKey: string;
  /** Site address, e.g. https://studymark.app/ (canonical links, 404 page). Null = relative only. */
  baseUrl: string | null;
  /** App Store page once the app is live. */
  appStoreUrl: string | null;
  year: number;
};

export type SiteFiles = Map<string, string | Buffer>;

function clean(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function optionsFromEnv(env: Record<string, string | undefined>, now: Date = new Date()): SiteOptions {
  const supabaseUrl = clean(env.EXPO_PUBLIC_SUPABASE_URL);
  const functionsUrl =
    clean(env.WEB_FUNCTIONS_URL) ?? (supabaseUrl ? `${supabaseUrl.replace(/\/$/, '')}/functions/v1` : null);
  let baseUrl = clean(env.WEB_BASE_URL);
  if (baseUrl && !baseUrl.endsWith('/')) baseUrl += '/';
  return {
    functionsUrl: functionsUrl?.replace(/\/$/, '') ?? null,
    stagingFunctionsUrl: clean(env.WEB_STAGING_FUNCTIONS_URL)?.replace(/\/$/, '') ?? null,
    supportEmail: clean(env.EXPO_PUBLIC_SUPPORT_EMAIL) ?? DEFAULT_SUPPORT_EMAIL,
    anonKey: clean(env.WEB_ANON_KEY) ?? '',
    baseUrl,
    appStoreUrl: clean(env.WEB_APP_STORE_URL),
    year: now.getFullYear(),
  };
}

/** Problems that must stop a deploy (`--strict`). */
export function strictProblems(options: SiteOptions): string[] {
  const problems: string[] = [];
  const checkFunctions = (name: string, value: string | null, required: boolean) => {
    if (!value) {
      if (required) problems.push(`${name} is not set (WEB_FUNCTIONS_URL or EXPO_PUBLIC_SUPABASE_URL)`);
      return;
    }
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      problems.push(`${name} is not a URL: ${value}`);
      return;
    }
    if (url.protocol !== 'https:') problems.push(`${name} must use https: ${value}`);
    if (/^(localhost|127\.0\.0\.1|\[::1\])$/.test(url.hostname)) problems.push(`${name} points to this machine: ${value}`);
    if (value === FUNCTIONS_PLACEHOLDER) problems.push(`${name} is still the placeholder`);
    if (!url.pathname.endsWith('/functions/v1')) problems.push(`${name} should end with /functions/v1: ${value}`);
  };
  checkFunctions('functionsUrl', options.functionsUrl, true);
  checkFunctions('stagingFunctionsUrl', options.stagingFunctionsUrl, false);
  if (options.baseUrl && !/^https:\/\//.test(options.baseUrl)) problems.push(`WEB_BASE_URL must use https: ${options.baseUrl}`);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(options.supportEmail)) problems.push(`support e-mail is not valid: ${options.supportEmail}`);
  return problems;
}

// ---------------------------------------------------------------------------------------------
// Theme
// ---------------------------------------------------------------------------------------------

export type ThemeTokens = { light: Record<string, string>; dark: Record<string, string> };

/** Reads `Colors` from src/constants/theme.ts as text (that file imports react-native). */
export function parseThemeColors(source: string): ThemeTokens {
  const block = /export const Colors\b[^=]*=\s*\{([\s\S]*?)\n\};/.exec(source)?.[1];
  if (!block) throw new Error('theme.ts: Colors object not found');
  const read = (mode: 'light' | 'dark') => {
    const body = new RegExp(`\\b${mode}:\\s*\\{([^}]*)\\}`).exec(block)?.[1];
    if (!body) throw new Error(`theme.ts: Colors.${mode} not found`);
    const colors: Record<string, string> = {};
    for (const match of body.matchAll(/(\w+):\s*'(#[0-9A-Fa-f]{6})'/g)) colors[match[1]] = match[2].toUpperCase();
    if (Object.keys(colors).length === 0) throw new Error(`theme.ts: Colors.${mode} has no colors`);
    return colors;
  };
  const tokens = { light: read('light'), dark: read('dark') };
  for (const key of ['paper', 'surface', 'ink', 'pen', 'onPen', 'highlight', 'exam', 'success']) {
    if (!tokens.light[key] || !tokens.dark[key]) throw new Error(`theme.ts: color ${key} missing`);
  }
  return tokens;
}

export function readTheme(root: string = ROOT): ThemeTokens {
  return parseThemeColors(fs.readFileSync(path.join(root, 'src', 'constants', 'theme.ts'), 'utf8'));
}

function cssName(key: string): string {
  return `--${key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`;
}

export function tokensCss(tokens: ThemeTokens): string {
  const lines = (colors: Record<string, string>, indent: string) =>
    Object.entries(colors)
      .map(([key, value]) => `${indent}${cssName(key)}: ${value};`)
      .join('\n');
  return [
    '/* Generated from src/constants/theme.ts. */',
    ':root {',
    '  color-scheme: light dark;',
    lines(tokens.light, '  '),
    '}',
    '@media (prefers-color-scheme: dark) {',
    '  :root {',
    lines(tokens.dark, '    '),
    '  }',
    '}',
  ].join('\n');
}

// ---------------------------------------------------------------------------------------------
// HTML helpers
// ---------------------------------------------------------------------------------------------

export function esc(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Escapes and marks "[placeholders]" that legal counsel still has to fill in. */
function legalText(text: string): string {
  return esc(text).replace(/\[([^\]]+)\]/g, '<mark class="placeholder">[$1]</mark>');
}

/** Visible text of a page, for the checks below. */
export function htmlText(html: string): string {
  return html
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ');
}

export function normalizeText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

const formatDate = (iso: string) =>
  new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(`${iso}T00:00:00Z`),
  );

function logo(tokens: ThemeTokens): string {
  // The app icon: two rings and a highlighter dot rising on ballpoint blue.
  return (
    `<svg viewBox="0 0 1024 1024" aria-hidden="true" focusable="false">` +
    `<rect width="1024" height="1024" rx="228" fill="${tokens.light.pen}"/>` +
    `<g fill="none" stroke="#FFFFFF" stroke-width="64"><circle cx="300" cy="724" r="118"/><circle cx="512" cy="512" r="118"/></g>` +
    `<circle cx="724" cy="300" r="138" fill="${tokens.light.highlight}"/></svg>`
  );
}

type Ctx = { options: SiteOptions; tokens: ThemeTokens };

/** "../" for pages one folder deep, "" for the landing page. */
function relPrefix(route: string): string {
  return route ? '../'.repeat(route.split('/').length) : '';
}

function link(rel: string, route: string): string {
  return route ? `${rel}${route}/` : rel || './';
}

function header(ctx: Ctx, route: string): string {
  const rel = relPrefix(route);
  const current = (target: string) => (route === target ? ' aria-current="page"' : '');
  return [
    '<a class="skip" href="#main">İçeriğe geç</a>',
    '<header class="site-header">',
    `  <a class="brand" href="${link(rel, ROUTES.home)}">${logo(ctx.tokens)}<span>StudyMark</span></a>`,
    '  <nav class="site-nav" aria-label="Site">',
    `    <a href="${link(rel, ROUTES.support)}"${current(ROUTES.support)}>Destek</a>`,
    `    <a href="${link(rel, ROUTES.gizlilik)}"${current(ROUTES.gizlilik)}>Gizlilik</a>`,
    '  </nav>',
    '</header>',
  ].join('\n');
}

function footer(ctx: Ctx, route: string): string {
  const rel = relPrefix(route);
  const items: [string, string][] = [
    [ROUTES.gizlilik, 'Gizlilik politikası'],
    [ROUTES.kosullar, 'Kullanım koşulları'],
    [ROUTES.aydinlatma, 'Aydınlatma metni'],
    [ROUTES.support, 'Destek'],
    [ROUTES.deleteAccount, 'Hesap silme'],
  ];
  return [
    '<footer class="site-footer">',
    '  <nav aria-label="Yasal ve destek">',
    '    <ul>',
    ...items.map(([target, label]) => `      <li><a href="${link(rel, target)}">${label}</a></li>`),
    '    </ul>',
    '  </nav>',
    `  <p>© ${ctx.options.year} StudyMark · Ortaokul ve lise öğrencileri için ders çalışma planlayıcısı</p>`,
    '</footer>',
  ].join('\n');
}

function themeColorMeta(tokens: ThemeTokens): string {
  return [
    `<meta name="theme-color" content="${tokens.light.paper}" media="(prefers-color-scheme: light)">`,
    `<meta name="theme-color" content="${tokens.dark.paper}" media="(prefers-color-scheme: dark)">`,
  ].join('\n  ');
}

/** Content pages run no script and load nothing from other sites. */
const CONTENT_CSP =
  "default-src 'none'; style-src 'self'; font-src 'self'; img-src 'self' data:; base-uri 'none'; form-action 'none'";

function layout(
  ctx: Ctx,
  page: { route: string; title: string; description: string; body: string; noindex?: boolean },
): string {
  const rel = relPrefix(page.route);
  const canonical =
    ctx.options.baseUrl && !page.noindex ? `${ctx.options.baseUrl}${page.route ? `${page.route}/` : ''}` : null;
  const head = [
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">',
    `<meta http-equiv="Content-Security-Policy" content="${CONTENT_CSP}">`,
    '<meta name="referrer" content="strict-origin-when-cross-origin">',
    page.noindex ? '<meta name="robots" content="noindex">' : null,
    themeColorMeta(ctx.tokens),
    `<title>${esc(page.title)}</title>`,
    `<meta name="description" content="${esc(page.description)}">`,
    canonical ? `<link rel="canonical" href="${esc(canonical)}">` : null,
    `<meta property="og:title" content="${esc(page.title)}">`,
    `<meta property="og:description" content="${esc(page.description)}">`,
    ctx.options.baseUrl ? `<meta property="og:image" content="${esc(ctx.options.baseUrl)}assets/icon.png">` : null,
    `<link rel="icon" href="${rel}assets/favicon.png">`,
    `<link rel="apple-touch-icon" href="${rel}assets/icon.png">`,
    `<link rel="stylesheet" href="${rel}assets/site.css">`,
  ].filter(Boolean);
  return [
    '<!doctype html>',
    '<html lang="tr">',
    '<head>',
    `  ${head.join('\n  ')}`,
    '</head>',
    '<body>',
    header(ctx, page.route),
    '<main id="main">',
    page.body,
    '</main>',
    footer(ctx, page.route),
    '</body>',
    '</html>',
    '',
  ].join('\n');
}

// ---------------------------------------------------------------------------------------------
// Pages
// ---------------------------------------------------------------------------------------------

function draftNotice(): string {
  if (!LEGAL_DRAFT) return '';
  return [
    '<div class="draft" role="note">',
    `  <span aria-hidden="true">✎</span>`,
    `  <div><strong>${esc(account.legal.draft)}.</strong> Yayından önce değişebilir. Köşeli parantez içindeki bilgiler henüz kesinleşmedi.</div>`,
    '</div>',
  ].join('\n');
}

export function legalPage(ctx: Ctx, doc: LegalDocument): string {
  const route = LEGAL_ROUTES[doc.id];
  const rel = relPrefix(route);
  const toc = LEGAL_DOC_IDS.map((id) => {
    const other = LEGAL_DOCUMENTS[id];
    const current = id === doc.id ? ' aria-current="page"' : '';
    return `    <li><a href="${link(rel, LEGAL_ROUTES[id])}"${current}>${esc(other.title)}</a></li>`;
  });
  const sections = doc.sections.map((section) =>
    [
      '  <section>',
      `    <h2>${legalText(section.heading)}</h2>`,
      // Same order as the app (LegalDocumentView): paragraphs, then bullets.
      ...(section.paragraphs ?? []).map((p) => `    <p>${legalText(p)}</p>`),
      section.bullets?.length
        ? ['    <ul>', ...section.bullets.map((b) => `      <li>${legalText(b)}</li>`), '    </ul>'].join('\n')
        : '',
      '  </section>',
    ]
      .filter(Boolean)
      .join('\n'),
  );
  const body = [
    `<h1>${esc(doc.title)}</h1>`,
    `<p class="lead">${esc(doc.summary)}</p>`,
    `<p class="meta">Sürüm ${esc(LEGAL_VERSION)} · ${esc(formatDate(LEGAL_DATE))}</p>`,
    draftNotice(),
    '<nav aria-label="Yasal metinler">',
    '  <ul class="toc">',
    ...toc,
    '  </ul>',
    '</nav>',
    '<article class="prose">',
    ...sections,
    '</article>',
    '<p class="muted">Bu metin uygulamadaki metnin aynısıdır: Ayarlar › Yasal metinler.</p>',
  ]
    .filter(Boolean)
    .join('\n');
  return layout(ctx, {
    route,
    title: `${doc.title} · StudyMark`,
    description: doc.summary,
    body,
    noindex: LEGAL_DRAFT,
  });
}

type FaqItem = { q: string; a: string };

export function faqItems(): FaqItem[] {
  return Object.values(settings.faq.items as Record<string, FaqItem>);
}

export function supportPage(ctx: Ctx): string {
  const route = ROUTES.support;
  const rel = relPrefix(route);
  const email = esc(ctx.options.supportEmail);
  const faq = faqItems().map((item) =>
    ['  <details>', `    <summary>${esc(item.q)}</summary>`, `    <p>${esc(item.a)}</p>`, '  </details>'].join('\n'),
  );
  const body = [
    '<h1>Destek</h1>',
    '<p class="lead">Sorunu ya da merak ettiğini kısaca yaz, ekibimiz e-postayla cevap versin. Aradığın cevap aşağıdaki sık sorulan sorularda da olabilir.</p>',
    '<div class="card pen">',
    '  <h2>Bize yaz</h2>',
    '  <ul class="facts">',
    '    <li><strong>Uygulamadan:</strong> Ayarlar › Destek. Uygulama sürümü mesajına kendiliğinden eklenir.</li>',
    `    <li><strong>E-postayla:</strong> <a href="mailto:${email}">${email}</a></li>`,
    '  </ul>',
    '  <p class="muted">Genellikle 2 iş günü içinde cevap veririz. Mesajına şifreni ya da belge içeriğini yazma.</p>',
    '</div>',
    '<div class="card exam">',
    '  <h2>Veliler için</h2>',
    '  <ul class="facts">',
    '    <li>Onay bağlantısı gelmediyse ya da süresi dolduysa çocuğunuz uygulamadaki <strong>Bağlantıyı yeniden gönder</strong> düğmesine dokunabilir. Bağlantılar 7 gün geçerlidir.</li>',
    '    <li>Tercihlerinizi değiştirmek ya da onayınızı geri almak için size gelen StudyMark e-postasındaki bağlantıyı açın.</li>',
    `    <li>KVKK kapsamındaki başvurularınız için <a href="mailto:${email}">${email}</a> adresine yazabilirsiniz; ayrıntılar <a href="${link(rel, ROUTES.aydinlatma)}">aydınlatma metninde</a>.</li>`,
    '  </ul>',
    '</div>',
    '<div class="card">',
    '  <h2>Hesap silme</h2>',
    '  <p>Uygulamadan: <strong>Ayarlar › Hesap ve silme › Hesabımı sil</strong>. Belgelerin hemen, diğer verilerin en geç 30 gün içinde silinir.</p>',
    `  <p>Uygulamaya giremiyorsan <a href="${link(rel, ROUTES.deleteAccount)}">web formundan</a> silme isteği gönderebilirsin.</p>`,
    '</div>',
    `<h2 id="sss">${esc(settings.faq.title)}</h2>`,
    '<div class="faq">',
    ...faq,
    '</div>',
  ].join('\n');
  return layout(ctx, {
    route,
    title: 'Destek · StudyMark',
    description: 'StudyMark için sık sorulan sorular, veli onayı yardımı ve destek iletişimi.',
    body,
  });
}

export function homePage(ctx: Ctx): string {
  const route = ROUTES.home;
  const rel = relPrefix(route);
  const badge = ctx.options.appStoreUrl
    ? `<a class="store-badge" href="${esc(ctx.options.appStoreUrl)}">App Store’dan indir</a>`
    : '<span class="store-badge soon">Yakında App Store’da</span>';
  const features: [string, string][] = [
    [
      'Sınavına göre plan',
      'Okul ders programını ve müsait saatlerini gir. Plan; sınavına kalan güne, konuların zorluğuna ve son sonuçlarına göre önümüzdeki 14 günü kurar. Kaçırdığın blok silinmez, sonraki günlere taşınır.',
    ],
    [
      'Notundan özet, quiz ve kart',
      'PDF ders notunu yükle, sayfa aralığını seç. Yapay zekâ sınıf seviyene uygun özet, açıklamalı sorular ve çalışma kartları hazırlar. Her öğe kaynak sayfasını gösterir ve “Yapay zekâ ile üretildi” etiketi taşır.',
    ],
    [
      'Kartlarla tekrar, internetsiz de',
      'Kartların aralıklı tekrar yöntemiyle, unutmaya başladığın zamanda karşına çıkar. Kart tekrarı, günün planı ve zamanlayıcı internet yokken de çalışır.',
    ],
    [
      'Odaklan, ilerlemeni gör',
      'Odak zamanlayıcı blok süresine göre çalışır ve molanı hatırlatır. Haftalık çalışma süreni, ders bazında doğru oranını, plan uyumunu ve serini görürsün.',
    ],
  ];
  const body = [
    '<section class="hero">',
    '  <h1>Bugün ne çalışacağın <span class="ink-mark">hazır</span>.</h1>',
    '  <p class="lead">StudyMark ortaokul ve lise öğrencileri için bir ders çalışma planlayıcısı. Derslerini, sınav tarihlerini ve boş saatlerini gir; planın kendiliğinden kurulsun. Ders notunu yükle; yapay zekâ özet, quiz ve kart hazırlasın.</p>',
    `  ${badge}`,
    '  <p class="muted">iPhone için · Türkçe · Reklam yok</p>',
    '</section>',
    '<figure class="today" aria-label="Örnek Bugün ekranı">',
    '  <div class="today-head"><strong>Bugün</strong><span>3 blok · 95 dk</span></div>',
    '  <div class="block now"><time>17:00</time><div class="what"><strong>Matematik</strong><span>Trigonometri</span></div><span class="len">40 dk</span></div>',
    '  <div class="block"><time>17:50</time><div class="what"><strong>Fizik</strong><span>Kuvvet ve hareket</span></div><span class="len">40 dk</span></div>',
    '  <div class="block"><time>18:40</time><div class="what"><strong>Kart tekrarı</strong><span>Biyoloji · 12 kart</span></div><span class="len">15 dk</span></div>',
    '  <div class="exam-chip"><span class="bubbles" aria-hidden="true"><span class="filled"></span><span class="filled"></span><span></span><span></span></span>Fizik yazılısına 4 gün</div>',
    '</figure>',
    '<h2>Neler yapabilirsin?</h2>',
    '<div class="features">',
    ...features.map(([title, text]) => `  <div class="card"><h3>${esc(title)}</h3><p>${esc(text)}</p></div>`),
    '</div>',
    '<div class="card exam">',
    '  <h2>Veli onayı ve gizlilik</h2>',
    '  <ul class="facts">',
    '    <li>18 yaşından küçükler için veliye e-postayla onay bağlantısı gönderilir. Onay gelene kadar yapay zekâ ve satın alma kapalıdır; 13 yaşından küçükler uygulamayı veli onayından sonra kullanmaya başlar.</li>',
    '    <li>Yapay zekâya yalnızca belgenin içeriği, sınıf seviyesi ve ders adı gider. Ad, e-posta ve doğum yılı gönderilmez.</li>',
    '    <li>Reklam yok. Reklam kimliği toplamayız, seni başka uygulamalarda takip etmeyiz.</li>',
    '    <li>Veriler Avrupa Birliği’ndeki sunucularda saklanır. Hesabını istediğin zaman uygulamadan silebilirsin.</li>',
    '  </ul>',
    `  <p><a href="${link(rel, ROUTES.gizlilik)}">Gizlilik politikası</a> · <a href="${link(rel, ROUTES.aydinlatma)}">Aydınlatma metni</a> · <a href="${link(rel, ROUTES.support)}">Veliler için destek</a></p>`,
    '</div>',
    '<h2>Ücretsiz ve Pro</h2>',
    '<p>Plan, quiz, kart tekrarı, zamanlayıcı ve ilerleme iki planda da var. Pro yalnızca her ay işleyebileceğin belge ve sayfa sayısını artırır; aylık ya da yıllık abonelikle alınır.</p>',
  ].join('\n');
  return layout(ctx, {
    route,
    title: 'StudyMark · Ders çalışma planlayıcısı',
    description:
      'Ortaokul ve lise öğrencileri için sınav tarihine göre çalışma planı, ders notundan özet, quiz ve kart, internetsiz kart tekrarı.',
    body,
  });
}

function notFoundPage(ctx: Ctx): string {
  // Served for any missing path, so asset links must be absolute.
  const base = ctx.options.baseUrl ? new URL(ctx.options.baseUrl).pathname : '/';
  const html = layout(ctx, {
    route: ROUTES.home,
    title: 'Sayfa bulunamadı · StudyMark',
    description: 'Aradığın sayfa bulunamadı.',
    body: ['<h1>Sayfa bulunamadı</h1>', '<p class="lead">Bağlantı yanlış ya da sayfa taşınmış olabilir.</p>'].join('\n'),
    noindex: true,
  });
  return html.replace(/(href)="(?!https?:|mailto:|#)([^"]*)"/g, (_m, attr: string, target: string) => {
    const resolved = target === './' ? base : `${base}${target}`;
    return `${attr}="${resolved}"`;
  });
}

// ---------------------------------------------------------------------------------------------
// Static form pages (web/consent, web/delete-account)
// ---------------------------------------------------------------------------------------------

type FormPage = {
  source: string;
  route: string;
  configName: 'STUDYFLOW_CONSENT_CONFIG' | 'STUDYFLOW_CONFIG';
  keys: readonly string[];
};

export const FORM_PAGES: FormPage[] = [
  {
    source: path.join('web', 'consent', 'index.html'),
    route: ROUTES.consent,
    configName: 'STUDYFLOW_CONSENT_CONFIG',
    keys: ['functionsUrl', 'anonKey', 'privacyUrl', 'supportEmail'],
  },
  {
    source: path.join('web', 'delete-account', 'index.html'),
    route: ROUTES.deleteAccount,
    configName: 'STUDYFLOW_CONFIG',
    keys: ['functionsUrl', 'anonKey', 'privacyUrl'],
  },
];

function replaceOnce(
  html: string,
  pattern: RegExp,
  replacement: string | ((...groups: string[]) => string),
  what: string,
): string {
  const count = [...html.matchAll(new RegExp(pattern.source, `${pattern.flags.replace('g', '')}g`))].length;
  if (count !== 1) throw new Error(`${what}: expected exactly one match, found ${count}`);
  return html.replace(pattern, (...args: string[]) =>
    typeof replacement === 'string' ? replacement : replacement(...args),
  );
}

/** A single-quoted JS string that is safe inside an inline <script>. */
function jsString(value: string): string {
  return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/</g, '\\x3C')}'`;
}

function isLocalUrl(value: string): boolean {
  try {
    return /^(localhost|127\.0\.0\.1|\[::1\])$/.test(new URL(value).hostname);
  } catch {
    return false;
  }
}

/** The page's behaviour: every script except its config block and the frame guard. */
export function behaviourScripts(html: string): string[] {
  return [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)]
    .map((match) => match[1])
    .filter((code) => !/window\.STUDYFLOW_\w*CONFIG\s*=/.test(code) && !code.includes('frame-guard'));
}

export function formPage(ctx: Ctx, page: FormPage, sourceHtml: string, functionsUrl: string | null, route: string): string {
  const rel = relPrefix(route);
  let html = sourceHtml;
  const values: Record<string, string> = {
    functionsUrl: functionsUrl ?? FUNCTIONS_PLACEHOLDER,
    anonKey: ctx.options.anonKey,
    privacyUrl: link(rel, ROUTES.aydinlatma),
    supportEmail: ctx.options.supportEmail,
  };
  for (const key of page.keys) {
    html = replaceOnce(
      html,
      new RegExp(`(\\b${key}:\\s*)'[^'\\n]*'`),
      (_match, lead) => `${lead}${jsString(values[key])}`,
      `${page.source} ${key}`,
    );
  }
  if (functionsUrl && !isLocalUrl(functionsUrl)) {
    const origin = new URL(functionsUrl).origin;
    html = replaceOnce(html, /connect-src (?:https?:\/\/[^\s;"]+ ?)+/, `connect-src ${origin}`, `${page.source} CSP connect-src`);
  }
  html = replaceOnce(html, /<!-- @site-header -->/, header(ctx, route), `${page.source} header marker`);
  html = replaceOnce(html, /<!-- @site-footer -->/, footer(ctx, route), `${page.source} footer marker`);
  html = replaceOnce(
    html,
    /<meta name="theme-color" content="#[0-9A-Fa-f]{6}" media="\(prefers-color-scheme: light\)">\s*<meta name="theme-color" content="#[0-9A-Fa-f]{6}" media="\(prefers-color-scheme: dark\)">/,
    themeColorMeta(ctx.tokens),
    `${page.source} theme-color`,
  );
  if (rel !== '../') html = html.replace(/(href|src)="\.\.\/assets\//g, `$1="${rel}assets/`);
  return html;
}

// ---------------------------------------------------------------------------------------------
// Whole site
// ---------------------------------------------------------------------------------------------

const FONT_SOURCE = path.join('node_modules', '@expo-google-fonts', 'literata');

export function buildSite(options: SiteOptions, root: string = ROOT): SiteFiles {
  const tokens = readTheme(root);
  const ctx: Ctx = { options, tokens };
  const files: SiteFiles = new Map();
  const put = (route: string, html: string) => files.set(route ? `${route}/index.html` : 'index.html', html);

  const css = fs.readFileSync(path.join(root, 'web', 'assets', 'site.css'), 'utf8');
  files.set('assets/site.css', replaceOnce(css, /\/\* @tokens \*\//, tokensCss(tokens), 'site.css tokens marker'));
  files.set('assets/fonts/literata-600.ttf', fs.readFileSync(path.join(root, FONT_SOURCE, '600SemiBold', 'Literata_600SemiBold.ttf')));
  files.set('assets/fonts/OFL.txt', fs.readFileSync(path.join(root, FONT_SOURCE, 'LICENSE_FONT')));
  files.set('assets/favicon.png', fs.readFileSync(path.join(root, 'assets', 'images', 'favicon.png')));
  files.set('assets/icon.png', fs.readFileSync(path.join(root, 'assets', 'images', 'icon.png')));

  put(ROUTES.home, homePage(ctx));
  for (const id of LEGAL_DOC_IDS) put(LEGAL_ROUTES[id], legalPage(ctx, LEGAL_DOCUMENTS[id]));
  put(ROUTES.support, supportPage(ctx));

  for (const page of FORM_PAGES) {
    const source = fs.readFileSync(path.join(root, page.source), 'utf8');
    put(page.route, formPage(ctx, page, source, options.functionsUrl, page.route));
    if (options.stagingFunctionsUrl) {
      const route = `staging/${page.route}`;
      const html = formPage(ctx, page, source, options.stagingFunctionsUrl, route);
      put(route, html.includes('name="robots"') ? html : html.replace('<head>', '<head>\n  <meta name="robots" content="noindex, nofollow">'));
    }
  }

  files.set('404.html', notFoundPage(ctx));
  const base = options.baseUrl ? new URL(options.baseUrl).pathname : '/';
  files.set(
    'robots.txt',
    ['User-agent: *', `Disallow: ${base}${ROUTES.consent}/`, `Disallow: ${base}${ROUTES.deleteAccount}/`, `Disallow: ${base}staging/`, ''].join('\n'),
  );
  return files;
}

// ---------------------------------------------------------------------------------------------
// Checks: every legal section and FAQ item is on the site, forms keep their behaviour
// ---------------------------------------------------------------------------------------------

export function verifySite(files: SiteFiles, root: string = ROOT): string[] {
  const problems: string[] = [];
  const text = (file: string): string | null => {
    const content = files.get(file);
    return typeof content === 'string' ? content : null;
  };
  const expectText = (file: string, html: string, wanted: string, what: string) => {
    if (!htmlText(html).includes(normalizeText(wanted))) problems.push(`${file}: missing ${what}: "${wanted.slice(0, 60)}"`);
  };

  for (const id of LEGAL_DOC_IDS) {
    const doc = LEGAL_DOCUMENTS[id];
    const file = `${LEGAL_ROUTES[id]}/index.html`;
    const html = text(file);
    if (!html) {
      problems.push(`${file}: page missing`);
      continue;
    }
    expectText(file, html, doc.title, 'title');
    expectText(file, html, `Sürüm ${LEGAL_VERSION}`, 'version');
    if (LEGAL_DRAFT) expectText(file, html, account.legal.draft, 'draft notice');
    for (const section of doc.sections) {
      expectText(file, html, section.heading, 'section heading');
      for (const p of section.paragraphs ?? []) expectText(file, html, p, `paragraph in "${section.heading}"`);
      for (const b of section.bullets ?? []) expectText(file, html, b, `bullet in "${section.heading}"`);
    }
  }

  const support = text(`${ROUTES.support}/index.html`);
  if (!support) problems.push('destek/index.html: page missing');
  else {
    for (const item of faqItems()) {
      expectText('destek/index.html', support, item.q, 'FAQ question');
      expectText('destek/index.html', support, item.a, 'FAQ answer');
    }
  }

  for (const page of FORM_PAGES) {
    const source = fs.readFileSync(path.join(root, page.source), 'utf8');
    const routes = [page.route, ...(files.has(`staging/${page.route}/index.html`) ? [`staging/${page.route}`] : [])];
    for (const route of routes) {
      const file = `${route}/index.html`;
      const html = text(file);
      if (!html) {
        problems.push(`${file}: page missing`);
        continue;
      }
      const before = behaviourScripts(source);
      const after = behaviourScripts(html);
      if (before.length === 0 || before.length !== after.length || before.some((code, i) => code !== after[i])) {
        problems.push(`${file}: page script differs from ${page.source}`);
      }
      if (!html.includes(`window.${page.configName} = {`)) problems.push(`${file}: config block missing`);
      if (html.includes('@site-header') || html.includes('@site-footer')) problems.push(`${file}: layout markers left`);
    }
  }

  for (const required of ['index.html', 'assets/site.css', 'assets/fonts/literata-600.ttf', '404.html']) {
    if (!files.has(required)) problems.push(`${required}: missing`);
  }
  const css = text('assets/site.css');
  if (css?.includes('/* @tokens */')) problems.push('assets/site.css: theme tokens were not filled in');
  return problems;
}

/** Differences between a fresh build and what is on disk (missing, changed, extra files). */
export function diffWithDir(files: SiteFiles, dir: string): string[] {
  const problems: string[] = [];
  if (!fs.existsSync(dir)) return [`${path.relative(ROOT, dir) || dir}: not built yet (npm run web:build)`];
  const onDisk = new Set(listFiles(dir));
  for (const [file, content] of files) {
    const target = path.join(dir, file);
    if (!onDisk.has(file)) {
      problems.push(`missing: ${file}`);
      continue;
    }
    onDisk.delete(file);
    const current = fs.readFileSync(target);
    const wanted = typeof content === 'string' ? Buffer.from(content, 'utf8') : content;
    if (!current.equals(wanted)) problems.push(`out of date: ${file}`);
  }
  for (const extra of onDisk) problems.push(`not generated by the build: ${extra}`);
  return problems;
}

export function listFiles(dir: string, prefix = ''): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...listFiles(path.join(dir, entry.name), rel));
    else out.push(rel);
  }
  return out.sort();
}

export function writeSite(files: SiteFiles, dir: string): void {
  fs.rmSync(dir, { recursive: true, force: true });
  for (const [file, content] of files) {
    const target = path.join(dir, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
  }
}

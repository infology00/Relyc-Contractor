/* ============================================================
   RELYC CONTRACTOR — static site generator
   No dependencies. Reads src/pages/*.html + src/partials/*.html
   and writes plain static HTML into site/.

   Run:  npm run build      (or: node build.mjs)
   ============================================================ */
import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const SRC = join(ROOT, 'src');
const OUT = join(ROOT, 'site');

export const SITE = {
  name: 'Relyc Contractor',
  legalName: 'Relyc Contractor Corp',
  origin: 'https://relyc.co',
  phone: '305-558-9988',
  phoneHref: '+13055589988',
  email: 'service@relyc.co',
  street: '7547 W 24th Ave, Suite 200',
  city: 'Hialeah',
  region: 'FL',
  postal: '33016',
  license: 'CGC1534523',
  uei: 'SSM2N79T1QL8',
  founded: '2012',
  // Paste the GA4 Measurement ID here (e.g. 'G-XXXXXXXXXX') and rebuild.
  // Left blank, no analytics script is emitted at all.
  ga4: ''
};

/* Primary navigation — single source of truth */
const NAV = [
  { id: 'home', short: 'Home', long: 'Home', href: 'index.html' },
  { id: 'about', short: 'About', long: 'About', href: 'about.html' },
  { id: 'services', short: 'Services', long: 'Services & Trades', href: 'services.html' },
  { id: 'process', short: 'Process', long: 'Our Process', href: 'process.html' },
  { id: 'safety', short: 'Safety', long: 'Safety & Quality', href: 'safety-quality.html' },
  { id: 'markets', short: 'Markets', long: 'Markets Served', href: 'markets.html' },
  { id: 'government', short: 'Government', long: 'Government & Certifications', href: 'government.html' },
  { id: 'contact', short: 'Contact', long: 'Request a Consultation', href: 'contact.html' }
];

const partial = (n) => readFileSync(join(SRC, 'partials', n + '.html'), 'utf8');

/* ---------- template helpers ---------- */
function fill(tpl, vars) {
  return tpl.replace(/\{\{(\w+)\}\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
}

function navHTML(active) {
  return NAV.map((n) =>
    `<a class="nav__link${n.id === active ? ' is-active' : ''}" href="${n.href}"` +
    `${n.id === active ? ' aria-current="page"' : ''}>${n.short}</a>`
  ).join('\n          ');
}

function drawerHTML(active) {
  return NAV.map((n, i) =>
    `<a class="drawer__link${n.id === active ? ' is-active' : ''}" href="${n.href}"` +
    `${n.id === active ? ' aria-current="page"' : ''}>` +
    `<span class="n">${String(i + 1).padStart(2, '0')}</span>${n.long}</a>`
  ).join('\n            ');
}

function footerNavHTML() {
  return NAV.map((n) => `<li><a href="${n.href}">${n.long}</a></li>`).join('\n              ');
}

/* ---------- structured data ---------- */
function jsonLd(meta) {
  const org = {
    '@context': 'https://schema.org',
    '@type': 'GeneralContractor',
    '@id': SITE.origin + '/#organization',
    name: SITE.name,
    legalName: SITE.legalName,
    url: SITE.origin + '/',
    telephone: SITE.phone,
    email: SITE.email,
    foundingDate: SITE.founded,
    image: SITE.origin + '/assets/img/og-default.jpg',
    logo: SITE.origin + '/assets/img/logo-relyc.svg',
    description:
      'Licensed Florida general contractor delivering industrial, commercial and government construction ' +
      'under single-source accountability. Based in Hialeah, serving Miami-Dade, Broward and Palm Beach.',
    address: {
      '@type': 'PostalAddress',
      streetAddress: SITE.street,
      addressLocality: SITE.city,
      addressRegion: SITE.region,
      postalCode: SITE.postal,
      addressCountry: 'US'
    },
    areaServed: [
      { '@type': 'AdministrativeArea', name: 'Miami-Dade County' },
      { '@type': 'AdministrativeArea', name: 'Broward County' },
      { '@type': 'AdministrativeArea', name: 'Palm Beach County' },
      { '@type': 'AdministrativeArea', name: 'Southeastern United States' }
    ],
    hasCredential: 'Florida State General Contractor License ' + SITE.license,
    knowsAbout: [
      'Ground-up construction', 'Tenant improvements', 'Facilities maintenance',
      'Building envelope and roofing', 'Government construction procurement'
    ]
  };

  const crumbs = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Home', item: SITE.origin + '/' }]
  };
  if (meta.slug !== 'index') {
    crumbs.itemListElement.push({
      '@type': 'ListItem', position: 2, name: meta.h1 || meta.navLong || meta.title,
      item: SITE.origin + '/' + meta.slug + '.html'
    });
  }

  const blocks = [org, crumbs];
  if (meta.slug === 'index') {
    blocks.push({
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      url: SITE.origin + '/',
      name: SITE.name,
      publisher: { '@id': SITE.origin + '/#organization' }
    });
  }
  return blocks
    .map((b) => `<script type="application/ld+json">${JSON.stringify(b)}</script>`)
    .join('\n  ');
}

/* ---------- page assembly ---------- */
function buildPage(file) {
  const raw = readFileSync(join(SRC, 'pages', file), 'utf8');
  const m = raw.match(/^<!--([\s\S]*?)-->/);
  if (!m) throw new Error('Missing front-matter comment in ' + file);
  const meta = JSON.parse(m[1]);
  const body = raw.slice(m[0].length).trim();

  const navEntry = NAV.find((n) => n.id === meta.nav);
  meta.navLong = navEntry ? navEntry.long : '';

  const canonical =
    SITE.origin + (meta.slug === 'index' ? '/' : '/' + meta.slug + '.html');

  const ogImage = SITE.origin + '/assets/img/' + (meta.ogImage || 'og-default.jpg');

  const preload = (meta.preload || [])
    // crossorigin belongs on font preloads only; on same-origin images it
    // makes the browser discard the preload and fetch the file twice.
    .map((p) => `<link rel="preload" href="${p.href}" as="${p.as}"${p.type ? ` type="${p.type}"` : ''}${p.as === 'font' ? ' crossorigin' : ''}${p.as === 'image' ? ' fetchpriority="high"' : ''}>`)
    .join('\n  ');

  const scripts = (meta.scripts || [])
    .map((s) => `<script src="assets/js/${s}" defer></script>`)
    .join('\n  ');

  const analytics = SITE.ga4
    ? `<script async src="https://www.googletagmanager.com/gtag/js?id=${SITE.ga4}"></script>
  <script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${SITE.ga4}');</script>`
    : '<!-- GA4: set SITE.ga4 in build.mjs and rebuild to enable analytics -->';

  const vars = {
    TITLE: meta.title,
    DESCRIPTION: meta.description,
    KEYWORDS: (meta.keywords || []).join(', '),
    CANONICAL: canonical,
    OG_IMAGE: ogImage,
    OG_TYPE: meta.slug === 'index' ? 'website' : 'article',
    PRELOAD: preload,
    SCRIPTS: scripts,
    ANALYTICS: analytics,
    JSONLD: jsonLd(meta),
    BODY_CLASS: meta.bodyClass || '',
    NAV: navHTML(meta.nav),
    DRAWER_NAV: drawerHTML(meta.nav),
    FOOTER_NAV: footerNavHTML(),
    PHONE: SITE.phone,
    PHONE_HREF: SITE.phoneHref,
    EMAIL: SITE.email,
    STREET: SITE.street,
    CITY: SITE.city,
    REGION: SITE.region,
    POSTAL: SITE.postal,
    LICENSE: SITE.license,
    UEI: SITE.uei,
    SITE_NAME: SITE.name,
    LEGAL_NAME: SITE.legalName
  };

  // Page bodies may reference site variables too, so fill them first.
  vars.CONTENT = fill(body, vars);

  const html = fill(partial('layout'), {
    ...vars,
    HEADER: fill(partial('header'), vars),
    FOOTER: fill(partial('footer'), vars),
    PRELOADER: meta.preloader === false ? '' : fill(partial('preloader'), vars)
  });

  writeFileSync(join(OUT, meta.slug + '.html'), html, 'utf8');
  return { slug: meta.slug, canonical, priority: meta.priority || 0.6, noindex: !!meta.noindex };
}

/* ---------- sitemap + robots ---------- */
function writeSitemap(pages) {
  const today = new Date().toISOString().slice(0, 10);
  const urls = pages
    .filter((p) => !p.noindex)
    .sort((a, b) => b.priority - a.priority)
    .map(
      (p) =>
        `  <url><loc>${p.canonical}</loc><lastmod>${today}</lastmod>` +
        `<changefreq>monthly</changefreq><priority>${p.priority.toFixed(1)}</priority></url>`
    )
    .join('\n');
  writeFileSync(
    join(OUT, 'sitemap.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
    'utf8'
  );
  writeFileSync(
    join(OUT, 'robots.txt'),
    `User-agent: *\nAllow: /\n\nSitemap: ${SITE.origin}/sitemap.xml\n`,
    'utf8'
  );
}

/* ---------- run ---------- */
if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });
const files = readdirSync(join(SRC, 'pages')).filter((f) => f.endsWith('.html'));
const built = files.map(buildPage);
writeSitemap(built);
console.log(`Built ${built.length} pages -> site/`);
built.forEach((p) => console.log('  · ' + p.slug + '.html'));

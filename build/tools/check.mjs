/* Static integrity check over the built site: broken links, missing assets,
   unresolved template vars, heading order, alt text, label association. */
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const pages = readdirSync(SITE).filter((f) => f.endsWith('.html'));
let errors = 0, warnings = 0;
const err = (p, m) => { console.log(`  ERROR  [${p}] ${m}`); errors++; };
const warn = (p, m) => { console.log(`  warn   [${p}] ${m}`); warnings++; };

const attr = (tag, name) => {
  const m = tag.match(new RegExp(`${name}\\s*=\\s*"([^"]*)"`, 'i'));
  return m ? m[1] : null;
};

for (const page of pages) {
  const html = readFileSync(join(SITE, page), 'utf8');

  // 1. Unresolved template variables
  const vars = html.match(/\{\{[A-Z_]+\}\}/g);
  if (vars) err(page, `unresolved template vars: ${[...new Set(vars)].join(', ')}`);

  // 2. Internal links + asset references resolve on disk
  const refs = [...html.matchAll(/(?:href|src)\s*=\s*"([^"]+)"/gi)].map((m) => m[1]);
  for (const ref of refs) {
    if (/^(https?:|mailto:|tel:|data:|#|\/\/)/i.test(ref)) continue;
    const clean = ref.split('#')[0].split('?')[0];
    if (!clean) continue;
    const target = clean.startsWith('/') ? join(SITE, clean) : resolve(SITE, clean);
    if (!existsSync(target)) err(page, `missing target: ${ref}`);
  }

  // 3. Exactly one <h1>
  const h1s = html.match(/<h1[\s>]/g) || [];
  if (h1s.length !== 1) err(page, `expected 1 <h1>, found ${h1s.length}`);

  // 4. Images need alt (empty alt is fine for decorative)
  for (const tag of html.match(/<img\b[^>]*>/gi) || []) {
    if (!/\balt\s*=/.test(tag)) err(page, `<img> without alt: ${tag.slice(0, 90)}`);
    if (!/\bwidth\s*=/.test(tag) || !/\bheight\s*=/.test(tag)) {
      warn(page, `<img> without width/height (layout shift risk): ${(attr(tag, 'src') || '').slice(0, 60)}`);
    }
  }

  // 5. Every form control has a matching label / accessible name
  const ids = new Set([...html.matchAll(/<label[^>]*\bfor\s*=\s*"([^"]+)"/gi)].map((m) => m[1]));
  for (const tag of html.match(/<(?:input|select|textarea)\b[^>]*>/gi) || []) {
    const type = (attr(tag, 'type') || '').toLowerCase();
    if (type === 'hidden' || type === 'submit') continue;
    const id = attr(tag, 'id');
    const name = attr(tag, 'name') || '';
    if (name.startsWith('_')) continue;                 // honeypot, wrapped in its own label
    if (!id || !ids.has(id)) err(page, `control without associated label: ${tag.slice(0, 80)}`);
  }

  // 6. Meta essentials
  if (!/<meta name="description" content="[^"]{50,}"/.test(html)) warn(page, 'description missing or under 50 chars');
  const title = (html.match(/<title>([^<]*)<\/title>/) || [])[1] || '';
  if (title.length > 70) warn(page, `title ${title.length} chars (>70 may truncate in SERPs)`);
  if (!/rel="canonical"/.test(html)) err(page, 'missing canonical');
  if (!/property="og:image"/.test(html)) err(page, 'missing og:image');

  // 7. aria-controls must point at a real id
  const realIds = new Set([...html.matchAll(/\bid\s*=\s*"([^"]+)"/gi)].map((m) => m[1]));
  for (const m of html.matchAll(/aria-controls\s*=\s*"([^"]+)"/gi)) {
    if (!realIds.has(m[1])) err(page, `aria-controls points at missing id: ${m[1]}`);
  }
}

// 8. Frame sequences match what the markup declares
const index = readFileSync(join(SITE, 'index.html'), 'utf8');
for (const m of index.matchAll(/data-src="([^"]+)"[\s\S]{0,120}?data-frames-w="(\d+)"\s+data-frames-m="(\d+)"/g)) {
  const [, base, w, mob] = m;
  for (const [tier, n] of [['w', +w], ['m', +mob]]) {
    const dir = join(SITE, base, tier);
    if (!existsSync(dir)) { err('index.html', `frame dir missing: ${base}/${tier}`); continue; }
    const files = readdirSync(dir).filter((f) => f.endsWith('.webp'));
    if (files.length !== n) err('index.html', `${base}/${tier}: markup declares ${n} frames, ${files.length} on disk`);
    const last = join(dir, String(n).padStart(3, '0') + '.webp');
    if (!existsSync(last)) err('index.html', `${base}/${tier}: last frame ${n} missing`);
  }
}

// 9. Weight budget
const dirSize = (d) => readdirSync(d).reduce((s, f) => {
  const p = join(d, f); const st = statSync(p);
  return s + (st.isDirectory() ? dirSize(p) : st.size);
}, 0);
const kb = (n) => Math.round(n / 1024) + ' KB';
console.log('\nPayload:');
console.log('  desktop frames :', kb(['act1', 'act2', 'act3'].reduce((s, a) => s + dirSize(join(SITE, 'assets/frames', a, 'w')), 0)));
console.log('  mobile frames  :', kb(['act1', 'act2', 'act3'].reduce((s, a) => s + dirSize(join(SITE, 'assets/frames', a, 'm')), 0)));
console.log('  act1 desktop   :', kb(dirSize(join(SITE, 'assets/frames/act1/w'))), '(gates the preloader)');
console.log('  fonts          :', kb(dirSize(join(SITE, 'assets/fonts'))));
console.log('  js + vendor    :', kb(dirSize(join(SITE, 'assets/js')) + dirSize(join(SITE, 'assets/vendor'))));
console.log('  css            :', kb(dirSize(join(SITE, 'assets/css'))));

console.log(`\n${errors} error(s), ${warnings} warning(s) across ${pages.length} pages.`);
process.exit(errors ? 1 : 0);

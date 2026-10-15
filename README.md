# Relyc Contractor — Website

Static multi-page site for **Relyc Contractor Corp**, with a scroll-scrubbed
three-act film on the home page. No framework, no build dependencies — the
generator and tooling are plain Node scripts.

---

## Quick start

```bash
npm run dev
```

Builds the HTML and serves the repo root at <http://localhost:4173>.

| Script | What it does |
| --- | --- |
| `npm run build` | Generates the root `*.html` + `sitemap.xml` + `robots.txt` from `build/src/` |
| `npm run serve` | Static preview server on port 4173 |
| `npm run check` | Integrity check: broken links, missing assets, labels, alt text, meta, frame counts |
| `npm run frames` | Re-extracts the scroll-film frames from `videos/` (needs ffmpeg) |
| `npm run icons` | Regenerates favicon / touch icons from the vector mark |
| `npm run og` | Rebuilds the social share image (needs ffmpeg) |

**Deploy (GitHub Pages):** push this folder as the repo, then Settings → Pages → *Deploy from a branch* → `main` / `(root)`.
`index.html` is at the root, so it works as-is. Any other static host: upload the whole folder.

---

## Structure

```
index.html, about.html …   BUILT PAGES — live at the repo root so GitHub Pages serves them
assets/                    CSS, JS, fonts, images, docs
  assets/frames/           Scroll-film frame sequences (act1/act2/act3 × w|m)
  assets/fonts/            Self-hosted variable fonts (Archivo, Inter, JetBrains Mono)
  assets/vendor/           GSAP + ScrollTrigger + Lenis (pinned versions, self-hosted)
.nojekyll                  Tells GitHub Pages to serve files as-is
build/build.mjs            Generator + site config (phone, address, UEI, GA4 id, nav)
build/src/partials/        layout · header · footer · preloader  (edit once, applies everywhere)
build/src/pages/           One file per page: JSON front-matter + body HTML
build/tools/               Preview server, integrity check, asset generation scripts
```

Edit pages in `build/src/pages/`, **not** the root `*.html` — the build overwrites them.

### Adding or renaming a page

1. Add `build/src/pages/<slug>.html` with a front-matter comment (copy an existing one).
2. If it belongs in the main nav, add it to the `NAV` array in `build/build.mjs`.
3. `npm run build`.

Header, footer, drawer, breadcrumbs and sitemap all follow from those two places.

---

## Design system

| Role | Value |
| --- | --- |
| Base | Graphite `#05070A` → `#243141` |
| Paper | Warm off-white `#F6F5F2` |
| Accent | Safety amber `#E39B26` (CTAs, highlights) |
| Secondary | Steel blue `#2C6EA4` (eyebrows, links on light) |
| Display | **Archivo** variable — uppercase, expanded width axis |
| Body | **Inter** variable |
| Data / eyebrows | **JetBrains Mono** — spec-sheet labels, license numbers, stats |

The brief specified a colour theme by reference but did not include one, so the
palette is derived from the brief's own annotation legend — blue for authority,
amber for attention, grey for structure — recast as an industrial contractor
palette. All tokens live at the top of `assets/css/main.css`; change them
there and the whole site follows.

---

## The scroll film

The home page runs three scroll-scrubbed acts, each backed by one source clip:

| Act | Clip | Narrative |
| --- | --- | --- |
| I | `Building_construction_transforma…` | **We Build** — hero, single-source accountability |
| II | `Creating_home_renovation_transfo…` | **We Transform** — renovations & tenant improvements |
| III | `Technicians_repairing_and_mainta…` | **We Maintain** — facilities, safety record |

**Why frame sequences and not `<video>`:** scrubbing `video.currentTime` stalls
badly on iOS Safari and stutters wherever the GOP is long. Decoded stills always
land on the exact frame the scroll position asks for.

Each act is a tall section whose `.film__stage` is `position: sticky`. Scroll
progress drives a canvas `drawImage` through the sequence, with text panels
cross-fading over it on the same range.

**Scrub speed** is deliberately slow, per the brief. Act I spends 460 vh of
scroll on 80 frames — roughly 45–55 px of scrolling per frame, so each frame
holds long enough to read. To retune:

- `data-length` on the section (in `svh`) — higher = slower.
- `scrub: 1.1` in `film.js` — the inertia after the wheel stops.
- Panel timing via `data-from` / `data-to` (0–100 across the act).

### Payload and loading

| | Desktop (`w`, 800×450) | Mobile (`m`, 480×270) |
| --- | --- | --- |
| Act I | 80 frames · 1.6 MB | 48 frames · 590 KB |
| Act II | 64 frames · 1.3 MB | 40 frames · 480 KB |
| Act III | 64 frames · 1.3 MB | 40 frames · 475 KB |
| **Total** | **~3.9 MB** | **~1.3 MB** |

Only one tier ever loads, chosen at 800 px. **The preloader gates on Act I
only** (~1.6 MB); Acts II and III stream in behind it at low concurrency while
the visitor reads the hero, so entry is fast without ever showing an unloaded
frame. A partially-loaded act paints its nearest decoded frame, and a 9-second
ceiling means a stalled asset can never trap a visitor on the loading screen.

**Automatic fallbacks** — the film degrades to a static poster with stacked,
fully readable panels when: `prefers-reduced-motion` is set, the connection
reports `save-data` or 2G, JavaScript fails, or GSAP does not load.

### Replacing the videos

Drop new clips in `videos/`, update the three paths at the top of
`build/tools/extract-frames.sh`, then `npm run frames`. Frame counts are set in that
script and must match `data-frames-w` / `data-frames-m` in
`build/src/pages/index.html` — `npm run check` verifies they agree.

---

## Wiring up before launch

### 1. Forms → email / CRM

All four forms (consultation, capability statement, subcontractor registration)
work today with **no backend**: they validate, then open the visitor's mail
client with the fields pre-filled to `service@relyc.co`.

For real server-side capture, add one attribute — no JS changes:

```html
<form class="form" data-form data-endpoint="https://your-endpoint">
```

The form POSTs JSON of all named fields. Any endpoint accepting JSON works
(Formspree, Netlify Forms, Zapier/Make webhook, or a CRM intake URL). A hidden
honeypot field (`_company_website`) silently discards bot submissions.

> **Note on file uploads:** the subcontractor form's Capability Statement and COI
> fields currently submit *file names* only, since JSON POST cannot carry binary.
> Wiring real uploads needs an endpoint accepting `multipart/form-data` — worth
> settling in the lead-capture working session the brief flags.

### 2. Analytics

Put the GA4 Measurement ID in `build/build.mjs` (`SITE.ga4 = 'G-XXXXXXXXXX'`) and
rebuild. Left blank, **no analytics script is emitted at all**. Then verify in
Google Search Console (`sitemap.xml` is generated automatically) and link the
Google Business Profile.

### 3. Domain

`SITE.origin` in `build/build.mjs` is `https://relyc.co` — it drives canonicals, Open
Graph URLs, JSON-LD and the sitemap. Change it there if the domain changes.

### 4. Hosting

`_headers` (Netlify / Cloudflare Pages) and `.htaccess` (Apache) ship
with caching and security headers: frames and fonts immutable for a year, HTML
always revalidated.

---

## Still needed from the client

These are marked **in the page itself** with an amber dashed "Needs input" flag,
so nothing ships silently wrong. Search the built HTML for `class="pending"` to
find every one.

| Item | Where |
| --- | --- |
| Real stat figures (5M+ SF, 100% on-time, 1,000s projects) | Home, About |
| Past client names + permission to display | Home — currently placeholder names |
| UEI number · CAGE code · NAICS codes | Government & Certifications |
| Capability Statement PDF | `assets/docs/relyc-capability-statement.pdf` — placeholder in place so the gated download works end to end |
| Leadership bios | About — grid is built and `hidden`; remove the attribute once supplied |
| Founding story / milestones | About |
| Legal review of Privacy, Terms, Accessibility | Those three pages |
| Logo files | A vector mark is in place (`assets/img/logo-relyc.svg`, favicons, OG card). Swap if the supplied logo differs. |
| Testimonials | Module not built — no content was available |

**Deliberately excluded per the brief:** no veteran-owned language anywhere; no
EMR reference on Safety & Quality; no bonding amounts or insurance limits
published.

---

## Accessibility & compatibility

Keyboard-operable throughout with visible focus and a skip link; landmark
regions and one `h1` per page; `aria-expanded` on accordions and the menu;
decorative graphics hidden from assistive tech; reduced-motion honoured; and
every page still renders and reads with JavaScript disabled — including all
home-page film copy. `npm run check` enforces labels, alt text, `aria-controls`
targets and link integrity on every build.

### One implementation note worth keeping

`html`/`body` use `overflow-x: clip`, **not** `overflow-x: hidden`. `hidden`
turns the element into a scroll container, which silently breaks every
`position: sticky` descendant — i.e. all three film stages — and throws off
ScrollTrigger's scroller detection. If horizontal overflow ever needs
suppressing again, keep it as `clip`.

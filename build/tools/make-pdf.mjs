/* Minimal placeholder capability statement so the gated download flow
   is testable end to end. Replace assets/docs/relyc-capability-statement.pdf
   with the client's approved one-pager before launch. */
import { writeFileSync } from 'node:fs';

const lines = [
  ['H1', 'RELYC CONTRACTOR CORP'],
  ['H2', 'CAPABILITY STATEMENT  -  PLACEHOLDER'],
  ['GAP', ''],
  ['B', 'THIS IS A PLACEHOLDER DOCUMENT'],
  ['P', 'Replace this file with the approved one-page capability statement.'],
  ['P', 'Path: assets/docs/relyc-capability-statement.pdf'],
  ['GAP', ''],
  ['B', 'COMPANY DATA'],
  ['P', 'Relyc Contractor Corp  -  Family-owned Florida General Contractor, est. 2012'],
  ['P', '7547 W 24th Ave, Suite 200, Hialeah, FL 33016'],
  ['P', '305-558-9988  -  service@relyc.co  -  relyc.co'],
  ['GAP', ''],
  ['B', 'LICENSE & REGISTRATIONS'],
  ['P', 'FL State General Contractor  -  CGC1534523'],
  ['P', 'SAM Registered  -  UEI: SSM2N79T1QL8  -  CAGE: [to be supplied]'],
  ['P', 'NAICS Codes: [to be supplied]'],
  ['GAP', ''],
  ['B', 'CERTIFICATIONS'],
  ['P', 'FL State Minority Business Certification'],
  ['P', 'Miami-Dade County Small Business Enterprise (SBE)'],
  ['P', 'Licensed, Bonded & Insured'],
  ['GAP', ''],
  ['B', 'CORE COMPETENCIES'],
  ['P', 'Ground-Up / New Construction'],
  ['P', 'Renovations, Remodels & Tenant Improvements'],
  ['P', 'Facilities Repair, Maintenance & Emergency Response'],
  ['P', 'Building Envelope & Roofing'],
  ['P', 'Site Work & Structural'],
  ['GAP', ''],
  ['B', 'DIFFERENTIATORS'],
  ['P', 'Single-source accountability  -  one contractor for the entire project'],
  ['P', 'Self-performed general labor and supervision for quality control'],
  ['P', 'Speed and responsiveness  -  local, licensed, responsive'],
  ['P', 'Zero accidents, injuries or fault losses across our projects'],
  ['GAP', ''],
  ['B', 'MARKETS SERVED'],
  ['P', 'Healthcare / Institutional  -  Education / Schools  -  Industrial / Warehouse'],
  ['P', 'Retail / Commercial  -  Government / Municipal'],
  ['GAP', ''],
  ['B', 'SERVICE AREA'],
  ['P', 'Miami-Dade, Broward and Palm Beach counties.'],
  ['P', 'Southeast US on a per-project, as-needed basis.']
];

const esc = (s) => s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');

let y = 780;
let content = '';
for (const [kind, text] of lines) {
  if (kind === 'GAP') { y -= 10; continue; }
  const font = kind === 'P' ? '/F1' : '/F2';
  const size = kind === 'H1' ? 20 : kind === 'H2' ? 12 : kind === 'B' ? 11 : 10;
  const color = kind === 'H1' ? '0.89 0.61 0.15' : kind === 'B' ? '0.17 0.43 0.64' : '0.15 0.15 0.15';
  content += `BT ${color} rg ${font} ${size} Tf 56 ${y} Td (${esc(text)}) Tj ET\n`;
  y -= kind === 'H1' ? 26 : kind === 'H2' ? 22 : kind === 'B' ? 18 : 15;
}
content = `0.02 0.03 0.04 rg 0 812 612 30 re f\n` + content;

const objs = [
  '<< /Type /Catalog /Pages 2 0 R >>',
  '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
  '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 4 0 R >>',
  `<< /Length ${content.length} >>\nstream\n${content}endstream`,
  '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>'
];

let pdf = '%PDF-1.4\n';
const offsets = [];
objs.forEach((o, i) => {
  offsets.push(pdf.length);
  pdf += `${i + 1} 0 obj\n${o}\nendobj\n`;
});
const xref = pdf.length;
pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
offsets.forEach((o) => { pdf += String(o).padStart(10, '0') + ' 00000 n \n'; });
pdf += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;

writeFileSync(process.argv[2], pdf, 'latin1');
console.log('placeholder PDF written:', process.argv[2]);

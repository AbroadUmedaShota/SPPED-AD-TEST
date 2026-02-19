/**
 * generate_sv_0003_26010_bizcards.js
 * sv_0003_26010 の名刺画像 (SVG) を生成し、
 * business-cards JSON の imageUrl を {front, back} オブジェクト形式に更新する。
 */

const fs = require('fs');
const path = require('path');

const BASE_DIR = path.join(__dirname, '..');
const BC_PATH = path.join(BASE_DIR, 'data/responses/business-cards/sv_0003_26010.json');
const OUT_DIR = path.join(BASE_DIR, 'media/generated/sv_0003_26010/bizcard');
const SURVEY_ID = 'sv_0003_26010';

// ---- SVG テンプレート関数 ----
const CARD_COLORS = [
    { bg: '#1a1a2e', accent: '#e94560', text: '#ffffff', sub: '#a0a0b0' },
    { bg: '#0f3460', accent: '#e94560', text: '#ffffff', sub: '#a0a0c0' },
    { bg: '#16213e', accent: '#0f3460', text: '#ffffff', sub: '#7f8c8d' },
    { bg: '#2d3436', accent: '#00b894', text: '#ffffff', sub: '#b2bec3' },
    { bg: '#6c5ce7', accent: '#fdcb6e', text: '#ffffff', sub: '#dfe6e9' },
    { bg: '#00b894', accent: '#00cec9', text: '#ffffff', sub: '#dfe6e9' },
    { bg: '#e17055', accent: '#fdcb6e', text: '#ffffff', sub: '#dfe6e9' },
    { bg: '#2c3e50', accent: '#3498db', text: '#ffffff', sub: '#bdc3c7' },
];

function frontSvg(bc, index) {
    const color = CARD_COLORS[index % CARD_COLORS.length];
    const company = bc.group3?.companyName || '会社名';
    const dept = bc.group3?.department || '';
    const position = bc.group3?.position || '';
    const lastName = bc.group2?.lastName || '';
    const firstName = bc.group2?.firstName || '';
    const fullName = `${lastName} ${firstName}`.trim();
    const email = bc.group1?.email || '';
    const tel = bc.group5?.tel1 || '';

    // エスケープ
    const esc = s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

    return `<svg xmlns="http://www.w3.org/2000/svg" width="550" height="300" viewBox="0 0 550 300">
  <rect width="550" height="300" fill="${color.bg}" rx="6"/>
  <!-- accent bar -->
  <rect x="0" y="0" width="8" height="300" fill="${color.accent}" rx="3"/>
  <!-- company -->
  <text x="30" y="55" font-family="sans-serif" font-size="16" fill="${color.sub}" font-weight="bold">${esc(company)}</text>
  <text x="30" y="80" font-family="sans-serif" font-size="12" fill="${color.sub}">${esc(dept)}　${esc(position)}</text>
  <!-- name -->
  <text x="30" y="145" font-family="sans-serif" font-size="34" fill="${color.text}" font-weight="bold">${esc(lastName)}</text>
  <text x="30" y="180" font-family="sans-serif" font-size="24" fill="${color.text}">${esc(firstName)}</text>
  <!-- divider -->
  <line x1="30" y1="200" x2="520" y2="200" stroke="${color.accent}" stroke-width="1" opacity="0.4"/>
  <!-- contact -->
  <text x="30" y="225" font-family="sans-serif" font-size="12" fill="${color.sub}">${esc(email)}</text>
  <text x="30" y="248" font-family="sans-serif" font-size="12" fill="${color.sub}">${esc(tel)}</text>
  <!-- seq badge -->
  <text x="510" y="285" font-family="monospace" font-size="10" fill="${color.sub}" text-anchor="end" opacity="0.5">#${String(index + 1).padStart(4, '0')}</text>
</svg>`;
}

function backSvg(bc, index) {
    const color = CARD_COLORS[index % CARD_COLORS.length];
    const company = bc.group3?.companyName || '会社名';
    const url = bc.group6?.url || '';
    const addr1 = bc.group4?.address1 || '';
    const esc = s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

    return `<svg xmlns="http://www.w3.org/2000/svg" width="550" height="300" viewBox="0 0 550 300">
  <rect width="550" height="300" fill="${color.bg}" rx="6" opacity="0.85"/>
  <!-- pattern -->
  <circle cx="500" cy="50"  r="120" fill="${color.accent}" opacity="0.07"/>
  <circle cx="50"  cy="250" r="100" fill="${color.accent}" opacity="0.07"/>
  <!-- company center -->
  <text x="275" y="130" font-family="sans-serif" font-size="22" fill="${color.text}" font-weight="bold" text-anchor="middle">${esc(company)}</text>
  <line x1="100" y1="150" x2="450" y2="150" stroke="${color.accent}" stroke-width="1" opacity="0.4"/>
  <text x="275" y="185" font-family="sans-serif" font-size="13" fill="${color.sub}" text-anchor="middle">${esc(addr1)}</text>
  <text x="275" y="210" font-family="sans-serif" font-size="12" fill="${color.sub}" text-anchor="middle">${esc(url)}</text>
  <!-- back label -->
  <text x="275" y="270" font-family="sans-serif" font-size="10" fill="${color.sub}" text-anchor="middle" opacity="0.4">裏面</text>
</svg>`;
}

// ---- ファイル生成 ----
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const bcData = JSON.parse(fs.readFileSync(BC_PATH, 'utf-8'));
const updated = bcData.map((item, index) => {
    const bc = item.businessCard;
    const seq = String(index + 1).padStart(4, '0');
    const frontFile = `${SURVEY_ID}_${seq}_1.svg`;
    const backFile = `${SURVEY_ID}_${seq}_2.svg`;

    fs.writeFileSync(path.join(OUT_DIR, frontFile), frontSvg(bc, index), 'utf-8');
    fs.writeFileSync(path.join(OUT_DIR, backFile), backSvg(bc, index), 'utf-8');

    return {
        ...item,
        businessCard: {
            ...bc,
            imageUrl: {
                front: `../media/generated/${SURVEY_ID}/bizcard/${frontFile}`,
                back: `../media/generated/${SURVEY_ID}/bizcard/${backFile}`
            }
        }
    };
});

fs.writeFileSync(BC_PATH, JSON.stringify(updated, null, 2), 'utf-8');
console.log(`✅ ${updated.length} 件の名刺画像を生成しました: ${OUT_DIR}`);
console.log(`✅ business-cards JSON を imageUrl {front, back} 形式に更新しました`);

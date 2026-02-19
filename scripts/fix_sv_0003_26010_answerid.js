/**
 * fix_sv_0003_26010_answerid.js
 * sv_0003_26010 の business-cards と answers の answerId を
 * ans-sv_0003_26010-XXXXX 形式に更新する。
 */

const fs = require('fs');
const path = require('path');

const BASE_DIR = path.join(__dirname, '..');
const BC_PATH = path.join(BASE_DIR, 'data/responses/business-cards/sv_0003_26010.json');
const ANS_PATH = path.join(BASE_DIR, 'data/responses/answers/sv_0003_26010.json');

// -------- business-cards の answerId 更新 --------
const bcRaw = JSON.parse(fs.readFileSync(BC_PATH, 'utf-8'));
const convertedBc = bcRaw.map((item, index) => {
    const seq = String(index + 1).padStart(5, '0');
    return { ...item, answerId: `ans-sv_0003_26010-${seq}` };
});
fs.writeFileSync(BC_PATH, JSON.stringify(convertedBc, null, 2), 'utf-8');
console.log(`✅ business-cards answerId を更新しました: ${BC_PATH} (${convertedBc.length} 件)`);

// -------- answers の answerId 更新 --------
const ansRaw = JSON.parse(fs.readFileSync(ANS_PATH, 'utf-8'));
const answersArr = Array.isArray(ansRaw) ? ansRaw : (ansRaw.answers || []);
const convertedAns = answersArr.map((item, index) => {
    const seq = String(index + 1).padStart(5, '0');
    return { ...item, answerId: `ans-sv_0003_26010-${seq}` };
});
const output = { surveyId: 'sv_0003_26010', answers: convertedAns };
fs.writeFileSync(ANS_PATH, JSON.stringify(output, null, 2), 'utf-8');
console.log(`✅ answers answerId を更新しました: ${ANS_PATH} (${convertedAns.length} 件)`);

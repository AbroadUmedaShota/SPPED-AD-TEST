/**
 * fix_sv_0003_26010_data.js
 * sv_0003_26010 の business-cards データを他アンケートと同じ group2/group3 形式に変換する。
 * answerId も sv26010-XXXXX 形式に統一する。
 */

const fs = require('fs');
const path = require('path');

const BASE_DIR = path.join(__dirname, '..');
const BC_PATH = path.join(BASE_DIR, 'data/responses/business-cards/sv_0003_26010.json');
const ANS_PATH = path.join(BASE_DIR, 'data/responses/answers/sv_0003_26010.json');

// --------  business-cards 変換 --------
const bcRaw = JSON.parse(fs.readFileSync(BC_PATH, 'utf-8'));

const convertedBc = bcRaw.map((item, index) => {
    const bc = item.businessCard;
    const seq = String(index + 1).padStart(5, '0');
    const answerId = `sv26010-${seq}`;

    // name を lastName / firstName に分割（スペース区切り）
    const nameParts = (bc.name || '').split(' ');
    const lastName = nameParts[0] || '';
    const firstName = nameParts.slice(1).join(' ') || '';

    return {
        answerId,
        businessCard: {
            group1: {
                email: bc.email || ''
            },
            group2: {
                lastName,
                firstName
            },
            group3: {
                companyName: bc.companyName || '',
                department: bc.department || '',
                position: bc.position || ''
            },
            group4: {
                postalCode: '',
                address1: bc.address || '',
                address2: ''
            },
            group5: {
                mobile: '',
                tel1: bc.phone || '',
                fax: ''
            },
            group6: {
                url: ''
            },
            status: bc.status || 'done',
            imageUrl: bc.imageUrl || ''
        }
    };
});

fs.writeFileSync(BC_PATH, JSON.stringify(convertedBc, null, 2), 'utf-8');
console.log(`✅ business-cards を変換しました: ${BC_PATH}`);

// --------  answers の answerId を統一 --------
const ansRaw = JSON.parse(fs.readFileSync(ANS_PATH, 'utf-8'));
const answersArr = Array.isArray(ansRaw) ? ansRaw : (ansRaw.answers || []);

const convertedAns = answersArr.map((item, index) => {
    const seq = String(index + 1).padStart(5, '0');
    const answerId = `sv26010-${seq}`;
    return { ...item, answerId };
});

// ファイルのフォーマット（旧 csv ラップ形式に合わせてオブジェクトとして保存）
const output = {
    surveyId: 'sv_0003_26010',
    answers: convertedAns
};

fs.writeFileSync(ANS_PATH, JSON.stringify(output, null, 2), 'utf-8');
console.log(`✅ answers の answerId を変換しました: ${ANS_PATH}`);
console.log(`   変換件数: ${convertedAns.length} 件`);

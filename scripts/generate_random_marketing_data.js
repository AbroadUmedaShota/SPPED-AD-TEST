const fs = require('fs');
const path = require('path');

const SURVEY_ID = 'sv_0003_26010';
const OUTPUT_DIR_ANSWERS = path.join(__dirname, '../data/responses/answers');
const OUTPUT_DIR_BIZCARDS = path.join(__dirname, '../data/responses/business-cards');

// Create directories if not exist
if (!fs.existsSync(OUTPUT_DIR_ANSWERS)) fs.mkdirSync(OUTPUT_DIR_ANSWERS, { recursive: true });
if (!fs.existsSync(OUTPUT_DIR_BIZCARDS)) fs.mkdirSync(OUTPUT_DIR_BIZCARDS, { recursive: true });

// Data Helpers
const LAST_NAMES = ['佐藤', '鈴木', '高橋', '田中', '伊藤', '渡辺', '山本', '中村', '小林', '加藤', '吉田', '山田', '佐々木', '山口', '松本', '井上', '木村', '林', '斎藤', '清水'];
const FIRST_NAMES = ['太郎', '次郎', '健一', '花子', '陽子', '美咲', '大輔', '誠', '直人', '香織', '真奈美', '拓也', '健太', '翔太', '由佳', 'あゆみ', '美優', '七海', '大樹', '翼'];
const COMPANIES = ['株式会社SPEED', 'テックイノベーション', '未来ソリューションズ', 'グローバル商事', 'アドバンストシステム', 'ネクストワン', 'クリエイティブ・ホールディングス', 'ジャパンテック', 'サイバーネティクス', 'データバンク'];
const DEPARTMENTS = ['営業部', 'マーケティング部', '開発部', '総務部', '人事部', '経営企画部', '情報システム部', 'デザイン部'];
const POSITIONS = ['部長', '課長', '係長', '主任', '一般社員', 'マネージャー', 'リーダー'];

function getRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

function weightedRandom(options, weights) {
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    let random = Math.random() * totalWeight;
    for (let i = 0; i < options.length; i++) {
        random -= weights[i];
        if (random < 0) return options[i];
    }
    return options[options.length - 1];
}


function toBase64(str) {
    return Buffer.from(str).toString('base64');
}

function generateSignatureSvg(name) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="100" viewBox="0 0 300 100"><rect width="300" height="100" fill="white" stroke="#ccc" stroke-width="1"/><text x="150" y="60" font-family="cursive" font-size="24" fill="#000" text-anchor="middle" font-style="italic">${name}</text><path d="M50,80 Q150,90 250,80" stroke="#000" stroke-width="2" fill="none"/></svg>`;
    return `data:image/svg+xml;base64,${toBase64(svg)}`;
}

function generateSitePhotoSvg(seq) {
    const hue = Math.floor(Math.random() * 360);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300"><rect width="400" height="300" fill="hsl(${hue}, 70%, 90%)"/><circle cx="200" cy="150" r="50" fill="hsl(${hue}, 70%, 80%)"/><rect x="100" y="240" width="200" height="20" fill="rgba(0,0,0,0.1)"/><text x="200" y="155" font-family="sans-serif" font-size="20" fill="#555" text-anchor="middle">Site Photo #${seq}</text></svg>`;
    return `data:image/svg+xml;base64,${toBase64(svg)}`;
}

function generateBusinessCardSvg(company, dept, pos, name, email, phone) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="550" height="300" viewBox="0 0 550 300"><rect width="550" height="300" fill="white" stroke="#ddd" stroke-width="2"/><text x="40" y="60" font-family="sans-serif" font-size="24" fill="#333" font-weight="bold">${company}</text><text x="40" y="100" font-family="sans-serif" font-size="16" fill="#666">${dept} ${pos}</text><text x="40" y="160" font-family="sans-serif" font-size="32" fill="#000">${name}</text><line x1="40" y1="180" x2="510" y2="180" stroke="#eee" stroke-width="2"/><text x="40" y="230" font-family="sans-serif" font-size="14" fill="#555">Email: ${email}</text><text x="40" y="260" font-family="sans-serif" font-size="14" fill="#555">Tel: ${phone}</text><rect x="450" y="40" width="60" height="60" fill="#f0f0f0"/><text x="460" y="75" font-family="sans-serif" font-size="10" fill="#aaa">Logo</text></svg>`;
    return `data:image/svg+xml;base64,${toBase64(svg)}`;
}

const answers = [];
const cards = [];

const TOTAL_RESPONSES = 200;
const START_TIME = new Date('2026-02-01T10:00:00').getTime();
const END_TIME = new Date().getTime();

console.log(`Generating ${TOTAL_RESPONSES} responses...`);

for (let i = 0; i < TOTAL_RESPONSES; i++) {
    const seq = String(i + 1).padStart(4, '0');
    const answerId = `A${seq}`;
    const timestamp = new Date(START_TIME + Math.random() * (END_TIME - START_TIME));

    // Profile
    const lastName = getRandom(LAST_NAMES);
    const firstName = getRandom(FIRST_NAMES);
    const fullName = `${lastName} ${firstName}`;
    const company = getRandom(COMPANIES);
    const dept = getRandom(DEPARTMENTS);
    const pos = getRandom(POSITIONS);
    const email = `user${i + 1}@example.com`;
    const phone = `03-${String(Math.floor(Math.random() * 9000) + 1000)}-${String(Math.floor(Math.random() * 9000) + 1000)}`;

    const details = [];

    // Q1: Knowing (SA) - Weighted
    const q1Options = ["招待状", "Webサイト", "SNS", "知人の紹介", "その他"];
    const q1Weights = [0.3, 0.4, 0.2, 0.05, 0.05];
    details.push({ questionId: 'Q1', answer: weightedRandom(q1Options, q1Weights) });

    // Q2: Interest (MA) - Random subset
    const q2Options = ["AI・機械学習", "クラウドサービス", "セキュリティ", "IoT", "VR/AR"];
    const q2Selection = q2Options.filter(() => Math.random() > 0.5); // ~50% chance each
    if (q2Selection.length === 0) q2Selection.push(getRandom(q2Options)); // At least one
    details.push({ questionId: 'Q2', answer: q2Selection });

    // Q3: Name (Text)
    details.push({ questionId: 'Q3', answer: fullName });

    // Q4: Opinion (Free Text)
    const opinions = ["特になし", "詳細を聞きたい", "導入コストについて知りたい", "デモを希望します", "素晴らしい製品でした。"];
    if (Math.random() > 0.7) {
        details.push({ questionId: 'Q4', answer: getRandom(opinions) });
    } else {
        details.push({ questionId: 'Q4', answer: "" });
    }

    // Q5: Date
    details.push({ questionId: 'Q5', answer: "2026-04-01" });

    // Q6: Time
    details.push({ questionId: 'Q6', answer: "14:00" });

    // Q7: Number
    details.push({ questionId: 'Q7', answer: Math.floor(Math.random() * 50) + 1 });

    // Q8: Satisfaction (Matrix SA) - Weighted Random
    // 5: Satisfied, 4: Somewhat, 3: Normal, 2: Somewhat Dissatisfied, 1: Dissatisfied
    const q8Rows = ['r1', 'r2', 'r3', 'r4']; // Functionality, Usability, Support, Price
    const q8Values = ["5", "4", "3", "2", "1"];
    // Weighting: Bias towards 4 and 5, fewer 1s.
    // Different weights per row for realism
    const q8WeightsMap = {
        'r1': [0.4, 0.4, 0.15, 0.05, 0.00], // Functionality: High
        'r2': [0.3, 0.4, 0.20, 0.08, 0.02], // Usability: Good
        'r3': [0.2, 0.3, 0.40, 0.08, 0.02], // Support: Average
        'r4': [0.1, 0.2, 0.30, 0.20, 0.20]  // Price: Mixed/Low
    };

    const q8Answer = {};
    q8Rows.forEach(rid => {
        q8Answer[rid] = weightedRandom(q8Values, q8WeightsMap[rid]);
    });
    details.push({ questionId: 'Q8', answer: q8Answer });

    // Q9: Consideration (Matrix MA)
    const q9Rows = ['r1', 'r2'];
    const q9Values = ['a', 'b', 'c', 'd'];
    const q9Answer = [];
    q9Rows.forEach(rid => {
        q9Values.forEach(val => {
            if (Math.random() > 0.7) { // 30% chance per option
                q9Answer.push({ row: rid, value: val });
            }
        });
    });
    details.push({ questionId: 'Q9', answer: q9Answer });

    // Q10: Handwriting - Generate SVG
    details.push({ questionId: 'Q10', answer: generateSignatureSvg(fullName), type: 'handwriting' });

    // Q11: Image - Generate SVG
    details.push({ questionId: 'Q11', answer: generateSitePhotoSvg(seq), type: 'image' });


    answers.push({
        answerId: answerId,
        surveyId: SURVEY_ID,
        answeredAt: timestamp.toISOString(),
        details: details
    });

    // Business Card
    const cardData = {
        id: `bc_${seq}`,
        companyName: company,
        department: dept,
        position: pos,
        name: fullName,
        email: email,
        phone: phone,
        address: "東京都千代田区...",
        status: (Math.random() > 0.05) ? 'done' : 'digitizing', // 95% done
        imageUrl: generateBusinessCardSvg(company, dept, pos, fullName, email, phone)
    };

    cards.push({
        answerId: answerId,
        businessCard: cardData
    });
}

// Write Answer File
const answerFileContent = {
    surveyId: SURVEY_ID,
    answers: answers
};
fs.writeFileSync(path.join(OUTPUT_DIR_ANSWERS, `${SURVEY_ID}.json`), JSON.stringify(answerFileContent, null, 2), 'utf8');
console.log(`Written ${path.join(OUTPUT_DIR_ANSWERS, `${SURVEY_ID}.json`)}`);

// Write Business Card File
const cardFileContent = cards; // Array format
fs.writeFileSync(path.join(OUTPUT_DIR_BIZCARDS, `${SURVEY_ID}.json`), JSON.stringify(cardFileContent, null, 2), 'utf8');
console.log(`Written ${path.join(OUTPUT_DIR_BIZCARDS, `${SURVEY_ID}.json`)}`);

console.log('Done.');

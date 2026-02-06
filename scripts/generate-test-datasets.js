/**
 * テスト用アンケートデータ生成スクリプト (マトリクス強化・300件版)
 */

const fs = require('fs');
const path = require('path');

const groups = [
    { id: 'personal', userId: '0001', name: '個人アカウント', plan: 'Free', corp: '個人事業主' },
    { id: 'group_sales', userId: '0002', name: '営業部', plan: 'Free', corp: '営業ターゲット(株)' },
    { id: 'group_marketing', userId: '0003', name: 'マーケティング部', plan: 'Premium', corp: 'マーケ分析(株)' },
    { id: 'group_bpo', userId: '0004', name: 'BPO部', plan: 'Mix', corp: '委託先(株)' }
];

const patterns = [
    { id: 'all_types', name: '全形式網羅・分析検証テスト', count: 300 }, // 300件に拡張
    { id: 'b2b', name: '展示会リード獲得', count: 50 },
    { id: 'csat', name: '製品満足度調査', count: 50 },
    { id: 'premium', name: '現場点検ログ', count: 50 },
    { id: 'global', name: 'グローバル意識調査', count: 50 },
    { id: 'logic', name: '条件分岐ロジック検証', count: 40 },
    { id: 'volume', name: '大量データ負荷検証', count: 1200 },
    { id: 'industry', name: '業種別実用テンプレート', count: 60 }
];

// --- 設問定義 (マトリクスを詳細化) ---
function createFullDetails() {
    return [
        { id: "Q1", text: "業界 (SA)", type: "single_choice", options: ["製造", "IT", "金融", "小売"] },
        { id: "Q2", text: "興味のある分野 (MA)", type: "multi_choice", options: ["製品A", "製品B", "製品C"] },
        { id: "Q3", text: "氏名 (Text)", type: "text" },
        { id: "Q4", text: "ご意見 (FreeText)", type: "free_text" },
        { id: "Q5", text: "来場人数 (Number)", type: "number" },
        { id: "Q6", text: "希望日 (Date)", type: "date" },
        { id: "Q7", text: "時間 (Time)", type: "time" },
        { 
            id: "Q8", text: "製品評価 (Matrix SA)", type: "matrix_sa", 
            rows: [
                { id: "row1", text: "デザイン" },
                { id: "row2", text: "機能性" },
                { id: "row3", text: "価格" },
                { id: "row4", text: "サポート" }
            ], 
            columns: [
                { value: "5", text: "非常に良い" },
                { value: "4", text: "良い" },
                { value: "3", text: "普通" },
                { value: "2", text: "悪い" },
                { value: "1", text: "非常に悪い" }
            ] 
        },
        { id: "Q9", text: "署名 (Handwriting)", type: "handwriting" },
        { id: "Q10", text: "現場写真 (Image)", type: "image" }
    ];
}

function randomElement(array) { return array[Math.floor(Math.random() * array.length)]; }
function randomElements(array, count) { return [...array].sort(() => 0.5 - Math.random()).slice(0, count); }
function randomDate() {
    const day = Math.floor(Math.random() * 14) + 4;
    return `2026-01-${String(day).padStart(2, '0')} 12:00:00`;
}

const allSurveys = [];

groups.forEach(group => {
    patterns.forEach((p, pIdx) => {
        const surveyId = `sv_${group.userId}_26${String(pIdx + 1).padStart(3, '0')}`;
        let currentPlan = group.plan;
        if (group.plan === 'Mix') currentPlan = (pIdx < 4) ? 'Premium' : 'Free';

        let details = (p.id === 'all_types') ? createFullDetails() : [{ id: "Q1", text: "質問1", type: "text" }];
        if (p.id === 'b2b') details = [{ id: "Q1", text: "業種", type: "single_choice", options: ["製造", "IT"] }];

        const survey = {
            id: surveyId,
            groupId: group.id,
            name: { ja: `${p.name} (${group.name})`, en: `${p.name} - ${group.id}` },
            status: "会期中",
            answerCount: p.count,
            periodStart: "2026-01-04",
            periodEnd: "2026-01-17",
            plan: currentPlan,
            details: details
        };
        allSurveys.push(survey);

        const answers = [];
        const businessCards = [];
        for (let i = 1; i <= p.count; i++) {
            const ansId = `ans-${surveyId}-${String(i).padStart(4, '0')}`;
            const ansDetails = details.map(q => {
                let val = "-";
                switch(q.type) {
                    case 'single_choice': val = randomElement(q.options); break;
                    case 'multi_choice': val = randomElements(q.options, 2); break;
                    case 'matrix_sa': 
                        val = {};
                        q.rows.forEach(r => {
                            const rand = Math.random();
                            if (rand < 0.05) return;
                            if (r.id === 'row1') val[r.id] = (rand < 0.7) ? "5" : "4";
                            else if (r.id === 'row3') val[r.id] = (rand < 0.5) ? "2" : "3";
                            else val[r.id] = randomElement(q.columns).value;
                        });
                        break;
                    case 'image': 
                        // 実際の画像ファイルへのパスをセット (再現用)
                        val = '../media/縦表 .png'; 
                        break;
                    case 'handwriting': 
                        // 実際の手書き風画像へのパスをセット (再現用)
                        val = '../media/hanko.png'; 
                        break;
                    default: val = "サンプル回答";
                }
                return { question: q.text, answer: val, type: q.type };
            });
            answers.push({ answerId: ansId, surveyId: surveyId, answeredAt: randomDate(), details: ansDetails });
            businessCards.push({
                answerId: ansId,
                businessCard: { group2: { lastName: group.name, firstName: `利用者${i}` }, group3: { companyName: group.corp } }
            });
        }

        const writeJson = (dir, name, data) => {
            const p = path.join(__dirname, `../docs/examples/${dir}/${name}.json`);
            if (!fs.existsSync(path.dirname(p))) fs.mkdirSync(path.dirname(p), { recursive: true });
            fs.writeFileSync(p, JSON.stringify(data, null, 2));
            if (dir === 'demo_surveys') {
                const p2 = path.join(__dirname, `../data/surveys/${name}.json`);
                if (!fs.existsSync(path.dirname(p2))) fs.mkdirSync(path.dirname(p2), { recursive: true });
                fs.writeFileSync(p2, JSON.stringify(data, null, 2));
            }
        };
        writeJson('demo_surveys', surveyId, survey);
        writeJson('demo_answers', surveyId, answers);
        writeJson('demo_business-cards', surveyId, businessCards);
    });
});

fs.writeFileSync(path.join(__dirname, '../data/core/surveys.json'), JSON.stringify(allSurveys, null, 2));
console.log(`✅ マトリクス回答を強化した300件のテストデータを再生成しました。`);
/**
 * テスト用アンケートデータ生成スクリプト (全形式網羅 × リアリティ究極版)
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
    { id: 'all_types', name: '全形式網羅・分析検証テスト', count: 300 },
    { id: 'b2b', name: '展示会リード獲得', count: 50 },
    { id: 'csat', name: '製品満足度調査', count: 100 },
    { id: 'premium', name: '現場点検ログ', count: 50 },
    { id: 'global', name: 'グローバル意識調査', count: 50 },
    { id: 'logic', name: '条件分岐ロジック検証', count: 40 },
    { id: 'volume', name: '大量データ負荷検証', count: 1200 },
    { id: 'industry', name: '業種別実用テンプレート', count: 60 }
];

// --- 設問定義 (全12形式網羅) ---
function createFullDetails() {
    return [
        { id: "Q1", text: "ご所属の業界", type: "single_choice", options: ["製造業", "IT・情報通信", "金融・保険", "小売・流通", "その他"] },
        { id: "Q2", text: "興味のあるソリューション (複数回答)", type: "multi_choice", options: ["クラウド移行", "AI活用", "セキュリティ強化", "コスト削減", "DX推進"] },
        { id: "Q3", text: "担当者名", type: "text" },
        { id: "Q4", text: "具体的なお悩み・ご要望", type: "free_text" },
        { id: "Q5", text: "来場人数", type: "number", min: 1, max: 10, unit: "名" },
        { id: "Q6", text: "次回商談希望日", type: "date" },
        { id: "Q7", text: "連絡希望時間帯", type: "time" },
        { 
            id: "Q8", text: "製品満足度詳細", type: "matrix_sa", 
            rows: [{id:"r1", text:"UI/UX"}, {id:"r2", text:"機能"}, {id:"r3", text:"価格"}, {id:"r4", text:"サポート"}], 
            options: [{value:"5", text:"非常に良い"}, {value:"4", text:"良い"}, {value:"3", text:"普通"}, {value:"2", text:"悪い"}, {value:"1", text:"非常に悪い"}] 
        },
        { id: "Q9", text: "承諾の署名", type: "handwriting" },
        { id: "Q10", text: "現場の状況写真", type: "image" },
        { id: "Q11", text: "評価マトリクス(MA)", type: "matrix_ma", rows: [{id:"r1", text:"注力分野"}], options: [{value:"a", text:"技術"}, {value:"b", text:"営業"}, {value:"c", text:"企画"}] },
        { id: "Q12", text: "※入力完了後、送信ボタンを押してください", type: "explanation" }
    ];
}

const commentPools = {
    positive: ["操作が非常にスムーズです。", "導入メリットが明確です。", "UIが洗練されています。"],
    negative: ["初期費用がネックです。", "操作に慣れが必要です。", "既存ツールとの競合が心配です。"],
    neutral: ["概ね満足です。", "継続して検討します。", "資料を確認します。"]
};

function randomElement(array) { return array[Math.floor(Math.random() * array.length)]; }
function randomElements(array, count) { return [...array].sort(() => 0.5 - Math.random()).slice(0, count); }

const allSurveys = [];

groups.forEach(group => {
    patterns.forEach((p, pIdx) => {
        const surveyId = `sv_${group.userId}_26${String(pIdx + 1).padStart(3, '0')}`;
        let currentPlan = group.plan;
        if (group.plan === 'Mix') currentPlan = (pIdx < 4) ? 'Premium' : 'Free';

        const details = createFullDetails(); // 全形式網羅
        const survey = {
            id: surveyId,
            groupId: group.id,
            name: { ja: `${p.name} (${group.name})`, en: `${p.id.toUpperCase()} Survey` },
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
            const score = Math.floor(Math.random() * 5) + 1;
            
            const ansDetails = details.map(q => {
                let val = "";
                switch(q.type) {
                    case 'single_choice': val = randomElement(q.options); break;
                    case 'multi_choice': val = randomElements(q.options, 2); break;
                    case 'text': val = `テスト 利用者${i}`; break;
                    case 'free_text': 
                        const pool = score >= 4 ? commentPools.positive : score <= 2 ? commentPools.negative : commentPools.neutral;
                        val = randomElement(pool);
                        break;
                    case 'number': val = Math.floor(Math.random() * 5) + 1; break;
                    case 'date': val = "2026-02-15"; break;
                    case 'time': val = "14:00"; break;
                    case 'matrix_sa': 
                        val = {}; q.rows.forEach(r => val[r.id] = String(Math.max(1, Math.min(5, score + (Math.floor(Math.random()*3)-1)))));
                        break;
                    case 'matrix_ma':
                        val = {}; q.rows.forEach(r => val[r.id] = [randomElement(q.options).value]);
                        break;
                    case 'handwriting': val = '../media/hanko.png'; break;
                    case 'image': val = '../media/縦表 .png'; break;
                    case 'explanation': val = null; break;
                }
                return { question: q.text, answer: val, type: q.type };
            });

            answers.push({ answerId: ansId, surveyId: surveyId, answeredAt: "2026-01-10 10:00:00", details: ansDetails });
            businessCards.push({
                answerId: ansId,
                businessCard: { group2: { lastName: group.name, firstName: `担当${i}` }, group3: { companyName: group.corp } }
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
console.log(`✅ 全形式網羅 × リアリティ連動の32データセットを再生成しました。`);
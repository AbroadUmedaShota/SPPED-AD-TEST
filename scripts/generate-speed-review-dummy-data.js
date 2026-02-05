/**
 * SPEED Review 用のダミーデータ生成スクリプト (全形式網羅版)
 */

const fs = require('fs');
const path = require('path');

const industries = ['製造業', 'IT', '金融', '小売', 'サービス'];
const products = ['製品A', '製品B', '製品C', '製品D'];
const evaluatons = ['非常に良い', '良い', '普通', '悪い'];
const matrixRows = ['機能性', 'デザイン', '価格', 'サポート'];

function randomElement(array) {
    return array[Math.floor(Math.random() * array.length)];
}

function randomElements(array, count) {
    const shuffled = [...array].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
}

function randomDate() {
    const year = 2026;
    const day = Math.floor(Math.random() * 14) + 4;
    const hour = Math.floor(Math.random() * 9) + 9;
    return `${year}-01-${String(day).padStart(2, '0')} ${String(hour).padStart(2, '0')}:30:00`;
}

const surveyId = 'sv_0001_25060';

// 1. 全形式網羅の設問定義
const surveyDefinition = {
    id: surveyId,
    groupId: "GROUP001",
    name: { ja: "全回答形式・検証用アンケート", en: "Full Format Test Survey" },
    status: "会期中",
    periodStart: "2026-01-04",
    periodEnd: "2026-01-17",
    bizcardEnabled: true,
    details: [
        { id: "Q1", text: "Q1. 業界 (SA)", type: "single_choice", options: industries },
        { id: "Q2", text: "Q2. 興味のある分野 (MA)", type: "multi_choice", options: products },
        { id: "Q3", text: "Q3. ご意見 (Free Text)", type: "free_text" },
        { id: "Q4", text: "Q4. 来場人数 (Number)", type: "number" },
        { id: "Q5", text: "Q5. 希望納期 (Date)", type: "date" },
        { id: "Q6", text: "Q6. 満足度評価 (Matrix SA)", type: "matrix_sa", rows: matrixRows, options: evaluatons },
        { id: "Q7", text: "Q7. サイン (Handwriting)", type: "handwriting" },
        { id: "Q8", text: "Q8. 現場写真 (Image)", type: "image" }
    ]
};

function generateAnswers(count) {
    const answers = [];
    const questions = surveyDefinition.details;
    
    for (let i = 1; i <= count; i++) {
        const answerId = `ans-${String(i).padStart(5, '0')}`;
        
        const details = questions.map(q => {
            let val = "";
            switch(q.type) {
                case 'single_choice': val = randomElement(q.options); break;
                case 'multi_choice': val = randomElements(q.options, 2); break;
                case 'free_text': val = "これはテストの自由記述回答です。"; break;
                case 'number': val = Math.floor(Math.random() * 10) + 1; break;
                case 'date': val = "2026-02-15"; break;
                case 'matrix_sa': val = { [matrixRows[0]]: "良い", [matrixRows[1]]: "普通" }; break;
                case 'handwriting': val = `handwriting_${i}.png`; break;
                case 'image': val = `photo_${i}.jpg`; break;
            }
            return { question: q.text, answer: val, type: q.type };
        });

        answers.push({
            answerId,
            surveyId: surveyId,
            answeredAt: randomDate(),
            details: details
        });
    }
    return answers;
}

function generateBusinessCards(count) {
    const businessCards = [];
    for (let i = 1; i <= count; i++) {
        const answerId = `ans-${String(i).padStart(5, '0')}`;
        businessCards.push({
            answerId,
            businessCard: {
                group2: { lastName: "テスト", firstName: "太郎" },
                group3: { companyName: "検証株式会社" }
            }
        });
    }
    return businessCards;
}

function main() {
    const COUNT = 100; // 検証用なので100件程度
    const answers = generateAnswers(COUNT);
    const businessCards = generateBusinessCards(COUNT);

    const surveyPath = path.join(__dirname, `../docs/examples/demo_surveys/${surveyId}.json`);
    const answersPath = path.join(__dirname, `../docs/examples/demo_answers/${surveyId}.json`);
    const businessCardsPath = path.join(__dirname, `../docs/examples/demo_business-cards/${surveyId}.json`);

    [surveyPath, answersPath, businessCardsPath].forEach(p => {
        if (!fs.existsSync(path.dirname(p))) fs.mkdirSync(path.dirname(p), { recursive: true });
    });

    fs.writeFileSync(surveyPath, JSON.stringify(surveyDefinition, null, 2));
    fs.writeFileSync(answersPath, JSON.stringify(answers, null, 2));
    fs.writeFileSync(businessCardsPath, JSON.stringify(businessCards, null, 2));

    console.log(`✅ 全形式網羅データを生成完了: ${COUNT}件`);
}

main();

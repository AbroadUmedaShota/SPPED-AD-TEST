/**
 * SPEED Review 用のダミーデータ生成スクリプト
 * 500件の回答データと名刺データを生成します
 */

const fs = require('fs');
const path = require('path');

// 業界のサンプル
const industries = [
    '製造業', 'IT・情報通信業', '金融・保険業', '小売業', '卸売業',
    '建設業', '運輸業', '不動産業', '医療・福祉', '教育・学習支援業',
    'サービス業', '宿泊・飲食業', '電気・ガス業', '農林水産業', 'その他'
];

// 名前のサンプル
const lastNames = [
    '佐藤', '鈴木', '高橋', '田中', '伊藤', '渡辺', '山本', '中村', '小林', '加藤',
    '吉田', '山田', '佐々木', '山口', '松本', '井上', '木村', '林', '斎藤', '清水',
    '山崎', '森', '池田', '橋本', '阿部', '石川', '山下', '中島', '石井', '小川'
];

const firstNames = [
    '太郎', '次郎', '三郎', '健一', '誠', '和也', '隆', '修', '浩', '勇',
    '花子', '美咲', '愛', '結衣', '陽菜', 'さくら', '未来', '優', '葵', '凛',
    '翔太', '大輔', '拓也', '直樹', '雄太', '美香', '由美', '真理', '智子', '恵'
];

// 会社名のサンプル
const companyPrefixes = [
    '株式会社', '有限会社', '合同会社', '一般社団法人'
];

const companyNames = [
    'テクノロジーソリューションズ', 'グローバルシステムズ', 'アドバンスト・テクノロジー',
    'イノベーション・ラボ', 'デジタルデザイン', 'クリエイティブワークス',
    'ビジネスパートナーズ', 'エンタープライズソリューション', 'スマートシステムズ',
    'フューチャービジョン', 'ダイナミックウェーブ', 'プログレス',
    '日本総合コンサルティング', 'マーケティングエクスパート', 'データアナリシス',
    'クラウドサービス', 'セキュリティソリューションズ', 'ネットワークデザイン',
    '総合商事', '開発センター', 'プロジェクトマネジメント', 'インダストリー',
    'コンストラクション', 'マニュファクチャリング', 'トレーディング'
];

// 部署名のサンプル
const departments = [
    '営業部', 'マーケティング部', '開発部', '企画部', '総務部', '人事部',
    '経理部', '業務部', '技術部', '製造部', '品質管理部', 'システム部',
    '情報システム部', '広報部', '法務部', 'カスタマーサポート部'
];

// 役職のサンプル
const positions = [
    '部長', '課長', '係長', '主任', 'マネージャー', 'リーダー',
    'スペシャリスト', 'エキスパート', 'アナリスト', 'コンサルタント',
    'エンジニア', 'ディレクター', 'チーフ', '担当'
];

// 都道府県のサンプル
const prefectures = [
    '東京都', '大阪府', '神奈川県', '愛知県', '埼玉県', '千葉県',
    '福岡県', '北海道', '兵庫県', '京都府', '宮城県', '広島県'
];

// ランダムな要素を取得
function randomElement(array) {
    return array[Math.floor(Math.random() * array.length)];
}

// ランダムな日時を生成（2026年1月1日～1月30日、9:00～17:00）
function randomDate() {
    // ランダムな日付を生成
    const year = 2026;
    const month = 0; // 1月（0-indexed）
    const day = Math.floor(Math.random() * 30) + 1; // 1-30日

    // 9時～17時のランダムな時刻
    const hour = Math.floor(Math.random() * 9) + 9; // 9-17時
    const minute = Math.floor(Math.random() * 60); // 0-59分
    const second = Math.floor(Math.random() * 60); // 0-59秒

    const date = new Date(year, month, day, hour, minute, second);

    const monthStr = String(date.getMonth() + 1).padStart(2, '0');
    const dayStr = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');

    return `${year}-${monthStr}-${dayStr} ${hours}:${minutes}:${seconds}`;
}

// ステータスを決定（1:1:1の割合でblank, processing, completed）
function determineStatus(index) {
    const remainder = index % 3;
    if (remainder === 0) return 'blank';
    if (remainder === 1) return 'processing';
    return 'completed';
}

// 回答データを生成
function generateAnswers(count) {
    const answers = [];

    // Q1の選択肢
    const q1Options = ['毎日', '週に数回', '月に数回', 'ほとんど使わない'];

    // Q5の選択肢
    const q5Options = ['非常に満足', '満足', '普通', '不満', '非常に不満'];

    // はい/いいえの選択肢
    const yesNoOptions = ['はい', 'いいえ'];

    // 自由記述のサンプル
    const freeTextSamples = [
        '特にありません',
        '使いやすくて良いと思います',
        '機能が多くて便利です',
        '改善の余地があると感じます',
        'もう少し直感的なUIになると嬉しいです',
        '概ね満足しています',
        '価格とのバランスが良いです',
        '今後も継続して利用したいです'
    ];

    for (let i = 1; i <= count; i++) {
        const answerId = `sv25060-${String(i).padStart(5, '0')}`;
        const status = determineStatus(i);

        const answer = {
            answerId,
            surveyId: 'sv_0001_25060',
            answeredAt: randomDate(),
            isTest: false,
            details: [
                { question: 'Q1. 製品の利用頻度を教えてください。', answer: randomElement(q1Options) },
                { question: 'Q2. 製品の利用頻度は適切だと思いますか？', answer: randomElement(yesNoOptions) },
                { question: 'Q3. 製品の利用頻度に関する課題はありますか？', answer: randomElement(freeTextSamples) },
                { question: 'Q4. 製品の利用頻度に関する改善点があれば教えてください。', answer: randomElement(freeTextSamples) },
                { question: 'Q5. 製品の利用頻度に関する全体的な満足度を教えてください。', answer: randomElement(q5Options) },
                { question: 'Q6. 製品の利用頻度に関するアイデアは豊富ですか？', answer: randomElement(yesNoOptions) },
                { question: 'Q7. 製品の利用頻度に関する実現可能性は高いですか？', answer: randomElement(yesNoOptions) },
                { question: 'Q8. 製品の利用頻度に関する独自性は高いですか？', answer: randomElement(yesNoOptions) },
                { question: 'Q9. 製品の利用頻度に関するターゲット層は明確ですか？', answer: randomElement(yesNoOptions) },
                { question: 'Q10. 製品の利用頻度に関する予算は適切ですか？', answer: randomElement(yesNoOptions) },
                { question: 'Q11. 製品の利用頻度に関するスケジュールは適切ですか？', answer: randomElement(yesNoOptions) },
                { question: 'Q12. 製品の利用頻度に関するプロモーション戦略は適切ですか？', answer: randomElement(yesNoOptions) },
                { question: 'Q13. 製品の利用頻度に関する成功指標は明確ですか？', answer: randomElement(yesNoOptions) },
                { question: 'Q14. 製品の利用頻度に関するリスク管理は適切ですか？', answer: randomElement(yesNoOptions) },
                { question: 'Q15. 製品の利用頻度に関する継続性は高いですか？', answer: randomElement(yesNoOptions) },
                { question: 'Q16. 製品の利用頻度に関する活用度は高いですか？', answer: randomElement(yesNoOptions) },
                { question: 'Q17. 製品の利用頻度に関する専門性は高いですか？', answer: randomElement(yesNoOptions) },
                { question: 'Q18. 製品の利用頻度に関する多様性は高いですか？', answer: randomElement(yesNoOptions) },
                { question: 'Q19. 製品の利用頻度に関する柔軟性は高いですか？', answer: randomElement(yesNoOptions) }
            ]
        };

        // processing の場合のみ cardStatus を追加
        if (status === 'processing') {
            answer.cardStatus = 'processing';
        }

        answers.push(answer);
    }

    return answers;
}

// 名刺データを生成
function generateBusinessCards(count) {
    const businessCards = [];

    for (let i = 1; i <= count; i++) {
        const answerId = `sv25060-${String(i).padStart(5, '0')}`;
        const status = determineStatus(i);

        // blank の場合は名刺データを生成しない
        if (status === 'blank') {
            continue;
        }

        const lastName = randomElement(lastNames);
        const firstName = randomElement(firstNames);
        const companyName = `${randomElement(companyPrefixes)}${randomElement(companyNames)}`;
        const prefecture = randomElement(prefectures);

        const businessCard = {
            answerId,
            businessCard: {
                group1: {
                    email: `${lastName.toLowerCase()}.${firstName.toLowerCase()}@example.com`
                },
                group2: {
                    lastName,
                    firstName
                },
                group3: {
                    companyName,
                    department: randomElement(departments),
                    position: randomElement(positions)
                },
                group4: {
                    postalCode: `${String(Math.floor(Math.random() * 900) + 100)}-${String(Math.floor(Math.random() * 9000) + 1000)}`,
                    address1: `${prefecture}${randomElement(['千代田区', '中央区', '港区', '新宿区', '渋谷区', '品川区'])}`,
                    address2: `${Math.floor(Math.random() * 30) + 1}-${Math.floor(Math.random() * 30) + 1}-${Math.floor(Math.random() * 30) + 1}`
                },
                group5: {
                    mobile: `090-${String(Math.floor(Math.random() * 9000) + 1000)}-${String(Math.floor(Math.random() * 9000) + 1000)}`,
                    tel1: `03-${String(Math.floor(Math.random() * 9000) + 1000)}-${String(Math.floor(Math.random() * 9000) + 1000)}`,
                    fax: `03-${String(Math.floor(Math.random() * 9000) + 1000)}-${String(Math.floor(Math.random() * 9000) + 1000)}`
                },
                group6: {
                    url: `https://www.${companyName.replace(/株式会社|有限会社|合同会社|一般社団法人/g, '').toLowerCase().replace(/・/g, '-')}.example.com`
                }
            }
        };

        businessCards.push(businessCard);
    }

    return businessCards;
}

// メイン処理
function main() {
    console.log('🎲 SPEED Review ダミーデータ生成を開始します...');

    const COUNT = 500;

    // データを生成
    console.log(`📝 ${COUNT}件の回答データを生成中...`);
    const answers = generateAnswers(COUNT);

    console.log(`💳 名刺データを生成中...`);
    const businessCards = generateBusinessCards(COUNT);

    // ファイルパスを設定（正しい読み込み先に保存）
    const answersPath = path.join(__dirname, '../docs/examples/demo_answers/sv_0001_25060.json');
    const businessCardsPath = path.join(__dirname, '../docs/examples/demo_business-cards/sv_0001_25060.json');

    // ディレクトリが存在しない場合は作成
    const answersDir = path.dirname(answersPath);
    const businessCardsDir = path.dirname(businessCardsPath);

    if (!fs.existsSync(answersDir)) {
        fs.mkdirSync(answersDir, { recursive: true });
    }
    if (!fs.existsSync(businessCardsDir)) {
        fs.mkdirSync(businessCardsDir, { recursive: true });
    }

    // ファイルに書き込み
    console.log(`💾 ファイルに書き込み中...`);
    fs.writeFileSync(answersPath, JSON.stringify(answers, null, 2), 'utf-8');
    fs.writeFileSync(businessCardsPath, JSON.stringify(businessCards, null, 2), 'utf-8');

    console.log('✅ ダミーデータ生成が完了しました！');
    console.log(`📊 統計:`);
    console.log(`   - 総回答データ: ${answers.length}件`);
    console.log(`   - 総名刺データ: ${businessCards.length}件`);
    console.log(`📋 ステータス別:`);
    console.log(`   - 未データ化（blank）: ${answers.filter(a => !a.cardStatus && !a.businessCard).length}件`);
    console.log(`   - データ化進行中（processing）: ${answers.filter(a => a.cardStatus === 'processing').length}件`);
    console.log(`   - データ化完了（completed）: ${businessCards.length}件`);
    console.log(`📁 保存先:`);
    console.log(`   - ${answersPath}`);
    console.log(`   - ${businessCardsPath}`);
}

main();

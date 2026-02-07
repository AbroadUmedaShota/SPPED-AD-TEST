/**
 * 展示会想定のSPEEDレビュー用データを生成する。
 * - 3日開催
 * - 合計900件（1日あたり約300件）
 * - 12回答形式を網羅
 * - 名刺データ進行中ケース（businessCard欠損）を一部混在
 */

const fs = require('fs');
const path = require('path');

const SURVEY_ID = 'sv_0001_26009';
const DAY_COUNTS = [285, 300, 315]; // 合計900件（1日300件想定、±10%以内）
const PERIOD_START = '2026-01-10';
const PERIOD_END = '2026-01-12';
const PLAN = 'Premium';
const GENERATED_MEDIA_DIR = path.join(__dirname, '..', 'media', 'generated', SURVEY_ID);
const BIZCARD_MEDIA_DIR = path.join(GENERATED_MEDIA_DIR, 'bizcard');
const HANDWRITING_MEDIA_DIR = path.join(GENERATED_MEDIA_DIR, 'handwriting');
const ATTACHMENT_MEDIA_DIR = path.join(GENERATED_MEDIA_DIR, 'attachment');

const QUESTION_DEFS = [
  { id: 'Q1', text: 'ご所属の業界', type: 'single_choice', options: ['製造業', 'IT・情報通信', '金融・保険', '小売・流通', 'その他'] },
  { id: 'Q2', text: '興味のあるソリューション (複数回答)', type: 'multi_choice', options: ['クラウド移行', 'AI活用', 'セキュリティ強化', 'コスト削減', 'DX推進'] },
  { id: 'Q3', text: '担当者名', type: 'text' },
  { id: 'Q4', text: '具体的なお悩み・ご要望', type: 'free_text' },
  { id: 'Q5', text: '来場人数', type: 'number', min: 1, max: 10, unit: '名' },
  { id: 'Q6', text: '次回商談希望日', type: 'date' },
  { id: 'Q7', text: '連絡希望時間帯', type: 'time' },
  {
    id: 'Q8',
    text: '製品満足度詳細',
    type: 'matrix_sa',
    rows: [
      { id: 'r1', text: 'UI/UX' },
      { id: 'r2', text: '機能' },
      { id: 'r3', text: '価格' },
      { id: 'r4', text: 'サポート' }
    ],
    options: [
      { value: '5', text: '非常に良い' },
      { value: '4', text: '良い' },
      { value: '3', text: '普通' },
      { value: '2', text: '悪い' },
      { value: '1', text: '非常に悪い' }
    ]
  },
  { id: 'Q9', text: '承諾の署名', type: 'handwriting' },
  { id: 'Q10', text: '現場の状況写真', type: 'image' },
  {
    id: 'Q11',
    text: '評価マトリクス(MA)',
    type: 'matrix_ma',
    rows: [{ id: 'r1', text: '注力分野' }],
    options: [
      { value: 'a', text: '技術' },
      { value: 'b', text: '営業' },
      { value: 'c', text: '企画' }
    ]
  },
  { id: 'Q12', text: '※入力完了後、送信ボタンを押してください', type: 'explanation' }
];

function mulberry32(seed) {
  return function rng() {
    let t = seed += 0x6d2b79f5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rng = mulberry32(26009);

function pickOne(items) {
  return items[Math.floor(rng() * items.length)];
}

function pickMany(items, n) {
  const copied = [...items];
  for (let i = copied.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [copied[i], copied[j]] = [copied[j], copied[i]];
  }
  return copied.slice(0, n);
}

function pad(v, len = 2) {
  return String(v).padStart(len, '0');
}

function ensureDirectory(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function ensureFile(filePath, buffer) {
  ensureDirectory(path.dirname(filePath));
  fs.writeFileSync(filePath, buffer);
}

function toWebMediaPath(category, fileName) {
  return `../media/generated/${SURVEY_ID}/${category}/${fileName}`;
}

// 1x1 PNG (transparent)
const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7Z3xYAAAAASUVORK5CYII=',
  'base64'
);

const JPG_TEMPLATE_PATH = path.join(__dirname, '..', '02_dashboard', 'assets', 'img', 'logo.jpg');
const JPG_TEMPLATE = fs.readFileSync(JPG_TEMPLATE_PATH);

function buildAnsweredAt(dayOffset, serialInDay) {
  // 9:00-19:00の中で分布。12時台は少し弱くなるように重みを置く。
  const weightedHours = [
    9, 9, 10, 10, 10, 11, 11, 11,
    12,
    13, 13, 14, 14, 14, 15, 15, 16, 16, 17, 17, 18, 18, 19
  ];
  const hour = pickOne(weightedHours);
  const minute = Math.floor(rng() * 60);
  const second = Math.floor(rng() * 60);
  const day = 10 + dayOffset;
  return `2026-01-${pad(day)} ${pad(hour)}:${pad(minute)}:${pad(second)}`;
}

function buildAnswerDetail(index) {
  const scoreBase = 1 + Math.floor(rng() * 5);
  const commentsPositive = ['操作が直感的で分かりやすいです。', '導入効果が具体的にイメージできました。', '商談を前向きに検討したいです。'];
  const commentsNeutral = ['社内で検討のうえ改めて連絡します。', '必要資料を確認して判断します。', '他社比較をしてから決めます。'];
  const commentsNegative = ['現時点では予算確保が難しいです。', '既存システムとの連携懸念があります。', '運用面の負荷が気になります。'];
  const nextDates = ['2026-01-15', '2026-01-20', '2026-01-24', '2026-01-28', '2026-02-03'];
  const timeSlots = ['10:00', '11:00', '13:00', '14:00', '15:00', '16:00', '17:00'];

  const handwritingFile = `handwriting_${pad(index, 4)}.png`;
  const attachmentFile = `attachment_${pad(index, 4)}.jpg`;

  return QUESTION_DEFS.map((q) => {
    let answer;
    switch (q.type) {
      case 'single_choice':
        answer = pickOne(q.options);
        break;
      case 'multi_choice':
        answer = pickMany(q.options, 2 + Math.floor(rng() * 2));
        break;
      case 'text':
        answer = `来場者${pad(index, 4)}`;
        break;
      case 'free_text':
        answer = scoreBase >= 4 ? pickOne(commentsPositive) : (scoreBase <= 2 ? pickOne(commentsNegative) : pickOne(commentsNeutral));
        break;
      case 'number':
        answer = 1 + Math.floor(rng() * 10);
        break;
      case 'date':
        answer = pickOne(nextDates);
        break;
      case 'time':
        answer = pickOne(timeSlots);
        break;
      case 'matrix_sa': {
        const matrix = {};
        q.rows.forEach((row) => {
          const drift = Math.floor(rng() * 3) - 1;
          const score = Math.max(1, Math.min(5, scoreBase + drift));
          matrix[row.id] = String(score);
        });
        answer = matrix;
        break;
      }
      case 'matrix_ma': {
        const matrix = {};
        q.rows.forEach((row) => {
          const choices = pickMany(q.options, 1 + Math.floor(rng() * 2)).map((v) => v.value);
          matrix[row.id] = choices;
        });
        answer = matrix;
        break;
      }
      case 'handwriting':
        answer = toWebMediaPath('handwriting', handwritingFile);
        break;
      case 'image':
        answer = toWebMediaPath('attachment', attachmentFile);
        break;
      case 'explanation':
        answer = null;
        break;
      default:
        answer = '';
        break;
    }

    // 一部欠損を混ぜる（説明以外）
    if (q.type !== 'explanation' && rng() < 0.03) {
      answer = q.type === 'multi_choice' ? [] : '';
    }

    return {
      question: q.text,
      answer,
      type: q.type
    };
  });
}

function buildBusinessCard(answerId, index, cardStatusProcessing) {
  if (cardStatusProcessing) {
    return { answerId, businessCard: null };
  }
  const frontFile = `card_front_${pad(index, 4)}.jpg`;
  const backFile = `card_back_${pad(index, 4)}.jpg`;
  return {
    answerId,
    businessCard: {
      imageUrl: {
        front: toWebMediaPath('bizcard', frontFile),
        back: toWebMediaPath('bizcard', backFile)
      },
      group1: {
        email: `expo${pad(index, 4)}@example.co.jp`
      },
      group2: {
        lastName: '展示会',
        firstName: `来場者${pad(index, 4)}`
      },
      group3: {
        companyName: `${pickOne(['東都', '未来', '第一', '共栄', '中央'])}${pickOne(['商事', 'システム', '電機', 'ソリューション', 'テック'])}株式会社`,
        department: pickOne(['営業部', '情報システム部', '経営企画部', '製造技術部', '購買部']),
        position: pickOne(['部長', '課長', '主任', 'マネージャー', '担当'])
      },
      group4: {
        postalCode: '100-0001',
        address1: '東京都千代田区1-1-1',
        address2: 'EXPOビル'
      },
      group5: {
        mobile: `090-${pad(1000 + (index % 9000), 4)}-${pad(1000 + ((index * 7) % 9000), 4)}`,
        tel1: `03-55${pad(10 + (index % 90), 2)}-${pad(1000 + ((index * 5) % 9000), 4)}`
      },
      group6: {
        url: 'https://example.co.jp'
      }
    }
  };
}

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function writeJson(filePath, data) {
  ensureDir(filePath);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

function main() {
  const totalAnswers = DAY_COUNTS.reduce((sum, v) => sum + v, 0);

  const survey = {
    id: SURVEY_ID,
    groupId: 'personal',
    name: {
      ja: '展示会レビュー検証（3日・900件）',
      en: 'Expo Review Validation (3 days / 900 answers)'
    },
    status: '会期中',
    answerCount: totalAnswers,
    periodStart: PERIOD_START,
    periodEnd: PERIOD_END,
    plan: PLAN,
    details: QUESTION_DEFS
  };

  const answers = [];
  const businessCards = [];

  ensureDirectory(BIZCARD_MEDIA_DIR);
  ensureDirectory(HANDWRITING_MEDIA_DIR);
  ensureDirectory(ATTACHMENT_MEDIA_DIR);

  let serial = 1;
  DAY_COUNTS.forEach((count, dayOffset) => {
    for (let i = 0; i < count; i += 1) {
      const answerId = `ans-${SURVEY_ID}-${pad(serial, 4)}`;
      const processing = (serial % 8 === 0); // 約12.5%を進行中扱い

      // 画像は3種で分離して全件分を作成
      ensureFile(path.join(HANDWRITING_MEDIA_DIR, `handwriting_${pad(serial, 4)}.png`), PNG_1X1);
      ensureFile(path.join(ATTACHMENT_MEDIA_DIR, `attachment_${pad(serial, 4)}.jpg`), JPG_TEMPLATE);
      ensureFile(path.join(BIZCARD_MEDIA_DIR, `card_front_${pad(serial, 4)}.jpg`), JPG_TEMPLATE);
      ensureFile(path.join(BIZCARD_MEDIA_DIR, `card_back_${pad(serial, 4)}.jpg`), JPG_TEMPLATE);

      answers.push({
        answerId,
        surveyId: SURVEY_ID,
        answeredAt: buildAnsweredAt(dayOffset, i + 1),
        isTest: (serial % 20 === 0),
        details: buildAnswerDetail(serial)
      });
      businessCards.push(buildBusinessCard(answerId, serial, processing));
      serial += 1;
    }
  });

  const base = path.join(__dirname, '..');
  const surveyFile = path.join(base, 'docs/examples/demo_surveys', `${SURVEY_ID}.json`);
  const answerFile = path.join(base, 'docs/examples/demo_answers', `${SURVEY_ID}.json`);
  const bizFile = path.join(base, 'docs/examples/demo_business-cards', `${SURVEY_ID}.json`);
  const coreSurveysFile = path.join(base, 'data/core/surveys.json');

  writeJson(surveyFile, survey);
  writeJson(answerFile, answers);
  writeJson(bizFile, businessCards);

  const coreSurveys = JSON.parse(fs.readFileSync(coreSurveysFile, 'utf8'));
  const idx = coreSurveys.findIndex((s) => s.id === SURVEY_ID);
  if (idx >= 0) {
    coreSurveys[idx] = survey;
  } else {
    coreSurveys.push(survey);
  }
  writeJson(coreSurveysFile, coreSurveys);

  console.log(`Generated ${SURVEY_ID}: ${answers.length} answers, ${businessCards.length} business-card rows.`);
}

main();

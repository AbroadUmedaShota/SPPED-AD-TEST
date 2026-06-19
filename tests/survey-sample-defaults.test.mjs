import assert from 'node:assert/strict';
import { access, readdir, readFile } from 'node:fs/promises';
import test from 'node:test';

const SAMPLE_SURVEY_ID = 'sv_0003_26010';
const SAMPLE_SURVEY_NAME = 'SPEED AD サンプルアンケート（標準機能確認用）';

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

async function pathExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

test('default new survey template is ready for automatic prefill', async () => {
  const template = await readJson('data/surveys/templates/default-new-survey.json');

  assert.equal(template.namePrefix, '展示会サンプルアンケート');
  assert.equal(template.displayTitle.ja, 'ご来場者アンケート');
  assert.equal(template.periodOffsetDays.start, 1);
  assert.equal(template.periodOffsetDays.end, 7);
  assert.equal(template.questions.length, 4);
  assert.deepEqual(
    template.questions.map((question) => question.text.ja),
    [
      'ご来場の目的を教えてください',
      '興味のあるサービスを選択してください',
      '導入予定時期を教えてください',
      'ご意見・ご要望をご記入ください'
    ]
  );
});

test('global sample survey is data-ready, read-only, and backed by existing sample responses', async () => {
  const coreSurveys = await readJson('data/core/surveys.json');
  const detailSurvey = await readJson(`data/surveys/${SAMPLE_SURVEY_ID}.json`);
  const answers = await readJson(`data/responses/answers/${SAMPLE_SURVEY_ID}.json`);
  const businessCards = await readJson(`data/responses/business-cards/${SAMPLE_SURVEY_ID}.json`);
  const demoSurvey = await readJson(`data/demo/demo_surveys/${SAMPLE_SURVEY_ID}.json`);
  const demoAnswers = await readJson(`data/demo/demo_answers/${SAMPLE_SURVEY_ID}.json`);
  const demoBusinessCards = await readJson(`data/demo/demo_business-cards/${SAMPLE_SURVEY_ID}.json`);
  const enqueteSurvey = await readJson(`data/surveys/enquete/${SAMPLE_SURVEY_ID}.json`);

  const coreSurvey = coreSurveys.find((survey) => survey.id === SAMPLE_SURVEY_ID);
  assert.ok(coreSurvey, 'sample survey must exist in core survey list');

  for (const survey of [coreSurvey, detailSurvey]) {
    assert.equal(survey.name.ja, SAMPLE_SURVEY_NAME);
    assert.equal(survey.isSample, true);
    assert.equal(survey.sampleVisibility, 'all_accounts');
    assert.equal(survey.readOnly, true);
    assert.equal(survey.bypassDownloadDeadline, true);
    assert.equal(survey.status, '完了');
    assert.equal(survey.answerCount, 10);
    assert.equal(survey.periodStart, '2026-06-01');
    assert.equal(survey.periodEnd, '2026-06-15');
    assert.equal(survey.bizcardEnabled, true);
    assert.equal(survey.bizcardRequest, 10);
    assert.equal(survey.bizcardCompletionCount, 10);
    assert.equal(survey.dataCompletionFlag, true);
  }

  assert.equal(answers.answers.length, 10);
  assert.equal(businessCards.length, 10);
  assert.equal(demoSurvey.id, SAMPLE_SURVEY_ID);
  assert.equal(enqueteSurvey.id, SAMPLE_SURVEY_ID);
  assert.ok(Array.isArray(demoAnswers), 'demo answers fallback must be an array');
  assert.ok(Array.isArray(demoBusinessCards), 'demo business card fallback must be an array');
  assert.equal(demoAnswers.length, 10);
  assert.equal(demoBusinessCards.length, 10);

  const expectedQuestionIds = Array.from({ length: 11 }, (_, index) => `Q${index + 1}`);
  const answerIds = new Set(answers.answers.map((answer) => answer.answerId));
  assert.equal(answerIds.size, 10);

  for (const answer of answers.answers) {
    const answeredAt = new Date(answer.answeredAt);
    assert.ok(answeredAt >= new Date('2026-06-01T00:00:00Z'));
    assert.ok(answeredAt <= new Date('2026-06-15T23:59:59Z'));
    assert.deepEqual(
      answer.details.map((detail) => detail.questionId),
      expectedQuestionIds
    );
  }

  assert.ok(
    answers.answers.some((answer) => answer.answeredAt.startsWith('2026-06-15')),
    'at least one sample answer must exist on the service release date'
  );
  assert.equal((await readdir(`media/generated/${SAMPLE_SURVEY_ID}/bizcard`)).length, 20);
  assert.equal((await readdir(`data/media/generated/${SAMPLE_SURVEY_ID}/bizcard`)).length, 20);

  for (const card of businessCards) {
    assert.ok(answerIds.has(card.answerId), `missing answer for business card ${card.answerId}`);
    assert.equal(card.businessCard.status, 'done');

    for (const side of ['front', 'back']) {
      const rawPath = card.businessCard.imageUrl[side];
      assert.ok(rawPath?.startsWith('../media/generated/'), `${side} image must use the served media path`);
      const servedPath = rawPath.replace('../media/', 'media/');
      const dataPath = rawPath.replace('../media/', 'data/media/');
      assert.equal(await pathExists(servedPath), true, `${servedPath} must exist`);
      assert.equal(await pathExists(dataPath), true, `${dataPath} must exist`);
    }
  }
});

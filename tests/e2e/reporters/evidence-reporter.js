const fs = require('fs');
const path = require('path');
const { gasPost, PW_TO_DB_STATUS } = require('../helpers/gas');

/**
 * E2E結果の記録 reporter。
 *
 * 常に行う（ローカル）:
 *  - output/e2e-results/<run_id>/step-results.csv   … scenario_step_results 形式の結果
 *  - output/e2e-results/<run_id>/coverage.csv        … index.html の全 case_id に対する消化状況（209カバレッジ）
 *  - output/e2e-results/<run_id>/defect-observations.json … 失敗を defect_observation 雛形に変換
 *
 * E2E_RECORD=1 かつ GAS_WEB_APP_URL 設定時のみ（共有スプシ）:
 *  - createScenarioRun → upsertScenarioStepResult（scenario_id/step_id を持つ結果のみ）
 *  - appendObservation（失敗を AI観測として登録）
 *
 * 証跡: 各テストの添付（evidence-screenshot / trace 等）のローカルパスを evidence_url に記録する。
 */
class EvidenceReporter {
  constructor() {
    this.rows = [];
    this.startedAt = new Date().toISOString();
    this.runId = 'SRUN-' + this.startedAt.replace(/[-:T.Z]/g, '').slice(0, 14) + '-PW';
    this.outDir = path.join('output', 'e2e-results', this.runId);
  }

  _ann(test, type) {
    return (test.annotations || []).filter((a) => a.type === type).map((a) => a.description);
  }

  _projectOf(test) {
    let s = test.parent;
    while (s) {
      if (typeof s.project === 'function' && s.project()) return s.project().name;
      s = s.parent;
    }
    return '';
  }

  onTestEnd(test, result) {
    const evidence = (result.attachments || [])
      .map((a) => a.path || a.name)
      .filter(Boolean);
    this.rows.push({
      run_id: this.runId,
      project: this._projectOf(test),
      case_ids: this._ann(test, 'case'),
      scenario_id: this._ann(test, 'scenario')[0] || '',
      step_id: this._ann(test, 'step')[0] || '',
      title: test.title,
      status: PW_TO_DB_STATUS[result.status] || result.status,
      actual: result.error ? String(result.error.message || '').replace(/\[[0-9;]*m/g, '').split('\n')[0].slice(0, 400) : '',
      evidence_url: evidence.join(' ; '),
      checked_at: new Date().toISOString(),
      checked_by: process.env.E2E_TESTER || 'Playwright',
    });
  }

  _extractMasterCaseIds() {
    try {
      const html = fs.readFileSync(path.join('99_backend-docs', '08_e2e-testing', 'index.html'), 'utf8');
      const ids = new Set();
      const re = /\bid:\s*'([A-Z][A-Z0-9-]*)'/g;
      let m;
      while ((m = re.exec(html))) ids.add(m[1]);
      return [...ids];
    } catch {
      return [];
    }
  }

  _writeLocal() {
    fs.mkdirSync(this.outDir, { recursive: true });

    // step-results.csv
    const headers = ['run_id', 'project', 'scenario_id', 'step_id', 'case_ids', 'title', 'status', 'actual', 'evidence_url', 'checked_at', 'checked_by'];
    const csv = [headers.join(',')]
      .concat(this.rows.map((r) => headers.map((h) => {
        const v = Array.isArray(r[h]) ? r[h].join('|') : r[h];
        return `"${String(v ?? '').replace(/"/g, '""')}"`;
      }).join(',')))
      .join('\n');
    fs.writeFileSync(path.join(this.outDir, 'step-results.csv'), csv, 'utf8');

    // coverage.csv（209カバレッジ）
    const covered = new Map();
    this.rows.forEach((r) => r.case_ids.forEach((c) => covered.set(c, r.status)));
    const master = this._extractMasterCaseIds();
    const covHeaders = ['case_id', 'covered', 'status'];
    const covLines = master.map((id) => `"${id}","${covered.has(id) ? 'Y' : 'N'}","${covered.get(id) || ''}"`);
    // master外でテストされたcase_id（実機独自IDなど）も残す
    [...covered.keys()].filter((c) => !master.includes(c)).forEach((id) => covLines.push(`"${id}","Y(対象外IDだが実行)","${covered.get(id)}"`));
    const coveredCount = master.filter((id) => covered.has(id)).length;
    fs.writeFileSync(
      path.join(this.outDir, 'coverage.csv'),
      [covHeaders.join(','), ...covLines].join('\n'),
      'utf8'
    );

    // defect-observations.json（失敗→AI観測雛形）
    const defects = this.rows
      .filter((r) => r.status === 'NG')
      .map((r, i) => ({
        observation: {
          observation_id: `${this.runId}-OBS-${i + 1}`,
          case_id: r.case_ids[0] || '',
          source_type: 'AI観測',
          source_role: 'Playwright自動E2E',
          agent_run_id: this.runId,
          verification_status: '未検証',
          note: `${r.title} / ${r.actual}`,
        },
        evidence: r.evidence_url
          ? [{ type: 'screenshot', url_or_path: r.evidence_url, summary: r.title, redaction_status: '未マスク' }]
          : [],
      }));
    fs.writeFileSync(path.join(this.outDir, 'defect-observations.json'), JSON.stringify(defects, null, 2), 'utf8');

    return { coveredCount, masterTotal: master.length, defects };
  }

  async onEnd(result) {
    const { coveredCount, masterTotal, defects } = this._writeLocal();
    const total = this.rows.length;
    const ng = this.rows.filter((r) => r.status === 'NG').length;
    process.stdout.write(
      `\n[evidence-reporter] run_id=${this.runId} 実行=${total} NG=${ng} / ケースカバレッジ=${coveredCount}/${masterTotal}\n` +
      `[evidence-reporter] ローカル出力: ${this.outDir}\n`
    );

    if (!process.env.E2E_RECORD) {
      process.stdout.write('[evidence-reporter] E2E_RECORD未設定のためスプシ送信はスキップ（ローカル記録のみ）\n');
      return;
    }
    if (!process.env.GAS_WEB_APP_URL) {
      process.stdout.write('[evidence-reporter] GAS_WEB_APP_URL未設定のためスプシ送信スキップ\n');
      return;
    }

    // 1) 実行回
    const browser = this.rows[0]?.project || 'chromium';
    const runRes = await gasPost('createScenarioRun', {
      run_id: this.runId,
      environment: 'stg',
      base_url: process.env.STG_BASE_URL || 'https://stg.speed-ad.com',
      tester: process.env.E2E_TESTER || 'Playwright',
      browser,
      viewport: '1280px',
      started_at: this.startedAt,
      ended_at: new Date().toISOString(),
      note: 'Playwright自動E2E',
    });
    process.stdout.write(`[evidence-reporter] createScenarioRun: ${JSON.stringify(runRes).slice(0, 160)}\n`);

    // 2) scenario_id/step_id を持つ結果のみ step_results へ
    const stepRows = this.rows
      .filter((r) => r.scenario_id && r.step_id)
      .map((r) => ({
        run_id: this.runId,
        scenario_id: r.scenario_id,
        step_id: r.step_id,
        status: r.status,
        actual: r.actual || (r.case_ids.length ? `case: ${r.case_ids.join(',')}` : ''),
        evidence_url: r.evidence_url,
        checked_at: r.checked_at,
        checked_by: r.checked_by,
        defect_link: '',
        note: r.title,
      }));
    if (stepRows.length) {
      const upRes = await gasPost('upsertScenarioStepResult', { results: stepRows });
      process.stdout.write(`[evidence-reporter] upsertScenarioStepResult(${stepRows.length}件): ${JSON.stringify(upRes).slice(0, 160)}\n`);
    } else {
      process.stdout.write('[evidence-reporter] scenario_id/step_id付きの結果が無いため step_results 送信なし\n');
    }

    // 3) 失敗を AI観測として登録
    for (const d of defects) {
      const obsRes = await gasPost('appendObservation', d);
      process.stdout.write(`[evidence-reporter] appendObservation: ${JSON.stringify(obsRes).slice(0, 120)}\n`);
    }
  }
}

module.exports = EvidenceReporter;

/* global React */

/* ============================================================
   Shared "evidence-free" components for all 3 themes
   - Before/After comparison
   - Excel export UI mockup
   - Slack notification mockup
   - Post-event timeline
   ============================================================ */

/* Before / After comparison */
function BeforeAfter(){
  return (
    <div className="ba-grid">
      <div className="ba-col before">
        <span className="ba-tag before">Standard では</span>
        <div className="ba-row bad"><span className="ic">✕</span>30日経つと回答データが消えてしまう</div>
        <div className="ba-row bad"><span className="ic">✕</span>名刺データを Excel で取り出せない</div>
        <div className="ba-row bad"><span className="ic">✕</span>新しい回答が入っても気づけない</div>
        <div className="ba-row bad"><span className="ic">✕</span>送信元メールがサービスのドメイン</div>
        <div className="ba-row bad"><span className="ic">✕</span>設問の分岐や画像入力が使えない</div>
      </div>
      <div className="ba-divider"></div>
      <div className="ba-col after">
        <span className="ba-tag after">Premium なら</span>
        <div className="ba-row good"><span className="ic">✓</span>契約期間中、最長1年データを保存</div>
        <div className="ba-row good"><span className="ic">✓</span>ワンクリックで Excel / CSV 出力</div>
        <div className="ba-row good"><span className="ic">✓</span>回答が入ると Slack に即時通知</div>
        <div className="ba-row good"><span className="ic">✓</span>自社ドメインからお礼メール配信</div>
        <div className="ba-row good"><span className="ic">✓</span>分岐・画像・手書き入力に対応</div>
      </div>
    </div>
  );
}

/* Excel-like data table mockup */
function ExcelExportMock(){
  const rows = [
    { num:1, name:'田中 明子', co:'ATELIER Inc.',    tag:'g', tagText:'商談中', date:'04/12 14:32' },
    { num:2, name:'佐藤 健',   co:'PIVOT合同会社',   tag:'b', tagText:'フォロー', date:'04/12 11:08' },
    { num:3, name:'山田 涼太', co:'Sora Studio',    tag:'a', tagText:'新規',     date:'04/11 16:45' },
    { num:4, name:'中村 花',   co:'Northwind',       tag:'g', tagText:'商談中',  date:'04/10 09:22' },
    { num:5, name:'伊藤 大輔', co:'Lumiere Co.',    tag:'b', tagText:'フォロー',  date:'04/09 18:10' },
  ];
  return (
    <div className="ui-mock">
      <div className="ui-mock-bar">
        <div className="dots"><span></span><span></span><span></span></div>
        <span className="url">leads_2026-04.xlsx · 名刺データ・回答記録</span>
      </div>
      <div className="ui-tbl">
        <div className="ui-tbl-row head">
          <div>#</div><div>氏名</div><div>会社名</div><div>ステータス</div><div>受信</div>
        </div>
        {rows.map(r=>(
          <div className="ui-tbl-row" key={r.num}>
            <div className="num">{r.num}</div>
            <div className="name">{r.name}</div>
            <div className="co">{r.co}</div>
            <div><span className={`tag ${r.tag}`}>{r.tagText}</span></div>
            <div className="date">{r.date}</div>
          </div>
        ))}
      </div>
      <div className="ui-mock-action">
        <span>1,284 件中 5 件を表示</span>
        <span className="btn-mini">⬇ Excel / CSV 出力</span>
      </div>
    </div>
  );
}

/* Slack notification mockup */
function SlackMock(){
  return (
    <div className="ui-slack">
      <div className="av">S</div>
      <div className="body">
        <div className="head-line">
          <span className="nm">SPEEDAD</span>
          <span className="bot">APP</span>
          <span className="ts">just now</span>
        </div>
        <div className="msg">新しい回答を受信しました — <strong>#sales-leads</strong> へ通知</div>
        <div className="lead-card">
          <div className="name">田中 明子（ATELIER Inc. / マーケティング部）</div>
          <div className="meta">
            <span className="k">ステータス：</span>商談希望　
            <span className="k">受信：</span>たった今　
            <span className="k">担当：</span>未割当
          </div>
        </div>
      </div>
    </div>
  );
}

/* Post-event timeline (5 steps) */
function PostEventTimeline(){
  return (
    <div className="timeline">
      <div className="tl-step">
        <div className="when">DAY 0 · 展示会当日</div>
        <h4>名刺・アンケート受付</h4>
        <p>来場者から名刺と回答を受け取る。</p>
      </div>
      <div className="tl-step">
        <div className="when now">DAY 1 · 翌日</div>
        <h4>データ化・即営業引き渡し</h4>
        <p>名刺と回答をデータ化、Slackで担当に通知。</p>
        <span className="premium-tag">Premium</span>
      </div>
      <div className="tl-step">
        <div className="when">WEEK 1</div>
        <h4>お礼メール・追客</h4>
        <p>自社ドメインから配信、CRMへ自動投入。</p>
        <span className="premium-tag">Premium</span>
      </div>
      <div className="tl-step">
        <div className="when">MONTH 1</div>
        <h4>月次報告・振り返り</h4>
        <p>Excel出力で集計、施策効果をレポート化。</p>
        <span className="premium-tag">Premium</span>
      </div>
      <div className="tl-step">
        <div className="when">YEAR 1</div>
        <h4>翌年の企画に活用</h4>
        <p>1年保存されたデータから来場者を再活性化。</p>
        <span className="premium-tag">Premium</span>
      </div>
    </div>
  );
}

Object.assign(window, { BeforeAfter, ExcelExportMock, SlackMock, PostEventTimeline });

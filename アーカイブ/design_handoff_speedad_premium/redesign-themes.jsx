/* global React, BeforeAfter, ExcelExportMock, SlackMock, PostEventTimeline */

const RD_COPY = {
  features: [
    { ic:'archive', em:'📦', t:'最長1年データ保存', d:'契約期間中、回答データを保管。後続の分析・報告まで活用できます。', featured:true, badge:'重要' },
    { ic:'edit_note', em:'✏️', t:'設問分岐・画像・手書き', d:'高度な入力フォームに対応。複雑なアンケートも分岐ロジックで整理。' },
    { ic:'download', em:'📊', t:'Excel / CSV 出力', d:'集計・共有・レポート作成に。社内のフォーマットへ即時取り込み。', featured:true, badge:'差分' },
    { ic:'rate_review', em:'🔍', t:'SPEEDレビュー', d:'入力データと画像を並べて確認。修正作業の往復を最小化。' },
    { ic:'domain', em:'🏢', t:'独自ドメイン送信', d:'お礼メールやリマインドを自社ドメインから送信。到達率も改善。' },
    { ic:'language', em:'🌐', t:'多言語対応', d:'作成画面・回答画面の双方を多言語化。海外来場者にもそのまま対応。' },
  ],
  compareRows: [
    { label:'追加設問・機能',  std:'利用不可', pre:'設問分岐・画像・手書き' },
    { label:'多言語対応',      std:'—', pre:'作成・回答画面の多言語' },
    { label:'お礼メール',      std:'制限あり', pre:'独自ドメイン・条件分岐' },
    { label:'分析・レポート',  std:'閲覧のみ', pre:'SPEEDレビュー＋Excel/CSV' },
    { label:'データ保存期間',  std:'30日', pre:'契約期間中、最長1年' },
    { label:'ブランド管理',    std:'標準表示', pre:'独自ドメイン・ロゴ非表示' },
    { label:'ブランド非表示',  std:'SPEEDADロゴ表示', pre:'ロゴ非表示・独自ドメイン' },
  ],
  proFeatures: [
    '最長1年データ保存',
    '設問分岐・画像・手書き入力',
    '多言語対応（作成・回答）',
    '独自ドメインメール配信',
    'SPEEDレビュー＋Excel/CSV出力',
    'ブランド非表示・ロゴ管理',
  ],
  freeFeatures: [
    '基本アンケート機能',
    'SPEEDレビュー（閲覧のみ）',
    '名刺データ化（標準速度）',
    { muted:'最長1年データ保存' },
    { muted:'独自ドメインメール' },
    { muted:'ブランド非表示' },
  ],
};

/* ============================================================
   THEME A — Stripe inspired
   ============================================================ */
function ThemeA({ dark }){
  return (
    <div className={`theme theme-a ${dark?'dark':''}`}>
      <div className="root">
        <div className="container">
          <nav className="a-nav">
            <div className="a-brand"><span className="lg">S</span>SPEEDAD</div>
            <div className="a-nav-links"><a>機能</a><a>料金</a><a>導入事例</a><a>サポート</a></div>
            <div className="a-nav-cta">
              <a className="btn btn-ghost">ログイン</a>
              <a className="btn btn-grad">無料で始める</a>
            </div>
          </nav>

          <header className="a-hero">
            <div>
              <span className="a-eyebrow"><span className="dot"></span>Premium · 初月無料キャンペーン実施中</span>
              <h1 className="a-h1">展示会後のリードを、<br/><span className="grad">入力待ちで止めない。</span></h1>
              <p className="a-lede">最長1年保存・Excel/CSV出力・Slack/CRM連携。展示会後の名刺をすぐ営業に渡せる状態へ整えます。</p>
              <div className="a-cta-row">
                <a className="btn btn-primary btn-lg">プレミアムプランに申し込む →</a>
                <a className="btn btn-ghost btn-lg">資料をダウンロード</a>
              </div>
            </div>
            <div className="a-hero-visual">
              <ExcelExportMock />
              <div className="a-floating">
                <div className="icon-wrap">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                </div>
                <div>
                  <div className="t">ワンクリック出力</div>
                  <div className="d">Excel / CSV / Slack 連携対応</div>
                </div>
              </div>
            </div>
          </header>

          <div className="a-logos">
            <div className="logo">Acme.Inc</div><div className="logo">Sora</div>
            <div className="logo">PIVOT</div><div className="logo">Lumiere</div>
            <div className="logo">Kanata</div><div className="logo">Northwind</div>
          </div>

          {/* Before / After */}
          <section className="a-section">
            <div className="ba-head">
              <span className="eyebrow" style={{fontFamily:'var(--font-mono)',fontSize:12,letterSpacing:'.14em',textTransform:'uppercase',color:'var(--primary)',display:'inline-block',marginBottom:16}}>Before / After</span>
              <h2>運用の困りごとを、Premium で解消する。</h2>
              <p>機能差は数値ではなく、現場の困りごとと解消の対比で見るのが分かりやすい。</p>
            </div>
            <BeforeAfter />
          </section>

          {/* Timeline */}
          <section className="a-section">
            <div className="ba-head">
              <span className="eyebrow" style={{fontFamily:'var(--font-mono)',fontSize:12,letterSpacing:'.14em',textTransform:'uppercase',color:'var(--primary)',display:'inline-block',marginBottom:16}}>Workflow</span>
              <h2>展示会後の動きが、止まらない。</h2>
              <p>受付から1年後の再活性化まで、Premium がカバーする業務範囲。</p>
            </div>
            <PostEventTimeline />
          </section>

          {/* Slack mock pair */}
          <section className="a-section">
            <div className="ba-head">
              <span className="eyebrow" style={{fontFamily:'var(--font-mono)',fontSize:12,letterSpacing:'.14em',textTransform:'uppercase',color:'var(--primary)',display:'inline-block',marginBottom:16}}>Live Notification</span>
              <h2>回答が入った瞬間、営業に届く。</h2>
              <p>Slack に通知が飛び、CRMにも自動投入。担当が初動を逃さない。</p>
            </div>
            <SlackMock />
          </section>

          {/* Features */}
          <section className="a-section">
            <div className="a-section-head">
              <span className="eyebrow">Premium Features</span>
              <h2>展示会後の業務を、<br/>止まらない仕組みに。</h2>
              <p>保存・入力・出力・連携の各面から、リード対応の初動を支援します。</p>
            </div>
            <div className="a-features">
              {RD_COPY.features.map((f,i)=>(
                <div className={`a-feat ${f.featured?'featured':''}`} key={i}>
                  <div className="ic"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M9 9h6v6H9z"/></svg></div>
                  <h3>{f.t}</h3>
                  <p>{f.d}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Pricing */}
          <section className="a-section">
            <div className="a-section-head">
              <span className="eyebrow">Pricing</span>
              <h2>シンプルで明確な料金</h2>
              <p>初月無料・初期費用0円・請求書払い対応。</p>
            </div>
            <div className="a-pricing">
              <div>
                <div className="label-row"><span className="badge">PREMIUM</span></div>
                <h2>すべての機能を、ひとつのプランで。</h2>
                <p className="desc">展示会後のリード対応から月次レポートまで、必要な機能をまとめて。</p>
                <ul className="features">
                  {RD_COPY.proFeatures.map((f,i)=>(
                    <li key={i}><span className="check">✓</span>{f}</li>
                  ))}
                </ul>
              </div>
              <div className="a-pricing-side">
                <div className="free">FIRST MONTH FREE</div>
                <div className="amt"><span className="yen">¥</span>10,000<span className="per">/ 月</span></div>
                <div className="tax">税別 / 1日あたり 約 ¥330</div>
                <a className="btn btn-grad btn-lg" style={{width:'100%',justifyContent:'center'}}>申し込む →</a>
                <div className="breakdown">
                  <div className="r"><span className="k">初期費用</span><span className="v">¥0</span></div>
                  <div className="r"><span className="k">支払い</span><span className="v">請求書払い</span></div>
                  <div className="r"><span className="k">追加アカウント</span><span className="v">¥300 / 名</span></div>
                </div>
              </div>
            </div>
          </section>

          <section className="a-section">
            <div className="a-section-head">
              <span className="eyebrow">Plan Comparison</span>
              <h2>StandardとPremiumの違い</h2>
            </div>
            <div className="a-cmp">
              <div className="a-cmp-row head"><div>機能</div><div>Standard</div><div>Premium</div></div>
              {RD_COPY.compareRows.map((r,i)=>(
                <div className="a-cmp-row" key={i}>
                  <div className="label">{r.label}</div>
                  <div className="std">{r.std}</div>
                  <div className="pre">{r.pre}</div>
                </div>
              ))}
            </div>
          </section>

          <section className="a-cta-final">
            <h2>Premiumで、展示会後の動きを止めない。</h2>
            <p>初月無料・初期費用0円・請求書払い対応。今すぐ始められます。</p>
            <a className="btn btn-light btn-lg">プレミアムプランに申し込む →</a>
          </section>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   THEME B — Linear inspired
   ============================================================ */
function ThemeB({ dark=true }){
  return (
    <div className={`theme theme-b ${dark?'':'light'}`}>
      <div className="root">
        <div className="container">
          <nav className="b-nav">
            <div className="b-brand"><span className="lg">S</span>SPEEDAD</div>
            <div className="b-nav-mid"><a>Features</a><a>Pricing</a><a>Customers</a><a>Changelog</a><a>Docs</a></div>
            <div className="b-nav-r">
              <span className="b-kbd">⌘ K</span>
              <a className="btn btn-ghost">ログイン</a>
              <a className="btn btn-primary">申し込む</a>
            </div>
          </nav>

          <header className="b-hero">
            <div>
              <span className="b-eyebrow">Premium · 1年データ保存対応<span className="arrow">→</span></span>
              <h1 className="b-h1">展示会後のリードを、<br/>仕組みで動かす。</h1>
              <p className="b-lede">保存・出力・多言語を一元化。SPEEDADプレミアムは、展示会後の業務初動を再現可能なワークフローに変える。</p>
              <div className="b-price-summary">
                <div className="b-price-amt"><span className="yen">¥</span>10,000<span className="per">/ 月（税別）</span></div>
                <div className="b-price-meta">
                  <span><span className="dot"></span>初月無料</span>
                  <span><span className="dot"></span>初期費用 ¥0</span>
                  <span><span className="dot"></span>請求書払い対応</span>
                </div>
              </div>
              <div className="b-cta-row">
                <a className="btn btn-primary btn-lg">申し込む</a>
                <a className="btn btn-ghost btn-lg">デモを見る →</a>
              </div>
            </div>
            <ExcelExportMock />
          </header>

          <div className="b-clients">
            <span className="lab">// Trusted teams</span>
            <span className="logo">Acme.Inc</span>
            <span className="logo">PIVOT</span>
            <span className="logo">Sora</span>
            <span className="logo">Lumiere</span>
            <span className="logo">Northwind</span>
          </div>

          {/* Before/After */}
          <section className="b-section">
            <div className="b-section-head">
              <span className="eyebrow">// BEFORE / AFTER</span>
              <h2>困りごとを、機能で解消する。</h2>
              <p>Standard プランで止まりがちな業務を、Premium で再開させる。</p>
            </div>
            <BeforeAfter />
          </section>

          {/* Workflow timeline */}
          <section className="b-section">
            <div className="b-section-head">
              <span className="eyebrow">// WORKFLOW</span>
              <h2>展示会後 1年間のワークフロー</h2>
              <p>Premium がカバーする業務範囲を時間軸で。</p>
            </div>
            <PostEventTimeline />
          </section>

          {/* Bento features */}
          <section className="b-section">
            <div className="b-section-head">
              <span className="eyebrow">// FEATURES</span>
              <h2>Premiumに含まれる機能</h2>
            </div>
            <div className="b-bento">
              <div className="cell featured span-3 row-2">
                <span className="pin">差分1</span>
                <div className="ic"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg></div>
                <h3>最長1年データ保存</h3>
                <p>契約期間中、回答データを長期保管。後続の分析・報告まで継続活用できます。</p>
                <p style={{marginTop:12,color:'var(--fg-muted)',fontSize:12}}>Standard：30日 → Premium：契約期間中（最長1年）</p>
              </div>
              <div className="cell featured span-3">
                <span className="pin">差分2</span>
                <div className="ic"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg></div>
                <h3>Excel / CSV 出力</h3>
                <p>集計・共有・レポート作成に。社内フォーマットへ即時取り込み可能。</p>
              </div>
              <div className="cell span-3">
                <div className="ic"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12h18M12 3v18"/></svg></div>
                <h3>設問分岐・画像・手書き</h3>
                <p>高度な入力フォームに対応。</p>
              </div>
              <div className="cell span-2">
                <div className="ic"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9"/><path d="M9 12l2 2 4-4"/></svg></div>
                <h3>SPEEDレビュー</h3>
                <p>入力と画像を並べて確認。</p>
              </div>
              <div className="cell span-2">
                <div className="ic"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 21V7l9-4 9 4v14M9 21V12h6v9"/></svg></div>
                <h3>独自ドメイン送信</h3>
                <p>到達率も改善。</p>
              </div>
              <div className="cell span-2">
                <div className="ic"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9"/><path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20"/></svg></div>
                <h3>多言語対応</h3>
                <p>作成・回答画面を多言語化。</p>
              </div>
            </div>
          </section>

          <section className="b-section">
            <div className="b-section-head">
              <span className="eyebrow">// PRICING</span>
              <h2>明確で、隠れない料金</h2>
            </div>
            <div className="b-pricing">
              <div className="b-pricing-head">
                <div className="dots"><span></span><span></span><span></span></div>
                <span style={{fontFamily:'var(--font-mono)'}}>~/billing/premium · invoice.json</span>
              </div>
              <div className="b-pricing-body">
                <div className="b-pricing-l">
                  <div className="lab">PREMIUM PLAN</div>
                  <h3>展示会後のリード対応に必要なすべて</h3>
                  <p>保存・入力・出力・連携を1つのプランで。月額のみ、追加機能は従量で透明。</p>
                  <ul className="feat">
                    {RD_COPY.proFeatures.map((f,i)=>(
                      <li key={i}><span className="ck">✓</span>{f}</li>
                    ))}
                  </ul>
                </div>
                <div className="b-pricing-r">
                  <span className="free-tag">● First month free</span>
                  <div className="amt"><span className="yen">¥</span>10,000<span className="per">/ month</span></div>
                  <div className="tax">税別 · 月末締め翌月末払い</div>
                  <div className="breakdown">
                    <div className="r"><span className="k">$ initial_fee</span><span className="v">¥0</span></div>
                    <div className="r"><span className="k">$ extra_seats</span><span className="v">¥300 / 名</span></div>
                    <div className="r"><span className="k">$ payment</span><span className="v">invoice</span></div>
                    <div className="r"><span className="k">$ contract</span><span className="v">monthly</span></div>
                  </div>
                  <a className="btn btn-primary btn-lg">$ subscribe --plan=premium</a>
                </div>
              </div>
            </div>
          </section>

          <section className="b-section">
            <div className="b-section-head">
              <span className="eyebrow">// COMPARISON</span>
              <h2>Standard vs Premium</h2>
            </div>
            <div className="b-cmp">
              <div className="b-cmp-row head"><div>FEATURE</div><div>STANDARD</div><div>PREMIUM</div></div>
              {RD_COPY.compareRows.map((r,i)=>(
                <div className="b-cmp-row" key={i}>
                  <div className="label">{r.label}</div>
                  <div className="std">{r.std}</div>
                  <div className="pre">{r.pre}</div>
                </div>
              ))}
            </div>
          </section>

          <section className="b-cta-final">
            <div className="b-cta-final-inner">
              <div>
                <h2>Ready to ship?</h2>
                <p>初月無料・初期費用0円・請求書払い対応。今すぐ始められます。</p>
                <div className="meta">
                  <span><span className="dot"></span>請求書払い</span>
                  <span><span className="dot"></span>初期費用 0円</span>
                  <span><span className="dot"></span>初月無料</span>
                </div>
              </div>
              <a className="btn btn-primary btn-lg">申し込む →</a>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   THEME C — Notion inspired
   ============================================================ */
function ThemeC({ dark }){
  return (
    <div className={`theme theme-c ${dark?'dark':''}`}>
      <div className="root">
        <div className="container">
          <nav className="c-nav">
            <div className="c-brand"><span className="lg">S</span>SPEEDAD</div>
            <div className="c-nav-links"><a>機能</a><a>料金</a><a>導入事例</a><a>テンプレート</a><a>ヘルプ</a></div>
            <div style={{display:'flex',gap:8}}>
              <a className="btn btn-ghost">ログイン</a>
              <a className="btn btn-primary">申し込む</a>
            </div>
          </nav>

          <header className="c-hero">
            <div>
              <div className="c-page-meta">
                <span className="emoji">📊</span>
                <span className="breadcrumb"><a>ホーム</a><span className="sep">/</span><a>料金</a><span className="sep">/</span><span>Premium</span></span>
              </div>
              <h1 className="c-h1">展示会後のリードを、<br/><span className="underline">きちんと整える</span>仕組み。</h1>
              <p className="c-lede">最長1年保存、Excel/CSV出力、独自ドメイン送信。展示会後の名刺対応を、データベースのように整理して扱えます。</p>
              <div className="c-price-summary">
                <div className="c-price-amt"><span className="yen">¥</span>10,000<span className="per">/ 月（税別）</span></div>
                <div className="c-price-meta">
                  <span>✨ 初月無料</span>
                  <span>💳 初期費用 ¥0</span>
                  <span>📄 請求書払い対応</span>
                </div>
              </div>
              <div className="c-cta-row">
                <a className="btn btn-primary btn-lg">プレミアムプランに申し込む</a>
                <a className="btn btn-ghost btn-lg">資料をダウンロード</a>
              </div>
            </div>
            <ExcelExportMock />
          </header>

          {/* Before/After */}
          <section className="c-section">
            <div className="c-section-head">
              <span className="eyebrow"><span>🔄</span>Before / After</span>
              <h2>運用の困りごとが、解消されます。</h2>
              <p>Standard で止まる業務を、Premium がそのまま続けられる仕組みにします。</p>
            </div>
            <BeforeAfter />
          </section>

          {/* Timeline */}
          <section className="c-section">
            <div className="c-section-head">
              <span className="eyebrow"><span>📅</span>展示会後のワークフロー</span>
              <h2>当日 → 翌日 → 1週間 → 1ヶ月 → 1年。</h2>
              <p>Premium がカバーする業務範囲を、時間軸で確認できます。</p>
            </div>
            <PostEventTimeline />
          </section>

          {/* Features */}
          <section className="c-section">
            <div className="c-section-head">
              <span className="eyebrow"><span>⚙️</span>Premium機能</span>
              <h2>展示会後の業務を、<br/>整理して扱える仕組みに。</h2>
              <p>保存・入力・出力・連携の各面から、リード対応の初動を支援します。</p>
            </div>
            <div className="c-blocks">
              {RD_COPY.features.map((f,i)=>(
                <div className={`c-block ${f.featured?'featured':''}`} key={i}>
                  <span className="em">{f.em}</span>
                  <h3>{f.t}</h3>
                  <p>{f.d}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="c-section">
            <div className="c-section-head">
              <span className="eyebrow"><span>💰</span>料金プラン</span>
              <h2>必要な分だけ、シンプルに。</h2>
            </div>
            <div className="c-pricing">
              <div className="c-plan">
                <div className="name">STANDARD</div>
                <div className="amt"><span className="yen">¥</span>0<span className="per">/ 月</span></div>
                <div className="desc">基本のアンケート・名刺データ化機能を試したい方向け。</div>
                <ul>
                  {RD_COPY.freeFeatures.map((f,i)=>(
                    typeof f === 'string'
                      ? <li key={i}><span className="ck">✓</span>{f}</li>
                      : <li key={i} className="muted"><span className="x">×</span>{f.muted}</li>
                  ))}
                </ul>
                <a className="btn btn-ghost">無料で始める</a>
              </div>
              <div className="c-plan pro">
                <div className="name" style={{color:'var(--primary)'}}>PREMIUM</div>
                <div className="amt"><span className="yen">¥</span>10,000<span className="per">/ 月</span></div>
                <div className="desc">展示会後のリード対応に必要なすべての機能を含むプラン。初月無料・税別。</div>
                <ul>
                  {RD_COPY.proFeatures.map((f,i)=>(
                    <li key={i}><span className="ck">✓</span>{f}</li>
                  ))}
                </ul>
                <a className="btn btn-primary">プレミアムプランに申し込む</a>
              </div>
            </div>
          </section>

          <section className="c-section">
            <div className="c-section-head">
              <span className="eyebrow"><span>🔍</span>機能比較</span>
              <h2>Standard と Premium の違い</h2>
            </div>
            <div className="c-cmp">
              <div className="c-cmp-row head"><div>機能</div><div>Standard</div><div>Premium</div></div>
              {RD_COPY.compareRows.map((r,i)=>(
                <div className="c-cmp-row" key={i}>
                  <div className="label">{r.label}</div>
                  <div className="std">{r.std}</div>
                  <div className="pre">{r.pre}</div>
                </div>
              ))}
            </div>
          </section>

          <section className="c-cta-final">
            <span className="em">🚀</span>
            <h2>展示会後の動きを、止めない。</h2>
            <p>初月無料・初期費用0円・請求書払い対応。今日から、リード対応を整え始められます。</p>
            <a className="btn btn-primary btn-lg">プレミアムプランに申し込む</a>
            <div className="meta-row">
              <span>✓ 月額¥10,000（税別）</span>
              <span>✓ 初月無料（新規のみ）</span>
              <span>✓ 請求書払い対応</span>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { ThemeA, ThemeB, ThemeC, RD_COPY });

// plans-data.jsx — 共通データ / アイコン / スペック描画関数 / 基本カード
// window へ export: PLANS, Icon, SpeedMeter, SPEC, PlanCard, Row

const PLANS = [
{ key: 'trial', name: 'お試し', icon: 'flask', price: '0', items: '2項目', days: '6',
  convShort: '会期終了から6営業日', convFull: '会期終了から6営業日でデータ化',
  speed: 1, tone: '#8AA0B8',
  desc: '初回の動作確認やお試し利用に適しています。' },
{ key: 'normal', name: '通常', icon: 'clock', price: '50', items: '10項目', days: '6',
  convShort: '会期終了から6営業日', convFull: '会期終了から6営業日でデータ化',
  speed: 1, tone: '#5B83BC',
  desc: '納期に余裕があり、コストを抑えて標準的にデータ化したい場合に適しています。' },
{ key: 'express', name: '特急', icon: 'gauge', price: '100', items: '10項目', days: '3',
  convShort: '会期終了から3営業日', convFull: '会期終了から3営業日でデータ化',
  speed: 2, tone: '#3E6AD6',
  desc: '会期後の営業フォローを数営業日以内に始めたい場合に適しています。' },
{ key: 'super', name: '超特急', icon: 'nav', price: '150', items: '10項目', days: '1',
  convShort: '会期終了から1営業日', convFull: '会期終了から1営業日でデータ化',
  speed: 3, tone: '#27459E',
  desc: '翌営業日までに確認し、優先度の高い来場者から対応したい場合に適しています。' },
{ key: 'ondemand', name: 'オンデマンド', icon: 'bolt', price: '200', items: '10項目', days: '当日',
  convShort: '会期当日', convFull: '会期当日にデータ化',
  speed: 4, tone: '#C2922F', premium: true,
  desc: '当日中に確認し、会期中の判断や即時フォローに活用したい場合に適しています。プレミアムプラン申込者が対象です。' }];


function Icon({ name, size = 22 }) {
  const c = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round' };
  switch (name) {
    case 'flask':return <svg {...c}><path d="M9 3h6" /><path d="M10 3v6.5L5.6 17a2.4 2.4 0 0 0 2.1 3.6h8.6a2.4 2.4 0 0 0 2.1-3.6L14 9.5V3" /><path d="M7.5 14h9" /></svg>;
    case 'clock':return <svg {...c}><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 1.8" /></svg>;
    case 'gauge':return <svg {...c}><path d="M4.5 18a8.5 8.5 0 1 1 15 0" /><path d="M12 14.5 15.5 10" /><circle cx="12" cy="14.5" r="0.6" fill="currentColor" /></svg>;
    case 'nav':return <svg {...c}><polygon points="20 4 4 11 11 13 13 20 20 4" /></svg>;
    case 'bolt':return <svg {...c} fill="currentColor" stroke="none"><polygon points="13 2 4.5 13.5 11 13.5 9 22 19.5 10 12.5 10 13 2" /></svg>;
    case 'doc':return <svg {...c}><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M9 8h6M9 12h6M9 16h3" /></svg>;
    case 'cal':return <svg {...c}><rect x="4" y="5" width="16" height="16" rx="2" /><path d="M4 9h16M8 3v4M16 3v4" /></svg>;
    default:return null;
  }
}

function SpeedMeter({ level, color, seg = 4 }) {
  return (
    <div className="sp-meter" aria-hidden="true">
      {Array.from({ length: seg }).map((_, i) =>
      <span key={i} className={'sp-seg' + (i < level ? ' on' : '')} style={i < level ? { background: color } : null} />
      )}
    </div>);

}

/* ---------- スペック描画関数（共通プール） ---------- */
const SPEC = {
  rows(p) {return (
      <div className="sp-rows">
      <div className="sp-r"><span className="sp-k">項目数</span><span className="sp-v">{p.items}</span></div>
      <div className="sp-hr" />
      <div className="sp-r sp-r--top"><span className="sp-k">データ化</span><span className="sp-v sp-v--r">{p.premium ? '会期当日' : p.convShort}</span></div>
    </div>);},

  badge(p) {return (
      <div className="sp-badge-wrap">
      <div className={'sp-badge' + (p.premium ? ' prem' : '')} style={!p.premium ? { '--tone': p.tone } : null}>
        {p.premium ? '会期当日にデータ化' : <>会期終了から <b>{p.days}</b> 営業日でデータ化</>}
      </div>
      <span className="sp-chip">{p.items}</span>
    </div>);},

  big(p) {return (
      <div className="sp-big">
      <div className="sp-bigrow">
        <span className="sp-num" style={{ color: p.tone }}>{p.premium ? '当日' : p.days}</span>
        {!p.premium && <span className="sp-suf">営業日後</span>}
      </div>
      <div className="sp-cap">{p.premium ? '会期当日にデータ化' : '会期終了からデータ化'}</div>
      <span className="sp-chip">{p.items}</span>
    </div>);},

  iconlist(p) {return (
      <div className="sp-list">
      <div className="sp-li"><Icon name="doc" size={15} /><span>{p.items}</span></div>
      <div className="sp-li">
        <span className="sp-li-ic" style={{ color: p.tone }}><Icon name={p.premium ? 'bolt' : 'cal'} size={15} /></span>
        <span className="sp-li-strong">{p.convFull}</span>
      </div>
    </div>);},

  caption(p) {return (
      <div className="sp-cap2">
      <div className="sp-cap2-main" style={{ color: p.tone }}>{p.premium ? '会期当日' : `会期終了から${p.days}営業日`}</div>
      <div className="sp-cap2-sub">{p.premium ? '会期中にデータ化 ・ ' + p.items : 'でデータ化 ・ ' + p.items}</div>
    </div>);},

  meter(p) {return (
      <div className="sp-mtr">
      <div className="sp-mtr-top"><span className="sp-chip">{p.items}</span><SpeedMeter level={p.speed} color={p.tone} /></div>
      <div className="sp-mtr-time">
        <span className="sp-mtr-when" style={{ color: p.tone }}>{p.premium ? '会期当日' : `${p.days}営業日`}</span>
        <span className="sp-mtr-lbl">{p.premium ? 'にデータ化（会期中）' : 'でデータ化（会期終了後）'}</span>
      </div>
    </div>);},

  compact(p) {return (
      <div className="sp-cmp">
      <div className="sp-cmp-tags"><span className="sp-chip">{p.items}</span><span className="sp-chip strong" style={{ '--tone': p.tone }}>{p.premium ? '会期当日' : `${p.days}営業日`}</span></div>
      <div className="sp-cmp-sub">{p.premium ? '会期当日にデータ化' : '会期終了からデータ化'}</div>
    </div>);}
};

/* ---------- 基本カード（テーマは祖先クラスで上書き） ---------- */
function PlanCard({ plan, spec }) {
  const render = SPEC[spec] || SPEC.rows;
  return (
    <div className={'c' + (plan.premium ? ' c--prem' : '')} style={{ '--tone': plan.tone }}>
      <div className="c-ico"><Icon name={plan.icon} /></div>
      <div className="c-name">{plan.name}</div>
      {plan.premium && <div className="c-prem">プレミアム</div>}
      <div className="c-price"><span className="c-num">{plan.price}</span><span className="c-unit">円/枚</span></div>
      <div className="c-spec">{render(plan)}</div>
      <p className="c-desc">{plan.desc}</p>
    </div>);

}

function Row({ theme, spec }) {
  return (
    <div className={'row ' + theme}>
      {PLANS.map((p) => <PlanCard key={p.key} plan={p} spec={spec} />)}
    </div>);

}

Object.assign(window, { PLANS, Icon, SpeedMeter, SPEC, PlanCard, Row });
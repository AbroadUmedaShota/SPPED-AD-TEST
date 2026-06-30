// <req-opt-toggle> — 必須/任意のセグメント型トグル
// value 属性: 'required' | 'optional'。選択変更時に change イベント（detail.value）を発火する。
(function () {
  if (customElements.get('req-opt-toggle')) return;
  var FONT_ID = 'noto-sans-jp-400-700';
  function ensureFont() {
    if (document.getElementById(FONT_ID)) return;
    var l = document.createElement('link');
    l.id = FONT_ID; l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400..700&display=swap';
    document.head.appendChild(l);
  }
  var REQ = { color: '#e24a5f', bg: '#fdecef' };   // 必須（赤）
  var OPT = { color: '#2fa45f', bg: '#e9f6ef' };   // 任意（緑）
  var GRAY = '#b4b4bd', SLASH = '#d2d2da';

  class ReqOptToggle extends HTMLElement {
    static get observedAttributes() { return ['value']; }
    static formAssociated = true;
    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
      try { this._internals = this.attachInternals(); } catch (e) { this._internals = null; }
    }
    connectedCallback() {
      ensureFont();
      if (!this.hasAttribute('value')) this.setAttribute('value', this.getAttribute('default') || 'required');
      this._render(); this._syncForm();
    }
    attributeChangedCallback() { if (this.shadowRoot.firstChild) { this._render(); this._syncForm(); } }
    get value() { return this.getAttribute('value') === 'optional' ? 'optional' : 'required'; }
    set value(v) { this.setAttribute('value', v === 'optional' ? 'optional' : 'required'); }
    _syncForm() { if (this._internals) this._internals.setFormValue(this.value); }
    _select(v) {
      if (this.value === v) return;
      this.value = v;
      this.dispatchEvent(new CustomEvent('change', { bubbles: true, detail: { value: v } }));
    }
    _toggle() { this._select(this.value === 'required' ? 'optional' : 'required'); }
    _render() {
      var on = this.value === 'required';
      var ms = this.getAttribute('anim-ms') || 250;
      var trans = 'color ' + ms + 'ms ease, transform ' + ms + 'ms ease, font-variation-settings ' + ms + 'ms ease, background-color ' + ms + 'ms ease';
      var act = on ? REQ : OPT;
      function word(isOn, col) {
        return "display:inline-flex;align-items:center;justify-content:center;min-width:33px;"
          + "font-family:'Noto Sans JP',sans-serif;cursor:pointer;transform-origin:center;transition:" + trans + ";"
          + "color:" + (isOn ? col : GRAY) + ";font-weight:" + (isOn ? 700 : 400) + ";"
          + "font-variation-settings:'wght' " + (isOn ? 700 : 400) + ";transform:scale(" + (isOn ? 1.06 : 1) + ");";
      }
      var label = (on ? '必須' : '任意') + '（クリックで' + (on ? '任意' : '必須') + 'に切り替え）';
      this.shadowRoot.innerHTML =
        '<div data-toggle role="button" tabindex="0" aria-label="' + label + '" aria-pressed="' + on + '" '
        + 'style="display:inline-flex;align-items:center;gap:7px;'
        + 'background:' + act.bg + ';border-radius:10px;padding:6px 13px;font-size:14px;line-height:1;'
        + 'cursor:pointer;user-select:none;transition:' + trans + ';-webkit-tap-highlight-color:transparent;box-sizing:border-box;">'
        + '<span aria-hidden="true" style="' + word(on, REQ.color) + '">必須</span>'
        + '<span aria-hidden="true" style="color:' + SLASH + ';font-size:13px;">/</span>'
        + '<span aria-hidden="true" style="' + word(!on, OPT.color) + '">任意</span>'
        + '</div>';
      var self = this;
      var box = this.shadowRoot.querySelector('[data-toggle]');
      box.onclick = function () { self._toggle(); };
      box.onkeydown = function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); self._toggle(); } };
    }
  }
  customElements.define('req-opt-toggle', ReqOptToggle);
})();

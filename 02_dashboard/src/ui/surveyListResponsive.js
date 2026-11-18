/**
 * @file surveyListResponsive.js
 * アンケート一覧の 1023px 以下の表示で使う、一覧の上のツールバー（表示件数・絞り込み・並べ替え）の開閉制御。
 * 見た目と幅ごとの出し分けは service-top-style.css の「アンケート一覧: レスポンシブ」が担う。
 * 絞り込み・並べ替え・ページ送りの処理は tableManager.js のものをそのまま使い、ここでは中身を持たない。
 *
 * 状態（開いている・条件あり・並べ替え中）は、class ではなく属性（data-open / data-active / aria-pressed）で持つ。
 * この画面は Tailwind の CDN 版を使っており、画面に新しい class 名が現れるたびに CSS を作り足す。
 * 作り足しが一覧の行の描画と重なると、行のバッジの色などが取りこぼされて付かなくなるため、
 * ここでは class 名を増やさない。
 */

import { sortSurveysByKey } from '../tableManager.js';

const NARROW_MEDIA_QUERY = '(max-width: 1023px)';
const FILTER_INPUT_IDS = ['searchKeyword', 'filterStatus', 'filterStartDate', 'filterEndDate'];
const DATE_PICKER_WRAPPER_IDS = ['startDatePickerWrapper', 'endDatePickerWrapper'];

/**
 * 絞り込みの入力欄のうち、条件が入っているものの数を返します。
 * ステータスは「全てのステータス」（all）を条件なしとして扱います。
 * @returns {number} 条件が入っている欄の数（0〜4）。
 */
function countFilterConditions() {
  return FILTER_INPUT_IDS.filter((id) => {
    const input = document.getElementById(id);
    if (!input) return false;
    const value = input.value.trim();
    return id === 'filterStatus' ? value !== '' && value !== 'all' : value !== '';
  }).length;
}

/**
 * リセットで空になった日付欄について、日付選択（flatpickr）側の表示も空にそろえます。
 * スマートフォン・タブレットの実機では flatpickr が端末標準の日付入力を別に出すため、
 * 元の入力欄だけを空にしても、画面には前の日付が残ってしまう。絞り込みの結果には触れず、
 * 変更の通知も出さない（clear の引数 false）。
 */
function syncClearedDatePickers() {
  DATE_PICKER_WRAPPER_IDS.forEach((id) => {
    const wrapper = document.getElementById(id);
    const picker = wrapper ? wrapper._flatpickr : null;
    if (!picker || !picker.input || picker.input.value !== '') return;
    if (picker.selectedDates.length > 0) {
      picker.clear(false);
    }
  });
}

/**
 * 一覧の上のツールバーを初期化します。
 * 必要な要素が無い画面では何もしません。
 */
export function initSurveyListResponsive() {
  const controls = document.getElementById('surveyListControls');
  const filterButton = document.getElementById('toggleSurveyFilterBtn');
  const sortButton = document.getElementById('toggleSurveySortBtn');
  const filterPanel = document.getElementById('surveyFilterPanel');
  const sortMenu = document.getElementById('surveySortMenu');
  const perPageGroup = document.getElementById('itemsPerPageGroup');
  const perPageSlot = document.getElementById('itemsPerPageSlotTop');
  const pagination = document.getElementById('surveyPagination');
  const resetButton = document.getElementById('resetFiltersButton');
  const filterCount = document.getElementById('surveyFilterCount');
  const sortSummary = document.getElementById('surveySortSummary');
  const sortSummaryLabel = document.getElementById('surveySortSummaryLabel');
  const sortSummaryIcon = document.getElementById('surveySortSummaryIcon');
  const sortSummaryDirection = document.getElementById('surveySortSummaryDirection');
  const tableBody = document.getElementById('surveyTableBody');

  if (!controls || !filterButton || !sortButton || !filterPanel || !sortMenu) {
    return;
  }

  const narrowQuery = window.matchMedia(NARROW_MEDIA_QUERY);
  /** @type {'filter'|'sort'|null} 開いているもの。同時に開くのは片方だけ。 */
  let openPanel = null;

  const render = () => {
    const filterOpen = openPanel === 'filter';
    const sortOpen = openPanel === 'sort';
    filterPanel.dataset.open = String(filterOpen);
    sortMenu.dataset.open = String(sortOpen);
    filterButton.setAttribute('aria-expanded', String(filterOpen));
    sortButton.setAttribute('aria-expanded', String(sortOpen));
    // 絞り込みボタンは、開いている間と、条件が入っている間は青にする。
    // 条件が入っている間は、その数をボタンの右上に出す（色だけでは絞り込み中だと気づきにくいため）。
    const conditionCount = countFilterConditions();
    filterButton.dataset.active = String(filterOpen || conditionCount > 0);
    if (filterCount) {
      const countText = conditionCount > 0 ? String(conditionCount) : '';
      if (filterCount.textContent !== countText) {
        filterCount.textContent = countText;
      }
      filterCount.hidden = conditionCount === 0;
    }
    if (conditionCount > 0) {
      filterButton.setAttribute('aria-label', `絞り込み（条件 ${conditionCount} 件）`);
    } else {
      filterButton.removeAttribute('aria-label');
    }
    sortButton.dataset.active = String(sortOpen);
  };

  const setOpenPanel = (next) => {
    openPanel = next;
    render();
  };

  const togglePanel = (name) => {
    setOpenPanel(openPanel === name ? null : name);
  };

  filterButton.addEventListener('click', () => togglePanel('filter'));
  sortButton.addEventListener('click', () => togglePanel('sort'));

  // 条件の有無でボタンの色を切り替える。値を読むだけで、絞り込みの処理には触れない。
  filterPanel.addEventListener('input', render);
  filterPanel.addEventListener('change', render);
  if (resetButton) {
    // リセットは tableManager.js が入力欄を直接空にする。その後に色を戻す。
    resetButton.addEventListener('click', () => {
      window.setTimeout(() => {
        syncClearedDatePickers();
        render();
      }, 0);
    });
  }

  // 並べ替えメニュー: 列見出しを押したときと同じ関数を呼び、並べ替えたらメニューを閉じる。
  // 逆順にするときは、メニューを開き直して同じ項目をもう一度押す。
  const sortItems = Array.from(sortMenu.querySelectorAll('.survey-sort-menu__item'));
  sortItems.forEach((item) => {
    item.addEventListener('click', () => {
      const hadFocus = document.activeElement === item;
      sortSurveysByKey(item.dataset.sortKey);
      setOpenPanel(null);
      // 押した項目はメニューごと見えなくなる。フォーカスを持っていた場合は「並べ替え」ボタンへ戻す。
      if (hadFocus) {
        sortButton.focus({ preventScroll: true });
      }
    });
  });

  // メニューの表示（並べ替え中の項目と矢印）は、列見出しの状態を写す。
  const syncSortMenu = () => {
    let sortedLabel = '';
    let sortedIcon = '';
    let sortedDirection = '';
    sortItems.forEach((item) => {
      const header = Array.from(document.querySelectorAll('.sortable-header'))
        .find((candidate) => candidate.dataset.sortKey === item.dataset.sortKey);
      const ariaSort = header ? header.getAttribute('aria-sort') : 'none';
      const isSorted = ariaSort === 'ascending' || ariaSort === 'descending';
      const headerIcon = header ? header.querySelector('.sort-icon') : null;
      const itemIcon = item.querySelector('.survey-sort-menu__icon');
      const iconName = isSorted && headerIcon ? headerIcon.textContent.trim() : 'unfold_more';
      // 並べ替え中の見た目は aria-pressed を見て CSS が付ける。変わらないときは DOM に触れない。
      if (item.getAttribute('aria-pressed') !== String(isSorted)) {
        item.setAttribute('aria-pressed', String(isSorted));
      }
      if (itemIcon && itemIcon.textContent !== iconName) {
        itemIcon.textContent = iconName;
      }
      if (isSorted) {
        const itemLabel = item.querySelector('span');
        sortedLabel = itemLabel ? itemLabel.textContent.trim() : '';
        sortedIcon = iconName;
        sortedDirection = ariaSort === 'ascending' ? '昇順' : '降順';
      }
    });

    // ツールバーの下に、いまの並び順（項目と向き）を出す。メニューを閉じたあとも分かるようにする。
    if (sortSummary && sortSummaryLabel && sortSummaryIcon) {
      if (sortSummaryLabel.textContent !== sortedLabel) {
        sortSummaryLabel.textContent = sortedLabel;
      }
      if (sortSummaryIcon.textContent !== sortedIcon) {
        sortSummaryIcon.textContent = sortedIcon;
      }
      // 矢印のアイコンは読み上げられないので、読み上げ用に向きを文字でも持つ（画面には出さない）
      if (sortSummaryDirection && sortSummaryDirection.textContent !== sortedDirection) {
        sortSummaryDirection.textContent = sortedDirection;
      }
      sortSummary.hidden = sortedLabel === '';
    }
  };

  const tableHead = document.querySelector('#surveyTable thead');
  if (tableHead && 'MutationObserver' in window) {
    new MutationObserver(syncSortMenu).observe(tableHead, {
      attributes: true,
      attributeFilter: ['aria-sort'],
      subtree: true
    });
  }
  syncSortMenu();

  // 外側を押したら閉じるだけにする。その下の行やボタンは反応させない。
  document.addEventListener('click', (event) => {
    if (!openPanel || !narrowQuery.matches) return;
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    if (target.closest('#surveyFilterPanel, #surveySortMenu, .survey-list-toolbar__btn')) return;
    // 日付のカレンダー（flatpickr）は body 直下に出るが、絞り込みの一部として扱う。
    if (target.closest('.flatpickr-calendar')) return;
    // 表示件数は、閉じたうえでそのまま操作させる。
    if (target.closest('#itemsPerPageGroup')) {
      setOpenPanel(null);
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    setOpenPanel(null);
  }, true);

  // iPhone では、ページのスクロールが止まりきる前（慣性で動いている間や、端で跳ね返っている間）に
  // 全画面のモーダルを開くと、画面に固定した要素の表示位置がずれたまま残り、上端の×が押せなくなることがある。
  // 何かを押した時点で、スクロールを今の位置（動ける範囲の中）に確定させてから、それぞれの処理に進ませる。
  // 止まっているときは同じ位置への移動なので、何も起きない。
  const settlePageScroll = () => {
    const root = document.scrollingElement || document.documentElement;
    const maxTop = Math.max(0, root.scrollHeight - window.innerHeight);
    const top = Math.min(Math.max(window.scrollY, 0), maxTop);
    window.scrollTo(window.scrollX, top);
  };

  document.addEventListener('click', () => {
    if (narrowQuery.matches) {
      settlePageScroll();
    }
  }, true);

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || !openPanel || !narrowQuery.matches) return;
    const button = openPanel === 'filter' ? filterButton : sortButton;
    setOpenPanel(null);
    button.focus({ preventScroll: true });
  });

  // 表示件数は、1023px 以下では一覧の上、1024px 以上では元の位置（一覧の下）に置く。要素は 1 つのまま移す。
  const placePerPageGroup = () => {
    if (!perPageGroup || !perPageSlot || !pagination) return;
    if (narrowQuery.matches) {
      if (perPageGroup.parentElement !== perPageSlot) {
        perPageSlot.appendChild(perPageGroup);
      }
    } else if (perPageGroup.parentElement !== pagination) {
      pagination.insertBefore(perPageGroup, pagination.firstChild);
    }
  };

  // 1023px 以下では行のボタンを出さないため、行そのものをキーボードで選べるようにする
  // （Tab で行へ移り、Enter かスペースでアンケート詳細を開く）。1024px 以上は行のボタンがあるので、元のままにする。
  const syncRowFocusability = () => {
    if (!tableBody) return;
    tableBody.querySelectorAll('tr[data-id]').forEach((row) => {
      if (narrowQuery.matches) {
        if (row.getAttribute('tabindex') !== '0') row.setAttribute('tabindex', '0');
      } else if (row.hasAttribute('tabindex')) {
        row.removeAttribute('tabindex');
      }
    });
  };

  if (tableBody) {
    if ('MutationObserver' in window) {
      new MutationObserver(syncRowFocusability).observe(tableBody, { childList: true });
    }
    let lastRowOpenAt = 0;
    tableBody.addEventListener('keydown', (event) => {
      if (!narrowQuery.matches) return;
      if (event.key !== 'Enter' && event.key !== ' ') return;
      const row = event.target instanceof Element && event.target.matches('tr[data-id]') ? event.target : null;
      if (!row) return;
      event.preventDefault();
      // アンケート詳細を開いても、フォーカスは背面の行に残る（モーダル側がフォーカスを移さないため）。
      // 押しっぱなし・続けての連打・モーダルを開いている間のキーでは、もう一度開かない。
      // 続けて開くと、モーダルが二重に読み込まれたり、背面のスクロールを止める回数の数え方がずれたりする。
      if (event.repeat) return;
      if (document.querySelector('.modal-overlay[data-state="open"]')) return;
      const now = Date.now();
      if (now - lastRowOpenAt < 800) return;
      lastRowOpenAt = now;
      // 行を押したときと同じ処理（tableManager.js が行に付けたもの）を呼ぶ
      row.click();
    });
  }

  const handleWidthChange = () => {
    placePerPageGroup();
    syncRowFocusability();
    if (!narrowQuery.matches) {
      setOpenPanel(null);
    }
  };

  if (typeof narrowQuery.addEventListener === 'function') {
    narrowQuery.addEventListener('change', handleWidthChange);
  } else if (typeof narrowQuery.addListener === 'function') {
    narrowQuery.addListener(handleWidthChange);
  }

  placePerPageGroup();
  syncRowFocusability();
  render();
}

import { initDocViewer } from './docViewer.js';

document.body.className = 'bg-background text-on-background';
document.body.innerHTML = `
<div class="min-h-screen bg-background">
  <header class="border-b border-outline-variant bg-surface">
    <div class="flex w-full flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
      <div>
        <p id="docViewerBreadcrumb" class="text-sm font-semibold text-primary">HOME / 読み込み中</p>
        <h1 id="docViewerPageTitle" class="text-headline-medium font-bold leading-tight text-on-surface">バックエンド資料</h1>
        <p id="docViewerPageSummary" class="mt-1 max-w-4xl text-sm leading-6 text-on-surface-variant"></p>
        <div class="mt-3 flex flex-wrap gap-2">
          <span id="docViewerSourceBadge" class="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary"></span>
          <span id="docViewerUnconfirmedBadge" class="inline-flex items-center rounded-full bg-surface-variant px-3 py-1 text-xs font-semibold text-on-surface"></span>
        </div>
      </div>
      <div class="flex flex-wrap gap-2">
        <a class="inline-flex items-center gap-2 rounded-lg border border-outline px-3 py-2 text-sm text-on-surface hover:bg-surface-variant" href="../index.html">
          <span class="material-icons text-base">home</span>
          HOMEへ戻る
        </a>
        <a class="inline-flex items-center gap-2 rounded-lg border border-outline px-3 py-2 text-sm text-on-surface hover:bg-surface-variant" href="./README.md" target="_blank" rel="noopener">
          <span class="material-icons text-base">open_in_new</span>
          READMEを開く
        </a>
      </div>
    </div>
  </header>

  <section id="docViewerFlowSection" class="hidden w-full px-4 pt-6 sm:px-6 lg:px-8" aria-labelledby="doc-flow-title">
    <div class="rounded-lg border border-outline-variant bg-surface p-5">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p class="text-sm font-semibold text-primary">フロー図</p>
          <h2 id="doc-flow-title" class="mt-1 text-title-large font-bold text-on-surface">処理の流れ</h2>
          <p class="mt-1 text-sm text-on-surface-variant">各カードをクリックすると、該当資料を本文ビューで確認できます。</p>
        </div>
        <span class="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">
          <span class="material-icons text-base">account_tree</span>
          資料連動
        </span>
      </div>
      <div id="docViewerFlow" class="mt-5 space-y-5"></div>
    </div>
  </section>

  <main class="grid w-full gap-5 px-4 py-6 sm:px-6 lg:grid-cols-[390px_minmax(0,1fr)] lg:px-8">
    <aside class="h-fit rounded-lg border border-outline-variant bg-surface p-4 shadow-sm lg:sticky lg:top-4">
      <div class="border-b border-outline-variant pb-4">
        <p class="text-xs font-bold uppercase tracking-wide text-primary">資料ナビ</p>
        <h2 class="mt-1 text-base font-bold text-on-surface">絞り込みと資料一覧</h2>
        <p class="mt-1 text-xs leading-5 text-on-surface-variant">検索条件を変えると、表示対象の資料と本文が切り替わります。</p>
      </div>

      <div class="mt-4 space-y-4">
        <label class="block text-sm text-on-surface-variant">
          <span class="font-semibold text-on-surface">検索</span>
          <span class="relative mt-1 block">
            <span class="material-icons pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-base text-on-surface-variant">search</span>
            <input id="docViewerSearch" type="search" class="form-input w-full rounded-lg border-outline pl-10" placeholder="タイトル・カテゴリ・本文で検索">
          </span>
        </label>

        <section class="rounded-lg border border-outline-variant bg-background p-3" aria-label="資料フィルタ">
          <div class="mb-3 flex items-center justify-between gap-2">
            <h3 class="text-sm font-bold text-on-surface">フィルタ</h3>
            <button id="docViewerReset" type="button" class="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold text-primary hover:bg-primary/10">
              <span class="material-icons text-sm">restart_alt</span>
              リセット
            </button>
          </div>
          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <label class="flex flex-col gap-1 text-sm text-on-surface-variant">
              <span>カテゴリ</span>
              <select id="docViewerCategory" class="form-select rounded-lg border-outline">
                <option value="">すべて</option>
              </select>
            </label>
            <label class="flex flex-col gap-1 text-sm text-on-surface-variant">
              <span>ソース状態</span>
              <select id="docViewerSourceStatus" class="form-select rounded-lg border-outline">
                <option value="">すべて</option>
              </select>
            </label>
          </div>
          <label class="mt-3 flex items-start gap-2 rounded-lg bg-surface px-3 py-2 text-sm text-on-surface">
            <input id="docViewerDiffOnly" type="checkbox" class="form-checkbox mt-0.5 rounded border-outline">
            <span>
              <span class="block font-semibold">差分・未確認のみ</span>
              <span class="block text-xs leading-5 text-on-surface-variant">確認待ちの論点を含む資料だけに絞ります。</span>
            </span>
          </label>
        </section>
      </div>

      <div class="mt-4 flex items-center justify-between gap-3">
        <h3 class="text-sm font-bold text-on-surface">資料一覧</h3>
        <span id="docViewerCount" class="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary">0件</span>
      </div>
      <div id="docViewerList" class="mt-3 max-h-[calc(100vh-18rem)] min-h-[12rem] space-y-2 overflow-y-auto pr-1" aria-label="資料一覧"></div>
    </aside>

    <article class="min-w-0 overflow-hidden rounded-lg border border-outline-variant bg-surface">
      <div class="border-b border-outline-variant p-4">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p id="docViewerMeta" class="text-sm text-on-surface-variant">資料を読み込み中です。</p>
            <h2 id="docViewerTitle" class="mt-1 text-title-large font-bold text-on-surface">資料</h2>
          </div>
          <button id="docViewerCopy" type="button" class="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-on disabled:opacity-50" disabled>
            <span class="material-icons text-base">content_copy</span>
            Markdownをコピー
          </button>
        </div>
        <div id="docViewerBadges" class="mt-3 flex flex-wrap gap-2"></div>
      </div>
      <div id="docViewerContent" class="min-h-[520px] overflow-x-hidden bg-surface p-5 text-on-surface"></div>
    </article>
  </main>
</div>
`;

initDocViewer();

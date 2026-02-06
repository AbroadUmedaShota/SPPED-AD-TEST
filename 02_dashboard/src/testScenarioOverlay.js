/**
 * テストシナリオ案内用オーバーレイ
 * 現在の表示コンテキスト（グループ/プラン）に応じた検証ポイントを提示します。
 */

function createTestScenarioOverlay() {
    const container = document.createElement('div');
    container.id = 'test-scenario-overlay';
    container.className = 'fixed bottom-4 left-4 z-[9999] transition-all duration-300';
    
    container.innerHTML = `
        <div class="bg-slate-900/90 text-white p-4 rounded-2xl shadow-2xl backdrop-blur-md border border-white/20 max-w-xs overflow-hidden">
            <div class="flex items-center gap-2 mb-3">
                <span class="material-icons text-amber-400 text-sm">science</span>
                <span class="text-[10px] font-black uppercase tracking-widest opacity-70">Testing Scenario</span>
                <button id="close-test-overlay" class="ml-auto opacity-50 hover:opacity-100 transition-opacity">
                    <span class="material-icons text-xs">close</span>
                </button>
            </div>
            
            <div id="test-scenario-content">
                <div class="animate-pulse h-4 bg-white/10 rounded w-24 mb-2"></div>
                <div class="animate-pulse h-3 bg-white/10 rounded w-full mb-1"></div>
                <div class="animate-pulse h-3 bg-white/10 rounded w-2/3"></div>
            </div>
            
            <div class="mt-4 pt-3 border-t border-white/10 flex flex-wrap gap-1" id="test-scenario-tags">
                <!-- Tags will be injected here -->
            </div>
        </div>
    `;
    
    document.body.appendChild(container);
    
    document.getElementById('close-test-overlay').onclick = () => container.classList.add('translate-y-20', 'opacity-0');
    
    // 更新ロジック
    const update = () => {
        const groupId = localStorage.getItem('dashboard.selectedGroupId') || 'personal';
        const content = document.getElementById('test-scenario-content');
        const tags = document.getElementById('test-scenario-tags');
        
        let scenario = { title: '', desc: '', badges: [] };
        
        switch(groupId) {
            case 'personal':
                scenario = {
                    title: '個人アカウント (Free)',
                    desc: '個人利用時の基本機能と、プレミアム機能への制限（画像DL不可、手書き制限等）を確認。',
                    badges: ['個人', '制限あり', 'Free']
                };
                break;
            case 'group_sales':
                scenario = {
                    title: '組織利用・非加入 (Free)',
                    desc: '組織アカウント内でのFreeプラン挙動を確認。メンバー間での共有範囲と制限の整合性を検証。',
                    badges: ['組織', '非加入', 'Free']
                };
                break;
            case 'group_marketing':
                scenario = {
                    title: '組織利用・加入済 (Premium)',
                    desc: 'Premium全機能（画像・結合データDL、マトリクス集計、手書き閲覧）が解放されているか確認。',
                    badges: ['組織', '加入済', 'Premium']
                };
                break;
            case 'group_bpo':
                scenario = {
                    title: 'プラン移行・混在 (Mixed)',
                    desc: '同一グループ内で新旧アンケートのプランが混在している場合の、データ保持期間等の挙動を検証。',
                    badges: ['混在', '有効期限テスト', 'Mix']
                };
                break;
            default:
                scenario = { title: '未定義のグループ', desc: 'このグループにはテストシナリオが設定されていません。', badges: ['未定義'] };
        }
        
        content.innerHTML = `
            <h4 class="text-sm font-bold text-white mb-1">${scenario.title}</h4>
            <p class="text-[11px] text-white/70 leading-relaxed">${scenario.desc}</p>
        `;
        
        tags.innerHTML = scenario.badges.map(b => 
            `<span class="px-1.5 py-0.5 rounded-md bg-white/10 text-[9px] font-bold text-white/50 border border-white/5 uppercase">${b}</span>`
        ).join('');
    };

    // グループ切り替えを監視（簡易的にインターバルで監視）
    setInterval(update, 1000);
    update();
}

// ページロード時に実行
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createTestScenarioOverlay);
} else {
    createTestScenarioOverlay();
}

const DATA_CONVERSION_PLANS = [
    {
        value: 'trial',
        title: { ja: 'お試し', en: 'Trial' },
        speedValue: 'normal',
        unitPrice: 0,
        unitPriceLabel: { ja: '無料', en: 'Free' },
        itemCountLabel: { ja: '2項目', en: '2 fields' },
        turnaroundLabel: { ja: '6営業日', en: '6 business days' },
        turnaroundDays: 6,
        tagline: { ja: 'まずは試してみたい方へ', en: 'Try before committing' },
        description: {
            ja: '無料で名刺の基本2項目を確認できるスタート用プラン。ワークフローとの相性をチェックできます。',
            en: 'Validate your workflow for free by converting two essential fields.'
        },
        badge: { ja: '無料', en: 'Free' },
        icon: 'emoji_objects',
        accentGradient: 'from-emerald-400/95 via-emerald-500/95 to-emerald-600/95'
    },
    {
        value: 'normal',
        title: { ja: '通常', en: 'Standard' },
        speedValue: 'normal',
        unitPrice: 50,
        unitPriceLabel: { ja: '＠50円', en: '@¥50' },
        itemCountLabel: { ja: '10項目', en: '10 fields' },
        turnaroundLabel: { ja: '6営業日', en: '6 business days' },
        turnaroundDays: 6,
        tagline: { ja: '迷ったらこのプラン', en: 'Most popular choice' },
        description: {
            ja: '営業現場で必要な10項目を標準納期で確保できるバランスプラン。コストとスピードの両立に優れます。',
            en: 'A balanced plan covering ten essential fields with a dependable standard turnaround.'
        },
        badge: { ja: 'おすすめ', en: 'Recommended' },
        icon: 'workspace_premium',
        accentGradient: 'from-sky-500/95 via-blue-600/95 to-indigo-600/95'
    },
    {
        value: 'express',
        title: { ja: '特急', en: 'Express' },
        speedValue: 'express',
        unitPrice: 100,
        unitPriceLabel: { ja: '＠100円', en: '@¥100' },
        itemCountLabel: { ja: '10項目', en: '10 fields' },
        turnaroundLabel: { ja: '3営業日', en: '3 business days' },
        turnaroundDays: 3,
        tagline: { ja: 'スピード重視', en: 'Speed focused' },
        description: {
            ja: '展示会後の素早いフォローに。3営業日で10項目をスピーディーにデータ化します。',
            en: 'Ideal for quick post-event follow-ups with a three business day turnaround.'
        },
        icon: 'rocket_launch',
        accentGradient: 'from-amber-400/95 via-orange-500/95 to-red-500/95'
    },
    {
        value: 'superExpress',
        title: { ja: '超特急', en: 'Super Express' },
        speedValue: 'superExpress',
        unitPrice: 150,
        unitPriceLabel: { ja: '＠150円', en: '@¥150' },
        itemCountLabel: { ja: '10項目', en: '10 fields' },
        turnaroundLabel: { ja: '1営業日', en: '1 business day' },
        turnaroundDays: 1,
        tagline: { ja: '最速納期', en: 'Lightning fast' },
        description: {
            ja: 'ホットリードを逃さない1営業日対応。VIP顧客や即日アクションが必要な案件に最適です。',
            en: 'A one business day turnaround to stay ahead on high-priority leads.'
        },
        icon: 'flash_on',
        accentGradient: 'from-fuchsia-500/95 via-pink-500/95 to-rose-500/95'
    },
    {
        value: 'onDemand',
        title: { ja: 'オンデマンド', en: 'On-Demand' },
        speedValue: 'onDemand',
        unitPrice: 200,
        unitPriceLabel: { ja: '＠200円', en: '@¥200' },
        itemCountLabel: { ja: '10項目', en: '10 fields' },
        turnaroundLabel: { ja: '当日中', en: 'Same-day' },
        turnaroundDays: 0,
        tagline: { ja: '当日対応', en: 'Same-day service' },
        description: {
            ja: '当日中の納品で即時共有を実現。最優先で処理したいリードに向いたプレミアムプランです。',
            en: 'Deliver same-day results to share leads immediately with priority handling.'
        },
        badge: { ja: '最優先', en: 'Priority' },
        icon: 'bolt',
        accentGradient: 'from-cyan-500/95 via-blue-500/95 to-slate-600/95'
    }
];

const PREMIUM_OPTION_GROUPS = [
    {
        value: 'multilingual',
        type: 'toggle',
        title: { ja: '多言語対応', en: 'Multilingual support' },
        description: {
            ja: '日本語に加えて中国語（繁体字・簡体字）など複数言語の翻訳入力を追加します。',
            en: 'Add translation entry fields so cards can be processed in Japanese, Traditional/Simplified Chinese, and other languages.'
        },
        unitPrice: 100,

        icon: 'language'
    },
    {
        value: 'additionalItems',
        type: 'multi',
        title: { ja: '項目追加', en: 'Additional fields' },
        description: {
            ja: '標準の10項目に加えて、必要な補足項目をデータ化します。',
            en: 'Capture additional details beyond the standard 10 fields.'
        },
        icon: 'playlist_add_check',
        options: [
            {
                value: 'secondPhone',
                title: { ja: '電話番号2つ目', en: 'Second phone number' },
                description: {
                    ja: '本社と直通など複数の電話番号を保持できます。',
                    en: 'Store both main line and direct dial numbers.'
                },
                icon: 'call_split'
            },
            {
                value: 'secondAddress',
                title: { ja: '住所2つめ', en: 'Second address' },
                description: {
                    ja: '本社と支社など複数住所の管理に対応します。',
                    en: 'Keep headquarters and branch addresses together.'
                },
                icon: 'map'
            },
            {
                value: 'handwrittenMemo',
                title: { ja: '手書きメモ', en: 'Handwritten memo' },
                description: {
                    ja: '名刺に記載された手書きメモをテキスト化します。',
                    en: 'Transcribe handwritten notes captured on the card.'
                },
                icon: 'draw'
            }
        ]
    }
];

const DEFAULT_PLAN = 'normal';

function getPlanConfig(planValue) {
    return DATA_CONVERSION_PLANS.find(plan => plan.value === planValue) || null;
}

function normalizePlanValue(value) {
    if (!value) return DEFAULT_PLAN;
    const legacyMap = {
        free: 'trial',
        standard: 'normal',
        premium: 'superExpress',
        enterprise: 'onDemand',
        custom: 'onDemand'
    };
    const candidate = legacyMap[value] || value;
    return getPlanConfig(candidate) ? candidate : DEFAULT_PLAN;
}

function normalizePremiumOptions(rawOptions) {
    const defaultOptions = {
        multilingual: false,
        additionalItems: []
    };

    if (!rawOptions || typeof rawOptions !== 'object') {
        return { ...defaultOptions };
    }

    const normalized = {
        multilingual: Boolean(rawOptions.multilingual),
        additionalItems: []
    };

    const additionalGroup = PREMIUM_OPTION_GROUPS.find(group => group.value === 'additionalItems');
    const validAdditionalItems = new Set((additionalGroup?.options || []).map(option => option.value));

    if (Array.isArray(rawOptions.additionalItems)) {
        rawOptions.additionalItems.forEach(item => {
            if (validAdditionalItems.has(item) && !normalized.additionalItems.includes(item)) {
                normalized.additionalItems.push(item);
            }
        });
    }

    return normalized;
}

export {
    DATA_CONVERSION_PLANS,
    DEFAULT_PLAN,
    PREMIUM_OPTION_GROUPS,
    getPlanConfig,
    normalizePlanValue,
    normalizePremiumOptions
};

graph TD
    subgraph "認証"
        A[ログイン画面<br>(login-top.html)]
        M1(新規アカウント作成モーダル)
    end

    subgraph "ダッシュボード (02_dashboard)"
        B[アンケート一覧<br>(index.html)]
        C[アンケート新規作成<br>(surveyCreation.html)]
        D[請求書一覧<br>(invoiceList.html)]
        E[請求書詳細<br>(invoice-detail.html)]
        F[SPEEDレビュー<br>(speed-review.html)]
        G[名刺データ化設定<br>(bizcardSettings.html)]
        H[お礼メール設定<br>(thankYouEmailSettings.html)]

        subgraph "共通コンポーネント"
            Sidebar[サイドバー<br>(sidebar.html)]
            M5(アカウント情報モーダル)
        end

        subgraph "アンケート一覧のモーダル"
            M2(新規アンケートモーダル)
            M3(アンケート詳細モーダル)
            M4(QRコードモーダル)
        end
    end

    subgraph "初回ログイン (04_first-login)"
        I[初回登録画面<br>(index.html)]
    end

    subgraph "管理画面 (03_admin)"
        J[管理者TOP<br>(index.html)]
    end

    %% 認証フロー
    A -- "ログイン成功 (通常ユーザー)" --> B
    A -- "ログイン成功 (新規ユーザー)" --> I
    A -- "ログイン成功 (管理者)" --> J
    A -- "無料ではじめる" --> M1
    M1 -- "ログインはこちら" --> A
    B -- ログアウト --> A

    %% サイドバーからの遷移
    Sidebar --> B
    Sidebar --> C
    Sidebar --> D
    Sidebar -- "アカウント情報" --> M5

    %% アンケート一覧 (index.html) からのフロー
    B -- "アンケート新規作成" --> M2
    M2 -- 作成実行 --> B
    B -- テーブル行クリック --> M3
    B -- QRアイコンクリック --> M4

    %% アンケート詳細モーダルからの遷移
    M3 -- "SPEEDレビュー" --> F

    %% アンケート作成 (surveyCreation.html) からのフロー
    C -- "名刺データ化設定" --> G
    C -- "お礼メール設定" --> H

    %% 請求書フロー
    D -- 請求書クリック --> E

    %% スタイル定義
    classDef page fill:#e8f0fe,stroke:#3367d6,stroke-width:2px;
    classDef modal fill:#fce8e6,stroke:#d93025,stroke-width:2px;
    class A,B,C,D,E,F,G,H,I,J page;
    class M1,M2,M3,M4,M5 modal;
    class Sidebar fill:#e6f4ea,stroke:#1e8e3e,stroke-width:2px;
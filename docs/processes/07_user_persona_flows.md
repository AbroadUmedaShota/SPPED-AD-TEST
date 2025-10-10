# 09 ユーザーペルソナ別ワークフロー

本ドキュメントは、主要なユーザーペルソナ（役割）ごとに、具体的な業務の流れを画面やソースコードと関連付けながら視覚的に表現します。

**関連ドキュメント:**
- **役割定義**: [02_roles_and_responsibilities.md](./02_roles_and_responsibilities.md)
- **データ定義**: [07_data_flow_mapping.md](./07_data_flow_mapping.md)

---

## A. サーベイ End-to-End フロー
**ペルソナ**: 管理者, オペレーター, 顧客/回答者

```mermaid
flowchart TD
    subgraph 管理者/利用者
        A1[1. 要件整理／設問設計]
        A2[4. 最終承認／公開]
    end

    subgraph オペレーター
        O1[2. サーベイ作成<br>surveyCreation.html]
        O2[3. プレビュー／調整]
        O3[6. 回答モニタリング<br>speed-review.html]
        O4[7. レビュー／差戻し]
        O5[8. データエクスポート]
    end

    subgraph 顧客／回答者
        C1[5. フォーム入力／送信]
    end

    A1 --> O1 --> O2 --> A2 --> C1 --> O3 --> O4 --> O5
end
```

- **Assumptions**: 回答データはモック環境ではJSONファイル、本番環境ではAPI/DB経由での取得を想定しています。

---

## B. 請求（Order-to-Cash）フロー
**ペルソナ**: マスター管理者, 管理者, 入力管理者, オペレーター, 顧客

```mermaid
flowchart TD
    subgraph オペレーター
        B1[1. 請求データ入力<br>invoiceDetail.html]
        B2[4. 入金確認／消込]
    end

    subgraph 入力管理者
        OA1[2. 入力内容レビュー]
    end

    subgraph 管理者
        AD1[3. 最終承認／発行]
        AD2[5. 督促／例外処理]
    end

    subgraph 顧客
        CU1[請求書受領／支払]
    end

    B1 --> OA1 --> AD1 --> CU1 --> B2 --> AD2
end
```

- **Assumptions**: 請求データはモック環境ではJSONファイル、本番環境では会計システム等との連携を想定しています。

---

## C. 問い合わせ／エスカレーション フロー
**ペルソナ**: 顧客, 管理者, マスター管理者, オペレーター

```mermaid
flowchart TD
    subgraph 顧客
        C01[1. 問い合わせ]
    end

    subgraph 管理者
        A01[2. 一次受付／トリアージ]
        A02{3. 自己解決可能？}
        A03[4a. 一次回答／クローズ]
        A04[4b. エスカレーション判断]
        A05[6. 解決策の最終確認と報告]
    end

    subgraph 開発/保守担当
        D01[5. 技術調査／恒久対策]
    end

    subgraph オペレーター
        OX1[調査補助<br>データ提供など]
    end

    C01 --> A01 --> A02
    A02 -- Yes --> A03
    A02 -- No --> A04 --> D01 --> A05
    D01 --> OX1
end
```

- **Assumptions**: 管理者が一次対応を担当し、オペレーターは補助に徹します。SLAは[08_kpis_and_reporting.md](./08_kpis_and_reporting.md)と連動します。

---

## D. オペレーター日次フロー
**ペルソナ**: オペレーター, 入力管理者

```mermaid
flowchart TD
    subgraph オペレーター
        D1[1. タスク確認]
        D2[2. データ入力<br>data_entry.html]
        D3[3. 突合処理<br>reconciliation]
        D4{4. 差異あり？}
        D6[5b. 進捗確認]
    end
    
    subgraph 入力管理者
        D5[5a. 差異の確認と指示]
        D7[6. 全体進捗の監督]
    end

    D1 --> D2 --> D3 --> D4
    D4 -- Yes --> D5 --> D2
    D4 -- No --> D6 --> D7
end
```

- **Assumptions**: 差異の修正は入力管理者の指示に基づき、オペレーターが実施します。


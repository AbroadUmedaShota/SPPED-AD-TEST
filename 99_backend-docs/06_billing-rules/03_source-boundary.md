---
owner: product
status: draft
last_reviewed: 2026-05-28
---

# 正本参照先と境界

## 請求関連の参照先

| 領域 | 優先参照先 |
| --- | --- |
| 利用者向け請求画面 | `docs/画面設計/仕様/04_invoice_screen.md` |
| 請求書帳票/PDF/印刷 | `docs/画面設計/仕様/05_invoice_document.md` |
| 請求関連資料の使い分け | `docs/画面設計/仕様/請求関連仕様マップ.md` |
| 管理者向け請求管理 | `docs/画面設計/仕様/admin/40_admin_billing_and_rules.md` |
| 請求通知文面 | `docs/テンプレート/email/invoice-notification-email-template_jp.txt` とシステムメール資料 |

## 境界

- 利用者向け請求書表示と管理者向け請求管理は別責務です。
- 価格、契約、法務、未公開プランは shared 資料へ詳細を置かず、必要なUI文言と表示条件に縮退します。
- この資料は請求ロジックの見取り図であり、正式な価格表ではありません。

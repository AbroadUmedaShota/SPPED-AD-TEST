(function () {
  const scenarios = [
    {
      scenario_id: 'STG-SCN-001',
      title: 'ログインからダッシュボード表示',
      role_scope: 'ユーザー',
      scenario_group: '認証・ダッシュボード',
      priority: 'P0',
      side_effect: 'none',
      start_url: 'https://stg.speed-ad.com/',
      objective: 'stgの企業ユーザー導線でログイン後にダッシュボードへ到達し、アンケート一覧の主要情報を確認できることを検証する。',
      linked_case_ids: ['LGN-001', 'DSH-001', 'DSH-004'],
      stg_observation_status: 'stg未観測/既存セッション確認待ち',
      expected_outcome: 'ログイン後にダッシュボードが表示され、アンケート一覧、詳細導線、主要ナビゲーションが操作できる。',
      evidence_policy: 'ダッシュボード初期表示、一覧行、コンソールエラーなしのスクリーンショットを残す。',
      notes: '実データの会社名や個人情報は証跡に残さない。'
    },
    {
      scenario_id: 'STG-SCN-002',
      title: 'アンケート詳細とQR/回答URL確認',
      role_scope: 'ユーザー',
      scenario_group: 'QR・回答',
      priority: 'P0',
      side_effect: 'none',
      start_url: 'https://stg.speed-ad.com/',
      objective: 'ダッシュボード上のアンケートから詳細、QR、回答URLの確認導線がつながることを検証する。',
      linked_case_ids: ['DSH-003', 'QR-001', 'QR-002', 'QR-003', 'QR-004'],
      stg_observation_status: 'stg未観測/既存セッション確認待ち',
      expected_outcome: 'アンケート詳細またはQR表示から回答URL相当の情報を確認でき、コピー操作後も画面が破綻しない。',
      evidence_policy: 'QRまたは回答URL表示部、コピー後トースト、コンソールエラーなしを記録する。',
      notes: 'コピー先の実URLは必要に応じて一部マスクする。'
    },
    {
      scenario_id: 'STG-SCN-003',
      title: '回答プレビューで完了表示まで確認',
      role_scope: 'ユーザー',
      scenario_group: 'QR・回答',
      priority: 'P0',
      side_effect: 'none',
      start_url: 'https://stg.speed-ad.com/',
      objective: '回答画面のプレビューまたは安全な確認導線で、入力から完了表示までの体験を副作用なしで確認する。',
      linked_case_ids: ['ANS-004', 'ANS-005', 'ANS-007', 'ANS-011', 'ANS-012', 'ANS-013', 'ANS-023'],
      stg_observation_status: 'stg未観測/既存セッション確認待ち',
      expected_outcome: '設問表示、入力保持、送信操作後のプレビュー完了表示が確認でき、実回答保存が発生しない。',
      evidence_policy: '回答画面、入力済み状態、プレビュー完了表示を記録する。',
      notes: 'プレビュー導線がない場合は送信直前までで止め、結果は「要許可」にする。'
    },
    {
      scenario_id: 'STG-SCN-004',
      title: '回答本送信の事前確認',
      role_scope: 'ユーザー',
      scenario_group: 'QR・回答',
      priority: 'P0',
      side_effect: 'medium',
      start_url: 'https://stg.speed-ad.com/',
      objective: '来場者回答の本送信導線が成立することを、stgデータ更新リスクを明示して確認する。',
      linked_case_ids: ['ANS-019', 'ANS-020', 'ANS-021', 'ANS-022'],
      stg_observation_status: 'stg未観測/明示許可待ち',
      expected_outcome: '必須入力後に送信確認または完了導線へ進める。明示許可がない場合は本送信せず、直前状態までを確認する。',
      evidence_policy: '送信直前状態、確認ダイアログまたは要許可判断を記録する。',
      notes: '本送信はstgデータを変更するため、実行前にユーザー許可が必要。'
    },
    {
      scenario_id: 'STG-SCN-005',
      title: 'アンケート作成から編集画面確認',
      role_scope: 'ユーザー',
      scenario_group: 'アンケート作成・編集',
      priority: 'P0',
      side_effect: 'medium',
      start_url: 'https://stg.speed-ad.com/',
      objective: 'アンケート作成画面で基本情報、設問、設定タブの導線が一連で確認できることを検証する。',
      linked_case_ids: ['CRT-001', 'EDT-001', 'EDT-002', 'EDT-022', 'EDT-027', 'EDT-028'],
      stg_observation_status: 'stg未観測/明示許可待ち',
      expected_outcome: '新規作成または編集画面で基本情報と設問操作UIが表示され、保存が必要な操作は直前で止められる。',
      evidence_policy: '作成/編集画面、設問追加メニュー、保存直前状態を記録する。',
      notes: '保存や公開はstgデータ変更のため原則実行しない。'
    },
    {
      scenario_id: 'STG-SCN-006',
      title: '名刺データ化設定と見積表示',
      role_scope: 'ユーザー',
      scenario_group: '名刺・お礼メール',
      priority: 'P1',
      side_effect: 'medium',
      start_url: 'https://stg.speed-ad.com/',
      objective: '名刺データ化設定でプラン、件数、見積、関連導線の表示を確認する。',
      linked_case_ids: ['BIZ-001', 'BIZ-002'],
      stg_observation_status: 'stg未観測/既存セッション確認待ち',
      expected_outcome: 'データ化有無、想定件数、見積または料金表示が確認でき、保存が必要な操作は直前で止められる。',
      evidence_policy: '設定画面、見積表示、保存前状態を記録する。',
      notes: '料金・件数など実データは必要最小限にマスクする。'
    },
    {
      scenario_id: 'STG-SCN-007',
      title: 'お礼メール設定の表示確認',
      role_scope: 'ユーザー',
      scenario_group: '名刺・お礼メール',
      priority: 'P1',
      side_effect: 'medium',
      start_url: 'https://stg.speed-ad.com/',
      objective: 'お礼メール設定で文面、送信対象、送信タイミング、保存入口を確認する。',
      linked_case_ids: ['THX-001', 'MAIL-001', 'MAIL-002'],
      stg_observation_status: 'stg未観測/明示許可待ち',
      expected_outcome: 'メール文面と送信対象の設定UIが表示され、保存や送信は許可がない限り実行しない。',
      evidence_policy: '設定画面、送信対象、保存/送信前状態を記録する。',
      notes: '実メール送信の可能性がある操作は必ず停止する。'
    },
    {
      scenario_id: 'STG-SCN-008',
      title: '請求一覧から請求詳細確認',
      role_scope: 'ユーザー',
      scenario_group: 'ダウンロード・請求',
      priority: 'P0',
      side_effect: 'none',
      start_url: 'https://stg.speed-ad.com/',
      objective: '企業ユーザー側で請求一覧、請求詳細、印刷用ビューの導線を確認する。',
      linked_case_ids: ['INV-001', 'INV-002', 'INV-003'],
      stg_observation_status: 'stg未観測/既存セッション確認待ち',
      expected_outcome: '請求一覧から詳細へ遷移でき、請求先、明細、合計金額、印刷導線が表示される。',
      evidence_policy: '請求一覧、詳細、印刷ビュー入口を記録する。',
      notes: '金額や請求先などの実値はマスクする。'
    },
    {
      scenario_id: 'STG-SCN-009',
      title: '管理者ログインと主要画面巡回',
      role_scope: '管理者',
      scenario_group: '管理者共通',
      priority: 'P0',
      side_effect: 'none',
      start_url: 'https://stg.speed-ad.com/admin/login',
      objective: '管理者ログイン後にトップへ入り、主要管理画面リンクが切れずに巡回できることを検証する。',
      linked_case_ids: ['STG-COMMON-01', 'STG-ADM-00', 'STG-AX-01', 'STG-AX-02'],
      stg_observation_status: 'stg観測資料あり/再確認待ち',
      expected_outcome: '管理者トップと主要リンクが表示され、遷移時にログインへ戻されない。',
      evidence_policy: '管理者トップ、主要リンク、代表遷移先、コンソールエラーなしを記録する。',
      notes: 'ログアウト確認は最後に実行する。'
    },
    {
      scenario_id: 'STG-SCN-010',
      title: '管理者の利用者・アンケート・請求検索',
      role_scope: '管理者',
      scenario_group: '管理者一覧検索',
      priority: 'P0',
      side_effect: 'none',
      start_url: 'https://stg.speed-ad.com/admin/top',
      objective: '管理者側の主要一覧で検索、リセット、ページング、関連導線を確認する。',
      linked_case_ids: ['STG-ADM-01', 'STG-ADM-02', 'STG-ADM-03', 'STG-AX-03'],
      stg_observation_status: 'stg観測資料あり/再確認待ち',
      expected_outcome: '利用者、アンケート、請求の各一覧で条件入力とリセットができ、関連導線へ進める。',
      evidence_policy: '各一覧の検索フォーム、検索後表示、リセット後表示を記録する。',
      notes: '実データ値は証跡に残さず、編集保存や削除確定は実行しない。'
    },
    {
      scenario_id: 'STG-SCN-011',
      title: '管理者のクーポン検索と実績確認',
      role_scope: '管理者',
      scenario_group: '管理者一覧検索',
      priority: 'P1',
      side_effect: 'none',
      start_url: 'https://stg.speed-ad.com/admin/coupon',
      objective: 'クーポン管理の検索/編集入口と、オペレーター実績確認の集計表示入口を確認する。',
      linked_case_ids: ['STG-ADM-04', 'STG-ADM-10'],
      stg_observation_status: 'stg観測資料あり/再確認待ち',
      expected_outcome: 'クーポン検索条件を操作でき、編集または利用履歴の入口が表示される。実績確認では期間/所属条件、集計表示、CSV入口が確認できる。',
      evidence_policy: 'クーポン検索条件、一覧、編集/利用履歴入口、実績確認の集計表示を記録する。',
      notes: 'クーポン作成や保存は実行しない。実績CSVは必要時のみ実行する。'
    },
    {
      scenario_id: 'STG-SCN-012',
      title: '管理者の営業日とオペレーター入口確認',
      role_scope: '管理者',
      scenario_group: '管理者設定',
      priority: 'P1',
      side_effect: 'medium',
      start_url: 'https://stg.speed-ad.com/admin/top',
      objective: '営業日カレンダーとオペレーター管理の更新系入口を、データ変更せず確認する。',
      linked_case_ids: ['STG-ADM-05', 'STG-ADM-09', 'STG-AX-04'],
      stg_observation_status: 'stg観測資料あり/再確認待ち',
      expected_outcome: '営業日設定UI、オペレーター検索、新規作成/編集/削除入口が表示され、確定操作は止められる。',
      evidence_policy: '営業日設定画面、オペレーター一覧、更新系入口を記録する。',
      notes: '決定、保存、削除確定は明示許可がない限り実行しない。'
    },
    {
      scenario_id: 'STG-SCN-013',
      title: '管理者の名刺入力・照合・エスカレーション導線',
      role_scope: '管理者',
      scenario_group: '管理者業務フロー',
      priority: 'P0',
      side_effect: 'medium',
      start_url: 'https://stg.speed-ad.com/admin/top',
      objective: '名刺入力、照合、エスカレーション確認の作業入口を確認する。',
      linked_case_ids: ['STG-ADM-07', 'STG-FLOW-DATA-01', 'STG-ADM-08', 'STG-FLOW-MATCH-01', 'STG-FLOW-ESCALE-01'],
      stg_observation_status: 'stg観測資料あり/一部未到達',
      expected_outcome: '名刺入力対象、作業画面入口、照合検索、エスカレーション導線が確認でき、確定/スキップは止められる。',
      evidence_policy: '一覧、作業入口、リダイレクトまたは未到達理由を記録する。',
      notes: '観測資料上、照合作業画面とエスカレーション確認は未到達のため、到達可否を結果に記録する。'
    },
    {
      scenario_id: 'STG-SCN-014',
      title: 'ユーザー作成アンケートと請求の管理者横断確認',
      role_scope: '横断',
      scenario_group: '請求横断',
      priority: 'P0',
      side_effect: 'none',
      start_url: 'https://stg.speed-ad.com/',
      objective: 'ユーザー側で確認したアンケート/請求の情報を、管理者側のアンケート検索と請求/請求書検索で追えることを確認する。',
      linked_case_ids: ['CRT-001', 'DSH-001', 'INV-001', 'INV-002', 'STG-ADM-02', 'STG-ADM-03', 'STG-ADM-06'],
      stg_observation_status: 'stg未観測/既存セッション確認待ち',
      expected_outcome: 'ユーザー側のアンケート/請求表示と、管理者側のアンケート/請求検索の表示観点を比較でき、データ更新なしで導線を確認できる。',
      evidence_policy: 'ユーザー側アンケート/請求、管理者側アンケート検索、請求検索、請求書検索結果を記録する。',
      notes: 'アンケート名、金額、請求先、会社名はマスクし、同一性の厳密判定は今回の期待結果に含めない。'
    }
  ];

  const steps = [
    ['STG-SCN-001', 1, 'stgのログイン入口を開き、既存セッションまたはログイン後の遷移先を確認する。', '企業ユーザーとしてダッシュボードへ到達する。', 'none', false, 'LGN-001'],
    ['STG-SCN-001', 2, 'ダッシュボードのアンケート一覧を確認する。', '一覧、ステータス、主要アクションが表示される。', 'none', false, 'DSH-001'],
    ['STG-SCN-001', 3, '代表アンケートの詳細または行アクションを開く。', '詳細導線が表示され、画面が崩れない。', 'none', false, 'DSH-003'],
    ['STG-SCN-001', 4, '主要ナビゲーションを1つ以上開いて戻る。', 'リンク切れや認証切れがない。', 'none', false, 'DSH-004'],
    ['STG-SCN-001', 5, 'コンソールとネットワークを確認する。', '表示を阻害するエラーがない。', 'none', false, ''],

    ['STG-SCN-002', 1, 'ダッシュボードから代表アンケートの詳細を開く。', 'アンケート概要と関連操作が確認できる。', 'none', false, 'DSH-003'],
    ['STG-SCN-002', 2, 'QRまたは回答URLの表示入口を開く。', '回答URL相当の情報が表示される。', 'none', false, 'QR-001,QR-002'],
    ['STG-SCN-002', 3, 'コピー操作を実行する。', 'コピー後トーストまたは完了表示が出る。', 'none', false, 'QR-003'],
    ['STG-SCN-002', 4, 'QR画像未設定時の表示を確認する。', '未設定時はプレースホルダーまたは無効表示になる。', 'none', false, 'QR-004'],

    ['STG-SCN-003', 1, '回答URLまたはプレビューURLを開く。', '回答画面のタイトルと説明が表示される。', 'none', false, 'ANS-004'],
    ['STG-SCN-003', 2, '設問数と必須表示を確認する。', '対象アンケートの設問が表示され、必須表示が確認できる。', 'none', false, 'ANS-005,ANS-006'],
    ['STG-SCN-003', 3, '自由記述、単一選択、複数選択など代表入力を行う。', '入力値または選択状態が保持される。', 'none', false, 'ANS-011,ANS-012,ANS-013'],
    ['STG-SCN-003', 4, 'プレビュー送信または安全な完了確認を行う。', 'プレビュー完了または送信直前状態が確認できる。', 'none', false, 'ANS-023'],

    ['STG-SCN-004', 1, '回答画面を開き、送信に必要な入力を行う。', '送信ボタンが押せる状態になる。', 'none', false, 'ANS-007'],
    ['STG-SCN-004', 2, '送信ボタン押下前に副作用の有無を確認する。', '実回答保存が発生する場合は要許可として止める。', 'medium', true, 'ANS-019'],
    ['STG-SCN-004', 3, '明示許可がある場合のみ本送信を行う。', '送信中表示から完了画面へ進む。', 'medium', true, 'ANS-020,ANS-021'],
    ['STG-SCN-004', 4, '完了表示を確認する。', '完了メッセージと完了アイコンが表示される。', 'none', false, 'ANS-021,ANS-022'],

    ['STG-SCN-005', 1, 'アンケート新規作成または編集入口を開く。', '作成/編集画面へ到達する。', 'medium', true, 'CRT-001,EDT-027'],
    ['STG-SCN-005', 2, '基本情報フィールドを確認する。', 'アンケート名や会期の入力欄が表示される。', 'none', false, 'EDT-001,EDT-022'],
    ['STG-SCN-005', 3, '設問追加メニューを開く。', '設問タイプの選択肢が表示される。', 'none', false, 'EDT-002,EDT-028'],
    ['STG-SCN-005', 4, '保存または公開が必要な操作は直前で止める。', 'stgデータ変更なしで確認を終える。', 'medium', true, 'EDT-001'],

    ['STG-SCN-006', 1, '名刺データ化設定画面を開く。', '設定画面へ到達する。', 'none', false, 'BIZ-001'],
    ['STG-SCN-006', 2, 'プラン、想定件数、料金/見積表示を確認する。', '設定に応じた見積または料金表示が確認できる。', 'none', false, 'BIZ-002'],
    ['STG-SCN-006', 3, '保存系ボタンの表示を確認する。', '保存入口が確認でき、押下は止められる。', 'medium', true, 'BIZ-002'],

    ['STG-SCN-007', 1, 'お礼メール設定画面を開く。', '文面と設定項目が表示される。', 'none', false, 'MAIL-001'],
    ['STG-SCN-007', 2, '送信対象と送信タイミングの表示を確認する。', '対象や期限の状態が確認できる。', 'none', false, 'MAIL-002'],
    ['STG-SCN-007', 3, 'サンクス画面設定または保存/送信系操作は直前で止める。', '実メール送信や保存更新を発生させない。', 'medium', true, 'THX-001,MAIL-001'],

    ['STG-SCN-008', 1, 'ユーザー側の請求一覧を開く。', '請求一覧が表示される。', 'none', false, 'INV-001'],
    ['STG-SCN-008', 2, '代表請求の詳細を開く。', '請求先、明細、合計金額、支払期日が表示される。', 'none', false, 'INV-002'],
    ['STG-SCN-008', 3, '印刷用ビュー入口を確認する。', '印刷用ビューまたは印刷導線が表示される。', 'none', false, 'INV-003'],

    ['STG-SCN-009', 1, '管理者ログイン入口を開く。', '既存セッションでトップへ入る、またはログイン画面が表示される。', 'none', false, 'STG-AX-01'],
    ['STG-SCN-009', 2, '管理者トップの主要リンクを確認する。', '主要管理画面へのリンクが表示される。', 'none', false, 'STG-COMMON-01,STG-ADM-00'],
    ['STG-SCN-009', 3, '主要画面を代表的に巡回する。', '遷移先が表示され、ログインへ戻されない。', 'none', false, 'STG-AX-02'],
    ['STG-SCN-009', 4, '最後に必要であればログアウト導線を確認する。', 'ログアウト後にログイン画面へ戻る。', 'none', false, 'STG-AX-01'],

    ['STG-SCN-010', 1, '利用者管理を開き検索/リセットを確認する。', '検索条件と一覧が表示され、リセットできる。', 'none', false, 'STG-ADM-01'],
    ['STG-SCN-010', 2, 'アンケート管理を開き検索/ステータス絞り込みを確認する。', '検索とステータス条件が操作できる。', 'none', false, 'STG-ADM-02'],
    ['STG-SCN-010', 3, '請求管理を開き検索/ページングを確認する。', '検索条件とページングが操作できる。', 'none', false, 'STG-ADM-03'],
    ['STG-SCN-010', 4, '編集、削除、保存系入口は確定前で止める。', 'stgデータ変更なしで確認を終える。', 'medium', true, 'STG-AX-03'],

    ['STG-SCN-011', 1, 'クーポン管理を開く。', '検索フォームと一覧が表示される。', 'none', false, 'STG-ADM-04'],
    ['STG-SCN-011', 2, 'ID、クーポン名、クーポンコードなどで検索/リセットを確認する。', '検索条件を操作できる。', 'none', false, 'STG-ADM-04'],
    ['STG-SCN-011', 3, '編集または利用履歴入口を確認する。', '入口が表示される。保存は実行しない。', 'medium', true, 'STG-ADM-04'],
    ['STG-SCN-011', 4, 'オペレーター実績確認を開き、期間/所属条件と集計タブを確認する。', '集計表示とCSV出力入口が確認できる。', 'none', false, 'STG-ADM-10'],

    ['STG-SCN-012', 1, '営業日カレンダーを開く。', '定休日、祝日、個別休日、決定ボタンが表示される。', 'none', false, 'STG-ADM-05'],
    ['STG-SCN-012', 2, 'オペレーター管理を開き検索/リセットを確認する。', '検索条件と一覧が表示される。', 'none', false, 'STG-ADM-09'],
    ['STG-SCN-012', 3, '新規作成、編集、削除入口を確認する。', '入口は確認でき、保存/削除確定は実行しない。', 'medium', true, 'STG-AX-04'],

    ['STG-SCN-013', 1, '名刺入力画面を開く。', 'データ入力対象一覧と作業可能件数が表示される。', 'none', false, 'STG-ADM-07'],
    ['STG-SCN-013', 2, '入力作業画面入口を開く。', '入力欄、回転、確定、スキップ、作業終了が表示される、または未到達理由を記録できる。', 'medium', true, 'STG-FLOW-DATA-01'],
    ['STG-SCN-013', 3, '照合画面を開き検索条件と作業入口を確認する。', '照合一覧、KPI、作業開始、エスカレーション導線が表示される。', 'none', false, 'STG-ADM-08'],
    ['STG-SCN-013', 4, '照合作業/エスカレーション確認導線を開く。', '到達先またはリダイレクト先を記録できる。', 'medium', true, 'STG-FLOW-MATCH-01,STG-FLOW-ESCALE-01'],

    ['STG-SCN-014', 1, 'ユーザー側で代表アンケートの一覧/詳細と請求一覧/詳細を確認する。', 'アンケート表示と請求表示が確認できる。', 'none', false, 'DSH-001,INV-001,INV-002'],
    ['STG-SCN-014', 2, '管理者側でアンケート管理を開き、対象を検索する。', 'アンケート管理一覧が表示され、検索できる。', 'none', false, 'STG-ADM-02'],
    ['STG-SCN-014', 3, '管理者側で請求管理と請求書管理を開き検索する。', '請求管理と請求書管理の条件入力、検索、リセットが確認できる。', 'none', false, 'STG-ADM-03,STG-ADM-06'],
    ['STG-SCN-014', 4, 'ユーザー側と管理者側の証跡を並べて確認する。', '表示観点を比較できる。実値の厳密一致は今回の期待に含めない。', 'none', false, '']
  ].map(([scenarioId, stepNo, action, expected, sideEffect, requiresPermission, linkedCaseIds]) => ({
    scenario_id: scenarioId,
    step_id: `${scenarioId}-${String(stepNo).padStart(2, '0')}`,
    step_no: stepNo,
    action,
    expected,
    side_effect: sideEffect,
    requires_permission: requiresPermission,
    linked_case_ids: linkedCaseIds ? linkedCaseIds.split(',') : []
  }));

  const sheetSchemas = [
    {
      tab: 'scenarios',
      purpose: 'シナリオマスタ',
      columns: ['scenario_id', 'title', 'role_scope', 'scenario_group', 'priority', 'side_effect', 'start_url', 'objective', 'linked_case_ids', 'stg_observation_status', 'expected_outcome', 'evidence_policy', 'notes', 'active']
    },
    {
      tab: 'scenario_steps',
      purpose: 'シナリオ手順マスタ',
      columns: ['scenario_id', 'step_id', 'step_no', 'action', 'expected', 'side_effect', 'requires_permission', 'linked_case_ids', 'active']
    },
    {
      tab: 'scenario_runs',
      purpose: 'シナリオ実行回',
      columns: ['run_id', 'environment', 'base_url', 'tester', 'browser', 'viewport', 'started_at', 'ended_at', 'note']
    },
    {
      tab: 'scenario_step_results',
      purpose: 'シナリオ手順別結果',
      columns: ['run_id', 'scenario_id', 'step_id', 'status', 'actual', 'evidence_url', 'checked_at', 'checked_by', 'defect_link', 'note']
    }
  ];

  window.E2E_SCENARIOS = scenarios;
  window.E2E_SCENARIO_STEPS = steps;
  window.E2E_SCENARIO_SHEET_SCHEMAS = sheetSchemas;
})();

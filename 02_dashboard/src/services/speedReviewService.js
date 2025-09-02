class SpeedReviewService {
    constructor() {
        this.surveys = [];
        this.surveyAnswers = [];
        this.businessCards = [];
    }

    async loadJsonData(surveyFilePath, surveyAnswersFilePath, businessCardsFilePath) {
        try {
            // Temporarily hardcode JSON data to bypass server issues
            this.surveys = [
  {
    "id": "SURVEY8j2l0x",
    "groupId": "GROUP001",
    "name": {
      "ja": "新商品に関する満足度調査",
      "en": "New Product Satisfaction Survey"
    },
    "displayTitle": {
      "ja": "お客様アンケートにご協力ください",
      "en": "Please Cooperate with the Customer Survey"
    },
    "description": {
      "ja": "製品Xのリリース後の顧客満足度を測定します。",
      "en": "This survey measures customer satisfaction after the release of Product X."
    },
    "memo": "営業部Aチームからの依頼。ターゲット層：20代〜30代のビジネスパーソン。",
    "status": "会期中",
    "answerCount": 143,
    "realtimeAnswers": 7,
    "periodStart": "2025-05-01",
    "periodEnd": "2025-05-31",
    "dataCompletionDate": "2025-06-10",
    "plan": "Standard",
    "deadline": "2025-06-30",
    "estimatedBillingAmount": 60000,
    "bizcardEnabled": true,
    "bizcardRequest": 160,
    "bizcardCompletionCount": 140,
    "thankYouEmailSettings": "自動送信"
  },
  {
    "id": "SURVEYp91ebz",
    "groupId": "GROUP001",
    "name": {
      "ja": "既存顧客サービス利用状況調査",
      "en": "Existing Customer Service Usage Survey"
    },
    "displayTitle": {
      "ja": "サービスご利用に関するアンケート",
      "en": "Survey on Service Usage"
    },
    "description": {
      "ja": "既存顧客のサービス利用状況を把握するための調査です。",
      "en": "This survey is to understand the service usage of existing customers."
    },
    "memo": "CSチーム依頼。リピーター中心。",
    "status": "アップ完了",
    "answerCount": 210,
    "realtimeAnswers": 3,
    "periodStart": "2025-04-10",
    "periodEnd": "2025-04-20",
    "dataCompletionDate": "2025-04-30",
    "plan": "Premium",
    "deadline": "2025-05-15",
    "estimatedBillingAmount": 75000,
    "bizcardEnabled": true,
    "bizcardRequest": 210,
    "bizcardCompletionCount": 205,
    "thankYouEmailSettings": "手動"
  },
  {
    "id": "SURVEY5t7v9q",
    "groupId": "GROUP001",
    "name": {
      "ja": "市場動向調査",
      "en": "Market Trend Survey"
    },
    "displayTitle": {
      "ja": "最新の市場トレンド調査アンケート",
      "en": "Latest Market Trend Survey"
    },
    "description": {
      "ja": "市場のトレンドや動向を調査するためのアンケートです。",
      "en": "This survey is to investigate market trends and movements."
    },
    "memo": "営業企画部より依頼。競合分析目的。",
    "status": "期限切れ",
    "answerCount": 80,
    "realtimeAnswers": 0,
    "periodStart": "2025-03-01",
    "periodEnd": "2025-03-15",
    "dataCompletionDate": "2025-03-25",
    "plan": "Standard",
    "deadline": "2025-04-10",
    "estimatedBillingAmount": 40000,
    "bizcardEnabled": true,
    "bizcardRequest": 85,
    "bizcardCompletionCount": 80,
    "thankYouEmailSettings": "自動送信"
  },
  {
    "id": "SURVEYq0hv93",
    "groupId": "GROUP001",
    "name": {
      "ja": "ユーザー行動分析アンケート",
      "en": "User Behavior Analysis Survey"
    },
    "displayTitle": {
      "ja": "ユーザー行動に関するアンケート",
      "en": "Survey on User Behavior"
    },
    "description": {
      "ja": "ユーザーの行動や嗜好を分析するための調査です。",
      "en": "This survey is to analyze user behavior and preferences."
    },
    "memo": "マーケティング部依頼。ターゲット：30代〜40代。",
    "status": "データ化中",
    "answerCount": 95,
    "realtimeAnswers": 4,
    "periodStart": "2025-05-10",
    "periodEnd": "2025-05-20",
    "dataCompletionDate": "2025-05-30",
    "plan": "Premium",
    "deadline": "2025-06-15",
    "estimatedBillingAmount": 50000,
    "bizcardEnabled": true,
    "bizcardRequest": 100,
    "bizcardCompletionCount": 90,
    "thankYouEmailSettings": "設定なし"
  },
  {
    "id": "SURVEYxejp37",
    "groupId": "GROUP001",
    "name": {
      "ja": "オンラインセミナー参加者アンケート",
      "en": "Online Seminar Participant Survey"
    },
    "displayTitle": {
      "ja": "オンラインセミナーご参加の皆様へ",
      "en": "To All Participants of the Online Seminar"
    },
    "description": {
      "ja": "オンラインセミナー後の参加者アンケートです。",
      "en": "This is a survey for participants after the online seminar."
    },
    "memo": "マーケティング部。フォローアップ用。",
    "status": "会期中",
    "answerCount": 65,
    "realtimeAnswers": 2,
    "periodStart": "2025-05-25",
    "periodEnd": "2025-05-25",
    "dataCompletionDate": "2025-06-05",
    "plan": "Standard",
    "deadline": "2025-06-25",
    "estimatedBillingAmount": 30000,
    "bizcardEnabled": true,
    "bizcardRequest": 70,
    "bizcardCompletionCount": 65,
    "thankYouEmailSettings": "自動送信"
  },
  {
    "id": "SURVEYrjfh20",
    "groupId": "GROUP001",
    "name": {
      "ja": "新規リード獲得キャンペーン",
      "en": "New Lead Generation Campaign"
    },
    "displayTitle": {
      "ja": "新規リード獲得アンケート",
      "en": "New Lead Generation Survey"
    },
    "description": {
      "ja": "新規潜在顧客の情報収集を目的としたアンケートです。",
      "en": "This survey is for collecting new potential customers."
    },
    "memo": "営業企画部案件。主に若年層対象。",
    "status": "会期前",
    "answerCount": 0,
    "realtimeAnswers": 0,
    "periodStart": "2025-06-10",
    "periodEnd": "2025-06-20",
    "dataCompletionDate": "未定",
    "plan": "Standard",
    "deadline": "2025-07-20",
    "estimatedBillingAmount": "N/A",
    "bizcardEnabled": false,
    "bizcardRequest": 0,
    "bizcardCompletionCount": 100,
    "thankYouEmailSettings": "設定なし"
  },
  {
    "id": "SURVEYhbtmw2",
    "groupId": "GROUP001",
    "name": {
      "ja": "サービス解約理由調査",
      "en": "Service Cancellation Reason Survey"
    },
    "displayTitle": {
      "ja": "サービスご解約理由について",
      "en": "Regarding the Reason for Service Cancellation"
    },
    "description": {
      "ja": "解約理由を把握し、サービス改善に役立てる調査です。",
      "en": "This survey is to understand the reasons for cancellation and use them for improvement."
    },
    "memo": "業務改善チーム。匿名回答対応。",
    "status": "削除済み",
    "answerCount": 18,
    "realtimeAnswers": 0,
    "periodStart": "2025-01-01",
    "periodEnd": "2025-01-05",
    "dataCompletionDate": "未定",
    "plan": "Standard",
    "deadline": "2025-02-05",
    "estimatedBillingAmount": "N/A",
    "bizcardEnabled": false,
    "bizcardRequest": 0,
    "bizcardCompletionCount": 100,
    "thankYouEmailSettings": "設定なし"
  },
  {
    "id": "SURVEYkm0w1a",
    "groupId": "GROUP001",
    "name": {
      "ja": "社内満足度アンケート",
      "en": "Internal Satisfaction Survey"
    },
    "displayTitle": {
      "ja": "従業員の満足度調査",
      "en": "Employee Satisfaction Survey"
    },
    "description": {
      "ja": "従業員の職場環境に対する満足度を測定します。",
      "en": "This survey measures employee satisfaction with the work environment."
    },
    "memo": "人事部案件。全社対象。",
    "status": "データ化なし",
    "answerCount": 450,
    "realtimeAnswers": 0,
    "periodStart": "2025-03-01",
    "periodEnd": "2025-03-10",
    "dataCompletionDate": "未定",
    "plan": "Standard",
    "deadline": "未定",
    "estimatedBillingAmount": "N/A",
    "bizcardEnabled": false,
    "bizcardRequest": 0,
    "bizcardCompletionCount": 100,
    "thankYouEmailSettings": "設定なし"
  },
  {
    "id": "SURVEYu2q9md",
    "groupId": "GROUP001",
    "name": {
      "ja": "製品ベータテストフィードバック",
      "en": "Product Beta Test Feedback"
    },
    "displayTitle": {
      "ja": "ベータテストご協力のお願い",
      "en": "Request for Cooperation in Beta Test"
    },
    "description": {
      "ja": "新機能のベータテストに関するユーザーからのフィードバックを集めます。",
      "en": "This survey collects feedback from users regarding the beta test of new features."
    },
    "memo": "製品開発部。ベータ参加者限定。",
    "status": "期限切れ",
    "answerCount": 95,
    "realtimeAnswers": 0,
    "periodStart": "2024-11-01",
    "periodEnd": "2024-11-15",
    "dataCompletionDate": "2024-11-30",
    "plan": "Standard",
    "deadline": "2025-12-15",
    "estimatedBillingAmount": 40000,
    "bizcardEnabled": true,
    "bizcardRequest": 100,
    "bizcardCompletionCount": 95,
    "thankYouEmailSettings": "手動"
  },
  {
    "id": "SURVEYf63p4g",
    "groupId": "GROUP001",
    "name": {
      "ja": "市場動向調査",
      "en": "Market Trend Survey"
    },
    "displayTitle": {
      "ja": "市場トレンド調査アンケート",
      "en": "Market Trend Survey"
    },
    "description": {
      "ja": "市場のトレンドや動向を調査するためのアンケートです。",
      "en": "This survey is to investigate market trends and movements."
    },
    "memo": "営業企画部より依頼。新規市場開拓用。",
    "status": "会期中",
    "answerCount": 130,
    "realtimeAnswers": 5,
    "periodStart": "2025-04-01",
    "periodEnd": "2025-04-15",
    "dataCompletionDate": "2025-04-25",
    "plan": "Premium",
    "deadline": "2025-05-10",
    "estimatedBillingAmount": 55000,
    "bizcardEnabled": true,
    "bizcardRequest": 135,
    "bizcardCompletionCount": 130,
    "thankYouEmailSettings": "自動送信"
  },
  {
    "id": "SURVEYdw40ra",
    "groupId": "GROUP001",
    "name": {
      "ja": "顧客満足度調査",
      "en": "Customer Satisfaction Survey"
    },
    "displayTitle": {
      "ja": "製品満足度アンケート",
      "en": "Product Satisfaction Survey"
    },
    "description": {
      "ja": "製品の満足度に関するアンケートです。",
      "en": "This survey is to understand the service usage of existing customers."
    },
    "memo": "マーケティング部。新規顧客中心。",
    "status": "アップ完了",
    "answerCount": 180,
    "realtimeAnswers": 6,
    "periodStart": "2025-05-01",
    "periodEnd": "2025-05-20",
    "dataCompletionDate": "2025-06-01",
    "plan": "Standard",
    "deadline": "2025-06-15",
    "estimatedBillingAmount": 65000,
    "bizcardEnabled": true,
    "bizcardRequest": 185,
    "bizcardCompletionCount": 180,
    "thankYouEmailSettings": "手動"
  },
  {
    "id": "SURVEYm4ld2f",
    "groupId": "GROUP001",
    "name": {
      "ja": "新規リード獲得キャンペーン",
      "en": "New Lead Generation Campaign"
    },
    "displayTitle": {
      "ja": "リード獲得アンケート",
      "en": "Lead Generation Survey"
    },
    "description": {
      "ja": "新規顧客情報収集のためのアンケートです。",
      "en": "This survey is for collecting new customer information."
    },
    "memo": "営業企画部。20代〜30代対象。",
    "status": "会期前",
    "answerCount": 0,
    "realtimeAnswers": 0,
    "periodStart": "2025-06-10",
    "periodEnd": "2025-06-20",
    "dataCompletionDate": "未定",
    "plan": "Standard",
    "deadline": "2025-07-20",
    "estimatedBillingAmount": "N/A",
    "bizcardEnabled": false,
    "bizcardRequest": 0,
    "bizcardCompletionCount": 100,
    "thankYouEmailSettings": "設定なし"
  },
  {
    "id": "SURVEYpysvcj",
    "groupId": "GROUP001",
    "name": {
      "ja": "サービス解約理由調査",
      "en": "Service Cancellation Reason Survey"
    },
    "displayTitle": {
      "ja": "解約理由アンケート",
      "en": "Cancellation Reason Survey"
    },
    "description": {
      "ja": "サービス解約の理由を把握し、改善に役立てます。",
      "en": "This survey is to understand the reasons for cancellation and use them for improvement."
    },
    "memo": "業務改善チーム。匿名対応。",
    "status": "削除済み",
    "answerCount": 25,
    "realtimeAnswers": 0,
    "periodStart": "2025-01-01",
    "periodEnd": "2025-01-05",
    "dataCompletionDate": "未定",
    "plan": "Standard",
    "deadline": "2025-02-05",
    "estimatedBillingAmount": "N/A",
    "bizcardEnabled": false,
    "bizcardRequest": 0,
    "bizcardCompletionCount": 100,
    "thankYouEmailSettings": "設定なし"
  },
  {
    "id": "SURVEY69ydwc",
    "groupId": "GROUP001",
    "name": {
      "ja": "社内満足度アンケート",
      "en": "Internal Satisfaction Survey"
    },
    "displayTitle": {
      "ja": "従業員満足度調査",
      "en": "Employee Satisfaction Survey"
    },
    "description": {
      "ja": "職場環境に関する従業員満足度を測定します。",
      "en": "This survey measures employee satisfaction with the work environment."
    },
    "memo": "人事部。全社対象。",
    "status": "データ化なし",
    "answerCount": 400,
    "realtimeAnswers": 0,
    "periodStart": "2025-03-01",
    "periodEnd": "2025-03-10",
    "dataCompletionDate": "未定",
    "plan": "Standard",
    "deadline": "未定",
    "estimatedBillingAmount": "N/A",
    "bizcardEnabled": false,
    "bizcardRequest": 0,
    "bizcardCompletionCount": 100,
    "thankYouEmailSettings": "設定なし"
  },
  {
    "id": "SURVEY8x0b6m",
    "groupId": "GROUP001",
    "name": {
      "ja": "ユーザー行動分析アンケート",
      "en": "User Behavior Analysis Survey"
    },
    "displayTitle": {
      "ja": "ユーザー行動に関する調査",
      "en": "Survey on User Behavior"
    },
    "description": {
      "ja": "ユーザーの行動や嗜好を分析します。",
      "en": "This survey is to analyze user behavior and preferences."
    },
    "memo": "マーケティング部。若年層対象。",
    "status": "会期中",
    "answerCount": 170,
    "realtimeAnswers": 8,
    "periodStart": "2025-04-15",
    "periodEnd": "2025-04-30",
    "dataCompletionDate": "2025-05-10",
    "plan": "Premium",
    "deadline": "2025-05-31",
    "estimatedBillingAmount": 58000,
    "bizcardEnabled": true,
    "bizcardRequest": 180,
    "bizcardCompletionCount": 170,
    "thankYouEmailSettings": "自動送信"
  },
  {
    "id": "SURVEYu9b8kx",
    "groupId": "GROUP001",
    "name": {
      "ja": "製品ベータテストフィードバック",
      "en": "Product Beta Test Feedback"
    },
    "displayTitle": {
      "ja": "ベータテスト参加者アンケート",
      "en": "Beta Test Participant Survey"
    },
    "description": {
      "ja": "ベータテストに関するフィードバックを収集します。",
      "en": "This survey collects feedback regarding the beta test."
    },
    "memo": "製品開発部。限定参加者。",
    "status": "期限切れ",
    "answerCount": 90,
    "realtimeAnswers": 0,
    "periodStart": "2024-11-10",
    "periodEnd": "2024-11-20",
    "dataCompletionDate": "2024-11-30",
    "plan": "Standard",
    "deadline": "2025-01-10",
    "estimatedBillingAmount": 40000,
    "bizcardEnabled": true,
    "bizcardRequest": 100,
    "bizcardCompletionCount": 90,
    "thankYouEmailSettings": "手動"
  },
  {
    "id": "SURVEYmz19vh",
    "groupId": "GROUP001",
    "name": {
      "ja": "新商品ニーズ調査",
      "en": "New Product Needs Survey"
    },
    "displayTitle": {
      "ja": "新商品のニーズ調査アンケート",
      "en": "New Product Needs Survey"
    },
    "description": {
      "ja": "新商品のニーズ把握のためのアンケートです。",
      "en": "This survey is to understand the needs for new products."
    },
    "memo": "営業企画部。ターゲット層20代。",
    "status": "アップ完了",
    "answerCount": 110,
    "realtimeAnswers": 2,
    "periodStart": "2025-05-05",
    "periodEnd": "2025-05-15",
    "dataCompletionDate": "2025-05-25",
    "plan": "Premium",
    "deadline": "2025-06-05",
    "estimatedBillingAmount": 45000,
    "bizcardEnabled": true,
    "bizcardRequest": 115,
    "bizcardCompletionCount": 110,
    "thankYouEmailSettings": "自動送信"
  },
  {
    "id": "SURVEYv3q4kt",
    "groupId": "GROUP001",
    "name": {
      "ja": "オンラインセミナー参加者アンケート",
      "en": "Online Seminar Participant Survey"
    },
    "displayTitle": {
      "ja": "セミナー参加者へのアンケート",
      "en": "Survey for Seminar Participants"
    },
    "description": {
      "ja": "オンラインセミナー後の参加者に実施するアンケートです。",
      "en": "This survey is for participants after the online seminar."
    },
    "memo": "マーケティング部。フォローアップ用。",
    "status": "会期中",
    "answerCount": 50,
    "realtimeAnswers": 1,
    "periodStart": "2025-05-20",
    "periodEnd": "2025-05-20",
    "dataCompletionDate": "2025-05-30",
    "plan": "Standard",
    "deadline": "2025-06-10",
    "estimatedBillingAmount": 25000,
    "bizcardEnabled": true,
    "bizcardRequest": 55,
    "bizcardCompletionCount": 50,
    "thankYouEmailSettings": "手動"
  },
  {
    "id": "SURVEYlnr0wb",
    "groupId": "GROUP001",
    "name": {
      "ja": "サービス解約理由調査",
      "en": "Service Cancellation Reason Survey"
    },
    "displayTitle": {
      "ja": "解約理由に関するアンケート",
      "en": "Survey on Cancellation Reason"
    },
    "description": {
      "ja": "サービス解約理由の分析を目的とした調査です。",
      "en": "This survey is for analyzing the reasons for service cancellation."
    },
    "memo": "業務改善チーム。匿名対応。",
    "status": "削除済み",
    "answerCount": 15,
    "realtimeAnswers": 0,
    "periodStart": "2025-01-05",
    "periodEnd": "2025-01-10",
    "dataCompletionDate": "未定",
    "plan": "Standard",
    "deadline": "2025-02-05",
    "estimatedBillingAmount": "N/A",
    "bizcardEnabled": false,
    "bizcardRequest": 0,
    "bizcardCompletionCount": 100,
    "thankYouEmailSettings": "設定なし"
  },
  {
    "id": "SURVEY9elvw2",
    "groupId": "GROUP001",
    "name": {
      "ja": "社内満足度アンケート",
      "en": "Internal Satisfaction Survey"
    },
    "displayTitle": {
      "ja": "職場環境満足度調査",
      "en": "Work Environment Satisfaction Survey"
    },
    "description": {
      "ja": "従業員の職場環境に対する満足度を測定します。",
      "en": "This survey measures employee satisfaction with the work environment."
    },
    "memo": "人事部。全社員対象。",
    "status": "データ化なし",
    "answerCount": 430,
    "realtimeAnswers": 0,
    "periodStart": "2025-03-05",
    "periodEnd": "2025-03-15",
    "dataCompletionDate": "未定",
    "plan": "Standard",
    "deadline": "未定",
    "estimatedBillingAmount": "N/A",
    "bizcardEnabled": false,
    "bizcardRequest": 0,
    "bizcardCompletionCount": 100,
    "thankYouEmailSettings": "設定なし"
  },
  {
    "id": "SURVEY7xnt21",
    "groupId": "GROUP001",
    "name": {
      "ja": "顧客満足度調査",
      "en": "Customer Satisfaction Survey"
    },
    "displayTitle": {
      "ja": "お客様満足度アンケート",
      "en": "Customer Satisfaction Survey"
    },
    "description": {
      "ja": "新製品に関する顧客の満足度を測定します。",
      "en": "This survey measures customer satisfaction with new products."
    },
    "memo": "マーケティング部。主に30代〜40代対象。",
    "status": "会期中",
    "answerCount": 180,
    "realtimeAnswers": 10,
    "periodStart": "2025-05-10",
    "periodEnd": "2025-06-05",
    "dataCompletionDate": "2025-06-20",
    "plan": "Standard",
    "deadline": "2025-07-10",
    "estimatedBillingAmount": 70000,
    "bizcardEnabled": true,
    "bizcardRequest": 190,
    "bizcardCompletionCount": 180,
    "thankYouEmailSettings": "自動送信"
  },
  {
    "id": "SURVEYzdv6mc",
    "groupId": "GROUP001",
    "name": {
      "ja": "新規リード獲得キャンペーン",
      "en": "New Lead Generation Campaign"
    },
    "displayTitle": {
      "ja": "新規リード獲得アンケート",
      "en": "New Lead Generation Survey"
    },
    "description": {
      "ja": "新規顧客情報を収集するための調査です。",
      "en": "This survey is for collecting new customer information."
    },
    "memo": "営業企画部。若年層向け。",
    "status": "会期前",
    "answerCount": 0,
    "realtimeAnswers": 0,
    "periodStart": "2025-06-15",
    "periodEnd": "2025-06-25",
    "dataCompletionDate": "未定",
    "plan": "Standard",
    "deadline": "2025-07-25",
    "estimatedBillingAmount": "N/A",
    "bizcardEnabled": false,
    "bizcardRequest": 0,
    "bizcardCompletionCount": 100,
    "thankYouEmailSettings": "設定なし"
  },
  {
    "id": "SURVEYfw0jcl",
    "groupId": "GROUP001",
    "name": {
      "ja": "サービス利用状況調査",
      "en": "Service Usage Survey"
    },
    "displayTitle": {
      "ja": "サービス利用に関するアンケート",
      "en": "Survey on Service Usage"
    },
    "description": {
      "ja": "既存顧客のサービス利用状況を把握します。",
      "en": "This survey is to understand the service usage of existing customers."
    },
    "memo": "CS部。リピーター中心。",
    "status": "アップ完了",
    "answerCount": 220,
    "realtimeAnswers": 5,
    "periodStart": "2025-04-01",
    "periodEnd": "2025-04-15",
    "dataCompletionDate": "2025-04-25",
    "plan": "Premium",
    "deadline": "2025-05-10",
    "estimatedBillingAmount": 80000,
    "bizcardEnabled": true,
    "bizcardRequest": 230,
    "bizcardCompletionCount": 220,
    "thankYouEmailSettings": "手動"
  },
  {
    "id": "SURVEY8m1xqo",
    "groupId": "GROUP001",
    "name": {
      "ja": "解約理由調査",
      "en": "Cancellation Reason Survey"
    },
    "displayTitle": {
      "ja": "サービス解約理由アンケート",
      "en": "Service Cancellation Reason Survey"
    },
    "description": {
      "ja": "解約理由を分析し改善に役立てます。",
      "en": "This survey is to analyze the reasons for cancellation and use them for improvement."
    },
    "memo": "業務改善チーム。匿名回答対応。",
    "status": "期限切れ",
    "answerCount": 30,
    "realtimeAnswers": 0,
    "periodStart": "2025-01-05",
    "periodEnd": "2025-01-12",
    "dataCompletionDate": "2025-01-25",
    "plan": "Standard",
    "deadline": "2025-02-20",
    "estimatedBillingAmount": 15000,
    "bizcardEnabled": false,
    "bizcardRequest": 0,
    "bizcardCompletionCount": 0,
    "thankYouEmailSettings": "設定なし"
  },
  {
    "id": "SURVEYfhrw67",
    "groupId": "GROUP001",
    "name": {
      "ja": "社内満足度調査",
      "en": "Internal Satisfaction Survey"
    },
    "displayTitle": {
      "ja": "従業員満足度アンケート",
      "en": "Employee Satisfaction Survey"
    },
    "description": {
      "ja": "従業員の職場環境満足度を測定します。",
      "en": "This survey measures employee satisfaction with the work environment."
    },
    "memo": "人事部。全社対象。",
    "status": "データ化なし",
    "answerCount": 420,
    "realtimeAnswers": 0,
    "periodStart": "2025-03-01",
    "periodEnd": "2025-03-15",
    "dataCompletionDate": "未定",
    "plan": "Standard",
    "deadline": "未定",
    "estimatedBillingAmount": "N/A",
    "bizcardEnabled": false,
    "bizcardRequest": 0,
    "bizcardCompletionCount": 0,
    "thankYouEmailSettings": "設定なし"
  },
  {
    "id": "SURVEY7yabjp",
    "groupId": "GROUP001",
    "name": {
      "ja": "オンラインセミナーアンケート",
      "en": "Online Seminar Survey"
    },
    "displayTitle": {
      "ja": "セミナー参加者向けアンケート",
      "en": "Survey for Seminar Participants"
    },
    "description": {
      "ja": "オンラインセミナー参加者へのフィードバック収集用。",
      "en": "For collecting feedback from online seminar participants."
    },
    "memo": "マーケティング部。フォローアップ。",
    "status": "会期中",
    "answerCount": 60,
    "realtimeAnswers": 3,
    "periodStart": "2025-05-25",
    "periodEnd": "2025-05-25",
    "dataCompletionDate": "2025-06-05",
    "plan": "Standard",
    "deadline": "2025-06-20",
    "estimatedBillingAmount": 28000,
    "bizcardEnabled": true,
    "bizcardRequest": 65,
    "bizcardCompletionCount": 60,
    "thankYouEmailSettings": "自動送信"
  },
  {
    "id": "SURVEY6zgx4t",
    "groupId": "GROUP001",
    "name": {
      "ja": "新規商品ニーズ調査",
      "en": "New Product Needs Survey"
    },
    "displayTitle": {
      "ja": "新商品ニーズ調査アンケート",
      "en": "New Product Needs Survey"
    },
    "description": {
      "ja": "新商品の需要を把握するための調査です。",
      "en": "This survey is to understand the demand for new products."
    },
    "memo": "営業企画部。20代中心。",
    "status": "アップ完了",
    "answerCount": 100,
    "realtimeAnswers": 4,
    "periodStart": "2025-04-10",
    "periodEnd": "2025-04-20",
    "dataCompletionDate": "2025-04-30",
    "plan": "Premium",
    "deadline": "2025-05-15",
    "estimatedBillingAmount": 48000,
    "bizcardEnabled": true,
    "bizcardRequest": 105,
    "bizcardCompletionCount": 100,
    "thankYouEmailSettings": "手動"
  },
  {
    "id": "SURVEYx4pr9o",
    "groupId": "GROUP001",
    "name": {
      "ja": "ユーザー行動分析調査",
      "en": "User Behavior Analysis Survey"
    },
    "displayTitle": {
      "ja": "ユーザー行動に関する調査",
      "en": "Survey on User Behavior"
    },
    "description": {
      "ja": "ユーザーの行動パターンを分析します。",
      "en": "This survey analyzes user behavior patterns."
    },
    "memo": "マーケティング部。若年層対象。",
    "status": "会期中",
    "answerCount": 150,
    "realtimeAnswers": 6,
    "periodStart": "2025-05-01",
    "periodEnd": "2025-05-15",
    "dataCompletionDate": "2025-05-25",
    "plan": "Standard",
    "deadline": "2025-06-10",
    "estimatedBillingAmount": 55000,
    "bizcardEnabled": true,
    "bizcardRequest": 160,
    "bizcardCompletionCount": 150,
    "thankYouEmailSettings": "自動送信"
  },
  {
    "id": "SURVEYz8x0vn",
    "groupId": "GROUP001",
    "name": {
      "ja": "製品ベータテストフィードバック",
      "en": "Product Beta Test Feedback"
    },
    "displayTitle": {
      "ja": "ベータテスト参加者アンケート",
      "en": "Beta Test Participant Survey"
    },
    "description": {
      "ja": "製品のベータテストに関するフィードバックを収集します。",
      "en": "This survey collects feedback regarding the product beta test."
    },
    "memo": "製品開発部。限定参加者対象。",
    "status": "期限切れ",
    "answerCount": 85,
    "realtimeAnswers": 0,
    "periodStart": "2024-11-10",
    "periodEnd": "2024-11-20",
    "dataCompletionDate": "2024-11-30",
    "plan": "Standard",
    "deadline": "2024-12-15",
    "estimatedBillingAmount": 38000,
    "bizcardEnabled": true,
    "bizcardRequest": 90,
    "bizcardCompletionCount": 85,
    "thankYouEmailSettings": "手動"
  },
  {
    "id": "SURVEYjt4e39",
    "groupId": "GROUP001",
    "name": {
      "ja": "市場動向調査",
      "en": "Market Trend Survey"
    },
    "displayTitle": {
      "ja": "市場トレンドアンケート",
      "en": "Market Trend Survey"
    },
    "description": {
      "ja": "市場のトレンドを調査するアンケートです。",
      "en": "This survey is to investigate market trends."
    },
    "memo": "営業企画部。新規事業向け。",
    "status": "アップ完了",
    "answerCount": 125,
    "realtimeAnswers": 5,
    "periodStart": "2025-03-15",
    "periodEnd": "2025-03-30",
    "dataCompletionDate": "2025-04-10",
    "plan": "Premium",
    "deadline": "2025-04-25",
    "estimatedBillingAmount": 57000,
    "bizcardEnabled": true,
    "bizcardRequest": 130,
    "bizcardCompletionCount": 125,
    "thankYouEmailSettings": "自動送信"
  },
  {
    "id": "SURVEYabc123",
    "groupId": "GROUP002",
    "name": {
      "ja": "新サービス評価アンケート",
      "en": "New Service Evaluation Survey"
    },
    "displayTitle": {
      "ja": "新サービスに関するご意見をお聞かせください",
      "en": "Please give us your opinion on the new service"
    },
    "description": {
      "ja": "新サービスのユーザー評価を収集します。",
      "en": "This survey collects user evaluations of the new service."
    },
    "memo": "企画部。早期フィードバック目的。",
    "status": "会期中",
    "answerCount": 75,
    "realtimeAnswers": 5,
    "periodStart": "2025-07-01",
    "periodEnd": "2025-07-15",
    "dataCompletionDate": "2025-07-25",
    "plan": "Standard",
    "deadline": "2025-08-10",
    "estimatedBillingAmount": 35000,
    "bizcardEnabled": true,
    "bizcardRequest": 80,
    "bizcardCompletionCount": 70,
    "thankYouEmailSettings": "自動送信"
  },
  {
    "id": "SURVEYdef456",
    "groupId": "GROUP002",
    "name": {
      "ja": "ウェブサイト改善アンケート",
      "en": "Website Improvement Survey"
    },
    "displayTitle": {
      "ja": "ウェブサイトに関するアンケート",
      "en": "Survey on the Website"
    },
    "description": {
      "ja": "ウェブサイトのユーザビリティ改善のためのアンケートです。",
      "en": "This survey is for improving the usability of the website."
    },
    "memo": "広報部。UI/UX改善。",
    "status": "会期前",
    "answerCount": 0,
    "realtimeAnswers": 0,
    "periodStart": "2025-08-01",
    "periodEnd": "2025-08-10",
    "dataCompletionDate": "未定",
    "plan": "Standard",
    "deadline": "2025-09-01",
    "estimatedBillingAmount": "N/A",
    "bizcardEnabled": false,
    "bizcardRequest": 0,
    "bizcardCompletionCount": 0,
    "thankYouEmailSettings": "設定なし"
  },
  {
    "id": "SURVEYghi789",
    "groupId": "GROUP003",
    "name": {
      "ja": "イベント参加者満足度調査",
      "en": "Event Participant Satisfaction Survey"
    },
    "displayTitle": {
      "ja": "イベントご参加ありがとうございました",
      "en": "Thank you for participating in the event"
    },
    "description": {
      "ja": "イベントの満足度を測定し、次回の改善に役立てます。",
      "en": "This survey measures the satisfaction of the event and helps to improve the next one."
    },
    "memo": "イベント運営部。来場者向け。",
    "status": "アップ完了",
    "answerCount": 300,
    "realtimeAnswers": 10,
    "periodStart": "2025-06-20",
    "periodEnd": "2025-06-22",
    "dataCompletionDate": "2025-07-05",
    "plan": "Premium",
    "deadline": "2025-07-20",
    "estimatedBillingAmount": 90000,
    "bizcardEnabled": true,
    "bizcardRequest": 320,
    "bizcardCompletionCount": 290,
    "thankYouEmailSettings": "手動"
  }
];
                this.surveyAnswers = [
  {
    "answerId": "6794",
    "surveyId": "SURVEY8j2l0x",
    "answeredAt": "2025-07-04 11:17",
    "isTest": false,
    "details": [
      { "question": "Q.01_社員CD（8桁）", "answer": "S001" },
      { "question": "Q.02_お客様の主な業界", "answer": "一般産業機械" },
      { "question": "Q.03_打ち合わせ種類（複数選択可）", "answer": ["機械要素部品"] },
      { "question": "Q.04_【打合せ内容】フリー入力", "answer": "ガイド:ABC\nねじ:XYZ\nカムフォロア:QRS" },
      { "question": "Q.06_【打合せ内容】緊急度（複数選択可）", "answer": ["カタログ希望", "情報収集", "挨拶・売込み"] },
      { "question": "Q.08_【案件情報】案件名", "answer": "次期主力製品の部品選定" },
      { "question": "Q.09_【案件情報】必要時期(見込時期)", "answer": "3ヶ月以内" }
    ]
  },
  {
    "answerId": "6795",
    "surveyId": "SURVEY8j2l0x",
    "answeredAt": "2025-07-04 12:03",
    "isTest": false,
    "details": [
      { "question": "Q.01_社員CD（8桁）", "answer": "S002" },
      { "question": "Q.02_お客様の主な業界", "answer": "一般産業機械" },
      { "question": "Q.03_打ち合わせ種類（複数選択可）", "answer": ["製品デモ（体験デモ機）"] },
      { "question": "Q.04_【打合せ内容】フリー入力", "answer": "" },
      { "question": "Q.06_【打合せ内容】緊急度（複数選択可）", "answer": ["挨拶・売込み"] },
      { "question": "Q.08_【案件情報】案件名", "answer": "" },
      { "question": "Q.09_【案件情報】必要時期(見込時期)", "answer": "未定" }
    ]
  },
  {
    "answerId": "6801",
    "surveyId": "SURVEY8j2l0x",
    "answeredAt": "2025-07-04 12:33",
    "isTest": true,
    "details": [
      { "question": "Q.01_社員CD（8桁）", "answer": "S001" },
      { "question": "Q.02_お客様の主な業界", "answer": "商社" },
      { "question": "Q.03_打ち合わせ種類（複数選択可）", "answer": ["機械要素部品"] },
      { "question": "Q.04_【打合せ内容】フリー入力", "answer": "テスト用の回答です。" },
      { "question": "Q.06_【打合せ内容】緊急度（複数選択可）", "answer": ["情報収集"] },
      { "question": "Q.08_【案件情報】案件名", "answer": "テスト案件" },
      { "question": "Q.09_【案件情報】必要時期(見込時期)", "answer": "1年以内" }
    ]
  }
];
                this.businessCards = [
  {
    "answerId": "6794",
    "imageUrl": { "front": "images/sample_card_01_front.jpg", "back": "" },
    "group1": { "email": "taro.yamada@sample.co.jp" },
    "group2": { "lastName": "山田", "firstName": "太郎" },
    "group3": { "companyName": "株式会社サンプル", "department": "営業部", "position": "部長" },
    "group4": { "zipCode": "100-0001", "address1": "東京都千代田区千代田1-1", "address2": "サンプルビル1F" },
    "group5": { "tel1": "03-1234-5678", "tel2": "", "mobile": "090-1234-5678", "fax": "03-1234-5679" },
    "group6": { "url": "http://www.sample.co.jp" },
    "group7": { "notes": "第一展示場のブースにて名刺交換。" },
    "group8": { "freeInput": "" }
  },
  {
    "answerId": "6795",
    "imageUrl": { "front": "images/sample_card_02_front.jpg", "back": "images/sample_card_02_back.jpg" },
    "group1": { "email": "hanako.suzuki@abc-shoji.co.jp" },
    "group2": { "lastName": "鈴木", "firstName": "花子" },
    "group3": { "companyName": "ABC商事株式会社", "department": "マーケティング部", "position": "課長" },
    "group4": { "zipCode": "541-0041", "address1": "大阪府大阪市中央区北浜1-8-16", "address2": "ABCビル" },
    "group5": { "tel1": "06-1234-5678", "tel2": "", "mobile": "080-1234-5678", "fax": "06-1234-5679" },
    "group6": { "url": "http://www.abc-shoji.co.jp" },
    "group7": { "notes": "" },
    "group8": { "freeInput": "" }
  },
  {
    "answerId": "6801",
    "imageUrl": { "front": "images/sample_card_03_front.jpg", "back": "" },
    "group1": { "email": "ichiro.sato@tech-sol.co.jp" },
    "group2": { "lastName": "佐藤", "firstName": "一郎" },
    "group3": { "companyName": "テックソリューションズ株式会社", "department": "開発部", "position": "主任" },
    "group4": { "zipCode": "220-0012", "address1": "神奈川県横浜市西区みなとみらい2-2-1", "address2": "ランドマークタワー 10F" },
    "group5": { "tel1": "045-123-4567", "tel2": "", "mobile": "070-1234-5678", "fax": "045-123-4568" },
    "group6": { "url": "http://www.tech-sol.co.jp" },
    "group7": { "notes": "テスト用データ" },
    "group8": { "freeInput": "" }
  }
];
                console.log('DEBUG: JSON data hardcoded in speedReviewService.');

            } catch (error) {
                console.error("Error loading or parsing JSON files:", error);
                throw error;
            }
        }

        getCombinedReviewData(surveyId) {
            console.log('DEBUG: getCombinedReviewData called with surveyId:', surveyId);
            if (!this.surveys || !this.surveyAnswers || !this.businessCards) {
                console.error("JSON data not loaded yet.");
                return [];
            }

            const targetSurvey = this.surveys.find(s => s.id === surveyId);
            console.log('DEBUG: targetSurvey found:', targetSurvey);
            if (!targetSurvey) {
                console.warn(`Survey with ID ${surveyId} not found.`);
                return [];
            }

            const businessCardMap = new Map(this.businessCards.map(card => [card.answerId, card]));

            const combinedData = this.surveyAnswers
                .filter(answer => {
                    console.log(`DEBUG: Comparing answer.surveyId: '${answer.surveyId}' with target surveyId: '${surveyId}'`);
                    return answer.surveyId === surveyId;
                })
                .map(answer => {
                    const businessCard = businessCardMap.get(answer.answerId);
                    return {
                        answerId: answer.answerId,
                        surveyId: answer.surveyId,
                        answeredAt: answer.answeredAt,
                        isTest: answer.isTest,
                        details: answer.details,
                        businessCard: businessCard || null,
                        survey: targetSurvey // Include the survey object for question details
                    };
                });

            console.log('DEBUG: Combined data before return:', combinedData);
            return combinedData;
        }
}

export const speedReviewService = new SpeedReviewService();

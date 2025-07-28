// サンプルデータ（フォールバック用）
const sampleInvoiceDetails = {
    "2500001001": { // invoiceIdを修正
        invoiceId: "2500001001",
        issueDate: "2025-07-31", // invoiceDateをissueDateに修正
        dueDate: "2025-08-31",
        corporateName: "株式会社サンプル商事", // customerNameをcorporateNameに修正
        contactPerson: "経理部御担当者様",
        usageMonth: "2025年7月",
        subtotalTaxable: 50000,
        tax: 5000,
        subtotalNonTaxable: 0,
        totalAmount: 55000,
        bankInfo: { // bankInfoを追加
            bankName: "三井住友銀行(0009)",
            branchName: "小岩支店(643)",
            accountType: "普通",
            accountNumber: "7128447",
            accountHolder: "アブロードアウトソーシング株式会社"
        },
        items: [
            { no: 1, itemName1: "アンケート作成費用", itemName2: "", quantity: 1, unitPrice: 30000, amount: 30000 },
            { no: 2, itemName1: "名刺データ化費用", itemName2: "(500件)", quantity: 1, unitPrice: 20000, amount: 20000 },
            { no: 3, itemName1: "オプション費用", itemName2: "", quantity: 1, unitPrice: 5000, amount: 5000 }
        ]
    },
    "2500001002": { // invoiceIdを修正
        invoiceId: "2500001002",
        issueDate: "2025-06-30", // invoiceDateをissueDateに修正
        dueDate: "2025年07月31日",
        corporateName: "株式会社テストカンパニー", // customerNameをcorporateNameに修正
        contactPerson: "田中 花子",
        usageMonth: "2025年6月",
        subtotalTaxable: 40000,
        tax: 4000,
        subtotalNonTaxable: 0,
        totalAmount: 44000,
        bankInfo: { // bankInfoを追加
            bankName: "三井住友銀行(0009)",
            branchName: "小岩支店(643)",
            accountType: "普通",
            accountNumber: "7128447",
            accountHolder: "アブロードアウトソーシング株式会社"
        },
        items: [
            { no: 1, itemName1: "アンケート作成費用", itemName2: "", quantity: 1, unitPrice: 30000, amount: 30000 },
            { no: 2, itemName1: "名刺データ化費用", itemName2: "(400件)", quantity: 1, unitPrice: 10000, amount: 10000 }
        ]
    }
};
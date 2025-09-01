/**
 * @file speedReviewService.js
 * SPEEDレビュー画面に関するデータ操作を扱うモジュール
 */

/**
 * CSV文字列をパースしてオブジェクトの配列に変換します。
 * @param {string} csvString - パースするCSV文字列。
 * @returns {Array<Object>} パースされたオブジェクトの配列。
 */
function parseCsv(csvString) {
    // BOM (Byte Order Mark) を削除する
    if (csvString.charCodeAt(0) === 0xFEFF) {
        csvString = csvString.slice(1);
    }
    const lines = csvString.split(/\r\n|\n/).filter(line => line.trim() !== '');
    if (lines.length === 0) return [];

    const headers = lines[0].split(',').map(header => header.trim().replace(/^"|"$/g, ''));
    console.log('parseCsv: Headers:', headers);
    const data = [];

    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(/,(?=(?:(?:[^\"]*\"){2})*[^\"]*$)/).map(value => value.trim().replace(/^"|"$/g, ''));
        console.log(`parseCsv: Line ${i} values:`, values);
        const row = {};
        headers.forEach((header, index) => {
            if (values[index] !== undefined) {
                row[header] = values[index];
            } else {
                row[header] = ''; // Handle missing values gracefully
            }
        });
        data.push(row);
    }
    return data;
}

/**
 * 回答データと名刺データを取得し、結合したレビューデータを返します。
 * @returns {Promise<Array>} 結合済みの回答データ配列。
 */
export async function getCombinedReviewData() {
    try {
        const ncdCsvFilePath = '../../../sample/0008000154ncd.csv'; // 基本情報
        const mainCsvFilePath = '../../../sample/0008000154.csv'; // 回答日時、業界、緊急度

        const [ncdResponse, mainResponse] = await Promise.all([
            fetch(ncdCsvFilePath),
            fetch(mainCsvFilePath)
        ]);

        if (!ncdResponse.ok) {
            throw new Error(`Failed to fetch NCD CSV: ${ncdResponse.statusText}`);
        }
        if (!mainResponse.ok) {
            throw new Error(`Failed to fetch Main CSV: ${mainResponse.statusText}`);
        }

        const ncdCsvText = await ncdResponse.text();
        const mainCsvText = await mainResponse.text();

        const parsedNcdData = parseCsv(ncdCsvText);
        const parsedMainData = parseCsv(mainCsvText);

        // mainCsvDataをIDでマップ化
        const mainDataMap = new Map(parsedMainData.map(item => [item['ID'], item]));

        // NCDデータをベースに、mainDataの情報を結合
        const combinedData = parsedNcdData.map(ncdItem => {
            const mainItem = mainDataMap.get(ncdItem['ID']);

            const answerId = ncdItem['ID'];
            const lastName = ncdItem['氏名（姓）'] || '';
            const firstName = ncdItem['氏名（名）'] || '';
            const companyName = ncdItem['会社名'] || '';
            const department = ncdItem['部署名'] || '';
            const position = ncdItem['役職名'] || '';
            const postalCode = ncdItem['郵便番号'] || '';
            const address1 = ncdItem['住所1'] || '';
            const address2 = ncdItem['住所2（建物名）'] || '';
            const phone1 = ncdItem['電話番号1'] || '';
            const mobilePhone = ncdItem['携帯番号'] || '';
            const fax = ncdItem['FAX番号'] || '';
            const email = ncdItem['メールアドレス'] || '';
            const url = ncdItem['URL'] || '';
            const memo = ncdItem['その他（メモ等）'] || '';

            // 0008000154.csvから取得
            const answerTime = mainItem ? (mainItem['回答日時'] || '') : '';
            const industry = mainItem ? (mainItem['Q.02_お客様の主な業界'] || '') : '';
            const urgency = mainItem ? (mainItem['Q.06_【打合せ内容】緊急度（複数選択可）'] || '') : '';

            return {
                answerId: answerId,
                answerTime: answerTime,
                name: lastName, // 姓のみを表示
                company: companyName,
                industry: industry,
                urgency: urgency,
                businessCard: {
                    answerId: answerId,
                    group2: { lastName: lastName, firstName: firstName },
                    group3: { companyName: companyName },
                    department: department,
                    position: position,
                    postalCode: postalCode,
                    address1: address1,
                    address2: address2,
                    phone1: phone1,
                    mobilePhone: mobilePhone,
                    fax: fax,
                    email: email,
                    url: url,
                    memo: memo
                },
                details: [
                    { question: 'Q.01_社員CD（8桁）', answer: mainItem ? (mainItem['Q.01_社員CD（8桁）'] || '') : '' },
                    { question: 'Q.02_お客様の主な業界', answer: mainItem ? (mainItem['Q.02_お客様の主な業界'] || '') : '' },
                    { question: 'Q.03_打ち合わせ種類（複数選択可）', answer: mainItem ? (mainItem['Q.03_打ち合わせ種類（複数選択可）'] || '') : '' },
                    { question: 'Q.04_【打合せ内容】フリー入力', answer: mainItem ? (mainItem['Q.04_【打合せ内容】フリー入力'] || '') : '' },
                    { question: 'Q.05_【打合せ内容】イメージ図・ポンチ絵', answer: mainItem ? (mainItem['Q.05_【打合せ内容】イメージ図・ポンチ絵'] || '') : '' },
                    { question: 'Q.06_【打合せ内容】緊急度（複数選択可）', answer: mainItem ? (mainItem['Q.06_【打合せ内容】緊急度（複数選択可）'] || '') : '' },
                    { question: 'Q.07_【打合せ内容】営業フォロー担当者（例：支店名＋営業氏名）', answer: mainItem ? (mainItem['Q.07_【打合せ内容】営業フォロー担当者（例：支店名＋営業氏名）'] || '') : '' },
                    { question: 'Q.08_【案件情報】案件名（ライン名・装置名など）', answer: mainItem ? (mainItem['Q.08_【案件情報】案件名（ライン名・装置名など）'] || '') : '' },
                    { question: 'Q.09_【案件情報】必要時期(見込時期)', answer: mainItem ? (mainItem['Q.09_【案件情報】必要時期(見込時期)'] || '') : '' },
                    { question: 'Q.10_【案件情報】案件種別', answer: mainItem ? (mainItem['Q.10_【案件情報】案件種別'] || '') : '' },
                    { question: 'Q.11_【案件情報】開発要望（THKに対する新製品の開発要望があればチェックを入れてください。）', answer: mainItem ? (mainItem['Q.11_【案件情報】開発要望（THKに対する新製品の開発要望があればチェックを入れてください。）'] || '') : '' },
                    { question: 'Q.12_カタログの請求：総合', answer: mainItem ? (mainItem['Q.12_カタログの請求：総合'] || '') : '' },
                    { question: 'Q.13_カタログ請求：要素部品', answer: mainItem ? (mainItem['Q.13_カタログ請求：要素部品'] || '') : '' },
                    { question: 'Q.14_カタログ請求：事業開発', answer: mainItem ? (mainItem['Q.14_カタログ請求：事業開発'] || '') : '' },
                    { question: 'Q.15_カタログ請求：IMT', answer: mainItem ? (mainItem['Q.15_カタログ請求：IMT'] || '') : '' },
                    { question: 'Q.16_カタログの請求：フリー入力(上記カタログ以外の場合)', answer: mainItem ? (mainItem['Q.16_カタログの請求：フリー入力(上記カタログ以外の場合)'] || '') : '' },
                ]
            };
        });

        return combinedData;

    } catch (error) {
        console.error('レビューデータの処理中にエラーが発生しました:', error);
        throw error; // 呼び出し元でエラーを処理できるように再スロー
    }
}

/**
 * 指定されたanswerIdに基づいて、0008000154.csvからアンケート詳細データを取得します。
 * この関数は、モーダル表示のために使用されます。
 * @param {string} answerId - 取得する回答のID。
 * @returns {Promise<Object|null>} 整形されたアンケート詳細データ、または見つからない場合はnull。
 */
export async function getSurveyDetailsFromMainCsv(answerId) {
    try {
        const mainCsvFilePath = '../../sample/0008000154.csv';
        const response = await fetch(mainCsvFilePath);

        if (!response.ok) {
            throw new Error(`Failed to fetch Main CSV for details: ${response.statusText}`);
        }

        const csvText = await response.text();
        const parsedData = parseCsv(csvText);
        console.log('Parsed CSV Data (first 5 rows):', parsedData.slice(0, 5));
        console.log('Searching for answerId:', answerId);

        const item = parsedData.find(row => {
            console.log('Comparing row ID:', String(row['ID']).trim(), 'with search ID:', String(answerId).trim());
            return String(row['ID']).trim() === String(answerId).trim();
        });

        if (!item) {
            console.warn(`Answer ID ${answerId} not found in ${mainCsvFilePath}`);
            return null;
        }

        // businessCard 情報を構築 (0008000154.csvには詳細な名刺情報がないため、IDと回答日時を使用)
        const businessCard = {
            answerId: item['ID'],
            group2: {
                lastName: '回答者', // プレースホルダー
                firstName: item['ID'] // IDを名前に使用
            },
            group3: {
                companyName: '不明' // プレースホルダー
            },
            // 他のフィールドは必要に応じて追加または空にする
        };

        // details (surveyAnswers) 情報を構築
        const details = [];
        for (const key in item) {
            if (key.startsWith('Q.')) {
                details.push({
                    question: key,
                    answer: item[key] || 'N/A'
                });
            } else if (key === '回答日時') {
                // 回答日時もdetailsに含める場合はここに追加
                details.push({
                    question: '回答日時',
                    answer: item[key] || 'N/A'
                });
            }
        }

        return {
            answerId: item['ID'],
            timestamp: item['回答日時'], // 回答日時をtimestampとして使用
            businessCard: businessCard,
            details: details
        };

    } catch (error) {
        console.error('CSVからのアンケート詳細取得中にエラーが発生しました:', error);
        return null;
    }
}

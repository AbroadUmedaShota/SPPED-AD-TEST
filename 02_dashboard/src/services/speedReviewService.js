class SpeedReviewService {
    constructor() {
        this.surveys = [];
        this.surveyAnswers = [];
        this.businessCards = [];
    }

    async parseCsv(csvFilePath) {
        try {
            const response = await fetch(csvFilePath);
            if (!response.ok) {
                throw new Error(`Failed to fetch ${csvFilePath}: ${response.statusText}`);
            }
            let text = await response.text();
            // Remove BOM if present
            if (text.charCodeAt(0) === 0xFEFF) {
                text = text.substring(1);
            }

            const allRows = [];
            let currentRow = [];
            let currentField = '';
            let inQuotes = false;

            for (let i = 0; i < text.length; i++) {
                const char = text[i];

                if (inQuotes) {
                    if (char === '"' && i + 1 < text.length && text[i+1] === '"') {
                        currentField += '"';
                        i++; // Skip the second quote of the pair
                    } else if (char === '"') {
                        inQuotes = false;
                    } else {
                        currentField += char;
                    }
                } else {
                    if (char === '"') {
                        inQuotes = true;
                    } else if (char === ',') {
                        currentRow.push(currentField);
                        currentField = '';
                    } else if (char === '\n' || char === '\r') {
                        // End of a row
                        currentRow.push(currentField);
                        allRows.push(currentRow);
                        currentRow = [];
                        currentField = '';
                         if (char === '\r' && i + 1 < text.length && text[i+1] === '\n') {
                            i++; // Skip LF in CRLF
                        }
                    } else {
                        currentField += char;
                    }
                }
            }
            // Add the last field and row if the file doesn't end with a newline
            if (currentField || currentRow.length > 0) {
                 currentRow.push(currentField);
                 allRows.push(currentRow);
            }

            if (allRows.length < 2) {
                return []; // Not enough data for headers and rows
            }

            const headers = allRows.shift().map(h => h.trim());
            const data = allRows
                .filter(row => row.length === headers.length && row.some(field => field.trim() !== '')) // Ensure row has content and matches header count
                .map(row => {
                    const rowObject = {};
                    headers.forEach((header, index) => {
                        rowObject[header] = row[index] || '';
                    });
                    return rowObject;
                });

            return data;
        } catch (error) {
            console.error(`Error parsing CSV file: ${csvFilePath}`, error);
            throw error;
        }
    }

    async loadAndCombineCsvData(csvFilePaths) {
        if (csvFilePaths.length < 2) {
            throw new Error("Expected at least two CSV file paths for combining.");
        }

        try {
            const answerDataPath = csvFilePaths.find(p => !p.includes('ncd'));
            const nameCardDataPath = csvFilePaths.find(p => p.includes('ncd'));

            if (!answerDataPath || !nameCardDataPath) {
                throw new Error("Could not find both answer and name card CSV files.");
            }

            const [answerData, nameCardData] = await Promise.all([
                this.parseCsv(answerDataPath),
                this.parseCsv(nameCardDataPath)
            ]);

            const nameCardMap = new Map(nameCardData.map(item => [item.ID, item]));

            const combined = answerData.map(answer => {
                const nameCardInfo = nameCardMap.get(answer.ID);
                return { ...answer, ...nameCardInfo };
            });

            return combined;

        } catch (error) {
            console.error("Error loading and combining CSV files:", error);
            throw error;
        }
    }

    transformCsvToCombinedData(csvData, surveyId) {
        return csvData.map(row => {
            const details = [];
            for (const key in row) {
                if (key.startsWith('Q.')) {
                    details.push({ question: key, answer: row[key] || '' });
                }
            }

            const businessCard = {
                imageUrl: {
                    front: row['名刺画像ファイル名（表）'] || '',
                    back: row['名刺画像ファイル名（裏）'] || ''
                },
                group1: {
                    email: row['メールアドレス'] || ''
                },
                group2: {
                    lastName: row['氏名（姓）'] || '',
                    firstName: '' // No first name in the new CSV structure
                },
                group3: {
                    companyName: row['会社名'] || '',
                    department: row['部署名'] || '',
                    position: row['役職名'] || ''
                },
                group4: {
                    postalCode: row['郵便番号'] || '',
                    address1: row['住所1'] || '',
                    address2: row['住所2（建物名）'] || ''
                },
                group5: {
                    mobile: row['携帯番号'] || '',
                    tel1: row['電話番号1'] || '',
                    tel2: row['電話番号2'] || '',
                    fax: row['FAX番号'] || ''
                },
                group6: {
                    url: row['URL'] || ''
                }
            };

            const dummySurvey = {
                id: surveyId,
                name: { ja: "CSVデータからのアンケート", en: "Survey from CSV Data" },
            };

            return {
                answerId: row['ID'],
                surveyId: surveyId,
                answeredAt: row['回答日時'] || '',
                isTest: row['テスト回答'] === 'テスト回答',
                details: details,
                businessCard: businessCard,
                survey: dummySurvey,
            };
        });
    }

    async loadJsonData(surveyFilePath, surveyAnswersFilePath, businessCardsFilePath) {
        try {
            const [surveysResponse, surveyAnswersResponse, businessCardsResponse] = await Promise.all([
                fetch(surveyFilePath),
                fetch(surveyAnswersFilePath),
                fetch(businessCardsFilePath)
            ]);

            this.surveys = await surveysResponse.json();
            this.surveyAnswers = await surveyAnswersResponse.json();
            this.businessCards = await businessCardsResponse.json();
            console.log('DEBUG: JSON data loaded by speedReviewService.');
        } catch (error) {
            console.error("Error loading or parsing JSON files:", error);
            throw error;
        }
    }

    getCombinedReviewData(surveyId) {
        if (!this.surveys || !this.surveyAnswers || !this.businessCards) {
            console.error("JSON data not loaded yet.");
            return [];
        }

        const targetSurvey = this.surveys.find(s => s.id === surveyId);
        if (!targetSurvey) {
            console.warn(`Survey with ID ${surveyId} not found.`);
            return [];
        }

        const businessCardMap = new Map(this.businessCards.map(card => [card.answerId, card]));

        return this.surveyAnswers
            .filter(answer => answer.surveyId === surveyId)
            .map(answer => ({
                ...answer,
                businessCard: businessCardMap.get(answer.answerId) || null,
                survey: targetSurvey
            }));
    }
}

export const speedReviewService = new SpeedReviewService();
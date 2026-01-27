import json
import random
import datetime
import os

# Configuration
TARGET_FILE = os.path.join("docs", "examples", "demo_answers", "sv_0001_25060.json")
TARGET_COUNT = 500
SURVEY_ID = "sv_0001_25060"
START_DATE = datetime.datetime(2025, 11, 1, 9, 0, 0)
END_DATE = datetime.datetime(2025, 11, 30, 18, 0, 0)

# Possible answers per question (based on existing data)
# Note: In a real scenario, this should be derived from the survey definition.
# Here we infer from the existing sample or define reasonable defaults.
POSSIBLE_ANSWERS = {
    "Q1": ["毎日", "週に数回", "月に数回", "めったに使わない", "ほとんど使わない"],
    "Q2": ["はい", "いいえ"],
    "Q3": ["特になし", "機能不足", "使いにくい", "価格が高い", "サポートが悪い"],
    "Q4": ["特になし", "機能の追加", "UIの改善", "価格の引き下げ"],
    "Q5": ["非常に満足", "満足", "普通", "不満", "非常に不満"],
    "Q6": ["はい", "いいえ", "どちらとも言えない"],
    "Q7": ["はい", "いいえ", "どちらとも言えない"],
    "Q8": ["はい", "いいえ", "どちらとも言えない"],
    "Q9": ["はい", "いいえ", "どちらとも言えない"],
    "Q10": ["はい", "いいえ", "どちらとも言えない"],
    "Q11": ["はい", "いいえ", "どちらとも言えない"],
    "Q12": ["はい", "いいえ", "どちらとも言えない"],
    "Q13": ["はい", "いいえ", "どちらとも言えない"],
    "Q14": ["はい", "いいえ", "どちらとも言えない"],
    "Q15": ["はい", "いいえ", "どちらとも言えない"],
    "Q16": ["はい", "いいえ", "どちらとも言えない"],
    "Q17": ["はい", "いいえ", "どちらとも言えない"],
    "Q18": ["はい", "いいえ", "どちらとも言えない"],
    "Q19": ["はい", "いいえ", "どちらとも言えない"],
}

QUESTIONS = [
    "Q1. 製品の利用頻度を教えてください。",
    "Q2. 製品の利用頻度は適切だと思いますか？",
    "Q3. 製品の利用頻度に関する課題はありますか？",
    "Q4. 製品の利用頻度に関する改善点があれば教えてください。",
    "Q5. 製品の利用頻度に関する全体的な満足度を教えてください。",
    "Q6. 製品の利用頻度に関するアイデアは豊富ですか？",
    "Q7. 製品の利用頻度に関する実現可能性は高いですか？",
    "Q8. 製品の利用頻度に関する独自性は高いですか？",
    "Q9. 製品の利用頻度に関するターゲット層は明確ですか？",
    "Q10. 製品の利用頻度に関する予算は適切ですか？",
    "Q11. 製品の利用頻度に関するスケジュールは適切ですか？",
    "Q12. 製品の利用頻度に関するプロモーション戦略は適切ですか？",
    "Q13. 製品の利用頻度に関する成功指標は明確ですか？",
    "Q14. 製品の利用頻度に関するリスク管理は適切ですか？",
    "Q15. 製品の利用頻度に関する継続性は高いですか？",
    "Q16. 製品の利用頻度に関する活用度は高いですか？",
    "Q17. 製品の利用頻度に関する専門性は高いですか？",
    "Q18. 製品の利用頻度に関する多様性は高いですか？",
    "Q19. 製品の利用頻度に関する柔軟性は高いですか？",
]


# Dummy data for Business Card
LAST_NAMES = ["佐藤", "鈴木", "高橋", "田中", "伊藤", "渡辺", "山本", "中村", "小林", "加藤", "吉田", "山田", "佐々木", "山口", "松本"]
FIRST_NAMES = ["太郎", "一郎", "二郎", "花子", "優子", "健太", "美咲", "大輔", "陽子", "拓也", "直人", "由美", "翔太", "七海", "雄大"]
COMPANY_NAMES = ["株式会社テック", "山田商事", "日本ソリューションズ", "グローバル貿易", "未来工業", "イノベーションラボ", "サミットホールディングス", "青空建設", "デジタルアーツ", "サイバーシステムズ"]
DEPARTMENTS = ["営業部", "開発部", "総務部", "人事部", "マーケティング部", "広報部", "経営企画室"]
POSITIONS = ["部長", "課長", "係長", "主任", "一般", "マネージャー", "リーダー"]

def random_date(start_date_obj, end_date_obj):
    """Generate a random datetime between start and end, restrict time to 00:00 - 08:00 UTC (09:00 - 17:00 JST)."""
    # Start and end date range (inclusive of days)
    days_diff = (end_date_obj - start_date_obj).days
    
    # Pick a random day offset
    random_day_offset = random.randint(0, days_diff)
    current_day = start_date_obj + datetime.timedelta(days=random_day_offset)
    
    # Generate random time between 00:00 and 08:00 UTC
    start_hour = 0
    end_hour = 8
    
    # Random seconds from 0:00 to 8:00 (8 hours * 3600 seconds)
    random_seconds = random.randint(0, 8 * 3600)
    
    final_datetime = current_day.replace(hour=start_hour, minute=0, second=0) + datetime.timedelta(seconds=random_seconds)
    
    if final_datetime > end_date_obj:
         final_datetime = end_date_obj - datetime.timedelta(hours=1) 
         
    return final_datetime


def generate_answers():
    try:
        # Load existing data to check structure if needed (optional)
        if os.path.exists(TARGET_FILE):
             with open(TARGET_FILE, 'r', encoding='utf-8') as f:
                current_data = json.load(f)
                print(f"Loaded {len(current_data)} existing records.")
        else:
            current_data = []

        new_data = []
        for i in range(1, TARGET_COUNT + 1):
             # Format sequence: ANS_sv_0001_25060_001
            answer_id = f"ANS_{SURVEY_ID}_{i:03d}"
            
            # Generate random answer details
            details = []
            for j, question_text in enumerate(QUESTIONS):
                # Extract Q number key (e.g., "Q1", "Q10")
                q_key = question_text.split(".")[0] 
                
                # Pick a random answer
                options = POSSIBLE_ANSWERS.get(q_key, ["はい", "いいえ"])
                picked_answer = random.choice(options)
                
                details.append({
                    "question": question_text,
                    "answer": picked_answer
                })
            
            # Generate Business Card Data
            last_name = random.choice(LAST_NAMES)
            first_name = random.choice(FIRST_NAMES)
            
            business_card = {
                "group1": {
                    "email": f"{random.choice(['user', 'contact', 'info'])}{i}@example.com"
                },
                "group2": {
                    "lastName": last_name,
                    "firstName": first_name
                },
                "group3": {
                    "companyName": random.choice(COMPANY_NAMES),
                    "department": random.choice(DEPARTMENTS),
                    "position": random.choice(POSITIONS)
                },
                "group5": {
                    "mobile": f"090-{random.randint(1000,9999)}-{random.randint(1000,9999)}",
                    "tel1": f"03-{random.randint(1000,9999)}-{random.randint(1000,9999)}"
                }
            }

            record = {
                "answerId": answer_id,
                "surveyId": SURVEY_ID,
                "answeredAt": random_date(START_DATE, END_DATE).strftime("%Y-%m-%dT%H:%M:%SZ"),
                "isTest": False,
                "details": details,
                "businessCard": business_card
            }
            new_data.append(record)

        # Sort by answeredAt
        new_data.sort(key=lambda x: x['answeredAt'])

        # Write to file
        with open(TARGET_FILE, 'w', encoding='utf-8') as f:
            json.dump(new_data, f, indent=2, ensure_ascii=False)
        
        print(f"Successfully generated {len(new_data)} records to {TARGET_FILE}")

    except Exception as e:
        print(f"Error generating data: {e}")

if __name__ == "__main__":
    generate_answers()

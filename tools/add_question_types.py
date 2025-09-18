import json

# AnswerファイルとEnqueteファイルのパスを生成する関数
def get_file_paths(survey_id):
    answer_path = f"C:\\Users\\user\\Desktop\\workspace20\\SPPED-AD-TEST\\sample\\sample-3\\Answer\\{survey_id}.json"
    enquete_path = f"C:\\Users\\user\\Desktop\\workspace20\\SPPED-AD-TEST\\sample\\sample-3\\Enquete\\{survey_id}.json"
    return answer_path, enquete_path

# 設問タイプを追記する処理
def add_question_types(answer_data, enquete_data):
    enquete_details_map = {detail['text']: detail for detail in enquete_data['details']}
    
    for answer_entry in answer_data:
        if 'details' in answer_entry:
            for detail in answer_entry['details']:
                question_text = detail['question']
                if question_text in enquete_details_map:
                    detail['type'] = enquete_details_map[question_text]['type']
                else:
                    # Enqueteファイルに該当する設問がない場合、answerの形式から判断
                    if isinstance(detail['answer'], list):
                        detail['type'] = 'multi_answer'
                    else:
                        detail['type'] = 'single_answer'
    return answer_data

# 全てのSURVEYファイルに対して処理を実行
for i in range(1, 31):
    survey_id = f"SURVEY_{i:03d}"
    answer_path, enquete_path = get_file_paths(survey_id)

    try:
        # Answerファイルを読み込み
        with open(answer_path, 'r', encoding='utf-8') as f:
            answer_data = json.load(f)

        # Enqueteファイルを読み込み
        with open(enquete_path, 'r', encoding='utf-8') as f:
            enquete_data = json.load(f)

        # 設問タイプを追記
        updated_answer_data = add_question_types(answer_data, enquete_data)

        # 修正したAnswerファイルを保存
        with open(answer_path, 'w', encoding='utf-8') as f:
            json.dump(updated_answer_data, f, ensure_ascii=False, indent=2)
        
        print(f"Successfully processed {survey_id}.json")

    except FileNotFoundError:
        print(f"File not found for {survey_id}.json. Skipping.")
    except Exception as e:
        print(f"Error processing {survey_id}.json: {e}")

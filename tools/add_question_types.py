import json
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[1]
ANSWERS_DIR = BASE_DIR / 'data/demo_answers'
SURVEYS_DIR = BASE_DIR / 'data/demo_surveys'
ENQUETE_DIR = BASE_DIR / 'data/surveys/enquete'


def get_file_paths(survey_id: str):
    """Return matching answer and enquete paths for the given survey id."""
    return ANSWERS_DIR / f"{survey_id}.json", ENQUETE_DIR / f"{survey_id}.json"


def add_question_types(answer_data, enquete_data):
    """Populate answer entries with question type metadata from enquete file."""
    enquete_details_map = {detail['text']: detail for detail in enquete_data['details']}

    for answer_entry in answer_data:
        for detail in answer_entry.get('details', []):
            question_text = detail['question']
            if question_text in enquete_details_map:
                detail['type'] = enquete_details_map[question_text]['type']
            else:
                detail['type'] = 'multi_answer' if isinstance(detail.get('answer'), list) else 'single_answer'
    return answer_data


for survey_file in sorted(SURVEYS_DIR.glob('sv_*.json')):
    survey_id = survey_file.stem
    answer_path, enquete_path = get_file_paths(survey_id)

    if not answer_path.exists() or not enquete_path.exists():
        print(f"Skipping {survey_id}: missing files")
        continue

    try:
        answer_data = json.loads(answer_path.read_text(encoding='utf-8'))
        enquete_data = json.loads(enquete_path.read_text(encoding='utf-8'))
        updated_answer_data = add_question_types(answer_data, enquete_data)
        answer_path.write_text(json.dumps(updated_answer_data, ensure_ascii=False, indent=2), encoding='utf-8')
        print(f"Successfully processed {survey_id}.json")
    except Exception as exc:
        print(f"Error processing {survey_id}.json: {exc}")

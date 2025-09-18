
import csv
import json
import sys

def csv_to_json(csv_string):
    lines = csv_string.strip().splitlines()
    reader = csv.DictReader(lines)
    data = []
    for row in reader:
        data.append(row)
    return json.dumps(data, ensure_ascii=False, indent=4)

if __name__ == "__main__":
    csv_content = sys.stdin.read()
    json_output = csv_to_json(csv_content)
    print(json_output)

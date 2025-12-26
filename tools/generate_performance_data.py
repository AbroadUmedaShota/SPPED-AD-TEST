import json
import random
import os

# Base data structure
base_data = {
  "summary": {
    "totalPayment": 1250000,
    "lastMonthComparison": 5.2,
    "activeUsers": 42,
    "totalUsers": 50,
    "totalProcessed": 15600,
    "errorRate": 1.2,
    "avgTime": 245,
    "maxCapacity": 18000,
    "costPerformance": 0.85,
    "onTimeRate": 98.5
  },
  "parameters": {
    "targetProcessed": 400,
    "targetErrorRate": 1.5,
    "targetAvgTime": 250,
    "unitPrice": 100,
    "correctionCost": 50
  }
}

# Template operators
templates = [
    {
      "name_base": "山田", "name_first": "向日葵", "group": "展示会Aチーム", "base_processed": 420, "base_error_rate": 0.012
    },
    {
      "name_base": "鈴木", "name_first": "蒼", "group": "展示会Aチーム", "base_processed": 315, "base_error_rate": 0.038
    },
    {
      "name_base": "佐藤", "name_first": "健太", "group": "セミナーBチーム", "base_processed": 510, "base_error_rate": 0.006
    }
]

last_names = ["田中", "伊藤", "渡辺", "山本", "中村", "小林", "加藤", "吉田", "山田", "佐々木", "山口", "松本", "井上", "木村", "林", "斎藤", "清水", "山崎", "森", "阿部", "池田", "橋本", "山下", "石川", "中島", "前田", "藤田", "小川", "後藤", "岡田", "長谷川", "村上", "近藤", "石井"]
first_names = ["太郎", "次郎", "花子", "一郎", "恵", "真一", "愛", "大輔", "美咲", "翔太", "陽菜", "健", "直人", "彩", "拓哉", "未来", "亮", "優子", "直樹", "遥", "健一", "七海", "剛", "美月", "達也", "香織", "哲也", "美穂", "秀樹", "智子"]

groups = ["展示会Aチーム", "セミナーBチーム", "その他案件Cチーム"]

operators = []

for i in range(1, 43): # Generate 42 operators
    template = templates[i % 3]
    
    # Generate random name if not one of the first 3
    if i <= 3:
        name = f"{template['name_base']} {template['name_first']}"
        group = template['group']
    else:
        name = f"{random.choice(last_names)} {random.choice(first_names)}"
        group = random.choice(groups)

    # Randomize stats
    processed = int(template['base_processed'] * random.uniform(0.8, 1.2))
    error_rate = template['base_error_rate'] * random.uniform(0.5, 1.5)
    errors = int(processed * error_rate)
    valid = processed - errors
    avg_time = int(250 * random.uniform(0.8, 1.2))
    
    # Calculate work time
    total_seconds = avg_time * processed
    hours = total_seconds // 3600
    minutes = (total_seconds % 3600) // 60
    seconds = total_seconds % 60
    work_time = f"{hours:02d}:{minutes:02d}:{seconds:02d}"
    
    est_payment = valid * 100 # Assuming unit price 100
    
    status = "達成"
    if processed < 350 or error_rate > 0.02: # Arbitrary threshold
        status = "未達"

    on_time_rate = round(random.uniform(90, 100), 1)

    op = {
      "id": f"OP{i:03d}",
      "name": name,
      "group": group,
      "processed": processed,
      "errors": errors,
      "valid": valid,
      "workTime": work_time,
      "avgTime": avg_time,
      "estPayment": est_payment,
      "status": status,
      "onTimeRate": on_time_rate,
      "errorTypes": {
        "name": round(random.uniform(0, 2), 1),
        "company": round(random.uniform(0, 2), 1),
        "address": round(random.uniform(0, 2), 1),
        "phone": round(random.uniform(0, 2), 1),
        "email": round(random.uniform(0, 2), 1)
      },
      "history": [
        {"date": f"2025-09-0{d}", "processed": int(processed/10 * random.uniform(0.8, 1.2)), "errorRate": round(error_rate * 100 * random.uniform(0.8, 1.2), 1)} for d in range(1, 6)
      ]
    }
    operators.append(op)

base_data["operators"] = operators

# Generate groups summary based on operators
generated_groups = []
for group_name in groups:
    group_ops = [op for op in operators if op["group"] == group_name]
    if not group_ops:
        continue
        
    total_active = len(group_ops)
    total_users = int(total_active * 1.2)
    avg_times = [op["avgTime"] for op in group_ops]
    group_avg_time = int(sum(avg_times) / len(avg_times)) if avg_times else 0
    
    # Calculate variance (simplified)
    variance = round(random.uniform(0.5, 2.0), 1)
    
    generated_groups.append({
      "id": f"GR{groups.index(group_name) + 1:03d}",
      "name": group_name,
      "activeUsers": total_active,
      "totalUsers": total_users,
      "maxCapacity": int(total_active * (450)), # Arbitrary
      "avgTime": group_avg_time,
      "qualityVariance": variance,
      "costPerformance": round(random.uniform(0.8, 1.1), 2),
      "onTimeRate": round(random.uniform(95, 100), 1),
      "operators": [{"name": op["name"], "avgTime": op["avgTime"], "accuracy": round(100 - (op["errors"]/op["processed"]*100), 1)} for op in group_ops]
    })

base_data["groups"] = generated_groups

# Write to file
file_path = os.path.join("data", "admin", "performance.json")
with open(file_path, "w", encoding="utf-8") as f:
    json.dump(base_data, f, ensure_ascii=False, indent=2)

print(f"Generated {len(operators)} operators in {file_path}")

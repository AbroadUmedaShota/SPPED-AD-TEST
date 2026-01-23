import json
import random
import datetime
import os

# Paths
DATA_PATH = os.path.join("data", "admin", "performance.json")

def generate_daily_data(start_date, end_date):
    current_date = start_date
    daily_data = []
    while current_date <= end_date:
        # Generate somewhat realistic data
        processed = random.randint(20, 70)
        
        # Simulate occasional days off (0 processed)
        if random.random() < 0.1:
            processed = 0
            error_rate = 0.0
        else:
            # Error rate usually low, sometimes high
            if random.random() < 0.8:
                error_rate = round(random.uniform(0.0, 1.5), 1)
            else:
                error_rate = round(random.uniform(1.5, 5.0), 1)

        daily_data.append({
            "date": current_date.strftime("%Y-%m-%d"),
            "processed": processed,
            "errorRate": error_rate
        })
        current_date += datetime.timedelta(days=1)
    return daily_data

def main():
    if not os.path.exists(DATA_PATH):
        print(f"Error: {DATA_PATH} not found.")
        return

    try:
        with open(DATA_PATH, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except Exception as e:
        print(f"Error loading JSON: {e}")
        return

    # Target period: Jan 2026
    start_date = datetime.date(2026, 1, 1)
    end_date = datetime.date(2026, 1, 31)

    print(f"Generating data for period: {start_date} to {end_date}")

    operators = data.get("operators", [])
    
    for op in operators:
        # Generate new history
        new_history = generate_daily_data(start_date, end_date)
        
        # Initialize history if it doesn't exist
        if "history" not in op:
            op["history"] = []
            
        # Append new history
        op["history"].extend(new_history)
        
        # Note: We are NOT updating the top-level 'processed', 'errors' etc. 
        # because the frontend JS logic recalculates these based on the filtered date range.
        # This is sufficient for the user's "display verification" purpose.

    # Update summary (Just roughly scaling up for the new month simulation)
    # In a real scenario, this should be calculated, but for now we leave it 
    # or maybe just update active users to match current total
    # data["summary"]["activeUsers"] = len(operators) # Let's keep it as is for safety

    try:
        with open(DATA_PATH, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        print(f"Successfully updated {DATA_PATH} with 2026/01 data.")
    except Exception as e:
        print(f"Error writing JSON: {e}")

if __name__ == "__main__":
    main()

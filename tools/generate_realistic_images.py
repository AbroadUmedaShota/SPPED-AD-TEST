
import os
import random
from PIL import Image, ImageDraw, ImageFont

def get_font(size):
    # Common Windows Japanese fonts
    font_paths = [
        "C:\\Windows\\Fonts\\msgothic.ttc",
        "C:\\Windows\\Fonts\\meiryo.ttc",
        "C:\\Windows\\Fonts\\msmincho.ttc"
    ]
    for path in font_paths:
        if os.path.exists(path):
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()

def create_bizcard(path, filename, is_front=True):
    width, height = 1024, 1024
    image = Image.new('RGB', (width, height), color=(255, 255, 255))
    draw = ImageDraw.Draw(image)
    
    font_large = get_font(60)
    font_medium = get_font(40)
    font_small = get_font(30)
    
    if is_front:
        # Draw a simple border
        draw.rectangle([50, 200, 974, 824], outline=(0, 0, 0), width=5)
        
        companies = ["株式会社 スピード調査", "SPEED AD Co., Ltd.", "火災安全コンサルティング", "都市防災ソリューション"]
        names = ["山田 太郎", "佐藤 次郎", "鈴木 一郎", "田中 花子", "伊藤 博"]
        titles = ["代表取締役", "調査技師", "チーフマネージャー", "主任調査員"]
        
        company = random.choice(companies)
        name = random.choice(names)
        title = random.choice(titles)
        
        draw.text((100, 300), company, font=font_large, fill=(0, 0, 0))
        draw.text((100, 450), title, font=font_small, fill=(0, 0, 0))
        draw.text((100, 500), name, font=font_large, fill=(0, 0, 0))
        draw.text((100, 650), "Tel: 03-1234-5678", font=font_medium, fill=(0, 0, 0))
        draw.text((100, 700), "Email: info@example.com", font=font_medium, fill=(0, 0, 0))
        
        # Add a "logo" (just a shape)
        draw.polygon([(800, 250), (950, 250), (875, 400)], fill=(random.randint(0,255), random.randint(0,255), random.randint(0,255)))
    else:
        # Back side
        draw.rectangle([50, 200, 974, 824], outline=(200, 200, 200), width=2)
        draw.text((400, 250), "MEMO / NOTES", font=font_medium, fill=(100, 100, 100))
        for i in range(10):
            y = 350 + i * 50
            draw.line([100, y, 900, y], fill=(200, 200, 200), width=1)

    image.save(os.path.join(path, filename))

def create_handwriting(path, filename):
    width, height = 1024, 1024
    image = Image.new('RGB', (width, height), color=(255, 255, 240))
    draw = ImageDraw.Draw(image)
    
    font = get_font(50)
    
    # Draw jittery lines to simulate handwriting area
    for _ in range(random.randint(5, 15)):
        start_x = random.randint(50, 200)
        start_y = random.randint(100, 900)
        end_x = start_x + random.randint(200, 600)
        points = [(start_x, start_y)]
        curr_x, curr_y = start_x, start_y
        segments = 20
        for i in range(segments):
            curr_x += (end_x - start_x) / segments
            curr_y += random.randint(-5, 5)
            points.append((curr_x, curr_y))
        draw.line(points, fill=(random.randint(0, 50), random.randint(0, 50), random.randint(100, 255)), width=4)

    texts = ["現場確認済み", "出火原因調査中", "異常なし", "2026/02/07 調査員", "Point A: 焦げ跡あり", "コンセント付近を確認"]
    draw.text((100, 50), random.choice(texts), font=font, fill=(0, 0, 128))
    
    image.save(os.path.join(path, filename))

def create_attachment(path, filename):
    width, height = 1024, 1024
    image = Image.new('RGB', (width, height), color=(240, 240, 240))
    draw = ImageDraw.Draw(image)
    
    font = get_font(40)
    
    # Draw a photo placeholder
    draw.rectangle([50, 50, 974, 974], fill=(255, 255, 255), outline=(0,0,0), width=3)
    
    # Floor plan lines
    for _ in range(15):
        x1 = random.randint(100, 900)
        y1 = random.randint(100, 900)
        x2 = random.randint(100, 900)
        y2 = random.randint(100, 900)
        if random.random() > 0.5: x2 = x1
        else: y2 = y1
        draw.line([x1, y1, x2, y2], fill=(random.randint(50, 150), random.randint(50, 150), random.randint(50, 150)), width=3)
        
    draw.text((70, 70), "Evidence / Inspection Photo", font=font, fill=(50, 50, 50))
    draw.text((70, 120), f"ID: {filename.split('_')[1].split('.')[0]}", font=font, fill=(100, 100, 100))
    
    image.save(os.path.join(path, filename))

import os
import random
import shutil
from PIL import Image, ImageDraw, ImageFont

def get_font(size):
    # Common Windows Japanese fonts
    font_paths = [
        "C:\\Windows\\Fonts\\msgothic.ttc",
        "C:\\Windows\\Fonts\\meiryo.ttc",
        "C:\\Windows\\Fonts\\msmincho.ttc"
    ]
    for path in font_paths:
        if os.path.exists(path):
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()

def create_bizcard(path, filename, is_front=True):
    width, height = 1024, 1024
    image = Image.new('RGB', (width, height), color=(255, 255, 255))
    draw = ImageDraw.Draw(image)
    
    font_large = get_font(60)
    font_medium = get_font(40)
    font_small = get_font(30)
    
    if is_front:
        draw.rectangle([50, 200, 974, 824], outline=(0, 0, 0), width=5)
        companies = ["株式会社 スピード調査", "SPEED AD Co., Ltd.", "火災安全コンサルティング", "都市防災ソリューション"]
        names = ["山田 太郎", "佐藤 次郎", "鈴木 一郎", "田中 花子", "伊藤 博"]
        titles = ["代表取締役", "調査技師", "チーフマネージャー", "主任調査員"]
        company = random.choice(companies)
        name = random.choice(names)
        title = random.choice(titles)
        draw.text((100, 300), company, font=font_large, fill=(0, 0, 0))
        draw.text((100, 450), title, font=font_small, fill=(0, 0, 0))
        draw.text((100, 500), name, font=font_large, fill=(0, 0, 0))
        draw.text((100, 650), "Tel: 03-1234-5678", font=font_medium, fill=(0, 0, 0))
        draw.text((100, 700), "Email: info@example.com", font=font_medium, fill=(0, 0, 0))
        draw.polygon([(800, 250), (950, 250), (875, 400)], fill=(random.randint(0,255), random.randint(0,255), random.randint(0,255)))
    else:
        draw.rectangle([50, 200, 974, 824], outline=(200, 200, 200), width=2)
        draw.text((400, 250), "MEMO / NOTES", font=font_medium, fill=(100, 100, 100))
        for i in range(10):
            y = 350 + i * 50
            draw.line([100, y, 900, y], fill=(200, 200, 200), width=1)
    image.save(os.path.join(path, filename))

def create_handwriting(path, filename):
    width, height = 1024, 1024
    image = Image.new('RGB', (width, height), color=(255, 255, 240))
    draw = ImageDraw.Draw(image)
    font = get_font(50)
    for _ in range(random.randint(5, 15)):
        start_x = random.randint(50, 200)
        start_y = random.randint(100, 900)
        end_x = start_x + random.randint(200, 600)
        points = [(start_x, start_y)]
        curr_x, curr_y = start_x, start_y
        segments = 20
        for i in range(segments):
            curr_x += (end_x - start_x) / segments
            curr_y += random.randint(-5, 5)
            points.append((curr_x, curr_y))
        draw.line(points, fill=(random.randint(0, 50), random.randint(0, 50), random.randint(100, 255)), width=4)
    texts = ["現場確認済み", "出火原因調査中", "異常なし", "2026/02/07 調査員", "Point A: 焦げ跡あり", "コンセント付近を確認"]
    draw.text((100, 50), random.choice(texts), font=font, fill=(0, 0, 128))
    image.save(os.path.join(path, filename))

def create_attachment(path, filename):
    width, height = 1024, 1024
    image = Image.new('RGB', (width, height), color=(240, 240, 240))
    draw = ImageDraw.Draw(image)
    font = get_font(40)
    draw.rectangle([50, 50, 974, 974], fill=(255, 255, 255), outline=(0,0,0), width=3)
    for _ in range(15):
        x1 = random.randint(100, 900)
        y1 = random.randint(100, 900)
        x2 = random.randint(100, 900)
        y2 = random.randint(100, 900)
        if random.random() > 0.5: x2 = x1
        else: y2 = y1
        draw.line([x1, y1, x2, y2], fill=(random.randint(50, 150), random.randint(50, 150), random.randint(50, 150)), width=3)
    draw.text((70, 70), "Evidence / Inspection Photo", font=font, fill=(50, 50, 50))
    draw.text((70, 120), f"Ref: {filename}", font=font, fill=(100, 100, 100))
    image.save(os.path.join(path, filename))

survey_id = "sv_0001_26009"
base_dir = r'C:\SharedFolder\WorkSpace\00.NewTopics\01_SPEED_AD_Project\00_dev_speed_ad_user\media\generated'
target_dir = os.path.join(base_dir, survey_id)
bizcard_dir = os.path.join(target_dir, 'bizcard')
handwriting_dir = os.path.join(target_dir, 'handwriting')
attachment_dir = os.path.join(target_dir, 'attachment')

print("Cleaning up old images...")
for d in [bizcard_dir, handwriting_dir, attachment_dir]:
    if os.path.exists(d):
        shutil.rmtree(d)
    os.makedirs(d, exist_ok=True)

print(f"Generating images for {survey_id}...")
for i in range(1, 901):
    suffix = f"{i:04d}"
    
    # Bizcard
    create_bizcard(bizcard_dir, f"{survey_id}_{suffix}_1.jpg", is_front=True)
    create_bizcard(bizcard_dir, f"{survey_id}_{suffix}_2.jpg", is_front=False)
    
    # Handwriting
    create_handwriting(handwriting_dir, f"{survey_id}_{suffix}_handwriting.png")
    
    # Attachment
    create_attachment(attachment_dir, f"{survey_id}_{suffix}_attachment.jpg")
    
    if i % 100 == 0:
        print(f"Generated {i} sets...")

print("Done!")

import os
file_to_delete = r'C:\\SharedFolder\\WorkSpace\\00.NewTopics\\01_SPEED_AD_Project\\00_dev_speed_ad_user\\02_dashboard\\delete_bat_script.py'
if os.path.exists(file_to_delete):
    os.remove(file_to_delete)
else:
    print(f"File not found: {file_to_delete}")

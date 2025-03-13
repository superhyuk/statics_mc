import boto3
import json
import os
import re

ACCESS_KEY = os.getenv('AWS_ACCESS_KEY_ID')
SECRET_KEY = os.getenv('AWS_SECRET_ACCESS_KEY')
BUCKET_NAME = os.getenv('BUCKET_NAME')
REGION_NAME = os.getenv('AWS_REGION', 'ap-northeast-2')

# 환경변수로 MACHINE_IDS 로드 (JSON 문자열로 secrets에 저장)
MACHINE_IDS = json.loads(os.getenv('MACHINE_IDS', '[]'))

s3 = boto3.client('s3',
                  aws_access_key_id=ACCESS_KEY,
                  aws_secret_access_key=SECRET_KEY,
                  region_name=REGION_NAME)

def load_last_processed():
    try:
        with open('last_processed.json', 'r') as f:
            data = json.load(f)
            return data.get("last_processed_time", "20240101_000000")
    except:
        return "20240101_000000"

def save_last_processed(time_str):
    with open("last_processed.json", "w") as f:
        json.dump({"last_processed_time": time_str}, f)

def update_counts():
    last_processed = load_last_processed()
    counts = {}
    max_processed = last_processed

    MACHINE_IDS = json.loads(os.getenv('MACHINE_IDS', '[]'))

    for machine_id in MACHINE_IDS:
        for prefix in ['result_MIC/anomaly/', 'result_MIC/processed/', 'result_ACC/anomaly/', 'result_ACC/processed/']:
            response = s3.list_objects_v2(Bucket=BUCKET_NAME, Prefix=f"{machine_id}/{prefix}")
            for obj in response.get('Contents', []):
                filename = obj['Key']
                match = re.search(r"(\d{8}_\d{6})", filename)
                if match:
                    file_time = match.group(1)
                    if file_time > max_processed:
                        hour = file_time[:11]  # YYYYMMDD_HH
                        counts[hour] = counts.get(hour, 0) + 1
                        max_processed = max(max_processed, file_time)

    # 결과 저장
    with open("data_counts.json", "w") as f:
        json.dump(counts, f)

    save_last_processed(max_processed)

def save_last_processed(time_str):
    with open("last_processed.json", "w") as f:
        json.dump({"last_processed_time": time_str}, f)

if __name__ == "__main__":
    update_counts()

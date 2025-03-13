import boto3
import json
import os
import re
from datetime import datetime, timedelta
from collections import defaultdict

ACCESS_KEY = os.getenv('AWS_ACCESS_KEY_ID')
SECRET_KEY = os.getenv('AWS_SECRET_ACCESS_KEY')
BUCKET_NAME = os.getenv('BUCKET_NAME')
REGION_NAME = os.getenv('REGION_NAME')
MACHINE_IDS = json.loads(os.getenv('MACHINE_IDS'))

s3 = boto3.client('s3', aws_access_key_id=ACCESS_KEY, aws_secret_access_key=SECRET_KEY, region_name=REGION_NAME)

def load_json(filename, default):
    try:
        with open(filename, "r") as f:
            return json.load(f)
    except:
        return default

def save_json(filename, data):
    with open(filename, "w") as f:
        json.dump(data, f, indent=2)

def load_last_processed():
    data = load_json('last_processed.json', {})
    return data.get("last_processed_time", "20240101_000000")

def save_last_processed(time_str):
    save_json("last_processed.json", {"last_processed_time": time_str})

def get_first_date():
    earliest = None
    for machine_id in MACHINE_IDS:
        response = s3.list_objects_v2(Bucket=BUCKET_NAME, Prefix=f"{machine_id}/")
        for obj in response.get('Contents', []):
            match = re.search(r"(\d{8}_\d{6})", obj['Key'])
            if match:
                date = datetime.strptime(match.group(1), "%Y%m%d_%H%M%S")
                earliest = date if earliest is None else min(earliest, date)
    return earliest or datetime.now()

def update_counts():
    last_processed = load_last_processed()
    data_counts = load_json("data_counts.json", {})
    max_processed = last_processed
    first_date = data_counts.get("first_date") or get_first_date().strftime("%Y%m%d_%H%M%S")

    hourlyData = data_counts.get("hourlyData", {})
    dailyData = data_counts.get("dailyData", {})
    weeklyData = data_counts.get("weeklyData", {})
    monthlyData = data_counts.get("monthlyData", {})

    patterns = {
        'result_MIC/anomaly/': 'MIC_anomaly',
        'result_MIC/processed/': 'MIC_processed',
        'result_ACC/anomaly/': 'ACC_anomaly',
        'result_ACC/processed/': 'ACC_processed'
    }

    for machine_id in MACHINE_IDS:
        for prefix, status_key in patterns.items():
            token = None
            while True:
                params = {'Bucket': BUCKET_NAME, 'Prefix': f"{machine_id}/{prefix}"}
                if token:
                    params['ContinuationToken'] = token
                res = s3.list_objects_v2(**params)

                for obj in res.get('Contents', []):
                    match = re.search(r"(\d{8}_\d{6})", obj['Key'])
                    if match:
                        file_time = match.group(1)
                        if file_time > last_processed:
                            dt = datetime.strptime(file_time, "%Y%m%d_%H%M%S")

                            # hourlyData
                            hour_key = dt.strftime("%Y%m%d_%H")
                            hourlyData.setdefault(hour_key, {}).setdefault(machine_id, {"MIC_anomaly":0,"MIC_processed":0,"ACC_anomaly":0,"ACC_processed":0})
                            hourlyData[hour_key][machine_id][status_key] += 1

                            # dailyData
                            day_key = dt.strftime("%Y-%m-%d")
                            dailyData.setdefault(day_key, {}).setdefault(machine_id, {"MIC_anomaly":0,"MIC_processed":0,"ACC_anomaly":0,"ACC_processed":0})
                            dailyData[day_key][machine_id][status_key] += 1

                            # weeklyData
                            first_dt = datetime.strptime(first_date, "%Y%m%d_%H%M%S")
                            week_num = (dt - first_dt).days // 7 + 1
                            week_key = f"Week_{week_num}"
                            weeklyData.setdefault(week_key, {}).setdefault(machine_id, {"MIC_anomaly":0,"MIC_processed":0,"ACC_anomaly":0,"ACC_processed":0})
                            weeklyData[week_key][machine_id][status_key] += 1

                            # monthlyData
                            month_key = dt.strftime("%Y-%m")
                            monthlyData.setdefault(month_key, {}).setdefault(machine_id, {"MIC_anomaly":0,"MIC_processed":0,"ACC_anomaly":0,"ACC_processed":0})
                            monthlyData[month_key][machine_id][status_key] += 1

                            if file_time > max_processed:
                                max_processed = file_time

                if res.get('IsTruncated'):
                    token = res.get('NextContinuationToken')
                else:
                    break

    result = {
        "first_date": first_date,
        "hourlyData": hourlyData,
        "dailyData": dailyData,
        "weeklyData": weeklyData,
        "monthlyData": monthlyData,
        "updated_at": datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    }

    save_json("data_counts.json", result)
    save_last_processed(max_processed)

if __name__ == "__main__":
    update_counts()

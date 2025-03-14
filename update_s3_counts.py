import boto3
import json
import os
import re
from datetime import datetime

ACCESS_KEY = os.getenv('AWS_ACCESS_KEY_ID')
SECRET_KEY = os.getenv('AWS_SECRET_ACCESS_KEY')
BUCKET_NAME = os.getenv('BUCKET_NAME')
REGION_NAME = os.getenv('REGION_NAME')
MACHINE_IDS = json.loads(os.getenv('MACHINE_IDS', '[]'))

# 머신 ID와 표시 이름 매핑
MACHINE_NAMES = {
    'MACHINE2': 'CURING_OVEN(#UNIT1)',
    'MACHINE3': 'HOT CHAMBER(#UNIT2)'
}

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
            match = re.search(r"(\d{8}_\d{2}_\d{2}_\d{2})_(.*?)_(MIC|ACC)", obj['Key'])
            if match:
                date = datetime.strptime(match.group(1), "%Y%m%d_%H_%M_%S")
                earliest = date if earliest is None else min(earliest, date)
    return earliest or datetime.now()

def update_counts():
    last_processed = load_last_processed()
    data_counts = load_json("data_counts.json", {})
    max_processed = last_processed
    first_date = data_counts.get("first_date") or get_first_date().strftime("%Y%m%d_%H%M%S")

    # 데이터 구조 초기화
    hourlyData = data_counts.get("hourlyData", {})
    dailyData = data_counts.get("dailyData", {})
    weeklyData = data_counts.get("weeklyData", {})
    monthlyData = data_counts.get("monthlyData", {})
    
    # 머신 정보 추가
    machine_info = data_counts.get("machine_info", {})
    for machine_id in MACHINE_IDS:
        if machine_id not in machine_info:
            machine_info[machine_id] = {
                "display_name": MACHINE_NAMES.get(machine_id, machine_id)
            }

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
                    # 파일명에서 날짜, 시간, 센서 타입 추출
                    match = re.search(r"(\d{8}_\d{2}_\d{2}_\d{2})_(.*?)_(MIC|ACC)", obj['Key'])
                    if match:
                        file_time_str = match.group(1)
                        file_suffix = match.group(2)  # MP23ABS1 또는 LSM6DSOX 같은 접미사
                        data_type = match.group(3)    # MIC 또는 ACC
                        
                        # 여기서 중요: file_machine_id는 S3 버킷의 최상위 폴더명(MACHINE2 등)
                        file_machine_id = machine_id

                        # 시간 파싱
                        file_time = datetime.strptime(file_time_str, "%Y%m%d_%H_%M_%S")

                        if file_time_str > last_processed:
                            # 시간별 데이터
                            hour_key = file_time.strftime("%Y%m%d_%H")
                            hourlyData.setdefault(hour_key, {}).setdefault(file_machine_id, {
                                "MIC_anomaly": 0, 
                                "MIC_processed": 0, 
                                "ACC_anomaly": 0, 
                                "ACC_processed": 0, 
                                "display_name": MACHINE_NAMES.get(file_machine_id, file_machine_id)
                            })
                            hourlyData[hour_key][file_machine_id][status_key] += 1

                            # 일별 데이터
                            day_key = file_time.strftime("%Y-%m-%d")
                            dailyData.setdefault(day_key, {}).setdefault(file_machine_id, {
                                "MIC_anomaly": 0, 
                                "MIC_processed": 0, 
                                "ACC_anomaly": 0, 
                                "ACC_processed": 0, 
                                "display_name": MACHINE_NAMES.get(file_machine_id, file_machine_id)
                            })
                            dailyData[day_key][file_machine_id][status_key] += 1

                            # 주별 데이터
                            first_dt = datetime.strptime(first_date, "%Y%m%d_%H%M%S")
                            week_num = (file_time - first_dt).days // 7 + 1
                            week_key = f"Week_{week_num}"
                            weeklyData.setdefault(week_key, {}).setdefault(file_machine_id, {
                                "MIC_anomaly": 0, 
                                "MIC_processed": 0, 
                                "ACC_anomaly": 0, 
                                "ACC_processed": 0, 
                                "display_name": MACHINE_NAMES.get(file_machine_id, file_machine_id)
                            })
                            weeklyData[week_key][file_machine_id][status_key] += 1

                            # 월별 데이터
                            month_key = file_time.strftime("%Y-%m")
                            monthlyData.setdefault(month_key, {}).setdefault(file_machine_id, {
                                "MIC_anomaly": 0, 
                                "MIC_processed": 0, 
                                "ACC_anomaly": 0, 
                                "ACC_processed": 0, 
                                "display_name": MACHINE_NAMES.get(file_machine_id, file_machine_id)
                            })
                            monthlyData[month_key][file_machine_id][status_key] += 1

                            # 최근 처리 시간 갱신
                            if file_time_str > max_processed:
                                max_processed = file_time_str

                if res.get('IsTruncated'):
                    token = res.get('NextContinuationToken')
                else:
                    break

    # 최종 결과 구성
    result = {
        "first_date": first_date,
        "hourlyData": hourlyData,
        "dailyData": dailyData,
        "weeklyData": weeklyData,
        "monthlyData": monthlyData,
        "machine_info": machine_info,
        "updated_at": datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    }

    save_json("data_counts.json", result)
    save_last_processed(max_processed)

if __name__ == "__main__":
    update_counts()
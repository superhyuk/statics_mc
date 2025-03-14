import boto3
import json
import os
import re
from datetime import datetime
import pytz  # 타임존 처리용

ACCESS_KEY = os.getenv('AWS_ACCESS_KEY_ID')
SECRET_KEY = os.getenv('AWS_SECRET_ACCESS_KEY')
BUCKET_NAME = os.getenv('BUCKET_NAME')
REGION_NAME = os.getenv('REGION_NAME')
MACHINE_IDS = json.loads(os.getenv('MACHINE_IDS', '[]'))

MACHINE_NAMES = {
    'MACHINE2': 'CURING_OVEN(#UNIT1)',
    'MACHINE3': 'HOT CHAMBER(#UNIT2)'
}

s3 = boto3.client('s3',
                  aws_access_key_id=ACCESS_KEY,
                  aws_secret_access_key=SECRET_KEY,
                  region_name=REGION_NAME)

KST = pytz.timezone('Asia/Seoul')

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
    # ... (기존 로직) ...
    return datetime.now()

def update_counts():
    # 1) 기존 data_counts와 last_processed 로드
    last_processed = load_last_processed()
    data_counts = load_json("data_counts.json", {})

    # 2) 현재 한국 시간
    now_kst = datetime.now(KST)
    today_str = now_kst.strftime("%Y%m%d")  # 예) '20250314'
    
    # 3) 기존 데이터 구조 불러오기
    hourlyData  = data_counts.get("hourlyData", {})
    dailyData   = data_counts.get("dailyData", {})
    weeklyData  = data_counts.get("weeklyData", {})
    monthlyData = data_counts.get("monthlyData", {})
    minuteData  = data_counts.get("minuteData", {})
    machine_info = data_counts.get("machine_info", {})
    first_date  = data_counts.get("first_date") or get_first_date().strftime("%Y%m%d_%H%M%S")

    # (3-A) 'minuteData_date' (이전 업데이트 시점의 날짜)
    #       하루가 바뀌면 minuteData를 비움
    old_minute_date = data_counts.get("minuteData_date")  # 예) '20250313'
    if old_minute_date != today_str:
        # 날짜 달라졌으니 이전 5분 데이터 삭제
        minuteData = {}  
        data_counts["minuteData_date"] = today_str  # 오늘 날짜로 갱신

    # 머신 정보
    for mid in MACHINE_IDS:
        if mid not in machine_info:
            machine_info[mid] = {
                "display_name": MACHINE_NAMES.get(mid, mid)
            }

    # 패턴
    patterns = {
        'result_MIC/anomaly/': 'MIC_anomaly',
        'result_MIC/processed/': 'MIC_processed',
        'result_ACC/anomaly/': 'ACC_anomaly',
        'result_ACC/processed/': 'ACC_processed'
    }

    max_processed = last_processed

    for machine_id in MACHINE_IDS:
        for prefix, status_key in patterns.items():
            token = None
            while True:
                params = {'Bucket': BUCKET_NAME, 'Prefix': f"{machine_id}/{prefix}"}
                if token:
                    params['ContinuationToken'] = token
                res = s3.list_objects_v2(**params)

                for obj in res.get('Contents', []):
                    match = re.search(r"(\d{8}_\d{2}_\d{2}_\d{2})_(.*?)_(MIC|ACC)", obj['Key'])
                    if not match:
                        continue

                    file_time_str = match.group(1)  # "YYYYmmdd_HH_MM_SS"
                    if file_time_str <= last_processed:
                        # 이미 처리된 파일
                        continue

                    # 파일 시간 -> python datetime
                    naive_file_time = datetime.strptime(file_time_str, "%Y%m%d_%H_%M_%S")
                    # 한국시간으로 해석 (환경에 따라 UTC->KST 변환이 필요할 수도)
                    file_time_kst = KST.localize(naive_file_time)

                    # hourlyData
                    hour_key = file_time_kst.strftime("%Y%m%d_%H")
                    if hour_key not in hourlyData:
                        hourlyData[hour_key] = {}
                    if machine_id not in hourlyData[hour_key]:
                        hourlyData[hour_key][machine_id] = {
                            "MIC_anomaly": 0, "MIC_processed": 0,
                            "ACC_anomaly": 0, "ACC_processed": 0,
                            "display_name": machine_info[machine_id]["display_name"]
                        }
                    hourlyData[hour_key][machine_id][status_key] += 1

                    # dailyData
                    day_key = file_time_kst.strftime("%Y-%m-%d")
                    if day_key not in dailyData:
                        dailyData[day_key] = {}
                    if machine_id not in dailyData[day_key]:
                        dailyData[day_key][machine_id] = {
                            "MIC_anomaly": 0, "MIC_processed": 0,
                            "ACC_anomaly": 0, "ACC_processed": 0,
                            "display_name": machine_info[machine_id]["display_name"]
                        }
                    dailyData[day_key][machine_id][status_key] += 1

                    # 주별
                    first_dt = datetime.strptime(first_date, "%Y%m%d_%H%M%S")
                    delta_days = (file_time_kst.replace(tzinfo=None) - first_dt).days
                    week_num = delta_days // 7 + 1
                    week_key = f"Week_{week_num}"
                    if week_key not in weeklyData:
                        weeklyData[week_key] = {}
                    if machine_id not in weeklyData[week_key]:
                        weeklyData[week_key][machine_id] = {
                            "MIC_anomaly": 0, "MIC_processed": 0,
                            "ACC_anomaly": 0, "ACC_processed": 0,
                            "display_name": machine_info[machine_id]["display_name"]
                        }
                    weeklyData[week_key][machine_id][status_key] += 1

                    # 월별
                    month_key = file_time_kst.strftime("%Y-%m")
                    if month_key not in monthlyData:
                        monthlyData[month_key] = {}
                    if machine_id not in monthlyData[month_key]:
                        monthlyData[month_key][machine_id] = {
                            "MIC_anomaly": 0, "MIC_processed": 0,
                            "ACC_anomaly": 0, "ACC_processed": 0,
                            "display_name": machine_info[machine_id]["display_name"]
                        }
                    monthlyData[month_key][machine_id][status_key] += 1

                    # 5분 단위 (오늘인 경우만)
                    file_ymd = file_time_kst.strftime("%Y%m%d")
                    if file_ymd == today_str:
                        # 5분 버킷
                        bucket_min = (file_time_kst.minute // 5) * 5
                        minute_key = file_time_kst.strftime(f"%Y%m%d_%H_{bucket_min:02d}")
                        if minute_key not in minuteData:
                            minuteData[minute_key] = {}
                        if machine_id not in minuteData[minute_key]:
                            minuteData[minute_key][machine_id] = {
                                "MIC_anomaly": 0, "MIC_processed": 0,
                                "ACC_anomaly": 0, "ACC_processed": 0,
                                "display_name": machine_info[machine_id]["display_name"]
                            }
                        minuteData[minute_key][machine_id][status_key] += 1

                    # 마지막 처리 시간 갱신
                    if file_time_str > max_processed:
                        max_processed = file_time_str

                if res.get('IsTruncated'):
                    token = res.get('NextContinuationToken')
                else:
                    break

    # 5) 최종 결과 저장
    data_counts["first_date"]   = first_date
    data_counts["hourlyData"]   = hourlyData
    data_counts["dailyData"]    = dailyData
    data_counts["weeklyData"]   = weeklyData
    data_counts["monthlyData"]  = monthlyData
    data_counts["minuteData"]   = minuteData
    data_counts["machine_info"] = machine_info
    data_counts["updated_at"]   = datetime.now(KST).strftime('%Y-%m-%d %H:%M:%S')

    save_json("data_counts.json", data_counts)
    save_last_processed(max_processed)


if __name__ == "__main__":
    update_counts()

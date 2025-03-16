import boto3
import json
import os
import re
from datetime import datetime, timedelta
import matplotlib.pyplot as plt  # pip install matplotlib
import numpy as np

# AWS 환경변수 및 설정
ACCESS_KEY = os.getenv('AWS_ACCESS_KEY_ID')
SECRET_KEY = os.getenv('AWS_SECRET_ACCESS_KEY')
BUCKET_NAME = os.getenv('BUCKET_NAME')
REGION_NAME = os.getenv('REGION_NAME')
MACHINE_IDS = json.loads(os.getenv('MACHINE_IDS', '[]'))

# 머신 ID -> 표시 이름
MACHINE_NAMES = {
    'MACHINE2': 'CURING_OVEN(#UNIT1)',
    'MACHINE3': 'HOT CHAMBER(#UNIT2)'
}

# S3 클라이언트 생성
s3 = boto3.client(
    's3',
    aws_access_key_id=ACCESS_KEY,
    aws_secret_access_key=SECRET_KEY,
    region_name=REGION_NAME
)

def load_json(filename, default=None):
    """JSON 파일을 읽어 dict로 반환 (실패 시 default 반환)"""
    try:
        with open(filename, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        return default if default is not None else {}

def save_json(filename, data):
    """dict를 JSON 파일로 저장"""
    with open(filename, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

def load_last_processed():
    """last_processed.json에서 마지막 처리 시각을 불러옴"""
    info = load_json('last_processed.json', {})
    return info.get("last_processed_time", "20240101_000000")

def save_last_processed(time_str):
    """마지막 처리 시각을 last_processed.json에 저장"""
    save_json('last_processed.json', {"last_processed_time": time_str})

def get_first_date():
    """
    S3에서 가장 오래된 파일의 날짜/시간을 찾아 반환.
    파일이 없으면 현재 시각을 반환.
    """
    earliest = None
    for machine_id in MACHINE_IDS:
        response = s3.list_objects_v2(Bucket=BUCKET_NAME, Prefix=f"{machine_id}/")
        for obj in response.get('Contents', []):
            match = re.search(r"(\d{8}_\d{2}_\d{2}_\d{2})_(.*?)_(MIC|ACC)", obj['Key'])
            if match:
                date = datetime.strptime(match.group(1), "%Y%m%d_%H_%M_%S")
                if earliest is None or date < earliest:
                    earliest = date
    return earliest or datetime.now()

def recollect_weekly_data_for_machine_sensor(week_start, week_end, machine_id, sensor):
    """
    주어진 기간(week_start ~ week_end) 동안 machine_id와 sensor(MIC 또는 ACC)에 대해
    S3에서 파일 건수를 시간(0~23)별로 재수집.
    """
    processed = [0] * 24
    anomaly = [0] * 24
    patterns = {
        'processed': f"result_{sensor}/processed/",
        'anomaly': f"result_{sensor}/anomaly/"
    }
    for key, prefix in patterns.items():
        token = None
        while True:
            params = {
                'Bucket': BUCKET_NAME,
                'Prefix': f"{machine_id}/{prefix}"
            }
            if token:
                params['ContinuationToken'] = token
            res = s3.list_objects_v2(**params)
            for obj in res.get('Contents', []):
                m = re.search(r"(\d{8}_\d{2}_\d{2}_\d{2})", obj['Key'])
                if m:
                    file_time_str = m.group(1)
                    try:
                        file_time = datetime.strptime(file_time_str, "%Y%m%d_%H_%M_%S")
                    except:
                        continue
                    if week_start <= file_time <= week_end:
                        hour = file_time.hour
                        if key == 'processed':
                            processed[hour] += 1
                        else:
                            anomaly[hour] += 1
            if res.get('IsTruncated'):
                token = res.get('NextContinuationToken')
            else:
                break
    return processed, anomaly

def make_weekly_plots(data_counts):
    """
    hourlyData를 바탕으로 각 주별로 머신별(MIC, ACC)에 대한
    시간대별 집계 데이터를 생성하고, 플롯 이미지를 생성.
    집계 데이터가 없는 경우 S3에서 재수집하여 JSON에 반영.
    생성된 플롯 파일 경로는 data_counts["weeklyPlots"]에 저장됨.
    """
    hourlyData = data_counts.get("hourlyData", {})
    if not hourlyData:
        print("[INFO] No hourlyData, skipping weekly plots generation.")
        return

    first_date_str = data_counts.get("first_date")
    first_date_dt = datetime.strptime(first_date_str, "%Y%m%d_%H%M%S")
    weeklyAgg = {}

    # hourlyData를 주차별, 머신별, 센서별 시간대별로 누적 집계
    for hour_key, machines in hourlyData.items():
        try:
            date_part, hour_part = hour_key.split("_")
        except ValueError:
            continue
        try:
            dt = datetime.strptime(date_part, "%Y%m%d")
        except:
            continue
        hour = int(hour_part)
        week_num = ((dt.date() - first_date_dt.date()).days // 7) + 1
        week_key = f"Week_{week_num}"
        if week_key not in weeklyAgg:
            weeklyAgg[week_key] = {}
        for machine_id, counts in machines.items():
            if machine_id not in weeklyAgg[week_key]:
                weeklyAgg[week_key][machine_id] = {
                    "MIC": {"processed": [0]*24, "anomaly": [0]*24},
                    "ACC": {"processed": [0]*24, "anomaly": [0]*24}
                }
            weeklyAgg[week_key][machine_id]["MIC"]["processed"][hour] += counts.get("MIC_processed", 0)
            weeklyAgg[week_key][machine_id]["MIC"]["anomaly"][hour] += counts.get("MIC_anomaly", 0)
            weeklyAgg[week_key][machine_id]["ACC"]["processed"][hour] += counts.get("ACC_processed", 0)
            weeklyAgg[week_key][machine_id]["ACC"]["anomaly"][hour] += counts.get("ACC_anomaly", 0)

    # 주간 플롯 생성: JSON의 weeklyData와 weeklyAgg 모두 활용하여 처리할 주 결정
    weeklyData_json = data_counts.get("weeklyData", {})
    all_week_keys = set(weeklyData_json.keys()).union(set(weeklyAgg.keys()))

    weekly_plots_dir = "weekly_plots"
    os.makedirs(weekly_plots_dir, exist_ok=True)
    weeklyPlotsPaths = {}

    for week_key in sorted(all_week_keys, key=lambda x: int(x.split('_')[1])):
        week_num = int(week_key.split('_')[1])
        week_start = first_date_dt + timedelta(days=(week_num - 1) * 7)
        week_end = week_start + timedelta(days=6, hours=23, minutes=59, seconds=59)
        weeklyPlotsPaths[week_key] = {}

        for machine_id in MACHINE_IDS:
            if machine_id not in weeklyAgg.get(week_key, {}):
                # 해당 주에 데이터가 없으면 빈 집계 구조를 만들고 재수집 시도
                weeklyAgg.setdefault(week_key, {})[machine_id] = {
                    "MIC": {"processed": [0]*24, "anomaly": [0]*24},
                    "ACC": {"processed": [0]*24, "anomaly": [0]*24}
                }
            for sensor in ["MIC", "ACC"]:
                proc_sum = sum(weeklyAgg[week_key][machine_id][sensor]["processed"])
                anom_sum = sum(weeklyAgg[week_key][machine_id][sensor]["anomaly"])
                # 데이터 없으면 S3에서 재수집
                if proc_sum == 0 and anom_sum == 0:
                    proc, anom = recollect_weekly_data_for_machine_sensor(week_start, week_end, machine_id, sensor)
                    weeklyAgg[week_key][machine_id][sensor]["processed"] = proc
                    weeklyAgg[week_key][machine_id][sensor]["anomaly"] = anom
                proc_sum = sum(weeklyAgg[week_key][machine_id][sensor]["processed"])
                anom_sum = sum(weeklyAgg[week_key][machine_id][sensor]["anomaly"])
                if proc_sum == 0 and anom_sum == 0:
                    continue

                plt.figure(figsize=(10, 5))
                x = np.arange(24)
                width = 0.35
                proc_data = weeklyAgg[week_key][machine_id][sensor]["processed"]
                anom_data = weeklyAgg[week_key][machine_id][sensor]["anomaly"]
                plt.bar(x - width/2, proc_data, width, label='정상')
                plt.bar(x + width/2, anom_data, width, label='이상')
                plt.xlabel("Hour (0-23)")
                plt.ylabel("Count")
                title = f"{week_key} - {MACHINE_NAMES.get(machine_id, machine_id)} {sensor} 집계"
                plt.title(title)
                plt.legend()

                week_dir = os.path.join(weekly_plots_dir, week_key)
                os.makedirs(week_dir, exist_ok=True)
                plot_filename = f"{machine_id}_{sensor}.png"
                plot_path = os.path.join(week_dir, plot_filename)
                plt.savefig(plot_path)
                plt.close()
                weeklyPlotsPaths[week_key].setdefault(machine_id, {})[sensor] = plot_path
                print(f"[INFO] Weekly plot saved to {plot_path}")

    data_counts["weeklyPlots"] = weeklyPlotsPaths
    save_json("data_counts.json", data_counts)

def update_counts():
    """
    S3 스캔을 통해 hourlyData, dailyData, weeklyData, monthlyData를 갱신하고,
    JSON 파일을 업데이트하며 마지막 처리 시각을 기록합니다.
    당일 플롯/요약은 제거하고, 주간 데이터 집계 플롯을 생성합니다.
    """
    last_processed = load_last_processed()
    data_counts = load_json("data_counts.json", {})
    max_processed = last_processed

    first_date = data_counts.get("first_date")
    if not first_date:
        first_date_dt = get_first_date()
        first_date = first_date_dt.strftime("%Y%m%d_%H%M%S")
    hourlyData = data_counts.get("hourlyData", {})
    dailyData  = data_counts.get("dailyData", {})
    weeklyData = data_counts.get("weeklyData", {})
    monthlyData = data_counts.get("monthlyData", {})

    machine_info = data_counts.get("machine_info", {})
    for machine_id in MACHINE_IDS:
        if machine_id not in machine_info:
            machine_info[machine_id] = {"display_name": MACHINE_NAMES.get(machine_id, machine_id)}

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
                params = {
                    'Bucket': BUCKET_NAME,
                    'Prefix': f"{machine_id}/{prefix}"
                }
                if token:
                    params['ContinuationToken'] = token
                res = s3.list_objects_v2(**params)
                contents = res.get('Contents', [])
                for obj in contents:
                    match = re.search(r"(\d{8}_\d{2}_\d{2}_\d{2})_(.*?)_(MIC|ACC)", obj['Key'])
                    if match:
                        file_time_str = match.group(1)
                        file_time = datetime.strptime(file_time_str, "%Y%m%d_%H_%M_%S")
                        if file_time_str > last_processed:
                            hour_key = file_time.strftime("%Y%m%d_%H")
                            if hour_key not in hourlyData:
                                hourlyData[hour_key] = {}
                            if machine_id not in hourlyData[hour_key]:
                                hourlyData[hour_key][machine_id] = {
                                    "MIC_anomaly": 0, "MIC_processed": 0,
                                    "ACC_anomaly": 0, "ACC_processed": 0,
                                    "display_name": MACHINE_NAMES.get(machine_id, machine_id)
                                }
                            hourlyData[hour_key][machine_id][status_key] += 1

                            day_key = file_time.strftime("%Y-%m-%d")
                            if day_key not in dailyData:
                                dailyData[day_key] = {}
                            if machine_id not in dailyData[day_key]:
                                dailyData[day_key][machine_id] = {
                                    "MIC_anomaly": 0, "MIC_processed": 0,
                                    "ACC_anomaly": 0, "ACC_processed": 0,
                                    "display_name": MACHINE_NAMES.get(machine_id, machine_id)
                                }
                            dailyData[day_key][machine_id][status_key] += 1

                            first_dt = datetime.strptime(first_date, "%Y%m%d_%H%M%S")
                            week_num = (file_time - first_dt).days // 7 + 1
                            week_key = f"Week_{week_num}"
                            if week_key not in weeklyData:
                                weeklyData[week_key] = {}
                            if machine_id not in weeklyData[week_key]:
                                weeklyData[week_key][machine_id] = {
                                    "MIC_anomaly": 0, "MIC_processed": 0,
                                    "ACC_anomaly": 0, "ACC_processed": 0,
                                    "display_name": MACHINE_NAMES.get(machine_id, machine_id)
                                }
                            weeklyData[week_key][machine_id][status_key] += 1

                            month_key = file_time.strftime("%Y-%m")
                            if month_key not in monthlyData:
                                monthlyData[month_key] = {}
                            if machine_id not in monthlyData[month_key]:
                                monthlyData[month_key][machine_id] = {
                                    "MIC_anomaly": 0, "MIC_processed": 0,
                                    "ACC_anomaly": 0, "ACC_processed": 0,
                                    "display_name": MACHINE_NAMES.get(machine_id, machine_id)
                                }
                            monthlyData[month_key][machine_id][status_key] += 1

                            if file_time_str > max_processed:
                                max_processed = file_time_str
                if res.get('IsTruncated'):
                    token = res.get('NextContinuationToken')
                else:
                    break

    data_counts["first_date"] = first_date
    data_counts["hourlyData"] = hourlyData
    data_counts["dailyData"] = dailyData
    data_counts["weeklyData"] = weeklyData
    data_counts["monthlyData"] = monthlyData
    data_counts["machine_info"] = machine_info
    data_counts["updated_at"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    save_json("data_counts.json", data_counts)
    save_last_processed(max_processed)

    # 당일 플롯/요약은 GitHub에 저장되지 않으므로 제거하고,
    # 주간 데이터 집계 플롯(시간대별)을 생성하여 JSON에 추가
    make_weekly_plots(data_counts)

if __name__ == "__main__":
    update_counts()

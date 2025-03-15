import boto3
import json
import os
import re
from datetime import datetime
import matplotlib.pyplot as plt  # 이미지 저장용 (pip install matplotlib)

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

# S3 클라이언트
s3 = boto3.client(
    's3',
    aws_access_key_id=ACCESS_KEY,
    aws_secret_access_key=SECRET_KEY,
    region_name=REGION_NAME
)

def load_json(filename, default=None):
    """JSON 파일 읽어 dict로 반환. 실패 시 default 반환."""
    try:
        with open(filename, 'r', encoding='utf-8') as f:
            return json.load(f)
    except:
        return default if default is not None else {}

def save_json(filename, data):
    """dict -> JSON 파일 저장."""
    with open(filename, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

def load_last_processed():
    """마지막 처리된 시각(문자열)을 last_processed.json에서 불러온다."""
    info = load_json('last_processed.json', {})
    return info.get("last_processed_time", "20240101_000000")

def save_last_processed(time_str):
    """마지막 처리된 시각을 last_processed.json에 저장."""
    save_json('last_processed.json', {"last_processed_time": time_str})

def get_first_date():
    """
    S3에서 가장 오래된(earliest) 날짜/시간을 찾아 리턴.
    만약 아무 파일도 없으면 현재 시각 반환.
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

def update_counts():
    """
    1) S3 스캔 -> hourlyData, dailyData, weeklyData, monthlyData 갱신
    2) data_counts.json 저장
    3) 마지막 처리 시각(last_processed.json) 갱신
    4) 오늘(24시간) 요약/이미지 생성 -> summary/, plot/
    """
    # 마지막 처리 시각
    last_processed = load_last_processed()

    # 기존 data_counts.json 로드
    data_counts = load_json("data_counts.json", {})
    max_processed = last_processed

    # 첫 처리 날짜 (주차 계산에 필요)
    first_date = data_counts.get("first_date")
    if not first_date:
        # 아직 first_date가 없으면 -> S3에서 가장 처음 파일 날짜
        first_date_dt = get_first_date()
        first_date = first_date_dt.strftime("%Y%m%d_%H%M%S")  # ex) "20250101_120000"

    # 데이터 구조 초기화 (없으면 빈 dict)
    hourlyData = data_counts.get("hourlyData", {})
    dailyData  = data_counts.get("dailyData", {})
    weeklyData = data_counts.get("weeklyData", {})
    monthlyData= data_counts.get("monthlyData", {})

    # 머신 정보
    machine_info = data_counts.get("machine_info", {})
    for machine_id in MACHINE_IDS:
        if machine_id not in machine_info:
            machine_info[machine_id] = {
                "display_name": MACHINE_NAMES.get(machine_id, machine_id)
            }

    # S3 상에서 MIC/ACC + anomaly/processed 경로
    patterns = {
        'result_MIC/anomaly/':    'MIC_anomaly',
        'result_MIC/processed/':  'MIC_processed',
        'result_ACC/anomaly/':    'ACC_anomaly',
        'result_ACC/processed/':  'ACC_processed'
    }

    # S3 스캔 -> hourly/daily/weekly/monthlyData 갱신
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
                    # 예: "20250315_17_12_34_MP23ABS1_MIC" 등등
                    match = re.search(r"(\d{8}_\d{2}_\d{2}_\d{2})_(.*?)_(MIC|ACC)", obj['Key'])
                    if match:
                        file_time_str = match.group(1)  # "20250315_17_12_34"
                        # file_suffix = match.group(2)  # "MP23ABS1" 등
                        data_type = match.group(3)      # "MIC" or "ACC"

                        file_machine_id = machine_id
                        file_time = datetime.strptime(file_time_str, "%Y%m%d_%H_%M_%S")

                        # last_processed보다 늦으면 새 파일
                        if file_time_str > last_processed:
                            # 1) hourly
                            hour_key = file_time.strftime("%Y%m%d_%H")
                            if hour_key not in hourlyData:
                                hourlyData[hour_key] = {}
                            if file_machine_id not in hourlyData[hour_key]:
                                hourlyData[hour_key][file_machine_id] = {
                                    "MIC_anomaly":0, "MIC_processed":0,
                                    "ACC_anomaly":0, "ACC_processed":0,
                                    "display_name": MACHINE_NAMES.get(file_machine_id, file_machine_id)
                                }
                            hourlyData[hour_key][file_machine_id][status_key] += 1

                            # 2) daily
                            day_key = file_time.strftime("%Y-%m-%d")
                            if day_key not in dailyData:
                                dailyData[day_key] = {}
                            if file_machine_id not in dailyData[day_key]:
                                dailyData[day_key][file_machine_id] = {
                                    "MIC_anomaly":0, "MIC_processed":0,
                                    "ACC_anomaly":0, "ACC_processed":0,
                                    "display_name": MACHINE_NAMES.get(file_machine_id, file_machine_id)
                                }
                            dailyData[day_key][file_machine_id][status_key] += 1

                            # 3) 주별
                            first_dt = datetime.strptime(first_date, "%Y%m%d_%H%M%S")
                            week_num = (file_time - first_dt).days // 7 + 1
                            week_key = f"Week_{week_num}"
                            if week_key not in weeklyData:
                                weeklyData[week_key] = {}
                            if file_machine_id not in weeklyData[week_key]:
                                weeklyData[week_key][file_machine_id] = {
                                    "MIC_anomaly":0, "MIC_processed":0,
                                    "ACC_anomaly":0, "ACC_processed":0,
                                    "display_name": MACHINE_NAMES.get(file_machine_id, file_machine_id)
                                }
                            weeklyData[week_key][file_machine_id][status_key] += 1

                            # 4) 월별
                            month_key = file_time.strftime("%Y-%m")
                            if month_key not in monthlyData:
                                monthlyData[month_key] = {}
                            if file_machine_id not in monthlyData[month_key]:
                                monthlyData[month_key][file_machine_id] = {
                                    "MIC_anomaly":0, "MIC_processed":0,
                                    "ACC_anomaly":0, "ACC_processed":0,
                                    "display_name": MACHINE_NAMES.get(file_machine_id, file_machine_id)
                                }
                            monthlyData[month_key][file_machine_id][status_key] += 1

                            # 최근 처리 시각 갱신
                            if file_time_str > max_processed:
                                max_processed = file_time_str

                # 다음 페이지
                if res.get('IsTruncated'):
                    token = res.get('NextContinuationToken')
                else:
                    break

    # 최종 데이터 반영
    data_counts["first_date"]   = first_date
    data_counts["hourlyData"]   = hourlyData
    data_counts["dailyData"]    = dailyData
    data_counts["weeklyData"]   = weeklyData
    data_counts["monthlyData"]  = monthlyData
    data_counts["machine_info"] = machine_info
    data_counts["updated_at"]   = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    # 저장
    save_json("data_counts.json", data_counts)
    save_last_processed(max_processed)

    # 요약/플롯 생성
    make_daily_summary_and_plot(data_counts)

def make_daily_summary_and_plot(data_counts):
    """
    오늘 날짜(또는 가장 최근 hourKey의 날짜)에 해당하는
    summary/{YYYY-MM-DD}/summary.txt & plot/{YYYY-MM-DD}/mic_processed.png 생성
    """
    hourlyData = data_counts.get("hourlyData", {})
    if not hourlyData:
        print("[INFO] No hourlyData, skip summary/plot generation.")
        return

    all_keys = sorted(hourlyData.keys())  # ["20250315_00", "20250315_01", ...]
    latest_key = all_keys[-1]            # 예: "20250315_23"
    base_date = latest_key[:8]           # "20250315"

    # YYYY-MM-DD
    date_str = f"{base_date[:4]}-{base_date[4:6]}-{base_date[6:8]}"

    # 디렉토리 생성
    summary_dir = f"summary/{date_str}"
    plot_dir    = f"plot/{date_str}"
    os.makedirs(summary_dir, exist_ok=True)
    os.makedirs(plot_dir, exist_ok=True)

    # 하루치 집계
    daily_totals = calculate_daily_totals(hourlyData, base_date)

    # 텍스트 요약
    summary_path = os.path.join(summary_dir, "summary.txt")
    with open(summary_path, "w", encoding="utf-8") as f:
        f.write(f"일자: {date_str}\n")
        f.write(f"업데이트 시각: {data_counts.get('updated_at','-')}\n\n")
        f.write("=== 하루치 총합 ===\n")

        for mId, obj in daily_totals.items():
            display_name = obj["display_name"]
            mic_proc = obj["MIC_processed"]
            mic_anom = obj["MIC_anomaly"]
            acc_proc = obj["ACC_processed"]
            acc_anom = obj["ACC_anomaly"]

            mic_total = mic_proc + mic_anom
            acc_total = acc_proc + acc_anom
            mic_rate = f"{(mic_anom/mic_total*100):.1f}%" if mic_total else "0%"
            acc_rate = f"{(acc_anom/acc_total*100):.1f}%" if acc_total else "0%"

            f.write(f"{display_name}\n")
            f.write(f"  MIC: 정상 {mic_proc}, 이상 {mic_anom} (이상 {mic_rate})\n")
            f.write(f"  ACC: 정상 {acc_proc}, 이상 {acc_anom} (이상 {acc_rate})\n")

        f.write("\n--- END OF SUMMARY ---\n")

    print(f"[INFO] Summaries saved to {summary_path}")

    # 예: MACHINE2 의 MIC 정상값(0~23h)을 바 형태로 
    mic_processed_arr = []
    for h in range(24):
        hour_key = f"{base_date}_{h:02d}"
        c = hourlyData.get(hour_key, {}).get("MACHINE2")
        if c:
            mic_processed_arr.append(c["MIC_processed"])
        else:
            mic_processed_arr.append(0)

    # Matplotlib 플롯
    plt.figure(figsize=(8,4))
    plt.bar(range(24), mic_processed_arr, color="blue", alpha=0.6)
    plt.title(f"{date_str} MACHINE2 MIC 정상처리 건수")
    plt.xlabel("Hour(0~23)")
    plt.ylabel("Count")

    plot_path = os.path.join(plot_dir, "mic_processed.png")
    plt.savefig(plot_path)
    plt.close()
    print(f"[INFO] Plot saved to {plot_path}")

def calculate_daily_totals(hourlyData, base_date):
    """
    base_date(YYYYMMDD)에 해당하는 0~23시의 MACHINE2/MACHINE3 데이터를 합산.
    """
    totals = {}
    for h in range(24):
        hh = f"{h:02d}"
        hour_key = f"{base_date}_{hh}"
        mchObj = hourlyData.get(hour_key, {})

        for mId, c in mchObj.items():
            if mId not in totals:
                totals[mId] = {
                    "MIC_processed":0, "MIC_anomaly":0,
                    "ACC_processed":0, "ACC_anomaly":0,
                    "display_name": c.get("display_name", mId)
                }
            totals[mId]["MIC_processed"] += c.get("MIC_processed",0)
            totals[mId]["MIC_anomaly"]  += c.get("MIC_anomaly",0)
            totals[mId]["ACC_processed"] += c.get("ACC_processed",0)
            totals[mId]["ACC_anomaly"]  += c.get("ACC_anomaly",0)
    return totals

if __name__ == "__main__":
    update_counts()

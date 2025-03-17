import boto3
import json
import os
import re
from datetime import datetime
import matplotlib.pyplot as plt

ACCESS_KEY = os.getenv('AWS_ACCESS_KEY_ID')
SECRET_KEY = os.getenv('AWS_SECRET_ACCESS_KEY')
BUCKET_NAME = os.getenv('BUCKET_NAME')
REGION_NAME = os.getenv('REGION_NAME')
MACHINE_IDS = json.loads(os.getenv('MACHINE_IDS', '[]'))

MACHINE_NAMES = {
    'MACHINE2': 'CURING_OVEN(#UNIT1)',
    'MACHINE3': 'HOT CHAMBER(#UNIT2)'
}

s3 = boto3.client(
    's3',
    aws_access_key_id=ACCESS_KEY,
    aws_secret_access_key=SECRET_KEY,
    region_name=REGION_NAME
)

def load_json(filename, default=None):
    try:
        with open(filename, 'r', encoding='utf-8') as f:
            return json.load(f)
    except:
        return default if default is not None else {}

def save_json(filename, data):
    with open(filename, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

def load_last_processed():
    info = load_json('last_processed.json', {})
    return info.get("last_processed_time", "20240101_000000")

def save_last_processed(time_str):
    save_json('last_processed.json', {"last_processed_time": time_str})

def get_first_date():
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

def calculate_daily_totals(hourlyData, base_date):
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

def make_daily_summary_and_plot(data_counts):
    hourlyData = data_counts.get("hourlyData", {})
    if not hourlyData:
        print("[INFO] No hourlyData, skip summary/plot generation.")
        return

    all_keys = sorted(hourlyData.keys())
    latest_key = all_keys[-1]
    base_date = latest_key[:8]

    date_str = f"{base_date[:4]}-{base_date[4:6]}-{base_date[6:8]}"

    summary_dir = f"summary/{date_str}"
    plot_dir = f"plot/{date_str}"
    os.makedirs(summary_dir, exist_ok=True)
    os.makedirs(plot_dir, exist_ok=True)

    daily_totals = calculate_daily_totals(hourlyData, base_date)

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

    mic_processed_arr = []
    for h in range(24):
        hour_key = f"{base_date}_{h:02d}"
        c = hourlyData.get(hour_key, {}).get("MACHINE2")
        mic_processed_arr.append(c["MIC_processed"] if c else 0)

    plt.figure(figsize=(8,4))
    plt.bar(range(24), mic_processed_arr, color="blue", alpha=0.6)
    plt.title(f"{date_str} MACHINE2 MIC 정상처리 건수")
    plt.xlabel("Hour(0~23)")
    plt.ylabel("Count")

    plot_path = os.path.join(plot_dir, "mic_processed.png")
    plt.savefig(plot_path)
    plt.close()

    print(f"[INFO] Plot saved to {plot_path}")

# 여기에 빠진 update_counts 함수 정의
def update_counts():
    print("update_counts 함수가 호출되었습니다.")

if __name__ == "__main__":
    update_counts()

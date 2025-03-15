import boto3
import json
import os
import re
from datetime import datetime
import matplotlib.pyplot as plt  # 이미지 저장을 위한 matplotlib
# 필요하다면 "pip install matplotlib"

ACCESS_KEY = os.getenv('AWS_ACCESS_KEY_ID')
SECRET_KEY = os.getenv('AWS_SECRET_ACCESS_KEY')
BUCKET_NAME = os.getenv('BUCKET_NAME')
REGION_NAME = os.getenv('REGION_NAME')
MACHINE_IDS = json.loads(os.getenv('MACHINE_IDS', '[]'))

MACHINE_NAMES = {
    'MACHINE2': 'CURING_OVEN(#UNIT1)',
    'MACHINE3': 'HOT CHAMBER(#UNIT2)'
}

# (중략) S3 클라이언트, load_json, save_json 등 기존함수 동일

def update_counts():
    # (1) 기존 S3 스캔 및 data_counts.json 업데이트
    last_processed = load_last_processed()
    data_counts = load_json("data_counts.json", {})
    # ... (중략) 기존 로직 그대로 ...
    # 최종적으로 hourlyData, dailyData, weeklyData, monthlyData 업데이트

    data_counts["updated_at"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    save_json("data_counts.json", data_counts)
    # save_last_processed(max_processed)

    # (2) 추가: 오늘 날짜 기준으로 summary 폴더 + plot 폴더에 결과 저장
    #    2-1) 텍스트 요약 (summary/{YYYY-MM-DD}/summary.txt)
    #    2-2) 이미지(하루치 히스토그램) (plot/{YYYY-MM-DD}/plot.png)

    make_daily_summary_and_plot(data_counts)

def make_daily_summary_and_plot(data_counts):
    # 1) 오늘 날짜(예: 20250315)를 식별
    hourlyData = data_counts.get("hourlyData", {})
    if not hourlyData:
        print("No hourlyData, skip summary/plot generation.")
        return

    all_keys = sorted(hourlyData.keys())
    latest_key = all_keys[-1]  # ex) "20250315_17"
    base_date = latest_key[:8] # "20250315"

    # "YYYY-MM-DD"
    date_str = f"{base_date[:4]}-{base_date[4:6]}-{base_date[6:8]}"

    # 2) 디렉토리 생성
    summary_dir = f"summary/{date_str}"
    plot_dir = f"plot/{date_str}"
    os.makedirs(summary_dir, exist_ok=True)
    os.makedirs(plot_dir, exist_ok=True)

    # 3) 하루치 요약 계산
    daily_totals = calculate_daily_totals(hourlyData, base_date)

    # 4) 텍스트 파일에 요약 저장
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

    # 5) 예시로 하루치(0~23시) MIC 정상합을 Matplotlib으로 그려 저장
    #    (실제로는 MACHINE2/MACHINE3 각각 MIC/ACC 등 여러 이미지를 만들 수도 있음)

    mic_processed_arr = []
    for h in range(24):
        hour_key = f"{base_date}_{h:02d}"
        # MACHINE2 예시
        c = hourlyData.get(hour_key,{}).get("MACHINE2")
        if c:
            mic_processed_arr.append(c["MIC_processed"])
        else:
            mic_processed_arr.append(0)

    # 간단한 막대 차트
    plt.figure(figsize=(8,4))
    plt.bar(range(24), mic_processed_arr, color="blue", alpha=0.6)
    plt.title(f"{date_str} MACHINE2 MIC 정상처리 건수")
    plt.xlabel("Hour(0~23)")
    plt.ylabel("Count")
    # 저장
    plot_path = os.path.join(plot_dir, "mic_processed.png")
    plt.savefig(plot_path)
    plt.close()
    print(f"[INFO] Plot saved to {plot_path}")

def calculate_daily_totals(hourlyData, base_date):
    # 0~23시 합산
    totals = {}
    for h in range(24):
        hour_key = f"{base_date}_{h:02d}"
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

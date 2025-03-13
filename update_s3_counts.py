import boto3
import json
import os
import re

ACCESS_KEY = os.getenv('AWS_ACCESS_KEY_ID')
SECRET_KEY = os.getenv('AWS_SECRET_ACCESS_KEY')
BUCKET_NAME = os.getenv('BUCKET_NAME')
REGION_NAME = os.getenv('AWS_REGION', 'ap-northeast-2')

# MACHINE_IDS는 예: ["machineA","machineB"] 처럼 JSON 배열 문자열을 Secrets에 저장
MACHINE_IDS = json.loads(os.getenv('MACHINE_IDS', '[]'))

s3 = boto3.client(
    's3',
    aws_access_key_id=ACCESS_KEY,
    aws_secret_access_key=SECRET_KEY,
    region_name=REGION_NAME
)

def load_last_processed():
    """
    last_processed.json에서 마지막 처리 시각을 읽어온다.
    파일이 없거나, 파싱 실패 시에는 "20240101_000000" 등 기본값 반환
    """
    try:
        with open('last_processed.json', 'r') as f:
            data = json.load(f)
            return data.get("last_processed_time", "20240101_000000")
    except FileNotFoundError:
        # 파일이 없으면 매우 과거 시점으로 가정
        return "20240101_000000"
    except:
        return "20240101_000000"

def save_last_processed(time_str):
    """
    가장 최근에 처리한 파일 시간(YYYYMMDD_HHMMSS)을 last_processed.json에 저장
    """
    with open("last_processed.json", "w") as f:
        json.dump({"last_processed_time": time_str}, f)

def load_data_counts():
    """
    이미 저장된 data_counts.json을 불러온다.
    없으면 {} 반환
    """
    try:
        with open("data_counts.json", "r") as f:
            return json.load(f)
    except FileNotFoundError:
        return {}
    except:
        return {}

def save_data_counts(data):
    """
    data_counts.json 파일에 저장
    """
    with open("data_counts.json", "w") as f:
        json.dump(data, f, indent=2)

def update_counts():
    last_processed_time = load_last_processed()  # 예) "20240101_000000"
    data_counts = load_data_counts()             # 과거 누적 정보

    # 지금까지 가장 마지막으로 처리된 시간을 추적(초기에는 last_processed_time)
    max_processed = last_processed_time

    # S3 경로 규칙:
    # - {machine_id}/result_MIC/anomaly/
    # - {machine_id}/result_MIC/processed/
    # - {machine_id}/result_ACC/anomaly/
    # - {machine_id}/result_ACC/processed/
    # 폴더별로 (MIC/ACC + anomaly/processed)를 판단
    prefix_patterns = [
        ("result_MIC/anomaly/", "MIC_anomaly"),
        ("result_MIC/processed/", "MIC_processed"),
        ("result_ACC/anomaly/", "ACC_anomaly"),
        ("result_ACC/processed/", "ACC_processed"),
    ]

    # S3에서 반복적으로 오브젝트 가져오기
    for machine_id in MACHINE_IDS:
        for prefix_tuple in prefix_patterns:
            prefix_folder, dict_key = prefix_tuple
            # 예: machineA/result_MIC/anomaly/
            full_prefix = f"{machine_id}/{prefix_folder}"

            # **주의**: list_objects_v2는 최대 1000개씩 반환하므로, 'NextContinuationToken'을 사용한 반복이 필요할 수 있음
            continuation_token = None

            while True:
                if continuation_token:
                    response = s3.list_objects_v2(
                        Bucket=BUCKET_NAME,
                        Prefix=full_prefix,
                        ContinuationToken=continuation_token
                    )
                else:
                    response = s3.list_objects_v2(
                        Bucket=BUCKET_NAME,
                        Prefix=full_prefix
                    )

                contents = response.get('Contents', [])
                for obj in contents:
                    # 예: "machineA/result_MIC/anomaly/20240101_123456_something.wav"
                    filename = obj['Key']
                    # 시간 정보(YYYYMMDD_HHMMSS)만 추출
                    # 정규식으로 8자리 날짜 + '_' + 6자리 시간
                    # 예: 20240101_123456
                    match = re.search(r"(\d{8}_\d{6})", filename)
                    if match:
                        file_time = match.group(1)  # "20240101_123456"

                        # last_processed_time 이후인 경우만 카운트에 반영
                        if file_time > last_processed_time:
                            # hourKey = "20240101_12" 형태
                            hour_key = file_time[:11]  # YYYYMMDD_HH (처음 11글자)
                            
                            if hour_key not in data_counts:
                                data_counts[hour_key] = {}

                            if machine_id not in data_counts[hour_key]:
                                data_counts[hour_key][machine_id] = {
                                    "MIC_anomaly": 0,
                                    "MIC_processed": 0,
                                    "ACC_anomaly": 0,
                                    "ACC_processed": 0
                                }

                            # 해당 폴더에 따라 MIC_anomaly / MIC_processed / ACC_anomaly / ACC_processed 중 하나 증가
                            data_counts[hour_key][machine_id][dict_key] += 1

                            # max_processed 갱신
                            if file_time > max_processed:
                                max_processed = file_time

                if response.get('IsTruncated'):
                    # 더 가져올 데이터가 있음 → 토큰 업데이트 후 반복
                    continuation_token = response.get('NextContinuationToken')
                else:
                    # 더 이상 가져올 페이지가 없음
                    break

    # 데이터 저장
    save_data_counts(data_counts)
    # 가장 최근 처리 시간 저장
    save_last_processed(max_processed)

if __name__ == "__main__":
    update_counts()

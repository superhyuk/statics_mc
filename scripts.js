// 전역 폰트 설정
Chart.defaults.font.family = "'Pretendard', 'Noto Sans KR', sans-serif";
Chart.defaults.font.size = 13;

const chartColors = {
  normal: 'rgba(54, 162, 235, 0.7)',  // 정상
  anomaly: 'rgba(255, 99, 132, 0.7)', // 이상
};

let charts = {};  // 만들어지는 차트들을 저장할 객체

function showLoading() { /* 생략 */ }
function hideLoading() { /* 생략 */ }

async function loadData() {
  showLoading();
  try {
    const res = await fetch('data_counts.json');
    const data = await res.json();
    updateDashboard(data);
  } catch (error) {
    console.error('데이터 로딩 실패:', error);
  } finally {
    hideLoading();
  }
}

function updateDashboard(data) {
  updateTodayData(data);

  // 주간/월간 데이터를 각각 렌더링
  renderWeeklyCharts(data);
  renderMonthlyCharts(data);

  // 업데이트 시간 표시
  const lastUpdatedEl = document.getElementById('lastUpdatedTime');
  if (lastUpdatedEl) {
    lastUpdatedEl.textContent = data.updated_at || '-';
  }
}

function updateTodayData(data) {
  // ... (기존 오늘 데이터 카드 만드는 로직 그대로 사용)
}

/* ------------------------------------------
   주간 차트 그리기 (머신별, 센서별 따로)
------------------------------------------ */

// 주간 데이터 전체에서 특정 머신+센서에 대한 주차별 [정상, 이상] 집계
function getWeeklyMachineSensorData(weeklyData, machineName, sensorKey, machineLabel) {
  // weeklyData: { "Week_1": { MACHINE2: {...}, MACHINE3: {...} }, "Week_2": {...} } ...
  // machineName: "MACHINE2" 등
  // sensorKey: "MIC" 또는 "ACC"
  // machineLabel: 실제 표시 이름 (예: "Curing Oven" / "Hot Chamber" 등)

  const weeks = Object.keys(weeklyData).sort((a, b) => {
    // "Week_1", "Week_2" ... 숫자만 비교
    return parseInt(a.split('_')[1]) - parseInt(b.split('_')[1]);
  });

  let labels = [];        // X축 레이블 (Week_x)
  let normalCounts = [];  // 정상 처리 건수
  let anomalyCounts = []; // 이상 감지 건수

  weeks.forEach(weekKey => {
    const machinesObj = weeklyData[weekKey];
    if (!machinesObj) return;

    const machineData = machinesObj[machineName];
    if (!machineData) {
      // 해당 주에 해당 머신 데이터가 없으면 0 처리
      labels.push(weekKey);
      normalCounts.push(0);
      anomalyCounts.push(0);
      return;
    }

    // 예: MIC_processed, MIC_anomaly
    const processedKey = sensorKey + "_processed"; // "MIC_processed" or "ACC_processed"
    const anomalyKey = sensorKey + "_anomaly";     // "MIC_anomaly" or "ACC_anomaly"

    const normalVal = machineData[processedKey] || 0;
    const anomalyVal = machineData[anomalyKey] || 0;

    labels.push(weekKey);
    normalCounts.push(normalVal);
    anomalyCounts.push(anomalyVal);
  });

  return { labels, normalCounts, anomalyCounts };
}

// 차트를 그리는 공용 함수
function renderWeeklyChart(chartId, tableId, dataset, titleText) {
  // dataset = { labels: [...], normalCounts: [...], anomalyCounts: [...] }
  const ctx = document.getElementById(chartId);
  if (!ctx) return;

  // 혹시 이미 차트가 있으면 파괴
  if (charts[chartId]) {
    charts[chartId].destroy();
  }

  charts[chartId] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: dataset.labels,
      datasets: [
        {
          label: '정상',
          data: dataset.normalCounts,
          backgroundColor: chartColors.normal
        },
        {
          label: '이상',
          data: dataset.anomalyCounts,
          backgroundColor: chartColors.anomaly
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'top' },
        title: { display: false }
      },
      scales: {
        y: { beginAtZero: true }
      }
    }
  });

  // 차트 옆에 표시할 표(정상/이상 건수, 이상비율)
  const tableContainer = document.getElementById(tableId);
  if (tableContainer) {
    let html = `
      <table class="w-full text-left border-t border-b">
        <thead>
          <tr class="border-b">
            <th class="py-1">주차</th>
            <th class="py-1">정상</th>
            <th class="py-1">이상</th>
            <th class="py-1">이상 비율</th>
          </tr>
        </thead>
        <tbody>
    `;
    dataset.labels.forEach((weekLabel, i) => {
      const n = dataset.normalCounts[i] || 0;
      const a = dataset.anomalyCounts[i] || 0;
      const total = n + a;
      const ratio = total > 0 ? ((a / total) * 100).toFixed(1) + "%" : "-";
      html += `
        <tr class="border-b">
          <td class="py-1">${weekLabel}</td>
          <td class="py-1">${n}</td>
          <td class="py-1 text-red-500">${a}</td>
          <td class="py-1">${ratio}</td>
        </tr>
      `;
    });
    html += "</tbody></table>";
    tableContainer.innerHTML = html;
  }
}

function renderWeeklyCharts(data) {
  const weeklyData = data.weeklyData || {};

  // MACHINE2 -> Curing Oven, MACHINE3 -> Hot Chamber 라고 가정
  // (update_s3_counts.py의 MACHINE_NAMES 참고)
  const datasetCuringMic = getWeeklyMachineSensorData(weeklyData, "MACHINE2", "MIC", "Curing Oven");
  renderWeeklyChart(
    "weeklyChartCuringOvenMic",
    "weeklyTableCuringOvenMic",
    datasetCuringMic,
    "Curing Oven - MIC 주간"
  );

  const datasetCuringAcc = getWeeklyMachineSensorData(weeklyData, "MACHINE2", "ACC", "Curing Oven");
  renderWeeklyChart(
    "weeklyChartCuringOvenAcc",
    "weeklyTableCuringOvenAcc",
    datasetCuringAcc,
    "Curing Oven - ACC 주간"
  );

  const datasetHotMic = getWeeklyMachineSensorData(weeklyData, "MACHINE3", "MIC", "Hot Chamber");
  renderWeeklyChart(
    "weeklyChartHotChamberMic",
    "weeklyTableHotChamberMic",
    datasetHotMic,
    "Hot Chamber - MIC 주간"
  );

  const datasetHotAcc = getWeeklyMachineSensorData(weeklyData, "MACHINE3", "ACC", "Hot Chamber");
  renderWeeklyChart(
    "weeklyChartHotChamberAcc",
    "weeklyTableHotChamberAcc",
    datasetHotAcc,
    "Hot Chamber - ACC 주간"
  );
}

/* ------------------------------------------
   월별 차트 그리기 (머신별, 센서별 따로)
------------------------------------------ */

function getMonthlyMachineSensorData(monthlyData, machineName, sensorKey) {
  // monthlyData: { "2025-02": { MACHINE2: {...}, MACHINE3: {...} }, "2025-03": {...}, ... }
  const months = Object.keys(monthlyData).sort();

  let labels = [];
  let normalCounts = [];
  let anomalyCounts = [];

  months.forEach(monthKey => {
    const machinesObj = monthlyData[monthKey];
    if (!machinesObj) return;

    const machineData = machinesObj[machineName];
    if (!machineData) {
      labels.push(monthKey);
      normalCounts.push(0);
      anomalyCounts.push(0);
      return;
    }

    const processedKey = sensorKey + "_processed";
    const anomalyKey = sensorKey + "_anomaly";

    const n = machineData[processedKey] || 0;
    const a = machineData[anomalyKey] || 0;

    labels.push(monthKey);
    normalCounts.push(n);
    anomalyCounts.push(a);
  });

  return { labels, normalCounts, anomalyCounts };
}

function renderMonthlyChart(chartId, tableId, dataset, titleText) {
  const ctx = document.getElementById(chartId);
  if (!ctx) return;

  // 기존 차트 있으면 파괴
  if (charts[chartId]) {
    charts[chartId].destroy();
  }

  charts[chartId] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: dataset.labels,
      datasets: [
        {
          label: '정상',
          data: dataset.normalCounts,
          backgroundColor: chartColors.normal
        },
        {
          label: '이상',
          data: dataset.anomalyCounts,
          backgroundColor: chartColors.anomaly
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'top' },
        title: { display: false }
      },
      scales: {
        y: { beginAtZero: true }
      }
    }
  });

  // 표 표시
  const tableContainer = document.getElementById(tableId);
  if (tableContainer) {
    let html = `
      <table class="w-full text-left border-t border-b">
        <thead>
          <tr class="border-b">
            <th class="py-1">월</th>
            <th class="py-1">정상</th>
            <th class="py-1">이상</th>
            <th class="py-1">이상 비율</th>
          </tr>
        </thead>
        <tbody>
    `;
    dataset.labels.forEach((monthLabel, i) => {
      const n = dataset.normalCounts[i] || 0;
      const a = dataset.anomalyCounts[i] || 0;
      const total = n + a;
      const ratio = total > 0 ? ((a / total) * 100).toFixed(1) + "%" : "-";
      html += `
        <tr class="border-b">
          <td class="py-1">${monthLabel}</td>
          <td class="py-1">${n}</td>
          <td class="py-1 text-red-500">${a}</td>
          <td class="py-1">${ratio}</td>
        </tr>
      `;
    });
    html += "</tbody></table>";
    tableContainer.innerHTML = html;
  }
}

function renderMonthlyCharts(data) {
  const monthlyData = data.monthlyData || {};

  // Curing Oven - MIC
  const dataCuringMic = getMonthlyMachineSensorData(monthlyData, "MACHINE2", "MIC");
  renderMonthlyChart("monthlyChartCuringOvenMic", "monthlyTableCuringOvenMic", dataCuringMic, "Curing Oven - MIC 월별");

  // Curing Oven - ACC
  const dataCuringAcc = getMonthlyMachineSensorData(monthlyData, "MACHINE2", "ACC");
  renderMonthlyChart("monthlyChartCuringOvenAcc", "monthlyTableCuringOvenAcc", dataCuringAcc, "Curing Oven - ACC 월별");

  // Hot Chamber - MIC
  const dataHotMic = getMonthlyMachineSensorData(monthlyData, "MACHINE3", "MIC");
  renderMonthlyChart("monthlyChartHotChamberMic", "monthlyTableHotChamberMic", dataHotMic, "Hot Chamber - MIC 월별");

  // Hot Chamber - ACC
  const dataHotAcc = getMonthlyMachineSensorData(monthlyData, "MACHINE3", "ACC");
  renderMonthlyChart("monthlyChartHotChamberAcc", "monthlyTableHotChamberAcc", dataHotAcc, "Hot Chamber - ACC 월별");
}

// 자동 새로고침 (5분 간격)
function setupAutoRefresh() {
  setInterval(loadData, 5 * 60 * 1000);
}

document.addEventListener('DOMContentLoaded', function() {
  loadData();
  setupAutoRefresh();
});

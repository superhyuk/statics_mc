// 전역 폰트 설정
Chart.defaults.font.family = "'Pretendard', 'Noto Sans KR', sans-serif";
Chart.defaults.font.size = 13;

// 차트 색상 정의 (정상/이상)
const chartColors = {
  normal: 'rgba(54, 162, 235, 0.7)',  // 정상
  anomaly: 'rgba(255, 99, 132, 0.7)', // 이상
};

let charts = {};  // 만들어지는 차트를 저장할 객체들

/* ----------------------------------------------------
  [공통] 로딩 오버레이 제어
---------------------------------------------------- */
function showLoading() {
  const overlay = document.getElementById('loadingOverlay');
  if (overlay) {
    overlay.classList.remove('invisible', 'opacity-0');
    overlay.classList.add('visible', 'opacity-100');
  }
}
function hideLoading() {
  const overlay = document.getElementById('loadingOverlay');
  if (overlay) {
    overlay.classList.add('invisible', 'opacity-0');
    overlay.classList.remove('visible', 'opacity-100');
  }
}

/* ----------------------------------------------------
  [공통] 데이터 로드 및 대시보드 업데이트
---------------------------------------------------- */
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
  // 1) 오늘(최신) 데이터 표시
  updateTodayData(data);

  // 2) 주간 차트 (날짜범위 라벨)
  renderWeeklyCharts(data);

  // 3) 월별 차트
  renderMonthlyCharts(data);

  // 마지막 업데이트 시간
  const lastUpdatedEl = document.getElementById('lastUpdatedTime');
  if (lastUpdatedEl) {
    lastUpdatedEl.textContent = data.updated_at || '-';
  }
}

/* ----------------------------------------------------
  [1] 오늘(최신) 데이터
     - (A) 머신별 오늘 총합 (2단)
     - (B) 시간대별 테이블
---------------------------------------------------- */
function updateTodayData(data) {
  // DOM 요소들
  const summaryContainer = document.getElementById('todaySummary');
  const detailContainer  = document.getElementById('todayHourlyDetail');
  const titleEl          = document.getElementById('todayTitle');

  if (!summaryContainer || !detailContainer) return;

  // hourlyData에서 '오늘' 또는 '최신' 날짜 찾기
  const hourlyData = data.hourlyData || {};
  const todayStr = new Date().toISOString().slice(0,10).replace(/-/g, ''); // YYYYMMDD
  
  let entriesToday = Object.entries(hourlyData).filter(([k]) => k.startsWith(todayStr));

  // 오늘 데이터 없으면 가장 최신 날짜로 대체
  if (entriesToday.length === 0) {
    const allKeys = Object.keys(hourlyData).sort();
    if (allKeys.length > 0) {
      const latestDate = allKeys[allKeys.length - 1].substring(0,8); // "20250314"
      entriesToday = Object.entries(hourlyData).filter(([k]) => k.startsWith(latestDate));
    }
  }

  // 표시할 '일자' 추출
  let displayDate = todayStr;
  if (entriesToday.length > 0) {
    displayDate = entriesToday[0][0].substring(0,8); // 예: "20250314"
  }
  const formattedDate = formatDisplayDate(displayDate); // 예: "2025-03-14"

  // 타이틀 업데이트
  if (titleEl) {
    titleEl.textContent = `${formattedDate} 데이터`;
  }

  // (A) 머신별 오늘 총합
  const machineTotals = {};
  entriesToday.forEach(([hourKey, machinesObj]) => {
    Object.entries(machinesObj).forEach(([mId, countObj]) => {
      if (!machineTotals[mId]) {
        machineTotals[mId] = {
          MIC_processed: 0, MIC_anomaly: 0,
          ACC_processed: 0, ACC_anomaly: 0,
          display_name: countObj.display_name || mId
        };
      }
      machineTotals[mId].MIC_processed += (countObj.MIC_processed || 0);
      machineTotals[mId].MIC_anomaly  += (countObj.MIC_anomaly  || 0);
      machineTotals[mId].ACC_processed += (countObj.ACC_processed || 0);
      machineTotals[mId].ACC_anomaly  += (countObj.ACC_anomaly  || 0);
    });
  });

  summaryContainer.innerHTML = '';
  if (Object.keys(machineTotals).length === 0) {
    summaryContainer.innerHTML = `<div class="bg-white p-4 rounded shadow">해당 일자에 데이터가 없습니다.</div>`;
  } else {
    // 2단 레이아웃: grid grid-cols-1 md:grid-cols-2
    Object.entries(machineTotals).forEach(([mId, counts]) => {
      const micTotal = counts.MIC_processed + counts.MIC_anomaly;
      const accTotal = counts.ACC_processed + counts.ACC_anomaly;
      const micRate  = micTotal ? ((counts.MIC_anomaly / micTotal) * 100).toFixed(1) : 0;
      const accRate  = accTotal ? ((counts.ACC_anomaly / accTotal) * 100).toFixed(1) : 0;

      const card = document.createElement('div');
      card.className = "bg-white rounded-lg shadow p-4";
      card.innerHTML = `
        <h3 class="font-medium text-lg mb-2">${counts.display_name}</h3>
        <div class="text-sm mb-2">
          <span class="font-semibold text-blue-500">MIC:</span>
          정상 ${counts.MIC_processed}, 이상 ${counts.MIC_anomaly} (이상 ${micRate}%)
        </div>
        <div class="text-sm">
          <span class="font-semibold text-green-500">ACC:</span>
          정상 ${counts.ACC_processed}, 이상 ${counts.ACC_anomaly} (이상 ${accRate}%)
        </div>
      `;
      summaryContainer.appendChild(card);
    });
  }

  // (B) 시간대별 상세 테이블
  detailContainer.innerHTML = `<h3 class="font-semibold mb-4">${formattedDate} 시간대별 데이터</h3>`;
  let tableHTML = `
    <table class="w-full text-sm border-t border-b">
      <thead>
        <tr class="border-b bg-gray-50">
          <th class="py-2 px-2">시간</th>
          <th class="py-2 px-2">머신</th>
          <th class="py-2 px-2">MIC(정상/이상)</th>
          <th class="py-2 px-2">ACC(정상/이상)</th>
        </tr>
      </thead>
      <tbody>
  `;

  // 24시간(0~23) 순회
  for (let hour=0; hour<24; hour++) {
    const hh = String(hour).padStart(2, '0'); // 예: "09"
    const rowKey = displayDate + "_" + hh;    // "20250314_09"
    if (!hourlyData[rowKey]) continue;        // 해당 시간대 데이터 없으면 스킵

    const machinesObj = hourlyData[rowKey];
    const machineKeys = Object.keys(machinesObj);

    // "9-10시" 라벨 (hour-(hour+1))
    const hourLabel = `${hour} - ${hour+1}시`;

    machineKeys.forEach((mId, idx) => {
      const mc = machinesObj[mId];
      const micStr = `정상 ${mc.MIC_processed||0} / 이상 ${mc.MIC_anomaly||0}`;
      const accStr = `정상 ${mc.ACC_processed||0} / 이상 ${mc.ACC_anomaly||0}`;

      // 첫 머신일 때만 시간 셀 표시
      const timeCell = (idx === 0)
        ? `<td class="py-2 px-2 border-b align-top" rowspan="${machineKeys.length}">${hourLabel}</td>`
        : '';

      tableHTML += `
        <tr class="border-b">
          ${timeCell}
          <td class="py-2 px-2 border-b">${mc.display_name || mId}</td>
          <td class="py-2 px-2 border-b">${micStr}</td>
          <td class="py-2 px-2 border-b">${accStr}</td>
        </tr>
      `;
    });
  }

  tableHTML += `</tbody></table>`;
  detailContainer.innerHTML += tableHTML;
}

/* 날짜 문자열 변환 (YYYYMMDD -> YYYY-MM-DD) */
function formatDisplayDate(dateStr) {
  if (dateStr.length === 8) {
    const y = dateStr.substring(0,4);
    const m = dateStr.substring(4,6);
    const d = dateStr.substring(6,8);
    return `${y}-${m}-${d}`;
  }
  return dateStr;
}

/* ----------------------------------------------------
  [2] 주간 차트
      - Week_n -> 구체적인 날짜 (mm/dd ~ mm/dd) 로 변환
      - Curing Oven & Hot Chamber, MIC & ACC 각각 4개
---------------------------------------------------- */

// 주차 라벨을 날짜 범위로 변환 (Week_1 -> "2/19 ~ 2/25" 식)
function getWeekRangeLabel(weekKey, firstDateStr) {
  const match = weekKey.match(/Week_(\d+)/);
  if (!match) return weekKey; // 혹시나 weekKey가 다른 형식일 때

  const weekNum = parseInt(match[1], 10);

  // firstDateStr가 "20250101_000000" 이런 식
  const year = parseInt(firstDateStr.substring(0, 4), 10);
  const month = parseInt(firstDateStr.substring(4, 6), 10) - 1; // 자바스크립트 월(0~11)
  const day = parseInt(firstDateStr.substring(6, 8), 10);

  // 첫 데이터 날짜를 기준으로 (weekNum - 1) * 7 일 후 → 주차 시작
  const startDate = new Date(year, month, day);
  startDate.setDate(startDate.getDate() + (weekNum - 1) * 7);

  // 끝은 startDate + 6일
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 6);

  const startLabel = `${startDate.getMonth()+1}/${startDate.getDate()}`;
  const endLabel   = `${endDate.getMonth()+1}/${endDate.getDate()}`;
  return `${startLabel} ~ ${endLabel}`;
}

// 특정 머신+센서 주간 데이터 추출
function getWeeklyMachineSensorData(weeklyData, machineName, sensorKey) {
  const weeks = Object.keys(weeklyData).sort((a,b)=>{
    // Week_1, Week_2 -> 숫자 비교
    const wA = parseInt(a.split('_')[1] || "0");
    const wB = parseInt(b.split('_')[1] || "0");
    return wA - wB;
  });

  let labels = [];
  let normalCounts = [];
  let anomalyCounts = [];

  weeks.forEach(weekKey => {
    const machineObj = weeklyData[weekKey][machineName];
    if (!machineObj) {
      // 데이터가 없으면 0
      labels.push(weekKey);
      normalCounts.push(0);
      anomalyCounts.push(0);
      return;
    }
    const procKey = sensorKey + "_processed"; // MIC_processed or ACC_processed
    const anomKey = sensorKey + "_anomaly";   // MIC_anomaly or ACC_anomaly

    labels.push(weekKey);
    normalCounts.push(machineObj[procKey] || 0);
    anomalyCounts.push(machineObj[anomKey] || 0);
  });

  return { labels, normalCounts, anomalyCounts };
}

// 주간 차트 렌더링 + 표
function renderWeeklyChart(chartId, tableId, dataset) {
  const ctx = document.getElementById(chartId);
  if (!ctx) return;

  // 이미 있다면 차트 제거
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

  // 표 생성 (주차별 정상/이상/이상비율)
  const tableContainer = document.getElementById(tableId);
  if (tableContainer) {
    let html = `
      <table class="w-full text-left border-t border-b text-sm">
        <thead>
          <tr class="border-b bg-gray-50">
            <th class="py-1 px-2">주차</th>
            <th class="py-1 px-2">정상</th>
            <th class="py-1 px-2">이상</th>
            <th class="py-1 px-2">이상 비율</th>
          </tr>
        </thead>
        <tbody>
    `;
    dataset.labels.forEach((lbl, i) => {
      const n = dataset.normalCounts[i] || 0;
      const a = dataset.anomalyCounts[i] || 0;
      const total = n + a;
      const ratio = total ? ((a/total)*100).toFixed(1)+'%' : '-';
      html += `
        <tr class="border-b">
          <td class="py-1 px-2">${lbl}</td>
          <td class="py-1 px-2">${n}</td>
          <td class="py-1 px-2 text-red-500">${a}</td>
          <td class="py-1 px-2">${ratio}</td>
        </tr>
      `;
    });
    html += `</tbody></table>`;
    tableContainer.innerHTML = html;
  }
}

function renderWeeklyCharts(data) {
  const weeklyData = data.weeklyData || {};
  const firstDateStr = data.first_date || "20250101_000000";

  // Curing Oven - MIC
  const dsCuringMic = getWeeklyMachineSensorData(weeklyData, "MACHINE2", "MIC");
  // 주차 라벨을 실제 날짜로 변환
  dsCuringMic.labels = dsCuringMic.labels.map(weekKey => getWeekRangeLabel(weekKey, firstDateStr));
  renderWeeklyChart("weeklyChartCuringOvenMic", "weeklyTableCuringOvenMic", dsCuringMic);

  // Curing Oven - ACC
  const dsCuringAcc = getWeeklyMachineSensorData(weeklyData, "MACHINE2", "ACC");
  dsCuringAcc.labels = dsCuringAcc.labels.map(weekKey => getWeekRangeLabel(weekKey, firstDateStr));
  renderWeeklyChart("weeklyChartCuringOvenAcc", "weeklyTableCuringOvenAcc", dsCuringAcc);

  // Hot Chamber - MIC
  const dsHotMic = getWeeklyMachineSensorData(weeklyData, "MACHINE3", "MIC");
  dsHotMic.labels = dsHotMic.labels.map(weekKey => getWeekRangeLabel(weekKey, firstDateStr));
  renderWeeklyChart("weeklyChartHotChamberMic", "weeklyTableHotChamberMic", dsHotMic);

  // Hot Chamber - ACC
  const dsHotAcc = getWeeklyMachineSensorData(weeklyData, "MACHINE3", "ACC");
  dsHotAcc.labels = dsHotAcc.labels.map(weekKey => getWeekRangeLabel(weekKey, firstDateStr));
  renderWeeklyChart("weeklyChartHotChamberAcc", "weeklyTableHotChamberAcc", dsHotAcc);
}

/* ----------------------------------------------------
  [3] 월별 차트
      - Curing Oven & Hot Chamber, MIC & ACC 각각 4개
---------------------------------------------------- */

// 특정 머신+센서 월별 데이터 추출
function getMonthlyMachineSensorData(monthlyData, machineName, sensorKey) {
  const months = Object.keys(monthlyData).sort();
  let labels = [];
  let normalCounts = [];
  let anomalyCounts = [];

  months.forEach(mKey => {
    const machineObj = monthlyData[mKey][machineName];
    if (!machineObj) {
      labels.push(mKey);
      normalCounts.push(0);
      anomalyCounts.push(0);
      return;
    }
    const procKey = sensorKey + "_processed";
    const anomKey = sensorKey + "_anomaly";

    labels.push(mKey);
    normalCounts.push(machineObj[procKey] || 0);
    anomalyCounts.push(machineObj[anomKey] || 0);
  });

  return { labels, normalCounts, anomalyCounts };
}

// 월별 차트 렌더링 + 표
function renderMonthlyChart(chartId, tableId, dataset) {
  const ctx = document.getElementById(chartId);
  if (!ctx) return;

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

  // 표 생성
  const tableContainer = document.getElementById(tableId);
  if (tableContainer) {
    let html = `
      <table class="w-full text-left border-t border-b text-sm">
        <thead>
          <tr class="border-b bg-gray-50">
            <th class="py-1 px-2">월</th>
            <th class="py-1 px-2">정상</th>
            <th class="py-1 px-2">이상</th>
            <th class="py-1 px-2">이상 비율</th>
          </tr>
        </thead>
        <tbody>
    `;
    dataset.labels.forEach((lbl, i) => {
      const n = dataset.normalCounts[i] || 0;
      const a = dataset.anomalyCounts[i] || 0;
      const total = n + a;
      const ratio = total ? ((a/total)*100).toFixed(1)+"%" : '-';
      html += `
        <tr class="border-b">
          <td class="py-1 px-2">${lbl}</td>
          <td class="py-1 px-2">${n}</td>
          <td class="py-1 px-2 text-red-500">${a}</td>
          <td class="py-1 px-2">${ratio}</td>
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
  const dsCuringMic = getMonthlyMachineSensorData(monthlyData, "MACHINE2", "MIC");
  renderMonthlyChart("monthlyChartCuringOvenMic", "monthlyTableCuringOvenMic", dsCuringMic);

  // Curing Oven - ACC
  const dsCuringAcc = getMonthlyMachineSensorData(monthlyData, "MACHINE2", "ACC");
  renderMonthlyChart("monthlyChartCuringOvenAcc", "monthlyTableCuringOvenAcc", dsCuringAcc);

  // Hot Chamber - MIC
  const dsHotMic = getMonthlyMachineSensorData(monthlyData, "MACHINE3", "MIC");
  renderMonthlyChart("monthlyChartHotChamberMic", "monthlyTableHotChamberMic", dsHotMic);

  // Hot Chamber - ACC
  const dsHotAcc = getMonthlyMachineSensorData(monthlyData, "MACHINE3", "ACC");
  renderMonthlyChart("monthlyChartHotChamberAcc", "monthlyTableHotChamberAcc", dsHotAcc);
}

/* ----------------------------------------------------
   [4] 페이지 로드 시 자동 호출
---------------------------------------------------- */
function setupAutoRefresh() {
  setInterval(loadData, 5 * 60 * 1000); // 5분마다
}

document.addEventListener('DOMContentLoaded', function() {
  loadData();
  setupAutoRefresh();
});

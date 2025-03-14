// Chart.js 전역 폰트 설정
Chart.defaults.font.family = "'Pretendard', 'Noto Sans KR', sans-serif";
Chart.defaults.font.size = 13;

// 차트 색상 테마 단순화 - MIC와 ACC 구분
const chartColors = {
  mic: {
    normal: 'rgba(54, 162, 235, 0.5)',
    anomaly: 'rgba(255, 99, 132, 0.5)',
    normalBorder: 'rgba(54, 162, 235, 1)',
    anomalyBorder: 'rgba(255, 99, 132, 1)'
  },
  acc: {
    normal: 'rgba(75, 192, 192, 0.5)',
    anomaly: 'rgba(255, 159, 64, 0.5)',
    normalBorder: 'rgba(75, 192, 192, 1)',
    anomalyBorder: 'rgba(255, 159, 64, 1)'
  }
};

// 차트 객체 저장
let charts = {
  weeklyChart: null,
  monthlyChart: null
};

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
  console.log("Dashboard update started");
  try {
    updateTodayData(data);
    updateWeeklyData(data);
    updateMonthlyData(data);
    
    const lastUpdatedEl = document.getElementById('lastUpdatedTime');
    if (lastUpdatedEl) {
      lastUpdatedEl.textContent = data.updated_at || '-';
    }
  } catch (error) {
    console.error("Dashboard update error:", error);
  }
}

function updateTodayData(data) {
  const container = document.getElementById('todayData');
  if (!container) {
    console.error('Error: #todayData element not found');
    return;
  }
  
  const hourlyData = data.hourlyData || {};
  const today = new Date().toISOString().slice(0,10).replace(/-/g, '');
  const todayEntries = Object.entries(hourlyData).filter(([key]) => key.startsWith(today));
  
  // 오늘 데이터가 없다면 최근 날짜의 데이터 사용
  const allDates = Object.keys(hourlyData).sort();
  const latestDate = allDates.length > 0 ? allDates[allDates.length - 1].substring(0, 8) : today;
  const entries = todayEntries.length > 0 ? todayEntries : 
                  Object.entries(hourlyData).filter(([key]) => key.startsWith(latestDate));
  
  const machineData = {};

  entries.forEach(([hour, machines]) => {
    Object.entries(machines).forEach(([machine, counts]) => {
      if (!machineData[machine]) {
        machineData[machine] = {
          MIC_anomaly: 0,
          MIC_processed: 0,
          ACC_anomaly: 0,
          ACC_processed: 0
        };
      }
      Object.keys(counts).forEach(key => {
        machineData[machine][key] += counts[key];
      });
    });
  });

  container.innerHTML = '';
  
  if (Object.keys(machineData).length === 0) {
    container.innerHTML = '<div class="col-span-full text-center py-6 bg-white rounded-lg shadow">오늘 수집된 데이터가 없습니다.</div>';
    return;
  }

  Object.entries(machineData).forEach(([machine, counts]) => {
    const micTotal = counts.MIC_processed + counts.MIC_anomaly;
    const accTotal = counts.ACC_processed + counts.ACC_anomaly;
    const micAnomalyRate = micTotal > 0 ? (counts.MIC_anomaly / micTotal * 100).toFixed(1) : 0;
    const accAnomalyRate = accTotal > 0 ? (counts.ACC_anomaly / accTotal * 100).toFixed(1) : 0;
    
    const machineDiv = document.createElement('div');
    machineDiv.className = "bg-white rounded-lg shadow p-4";
    machineDiv.innerHTML = `
      <h3 class="font-semibold text-lg mb-3 pb-2 border-b">${machine}</h3>
      <div class="grid grid-cols-2 gap-4">
        <div>
          <h4 class="font-medium text-blue-600 mb-2">MIC 센서</h4>
          <div class="flex justify-between mb-1">
            <span class="text-sm">정상 처리:</span>
            <span class="font-medium">${counts.MIC_processed.toLocaleString()}</span>
          </div>
          <div class="flex justify-between mb-1">
            <span class="text-sm">이상 감지:</span>
            <span class="font-medium text-red-500">${counts.MIC_anomaly.toLocaleString()}</span>
          </div>
          <div class="mt-2 bg-gray-200 rounded-full h-2.5">
            <div class="bg-red-500 h-2.5 rounded-full" style="width: ${micAnomalyRate}%"></div>
          </div>
          <div class="text-xs text-right mt-1">이상 비율: ${micAnomalyRate}%</div>
        </div>
        <div>
          <h4 class="font-medium text-green-600 mb-2">ACC 센서</h4>
          <div class="flex justify-between mb-1">
            <span class="text-sm">정상 처리:</span>
            <span class="font-medium">${counts.ACC_processed.toLocaleString()}</span>
          </div>
          <div class="flex justify-between mb-1">
            <span class="text-sm">이상 감지:</span>
            <span class="font-medium text-red-500">${counts.ACC_anomaly.toLocaleString()}</span>
          </div>
          <div class="mt-2 bg-gray-200 rounded-full h-2.5">
            <div class="bg-red-500 h-2.5 rounded-full" style="width: ${accAnomalyRate}%"></div>
          </div>
          <div class="text-xs text-right mt-1">이상 비율: ${accAnomalyRate}%</div>
        </div>
      </div>
    `;
    container.appendChild(machineDiv);
  });
}

function updateWeeklyData(data) {
  const weeklyData = data.weeklyData || {};
  const weeklyContainer = document.getElementById('weeklyData');
  
  if (!weeklyContainer) {
    console.error('Error: #weeklyData element not found');
    return;
  }
  
  // 주별 데이터가 없으면 메시지 표시
  if (Object.keys(weeklyData).length === 0) {
    weeklyContainer.innerHTML = '<div class="bg-white rounded-lg shadow p-4 text-center">주별 데이터가 없습니다.</div>';
    return;
  }
  
  weeklyContainer.innerHTML = `
    <div class="bg-white rounded-lg shadow p-4">
      <h3 class="font-semibold text-lg mb-4">주별 데이터 추이</h3>
      <div class="chart-container">
        <canvas id="weeklyChart"></canvas>
      </div>
    </div>
  `;
  
  // 첫 날짜 가져오기
  const firstDate = data.first_date || "";
  const firstDateTime = firstDate ? new Date(
    parseInt(firstDate.substring(0, 4)),
    parseInt(firstDate.substring(4, 6)) - 1,
    parseInt(firstDate.substring(6, 8))
  ) : new Date();
  
  const weeks = Object.keys(weeklyData).sort();
  
  // 주별 날짜 범위 계산
  const weekLabels = weeks.map(week => {
    const weekNum = parseInt(week.split('_')[1]);
    const weekStart = new Date(firstDateTime);
    weekStart.setDate(weekStart.getDate() + (weekNum - 1) * 7);
    
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    
    return `${weekStart.getMonth()+1}/${weekStart.getDate()} - ${weekEnd.getMonth()+1}/${weekEnd.getDate()}`;
  });
  
  // 데이터셋 준비 - 구분되고 간결한 형식
  const datasets = [];
  
  // 단순화된 구조 - 기기별, 센서별로 합산
  const machines = new Set();
  weeks.forEach(week => {
    Object.keys(weeklyData[week]).forEach(machine => machines.add(machine));
  });
  
  // 각 머신별로 차트 데이터 생성
  machines.forEach(machine => {
    // MIC 센서 데이터
    datasets.push({
      label: `${machine} - MIC 정상`,
      data: weeks.map(week => weeklyData[week][machine]?.MIC_processed || 0),
      backgroundColor: chartColors.mic.normal,
      borderColor: chartColors.mic.normalBorder,
      borderWidth: 1
    });
    
    datasets.push({
      label: `${machine} - MIC 이상`,
      data: weeks.map(week => weeklyData[week][machine]?.MIC_anomaly || 0),
      backgroundColor: chartColors.mic.anomaly,
      borderColor: chartColors.mic.anomalyBorder,
      borderWidth: 1
    });
    
    // ACC 센서 데이터
    datasets.push({
      label: `${machine} - ACC 정상`,
      data: weeks.map(week => weeklyData[week][machine]?.ACC_processed || 0),
      backgroundColor: chartColors.acc.normal,
      borderColor: chartColors.acc.normalBorder,
      borderWidth: 1
    });
    
    datasets.push({
      label: `${machine} - ACC 이상`,
      data: weeks.map(week => weeklyData[week][machine]?.ACC_anomaly || 0),
      backgroundColor: chartColors.acc.anomaly,
      borderColor: chartColors.acc.anomalyBorder,
      borderWidth: 1
    });
  });
  
  // 이전 차트 제거
  if (charts.weeklyChart) {
    charts.weeklyChart.destroy();
  }
  
  // 새 차트 생성
  const ctx = document.getElementById('weeklyChart');
  if (ctx) {
    charts.weeklyChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: weekLabels,
        datasets: datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
            labels: {
              boxWidth: 12,
              font: {
                size: 11
              }
            }
          },
          title: {
            display: false
          }
        },
        scales: {
          y: {
            beginAtZero: true
          }
        }
      }
    });
  } else {
    console.error("Weekly chart canvas not found");
  }
}

function updateMonthlyData(data) {
  const monthlyData = data.monthlyData || {};
  const monthlyContainer = document.getElementById('monthlyData');
  
  if (!monthlyContainer) {
    console.error('Error: #monthlyData element not found');
    return;
  }
  
  // 월별 데이터가 없으면 메시지 표시
  if (Object.keys(monthlyData).length === 0) {
    monthlyContainer.innerHTML = '<div class="bg-white rounded-lg shadow p-4 text-center">월별 데이터가 없습니다.</div>';
    return;
  }
  
  monthlyContainer.innerHTML = `
    <div class="bg-white rounded-lg shadow p-4">
      <h3 class="font-semibold text-lg mb-4">월별 데이터</h3>
      <div class="chart-container">
        <canvas id="monthlyChart"></canvas>
      </div>
    </div>
  `;
  
  const months = Object.keys(monthlyData).sort();
  
  // 간단한 월 이름 포맷
  const monthLabels = months.map(month => {
    const [year, m] = month.split('-');
    return `${year}년 ${m}월`;
  });
  
  // 기기 식별
  const machines = new Set();
  months.forEach(month => {
    Object.keys(monthlyData[month]).forEach(machine => machines.add(machine));
  });
  
  // 데이터셋 준비 - 구분되고 간결한 형식
  const datasets = [];
  
  // 각 머신별로 차트 데이터 생성
  machines.forEach(machine => {
    // MIC 센서 데이터
    datasets.push({
      label: `${machine} - MIC 정상`,
      data: months.map(month => monthlyData[month][machine]?.MIC_processed || 0),
      backgroundColor: chartColors.mic.normal,
      borderColor: chartColors.mic.normalBorder,
      borderWidth: 1
    });
    
    datasets.push({
      label: `${machine} - MIC 이상`,
      data: months.map(month => monthlyData[month][machine]?.MIC_anomaly || 0),
      backgroundColor: chartColors.mic.anomaly,
      borderColor: chartColors.mic.anomalyBorder,
      borderWidth: 1
    });
    
    // ACC 센서 데이터
    datasets.push({
      label: `${machine} - ACC 정상`,
      data: months.map(month => monthlyData[month][machine]?.ACC_processed || 0),
      backgroundColor: chartColors.acc.normal,
      borderColor: chartColors.acc.normalBorder,
      borderWidth: 1
    });
    
    datasets.push({
      label: `${machine} - ACC 이상`,
      data: months.map(month => monthlyData[month][machine]?.ACC_anomaly || 0),
      backgroundColor: chartColors.acc.anomaly,
      borderColor: chartColors.acc.anomalyBorder,
      borderWidth: 1
    });
  });
  
  // 이전 차트 제거
  if (charts.monthlyChart) {
    charts.monthlyChart.destroy();
  }
  
  // 새 차트 생성 - 히스토그램으로 변경
  const ctx = document.getElementById('monthlyChart');
  if (ctx) {
    charts.monthlyChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: monthLabels,
        datasets: datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
            labels: {
              boxWidth: 12,
              font: {
                size: 11
              }
            }
          },
          title: {
            display: false
          }
        },
        scales: {
          y: {
            beginAtZero: true
          }
        }
      }
    });
  } else {
    console.error("Monthly chart canvas not found");
  }
}

// 자동 새로고침 (5분마다)
function setupAutoRefresh() {
  setInterval(loadData, 5 * 60 * 1000);
}

// 문서 로드 후 초기화
document.addEventListener('DOMContentLoaded', function() {
  console.log("DOM fully loaded");
  loadData();
  setupAutoRefresh();
});
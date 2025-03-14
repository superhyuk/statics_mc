// Chart.js 전역 폰트 설정
Chart.defaults.font.family = "'Pretendard', 'Noto Sans KR', sans-serif";
Chart.defaults.font.size = 13;

// 차트 색상 테마
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
  document.getElementById('loadingOverlay').classList.remove('invisible', 'opacity-0');
  document.getElementById('loadingOverlay').classList.add('visible', 'opacity-100');
}

function hideLoading() {
  document.getElementById('loadingOverlay').classList.add('invisible', 'opacity-0');
  document.getElementById('loadingOverlay').classList.remove('visible', 'opacity-100');
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
  updateTodayData(data);
  updateWeeklyData(data);
  updateMonthlyData(data);
  document.getElementById('lastUpdatedTime').textContent = data.updated_at || '-';
}

function updateTodayData(data) {
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

  const container = document.getElementById('todayData');
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
  
  // 주별 데이터가 없으면 메시지 표시
  if (Object.keys(weeklyData).length === 0) {
    weeklyContainer.innerHTML = '<div class="bg-white rounded-lg shadow p-4 text-center">주별 데이터가 없습니다.</div>';
    return;
  }
  
  weeklyContainer.innerHTML = `
    <div class="bg-white rounded-lg shadow p-4">
      <h3 class="font-semibold text-lg mb-4">주별 데이터 추이</h3>
      <canvas id="weeklyChart" height="300"></canvas>
    </div>
  `;
  
  const weeks = Object.keys(weeklyData).sort();
  const datasets = [];
  const machines = new Set();
  
  // 모든 기기 식별
  weeks.forEach(week => {
    Object.keys(weeklyData[week]).forEach(machine => machines.add(machine));
  });
  
  machines.forEach(machine => {
    // MIC 정상 데이터
    datasets.push({
      label: `${machine} - MIC 정상`,
      data: weeks.map(week => weeklyData[week][machine]?.MIC_processed || 0),
      backgroundColor: chartColors.mic.normal,
      borderColor: chartColors.mic.normalBorder,
      borderWidth: 1
    });
    
    // MIC 이상 데이터
    datasets.push({
      label: `${machine} - MIC 이상`,
      data: weeks.map(week => weeklyData[week][machine]?.MIC_anomaly || 0),
      backgroundColor: chartColors.mic.anomaly,
      borderColor: chartColors.mic.anomalyBorder,
      borderWidth: 1
    });
    
    // ACC 정상 데이터
    datasets.push({
      label: `${machine} - ACC 정상`,
      data: weeks.map(week => weeklyData[week][machine]?.ACC_processed || 0),
      backgroundColor: chartColors.acc.normal,
      borderColor: chartColors.acc.normalBorder,
      borderWidth: 1
    });
    
    // ACC 이상 데이터
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
  const ctx = document.getElementById('weeklyChart').getContext('2d');
  charts.weeklyChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: weeks,
      datasets: datasets
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          position: 'top',
        },
        title: {
          display: true,
          text: '주별 데이터 분석'
        }
      },
      scales: {
        y: {
          beginAtZero: true
        }
      }
    }
  });
}

function updateMonthlyData(data) {
  const monthlyData = data.monthlyData || {};
  const monthlyContainer = document.getElementById('monthlyData');
  
  // 월별 데이터가 없으면 메시지 표시
  if (Object.keys(monthlyData).length === 0) {
    monthlyContainer.innerHTML = '<div class="bg-white rounded-lg shadow p-4 text-center">월별 데이터가 없습니다.</div>';
    return;
  }
  
  monthlyContainer.innerHTML = `
    <div class="bg-white rounded-lg shadow p-4">
      <h3 class="font-semibold text-lg mb-4">월별 이상 감지 비율</h3>
      <canvas id="monthlyChart" height="300"></canvas>
    </div>
  `;
  
  const months = Object.keys(monthlyData).sort();
  const machines = new Set();
  
  // 모든 기기 식별
  months.forEach(month => {
    Object.keys(monthlyData[month]).forEach(machine => machines.add(machine));
  });
  
  const datasets = [];
  
  machines.forEach(machine => {
    // MIC 이상 비율
    const micAnomalyRateData = months.map(month => {
      const machineData = monthlyData[month][machine] || { MIC_anomaly: 0, MIC_processed: 0 };
      const total = machineData.MIC_anomaly + machineData.MIC_processed;
      return total > 0 ? (machineData.MIC_anomaly / total * 100) : 0;
    });
    
    datasets.push({
      label: `${machine} - MIC 이상 비율 (%)`,
      data: micAnomalyRateData,
      borderColor: chartColors.mic.anomalyBorder,
      backgroundColor: chartColors.mic.anomaly,
      fill: false,
      tension: 0.1
    });
    
    // ACC 이상 비율
    const accAnomalyRateData = months.map(month => {
      const machineData = monthlyData[month][machine] || { ACC_anomaly: 0, ACC_processed: 0 };
      const total = machineData.ACC_anomaly + machineData.ACC_processed;
      return total > 0 ? (machineData.ACC_anomaly / total * 100) : 0;
    });
    
    datasets.push({
      label: `${machine} - ACC 이상 비율 (%)`,
      data: accAnomalyRateData,
      borderColor: chartColors.acc.anomalyBorder,
      backgroundColor: chartColors.acc.anomaly,
      fill: false,
      tension: 0.1
    });
  });
  
  // 이전 차트 제거
  if (charts.monthlyChart) {
    charts.monthlyChart.destroy();
  }
  
  // 새 차트 생성
  const ctx = document.getElementById('monthlyChart').getContext('2d');
  charts.monthlyChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: months.map(month => {
        const [year, m] = month.split('-');
        return `${year}년 ${m}월`;
      }),
      datasets: datasets
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          position: 'top',
        },
        title: {
          display: true,
          text: '월별 이상 감지 비율 추이'
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          max: 100,
          title: {
            display: true,
            text: '이상 감지 비율 (%)'
          }
        }
      }
    }
  });
}

// 자동 새로고침 (5분마다)
function setupAutoRefresh() {
  setInterval(loadData, 5 * 60 * 1000);
}

window.addEventListener('DOMContentLoaded', () => {
  loadData();
  setupAutoRefresh();
});
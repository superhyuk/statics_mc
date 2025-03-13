// Chart.js 전역 폰트 설정
Chart.defaults.font.family = "'Pretendard', 'Noto Sans KR', sans-serif";
Chart.defaults.font.size = 13;

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
  const today = new Date().toISOString().slice(0,10).replace(/-/g, '');

  const hourlyData = data.hourlyData;
  const todayData = Object.entries(hourlyData).filter(([key]) => key.startsWith(today));

  const machineSummary = {};

  todayEntries = today ? Object.entries(data.hourlyData).filter(([hour, _]) => hour.startsWith(today.replace(/-/g, ''))) : [];

  todayEntries.forEach(([hour, machines]) => {
    Object.entries(machines).forEach(([machine, counts]) => {
      if (!machineData[machine]) {
        machineData[machine] = {MIC_anomaly:0,MIC_processed:0,ACC_anomaly:0,ACC_processed:0};
      }
      Object.keys(counts).forEach(key => {
        machineData[machine][key] += counts[key];
      });
    });
  });

  const container = document.getElementById('machineData');
  container.innerHTML = '';

  Object.entries(machineData).forEach(([machine, counts]) => {
    const machineDiv = document.createElement('div');
    machineDiv.className = "bg-white rounded shadow p-4";
    machineDiv.innerHTML = `
      <h3 class="font-semibold text-lg mb-2">${machine}</h3>
      <ul class="text-sm space-y-1">
        <li>MIC 이상 감지: ${counts.MIC_anomaly}</li>
        <li>MIC 정상 처리: ${counts.MIC_processed}</li>
        <li>ACC 이상 감지: ${counts.ACC_anomaly}</li>
        <li>ACC 정상 처리: ${counts.ACC_processed}</li>
      </ul>
    `;
    document.getElementById('machineData').appendChild(machineDiv);
  });

  document.getElementById('lastUpdatedTime').textContent = data.updated_at;
}

window.addEventListener('DOMContentLoaded', loadData);

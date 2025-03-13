// Chart.js 전역 폰트 설정
Chart.defaults.font.family = "'Pretendard', 'Noto Sans KR', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";
Chart.defaults.font.size = 13;
Chart.defaults.color = '#505050';

// 차트의 제목 폰트 설정
Chart.defaults.plugins.title.font = {
  family: "'Pretendard', 'Noto Sans KR', sans-serif",
  size: 15,
  weight: '600'
};

// 차트 축 폰트 설정
Chart.defaults.scales.x.ticks.font = {
  family: "'Pretendard', 'Noto Sans KR', sans-serif",
  size: 12
};
Chart.defaults.scales.y.ticks.font = {
  family: "'Pretendard', 'Noto Sans KR', sans-serif",
  size: 12
};

// 전역 변수
let sampleData = null;
let histogramChart = null;
let trendChart = null;

// 날짜/시간 포맷 유틸 함수
function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatTime(h, m, s = 0) {
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}${s ? ':' + String(s).padStart(2, '0') : ''}`;
}

function formatDateTime(date) {
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일 ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

// 로딩 오버레이 제어
function showLoading() {
  const overlay = document.getElementById('loadingOverlay');
  overlay.classList.add('opacity-100', 'visible');
  overlay.classList.remove('opacity-0', 'invisible');
}

function hideLoading() {
  const overlay = document.getElementById('loadingOverlay');
  overlay.classList.add('opacity-0', 'invisible');
  overlay.classList.remove('opacity-100', 'visible');
}

// 샘플 데이터 생성 (예시 데이터)
function generateSampleData() {
  const now = new Date();
  const todayDetails = [];
  
  function generateFilename(date, type, status) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const h = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');
    const s = String(date.getSeconds()).padStart(2, '0');
    const rand = Math.random().toString(36).substring(2, 6);
    return `${y}${m}${d}_${h}${min}${s}_${rand}.json`;
  }
  
  for (let h = 0; h < 24; h++) {
    const isBusinessHour = h >= 9 && h < 18;
    const count = isBusinessHour ? Math.floor(Math.random() * 50) + 30 : Math.floor(Math.random() * 20) + 5;
    for (let i = 0; i < count; i++) {
      const sec = Math.floor(Math.random() * 3600);
      const min = Math.floor(sec / 60);
      const rem = sec % 60;
      const type = Math.random() > 0.4 ? 'MIC' : 'ACC';
      const status = Math.random() > 0.85 ? 'anomaly' : 'normal';
      const date = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, min, rem);
      todayDetails.push({
        hour: h,
        minute: min,
        second: rem,
        type,
        status,
        time: formatTime(h, min, rem),
        timestamp: date.toISOString(),
        filename: generateFilename(date, type, status)
      });
    }
  }
  
  const hourlyData = {
    all: Array(24).fill(0),
    mic: Array(24).fill(0),
    acc: Array(24).fill(0),
    normal: Array(24).fill(0),
    anomaly: Array(24).fill(0)
  };
  
  todayDetails.forEach(item => {
    hourlyData.all[item.hour]++;
    if (item.type === 'MIC') {
      hourlyData.mic[item.hour]++;
    } else {
      hourlyData.acc[item.hour]++;
    }
    if (item.status === 'normal') {
      hourlyData.normal[item.hour]++;
    } else {
      hourlyData.anomaly[item.hour]++;
    }
  });
  
  const dailyData = [];
  for (let i = 13; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = formatDate(date);
    const micNormal = Math.floor(Math.random() * 700) + 400;
    const micAnomaly = Math.floor(micNormal * (Math.random() * 0.1 + 0.05));
    const accNormal = Math.floor(Math.random() * 500) + 300;
    const accAnomaly = Math.floor(accNormal * (Math.random() * 0.1 + 0.05));
    dailyData.push({
      date: dateStr,
      mic: { normal: micNormal, anomaly: micAnomaly, total: micNormal + micAnomaly },
      acc: { normal: accNormal, anomaly: accAnomaly, total: accNormal + accAnomaly },
      total: micNormal + micAnomaly + accNormal + accAnomaly
    });
  }
  
  const weeklyData = [];
  for (let i = 9; i >= 0; i--) {
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - (i * 7 + 6));
    const weekNum = Math.floor((weekStart.getDate() - 1) / 7) + 1;
    const monthName = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'][weekStart.getMonth()];
    const weekLabel = `${monthName} ${weekNum}주`;
    const micNormal = Math.floor(Math.random() * 2000) + 1500;
    const micAnomaly = Math.floor(micNormal * (Math.random() * 0.1 + 0.05));
    const accNormal = Math.floor(Math.random() * 1500) + 1000;
    const accAnomaly = Math.floor(accNormal * (Math.random() * 0.1 + 0.05));
    weeklyData.push({
      week: weekLabel,
      startDate: formatDate(weekStart),
      mic: { normal: micNormal, anomaly: micAnomaly, total: micNormal + micAnomaly },
      acc: { normal: accNormal, anomaly: accAnomaly, total: accNormal + accAnomaly },
      total: micNormal + micAnomaly + accNormal + accAnomaly
    });
  }
  
  const monthlyData = [];
  for (let i = 5; i >= 0; i--) {
    const monthDate = new Date();
    monthDate.setMonth(monthDate.getMonth() - i);
    const monthName = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'][monthDate.getMonth()];
    const micNormal = Math.floor(Math.random() * 8000) + 6000;
    const micAnomaly = Math.floor(micNormal * (Math.random() * 0.1 + 0.05));
    const accNormal = Math.floor(Math.random() * 6000) + 4000;
    const accAnomaly = Math.floor(accNormal * (Math.random() * 0.1 + 0.05));
    monthlyData.push({
      month: monthName,
      date: `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`,
      mic: { normal: micNormal, anomaly: micAnomaly, total: micNormal + micAnomaly },
      acc: { normal: accNormal, anomaly: accAnomaly, total: accNormal + accAnomaly },
      total: micNormal + micAnomaly + accNormal + accAnomaly
    });
  }
  
  return {
    updated_at: new Date(),
    today: formatDate(new Date()),
    todayDetails,
    hourlyData,
    summary: {
      total: dailyData.reduce((sum, day) => sum + day.total, 0),
      mic: {
        total: dailyData.reduce((sum, day) => sum + day.mic.total, 0),
        normal: dailyData.reduce((sum, day) => sum + day.mic.normal, 0),
        anomaly: dailyData.reduce((sum, day) => sum + day.mic.anomaly, 0)
      },
      acc: {
        total: dailyData.reduce((sum, day) => sum + day.acc.total, 0),
        normal: dailyData.reduce((sum, day) => sum + day.acc.normal, 0),
        anomaly: dailyData.reduce((sum, day) => sum + day.acc.anomaly, 0)
      },
      anomaly: dailyData.reduce((sum, day) => sum + day.mic.anomaly + day.acc.anomaly, 0)
    },
    dailyData,
    weeklyData,
    monthlyData
  };
}

function init() {
  showLoading();

  const today = new Date();
  document.getElementById('dateSelect').value = formatDate(today);
  document.getElementById('hourSelect').value = today.getHours();

  // 동적으로 시간 옵션 생성 (0~23)
  const hourSelect = document.getElementById('hourSelect');
  for (let i = 0; i < 24; i++) {
    const option = document.createElement('option');
    option.value = i;
    option.textContent = i.toString().padStart(2, '0') + ":00 - " + i.toString().padStart(2, '0') + ":59";
    hourSelect.appendChild(option);
  }

  sampleData = generateSampleData();
  updateDashboard();
  setupEventListeners();

  hideLoading();
}

function updateDashboard() {
  updateSummaryStats();
  updateHistogram();
  updateTimelineView();
  updateTrendChart();
  updateDailySummary();
  document.getElementById('lastUpdatedTime').textContent = formatDateTime(sampleData.updated_at);
}

function updateSummaryStats() {
  const s = sampleData.summary;
  document.getElementById('totalCount').textContent = s.total;
  document.getElementById('micCount').textContent = s.mic.total;
  document.getElementById('accCount').textContent = s.acc.total;
  document.getElementById('anomalyCount').textContent = s.anomaly;
}

function updateHistogram() {
  const ctx = document.getElementById('histogramChart').getContext('2d');
  if (histogramChart) histogramChart.destroy();

  const activeButton = document.querySelector('#histogramTypeFilter button.active');
  const chartType = activeButton.getAttribute('data-type');
  const data = sampleData.hourlyData;

  let datasets = [];
  if (chartType === 'total') {
    datasets = [{
      label: '전체 데이터',
      data: data.all,
      backgroundColor: 'rgba(37,99,235,0.7)'
    }];
  } else if (chartType === 'dataType') {
    datasets = [
      { label: 'MIC', data: data.mic, backgroundColor: 'rgba(37,99,235,0.7)' },
      { label: 'ACC', data: data.acc, backgroundColor: 'rgba(245,158,11,0.7)' }
    ];
  } else if (chartType === 'status') {
    datasets = [
      { label: '정상', data: data.normal, backgroundColor: 'rgba(16,185,129,0.7)' },
      { label: '이상 감지', data: data.anomaly, backgroundColor: 'rgba(239,68,68,0.7)' }
    ];
  }

  histogramChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: Array.from({ length: 24 }, (_, i) => i + '시'),
      datasets
    },
    options: { responsive: true }
  });
}

function updateTimelineView() {
  const selectedHour = document.getElementById('hourSelect').value;
  let filtered = sampleData.todayDetails;
  if (selectedHour !== 'all') {
    filtered = filtered.filter(item => item.hour == selectedHour);
  }
  updateHourSummary(filtered);
  updateTimelineTrack(filtered, selectedHour);
  updateDetailTable(filtered);
}

function updateHourSummary(data) {
  const total = data.length;
  const mic = data.filter(item => item.type === 'MIC').length;
  const acc = data.filter(item => item.type === 'ACC').length;
  const normal = data.filter(item => item.status === 'normal').length;
  const anomaly = data.filter(item => item.status === 'anomaly').length;

  document.getElementById('hourTotalCount').textContent = total;
  document.getElementById('hourMicCount').textContent = mic;
  document.getElementById('hourAccCount').textContent = acc;
  document.getElementById('hourNormalCount').textContent = normal;
  document.getElementById('hourAnomalyCount').textContent = anomaly;
}

function updateTimelineTrack(data, selectedHour) {
  const track = document.getElementById('timelineTrack');
  const scale = document.getElementById('timelineScale');
  track.innerHTML = '';
  scale.innerHTML = '';

  if (selectedHour === 'all') {
    for (let h = 0; h < 24; h += 2) {
      const tick = document.createElement('div');
      tick.className = 'timeline-tick';
      tick.style.left = (h / 24 * 100) + '%';
      track.appendChild(tick);

      const label = document.createElement('div');
      label.className = 'text-xs text-gray-400 absolute';
      label.style.left = (h / 24 * 100) + '%';
      label.style.transform = 'translateX(-50%)';
      label.textContent = `${h}:00`;
      scale.appendChild(label);
    }
    data.forEach(item => {
      const marker = document.createElement('div');
      marker.className = `timeline-marker ${item.status}`;
      const pos = ((item.hour * 3600 + item.minute * 60 + item.second) / 86400) * 100;
      marker.style.left = pos + '%';
      track.appendChild(marker);
    });
  } else {
    for (let m = 0; m <= 59; m += 10) {
      const tick = document.createElement('div');
      tick.className = 'timeline-tick';
      tick.style.left = (m / 60 * 100) + '%';
      track.appendChild(tick);

      const label = document.createElement('div');
      label.className = 'text-xs text-gray-400 absolute';
      label.style.left = (m / 60 * 100) + '%';
      label.style.transform = 'translateX(-50%)';
      label.textContent = `${selectedHour}:${String(m).padStart(2, '0')}`;
      scale.appendChild(label);
    }
    data.forEach(item => {
      const marker = document.createElement('div');
      marker.className = `timeline-marker ${item.status}`;
      const pos = ((item.minute * 60 + item.second) / 3600) * 100;
      marker.style.left = pos + '%';
      track.appendChild(marker);
    });
  }
}

function updateDetailTable(data) {
  const tbody = document.getElementById('detailData');
  tbody.innerHTML = '';

  const dataType = document.getElementById('dataTypeFilter').value;
  const status = document.getElementById('statusFilter').value;

  let filtered = [...data];
  if (dataType !== 'all') filtered = filtered.filter(item => item.type === dataType);
  if (status !== 'all') filtered = filtered.filter(item => item.status === status);

  filtered.sort((a, b) => {
    if (a.hour !== b.hour) return a.hour - b.hour;
    if (a.minute !== b.minute) return a.minute - b.minute;
    return a.second - b.second;
  });

  if (filtered.length === 0) {
    const row = document.createElement('tr');
    row.innerHTML = `<td colspan="4" class="text-center text-gray-500 py-2">데이터가 없습니다.</td>`;
    tbody.appendChild(row);
  } else {
    filtered.forEach(item => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td class="p-2 border-b text-gray-700">${item.time}</td>
        <td class="p-2 border-b"><span class="badge ${item.type === 'MIC' ? 'badge-mic' : 'badge-acc'}">${item.type}</span></td>
        <td class="p-2 border-b"><span class="badge ${item.status === 'normal' ? 'badge-normal' : 'badge-anomaly'}">${item.status === 'normal' ? '정상' : '이상 감지'}</span></td>
        <td class="p-2 border-b text-gray-700">${item.filename}</td>
      `;
      tbody.appendChild(row);
    });
  }
}

function updateTrendChart() {
  const ctx = document.getElementById('trendChart').getContext('2d');
  if (trendChart) trendChart.destroy();

  const activePeriodTab = document.querySelector('#trendPeriodFilter button.active');
  const period = activePeriodTab.getAttribute('data-period');

  let chartData, labels;
  if (period === 'day') {
    chartData = sampleData.dailyData.slice(-7);
    labels = chartData.map(d => d.date.substr(5));
  } else if (period === 'week') {
    chartData = sampleData.weeklyData.slice(-8);
    labels = chartData.map(d => d.week);
  } else {
    chartData = sampleData.monthlyData;
    labels = chartData.map(d => d.month);
  }

  const normalData = chartData.map(d => d.mic.normal + d.acc.normal);
  const anomalyData = chartData.map(d => d.mic.anomaly + d.acc.anomaly);

  trendChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: '정상', data: normalData, backgroundColor: 'rgba(16,185,129,0.7)', stack: 'stack0' },
        { label: '이상 감지', data: anomalyData, backgroundColor: 'rgba(239,68,68,0.7)', stack: 'stack0' }
      ]
    },
    options: {
      responsive: true,
      scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true } }
    }
  });
}

function updateDailySummary() {
  const tableBody = document.getElementById('dailySummary');
  tableBody.innerHTML = '';

  const recentData = sampleData.dailyData.slice(-7);
  recentData.forEach(day => {
    // MIC 데이터 행
    const micRow = document.createElement('tr');
    micRow.innerHTML = `
      <td class="p-2 border-b">${day.date}</td>
      <td class="p-2 border-b"><span class="badge badge-mic">MIC</span></td>
      <td class="p-2 border-b">${day.mic.normal}</td>
      <td class="p-2 border-b">${day.mic.anomaly}</td>
      <td class="p-2 border-b">${day.mic.total}</td>
    `;
    tableBody.appendChild(micRow);

    // ACC 데이터 행
    const accRow = document.createElement('tr');
    accRow.innerHTML = `
      <td class="p-2 border-b">${day.date}</td>
      <td class="p-2 border-b"><span class="badge badge-acc">ACC</span></td>
      <td class="p-2 border-b">${day.acc.normal}</td>
      <td class="p-2 border-b">${day.acc.anomaly}</td>
      <td class="p-2 border-b">${day.acc.total}</td>
    `;
    tableBody.appendChild(accRow);
  });
}

function setupEventListeners() {
  document.getElementById('histogramDateFilter').addEventListener('change', updateHistogram);
  document.querySelectorAll('#histogramTypeFilter button').forEach(btn => {
    btn.addEventListener('click', function() {
      document.querySelectorAll('#histogramTypeFilter button').forEach(b => b.classList.remove('active', 'bg-blue-600', 'text-white'));
      this.classList.add('active', 'bg-blue-600', 'text-white');
      updateHistogram();
    });
  });

  document.getElementById('dateSelect').addEventListener('change', updateTimelineView);
  document.getElementById('hourSelect').addEventListener('change', updateTimelineView);
  document.getElementById('dataTypeFilter').addEventListener('change', () => updateDetailTable(getFilteredData()));
  document.getElementById('statusFilter').addEventListener('change', () => updateDetailTable(getFilteredData()));

  document.querySelectorAll('#trendPeriodFilter button').forEach(btn => {
    btn.addEventListener('click', function() {
      document.querySelectorAll('#trendPeriodFilter button').forEach(b => b.classList.remove('active', 'bg-blue-600', 'text-white'));
      this.classList.add('active', 'bg-blue-600', 'text-white');
      updateTrendChart();
    });
  });
}

function getFilteredData() {
  const selectedHour = document.getElementById('hourSelect').value;
  let filtered = sampleData.todayDetails;
  if (selectedHour !== 'all') {
    filtered = filtered.filter(item => item.hour == selectedHour);
  }
  return filtered;
}

window.addEventListener('load', init);

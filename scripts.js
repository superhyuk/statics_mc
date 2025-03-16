// 전역 폰트 설정
const MACHINE_NAMES = {
  "MACHINE2": "CURING_OVEN(#UNIT1)",
  "MACHINE3": "HOT CHAMBER(#UNIT2)"
};

let charts = {};  // 기존 Chart.js 관련 변수 (더 이상 사용하지 않을 수 있음)

/* --------------------------------------------------
   로딩 오버레이
-------------------------------------------------- */
function showLoading(){
  const ov = document.getElementById('loadingOverlay');
  if(ov){
    ov.classList.remove('invisible','opacity-0');
    ov.classList.add('visible','opacity-100');
  }
}
function hideLoading(){
  const ov = document.getElementById('loadingOverlay');
  if(ov){
    ov.classList.add('invisible','opacity-0');
    ov.classList.remove('visible','opacity-100');
  }
}

/* --------------------------------------------------
   데이터 로드 & 대시보드 업데이트
-------------------------------------------------- */
async function loadData(){
  showLoading();
  try {
    const resp = await fetch('data_counts.json');
    const data = await resp.json();
    updateDashboard(data);
  } catch(err) {
    console.error("데이터 로드 실패:", err);
  } finally {
    hideLoading();
  }
}

function updateDashboard(data){
  // (1) 이전 1시간 데이터
  renderRecentHour(data);
  // (1-B) 오늘(24시간) 총집계
  renderTodayDailySummary(data);
  // (2) 24시간 상세 데이터
  renderTodayHourCards(data);
  // (3) 일자 플롯 카드 (JSON의 dailyPlot 사용)
  renderDailyPlotCards(data);
  // (4) 주간 플롯 카드 (JSON의 weeklyPlots 사용)
  renderWeeklyPlotCards(data);
  // (5) 월별 플롯 카드 (JSON의 monthlyPlot 사용)
  renderMonthlyPlotCards(data);

  // 마지막 업데이트 시간
  const lastUp = document.getElementById('lastUpdatedTime');
  if(lastUp){
    lastUp.textContent = data.updated_at || '-';
  }
}

/* --------------------------------------------------
   (1) 이전 1시간 데이터 렌더링
-------------------------------------------------- */
function renderRecentHour(data){
  const container = document.getElementById('recentHourSummary');
  const titleEl = document.getElementById('recentHourTitle');
  if(!container || !titleEl) return;
  container.innerHTML = '';

  const hourlyData = data.hourlyData || {};
  const hourKeys = Object.keys(hourlyData).sort();
  if(!hourKeys.length){
    titleEl.textContent = "이전 1시간 (데이터 없음)";
    return;
  }
  const latestKey = hourKeys[hourKeys.length - 1];
  const prevIndex = hourKeys.length - 2;
  if(prevIndex < 0){
    titleEl.textContent = "이전 1시간 데이터 없음(기록이 너무 적음)";
    return;
  }
  const prevHourKey = hourKeys[prevIndex];
  const baseDate = prevHourKey.substring(0,8);
  const hourStr = prevHourKey.substring(9,11);
  const h = parseInt(hourStr, 10);
  const yyyy = baseDate.substring(0,4);
  const mm = baseDate.substring(4,6);
  const dd = baseDate.substring(6,8);
  titleEl.textContent = `${yyyy}.${mm}.${dd} ${h}:00 ~ ${h+1}:00 (이전 1시간)`;

  const mchObj = hourlyData[prevHourKey];
  if(!mchObj || !Object.keys(mchObj).length){
    container.innerHTML = `<div class="card text-gray-500">이전1시간(${prevHourKey}) 데이터 없음</div>`;
    return;
  }
  const mchKeys = Object.keys(mchObj).sort();
  mchKeys.forEach(mId => {
    const c = mchObj[mId];
    const micTotal = (c.MIC_processed || 0) + (c.MIC_anomaly || 0);
    const accTotal = (c.ACC_processed || 0) + (c.ACC_anomaly || 0);
    const micRate = micTotal ? ((c.MIC_anomaly || 0) / micTotal * 100).toFixed(1) : 0;
    const accRate = accTotal ? ((c.ACC_anomaly || 0) / accTotal * 100).toFixed(1) : 0;

    const card = document.createElement('div');
    card.className = "card";
    card.innerHTML = `
      <h3 class="font-medium text-lg mb-2">${c.display_name || MACHINE_NAMES[mId] || mId}</h3>
      <div class="text-sm mb-1">
        <span class="font-semibold text-blue-500">MIC:</span>
        <span class="text-normal">정상 ${c.MIC_processed || 0}</span>
        / <span class="text-anomaly">이상 ${c.MIC_anomaly || 0}</span>
        (이상 ${micRate}%)
      </div>
      <div class="text-sm">
        <span class="font-semibold text-green-500">ACC:</span>
        <span class="text-normal">정상 ${c.ACC_processed || 0}</span>
        / <span class="text-anomaly">이상 ${c.ACC_anomaly || 0}</span>
        (이상 ${accRate}%)
      </div>
    `;
    container.appendChild(card);
  });
}

/* --------------------------------------------------
   (1-B) 오늘(24시간) 총집계 렌더링
-------------------------------------------------- */
function renderTodayDailySummary(data){
  const container = document.getElementById('todayDailySummary');
  if(!container) return;
  container.innerHTML = '';

  const dailyTotals = getTodayMachineTotals(data);
  if(!Object.keys(dailyTotals.totals).length){
    container.innerHTML = `<div class="card text-gray-500">오늘(24시간) 데이터 없음</div>`;
    return;
  }
  const dateStr = dailyTotals.displayDate;
  const heading = document.createElement('div');
  heading.className = "col-span-full mb-2 text-md font-bold text-gray-800";
  heading.textContent = `${dateStr} 총집계`;
  container.appendChild(heading);

  Object.entries(dailyTotals.totals).forEach(([mId, obj]) => {
    const micTotal = obj.MIC_processed + obj.MIC_anomaly;
    const accTotal = obj.ACC_processed + obj.ACC_anomaly;
    const micRate = micTotal ? ((obj.MIC_anomaly || 0) / micTotal * 100).toFixed(1) : 0;
    const accRate = accTotal ? ((obj.ACC_anomaly || 0) / accTotal * 100).toFixed(1) : 0;

    const card = document.createElement('div');
    card.className = "card";
    card.innerHTML = `
      <h3 class="font-medium text-lg mb-2">${obj.display_name || MACHINE_NAMES[mId] || mId}</h3>
      <div class="text-sm mb-1">
        <span class="font-semibold text-blue-500">MIC:</span>
        <span class="text-normal">정상 ${obj.MIC_processed}</span>
        / <span class="text-anomaly">이상 ${obj.MIC_anomaly}</span>
        (이상 ${micRate}%)
      </div>
      <div class="text-sm">
        <span class="font-semibold text-green-500">ACC:</span>
        <span class="text-normal">정상 ${obj.ACC_processed}</span>
        / <span class="text-anomaly">이상 ${obj.ACC_anomaly}</span>
        (이상 ${accRate}%)
      </div>
    `;
    container.appendChild(card);
  });
}

function getTodayMachineTotals(data){
  const hourlyData = data.hourlyData || {};
  const keys = Object.keys(hourlyData).sort();
  if(!keys.length){
    return { displayDate:"-", totals:{} };
  }
  const latest = keys[keys.length-1];
  const baseDate = latest.substring(0,8);
  const displayDate = `${baseDate.substring(0,4)}.${baseDate.substring(4,6)}.${baseDate.substring(6,8)}`;
  const totals = {};
  for(let h=0; h<24; h++){
    const hh = String(h).padStart(2,'0');
    const hourKey = `${baseDate}_${hh}`;
    const mchObj = hourlyData[hourKey];
    if(!mchObj) continue;
    Object.entries(mchObj).forEach(([mId,c]) => {
      if(!totals[mId]){
        totals[mId] = {
          MIC_processed:0, MIC_anomaly:0,
          ACC_processed:0, ACC_anomaly:0,
          display_name: c.display_name || MACHINE_NAMES[mId] || mId
        };
      }
      totals[mId].MIC_processed += c.MIC_processed || 0;
      totals[mId].MIC_anomaly  += c.MIC_anomaly || 0;
      totals[mId].ACC_processed += c.ACC_processed || 0;
      totals[mId].ACC_anomaly  += c.ACC_anomaly || 0;
    });
  }
  return { displayDate, totals };
}

/* --------------------------------------------------
   (2) 24시간 상세 데이터 카드 렌더링
-------------------------------------------------- */
function renderTodayHourCards(data){
  const container = document.getElementById('todayHourCards');
  if(!container) return;
  container.innerHTML = '';

  const hourlyData = data.hourlyData || {};
  const hKeys = Object.keys(hourlyData).sort();
  if(!hKeys.length){
    container.innerHTML = `<div class="text-gray-500">데이터 없음</div>`;
    return;
  }
  const latest = hKeys[hKeys.length-1];
  const baseDate = latest.substring(0,8);

  for(let h=0; h<24; h++){
    const hh = String(h).padStart(2,'0');
    const hourKey = `${baseDate}_${hh}`;
    const mo = hourlyData[hourKey] || {};
    const label = `${h}-${h+1}시`;

    const detail = document.createElement('details');
    detail.className = "group card";

    let innerHtml = `
      <summary class="flex items-center font-semibold text-blue-600 gap-1 cursor-pointer mb-2">
        <svg class="w-4 h-4 rotate-90" fill="none" stroke="currentColor" stroke-width="2"
             viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round">
          <path d="M9 5l7 7-7 7"></path>
        </svg>
        ${label}
      </summary>
    `;

    let content = ``;
    const mchKeys = Object.keys(mo).sort();
    if(!mchKeys.length){
      content += `<div class="text-sm text-gray-400">데이터 없음</div>`;
    } else {
      mchKeys.forEach(mId => {
        const c = mo[mId];
        content += `
          <div class="border-t pt-2 mt-2 text-sm">
            <div class="font-medium mb-1">${c.display_name || MACHINE_NAMES[mId] || mId}</div>
            <div class="mb-1">
              <span class="font-semibold text-blue-500">MIC:</span>
              <span class="text-normal">정상 ${c.MIC_processed || 0}</span>
              / <span class="text-anomaly">이상 ${c.MIC_anomaly || 0}</span>
            </div>
            <div>
              <span class="font-semibold text-green-500">ACC:</span>
              <span class="text-normal">정상 ${c.ACC_processed || 0}</span>
              / <span class="text-anomaly">이상 ${c.ACC_anomaly || 0}</span>
            </div>
          </div>
        `;
      });
    }
    innerHtml += `<div class="mt-2">${content}</div>`;
    detail.innerHTML = innerHtml;
    container.appendChild(detail);
  }
}

/* --------------------------------------------------
   (3) 일자 플롯 카드 렌더링 (JSON의 dailyPlot 사용)
-------------------------------------------------- */
function renderDailyPlotCards(data){
  const container = document.getElementById('dailyPlotCards');
  if(!container) return;
  container.innerHTML = '';

  const dailyPlot = data.dailyPlot;
  if(!dailyPlot || Object.keys(dailyPlot).length === 0){
    container.innerHTML = `<div class="card text-gray-500">일자 플롯 데이터가 없습니다.</div>`;
    return;
  }
  // dailyPlot 구조: { machine_id: "경로" }
  Object.keys(dailyPlot).forEach(machineId => {
    const card = document.createElement('div');
    card.className = "card";
    const title = document.createElement('h3');
    title.className = "font-bold text-lg mb-2";
    // machine_info 매핑 적용 (JSON 내 machine_info 사용)
    const displayName = data.machine_info && data.machine_info[machineId] 
                          ? data.machine_info[machineId].display_name 
                          : MACHINE_NAMES[machineId] || machineId;
    title.textContent = displayName + " 일자 플롯";
    card.appendChild(title);

    const img = document.createElement('img');
    img.src = dailyPlot[machineId];
    img.alt = displayName + " 일자 플롯";
    img.className = "w-full h-auto";
    card.appendChild(img);

    container.appendChild(card);
  });
}

/* --------------------------------------------------
   (4) 주간 플롯 카드 렌더링 (JSON의 weeklyPlots 사용)
-------------------------------------------------- */
function renderWeeklyPlotCards(data){
  const container = document.getElementById('weeklyPlotCards');
  if(!container) return;
  container.innerHTML = '';

  const weeklyPlots = data.weeklyPlots;
  if(!weeklyPlots || Object.keys(weeklyPlots).length === 0){
    container.innerHTML = `<div class="card text-gray-500">주간 플롯 데이터가 없습니다.</div>`;
    return;
  }
  // weeklyPlots 구조: { Week_X: { machine_id: { MIC: 경로, ACC: 경로 } } }
  Object.keys(weeklyPlots).sort((a, b) => {
    return parseInt(a.split('_')[1]) - parseInt(b.split('_')[1]);
  }).forEach(weekKey => {
    const weekCard = document.createElement('div');
    weekCard.className = "card bg-gray-50";
    const header = document.createElement('h3');
    header.className = "font-bold text-lg mb-2";
    header.textContent = weekKey;
    weekCard.appendChild(header);

    const machines = weeklyPlots[weekKey];
    for (const machineId in machines) {
      const machineCard = document.createElement('div');
      machineCard.className = "mb-4";
      const displayName = data.machine_info && data.machine_info[machineId]
                          ? data.machine_info[machineId].display_name
                          : MACHINE_NAMES[machineId] || machineId;
      const machineHeader = document.createElement('h4');
      machineHeader.className = "font-semibold text-md mb-1";
      machineHeader.textContent = displayName;
      machineCard.appendChild(machineHeader);

      const sensorContainer = document.createElement('div');
      sensorContainer.className = "grid grid-cols-1 md:grid-cols-2 gap-4";
      const sensors = machines[machineId];
      for (const sensor in sensors) {
        const sensorCard = document.createElement('div');
        sensorCard.className = "card";
        const sensorTitle = document.createElement('div');
        sensorTitle.className = "font-medium mb-1";
        sensorTitle.textContent = sensor + " 플롯";
        sensorCard.appendChild(sensorTitle);

        const img = document.createElement('img');
        img.src = sensors[sensor];
        img.alt = displayName + " " + sensor + " 플롯";
        img.className = "w-full h-auto";
        sensorCard.appendChild(img);

        sensorContainer.appendChild(sensorCard);
      }
      machineCard.appendChild(sensorContainer);
      weekCard.appendChild(machineCard);
    }
    container.appendChild(weekCard);
  });
}

/* --------------------------------------------------
   (5) 월별 플롯 카드 렌더링 (JSON의 monthlyPlot 사용)
-------------------------------------------------- */
function renderMonthlyPlotCards(data){
  const container = document.getElementById('monthlyPlotCards');
  if(!container) return;
  container.innerHTML = '';

  const monthlyPlot = data.monthlyPlot;
  if(!monthlyPlot || Object.keys(monthlyPlot).length === 0){
    container.innerHTML = `<div class="card text-gray-500">월별 플롯 데이터가 없습니다.</div>`;
    return;
  }
  // monthlyPlot 구조: { machine_id: "경로" }
  Object.keys(monthlyPlot).forEach(machineId => {
    const card = document.createElement('div');
    card.className = "card";
    const title = document.createElement('h3');
    title.className = "font-bold text-lg mb-2";
    const displayName = data.machine_info && data.machine_info[machineId]
                          ? data.machine_info[machineId].display_name
                          : MACHINE_NAMES[machineId] || machineId;
    title.textContent = displayName + " 월별 플롯";
    card.appendChild(title);

    const img = document.createElement('img');
    img.src = monthlyPlot[machineId];
    img.alt = displayName + " 월별 플롯";
    img.className = "w-full h-auto";
    card.appendChild(img);

    container.appendChild(card);
  });
}

/* --------------------------------------------------
   자동 새로고침 (5분)
-------------------------------------------------- */
function setupAutoRefresh(){
  setInterval(loadData, 5 * 60 * 1000);
}

document.addEventListener('DOMContentLoaded', () => {
  loadData();
  setupAutoRefresh();
});

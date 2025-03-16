// Chart 기본 설정
Chart.defaults.font.family = "'Pretendard', 'Noto Sans KR', sans-serif";
Chart.defaults.font.size = 13;

// 색상 설정 (막대는 기존대로, 선은 여기서 설정)
const chartColors = {
  barNormal: 'rgba(54,162,235,0.7)',
  barAnomaly: 'rgba(255,99,132,0.7)',
  // 선: 각 머신별로 2개 선 (MIC, ACC)
  m2Mic: 'rgba(54,162,235,1)',
  m2Acc: 'rgba(75,192,192,1)',
  m3Mic: 'rgba(255,159,64,1)',
  m3Acc: 'rgba(255,99,132,1)'
};

let charts = {};

/* -------------------------
   Helper: Machine ID 정렬
-------------------------- */
function sortMachineIds(keys) {
  const order = ["MACHINE2", "MACHINE3"];
  return keys.sort((a, b) => {
    const iA = order.indexOf(a);
    const iB = order.indexOf(b);
    if(iA === -1 && iB === -1) return a.localeCompare(b);
    if(iA === -1) return 1;
    if(iB === -1) return -1;
    return iA - iB;
  });
}

/* -------------------------
   로딩 오버레이 토글
-------------------------- */
function showLoading() {
  const ov = document.getElementById("loadingOverlay");
  if(ov) {
    ov.classList.remove("invisible", "opacity-0");
    ov.classList.add("visible", "opacity-100");
  }
}
function hideLoading() {
  const ov = document.getElementById("loadingOverlay");
  if(ov) {
    ov.classList.add("invisible", "opacity-0");
    ov.classList.remove("visible", "opacity-100");
  }
}

/* -------------------------
   데이터 로드 및 대시보드 업데이트
-------------------------- */
async function loadData() {
  showLoading();
  try {
    const resp = await fetch("data_counts.json");
    const data = await resp.json();
    updateDashboard(data);
  } catch (err) {
    console.error("데이터 로드 실패:", err);
  } finally {
    hideLoading();
  }
}

function updateDashboard(data) {
  renderRecentHour(data);
  renderTodayDailySummary(data);
  renderTodayHistograms(data);
  renderTodayHourCards(data);
  renderWeeklyCharts(data);
  renderWeeklyDayBreakdown(data);
  renderMonthlyCharts(data);

  const lastUpdated = document.getElementById("lastUpdatedTime");
  if(lastUpdated) {
    lastUpdated.textContent = data.updated_at || "-";
  }
}

/* -------------------------
   (1) 이전 1시간
-------------------------- */
function renderRecentHour(data) {
  const container = document.getElementById("recentHourSummary");
  const titleEl = document.getElementById("recentHourTitle");
  if(!container || !titleEl) return;
  container.innerHTML = "";

  const hourlyData = data.hourlyData || {};
  const hourKeys = Object.keys(hourlyData).sort();
  if(!hourKeys.length) {
    titleEl.textContent = "이전 1시간 (데이터 없음)";
    return;
  }
  const latestKey = hourKeys[hourKeys.length - 1];
  const prevIndex = hourKeys.length - 2;
  if(prevIndex < 0) {
    titleEl.textContent = "이전 1시간 (기록 부족)";
    return;
  }
  const prevHourKey = hourKeys[prevIndex];
  const baseDate = prevHourKey.substring(0,8);
  const hh = prevHourKey.substring(9,11);
  const h = parseInt(hh,10);
  const yyyy = baseDate.substring(0,4);
  const mm = baseDate.substring(4,6);
  const dd = baseDate.substring(6,8);
  titleEl.textContent = `${yyyy}.${mm}.${dd} ${h}:00~${h+1}:00 (이전 1시간)`;

  const mchObj = hourlyData[prevHourKey];
  if(!mchObj || !Object.keys(mchObj).length) {
    container.innerHTML = `<div class="card-base text-gray-500">데이터 없음</div>`;
    return;
  }
  const mchKeys = sortMachineIds(Object.keys(mchObj));
  mchKeys.forEach(mId => {
    const c = mchObj[mId];
    const micSum = (c.MIC_processed||0) + (c.MIC_anomaly||0);
    const accSum = (c.ACC_processed||0) + (c.ACC_anomaly||0);
    const micRate = micSum ? ((c.MIC_anomaly||0) / micSum * 100) : 0;
    const accRate = accSum ? ((c.ACC_anomaly||0) / accSum * 100) : 0;
    const card = document.createElement("div");
    card.className = "card-base";
    card.innerHTML = `
      <h3 class="card-title">${c.display_name || mId}</h3>
      <div class="card-text mb-1">
        <span class="text-label text-blue-500">MIC:</span>
        <span class="text-normal">정상 ${c.MIC_processed||0}</span>
        / <span class="text-anomaly">이상 ${c.MIC_anomaly||0}</span>
        (이상 ${micRate.toFixed(1)}%)
      </div>
      <div class="card-text">
        <span class="text-label text-green-500">ACC:</span>
        <span class="text-normal">정상 ${c.ACC_processed||0}</span>
        / <span class="text-anomaly">이상 ${c.ACC_anomaly||0}</span>
        (이상 ${accRate.toFixed(1)}%)
      </div>
    `;
    container.appendChild(card);
  });
}

/* -------------------------
   (1-B) 오늘(24시간) 총집계
-------------------------- */
function renderTodayDailySummary(data) {
  const container = document.getElementById("todayDailySummary");
  if(!container) return;
  container.innerHTML = "";
  const totalsObj = getTodayMachineTotals(data);
  if(!Object.keys(totalsObj.totals).length) {
    container.innerHTML = `<div class="card-base text-gray-500">오늘(24시간) 데이터 없음</div>`;
    return;
  }
  const dateStr = totalsObj.displayDate;
  const heading = document.createElement("div");
  heading.className = "col-span-full mb-2 text-md font-bold text-gray-800";
  heading.textContent = `${dateStr} 총집계`;
  container.appendChild(heading);
  Object.entries(totalsObj.totals).forEach(([mId, obj]) => {
    const micSum = obj.MIC_processed + obj.MIC_anomaly;
    const accSum = obj.ACC_processed + obj.ACC_anomaly;
    const micRate = micSum ? (obj.MIC_anomaly / micSum * 100) : 0;
    const accRate = accSum ? (obj.ACC_anomaly / accSum * 100) : 0;
    const card = document.createElement("div");
    card.className = "card-base";
    card.innerHTML = `
      <h3 class="card-title">${obj.display_name || mId}</h3>
      <div class="card-text mb-1">
        <span class="text-label text-blue-500">MIC:</span>
        <span class="text-normal">정상 ${obj.MIC_processed}</span>
        / <span class="text-anomaly">이상 ${obj.MIC_anomaly}</span>
        (이상 ${micRate.toFixed(1)}%)
      </div>
      <div class="card-text">
        <span class="text-label text-green-500">ACC:</span>
        <span class="text-normal">정상 ${obj.ACC_processed}</span>
        / <span class="text-anomaly">이상 ${obj.ACC_anomaly}</span>
        (이상 ${accRate.toFixed(1)}%)
      </div>
    `;
    container.appendChild(card);
  });
}
function getTodayMachineTotals(data) {
  const hourlyData = data.hourlyData || {};
  const keys = Object.keys(hourlyData).sort();
  if(!keys.length) {
    return { displayDate:"-", totals:{} };
  }
  const latest = keys[keys.length - 1];
  const baseDate = latest.substring(0,8);
  const displayDate = baseDateToDot(baseDate);
  const totals = {};
  for(let h = 0; h < 24; h++){
    const hh = String(h).padStart(2, "0");
    const key = `${baseDate}_${hh}`;
    if(!hourlyData[key]) continue;
    Object.entries(hourlyData[key]).forEach(([mId, c]) => {
      if(!totals[mId]) {
        totals[mId] = {
          MIC_processed: 0, MIC_anomaly: 0,
          ACC_processed: 0, ACC_anomaly: 0,
          display_name: c.display_name || mId
        };
      }
      totals[mId].MIC_processed += (c.MIC_processed || 0);
      totals[mId].MIC_anomaly  += (c.MIC_anomaly || 0);
      totals[mId].ACC_processed += (c.ACC_processed || 0);
      totals[mId].ACC_anomaly  += (c.ACC_anomaly || 0);
    });
  }
  return { displayDate, totals };
}
function baseDateToDot(baseDate) {
  const y = baseDate.substring(0,4);
  const m = baseDate.substring(4,6);
  const d = baseDate.substring(6,8);
  return `${y}.${m}.${d}`;
}

/* -------------------------
   (2) 오늘(24시간) 히스토그램 (기존)
-------------------------- */
function renderTodayHistograms(data) {
  const titleEl = document.getElementById("todayTitle");
  const hourlyData = data.hourlyData || {};
  const keys = Object.keys(hourlyData).sort();
  if(!keys.length) {
    titleEl.textContent = "오늘(24시간) 데이터 없음";
    return;
  }
  const latest = keys[keys.length - 1];
  const baseDate = latest.substring(0,8);
  titleEl.textContent = `${baseDateToDot(baseDate)} (24시간) 히스토그램`;
  renderOneDayChart(data, "MACHINE2", "MIC", "chartCuringMic");
  renderOneDayChart(data, "MACHINE2", "ACC", "chartCuringAcc");
  renderOneDayChart(data, "MACHINE3", "MIC", "chartHotMic");
  renderOneDayChart(data, "MACHINE3", "ACC", "chartHotAcc");
}
function renderOneDayChart(data, mId, sensorKey, canvasId) {
  const ctx = document.getElementById(canvasId);
  if(!ctx) return;
  if(charts[canvasId]) charts[canvasId].destroy();
  const hourlyData = data.hourlyData || {};
  const keys = Object.keys(hourlyData).sort();
  if(!keys.length) {
    charts[canvasId] = new Chart(ctx, { type:'bar', data:{labels:[], datasets:[]} });
    return;
  }
  const latest = keys[keys.length-1];
  const baseDate = latest.substring(0,8);
  let labels = [], arrNormal = [], arrAnomaly = [];
  for(let h = 0; h < 24; h++){
    const hh = String(h).padStart(2, "0");
    const key = `${baseDate}_${hh}`;
    const mo = hourlyData[key] || {};
    let n = 0, a = 0;
    if(mo[mId]){
      const c = mo[mId];
      n = c[sensorKey+"_processed"] || 0;
      a = c[sensorKey+"_anomaly"] || 0;
    }
    labels.push(`${h}-${h+1}시`);
    arrNormal.push(n);
    arrAnomaly.push(a);
  }
  charts[canvasId] = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        { label:"정상", data: arrNormal, backgroundColor: chartColors.barNormal },
        { label:"이상", data: arrAnomaly, backgroundColor: chartColors.barAnomaly }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: "top" } },
      scales: { x: { ticks: { maxRotation: 0, minRotation: 0 } }, y: { beginAtZero: true } }
    }
  });
}

/* -------------------------
   (3) 24시간 상세 (기존)
-------------------------- */
function renderTodayHourCards(data) {
  const container = document.getElementById("todayHourCards");
  if(!container) return;
  container.innerHTML = "";
  const hourlyData = data.hourlyData || {};
  const keys = Object.keys(hourlyData).sort();
  if(!keys.length) {
    container.innerHTML = `<div class="text-gray-500">데이터 없음</div>`;
    return;
  }
  const latest = keys[keys.length-1];
  const baseDate = latest.substring(0,8);
  for(let h = 0; h < 24; h++){
    const hh = String(h).padStart(2, "0");
    const key = `${baseDate}_${hh}`;
    const mo = hourlyData[key] || {};
    const label = `${h}-${h+1}시`;
    const detail = document.createElement("details");
    detail.className = "group card-base";
    let html = `
      <summary class="flex items-center font-semibold mb-2 text-blue-600 gap-1 cursor-pointer">
        <svg class="w-4 h-4 rotate-90" fill="none" stroke="currentColor" stroke-width="2"
             viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round">
          <path d="M9 5l7 7-7 7"></path>
        </svg>
        ${label}
      </summary>
    `;
    let content = "";
    const mchKeys = sortMachineIds(Object.keys(mo));
    if(!mchKeys.length){
      content = `<div class="text-sm text-gray-400">데이터 없음</div>`;
    } else {
      mchKeys.forEach(mId => {
        const c = mo[mId];
        content += `
          <div class="border-t pt-2 mt-2 text-sm">
            <div class="font-medium mb-1">${c.display_name || mId}</div>
            <div class="mb-1">
              <span class="text-label text-blue-500">MIC:</span>
              <span class="text-normal">정상 ${c.MIC_processed||0}</span>
              / <span class="text-anomaly">이상 ${c.MIC_anomaly||0}</span>
            </div>
            <div>
              <span class="text-label text-green-500">ACC:</span>
              <span class="text-normal">정상 ${c.ACC_processed||0}</span>
              / <span class="text-anomaly">이상 ${c.ACC_anomaly||0}</span>
            </div>
          </div>
        `;
      });
    }
    html += `<div class="mt-2">${content}</div>`;
    detail.innerHTML = html;
    container.appendChild(detail);
  }
}

/* -------------------------
   (4) 주별 데이터
   (4-B) 주차별 일(Daily) 집계 – 기존 요약표 외에
   각 일자별로 머신별(각 2개의 선) 24시간 라인차트를 추가하는 기능
-------------------------- */
function getWeekRangeLabel(weekKey, firstDateStr) {
  const m = weekKey.match(/Week_(\d+)/);
  if(!m) return weekKey;
  const wNum = parseInt(m[1], 10);
  const y = parseInt(firstDateStr.substring(0,4), 10);
  const mm = parseInt(firstDateStr.substring(4,6), 10) - 1;
  const d = parseInt(firstDateStr.substring(6,8), 10);
  const start = new Date(y, mm, d + (wNum-1)*7);
  const end = new Date(start.getTime() + 6*24*3600*1000);
  return `${weekKey} (${start.getMonth()+1}/${start.getDate()}~${end.getMonth()+1}/${end.getDate()})`;
}

function getWeeklyMachineSensorData(weeklyData, machineName, sensorKey) {
  const wKeys = Object.keys(weeklyData).sort((a, b) => {
    const aN = parseInt(a.split('_')[1]||"0", 10);
    const bN = parseInt(b.split('_')[1]||"0", 10);
    return aN - bN;
  });
  let labels = [], normals = [], anomalies = [];
  wKeys.forEach(weekKey => {
    const mo = weeklyData[weekKey] && weeklyData[weekKey][machineName];
    if(!mo) {
      labels.push(weekKey);
      normals.push(0);
      anomalies.push(0);
    } else {
      const pk = sensorKey + "_processed";
      const ak = sensorKey + "_anomaly";
      normals.push(mo[pk]||0);
      anomalies.push(mo[ak]||0);
      labels.push(weekKey);
    }
  });
  return { labels, normals, anomalies };
}

function renderWeeklyChart(canvasId, tableId, dataset) {
  const ctx = document.getElementById(canvasId);
  if(!ctx) return;
  if(charts[canvasId]) charts[canvasId].destroy();
  charts[canvasId] = new Chart(ctx, {
    type: "bar",
    data: {
      labels: dataset.labels,
      datasets: [
        { label:"정상", data: dataset.normals, backgroundColor: chartColors.barNormal },
        { label:"이상", data: dataset.anomalies, backgroundColor: chartColors.barAnomaly }
      ]
    },
    options: {
      responsive:true,
      maintainAspectRatio:false,
      plugins: { legend: { position:"top" } },
      scales: { x:{ ticks:{ maxRotation:0, minRotation:0 } }, y:{ beginAtZero:true } }
    }
  });
  const tbl = document.getElementById(tableId);
  if(tbl){
    let html = `
      <table class="w-full text-sm border-t border-b">
        <thead>
          <tr class="bg-gray-50 border-b">
            <th class="py-1 px-2">주차</th>
            <th class="py-1 px-2">정상</th>
            <th class="py-1 px-2">이상</th>
            <th class="py-1 px-2">이상비율</th>
          </tr>
        </thead>
        <tbody>
    `;
    dataset.labels.forEach((lbl, i) => {
      const n = dataset.normals[i] || 0;
      const a = dataset.anomalies[i] || 0;
      const sum = n+a;
      const ratio = sum ? ((a/sum)*100).toFixed(1)+"%" : "-";
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
    tbl.innerHTML = html;
  }
}

function renderWeeklyCharts(data) {
  const wd = data.weeklyData || {};
  const firstDt = data.first_date || "20250101_000000";
  const dsM2Mic = getWeeklyMachineSensorData(wd, "MACHINE2", "MIC");
  dsM2Mic.labels = dsM2Mic.labels.map(k => getWeekRangeLabel(k, firstDt));
  renderWeeklyChart("weeklyChartCuringOvenMic", "weeklyTableCuringOvenMic", dsM2Mic);
  const dsM2Acc = getWeeklyMachineSensorData(wd, "MACHINE2", "ACC");
  dsM2Acc.labels = dsM2Acc.labels.map(k => getWeekRangeLabel(k, firstDt));
  renderWeeklyChart("weeklyChartCuringOvenAcc", "weeklyTableCuringOvenAcc", dsM2Acc);
  const dsM3Mic = getWeeklyMachineSensorData(wd, "MACHINE3", "MIC");
  dsM3Mic.labels = dsM3Mic.labels.map(k => getWeekRangeLabel(k, firstDt));
  renderWeeklyChart("weeklyChartHotChamberMic", "weeklyTableHotChamberMic", dsM3Mic);
  const dsM3Acc = getWeeklyMachineSensorData(wd, "MACHINE3", "ACC");
  dsM3Acc.labels = dsM3Acc.labels.map(k => getWeekRangeLabel(k, firstDt));
  renderWeeklyChart("weeklyChartHotChamberAcc", "weeklyTableHotChamberAcc", dsM3Acc);
}

/* -------------------------
   (4-B) 주차별 일(Daily) 집계 – 기존 요약 외에
   각 일자별로 머신별(각 2개의 선) 24시간 라인차트 추가 기능
-------------------------- */
function renderWeeklyDayBreakdown(data) {
  const container = document.getElementById("weeklyDayBreakdown");
  if(!container) return;
  container.innerHTML = "";

  const weeklyData = data.weeklyData || {};
  const dailyData = data.dailyData || {};
  if(!Object.keys(weeklyData).length) {
    container.innerHTML = "<p class='text-gray-500'>주간 데이터 없음</p>";
    return;
  }
  const weeks = Object.keys(weeklyData).sort((a,b)=>{
    const aN = parseInt(a.split('_')[1]||"0",10);
    const bN = parseInt(b.split('_')[1]||"0",10);
    return aN - bN;
  });
  const firstDtStr = data.first_date || "20250101_000000";
  const y = parseInt(firstDtStr.substring(0,4),10);
  const m = parseInt(firstDtStr.substring(4,6),10)-1;
  const d = parseInt(firstDtStr.substring(6,8),10);

  weeks.forEach(weekKey => {
    const wNum = parseInt(weekKey.split('_')[1],10);
    const start = new Date(y, m, d + (wNum-1)*7);
    const end = new Date(start.getTime() + 6*24*3600*1000);
    const wrapDetails = document.createElement("details");
    wrapDetails.className = "group bg-gray-50 rounded-lg shadow p-4";
    const sLabel = `${start.getMonth()+1}/${start.getDate()}`;
    const eLabel = `${end.getMonth()+1}/${end.getDate()}`;
    const summaryHtml = `
      <summary class="flex items-center font-semibold mb-2 text-blue-600 gap-1 cursor-pointer">
        <svg class="w-4 h-4 rotate-90" fill="none" stroke="currentColor" stroke-width="2"
             viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round">
          <path d="M9 5l7 7-7 7"></path>
        </svg>
        ${weekKey} (${sLabel} ~ ${eLabel})
      </summary>
    `;
    let daysHtml = `<div class="mt-2 grid grid-cols-1 md:grid-cols-3 gap-4">`;
    // 7일 반복
    for(let i = 0; i < 7; i++){
      const cur = new Date(start.getTime() + i*24*3600*1000);
      const yy = cur.getFullYear();
      const mm = String(cur.getMonth()+1).padStart(2,"0");
      const dd = String(cur.getDate()).padStart(2,"0");
      const dayKey = `${yy}-${mm}-${dd}`;
      let cardHtml = `<div class="card-base">`;
      cardHtml += `<h4 class="font-medium mb-2 text-sm text-gray-700">${dayKey}</h4>`;
      // 기존 요약 (dailyData)
      let summaryStr = `<div class="text-sm text-gray-400">- 데이터 없음 -</div>`;
      const dayObj = dailyData[dayKey];
      if(dayObj){
        const c2 = dayObj["MACHINE2"];
        const c3 = dayObj["MACHINE3"];
        if(c2 || c3){
          summaryStr = "";
          if(c2){
            summaryStr += `
              <div class="mb-1">
                <span class="text-label text-blue-500">Curing(MIC):</span>
                <span class="text-normal">정상 ${c2.MIC_processed||0}</span>
                / <span class="text-anomaly">이상 ${c2.MIC_anomaly||0}</span>
              </div>
              <div class="mb-2">
                <span class="text-label text-green-500">Curing(ACC):</span>
                <span class="text-normal">정상 ${c2.ACC_processed||0}</span>
                / <span class="text-anomaly">이상 ${c2.ACC_anomaly||0}</span>
              </div>
            `;
          }
          if(c3){
            summaryStr += `
              <div class="mb-1">
                <span class="text-label text-blue-500">Hot(MIC):</span>
                <span class="text-normal">정상 ${c3.MIC_processed||0}</span>
                / <span class="text-anomaly">이상 ${c3.MIC_anomaly||0}</span>
              </div>
              <div>
                <span class="text-label text-green-500">Hot(ACC):</span>
                <span class="text-normal">정상 ${c3.ACC_processed||0}</span>
                / <span class="text-anomaly">이상 ${c3.ACC_anomaly||0}</span>
              </div>
            `;
          }
        }
      }
      cardHtml += summaryStr;

      // 추가: 각 일자 카드 내에 머신별 24시간 라인차트 (2개의 선씩)
      // MACHINE2 차트 (MIC 총합, ACC 총합)
      cardHtml += `
        <details class="group mt-3">
          <summary class="flex items-center text-blue-600 gap-1 cursor-pointer text-sm font-semibold">
            <svg class="w-4 h-4 rotate-90" fill="none" stroke="currentColor" stroke-width="2"
                 viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round">
              <path d="M9 5l7 7-7 7"></path>
            </svg>
            MACHINE2 24시간 보기
          </summary>
          <div class="mt-2">
            <canvas id="chart_${dayKey}_M2" style="width:100%; height:220px;"></canvas>
          </div>
        </details>
      `;
      // MACHINE3 차트
      cardHtml += `
        <details class="group mt-3">
          <summary class="flex items-center text-blue-600 gap-1 cursor-pointer text-sm font-semibold">
            <svg class="w-4 h-4 rotate-90" fill="none" stroke="currentColor" stroke-width="2"
                 viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round">
              <path d="M9 5l7 7-7 7"></path>
            </svg>
            MACHINE3 24시간 보기
          </summary>
          <div class="mt-2">
            <canvas id="chart_${dayKey}_M3" style="width:100%; height:220px;"></canvas>
          </div>
        </details>
      `;
      cardHtml += `</div>`;
      daysHtml += cardHtml;
    }
    daysHtml += `</div>`;
    wrapDetails.innerHTML = summaryHtml + daysHtml;
    container.appendChild(wrapDetails);
  });

  // 각 날짜별 머신차트 채우기
  renderAllDayMachineCharts(data);
}

// 새로 추가: 각 날짜별로 머신별 차트를 그린다.
// 각 차트는 24시간 데이터를 2개의 선으로 구성:
// MIC 총합 = (MIC_processed + MIC_anomaly)
// ACC 총합 = (ACC_processed + ACC_anomaly)
function renderAllDayMachineCharts(data) {
  const canvasList = document.querySelectorAll('canvas[id^="chart_"][id$="_M2"], canvas[id^="chart_"][id$="_M3"]');
  const hourlyData = data.hourlyData || {};
  canvasList.forEach(canvas => {
    // id 예: chart_2025-03-10_M2  또는 chart_2025-03-10_M3
    const id = canvas.id;
    const parts = id.split("_"); // ["chart", "2025-03-10", "M2"] or M3
    const dayStr = parts[1]; // "YYYY-MM-DD"
    const machine = parts[2]; // "M2" or "M3"
    renderDayMachineChart(dayStr, machine, canvas, hourlyData);
  });
}

// 해당 날짜, 해당 머신에 대해 24시간 데이터 2개 선 차트 그리기
function renderDayMachineChart(dayStr, machine, canvasEl, hourlyData) {
  // dayStr "YYYY-MM-DD" -> baseDate "YYYYMMDD"
  const y = dayStr.substring(0,4);
  const m = dayStr.substring(5,7);
  const d = dayStr.substring(8,10);
  const baseDate = `${y}${m}${d}`;

  let labels = [];
  let arrMic = [];
  let arrAcc = [];

  for(let h=0; h<24; h++){
    const hh = String(h).padStart(2,"0");
    const key = `${baseDate}_${hh}`;
    const mo = hourlyData[key] || {};
    let mic = 0, acc = 0;
    if(mo[machine]) {
      const c = mo[machine];
      mic = (c.MIC_processed || 0) + (c.MIC_anomaly || 0);
      acc = (c.ACC_processed || 0) + (c.ACC_anomaly || 0);
    }
    labels.push(`${h}h`);
    arrMic.push(mic);
    arrAcc.push(acc);
  }

  if(charts[canvasEl.id]) charts[canvasEl.id].destroy();
  const ctx = canvasEl.getContext("2d");
  charts[canvasEl.id] = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: `${machine} - MIC`,
          data: arrMic,
          borderColor: chartColors[machine === "M2" ? "m2Mic" : "m3Mic"],
          backgroundColor: machine === "M2" ? "rgba(54,162,235,0.2)" : "rgba(255,159,64,0.2)",
          fill: true
        },
        {
          label: `${machine} - ACC`,
          data: arrAcc,
          borderColor: chartColors[machine === "M2" ? "m2Acc" : "m3Acc"],
          backgroundColor: machine === "M2" ? "rgba(75,192,192,0.2)" : "rgba(255,99,132,0.2)",
          fill: true
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: { y: { beginAtZero: true } },
      plugins: { legend: { position: "top" } }
    }
  });
}

/* -------------------------
   (5) 월별 데이터 (기존)
-------------------------- */
function getMonthlyMachineSensorData(md, machineName, sensorKey) {
  const mKeys = Object.keys(md).sort();
  let labels = [], normals = [], anomalies = [];
  mKeys.forEach(monKey => {
    const mo = md[monKey] && md[monKey][machineName];
    if(!mo) {
      labels.push(monKey);
      normals.push(0);
      anomalies.push(0);
    } else {
      normals.push(mo[sensorKey+"_processed"] || 0);
      anomalies.push(mo[sensorKey+"_anomaly"] || 0);
      labels.push(monKey);
    }
  });
  return { labels, normals, anomalies };
}
function renderMonthlyChart(canvasId, tableId, dataset) {
  const ctx = document.getElementById(canvasId);
  if(!ctx) return;
  if(charts[canvasId]) charts[canvasId].destroy();
  charts[canvasId] = new Chart(ctx, {
    type: "bar",
    data: {
      labels: dataset.labels,
      datasets: [
        { label:"정상", data: dataset.normals, backgroundColor: chartColors.barNormal },
        { label:"이상", data: dataset.anomalies, backgroundColor: chartColors.barAnomaly }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: "top" } },
      scales: { x: { ticks: { maxRotation: 0, minRotation: 0 } }, y: { beginAtZero: true } }
    }
  });
  const tbl = document.getElementById(tableId);
  if(tbl) {
    let html = `
      <table class="w-full text-sm border-t border-b">
        <thead>
          <tr class="bg-gray-50 border-b">
            <th class="py-1 px-2">월</th>
            <th class="py-1 px-2">정상</th>
            <th class="py-1 px-2">이상</th>
            <th class="py-1 px-2">이상비율</th>
          </tr>
        </thead>
        <tbody>
    `;
    dataset.labels.forEach((lbl, i) => {
      const n = dataset.normals[i] || 0;
      const a = dataset.anomalies[i] || 0;
      const sum = n+a;
      const ratio = sum ? ((a/sum)*100).toFixed(1) + "%" : "-";
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
    tbl.innerHTML = html;
  }
}
function renderMonthlyCharts(data) {
  const md = data.monthlyData || {};
  const dsM2Mic = getMonthlyMachineSensorData(md, "MACHINE2", "MIC");
  renderMonthlyChart("monthlyChartCuringOvenMic", "monthlyTableCuringOvenMic", dsM2Mic);
  const dsM2Acc = getMonthlyMachineSensorData(md, "MACHINE2", "ACC");
  renderMonthlyChart("monthlyChartCuringOvenAcc", "monthlyTableCuringOvenAcc", dsM2Acc);
  const dsM3Mic = getMonthlyMachineSensorData(md, "MACHINE3", "MIC");
  renderMonthlyChart("monthlyChartHotChamberMic", "monthlyTableHotChamberMic", dsM3Mic);
  const dsM3Acc = getMonthlyMachineSensorData(md, "MACHINE3", "ACC");
  renderMonthlyChart("monthlyChartHotChamberAcc", "monthlyTableHotChamberAcc", dsM3Acc);
}

/* -------------------------
   자동 새로고침 (5분)
-------------------------- */
function setupAutoRefresh() {
  setInterval(loadData, 5 * 60 * 1000);
}

document.addEventListener("DOMContentLoaded", () => {
  loadData();
  setupAutoRefresh();
});

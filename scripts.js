// 전역 폰트 설정 및 머신 매핑 (서버에서 전달한 mapping을 그대로 사용)
Chart.defaults.font.family = "'D2Coding', 'Pretendard', 'Noto Sans KR', sans-serif";
Chart.defaults.font.size = 14;

const chartColors = {
  normal: 'rgba(54, 162, 235, 0.7)',
  anomaly: 'rgba(255, 99, 132, 0.7)'
};

const charts = {};

// 머신 순서: 반드시 ["MACHINE2", "MACHINE3"] (서버에서 지정한 순서)
const MACHINE_IDS = ["MACHINE2", "MACHINE3"];

/* --------------------------------------------------
   기존 함수: Machine ID 순서 고정
-------------------------------------------------- */
function sortMachineIds(keys) {
  const order = MACHINE_IDS;
  return keys.sort((a, b) => {
    const iA = order.indexOf(a);
    const iB = order.indexOf(b);
    if(iA === -1 && iB === -1){
      return a.localeCompare(b);
    } else if(iA === -1){
      return 1;
    } else if(iB === -1){
      return -1;
    } else {
      return iA - iB;
    }
  });
}

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
  renderRecentHour(data);
  renderTodayDailySummary(data);
  renderTodayHistograms(data);
  renderTodayHourCards(data);
  renderWeeklyPlotCards(data);  // 변경: JSON의 weeklyPlotData를 사용하여 Chart.js로 라인 차트 렌더링 (접이식 카드)
  renderWeeklyDayBreakdown(data);
  renderMonthlyCharts(data);

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
  const titleEl  = document.getElementById('recentHourTitle');
  if(!container || !titleEl) return;
  container.innerHTML = '';

  const hourlyData = data.hourlyData || {};
  const hourKeys = Object.keys(hourlyData).sort();
  if(!hourKeys.length){
    titleEl.textContent = "이전 1시간 (데이터 없음)";
    return;
  }
  const latestKey = hourKeys[hourKeys.length-1];
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
    container.innerHTML = `<div class="bg-white p-4 rounded shadow text-gray-500">이전1시간(${prevHourKey}) 데이터 없음</div>`;
    return;
  }

  const mchKeys = sortMachineIds(Object.keys(mchObj));
  mchKeys.forEach(mId => {
    const c = mchObj[mId];
    const micTotal = (c.MIC_processed || 0) + (c.MIC_anomaly || 0);
    const accTotal = (c.ACC_processed || 0) + (c.ACC_anomaly || 0);
    const micRate = micTotal ? ((c.MIC_anomaly || 0) / micTotal * 100).toFixed(1) : 0;
    const accRate = accTotal ? ((c.ACC_anomaly || 0) / accTotal * 100).toFixed(1) : 0;

    const card = document.createElement('div');
    card.className = "bg-white rounded-lg shadow p-4";
    card.innerHTML = `
      <h3 class="font-medium text-lg mb-2">${c.display_name || mId}</h3>
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
    container.innerHTML = `<div class="bg-white p-4 rounded shadow text-gray-500">오늘(24시간) 데이터 없음</div>`;
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
    card.className = "bg-white rounded-lg shadow p-4";
    card.innerHTML = `
      <h3 class="font-medium text-lg mb-2">${obj.display_name || mId}</h3>
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

/* --------------------------------------------------
   (2) 오늘(24시간) 히스토그램 렌더링
-------------------------------------------------- */
function renderTodayHistograms(data){
  const titleEl = document.getElementById('todayTitle');
  const hourlyData = data.hourlyData || {};
  const hKeys = Object.keys(hourlyData).sort();
  if(!hKeys.length){
    titleEl.textContent = "오늘(24시간) 데이터 없음";
    return;
  }
  const latest = hKeys[hKeys.length-1];
  const baseDate = latest.substring(0,8);
  titleEl.textContent = `${baseDate.substring(0,4)}.${baseDate.substring(4,6)}.${baseDate.substring(6,8)} (24시간) 히스토그램`;

  renderOneDayChart(data, "MACHINE2", "MIC", "chartCuringMic");
  renderOneDayChart(data, "MACHINE2", "ACC", "chartCuringAcc");
  renderOneDayChart(data, "MACHINE3", "MIC", "chartHotMic");
  renderOneDayChart(data, "MACHINE3", "ACC", "chartHotAcc");
}

function renderOneDayChart(data, machineId, sensorKey, canvasId){
  const ctx = document.getElementById(canvasId);
  if(!ctx) return;
  if(charts[canvasId]) charts[canvasId].destroy();

  const hourlyData = data.hourlyData || {};
  const hKeys = Object.keys(hourlyData).sort();
  if(!hKeys.length){
    charts[canvasId] = new Chart(ctx,{type:'bar',data:{labels:[],datasets:[]}});
    return;
  }
  const latest = hKeys[hKeys.length-1];
  const baseDate = latest.substring(0,8);
  let labels = [], normalArr = [], anomalyArr = [];
  for(let h=0; h<24; h++){
    const hh = String(h).padStart(2,'0');
    const hourKey = `${baseDate}_${hh}`;
    const mo = hourlyData[hourKey] || {};
    const c = mo[machineId];
    let n = 0, a = 0;
    if(c){
      n = c[sensorKey+"_processed"] || 0;
      a = c[sensorKey+"_anomaly"] || 0;
    }
    labels.push(`${h}-${h+1}시`);
    normalArr.push(n);
    anomalyArr.push(a);
  }
  charts[canvasId] = new Chart(ctx, {
    type:'bar',
    data:{
      labels,
      datasets:[
        { label:'정상', data: normalArr, backgroundColor: chartColors.normal },
        { label:'이상', data: anomalyArr, backgroundColor: chartColors.anomaly }
      ]
    },
    options:{
      responsive:true,
      maintainAspectRatio:false,
      plugins:{ legend:{ position:'top' } },
      scales:{
        x:{ ticks:{ maxRotation:0, minRotation:0 } },
        y:{ beginAtZero:true }
      }
    }
  });
}

/* --------------------------------------------------
   (4) 주간 플롯 카드 렌더링 (JSON의 weeklyPlotData 사용, 접이식 카드)
   각 주마다, 카드 제목에 해당 주의 구체적 기간(예: "02/19 ~ 02/25")를 표시하고,
   내부에는 각 머신별로 두 개의 캔버스(하나는 MIC, 하나는 ACC)를 생성하여
   Chart.js의 라인 차트로 24시간 데이터를 렌더링합니다.
-------------------------------------------------- */
function renderWeeklyPlotCards(data){
  const container = document.getElementById('weeklyPlotCards');
  if(!container) return;
  container.innerHTML = '';

  const weeklyPlotData = data.weeklyPlotData;
  if(!weeklyPlotData || Object.keys(weeklyPlotData).length === 0){
    container.innerHTML = `<div class="bg-white p-4 rounded shadow text-gray-500">주간 플롯 데이터가 없습니다.</div>`;
    return;
  }
  const weekKeys = Object.keys(weeklyPlotData).sort((a, b) => {
    return parseInt(a.split('_')[1]) - parseInt(b.split('_')[1]);
  });
  weekKeys.forEach(weekKey => {
    const weekInfo = weeklyPlotData[weekKey]; // { period: "MM/DD ~ MM/DD", data: { machine_id: { MIC: {processed:[], anomaly:[]}, ACC: {…} } } }
    const period = weekInfo.period;
    const weekCard = document.createElement('div');
    weekCard.className = "bg-gray-50 rounded-lg shadow p-4";
    
    const details = document.createElement('details');
    details.className = "group";
    const summary = document.createElement('summary');
    summary.className = "flex items-center font-semibold mb-2 text-blue-600 gap-1 cursor-pointer";
    summary.innerHTML = `<svg class="w-4 h-4 rotate-90" fill="none" stroke="currentColor" stroke-width="2"
                           viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round">
                           <path d="M9 5l7 7-7 7"></path>
                           </svg> ${weekKey} (${period})`;
    details.appendChild(summary);

    const contentDiv = document.createElement('div');
    contentDiv.className = "mt-2";

    const machines = weekInfo.data;
    MACHINE_IDS.forEach(machineId => {
      if(machines[machineId]){
        const machineData = machines[machineId];
        const machineDiv = document.createElement('div');
        machineDiv.className = "mb-4";
        const machineName = (data.machine_info && data.machine_info[machineId] && data.machine_info[machineId].display_name) 
                              || machineId;
        const machineHeader = document.createElement('h4');
        machineHeader.className = "font-semibold text-md mb-1";
        machineHeader.textContent = machineName;
        machineDiv.appendChild(machineHeader);

        // For each sensor (MIC, ACC) render a canvas and draw a line chart
        ["MIC", "ACC"].forEach(sensor => {
          if(machineData[sensor]){
            const sensorData = machineData[sensor]; // { processed: [...], anomaly: [...] }
            const canvas = document.createElement('canvas');
            const canvasId = `weekly_${weekKey}_${machineId}_${sensor}`;
            canvas.id = canvasId;
            canvas.style.height = "220px";
            canvas.style.width = "100%";
            machineDiv.appendChild(canvas);

            const ctx = canvas.getContext('2d');
            new Chart(ctx, {
              type: 'line',
              data: {
                labels: Array.from({length: 24}, (_, i) => `${i}-${i+1}시`),
                datasets: [
                  {
                    label: '정상',
                    data: sensorData.processed,
                    borderColor: 'rgba(54, 162, 235, 1)',
                    backgroundColor: 'rgba(54, 162, 235, 0.2)',
                    fill: false
                  },
                  {
                    label: '이상',
                    data: sensorData.anomaly,
                    borderColor: 'rgba(255, 99, 132, 1)',
                    backgroundColor: 'rgba(255, 99, 132, 0.2)',
                    fill: false
                  }
                ]
              },
              options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: { position: 'top' },
                  title: { display: true, text: `${sensor} 24시간 집계` }
                },
                scales: {
                  x: { title: { display: true, text: 'Hour' } },
                  y: { beginAtZero: true, title: { display: true, text: 'Count' } }
                }
              }
            });
          }
        });
        contentDiv.appendChild(machineDiv);
      }
    });
    details.appendChild(contentDiv);
    weekCard.appendChild(details);
    container.appendChild(weekCard);
  });
}

/* --------------------------------------------------
   (4-B) 주차별 일(Daily) 집계 렌더링 (기존 그대로)
-------------------------------------------------- */
function renderWeeklyDayBreakdown(data){
  const container = document.getElementById('weeklyDayBreakdown');
  if(!container) return;
  container.innerHTML = '';

  const weeklyData = data.weeklyData || {};
  const dailyData = data.dailyData || {};
  if(!Object.keys(weeklyData).length){
    container.innerHTML = "<p class='text-gray-500'>주간 데이터가 없습니다.</p>";
    return;
  }
  const weeks = Object.keys(weeklyData).sort((a, b) => {
    return parseInt(a.split('_')[1]) - parseInt(b.split('_')[1]);
  });
  const firstDtStr = data.first_date || "20250101_000000";
  const year = parseInt(firstDtStr.substring(0,4),10);
  const mon  = parseInt(firstDtStr.substring(4,6),10)-1;
  const day  = parseInt(firstDtStr.substring(6,8),10);
  weeks.forEach(weekKey => {
    const wNum = parseInt(weekKey.split('_')[1],10);
    const start = new Date(year, mon, day + (wNum-1)*7);
    const end   = new Date(start.getTime() + 6*24*3600*1000);
    const wrapDetails = document.createElement('details');
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
    for(let i=0; i<7; i++){
      const tmp = new Date(start.getTime() + i*24*3600*1000);
      const yyy = tmp.getFullYear();
      const mm = String(tmp.getMonth()+1).padStart(2,'0');
      const dd = String(tmp.getDate()).padStart(2,'0');
      const dayKey = `${yyy}-${mm}-${dd}`;
      let cardHtml = `<div class="bg-white rounded-lg shadow p-3">`;
      cardHtml += `<h4 class="font-medium mb-2 text-sm text-gray-700">${dayKey}</h4>`;
      let coStr = `<div class="text-sm text-gray-400">- 데이터 없음 -</div>`;
      const dayObj = dailyData[dayKey];
      if(dayObj){
        const c2 = dayObj["MACHINE2"];
        const c3 = dayObj["MACHINE3"];
        if(c2 || c3){
          coStr = '';
          if(c2){
            const micN = c2.MIC_processed || 0, micA = c2.MIC_anomaly || 0;
            const accN = c2.ACC_processed || 0, accA = c2.ACC_anomaly || 0;
            coStr += `
              <div class="mb-1">
                <span class="font-semibold text-blue-500">Curing(MIC):</span>
                <span class="text-normal">정상 ${micN}</span>
                / <span class="text-anomaly">이상 ${micA}</span>
              </div>
              <div class="mb-2">
                <span class="font-semibold text-green-500">Curing(ACC):</span>
                <span class="text-normal">정상 ${accN}</span>
                / <span class="text-anomaly">이상 ${accA}</span>
              </div>
            `;
          } else {
            coStr += `<div class="text-sm text-gray-400">Curing Oven 데이터 없음</div>`;
          }
          if(c3){
            const micN = c3.MIC_processed || 0, micA = c3.MIC_anomaly || 0;
            const accN = c3.ACC_processed || 0, accA = c3.ACC_anomaly || 0;
            coStr += `
              <div class="mb-1">
                <span class="font-semibold text-blue-500">Hot(MIC):</span>
                <span class="text-normal">정상 ${micN}</span>
                / <span class="text-anomaly">이상 ${micA}</span>
              </div>
              <div>
                <span class="font-semibold text-green-500">Hot(ACC):</span>
                <span class="text-normal">정상 ${accN}</span>
                / <span class="text-anomaly">이상 ${accA}</span>
              </div>
            `;
          } else {
            coStr += `<div class="text-sm text-gray-400">Hot Chamber 데이터 없음</div>`;
          }
        }
      }
      cardHtml += coStr;
      cardHtml += `</div>`;
      daysHtml += cardHtml;
    }
    daysHtml += `</div>`;
    wrapDetails.innerHTML = summaryHtml + daysHtml;
    container.appendChild(wrapDetails);
  });
}

/* --------------------------------------------------
   (5) 월별 데이터 렌더링 (기존 Chart.js 기반)
-------------------------------------------------- */
function getMonthlyMachineSensorData(md, machineName, sensorKey){
  const mKeys = Object.keys(md).sort();
  let labels = [], normals = [], anomalies = [];
  mKeys.forEach(m => {
    const mo = md[m][machineName];
    if(!mo){
      labels.push(m);
      normals.push(0);
      anomalies.push(0);
      return;
    }
    const pk = sensorKey+"_processed";
    const ak = sensorKey+"_anomaly";
    normals.push(mo[pk] || 0);
    anomalies.push(mo[ak] || 0);
    labels.push(m);
  });
  return { labels, normals, anomalies };
}

function renderMonthlyChart(chartId, tableId, dataset){
  const ctx = document.getElementById(chartId);
  if(!ctx) return;
  if(charts[chartId]) charts[chartId].destroy();

  charts[chartId] = new Chart(ctx,{
    type:'bar',
    data:{
      labels: dataset.labels,
      datasets:[
        { label:'정상', data: dataset.normals, backgroundColor: chartColors.normal },
        { label:'이상', data: dataset.anomalies, backgroundColor: chartColors.anomaly }
      ]
    },
    options:{
      responsive:true,
      maintainAspectRatio:false,
      plugins:{ legend:{position:'top'} },
      scales:{
        x:{ ticks:{ maxRotation:0, minRotation:0 } },
        y:{ beginAtZero:true }
      }
    }
  });

  const tbl = document.getElementById(tableId);
  if(tbl){
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
    dataset.labels.forEach((lbl,i)=>{
      const n = dataset.normals[i] || 0;
      const a = dataset.anomalies[i] || 0;
      const sum = n + a;
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

function renderMonthlyCharts(data){
  const md = data.monthlyData || {};
  
  const dsCuringMic = getMonthlyMachineSensorData(md, "MACHINE2", "MIC");
  renderMonthlyChart("monthlyChartCuringOvenMic", "monthlyTableCuringOvenMic", dsCuringMic);

  const dsCuringAcc = getMonthlyMachineSensorData(md, "MACHINE2", "ACC");
  renderMonthlyChart("monthlyChartCuringOvenAcc", "monthlyTableCuringOvenAcc", dsCuringAcc);

  const dsHotMic = getMonthlyMachineSensorData(md, "MACHINE3", "MIC");
  renderMonthlyChart("monthlyChartHotChamberMic", "monthlyTableHotChamberMic", dsHotMic);

  const dsHotAcc = getMonthlyMachineSensorData(md, "MACHINE3", "ACC");
  renderMonthlyChart("monthlyChartHotChamberAcc", "monthlyTableHotChamberAcc", dsHotAcc);
}

/* --------------------------------------------------
   자동 새로고침 (5분)
-------------------------------------------------- */
function setupAutoRefresh(){
  setInterval(loadData, 5 * 60 * 1000);
}

document.addEventListener('DOMContentLoaded', ()=>{
  loadData();
  setupAutoRefresh();
});

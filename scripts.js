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
  // 1) 오늘(최신) 데이터
  updateTodayData(data);

  // 2) 주간 차트
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
  날짜 표시 변환 (YYYYMMDD -> YYYY-MM-DD)
---------------------------------------------------- */
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
   [1] 오늘(최신) 데이터 섹션
     - (A) 머신별 오늘 총합 (hourlyData)
     - (B) 최근 1시간(5분) 히스토그램 4개
     - (C) 최근 1시간(5분) 상세 카드
---------------------------------------------------- */
function updateTodayData(data) {
  const summaryContainer  = document.getElementById('todaySummary');
  const lastHourDetailsEl = document.getElementById('lastHourDetails');
  const titleEl           = document.getElementById('todayTitle');

  // (A) "오늘 날짜" 기준 머신별 총합
  const dailyTotals = getTodayMachineTotals(data);
  if (titleEl) {
    titleEl.textContent = dailyTotals.displayDate + " 데이터";
  }

  // 카드 만들기
  summaryContainer.innerHTML = '';
  Object.entries(dailyTotals.totals).forEach(([mId, obj]) => {
    const micTotal = obj.MIC_processed + obj.MIC_anomaly;
    const accTotal = obj.ACC_processed + obj.ACC_anomaly;
    const micRate  = micTotal ? ((obj.MIC_anomaly/micTotal)*100).toFixed(1) : 0;
    const accRate  = accTotal ? ((obj.ACC_anomaly/accTotal)*100).toFixed(1) : 0;

    const div = document.createElement('div');
    div.className = "bg-white rounded-lg shadow p-4";
    div.innerHTML=`
      <h3 class="font-medium text-lg mb-2">${obj.display_name}</h3>
      <div class="text-sm mb-1">
        <span class="font-semibold text-blue-500">MIC:</span>
        정상 ${obj.MIC_processed} / 이상 ${obj.MIC_anomaly}
        (이상 ${micRate}%)
      </div>
      <div class="text-sm">
        <span class="font-semibold text-green-500">ACC:</span>
        정상 ${obj.ACC_processed} / 이상 ${obj.ACC_anomaly}
        (이상 ${accRate}%)
      </div>
    `;
    summaryContainer.appendChild(div);
  });

  // (B) 최근 1시간(5분) 히스토그램 4개
  renderLastHourCharts(data, "MACHINE2", "MIC", "lastHourChartCuringMic");
  renderLastHourCharts(data, "MACHINE2", "ACC", "lastHourChartCuringAcc");
  renderLastHourCharts(data, "MACHINE3", "MIC", "lastHourChartHotMic");
  renderLastHourCharts(data, "MACHINE3", "ACC", "lastHourChartHotAcc");

  // (C) 최근 1시간 상세(카드)
  lastHourDetailsEl.innerHTML = '';
  const lastHourArr = getLastHourMinuteData(data);

  lastHourArr.forEach(item => {
    const card = document.createElement('div');
    card.className = "bg-gray-50 rounded-lg p-3 shadow-sm";
    let machineHtml = '';
    Object.entries(item.machines).forEach(([mId, c]) => {
      const micStr = `정상 ${c.MIC_processed||0} / 이상 ${c.MIC_anomaly||0}`;
      const accStr = `정상 ${c.ACC_processed||0} / 이상 ${c.ACC_anomaly||0}`;

      machineHtml += `
        <div class="border-t pt-2 mt-2 text-sm">
          <div class="font-medium mb-1">${c.display_name || mId}</div>
          <div class="mb-1">
            <span class="text-blue-500 font-semibold">MIC:</span> ${micStr}
          </div>
          <div>
            <span class="text-green-500 font-semibold">ACC:</span> ${accStr}
          </div>
        </div>
      `;
    });

    card.innerHTML = `
      <div class="mb-2 font-semibold text-sm">${item.label}</div>
      ${machineHtml || `<div class="text-sm text-gray-400">데이터 없음</div>`}
    `;
    lastHourDetailsEl.appendChild(card);
  });
}

/* ----------------------------------------------------
   [1-A] "오늘 날짜"의 머신별 총합 (hourlyData 사용)
---------------------------------------------------- */
function getTodayMachineTotals(data){
  const hourlyData = data.hourlyData || {};
  const keys = Object.keys(hourlyData).sort();
  if (!keys.length) {
    return { displayDate:"데이터없음", totals:{} };
  }

  // 최신 key -> YYYYMMDD
  const latest = keys[keys.length-1]; // "20250314_09"
  const baseDate = latest.substring(0,8);

  // 해당 날짜만 필터
  const sameDayKeys = keys.filter(k => k.startsWith(baseDate));
  const totals = {};

  sameDayKeys.forEach(k=>{
    const machinesObj = hourlyData[k];
    Object.entries(machinesObj).forEach(([mId, c])=>{
      if (!totals[mId]){
        totals[mId] = {
          MIC_processed:0, MIC_anomaly:0,
          ACC_processed:0, ACC_anomaly:0,
          display_name: c.display_name || mId
        };
      }
      totals[mId].MIC_processed += (c.MIC_processed||0);
      totals[mId].MIC_anomaly  += (c.MIC_anomaly||0);
      totals[mId].ACC_processed += (c.ACC_processed||0);
      totals[mId].ACC_anomaly  += (c.ACC_anomaly||0);
    });
  });

  return {
    displayDate: formatDisplayDate(baseDate),
    totals
  };
}

/* ----------------------------------------------------
   [1-B] 최근 1시간(5분) 히스토그램 (machine×sensor)
---------------------------------------------------- */
function renderLastHourCharts(data, machineId, sensorKey, canvasId){
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;

  if (charts[canvasId]) charts[canvasId].destroy();

  const { labels, normals, anomalies } = getLastHourChartData(data, machineId, sensorKey);

  charts[canvasId] = new Chart(ctx, {
    type:'bar',
    data:{
      labels,
      datasets:[
        { label:'정상', data:normals, backgroundColor:chartColors.normal },
        { label:'이상', data:anomalies, backgroundColor:chartColors.anomaly }
      ]
    },
    options:{
      responsive:true,
      maintainAspectRatio:false,
      plugins:{ legend:{position:'top'} },
      scales:{
        x:{ 
          ticks:{ maxRotation:45, minRotation:30 } 
        },
        y:{ beginAtZero:true }
      }
    }
  });
}

// 실제 데이터 추출
function getLastHourChartData(data, machineId, sensorKey){
  const minuteData = data.minuteData || {};
  const now = new Date();
  const oneHourAgo = new Date(now.getTime()-60*60*1000);

  let labels=[], normals=[], anomalies=[];

  let cur = new Date(oneHourAgo.getTime());
  while(cur <= now){
    // 5분 버킷
    const y=cur.getFullYear();
    const m=String(cur.getMonth()+1).padStart(2,'0');
    const d=String(cur.getDate()).padStart(2,'0');
    const hh=String(cur.getHours()).padStart(2,'0');
    const buckMin=String(Math.floor(cur.getMinutes()/5)*5).padStart(2,'0');
    const minKey=`${y}${m}${d}_${hh}_${buckMin}`;

    const label=`${hh}:${buckMin}`;
    labels.push(label);

    let n=0, a=0;
    const mObj= minuteData[minKey] || {};
    if(mObj[machineId]){
      const c = mObj[machineId];
      const pk = sensorKey+"_processed";
      const ak = sensorKey+"_anomaly";
      n = c[pk]||0;
      a = c[ak]||0;
    }
    normals.push(n);
    anomalies.push(a);

    cur.setMinutes(cur.getMinutes()+5);
  }

  return { labels, normals, anomalies };
}

/* ----------------------------------------------------
   [1-C] 최근 1시간 (5분 단위) 상세 카드
---------------------------------------------------- */
function getLastHourMinuteData(data){
  const minuteData = data.minuteData || {};
  const now = new Date();
  const oneHourAgo = new Date(now.getTime()-60*60*1000);

  let result=[];
  let cur = new Date(oneHourAgo.getTime());
  while(cur < now){
    const startLabel = timeHHMM(cur);
    const next = new Date(cur.getTime()+5*60000);
    const endLabel = timeHHMM(next);

    // 버킷
    const y=cur.getFullYear();
    const m=String(cur.getMonth()+1).padStart(2,'0');
    const d=String(cur.getDate()).padStart(2,'0');
    const hh=String(cur.getHours()).padStart(2,'0');
    const buckMin=String(Math.floor(cur.getMinutes()/5)*5).padStart(2,'0');
    const minKey=`${y}${m}${d}_${hh}_${buckMin}`;

    const mObj= minuteData[minKey] || {};
    result.push({
      label: `${startLabel} ~ ${endLabel}`,
      machines: mObj
    });

    cur=next;
  }
  return result;
}
function timeHHMM(d){
  const hh=String(d.getHours()).padStart(2,'0');
  const mm=String(d.getMinutes()).padStart(2,'0');
  return hh+":"+mm;
}

/* ----------------------------------------------------
   [2] 주간 차트 (Week_1 -> "MM/DD ~ MM/DD")
---------------------------------------------------- */
function getWeekRangeLabel(weekKey, firstDateStr){
  const match = weekKey.match(/Week_(\d+)/);
  if(!match) return weekKey;
  const wNum= parseInt(match[1],10);

  const y= parseInt(firstDateStr.substring(0,4),10);
  const mon= parseInt(firstDateStr.substring(4,6),10)-1;
  const day= parseInt(firstDateStr.substring(6,8),10);

  const startDate= new Date(y,mon,day);
  startDate.setDate(startDate.getDate()+(wNum-1)*7);
  const endDate= new Date(startDate.getTime()+6*24*60*60*1000);

  const sLabel=`${startDate.getMonth()+1}/${startDate.getDate()}`;
  const eLabel=`${endDate.getMonth()+1}/${endDate.getDate()}`;
  return `${sLabel} ~ ${eLabel}`;
}

function getWeeklyMachineSensorData(weeklyData, machineName, sensorKey){
  const weeks= Object.keys(weeklyData).sort((a,b)=>{
    const aNum= parseInt(a.split('_')[1]||"0",10);
    const bNum= parseInt(b.split('_')[1]||"0",10);
    return aNum-bNum;
  });

  let labels=[], normals=[], anomalies=[];
  weeks.forEach(weekKey=>{
    const mo= weeklyData[weekKey][machineName];
    if(!mo){
      labels.push(weekKey);
      normals.push(0);
      anomalies.push(0);
      return;
    }
    const pKey= sensorKey+"_processed";
    const aKey= sensorKey+"_anomaly";
    labels.push(weekKey);
    normals.push(mo[pKey]||0);
    anomalies.push(mo[aKey]||0);
  });
  return { labels, normals, anomalies };
}

function renderWeeklyChart(chartId, tableId, dataset){
  const ctx= document.getElementById(chartId);
  if(!ctx) return;
  if(charts[chartId]) charts[chartId].destroy();

  charts[chartId]= new Chart(ctx, {
    type:'bar',
    data:{
      labels: dataset.labels,
      datasets:[
        { label:'정상', data:dataset.normals, backgroundColor: chartColors.normal },
        { label:'이상', data:dataset.anomalies, backgroundColor: chartColors.anomaly }
      ]
    },
    options:{
      responsive:true,
      maintainAspectRatio:false,
      plugins:{
        legend:{ position:'top' }
      },
      scales:{
        y:{ beginAtZero:true }
      }
    }
  });

  // 표
  const tableContainer= document.getElementById(tableId);
  if(tableContainer){
    let html=`
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
    dataset.labels.forEach((lbl,i)=>{
      const n= dataset.normals[i]||0;
      const a= dataset.anomalies[i]||0;
      const sum= n+a;
      const ratio= sum? ((a/sum)*100).toFixed(1)+"%":"-";
      html+=`
        <tr class="border-b">
          <td class="py-1 px-2">${lbl}</td>
          <td class="py-1 px-2">${n}</td>
          <td class="py-1 px-2 text-red-500">${a}</td>
          <td class="py-1 px-2">${ratio}</td>
        </tr>
      `;
    });
    html+=`</tbody></table>`;
    tableContainer.innerHTML= html;
  }
}

function renderWeeklyCharts(data){
  const weeklyData = data.weeklyData || {};
  const firstDateStr= data.first_date || "20250101_000000";

  // Curing Oven - MIC
  const dsCuringMic= getWeeklyMachineSensorData(weeklyData, "MACHINE2", "MIC");
  dsCuringMic.labels= dsCuringMic.labels.map(k=> getWeekRangeLabel(k, firstDateStr));
  renderWeeklyChart("weeklyChartCuringOvenMic","weeklyTableCuringOvenMic", dsCuringMic);

  // Curing Oven - ACC
  const dsCuringAcc= getWeeklyMachineSensorData(weeklyData, "MACHINE2", "ACC");
  dsCuringAcc.labels= dsCuringAcc.labels.map(k=> getWeekRangeLabel(k, firstDateStr));
  renderWeeklyChart("weeklyChartCuringOvenAcc","weeklyTableCuringOvenAcc", dsCuringAcc);

  // Hot Chamber - MIC
  const dsHotMic= getWeeklyMachineSensorData(weeklyData, "MACHINE3", "MIC");
  dsHotMic.labels= dsHotMic.labels.map(k=> getWeekRangeLabel(k, firstDateStr));
  renderWeeklyChart("weeklyChartHotChamberMic","weeklyTableHotChamberMic", dsHotMic);

  // Hot Chamber - ACC
  const dsHotAcc= getWeeklyMachineSensorData(weeklyData, "MACHINE3", "ACC");
  dsHotAcc.labels= dsHotAcc.labels.map(k=> getWeekRangeLabel(k, firstDateStr));
  renderWeeklyChart("weeklyChartHotChamberAcc","weeklyTableHotChamberAcc", dsHotAcc);
}

/* ----------------------------------------------------
   [3] 월별 차트 (MACHINE2/3 × MIC/ACC)
---------------------------------------------------- */
function getMonthlyMachineSensorData(monthlyData, machineName, sensorKey){
  const months= Object.keys(monthlyData).sort();
  let labels=[], normals=[], anomalies=[];
  months.forEach(m=>{
    const mo= monthlyData[m][machineName];
    if(!mo){
      labels.push(m);
      normals.push(0);
      anomalies.push(0);
      return;
    }
    const pk= sensorKey+"_processed";
    const ak= sensorKey+"_anomaly";
    labels.push(m);
    normals.push(mo[pk]||0);
    anomalies.push(mo[ak]||0);
  });
  return { labels, normals, anomalies };
}

function renderMonthlyChart(chartId, tableId, dataset){
  const ctx= document.getElementById(chartId);
  if(!ctx) return;
  if(charts[chartId]) charts[chartId].destroy();

  charts[chartId]= new Chart(ctx, {
    type:'bar',
    data:{
      labels: dataset.labels,
      datasets:[
        { label:'정상', data:dataset.normals, backgroundColor: chartColors.normal },
        { label:'이상', data:dataset.anomalies, backgroundColor: chartColors.anomaly }
      ]
    },
    options:{
      responsive:true,
      maintainAspectRatio:false,
      plugins:{
        legend:{ position:'top' }
      },
      scales:{
        y:{ beginAtZero:true }
      }
    }
  });

  // 표
  const tableContainer= document.getElementById(tableId);
  if(tableContainer){
    let html= `
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
    dataset.labels.forEach((lbl,i)=>{
      const n= dataset.normals[i]||0;
      const a= dataset.anomalies[i]||0;
      const total= n+a;
      const ratio= total? ((a/total)*100).toFixed(1)+"%":"-";
      html+= `
        <tr class="border-b">
          <td class="py-1 px-2">${lbl}</td>
          <td class="py-1 px-2">${n}</td>
          <td class="py-1 px-2 text-red-500">${a}</td>
          <td class="py-1 px-2">${ratio}</td>
        </tr>
      `;
    });
    html+= "</tbody></table>";
    tableContainer.innerHTML= html;
  }
}

function renderMonthlyCharts(data){
  const monthlyData= data.monthlyData || {};

  // Curing Oven - MIC
  const dsCuringMic= getMonthlyMachineSensorData(monthlyData, "MACHINE2", "MIC");
  renderMonthlyChart("monthlyChartCuringOvenMic","monthlyTableCuringOvenMic", dsCuringMic);

  // Curing Oven - ACC
  const dsCuringAcc= getMonthlyMachineSensorData(monthlyData, "MACHINE2", "ACC");
  renderMonthlyChart("monthlyChartCuringOvenAcc","monthlyTableCuringOvenAcc", dsCuringAcc);

  // Hot Chamber - MIC
  const dsHotMic= getMonthlyMachineSensorData(monthlyData, "MACHINE3", "MIC");
  renderMonthlyChart("monthlyChartHotChamberMic","monthlyTableHotChamberMic", dsHotMic);

  // Hot Chamber - ACC
  const dsHotAcc= getMonthlyMachineSensorData(monthlyData, "MACHINE3", "ACC");
  renderMonthlyChart("monthlyChartHotChamberAcc","monthlyTableHotChamberAcc", dsHotAcc);
}

/* ----------------------------------------------------
   [4] 페이지 로드 시 자동 새로고침
---------------------------------------------------- */
function setupAutoRefresh(){
  // 5분마다 loadData()
  setInterval(loadData, 5*60*1000);
}

document.addEventListener('DOMContentLoaded', function(){
  loadData();
  setupAutoRefresh();
});

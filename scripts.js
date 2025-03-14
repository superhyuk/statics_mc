// 전역 폰트 설정
Chart.defaults.font.family = "'Pretendard', 'Noto Sans KR', sans-serif";
Chart.defaults.font.size = 13;

// 차트 색상
const chartColors = {
  normal: 'rgba(54, 162, 235, 0.7)',
  anomaly: 'rgba(255, 99, 132, 0.7)',
};

let charts = {};

/* -----------------------------
   로딩 오버레이
----------------------------- */
function showLoading(){
  const ov = document.getElementById('loadingOverlay');
  if(ov){
    ov.classList.remove('invisible','opacity-0');
    ov.classList.add('visible','opacity-100');
  }
}
function hideLoading(){
  const ov= document.getElementById('loadingOverlay');
  if(ov){
    ov.classList.add('invisible','opacity-0');
    ov.classList.remove('visible','opacity-100');
  }
}

/* -----------------------------
   데이터 로드 + 대시보드 업데이트
----------------------------- */
async function loadData(){
  showLoading();
  try {
    const resp= await fetch('data_counts.json');
    const data= await resp.json();
    updateDashboard(data);
  } catch(err){
    console.error("데이터 로드 실패:", err);
  } finally {
    hideLoading();
  }
}

function updateDashboard(data){
  // 1) 최근 1시간 요약 (머신별)
  renderRecentHourSummary(data);

  // 2) 오늘 24시간 히스토그램
  renderTodayHistograms(data);

  // 3) 24시간 상세 (카드+접기)
  renderTodayHourCards(data);

  // 주간/월간 차트
  renderWeeklyCharts(data);
  renderMonthlyCharts(data);

  // 마지막 업데이트
  const lastUp= document.getElementById('lastUpdatedTime');
  if(lastUp){
    lastUp.textContent= data.updated_at || '-';
  }
}

/* -----------------------------
   1) 최근 1시간 데이터 (머신별 통계)
   - 예: 14:20 => 14:00 ~ 14:59 범위
----------------------------- */
function renderRecentHourSummary(data){
  const hourlyData= data.hourlyData || {};
  const container= document.getElementById('recentHourSummary');
  if(!container) return;

  container.innerHTML= '';

  // 현재 시각
  const now= new Date();
  // '시'만 맞춰서, 분초는 0
  const hourStart= new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), 0, 0);
  // hourKey 예) 20250314_14
  const hourKey= formatHourKey(hourStart);

  // 만약 14:20이라면 => 14시00~14시59에 들어오는 모든 파일은 hourKey="20250314_14" 로 들어올 것
  const machineObj= hourlyData[hourKey] || {};

  // 머신별 합산
  if(!Object.keys(machineObj).length){
    container.innerHTML= `<div class="bg-white p-4 rounded shadow">최근 1시간 (${hourStart.getHours()}시) 데이터가 없습니다.</div>`;
    return;
  }

  Object.entries(machineObj).forEach(([mId, c])=>{
    const micTotal= (c.MIC_processed||0)+(c.MIC_anomaly||0);
    const accTotal= (c.ACC_processed||0)+(c.ACC_anomaly||0);
    const micRate= micTotal?((c.MIC_anomaly||0)/micTotal*100).toFixed(1):0;
    const accRate= accTotal?((c.ACC_anomaly||0)/accTotal*100).toFixed(1):0;

    const card= document.createElement('div');
    card.className= "bg-white rounded-lg shadow p-4";
    card.innerHTML=`
      <h3 class="font-medium text-lg mb-2">${c.display_name||mId}</h3>
      <div class="text-sm mb-1">
        <span class="font-semibold text-blue-500">MIC:</span>
        정상 ${c.MIC_processed||0} / 이상 ${c.MIC_anomaly||0}
        (이상 ${micRate}%)
      </div>
      <div class="text-sm">
        <span class="font-semibold text-green-500">ACC:</span>
        정상 ${c.ACC_processed||0} / 이상 ${c.ACC_anomaly||0}
        (이상 ${accRate}%)
      </div>
    `;
    container.appendChild(card);
  });
}

// hourKey = YYYYMMDD_HH
function formatHourKey(d){
  const y= d.getFullYear();
  const m= String(d.getMonth()+1).padStart(2,'0');
  const dd= String(d.getDate()).padStart(2,'0');
  const hh= String(d.getHours()).padStart(2,'0');
  return `${y}${m}${dd}_${hh}`;
}

/* -----------------------------
   2) 오늘(24시간) 히스토그램
   - MACHINE2, MACHINE3 × MIC, ACC => 4개
----------------------------- */
function renderTodayHistograms(data){
  // MACHINE2 => Curing Oven, MACHINE3 => Hot Chamber
  renderOneDayChart(data, "MACHINE2", "MIC", "chartCuringMic");
  renderOneDayChart(data, "MACHINE2", "ACC", "chartCuringAcc");
  renderOneDayChart(data, "MACHINE3", "MIC", "chartHotMic");
  renderOneDayChart(data, "MACHINE3", "ACC", "chartHotAcc");
}

function renderOneDayChart(data, machineId, sensorKey, canvasId){
  const ctx= document.getElementById(canvasId);
  if(!ctx) return;

  if(charts[canvasId]){
    charts[canvasId].destroy();
  }

  const hourlyData= data.hourlyData || {};
  // 오늘 날짜(YYYYMMDD) 식별
  const keys= Object.keys(hourlyData).sort();
  if(!keys.length){
    // 데이터가 전혀 없는 경우
    charts[canvasId]= new Chart(ctx,{type:'bar',data:{labels:[],datasets:[]}});
    return;
  }

  const latest= keys[keys.length-1]; // ex "20250314_14"
  const baseDate= latest.substring(0,8); // "20250314"

  // 0~23시
  let labels=[], normalArr=[], anomalyArr=[];

  for(let h=0; h<24; h++){
    const hh= String(h).padStart(2,'0');
    const hourKey= `${baseDate}_${hh}`;
    const mo= hourlyData[hourKey] || {};
    const c= mo[machineId];
    let n=0, a=0;
    if(c){
      const pk= sensorKey+"_processed";
      const ak= sensorKey+"_anomaly";
      n= c[pk]||0;
      a= c[ak]||0;
    }
    labels.push(`${h}시`);
    normalArr.push(n);
    anomalyArr.push(a);
  }

  charts[canvasId]= new Chart(ctx, {
    type:'bar',
    data:{
      labels,
      datasets:[
        { label:'정상', data:normalArr, backgroundColor:chartColors.normal },
        { label:'이상', data:anomalyArr, backgroundColor:chartColors.anomaly }
      ]
    },
    options:{
      responsive:true,
      maintainAspectRatio:false,
      plugins:{ legend:{ position:'top'} },
      scales:{
        x:{
          ticks:{
            maxRotation:45,
            minRotation:30
          }
        },
        y:{ beginAtZero:true }
      }
    }
  });
}

/* -----------------------------
   3) 24시간 상세 (카드+접기)
   - accordion 내에 각 시간(0~23)별 카드
----------------------------- */
function renderTodayHourCards(data){
  const container= document.getElementById('todayHourCards');
  if(!container) return;

  const hourlyData= data.hourlyData || {};
  container.innerHTML= '';

  const keys= Object.keys(hourlyData).sort();
  if(!keys.length){
    container.innerHTML= `<div class="text-sm text-gray-500">데이터가 없습니다.</div>`;
    return;
  }

  const latest= keys[keys.length-1]; // "20250314_14"
  const baseDate= latest.substring(0,8);

  // 0~23시
  for(let h=0; h<24; h++){
    const hh= String(h).padStart(2,'0');
    const hourKey= `${baseDate}_${hh}`;
    const mo= hourlyData[hourKey] || {};

    let cardHtml= `<h3 class="font-semibold mb-2">${h}시</h3>`;
    const mchKeys= Object.keys(mo);

    if(!mchKeys.length){
      cardHtml+= `<div class="text-sm text-gray-400">데이터 없음</div>`;
    } else {
      mchKeys.forEach(mId=>{
        const c= mo[mId];
        const micStr= `정상 ${c.MIC_processed||0} / 이상 ${c.MIC_anomaly||0}`;
        const accStr= `정상 ${c.ACC_processed||0} / 이상 ${c.ACC_anomaly||0}`;
        cardHtml+= `
          <div class="border-t pt-2 mt-2 text-sm">
            <div class="font-medium mb-1">${c.display_name||mId}</div>
            <div class="mb-1 text-blue-500 font-semibold">MIC: <span class="text-black font-normal">${micStr}</span></div>
            <div class="text-green-500 font-semibold">ACC: <span class="text-black font-normal">${accStr}</span></div>
          </div>
        `;
      });
    }

    const card= document.createElement('div');
    card.className= "bg-gray-50 rounded-lg shadow p-4";
    card.innerHTML= cardHtml;
    container.appendChild(card);
  }
}

/* -----------------------------
   [주간/월간 차트 - 기존 그대로]
----------------------------- */
function getWeekRangeLabel(weekKey, firstDateStr){
  const m= weekKey.match(/Week_(\d+)/);
  if(!m) return weekKey;
  const wNum= parseInt(m[1],10);

  const y= parseInt(firstDateStr.substring(0,4),10);
  const mo= parseInt(firstDateStr.substring(4,6),10)-1;
  const d= parseInt(firstDateStr.substring(6,8),10);
  const start= new Date(y,mo,d);
  start.setDate(start.getDate()+(wNum-1)*7);
  const end= new Date(start.getTime()+6*24*60*60*1000);
  const sLabel= `${start.getMonth()+1}/${start.getDate()}`;
  const eLabel= `${end.getMonth()+1}/${end.getDate()}`;
  return `${sLabel} ~ ${eLabel}`;
}

function getWeeklyMachineSensorData(weeklyData, machineName, sensorKey){
  const weeks= Object.keys(weeklyData).sort((a,b)=>{
    const wA= parseInt(a.split('_')[1]||"0",10);
    const wB= parseInt(b.split('_')[1]||"0",10);
    return wA-wB;
  });
  let labels=[], normals=[], anomalies=[];
  weeks.forEach(wk=>{
    const mo= weeklyData[wk][machineName];
    if(!mo){
      labels.push(wk); normals.push(0); anomalies.push(0);
      return;
    }
    const pk= sensorKey+"_processed";
    const ak= sensorKey+"_anomaly";
    normals.push(mo[pk]||0);
    anomalies.push(mo[ak]||0);
    labels.push(wk);
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
        {label:'정상', data:dataset.normals, backgroundColor:chartColors.normal},
        {label:'이상', data:dataset.anomalies, backgroundColor:chartColors.anomaly}
      ]
    },
    options:{
      responsive:true,
      maintainAspectRatio:false,
      plugins:{ legend:{ position:'top'} },
      scales:{ y:{ beginAtZero:true } }
    }
  });

  const tbl= document.getElementById(tableId);
  if(tbl){
    let html=`
      <table class="w-full text-sm border-t border-b">
        <thead>
          <tr class="bg-gray-50 border-b">
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
      const total= n+a;
      const ratio= total? ((a/total)*100).toFixed(1)+"%":"-";
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
    tbl.innerHTML= html;
  }
}
function renderWeeklyCharts(data){
  const wd= data.weeklyData||{};
  const fd= data.first_date||"20250101_000000";

  // Curing Oven - MIC
  const dsCuringMic= getWeeklyMachineSensorData(wd, "MACHINE2", "MIC");
  dsCuringMic.labels= dsCuringMic.labels.map(k=> getWeekRangeLabel(k,fd));
  renderWeeklyChart("weeklyChartCuringOvenMic","weeklyTableCuringOvenMic", dsCuringMic);

  // Curing Oven - ACC
  const dsCuringAcc= getWeeklyMachineSensorData(wd, "MACHINE2", "ACC");
  dsCuringAcc.labels= dsCuringAcc.labels.map(k=> getWeekRangeLabel(k,fd));
  renderWeeklyChart("weeklyChartCuringOvenAcc","weeklyTableCuringOvenAcc", dsCuringAcc);

  // Hot Chamber - MIC
  const dsHotMic= getWeeklyMachineSensorData(wd, "MACHINE3", "MIC");
  dsHotMic.labels= dsHotMic.labels.map(k=> getWeekRangeLabel(k,fd));
  renderWeeklyChart("weeklyChartHotChamberMic","weeklyTableHotChamberMic", dsHotMic);

  // Hot Chamber - ACC
  const dsHotAcc= getWeeklyMachineSensorData(wd, "MACHINE3", "ACC");
  dsHotAcc.labels= dsHotAcc.labels.map(k=> getWeekRangeLabel(k,fd));
  renderWeeklyChart("weeklyChartHotChamberAcc","weeklyTableHotChamberAcc", dsHotAcc);
}

/* -----------------------------
   월별
----------------------------- */
function getMonthlyMachineSensorData(md,machineName,sensorKey){
  const months= Object.keys(md).sort();
  let labels=[], normals=[], anomalies=[];
  months.forEach(m=>{
    const mo= md[m][machineName];
    if(!mo){ labels.push(m); normals.push(0); anomalies.push(0); return;}
    const pk= sensorKey+"_processed", ak= sensorKey+"_anomaly";
    normals.push(mo[pk]||0);
    anomalies.push(mo[ak]||0);
    labels.push(m);
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
      labels:dataset.labels,
      datasets:[
        {label:'정상', data:dataset.normals, backgroundColor:chartColors.normal},
        {label:'이상', data:dataset.anomalies, backgroundColor:chartColors.anomaly}
      ]
    },
    options:{
      responsive:true,
      maintainAspectRatio:false,
      plugins:{ legend:{position:'top'} },
      scales:{ y:{ beginAtZero:true } }
    }
  });

  const tbl= document.getElementById(tableId);
  if(tbl){
    let html=`
      <table class="w-full text-sm border-t border-b">
        <thead>
          <tr class="bg-gray-50 border-b">
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
    tbl.innerHTML= html;
  }
}
function renderMonthlyCharts(data){
  const md= data.monthlyData||{};

  // Curing Oven - MIC
  const dsCuringMic= getMonthlyMachineSensorData(md,"MACHINE2","MIC");
  renderMonthlyChart("monthlyChartCuringOvenMic","monthlyTableCuringOvenMic", dsCuringMic);

  // Curing Oven - ACC
  const dsCuringAcc= getMonthlyMachineSensorData(md,"MACHINE2","ACC");
  renderMonthlyChart("monthlyChartCuringOvenAcc","monthlyTableCuringOvenAcc", dsCuringAcc);

  // Hot Chamber - MIC
  const dsHotMic= getMonthlyMachineSensorData(md,"MACHINE3","MIC");
  renderMonthlyChart("monthlyChartHotChamberMic","monthlyTableHotChamberMic", dsHotMic);

  // Hot Chamber - ACC
  const dsHotAcc= getMonthlyMachineSensorData(md,"MACHINE3","ACC");
  renderMonthlyChart("monthlyChartHotChamberAcc","monthlyTableHotChamberAcc", dsHotAcc);
}

/* -----------------------------
   자동 새로고침
----------------------------- */
function setupAutoRefresh(){
  // 5분마다 loadData
  setInterval(loadData, 5*60*1000);
}

document.addEventListener('DOMContentLoaded',()=>{
  loadData();
  setupAutoRefresh();
});

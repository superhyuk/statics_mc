// 전역 폰트 설정
Chart.defaults.font.family = "'Pretendard', 'Noto Sans KR', sans-serif";
Chart.defaults.font.size = 13;

const chartColors = {
  normal: 'rgba(54, 162, 235, 0.7)',
  anomaly: 'rgba(255, 99, 132, 0.7)'
};

let charts = {};

/* ------------------------------------
   로딩 오버레이
------------------------------------ */
function showLoading(){
  const ov= document.getElementById('loadingOverlay');
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

/* ------------------------------------
   데이터 로드 + 업데이트
------------------------------------ */
async function loadData(){
  showLoading();
  try {
    const resp= await fetch('data_counts.json');
    const data= await resp.json();
    updateDashboard(data);
  } catch(err){
    console.error("데이터 로드 실패:", err);
  } finally{
    hideLoading();
  }
}

function updateDashboard(data){
  // (1) 이전 1시간
  renderRecentHour(data);

  // (2) 오늘(24시간) 히스토그램
  renderTodayHistograms(data);

  // (3) 24시간 상세
  renderTodayHourCards(data);

  // (4) 주별
  renderWeeklyCharts(data);

  // (5) 월별
  renderMonthlyCharts(data);

  // 마지막 업데이트
  const lastUp= document.getElementById('lastUpdatedTime');
  if(lastUp){
    lastUp.textContent= data.updated_at || '-';
  }
}

/* ------------------------------------
   (1) 이전 1시간
   - "hourlyData"에서 가장 최근 HourKey를 찾고,
   - 그 바로 이전 HourKey를 표시
------------------------------------ */
function renderRecentHour(data){
  const container= document.getElementById('recentHourSummary');
  const titleEl  = document.getElementById('recentHourTitle');
  if(!container || !titleEl) return;

  container.innerHTML= '';

  const hourlyData= data.hourlyData || {};
  const hourKeys= Object.keys(hourlyData).sort();
  if(!hourKeys.length){
    titleEl.textContent= "이전 1시간 (데이터 없음)";
    return;
  }

  // 가장 최신 hourKey => ex "20250314_14"
  const latestKey= hourKeys[hourKeys.length-1];
  
  // 그 바로 전 hourKey 찾기
  // ex) if latestKey= "20250314_14", then prevHourKey= "20250314_13"
  const prevIndex= hourKeys.length-2; 
  if(prevIndex < 0){
    // hourKeys가 1개 뿐이면 "이전1시간"이 없음
    titleEl.textContent= "이전 1시간 데이터 없음(기록이 너무 적음)";
    return;
  }
  const prevHourKey= hourKeys[prevIndex];

  // "YYYYMMDD_HH" -> "YYYY.MM.DD HH:00 ~ HH+1:00"
  const baseDate= prevHourKey.substring(0,8); // "20250314"
  const hourStr= prevHourKey.substring(9,11); // "13"
  const h= parseInt(hourStr, 10);

  const yyyy= baseDate.substring(0,4);
  const mm= baseDate.substring(4,6);
  const dd= baseDate.substring(6,8);
  titleEl.textContent= `${yyyy}.${mm}.${dd} ${h}:00 ~ ${h+1}:00 (이전 1시간)`;

  // 머신별 데이터
  const machineObj= hourlyData[prevHourKey];
  if(!machineObj || !Object.keys(machineObj).length){
    container.innerHTML= `<div class="bg-white p-4 rounded shadow text-gray-500">이전1시간(${prevHourKey}) 데이터 없음</div>`;
    return;
  }

  // 머신별 카드
  Object.entries(machineObj).forEach(([mId,c])=>{
    const micTotal= (c.MIC_processed||0)+(c.MIC_anomaly||0);
    const accTotal= (c.ACC_processed||0)+(c.ACC_anomaly||0);
    const micRate= micTotal? ((c.MIC_anomaly||0)/micTotal*100).toFixed(1):0;
    const accRate= accTotal? ((c.ACC_anomaly||0)/accTotal*100).toFixed(1):0;

    const div= document.createElement('div');
    div.className= "bg-white rounded-lg shadow p-4";
    div.innerHTML=`
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
    container.appendChild(div);
  });
}

/* ------------------------------------
   (2) 오늘(24시간) 히스토그램
   - X축: "0-1시, 1-2시..." (가로표시)
------------------------------------ */
function renderTodayHistograms(data){
  const titleEl= document.getElementById('todayTitle');
  const hourlyData= data.hourlyData || {};
  const hKeys= Object.keys(hourlyData).sort();
  if(!hKeys.length){
    titleEl.textContent= "오늘(24시간) 데이터 없음";
    return;
  }
  
  // latest key => "YYYYMMDD_HH"
  const latest= hKeys[hKeys.length-1];
  const baseDate= latest.substring(0,8);
  
  // "YYYY.MM.DD"
  const yyyy= baseDate.substring(0,4);
  const mm= baseDate.substring(4,6);
  const dd= baseDate.substring(6,8);
  titleEl.textContent= `${yyyy}.${mm}.${dd} (24시간) 히스토그램`;

  renderOneDayChart(data, "MACHINE2", "MIC",  "chartCuringMic");
  renderOneDayChart(data, "MACHINE2", "ACC",  "chartCuringAcc");
  renderOneDayChart(data, "MACHINE3", "MIC",  "chartHotMic");
  renderOneDayChart(data, "MACHINE3", "ACC",  "chartHotAcc");
}

function renderOneDayChart(data, machineId, sensorKey, canvasId){
  const ctx= document.getElementById(canvasId);
  if(!ctx) return;

  if(charts[canvasId]) charts[canvasId].destroy();

  const hourlyData= data.hourlyData || {};
  const hKeys= Object.keys(hourlyData).sort();
  if(!hKeys.length){
    charts[canvasId]= new Chart(ctx,{type:'bar', data:{labels:[],datasets:[]}});
    return;
  }
  const latest= hKeys[hKeys.length-1];
  const baseDate= latest.substring(0,8);

  let labels=[], normalArr=[], anomalyArr=[];
  for(let h=0; h<24; h++){
    const hh= String(h).padStart(2,'0');
    const hourKey= baseDate+"_"+hh;
    const mo= hourlyData[hourKey]||{};
    const c= mo[machineId];
    let n=0,a=0;
    if(c){
      const pk= sensorKey+"_processed";
      const ak= sensorKey+"_anomaly";
      n= c[pk]||0;
      a= c[ak]||0;
    }
    // "0-1시"
    labels.push(`${h}-${h+1}시`);
    normalArr.push(n);
    anomalyArr.push(a);
  }

  charts[canvasId]= new Chart(ctx,{
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
      plugins:{
        legend:{ position:'top' }
      },
      scales:{
        x:{
          ticks:{
            // 사선 없애기
            maxRotation:0,
            minRotation:0
          }
        },
        y:{
          beginAtZero:true
        }
      }
    }
  });
}

/* ------------------------------------
   (3) 24시간 상세 (카드)
   - "h-(h+1)시"
------------------------------------ */
function renderTodayHourCards(data){
  const container= document.getElementById('todayHourCards');
  if(!container) return;
  container.innerHTML= '';

  const hourlyData= data.hourlyData||{};
  const hKeys= Object.keys(hourlyData).sort();
  if(!hKeys.length){
    container.innerHTML= `<div class="text-gray-500">데이터 없음</div>`;
    return;
  }
  
  const latest= hKeys[hKeys.length-1];
  const baseDate= latest.substring(0,8);

  for(let h=0; h<24; h++){
    const hh= String(h).padStart(2,'0');
    const hourKey= baseDate+"_"+hh;
    const mo= hourlyData[hourKey]||{};

    const label= `${h}-${h+1}시`;
    let cardHtml= `<h3 class="font-semibold mb-2">${label}</h3>`;

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
            <div class="mb-1 text-blue-500 font-semibold">
              MIC: <span class="text-black font-normal">${micStr}</span>
            </div>
            <div class="text-green-500 font-semibold">
              ACC: <span class="text-black font-normal">${accStr}</span>
            </div>
          </div>
        `;
      });
    }

    const div= document.createElement('div');
    div.className= "bg-gray-50 rounded-lg shadow p-4";
    div.innerHTML= cardHtml;
    container.appendChild(div);
  }
}

/* ------------------------------------
   (4) 주별 차트
------------------------------------ */
function getWeekRangeLabel(weekKey, firstDateStr){
  const match= weekKey.match(/Week_(\d+)/);
  if(!match) return weekKey;
  const wNum= parseInt(match[1],10);

  const y= parseInt(firstDateStr.substring(0,4),10);
  const mo= parseInt(firstDateStr.substring(4,6),10)-1;
  const d= parseInt(firstDateStr.substring(6,8),10);
  const start= new Date(y, mo, d);
  start.setDate(start.getDate() + (wNum-1)*7);
  const end= new Date(start.getTime()+6*24*60*60*1000);

  const sLabel= `${start.getMonth()+1}/${start.getDate()}`;
  const eLabel= `${end.getMonth()+1}/${end.getDate()}`;
  return `${sLabel}~${eLabel}`;
}

function getWeeklyMachineSensorData(weeklyData, machineName, sensorKey){
  const wKeys= Object.keys(weeklyData).sort((a,b)=>{
    const aNum= parseInt(a.split('_')[1]||"0",10);
    const bNum= parseInt(b.split('_')[1]||"0",10);
    return aNum-bNum;
  });
  let labels=[], normals=[], anomalies=[];
  wKeys.forEach(weekKey=>{
    const mo= weeklyData[weekKey][machineName];
    if(!mo){
      labels.push(weekKey);
      normals.push(0);
      anomalies.push(0);
      return;
    }
    const pk= sensorKey+"_processed";
    const ak= sensorKey+"_anomaly";
    normals.push(mo[pk]||0);
    anomalies.push(mo[ak]||0);
    labels.push(weekKey);
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
      plugins:{ legend:{ position:'top' } },
      scales:{
        x:{ 
          ticks:{
            // 가로 표시
            maxRotation:0,
            minRotation:0
          }
        },
        y:{ beginAtZero:true }
      }
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
            <th class="py-1 px-2">이상비율</th>
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
    html+= "</tbody></table>";
    tbl.innerHTML= html;
  }
}

function renderWeeklyCharts(data){
  const wd= data.weeklyData||{};
  const firstDt= data.first_date||"20250101_000000";

  // Curing Oven - MIC
  const dsCuringMic= getWeeklyMachineSensorData(wd, "MACHINE2", "MIC");
  dsCuringMic.labels= dsCuringMic.labels.map(k=> getWeekRangeLabel(k, firstDt));
  renderWeeklyChart("weeklyChartCuringOvenMic","weeklyTableCuringOvenMic", dsCuringMic);

  // Curing Oven - ACC
  const dsCuringAcc= getWeeklyMachineSensorData(wd, "MACHINE2", "ACC");
  dsCuringAcc.labels= dsCuringAcc.labels.map(k=> getWeekRangeLabel(k, firstDt));
  renderWeeklyChart("weeklyChartCuringOvenAcc","weeklyTableCuringOvenAcc", dsCuringAcc);

  // Hot Chamber - MIC
  const dsHotMic= getWeeklyMachineSensorData(wd, "MACHINE3", "MIC");
  dsHotMic.labels= dsHotMic.labels.map(k=> getWeekRangeLabel(k, firstDt));
  renderWeeklyChart("weeklyChartHotChamberMic","weeklyTableHotChamberMic", dsHotMic);

  // Hot Chamber - ACC
  const dsHotAcc= getWeeklyMachineSensorData(wd, "MACHINE3", "ACC");
  dsHotAcc.labels= dsHotAcc.labels.map(k=> getWeekRangeLabel(k, firstDt));
  renderWeeklyChart("weeklyChartHotChamberAcc","weeklyTableHotChamberAcc", dsHotAcc);
}

/* ------------------------------------
   (5) 월별
------------------------------------ */
function getMonthlyMachineSensorData(md, machineName, sensorKey){
  const mKeys= Object.keys(md).sort();
  let labels=[], normals=[], anomalies=[];
  mKeys.forEach(m=>{
    const mo= md[m][machineName];
    if(!mo){
      labels.push(m);
      normals.push(0);
      anomalies.push(0);
      return;
    }
    const pk= sensorKey+"_processed";
    const ak= sensorKey+"_anomaly";
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

  charts[chartId]= new Chart(ctx,{
    type:'bar',
    data:{
      labels: dataset.labels,
      datasets:[
        {label:'정상', data: dataset.normals, backgroundColor: chartColors.normal},
        {label:'이상', data: dataset.anomalies, backgroundColor: chartColors.anomaly}
      ]
    },
    options:{
      responsive:true,
      maintainAspectRatio:false,
      plugins:{ legend:{position:'top'} },
      scales:{
        x:{ 
          ticks:{
            maxRotation:0,
            minRotation:0
          }
        },
        y:{ beginAtZero:true }
      }
    }
  });

  const tbl= document.getElementById(tableId);
  if(tbl){
    let html= `
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
    html+= "</tbody></table>";
    tbl.innerHTML= html;
  }
}

function renderMonthlyCharts(data){
  const md= data.monthlyData||{};
  
  // Curing Oven - MIC
  const dsCuringMic= getMonthlyMachineSensorData(md, "MACHINE2", "MIC");
  renderMonthlyChart("monthlyChartCuringOvenMic","monthlyTableCuringOvenMic", dsCuringMic);

  // Curing Oven - ACC
  const dsCuringAcc= getMonthlyMachineSensorData(md, "MACHINE2", "ACC");
  renderMonthlyChart("monthlyChartCuringOvenAcc","monthlyTableCuringOvenAcc", dsCuringAcc);

  // Hot Chamber - MIC
  const dsHotMic= getMonthlyMachineSensorData(md, "MACHINE3", "MIC");
  renderMonthlyChart("monthlyChartHotChamberMic","monthlyTableHotChamberMic", dsHotMic);

  // Hot Chamber - ACC
  const dsHotAcc= getMonthlyMachineSensorData(md, "MACHINE3", "ACC");
  renderMonthlyChart("monthlyChartHotChamberAcc","monthlyTableHotChamberAcc", dsHotAcc);
}

/* ------------------------------------
   자동 새로고침(5분)
------------------------------------ */
function setupAutoRefresh(){
  setInterval(loadData, 5 * 60 * 1000);
}

document.addEventListener('DOMContentLoaded', ()=>{
  loadData();
  setupAutoRefresh();
});

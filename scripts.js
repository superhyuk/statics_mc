// 전역 폰트 설정
Chart.defaults.font.family = "'Pretendard', 'Noto Sans KR', sans-serif";
Chart.defaults.font.size = 13;

// 차트 색상
const chartColors = {
  normal: 'rgba(54, 162, 235, 0.7)',
  anomaly: 'rgba(255, 99, 132, 0.7)'
};

let charts = {};

/* ------------------------------------------
   로딩 오버레이
------------------------------------------ */
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

/* ------------------------------------------
   데이터 로드 & 대시보드 업데이트
------------------------------------------ */
async function loadData(){
  showLoading();
  try {
    const res= await fetch('data_counts.json');
    const data= await res.json();
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

  // 주/월 차트
  renderWeeklyCharts(data);
  renderMonthlyCharts(data);

  // 업데이트 시각
  const lastUp= document.getElementById('lastUpdatedTime');
  if(lastUp){
    lastUp.textContent= data.updated_at || '-';
  }
}

/* ------------------------------------------
   (1) 이전 1시간
   -> now=14:20 => 13:00~14:00 범위
------------------------------------------ */
function renderRecentHour(data){
  const container= document.getElementById('recentHourSummary');
  const titleEl  = document.getElementById('recentHourTitle');
  if(!container || !titleEl) return;

  container.innerHTML= '';

  const now= new Date();
  // "정각 한 시간 전"
  // 예: 14:20 => hourStart=13:00
  const hourStart= new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours()-1, 0, 0);
  
  const dateStr= formatDateYMD(hourStart); // "2025.03.14"
  const hh= hourStart.getHours();         // 13
  // 제목 "YYYY.MM.DD 13:00 ~ 14:00"
  titleEl.textContent= `${dateStr} ${hh}:00 ~ ${hh+1}:00 데이터 집계`;

  // hourKey= YYYYMMDD_HH
  const hourKey= formatHourKey(hourStart);

  // 가져오기
  const hourlyData= data.hourlyData || {};
  const machineObj= hourlyData[hourKey] || {};

  if(!Object.keys(machineObj).length){
    container.innerHTML= `<div class="bg-white p-4 rounded shadow text-gray-500">이전 한 시간(${hh}:00~${hh+1}:00) 데이터가 없습니다.</div>`;
    return;
  }

  // 머신별 카드
  Object.entries(machineObj).forEach(([mId, c])=>{
    const micTotal= (c.MIC_processed||0)+(c.MIC_anomaly||0);
    const accTotal= (c.ACC_processed||0)+(c.ACC_anomaly||0);
    const micRate= micTotal? ((c.MIC_anomaly||0)/micTotal*100).toFixed(1):0;
    const accRate= accTotal? ((c.ACC_anomaly||0)/accTotal*100).toFixed(1):0;

    const div= document.createElement('div');
    div.className= "bg-white rounded-lg shadow p-4";
    div.innerHTML=`
      <h3 class="font-medium text-lg mb-2">${c.display_name || mId}</h3>
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

// YYYYMMDD_HH
function formatHourKey(d){
  const yy= d.getFullYear();
  const mm= String(d.getMonth()+1).padStart(2,'0');
  const dd= String(d.getDate()).padStart(2,'0');
  const hh= String(d.getHours()).padStart(2,'0');
  return `${yy}${mm}${dd}_${hh}`;
}

function formatDateYMD(d){
  // "YYYY.MM.DD"
  const yy= d.getFullYear();
  const mm= String(d.getMonth()+1).padStart(2,'0');
  const dd= String(d.getDate()).padStart(2,'0');
  return `${yy}.${mm}.${dd}`;
}

/* ------------------------------------------
   (2) 오늘(24시간) 히스토그램
   x축: "0-1시, 1-2시, ..." + 라벨 회전=0
------------------------------------------ */
function renderTodayHistograms(data){
  const titleEl= document.getElementById('todayTitle');
  const hourlyData= data.hourlyData || {};
  const keys= Object.keys(hourlyData).sort();
  if(!keys.length){
    titleEl.textContent= "오늘 날짜 데이터가 없습니다.";
    return;
  }
  // 최신키= "20250314_15" => YYYYMMDD
  const latest= keys[keys.length-1];
  const baseDate= latest.substring(0,8);
  // => "2025.03.14"
  const y= baseDate.substring(0,4);
  const m= baseDate.substring(4,6);
  const d= baseDate.substring(6,8);
  titleEl.textContent= `${y}.${m}.${d} 데이터 분포`;

  // 4개 차트
  renderOneDayChart(data, "MACHINE2", "MIC",  "chartCuringMic");
  renderOneDayChart(data, "MACHINE2", "ACC",  "chartCuringAcc");
  renderOneDayChart(data, "MACHINE3", "MIC",  "chartHotMic");
  renderOneDayChart(data, "MACHINE3", "ACC",  "chartHotAcc");
}

function renderOneDayChart(data, machineId, sensorKey, canvasId){
  const ctx= document.getElementById(canvasId);
  if(!ctx) return;

  if(charts[canvasId]){
    charts[canvasId].destroy();
  }

  const hourlyData= data.hourlyData || {};
  const keys= Object.keys(hourlyData).sort();
  if(!keys.length){
    charts[canvasId]= new Chart(ctx,{type:'bar',data:{labels:[],datasets:[]}});
    return;
  }

  // YYYYMMDD
  const latest= keys[keys.length-1];
  const baseDate= latest.substring(0,8);

  let labels=[], normalData=[], anomalyData=[];

  for(let h=0; h<24; h++){
    const hh= String(h).padStart(2,'0');
    const hourKey= baseDate+"_"+hh;
    const mo= hourlyData[hourKey] || {};
    const c= mo[machineId];
    let n=0,a=0;
    if(c){
      const pk= sensorKey+"_processed";
      const ak= sensorKey+"_anomaly";
      n= c[pk]||0;
      a= c[ak]||0;
    }
    // 라벨: "h-(h+1)시"
    labels.push(`${h}-${h+1}시`);
    normalData.push(n);
    anomalyData.push(a);
  }

  charts[canvasId]= new Chart(ctx, {
    type:'bar',
    data:{
      labels,
      datasets:[
        { label:'정상', data: normalData, backgroundColor: chartColors.normal },
        { label:'이상', data: anomalyData, backgroundColor: chartColors.anomaly }
      ]
    },
    options:{
      responsive:true,
      maintainAspectRatio:false,
      plugins:{ 
        legend:{ position:'top'} 
      },
      scales:{
        x:{
          // 라벨 회전=0 (가로로 표시)
          ticks:{
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

/* ------------------------------------------
   (3) 24시간 상세 (카드)
   각 시간 -> "h-(h+1)시"
------------------------------------------ */
function renderTodayHourCards(data){
  const container= document.getElementById('todayHourCards');
  if(!container) return;
  container.innerHTML= '';

  const hourlyData= data.hourlyData || {};
  const keys= Object.keys(hourlyData).sort();
  if(!keys.length){
    container.innerHTML= `<div class="text-gray-500">데이터가 없습니다.</div>`;
    return;
  }

  // YYYYMMDD
  const latest= keys[keys.length-1]; // "20250314_14"
  const baseDate= latest.substring(0,8);

  for(let h=0; h<24; h++){
    const hh= String(h).padStart(2,'0');
    const hourKey= baseDate+"_"+hh;
    const mo= hourlyData[hourKey] || {};

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

/* ------------------------------------------
   주간/월간 부분 (변경 없음)
------------------------------------------ */
function getWeekRangeLabel(weekKey, firstDateStr){ /* ... */ }
function getWeeklyMachineSensorData(weeklyData, machineName, sensorKey){ /* ... */ }
function renderWeeklyChart(chartId, tableId, dataset){ /* ... */ }
function renderWeeklyCharts(data){ /* ... */ }
function getMonthlyMachineSensorData(md,machineName,sensorKey){ /* ... */ }
function renderMonthlyChart(chartId, tableId, dataset){ /* ... */ }
function renderMonthlyCharts(data){ /* ... */ }

/* ------------------------------------------
   자동 새로고침 (5분)
------------------------------------------ */
function setupAutoRefresh(){
  setInterval(loadData, 5*60*1000);
}

document.addEventListener('DOMContentLoaded',()=>{
  loadData();
  setupAutoRefresh();
});

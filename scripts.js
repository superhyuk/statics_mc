// 전역 폰트 설정
Chart.defaults.font.family = "'D2Coding', 'Pretendard', 'Noto Sans KR', sans-serif";
Chart.defaults.font.size = 13;

// 차트 저장
let charts = {};

const chartColors = {
  normal: 'rgba(54, 162, 235, 0.7)',
  anomaly:'rgba(255, 99, 132, 0.7)'
};

/* ----------------------------------------------------
   로딩 오버레이
---------------------------------------------------- */
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

/* ----------------------------------------------------
   데이터 로드 + 대시보드 갱신
---------------------------------------------------- */
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
  // (1) 이전 1시간
  renderRecentHour(data);
  // (1-B) 오늘(24시간) 총집계
  renderTodayDailySummary(data);

  // (2) 24시간 히스토그램
  renderTodayHistograms(data);

  // (3) 24시간 상세
  renderTodayHourCards(data);

  // (4) 주간 라인그래프
  renderWeeklyLineCharts(data);

  // (4-B) 주간(Daily) 카드
  renderWeeklyDayBreakdownAsCards(data);

  // 마지막 업데이트
  const lastUp= document.getElementById('lastUpdatedTime');
  if(lastUp){
    lastUp.textContent= data.updated_at || '-';
  }
}

/* ----------------------------------------------------
   (1) 이전 1시간
---------------------------------------------------- */
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
  // 최신 hourKey => 바로 전 hourKey
  const latestKey= hourKeys[hourKeys.length-1];
  const prevIndex= hourKeys.length-2;
  if(prevIndex<0){
    titleEl.textContent="이전 1시간 데이터가 충분치 않음";
    return;
  }
  const prevHourKey= hourKeys[prevIndex];

  // YYYYMMDD_HH -> YYYY.MM.DD HH:00 ~ HH+1:00
  const baseDate= prevHourKey.substring(0,8); // ex "20250315"
  const hh= prevHourKey.substring(9,11);
  const dtStr= `${baseDate.substring(0,4)}.${baseDate.substring(4,6)}.${baseDate.substring(6,8)}`;
  const hourNum= parseInt(hh,10);
  titleEl.textContent= `${dtStr} ${hourNum}:00 ~ ${hourNum+1}:00 (이전 1시간)`;

  const mchObj= hourlyData[prevHourKey];
  if(!mchObj){
    container.innerHTML=`<div class="bg-white p-4 rounded shadow">데이터 없음</div>`;
    return;
  }

  // 머신별 카드
  const mchKeys= Object.keys(mchObj).sort();
  mchKeys.forEach(mId=>{
    const c= mchObj[mId];
    const micTotal= (c.MIC_processed||0)+(c.MIC_anomaly||0);
    const micRate= micTotal? ((c.MIC_anomaly||0)/micTotal*100).toFixed(1) : 0;
    const accTotal= (c.ACC_processed||0)+(c.ACC_anomaly||0);
    const accRate= accTotal? ((c.ACC_anomaly||0)/accTotal*100).toFixed(1) : 0;

    const card= document.createElement('div');
    card.className="bg-white p-4 rounded shadow";
    card.innerHTML=`
      <h3 class="font-medium text-lg mb-2">${c.display_name||mId}</h3>
      <div class="text-sm mb-1">
        <span class="font-semibold text-blue-500">MIC:</span>
        정상 ${c.MIC_processed||0} / 이상 ${c.MIC_anomaly||0} (이상 ${micRate}%)
      </div>
      <div class="text-sm">
        <span class="font-semibold text-green-500">ACC:</span>
        정상 ${c.ACC_processed||0} / 이상 ${c.ACC_anomaly||0} (이상 ${accRate}%)
      </div>
    `;
    container.appendChild(card);
  });
}

/* ----------------------------------------------------
   (1-B) 오늘(24시간) 총집계
---------------------------------------------------- */
function renderTodayDailySummary(data){
  const container= document.getElementById('todayDailySummary');
  if(!container) return;

  container.innerHTML='';
  const dailyTotals= getTodayMachineTotals(data);

  // 예: "2025.03.16 총집계" 라벨
  const dateLabel= dailyTotals.displayDate;
  const sumTitle= document.getElementById('todaySummaryTitle');
  if(sumTitle){
    sumTitle.textContent= dateLabel+" 총집계";
  }

  // 카드
  Object.entries(dailyTotals.totals).forEach(([mId,obj])=>{
    const micTotal= obj.MIC_processed + obj.MIC_anomaly;
    const accTotal= obj.ACC_processed + obj.ACC_anomaly;
    const micRate= micTotal? ((obj.MIC_anomaly||0)/micTotal*100).toFixed(1):0;
    const accRate= accTotal? ((obj.ACC_anomaly||0)/accTotal*100).toFixed(1):0;

    const div= document.createElement('div');
    div.className= "bg-white rounded-lg shadow p-4";
    div.innerHTML=`
      <h3 class="font-bold text-lg mb-2">${obj.display_name||mId}</h3>
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
    container.appendChild(div);
  });
}

// 오늘 날짜(24시간) 합산
function getTodayMachineTotals(data){
  const hourlyData= data.hourlyData||{};
  const keys= Object.keys(hourlyData).sort();
  if(!keys.length){
    return { displayDate:"-", totals:{} };
  }
  // 가장 최신 key -> baseDate
  const latest= keys[keys.length-1]; // "20250316_17"
  const baseDate= latest.substring(0,8);
  const displayDate= baseDateToDot(baseDate);

  const totals={};
  for(let h=0; h<24; h++){
    const hh= String(h).padStart(2,'0');
    const hourKey= baseDate+"_"+hh;
    const mchObj= hourlyData[hourKey];
    if(!mchObj) continue;

    Object.entries(mchObj).forEach(([mId,c])=>{
      if(!totals[mId]){
        totals[mId]= {
          MIC_processed:0, MIC_anomaly:0,
          ACC_processed:0, ACC_anomaly:0,
          display_name: c.display_name||mId
        };
      }
      totals[mId].MIC_processed += (c.MIC_processed||0);
      totals[mId].MIC_anomaly  += (c.MIC_anomaly||0);
      totals[mId].ACC_processed += (c.ACC_processed||0);
      totals[mId].ACC_anomaly  += (c.ACC_anomaly||0);
    });
  }

  return { displayDate, totals };
}

function baseDateToDot(baseDate){
  // YYYYMMDD -> YYYY.MM.DD
  const y= baseDate.substring(0,4);
  const m= baseDate.substring(4,6);
  const d= baseDate.substring(6,8);
  return `${y}.${m}.${d}`;
}

/* ----------------------------------------------------
   (2) 오늘(24시간) 히스토그램
---------------------------------------------------- */
function renderTodayHistograms(data){
  const titleEl= document.getElementById('todayTitle');
  const hourlyData= data.hourlyData || {};
  const hKeys= Object.keys(hourlyData).sort();
  if(!hKeys.length){
    titleEl.textContent= "오늘(24시간) 데이터 없음";
    return;
  }
  
  // 최신 -> baseDate
  const latest= hKeys[hKeys.length-1];
  const baseDate= latest.substring(0,8);
  titleEl.textContent= `${baseDateToDot(baseDate)} (24시간) 히스토그램`;

  renderOneDayChart(data,"MACHINE2","MIC","chartCuringMic");
  renderOneDayChart(data,"MACHINE2","ACC","chartCuringAcc");
  renderOneDayChart(data,"MACHINE3","MIC","chartHotMic");
  renderOneDayChart(data,"MACHINE3","ACC","chartHotAcc");
}

function renderOneDayChart(data, machineId, sensorKey, canvasId){
  const ctx= document.getElementById(canvasId);
  if(!ctx) return;
  if(charts[canvasId]) charts[canvasId].destroy();

  const hourlyData= data.hourlyData||{};
  const hKeys= Object.keys(hourlyData).sort();
  if(!hKeys.length){
    charts[canvasId]= new Chart(ctx,{type:'bar', data:{labels:[],datasets:[]}});
    return;
  }
  const latest= hKeys[hKeys.length-1];
  const baseDate= latest.substring(0,8);

  let labels=[], normalArr=[], anomalyArr=[];
  for(let h=0;h<24;h++){
    const hh= String(h).padStart(2,'0');
    const hourKey= baseDate+"_"+hh;
    const mo= hourlyData[hourKey]||{};
    const c= mo[machineId];
    let n=0,a=0;
    if(c){
      n= c[sensorKey+"_processed"]||0;
      a= c[sensorKey+"_anomaly"]||0;
    }
    labels.push(`${h}-${h+1}시`);
    normalArr.push(n);
    anomalyArr.push(a);
  }

  charts[canvasId]= new Chart(ctx,{
    type:'bar',
    data:{
      labels,
      datasets:[
        { label:'정상', data: normalArr, backgroundColor: chartColors.normal},
        { label:'이상', data: anomalyArr, backgroundColor: chartColors.anomaly}
      ]
    },
    options:{
      responsive:true,
      maintainAspectRatio:false,
      plugins:{
        legend:{ position:'top'}
      },
      scales:{
        x:{ ticks:{ maxRotation:0, minRotation:0 } },
        y:{ beginAtZero:true }
      }
    }
  });
}

/* ----------------------------------------------------
   (3) 24시간 상세 (카드)
---------------------------------------------------- */
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

    // 머신 정렬
    const mchKeys= Object.keys(mo).sort();
    if(!mchKeys.length){
      cardHtml+= `<div class="text-sm text-gray-400">데이터 없음</div>`;
    } else {
      mchKeys.forEach(mId=>{
        const c= mo[mId];
        const micStr= `정상 ${c.MIC_processed||0} / 이상 ${c.MIC_anomaly||0}`;
        const accStr= `정상 ${c.ACC_processed||0} / 이상 ${c.ACC_anomaly||0}`;
        cardHtml += `
          <div class="border-t pt-2 mt-2 text-sm">
            <div class="font-medium mb-1 text-blue-600">${c.display_name||mId}</div>
            <div class="mb-1"><span class="text-blue-500 font-semibold">MIC:</span> ${micStr}</div>
            <div><span class="text-green-500 font-semibold">ACC:</span> ${accStr}</div>
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

/* ----------------------------------------------------
   (4) 주간 데이터 (라인그래프)
---------------------------------------------------- */
function renderWeeklyLineCharts(data){
  const weeklyData= data.weeklyData||{};
  const firstDtStr= data.first_date||"20250101_000000";

  // Curing Oven - MIC
  renderWeeklyLineChart(
    "weeklyLineCuringMic",
    getWeeklyMachineSensorLineData(weeklyData, "MACHINE2","MIC", firstDtStr),
    "Curing Oven - MIC 주간 추이"
  );
  // Curing Oven - ACC
  renderWeeklyLineChart(
    "weeklyLineCuringAcc",
    getWeeklyMachineSensorLineData(weeklyData,"MACHINE2","ACC", firstDtStr),
    "Curing Oven - ACC 주간 추이"
  );
  // Hot Chamber - MIC
  renderWeeklyLineChart(
    "weeklyLineHotMic",
    getWeeklyMachineSensorLineData(weeklyData,"MACHINE3","MIC", firstDtStr),
    "Hot Chamber - MIC 주간 추이"
  );
  // Hot Chamber - ACC
  renderWeeklyLineChart(
    "weeklyLineHotAcc",
    getWeeklyMachineSensorLineData(weeklyData,"MACHINE3","ACC", firstDtStr),
    "Hot Chamber - ACC 주간 추이"
  );
}

// 주차 -> normal/anomaly
function getWeeklyMachineSensorLineData(weeklyData, machineId, sensorKey, firstDtStr){
  const wKeys= Object.keys(weeklyData).sort((a,b)=>{
    const aN= parseInt(a.split('_')[1]||"0",10);
    const bN= parseInt(b.split('_')[1]||"0",10);
    return aN-bN;
  });
  let labels=[], normals=[], anomalies=[];
  wKeys.forEach(weekKey=>{
    const mo= weeklyData[weekKey][machineId];
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
  // 주차 범위를 함께
  labels = labels.map(k=> getWeekRangeLabel(k, firstDtStr));
  return { labels, normals, anomalies };
}

function renderWeeklyLineChart(canvasId, dataset, chartTitle){
  const ctx = document.getElementById(canvasId);
  if(!ctx) return;
  if(charts[canvasId]) charts[canvasId].destroy();

  charts[canvasId] = new Chart(ctx,{
    type: 'line',
    data:{
      labels: dataset.labels,
      datasets:[
        {
          label:'정상',
          data: dataset.normals,
          borderColor:'rgba(54,162,235,1)',
          backgroundColor:'rgba(54,162,235,0.2)',
          fill:false,
          tension:0.2
        },
        {
          label:'이상',
          data: dataset.anomalies,
          borderColor:'rgba(255,99,132,1)',
          backgroundColor:'rgba(255,99,132,0.2)',
          fill:false,
          tension:0.2
        }
      ]
    },
    options:{
      responsive:true,
      maintainAspectRatio:false,
      plugins:{
        legend:{ position:'top'},
        title:{
          display:true,
          text: chartTitle
        }
      },
      scales:{
        x:{
          ticks:{ maxRotation:0, minRotation:0}
        },
        y:{ beginAtZero:true }
      }
    }
  });
}

// "Week_1" -> "Week_1 (2/19 ~ 2/25)"
function getWeekRangeLabel(weekKey, firstDateStr){
  const match= weekKey.match(/Week_(\d+)/);
  if(!match) return weekKey;
  const wNum= parseInt(match[1],10);

  const y= parseInt(firstDateStr.substring(0,4),10);
  const mo= parseInt(firstDateStr.substring(4,6),10)-1;
  const d= parseInt(firstDateStr.substring(6,8),10);
  const start= new Date(y, mo, d + (wNum-1)*7);
  const end= new Date(start.getTime()+ 6*24*3600*1000);

  const sLabel= `${start.getMonth()+1}/${start.getDate()}`;
  const eLabel= `${end.getMonth()+1}/${end.getDate()}`;
  return `${weekKey} (${sLabel} ~ ${eLabel})`;
}

/* ----------------------------------------------------
   (4-B) 주차별 일(Daily) -> 카드
---------------------------------------------------- */
function renderWeeklyDayBreakdownAsCards(data){
  const container= document.getElementById('weeklyDayBreakdown');
  if(!container) return;
  container.innerHTML='';

  const weeklyData= data.weeklyData||{};
  const dailyData = data.dailyData||{};
  const firstDtStr= data.first_date||"20250101_000000";

  // 주차 정렬
  const weeks= Object.keys(weeklyData).sort((a,b)=>{
    const aN= parseInt(a.split('_')[1]||0,10);
    const bN= parseInt(b.split('_')[1]||0,10);
    return aN - bN;
  });
  if(!weeks.length){
    container.innerHTML= `<p class="text-gray-500">주간 데이터가 없습니다.</p>`;
    return;
  }

  weeks.forEach(weekKey=>{
    const wNum= parseInt(weekKey.split('_')[1],10);
    const rangeLabel= getWeekRangeLabel(weekKey, firstDtStr); 
    // ex) "Week_1 (2/19 ~ 2/25)"

    // 주차 제목
    let html=`
      <h3 class="text-lg font-semibold mb-2">${weekKey} (일자별 집계)</h3>
      <p class="text-sm text-gray-400 mb-4">*${rangeLabel.split('(')[1] || ''}</p>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
    `;

    // 시작일 ~ 7일
    const y= parseInt(firstDtStr.substring(0,4),10);
    const m= parseInt(firstDtStr.substring(4,6),10)-1;
    const d= parseInt(firstDtStr.substring(6,8),10);
    const startDate= new Date(y,m,d+(wNum-1)*7);

    for(let i=0;i<7;i++){
      const dt= new Date(startDate.getTime()+ i*86400000);
      const yy= dt.getFullYear();
      const mm= String(dt.getMonth()+1).padStart(2,'0');
      const dd= String(dt.getDate()).padStart(2,'0');
      const dayKey= `${yy}-${mm}-${dd}`;
      
      // dailyData[dayKey] => { MACHINE2:{...}, MACHINE3:{...} }
      const dayObj= dailyData[dayKey] || {};

      html += `<div class="bg-gray-50 rounded shadow p-3">`;
      html += `<h4 class="font-semibold mb-2">${dayKey}</h4>`;

      const mchKeys= Object.keys(dayObj).sort();
      if(!mchKeys.length){
        html+= `<p class="text-sm text-gray-400">데이터 없음</p>`;
      } else {
        mchKeys.forEach(mId=>{
          const c= dayObj[mId];
          const micStr= `정상 ${c.MIC_processed||0} / 이상 ${c.MIC_anomaly||0}`;
          const accStr= `정상 ${c.ACC_processed||0} / 이상 ${c.ACC_anomaly||0}`;
          html += `
            <div class="border-t pt-2 mt-2 text-sm">
              <div class="font-medium mb-1 text-blue-600">${c.display_name||mId}</div>
              <div class="mb-1">
                <span class="text-blue-500 font-semibold">MIC:</span> 
                <span class="text-black">${micStr}</span>
              </div>
              <div>
                <span class="text-green-500 font-semibold">ACC:</span>
                <span class="text-black">${accStr}</span>
              </div>
            </div>
          `;
        });
      }

      html+= `</div>`; // 카드 하나 종료
    }

    html += `</div>`; // grid 종료

    const div= document.createElement('div');
    div.innerHTML= html;
    container.appendChild(div);
  });
}

/* ----------------------------------------------------
   자동 새로고침
---------------------------------------------------- */
function setupAutoRefresh(){
  setInterval(loadData, 5*60*1000);
}

/* ----------------------------------------------------
   페이지 로드 시
---------------------------------------------------- */
document.addEventListener('DOMContentLoaded', ()=>{
  loadData();
  setupAutoRefresh();
});

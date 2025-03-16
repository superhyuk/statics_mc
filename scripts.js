// Chart.js 전역 폰트 설정
Chart.defaults.font.family = "'D2Coding', 'Noto Sans KR', sans-serif";
Chart.defaults.font.size   = 13;

let charts = {}; // 차트 보관용

/* ----------------------------------------------------
   (A) 로딩 오버레이
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
   (B) 데이터 로드 + 대시보드 갱신
---------------------------------------------------- */
async function loadData(){
  showLoading();
  try {
    const resp= await fetch('data_counts.json'); // 같은 폴더에 data_counts.json
    const data= await resp.json();
    updateDashboard(data);
  } catch(e){
    console.error("데이터 로드 실패:", e);
  } finally {
    hideLoading();
  }
}

function updateDashboard(data){
  console.log("updateDashboard start");
  try {
    // 1) 오늘(최신) 데이터
    updateTodayData(data);

    // 2) 주간 요약(간단)
    //   -> 예: renderWeeklySummaryCharts(data);

    // 3) 주차별 상세(일자별 24시간)
    renderWeeklyDetailedCharts(data);

    // 4) 월별 데이터
    renderMonthlyData(data);

    // 마지막 업데이트 시각
    const lastUp= document.getElementById('lastUpdatedTime');
    if(lastUp) lastUp.textContent = data.updated_at || '-';

  } catch(err){
    console.error("updateDashboard error:", err);
  }
}

/* ----------------------------------------------------
   (1) 오늘(최신) 데이터 예시
---------------------------------------------------- */
function updateTodayData(data){
  const container= document.getElementById('todayData');
  if(!container) return;
  container.innerHTML= '';

  const hourlyData= data.hourlyData || {};
  const allKeys= Object.keys(hourlyData).sort();
  if(!allKeys.length){
    container.innerHTML = `<div class="bg-white p-4 rounded shadow">오늘 데이터가 없습니다.</div>`;
    return;
  }

  // 예시: 가장 최신 날짜(YYYYMMDD)
  const latestKey= allKeys[allKeys.length-1]; // e.g. "20250314_16"
  const baseDate= latestKey.slice(0,8);
  const displayDate= `${baseDate.slice(0,4)}.${baseDate.slice(4,6)}.${baseDate.slice(6,8)}`;

  // 임시 “오늘 머신별 합산”
  const dailyTotals = {};
  for(let h=0;h<24;h++){
    const hh= String(h).padStart(2,'0');
    const k= baseDate+"_"+hh;
    if(!hourlyData[k]) continue;
    Object.entries(hourlyData[k]).forEach(([mId,c])=>{
      if(!dailyTotals[mId]){
        dailyTotals[mId] = {
          MIC_processed:0, MIC_anomaly:0,
          ACC_processed:0, ACC_anomaly:0,
          display_name: c.display_name||mId
        };
      }
      dailyTotals[mId].MIC_processed += (c.MIC_processed||0);
      dailyTotals[mId].MIC_anomaly  += (c.MIC_anomaly||0);
      dailyTotals[mId].ACC_processed += (c.ACC_processed||0);
      dailyTotals[mId].ACC_anomaly  += (c.ACC_anomaly||0);
    });
  }

  // 그리드 카드
  Object.entries(dailyTotals).forEach(([mId,obj])=>{
    const micT = obj.MIC_processed+obj.MIC_anomaly;
    const micRate= micT? (obj.MIC_anomaly/micT*100).toFixed(1):0;
    const accT = obj.ACC_processed+obj.ACC_anomaly;
    const accRate= accT? (obj.ACC_anomaly/accT*100).toFixed(1):0;

    const div= document.createElement('div');
    div.className= "bg-white p-4 rounded shadow";
    div.innerHTML=`
      <h3 class="font-bold text-lg mb-2">${obj.display_name}</h3>
      <p class="text-sm mb-1">
        <span class="text-blue-500 font-semibold">MIC:</span>
        정상 ${obj.MIC_processed}, 이상 ${obj.MIC_anomaly} (이상 ${micRate}%)
      </p>
      <p class="text-sm">
        <span class="text-green-500 font-semibold">ACC:</span>
        정상 ${obj.ACC_processed}, 이상 ${obj.ACC_anomaly} (이상 ${accRate}%)
      </p>
    `;
    container.appendChild(div);
  });
}

/* ----------------------------------------------------
   (2) 월별 데이터 예시
---------------------------------------------------- */
function renderMonthlyData(data){
  const container= document.getElementById('monthlyData');
  if(!container) return;
  container.innerHTML= `<p class="text-sm text-gray-400">월별 데이터는 여기 표시 (예: 바 차트)</p>`;
  // 실제 구현 가능
}

/* ----------------------------------------------------
   (3) 주차별 상세 (일자별 24시간 그래프, 2중 <details>)
---------------------------------------------------- */
function renderWeeklyDetailedCharts(data){
  const container= document.getElementById('weeklyDetailedCharts');
  if(!container) return;
  container.innerHTML='';

  const weeklyData= data.weeklyData||{};
  const hourlyData= data.hourlyData||{};
  const firstDtStr= data.first_date||"20250101_000000";

  // Week_1, Week_2 ... 정렬
  const weekKeys= Object.keys(weeklyData).sort((a,b)=>{
    const aNum= parseInt(a.split('_')[1]||0,10);
    const bNum= parseInt(b.split('_')[1]||0,10);
    return aNum-bNum;
  });

  if(!weekKeys.length){
    container.innerHTML=`<p class="text-gray-500">주간 데이터가 없습니다.</p>`;
    return;
  }

  // (A) 주차 레벨 <details>
  weekKeys.forEach(weekKey=>{
    const wNum = parseInt(weekKey.split('_')[1],10);
    const rangeLabel= getWeekRangeLabel(weekKey, firstDtStr); 

    // 주차 details
    const weekDetails= document.createElement('details');
    weekDetails.className= "group mb-4 bg-white rounded shadow p-4";

    // 주차 summary
    const sum= document.createElement('summary');
    sum.className= "no-scroll flex items-center gap-1 cursor-pointer text-blue-600 font-semibold";
    sum.innerHTML=`
      <svg class="w-4 h-4 rotate-90" fill="none" stroke="currentColor" stroke-width="2"
           viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round">
        <path d="M9 5l7 7-7 7"></path>
      </svg>
      ${weekKey} 상세보기
    `;
    sum.addEventListener('click', e=>{
      e.preventDefault();
      weekDetails.open = !weekDetails.open;
    });
    weekDetails.appendChild(sum);

    // 범위 표시
    const sub= document.createElement('p');
    sub.className="text-sm text-gray-400 mb-4";
    sub.textContent= "*"+ (rangeLabel.split('(')[1]||'');
    weekDetails.appendChild(sub);

    // (B) 7일
    const daysWrapper= document.createElement('div');
    daysWrapper.className= "space-y-6";

    for(let i=0; i<7; i++){
      const baseY= parseInt(firstDtStr.slice(0,4),10);
      const baseM= parseInt(firstDtStr.slice(4,6),10)-1;
      const baseD= parseInt(firstDtStr.slice(6,8),10);
      const dt= new Date(baseY, baseM, baseD + (wNum-1)*7 + i);
      const yy= dt.getFullYear();
      const mm= String(dt.getMonth()+1).padStart(2,'0');
      const dd= String(dt.getDate()).padStart(2,'0');
      const dayLabel= `${yy}-${mm}-${dd}`; 
      const baseDate= `${yy}${mm}${dd}`;   // for hourlyData key

      // 일자 details
      const dayDetails= document.createElement('details');
      dayDetails.className= "group bg-gray-50 rounded p-3";

      // day summary
      const daySum= document.createElement('summary');
      daySum.className= "no-scroll flex items-center gap-1 cursor-pointer text-blue-800 font-semibold";
      daySum.innerHTML=`
        <svg class="w-4 h-4 rotate-90" fill="none" stroke="currentColor" stroke-width="2"
             viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round">
          <path d="M9 5l7 7-7 7"></path>
        </svg>
        ${dayLabel} (펼치기)
      `;
      daySum.addEventListener('click', e=>{
        e.preventDefault();
        dayDetails.open= !dayDetails.open;
      });
      dayDetails.appendChild(daySum);

      // 4개 차트 (M2-MIC, M2-ACC, M3-MIC, M3-ACC)
      const dayContent= document.createElement('div');
      dayContent.className= "mt-3 grid grid-cols-1 md:grid-cols-2 gap-4";
      dayContent.innerHTML=`
        <div>
          <p class="font-bold text-blue-600 mb-1">MACHINE2 - MIC</p>
          <div class="chart-container">
            <canvas id="chart_${weekKey}_${dayLabel}_m2mic"></canvas>
          </div>
        </div>
        <div>
          <p class="font-bold text-green-600 mb-1">MACHINE2 - ACC</p>
          <div class="chart-container">
            <canvas id="chart_${weekKey}_${dayLabel}_m2acc"></canvas>
          </div>
        </div>
        <div>
          <p class="font-bold text-red-600 mb-1">MACHINE3 - MIC</p>
          <div class="chart-container">
            <canvas id="chart_${weekKey}_${dayLabel}_m3mic"></canvas>
          </div>
        </div>
        <div>
          <p class="font-bold text-yellow-600 mb-1">MACHINE3 - ACC</p>
          <div class="chart-container">
            <canvas id="chart_${weekKey}_${dayLabel}_m3acc"></canvas>
          </div>
        </div>
      `;
      dayDetails.appendChild(dayContent);

      daysWrapper.appendChild(dayDetails);
    }

    weekDetails.appendChild(daysWrapper);
    container.appendChild(weekDetails);
  });

  // 모든 일자×머신×센서 24시간 차트 그리기
  drawAllWeeklyDailyCharts(weekKeys, firstDtStr, hourlyData);
}

// 실제 차트 그리기
function drawAllWeeklyDailyCharts(weekKeys, firstDtStr, hourlyData){
  weekKeys.forEach(weekKey=>{
    const wNum= parseInt(weekKey.split('_')[1]||0,10);
    for(let i=0;i<7;i++){
      const baseY= parseInt(firstDtStr.slice(0,4),10);
      const baseM= parseInt(firstDtStr.slice(4,6),10)-1;
      const baseD= parseInt(firstDtStr.slice(6,8),10);
      const dt= new Date(baseY,baseM, baseD+(wNum-1)*7 +i);
      const yy= dt.getFullYear();
      const mm= String(dt.getMonth()+1).padStart(2,'0');
      const dd= String(dt.getDate()).padStart(2,'0');
      const dayLabel= `${yy}-${mm}-${dd}`;
      const baseDate= `${yy}${mm}${dd}`;

      // 4개
      renderDay24LineChart(hourlyData, baseDate, "MACHINE2","MIC",
        `chart_${weekKey}_${dayLabel}_m2mic`
      );
      renderDay24LineChart(hourlyData, baseDate, "MACHINE2","ACC",
        `chart_${weekKey}_${dayLabel}_m2acc`
      );
      renderDay24LineChart(hourlyData, baseDate, "MACHINE3","MIC",
        `chart_${weekKey}_${dayLabel}_m3mic`
      );
      renderDay24LineChart(hourlyData, baseDate, "MACHINE3","ACC",
        `chart_${weekKey}_${dayLabel}_m3acc`
      );
    }
  });
}

// 하루치(0~23h) 라인 차트
function renderDay24LineChart(hourlyData, baseDateStr, machineId, sensorKey, canvasId){
  const ctx= document.getElementById(canvasId);
  if(!ctx) return;

  let labels=[], normals=[], anomalies=[];
  for(let h=0; h<24; h++){
    const hh= String(h).padStart(2,'0');
    const hourKey= baseDateStr+"_"+hh; // "20250219_00"
    const mchObj= hourlyData[hourKey]||{};
    const c= mchObj[machineId];
    let n=0,a=0;
    if(c){
      n= c[sensorKey+"_processed"]||0;
      a= c[sensorKey+"_anomaly"]||0;
    }
    labels.push(h+"시");
    normals.push(n);
    anomalies.push(a);
  }

  if(charts[canvasId]) charts[canvasId].destroy();
  charts[canvasId] = new Chart(ctx, {
    type:'line',
    data:{
      labels,
      datasets:[
        {
          label:'정상',
          data: normals,
          borderColor:'rgba(54,162,235,1)',
          backgroundColor:'rgba(54,162,235,0.2)',
          tension:0.2,
          fill:false
        },
        {
          label:'이상',
          data: anomalies,
          borderColor:'rgba(255,99,132,1)',
          backgroundColor:'rgba(255,99,132,0.2)',
          tension:0.2,
          fill:false
        }
      ]
    },
    options:{
      responsive:true,
      maintainAspectRatio:false,
      scales:{
        y:{ beginAtZero:true },
        x:{ ticks:{ maxRotation:0, minRotation:0}}
      },
      plugins:{
        legend:{ position:'top'}
      }
    }
  });
}

// "Week_1" -> "Week_1 (2/19 ~ 2/25)"
function getWeekRangeLabel(weekKey, firstDateStr){
  const match= weekKey.match(/Week_(\d+)/);
  if(!match) return weekKey;
  const wNum= parseInt(match[1],10);

  if(!firstDateStr || firstDateStr.length<8) return weekKey;
  const y= parseInt(firstDateStr.slice(0,4),10);
  const m= parseInt(firstDateStr.slice(4,6),10)-1;
  const d= parseInt(firstDateStr.slice(6,8),10);
  const start= new Date(y,m,d + (wNum-1)*7);
  const end= new Date(start.getTime() + 6*86400000);

  const sLabel= `${start.getMonth()+1}/${start.getDate()}`;
  const eLabel= `${end.getMonth()+1}/${end.getDate()}`;
  return `${weekKey} (${sLabel} ~ ${eLabel})`;
}

/* ----------------------------------------------------
   자동 새로고침 (5분)
---------------------------------------------------- */
function setupAutoRefresh(){
  setInterval(loadData, 5*60*1000);
}

document.addEventListener('DOMContentLoaded', ()=>{
  loadData();
  setupAutoRefresh();
});

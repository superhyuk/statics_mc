// 전역 폰트
Chart.defaults.font.family = "'D2Coding', 'Pretendard', 'Noto Sans KR', sans-serif";
Chart.defaults.font.size = 13;

const chartColors = {
  normal: 'rgba(54, 162, 235, 0.7)',
  anomaly:'rgba(255, 99, 132, 0.7)'
};

let charts = {};

/* --------------------------------------------------
   1) Machine ID 순서 고정 (사용 예시)
   MACHINE2 -> MACHINE3
-------------------------------------------------- */
function sortMachineIds(keys) {
  const order = ["MACHINE2","MACHINE3"];
  return keys.sort((a,b)=>{
    const iA= order.indexOf(a);
    const iB= order.indexOf(b);
    if(iA===-1 && iB===-1){
      return a.localeCompare(b);
    } else if(iA===-1){
      return 1;
    } else if(iB===-1){
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

/* --------------------------------------------------
   데이터 로드 & 대시보드
-------------------------------------------------- */
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

  // (1-B) 오늘(24시간) 총집계
  renderTodayDailySummary(data);

  // (2) 오늘(24시간) 히스토그램
  renderTodayHistograms(data);

  // (3) 24시간 상세 (카드+접기)
  renderTodayHourCards(data);

  // (4) 주별
  renderWeeklyCharts(data);
  // (4-B) 주차별 일일 집계
  renderWeeklyDayBreakdown(data);

  // (5) 월별
  renderMonthlyCharts(data);

  // 마지막 업데이트
  const lastUp= document.getElementById('lastUpdatedTime');
  if(lastUp){
    lastUp.textContent= data.updated_at || '-';
  }
}

/* --------------------------------------------------
   (1) 이전 1시간
-------------------------------------------------- */
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
  // 최신 -> 바로 전
  const latestKey= hourKeys[hourKeys.length-1];
  const prevIndex= hourKeys.length-2; 
  if(prevIndex<0){
    titleEl.textContent= "이전 1시간 데이터 없음(기록이 너무 적음)";
    return;
  }
  const prevHourKey= hourKeys[prevIndex];

  // prevHourKey= "YYYYMMDD_HH"
  const baseDate= prevHourKey.substring(0,8);
  const hourStr= prevHourKey.substring(9,11);
  const h= parseInt(hourStr,10);  

  const yyyy= baseDate.substring(0,4);
  const mm= baseDate.substring(4,6);
  const dd= baseDate.substring(6,8);
  titleEl.textContent= `${yyyy}.${mm}.${dd} ${h}:00 ~ ${h+1}:00 (이전 1시간)`;

  const mchObj= hourlyData[prevHourKey];
  if(!mchObj || !Object.keys(mchObj).length){
    container.innerHTML= `<div class="bg-white p-4 rounded shadow text-gray-500">이전1시간(${prevHourKey}) 데이터 없음</div>`;
    return;
  }

  // 정렬
  const mchKeys= sortMachineIds(Object.keys(mchObj));
  mchKeys.forEach(mId=>{
    const c= mchObj[mId];
    const micTotal= (c.MIC_processed||0)+(c.MIC_anomaly||0);
    const accTotal= (c.ACC_processed||0)+(c.ACC_anomaly||0);
    const micRate= micTotal? ((c.MIC_anomaly||0)/micTotal*100).toFixed(1):0;
    const accRate= accTotal? ((c.ACC_anomaly||0)/accTotal*100).toFixed(1):0;

    const card= document.createElement('div');
    card.className= "bg-white rounded-lg shadow p-4";
    card.innerHTML=`
      <h3 class="font-medium text-lg mb-2">${c.display_name||mId}</h3>
      <div class="text-sm mb-1">
        <span class="font-semibold text-blue-500">MIC:</span>
        <span class="text-normal">정상 ${c.MIC_processed||0}</span>
        / <span class="text-anomaly">이상 ${c.MIC_anomaly||0}</span>
        (이상 ${micRate}%)
      </div>
      <div class="text-sm">
        <span class="font-semibold text-green-500">ACC:</span>
        <span class="text-normal">정상 ${c.ACC_processed||0}</span>
        / <span class="text-anomaly">이상 ${c.ACC_anomaly||0}</span>
        (이상 ${accRate}%)
      </div>
    `;
    container.appendChild(card);
  });
}

/* --------------------------------------------------
   (1-B) 오늘(24시간) 총집계
-------------------------------------------------- */
function renderTodayDailySummary(data){
  const container= document.getElementById('todayDailySummary');
  if(!container) return;
  container.innerHTML= '';

  const dailyTotals= getTodayMachineTotals(data);
  if(!Object.keys(dailyTotals.totals).length){
    container.innerHTML= `<div class="bg-white p-4 rounded shadow text-gray-500">오늘(24시간) 데이터 없음</div>`;
    return;
  }

  const dateStr= dailyTotals.displayDate;
  // 타이틀을 좀 더 진하고 크게
  const heading= document.createElement('div');
  heading.className= "col-span-full mb-2 text-md font-bold text-gray-800";
  heading.textContent= `${dateStr} 총집계`;
  container.appendChild(heading);

  // 머신별 카드
  Object.entries(dailyTotals.totals).forEach(([mId,obj])=>{
    const micTotal= obj.MIC_processed + obj.MIC_anomaly;
    const accTotal= obj.ACC_processed + obj.ACC_anomaly;
    const micRate = micTotal? ((obj.MIC_anomaly||0)/micTotal*100).toFixed(1):0;
    const accRate = accTotal? ((obj.ACC_anomaly||0)/accTotal*100).toFixed(1):0;

    const card= document.createElement('div');
    card.className= "bg-white rounded-lg shadow p-4";
    card.innerHTML=`
      <h3 class="font-medium text-lg mb-2">${obj.display_name||mId}</h3>
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
  const hourlyData= data.hourlyData||{};
  const keys= Object.keys(hourlyData).sort();
  if(!keys.length){
    return { displayDate:"-", totals:{} };
  }
  // latest -> baseDate
  const latest= keys[keys.length-1]; // "20250315_17"
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
  const y= baseDate.substring(0,4);
  const m= baseDate.substring(4,6);
  const d= baseDate.substring(6,8);
  return `${y}.${m}.${d}`;
}

/* --------------------------------------------------
   (2) 오늘(24시간) 히스토그램
-------------------------------------------------- */
function renderTodayHistograms(data){
  const titleEl= document.getElementById('todayTitle');
  const hourlyData= data.hourlyData || {};
  const hKeys= Object.keys(hourlyData).sort();
  if(!hKeys.length){
    titleEl.textContent= "오늘(24시간) 데이터 없음";
    return;
  }
  
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
    charts[canvasId]= new Chart(ctx,{type:'bar',data:{labels:[],datasets:[]}});
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
      plugins:{ legend:{ position:'top'} },
      scales:{
        x:{
          ticks:{ maxRotation:0, minRotation:0 }
        },
        y:{ beginAtZero:true }
      }
    }
  });
}

/* --------------------------------------------------
   (3) 24시간 상세 (각 시간대를 카드+details로)
-------------------------------------------------- */
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

    // details 만들기
    const detail = document.createElement('details');
    detail.className = "group bg-white rounded-lg shadow p-4";

    let innerHtml = `
      <summary class="flex items-center font-semibold mb-2 text-blue-600 gap-1 cursor-pointer">
        <svg class="w-4 h-4 rotate-90" fill="none" stroke="currentColor" stroke-width="2"
             viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round">
          <path d="M9 5l7 7-7 7"></path>
        </svg>
        ${label}
      </summary>
    `;

    // 내용부
    let content = ``;
    const mchKeys= sortMachineIds(Object.keys(mo));
    if(!mchKeys.length){
      content+= `<div class="text-sm text-gray-400">데이터 없음</div>`;
    } else {
      mchKeys.forEach(mId=>{
        const c= mo[mId];
        const micNormal = c.MIC_processed||0;
        const micAnom   = c.MIC_anomaly||0;
        const accNormal = c.ACC_processed||0;
        const accAnom   = c.ACC_anomaly||0;

        content += `
          <div class="border-t pt-2 mt-2 text-sm">
            <div class="font-medium mb-1">${c.display_name||mId}</div>
            <div class="mb-1">
              <span class="font-semibold text-blue-500">MIC:</span>
              <span class="text-normal">정상 ${micNormal}</span>
              / <span class="text-anomaly">이상 ${micAnom}</span>
            </div>
            <div>
              <span class="font-semibold text-green-500">ACC:</span>
              <span class="text-normal">정상 ${accNormal}</span>
              / <span class="text-anomaly">이상 ${accAnom}</span>
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
   (4) 주별 차트
   (4-B) 주차별 일(Daily) 집계
-------------------------------------------------- */
function getWeekRangeLabel(weekKey, firstDateStr){
  const match= weekKey.match(/Week_(\d+)/);
  if(!match) return weekKey;
  const wNum= parseInt(match[1],10);

  const y= parseInt(firstDateStr.substring(0,4),10);
  const mo= parseInt(firstDateStr.substring(4,6),10)-1;
  const d= parseInt(firstDateStr.substring(6,8),10);
  const start= new Date(y, mo, d);
  // weekNum-1 주 뒤로
  start.setDate(start.getDate() + (wNum-1)*7);
  const end= new Date(start.getTime()+6*24*60*60*1000);

  const sLabel= `${start.getMonth()+1}/${start.getDate()}`;
  const eLabel= `${end.getMonth()+1}/${end.getDate()}`;
  return `${weekKey} (${sLabel} ~ ${eLabel})`;
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
      plugins:{ legend:{ position:'top'} },
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

/* 
   (4-B) 주차별 "일(Daily)" 집계를 카드 형태로 표시
   - 각 주차별로 details를 만들고, 그 안에서 7일치 각 날짜를
     작은 카드(접기/펼치기)로 나누어서 보여줍니다.
*/
function renderWeeklyDayBreakdown(data){
  const container= document.getElementById('weeklyDayBreakdown');
  if(!container) return;

  container.innerHTML= '';

  const weeklyData= data.weeklyData||{};
  const dailyData = data.dailyData||{};
  if(!Object.keys(weeklyData).length){
    container.innerHTML= "<p class='text-gray-500'>주간 데이터가 없습니다.</p>";
    return;
  }

  // 주차 키들 정렬
  const weeks= Object.keys(weeklyData).sort((a,b)=>{
    const aN= parseInt(a.split('_')[1]||"0",10);
    const bN= parseInt(b.split('_')[1]||"0",10);
    return aN-bN;
  });

  const firstDtStr= data.first_date||"20250101_000000";
  const year = parseInt(firstDtStr.substring(0,4),10);
  const mon  = parseInt(firstDtStr.substring(4,6),10)-1;
  const day  = parseInt(firstDtStr.substring(6,8),10);

  weeks.forEach(weekKey=>{
    const wNum = parseInt(weekKey.split('_')[1],10);
    // 주 시작일 ~ 6일 후
    const start = new Date(year, mon, day + (wNum-1)*7);
    const end   = new Date(start.getTime() + 6*24*3600*1000);

    // 주차 큰 카드(접기/펼치기)
    const wrapDetails = document.createElement('details');
    wrapDetails.className = "group bg-gray-50 rounded-lg shadow p-4";

    // 제목 표시: "Week_1 (2/19 ~ 2/25)"
    const sLabel= `${start.getMonth()+1}/${start.getDate()}`;
    const eLabel= `${end.getMonth()+1}/${end.getDate()}`;
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

    // 7일 돌면서
    for(let i=0;i<7;i++){
      const tmp = new Date(start.getTime() + i*24*3600*1000);
      const yyy = tmp.getFullYear();
      const mm  = String(tmp.getMonth()+1).padStart(2,'0');
      const dd  = String(tmp.getDate()).padStart(2,'0');
      const dayKey= `${yyy}-${mm}-${dd}`;

      // 날짜별 카드 (단순 div 사용)
      let cardHtml = `<div class="bg-white rounded-lg shadow p-3">`;
      cardHtml += `<h4 class="font-medium mb-2 text-sm text-gray-700">${dayKey}</h4>`;

      // MACHINE2, MACHINE3 각각 표시
      let coStr = `<div class="text-sm text-gray-400">- 데이터 없음 -</div>`;
      let hcStr = ``;

      const dayObj= dailyData[dayKey];
      if(dayObj){
        // MACHINE2 (Curing Oven)
        const c2 = dayObj["MACHINE2"];
        // MACHINE3 (Hot Chamber)
        const c3 = dayObj["MACHINE3"];
        if(c2 || c3){
          // 있으면 구분해서 표시
          coStr = '';
          if(c2){
            const micN = c2.MIC_processed||0, micA = c2.MIC_anomaly||0;
            const accN = c2.ACC_processed||0, accA = c2.ACC_anomaly||0;
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
            const micN = c3.MIC_processed||0, micA = c3.MIC_anomaly||0;
            const accN = c3.ACC_processed||0, accA = c3.ACC_anomaly||0;
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
      cardHtml += `</div>`; // card end

      daysHtml += cardHtml;
    }
    daysHtml += `</div>`; // grid end

    wrapDetails.innerHTML = summaryHtml + daysHtml;
    container.appendChild(wrapDetails);
  });
}

/* --------------------------------------------------
   (5) 월별
-------------------------------------------------- */
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
          ticks:{ maxRotation:0, minRotation:0 }
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

/* --------------------------------------------------
   자동 새로고침(5분)
-------------------------------------------------- */
function setupAutoRefresh(){
  setInterval(loadData, 5 * 60 * 1000);
}

document.addEventListener('DOMContentLoaded', ()=>{
  loadData();
  setupAutoRefresh();
});

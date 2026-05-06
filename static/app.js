const API={sectors:()=>fetch("/api/sectors").then(r=>r.json()),sssConfigs:()=>fetch("/api/sss-configs").then(r=>r.json()),sssFunds:()=>fetch("/api/sss-funds").then(r=>r.json()),personalFunds:()=>fetch("/api/personal-funds").then(r=>r.json()),settings:()=>fetch("/api/settings").then(r=>r.json()),calculations:()=>fetch("/api/calculations").then(r=>r.json()),dailyInvestments:()=>fetch("/api/daily-investments").then(r=>r.json()),tradingStatus:()=>fetch("/api/trading/status").then(r=>r.json()),investmentRecords:()=>fetch("/api/investment-records").then(r=>r.json()),simulate:(amt)=>fetch("/api/calculations/simulate",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({sss_buy_amount:amt})}).then(r=>r.json()),put:(url,data)=>fetch(url,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(data)}),post:(url,data)=>fetch(url,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(data)}),del:(url)=>fetch(url,{method:"DELETE"})};
const CYCLE_LABELS={daily:"每日",weekly:"每周",biweekly:"每两周",monthly:"每月"};
const CYCLE_DAY_LABELS=["周一","周二","周三","周四","周五"];
function switchTab(tab){document.querySelectorAll(".tab-content").forEach(e=>e.classList.remove("active"));document.querySelectorAll(".nav-item").forEach(e=>e.classList.remove("active"));const c=document.getElementById("tab-"+tab),n=document.querySelector('[data-tab="'+tab+'"]');if(c)c.classList.add("active");if(n)n.classList.add("active");if(tab==="dashboard")refreshDashboard();if(tab==="guide")refreshGuide();if(tab==="calculator")refreshCalculator();if(tab==="settings")refreshSettings()}
function fmtW(n){if(n==null||isNaN(n))return"--";return(n/10000).toLocaleString("zh-CN",{minimumFractionDigits:1,maximumFractionDigits:1})}
function fmt(n){if(n==null||isNaN(n))return"--";return Number(n).toLocaleString("zh-CN",{minimumFractionDigits:0,maximumFractionDigits:0})}
function fmt2(n){if(n==null||isNaN(n))return"--";return Number(n).toLocaleString("zh-CN",{minimumFractionDigits:2,maximumFractionDigits:2})}
function pct(n){if(n==null||isNaN(n))return"--";return Math.round(n*100)+"%"}
function pct1(n){if(n==null||isNaN(n))return"--";return (n*100).toFixed(1)+"%"}
let undoData=null,undoTimeout=null;
function showUndo(type,endpoint,restoreData,msg){undoData={type,endpoint,restoreData};document.getElementById("undo-msg").textContent=msg;document.getElementById("undo-toast").style.display="flex";if(undoTimeout)clearTimeout(undoTimeout);undoTimeout=setTimeout(dismissUndo,5000)}
function dismissUndo(){document.getElementById("undo-toast").style.display="none";undoData=null;if(undoTimeout)clearTimeout(undoTimeout)}
async function performUndo(){if(!undoData)return;const{type,restoreData}=undoData;if(type==="personal")await API.post("/api/personal-funds",restoreData);else if(type==="sss")await API.post("/api/sss-funds",restoreData);else if(type==="invest")await API.post("/api/daily-investments",restoreData);dismissUndo();refreshDashboard();refreshGuide();if(document.getElementById("tab-settings").classList.contains("active"))refreshSettings()}
let chartSSS=null,chartPersonal=null;
async function refreshDashboard(){const[calc,tradeStatus]=await Promise.all([API.calculations(),API.tradingStatus()]);document.getElementById("stat-budget").textContent=fmtW(calc.summary.personal_budget);document.getElementById("stat-personal-total").textContent=fmtW(calc.summary.personal_total_current);document.getElementById("stat-sss-total").textContent=fmtW(calc.summary.sss_total_full);const rate=calc.summary.adaptation_rate,rateEl=document.getElementById("stat-adaptation");rateEl.textContent=pct(rate);rateEl.style.color=rate>=0.8?"#34c759":(rate>=0.5?"#ff9500":"#ff3b30");const sssTotalCurrent=calc.sectors.reduce((a,s)=>a+(s.sss_current_amount||0),0);const personalTotalCurrent=calc.sectors.reduce((a,s)=>a+(s.personal_current_amount||0),0);renderPersonalChart(calc.sectors,calc.summary,personalTotalCurrent);renderSSSChart(calc.sectors,calc.summary,sssTotalCurrent);document.getElementById("guide-table-body").innerHTML=calc.sectors.filter(s=>s.personal_current_amount>0||s.sss_current_amount>0).map(s=>{const sssW=sssTotalCurrent>0?s.sss_current_amount/sssTotalCurrent:0;const myW=personalTotalCurrent>0?s.personal_current_amount/personalTotalCurrent:0;const myTarget=personalTotalCurrent*sssW;const diff=myTarget-s.personal_current_amount;const dir=diff>0.01?'buy':(diff<-0.01?'sell':'hold');return`<tr><td><strong>${s.sector_name}</strong></td><td class="num">${pct1(sssW)}</td><td class="num">${pct1(myW)}</td><td class="num">${fmt2(myTarget)}</td><td class="num">${fmt2(s.personal_current_amount)}</td><td class="num ${diff>0?'adj-positive':'adj-negative'}">${diff>=0?'+':''}${fmt2(diff)}</td><td><span class="badge ${dir==='buy'?'badge-buy':(dir==='sell'?'badge-sell':'badge-hold')}">${dir==='buy'?'买入':(dir==='sell'?'卖出':'持有')}</span></td></tr>`}).join("");const badge=document.getElementById("trading-badge");badge.textContent=tradeStatus.is_trading_day?"● 今日交易":"○ 今日休市";badge.className="trading-badge"+(tradeStatus.is_trading_day?" active":"")}
function renderPersonalChart(sectors,summary,totalCurrent){const dom=document.getElementById("chart-personal");if(!chartPersonal)chartPersonal=echarts.init(dom);const t=totalCurrent||1;chartPersonal.setOption({tooltip:{trigger:"item",formatter:p=>`${p.name}: ${(p.data.myWeight*100).toFixed(1)}%`},series:[{type:"pie",radius:["50%","78%"],center:["50%","55%"],itemStyle:{borderRadius:6,borderColor:"#fff",borderWidth:2},label:{formatter:p=>`${p.name}\n${(p.data.myWeight*100).toFixed(1)}%`,fontSize:12},data:sectors.filter(s=>(s.personal_current_amount||0)>0).map(s=>({name:s.sector_name,value:Math.round(s.personal_current_amount),myWeight:s.personal_current_amount/t}))}],color:["#007aff","#ff9500","#34c759","#ff3b30","#af52de","#5ac8fa","#ff6b35"]});chartPersonal.resize()}
function renderSSSChart(sectors,summary,totalCurrent){const dom=document.getElementById("chart-sss");if(!chartSSS)chartSSS=echarts.init(dom);const t=totalCurrent||1;chartSSS.setOption({tooltip:{trigger:"item",formatter:p=>`${p.name}: ${(p.data.sssWeight*100).toFixed(1)}%`},series:[{type:"pie",radius:["50%","78%"],center:["50%","55%"],itemStyle:{borderRadius:6,borderColor:"#fff",borderWidth:2},label:{formatter:p=>`${p.name}\n${(p.data.sssWeight*100).toFixed(1)}%`,fontSize:12},data:sectors.filter(s=>(s.sss_current_amount||0)>0).map(s=>({name:s.sector_name,value:Math.round(s.sss_current_amount),sssWeight:s.sss_current_amount/t}))}],color:["#007aff","#ff9500","#34c759","#ff3b30","#af52de","#5ac8fa","#ff6b35"]});chartSSS.resize()}
async function refreshGuide(){const[calc,personalFunds,sssFunds,sssConfigs,allSectors]=await Promise.all([API.calculations(),API.personalFunds(),API.sssFunds(),API.sssConfigs(),API.sectors()]);renderPersonalFunds(personalFunds,calc,allSectors);renderSSSFunds(sssFunds,calc)}

function sectorDatalist(sectors,id){
  return `<datalist id="${id}">${sectors.map(s=>`<option value="${s.name}">`).join("")}</datalist>`;
}

function renderPersonalFunds(personalFunds,calc,allSectors){
  const sectorNames={};
  const personalSectorTotals={};
  personalFunds.forEach(f=>{
    personalSectorTotals[f.sector_id]=(personalSectorTotals[f.sector_id]||0)+f.current_amount;
    sectorNames[f.sector_id]=f.sector_name||'';
  });
  // Build datalist from unique sector names currently in personal funds only
  const usedNames=[...new Set(personalFunds.map(f=>f.sector_name).filter(Boolean))];
  const dlId="pf-sector-list";
  const dlHTML=`<datalist id="${dlId}">${usedNames.map(n=>`<option value="${n}">`).join("")}</datalist>`;

  // Group funds by sector for rowspan
  const bySector={};
  personalFunds.forEach(f=>{
    if(!bySector[f.sector_id])bySector[f.sector_id]=[];
    bySector[f.sector_id].push(f);
  });

  // Build rows sorted by existing sector order then new sectors
  const ordered=[];
  allSectors.forEach(s=>{
    if(bySector[s.id])ordered.push({sid:s.id,funds:bySector[s.id]});
  });
  // Add sectors not in allSectors
  for(const[sid,funds]of Object.entries(bySector)){
    if(!allSectors.find(s=>s.id===parseInt(sid))){
      ordered.push({sid:parseInt(sid),funds});
    }
  }

  const pfTotal=personalFunds.reduce((s,f)=>s+f.current_amount,0)||1;
  const pfRows=[];
  ordered.forEach(({sid,funds})=>{
    const n=funds.length||1;
    funds.forEach((f,i)=>{
      const myPct=pfTotal>0?(f.current_amount/pfTotal*100):0;
      pfRows.push(`<tr>
        <td><input list="${dlId}" value="${f.sector_name||''}" style="padding:5px 8px;border:1px solid var(--border);border-radius:6px;font-size:13px;width:90px" onchange="updatePersonalFund(${f.id},'sector_name',this.value)"></td>
        <td><input class="w80" value="${f.code}" onchange="updatePersonalFund(${f.id},'code',this.value)"></td>
        <td><input class="w140" value="${f.name}" onchange="updatePersonalFund(${f.id},'name',this.value)"></td>
        <td><input class="num w80" type="number" step="0.01" value="${f.current_amount}" onchange="updatePersonalFund(${f.id},'current_amount',parseFloat(this.value))"></td>
        <td class="num">${myPct.toFixed(1)}%</td>
        ${i===0?`<td class="num" rowspan="${n}">${fmt2(personalSectorTotals[f.sector_id]||0)}</td>`:''}
        <td><button class="btn-del" onclick="deletePersonalFund(${f.id})" title="删除">&times;</button></td>
      </tr>`);
    });
  });

  // Inline add row
  pfRows.push(`<tr style="border-top:2px solid var(--accent)">
    <td><input list="${dlId}" id="new-pf-sector" placeholder="板块名" style="padding:5px 8px;border:1px solid var(--accent);border-radius:6px;font-size:13px;width:90px"></td>
    <td><input id="new-pf-code" placeholder="代码" class="w80" style="padding:5px 8px;border:1px solid var(--accent);border-radius:6px;font-size:13px"></td>
    <td><input id="new-pf-name" placeholder="基金名称" class="w140" style="padding:5px 8px;border:1px solid var(--accent);border-radius:6px;font-size:13px"></td>
    <td><input id="new-pf-amount" type="number" step="0.01" placeholder="金额" class="num w80" style="padding:5px 8px;border:1px solid var(--accent);border-radius:6px;font-size:13px"></td>
    <td class="num">-</td>
    <td class="num">-</td>
    <td><button class="btn btn-sm" onclick="saveNewPersonalFund()" style="background:var(--accent);color:#fff">保存</button></td>
  </tr>`);

  // Total row
  const stArr=Object.values(personalSectorTotals);
  pfRows.push(`<tr style="font-weight:700;border-top:2px solid var(--border)"><td colspan="3">共计</td><td class="num">${fmt2(pfTotal)}</td><td class="num">100.0%</td><td class="num">${fmt2(stArr.reduce((a,b)=>a+b,0))}</td><td></td></tr>`);

  document.getElementById("personal-funds-body").innerHTML=dlHTML+pfRows.join("");
}

async function saveNewPersonalFund(){
  const sectorName=document.getElementById("new-pf-sector").value.trim();
  const code=document.getElementById("new-pf-code").value.trim();
  const name=document.getElementById("new-pf-name").value.trim();
  const amount=parseFloat(document.getElementById("new-pf-amount").value)||0;
  if(!sectorName||!name||amount<=0)return;
  await API.post("/api/personal-funds",{sector_name:sectorName,code,name,current_amount:amount});
  refreshGuide();refreshDashboard();
}

function renderSSSFunds(sssFunds,calc){
  const sssFundTotal=sssFunds.reduce((s,f)=>s+f.current_amount,0)||1;
  const fundsBySector={};sssFunds.forEach(f=>{if(!fundsBySector[f.sector_id])fundsBySector[f.sector_id]=[];fundsBySector[f.sector_id].push(f)});
  const sssSectorTotals={};sssFunds.forEach(f=>{sssSectorTotals[f.sector_id]=(sssSectorTotals[f.sector_id]||0)+f.current_amount});
  const rows=[];
  calc.sectors.forEach(s=>{
    const funds=fundsBySector[s.sector_id]||[];
    const n=funds.length||1;
    const secTotal=sssSectorTotals[s.sector_id]||0;
    funds.forEach((f,i)=>{
      const pct=f.current_amount/sssFundTotal*100;
      rows.push(`<tr><td><span class="sector-tag">${s.sector_name}</span></td><td><code>${f.code}</code></td><td>${f.name}</td><td class="num">${fmt(f.current_amount)}</td><td class="num">${pct.toFixed(1)}%</td>${i===0?`<td class="num" rowspan="${n}">${fmt(secTotal)}</td>`:''}</tr>`);
    });
  });
  const sstArr=Object.values(sssSectorTotals);
  rows.push(`<tr style="font-weight:700;border-top:2px solid var(--border)"><td colspan="3">共计</td><td class="num">${fmt(sssFundTotal)}</td><td class="num">100.0%</td><td class="num">${fmt(sstArr.reduce((a,b)=>a+b,0))}</td></tr>`);
  document.getElementById("sss-detail-body").innerHTML=rows.join("");
}
async function updatePersonalFund(fid,field,value){await API.put(`/api/personal-funds/${fid}`,{[field]:value});refreshGuide();refreshDashboard()}
async function onPersonalSectorChange(fid,selectEl){const v=selectEl.value;if(v==="__new__"){const name=await domPrompt("新增板块","输入板块名称（支持中文输入法）");if(!name){refreshGuide();return}const r=await API.post("/api/sectors",{name:name,position_level:7,position_coefficient:0.7,full_position:0});if(r.id){await API.put(`/api/personal-funds/${fid}`,{sector_id:r.id})}}else{await API.put(`/api/personal-funds/${fid}`,{sector_id:parseInt(v)})}refreshGuide();refreshDashboard()}
async function deletePersonalFund(fid){const funds=await API.personalFunds();const fund=funds.find(f=>f.id===fid);if(!fund)return;const restoreData={sector_id:fund.sector_id,code:fund.code,name:fund.name,current_amount:fund.current_amount};await API.del(`/api/personal-funds/${fid}`);showUndo("personal",`/api/personal-funds/${fid}`,restoreData,`已删除「${fund.name||fund.code||'基金'}」`);refreshGuide();refreshDashboard()}
async function addPersonalFund(){const sectors=await API.sectors();document.getElementById("modal-sector").innerHTML=sectors.map(s=>`<option value="${s.id}">${s.name}</option>`).join("")+`<option value="__new__">+ 新增板块</option>`;document.getElementById("modal-type").value="personal";document.getElementById("modal-title").textContent="添加我的基金";document.getElementById("modal-code").value="";document.getElementById("modal-name").value="";document.getElementById("modal-amount").value="";document.getElementById("modal-overlay").style.display="flex"}
async function refreshCalculator(){const calc=await API.calculations();document.getElementById("calc-ratio").textContent=(calc.summary.ratio*100).toFixed(4)+"%";const amt=parseFloat(document.getElementById("calc-sss-amount").value)||0;if(amt>0)runSimulation()}
async function runSimulation(){const amt=parseFloat(document.getElementById("calc-sss-amount").value)||0;if(amt<=0){document.getElementById("calc-follow-total").textContent="--";document.getElementById("calc-breakdown").innerHTML="";return}const result=await API.simulate(amt);document.getElementById("calc-follow-total").textContent=fmt2(result.personal_follow_total);document.getElementById("calc-breakdown").innerHTML=result.breakdown.map(b=>`<div class="breakdown-item"><div class="b-name">${b.sector_name}</div><div class="b-amount">${fmt2(b.follow_amount)}</div></div>`).join("");document.getElementById("calc-ratio").textContent=(result.ratio*100).toFixed(4)+"%"}
async function saveFund(){const type=document.getElementById("modal-type").value;let sectorVal=document.getElementById("modal-sector").value;let sectorId;if(sectorVal==="__new__"){const name=await domPrompt("新增板块","输入板块名称（支持中文输入法）");if(!name)return;const r=await API.post("/api/sectors",{name:name,position_level:7,position_coefficient:0.7,full_position:0});if(!r.id)return;sectorId=r.id}else{sectorId=parseInt(sectorVal)}const code=document.getElementById("modal-code").value.trim();const name=document.getElementById("modal-name").value.trim();const amount=parseFloat(document.getElementById("modal-amount").value)||0;if(type==="sss"){await API.post("/api/sss-funds",{sector_id:sectorId,code,name,current_amount:amount});refreshGuide();refreshDashboard();const[s,c,f]=await Promise.all([API.sectors(),API.sssConfigs(),API.sssFunds()]);renderSSSBudgetCard(s,c,f);renderSSSEdit(s,c,f)}else{await API.post("/api/personal-funds",{sector_id:sectorId,code,name,current_amount:amount});refreshGuide();refreshDashboard()}closeModal()}
function closeModal(){document.getElementById("modal-overlay").style.display="none"}
function addSector(){document.getElementById("sector-name").value="";document.getElementById("sector-level").value="";document.getElementById("sector-full").value="";document.getElementById("sector-modal-overlay").style.display="flex"}
function closeSectorModal(){document.getElementById("sector-modal-overlay").style.display="none"}
async function saveSector(){const name=document.getElementById("sector-name").value.trim();const level=parseFloat(document.getElementById("sector-level").value);const full=parseFloat(document.getElementById("sector-full").value)||0;if(!name)return alert("请输入板块名称");if(isNaN(level)||level<=0)return alert("请输入有效仓位");await API.post("/api/sectors",{name,position_coefficient:level*0.1,position_level:level,full_position:full});closeSectorModal();refreshSettings()}
async function refreshSettings(){const[settings,sectors,sssConfigs,sssFunds,investments,tradeStatus]=await Promise.all([API.settings(),API.sectors(),API.sssConfigs(),API.sssFunds(),API.dailyInvestments(),API.tradingStatus()]);document.getElementById("setting-budget").value=settings.total_budget;renderSSSBudgetCard(sectors,sssConfigs,sssFunds);renderSSSEdit(sectors,sssConfigs,sssFunds);document.getElementById("invest-table-body").innerHTML=investments.length>0?investments.map(inv=>{const cd=inv.cycle_day!=null?inv.cycle_day:0;return`<tr><td><span class="sector-tag">${inv.sector_name}</span> ${inv.fund_label||''}</td><td><input type="number" step="1" value="${inv.daily_amount}" id="inv-amt-${inv.id}" onchange="saveInvestment(${inv.id})"></td><td><select id="inv-cycle-${inv.id}" onchange="onInvCycleChange(${inv.id})"><option value="daily" ${inv.cycle==="daily"?"selected":""}>每日</option><option value="weekly" ${inv.cycle==="weekly"?"selected":""}>每周</option><option value="biweekly" ${inv.cycle==="biweekly"?"selected":""}>每两周</option><option value="monthly" ${inv.cycle==="monthly"?"selected":""}>每月</option></select> <select id="inv-cycle-day-${inv.id}" onchange="saveInvestment(${inv.id})" style="${inv.cycle!=="daily"?"":"display:none"}"><option value="0" ${cd===0?"selected":""}>周一</option><option value="1" ${cd===1?"selected":""}>周二</option><option value="2" ${cd===2?"selected":""}>周三</option><option value="3" ${cd===3?"selected":""}>周四</option><option value="4" ${cd===4?"selected":""}>周五</option></select></td><td><select id="inv-active-${inv.id}" onchange="saveInvestment(${inv.id})"><option value="1" ${inv.is_active?"selected":""}>启用</option><option value="0" ${!inv.is_active?"selected":""}>暂停</option></select></td><td><button class="btn-del" onclick="deleteInvestment(${inv.id})" title="删除">&times;</button></td></tr>`}).join(""):'<tr><td colspan="5" style="color:#86868b">暂无定投记录，点击「+ 添加定投」从我的持仓中选择</td></tr>';document.getElementById("trading-status-text").textContent=`${tradeStatus.today} — ${tradeStatus.is_trading_day?"交易日":"非交易日"} — ${tradeStatus.processed_today?"定投已执行":"定投待执行"}`+(tradeStatus.pending_dates&&tradeStatus.pending_dates.length>0?` | 待处理: ${tradeStatus.pending_dates.length}天`:"")}
function renderSSSBudgetCard(sectors,configs,funds){const totals={};funds.forEach(f=>{totals[f.sector_id]=(totals[f.sector_id]||0)+f.current_amount});const sssTotal=Object.values(configs).reduce((sum,c)=>sum+(c.full_position||0),0);const currTotal=Object.values(totals).reduce((a,b)=>a+b,0);document.getElementById("sss-budget-table-body").innerHTML=sectors.filter(s=>(totals[s.id]||0)>0).map(s=>{const cfg=configs[s.id]||{};const fp=cfg.full_position||0;const cur=totals[s.id]||0;const fillPct=sssTotal>0?(fp/sssTotal*100):0;return`<tr><td><strong>${s.name}</strong></td><td class="num">${fmt(fp)}</td><td class="num">${fmt(cur)}</td><td class="num">${fillPct.toFixed(1)}%</td></tr>`}).join("")+`<tr style="font-weight:700;border-top:2px solid var(--border)"><td>共计</td><td class="num">${fmt(sssTotal)}</td><td class="num">${fmt(currTotal)}</td><td class="num">100%</td></tr>`}
function miniDonut(pct){const c=69.1;const off=c*(1-Math.min(pct,1));return`<svg width="26" height="26" viewBox="0 0 28 28"><circle cx="14" cy="14" r="11" fill="none" stroke="#e5e5ea" stroke-width="3"/><circle cx="14" cy="14" r="11" fill="none" stroke="${pct>=1?'#34c759':'#007aff'}" stroke-width="3" stroke-dasharray="${c}" stroke-dashoffset="${off}" stroke-linecap="round" transform="rotate(-90 14 14)"/><text x="14" y="17" text-anchor="middle" font-size="7" fill="#1d1d1f" font-weight="600">${Math.round(pct*100)}%</text></svg>`}

function renderSSSEdit(sectors,configs,funds){const fundsBySector={};funds.forEach(f=>{if(!fundsBySector[f.sector_id])fundsBySector[f.sector_id]=[];fundsBySector[f.sector_id].push(f)});document.getElementById("sss-edit-area").innerHTML=sectors.filter(s=>(fundsBySector[s.id]||[]).length>0).map(s=>{const cfg=configs[s.id]||{};const sfunds=fundsBySector[s.id]||[];const curTotal=sfunds.reduce((a,f)=>a+f.current_amount,0);const fp=cfg.full_position||0;const fillPct=fp>0?curTotal/fp:0;return`<div class="sss-sector-block"><div class="sector-header"><input value="${s.name}" style="font-weight:700;font-size:14px;width:80px;padding:4px 8px;border:1px solid var(--border);border-radius:5px;font-family:inherit" onchange="renameSector(${s.id},this.value)"><label>仓位(成)<input type="number" step="0.1" value="${cfg.position_level||10}" onchange="updateSSSConfig(${s.id},'position_level',parseFloat(this.value))"></label><label>满仓<input type="number" step="1" value="${fp}" onchange="updateSSSConfig(${s.id},'full_position',parseFloat(this.value))"></label><label>仓位系数<span style="display:inline-block;width:90px;padding:6px 10px;font-size:14px;font-weight:600">${((cfg.position_level||10)*0.1).toFixed(2)}</span></label><button class="btn btn-sm" onclick="addSSSFundToSector(${s.id},'${s.name}')">+ 基金</button><button class="btn-del" onclick="deleteSector(${s.id},'${s.name}')" title="删除板块">&times;</button><span style="display:inline-flex;align-items:center;gap:6px;margin-left:auto;font-size:13px;font-weight:600;color:var(--text)">${fmt(curTotal)} ${miniDonut(fillPct)}</span></div><table class="sss-fund-list"><thead><tr><th>板块</th><th>代码</th><th>名称</th><th>持仓金额</th><th></th></tr></thead><tbody>${sfunds.map(f=>{const secOpts=sectors.map(s=>`<option value="${s.id}" ${s.id===f.sector_id?'selected':''}>${s.name}</option>`).join("")+`<option value="__new__">+ 新增板块</option>`;return`<tr><td><select onchange="onSSSSectorChange(${f.id},this)" style="padding:5px 8px;border:1px solid var(--border);border-radius:5px;font-size:13px;font-family:inherit">${secOpts}</select></td><td><input value="${f.code}" onchange="updateSSSFund(${f.id},'code',this.value)"></td><td><input value="${f.name}" style="width:150px" onchange="updateSSSFund(${f.id},'name',this.value)"></td><td><input type="number" step="1" value="${f.current_amount}" onchange="updateSSSFund(${f.id},'current_amount',parseFloat(this.value))"></td><td><button class="btn-del" onclick="deleteSSSFund(${f.id})" title="删除">&times;</button></td></tr>`}).join("")||'<tr><td colspan="5" style="color:#86868b">暂无</td></tr>'}</tbody></table></div>`}).join("")}
async function updateSSSConfig(sid,field,value){await API.put(`/api/sss-configs/${sid}`,{[field]:value});if(field==="position_level"){await API.put(`/api/sectors/${sid}`,{position_coefficient:value*0.1});const[s,c,f]=await Promise.all([API.sectors(),API.sssConfigs(),API.sssFunds()]);renderSSSEdit(s,c,f)}const[sectors,configs,funds]=await Promise.all([API.sectors(),API.sssConfigs(),API.sssFunds()]);renderSSSBudgetCard(sectors,configs,funds);refreshDashboard();refreshGuide()}
async function updateSSSFund(fid,field,value){await API.put(`/api/sss-funds/${fid}`,{[field]:value});if(field==="current_amount"||field==="sector_id"){const[sectors,configs,funds]=await Promise.all([API.sectors(),API.sssConfigs(),API.sssFunds()]);renderSSSBudgetCard(sectors,configs,funds);refreshDashboard();refreshGuide()}}
async function onSSSSectorChange(fid,selectEl){const v=selectEl.value;if(v==="__new__"){const name=await domPrompt("新增板块","输入板块名称（支持中文输入法）");if(!name){refreshSettings();return}const r=await API.post("/api/sectors",{name:name,position_level:7,position_coefficient:0.7,full_position:0});if(r.id){await API.put(`/api/sss-funds/${fid}`,{sector_id:r.id})}}else{await API.put(`/api/sss-funds/${fid}`,{sector_id:parseInt(v)})}refreshSettings();refreshDashboard();refreshGuide()}
async function updateSector(sid,field,value){await API.put(`/api/sectors/${sid}`,{[field]:value})}
async function renameSector(sid,name){if(!name.trim()){refreshSettings();return}await API.put(`/api/sectors/${sid}`,{name:name.trim()});refreshSettings();refreshDashboard();refreshGuide()}
async function deleteSSSFund(fid){const funds=await API.sssFunds();const fund=funds.find(f=>f.id===fid);if(!fund)return;const restoreData={sector_id:fund.sector_id,code:fund.code,name:fund.name,current_amount:fund.current_amount};await API.del(`/api/sss-funds/${fid}`);showUndo("sss",`/api/sss-funds/${fid}`,restoreData,`已删除「${fund.name||fund.code||'SSS基金'}」`);const[sectors,configs,funds2]=await Promise.all([API.sectors(),API.sssConfigs(),API.sssFunds()]);renderSSSBudgetCard(sectors,configs,funds2);renderSSSEdit(sectors,configs,funds2);refreshGuide();refreshDashboard()}
async function deleteSector(sid,name){if(!confirm(`确认删除整个「${name}」板块及其所有数据？此操作不可撤销。`))return;await API.del(`/api/sectors/${sid}`);refreshSettings()}
async function addSSSFundToSector(sid,name){document.getElementById("modal-sector").innerHTML=`<option value="${sid}">${name}</option>`;document.getElementById("modal-type").value="sss";document.getElementById("modal-title").textContent=`添加 SSS 基金 — ${name}`;document.getElementById("modal-code").value="";document.getElementById("modal-name").value="";document.getElementById("modal-amount").value="";document.getElementById("modal-overlay").style.display="flex"}
async function saveInvestment(invId){const amt=parseFloat(document.getElementById("inv-amt-"+invId).value)||0;const active=parseInt(document.getElementById("inv-active-"+invId).value);const cycle=document.getElementById("inv-cycle-"+invId).value;const cycleDayEl=document.getElementById("inv-cycle-day-"+invId);const cycleDay=cycleDayEl?parseInt(cycleDayEl.value):null;await API.put(`/api/daily-investments/${invId}`,{daily_amount:amt,is_active:active,cycle:cycle,cycle_day:cycle==="daily"?null:cycleDay})}
async function processInvestments(){const st=document.getElementById("invest-status");st.textContent="处理中...";const r=await fetch("/api/trading/process",{method:"POST"}).then(r=>r.json());st.textContent=`已处理 ${r.processed} 笔`;setTimeout(refreshSettings,1000)}
function onInvCycleChange(invId){const cycle=document.getElementById("inv-cycle-"+invId).value;const dayEl=document.getElementById("inv-cycle-day-"+invId);dayEl.style.display=cycle==="daily"?"none":"";saveInvestment(invId)}
async function deleteInvestment(invId){const investments=await API.dailyInvestments();const inv=investments.find(i=>i.id===invId);if(!inv)return;const restoreData={sector_id:inv.sector_id,daily_amount:inv.daily_amount,fund_label:inv.fund_label||'',personal_fund_id:inv.personal_fund_id,is_active:inv.is_active,cycle:inv.cycle,cycle_day:inv.cycle_day};await API.del(`/api/daily-investments/${invId}`);showUndo("invest",`/api/daily-investments/${invId}`,restoreData,`已删除定投「${inv.fund_label||inv.sector_name}」`);refreshSettings()}
function onCycleChange(){const cycle=document.getElementById("invest-cycle").value;document.getElementById("invest-cycle-day-group").style.display=cycle==="daily"?"none":""}
async function addDailyInvestment(){const[personalFunds,sectors]=await Promise.all([API.personalFunds(),API.sectors()]);if(!personalFunds.length){alert("请先在「调仓指南 → 我的基金明细」中添加持仓基金");return}const sectorNames={};sectors.forEach(s=>{sectorNames[s.id]=s.name});document.getElementById("invest-fund-select").innerHTML=personalFunds.map(f=>`<option value="${f.id}">[${sectorNames[f.sector_id]||''}] ${f.code} ${f.name}</option>`).join("");document.getElementById("invest-daily-amount").value="";document.getElementById("invest-cycle").value="daily";document.getElementById("invest-cycle-day-group").style.display="none";document.getElementById("invest-modal-overlay").style.display="flex"}
function closeInvestModal(){document.getElementById("invest-modal-overlay").style.display="none"}
async function saveDailyInvestment(){const fundId=parseInt(document.getElementById("invest-fund-select").value);const amt=parseFloat(document.getElementById("invest-daily-amount").value)||0;const cycle=document.getElementById("invest-cycle").value;const cycleDay=cycle==="daily"?null:parseInt(document.getElementById("invest-cycle-day").value);if(!fundId||amt<=0)return;const funds=await API.personalFunds();const fund=funds.find(f=>f.id===fundId);if(!fund)return;await API.post("/api/daily-investments",{sector_id:fund.sector_id,personal_fund_id:fundId,fund_label:`${fund.code} ${fund.name}`,daily_amount:amt,is_active:0,cycle:cycle,cycle_day:cycleDay});closeInvestModal();refreshSettings()}
async function saveBudget(){const v=parseFloat(document.getElementById("setting-budget").value);if(isNaN(v)||v<=0)return;await API.put("/api/settings",{total_budget:v});refreshDashboard()}
async function loadSSSEdit(){const[sectors,configs,funds]=await Promise.all([API.sectors(),API.sssConfigs(),API.sssFunds()]);renderSSSEdit(sectors,configs,funds)}

// ── OCR ──

let ocrParsedData = null;
let domPromptResolve = null;

function domPrompt(title, placeholder){
  return new Promise(resolve => {
    domPromptResolve = resolve;
    document.getElementById("prompt-title").textContent = title;
    const inp = document.getElementById("prompt-input");
    inp.value = "";
    inp.placeholder = placeholder || "";
    inp.focus();
    document.getElementById("prompt-overlay").style.display = "flex";
    document.getElementById("prompt-ok-btn").onclick = () => {
      const val = inp.value.trim();
      document.getElementById("prompt-overlay").style.display = "none";
      domPromptResolve = null;
      resolve(val);
    };
    inp.onkeydown = (e) => {
      if(e.key === "Enter" && !e.isComposing){ document.getElementById("prompt-ok-btn").click(); }
      if(e.key === "Escape"){ document.getElementById("prompt-overlay").style.display = "none"; domPromptResolve = null; resolve(""); }
    };
  });
}

function closeDomPrompt(){
  if(domPromptResolve){
    domPromptResolve("");
    domPromptResolve = null;
  }
  document.getElementById("prompt-overlay").style.display = "none";
}

function setupOcrDropzone(){
  const zone = document.getElementById("ocr-dropzone");
  if(!zone) return;
  zone.addEventListener("click",()=>document.getElementById("ocr-file-input").click());
  zone.addEventListener("dragover",e=>{e.preventDefault();zone.classList.add("drag-over")});
  zone.addEventListener("dragleave",()=>zone.classList.remove("drag-over"));
  zone.addEventListener("drop",e=>{
    e.preventDefault();
    zone.classList.remove("drag-over");
    const file = e.dataTransfer.files[0];
    if(file) processOcrImage(file);
  });
  document.getElementById("ocr-file-input").addEventListener("change",function(){
    if(this.files[0]) processOcrImage(this.files[0]);
    this.value = "";
  });
}

async function handleOcrFile(input){
  if(input.files[0]) processOcrImage(input.files[0]);
  input.value = "";
}

async function processOcrImage(file){
  const zone = document.getElementById("ocr-dropzone");
  const statusEl = document.getElementById("ocr-status");
  statusEl.style.display = "block";
  statusEl.textContent = "⏳ 正在识别图片中的文字...";
  statusEl.className = "ocr-status loading";
  zone.style.pointerEvents = "none";
  zone.style.opacity = "0.5";

  try {
    const formData = new FormData();
    formData.append("image", file);
    const resp = await fetch("/api/ocr", {method:"POST", body:formData});
    const data = await resp.json();

    if(data.error){
      statusEl.textContent = "❌ OCR 识别失败: " + data.error;
      statusEl.className = "ocr-status error";
      zone.style.pointerEvents = "";
      zone.style.opacity = "";
      return;
    }

    statusEl.style.display = "none";
    zone.style.pointerEvents = "";
    zone.style.opacity = "";

    ocrParsedData = data;
    showOcrModal(data);

  } catch(err){
    statusEl.textContent = "❌ 请求失败: " + err.message;
    statusEl.className = "ocr-status error";
    zone.style.pointerEvents = "";
    zone.style.opacity = "";
  }
}

async function showOcrModal(data){
  ocrParsedData = data;
  const [sectors, sssFunds] = await Promise.all([API.sectors(), API.sssFunds()]);
  document.getElementById("ocr-raw").textContent = (data.raw_lines || []).join("\n");
  document.getElementById("ocr-raw").style.display = "none";
  renderOcrModal(sectors, sssFunds);
  document.getElementById("ocr-modal-overlay").style.display = "flex";
}

function renderOcrModal(sectors, sssFunds){
  const transactions = ocrParsedData?.transactions || [];

  const fundIndex = {};
  sssFunds.forEach(f => {
    fundIndex[f.name.trim()] = f;
    fundIndex[f.name.trim().toLowerCase()] = f;
  });

  function findMatchingFund(fundName){
    if(fundIndex[fundName.trim()]) return fundIndex[fundName.trim()];
    if(fundIndex[fundName.trim().toLowerCase()]) return fundIndex[fundName.trim().toLowerCase()];
    for(const key in fundIndex){
      const f = fundIndex[key];
      if(f.name.trim().includes(fundName.trim()) || fundName.trim().includes(f.name.trim())){
        return f;
      }
    }
    return null;
  }

  const tbody = document.getElementById("ocr-table-body");

  if(transactions.length === 0){
    tbody.innerHTML = `<tr><td colspan="6" style="color:#86868b;text-align:center;padding:20px">
      已无识别记录
    </td></tr>`;
  } else {
    tbody.innerHTML = transactions.map((tx,i)=>{
      const matched = findMatchingFund(tx.fund_name);
      const matchHtml = matched
        ? `<span class="ocr-match found">已匹配: ${matched.code} ${matched.name}<br>板块: ${sectors.find(s=>s.id===matched.sector_id)?.name||'--'} | 当前: ${fmt(matched.current_amount)}</span>`
        : `<span class="ocr-match new">新基金，需选择板块</span>`;

      const currentSectorId = matched ? matched.sector_id : tx.sector_id;
      const hasSel = !!currentSectorId;
      const sectorOpts = (hasSel ? "" : `<option value="">-- 请选择板块 --</option>`) +
        sectors.map(s=>{
          const sel = currentSectorId === s.id ? " selected" : "";
          return `<option value="${s.id}"${sel}>${s.name}</option>`;
        }).join("") + `<option value="__new__">+ 新增板块</option>`;

      return `<tr data-idx="${i}">
        <td><input value="${tx.operation_label||(tx.operation==='sell'?'卖出':'买入')}" style="width:50px" onchange="updateOcrTx(${i},'operation_label',this.value)"></td>
        <td><input value="${tx.fund_name}" style="width:200px" onchange="updateOcrTx(${i},'fund_name',this.value)"></td>
        <td><input type="number" step="0.01" value="${tx.amount}" class="ocr-amount" style="width:90px" onchange="updateOcrTx(${i},'amount',parseFloat(this.value))"></td>
        <td><select onchange="onOcrSectorChange(${i},this)">${sectorOpts}</select></td>
        <td>${matchHtml}</td>
        <td><button class="btn-del" onclick="deleteOcrTx(${i})" title="移除此条">&times;</button></td>
      </tr>`;
    }).join("");
  }
}

function updateOcrTx(idx, field, value){
  if(!ocrParsedData || !ocrParsedData.transactions) return;
  const tx = ocrParsedData.transactions[idx];
  if(!tx) return;
  tx[field] = value;
  if(field === "operation_label"){
    tx.operation = (value === "卖出") ? "sell" : "buy";
  }
}

async function onOcrSectorChange(idx,selectEl){
  const v = selectEl.value;
  if(v === "__new__"){
    // Replace select with inline input + confirm/cancel buttons (no modal!)
    const td = selectEl.parentElement;
    td.innerHTML = `<span style="display:flex;gap:4px;align-items:center">
      <input id="ocr-inline-input" style="width:100px;padding:5px 8px;border:1px solid var(--accent);border-radius:6px;font-size:13px;font-family:inherit" placeholder="输入板块名">
      <button class="btn btn-sm" onclick="confirmOcrNewSector(${idx})" style="background:var(--accent);color:#fff">OK</button>
      <button class="btn btn-sm" onclick="cancelOcrNewSector(${idx})">X</button>
    </span>`;
    const inp = document.getElementById("ocr-inline-input");
    if(inp){
      inp.focus();
      inp.addEventListener("keydown", (e) => {
        if(e.key === "Enter" && !e.isComposing){ e.preventDefault(); confirmOcrNewSector(idx); }
        if(e.key === "Escape"){ e.preventDefault(); cancelOcrNewSector(idx); }
      });
    }
  } else if(v === ""){
    updateOcrTx(idx, "sector_id", null);
  } else {
    updateOcrTx(idx, "sector_id", parseInt(v));
  }
}

async function confirmOcrNewSector(idx){
  const inp = document.getElementById("ocr-inline-input");
  const name = (inp ? inp.value : "").trim();
  if(!name) return;
  const r = await API.post("/api/sectors",{name:name,position_level:7,position_coefficient:0.7,full_position:0});
  if(!r.id) return;
  updateOcrTx(idx, "sector_id", r.id);
  rebuildOcrSelects();
}

async function cancelOcrNewSector(idx){
  rebuildOcrSelects();
}

function rebuildOcrSelects(){
  const txList = ocrParsedData?.transactions || [];
  API.sectors().then(sectors => {
    document.querySelectorAll("#ocr-table-body tr").forEach(tr => {
      const rowIdx = parseInt(tr.getAttribute("data-idx"));
      if(isNaN(rowIdx)) return;
      const tx = txList[rowIdx];
      const curSid = tx ? tx.sector_id : null;
      const hasSel = !!curSid;
      let o = (hasSel ? "" : `<option value="">-- 请选择板块 --</option>`);
      o += sectors.map(s => `<option value="${s.id}">${s.name}</option>`).join("");
      o += `<option value="__new__">+ 新增板块</option>`;
      const td = tr.querySelectorAll("td")[3];
      if(td) td.innerHTML = `<select onchange="onOcrSectorChange(${rowIdx},this)">${o}</select>`;
      const sel = td ? td.querySelector("select") : null;
      if(sel && curSid) sel.value = String(curSid);
    });
  });
}

function deleteOcrTx(idx){
  if(!ocrParsedData || !ocrParsedData.transactions) return;
  ocrParsedData.transactions.splice(idx, 1);
  if(ocrParsedData.transactions.length === 0){
    closeOcrModal();
    return;
  }
  Promise.all([API.sectors(), API.sssFunds()]).then(([sectors, sssFunds]) => {
    renderOcrModal(sectors, sssFunds);
  });
}

function closeOcrModal(){
  document.getElementById("ocr-modal-overlay").style.display = "none";
  ocrParsedData = null;
}

function toggleOcrRaw(){
  const el = document.getElementById("ocr-raw");
  const toggle = document.querySelector(".ocr-raw-toggle");
  if(el.style.display === "none"){
    el.style.display = "block";
    toggle.innerHTML = toggle.innerHTML.replace("▾","▴");
  } else {
    el.style.display = "none";
    toggle.innerHTML = toggle.innerHTML.replace("▴","▾");
  }
}

async function applyOcrResults(){
  if(!ocrParsedData || !ocrParsedData.transactions || ocrParsedData.transactions.length === 0){
    closeOcrModal();
    return;
  }

  const btn = document.querySelector("#ocr-modal-overlay .btn-primary");
  btn.textContent = "更新中...";
  btn.disabled = true;

  try {
    const resp = await fetch("/api/ocr/apply", {
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body: JSON.stringify({transactions: ocrParsedData.transactions})
    });
    const result = await resp.json();

    if(result.ok){
      const updated = result.updated || [];
      const created = result.created || [];
      let msg = "";
      if(updated.length > 0) msg += `已更新 ${updated.length} 只基金持仓`;
      if(created.length > 0) msg += (msg?"，":"") + `新增 ${created.length} 只基金`;
      if(!msg) msg = "无变更";

      const statusEl = document.getElementById("ocr-status");
      statusEl.style.display = "block";
      statusEl.textContent = `✅ ${msg}`;
      statusEl.className = "ocr-status";
      setTimeout(()=>{statusEl.style.display = "none"}, 4000);

      refreshGuide();
      refreshDashboard();
      const tabSettings = document.getElementById("tab-settings");
      if(tabSettings && tabSettings.classList.contains("active")) refreshSettings();
    } else {
      alert("更新失败: " + (result.error||"未知错误"));
    }
  } catch(err){
    alert("请求失败: " + err.message);
  }

  closeOcrModal();
}

document.addEventListener("DOMContentLoaded",()=>{switchTab("dashboard");window.addEventListener("resize",()=>{if(chartSSS)chartSSS.resize();if(chartPersonal)chartPersonal.resize()});setupOcrDropzone()});

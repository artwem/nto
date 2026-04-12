// ─── RENDER: STATS ──────────────────────────────────────────────────
function renderStats(){
  const now = new Date();
  const last6 = [];
  for(let i=5;i>=0;i--){
    let m=now.getMonth()-i, y=now.getFullYear();
    if(m<0){m+=12;y--;}
    const total=getMonthExpenses(y,m).reduce((s,e)=>s+e.amount,0);
    last6.push({label:SHORT_MONTHS[m]+"'"+String(y).slice(2),total,y,m});
  }
  document.getElementById('pie-month-label').textContent=MONTHS_RU[currentMonth.m]+' '+currentMonth.y;
  if(charts.monthly) charts.monthly.destroy();
  charts.monthly=new Chart(document.getElementById('chartMonthly'),{
    type:'bar',
    data:{labels:last6.map(x=>x.label),datasets:[{data:last6.map(x=>Math.round(x.total)),backgroundColor:last6.map((_,i)=>i===5?'#185fa5':'rgba(128,128,128,0.35)'),borderRadius:5,borderSkipped:false}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:v=>fmt(v.raw)}}},scales:{x:{grid:{display:false},ticks:{font:{size:10},color:'#888'}},y:{grid:{color:'rgba(128,128,128,.1)'},ticks:{callback:v=>fmtShort(v)+'₽',font:{size:9},color:'#888'}}}}
  });
  const {y,m}=currentMonth;
  const curExp=getMonthExpenses(y,m);
  const catTotals=DB.categories.map((_,i)=>curExp.filter(e=>e.cat===i).reduce((s,e)=>s+e.amount,0));
  const nonZero=catTotals.map((v,i)=>({v:Math.round(v),i})).filter(x=>x.v>0)
    .sort((a,b)=>b.v-a.v);
  // Custom bar structure chart — no Chart.js, full theme support
  const pieEl = document.getElementById('chartPie');
  pieEl.innerHTML = '';
  if(nonZero.length){
    const grandTotal = nonZero.reduce((s,x)=>s+x.v,0);
    const maxVal = nonZero[0].v;
    nonZero.forEach(x=>{
      const pct = grandTotal>0 ? (x.v/grandTotal*100).toFixed(1) : 0;
      const barW = maxVal>0 ? (x.v/maxVal*100) : 0;
      const color = getCatColor(x.i);
      const name = DB.categories[x.i]||'';
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;gap:8px;padding:4px 0';
      // Color dot
      const dot = document.createElement('div');
      dot.style.cssText = 'width:8px;height:8px;border-radius:50%;background:'+color+';flex-shrink:0';
      // Bar + label column
      const col = document.createElement('div');
      col.style.cssText = 'flex:1;min-width:0';
      // Name row
      const nameEl = document.createElement('div');
      nameEl.style.cssText = 'font-size:11px;color:#888;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:2px';
      nameEl.textContent = name;
      // Bar track
      const track = document.createElement('div');
      track.style.cssText = 'height:6px;background:rgba(128,128,128,.15);border-radius:3px;overflow:hidden';
      const fill = document.createElement('div');
      fill.style.cssText = 'height:100%;width:'+barW+'%;background:'+color+';border-radius:3px;transition:width .3s';
      track.appendChild(fill);
      col.appendChild(nameEl);
      col.appendChild(track);
      // Amount + percent
      const vals = document.createElement('div');
      vals.style.cssText = 'text-align:right;flex-shrink:0';
      const amtEl = document.createElement('div');
      amtEl.style.cssText = 'font-size:12px;font-weight:600;color:#888';
      amtEl.textContent = fmt(x.v);
      const pctEl = document.createElement('div');
      pctEl.style.cssText = 'font-size:10px;color:#666';
      pctEl.textContent = pct+'%';
      vals.appendChild(amtEl);
      vals.appendChild(pctEl);
      row.appendChild(dot);
      row.appendChild(col);
      row.appendChild(vals);
      pieEl.appendChild(row);
    });
  }
  const sorted=[...nonZero].sort((a,b)=>b.v-a.v).slice(0,7);
  const topH=Math.max(140,sorted.length*36+40);
  document.getElementById('chart-top-wrap').style.height=topH+'px';
  if(charts.top) charts.top.destroy();
  charts.top=new Chart(document.getElementById('chartTop'),{
    type:'bar',
    data:{labels:sorted.map(x=>DB.categories[x.i]),datasets:[{data:sorted.map(x=>x.v),backgroundColor:sorted.map(x=>getCatColor(x.i)),borderRadius:4,borderSkipped:false}]},
    options:{indexAxis:'y',responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:v=>fmt(v.raw)}}},scales:{x:{grid:{color:'rgba(128,128,128,.1)'},ticks:{callback:v=>fmtShort(v)+'₽',font:{size:9},color:'#888'}},y:{grid:{display:false},ticks:{font:{size:10},color:'#888'}}}}
  });
}

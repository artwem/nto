// ─── INIT ────────────────────────────────────────────────────────────
function init(){
  loadDB();
  const now=new Date();
  currentMonth={y:now.getFullYear(),m:now.getMonth()};
  currentDay=today();
  document.getElementById('fab').style.display='flex';
  document.getElementById('fab').textContent='+';
  if(!DB.expenses.length) addSampleData();
  renderBudget();
  // Auto-sync on start if URL configured
  initSyncWidget();
  if(DB.syncUrl) autoSyncOnStart();
  // Auto-push on page close
  window.addEventListener('beforeunload', autoSyncOnClose);
  window.addEventListener('pagehide', autoSyncOnClose);
}

// ── SYNC STATUS WIDGET ──────────────────────────────────────────────
function setSyncStatus(state, isoTs){
  const widget = document.getElementById('sync-widget');
  const dot    = document.getElementById('sync-dot');
  const text   = document.getElementById('sync-text');
  if(!widget) return;
  widget.style.display = 'flex';
  dot.className = 'sync-dot ' + state;
  if(state === 'syncing'){
    text.textContent = 'Синхр…';
  } else if(state === 'ok' && isoTs){
    const d = new Date(isoTs);
    const hhmm = d.getHours().toString().padStart(2,'0')+':'+d.getMinutes().toString().padStart(2,'0');
    const today = new Date().toDateString() === d.toDateString();
    text.textContent = today ? hhmm : d.getDate()+'.'+(d.getMonth()+1)+' '+hhmm;
  } else if(state === 'error'){
    text.textContent = 'Ошибка';
  } else {
    text.textContent = 'Не синхр.';
  }
}

function syncWidgetTap(){
  if(!DB.syncUrl){
    openSyncSettings();
    return;
  }
  // Show action sheet: push or pull
  const action = confirm('Синхронизация\n\nОК — Загрузить из таблицы\nОтмена — Выгрузить в таблицу');
  if(action) pullFromSheets();
  else pushToSheets();
}

function initSyncWidget(){
  if(!DB.syncUrl) return;
  const lastSync = localStorage.getItem('lastSync');
  setSyncStatus(lastSync ? 'ok' : 'none', lastSync);
}

async function autoSyncOnStart(){
  setSyncStatus('syncing');
  try{
    const d = await doSyncRequest({action:'pull'});
    if(d.error){ setSyncStatus('error'); return; }
    mergePullData(d);
    saveDB();
    renderBudget();
    const ts = new Date().toISOString();
    localStorage.setItem('lastSync', ts);
    setSyncStatus('ok', ts);
  } catch(e){ setSyncStatus('error'); }
}

function buildPayload(){
  return {
    expenses: DB.expenses,
    assets: DB.assets,
    categories: DB.categories,
    catColors: DB.catColors || {},
    banks: DB.banks,
    creditBanks: DB.creditBanks || [],
    limits: DB.limits,
    incomes: DB.incomes || []
  };
}

function autoSyncOnClose(){
  if(!DB.syncUrl || !DB._dirty) return;
  const body = JSON.stringify({action:'push', data: buildPayload()});
  // sendBeacon with POST body — most reliable on page close
  if(navigator.sendBeacon){
    const blob = new Blob([body], {type:'application/json'});
    navigator.sendBeacon(DB.syncUrl + '?action=push', blob);
  } else {
    fetch(DB.syncUrl + '?action=push', {method:'POST', headers:{'Content-Type':'application/json'}, body, keepalive:true}).catch(()=>{});
  }
  DB._dirty = false;
  localStorage.setItem('lastSync', new Date().toISOString());
}

function mergePullData(d){
  if(d.categories && d.categories.length) DB.categories = d.categories;
  if(d.limits) Object.assign(DB.limits, d.limits);

  // Merge expenses — preserve app-only comments
  if(d.expenses && d.expenses.length){
    const appComments = {};
    DB.expenses.forEach(e => { if(e.comment) appComments[e.id] = e.comment; });
    const appOnly = DB.expenses.filter(e => !e.id.startsWith('gs_'));
    const sheetEntries = d.expenses.map(e => ({...e, comment: e.comment || appComments[e.id] || ''}));
    DB.expenses = [...appOnly, ...sheetEntries];
  }

  // Merge assets — sheet wins, preserve app-only entries
  if(d.assets && d.assets.length){
    const appOnly = DB.assets.filter(a => !String(a.id||'').startsWith('gs_asset_'));
    DB.assets = [...appOnly, ...d.assets];
  }

  // Merge incomes
  if(d.incomes && d.incomes.length){
    const appOnlyInc = DB.incomes.filter(i => !String(i.id||'').startsWith('gs_inc_'));
    DB.incomes = [...appOnlyInc, ...d.incomes];
  }

  // Merge banks — add any new banks from sheet not yet in app
  if(d.banks && d.banks.length){
    d.banks.forEach(b => { if(!DB.banks.includes(b)) DB.banks.push(b); });
  }
  if(d.creditBanks && d.creditBanks.length){
    if(!DB.creditBanks) DB.creditBanks = [];
    d.creditBanks.forEach(b => { if(!DB.creditBanks.includes(b)) DB.creditBanks.push(b); });
  }
}



function addSampleData(){
  const now=new Date();
  const y=now.getFullYear(),m=now.getMonth();
  const pad=n=>String(n).padStart(2,'0');
  const d=day=>`${y}-${pad(m+1)}-${pad(day)}`;
  const days=now.getDate();
  const sample=[
    {cat:0,amount:12500,date:d(3)},{cat:1,amount:1200,date:d(5)},
    {cat:3,amount:8700,date:d(7)},{cat:4,amount:3200,date:d(9)},
    {cat:5,amount:1800,date:d(11)},{cat:12,amount:900,date:d(Math.min(13,days))},
    {cat:6,amount:4500,date:d(Math.min(15,days))},{cat:2,amount:900,date:d(4)},
    {cat:10,amount:1200,date:d(Math.min(18,days))},{cat:14,amount:5000,date:d(2)},
  ].filter(e=>{const day=parseInt(e.date.split('-')[2]);return day<=days;});
  sample.forEach(e=>{e.id=uid();DB.expenses.push(e);});
  DB.assets=[
    {id:uid(),bank:0,amount:85000,date:`${y}-${pad(m)}-01`},
    {id:uid(),bank:1,amount:42000,date:`${y}-${pad(m)}-01`},
    {id:uid(),bank:2,amount:15000,date:`${y}-${pad(m)}-01`},
    {id:uid(),bank:0,amount:91000,date:`${y}-${pad(m+1)}-01`},
    {id:uid(),bank:1,amount:47000,date:`${y}-${pad(m+1)}-01`},
  ].filter(a=>a.date.split('-')[1]<=String(m+1).padStart(2,'0'));
  const limArr=DB.categories.map((_,i)=>DEFAULT_LIMITS[i]||3000);
  DB.limits[monthKey(y,m)]=limArr;
  saveDB();
}

loadAppsScriptCode().then(() => init());

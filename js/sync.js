// ─── GOOGLE SHEETS SYNC ─────────────────────────────────────────────
// APPS_SCRIPT_CODE is in apps-script/Code.gs
// Loaded via fetch in sync.js
const APPS_SCRIPT_CODE = window._APPS_SCRIPT_CODE || '';

function copyAppsScript(){
  // Try modern clipboard API first
  if(navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(APPS_SCRIPT_CODE)
      .then(()=>toast('Скрипт скопирован!'))
      .catch(()=>showScriptModal());
  } else {
    showScriptModal();
  }
}

function showScriptModal(){
  document.getElementById('script-code-ta').value = APPS_SCRIPT_CODE;
  openModal('modal-script');
  setTimeout(()=>{
    const ta = document.getElementById('script-code-ta');
    ta.focus(); ta.select();
    try{
      if(document.execCommand('copy')) toast('Скрипт скопирован!');
    }catch(e){}
  }, 120);
}

function copyScriptFromModal(){
  const ta = document.getElementById('script-code-ta');
  ta.select();
  ta.setSelectionRange(0, 99999);
  if(navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(ta.value).then(()=>toast('Скрипт скопирован!'));
  } else {
    try{ document.execCommand('copy'); toast('Скрипт скопирован!'); }catch(e){ toast('Выделите текст и скопируйте вручную'); }
  }
}

function openSyncSettings(){
  document.getElementById('sync-url-input').value=DB.syncUrl||'';
  openModal('modal-sync');
}

function saveSyncUrl(){
  const url = document.getElementById('sync-url-input').value.trim();
  DB.syncUrl = url;
  localStorage.setItem('syncUrl', url);
  saveDB();
  closeModal('modal-sync');
  renderSettings();
  toast('URL сохранён');
}

async function doSyncRequest(params){
  // Always pass action in URL so it survives Google's redirects.
  // Data payload goes in POST body (stays intact on same-origin redirects).
  const url = DB.syncUrl + '?action=' + encodeURIComponent(params.action || '');
  const r = await fetch(url, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(params),
    redirect: 'follow'
  });
  const text = await r.text();
  return JSON.parse(text);
}

async function testSync(){
  if(!DB.syncUrl){toast('URL не задан');return;}
  const el = document.getElementById('sync-test-result');
  el.textContent='…';
  try{
    const d = await doSyncRequest({action:'ping'});
    el.textContent = d.ok ? '✓ Подключено' : ('✗ '+( d.error||'Ошибка'));
    toast(d.ok ? 'Подключение успешно!' : 'Ошибка: '+(d.error||'неизвестно'));
  }catch(e){
    el.textContent='✗ Недоступно';
    toast('Не удалось подключиться: '+e.message);
  }
}

async function pullFromSheets(){
  if(!DB.syncUrl){toast('URL не задан');return;}
  setSyncStatus('syncing');
  try{
    const d = await doSyncRequest({action:'pull'});
    if(d.error){ setSyncStatus('error'); toast('Ошибка: '+d.error); return; }
    mergePullData(d);
    if(d.banks&&d.banks.length) DB.banks=d.banks;
    saveDB();
    renderBudget();
    const ts = new Date().toISOString();
    localStorage.setItem('lastSync', ts);
    setSyncStatus('ok', ts);
    toast('Загружено из таблицы!');
  }catch(e){
    setSyncStatus('error');
    toast('Ошибка: '+e.message);
  }
}

async function pushToSheets(){
  if(!DB.syncUrl){toast('URL не задан');return;}
  setSyncStatus('syncing');
  try{
    const payload = buildPayload();
    const d = await doSyncRequest({action:'push', data: payload});
    if(d.success){
      const ts = new Date().toISOString();
      localStorage.setItem('lastSync', ts);
      DB._dirty = false;
      setSyncStatus('ok', ts);
      toast('Выгружено в таблицу!');
    } else {
      setSyncStatus('error');
      toast('Ошибка: '+(d.error||'неизвестно'));
    }
  }catch(e){
    setSyncStatus('error');
    toast('Ошибка: '+e.message);
  }
}



// ─── APPS SCRIPT CODE LOADER ─────────────────────────────────────────
// Loads Code.gs content and makes it available to showScriptModal
async function loadAppsScriptCode() {
  try {
    const r = await fetch('./apps-script/Code.gs');
    window._APPS_SCRIPT_CODE = await r.text();
  } catch(e) {
    // Fallback: inline placeholder
    window._APPS_SCRIPT_CODE = '// Could not load Code.gs - see apps-script/Code.gs';
  }
}

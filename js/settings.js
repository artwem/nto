// ─── RENDER: SETTINGS ───────────────────────────────────────────────
function renderSettings(){
  const hasSyncUrl = !!DB.syncUrl;
  document.getElementById('sync-url-display').textContent =
    hasSyncUrl ? DB.syncUrl.slice(0,40)+'…' : 'Не задан';
  ['sync-test-row','sync-pull-row','sync-push-row','sync-last-row','sync-interval-row'].forEach(id=>{
    const el = document.getElementById(id);
    if(el) el.style.display = hasSyncUrl ? 'flex' : 'none';
  });
  const lastSync = localStorage.getItem('lastSync') || sessionStorage.getItem('lastSync');
  if(lastSync){
    const d = new Date(lastSync);
    document.getElementById('sync-last-time').textContent =
      d.toLocaleDateString('ru-RU') + ' ' +
      d.toLocaleTimeString('ru-RU', {hour:'2-digit', minute:'2-digit'});
  }
  const intervalInput = document.getElementById('sync-interval-input');
  if(intervalInput) intervalInput.value = getSyncInterval();
  const lims = getLimits(currentMonth.y, currentMonth.m);
  document.getElementById('cat-settings-list').innerHTML = DB.categories.map((c,i) => `
    <div class="setting-row">
      <div style="display:flex;align-items:center;gap:8px;flex:1">
        <div style="width:10px;height:10px;border-radius:50%;background:${getCatColor(i)};flex-shrink:0"></div>
        <span class="setting-label">${c}</span>
      </div>
      <span class="setting-value">${fmt(lims[i]||0)} / мес</span>
    </div>
  `).join('');
}

// ─── CAT MANAGER ────────────────────────────────────────────────────
function openCatManager(){
  renderCatManager();
  openModal('modal-cats');
}

function renderCatManager(){
  // Build color → [indices] map to show group badges
  const colorCount = {};
  DB.categories.forEach((_,i) => {
    const c = getCatColor(i);
    colorCount[c] = (colorCount[c]||0) + 1;
  });

  document.getElementById('cat-manager-list').innerHTML = DB.categories.map((c,i) => {
    const color = getCatColor(i);
    const inGroup = colorCount[color] > 1;
    const delBtn = DB.categories.length > 1
      ? '<button class="btn danger small" onclick="removeCategory('+i+')">✕</button>'
      : '';
    const groupDot = inGroup
      ? '<span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:'+color+';margin-left:5px;vertical-align:middle" title="В группе"></span>'
      : '';
    return '<div class="setting-row" style="cursor:default;gap:6px;flex-wrap:nowrap" id="cat-row-'+i+'">'
      + '<input type="color" value="'+color+'"'
      + ' style="width:26px;height:26px;border:none;padding:0;border-radius:50%;cursor:pointer;flex-shrink:0;background:none"'
      + ' onchange="setCatColor('+i+',this.value)" title="Цвет. Одинаковый цвет = одна группа"/>'
      + '<span class="setting-label" style="flex:1;cursor:pointer" onclick="startEditCat('+i+')">'+c+groupDot+'</span>'
      + '<button class="btn small" style="padding:5px 8px;flex-shrink:0" onclick="startEditCat('+i+')" title="Переименовать">✎</button>'
      + delBtn
      + '</div>';
  }).join('');

  // Show group summary below list
  const groups = buildGroupSummary();
  const grpEl = document.getElementById('cat-group-summary');
  if(grpEl){
    if(groups.length){
      grpEl.style.display = 'block';
      grpEl.innerHTML = '<div style="font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;padding:12px 0 6px">Группы</div>'
        + groups.map(g =>
            '<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-top:0.5px solid var(--border)">'
            + '<input type="color" value="'+g.color+'" onchange="setGroupColor(\''+g.color+'\',this.value)"'
            + ' style="width:22px;height:22px;border:none;padding:0;border-radius:50%;cursor:pointer;flex-shrink:0;background:none"/>'
            + '<span style="font-size:13px;color:var(--text);flex:1">'+g.names.join(', ')+'</span>'
            + '</div>'
          ).join('');
    } else {
      grpEl.style.display = 'none';
    }
  }
}

function buildGroupSummary(){
  const colorMap = {};
  DB.categories.forEach((c,i) => {
    const col = getCatColor(i);
    if(!colorMap[col]) colorMap[col] = {color:col, names:[]};
    colorMap[col].names.push(c);
  });
  return Object.values(colorMap).filter(g => g.names.length > 1);
}

// Change color of entire group
function setGroupColor(oldColor, newColor){
  if(!DB.catColors) DB.catColors = {};
  DB.categories.forEach((_,i) => {
    if(getCatColor(i) === oldColor) DB.catColors[i] = newColor;
  });
  saveDB();
  renderCatManager();
}

function startEditCat(i){
  const row = document.getElementById('cat-row-'+i);
  if(!row) return;
  const oldName = DB.categories[i];
  const color = getCatColor(i);

  // Build group options: unique colors with member names
  const colorMap = {};
  DB.categories.forEach((c,j) => {
    const col = getCatColor(j);
    if(!colorMap[col]) colorMap[col] = [];
    colorMap[col].push({name:c, idx:j});
  });
  const groups = Object.entries(colorMap).filter(([,members]) => members.length > 1);

  // Row 1: color + name
  const colorInp = document.createElement('input');
  colorInp.type = 'color';
  colorInp.value = color;
  colorInp.style.cssText = 'width:26px;height:26px;border:none;padding:0;border-radius:50%;cursor:pointer;flex-shrink:0;background:none';
  colorInp.id = 'cat-color-inp-'+i;
  colorInp.addEventListener('change', function(){ setCatColor(i, this.value); });

  const nameInp = document.createElement('input');
  nameInp.type = 'text';
  nameInp.id = 'cat-edit-'+i;
  nameInp.value = oldName;
  nameInp.style.cssText = 'flex:1;padding:6px 8px;font-size:14px;border:0.5px solid var(--border2);border-radius:var(--r-sm);background:var(--card);color:var(--text);font-family:inherit;min-width:0';
  nameInp.addEventListener('keydown', function(e){
    if(e.key==='Enter') saveCatName(i);
    if(e.key==='Escape') renderCatManager();
  });

  const btnOk = document.createElement('button');
  btnOk.className = 'btn primary small';
  btnOk.textContent = '✓';
  btnOk.onclick = function(){ saveCatName(i); };

  const btnCancel = document.createElement('button');
  btnCancel.className = 'btn small';
  btnCancel.textContent = '✕';
  btnCancel.onclick = renderCatManager;

  row.innerHTML = '';
  row.style.flexWrap = 'wrap';
  row.append(colorInp, nameInp, btnOk, btnCancel);

  // Row 2: group selector (only if groups exist)
  if(groups.length){
    const grpRow = document.createElement('div');
    grpRow.style.cssText = 'display:flex;align-items:center;gap:8px;width:100%;padding:6px 0 2px 34px';

    const lbl = document.createElement('span');
    lbl.style.cssText = 'font-size:12px;color:var(--muted);white-space:nowrap';
    lbl.textContent = 'Группа:';

    const sel = document.createElement('select');
    sel.id = 'cat-group-sel-'+i;
    sel.style.cssText = 'flex:1;padding:5px 8px;font-size:13px;border:0.5px solid var(--border2);border-radius:var(--r-sm);background:var(--card);color:var(--text)';

    // Option: no group
    const optNone = document.createElement('option');
    optNone.value = '';
    optNone.textContent = '— без группы —';
    sel.appendChild(optNone);

    // One option per existing group
    groups.forEach(([grpColor, members]) => {
      const opt = document.createElement('option');
      opt.value = grpColor;
      opt.textContent = members.filter(m => m.idx !== i).map(m => m.name).join(', ');
      if(grpColor === color && members.length > 1) opt.selected = true;
      sel.appendChild(opt);
    });

    sel.addEventListener('change', function(){
      if(this.value){
        // Join group — apply group color to this category
        setCatColor(i, this.value);
        // Update color picker to reflect
        const cp = document.getElementById('cat-color-inp-'+i);
        if(cp) cp.value = this.value;
      }
    });

    grpRow.append(lbl, sel);
    row.appendChild(grpRow);
  }

  setTimeout(function(){ nameInp.focus(); nameInp.select(); }, 50);
}

function saveCatName(i){
  const inp = document.getElementById('cat-edit-'+i);
  if(!inp) return;
  const newName = inp.value.trim();
  if(!newName){ toast('Название не может быть пустым'); return; }
  if(newName !== DB.categories[i]){
    if(DB.categories.includes(newName)){ toast('Такая категория уже есть'); return; }
    const oldName = DB.categories[i];
    DB.categories[i] = newName;
    if(!DB.catRenames) DB.catRenames = [];
    DB.catRenames.push({from: oldName, to: newName, ts: Date.now()});
  }
  saveDB();
  renderCatManager();
  toast('Сохранено');
}

function addCategory(){
  const name = document.getElementById('new-cat-name').value.trim();
  if(!name){ toast('Введите название'); return; }
  if(DB.categories.includes(name)){ toast('Уже существует'); return; }
  DB.categories.push(name);
  Object.keys(DB.limits).forEach(k=>{
    if(Array.isArray(DB.limits[k])) DB.limits[k].push(3000);
  });
  saveDB();
  document.getElementById('new-cat-name').value = '';
  renderCatManager();
  toast('Добавлено: ' + name);
}

function setCatColor(i, color){
  if(!DB.catColors) DB.catColors = {};
  DB.catColors[i] = color;
  saveDB();
  renderCatManager();
}

function removeCategory(i){
  if(DB.categories.length <= 1) return;
  const name = DB.categories[i];
  DB.categories.splice(i, 1);
  const newColors = {};
  Object.entries(DB.catColors||{}).forEach(([k,v]) => {
    const ki = parseInt(k);
    if(ki < i) newColors[ki] = v;
    else if(ki > i) newColors[ki-1] = v;
  });
  DB.catColors = newColors;
  Object.keys(DB.limits).forEach(k=>{
    if(Array.isArray(DB.limits[k])) DB.limits[k].splice(i, 1);
  });
  DB.expenses.forEach(e=>{
    if(e.cat > i) e.cat--;
    else if(e.cat === i) e.cat = 0;
  });
  saveDB();
  renderCatManager();
  toast('Удалено: ' + name);
}

// ─── EXPORT CSV ─────────────────────────────────────────────────────
function exportCSV(){
  const rows = [['id','категория','сумма','дата','комментарий']];
  DB.expenses.filter(e => !e._deleted).forEach(e=>{
    rows.push([e.id, DB.categories[e.cat]||'', e.amount, e.date, e.comment||'']);
  });
  const csv = rows.map(r =>
    r.map(v => '"'+String(v).replace(/"/g,'""')+'"').join(',')
  ).join('\n');
  const a = document.createElement('a');
  a.href = 'data:text/csv;charset=utf-8,\uFEFF' + encodeURIComponent(csv);
  a.download = 'budget_' + today() + '.csv';
  a.click();
  toast('CSV скачан');
}

function confirmClearData(){
  openModal('modal-confirm-clear');
}

function doClearData(){
  DB.expenses   = [];
  DB.assets     = [];
  DB.incomes    = [];
  DB.limits     = {};
  DB.catRenames = [];
  DB.bankRenames= [];
  DB.categories  = [];
  DB.catColors   = {};
  DB.banks       = [];
  DB.creditBanks = [];
  saveDB();
  closeModal('modal-confirm-clear');
  renderBudget();
  toast('Все данные очищены');
}

// ─── RENDER: BUDGET ─────────────────────────────────────────────────
function renderBudget(){
  const {y,m} = currentMonth;
  document.getElementById('month-label').textContent = MONTHS_RU[m]+' '+y;
  const limits = getLimits(y,m);
  const list = document.getElementById('cat-list');
  list.innerHTML='';
  let totalSpent=0, totalLimit=0;
  DB.categories.forEach((cat,i)=>{
    const spent = getCatSpent(i,y,m);
    const lim = limits[i]||0;
    totalSpent+=spent; totalLimit+=lim;
    const pct = lim>0 ? (spent/lim)*100 : 0;
    const pctOfBudget = totalLimit>0 ? ((lim/totalLimit)*100) : 0;
    const isOver = spent>lim&&lim>0;
    const bar = Math.min(pct,100);
    const barClass = pct<70?'pf-ok':pct<100?'pf-warn':'pf-over';
    const badgeClass = isOver?'badge-over':pct>=70?'badge-warn':'badge-ok';
    const badgeText = isOver?'Превышен':pct.toFixed(0)+'%';
    const row=document.createElement('div');
    row.className='cat-row'+(isOver?' over':'');
    row.innerHTML=`
      <div class="cat-top">
        <span class="cat-name">${cat}</span>
        <div class="cat-badges">
          <span class="badge ${badgeClass}">${badgeText}</span>
        </div>
      </div>
      <div class="cat-nums">
        <span class="cat-spent">${fmt(spent)}</span>
        <span class="cat-limit-txt">из ${fmt(lim)} · ${pctOfBudget.toFixed(0)}% бюджета</span>
      </div>
      <div class="progress"><div class="progress-fill ${barClass}" style="width:${bar}%"></div></div>
    `;
    list.appendChild(row);
  });
  const left=totalLimit-totalSpent;
  document.getElementById('sum-spent').textContent=fmt(totalSpent);
  document.getElementById('sum-limit').textContent=fmt(totalLimit);
  const leftEl=document.getElementById('sum-left');
  leftEl.textContent=fmt(Math.abs(left));
  leftEl.className='s-val '+(left<0?'over':'ok');
}

// ─── EXPENSE CRUD ───────────────────────────────────────────────────
function openAddExpense(){
  editingExpenseId = null;
  document.getElementById('expense-modal-title').textContent='Добавить расход';
  document.getElementById('exp-delete-btn').style.display='none';
  populateCatSelect('exp-cat');
  document.getElementById('exp-date').value = currentPage==='day' ? currentDay : today();
  document.getElementById('exp-amount').value='';
  document.getElementById('exp-comment').value='';
  openModal('modal-expense');
}

function editExpense(id, e){
  if(e) e.stopPropagation();
  const exp = DB.expenses.find(x=>x.id===id);
  if(!exp) return;
  editingExpenseId = id;
  document.getElementById('expense-modal-title').textContent='Редактировать';
  document.getElementById('exp-delete-btn').style.display='block';
  populateCatSelect('exp-cat');
  document.getElementById('exp-cat').value = exp.cat;
  document.getElementById('exp-amount').value = exp.amount;
  document.getElementById('exp-date').value = exp.date;
  document.getElementById('exp-comment').value = exp.comment||'';
  openModal('modal-expense');
}

function saveExpense(){
  const amt = parseFloat(document.getElementById('exp-amount').value);
  if(!amt||amt<=0){toast('Введите сумму');return;}
  const obj = {
    cat: parseInt(document.getElementById('exp-cat').value),
    amount: amt,
    date: document.getElementById('exp-date').value,
    comment: document.getElementById('exp-comment').value
  };
  if(editingExpenseId){
    const idx = DB.expenses.findIndex(e=>e.id===editingExpenseId);
    if(idx>=0){DB.expenses[idx]={...DB.expenses[idx],...obj};}
  } else {
    obj.id = uid();
    DB.expenses.push(obj);
  }
  saveDB();
  closeModal('modal-expense');
  if(currentPage==='day') renderDay();
  else renderBudget();
  toast(editingExpenseId?'Обновлено':'Добавлено');
}

function deleteExpense(){
  if(!editingExpenseId) return;
  DB.expenses = DB.expenses.filter(e=>e.id!==editingExpenseId);
  saveDB();
  closeModal('modal-expense');
  if(currentPage==='day') renderDay();
  else renderBudget();
  toast('Удалено');
}

function populateCatSelect(id){
  document.getElementById(id).innerHTML = DB.categories.map((c,i)=>`<option value="${i}">${c}</option>`).join('');
}

// ─── LIMIT EDITOR ───────────────────────────────────────────────────
function openLimitEditor(){
  const sel = document.getElementById('limit-month-sel');
  // Build list of current + recent 12 months
  const opts = [];
  const now = new Date();
  for(let i=0;i<13;i++){
    let m=now.getMonth()-i, y=now.getFullYear();
    if(m<0){m+=12;y--;}
    opts.push({y,m,label:MONTHS_RU[m]+' '+y,key:monthKey(y,m)});
  }
  sel.innerHTML = opts.map(o=>`<option value="${o.key}">${o.label}</option>`).join('');
  sel.value = monthKey(currentMonth.y,currentMonth.m);
  loadLimitEditor();
  openModal('modal-limits');
}

function loadLimitEditor(){
  const key = document.getElementById('limit-month-sel').value;
  const [y,m] = key.split('-').map(Number);
  const limits = getLimits(y,m-1);
  const rows = document.getElementById('limit-editor-rows');
  rows.innerHTML = DB.categories.map((c,i)=>`
    <div class="limit-edit-row">
      <span class="limit-edit-name">${c}</span>
      <input class="limit-edit-input" type="number" id="lim_${i}" value="${limits[i]||0}" inputmode="decimal"/>
    </div>
  `).join('');
}

function saveLimits(){
  const key = document.getElementById('limit-month-sel').value;
  const newLimits = DB.categories.map((_,i)=>{
    const v = parseFloat(document.getElementById('lim_'+i).value)||0;
    return v;
  });
  DB.limits[key] = newLimits;
  saveDB();
  closeModal('modal-limits');
  renderBudget();
  toast('Лимиты сохранены');
}

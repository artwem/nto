// ===== BUDGET TRACKER APPS SCRIPT v8 =====
// Автоматически создаёт все нужные листы при первом запуске.
// Деплой: Расширения → Apps Script → Развернуть → Новое развертывание
// Тип: Веб-приложение | Выполнять как: Я | Доступ: Все

const SHEET_DAYS     = 'По дням';
const SHEET_TEMPLATE = 'Шаблон';
const SHEET_COMMENTS = 'Комментарии';
const SHEET_ASSETS   = 'Активы на 01';
const SHEET_INCOME   = 'Доходы';
const MONTHS_RU = ['Январь','Февраль','Март','Апрель','Май','Июнь',
                   'Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
const DEFAULT_CATS = [
  'ЖКУ + жилье','Транспорт','Связь + интернет','Еда+Хозтовары, уход',
  'Еда вне дома','Доставка','Одежда','Зубы','Активности','Хотелки',
  'Развлечения','Подарки','Такси','Дом, быт, другое','Мама','Непредвиденные расходы'
];
const DEFAULT_LIMITS = [15000,3000,1500,20000,8000,5000,5000,3000,4000,5000,3000,3000,2000,4000,5000,5000];

function doGet(e) {
  const action = (e.parameter && e.parameter.action) || '';
  let data = null;
  if (e.parameter && e.parameter.data) {
    try {
      if (e.parameter.enc === 'b64') {
        // Decode base64 + UTF-8
        const decoded = decodeURIComponent(escape(Utilities.base64Decode(
          e.parameter.data, Utilities.Charset.UTF_8
        ).map(b => String.fromCharCode(b)).join('')));
        data = JSON.parse(decoded);
      } else {
        data = JSON.parse(e.parameter.data);
      }
    } catch(err) { data = null; }
  }
  return handleRequest(action, data);
}

// Keep doPost as alias in case of future use
function doPost(e) { return doGet(e); }

function handleRequest(action, data) {
  let result = {};
  try {
    if      (action === 'ping') result = { ok: true, version: '8.2' };
    else if (action === 'pull') result = pullData();
    else if (action === 'push') {
      const payload = (typeof data === 'string') ? JSON.parse(data) : data;
      if (!payload) throw new Error('Empty payload');
      const debug = pushData(payload);
      result = { success: true, debug };
    }
    else result = { error: 'Unknown action: "' + action + '". Valid: ping, pull, push' };
  } catch(err) {
    result = { error: err.message };
  }
  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── HELPERS ───────────────────────────────────────────────────────────
function fmtDate(d) {
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}
function monthSheetName(yr, mo) { return MONTHS_RU[mo]+' '+yr; }

function readSheetLimits(sheetData) {
  const r2 = {};
  for (let r = 1; r < sheetData.length; r++) {
    const cat = sheetData[r][0], lim = sheetData[r][4];
    if (cat && String(cat) !== 'Итого')
      r2[String(cat)] = (typeof lim === 'number' && lim > 0) ? lim : 0;
  }
  return r2;
}

// Create sheet only if missing, with optional headers
function ensureSheet(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    if (headers) sheet.getRange(1,1,1,headers.length).setValues([headers]);
  }
  return sheet;
}

// ── SETUP: Create all required sheets if missing ──────────────────────
function setupSheets(ss) {
  // 1. Шаблон — rows: header + each category + Итого
  let tmpl = ss.getSheetByName(SHEET_TEMPLATE);
  if (!tmpl) {
    tmpl = ss.insertSheet(SHEET_TEMPLATE);
    const rows = [['Статья Расходов','Сумма/Мес','Доля Общая','Доля Лимита','Лимиты',null,'Итого доходов','Аванс',null]];
    DEFAULT_CATS.forEach((cat, i) => rows.push([cat, 0, 0, 0, DEFAULT_LIMITS[i]||0]));
    rows.push(['Итого', 0, 0, 0, '=SUM(E2:E'+(rows.length)+')']);
    tmpl.getRange(1,1,rows.length,9).setValues(rows);
  }

  // 2. По дням — row 1 = header with dates for current year
  if (!ss.getSheetByName(SHEET_DAYS)) {
    const daysSheet = ss.insertSheet(SHEET_DAYS);
    const now = new Date();
    const year = now.getFullYear();
    const startDate = new Date(year, 0, 1); // Jan 1
    const dates = [null]; // col A = category name
    for (let d = new Date(startDate); d.getFullYear() === year; d.setDate(d.getDate()+1)) {
      dates.push(new Date(d));
    }
    daysSheet.getRange(1,1,1,dates.length).setValues([dates]);
    // Format date columns
    const dateFormat = daysSheet.getRange(1, 2, 1, dates.length-1);
    dateFormat.setNumberFormat('dd.mm');
    // Add category rows
    const tmplData = tmpl.getDataRange().getValues();
    let rowIdx = 2;
    for (let r = 1; r < tmplData.length; r++) {
      const cat = tmplData[r][0];
      if (cat && String(cat) !== 'Итого') {
        daysSheet.getRange(rowIdx, 1).setValue(cat);
        rowIdx++;
      }
    }
    // Add Итого row with SUM formula
    daysSheet.getRange(rowIdx, 1).setValue('Итого');
    for (let c = 2; c <= dates.length; c++) {
      const col = columnLetter(c);
      daysSheet.getRange(rowIdx, c).setFormula('=SUM('+col+'2:'+col+(rowIdx-1)+')');
    }
  }

  // 3. Активы на 01
  ensureSheet(ss, SHEET_ASSETS, ['Дата','Сбер','Альфа','Тиньк','Цифра+Фридом','Газпром','Яндекс','Озон','Финуслуги','РСХБ','КРЕДИТ(СПЛИТ)','Общий актив']);

  // 4. Доходы
  ensureSheet(ss, SHEET_INCOME, ['id','date','source','amount','comment','month']);

  // 5. Комментарии
  ensureSheet(ss, SHEET_COMMENTS, ['catIdx','date','comment','category']);
}

function columnLetter(n) {
  let s = '';
  while (n > 0) { s = String.fromCharCode(65+(n-1)%26)+s; n = Math.floor((n-1)/26); }
  return s;
}

function getOrCreateMonthSheet(ss, yr, mo) {
  const name = monthSheetName(yr, mo);
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    const tmpl = ss.getSheetByName(SHEET_TEMPLATE);
    if (!tmpl) { setupSheets(ss); }
    sheet = ss.getSheetByName(SHEET_TEMPLATE).copyTo(ss);
    sheet.setName(name);
    sheet.getRange(1,6).setValue(new Date(yr, mo, 1));
  }
  return sheet;
}

// ── PULL ──────────────────────────────────────────────────────────────
function pullData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  setupSheets(ss);

  // --- Expenses ---
  const daysSheet = ss.getSheetByName(SHEET_DAYS);
  const daysData = daysSheet.getDataRange().getValues();
  const headerRow = daysData[0];

  const dateColMap = {};
  for (let c = 1; c < headerRow.length; c++)
    if (headerRow[c] instanceof Date) dateColMap[fmtDate(headerRow[c])] = c;

  const catRowMap = {}, categories = [];
  for (let r = 1; r < daysData.length; r++) {
    const cat = daysData[r][0];
    if (cat && String(cat) !== 'Итого') { catRowMap[String(cat)] = r; categories.push(String(cat)); }
  }

  const expenseMap = {};
  for (const cat of categories) {
    const r = catRowMap[cat], catIdx = categories.indexOf(cat);
    for (const [dateStr, c] of Object.entries(dateColMap)) {
      const val = daysData[r][c];
      if (val === null || val === undefined || val === '') continue;
      const num = typeof val === 'number' ? val : parseFloat(String(val).replace(/[^0-9.]/g,''));
      if (!isNaN(num) && num > 0) {
        const key = catIdx+'_'+dateStr.replace(/-/g,'');
        expenseMap[key] = { id:'gs_'+key, cat:catIdx, amount:num, date:dateStr, comment:'' };
      }
    }
  }

  // Merge comments
  const commData = ss.getSheetByName(SHEET_COMMENTS).getDataRange().getValues();
  for (let r = 1; r < commData.length; r++) {
    const [catIdx, dateStr, comment] = commData[r];
    if (catIdx===''||catIdx===null) continue;
    const key = catIdx+'_'+String(dateStr).replace(/-/g,'');
    if (expenseMap[key] && comment) expenseMap[key].comment = String(comment);
  }

  // --- Incomes ---
  const incSheet = ss.getSheetByName(SHEET_INCOME);
  const incData = incSheet.getDataRange().getValues();
  const incomes = [];
  for (let r = 1; r < incData.length; r++) {
    const [id, date, source, amount, comment] = incData[r];
    if (!id) continue;
    incomes.push({ id: String(id), date: String(date instanceof Date ? fmtDate(date) : date),
      source: String(source||''), amount: +amount||0, comment: String(comment||'') });
  }

  // --- Assets ---
  const aSheet = ss.getSheetByName(SHEET_ASSETS);
  const aData = aSheet.getDataRange().getValues();
  const aHeader = aData[0];
  const banks = [], creditBanks = [], bankCols = [];
  for (let c = 1; c < aHeader.length - 1; c++) {
    const name = String(aHeader[c]||'').trim();
    if (!name) continue;
    const isCredit = name.toUpperCase().includes('КРЕДИТ');
    bankCols.push({ name, colIdx: c, isCredit });
    if (isCredit) creditBanks.push(name); else banks.push(name);
  }
  const allBanks = [...banks, ...creditBanks];
  const assets = [];
  for (let r = 1; r < aData.length; r++) {
    if (!(aData[r][0] instanceof Date)) continue;
    const dateStr = fmtDate(aData[r][0]);
    for (const {name, colIdx} of bankCols) {
      const val = aData[r][colIdx];
      if (val===null||val===undefined||val==='') continue;
      const num = typeof val==='number' ? val : parseFloat(String(val).replace(/[^0-9.]/g,''));
      if (isNaN(num)) continue;
      assets.push({ id:'gs_asset_'+allBanks.indexOf(name)+'_'+dateStr.replace(/-/g,''),
        bank: allBanks.indexOf(name), amount: Math.abs(num), date: dateStr });
    }
  }

  // --- Limits ---
  const tmplSheet = ss.getSheetByName(SHEET_TEMPLATE);
  const templateLimits = readSheetLimits(tmplSheet.getDataRange().getValues());
  const limits = {};
  ss.getSheets().forEach(s => {
    const name = s.getName();
    MONTHS_RU.forEach((mon, idx) => {
      if (name.startsWith(mon+' ')) {
        const yr = parseInt(name.split(' ')[1]);
        if (!isNaN(yr)) {
          const key = yr+'-'+String(idx+1).padStart(2,'0');
          const sl = readSheetLimits(s.getDataRange().getValues());
          limits[key] = categories.map(cat => sl[cat]>0 ? sl[cat] : (templateLimits[cat]||0));
        }
      }
    });
  });
  const now = new Date();
  for (let i = 0; i < 3; i++) {
    let m = now.getMonth()+i, yr = now.getFullYear();
    if (m>11){m-=12;yr++;}
    const key = yr+'-'+String(m+1).padStart(2,'0');
    if (!limits[key]) limits[key] = categories.map(cat => templateLimits[cat]||0);
  }

  return { expenses: Object.values(expenseMap), categories, limits, assets, banks, creditBanks, incomes };
}

// ── PUSH ──────────────────────────────────────────────────────────────
function pushData(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  setupSheets(ss);

  const op = data.op || 'full'; // operation type
  const dbg = { op, cells_written: 0, comments_written: 0, rows_added: 0 };

  if (op === 'cats' || op === 'full') {
    pushCategories(ss, data.categories || []);
  }

  if (op === 'limits' || op === 'full') {
    pushLimits(ss, data.categories || [], data.limits || (data.month ? { [data.month]: data.limits_arr || data.limits } : {}));
  }

  if (op === 'expenses' || op === 'full') {
    const r = pushExpenses(ss, data.categories || [], data.expenses || []);
    dbg.cells_written = r.cells;
    dbg.comments_written = r.comments;
    dbg.dateColMap_total = r.dateColTotal;
    dbg.catRowMap_total = r.catRowTotal;
    dbg.first_expense = (data.expenses||[])[0] || null;
  }

  if (op === 'assets' || op === 'full') {
    pushAssets(ss, data.assets || [], data.banks || [], data.creditBanks || []);
  }

  if (op === 'incomes' || op === 'full') {
    pushIncomes(ss, data.incomes || []);
  }

  return { success: true, debug: dbg };
}

function pushCategories(ss, categories) {
  if (!categories.length) return;
  const daysSheet = ss.getSheetByName(SHEET_DAYS);
  const sheetData = daysSheet.getDataRange().getValues();
  const catRowMap = {};
  for (let r = 1; r < sheetData.length; r++) {
    const c = sheetData[r][0];
    if (c && String(c) !== 'Итого') catRowMap[String(c)] = r;
  }
  for (const cat of categories) {
    if (catRowMap[cat] || cat === 'Итого') continue;
    let itogoRow = daysSheet.getLastRow();
    for (let r = 1; r <= daysSheet.getLastRow(); r++) {
      if (daysSheet.getRange(r,1).getValue() === 'Итого') { itogoRow = r; break; }
    }
    daysSheet.insertRowBefore(itogoRow);
    daysSheet.getRange(itogoRow, 1).setValue(cat);
    catRowMap[cat] = itogoRow - 1;
    // Add to Шаблон
    const tmpl = ss.getSheetByName(SHEET_TEMPLATE);
    if (tmpl) {
      const td = tmpl.getDataRange().getValues();
      let ti = tmpl.getLastRow();
      for (let r = 0; r < td.length; r++) { if (td[r][0] === 'Итого') { ti = r+1; break; } }
      tmpl.insertRowBefore(ti);
      tmpl.getRange(ti, 1).setValue(cat);
      tmpl.getRange(ti, 5).setValue(0);
    }
  }
}

function pushExpenses(ss, categories, expenses) {
  const result = { cells: 0, comments: 0, dateColTotal: 0, catRowTotal: 0 };
  if (!expenses.length) return result;

  const daysSheet = ss.getSheetByName(SHEET_DAYS);
  const sheetData = daysSheet.getDataRange().getValues();
  const headerRow = sheetData[0];

  // Build dateColMap — handle both Date objects and serial numbers
  const dateColMap = {};
  for (let c = 1; c < headerRow.length; c++) {
    const cell = headerRow[c];
    if (cell instanceof Date) {
      dateColMap[fmtDate(cell)] = c;
    } else if (typeof cell === 'number' && cell > 40000) {
      const d = new Date(Math.round((cell - 25569) * 86400 * 1000));
      dateColMap[fmtDate(d)] = c;
    }
  }
  result.dateColTotal = Object.keys(dateColMap).length;

  // Build catRowMap
  const catRowMap = {};
  for (let r = 1; r < sheetData.length; r++) {
    const c = sheetData[r][0];
    if (c && String(c) !== 'Итого') catRowMap[String(c)] = r;
  }
  result.catRowTotal = Object.keys(catRowMap).length;

  // Write expense cells — group by cat+date, sum amounts
  const cellMap = {};
  const commentMap = {};
  for (const exp of expenses) {
    const catName = categories[exp.cat];
    if (!catName) continue;
    const col = dateColMap[exp.date];
    const row = catRowMap[catName];
    if (col === undefined || row === undefined) continue;
    const key = row + '_' + col;
    cellMap[key] = (cellMap[key] || 0) + exp.amount;
    if (exp.comment) commentMap[exp.cat + '_' + exp.date] = { comment: exp.comment, cat: exp.cat, date: exp.date, catName };
  }

  for (const [key, amount] of Object.entries(cellMap)) {
    const [r, c] = key.split('_').map(Number);
    daysSheet.getRange(r + 1, c + 1).setValue(amount);
    result.cells++;
  }

  // Write comments
  const commSheet = ss.getSheetByName(SHEET_COMMENTS) || ss.insertSheet(SHEET_COMMENTS);
  const commData = commSheet.getDataRange().getValues();
  const existingComm = {};
  for (let r = 1; r < commData.length; r++) {
    if (commData[r][0] !== '') existingComm[commData[r][0] + '_' + commData[r][1]] = r + 1;
  }
  for (const [key, info] of Object.entries(commentMap)) {
    const rowNum = existingComm[key];
    if (rowNum) {
      commSheet.getRange(rowNum, 3).setValue(info.comment);
    } else {
      commSheet.appendRow([info.cat, info.date, info.comment, info.catName]);
    }
    result.comments++;
  }

  return result;
}

function pushLimits(ss, categories, limits) {
  Object.entries(limits).forEach(([key, limArr]) => {
    if (!Array.isArray(limArr)) return;
    const [yr, mo] = key.split('-').map(Number);
    const mSheet = getOrCreateMonthSheet(ss, yr, mo - 1);
    const mData = mSheet.getDataRange().getValues();
    const mCatRow = {};
    for (let r = 1; r < mData.length; r++) {
      const c = mData[r][0];
      if (c && String(c) !== 'Итого') mCatRow[String(c)] = r + 1;
    }
    categories.forEach((cat, idx) => {
      const lim = limArr[idx]; if (lim === undefined) return;
      if (mCatRow[cat]) {
        mSheet.getRange(mCatRow[cat], 5).setValue(lim);
      } else {
        let iRow = mSheet.getLastRow();
        for (let r = 1; r <= mSheet.getLastRow(); r++) {
          if (mSheet.getRange(r,1).getValue() === 'Итого') { iRow = r; break; }
        }
        mSheet.insertRowBefore(iRow);
        mSheet.getRange(iRow, 1).setValue(cat);
        mSheet.getRange(iRow, 5).setValue(lim);
      }
    });
  });
}

function pushAssets(ss, assets, banks, creditBanks) {
  if (!assets.length) return;
  const allBanks = [...banks, ...creditBanks];
  const aSheet = ss.getSheetByName(SHEET_ASSETS);
  if (!aSheet) return;
  const aData = aSheet.getDataRange().getValues();
  const aHeader = aData[0];
  const colByBank = {};
  for (let c = 1; c < aHeader.length; c++) colByBank[String(aHeader[c]||'')] = c;

  // Add missing bank columns
  for (const bank of allBanks) {
    if (!colByBank[bank] && bank) {
      const lc = aSheet.getLastColumn();
      aSheet.insertColumnBefore(lc);
      aSheet.getRange(1, lc).setValue(bank);
      colByBank[bank] = lc;
    }
  }

  // Build date → row map
  const freshData = aSheet.getDataRange().getValues();
  const dateRowMap = {};
  for (let r = 1; r < freshData.length; r++) {
    if (freshData[r][0] instanceof Date) dateRowMap[fmtDate(freshData[r][0])] = r + 1;
  }

  for (const a of assets) {
    const bname = allBanks[a.bank]; if (!bname) continue;
    const col = colByBank[bname]; if (!col) continue;
    let row = dateRowMap[a.date];
    if (!row) {
      aSheet.appendRow([new Date(a.date)]);
      row = aSheet.getLastRow();
      dateRowMap[a.date] = row;
      const lc = aSheet.getLastColumn();
      const ldc = columnLetter(lc - 1);
      aSheet.getRange(row, lc).setFormula('=IF(SUM(B'+row+':'+ldc+row+')=0,,SUM(B'+row+':'+ldc+row+'))');
    }
    aSheet.getRange(row, col).setValue(a.amount);
  }
}

function pushIncomes(ss, incomes) {
  if (!incomes.length) return;
  const incSheet = ss.getSheetByName(SHEET_INCOME) || getOrCreateSheet(ss, SHEET_INCOME, ['id','date','source','amount','comment','month']);
  const incData = incSheet.getDataRange().getValues();
  const existing = {};
  for (let r = 1; r < incData.length; r++) {
    if (incData[r][0]) existing[String(incData[r][0])] = r + 1;
  }
  for (const inc of incomes) {
    const row = [inc.id, inc.date, inc.source, inc.amount, inc.comment||'', inc.date.slice(0,7)];
    if (existing[inc.id]) incSheet.getRange(existing[inc.id], 1, 1, row.length).setValues([row]);
    else { incSheet.appendRow(row); existing[inc.id] = incSheet.getLastRow(); }
  }
}

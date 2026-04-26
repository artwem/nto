// ===== BUDGET TRACKER APPS SCRIPT v10 — Drive Storage =====
// Деплой: Расширения → Apps Script → Развернуть → Новое развертывание
// Тип: Веб-приложение | Выполнять как: Я | Доступ: Все
// Данные хранятся в файле nto_data.json в Google Drive (не в таблице)

const FILE_DATA   = 'nto_data.json';
const FILE_BACKUP = 'nto_backup.json';

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const action = body.action || '';
    if (action === 'ping')        return out({ ok: true, version: '10.0' });
    if (action === 'push')        return out(saveFile(FILE_DATA, JSON.stringify(body.data || {})));
    if (action === 'pull')        return readFile(FILE_DATA);
    if (action === 'driveBackup') return out(saveFile(FILE_BACKUP, JSON.stringify(body.data || {})));
    return out({ error: 'Unknown action: ' + action });
  } catch(err) {
    return out({ error: err.message });
  }
}

function doGet(e) {
  const action = (e.parameter && e.parameter.action) || '';
  if (action === 'ping')           return out({ ok: true, version: '10.0' });
  if (action === 'pull')           return readFile(FILE_DATA);
  if (action === 'getDriveBackup') return readFile(FILE_BACKUP);
  return out({ info: 'Budget Tracker API v10.0' });
}

function saveFile(name, content) {
  try {
    const it = DriveApp.getFilesByName(name);
    if (it.hasNext()) it.next().setContent(content);
    else DriveApp.createFile(name, content, MimeType.PLAIN_TEXT);
    return { ok: true };
  } catch(err) { return { error: err.message }; }
}

function readFile(name) {
  try {
    const it = DriveApp.getFilesByName(name);
    if (!it.hasNext()) return out({ empty: true });
    return ContentService.createTextOutput(it.next().getBlob().getDataAsString())
      .setMimeType(ContentService.MimeType.JSON);
  } catch(err) { return out({ error: err.message }); }
}

function out(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

# Budget Tracker — Структура проекта

```
budget-tracker/
├── index.html              ← Только HTML разметка + подключение скриптов
├── build.sh                ← Сборка в один файл для деплоя
├── manifest.json           ← PWA манифест
│
├── css/
│   └── app.css             ← Все стили приложения
│
├── js/                     ← Каждый файл = один модуль
│   ├── db.js               ← База данных: константы, loadDB/saveDB, хелперы, toast, модалки
│   ├── nav.js              ← Навигация: showPage, changeMonth, changeDay
│   ├── budget.js           ← Бюджет: renderBudget, расходы CRUD, лимиты
│   ├── day.js              ← Вкладка День: renderDay
│   ├── income.js           ← Доходы: renderIncome, CRUD доходов
│   ├── stats.js            ← Аналитика: графики Chart.js
│   ├── assets.js           ← Активы: renderAssets, банки, записи активов
│   ├── settings.js         ← Настройки: категории, цвета, экспорт CSV
│   ├── sync.js             ← Google Sheets: sync, push, pull, виджет статуса
│   ├── calc.js             ← Калькулятор вкладов
│   └── init.js             ← Инициализация, автосинхронизация, демо-данные
│
└── apps-script/
    └── Code.gs             ← Google Apps Script (копировать в редактор скриптов)
```

## Разработка

Открыть локально: просто открыть `index.html` в браузере.
> Примечание: `fetch('./apps-script/Code.gs')` требует http-сервер.
> Для локальной разработки: `python3 -m http.server 8080`

## Деплой

### Netlify Drop (быстро, без регистрации)
```bash
chmod +x build.sh
./build.sh
# Перетащи папку dist/ на netlify.com/drop
```

### Netlify с Git (автодеплой при изменениях)
1. Запушь репо на GitHub
2. Подключи на netlify.com → New site from Git
3. Build command: `bash build.sh`
4. Publish directory: `dist`

## Редактирование модулей

| Что хочу изменить | Файл |
|---|---|
| Логику категорий / лимитов | `js/budget.js` |
| Добавить/убрать категории по умолчанию | `js/db.js` → `DEFAULT_CATS` |
| Графики | `js/stats.js` |
| Синхронизацию | `js/sync.js` |
| Apps Script (таблица) | `apps-script/Code.gs` |
| Стили / цвета | `css/app.css` |
| Структуру страниц | `index.html` |

## Google Sheets синхронизация

1. Открой свою Google Таблицу
2. Расширения → Apps Script
3. Скопируй содержимое `apps-script/Code.gs`
4. Развернуть → Новое развертывание → Веб-приложение
5. Доступ: **Все**, Выполнять как: **Я**
6. Скопируй URL → вставь в приложение (Настройки → URL)

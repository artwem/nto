#!/bin/bash
# build.sh — Bundle all files into a single index.html for Netlify Drop deployment
# Usage: ./build.sh
# Output: dist/index.html

set -e
DIST="dist"
mkdir -p "$DIST"

echo "Building budget-tracker..."

# Read parts
CSS=$(cat css/app.css)
DB=$(cat js/db.js)
NAV=$(cat js/nav.js)
BUDGET=$(cat js/budget.js)
DAY=$(cat js/day.js)
INCOME=$(cat js/income.js)
STATS=$(cat js/stats.js)
ASSETS=$(cat js/assets.js)
SETTINGS=$(cat js/settings.js)
SYNC=$(cat js/sync.js)
CALC=$(cat js/calc.js)
INIT=$(cat js/init.js)
APPS_SCRIPT=$(cat apps-script/Code.gs)

# Replace the loader in sync.js with inline apps script
SYNC_INLINE="${SYNC/loadAppsScriptCode().then(() => init());/}"
INIT_INLINE="${INIT/loadAppsScriptCode().then(() => init());/init();}"

# Build combined HTML
cat > "$DIST/index.html" << HTMLEOF
<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<meta name="theme-color" content="#ffffff">
<title>Бюджет</title>
<link rel="manifest" href="manifest.json">
<script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js"></script>
<style>
${CSS}
</style>
</head>
$(cat index.html | sed 's|<link rel="stylesheet" href="css/app.css">||' \
  | sed 's|<script src="js/[^"]*"></script>||g' \
  | sed 's|</body>||')
<script>
window._APPS_SCRIPT_CODE = \`$(cat apps-script/Code.gs | sed 's/`/\\`/g')\`;
${DB}
${NAV}
${BUDGET}
${DAY}
${INCOME}
${STATS}
${ASSETS}
${SETTINGS}
${SYNC_INLINE}
${CALC}
${INIT_INLINE}
</script>
</body>
</html>
HTMLEOF

cp manifest.json "$DIST/manifest.json" 2>/dev/null || true

echo "✓ Built: $DIST/index.html ($(wc -c < $DIST/index.html) bytes)"
echo ""
echo "Deploy options:"
echo "  • Netlify Drop: drag the 'dist' folder to netlify.com/drop"
echo "  • Or drag just dist/index.html if manifest.json is not needed"

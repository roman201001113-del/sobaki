const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();

const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'servers.json');
const TXT_FILE = path.join(__dirname, 'servers.txt');

let servers = {};

// Загружаем данные при старте (если есть)
try {
    if (fs.existsSync(DATA_FILE)) {
        servers = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    }
} catch(e) {
    servers = {};
}

// Функция очистки старых записей и сохранения
function cleanupAndSave() {
    const now = Date.now();
    let changed = false;
    
    for (let ip in servers) {
        if (now - servers[ip].last_seen > 60000) { // 60 секунд
            delete servers[ip];
            changed = true;
        }
    }
    
    if (changed || true) {
        // Сохраняем JSON
        fs.writeFileSync(DATA_FILE, JSON.stringify(servers, null, 2));
        // Сохраняем TXT (только IP)
        fs.writeFileSync(TXT_FILE, Object.keys(servers).join('\n'));
    }
}

// Запускаем очистку каждые 10 секунд
setInterval(cleanupAndSave, 10000);

// ========== МАРШРУТ ДЛЯ E2 ЧИПА ==========
app.get('/collect', (req, res) => {
    // Получаем IP отправителя
    let ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    
    // Очищаем IP (убираем префикс ::ffff: и порт)
    ip = ip.replace('::ffff:', '').split(',')[0].trim();
    
    const chip = req.query.chip || 'unknown';
    
    servers[ip] = {
        chip: chip,
        first_seen: servers[ip]?.first_seen || new Date().toISOString(),
        last_seen: Date.now(),
        requests: (servers[ip]?.requests || 0) + 1
    };
    
    res.send('1');
});

// ========== ВЕБ-СТРАНИЦА СО СПИСКОМ ==========
app.get('/', (req, res) => {
    const now = Date.now();
    let html = `<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="refresh" content="5">
    <title>Активные E2 серверы</title>
    <style>
        body { font-family: Arial; margin: 20px; background: #1a1a2e; color: #eee; }
        h1 { color: #00d4aa; font-size: 22px; }
        .server {
            background: #16213e; padding: 10px 15px; margin: 5px 0;
            border-left: 3px solid #00d4aa; border-radius: 4px;
            font-family: monospace;
        }
        .ip { color: #00d4aa; font-weight: bold; }
        .chip { color: #888; margin-left: 10px; }
        .time { color: #666; float: right; }
        .count { color: #888; margin: 15px 0; }
        .empty { color: #666; text-align: center; padding: 50px; }
        a { color: #00d4aa; }
    </style>
</head>
<body>
    <h1>🟢 Активные E2 серверы (&lt;60 сек)</h1>
`;

    let active = 0;
    for (let ip in servers) {
        const s = servers[ip];
        const ago = Math.floor((now - s.last_seen) / 1000);
        if (ago <= 60) {
            active++;
            html += `<div class="server">
                <span class="ip">${ip}</span>
                <span class="chip">[${s.chip}]</span>
                <span class="time">${ago} сек назад | запросов: ${s.requests}</span>
            </div>`;
        }
    }
    
    html += `<div class="count">Всего активно: <strong>${active}</strong></div>`;
    if (active === 0) {
        html += `<div class="empty">Нет активных серверов. Ждём запрос...</div>`;
    }
    
    html += `<p style="margin-top:20px;font-size:13px;color:#555;">
        📄 <a href="/servers.txt">servers.txt</a> | 
        🔗 E2 URL: <code>${req.protocol}://${req.get('host')}/collect?chip=Server01</code>
    </p></body></html>`;
    
    res.send(html);
});

// ========== ОТДАЧА TXT ФАЙЛА ==========
app.get('/servers.txt', (req, res) => {
    if (fs.existsSync(TXT_FILE)) {
        res.sendFile(TXT_FILE);
    } else {
        res.send('');
    }
});

// ========== ЗАПУСК ==========
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

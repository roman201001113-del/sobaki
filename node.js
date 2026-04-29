const express = require('express');
const fs = require('fs');
const app = express();

let servers = {};

// Принимаем запрос от E2
app.get('/collect', (req, res) => {
    const ip = req.ip || req.connection.remoteAddress;
    const chip = req.query.chip || 'unknown';
    
    servers[ip] = {
        chip: chip,
        last_seen: Date.now()
    };
    
    // Чистим старые (>60 сек)
    const now = Date.now();
    for (let key in servers) {
        if (now - servers[key].last_seen > 60000) {
            delete servers[key];
        }
    }
    
    // Сохраняем в TXT
    fs.writeFileSync('servers.txt', Object.keys(servers).join('\n'));
    
    res.send('1');
});

// Просмотр списка
app.get('/', (req, res) => {
    const list = Object.keys(servers).map(ip => 
        `${ip} [${servers[ip].chip}] - ${Math.floor((Date.now() - servers[ip].last_seen)/1000)}s ago`
    ).join('<br>');
    res.send(`<h2>Active Servers</h2>${list || 'None'}<br><a href="servers.txt">TXT file</a>`);
});

app.listen(3000, () => console.log('Running on port 3000'));
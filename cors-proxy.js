const http = require('http');
const https = require('https');
const url = require('url');

const PORT = 3000;

function proxyRequest(targetUrl, headers = {}) {
    return new Promise((resolve, reject) => {
        const parsed = new URL(targetUrl);
        const client = parsed.protocol === 'https:' ? https : http;
        const req = client.get(targetUrl, { headers }, (res) => {
            let data = '';
            res.on('data', (chunk) => (data += chunk));
            res.on('end', () => {
                try {
                    resolve({ status: res.statusCode, data: JSON.parse(data) });
                } catch {
                    resolve({ status: res.statusCode, data });
                }
            });
        });
        req.on('error', reject);
        req.setTimeout(15000, () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });
    });
}

const server = http.createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    const parsed = url.parse(req.url, true);
    const params = parsed.query;

    try {
        if (parsed.pathname === '/xtream') {
            const serverUrl = params.url;
            delete params.url;
            const qs = new URLSearchParams(params).toString();
            const targetUrl = `${serverUrl}/player_api.php?${qs}`;
            console.log(`[xtream] ${targetUrl}`);

            const headers = {};
            if (params.macAddress) {
                headers['Cookie'] = `mac=${params.macAddress}`;
            }

            const result = await proxyRequest(targetUrl, headers);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ payload: result.data }));
        } else if (parsed.pathname === '/stalker') {
            const portalUrl = params.url;
            const macAddress = params.macAddress;
            delete params.url;
            delete params.macAddress;
            const qs = new URLSearchParams(params).toString();
            const targetUrl = `${portalUrl}?${qs}`;
            console.log(`[stalker] ${targetUrl}`);

            const headers = {
                Cookie: `mac=${macAddress}`,
                'X-User-Agent': 'Model: MAG250; Link: WiFi',
            };

            const result = await proxyRequest(targetUrl, headers);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ payload: result.data }));
        } else if (parsed.pathname === '/parse') {
            const playlistUrl = params.url;
            console.log(`[parse] ${playlistUrl}`);
            const result = await proxyRequest(playlistUrl);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result.data));
        } else {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'ok', message: 'IPTVnator CORS Proxy' }));
        }
    } catch (err) {
        console.error('Proxy error:', err.message);
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
    }
});

server.listen(PORT, () => {
    console.log(`CORS proxy running at http://localhost:${PORT}`);
    console.log('Ready to proxy Xtream, Stalker, and M3U requests.');
});

import http from 'http';
import https from 'https';

const PORT = 3000;

function fetchStream(url, res, redirectCount = 0) {
    if (redirectCount > 5) {
        res.writeHead(500);
        res.end(JSON.stringify({ error: 'Too many redirects' }));
        return;
    }

    const client = url.startsWith('https') ? https : http;

    console.log(`\x1b[36m[Proxy Request]\x1b[0m ${url}`);

    const proxyReq = client.get(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'audio/mpeg, audio/*;q=0.9, */*;q=0.8',
            'Referer': 'https://www.internet-radio.com/',
            'Range': 'bytes=0-'
        }
    }, (proxyRes) => {
        // Handle Redirects
        if (proxyRes.statusCode >= 300 && proxyRes.statusCode < 400 && proxyRes.headers.location) {
            console.log(`\x1b[33m[Redirect]\x1b[0m -> ${proxyRes.headers.location}`);
            fetchStream(proxyRes.headers.location, res, redirectCount + 1);
            return;
        }

        console.log(`[Proxy Response] Status: ${proxyRes.statusCode} ${proxyRes.statusMessage}`);

        // Forward headers
        const contentType = proxyRes.headers['content-type'];
        if (contentType) res.setHeader('Content-Type', contentType);

        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('Transfer-Encoding', 'chunked');

        // Ensure we explicitly unset Content-Length for live streams
        res.removeHeader('Content-Length');

        res.writeHead(proxyRes.statusCode);

        proxyRes.pipe(res);

        proxyRes.on('error', (err) => {
            console.error('[Proxy] Stream Error from Source:', err.message);
            res.end();
        });

        proxyRes.on('end', () => {
            console.log('[Proxy] Source stream ended.');
            res.end();
        });
    });

    proxyReq.on('error', (err) => {
        console.error(`\x1b[31m[Proxy Error]\x1b[0m Source failed: ${err.message}`);
        if (!res.headersSent) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: `Source station error: ${err.message}` }));
        }
    });

    res.on('close', () => {
        console.log(`[Proxy] Client disconnected.`);
        proxyReq.destroy();
    });
}

const server = http.createServer((req, res) => {
    // Enable CORS for all requests
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    const urlParams = new URL(req.url, `http://localhost:${PORT}`);
    const streamUrl = urlParams.searchParams.get('url');

    if (!streamUrl) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Missing stream URL' }));
        return;
    }

    fetchStream(streamUrl, res);
});

server.listen(PORT, () => {
    console.log(`\x1b[32m%s\x1b[0m`, `Standalone Radio Proxy (v3) running at http://localhost:${PORT}`);
    console.log(`Deduplication & Pure Audio Mode Active.`);
});

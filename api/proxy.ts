import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Readable } from 'stream';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const { url } = req.query;

    if (!url || typeof url !== 'string') {
        return res.status(400).json({ error: 'Missing stream URL' });
    }

    // Early return for CORS preflight
    if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', '*');
        return res.status(200).end();
    }

    try {
        console.log('Proxying URL:', url);
        const response = await fetch(url, {
            headers: {
                // Mimic a browser to bypass Shoutcast/Internet-Radio detection pages
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'audio/mpeg, audio/*;q=0.9, */*;q=0.8',
                'Referer': 'https://www.internet-radio.com/'
            }
        });

        if (!response.ok) {
            console.error(`Proxy fetch failed: ${response.status} ${response.statusText} for ${url}`);
            return res.status(response.status).json({ error: `Failed to fetch stream: ${response.statusText}` });
        }

        // Set CORS headers
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.setHeader('Access-Control-Expose-Headers', '*');
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.setHeader('Connection', 'keep-alive');

        // Copy content type if available with fallback
        let contentType = response.headers.get('content-type');
        if (!contentType || contentType.includes('text/html')) {
            contentType = 'audio/mpeg';
        }
        res.setHeader('content-type', contentType);

        // Proxy the stream
        if (response.body) {
            const reader = response.body.getReader();
            try {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    res.write(value);
                }
            } catch (streamErr) {
                console.error('Error during stream proxying:', streamErr);
            } finally {
                res.end();
            }
        } else {
            res.status(500).json({ error: 'No stream body available' });
        }
    } catch (error) {
        console.error('Proxy error:', error);
        res.status(500).json({ error: 'Failed to proxy stream' });
    }
}

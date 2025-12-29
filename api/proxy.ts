import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Readable } from 'stream';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const { url } = req.query;

    if (!url || typeof url !== 'string') {
        return res.status(400).json({ error: 'Missing stream URL' });
    }

    try {
        console.log('Proxying URL:', url);
        const response = await fetch(url);

        if (!response.ok) {
            return res.status(response.status).json({ error: `Failed to fetch stream: ${response.statusText}` });
        }

        // Set CORS headers
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        // Copy content type if available
        const contentType = response.headers.get('content-type');
        if (contentType) {
            res.setHeader('content-type', contentType);
        }

        // Proxy the stream
        if (response.body) {
            // Convert Web ReadableStream to Node Readable
            Readable.fromWeb(response.body as any).pipe(res);
        } else {
            res.status(500).json({ error: 'No stream body available' });
        }
    } catch (error) {
        console.error('Proxy error:', error);
        res.status(500).json({ error: 'Failed to proxy stream' });
    }
}

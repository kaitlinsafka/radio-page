/**
 * Sanitizes a radio stream URL for compatibility and security.
 * - Handles internet-radio.com proxies by preferring ?mp=/stream suffix.
 * - Routes HTTP streams through the CORS proxy if the app is on HTTPS.
 */
export const sanitizeStreamUrl = (url: string, forceProxy: boolean = false): string => {
    if (!url) return url;

    let sanitized = url.trim();

    // 1. Internet-Radio.com Proxy Requirement:
    // They prefer ?mp=/stream to bypass the HTML landing page and provide a direct audio stream.
    if (sanitized.includes('internet-radio.com/proxy')) {
        if (!sanitized.includes('?mp=/stream') && !sanitized.includes('&mp=/stream')) {
            const separator = sanitized.includes('?') ? '&' : '?';
            sanitized = sanitized + separator + 'mp=/stream';
        }
        // Remove old shoutcast semicolon if it was added previously, as mp=/stream is better
        sanitized = sanitized.replace(/;$/, '');
    }

    // 2. Mixed Content & Force Proxy Check:
    // If the app is running on HTTPS and the stream is HTTP, OR if forced, route through proxy.
    const isHttps = window.location.protocol === 'https:';
    const shouldProxy = forceProxy || (isHttps && sanitized.startsWith('http://'));

    if (shouldProxy && !sanitized.startsWith('/api/proxy')) {
        console.log(`[Sanitizer] Routing stream through proxy: ${sanitized}`);
        const proxyUrl = `/api/proxy?url=${encodeURIComponent(sanitized)}`;
        // Add cache-buster to prevent browser from using stale failed responses
        return `${proxyUrl}${proxyUrl.includes('?') ? '&' : '?'}_t=${Date.now()}`;
    }

    return sanitized;
};

export function isAllowedUrl(input: unknown): boolean {
    if (typeof input !== 'string') return false;
    try {
        const url = new URL(input);
        if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
        const h = url.hostname.toLowerCase();
        return !/^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(h);
    } catch {
        return false;
    }
}

import { isAllowedUrl } from '../utils';

describe('isAllowedUrl', () => {
    it('accepts http URLs', () => {
        expect(isAllowedUrl('http://example.com/data.csv')).toBe(true);
    });

    it('accepts https URLs', () => {
        expect(isAllowedUrl('https://example.com/data.csv')).toBe(true);
    });

    it('rejects ftp protocol', () => {
        expect(isAllowedUrl('ftp://example.com/file')).toBe(false);
    });

    it('rejects file protocol', () => {
        expect(isAllowedUrl('file:///etc/passwd')).toBe(false);
    });

    it('rejects localhost', () => {
        expect(isAllowedUrl('http://localhost/data')).toBe(false);
    });

    it('rejects 127.x loopback', () => {
        expect(isAllowedUrl('http://127.0.0.1/data')).toBe(false);
    });

    it('rejects 10.x private range', () => {
        expect(isAllowedUrl('http://10.0.0.1/data')).toBe(false);
    });

    it('rejects 192.168.x private range', () => {
        expect(isAllowedUrl('http://192.168.1.1/data')).toBe(false);
    });

    it('rejects 172.16-31 private range', () => {
        expect(isAllowedUrl('http://172.16.0.1/data')).toBe(false);
        expect(isAllowedUrl('http://172.31.255.255/data')).toBe(false);
    });

    it('accepts 172.15.x (not in private range)', () => {
        expect(isAllowedUrl('http://172.15.0.1/data')).toBe(true);
    });

    it('rejects invalid URL', () => {
        expect(isAllowedUrl('not a url')).toBe(false);
    });

    it('rejects empty string', () => {
        expect(isAllowedUrl('')).toBe(false);
    });

    it('rejects non-string input', () => {
        expect(isAllowedUrl(undefined)).toBe(false);
        expect(isAllowedUrl(null)).toBe(false);
        expect(isAllowedUrl(42)).toBe(false);
    });
});

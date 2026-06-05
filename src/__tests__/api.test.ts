import request from 'supertest';

jest.mock('../queue', () => ({
    pipelineQueue: {
        add: jest.fn().mockResolvedValue({ id: '42' }),
        getJob: jest.fn(),
    },
    connection: {},
}));

jest.mock('../db', () => ({
    query: jest.fn(),
    initDb: jest.fn().mockResolvedValue(undefined),
    default: {},
}));

import app from '../app';
import { pipelineQueue } from '../queue';
import { query } from '../db';

const mockGetJob = pipelineQueue.getJob as jest.Mock;
const mockQuery = query as jest.Mock;

describe('GET /health', () => {
    it('returns 200 with ok status', async () => {
        const res = await request(app).get('/health');
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ status: 'ok' });
    });
});

describe('POST /jobs', () => {
    it('returns 400 for missing URL', async () => {
        const res = await request(app).post('/jobs').send({});
        expect(res.status).toBe(400);
    });

    it('returns 400 for ftp URL', async () => {
        const res = await request(app).post('/jobs').send({ url: 'ftp://example.com/data.csv' });
        expect(res.status).toBe(400);
    });

    it('returns 400 for localhost URL', async () => {
        const res = await request(app).post('/jobs').send({ url: 'http://localhost/data.csv' });
        expect(res.status).toBe(400);
    });

    it('returns 400 for private IP URL', async () => {
        const res = await request(app).post('/jobs').send({ url: 'http://192.168.1.1/data.csv' });
        expect(res.status).toBe(400);
    });

    it('returns jobId for valid URL', async () => {
        const res = await request(app).post('/jobs').send({ url: 'https://example.com/data.csv' });
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('jobId', '42');
    });
});

describe('GET /jobs/:id', () => {
    it('returns 404 for unknown job', async () => {
        mockGetJob.mockResolvedValue(null);
        const res = await request(app).get('/jobs/999');
        expect(res.status).toBe(404);
        expect(res.body).toHaveProperty('error');
    });

    it('returns job data for known job', async () => {
        mockGetJob.mockResolvedValue({
            id: '1',
            data: { url: 'https://example.com/data.csv' },
            getState: async () => 'completed',
            progress: { step: 'store', status: 'Done' },
        });
        const res = await request(app).get('/jobs/1');
        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({ id: '1', status: 'completed' });
    });
});

describe('GET /jobs/:id/results', () => {
    it('returns 404 when no results exist', async () => {
        mockQuery.mockResolvedValue({ rows: [] });
        const res = await request(app).get('/jobs/1/results');
        expect(res.status).toBe(404);
    });

    it('returns results when available', async () => {
        mockQuery.mockResolvedValue({ rows: [{ data: { name: 'Alice' } }, { data: { name: 'Bob' } }] });
        const res = await request(app).get('/jobs/1/results');
        expect(res.status).toBe(200);
        expect(res.body.results).toHaveLength(2);
        expect(res.body.results[0]).toEqual({ name: 'Alice' });
    });
});

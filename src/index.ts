import 'dotenv/config';
import express from 'express';
import { pipelineQueue } from './queue'
import "./worker";
import {initDb, query} from "./db";

initDb().catch(err => { console.error('DB init failed:', err); process.exit(1); });

function isAllowedUrl(input: string): boolean {
    try {
        const url = new URL(input);
        if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
        const h = url.hostname.toLowerCase();
        return !/^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(h);
    } catch {
        return false;
    }
}

const app = express();

app.use(express.json());

app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
});

app.post('/jobs', async (req, res) => {
    if (!isAllowedUrl(req.body?.url)) return res.status(400).json({ error: 'A valid http/https URL is required' });
    const job = await pipelineQueue.add('run', {url: req.body.url})
    res.json({jobId: job.id })
})
app.get('/jobs/:id', async (req, res) => {
    const job = await pipelineQueue.getJob(req.params.id);
    if (!job) return res.status(404).json({ error: 'Job not found' });
    res.json({ id: job.id, data: job.data, status: await job.getState(), progress: job.progress });
});

app.get('/jobs/:id/results', async (req, res) => {
    const result = await query('SELECT data FROM pipeline_results WHERE job_id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'No results found' });
    res.json({ results: result.rows.map(r => r.data) });
});

app.listen(3000);

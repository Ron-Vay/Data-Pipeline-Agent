import express from 'express';
import { pipelineQueue } from './queue';
import { query } from './db';
import { isAllowedUrl } from './utils';

const app = express();
app.use(express.json());

app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
});

app.post('/jobs', async (req, res) => {
    if (!isAllowedUrl(req.body?.url)) return res.status(400).json({ error: 'A valid http/https URL is required' });
    const job = await pipelineQueue.add('run', { url: req.body.url });
    res.json({ jobId: job.id });
});

app.get('/jobs/:id', async (req, res) => {
    const job = await pipelineQueue.getJob(req.params.id);
    if (!job) return res.status(404).json({ error: 'Job not found' });
    res.json({ id: job.id, data: job.data, status: await job.getState(), progress: job.progress });
});

app.get('/jobs/:id/results', async (req, res) => {
    const result = await query('SELECT data FROM pipeline_results WHERE job_id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'No results found' });
    res.json({ results: result.rows.map((r: { data: unknown }) => r.data) });
});

export default app;

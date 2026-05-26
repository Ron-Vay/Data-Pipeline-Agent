import express from 'express';
import { pipelineQueue } from './queue'
import "./worker";
import {initDb} from "./db";

initDb().catch(err => { console.error('DB init failed:', err); process.exit(1); });
const app = express();

app.use(express.json());

app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

app.post('/jobs', async (req, res) => {
    const job = await pipelineQueue.add('run', {url: req.body.url})
    if (!req.body?.url) return res.status(400).json({ error: 'url is required' });
    res.json({jobId: job.id })
})
app.get('/jobs/:id', async (req, res) => {
    const job = await pipelineQueue.getJob(req.params.id);
    if (!job) return res.status(404).json({});
    res.json({ id: job.id, data: job.data, status: await job.getState(), progress: job.progress });
});

app.listen(3000);

export default app;

import express from 'express';
import { pipelineQueue } from './queue'

const app = express();

app.use(express.json());

app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

app.post('/jobs', async (req, res) => {
    const job = await pipelineQueue.add('run', {url: req.body.url})
    res.json({jobId: job.id })
})
app.get('/jobs/:id', async(req, res) => {
    pipelineQueue.getJob(req.params.id)
        .then(async job => {
            if (!job) {
                res.status(404).json({})
            }
            else
            res.json({ id: job.id, data: job.data, status: await job.getState() })
        })
})

app.listen(3000);

export default app;

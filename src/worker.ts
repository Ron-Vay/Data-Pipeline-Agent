import { connection } from "./queue";
import { Worker, Job } from 'bullmq'
import { fetchSource, inspectSchema, store } from "./tools";
import { parse } from 'csv-parse/sync';
import { runAgent } from "./agent";

const JOB_TIMEOUT_MS = 2 * 60 * 1000; // 2 minutes

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return Promise.race([
        promise,
        new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error(`Job timed out after ${ms / 1000}s`)), ms)
        ),
    ]);
}

async function runPipeline(job: Job) {
    await job.updateProgress({ step: 'fetch_source', status: 'running..' });
    let text: string
    try {
        text = await fetchSource(job.data.url);
    } catch (e) {
        await job.updateProgress({ step: 'fetch_source', status: 'failed' });
        throw e;
    }
    await job.updateProgress({ step: 'inspect_schema', status: 'running..' });

    let schema: ReturnType<typeof inspectSchema>;
    let rawRows: Record<string, string>[];
    try {
        rawRows = parse(text, { columns: true, skip_empty_lines: true });
        schema = inspectSchema(rawRows);
    } catch (e) {
        await job.updateProgress({ step: 'inspect_schema', status: 'failed' });
        throw e;
    }

    await job.updateProgress({ step: 'transform', status: 'planning..' });
    let rows: Record<string, string>[]
    try {
        rows = await runAgent(schema, rawRows, async (status) => {
            await job.updateProgress({ step: 'transform', status });
        });
    } catch (e) {
        await job.updateProgress({ step: 'transform', status: 'failed' });
        throw e;
    }

    await job.updateProgress({ step: 'store', status: 'running..' });
    try {
        await store(rows, job.id!);
    } catch (e) {
        await job.updateProgress({ step: 'store', status: 'failed' });
        throw e;
    }
    await job.updateProgress({ step: 'store', status: 'Done' });
}

new Worker('pipeline', (job) => withTimeout(runPipeline(job), JOB_TIMEOUT_MS), { connection })
    .on('error', (err) => console.error('Worker error:', err));

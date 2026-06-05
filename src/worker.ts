import { connection } from "./queue";
import { Worker } from 'bullmq'
import { fetchSource, inspectSchema, store } from "./tools";
import { parse } from 'csv-parse/sync';
import { runAgent } from "./agent";

new Worker('pipeline', async (job) => {

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
    try {
        schema = inspectSchema(text);
    } catch (e) {
        await job.updateProgress({ step: 'inspect_schema', status: 'failed' });
        throw e;
    }

    await job.updateProgress({ step: 'transform', status: 'planning..' });
    let rows: Record<string, string>[]
    try{
        const rawRows: Record<string, string>[] = parse(text, { columns: true, skip_empty_lines: true });
        rows = await runAgent(schema, rawRows, async (status) => {
            await job.updateProgress({ step: 'transform', status });
        });
    } catch (e) {
        await job.updateProgress({ step: 'transform', status: 'failed' });
        throw e;
    }

    await job.updateProgress({ step: 'store', status: 'running..' });
    try{
        await store(rows, job.id!);
    }catch (e) {
        await job.updateProgress({ step: 'store', status: 'failed' });
        throw e;
    }
    await job.updateProgress({ step: 'store', status: 'Done' });
}, { connection })
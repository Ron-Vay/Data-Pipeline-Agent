import { connection } from "./queue";
import { Worker } from 'bullmq'
import { fetchSource, inspectSchema, transform } from "./tools";
import { ColumnSchema } from "./types";
import { parse } from 'csv-parse/sync';

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

    let columns: ColumnSchema[];
    let rowCount: number;
    try {
        ({ columns, rowCount } = inspectSchema(text)); // metadata, for ollama later
    } catch (e) {
        await job.updateProgress({ step: 'inspect_schema', status: 'failed' });
        throw e;
    }

    await job.updateProgress({ step: 'transform', status: 'running..' });
    let rows: Record<string, string>[]
    try{
        rows = parse(text, { columns: true, skip_empty_lines: true }); //hardcoded for now, ollama will replace later

        await job.updateProgress({ step: 'transform', status: 'deduping..' });
        const deduped = transform({ rows, operation: 'dedupe' });

        await job.updateProgress({ step: 'transform', status: 'dropping nulls..' });
        const clean = transform({ rows: deduped, operation: 'drop_nulls' });

    } catch (e) {
        await job.updateProgress({ step: 'transform', status: 'failed' });
        throw e;
    }

}, { connection })
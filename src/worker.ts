import { connection } from "./queue";
import { Worker } from 'bullmq'

new Worker('pipeline', async (job) => {
    console.log(`Working... #${job.id}` , job.data);
}, { connection })
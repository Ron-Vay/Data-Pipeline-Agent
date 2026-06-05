import 'dotenv/config';
import app from './app';
import './worker';
import { initDb } from './db';

initDb().catch(err => { console.error('DB init failed:', err); process.exit(1); });
app.listen(3000);

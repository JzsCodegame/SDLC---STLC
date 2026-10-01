import path from 'node:path';
import { createApp } from './app.js';
const port = Number(process.env.PORT || 4173); const host = process.env.HOST || '127.0.0.1';
const app = createApp({ dataDir: process.env.DATA_DIR || path.resolve('data'), distDir: path.resolve('dist') });
app.listen(port, host, () => { console.log(`Academy Help Desk listening at http://${host}:${port}`); process.send?.({ ready: true }); });

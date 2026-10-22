import app from './app.js';
import { initDb } from './db/index.js';
import { runClusterAggregation } from './services/aggregationService.js';
import { validateEnvironment } from './config/env.js';

const PORT = parseInt(process.env.PORT || '5000', 10);
const HOST = '0.0.0.0';

async function startServer() {
  try {
    validateEnvironment();
    console.log('[SafeSignal] Starting backend service...');
    await initDb();
    
    // Initial sync of cluster alerts
    try {
      const agg = await runClusterAggregation();
      console.log(`[SafeSignal] Aggregation active: ${agg.activeClusters.length} alert clusters detected.`);
    } catch (e) {
      console.warn('[SafeSignal] Note: Initial cluster sync skipped or waiting for seed.');
    }

    app.listen(PORT, HOST, () => {
      console.log(`=================================================`);
      console.log(` SafeSignal REST API listening on ${HOST}:${PORT}`);
      console.log(` Healthcheck: http://${HOST}:${PORT}/api/health`);
      console.log(` Client URL:  ${process.env.CLIENT_ORIGIN || 'http://localhost:5173'}`);
      console.log(`=================================================`);
    });
  } catch (err) {
    console.error('[SafeSignal] Fatal boot error:', err);
    process.exit(1);
  }
}

startServer();

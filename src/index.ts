if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import routes from './routes';
import prisma from './config/database';
import { activityTracker } from './middleware/activityTracker';
import { ensureBucket, getObjectStream, statObject } from './config/storage';

const app = express();
const PORT = process.env.PORT || 5000;

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:3000', credentials: true }));
app.use(morgan('dev'));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(activityTracker);
// Serve uploaded files by streaming them from object storage (MinIO).
// Keeps the historical /uploads/<key> URL scheme; the bucket stays private.
app.use('/uploads', async (req, res) => {
  try {
    const key = decodeURIComponent(req.path.replace(/^\/+/, ''));
    if (!key) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    const stat = await statObject(key).catch(() => null);
    if (!stat) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    res.setHeader(
      'Content-Type',
      (stat.metaData?.['content-type'] as string) || 'application/octet-stream',
    );
    res.setHeader('Content-Length', stat.size);
    res.setHeader('Cache-Control', 'private, max-age=300');
    const stream = await getObjectStream(key);
    stream.on('error', () => {
      if (!res.headersSent) res.status(500).end();
    });
    stream.pipe(res);
  } catch {
    if (!res.headersSent) res.status(500).json({ error: 'Failed to fetch file' });
  }
});

app.get('/', (_req, res) =>
  res.json({
    status: 'ok',
    message: 'DVLA IDP/ICMV Issuance System API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  }),
);

app.get('/health', (_req, res) => res.json({ status: 'healthy', uptime: process.uptime() }));

app.use('/api', routes);

// Error handler
app.use((err: Error, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use((_req: express.Request, res: express.Response) => {
  res.status(404).json({ error: 'Not found' });
});

process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});
process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

ensureBucket().catch((err) => console.error('Object storage init error:', err));

app.listen(PORT, () => {
  console.log(`🚀 DVLA IDP Backend running on port ${PORT}`);
  console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
});

export default app;

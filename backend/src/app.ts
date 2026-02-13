import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import { errorHandler } from './middleware/errorHandler';
import mangaRoutes from './routes/manga';
import { generalLimiter } from './middleware/rateLimiter';
import { CONFIG } from './config/constants';

const app = express();

// ============================================
// Middleware
// ============================================
app.use(helmet());
app.use(cors({
  origin: CONFIG.ALLOWED_ORIGINS,
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.use('/api/', generalLimiter);

// Static files (generated images)
app.use('/uploads', express.static(path.resolve('./uploads')));
app.use('/output', express.static(path.resolve('./output')));

// ============================================
// Routes
// ============================================
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/manga', mangaRoutes);

// ============================================
// Production SPA serving
// ============================================
if (CONFIG.NODE_ENV === 'production') {
  app.use(express.static(path.resolve(__dirname, '../../frontend/dist')));
  app.get('*', (_req, res) => {
    res.sendFile(path.resolve(__dirname, '../../frontend/dist/index.html'));
  });
}

// ============================================
// Error handling
// ============================================
app.use(errorHandler);

export default app;

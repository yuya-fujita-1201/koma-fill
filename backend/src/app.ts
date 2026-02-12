import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { errorHandler } from './middleware/errorHandler';
import mangaRoutes from './routes/manga';

const app = express();

// ============================================
// Middleware
// ============================================
app.use(helmet());
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? process.env.ALLOWED_ORIGINS?.split(',')
    : ['http://localhost:3000'],
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1分
  max: 100,
  message: { error: 'Too many requests, please try again later.' },
});
app.use('/api/', limiter);

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
// Error handling
// ============================================
app.use(errorHandler);

export default app;

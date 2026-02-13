import rateLimit from 'express-rate-limit';
import { CONFIG } from '../config/constants';

/**
 * 画像生成系エンドポイント用
 */
export const imageGenerationLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: CONFIG.DALLE_RATE_LIMIT_PER_MINUTE,
  message: {
    error: 'Image generation rate limit exceeded. Please wait before generating more images.',
    retryAfterMs: 60000,
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * 画像分析系エンドポイント用
 */
export const imageAnalysisLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: CONFIG.VISION_RATE_LIMIT_PER_MINUTE,
  message: {
    error: 'Analysis rate limit exceeded. Please wait before analyzing more images.',
    retryAfterMs: 60000,
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * 一般APIエンドポイント用
 */
export const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: {
    error: 'Too many requests, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

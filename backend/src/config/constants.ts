import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

const envCandidates = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), '..', '.env'),
];

for (const envPath of envCandidates) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
    break;
  }
}

export const CONFIG = {
  // Server
  PORT: parseInt(process.env.PORT || '3001', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',
  BASE_URL: process.env.BASE_URL || 'http://localhost:3001',
  ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',')
    : ['http://localhost:3000'],

  // OpenAI
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
  OPENAI_ORG_ID: process.env.OPENAI_ORG_ID,
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
  GEMINI_API_BASE_URL: process.env.GEMINI_API_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta',

  // Authentication
  API_KEYS: process.env.API_KEYS
    ? process.env.API_KEYS.split(',').map((k) => k.trim()).filter(Boolean)
    : ([] as string[]),

  // Rate Limits
  DALLE_RATE_LIMIT_PER_MINUTE: parseInt(process.env.DALLE_RATE_LIMIT_PER_MINUTE || '5', 10),
  VISION_RATE_LIMIT_PER_MINUTE: parseInt(process.env.VISION_RATE_LIMIT_PER_MINUTE || '30', 10),
  MAX_RETRIES_PER_PANEL: parseInt(process.env.MAX_RETRIES_PER_PANEL || '3', 10),
  MAX_PANELS_PER_PROJECT: parseInt(process.env.MAX_PANELS_PER_PROJECT || '12', 10),

  // Storage
  DATABASE_PATH: process.env.DATABASE_PATH || './data/koma-fill.db',
  STORAGE_PATH: process.env.STORAGE_PATH || './uploads',
  EXPORT_PATH: process.env.EXPORT_PATH || './exports',
  MAX_IMAGE_SIZE_MB: parseInt(process.env.MAX_IMAGE_SIZE_MB || '20', 10),

  // DALL-E 3 Model Settings (環境変数でオーバーライド可能)
  DALLE_MODEL: process.env.DALLE_MODEL || 'dall-e-3',
  VISION_MODEL: process.env.VISION_MODEL || 'gpt-4o',
  PROMPT_MODEL: process.env.PROMPT_MODEL || 'gpt-4o',

  // Image Defaults
  PANEL_SIZE: {
    SQUARE: { width: 1024, height: 1024 },
    WIDE: { width: 1792, height: 1024 },
    TALL: { width: 1024, height: 1792 },
  },
} as const;

// Validate required startup config
export function validateConfig(): void {
  if (!Number.isFinite(CONFIG.PORT) || CONFIG.PORT <= 0) {
    throw new Error('PORT must be a positive integer.');
  }
}

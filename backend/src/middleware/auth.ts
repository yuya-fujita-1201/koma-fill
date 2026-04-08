import { Request, Response, NextFunction } from 'express';
import { CONFIG } from '../config/constants';
import { AppError } from './errorHandler';

/**
 * APIキー認証ミドルウェア
 *
 * - Authorization: Bearer <API_KEY> ヘッダーを検証
 * - API_KEYS 未設定ならローカルデスクトップ利用を想定してスキップ
 * - API_KEYS を設定した場合のみ Bearer 認証を強制
 */
export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  if (CONFIG.API_KEYS.length === 0) {
    next();
    return;
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    next(new AppError('Authentication required. Provide Authorization: Bearer <API_KEY>', 401));
    return;
  }

  const token = authHeader.slice(7);
  if (!CONFIG.API_KEYS.includes(token)) {
    next(new AppError('Invalid API key', 403));
    return;
  }

  next();
}

/**
 * 特定ルートのみ認証をスキップ
 */
export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    next();
    return;
  }

  authenticate(req, _res, next);
}

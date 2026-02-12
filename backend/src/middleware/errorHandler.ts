import { Request, Response, NextFunction } from 'express';

/**
 * カスタムエラークラス
 */
export class AppError extends Error {
  statusCode: number;
  isOperational: boolean;

  constructor(message: string, statusCode: number = 500) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(`${resource} not found`, 404);
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 400);
  }
}

export class OpenAIError extends AppError {
  constructor(message: string) {
    super(`OpenAI API Error: ${message}`, 502);
  }
}

/**
 * グローバルエラーハンドラーミドルウェア
 */
export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: err.message,
      statusCode: err.statusCode,
    });
    return;
  }

  // 予期しないエラー
  console.error('Unexpected error:', err);
  res.status(500).json({
    error: 'Internal server error',
    statusCode: 500,
  });
}

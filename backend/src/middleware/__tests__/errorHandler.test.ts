import { Response } from 'express';
import {
  AppError,
  NotFoundError,
  OpenAIError,
  ValidationError,
  errorHandler,
} from '../errorHandler';

describe('errorHandler', () => {
  function createResponse() {
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    return res as unknown as Response & { status: jest.Mock; json: jest.Mock };
  }

  it('AppError が status と message を返す', () => {
    const err = new AppError('app error', 403);
    const res = createResponse();
    errorHandler(err, {} as never, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'app error', statusCode: 403 });
  });

  it('NotFoundError が 404 を返す', () => {
    const res = createResponse();
    errorHandler(new NotFoundError('Project'), {} as never, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('ValidationError が 400 を返す', () => {
    const res = createResponse();
    errorHandler(new ValidationError('bad input'), {} as never, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('OpenAIError が 502 を返す', () => {
    const res = createResponse();
    errorHandler(new OpenAIError('quota exceeded'), {} as never, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(502);
  });

  it('Unknown error が 500 を返す', () => {
    const res = createResponse();
    errorHandler(new Error('boom'), {} as never, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

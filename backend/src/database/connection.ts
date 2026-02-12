import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { CONFIG } from '../config/constants';
import { createSchema } from './schema';

let dbInstance: Database.Database | null = null;

function ensureDirectoryExists(filePath: string): void {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
}

export function getDatabase(): Database.Database {
  if (!dbInstance) {
    throw new Error('Database is not initialized. Call initDatabase() first.');
  }
  return dbInstance;
}

export async function initDatabase(): Promise<Database.Database> {
  if (dbInstance) {
    return dbInstance;
  }

  const dbPath = path.resolve(CONFIG.DATABASE_PATH);
  ensureDirectoryExists(dbPath);
  fs.mkdirSync(path.resolve(CONFIG.STORAGE_PATH), { recursive: true });

  const db = new Database(dbPath);
  db.pragma('foreign_keys = ON');
  createSchema(db);

  dbInstance = db;
  return db;
}

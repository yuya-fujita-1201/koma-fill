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

export async function initDatabase(dbPath?: string): Promise<Database.Database> {
  if (dbPath) {
    if (dbInstance) {
      dbInstance.close();
      dbInstance = null;
    }

    const resolvedPath = dbPath === ':memory:' ? ':memory:' : path.resolve(dbPath);
    if (resolvedPath !== ':memory:') {
      ensureDirectoryExists(resolvedPath);
    }

    const db = new Database(resolvedPath);
    db.pragma('foreign_keys = ON');
    createSchema(db);
    fs.mkdirSync(path.resolve(CONFIG.STORAGE_PATH), { recursive: true });
    dbInstance = db;
    return db;
  }

  if (dbInstance) {
    return dbInstance;
  }

  const dbPathResolved = path.resolve(CONFIG.DATABASE_PATH);
  ensureDirectoryExists(dbPathResolved);
  fs.mkdirSync(path.resolve(CONFIG.STORAGE_PATH), { recursive: true });

  const db = new Database(dbPathResolved);
  db.pragma('foreign_keys = ON');
  createSchema(db);
  dbInstance = db;

  return db;
}

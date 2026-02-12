import Database from 'better-sqlite3';

export function createSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL,
      layoutConfig JSON NOT NULL,
      generationSettings JSON NOT NULL,
      totalCost REAL DEFAULT 0,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS panels (
      id TEXT PRIMARY KEY,
      projectId TEXT NOT NULL,
      panelIndex INTEGER NOT NULL,
      imageUrl TEXT,
      imageFilePath TEXT,
      prompt TEXT,
      storyBeat TEXT,
      speechBubbleText TEXT,
      status TEXT NOT NULL,
      retryCount INTEGER DEFAULT 0,
      generatedAt TEXT,
      createdAt TEXT NOT NULL,
      FOREIGN KEY (projectId) REFERENCES projects(id)
    );

    CREATE TABLE IF NOT EXISTS keyImages (
      id TEXT PRIMARY KEY,
      projectId TEXT NOT NULL,
      imageFilePath TEXT NOT NULL,
      position TEXT NOT NULL,
      analysis JSON,
      createdAt TEXT NOT NULL,
      FOREIGN KEY (projectId) REFERENCES projects(id)
    );

    CREATE INDEX IF NOT EXISTS idx_project_status ON projects(status);
    CREATE INDEX IF NOT EXISTS idx_panel_project ON panels(projectId);
    CREATE INDEX IF NOT EXISTS idx_panel_status ON panels(status);
  `);
}

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const dbDir = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, 'project.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const initSql = `
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  duration INTEGER NOT NULL CHECK (duration > 0),
  assignee TEXT NOT NULL,
  manual_start INTEGER,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS task_dependencies (
  task_id TEXT NOT NULL,
  depends_on_id TEXT NOT NULL,
  PRIMARY KEY (task_id, depends_on_id),
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  FOREIGN KEY (depends_on_id) REFERENCES tasks(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS project_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;

db.exec(initSql);

const configCount = db.prepare('SELECT COUNT(*) as cnt FROM project_config').get() as { cnt: number };
if (configCount.cnt === 0) {
  const today = new Date().toISOString().split('T')[0];
  db.prepare('INSERT INTO project_config (key, value) VALUES (?, ?)').run('start_date', today);
}

const taskCount = db.prepare('SELECT COUNT(*) as cnt FROM tasks').get() as { cnt: number };
if (taskCount.cnt === 0) {
  const insertTask = db.prepare(
    'INSERT INTO tasks (id, name, duration, assignee) VALUES (?, ?, ?, ?)'
  );
  const insertDep = db.prepare(
    'INSERT INTO task_dependencies (task_id, depends_on_id) VALUES (?, ?)'
  );

  const tx = db.transaction(() => {
    insertTask.run('A', '需求分析', 3, '张三');
    insertTask.run('B', '系统设计', 2, '李四');
    insertTask.run('C', '开发实现', 5, '王五');
    insertTask.run('D', 'UI设计', 2, '赵六');
    insertTask.run('E', '测试验收', 3, '张三');

    insertDep.run('B', 'A');
    insertDep.run('D', 'A');
    insertDep.run('C', 'B');
    insertDep.run('C', 'D');
    insertDep.run('E', 'C');
  });

  tx();
}

export default db;

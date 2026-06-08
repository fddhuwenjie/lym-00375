import db from '../db/init';
import type { TaskInput } from '../../shared/types';

interface TaskRow {
  id: string;
  name: string;
  duration: number;
  assignee: string;
  manual_start: number | null;
  created_at: string;
  updated_at: string;
}

interface RawTask {
  id: string;
  name: string;
  duration: number;
  assignee: string;
  dependsOn: string[];
  manualStart?: number;
}

export function getAllTasks(): RawTask[] {
  const tasks = db.prepare('SELECT * FROM tasks ORDER BY id').all() as TaskRow[];
  
  const depStmt = db.prepare(
    'SELECT depends_on_id FROM task_dependencies WHERE task_id = ?'
  );

  return tasks.map(t => {
    const deps = depStmt.all(t.id) as { depends_on_id: string }[];
    return {
      id: t.id,
      name: t.name,
      duration: t.duration,
      assignee: t.assignee,
      dependsOn: deps.map(d => d.depends_on_id),
      manualStart: t.manual_start ?? undefined,
    };
  });
}

export function getTaskById(id: string): RawTask | null {
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as TaskRow | undefined;
  if (!task) return null;

  const deps = db.prepare(
    'SELECT depends_on_id FROM task_dependencies WHERE task_id = ?'
  ).all(id) as { depends_on_id: string }[];

  return {
    id: task.id,
    name: task.name,
    duration: task.duration,
    assignee: task.assignee,
    dependsOn: deps.map(d => d.depends_on_id),
    manualStart: task.manual_start ?? undefined,
  };
}

export function createTask(input: TaskInput): RawTask {
  const id = input.id || generateId();
  
  const tx = db.transaction(() => {
    db.prepare(
      'INSERT INTO tasks (id, name, duration, assignee, manual_start) VALUES (?, ?, ?, ?, ?)'
    ).run(id, input.name, input.duration, input.assignee, input.manualStart ?? null);

    const insertDep = db.prepare(
      'INSERT INTO task_dependencies (task_id, depends_on_id) VALUES (?, ?)'
    );
    for (const dep of input.dependsOn) {
      if (dep !== id) {
        insertDep.run(id, dep);
      }
    }
  });

  tx();
  return getTaskById(id)!;
}

export function updateTask(id: string, input: TaskInput): RawTask {
  const tx = db.transaction(() => {
    db.prepare(
      'UPDATE tasks SET name = ?, duration = ?, assignee = ?, manual_start = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    ).run(input.name, input.duration, input.assignee, input.manualStart ?? null, id);

    db.prepare('DELETE FROM task_dependencies WHERE task_id = ?').run(id);
    
    const insertDep = db.prepare(
      'INSERT INTO task_dependencies (task_id, depends_on_id) VALUES (?, ?)'
    );
    for (const dep of input.dependsOn) {
      if (dep !== id) {
        insertDep.run(id, dep);
      }
    }
  });

  tx();
  return getTaskById(id)!;
}

export function deleteTask(id: string): boolean {
  const result = db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
  return result.changes > 0;
}

export function getProjectConfig(): { startDate: string } {
  const row = db.prepare(
    "SELECT value FROM project_config WHERE key = 'start_date'"
  ).get() as { value: string } | undefined;
  
  return { startDate: row?.value || new Date().toISOString().split('T')[0] };
}

export function updateProjectConfig(config: { startDate: string }): void {
  db.prepare(
    "INSERT OR REPLACE INTO project_config (key, value) VALUES ('start_date', ?)"
  ).run(config.startDate);
}

function generateId(): string {
  const existing = db.prepare('SELECT id FROM tasks').all() as { id: string }[];
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  for (const letter of letters) {
    if (!existing.some(e => e.id === letter)) {
      return letter;
    }
  }
  return `T${Date.now().toString(36).toUpperCase()}`;
}

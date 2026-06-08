import db from '../db/init';
import type { TaskInput } from '../../shared/types';

interface TaskRow {
  id: string;
  project_id: string | null;
  name: string;
  duration: number;
  assignee: string;
  manual_start: number | null;
  progress: number;
  actual_start_date: string | null;
  actual_end_date: string | null;
  calendar_id: string | null;
  time_off: string | null;
  created_at: string;
  updated_at: string;
}

interface RawTask {
  id: string;
  projectId?: string;
  name: string;
  duration: number;
  assignee: string;
  dependsOn: string[];
  manualStart?: number;
  progress?: number;
  actualStartDate?: string;
  actualEndDate?: string;
  calendarId?: string;
  timeOff?: string[];
}

export function getAllTasks(projectId?: string): RawTask[] {
  let sql = 'SELECT * FROM tasks';
  let params: any[] = [];
  
  if (projectId) {
    sql += " WHERE project_id = ? OR (project_id IS NULL AND ? = 'default')";
    params = [projectId, projectId];
  }
  
  sql += ' ORDER BY id';
  
  const tasks = db.prepare(sql).all(...params) as TaskRow[];
  
  const depStmt = db.prepare(
    'SELECT depends_on_id FROM task_dependencies WHERE task_id = ?'
  );

  return tasks.map(t => {
    const deps = depStmt.all(t.id) as { depends_on_id: string }[];
    return {
      id: t.id,
      projectId: t.project_id ?? undefined,
      name: t.name,
      duration: t.duration,
      assignee: t.assignee,
      dependsOn: deps.map(d => d.depends_on_id),
      manualStart: t.manual_start ?? undefined,
      progress: t.progress ?? 0,
      actualStartDate: t.actual_start_date ?? undefined,
      actualEndDate: t.actual_end_date ?? undefined,
      calendarId: t.calendar_id ?? undefined,
      timeOff: t.time_off ? JSON.parse(t.time_off) : undefined,
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
    projectId: task.project_id ?? undefined,
    name: task.name,
    duration: task.duration,
    assignee: task.assignee,
    dependsOn: deps.map(d => d.depends_on_id),
    manualStart: task.manual_start ?? undefined,
    progress: task.progress ?? 0,
    actualStartDate: task.actual_start_date ?? undefined,
    actualEndDate: task.actual_end_date ?? undefined,
    calendarId: task.calendar_id ?? undefined,
    timeOff: task.time_off ? JSON.parse(task.time_off) : undefined,
  };
}

export function createTask(input: TaskInput): RawTask {
  const id = input.id || generateId();
  
  const tx = db.transaction(() => {
    db.prepare(
      `INSERT INTO tasks 
       (id, project_id, name, duration, assignee, manual_start, progress, actual_start_date, actual_end_date, calendar_id, time_off) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      input.projectId || null,
      input.name,
      input.duration,
      input.assignee,
      input.manualStart ?? null,
      input.progress ?? 0,
      input.actualStartDate ?? null,
      input.actualEndDate ?? null,
      input.calendarId ?? null,
      input.timeOff ? JSON.stringify(input.timeOff) : null
    );

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
      `UPDATE tasks 
       SET name = ?, duration = ?, assignee = ?, manual_start = ?, progress = ?, 
           actual_start_date = ?, actual_end_date = ?, calendar_id = ?, time_off = ?, 
           project_id = ?, updated_at = CURRENT_TIMESTAMP 
       WHERE id = ?`
    ).run(
      input.name,
      input.duration,
      input.assignee,
      input.manualStart ?? null,
      input.progress ?? 0,
      input.actualStartDate ?? null,
      input.actualEndDate ?? null,
      input.calendarId ?? null,
      input.timeOff ? JSON.stringify(input.timeOff) : null,
      input.projectId || null,
      id
    );

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

export function updateTaskProgress(id: string, progress: number): RawTask {
  db.prepare(
    'UPDATE tasks SET progress = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
  ).run(Math.max(0, Math.min(100, progress)), id);
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

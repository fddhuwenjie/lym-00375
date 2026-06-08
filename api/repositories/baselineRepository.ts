import db from '../db/init';
import type { Baseline, BaselineTask, ScheduleResult } from '../../shared/types';

interface BaselineRow {
  id: string;
  project_id: string | null;
  name: string;
  created_at: string;
  total_duration: number;
  project_end_date: string;
  critical_paths: string;
}

interface BaselineTaskRow {
  id: number;
  baseline_id: string;
  task_id: string;
  name: string;
  start_date: string;
  end_date: string;
  duration: number;
  is_critical: number;
}

export function getBaselinesByProjectId(projectId: string): Baseline[] {
  const rows = db.prepare(
    "SELECT * FROM baselines WHERE project_id = ? OR (project_id IS NULL AND ? = 'default') ORDER BY created_at DESC"
  ).all(projectId, projectId) as BaselineRow[];
  
  return rows.map(row => getBaselineWithTasks(row.id, row));
}

function getBaselineWithTasks(baselineId: string, row?: BaselineRow): Baseline {
  const baselineRow = row || db.prepare('SELECT * FROM baselines WHERE id = ?').get(baselineId) as BaselineRow;
  if (!baselineRow) throw new Error('Baseline not found');

  const taskRows = db.prepare(
    'SELECT * FROM baseline_tasks WHERE baseline_id = ? ORDER BY task_id'
  ).all(baselineId) as BaselineTaskRow[];

  const tasks: BaselineTask[] = taskRows.map(tr => ({
    taskId: tr.task_id,
    name: tr.name,
    startDate: tr.start_date,
    endDate: tr.end_date,
    duration: tr.duration,
    isCritical: tr.is_critical === 1,
  }));

  return {
    id: baselineRow.id,
    projectId: baselineRow.project_id || 'default',
    name: baselineRow.name,
    createdAt: baselineRow.created_at,
    totalDuration: baselineRow.total_duration,
    projectEndDate: baselineRow.project_end_date,
    criticalPaths: JSON.parse(baselineRow.critical_paths || '[]'),
    tasks,
  };
}

export function getBaselineById(id: string): Baseline | null {
  try {
    return getBaselineWithTasks(id);
  } catch {
    return null;
  }
}

export function createBaseline(
  projectId: string,
  name: string,
  scheduleResult: ScheduleResult
): Baseline {
  const existingBaselines = getBaselinesByProjectId(projectId);
  if (existingBaselines.length >= 5) {
    const oldest = existingBaselines[existingBaselines.length - 1];
    deleteBaseline(oldest.id);
  }

  const id = `B${Date.now().toString(36).toUpperCase()}`;
  const timestamp = new Date().toLocaleString('zh-CN');
  const finalName = `${name} - ${timestamp}`;

  const tx = db.transaction(() => {
    db.prepare(
      'INSERT INTO baselines (id, project_id, name, total_duration, project_end_date, critical_paths) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(
      id,
      projectId === 'default' ? null : projectId,
      finalName,
      scheduleResult.totalDuration,
      scheduleResult.projectEndDate,
      JSON.stringify(scheduleResult.criticalPaths)
    );

    const insertTask = db.prepare(
      'INSERT INTO baseline_tasks (baseline_id, task_id, name, start_date, end_date, duration, is_critical) VALUES (?, ?, ?, ?, ?, ?, ?)'
    );

    for (const task of scheduleResult.tasks) {
      insertTask.run(
        id,
        task.id,
        task.name,
        task.startDate,
        task.endDate,
        task.duration,
        task.isCritical ? 1 : 0
      );
    }
  });

  tx();
  return getBaselineById(id)!;
}

export function deleteBaseline(id: string): boolean {
  const result = db.prepare('DELETE FROM baselines WHERE id = ?').run(id);
  return result.changes > 0;
}

export function getLatestBaseline(projectId: string): Baseline | null {
  const row = db.prepare(
    "SELECT * FROM baselines WHERE project_id = ? OR (project_id IS NULL AND ? = 'default') ORDER BY created_at DESC LIMIT 1"
  ).get(projectId, projectId) as BaselineRow | undefined;
  
  if (!row) return null;
  return getBaselineWithTasks(row.id, row);
}

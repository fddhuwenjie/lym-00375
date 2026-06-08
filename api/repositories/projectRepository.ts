import db from '../db/init';
import type { Project, ProjectInput } from '../../shared/types';

interface ProjectRow {
  id: string;
  name: string;
  color: string;
  calendar_id: string | null;
  created_at: string;
  updated_at: string;
}

export function getAllProjects(): Project[] {
  const rows = db.prepare('SELECT * FROM projects ORDER BY created_at DESC').all() as ProjectRow[];
  return rows.map(row => ({
    id: row.id,
    name: row.name,
    color: row.color,
    calendarId: row.calendar_id ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export function getProjectById(id: string): Project | null {
  const row = db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as ProjectRow | undefined;
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    calendarId: row.calendar_id ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createProject(input: ProjectInput): Project {
  const id = input.id || generateId();
  db.prepare(
    'INSERT INTO projects (id, name, color, calendar_id) VALUES (?, ?, ?, ?)'
  ).run(id, input.name, input.color || '#2563eb', input.calendarId || null);
  return getProjectById(id)!;
}

export function updateProject(id: string, input: ProjectInput): Project {
  db.prepare(
    'UPDATE projects SET name = ?, color = ?, calendar_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
  ).run(input.name, input.color || '#2563eb', input.calendarId || null, id);
  return getProjectById(id)!;
}

export function deleteProject(id: string): boolean {
  const result = db.prepare('DELETE FROM projects WHERE id = ?').run(id);
  return result.changes > 0;
}

function generateId(): string {
  return `P${Date.now().toString(36).toUpperCase()}`;
}

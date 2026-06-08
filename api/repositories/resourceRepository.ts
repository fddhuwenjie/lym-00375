import db from '../db/init';
import type { Resource, ResourceInput } from '../../shared/types';

interface ResourceRow {
  id: string;
  name: string;
  daily_capacity: number;
  created_at: string;
  updated_at: string;
}

export function getAllResources(): Resource[] {
  const rows = db.prepare('SELECT * FROM resources ORDER BY name').all() as ResourceRow[];
  return rows.map(row => ({
    id: row.id,
    name: row.name,
    dailyCapacity: row.daily_capacity,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export function getResourceById(id: string): Resource | null {
  const row = db.prepare('SELECT * FROM resources WHERE id = ?').get(id) as ResourceRow | undefined;
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    dailyCapacity: row.daily_capacity,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function getResourceByName(name: string): Resource | null {
  const row = db.prepare('SELECT * FROM resources WHERE name = ?').get(name) as ResourceRow | undefined;
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    dailyCapacity: row.daily_capacity,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createResource(input: ResourceInput): Resource {
  const id = input.id || generateId();
  db.prepare(
    'INSERT INTO resources (id, name, daily_capacity) VALUES (?, ?, ?)'
  ).run(id, input.name, input.dailyCapacity || 8);
  return getResourceById(id)!;
}

export function updateResource(id: string, input: ResourceInput): Resource {
  db.prepare(
    'UPDATE resources SET name = ?, daily_capacity = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
  ).run(input.name, input.dailyCapacity || 8, id);
  return getResourceById(id)!;
}

export function deleteResource(id: string): boolean {
  const result = db.prepare('DELETE FROM resources WHERE id = ?').run(id);
  return result.changes > 0;
}

function generateId(): string {
  return `R${Date.now().toString(36).toUpperCase()}`;
}

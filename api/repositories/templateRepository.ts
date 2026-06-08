import db from '../db/init';
import type { Template, TemplateInput, TaskInput } from '../../shared/types';

interface TemplateRow {
  id: string;
  name: string;
  description: string;
  is_default: number;
  tasks: string;
  created_at: string;
}

export function getAllTemplates(): Template[] {
  const rows = db.prepare('SELECT * FROM templates ORDER BY is_default DESC, created_at DESC').all() as TemplateRow[];
  return rows.map(row => ({
    id: row.id,
    name: row.name,
    description: row.description,
    isDefault: row.is_default === 1,
    tasks: JSON.parse(row.tasks || '[]'),
    createdAt: row.created_at,
  }));
}

export function getTemplateById(id: string): Template | null {
  const row = db.prepare('SELECT * FROM templates WHERE id = ?').get(id) as TemplateRow | undefined;
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    isDefault: row.is_default === 1,
    tasks: JSON.parse(row.tasks || '[]'),
    createdAt: row.created_at,
  };
}

export function createTemplate(input: TemplateInput): Template {
  const id = input.id || `TPL${Date.now().toString(36).toUpperCase()}`;
  db.prepare(
    'INSERT INTO templates (id, name, description, is_default, tasks) VALUES (?, ?, ?, ?, ?)'
  ).run(
    id,
    input.name,
    input.description,
    input.isDefault ? 1 : 0,
    JSON.stringify(input.tasks)
  );
  return getTemplateById(id)!;
}

export function updateTemplate(id: string, input: TemplateInput): Template {
  db.prepare(
    'UPDATE templates SET name = ?, description = ?, is_default = ?, tasks = ? WHERE id = ?'
  ).run(
    input.name,
    input.description,
    input.isDefault ? 1 : 0,
    JSON.stringify(input.tasks),
    id
  );
  return getTemplateById(id)!;
}

export function deleteTemplate(id: string): boolean {
  const template = getTemplateById(id);
  if (!template || template.isDefault) return false;
  const result = db.prepare('DELETE FROM templates WHERE id = ?').run(id);
  return result.changes > 0;
}

export function createTemplateFromProject(
  name: string,
  description: string,
  tasks: TaskInput[]
): Template {
  return createTemplate({
    name,
    description,
    isDefault: false,
    tasks,
  });
}

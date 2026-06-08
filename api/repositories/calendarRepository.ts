import db from '../db/init';
import type { Calendar, CalendarInput } from '../../shared/types';

interface CalendarRow {
  id: string;
  name: string;
  weekend_pattern: string;
  holidays: string;
  created_at: string;
  updated_at: string;
}

export function getAllCalendars(): Calendar[] {
  const rows = db.prepare('SELECT * FROM calendars ORDER BY created_at DESC').all() as CalendarRow[];
  return rows.map(row => ({
    id: row.id,
    name: row.name,
    weekendPattern: JSON.parse(row.weekend_pattern || '[0,6]'),
    holidays: JSON.parse(row.holidays || '[]'),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export function getCalendarById(id: string): Calendar | null {
  const row = db.prepare('SELECT * FROM calendars WHERE id = ?').get(id) as CalendarRow | undefined;
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    weekendPattern: JSON.parse(row.weekend_pattern || '[0,6]'),
    holidays: JSON.parse(row.holidays || '[]'),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createCalendar(input: CalendarInput): Calendar {
  const id = input.id || `CAL${Date.now().toString(36).toUpperCase()}`;
  db.prepare(
    'INSERT INTO calendars (id, name, weekend_pattern, holidays) VALUES (?, ?, ?, ?)'
  ).run(
    id,
    input.name,
    JSON.stringify(input.weekendPattern || [0, 6]),
    JSON.stringify(input.holidays || [])
  );
  return getCalendarById(id)!;
}

export function updateCalendar(id: string, input: CalendarInput): Calendar {
  db.prepare(
    'UPDATE calendars SET name = ?, weekend_pattern = ?, holidays = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
  ).run(
    input.name,
    JSON.stringify(input.weekendPattern || [0, 6]),
    JSON.stringify(input.holidays || []),
    id
  );
  return getCalendarById(id)!;
}

export function deleteCalendar(id: string): boolean {
  if (id === 'default') return false;
  const result = db.prepare('DELETE FROM calendars WHERE id = ?').run(id);
  return result.changes > 0;
}

export function addHoliday(calendarId: string, date: string): Calendar {
  const calendar = getCalendarById(calendarId);
  if (!calendar) throw new Error('Calendar not found');
  
  const holidays = [...new Set([...calendar.holidays, date])].sort();
  return updateCalendar(calendarId, {
    id: calendarId,
    name: calendar.name,
    weekendPattern: calendar.weekendPattern,
    holidays,
  });
}

export function removeHoliday(calendarId: string, date: string): Calendar {
  const calendar = getCalendarById(calendarId);
  if (!calendar) throw new Error('Calendar not found');
  
  const holidays = calendar.holidays.filter(d => d !== date);
  return updateCalendar(calendarId, {
    id: calendarId,
    name: calendar.name,
    weekendPattern: calendar.weekendPattern,
    holidays,
  });
}

export function getTaskOverrides(taskId: string): string[] {
  const rows = db.prepare(
    'SELECT date FROM calendar_overrides WHERE task_id = ? ORDER BY date'
  ).all(taskId) as { date: string }[];
  return rows.map(r => r.date);
}

export function addTaskOverride(taskId: string, date: string): void {
  db.prepare(
    'INSERT OR IGNORE INTO calendar_overrides (task_id, date) VALUES (?, ?)'
  ).run(taskId, date);
}

export function removeTaskOverride(taskId: string, date: string): void {
  db.prepare(
    'DELETE FROM calendar_overrides WHERE task_id = ? AND date = ?'
  ).run(taskId, date);
}

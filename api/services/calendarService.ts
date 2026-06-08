import * as repo from '../repositories/calendarRepository';
import type { Calendar, CalendarInput } from '../../shared/types';

export function getAllCalendars(): Calendar[] {
  return repo.getAllCalendars();
}

export function getCalendarById(id: string): Calendar | null {
  return repo.getCalendarById(id);
}

export function createCalendar(input: CalendarInput): Calendar {
  return repo.createCalendar(input);
}

export function updateCalendar(id: string, input: CalendarInput): Calendar {
  return repo.updateCalendar(id, input);
}

export function deleteCalendar(id: string): boolean {
  return repo.deleteCalendar(id);
}

export function addHoliday(calendarId: string, date: string): Calendar {
  return repo.addHoliday(calendarId, date);
}

export function removeHoliday(calendarId: string, date: string): Calendar {
  return repo.removeHoliday(calendarId, date);
}

export function parseICS(content: string): string[] {
  const holidays: string[] = [];
  const lines = content.split('\n');
  let currentEvent: { dtstart?: string; summary?: string } = {};
  let inEvent = false;

  for (const line of lines) {
    const trimmed = line.trim();
    
    if (trimmed === 'BEGIN:VEVENT') {
      inEvent = true;
      currentEvent = {};
    } else if (trimmed === 'END:VEVENT') {
      inEvent = false;
      if (currentEvent.dtstart) {
        holidays.push(currentEvent.dtstart);
      }
    } else if (inEvent) {
      if (trimmed.startsWith('DTSTART;VALUE=DATE:')) {
        const dateStr = trimmed.replace('DTSTART;VALUE=DATE:', '');
        currentEvent.dtstart = `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;
      } else if (trimmed.startsWith('DTSTART:')) {
        const dateStr = trimmed.replace('DTSTART:', '').slice(0, 8);
        if (dateStr.length === 8) {
          currentEvent.dtstart = `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;
        }
      }
    }
  }

  return [...new Set(holidays)].sort();
}

export function importHolidaysFromICS(calendarId: string, icsContent: string): Calendar {
  const holidays = parseICS(icsContent);
  const calendar = repo.getCalendarById(calendarId);
  if (!calendar) throw new Error('Calendar not found');

  const allHolidays = [...new Set([...calendar.holidays, ...holidays])].sort();
  return repo.updateCalendar(calendarId, {
    id: calendarId,
    name: calendar.name,
    weekendPattern: calendar.weekendPattern,
    holidays: allHolidays,
  });
}

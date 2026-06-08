import { Router } from 'express';
import * as service from '../services/calendarService';
import type { CalendarInput } from '../../shared/types';

const router = Router();

router.get('/', (_req, res) => {
  const calendars = service.getAllCalendars();
  res.json(calendars);
});

router.get('/:id', (req, res) => {
  const calendar = service.getCalendarById(req.params.id);
  if (!calendar) {
    return res.status(404).json({ error: '日历不存在' });
  }
  res.json(calendar);
});

router.post('/', (req, res) => {
  try {
    const input: CalendarInput = req.body;
    if (!input.name) {
      return res.status(400).json({ error: '日历名称不能为空' });
    }
    const calendar = service.createCalendar(input);
    res.json(calendar);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', (req, res) => {
  try {
    const input: CalendarInput = req.body;
    if (!input.name) {
      return res.status(400).json({ error: '日历名称不能为空' });
    }
    const calendar = service.updateCalendar(req.params.id, input);
    res.json(calendar);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', (req, res) => {
  try {
    const success = service.deleteCalendar(req.params.id);
    if (!success) {
      return res.status(404).json({ error: '日历不存在或为默认日历' });
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/holidays', (req, res) => {
  try {
    const { date } = req.body;
    if (!date) {
      return res.status(400).json({ error: '日期不能为空' });
    }
    const calendar = service.addHoliday(req.params.id, date);
    res.json(calendar);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id/holidays/:date', (req, res) => {
  try {
    const calendar = service.removeHoliday(req.params.id, req.params.date);
    res.json(calendar);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/import-ics', (req, res) => {
  try {
    const { content } = req.body;
    if (!content) {
      return res.status(400).json({ error: 'ICS 内容不能为空' });
    }
    const calendar = service.importHolidaysFromICS(req.params.id, content);
    res.json({
      success: true,
      calendar,
      message: `成功导入 ${calendar.holidays.length} 个节假日`,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

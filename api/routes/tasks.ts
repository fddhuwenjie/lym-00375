import { Router } from 'express';
import * as service from '../services/taskService';
import type { TaskInput } from '../../shared/types';

const router = Router();

router.get('/', (_req, res) => {
  const result = service.getFullSchedule();
  res.json(result);
});

router.post('/', (req, res) => {
  try {
    const input: TaskInput = req.body;
    if (!input.name || !input.duration || !input.assignee) {
      return res.status(400).json({ error: '缺少必填字段: name, duration, assignee' });
    }
    if (input.duration <= 0) {
      return res.status(400).json({ error: '工期必须大于0' });
    }
    const result = service.createTask(input);
    res.json(result);
  } catch (err: any) {
    if (err.cyclePath) {
      return res.status(400).json({ error: err.message, cyclePath: err.cyclePath });
    }
    if (err.invalidDependencies) {
      return res.status(400).json({ error: err.message, invalidDependencies: err.invalidDependencies });
    }
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', (req, res) => {
  try {
    const id = req.params.id;
    const input: TaskInput = req.body;
    if (!input.name || !input.duration || !input.assignee) {
      return res.status(400).json({ error: '缺少必填字段: name, duration, assignee' });
    }
    if (input.duration <= 0) {
      return res.status(400).json({ error: '工期必须大于0' });
    }
    const result = service.updateTask(id, input);
    res.json(result);
  } catch (err: any) {
    if (err.cyclePath) {
      return res.status(400).json({ error: err.message, cyclePath: err.cyclePath });
    }
    if (err.invalidDependencies) {
      return res.status(400).json({ error: err.message, invalidDependencies: err.invalidDependencies });
    }
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', (req, res) => {
  try {
    const id = req.params.id;
    const result = service.deleteTask(id);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

import { Router } from 'express';
import * as service from '../services/taskService';
import type { TaskInput } from '../../shared/types';

const router = Router();

router.get('/', (req, res) => {
  const projectId = req.query.projectId as string || 'default';
  const result = service.getFullSchedule(projectId);
  
  if (result.overloadedResources && result.overloadedResources.length > 0) {
    res.json({
      ...result,
      warning: `检测到资源超载: ${result.overloadedResources.join(', ')}`,
    });
  } else {
    res.json(result);
  }
});

router.post('/', (req, res) => {
  try {
    const projectId = req.query.projectId as string || 'default';
    const input: TaskInput = req.body;
    if (!input.name || !input.duration || !input.assignee) {
      return res.status(400).json({ error: '缺少必填字段: name, duration, assignee' });
    }
    if (input.duration <= 0) {
      return res.status(400).json({ error: '工期必须大于0' });
    }
    const result = service.createTask(input, projectId);
    
    if (result.overloadedResources && result.overloadedResources.length > 0) {
      return res.status(201).json({
        ...result,
        warning: `资源超载警告: ${result.overloadedResources.join(', ')} 的工时超过每日上限`,
      });
    }
    
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
    const projectId = req.query.projectId as string || 'default';
    const id = req.params.id;
    const input: TaskInput = req.body;
    if (!input.name || !input.duration || !input.assignee) {
      return res.status(400).json({ error: '缺少必填字段: name, duration, assignee' });
    }
    if (input.duration <= 0) {
      return res.status(400).json({ error: '工期必须大于0' });
    }
    const result = service.updateTask(id, input, projectId);
    
    if (result.overloadedResources && result.overloadedResources.length > 0) {
      return res.json({
        ...result,
        warning: `资源超载警告: ${result.overloadedResources.join(', ')} 的工时超过每日上限`,
      });
    }
    
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

router.patch('/:id/progress', (req, res) => {
  try {
    const projectId = req.query.projectId as string || 'default';
    const id = req.params.id;
    const { progress } = req.body;
    if (progress === undefined || progress < 0 || progress > 100) {
      return res.status(400).json({ error: '进度必须在 0-100 之间' });
    }
    const result = service.updateTaskProgress(id, progress, projectId);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', (req, res) => {
  try {
    const projectId = req.query.projectId as string || 'default';
    const id = req.params.id;
    const result = service.deleteTask(id, projectId);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

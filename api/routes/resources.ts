import { Router } from 'express';
import * as service from '../services/resourceService';
import * as taskService from '../services/taskService';
import type { ResourceInput } from '../../shared/types';

const router = Router();

router.get('/', (_req, res) => {
  const resources = service.getAllResources();
  res.json(resources);
});

router.get('/allocations', (_req, res) => {
  try {
    const schedule = taskService.getFullSchedule();
    res.json({
      allocations: schedule.resourceAllocations || [],
      overloaded: schedule.overloadedResources || [],
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', (req, res) => {
  const resource = service.getResourceById(req.params.id);
  if (!resource) {
    return res.status(404).json({ error: '资源不存在' });
  }
  res.json(resource);
});

router.post('/', (req, res) => {
  try {
    const input: ResourceInput = req.body;
    if (!input.name) {
      return res.status(400).json({ error: '资源名称不能为空' });
    }
    const resource = service.createResource(input);
    res.json(resource);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', (req, res) => {
  try {
    const input: ResourceInput = req.body;
    if (!input.name) {
      return res.status(400).json({ error: '资源名称不能为空' });
    }
    const resource = service.updateResource(req.params.id, input);
    res.json(resource);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', (req, res) => {
  try {
    const success = service.deleteResource(req.params.id);
    if (!success) {
      return res.status(404).json({ error: '资源不存在' });
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

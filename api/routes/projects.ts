import { Router } from 'express';
import * as service from '../services/projectService';
import * as taskService from '../services/taskService';
import type { ProjectInput } from '../../shared/types';

const router = Router();

router.get('/', (_req, res) => {
  const projects = service.getAllProjects();
  res.json(projects);
});

router.get('/:id', (req, res) => {
  const project = service.getProjectById(req.params.id);
  if (!project) {
    return res.status(404).json({ error: '项目不存在' });
  }
  res.json(project);
});

router.get('/:id/health', (req, res) => {
  try {
    const health = taskService.getProjectHealth(req.params.id);
    res.json(health);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', (req, res) => {
  try {
    const input: ProjectInput = req.body;
    if (!input.name) {
      return res.status(400).json({ error: '项目名称不能为空' });
    }
    const project = service.createProject(input);
    res.json(project);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', (req, res) => {
  try {
    const input: ProjectInput = req.body;
    if (!input.name) {
      return res.status(400).json({ error: '项目名称不能为空' });
    }
    const project = service.updateProject(req.params.id, input);
    res.json(project);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', (req, res) => {
  try {
    const success = service.deleteProject(req.params.id);
    if (!success) {
      return res.status(404).json({ error: '项目不存在' });
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

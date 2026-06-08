import { Router } from 'express';
import * as service from '../services/templateService';
import * as taskService from '../services/taskService';
import type { TemplateInput } from '../../shared/types';

const router = Router();

router.get('/', (_req, res) => {
  const templates = service.getAllTemplates();
  res.json(templates);
});

router.get('/:id', (req, res) => {
  const template = service.getTemplateById(req.params.id);
  if (!template) {
    return res.status(404).json({ error: '模板不存在' });
  }
  res.json(template);
});

router.post('/', (req, res) => {
  try {
    const input: TemplateInput = req.body;
    if (!input.name || !input.tasks) {
      return res.status(400).json({ error: '模板名称和任务列表不能为空' });
    }
    const template = service.createTemplate(input);
    res.json(template);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/from-project', (req, res) => {
  try {
    const { name, description, projectId } = req.body;
    if (!name) {
      return res.status(400).json({ error: '模板名称不能为空' });
    }
    const template = service.createTemplateFromProject(name, description || '', projectId || 'default');
    res.json(template);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/apply', (req, res) => {
  try {
    const { projectId } = req.body;
    const result = service.applyTemplateToProject(req.params.id, projectId || 'default');
    const schedule = taskService.getFullSchedule(projectId || 'default');
    res.json({ ...result, schedule });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', (req, res) => {
  try {
    const input: TemplateInput = req.body;
    if (!input.name || !input.tasks) {
      return res.status(400).json({ error: '模板名称和任务列表不能为空' });
    }
    const template = service.updateTemplate(req.params.id, input);
    res.json(template);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', (req, res) => {
  try {
    const success = service.deleteTemplate(req.params.id);
    if (!success) {
      return res.status(404).json({ error: '模板不存在或为内置模板' });
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

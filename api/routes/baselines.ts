import { Router } from 'express';
import * as service from '../services/baselineService';

const router = Router();

router.get('/', (req, res) => {
  const projectId = req.query.projectId as string || 'default';
  const baselines = service.getBaselines(projectId);
  res.json(baselines);
});

router.get('/:id', (req, res) => {
  const baseline = service.getBaselineById(req.params.id);
  if (!baseline) {
    return res.status(404).json({ error: '基线不存在' });
  }
  res.json(baseline);
});

router.get('/:id/compare', (req, res) => {
  try {
    const projectId = req.query.projectId as string || 'default';
    const comparison = service.getBaselineComparison(req.params.id, projectId);
    if (!comparison) {
      return res.status(404).json({ error: '基线不存在' });
    }
    res.json(comparison);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', (req, res) => {
  try {
    const { name, projectId } = req.body;
    if (!name) {
      return res.status(400).json({ error: '基线名称不能为空' });
    }
    const baseline = service.createBaseline(name, projectId || 'default');
    res.json(baseline);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', (req, res) => {
  try {
    const success = service.deleteBaseline(req.params.id);
    if (!success) {
      return res.status(404).json({ error: '基线不存在' });
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

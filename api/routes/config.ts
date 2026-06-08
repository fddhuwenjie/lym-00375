import { Router } from 'express';
import * as service from '../services/taskService';

const router = Router();

router.get('/', (_req, res) => {
  const config = service.getConfig();
  res.json(config);
});

router.put('/', (req, res) => {
  try {
    const { startDate } = req.body;
    if (!startDate) {
      return res.status(400).json({ error: '缺少 startDate 字段' });
    }
    const result = service.updateConfig(startDate);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

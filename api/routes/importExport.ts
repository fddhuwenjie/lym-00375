import { Router } from 'express';
import * as service from '../services/importExportService';
import * as taskService from '../services/taskService';
import * as projectService from '../services/projectService';
import * as baselineService from '../services/baselineService';

const router = Router();

router.post('/projects/:id/import', (req, res) => {
  try {
    const projectId = req.params.id;
    const { format, content } = req.body;
    
    if (!format || !content) {
      return res.status(400).json({ error: '格式和内容不能为空' });
    }
    
    if (format !== 'xml' && format !== 'csv') {
      return res.status(400).json({ error: '不支持的格式，仅支持 xml 和 csv' });
    }

    const result = service.importProject(projectId, format, content);
    
    if (result.success) {
      const schedule = taskService.getFullSchedule(projectId);
      res.json({ ...result, schedule });
    } else {
      res.status(400).json(result);
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/projects/:id/export', (req, res) => {
  try {
    const projectId = req.params.id;
    const format = req.query.format as string;
    
    if (!format) {
      return res.status(400).json({ error: '请指定导出格式' });
    }

    const schedule = taskService.getFullSchedule(projectId);
    const project = projectService.getProjectById(projectId);
    const projectName = project?.name || '项目';
    const baseline = baselineService.getLatestBaseline(projectId);

    if (format === 'csv') {
      const csv = service.exportToCSV(schedule);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${projectName}.csv"`);
      res.send('\ufeff' + csv);
    } else if (format === 'xml') {
      const xml = service.exportToMSProjectXML(schedule, projectName);
      res.setHeader('Content-Type', 'application/xml; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${projectName}.xml"`);
      res.send(xml);
    } else if (format === 'png' || format === 'pdf') {
      res.json({
        schedule,
        project,
        baseline,
        format,
        message: 'PNG/PDF 导出请在前端使用 SVG 转 Canvas 实现',
      });
    } else {
      return res.status(400).json({ error: '不支持的格式，仅支持 png, pdf, csv, xml' });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

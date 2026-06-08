import * as taskRepo from '../repositories/taskRepository';
import * as resourceRepo from '../repositories/resourceRepository';
import type { TaskInput, ScheduleResult, ImportResult } from '../../shared/types';
import { computeSchedule } from './scheduler';

function parseMSProjectXML(xmlContent: string): { tasks: TaskInput[]; resources: string[]; dependencies: [string, string][] } {
  const tasks: TaskInput[] = [];
  const resources: string[] = [];
  const dependencies: [string, string][] = [];

  const taskRegex = /<Task>[\s\S]*?<\/Task>/g;
  const resourceRegex = /<Resource>[\s\S]*?<\/Resource>/g;

  const taskMatches = xmlContent.match(taskRegex) || [];
  const resourceMatches = xmlContent.match(resourceRegex) || [];

  for (const resourceMatch of resourceMatches) {
    const nameMatch = resourceMatch.match(/<Name>([^<]+)<\/Name>/);
    if (nameMatch) {
      resources.push(nameMatch[1]);
    }
  }

  const taskIdMap = new Map<string, string>();
  let taskCounter = 1;

  for (const taskMatch of taskMatches) {
    const idMatch = taskMatch.match(/<UID>(\d+)<\/UID>/);
    const nameMatch = taskMatch.match(/<Name>([^<]+)<\/Name>/);
    const durationMatch = taskMatch.match(/<Duration>PT(\d+)H<\/Duration>/);
    const resourceMatch = taskMatch.match(/<ResourceNames>([^<]+)<\/ResourceNames>/);

    if (nameMatch && durationMatch) {
      const duration = Math.ceil(parseInt(durationMatch[1]) / 8);
      const assignee = resourceMatch ? resourceMatch[1].split(',')[0].trim() : '未分配';
      
      const newId = `T${taskCounter++}`;
      if (idMatch) {
        taskIdMap.set(idMatch[1], newId);
      }

      tasks.push({
        id: newId,
        name: nameMatch[1],
        duration: Math.max(1, duration),
        assignee,
        dependsOn: [],
      });
    }
  }

  const predecessorRegex = /<PredecessorLink>[\s\S]*?<\/PredecessorLink>/g;
  for (const taskMatch of taskMatches) {
    const taskIdMatch = taskMatch.match(/<UID>(\d+)<\/UID>/);
    const predecessorMatches = taskMatch.match(predecessorRegex) || [];

    for (const predMatch of predecessorMatches) {
      const predIdMatch = predMatch.match(/<PredecessorUID>(\d+)<\/PredecessorUID>/);
      if (taskIdMatch && predIdMatch) {
        const fromId = taskIdMap.get(predIdMatch[1]);
        const toId = taskIdMap.get(taskIdMatch[1]);
        if (fromId && toId && fromId !== toId) {
          dependencies.push([fromId, toId]);
        }
      }
    }
  }

  return { tasks, resources, dependencies };
}

function parseCSV(csvContent: string): { tasks: TaskInput[]; resources: string[] } {
  const lines = csvContent.trim().split('\n');
  if (lines.length < 2) return { tasks: [], resources: [] };

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  const tasks: TaskInput[] = [];
  const resources: string[] = [];

  const nameIdx = headers.indexOf('name') || headers.indexOf('任务名称') || headers.indexOf('task');
  const durationIdx = headers.indexOf('duration') || headers.indexOf('工期') || headers.indexOf('days');
  const assigneeIdx = headers.indexOf('assignee') || headers.indexOf('负责人') || headers.indexOf('resource');
  const dependsIdx = headers.indexOf('dependencies') || headers.indexOf('依赖') || headers.indexOf('depends');

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim());
    if (values.length < 3) continue;

    const name = values[nameIdx] || `任务${i}`;
    const duration = parseInt(values[durationIdx]) || 1;
    const assignee = values[assigneeIdx] || '未分配';
    const dependsOnStr = values[dependsIdx] || '';
    const dependsOn = dependsOnStr ? dependsOnStr.split(';').map(d => d.trim()).filter(Boolean) : [];

    if (assignee && !resources.includes(assignee)) {
      resources.push(assignee);
    }

    tasks.push({
      id: `T${i}`,
      name,
      duration: Math.max(1, duration),
      assignee,
      dependsOn,
    });
  }

  return { tasks, resources };
}

export function importProject(
  projectId: string,
  format: 'xml' | 'csv',
  content: string
): ImportResult {
  const result: ImportResult = {
    success: true,
    tasksCreated: 0,
    dependenciesCreated: 0,
    resourcesCreated: 0,
    warnings: [],
    errors: [],
  };

  try {
    let parsedData: { tasks: TaskInput[]; resources: string[]; dependencies?: [string, string][] };

    if (format === 'xml') {
      parsedData = parseMSProjectXML(content);
    } else {
      parsedData = parseCSV(content);
    }

    const existingResources = resourceRepo.getAllResources();
    const existingResourceNames = new Set(existingResources.map(r => r.name));

    for (const resourceName of parsedData.resources) {
      if (!existingResourceNames.has(resourceName)) {
        resourceRepo.createResource({ name: resourceName });
        result.resourcesCreated++;
        existingResourceNames.add(resourceName);
      }
    }

    const taskMap = new Map<string, TaskInput>();
    for (const task of parsedData.tasks) {
      taskMap.set(task.id!, task);
    }

    if (parsedData.dependencies) {
      for (const [fromId, toId] of parsedData.dependencies) {
        const toTask = taskMap.get(toId);
        if (toTask && !toTask.dependsOn.includes(fromId)) {
          toTask.dependsOn.push(fromId);
          result.dependenciesCreated++;
        }
      }
    }

    for (const task of parsedData.tasks) {
      try {
        const existingTasks = taskRepo.getAllTasks(projectId);
        const existingIds = new Set(existingTasks.map(t => t.id));
        let taskId = task.id;
        while (taskId && existingIds.has(taskId)) {
          taskId = `${taskId}_${Date.now()}`;
        }

        taskRepo.createTask({
          ...task,
          id: taskId,
          projectId,
        });
        result.tasksCreated++;
      } catch (err: any) {
        result.warnings.push(`创建任务 "${task.name}" 失败: ${err.message}`);
      }
    }

    result.success = result.tasksCreated > 0;
  } catch (err: any) {
    result.success = false;
    result.errors.push(err.message);
  }

  return result;
}

export function exportToCSV(schedule: ScheduleResult): string {
  const headers = ['ID', '任务名称', '工期(天)', '负责人', '开始日期', '结束日期', '依赖', '进度(%)', '是否关键路径'];
  const lines = [headers.join(',')];

  for (const task of schedule.tasks) {
    const line = [
      task.id,
      `"${task.name}"`,
      task.duration,
      task.assignee,
      task.startDate,
      task.endDate,
      task.dependsOn.join(';'),
      task.progress || 0,
      task.isCritical ? '是' : '否',
    ];
    lines.push(line.join(','));
  }

  return lines.join('\n');
}

export function exportToMSProjectXML(schedule: ScheduleResult, projectName: string): string {
  const now = new Date().toISOString();
  
  let tasksXML = '';
  for (const task of schedule.tasks) {
    const predecessors = task.dependsOn
      .map(depId => {
        const depTask = schedule.tasks.find(t => t.id === depId);
        if (!depTask) return '';
        return `
          <PredecessorLink>
            <PredecessorUID>${schedule.tasks.findIndex(t => t.id === depId) + 1}</PredecessorUID>
            <Type>1</Type>
            <LinkLag>0</LinkLag>
            <LagFormat>7</LagFormat>
          </PredecessorLink>`;
      })
      .join('');

    tasksXML += `
      <Task>
        <UID>${schedule.tasks.findIndex(t => t.id === task.id) + 1}</UID>
        <ID>${schedule.tasks.findIndex(t => t.id === task.id) + 1}</ID>
        <Name>${task.name}</Name>
        <Duration>PT${task.duration * 8}H</Duration>
        <Start>${task.startDate}T08:00:00</Start>
        <Finish>${task.endDate}T17:00:00</Finish>
        <PercentComplete>${task.progress || 0}</PercentComplete>
        <ResourceNames>${task.assignee}</ResourceNames>
        ${predecessors}
      </Task>`;
  }

  const resources = [...new Set(schedule.tasks.map(t => t.assignee))];
  let resourcesXML = '';
  for (let i = 0; i < resources.length; i++) {
    resourcesXML += `
      <Resource>
        <UID>${i + 1}</UID>
        <ID>${i + 1}</ID>
        <Name>${resources[i]}</Name>
        <MaxUnits>100</MaxUnits>
        <PeakUnits>100</PeakUnits>
        <StandardRate>0</StandardRate>
        <OvertimeRate>0</OvertimeRate>
        <Cost>0</Cost>
      </Resource>`;
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<Project xmlns="http://schemas.microsoft.com/project">
  <Name>${projectName}</Name>
  <Title>${projectName}</Title>
  <CreationDate>${now}</CreationDate>
  <LastSaved>${now}</LastSaved>
  <StartDate>${schedule.tasks[0]?.startDate || new Date().toISOString().split('T')[0]}T08:00:00</StartDate>
  <FinishDate>${schedule.projectEndDate}T17:00:00</FinishDate>
  <ScheduleFromStart>1</ScheduleFromStart>
  <CalendarUID>1</CalendarUID>
  <Tasks>${tasksXML}
  </Tasks>
  <Resources>${resourcesXML}
  </Resources>
</Project>`;
}

export { parseMSProjectXML, parseCSV };

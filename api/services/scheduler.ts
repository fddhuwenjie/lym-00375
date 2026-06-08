import type { Task, TaskInput, ScheduleResult, ResourceConflict, CycleError, Calendar, ResourceAllocation, Project } from '../../shared/types';
import * as calendarRepo from '../repositories/calendarRepository';
import * as resourceRepo from '../repositories/resourceRepository';
import * as projectRepo from '../repositories/projectRepository';

interface RawTask {
  id: string;
  projectId?: string;
  name: string;
  duration: number;
  assignee: string;
  dependsOn: string[];
  manualStart?: number;
  progress?: number;
  actualStartDate?: string;
  actualEndDate?: string;
  calendarId?: string;
  timeOff?: string[];
}

interface CalendarContext {
  defaultCalendar: Calendar | null;
  taskCalendars: Map<string, Calendar | null>;
}

function getTaskCalendar(task: RawTask, ctx: CalendarContext): Calendar | null {
  if (task.calendarId) {
    const cal = ctx.taskCalendars.get(task.id);
    if (cal) return cal;
  }
  return ctx.defaultCalendar;
}

function isWorkDay(date: Date, calendar: Calendar | null, taskTimeOff: string[] = []): boolean {
  const dateStr = date.toISOString().split('T')[0];
  
  if (taskTimeOff.includes(dateStr)) {
    return false;
  }
  
  if (calendar) {
    const dayOfWeek = date.getDay();
    if (calendar.weekendPattern.includes(dayOfWeek)) {
      return false;
    }
    if (calendar.holidays.includes(dateStr)) {
      return false;
    }
  } else {
    const dayOfWeek = date.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return false;
    }
  }
  
  return true;
}

function addWorkdays(startDateStr: string, workdays: number, calendar: Calendar | null, taskTimeOff: string[] = []): string {
  const date = new Date(startDateStr);
  let remaining = workdays;
  while (remaining > 0) {
    date.setDate(date.getDate() + 1);
    if (isWorkDay(date, calendar, taskTimeOff)) {
      remaining--;
    }
  }
  return date.toISOString().split('T')[0];
}

function getDateForWorkday(startDateStr: string, workdayIndex: number, calendar: Calendar | null, taskTimeOff: string[] = []): string {
  if (workdayIndex <= 0) return startDateStr;
  return addWorkdays(startDateStr, workdayIndex, calendar, taskTimeOff);
}

function workdayToDate(startDate: string, day: number, duration: number, calendar: Calendar | null, taskTimeOff: string[] = []): { startDate: string; endDate: string } {
  const s = getDateForWorkday(startDate, day, calendar, taskTimeOff);
  const e = addWorkdays(s, duration - 1, calendar, taskTimeOff);
  return { startDate: s, endDate: e };
}

function countWorkdaysBetween(startDateStr: string, endDateStr: string, calendar: Calendar | null): number {
  const start = new Date(startDateStr);
  const end = new Date(endDateStr);
  let count = 0;
  const current = new Date(start);
  while (current < end) {
    current.setDate(current.getDate() + 1);
    if (isWorkDay(current, calendar)) {
      count++;
    }
  }
  return count;
}

export function detectCycle(tasks: RawTask[], newTaskId: string, newDependsOn: string[]): CycleError {
  const adjMap = new Map<string, string[]>();
  
  for (const t of tasks) {
    adjMap.set(t.id, [...t.dependsOn]);
  }
  
  adjMap.set(newTaskId, [...newDependsOn]);

  const visited = new Set<string>();
  const recStack = new Set<string>();
  const path: string[] = [];

  function dfs(node: string): { hasCycle: boolean; cyclePath: string[] } {
    if (recStack.has(node)) {
      const cycleStart = path.indexOf(node);
      return { hasCycle: true, cyclePath: path.slice(cycleStart).concat(node) };
    }
    if (visited.has(node)) {
      return { hasCycle: false, cyclePath: [] };
    }

    visited.add(node);
    recStack.add(node);
    path.push(node);

    const deps = adjMap.get(node) || [];
    for (const dep of deps) {
      const result = dfs(dep);
      if (result.hasCycle) {
        return result;
      }
    }

    recStack.delete(node);
    path.pop();
    return { hasCycle: false, cyclePath: [] };
  }

  for (const task of tasks) {
    if (!visited.has(task.id)) {
      const result = dfs(task.id);
      if (result.hasCycle) {
        return { hasCycle: true, path: result.cyclePath };
      }
    }
  }

  const result = dfs(newTaskId);
  if (result.hasCycle) {
    return { hasCycle: true, path: result.cyclePath };
  }

  return { hasCycle: false, path: [] };
}

function topologicalSort(tasks: RawTask[]): RawTask[] {
  const inDegree = new Map<string, number>();
  const adjMap = new Map<string, string[]>();
  const taskMap = new Map<string, RawTask>();

  for (const t of tasks) {
    inDegree.set(t.id, 0);
    adjMap.set(t.id, []);
    taskMap.set(t.id, t);
  }

  for (const t of tasks) {
    for (const dep of t.dependsOn) {
      adjMap.get(dep)!.push(t.id);
      inDegree.set(t.id, (inDegree.get(t.id) || 0) + 1);
    }
  }

  const queue: string[] = [];
  for (const [id, deg] of inDegree) {
    if (deg === 0) queue.push(id);
  }

  const sorted: RawTask[] = [];
  while (queue.length > 0) {
    const id = queue.shift()!;
    sorted.push(taskMap.get(id)!);
    for (const next of adjMap.get(id) || []) {
      const newDeg = (inDegree.get(next) || 0) - 1;
      inDegree.set(next, newDeg);
      if (newDeg === 0) queue.push(next);
    }
  }

  return sorted;
}

function getCalendarContext(tasks: RawTask[], projectCalendarId?: string): CalendarContext {
  const defaultCalendar = projectCalendarId ? calendarRepo.getCalendarById(projectCalendarId) : calendarRepo.getCalendarById('default');
  const taskCalendars = new Map<string, Calendar | null>();
  
  for (const task of tasks) {
    if (task.calendarId) {
      taskCalendars.set(task.id, calendarRepo.getCalendarById(task.calendarId));
    }
  }
  
  return { defaultCalendar, taskCalendars };
}

function adjustTaskDurationForProgress(task: RawTask): number {
  const progress = task.progress || 0;
  if (progress >= 100) return 0;
  const remainingRatio = 1 - progress / 100;
  return Math.ceil(task.duration * remainingRatio);
}

export function computeSchedule(rawTasks: RawTask[], startDate: string, projectCalendarId?: string): ScheduleResult {
  const calendarCtx = getCalendarContext(rawTasks, projectCalendarId);
  const sorted = topologicalSort(rawTasks);
  const taskMap = new Map<string, RawTask>();
  const computedTasks = new Map<string, Task>();

  for (const t of rawTasks) {
    taskMap.set(t.id, t);
  }

  for (const t of sorted) {
    let es = 0;
    for (const depId of t.dependsOn) {
      const depTask = computedTasks.get(depId);
      if (depTask && depTask.ef > es) {
        es = depTask.ef;
      }
    }

    const effectiveDuration = adjustTaskDurationForProgress(t);
    const actualStart = t.manualStart !== undefined ? Math.max(t.manualStart, es) : es;
    const ef = actualStart + effectiveDuration;

    const calendar = getTaskCalendar(t, calendarCtx);
    const dates = workdayToDate(startDate, actualStart, effectiveDuration, calendar, t.timeOff || []);

    computedTasks.set(t.id, {
      ...t,
      progress: t.progress || 0,
      actualStartDate: t.actualStartDate,
      actualEndDate: t.actualEndDate,
      es,
      ef,
      ls: 0,
      lf: 0,
      slack: 0,
      isCritical: false,
      startDate: dates.startDate,
      endDate: dates.endDate,
      duration: effectiveDuration > 0 ? effectiveDuration : t.duration,
    });
  }

  const reverseSorted = [...sorted].reverse();
  let maxEf = 0;
  for (const t of computedTasks.values()) {
    if (t.ef > maxEf) maxEf = t.ef;
  }

  const successors = new Map<string, string[]>();
  for (const t of rawTasks) {
    for (const dep of t.dependsOn) {
      if (!successors.has(dep)) successors.set(dep, []);
      successors.get(dep)!.push(t.id);
    }
  }

  for (const t of reverseSorted) {
    const computed = computedTasks.get(t.id)!;
    let lf = maxEf;
    const succs = successors.get(t.id) || [];
    for (const succId of succs) {
      const succTask = computedTasks.get(succId)!;
      if (succTask.ls < lf) lf = succTask.ls;
    }
    const effectiveDuration = adjustTaskDurationForProgress(t);
    const ls = lf - effectiveDuration;
    const slack = ls - computed.es;
    
    computed.ls = ls;
    computed.lf = lf;
    computed.slack = slack;
    computed.isCritical = slack === 0 && effectiveDuration > 0;
  }

  const criticalPaths = findAllCriticalPaths(
    rawTasks,
    Array.from(computedTasks.values())
  );

  const conflicts = detectResourceConflicts(Array.from(computedTasks.values()));
  const { resourceAllocations, overloadedResources } = computeResourceAllocations(
    Array.from(computedTasks.values()),
    startDate,
    calendarCtx.defaultCalendar
  );

  const projectEndDate = getDateForWorkday(startDate, maxEf, calendarCtx.defaultCalendar);

  return {
    tasks: Array.from(computedTasks.values()),
    criticalPaths,
    conflicts,
    totalDuration: maxEf,
    projectEndDate,
    resourceAllocations,
    overloadedResources,
  };
}

function findAllCriticalPaths(rawTasks: RawTask[], computedTasks: Task[]): string[][] {
  const taskMap = new Map<string, Task>();
  for (const t of computedTasks) {
    taskMap.set(t.id, t);
  }

  const adjMap = new Map<string, string[]>();
  for (const t of rawTasks) {
    adjMap.set(t.id, t.dependsOn);
  }

  const endTasks = computedTasks.filter(t => t.isCritical);
  if (endTasks.length === 0) return [];

  let maxEf = 0;
  for (const t of endTasks) {
    if (t.ef > maxEf) maxEf = t.ef;
  }

  const finalCriticalTasks = endTasks.filter(t => t.ef === maxEf);
  const paths: string[][] = [];

  function dfs(currentId: string, path: string[], visited: Set<string>) {
    if (visited.has(currentId)) return;
    visited.add(currentId);
    path.push(currentId);

    const deps = adjMap.get(currentId) || [];
    const criticalDeps = deps.filter(depId => {
      const depTask = taskMap.get(depId);
      return depTask?.isCritical;
    });

    if (criticalDeps.length === 0) {
      paths.push([...path].reverse());
    } else {
      for (const depId of criticalDeps) {
        dfs(depId, path, new Set(visited));
      }
    }

    path.pop();
    visited.delete(currentId);
  }

  for (const endTask of finalCriticalTasks) {
    dfs(endTask.id, [], new Set());
  }

  const uniquePaths = Array.from(new Set(paths.map(p => p.join(',')))).map(s => s.split(','));

  return uniquePaths;
}

function detectResourceConflicts(tasks: Task[]): ResourceConflict[] {
  const assigneeTasks = new Map<string, Task[]>();
  for (const t of tasks) {
    if (!assigneeTasks.has(t.assignee)) {
      assigneeTasks.set(t.assignee, []);
    }
    assigneeTasks.get(t.assignee)!.push(t);
  }

  const conflicts: ResourceConflict[] = [];

  for (const [assignee, atasks] of assigneeTasks) {
    for (let i = 0; i < atasks.length; i++) {
      for (let j = i + 1; j < atasks.length; j++) {
        const t1 = atasks[i];
        const t2 = atasks[j];

        const start1 = t1.manualStart !== undefined ? t1.manualStart : t1.es;
        const end1 = start1 + t1.duration;
        const start2 = t2.manualStart !== undefined ? t2.manualStart : t2.es;
        const end2 = start2 + t2.duration;

        const overlapStart = Math.max(start1, start2);
        const overlapEnd = Math.min(end1, end2);

        if (overlapStart < overlapEnd) {
          conflicts.push({
            assignee,
            tasks: [t1.id, t2.id],
            startDay: overlapStart,
            endDay: overlapEnd,
          });
        }
      }
    }
  }

  return conflicts;
}

function computeResourceAllocations(
  tasks: Task[],
  startDate: string,
  defaultCalendar: Calendar | null
): { resourceAllocations: ResourceAllocation[]; overloadedResources: string[] } {
  const resources = resourceRepo.getAllResources();
  const projects = projectRepo.getAllProjects();
  const resourceMap = new Map(resources.map(r => [r.name, r]));
  const projectMap = new Map(projects.map(p => [p.id, p]));

  const allAllocations = new Map<string, ResourceAllocation>();
  const overloaded = new Set<string>();

  let minDate: Date | null = null;
  let maxDate: Date | null = null;

  for (const task of tasks) {
    const taskStart = new Date(task.startDate);
    const taskEnd = new Date(task.endDate);
    if (!minDate || taskStart < minDate) minDate = taskStart;
    if (!maxDate || taskEnd > maxDate) maxDate = taskEnd;
  }

  if (!minDate || !maxDate) {
    return { resourceAllocations: [], overloadedResources: [] };
  }

  const current = new Date(minDate);
  while (current <= maxDate) {
    const dateStr = current.toISOString().split('T')[0];
    
    for (const resource of resources) {
      const key = `${resource.name}-${dateStr}`;
      if (!allAllocations.has(key)) {
        allAllocations.set(key, {
          assignee: resource.name,
          date: dateStr,
          projects: [],
          totalHours: 0,
          isOverloaded: false,
        });
      }
    }
    
    current.setDate(current.getDate() + 1);
  }

  for (const task of tasks) {
    const taskStart = new Date(task.startDate);
    const taskEnd = new Date(task.endDate);
    const currentDate = new Date(taskStart);
    const resource = resourceMap.get(task.assignee);
    const dailyHours = resource ? Math.min(8, resource.dailyCapacity) : 8;
    const projectId = task.projectId || 'default';
    const project = projectMap.get(projectId) || { id: 'default', name: '默认项目', color: '#2563eb', createdAt: '', updatedAt: '' };

    while (currentDate <= taskEnd) {
      const dateStr = currentDate.toISOString().split('T')[0];
      const key = `${task.assignee}-${dateStr}`;
      const allocation = allAllocations.get(key);
      
      if (allocation && isWorkDay(currentDate, defaultCalendar)) {
        allocation.projects.push({
          projectId,
          projectName: project.name,
          taskId: task.id,
          taskName: task.name,
          hours: dailyHours,
        });
        allocation.totalHours += dailyHours;
        
        if (resource && allocation.totalHours > resource.dailyCapacity) {
          allocation.isOverloaded = true;
          overloaded.add(task.assignee);
        }
      }
      
      currentDate.setDate(currentDate.getDate() + 1);
    }
  }

  const allocations = Array.from(allAllocations.values()).sort((a, b) => {
    if (a.assignee !== b.assignee) return a.assignee.localeCompare(b.assignee);
    return a.date.localeCompare(b.date);
  });

  return {
    resourceAllocations: allocations,
    overloadedResources: Array.from(overloaded),
  };
}

export function compareBaseline(
  baseline: { tasks: { taskId: string; name: string; startDate: string; endDate: string; duration: number; isCritical: boolean }[]; totalDuration: number; projectEndDate: string; criticalPaths: string[][] },
  currentSchedule: { tasks: Task[]; totalDuration: number; projectEndDate: string },
  calendar: Calendar | null
) {
  const taskComparisons = baseline.tasks.map(bt => {
    const currentTask = currentSchedule.tasks.find(t => t.id === bt.taskId);
    if (!currentTask) {
      return {
        taskId: bt.taskId,
        taskName: bt.name,
        startDateDiff: NaN,
        endDateDiff: NaN,
        durationDiff: NaN,
        isCriticalChanged: false,
        wasCritical: bt.isCritical,
        isCritical: false,
      };
    }

    const startDiff = countWorkdaysBetween(bt.startDate, currentTask.startDate, calendar);
    const endDiff = countWorkdaysBetween(bt.endDate, currentTask.endDate, calendar);
    const durationDiff = currentTask.duration - bt.duration;

    return {
      taskId: bt.taskId,
      taskName: bt.name,
      startDateDiff: startDiff,
      endDateDiff: endDiff,
      durationDiff,
      isCriticalChanged: bt.isCritical !== currentTask.isCritical,
      wasCritical: bt.isCritical,
      isCritical: currentTask.isCritical,
    };
  });

  const baselineCriticalIds = new Set(baseline.criticalPaths.flat());
  const currentCriticalIds = new Set(currentSchedule.tasks.filter(t => t.isCritical).map(t => t.id));

  const toCritical = Array.from(currentCriticalIds).filter(id => !baselineCriticalIds.has(id));
  const fromCritical = Array.from(baselineCriticalIds).filter(id => !currentCriticalIds.has(id));

  return {
    projectDurationChange: currentSchedule.totalDuration - baseline.totalDuration,
    projectEndDateChange: countWorkdaysBetween(baseline.projectEndDate, currentSchedule.projectEndDate, calendar),
    taskComparisons,
    criticalPathChanges: {
      toCritical,
      fromCritical,
    },
  };
}

export { workdayToDate, getDateForWorkday, addWorkdays, isWorkDay, countWorkdaysBetween };

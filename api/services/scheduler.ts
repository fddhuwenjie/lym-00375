import type { Task, TaskInput, ScheduleResult, ResourceConflict, CycleError } from '../../shared/types';

interface RawTask {
  id: string;
  name: string;
  duration: number;
  assignee: string;
  dependsOn: string[];
  manualStart?: number;
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

function addWorkdays(startDateStr: string, workdays: number): string {
  const date = new Date(startDateStr);
  let remaining = workdays;
  while (remaining > 0) {
    date.setDate(date.getDate() + 1);
    const day = date.getDay();
    if (day !== 0 && day !== 6) {
      remaining--;
    }
  }
  return date.toISOString().split('T')[0];
}

function getDateForWorkday(startDateStr: string, workdayIndex: number): string {
  if (workdayIndex <= 0) return startDateStr;
  return addWorkdays(startDateStr, workdayIndex);
}

function workdayToDate(startDate: string, day: number, duration: number): { startDate: string; endDate: string } {
  const s = getDateForWorkday(startDate, day);
  const e = addWorkdays(s, duration - 1);
  return { startDate: s, endDate: e };
}

export function computeSchedule(rawTasks: RawTask[], startDate: string): ScheduleResult {
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

    const actualStart = t.manualStart !== undefined ? Math.max(t.manualStart, es) : es;
    const ef = actualStart + t.duration;

    const dates = workdayToDate(startDate, actualStart, t.duration);

    computedTasks.set(t.id, {
      ...t,
      es,
      ef,
      ls: 0,
      lf: 0,
      slack: 0,
      isCritical: false,
      startDate: dates.startDate,
      endDate: dates.endDate,
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
    const ls = lf - t.duration;
    const slack = ls - computed.es;
    
    computed.ls = ls;
    computed.lf = lf;
    computed.slack = slack;
    computed.isCritical = slack === 0;
  }

  const criticalPaths = findAllCriticalPaths(
    rawTasks,
    Array.from(computedTasks.values())
  );

  const conflicts = detectResourceConflicts(Array.from(computedTasks.values()));

  const projectEndDate = getDateForWorkday(startDate, maxEf);

  return {
    tasks: Array.from(computedTasks.values()),
    criticalPaths,
    conflicts,
    totalDuration: maxEf,
    projectEndDate,
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

export { workdayToDate, getDateForWorkday, addWorkdays };

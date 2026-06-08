import * as repo from '../repositories/taskRepository';
import { computeSchedule, detectCycle } from './scheduler';
import type { TaskInput, ScheduleResult } from '../../shared/types';

export function getFullSchedule(): ScheduleResult {
  const tasks = repo.getAllTasks();
  const config = repo.getProjectConfig();
  return computeSchedule(tasks, config.startDate);
}

export function createTask(input: TaskInput): ScheduleResult {
  const existingTasks = repo.getAllTasks();
  
  const id = input.id || generateTempId(existingTasks);
  const cycleResult = detectCycle(existingTasks, id, input.dependsOn);
  
  if (cycleResult.hasCycle) {
    const error = new Error(`检测到循环依赖: ${cycleResult.path.join(' → ')}`);
    (error as any).cyclePath = cycleResult.path;
    throw error;
  }

  repo.createTask({ ...input, id });
  return getFullSchedule();
}

export function updateTask(id: string, input: TaskInput): ScheduleResult {
  const existingTasks = repo.getAllTasks().filter(t => t.id !== id);
  
  const cycleResult = detectCycle(existingTasks, id, input.dependsOn);
  
  if (cycleResult.hasCycle) {
    const error = new Error(`检测到循环依赖: ${cycleResult.path.join(' → ')}`);
    (error as any).cyclePath = cycleResult.path;
    throw error;
  }

  repo.updateTask(id, input);
  return getFullSchedule();
}

export function deleteTask(id: string): ScheduleResult {
  repo.deleteTask(id);
  return getFullSchedule();
}

export function getConfig() {
  return repo.getProjectConfig();
}

export function updateConfig(startDate: string): ScheduleResult {
  repo.updateProjectConfig({ startDate });
  return getFullSchedule();
}

function generateTempId(existing: { id: string }[]): string {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  for (const letter of letters) {
    if (!existing.some(e => e.id === letter)) {
      return letter;
    }
  }
  return `T${Date.now().toString(36).toUpperCase()}`;
}

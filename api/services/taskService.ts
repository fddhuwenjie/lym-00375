import * as repo from '../repositories/taskRepository';
import { computeSchedule, detectCycle } from './scheduler';
import type { TaskInput, ScheduleResult } from '../../shared/types';

export function getFullSchedule(): ScheduleResult {
  const tasks = repo.getAllTasks();
  const config = repo.getProjectConfig();
  return computeSchedule(tasks, config.startDate);
}

function validateDependencies(dependsOn: string[], existingTaskIds: string[], currentTaskId?: string): { invalidIds: string[] } {
  const invalidIds: string[] = [];
  for (const depId of dependsOn) {
    if (depId === currentTaskId) continue;
    if (!existingTaskIds.includes(depId)) {
      invalidIds.push(depId);
    }
  }
  return { invalidIds };
}

export function createTask(input: TaskInput): ScheduleResult {
  const existingTasks = repo.getAllTasks();
  const existingIds = existingTasks.map(t => t.id);
  
  const id = input.id || generateTempId(existingTasks);

  const depValidation = validateDependencies(input.dependsOn, existingIds, id);
  if (depValidation.invalidIds.length > 0) {
    const error = new Error(`依赖任务不存在: ${depValidation.invalidIds.join(', ')}`);
    (error as any).invalidDependencies = depValidation.invalidIds;
    throw error;
  }
  
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
  const allTasks = repo.getAllTasks();
  const existingTasks = allTasks.filter(t => t.id !== id);
  const existingIds = allTasks.map(t => t.id);
  
  const depValidation = validateDependencies(input.dependsOn, existingIds, id);
  if (depValidation.invalidIds.length > 0) {
    const error = new Error(`依赖任务不存在: ${depValidation.invalidIds.join(', ')}`);
    (error as any).invalidDependencies = depValidation.invalidIds;
    throw error;
  }
  
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

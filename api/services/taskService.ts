import * as repo from '../repositories/taskRepository';
import * as projectRepo from '../repositories/projectRepository';
import { computeSchedule, detectCycle } from './scheduler';
import type { TaskInput, ScheduleResult, ProjectHealth } from '../../shared/types';

const DEFAULT_PROJECT_ID = 'default';

export function getFullSchedule(projectId: string = DEFAULT_PROJECT_ID): ScheduleResult {
  const tasks = repo.getAllTasks(projectId);
  const config = repo.getProjectConfig();
  const project = projectRepo.getProjectById(projectId);
  return computeSchedule(tasks, config.startDate, project?.calendarId);
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

export function createTask(input: TaskInput, projectId: string = DEFAULT_PROJECT_ID): ScheduleResult {
  const existingTasks = repo.getAllTasks(projectId);
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

  const inputWithProject = { ...input, id, projectId: input.projectId || projectId };
  repo.createTask(inputWithProject);
  return getFullSchedule(projectId);
}

export function updateTask(id: string, input: TaskInput, projectId: string = DEFAULT_PROJECT_ID): ScheduleResult {
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

  const inputWithProject = { ...input, projectId: input.projectId || projectId };
  repo.updateTask(id, inputWithProject);
  return getFullSchedule(projectId);
}

export function updateTaskProgress(id: string, progress: number, projectId: string = DEFAULT_PROJECT_ID): ScheduleResult {
  repo.updateTaskProgress(id, progress);
  return getFullSchedule(projectId);
}

export function deleteTask(id: string, projectId: string = DEFAULT_PROJECT_ID): ScheduleResult {
  repo.deleteTask(id);
  return getFullSchedule(projectId);
}

export function getConfig() {
  return repo.getProjectConfig();
}

export function updateConfig(startDate: string, projectId: string = DEFAULT_PROJECT_ID): ScheduleResult {
  repo.updateProjectConfig({ startDate });
  return getFullSchedule(projectId);
}

export function getProjectHealth(projectId: string = DEFAULT_PROJECT_ID): ProjectHealth {
  const schedule = getFullSchedule(projectId);
  const project = projectRepo.getProjectById(projectId);
  const today = new Date().toISOString().split('T')[0];
  
  let completedTasks = 0;
  let overdueTasks = 0;
  let totalDelayDays = 0;
  let totalProgress = 0;
  let criticalCompleted = 0;
  let criticalTotal = 0;
  
  for (const task of schedule.tasks) {
    const progress = task.progress || 0;
    totalProgress += progress;
    
    if (progress >= 100) {
      completedTasks++;
    }
    
    if (progress < 100 && task.endDate < today) {
      overdueTasks++;
      const delayMs = new Date(today).getTime() - new Date(task.endDate).getTime();
      totalDelayDays += Math.ceil(delayMs / (1000 * 60 * 60 * 24));
    }
    
    if (task.isCritical) {
      criticalTotal++;
      if (progress >= 100) {
        criticalCompleted++;
      }
    }
  }
  
  const totalTasks = schedule.tasks.length;
  const onTimeCompletionRate = totalTasks > 0 ? (completedTasks / (completedTasks + overdueTasks) * 100) : 100;
  const averageDelayDays = overdueTasks > 0 ? totalDelayDays / overdueTasks : 0;
  const criticalPathCompletion = criticalTotal > 0 ? (criticalCompleted / criticalTotal * 100) : 100;
  const overallProgress = totalTasks > 0 ? totalProgress / totalTasks : 0;
  
  return {
    projectId,
    projectName: project?.name || '默认项目',
    onTimeCompletionRate: Math.round(onTimeCompletionRate * 100) / 100,
    averageDelayDays: Math.round(averageDelayDays * 100) / 100,
    criticalPathCompletion: Math.round(criticalPathCompletion * 100) / 100,
    totalTasks,
    completedTasks,
    overdueTasks,
    progress: Math.round(overallProgress * 100) / 100,
  };
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

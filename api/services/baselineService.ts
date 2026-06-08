import * as repo from '../repositories/baselineRepository';
import * as taskService from './taskService';
import * as calendarRepo from '../repositories/calendarRepository';
import { compareBaseline } from './scheduler';
import type { Baseline, BaselineComparison } from '../../shared/types';

const DEFAULT_PROJECT_ID = 'default';

export function getBaselines(projectId: string = DEFAULT_PROJECT_ID): Baseline[] {
  return repo.getBaselinesByProjectId(projectId);
}

export function getBaselineById(id: string): Baseline | null {
  return repo.getBaselineById(id);
}

export function createBaseline(name: string, projectId: string = DEFAULT_PROJECT_ID): Baseline {
  const schedule = taskService.getFullSchedule(projectId);
  return repo.createBaseline(projectId, name, schedule);
}

export function deleteBaseline(id: string): boolean {
  return repo.deleteBaseline(id);
}

export function getLatestBaseline(projectId: string = DEFAULT_PROJECT_ID): Baseline | null {
  const baselines = repo.getBaselinesByProjectId(projectId);
  return baselines.length > 0 ? baselines[0] : null;
}

export function getBaselineComparison(
  baselineId: string,
  projectId: string = DEFAULT_PROJECT_ID
): BaselineComparison | null {
  const baseline = repo.getBaselineById(baselineId);
  if (!baseline) return null;

  const schedule = taskService.getFullSchedule(projectId);
  const calendar = calendarRepo.getCalendarById('default');

  const comparison = compareBaseline(baseline, schedule, calendar);

  return {
    baselineId: baseline.id,
    baselineName: baseline.name,
    ...comparison,
  };
}

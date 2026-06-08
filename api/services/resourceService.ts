import * as repo from '../repositories/resourceRepository';
import type { Resource, ResourceInput } from '../../shared/types';

export function getAllResources(): Resource[] {
  return repo.getAllResources();
}

export function getResourceById(id: string): Resource | null {
  return repo.getResourceById(id);
}

export function createResource(input: ResourceInput): Resource {
  const existing = repo.getResourceByName(input.name);
  if (existing) {
    return existing;
  }
  return repo.createResource(input);
}

export function updateResource(id: string, input: ResourceInput): Resource {
  return repo.updateResource(id, input);
}

export function deleteResource(id: string): boolean {
  return repo.deleteResource(id);
}

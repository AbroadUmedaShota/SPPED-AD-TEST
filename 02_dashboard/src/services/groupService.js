import { resolveDashboardDataPath } from '../utils.js';

export async function fetchAllGroups() {
  const response = await fetch(resolveDashboardDataPath('core/groups.json'));
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  const data = await response.json();
  return Array.isArray(data) ? data : [];
}

export async function fetchGroupById(id) {
  const groups = await fetchAllGroups();
  return groups.find(group => group.id === id) ?? null;
}

import { resolveDashboardDataPath } from '../utils.js';

export async function fetchAllUsers() {
  const response = await fetch(resolveDashboardDataPath('core/users.json'));
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  const data = await response.json();
  return Array.isArray(data) ? data : [];
}

export async function fetchUserByEmail(email) {
  const users = await fetchAllUsers();
  return users.find(user => user.email === email) ?? null;
}

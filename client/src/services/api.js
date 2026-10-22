const API_BASE = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? 'https://safesignal-api-5e2y.onrender.com/api' : 'http://localhost:5000/api');

// Helper to retrieve token from localStorage if cookie is blocked in dev cross-origin
function getAuthHeader() {
  const token = localStorage.getItem('safesignal_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function submitIncidentReport(formData) {
  const res = await fetch(`${API_BASE}/reports`, {
    method: 'POST',
    body: formData // multipart/form-data
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to submit report');
  }
  return data;
}

export async function fetchSuggestions() {
  const res = await fetch(`${API_BASE}/reports/suggestions`);
  return res.json();
}

export async function fetchPublicNotice() {
  const res = await fetch(`${API_BASE}/reports/notice`);
  return res.json();
}

// Admin API
export async function adminLogin(username, password) {
  const res = await fetch(`${API_BASE}/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ username, password })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Login failed');
  if (data.token) {
    localStorage.setItem('safesignal_token', data.token);
  }
  return data;
}

export async function adminLogout() {
  try {
    await fetch(`${API_BASE}/admin/logout`, {
      method: 'POST',
      headers: { ...getAuthHeader() },
      credentials: 'include'
    });
  } finally {
    localStorage.removeItem('safesignal_token');
  }
}

export async function fetchAdminProfile() {
  const res = await fetch(`${API_BASE}/admin/me`, {
    headers: { ...getAuthHeader() },
    credentials: 'include'
  });
  if (!res.ok) throw new Error('Unauthenticated');
  return res.json();
}

export async function fetchDashboardOverview() {
  const res = await fetch(`${API_BASE}/admin/overview`, {
    headers: { ...getAuthHeader() },
    credentials: 'include'
  });
  if (!res.ok) throw new Error('Failed to load overview');
  return res.json();
}

export async function fetchAdminReports(params = {}) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') qs.append(k, v);
  });
  const res = await fetch(`${API_BASE}/admin/reports?${qs.toString()}`, {
    headers: { ...getAuthHeader() },
    credentials: 'include'
  });
  if (!res.ok) throw new Error('Failed to fetch reports');
  return res.json();
}

export async function fetchReportDetail(id) {
  const res = await fetch(`${API_BASE}/admin/reports/${id}`, {
    headers: { ...getAuthHeader() },
    credentials: 'include'
  });
  if (!res.ok) throw new Error('Failed to fetch report detail');
  return res.json();
}

export async function updateReportStatus(id, status, internal_note = '') {
  const res = await fetch(`${API_BASE}/admin/reports/${id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
    credentials: 'include',
    body: JSON.stringify({ status, internal_note })
  });
  if (!res.ok) throw new Error('Failed to update report status');
  return res.json();
}

export async function fetchAlerts() {
  const res = await fetch(`${API_BASE}/admin/alerts`, {
    headers: { ...getAuthHeader() },
    credentials: 'include'
  });
  if (!res.ok) throw new Error('Failed to fetch alerts');
  return res.json();
}

export async function updateAlertState(id, action, note = '') {
  const res = await fetch(`${API_BASE}/admin/alerts/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
    credentials: 'include',
    body: JSON.stringify({ action, note })
  });
  if (!res.ok) throw new Error('Failed to update alert');
  return res.json();
}

export async function fetchSettings() {
  const res = await fetch(`${API_BASE}/admin/settings`, {
    headers: { ...getAuthHeader() },
    credentials: 'include'
  });
  if (!res.ok) throw new Error('Failed to fetch settings');
  return res.json();
}

export async function updateSettings(settingsData) {
  const res = await fetch(`${API_BASE}/admin/settings`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
    credentials: 'include',
    body: JSON.stringify(settingsData)
  });
  if (!res.ok) throw new Error('Failed to update settings');
  return res.json();
}

export async function fetchResponders() {
  const res = await fetch(`${API_BASE}/admin/responders`, {
    headers: { ...getAuthHeader() },
    credentials: 'include'
  });
  if (!res.ok) throw new Error('Failed to fetch responder contacts');
  return res.json();
}

export async function saveResponder(responderData, id = null) {
  const url = id ? `${API_BASE}/admin/responders/${id}` : `${API_BASE}/admin/responders`;
  const method = id ? 'PUT' : 'POST';
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
    credentials: 'include',
    body: JSON.stringify(responderData)
  });
  if (!res.ok) throw new Error('Failed to save responder');
  return res.json();
}

export async function logResponderDeliberateAction(payload) {
  const res = await fetch(`${API_BASE}/admin/responders/action-log`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
    credentials: 'include',
    body: JSON.stringify(payload)
  });
  return res.json();
}

export async function fetchAuditLogs() {
  const res = await fetch(`${API_BASE}/admin/audit-logs`, {
    headers: { ...getAuthHeader() },
    credentials: 'include'
  });
  if (!res.ok) throw new Error('Failed to load audit logs');
  return res.json();
}

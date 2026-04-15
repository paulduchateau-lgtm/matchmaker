const BASE = "/api";

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  return res.json();
}

// Workspaces
export const listWorkspaces = () => request("/workspaces");
export const getWorkspace = (slug) => request(`/workspaces/${slug}`);
export const createWorkspace = (data) => request("/workspaces", { method: "POST", body: JSON.stringify(data) });
export const updateWorkspace = (id, data) => request(`/workspaces/${id}`, { method: "PUT", body: JSON.stringify(data) });
export const deleteWorkspace = (id) => request(`/workspaces/${id}`, { method: "DELETE" });

// Resources
export const listResources = (wid) => request(`/workspaces/${wid}/resources`);
export const createResource = (wid, data) => request(`/workspaces/${wid}/resources`, { method: "POST", body: JSON.stringify(data) });
export const updateResource = (wid, id, data) => request(`/workspaces/${wid}/resources/${id}`, { method: "PUT", body: JSON.stringify(data) });
export const deleteResource = (wid, id) => request(`/workspaces/${wid}/resources/${id}`, { method: "DELETE" });

// Needs
export const listNeeds = (wid) => request(`/workspaces/${wid}/needs`);
export const createNeed = (wid, data) => request(`/workspaces/${wid}/needs`, { method: "POST", body: JSON.stringify(data) });
export const updateNeed = (wid, id, data) => request(`/workspaces/${wid}/needs/${id}`, { method: "PUT", body: JSON.stringify(data) });
export const deleteNeed = (wid, id) => request(`/workspaces/${wid}/needs/${id}`, { method: "DELETE" });

// Documents
export const listDocuments = (wid) => request(`/workspaces/${wid}/documents`);
export const getDocument = (wid, id) => request(`/workspaces/${wid}/documents/${id}`);
export const deleteDocument = (wid, id) => request(`/workspaces/${wid}/documents/${id}`, { method: "DELETE" });

export async function uploadDocument(wid, file) {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${BASE}/workspaces/${wid}/documents`, { method: "POST", body: form });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  return res.json();
}

// Matches
export const listMatches = (wid, needId) => request(`/workspaces/${wid}/needs/${needId}/matches`);
export const runMatch = (wid, needId) => request(`/workspaces/${wid}/needs/${needId}/match`, { method: "POST" });

// Extract needs from document
export const extractNeeds = (wid, docId) => request(`/workspaces/${wid}/documents/${docId}/extract-needs`, { method: "POST" });

// Generate AO response
export const generateResponse = (wid, needId, data = {}) => request(`/workspaces/${wid}/needs/${needId}/generate`, { method: "POST", body: JSON.stringify(data) });

// Chat
export const getChatHistory = (wid) => request(`/workspaces/${wid}/chat`);
export const sendChatMessage = (wid, message) => request(`/workspaces/${wid}/chat`, { method: "POST", body: JSON.stringify({ message }) });
export const clearChat = (wid) => request(`/workspaces/${wid}/chat`, { method: "DELETE" });

// Stats
export const getStats = (wid) => request(`/workspaces/${wid}/stats`);

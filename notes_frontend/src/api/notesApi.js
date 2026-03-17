const DEFAULT_BASE_URL = 'http://localhost:3001';

function getBaseUrl() {
  return process.env.REACT_APP_NOTES_API_BASE_URL || DEFAULT_BASE_URL;
}

async function http(path, { method = 'GET', query, body } = {}) {
  const base = getBaseUrl();
  const url = new URL(path, base);

  if (query) {
    Object.entries(query).forEach(([k, v]) => {
      if (v === undefined || v === null || v === '') return;
      url.searchParams.set(k, String(v));
    });
  }

  const res = await fetch(url.toString(), {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const data = await res.json();
      detail = data?.detail || JSON.stringify(data);
    } catch (e) {
      // ignore parse error
    }
    const err = new Error(detail);
    err.status = res.status;
    throw err;
  }

  // 204 etc.
  if (res.status === 204) return null;
  return res.json();
}

// PUBLIC_INTERFACE
export async function listNotes({ q, tag, pinned } = {}) {
  /** List notes with optional filters. */
  return http('/notes', { query: { q, tag, pinned } });
}

// PUBLIC_INTERFACE
export async function createNote({ title, content, tags, pinned }) {
  /** Create a note. */
  return http('/notes', { method: 'POST', body: { title, content, tags, pinned } });
}

// PUBLIC_INTERFACE
export async function updateNote(id, patch) {
  /** Update a note by id with partial fields. */
  return http(`/notes/${id}`, { method: 'PUT', body: patch });
}

// PUBLIC_INTERFACE
export async function deleteNote(id) {
  /** Delete a note by id. */
  return http(`/notes/${id}`, { method: 'DELETE' });
}

// PUBLIC_INTERFACE
export async function listTags() {
  /** List distinct tags. */
  return http('/tags');
}

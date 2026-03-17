import React, { useEffect, useMemo, useState } from 'react';
import './App.css';
import { createNote, deleteNote, listNotes, listTags, updateNote } from './api/notesApi';

function formatDateTime(isoOrDate) {
  try {
    const d = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate;
    return new Intl.DateTimeFormat(undefined, {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
  } catch (e) {
    return String(isoOrDate || '');
  }
}

function normalizeTagInput(value) {
  const raw = (value || '').trim();
  if (!raw) return [];
  // Accept comma-separated tags
  return raw
    .split(',')
    .map(t => t.trim())
    .filter(Boolean);
}

// PUBLIC_INTERFACE
function App() {
  /** Notes application (single-user) consuming the Notes Backend REST API. */

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [notes, setNotes] = useState([]);
  const [selectedId, setSelectedId] = useState(null);

  const [q, setQ] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [pinnedOnly, setPinnedOnly] = useState(false);

  const [tags, setTags] = useState([]);

  // Editor state (local, saved explicitly)
  const selectedNote = useMemo(() => notes.find(n => n.id === selectedId) || null, [notes, selectedId]);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftTags, setDraftTags] = useState('');
  const [draftPinned, setDraftPinned] = useState(false);
  const [draftContent, setDraftContent] = useState('');

  const hasUnsavedChanges = useMemo(() => {
    if (!selectedNote) return false;
    const currentTags = (selectedNote.tags || []).join(', ');
    return (
      draftTitle !== selectedNote.title ||
      draftContent !== selectedNote.content ||
      draftPinned !== selectedNote.pinned ||
      draftTags !== currentTags
    );
  }, [selectedNote, draftTitle, draftContent, draftPinned, draftTags]);

  async function refresh({ keepSelection = true } = {}) {
    setLoading(true);
    setError('');
    try {
      const data = await listNotes({
        q: q || undefined,
        tag: tagFilter || undefined,
        pinned: pinnedOnly ? true : undefined,
      });
      setNotes(data.notes || []);
      if (!keepSelection) setSelectedId(null);

      const tagData = await listTags();
      setTags(tagData.tags || []);
    } catch (e) {
      setError(e.message || 'Failed to load notes');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh({ keepSelection: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, tagFilter, pinnedOnly]);

  useEffect(() => {
    if (!selectedNote) {
      setDraftTitle('');
      setDraftTags('');
      setDraftPinned(false);
      setDraftContent('');
      return;
    }
    setDraftTitle(selectedNote.title || '');
    setDraftTags((selectedNote.tags || []).join(', '));
    setDraftPinned(Boolean(selectedNote.pinned));
    setDraftContent(selectedNote.content || '');
  }, [selectedNote]);

  async function onCreateNew() {
    setLoading(true);
    setError('');
    try {
      const created = await createNote({
        title: 'Untitled',
        content: '',
        tags: [],
        pinned: false,
      });
      // Refresh with new selection
      await refresh({ keepSelection: true });
      setSelectedId(created.id);
    } catch (e) {
      setError(e.message || 'Failed to create note');
    } finally {
      setLoading(false);
    }
  }

  async function onSave() {
    if (!selectedNote) return;
    setLoading(true);
    setError('');
    try {
      const updated = await updateNote(selectedNote.id, {
        title: draftTitle,
        content: draftContent,
        pinned: draftPinned,
        tags: normalizeTagInput(draftTags),
      });

      // Replace in local list for snappy UI
      setNotes(prev => prev.map(n => (n.id === updated.id ? updated : n)));
      // tags list might have changed
      const tagData = await listTags();
      setTags(tagData.tags || []);
    } catch (e) {
      setError(e.message || 'Failed to save note');
    } finally {
      setLoading(false);
    }
  }

  async function onDeleteSelected() {
    if (!selectedNote) return;
    // eslint-disable-next-line no-restricted-globals
    const ok = window.confirm(`Delete note "${selectedNote.title}"?`);
    if (!ok) return;

    setLoading(true);
    setError('');
    try {
      await deleteNote(selectedNote.id);
      setSelectedId(null);
      await refresh({ keepSelection: false });
    } catch (e) {
      setError(e.message || 'Failed to delete note');
    } finally {
      setLoading(false);
    }
  }

  async function onTogglePinFromList(note) {
    setLoading(true);
    setError('');
    try {
      const updated = await updateNote(note.id, { pinned: !note.pinned });
      setNotes(prev => prev.map(n => (n.id === updated.id ? updated : n)));
    } catch (e) {
      setError(e.message || 'Failed to update pin');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="NotesApp">
      <header className="TopBar">
        <div className="TopBarLeft">
          <div className="Brand">Notes</div>
          <div className="SearchWrap">
            <label className="SrOnly" htmlFor="searchInput">
              Search notes
            </label>
            <input
              id="searchInput"
              className="SearchInput"
              placeholder="Search title or content…"
              value={q}
              onChange={e => setQ(e.target.value)}
            />
          </div>

          <label className="PinFilter">
            <input type="checkbox" checked={pinnedOnly} onChange={e => setPinnedOnly(e.target.checked)} />
            Pinned
          </label>
        </div>

        <div className="TopBarRight">
          <button className="PrimaryBtn" onClick={onCreateNew} disabled={loading}>
            New note
          </button>
          <div className="ApiHint">
            API: <code>{process.env.REACT_APP_NOTES_API_BASE_URL || 'http://localhost:3001'}</code>
          </div>
        </div>
      </header>

      <div className="Main">
        <aside className="Sidebar">
          <div className="SidebarHeader">Tags</div>
          <button className={`TagChip ${tagFilter === '' ? 'Active' : ''}`} onClick={() => setTagFilter('')}>
            All
          </button>
          {tags.map(t => (
            <button
              key={t}
              className={`TagChip ${tagFilter === t ? 'Active' : ''}`}
              onClick={() => setTagFilter(t)}
              title={`Filter by tag: ${t}`}
            >
              {t}
            </button>
          ))}
        </aside>

        <section className="ListPane">
          <div className="PaneHeader">
            <div className="PaneTitle">Notes</div>
            <div className="PaneMeta">{loading ? 'Loading…' : `${notes.length} shown`}</div>
          </div>

          {error ? <div className="ErrorBanner">{error}</div> : null}

          <div className="NotesList" role="list">
            {notes.map(n => (
              <button
                key={n.id}
                className={`NoteRow ${selectedId === n.id ? 'Selected' : ''}`}
                onClick={() => setSelectedId(n.id)}
                role="listitem"
                title={n.title}
              >
                <div className="NoteRowTop">
                  <div className="NoteRowTitle">
                    {n.pinned ? <span className="Pin">📌</span> : null}
                    {n.title || 'Untitled'}
                  </div>
                  <button
                    className="PinBtn"
                    type="button"
                    onClick={e => {
                      e.preventDefault();
                      e.stopPropagation();
                      onTogglePinFromList(n);
                    }}
                    aria-label={n.pinned ? 'Unpin note' : 'Pin note'}
                    title={n.pinned ? 'Unpin' : 'Pin'}
                    disabled={loading}
                  >
                    {n.pinned ? 'Unpin' : 'Pin'}
                  </button>
                </div>
                <div className="NoteRowPreview">{(n.content || '').slice(0, 120) || '—'}</div>
                <div className="NoteRowMeta">
                  <span>{formatDateTime(n.updated_at)}</span>
                  <span className="Dot">·</span>
                  <span className="TagsInline">{(n.tags || []).slice(0, 3).map(t => `#${t}`).join(' ')}</span>
                </div>
              </button>
            ))}
            {notes.length === 0 && !loading ? <div className="EmptyState">No notes match your filters.</div> : null}
          </div>
        </section>

        <section className="EditorPane">
          <div className="PaneHeader">
            <div className="PaneTitle">Editor</div>
            {selectedNote ? (
              <div className="PaneMeta">
                Created {formatDateTime(selectedNote.created_at)} · Updated {formatDateTime(selectedNote.updated_at)}
              </div>
            ) : (
              <div className="PaneMeta">Select a note to edit</div>
            )}
          </div>

          {selectedNote ? (
            <div className="Editor">
              <div className="EditorRow">
                <label className="FieldLabel" htmlFor="titleInput">
                  Title
                </label>
                <input
                  id="titleInput"
                  className="TextInput"
                  value={draftTitle}
                  onChange={e => setDraftTitle(e.target.value)}
                  placeholder="Title"
                />
              </div>

              <div className="EditorRow EditorRowTwo">
                <div className="EditorCol">
                  <label className="FieldLabel" htmlFor="tagsInput">
                    Tags
                  </label>
                  <input
                    id="tagsInput"
                    className="TextInput"
                    value={draftTags}
                    onChange={e => setDraftTags(e.target.value)}
                    placeholder="Comma-separated tags (e.g. work, ideas)"
                  />
                </div>

                <label className="PinToggle">
                  <input type="checkbox" checked={draftPinned} onChange={e => setDraftPinned(e.target.checked)} />
                  Pinned
                </label>
              </div>

              <div className="EditorRow">
                <label className="FieldLabel" htmlFor="contentInput">
                  Content (plain text)
                </label>
                <textarea
                  id="contentInput"
                  className="TextArea"
                  value={draftContent}
                  onChange={e => setDraftContent(e.target.value)}
                  placeholder="Write your note…"
                  spellCheck
                />
              </div>

              <div className="EditorActions">
                <button className="PrimaryBtn" onClick={onSave} disabled={loading || !hasUnsavedChanges}>
                  Save
                </button>
                <button className="DangerBtn" onClick={onDeleteSelected} disabled={loading}>
                  Delete
                </button>
                {hasUnsavedChanges ? <div className="Unsaved">Unsaved changes</div> : <div className="Unsaved Ok">Saved</div>}
              </div>
            </div>
          ) : (
            <div className="EmptyEditor">
              <div className="EmptyEditorTitle">No note selected</div>
              <div className="EmptyEditorBody">Create a new note or select one from the list to start editing.</div>
              <button className="PrimaryBtn" onClick={onCreateNew} disabled={loading}>
                New note
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

export default App;

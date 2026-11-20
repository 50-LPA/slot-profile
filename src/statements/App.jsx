import { useCallback, useEffect, useRef, useState } from 'react';
import Dashboard from './components/Dashboard.jsx';
import Editor from './components/Editor.jsx';
import { isPersistent, loadAll, saveAll } from './lib/storage.js';
import { statementTitle } from './lib/model.js';
import { go, parseHash } from './route.js';
import { Page } from '../ui.jsx';
import './styles.css';

export default function App() {
  const [list, setList] = useState(loadAll);
  const [route, setRoute] = useState(() => parseHash());
  const [savedAt, setSavedAt] = useState(null);
  const listRef = useRef(list);
  listRef.current = list;

  useEffect(() => {
    const onHash = () => setRoute(parseHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  // Autosave (debounced) on every change using idle execution, plus a final flush on pagehide.
  const loaded = useRef(false);
  useEffect(() => {
    if (!loaded.current) { loaded.current = true; return; }
    const timer = setTimeout(() => {
      const scheduleIdle = typeof window.requestIdleCallback === 'function'
        ? window.requestIdleCallback
        : cb => setTimeout(cb, 1);

      scheduleIdle(() => {
        saveAll(list);
        setSavedAt(new Date());
      });
    }, 500);

    return () => clearTimeout(timer);
  }, [list]);
  useEffect(() => {
    const flush = () => saveAll(listRef.current);
    window.addEventListener('pagehide', flush);
    return () => window.removeEventListener('pagehide', flush);
  }, []);

  const upsert = useCallback(st => {
    const next = { ...st, updatedAt: Date.now() };
    setList(l => (l.some(x => x.id === st.id) ? l.map(x => (x.id === st.id ? next : x)) : [next, ...l]));
  }, []);
  const remove = useCallback(id => setList(l => l.filter(x => x.id !== id)), []);

  const current = route.id ? list.find(s => s.id === route.id) : null;
  useEffect(() => {
    if (route.id && !current) go(null); // unknown or deleted statement
  }, [route.id, current]);

  const crumbs = current
    ? [['Statements', '#/statements'], [statementTitle(current) || 'Statement']]
    : [['Statements']];

  return (
    <Page crumbs={crumbs}>
      <div className="statement-root">
        {current ? (
          <Editor key={current.id} statement={current} onChange={upsert} savedAt={savedAt} persistent={isPersistent()} onBack={() => go(null)} />
        ) : (
          <Dashboard list={list} onSave={upsert} onDelete={remove} persistent={isPersistent()} />
        )}
      </div>
    </Page>
  );
}

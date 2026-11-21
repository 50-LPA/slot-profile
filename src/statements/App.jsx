import { useCallback, useState } from 'react';
import Editor from './components/Editor.jsx';
import { demoStatement } from './lib/demo.js';
import { loadAll, saveAll } from './lib/storage.js';
import { Page } from '../ui.jsx';
import './styles.css';

export default function App() {
  // Directly opens the statement editor with active in-memory statement (demo by default).
  const [statement, setStatement] = useState(() => loadAll()[0] || demoStatement());
  const [savedAt, setSavedAt] = useState(null);

  const handleChange = useCallback(st => {
    const next = { ...st, updatedAt: Date.now() };
    setStatement(next);
    saveAll([next]);
    setSavedAt(new Date());
  }, []);

  return (
    <Page crumbs={[['Statements']]}>
      <div className="statement-root">
        <Editor
          statement={statement}
          onChange={handleChange}
          savedAt={savedAt}
          onBack={null}
        />
      </div>
    </Page>
  );
}

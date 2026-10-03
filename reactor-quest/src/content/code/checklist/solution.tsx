import { useState, type SubmitEvent } from 'react';

export interface Task {
  id: number;
  label: string;
  done: boolean;
}

export function Checklist({ initial = [] }: { initial?: string[] }) {
  const [tasks, setTasks] = useState<Task[]>(() => initial.map((label, i) => ({ id: i + 1, label, done: false })));
  const [text, setText] = useState('');

  const doneCount = tasks.filter((t) => t.done).length;
  const allDone = tasks.length > 0 && doneCount === tasks.length;

  function add(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const label = text.trim();
    if (!label) return;
    const id = Math.max(0, ...tasks.map((t) => t.id)) + 1;
    setTasks([...tasks, { id, label, done: false }]);
    setText('');
  }

  function toggle(id: number) {
    setTasks(tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
  }

  return (
    <div className="checklist">
      <form onSubmit={add}>
        <input aria-label="New task" value={text} onChange={(e) => setText(e.target.value)} />
        <button type="submit">Add</button>
      </form>
      <ul>
        {tasks.map((t) => (
          <li key={t.id} className={t.done ? 'done' : undefined}>
            <label>
              <input type="checkbox" checked={t.done} onChange={() => toggle(t.id)} /> {t.label}
            </label>
          </li>
        ))}
      </ul>
      <p className="progress">
        {doneCount}/{tasks.length} complete
      </p>
      <button disabled={doneCount === 0} onClick={() => setTasks(tasks.filter((t) => !t.done))}>
        Clear completed
      </button>
      {allDone && <p className="go">All systems go</p>}
    </div>
  );
}

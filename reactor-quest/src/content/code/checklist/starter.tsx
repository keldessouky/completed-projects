// BOSS — the launch checklist.
import { useState } from 'react';

export interface Task {
  id: number;
  label: string;
  done: boolean;
}

// • Starts with one task per string in `initial` (ids 1, 2, 3…), none done.
// • <form> with <input aria-label="New task" /> and <button type="submit">Add</button>:
//     adds the trimmed label (blank is ignored) and clears the input. No page reloads!
// • <ul> with one <li> per task:
//     <li className="done" (or no class)><label><input type="checkbox" /> {label}</label></li>
//     ticking the checkbox toggles that task.
// • <p className="progress">1/3 complete</p>
// • <button>Clear completed</button> removes finished tasks; disabled when none are finished.
// • When there is at least one task and every task is done: <p className="go">All systems go</p>
export function Checklist({ initial = [] }: { initial?: string[] }) {
  // TODO
}

import type { ReactNode } from 'react';

// A Panel draws a framed section with a title, and whatever is placed
// between <Panel> and </Panel> inside it:
//   <section className="panel"><h2>{title}</h2> …children… </section>
export function Panel({ title }: { title: string }) {
  return (
    <section className="panel">
      <h2>{title}</h2>
    </section>
  );
}

// The dashboard: a "Power" panel containing <p>98%</p>,
// and an "Air" panel containing <p>Nominal</p>.
export function Dashboard() {
  return <div className="dashboard">{/* TODO */}</div>;
}

---
applyTo: "src/web/**"
---

<!--
  destination: .github/instructions/frontend.instructions.md

  Path-scoped rules: injected only when the agent is working on files matching
  the applyTo glob. Use these to keep area-specific conventions out of the
  always-on AGENTS.md (React rules shouldn't tax every backend task).
  One file per area: frontend, api, tests, infra. Keep each under ~50 lines.
  Comma-separate multiple globs if needed, e.g. "src/web/**,ui/**".
-->

# Frontend rules (src/web)

- React function components + hooks only. No class components.
- Styling via CSS Modules. No inline styles, no styled-components.
- Server state: TanStack Query. Client state: Zustand. Do not add Redux.
- Component layout: `src/web/components/<Name>/` containing `index.tsx`, `<Name>.module.css`, `<Name>.test.tsx`.
- Interactive elements need keyboard support and accessible names. Run `pnpm test:a11y` after UI changes.

Data fetching:

```tsx
// Good — through the query layer
const { data } = useQuery({
  queryKey: ["order", id],
  queryFn: () => api.orders.get(id),
});

// Bad — raw fetch in components bypasses caching, retries, and auth headers
useEffect(() => {
  fetch(`/api/orders/${id}`).then(/* ... */);
}, [id]);
```

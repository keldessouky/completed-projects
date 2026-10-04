import { useRef, useState, type SubmitEvent } from 'react';

type Field = 'callsign' | 'email';

function validate(values: Record<Field, string>): Partial<Record<Field, string>> {
  const errors: Partial<Record<Field, string>> = {};
  const length = values.callsign.trim().length;
  if (length < 3 || length > 12) errors.callsign = 'Callsign must be 3–12 characters';
  if (!values.email.includes('@')) errors.email = 'Enter a valid email';
  return errors;
}

export function RegisterForm({ onRegister }: { onRegister: (data: { callsign: string; email: string }) => void }) {
  const [values, setValues] = useState<Record<Field, string>>({ callsign: '', email: '' });
  const [touched, setTouched] = useState<Record<Field, boolean>>({ callsign: false, email: false });
  const refs = { callsign: useRef<HTMLInputElement>(null), email: useRef<HTMLInputElement>(null) };
  const errors = validate(values);

  function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setTouched({ callsign: true, email: true });
    const firstInvalid = (['callsign', 'email'] as const).find((f) => errors[f]);
    if (firstInvalid) {
      refs[firstInvalid].current?.focus();
      return;
    }
    onRegister({ callsign: values.callsign.trim(), email: values.email.trim() });
  }

  const field = (name: Field, label: string, type: string) => {
    const error = touched[name] ? errors[name] : undefined;
    return (
      <div>
        <label htmlFor={name}>{label}</label>
        <input
          id={name}
          ref={refs[name]}
          type={type}
          value={values[name]}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${name}-error` : undefined}
          onChange={(e) => setValues((v) => ({ ...v, [name]: e.target.value }))}
          onBlur={() => setTouched((t) => ({ ...t, [name]: true }))}
        />
        {error && <p id={`${name}-error`}>{error}</p>}
      </div>
    );
  };

  return (
    <form onSubmit={submit} noValidate>
      {field('callsign', 'Callsign', 'text')}
      {field('email', 'Email', 'email')}
      <button type="submit">Register</button>
    </form>
  );
}

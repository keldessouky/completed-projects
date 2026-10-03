import { useRef, useState, type SubmitEvent } from 'react';

// A registration form that works for everyone — including people using a
// screen reader or only a keyboard.
//
// Fields (each with a real <label> connected by htmlFor/id):
//   Callsign   id="callsign"   required, 3–12 characters
//   Email      id="email"      must contain "@"
//
// Errors:
//   - show a field's error after the user leaves it (blur), or on submit
//   - the error is <p id="callsign-error"> / <p id="email-error"> with the message
//   - the input gets aria-invalid="true" and aria-describedby pointing at its error
// Messages: "Callsign must be 3–12 characters"  and  "Enter a valid email"
//
// On submit:
//   - invalid → show all errors and move keyboard focus to the FIRST invalid field
//   - valid   → onRegister({ callsign, email })

export function RegisterForm({ onRegister }: { onRegister: (data: { callsign: string; email: string }) => void }) {
  const [callsign, setCallsign] = useState('');
  const [email, setEmail] = useState('');

  function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    onRegister({ callsign, email });
  }

  return (
    <form onSubmit={submit} noValidate>
      <p>Callsign</p>
      <input value={callsign} onChange={(e) => setCallsign(e.target.value)} />
      <p>Email</p>
      <input value={email} onChange={(e) => setEmail(e.target.value)} />
      <button type="submit">Register</button>
    </form>
  );
}

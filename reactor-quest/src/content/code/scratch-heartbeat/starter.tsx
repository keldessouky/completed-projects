// FROM A BLANK FILE. Export a custom hook and a component.
//
// useTicker(ms, running)
//   returns a number that starts at 0 and goes up by 1 every `ms` milliseconds
//   while `running` is true. Pausing keeps the count where it is.
//   It must never leave a timer running: not while paused, not after unmount.
//
// Heartbeat   props: ms (number)
//   <p className="beats">Beats: 3</p>
//   <button>Pause</button>   (it says "Resume" while paused, and starts it again)

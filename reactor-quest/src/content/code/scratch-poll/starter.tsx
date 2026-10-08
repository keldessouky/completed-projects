// FROM A BLANK FILE. Export a component called Poll.
// Props: question (string) and options (an array of strings).
//
//   <h3>{question}</h3>
//   one <button> per option, labelled with the option: clicking it adds a vote
//   <p className="tally">Kite 2 · Gull 1 · Wren 0</p>
//        every option with its votes, in order, separated by " · "
//   <p className="leader">…</p>
//        "No votes yet" before any votes, "Leading: Kite" when one option has
//        the most votes, or "Tied" when two or more share the most
//   <button>Reset</button>   sets every count back to 0

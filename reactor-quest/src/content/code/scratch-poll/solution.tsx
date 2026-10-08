import { useState } from 'react';

export function Poll({ question, options }: { question: string; options: string[] }) {
  const [votes, setVotes] = useState<number[]>(() => options.map(() => 0));

  const most = Math.max(0, ...votes);
  const leaders = options.filter((_, i) => votes[i] === most);
  const leader = most === 0 ? 'No votes yet' : leaders.length > 1 ? 'Tied' : `Leading: ${leaders[0]}`;

  return (
    <div className="poll">
      <h3>{question}</h3>
      {options.map((option, i) => (
        <button key={option} onClick={() => setVotes(votes.map((v, j) => (j === i ? v + 1 : v)))}>
          {option}
        </button>
      ))}
      <p className="tally">{options.map((option, i) => `${option} ${votes[i]}`).join(' · ')}</p>
      <p className="leader">{leader}</p>
      <button onClick={() => setVotes(options.map(() => 0))}>Reset</button>
    </div>
  );
}

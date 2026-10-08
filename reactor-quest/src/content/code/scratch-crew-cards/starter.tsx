// FROM A BLANK FILE. Export two components.
//
// CrewCard   props: name (string), role (string), onDuty (boolean)
//   <article className="crew-card">
//     <h3>{name}</h3>
//     <p>{role}</p>
//     <span className="badge">On duty</span>   ← only when on duty
//   </article>
//
// CrewList   props: crew (an array of { name, role, onDuty })
//   no crew   → <p className="empty">No crew aboard</p>
//   otherwise → a <ul> with one <li> per crew member, each holding a CrewCard,
//               then <p className="count">2 on duty</p>  (how many are on duty)

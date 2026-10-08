// FROM A BLANK FILE. Export a component called StationSearch.
// Props: search(query: string) → Promise<string[]>, which asks the server.
//
//   <label htmlFor="station-query">Search stations</label> and its input
//   While the input is empty:  no request, and nothing else on screen
//   While a request is out:    <p className="status">Searching…</p>
//   Results:                   a <ul> with one <li> per station
//   No results:                <p className="status">No stations match</p>
//   A failed request:          <p role="alert">Search failed: {the error's message}</p>
//   An answer to an older query must never replace the answer to a newer one.

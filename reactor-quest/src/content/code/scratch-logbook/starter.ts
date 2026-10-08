// FROM A BLANK FILE. Just the spec.
//
// Export a class called Logbook. Each logbook keeps its own entries.
//
//   new Logbook()       starts empty
//   log.add(text)       adds an entry and returns how many entries there are now.
//                       Spaces around the text are trimmed off. An empty (or
//                       all-spaces) entry throws an Error with the message
//                       "Entry can't be empty", and isn't added.
//   log.latest(n)       the n most recent entries, newest first
//                       (fewer, if there aren't that many yet)
//   log.search(word)    every entry containing that word, ignoring upper and
//                       lower case, oldest first

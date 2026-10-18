// The short title shown for a board. Pure functions, no imports.
// `project.name` keeps the user's own sentence; `project.title` is an optional short label.

export const MAX_TITLE = 40;

const FILLER = /^(?:i want to|i['’]d like to|i would like to|we want to|let['’]?s)\s+(?:build|make|create|add|write|implement)\s+/i;
const ARTICLE = /^(?:a|an|the)\s+/i;

// A short label from a long sentence: drops "I want to build", a leading article and the final stop,
// and cuts at a word so the result (with its ellipsis) is at most 40 characters.
export function shortName(name) {
  const full = String(name ?? '').replace(/\s+/g, ' ').trim();
  let s = full.replace(FILLER, '').replace(ARTICLE, '').replace(/[.!?]+$/, '').trim();
  if (!s) s = full;
  if (s.length > MAX_TITLE) {
    const room = MAX_TITLE - 1;
    let cut = s.slice(0, room);
    if (s[room] !== ' ') {
      const i = cut.lastIndexOf(' ');
      if (i > 0) cut = cut.slice(0, i);
    }
    s = `${cut.trimEnd()}…`;
  }
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// The title to show: the set one, or a trimmed version of the name.
export const shownTitle = (project) => project.title || shortName(project.name);

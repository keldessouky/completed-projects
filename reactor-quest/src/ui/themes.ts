// Colour profiles: the station's original look plus sixteen others modelled
// on the best-loved VS Code and IntelliJ themes. Each one is a set of CSS
// custom properties applied to <html>; the stylesheet derives everything else
// (gradients, glows, tints) from these, so a profile recolours the whole game,
// syntax highlighting included.
import { useSyncExternalStore } from 'react';

export interface Palette {
  /** Page background, and the slightly darker wells inside panels. */
  bg: string;
  bg2: string;
  /** Panel surfaces, and raised controls on them. */
  panel: string;
  panel2: string;
  line: string;
  text: string;
  muted: string;
  /** The theme's signature colour: links, focus, primary buttons, progress. */
  accent: string;
  /** Text on an accent-coloured button. */
  onAccent: string;
  /** Rewards, stars and warnings. */
  gold: string;
  green: string;
  red: string;
  violet: string;
  editor: string;
  gutter: string;
  syntax: {
    keyword: string;
    string: string;
    number: string;
    comment: string;
    type: string;
    fn: string;
    prop: string;
    variable: string;
    tag: string;
    attr: string;
    op: string;
  };
}

export interface Theme {
  id: string;
  name: string;
  /** Where the original lives. */
  from: 'VS Code' | 'IntelliJ' | 'VS Code · IntelliJ' | 'Reactor';
  blurb: string;
  scheme: 'dark' | 'light';
  /** Neon text glow, for themes that are all about the glow. */
  glow?: boolean;
  palette: Palette;
}

export const DEFAULT_THEME = 'reactor';

export const THEMES: Theme[] = [
  {
    id: 'reactor',
    name: 'Reactor',
    from: 'Reactor',
    blurb: "The station's own colours: cool blue, warm amber.",
    scheme: 'dark',
    palette: {
      bg: '#070b16', bg2: '#0c1324', panel: '#111a2f', panel2: '#16213b', line: '#22304f', text: '#dbe5f7', muted: '#8a9abb',
      accent: '#4fd1ff', onAccent: '#031018', gold: '#ffb347', green: '#4ade80', red: '#f87171', violet: '#b794f6',
      editor: '#0a1122', gutter: '#4a5a7d',
      syntax: { keyword: '#c792ea', string: '#c3e88d', number: '#f78c6c', comment: '#5c6f94', type: '#ffcb6b', fn: '#82aaff', prop: '#82aaff', variable: '#dbe5f7', tag: '#f07178', attr: '#ffcb6b', op: '#89ddff' },
    },
  },
  {
    id: 'dracula',
    name: 'Dracula',
    from: 'VS Code · IntelliJ',
    blurb: 'Hot pink and electric purple on a vampire-grey night.',
    scheme: 'dark',
    palette: {
      bg: '#21222c', bg2: '#191a21', panel: '#282a36', panel2: '#343746', line: '#44475a', text: '#f8f8f2', muted: '#a4abd0',
      accent: '#ff79c6', onAccent: '#21222c', gold: '#ffb86c', green: '#50fa7b', red: '#ff5555', violet: '#bd93f9',
      editor: '#282a36', gutter: '#6272a4',
      syntax: { keyword: '#ff79c6', string: '#f1fa8c', number: '#bd93f9', comment: '#7282b4', type: '#8be9fd', fn: '#50fa7b', prop: '#ffb86c', variable: '#f8f8f2', tag: '#ff79c6', attr: '#50fa7b', op: '#ff79c6' },
    },
  },
  {
    id: 'one-dark-pro',
    name: 'One Dark Pro',
    from: 'VS Code',
    blurb: "Atom's classic: calm slate, soft blue, nothing shouting.",
    scheme: 'dark',
    palette: {
      bg: '#21252b', bg2: '#1b1f23', panel: '#282c34', panel2: '#2f343e', line: '#3e4451', text: '#abb2bf', muted: '#9199a6',
      accent: '#61afef', onAccent: '#14171c', gold: '#e5c07b', green: '#98c379', red: '#e06c75', violet: '#c678dd',
      editor: '#282c34', gutter: '#636d83',
      syntax: { keyword: '#c678dd', string: '#98c379', number: '#d19a66', comment: '#7f848e', type: '#e5c07b', fn: '#61afef', prop: '#e06c75', variable: '#abb2bf', tag: '#e06c75', attr: '#d19a66', op: '#56b6c2' },
    },
  },
  {
    id: 'tokyo-night',
    name: 'Tokyo Night',
    from: 'VS Code',
    blurb: 'Neon signs reflected in a midnight street.',
    scheme: 'dark',
    palette: {
      bg: '#16161e', bg2: '#111118', panel: '#1a1b26', panel2: '#222436', line: '#2f334d', text: '#c0caf5', muted: '#7f88b5',
      accent: '#bb9af7', onAccent: '#16161e', gold: '#e0af68', green: '#9ece6a', red: '#f7768e', violet: '#7aa2f7',
      editor: '#1a1b26', gutter: '#545c7e',
      syntax: { keyword: '#bb9af7', string: '#9ece6a', number: '#ff9e64', comment: '#636da6', type: '#2ac3de', fn: '#7aa2f7', prop: '#73daca', variable: '#c0caf5', tag: '#f7768e', attr: '#bb9af7', op: '#89ddff' },
    },
  },
  {
    id: 'catppuccin-mocha',
    name: 'Catppuccin Mocha',
    from: 'VS Code · IntelliJ',
    blurb: 'Soothing pastels on a warm, dark mocha.',
    scheme: 'dark',
    palette: {
      bg: '#181825', bg2: '#11111b', panel: '#1e1e2e', panel2: '#313244', line: '#45475a', text: '#cdd6f4', muted: '#a6adc8',
      accent: '#fab387', onAccent: '#1e1e2e', gold: '#f9e2af', green: '#a6e3a1', red: '#f38ba8', violet: '#cba6f7',
      editor: '#1e1e2e', gutter: '#6c7086',
      syntax: { keyword: '#cba6f7', string: '#a6e3a1', number: '#fab387', comment: '#7f849c', type: '#f9e2af', fn: '#89b4fa', prop: '#b4befe', variable: '#cdd6f4', tag: '#89b4fa', attr: '#f9e2af', op: '#94e2d5' },
    },
  },
  {
    id: 'nord',
    name: 'Nord',
    from: 'VS Code · IntelliJ',
    blurb: 'Arctic frost and polar night. Very calm. Very Scandinavian.',
    scheme: 'dark',
    palette: {
      bg: '#2e3440', bg2: '#292e39', panel: '#3b4252', panel2: '#434c5e', line: '#4c566a', text: '#eceff4', muted: '#b0bacb',
      accent: '#88c0d0', onAccent: '#2e3440', gold: '#ebcb8b', green: '#a3be8c', red: '#e5838b', violet: '#b48ead',
      editor: '#2e3440', gutter: '#616e88',
      syntax: { keyword: '#81a1c1', string: '#a3be8c', number: '#b48ead', comment: '#8390a8', type: '#8fbcbb', fn: '#88c0d0', prop: '#d8dee9', variable: '#d8dee9', tag: '#81a1c1', attr: '#8fbcbb', op: '#81a1c1' },
    },
  },
  {
    id: 'gruvbox-dark',
    name: 'Gruvbox Dark',
    from: 'VS Code · IntelliJ',
    blurb: 'Retro groove: earthy browns, toasted yellows, burnt orange.',
    scheme: 'dark',
    palette: {
      bg: '#1d2021', bg2: '#171a1a', panel: '#282828', panel2: '#32302f', line: '#504945', text: '#ebdbb2', muted: '#a89984',
      accent: '#fabd2f', onAccent: '#282828', gold: '#fe8019', green: '#b8bb26', red: '#fb4934', violet: '#d3869b',
      editor: '#282828', gutter: '#7c6f64',
      syntax: { keyword: '#fb4934', string: '#b8bb26', number: '#d3869b', comment: '#928374', type: '#fabd2f', fn: '#8ec07c', prop: '#83a598', variable: '#ebdbb2', tag: '#fe8019', attr: '#fabd2f', op: '#fe8019' },
    },
  },
  {
    id: 'monokai-pro',
    name: 'Monokai Pro',
    from: 'VS Code · IntelliJ',
    blurb: 'The classic Monokai, refined: lime, pink and lemon on charcoal.',
    scheme: 'dark',
    palette: {
      bg: '#221f22', bg2: '#19181a', panel: '#2d2a2e', panel2: '#383539', line: '#4a474b', text: '#fcfcfa', muted: '#a9a7a9',
      accent: '#a9dc76', onAccent: '#221f22', gold: '#ffd866', green: '#a9dc76', red: '#ff6188', violet: '#ab9df2',
      editor: '#2d2a2e', gutter: '#6b696b',
      syntax: { keyword: '#ff6188', string: '#ffd866', number: '#ab9df2', comment: '#848284', type: '#78dce8', fn: '#a9dc76', prop: '#fc9867', variable: '#fcfcfa', tag: '#ff6188', attr: '#78dce8', op: '#ff6188' },
    },
  },
  {
    id: 'night-owl',
    name: 'Night Owl',
    from: 'VS Code',
    blurb: 'Made for coding at 2 a.m.: deep ocean blue, sea-glass teal.',
    scheme: 'dark',
    palette: {
      bg: '#011627', bg2: '#010e1a', panel: '#0b2942', panel2: '#13344f', line: '#1d3b53', text: '#d6deeb', muted: '#8ba3bd',
      accent: '#7fdbca', onAccent: '#011627', gold: '#ecc48d', green: '#addb67', red: '#ef5350', violet: '#c792ea',
      editor: '#011627', gutter: '#4b6479',
      syntax: { keyword: '#c792ea', string: '#ecc48d', number: '#f78c6c', comment: '#7a9292', type: '#ffcb8b', fn: '#82aaff', prop: '#7fdbca', variable: '#d6deeb', tag: '#caece6', attr: '#addb67', op: '#7fdbca' },
    },
  },
  {
    id: 'synthwave-84',
    name: "SynthWave '84",
    from: 'VS Code',
    blurb: 'Neon on a purple horizon. Yes, the code glows.',
    scheme: 'dark',
    glow: true,
    palette: {
      bg: '#1e1830', bg2: '#171226', panel: '#262335', panel2: '#34294f', line: '#463465', text: '#f4eee4', muted: '#a8a2c8',
      accent: '#36f9f6', onAccent: '#1e1830', gold: '#fede5d', green: '#72f1b8', red: '#fe4450', violet: '#ff7edb',
      editor: '#262335', gutter: '#6d77b3',
      syntax: { keyword: '#fede5d', string: '#ff8b39', number: '#f97e72', comment: '#8a91c4', type: '#fe4450', fn: '#36f9f6', prop: '#ff7edb', variable: '#f4eee4', tag: '#72f1b8', attr: '#fede5d', op: '#f97e72' },
    },
  },
  {
    id: 'cobalt2',
    name: 'Cobalt2',
    from: 'VS Code',
    blurb: "Wes Bos's punchy yellow-on-cobalt. Impossible to ignore.",
    scheme: 'dark',
    palette: {
      bg: '#15232d', bg2: '#0f1c25', panel: '#193549', panel2: '#1f4662', line: '#2a5576', text: '#ffffff', muted: '#a3bed4',
      accent: '#ffc600', onAccent: '#15232d', gold: '#ff9d00', green: '#3ad900', red: '#ff628c', violet: '#fb94ff',
      editor: '#193549', gutter: '#5b86a8',
      syntax: { keyword: '#ff9d00', string: '#3ad900', number: '#ff628c', comment: '#4ea1ff', type: '#80ffbb', fn: '#ffc600', prop: '#9effff', variable: '#e1efff', tag: '#9effff', attr: '#ffc600', op: '#ff9d00' },
    },
  },
  {
    id: 'darcula',
    name: 'Darcula',
    from: 'IntelliJ',
    blurb: "JetBrains' own dark theme: orange keywords, olive strings, zero fuss.",
    scheme: 'dark',
    palette: {
      bg: '#2b2b2b', bg2: '#232425', panel: '#3c3f41', panel2: '#424547', line: '#55595c', text: '#cbcbcb', muted: '#a3a3a3',
      accent: '#e8914c', onAccent: '#1e1e1e', gold: '#e8bf6a', green: '#7fb35a', red: '#ff6b68', violet: '#9876aa',
      editor: '#2b2b2b', gutter: '#606366',
      syntax: { keyword: '#cc7832', string: '#7a9a63', number: '#6897bb', comment: '#808080', type: '#a9b7c6', fn: '#ffc66d', prop: '#a685b8', variable: '#a9b7c6', tag: '#e8bf6a', attr: '#bababa', op: '#a9b7c6' },
    },
  },
  {
    id: 'rose-pine',
    name: 'Rosé Pine',
    from: 'VS Code · IntelliJ',
    blurb: 'All natural pine, faux fur and a bit of soho vibes.',
    scheme: 'dark',
    palette: {
      bg: '#191724', bg2: '#13111c', panel: '#1f1d2e', panel2: '#26233a', line: '#403d52', text: '#e0def4', muted: '#908caa',
      accent: '#ebbcba', onAccent: '#191724', gold: '#f6c177', green: '#9ccfd8', red: '#eb6f92', violet: '#c4a7e7',
      editor: '#191724', gutter: '#6e6a86',
      syntax: { keyword: '#4a9fc4', string: '#f6c177', number: '#ebbcba', comment: '#7c7896', type: '#9ccfd8', fn: '#ebbcba', prop: '#c4a7e7', variable: '#e0def4', tag: '#9ccfd8', attr: '#c4a7e7', op: '#908caa' },
    },
  },
  {
    id: 'ayu-mirage',
    name: 'Ayu Mirage',
    from: 'VS Code · IntelliJ',
    blurb: 'Dusky blue-grey with a marigold glow.',
    scheme: 'dark',
    palette: {
      bg: '#1f2430', bg2: '#1a1f29', panel: '#242936', panel2: '#2d3343', line: '#3a4152', text: '#cccac2', muted: '#959ca5',
      accent: '#ffcc66', onAccent: '#1f2430', gold: '#ffad66', green: '#d5ff80', red: '#f28779', violet: '#dfbfff',
      editor: '#242936', gutter: '#6c7380',
      syntax: { keyword: '#ffad66', string: '#d5ff80', number: '#dfbfff', comment: '#7a8699', type: '#73d0ff', fn: '#ffd173', prop: '#f28779', variable: '#cccac2', tag: '#5ccfe6', attr: '#ffd173', op: '#f29e74' },
    },
  },
  {
    id: 'everforest',
    name: 'Everforest',
    from: 'VS Code · IntelliJ',
    blurb: 'A green, comfortable forest. Easy on the eyes for long sessions.',
    scheme: 'dark',
    palette: {
      bg: '#272e33', bg2: '#1e2326', panel: '#2d353b', panel2: '#343f44', line: '#475258', text: '#d3c6aa', muted: '#9da9a0',
      accent: '#a7c080', onAccent: '#232a2e', gold: '#dbbc7f', green: '#a7c080', red: '#e67e80', violet: '#d699b6',
      editor: '#2d353b', gutter: '#7a8478',
      syntax: { keyword: '#e67e80', string: '#a7c080', number: '#d699b6', comment: '#859289', type: '#dbbc7f', fn: '#83c092', prop: '#7fbbb3', variable: '#d3c6aa', tag: '#e69875', attr: '#dbbc7f', op: '#e69875' },
    },
  },
  {
    id: 'github-light',
    name: 'GitHub Light',
    from: 'VS Code · IntelliJ',
    blurb: "Crisp white, exactly like reading code on GitHub.",
    scheme: 'light',
    palette: {
      bg: '#f0f3f6', bg2: '#f6f8fa', panel: '#ffffff', panel2: '#eef1f4', line: '#d0d7de', text: '#1f2328', muted: '#59636e',
      accent: '#0969da', onAccent: '#ffffff', gold: '#9a6700', green: '#1a7f37', red: '#cf222e', violet: '#8250df',
      editor: '#ffffff', gutter: '#8c959f',
      syntax: { keyword: '#cf222e', string: '#0a3069', number: '#0550ae', comment: '#6e7781', type: '#953800', fn: '#8250df', prop: '#0550ae', variable: '#1f2328', tag: '#116329', attr: '#0550ae', op: '#cf222e' },
    },
  },
  {
    id: 'solarized-light',
    name: 'Solarized Light',
    from: 'VS Code · IntelliJ',
    blurb: 'Precision-tuned warm parchment. A classic for daylight coding.',
    scheme: 'light',
    palette: {
      bg: '#eee8d5', bg2: '#f5efdc', panel: '#fdf6e3', panel2: '#f2ebd6', line: '#d9d0b6', text: '#475b62', muted: '#5d6f70',
      accent: '#2176b5', onAccent: '#fdf6e3', gold: '#946f00', green: '#6b7a00', red: '#cb2b28', violet: '#5b60b5',
      editor: '#fdf6e3', gutter: '#93a1a1',
      syntax: { keyword: '#6b7a00', string: '#1d8279', number: '#c42d78', comment: '#7a8888', type: '#946f00', fn: '#2176b5', prop: '#2176b5', variable: '#475b62', tag: '#2176b5', attr: '#946f00', op: '#6b7a00' },
    },
  },
];

/** The CSS custom properties a theme sets on <html>. */
export function themeVars(t: Theme): Record<string, string> {
  const p = t.palette;
  const vars: Record<string, string> = {
    '--bg': p.bg, '--bg2': p.bg2, '--panel': p.panel, '--panel2': p.panel2, '--line': p.line, '--text': p.text, '--muted': p.muted,
    '--accent': p.accent, '--on-accent': p.onAccent, '--gold': p.gold, '--green': p.green, '--red': p.red, '--violet': p.violet,
    '--editor': p.editor, '--gutter': p.gutter,
  };
  for (const [k, v] of Object.entries(p.syntax)) vars[`--syn-${k}`] = v;
  return vars;
}

export const findTheme = (id: string | null | undefined): Theme => THEMES.find((t) => t.id === id) ?? THEMES[0];

const KEY = 'reactor-quest/theme';
let current = DEFAULT_THEME;
const listeners = new Set<() => void>();

function readStored(): string {
  try {
    return findTheme(localStorage.getItem(KEY)).id;
  } catch {
    return DEFAULT_THEME;
  }
}

/** Paint a theme onto the page (without remembering it — used for hover previews too). */
export function paintTheme(id: string) {
  const t = findTheme(id);
  const root = document.documentElement;
  for (const [k, v] of Object.entries(themeVars(t))) root.style.setProperty(k, v);
  root.dataset.theme = t.id;
  root.dataset.scheme = t.scheme;
  if (t.glow) root.dataset.glow = '';
  else delete root.dataset.glow;
  root.style.colorScheme = t.scheme;
  document.querySelector('meta[name="color-scheme"]')?.setAttribute('content', t.scheme);
  // The browser chrome / Android status bar follows the profile too.
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t.palette.bg);
}

/** Choose a theme: paint it, remember it on this device, and tell subscribers. */
export function setTheme(id: string) {
  current = findTheme(id).id;
  paintTheme(current);
  try {
    localStorage.setItem(KEY, current);
  } catch {
    /* private mode: the choice lasts for this visit */
  }
  for (const l of listeners) l();
}

/** Apply the remembered theme. Called once, before the first render, so there's no flash. */
export function initTheme() {
  current = readStored();
  paintTheme(current);
}

export function useTheme(): Theme {
  const id = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current,
  );
  return findTheme(id);
}

// TODO https://electronjs.org/docs/tutorial/security
// TODO read config from file
// TODO event queue

import './index.css';
const util = require('util');
const exec = util.promisify(require('child_process').exec);
const {BrowserWindow} = require('electron').remote;

interface Source {
  name: string;
  key: string;
  command: string;
  action: string;
  unfiltered: boolean;
}

interface Config {
  sources: Source[];
}

interface Candidate {
  value: string;
  source: string;
  action: string;
}

interface execResult {
  stdout: string;
  stderr: string;
}

interface WindowBounds {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

interface BrowserWindow {
  setBounds(bounds: WindowBounds, animate?: boolean): void;
  hide(): void;
}

// globals

let domQuery = document.getElementById('query-input') as HTMLInputElement;
let domResult = document.getElementById('query-result');
let candidates: Candidate[] = [];
let domCandidates: HTMLDivElement[] = [];
let selected: number = 0;

const config: Config = {
  sources: [
    {
      name: 'apps',
      key: 'a',
      unfiltered: false,
      command: '/Users/fgeller/bin/list-apps',
      action: '/usr/bin/open -a "%match%"',
    },
    {
      name: 'pass',
      key: 'p',
      unfiltered: false,
      command: '/Users/fgeller/bin/pass-enumerate',
      action: '/Users/fgeller/bin/pass-copy "%match%"',
    },
    {
      name: 'calc',
      key: 'c',
      unfiltered: true,
      command: '/Users/fgeller/bin/calc "%query%"',
      action: 'echo %match% | /usr/bin/pbcopy',
    },
  ],
};

function filter(q: string, candidates: string[], src: Source): string[] {
  let result: string[] = candidates.map(v => v.trim()).filter(v => v != '');

  if (src.unfiltered) return result;

  let matched: string[] = [];
  let patterns: string[] = q.split(' ').map(v => v.toLowerCase());
  for (const c of result) {
    if (patterns.every((p, i, all) => c.toLowerCase().includes(p))) {
      matched.push(c);
    }
  }

  return matched;
}

function newCandidate(value: string, src: Source): Candidate {
  return {
    value: value,
    source: src.name,
    action: src.action.replace('%match%', value),
  };
}

function findCandidates(q: string): Promise<Candidate[]> {
  let all: Candidate[] = [];
  let ps = config.sources.map(src => {
    const cmd = src.command.replace('%query%', q);
    return exec(cmd).then((out: execResult) => {
      const raw = out.stdout.split('\n');
      const filtered = filter(q, raw, src);
      const limited = filtered.slice(0, 4);
      const cs = limited.map(v => newCandidate(v, src));
      all = all.concat(cs);
    });
  });

  return Promise.all(ps).then(_ => all.slice(0, 5));
}

function hideWindow(): void {
  getQueryWindow().hide();
}

function updateWindowBounds(): void {
  let height = 58;
  height += candidates.length * 41;
  const win = getQueryWindow();
  win.setBounds({height: height}, true);
}

function getQueryWindow(): BrowserWindow {
  const wins = BrowserWindow.getAllWindows();
  return wins[0];
}

function updateCandidates(event: KeyboardEvent): Promise<void> {
  const q = domQuery.value;
  const fail = (reason: any) => console.error('update failure', reason);
  return findCandidates(q).then(setCandidates, fail);
}

function setCandidates(cs: Candidate[]): void {
  candidates = cs;

  const container = document.createElement('div') as HTMLDivElement;
  container.classList.add('container');

  domCandidates = [];
  selected = 0;

  for (let i = 0; i < cs.length; i++) {
    const o = document.createElement('div') as HTMLDivElement;
    o.classList.add('candidate');
    if (i == selected) o.classList.add('selected');

    const v = document.createElement('div') as HTMLDivElement;
    v.textContent = cs[i].value;
    v.classList.add('value');
    o.appendChild(v);

    const s = document.createElement('div') as HTMLDivElement;
    s.textContent = cs[i].source;
    s.classList.add('source');
    o.appendChild(s);

    domCandidates.push(o);
    container.appendChild(o);
  }

  while (domResult.firstChild) domResult.removeChild(domResult.lastChild);

  if (cs.length > 0) domResult.appendChild(container);

  updateWindowBounds();
}

function trigger(): Promise<void> {
  if (candidates.length == 0) {
    console.log(`no candidates available, nothing to trigger`);
    return Promise.resolve();
  }

  const sc = candidates[selected];
  domQuery.readOnly = true;

  const success = (out: execResult) => {
    setCandidates([]);
    domQuery.value = '';
    domQuery.readOnly = false;
    hideWindow();
  };
  const fail = (reason: any) => console.error(`trigger fail`, sc, reason);
  return exec(sc.action).then(success, fail);
}

function markSelected() {
  for (let i = 0; i < domCandidates.length; i++) {
    const c = domCandidates[i];
    if (i == selected && !c.classList.contains('selected')) {
      c.classList.add('selected');
    } else {
      c.classList.remove('selected');
    }
  }
}

function select(ev: KeyboardEvent): Promise<void> {
  switch (ev.key) {
    case 'ArrowLeft':
    case 'ArrowUp':
      if (selected == 0) return;
      selected -= 1;
      markSelected();
      break;
    case 'ArrowRight':
    case 'ArrowDown':
      if (selected >= domCandidates.length - 1) return;
      selected += 1;
      markSelected();
      break;
  }
  return Promise.resolve();
}

function queryKeyUp(ev: KeyboardEvent): Promise<void> {
  switch (ev.key) {
    case 'Control':
    case 'Meta':
    case 'Alt':
    case 'Tab':
    case 'Escape':
      return;

    case 'Enter':
      return trigger();

    case 'ArrowDown':
    case 'ArrowRight':
    case 'ArrowUp':
    case 'ArrowLeft':
      return select(ev);
  }

  if (domQuery.value.trim() == '') {
    setCandidates([]);
    return;
  }

  updateCandidates(ev);
}

domQuery.addEventListener('keyup', queryKeyUp);
domQuery.focus();

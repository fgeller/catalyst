// TODO https://electronjs.org/docs/tutorial/security
// TODO blur on enter/trigger
// TODO read config from file
// TODO event queue
// TODO only show calc when calculation

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
      name: 'osx-applications',
      key: 'a',
      unfiltered: false,
      command:
        '/usr/local/bin/fd -d 2 .app$ /Applications /System/Applications /Users/fgeller/Applications',
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
      command: '/Users/fgeller/bin/calc %query%',
      action: 'echo %match% | /usr/bin/pbcopy',
    },
  ],
};

function filter(q: string, candidates: string[], src: Source): string[] {
  let result: string[] = candidates.map(v => v.trim()).filter(v => v != '');

  if (src.unfiltered) {
    return result;
  }

  let matched: string[] = [];
  let patterns: string[] = q.split(' ').map(v => {
    return v.toLowerCase();
  });
  for (const cand of result) {
    if (
      patterns.every((p, i, all) => {
        return cand.toLowerCase().includes(p);
      })
    ) {
      matched.push(cand);
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

  return Promise.all(ps).then(_ => {
    return all.slice(0, 5);
  });
}

function updateWindowBounds(): void {
  let height = 79;
  height += candidates.length * 40;
  if (candidates.length > 0) {
    height += 9;
  }

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
  domCandidates = [];
  selected = 0;
  for (let i = 0; i < cs.length; i++) {
    const o = document.createElement('div') as HTMLDivElement;
    o.textContent = cs[i].value;
    if (i == selected) {
      o.classList.add('selected');
    }
    domCandidates.push(o);
    container.appendChild(o);
  }

  while (domResult.firstChild) {
    domResult.removeChild(domResult.lastChild);
  }

  if (cs.length > 0) {
    domResult.appendChild(container);
  }

  updateWindowBounds();
}

function trigger(): Promise<void> {
  if (candidates.length == 0) {
    console.log(`no candidates available, nothing to trigger`);
    return Promise.resolve();
  }

  const sc = candidates[selected];

  setCandidates([]);
  domQuery.value = '';

  const success = (out: execResult) => console.log('trigger result', out);
  const fail = (reason: any) => console.error(`trigger fail`, sc, reason);
  return exec(sc.action).then(success, fail);
}

function markSelected() {
  console.log(`marking selected ${selected} of ${domCandidates.length}`);
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
  console.log('select', ev);
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

  console.log('queryKeyUp', ev);
  updateCandidates(ev);
}

domQuery.addEventListener('keyup', queryKeyUp);
domQuery.focus();

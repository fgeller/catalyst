// TODO https://electronjs.org/docs/tutorial/security
// TODO allow selecting other candidates
// TODO icon
// TODO blur on enter/trigger
// TODO read config from file
// TODO candidates wrapper to add and remove single dom node

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
let domCandidates = document.getElementById('query-candidates');
let candidates: Candidate[] = [];

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

async function findCandidates(q: string): Promise<Candidate[]> {
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

function clearCandidates(): void {
  while (domCandidates.firstChild) {
    domCandidates.removeChild(domCandidates.lastChild);
  }
}

async function updateCandidates(event: KeyboardEvent): Promise<void> {
  const cs = await findCandidates(domQuery.value);

  let ns: HTMLDivElement[] = [];
  for (const c of cs) {
    const o = document.createElement('div') as HTMLDivElement;
    o.textContent = c.value;
    ns.push(o);
  }

  setCandidates(cs);

  for (let i = 0; i < ns.length; i++) {
    domCandidates.appendChild(ns[i]);
  }

  updateWindowBounds();
}

function setCandidates(cs: Candidate[]): void {
  candidates = cs;
  clearCandidates();
  updateWindowBounds();
}

async function trigger(): Promise<void> {
  if (candidates.length == 0) {
    console.log(`no candidates available, nothing to trigger`);
    return;
  }

  const selected = candidates[0];
  console.log(`triggering action on candidate`, selected);

  const success = (out: execResult) => {
    console.log('triggered action result', out);
    domQuery.value = '';
    setCandidates([]);
  };
  const fail = (reason: any) => {
    console.error(`failed to execute action for candidate`, selected, reason);
  };

  exec(selected.action).then(success, fail);
}

async function queryKeyUp(ev: KeyboardEvent): Promise<void> {
  if (ev.key === 'Enter') {
    await trigger();
    return;
  }

  if (domQuery.value.trim() == '') {
    setCandidates([]);
    return;
  }

  await updateCandidates(ev);
}

domQuery.addEventListener('keyup', queryKeyUp);
domQuery.focus();

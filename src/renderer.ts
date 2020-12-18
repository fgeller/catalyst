import './index.css';
import {promisify} from 'util';
import {readFileSync} from 'fs';
import {join as pathJoin} from 'path';
import {safeLoad} from 'js-yaml';
import {homedir} from 'os';
import {remote} from 'electron';
import {execFile as execFileCallback} from 'child_process';
const execFile = promisify(execFileCallback);
import {spawn} from 'child_process';

interface Source {
  name: string;
  key: string;
  command: string[];
  action: string[];
  actionType: string;

  unfiltered: boolean;
  timeout: number;
}

interface Config {
  sources: Source[];
}

interface Candidate {
  value: string;
  source: string;
  action: string[];
  actionType: string;
  timeout: number;
}

interface execResult {
  stdout: string;
  stderr: string;
}

interface childProcess {
  unref(): void;
}

interface WindowBounds {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

interface BrowserWindow {
  getBounds(): WindowBounds;
  setBounds(bounds: WindowBounds, animate?: boolean): void;
  hide(): void;
}

// globals

let domQuery = document.getElementById('query-input') as HTMLInputElement;
let domEchoArea = document.getElementById('echo-area') as HTMLInputElement;
let domResult = document.getElementById('query-result');
let candidates: Candidate[] = [];
let domCandidates: HTMLDivElement[] = [];
let selected: number = 0;

function readConfig(): Config {
  // TODO fail gracefully when file is missing
  const path: string = pathJoin(homedir(), '.config', 'catalyst', 'config.yml');
  let bytes: any = readFileSync(path);
  let cfg = safeLoad(bytes) as Config;
  return cfg;
}

const config = readConfig();

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
  const re = /%match%/gi;
  return {
    value: value,
    source: src.name,
    action: src.action.map(s => s.replace(re, value)),
    actionType: src.actionType,
    timeout: src.timeout,
  };
}

function findCandidates(q: string): Promise<Candidate[]> {
  let all: Candidate[] = [];
  const keyMatch = config.sources.find((s: Source) => {
    // "k" == "k"
    // "k" !== "kool"
    // "k" === "k ool"
    const tq = q.trim();

    if (s.key === tq) {
      return true;
    }

    const fw = tq.indexOf(' ');
    if (fw === -1) {
      return false;
    }

    return s.key === tq.substring(0, fw);
  });

  let srcs = config.sources;
  if (keyMatch !== undefined) {
    srcs = [keyMatch];
    q = q.trim().substring(keyMatch.key.length).trim();
  }

  let ps = srcs.map(src => {
    const re = /%query%/gi;
    const cmd = src.command.map(s => s.replace(re, q));
    return execFile(cmd[0], cmd.slice(1), {}).then((out: execResult) => {
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
  if (candidates.length > 0) {
    height += Math.round(
      candidates.length * (domCandidates[0].clientHeight + 5.4)
    );
  }
  if ('block' === domEchoArea.style.display) {
    height += domEchoArea.clientHeight;
  }
  // 🤷 https://github.com/electron/electron/issues/9477
  // TODO do this only for Linux? and scale level?
  const win = getQueryWindow();
  let bounds = win.getBounds();
  bounds.x = bounds.x + 1;
  bounds.y = bounds.y + 1;
  bounds.width = bounds.width - 2;
  bounds.height = height - 2;
  win.setBounds(bounds);
}

function getQueryWindow(): BrowserWindow {
  const wins = remote.BrowserWindow.getAllWindows();
  return wins[0];
}

function updateCandidates(event: KeyboardEvent): Promise<void> {
  const q = domQuery.value;
  const ctx = {description: 'failed to update the candidates', query: q};

  return findCandidates(q).then(setCandidates, errorHandler(ctx));
}

class CandidateDivElement extends HTMLDivElement {
  i: number;
  lastMouseDown: MouseEvent;
}

function setCandidates(cs: Candidate[]): void {
  candidates = cs;

  const container = document.createElement('div') as HTMLDivElement;
  container.classList.add('container');

  domCandidates = [];
  selected = 0;

  for (let i = 0; i < cs.length; i++) {
    const o = document.createElement('div') as CandidateDivElement;
    o.i = i;
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

    const storeMouseDown = function (ev: MouseEvent): void {
      this.lastMouseDown = ev;
    };

    const triggerCandidate = function (
      this: CandidateDivElement,
      ev: MouseEvent
    ): void {
      if (
        ev.screenX == this.lastMouseDown.screenX &&
        ev.screenY == this.lastMouseDown.screenY
      ) {
        selected = this.i;
        trigger();
      }
    };

    o.addEventListener('mousedown', storeMouseDown);
    o.addEventListener('click', triggerCandidate);

    domCandidates.push(o);
    container.appendChild(o);
  }

  while (domResult.firstChild) domResult.removeChild(domResult.lastChild);

  if (cs.length > 0) domResult.appendChild(container);

  updateWindowBounds();
}

class InputHistory {
  history: Array<string>;
  limit: number;
  pointer: number;
  reset: boolean;

  constructor(limit: number) {
    this.history = new Array<string>();
    this.limit = limit;
  }

  push(c: string) {
    if (this.history.length >= this.limit) {
      this.history.shift();
    }
    this.reset = true;
    this.history.push(c);
  }

  previous(): string {
    return this.select(-1);
  }

  next(): string {
    return this.select(1);
  }

  select(d: number): string {
    if (this.history.length == 0) {
      return null;
    }

    if (d > 0 && (this.reset || this.pointer == this.history.length - 1)) {
      this.pointer = 0;
    } else if (d < 0 && (this.reset || this.pointer == 0)) {
      this.pointer = this.history.length - 1;
    } else {
      this.pointer += d;
    }

    this.reset = false;
    return this.history[this.pointer];
  }
}

const inputHistory = new InputHistory(100); // TODO magic number

function trigger(): Promise<void> {
  if (candidates.length == 0) {
    console.log(`no candidates available, nothing to trigger`);
    return Promise.resolve();
  }

  const sc = candidates[selected];
  inputHistory.push(domQuery.value);
  domQuery.readOnly = true;

  const success = (out: execResult) => {
    if (sc.timeout > 0) {
      hideWindow();
    }
    setCandidates([]);
    domQuery.value = '';
    domQuery.readOnly = false;
  };
  const ctx: any = {
    description: 'failed to trigger action',
    candidates: sc,
  };

  console.log(sc);
  if (sc.timeout === 0) {
    hideWindow();
    domQuery.readOnly = false;
  }

  if (sc.actionType === 'spawn') {
    console.log('spawning');
    const sp = spawn(sc.action[0], sc.action.slice(1), {
      detached: true,
      stdio: 'ignore',
    });
    sp.unref();
    // TODO on error

    if (sc.timeout > 0) {
      hideWindow();
    }
    setCandidates([]);
    domQuery.value = '';
    domQuery.readOnly = false;
    return Promise.resolve();
  } else {
    return execFile(sc.action[0], sc.action.slice(1), {
      timeout: sc.timeout,
    }).then(success, errorHandler(ctx));
  }
}

function errorHandler(ctx: any): (err: Error) => void {
  return function (err: Error): void {
    console.log(ctx, err);
    handleError(err);
  };
}

function handleError(err: Error) {
  domEchoArea.style.background = 'red';
  domEchoArea.style.color = 'white';
  domEchoArea.textContent = err.message;
  domEchoArea.style.display = 'block';
  updateWindowBounds();

  domQuery.readOnly = false;

  const kl = function () {
    domEchoArea.style.display = 'none';
    document.removeEventListener('keyup', kl);
  };

  document.addEventListener('keyup', kl);
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

function selectPrevious() {
  if (selected == 0) return;
  selected -= 1;
  markSelected();
}
function selectNext() {
  if (selected >= domCandidates.length - 1) return;
  selected += 1;
  markSelected();
}

function select(ev: KeyboardEvent): Promise<void> {
  if (ev.key === 'ArrowUp' || (ev.ctrlKey && ev.key === 'p')) {
    selectPrevious();
  } else if (ev.key === 'ArrowDown' || (ev.ctrlKey && ev.key === 'n')) {
    selectNext();
  }
  return Promise.resolve();
}

function previousInput() {
  domQuery.value = inputHistory.previous();
}
function nextInput() {
  domQuery.value = inputHistory.next();
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

    case 'n':
    case 'p':
      if (ev.ctrlKey) {
        return select(ev);
      }
  }

  if (domQuery.value.trim() == '') {
    setCandidates([]);
    return;
  }

  updateCandidates(ev);
}

function queryKeyDown(ev: KeyboardEvent): Promise<void> {
  if (ev.metaKey) {
    switch (ev.code) {
      case 'KeyN':
        nextInput();
        updateCandidates(ev);
        return;
      case 'KeyP':
        previousInput();
        updateCandidates(ev);
        return;
    }
  }
}

domQuery.addEventListener('keydown', queryKeyDown);
domQuery.addEventListener('keyup', queryKeyUp);
domQuery.focus();

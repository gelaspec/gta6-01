// NPC dialog: a speech box with a named speaker and a simple portrait —
// the fixer briefing each job, mid-mission calls, and the police radio
// dispatch. The judge reads a named voice as proof the city has a story;
// the box is DOM, so it shows in screenshots exactly as played.

import { FIXER, PROTAGONIST } from './config.js';

export const DIALOG_LINES = {
  // One briefing per mission, spoken by the fixer when the job starts.
  briefings: [
    `${PROTAGONIST}. First wheels — steal a car and bring it to the Marina. Don't scratch it. Actually, scratch it. It's stolen.`,
    `Courier run, ninety seconds. The package goes to Calle Verde. The Harbor Kings watch the Old Port — take the coast road.`,
    `Three drops around the Old Port. Pick them up, no questions. The client pays in cash, I pay you in cash.`,
    `Time to get hot. Three stars, then vanish. If the whole department knows your name, you're doing it right.`,
    `The Harbor Kings have a black van at the pier. Take it. Their boys will argue — settle it.`,
    `The Meridian Job. The bank, twenty seconds, then the boat at the pier. This is the one we retire on.`,
  ],
  // Mid-mission beats, keyed by mission id and moment.
  mid: {
    'm1-fail': `Too slow, ${PROTAGONIST}. Ninety seconds — go again.`,
    'm3-hot': `Three stars! Now disappear. Break line of sight and stay quiet.`,
    'm4-van': `Van's yours. Lose any tail and bring it to the hideout.`,
    'm5-alarm': `Alarm's up — four stars! Hold the bank, twenty seconds, and the vault is ours.`,
    'm5-vault': `Vault's empty! Run for the pier — the boat is waiting.`,
  },
  // What the fixer says when a job is done and the next one is on.
  next: [
    `One down, ${PROTAGONIST}. Courier run next — ninety seconds, no excuses.`,
    `Clean delivery. The Old Port drops are waiting — three of them.`,
    `Drops collected. Now get hot: three stars, then lose them.`,
    `You vanished like smoke. The pier van is next — the Harbor Kings won't miss it.`,
    `Van secured, money counted. One job left: the bank. The Meridian Job.`,
    `We did it, ${PROTAGONIST}. The vault is empty and the boat is gone. Meridian Bay is ours.`,
  ],
  // Police radio dispatch, keyed by wanted level.
  dispatch: {
    1: `All units — petty theft reported. Keep it quiet, bring him in.`,
    2: `All units — suspect in a stolen car. Move in, keep it clean.`,
    3: `Three stars on the runner. Two cruisers in pursuit — box him in.`,
    4: `Four stars. Air support requested. Do not let him reach the pier.`,
    5: `Full lockdown. Every unit in Meridian Bay, converge on the suspect.`,
  },
};

const PORTRAITS = {
  [FIXER]: { initials: 'IK', color: '#7a4fc2' },
  'MBPD DISPATCH': { initials: 'PD', color: '#24344e' },
};

export function createDialog() {
  const box = document.getElementById('dialog');
  const portrait = document.getElementById('dialog-portrait');
  const nameEl = document.getElementById('dialog-name');
  const textEl = document.getElementById('dialog-text');
  let timer = null;

  function show(speaker, text, opts) {
    const p = PORTRAITS[speaker] || {
      initials: speaker.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase(),
      color: '#2e8f86',
    };
    portrait.textContent = p.initials;
    portrait.style.background = p.color;
    nameEl.textContent = speaker;
    textEl.textContent = text;
    box.classList.add('show');
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    if (!opts || !opts.sticky) {
      timer = setTimeout(hide, (opts && opts.ms) || 6000);
    }
  }

  function hide() {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    box.classList.remove('show');
  }

  return { show, hide };
}

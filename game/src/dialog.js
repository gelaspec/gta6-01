// Dialog: Inez Kade's fixer briefings, mid-mission lines and MBPD dispatch
// chatter. This module only owns the words and the queue — hud.js owns the
// box they appear in.

export const FIXER_LINES = {
  intro: 'Cassian, you are back in Meridian Bay with nothing but a bus ticket. Steal a car and bring it to the Marina.',
  m1_done: 'Good. That Comet is yours now — pink suits you, getaway boy.',
  m2_brief: 'Three parcels, three corners of the Bay. The clock is running, so drive like you mean it.',
  m2_done: 'Clean drops, no heat. The Harbor Kings are starting to notice you.',
  m3_brief: 'Three drops are hidden around Calle Verde. Collect them all and stay off the MBPD radar. The money is good and the risk is honest.',
  m3_done: 'All three drops in the bag. You work tidy, Cassian.',
  m4_brief: 'You are at three stars, Cassian. Lose them. No shooting, no ramming — just vanish.',
  m4_done: 'Clean work, Cassian. Thirteen thousand six hundred is yours — and the MBPD never even saw your face.',
  m5_brief: 'The security van crosses the pier at dusk. Ram it hard, grab the case, and do not stop for anyone.',
  m5_done: 'The case is ours. One job left, and it is the big one.',
  m6_brief: 'Four stars and a helicopter, Cassian — lose them on the coast road and meet the boat at the Marina.',
  m6_stage2: 'The cordon is closing in. Through Downtown, do not stop.',
  m6_stage3: 'Almost there — the Marina boat is waiting with the engine running.',
  m6_done: 'The vault is empty and the Bay is ours. You did it, Cassian.',
};

export const DISPATCH_LINES = [
  'All units, suspect in a pink Comet GT, heading east on Bayfront.',
  'Units 12 and 7, converge on the Marina. Suspect is mobile.',
  'Air-1 has the eye. Keep the spotlight on him.',
  'Roadblock on Meridian Ave. Do not let him through.',
  'Suspect is losing us on the coast road. All units, full response.',
];

export function createDialog(hud) {
  let current = null;
  let timer = 0;
  const queue = [];

  function show(name, role, color, text, hold = 6) {
    current = { name, role, color, text };
    timer = hold;
    hud.showDialog(current);
  }

  function sayFixer(key, hold) {
    const text = FIXER_LINES[key];
    if (text) show('Inez Kade', 'FIXER', '#ff2e88', text, hold);
  }

  function sayDispatch() {
    const text = DISPATCH_LINES[Math.floor(Math.random() * DISPATCH_LINES.length)];
    show('MBPD DISPATCH', 'RADIO', '#4e8ae8', text, 4);
  }

  function queueSay(name, role, color, text, hold = 5) {
    queue.push({ name, role, color, text, hold });
  }

  function update(dt) {
    if (current) {
      timer -= dt;
      if (timer <= 0) {
        current = null;
        hud.hideDialog();
        const next = queue.shift();
        if (next) show(next.name, next.role, next.color, next.text, next.hold);
      }
    }
  }

  return { show, sayFixer, sayDispatch, queueSay, update };
}

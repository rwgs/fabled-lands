// render-choices.js — the choice + navigation view (task 119).
//
// Plain functions taking the story as first argument (no prototype mixin): the <choices>
// table, individual <choice> buttons, <goto>/<return> links, the sail-ship chooser and
// the small dead=/target-book gates. Eligibility + payment semantics are decided DOM-free
// in render-rules.js (choiceGate/flagGate/isSpentSource/blessingSpendForGoto); the fight/
// roll/transfer nav tagging and goBack() stay on the Story (section lifecycle). This
// module only builds the DOM and wires the clicks.

import { boolAttr, applyEffectBody } from './engine.js';
import { payChoiceCost } from './market.js';
import { bookTitle, availableBooks } from './data.js';
import { choiceGate, flagGate, isSpentSource, blessingSpendForGoto } from './render-rules.js';
// renderBranch (render-rolls) is reached through story.dispatchBranch, not a direct import,
// so render-choices and render-rolls no longer form an ES-module cycle. (task 163)

// ---- choices ----------------------------------------------------------------

export function renderChoices(story, container, choicesNode, path, only = null, explicitKids = null) {
  const wrap = document.createElement('div');
  wrap.className = 'choices';
  // A <choices> table can also hold the roll-branch elements the books place
  // beside the buttons (<success>/<failure>/<outcome>) — the resolution of a
  // <difficulty>/<random> rolled in the prose above (e.g. book1/123 swim). Route
  // those through the branch renderer so they reveal their goto once the roll resolves.
  const kids = explicitKids || (only ? [only] : Array.from(choicesNode.children));
  kids.forEach((node, i) => {
    const tag = node.tagName.toLowerCase();
    if (tag === 'choice') wrap.appendChild(renderChoice(story, node, path + '.c' + i));
    else if (tag === 'success' || tag === 'failure' || tag === 'outcome' || tag === 'outcomes') {
      story.dispatchBranch(wrap, node, path + '.b' + i, story.activeRoll); // renderBranch via the facade (task 163)
    }
  });
  container.appendChild(wrap);
  return wrap;
}

// A bare <choice> reached directly (not inside a <choices> table): render it via the
// table renderer so it picks up the same branch-sibling handling.
export function renderChoiceElement(story, container, node, path) {
  return renderChoices(story, container, node.parentNode, path, node);
}

export function renderChoice(story, node, path) {
  const btn = document.createElement('button');
  btn.className = 'choice';
  const label = document.createElement('span');
  label.className = 'choice-label';
  // strip {box} token
  const raw = Array.from(node.childNodes);
  const tmp = document.createElement('span');
  appendChildrenList(story, tmp, raw, path);
  label.innerHTML = tmp.innerHTML.replace('{box}', '');
  btn.appendChild(label);

  const section = node.getAttribute('section');
  const targetBook = node.getAttribute('book') ? Number(node.getAttribute('book')) : story.book;
  const boxWord = node.getAttribute('box');
  const isFlee = boolAttr(node.getAttribute('flee')); // "flee at any time" option

  // Eligibility + payment semantics decided DOM-free in render-rules.js (task 119):
  // reasons disable the button; `payment` is handed to payChoiceCost on click.
  const gate = choiceGate(story.state, node, story);

  if (gate.cost) {
    const tag = document.createElement('span');
    tag.className = 'choice-cost';
    tag.textContent = `${gate.cost} ${gate.coinLabel}`;
    btn.appendChild(tag);
  }
  if (boxWord) {
    const cb = document.createElement('span');
    cb.className = 'choice-box' + (story.state.hasCodeword(boxWord) ? ' ticked' : '');
    cb.textContent = story.state.hasCodeword(boxWord) ? '☑' : '☐';
    btn.insertBefore(cb, label);
  }

  if (gate.reasons.length) {
    btn.disabled = true;
    btn.classList.add('disabled');
    btn.title = gate.reasons.join('; ');
  } else {
    btn.addEventListener('click', () => {
      // A flee="t" choice IS the flee action, and it carries the SAME durable-consequence
      // contract as the fight widget's Flee button (task 178): its <flee> body (a parting
      // wound / "ran away" codeword) is applied NOW and must STAY, so the move is routed
      // { durable: true } — a rejected/missing target arms the task-169/173 retry instead of
      // leaving the flee choice live to apply the wound a second time. Any real cost (a paid
      // flee — none in the current corpus) is charged and re-validated against the live sheet
      // BEFORE the consequence mutates anything; refuse-and-refresh if it can't be met.
      if (isFlee) {
        if (!payChoiceCost(story.state, gate.payment).ok) { story.rerender(); return; }
        const fleeNode = story.sectionEl && story.sectionEl.querySelector('flee');
        if (fleeNode) applyEffectBody(fleeNode, story.state);
        if (story.sectionFight) story.sectionFight.outcome = 'fled';
        if (story.state.isDead()) { story.rerender(); return; } // fatal parting wound: no move, no retry
        if (section == null) { story.rerender(); return; }      // flee only unlocks a box-gated choice
        story.navigate(targetBook, section, { durable: true, sourceNode: node });
        return;
      }
      // Sail exit: same chooser/action as a sail goto (task 89) — on click, sets the
      // chosen vessel at large (prompting when several are here) before navigating. For
      // a sail choice the payment is deferred into the chooser's commit, so abandoning
      // the which-ship picker never eats the cost (task 149); payChoiceCost still
      // re-validates against the live sheet (task 133) at the moment a ship is picked.
      if (gate.isSail && section != null) {
        story._pendingSourceNode = node; // record the source action for a possible <return> (task 110)
        sailThenGo(story, btn.parentElement || story.root, btn, targetBook, section,
          () => payChoiceCost(story.state, gate.payment).ok);
        return;
      }
      // A cost-only choice (no destination) pays and stays — its price is immediate, with no
      // move to guard. Re-validate against the live sheet (task 133); refuse-and-refresh so a
      // now-ineligible choice greys out instead of crossing for free.
      if (section == null) {
        const paid = payChoiceCost(story.state, gate.payment); // transaction lives in market.js (task 34)
        if (!paid.ok) story.rerender();
        return;
      }
      // A real move: defer the price INTO the transactional navigate (task 167) so a rejected
      // or interrupted target refunds it and leaves this choice live, and a successful target
      // takes it exactly once. payChoiceCost still re-validates the live sheet at click time.
      story.navigate(targetBook, section, {
        pay: () => payChoiceCost(story.state, gate.payment),
        sourceNode: node, // record the source action for a possible <return> (task 110)
      });
    });
  }
  story.tagFightNav(node, btn);
  story.tagRollNav(node, btn);
  story.tagTransferNav(node, btn);
  story.tagBuyNav(node, btn);
  return btn;
}

function appendChildrenList(story, container, nodeList, basePath) {
  nodeList.forEach((node, idx) => {
    const path = basePath + '.' + idx;
    if (node.nodeType === Node.TEXT_NODE) story.appendText(container, node.nodeValue);
    else if (node.nodeType === Node.ELEMENT_NODE) story.renderElement(container, node, path);
  });
}

// ---- navigation -------------------------------------------------------------

function targetBook(story, node) {
  const b = node.getAttribute('book');
  return b ? Number(b) : story.book;
}

// A dead="t"/"f" attribute gates navigation on the player's alive/dead state:
// dead="t" is a "you are dead" link (only for a dead player) — while alive it
// must not be clickable, else a survivor walks into the you-are-dead section
// (book4/16's trample → §7). dead="f" is the mirror (only while alive). Returns
// true (and disables the button) when the node is gated out. (task 28)
function deadGate(story, node, btn) {
  const d = node.getAttribute('dead');
  if (d == null) return false;
  const needDead = boolAttr(d);
  if (needDead === story.state.isDead()) return false;
  btn.disabled = true;
  btn.classList.add('gated');
  btn.title = needDead ? 'Only if you are dead.' : 'Only while you live.';
  return true;
}

export function renderGoto(story, container, node, path) {
  const section = node.getAttribute('section');
  if (section == null) return null;
  const book = targetBook(story, node);
  const isSail = boolAttr(node.getAttribute('sail'));
  const force = node.getAttribute('force');
  // force defaults to true (a primary "continue"), EXCEPT a sail goto, which the spec
  // makes optional by default. (task 73)
  const primary = force == null ? !isSail : boolAttr(force, true);

  // A sail goto needs a ship at the CURRENT dock (not merely any owned ship — a ship
  // left at Smogmaw can't sail from Kunrir). (task 73)
  const canSail = !isSail || story.state.shipsHere().length > 0;
  const bookAvailable = availableBooks().includes(book);

  const link = document.createElement('button');
  link.className = 'goto' + (primary ? ' goto-primary' : '');
  // Text: use the node's own text if any, else the section number.
  const inner = document.createElement('span');
  story.appendChildren(inner, node, path);
  link.appendChild(inner.textContent.trim() ? inner : document.createTextNode(String(section)));

  if (!canSail) { link.disabled = true; link.title = 'You need a ship here.'; }
  deadGate(story, node, link); // dead="t" only for a dead player, dead="f" only while alive
  const fg = flagGate(story.state, node); // price/flag "pay to spin" exit gate (task 30)
  if (fg) { link.disabled = true; link.classList.add('gated'); link.title = fg; }
  // A source goto the player took before a <return> is spent — crossed off on the
  // restored section — unless it carries revisit="t" (task 110).
  if (isSpentSource(story.ctx, node)) { link.disabled = true; link.classList.add('disabled'); link.title = 'You have already taken this path.'; }

  // The storm-safe goto (§200/250/60) spends the guarded Safety from Storms on the
  // way out — the roll gate only leaves it clickable in the protected state. (task 108)
  const spendBlessing = blessingSpendForGoto(node, story.sectionEl, story.state, story.outcomeBlessings);
  link.addEventListener('click', () => {
    if (!bookAvailable) { story.notify(`“${bookTitle(book)}” (Book ${book}) isn’t included in this edition.`, 'warn'); return; }
    // The storm-safe goto spends the guarded blessing on the way out; for a sail goto
    // defer that spend into the chooser's commit so an abandoned which-ship picker
    // doesn't waste the blessing (task 149).
    const spend = () => { if (spendBlessing && story.state.hasBlessing(spendBlessing)) story.state.useBlessing(spendBlessing); return true; };
    // A sail goto puts a ship "at large" before leaving; prompt when more than one
    // ship is at this dock, else sail the single one. (task 73)
    if (isSail) { story._pendingSourceNode = node; sailThenGo(story, container, link, book, section, spend); return; }
    // Defer the blessing spend into the transactional navigate (task 167): a rejected or
    // interrupted target refunds the guarded blessing and leaves this goto live.
    story.navigate(book, section, { pay: spend, sourceNode: node }); // sourceNode: a possible <return> (task 110)
  });
  story.tagFightNav(node, link);
  story.tagRollNav(node, link);
  story.tagTransferNav(node, link);
  story.tagBuyNav(node, link);
  container.appendChild(link);
  return link;
}

// Perform a sail action: set a ship "at large", then navigate. When several ships are
// at this dock, prompt the player to choose which one to sail (JaFL ship selection);
// otherwise sail the single ship here. (task 73)
// `commit` (optional) runs the choice's cost/blessing spend at the moment a ship is
// picked and returns whether it succeeded. It is deferred to here so an abandoned
// which-ship chooser never eats the payment — the leak fixed by task 149; a failed
// commit refreshes without sailing or navigating (mirrors payChoiceCost's { ok:false }).
export function sailThenGo(story, container, link, book, section, commit) {
  const here = story.state.shipsHere();
  // Bundle the payment + putting the ship "at large" into the transactional navigate's
  // deferred price (task 167): they run in memory but are refunded if the destination is
  // missing/rejected, so an interrupted voyage neither eats the cost nor strands a ship at
  // sea. An unaffordable/blocked commit returns { ok:false } to refuse the move (task 149).
  // The sail-exempt flag is set here (before the wrapper's leave hooks read it). The source
  // node was recorded by the caller into _pendingSourceNode, which navigate keeps. (task 81)
  const go = (ship) => {
    story.navigate(book, section, {
      pay: () => {
        if (commit && !commit()) return { ok: false };
        const s = story.state.sailShip(ship && ship.id);
        story._sailExempt = s ? s.id : null;
        return { ok: true };
      },
    });
  };
  if (here.length <= 1) { go(here[0]); return; }
  link.disabled = true;
  const box = document.createElement('div');
  box.className = 'ship-choice';
  box.appendChild(document.createTextNode('Sail which ship? '));
  here.forEach((s) => {
    const b = document.createElement('button');
    b.className = 'btn-mini';
    b.textContent = (s.name && s.name !== 'Ship') ? `${s.name} (${s.type})` : String(s.type);
    b.addEventListener('click', () => go(s));
    box.appendChild(b);
  });
  container.appendChild(box);
}

// <return> — a "go back to where you came from" link. The reversal itself (restoring the
// prior visit's position/vars/memo) is story.goBack() — section lifecycle, not view.
export function renderReturn(story, container, node, path) {
  const hist = story.state.data.history || [];
  const link = document.createElement('button');
  link.className = 'goto goto-primary';
  const inner = document.createElement('span');
  story.appendChildren(inner, node, path);
  link.appendChild(inner.textContent.trim() ? inner : document.createTextNode('Go back'));
  if (hist.length) link.addEventListener('click', () => story.goBack());
  else { link.disabled = true; link.title = 'Nowhere to return to'; }
  story.tagFightNav(node, link);
  story.tagRollNav(node, link);
  story.tagTransferNav(node, link);
  story.tagBuyNav(node, link);
  container.appendChild(link);
  return link;
}

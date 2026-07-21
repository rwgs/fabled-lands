// FL test suite — travel gates, transfers, returns, curse lift, blessing veto, reroll storm
// Extracted verbatim from web/_test.html run() lines 4350-4891 (task 120).
import * as data from '../js/data.js';
import { GameState, readSlotData, importSave, loadSlotMeta, deleteSlot, makeItem, nextFreeSlot, sanitizeData, currencyAward, splitItemName } from '../js/state.js';
import * as eng from '../js/engine.js';
import { fightRound, makeFight, groupFightRound, isDefeated, useWrathBlessing, useDefenceBlessing, rerollAttack } from '../js/combat.js';
import { goodsFrom, buyTrade, sellTrade, applyInlineBuy, sellInlineItem, sellCargo, canUpgradeCrew, payChoiceCost } from '../js/market.js';
import { Story, previewProse } from '../js/render.js';
import * as rules from '../js/render-rules.js';
import * as gates from '../js/render-gates.js';
import * as visit from '../js/visit-state.js';
import { Narrator } from '../js/tts.js';
import { renderSheet } from '../js/ui.js';
import { renderStatic } from '../js/app.js';

export async function run(ctx) {
  const { ok, parse } = ctx;
  await data.loadMeta();
  const adv = data.parseAdventurers(data.bookInfo(1).adventurers);
    // --- task 104: travel/encounter roll gates the onward choices ---
    // A mandatory <random> → <outcomes> → <choices> section must be rolled before the
    // onward destinations unlock, and a "get lost" outcome carrying its own <goto>
    // suppresses those choices so only the redirect is offered.
    {
      window.__FL_INSTANT_DICE__ = true;
      const settle104 = () => new Promise((r) => setTimeout(r, 30));
      const rnd104 = Math.random;

      // §1.278: die 1 → "you get lost" → §82 (redirect); die 4 → nothing → destinations.
      const g278 = GameState.create({ name:'T278', gender:'m', profession:'Warrior', book:1, adv });
      const c278 = document.createElement('div');
      const st278 = new Story(c278, g278, { navigate(){}, onDeath(){}, notify(){} });
      const choices278 = () => Array.from(c278.querySelectorAll('.choice'));
      const goto82 = () => Array.from(c278.querySelectorAll('.goto')).find((b) => b.textContent.trim() === '82');
      st278.begin(await data.getSection(1,'278'), 1, '278');
      ok('§278 draws four onward choices', choices278().length === 4, `n=${choices278().length}`);
      ok('§278 choices are all gated before the travel roll',
         choices278().length === 4 && choices278().every((b) => b.disabled && b.dataset.rollnav === '1'),
         choices278().map((b) => b.disabled).join(','));
      ok('§278 shows the travel roll button', !!c278.querySelector('.btn-roll'));

      Math.random = () => 0; // die = 1 → outcome 1,2 → get lost → goto 82
      c278.querySelector('.btn-roll').click(); await settle104();
      ok('§278 rolling 1 reveals the "get lost" redirect to 82', !!goto82() && goto82().disabled === false);
      ok('§278 a redirect keeps the destinations suppressed',
         choices278().length === 4 && choices278().every((b) => b.disabled),
         choices278().map((b) => b.disabled).join(','));

      st278.begin(await data.getSection(1,'278'), 1, '278'); // fresh visit
      Math.random = () => 0.5; // die = 4 → outcome 3,4 → nothing happens (no redirect)
      c278.querySelector('.btn-roll').click(); await settle104();
      ok('§278 rolling 4 unlocks all four destinations',
         choices278().length === 4 && choices278().every((b) => !b.disabled),
         choices278().map((b) => b.disabled).join(','));
      ok('§278 a non-redirect outcome offers no forced goto', !goto82());

      // §1.668 (mining, a plain untyped <random>): the gate is structural, not keyed on
      // type="travel", so a non-travel mandatory roll gates its onward choices too.
      const g668 = GameState.create({ name:'T668', gender:'m', profession:'Warrior', book:1, adv });
      g668.data.stamina = 20; g668.data.staminaMax = 20;
      const c668 = document.createElement('div');
      const st668 = new Story(c668, g668, { navigate(){}, onDeath(){}, notify(){} });
      const choices668 = () => Array.from(c668.querySelectorAll('.choice'));
      st668.begin(await data.getSection(1,'668'), 1, '668');
      ok('§668 (non-travel roll) gates its onward choices before the roll',
         choices668().length === 4 && choices668().every((b) => b.disabled && b.dataset.rollnav === '1'),
         `n=${choices668().length}`);
      Math.random = () => 0.9; // 6+6 = 12 → silver nugget (no redirect) → unlock
      c668.querySelector('.btn-roll').click(); await settle104();
      ok('§668 unlocks the choices once the roll resolves', choices668().every((b) => !b.disabled));

      // §5.674 (physician): the cure roll is OPTIONAL (pay-gated flag="c"), so declining
      // and leaving must stay possible — its choices must NOT be roll-gated.
      const g674t = GameState.create({ name:'T674', gender:'m', profession:'Warrior', book:5, adv });
      g674t.data.shards = 100;
      const c674t = document.createElement('div');
      const st674t = new Story(c674t, g674t, { navigate(){}, onDeath(){}, notify(){} });
      st674t.begin(await data.getSection(5,'674'), 5, '674');
      const choices674 = Array.from(c674t.querySelectorAll('.choice'));
      ok('§674 gate is not built for an optional pay-gated roll', st674t.rollGate === null);
      ok('§674 onward choices stay live beside the optional cure roll',
         choices674.length === 3 && choices674.every((b) => !b.disabled && b.dataset.rollnav !== '1'),
         `n=${choices674.length}`);

      Math.random = rnd104;
      window.__FL_INSTANT_DICE__ = false;
    }

    // --- task 107: <transfer> is a player action (chooser/filter/price/force) ---
    { // block-scoped
      // §4.456: the +1 offering is a price-gated transfer — it must NOT auto-run on
      // entry; offering a +1 item moves THAT item to the cache, sets flag 1 and
      // reveals →641; an ineligible (+0) item is never touched.
      const g456 = GameState.create({ name:'V456', gender:'m', profession:'Warrior', book:4, adv });
      g456.data.items = [];
      g456.addItem(makeItem('item', 'apple'));                     // +0 → ineligible
      g456.addItem(makeItem('tool', 'lucky ring', 1, 'charisma')); // +1 → the eligible offering
      const before456 = g456.itemCount();
      const c456 = document.createElement('div');
      const st456 = new Story(c456, g456, { navigate(){}, onDeath(){}, notify(){} });
      st456.begin(await data.getSection(4, '456'), 4, '456');
      ok('task107: §456 offers nothing on entry (no auto-transfer, flag clear)',
         g456.itemCount() === before456 && g456.cacheItems('4.641').length === 0 && !g456.getFlag('1'),
         `n=${g456.itemCount()} cache=${g456.cacheItems('4.641').length} flag=${g456.getFlag('1')}`);
      ok('task107: §456 →641 hidden before the offering',
         !Array.from(c456.querySelectorAll('.goto')).some((b)=>/641/.test(b.textContent)));
      const offer = Array.from(c456.querySelectorAll('button')).find((b)=>/offer a \+1 item/i.test(b.textContent));
      ok('task107: §456 the +1 offering is armed (enabled)', !!offer && !offer.disabled);
      offer.click();
      ok('task107: §456 offering a +1 item moves it to the cache and sets flag 1',
         g456.getFlag('1') === true && g456.cacheItems('4.641').some((i)=>i.name==='lucky ring') && g456.findItems('lucky ring').length === 0,
         `flag=${g456.getFlag('1')} cache=${JSON.stringify(g456.cacheItems('4.641').map((i)=>i.name))}`);
      ok('task107: §456 the ineligible +0 item is untouched', g456.findItems('apple').length === 1);
      ok('task107: §456 →641 revealed after the offering',
         Array.from(c456.querySelectorAll('.goto')).some((b)=>/641/.test(b.textContent)));

      // §4.456 with no eligible item: the offer stays disabled and nothing moves.
      const g456b = GameState.create({ name:'V456b', gender:'m', profession:'Warrior', book:4, adv });
      g456b.data.items = [makeItem('item', 'apple')]; // no bonus items at all
      const c456b = document.createElement('div');
      new Story(c456b, g456b, { navigate(){}, onDeath(){}, notify(){} }).begin(await data.getSection(4, '456'), 4, '456');
      const offerB = Array.from(c456b.querySelectorAll('button')).find((b)=>/offer a \+1 item/i.test(b.textContent));
      ok('task107: §456 offer is disabled with no eligible +1 item',
         !!offerB && offerB.disabled && !g456b.getFlag('1') && g456b.findItems('apple').length === 1);

      // §6.310: "decide what item to present" — item="?" is a choose-one action; the
      // SELECTED possession moves, not array position zero.
      const g310 = GameState.create({ name:'V310', gender:'m', profession:'Warrior', book:6, adv });
      g310.data.items = [makeItem('item','first thing'), makeItem('item','second thing'), makeItem('item','third thing')];
      const c310 = document.createElement('div');
      new Story(c310, g310, { navigate(){}, onDeath(){}, notify(){} }).begin(await data.getSection(6, '310'), 6, '310');
      ok('task107: §310 presents nothing on entry', g310.itemCount() === 3 && g310.cacheItems('6.310').length === 0);
      const picks310 = Array.from(c310.querySelectorAll('.ability-pick'));
      const pick2 = picks310.find((btn)=>/second thing/i.test(btn.textContent));
      ok('task107: §310 shows an item chooser (a pick per possession)', picks310.length === 3 && !!pick2);
      pick2.click();
      ok('task107: §310 the CHOSEN item moves (not the first)',
         g310.cacheItems('6.310').length === 1 && g310.cacheItems('6.310')[0].name === 'second thing'
         && g310.findItems('first thing').length === 1 && g310.findItems('second thing').length === 0,
         `cache=${JSON.stringify(g310.cacheItems('6.310').map((i)=>i.name))}`);

      // §6.635: giving a weapon is force="f" (optional) — →677 stays live without it.
      const g635 = GameState.create({ name:'V635', gender:'m', profession:'Warrior', book:6, adv });
      g635.data.items = [makeItem('weapon','broadsword',2)];
      const c635 = document.createElement('div');
      const st635 = new Story(c635, g635, { navigate(){}, onDeath(){}, notify(){} });
      st635.begin(await data.getSection(6, '635'), 6, '635');
      ok('task107: §635 builds no forced-transfer gate (both force="f")', st635.transferGate === null);
      const cont677 = Array.from(c635.querySelectorAll('.goto')).find((b)=>/677/.test(b.textContent));
      ok('task107: §635 →677 stays live beside the optional gift', !!cont677 && !cont677.disabled);
      ok('task107: §635 no weapon given on entry',
         g635.findItems('broadsword').length === 1 && g635.cacheItems('6.635').length === 0);

      // §2.639: "lose any OTHER armour" — armour="*" xarmour="?" xgroup="2.639" spares
      // the just-granted group-2.639 suit; forced, so it gates →342.
      const g639 = GameState.create({ name:'V639', gender:'m', profession:'Warrior', book:2, adv });
      g639.data.items = [
        makeItem('armour','splint armour',4,null,[],[],'2.639'), // the gift (spared)
        makeItem('armour','chainmail',2),                        // other armour (lost)
      ];
      const movers639 = eng.transferPlan(parse('<transfer to="null" armour="*" xarmour="?" xgroup="2.639"/>'), g639).movers;
      ok('task107: §639 selector spares the group-2.639 suit, takes the rest',
         movers639.length === 1 && movers639[0].name === 'chainmail', JSON.stringify(movers639.map((m)=>m.name)));
      const c639 = document.createElement('div');
      const st639 = new Story(c639, g639, { navigate(){}, onDeath(){}, notify(){} });
      st639.begin(await data.getSection(2, '639'), 2, '639');
      const goto342 = Array.from(c639.querySelectorAll('.goto')).find((b)=>/342/.test(b.textContent));
      ok('task107: §639 nothing moved on entry; forced transfer gates →342',
         g639.findItems('chainmail').length === 1 && !!goto342 && goto342.disabled);
      const doIt639 = Array.from(c639.querySelectorAll('button')).find((b)=>/lose any other/i.test(b.textContent));
      ok('task107: §639 the forced transfer is armed', !!doIt639 && !doIt639.disabled);
      doIt639.click();
      const goto342b = Array.from(c639.querySelectorAll('.goto')).find((b)=>/342/.test(b.textContent));
      ok('task107: §639 running it loses other armour, keeps the gift, unlocks →342',
         g639.findItems('chainmail').length === 0 && g639.findItems('splint armour').length === 1
         && g639.cacheItems('null').some((i)=>i.name==='chainmail') && !!goto342b && !goto342b.disabled,
         `items=${JSON.stringify(g639.data.items.map((i)=>i.name))} gated=${goto342b&&goto342b.disabled}`);

      // Engine: keep-tagged possessions survive a plain item="*" transfer from the player.
      const gkeep = GameState.create({ name:'Vkeep', gender:'m', profession:'Warrior', book:1, adv });
      gkeep.data.items = [makeItem('item','white sword',0,null,['keep']), makeItem('item','junk')];
      eng.applyEffect(parse('<transfer item="*" to="void"/>'), gkeep, {});
      ok('task107: item="*" transfer from the player spares keep-tagged items',
         gkeep.findItems('white sword').length === 1 && gkeep.findItems('junk').length === 0
         && gkeep.cacheItems('void').some((i)=>i.name==='junk'),
         `items=${JSON.stringify(gkeep.data.items.map((i)=>i.name))}`);
    }

    // --- task 108: <outcome blessing="…"> veto — Safety from Storms carries the
    // protected traveller past the storm/capsize redirect ---
    {
      window.__FL_INSTANT_DICE__ = true;
      const settle108 = () => new Promise((r) => setTimeout(r, 30));
      const rnd108 = Math.random;
      const cont527 = (c) => Array.from(c.querySelectorAll('.goto')).find((b) => /→\s*527/.test(b.textContent));
      const goto619 = (c) => Array.from(c.querySelectorAll('.goto')).find((b) => b.textContent.trim() === '619');

      // §200, ordinary storm blessing, roll 11-12: the storm outcome (→527) is vetoed,
      // the blessing is NOT consumed on entry or by the veto, and the safe →619 unlocks.
      const g200 = GameState.create({ name:'T200', gender:'m', profession:'Warrior', book:5, adv });
      g200.addBlessing('storm');
      let nav200 = null;
      const c200 = document.createElement('div');
      const st200 = new Story(c200, g200, { navigate(b,s){ nav200 = { b, s }; }, onDeath(){}, notify(){} });
      st200.begin(await data.getSection(5,'200'), 5, '200');
      ok('task108: §200 keeps the storm blessing on entry (not auto-consumed)', g200.hasBlessing('storm'));
      Math.random = () => 0.9; // 6+6 = 12 → range 11-12
      c200.querySelector('.btn-roll').click(); await settle108();
      ok('task108: §200 a held blessing vetoes the →527 storm redirect', !cont527(c200));
      ok('task108: §200 the safe →619 unlocks (roll gate sees no forced redirect)',
         !!goto619(c200) && !goto619(c200).disabled);
      ok('task108: §200 the blessing survives until the safe path is taken', g200.hasBlessing('storm'));
      goto619(c200).click();
      ok('task108: §200 taking the safe goto spends the blessing and turns to 619',
         nav200 && String(nav200.s) === '619' && !g200.hasBlessing('storm'),
         `nav=${JSON.stringify(nav200)} storm=${g200.hasBlessing('storm')}`);

      // §200, permanent storm blessing: vetoed the same way, but never used up (task 90).
      const g200p = GameState.create({ name:'T200p', gender:'m', profession:'Warrior', book:5, adv });
      g200p.addBlessing('storm', true);
      let nav200p = null;
      const c200p = document.createElement('div');
      const st200p = new Story(c200p, g200p, { navigate(b,s){ nav200p = { b, s }; }, onDeath(){}, notify(){} });
      st200p.begin(await data.getSection(5,'200'), 5, '200');
      Math.random = () => 0.9;
      c200p.querySelector('.btn-roll').click(); await settle108();
      ok('task108: §200 a permanent blessing also vetoes the storm', !cont527(c200p) && !!goto619(c200p) && !goto619(c200p).disabled);
      goto619(c200p).click();
      ok('task108: §200 the permanent blessing is not used up by the safe passage',
         nav200p && String(nav200p.s) === '619' && g200p.hasBlessing('storm') && g200p.isBlessingPermanent('storm'));

      // §200 unblessed: the storm redirect is the only result, and →619 stays suppressed.
      const g200u = GameState.create({ name:'T200u', gender:'m', profession:'Warrior', book:5, adv });
      const c200u = document.createElement('div');
      const st200u = new Story(c200u, g200u, { navigate(){}, onDeath(){}, notify(){} });
      st200u.begin(await data.getSection(5,'200'), 5, '200');
      Math.random = () => 0.9;
      c200u.querySelector('.btn-roll').click(); await settle108();
      ok('task108: §200 unblessed rolls 11-12 into the storm (→527 revealed)', !!cont527(c200u));
      ok('task108: §200 unblessed keeps the safe sibling →619 suppressed',
         !goto619(c200u) || goto619(c200u).disabled);

      // §200 blessed but rolls 4-10: plain sailing, blessing untouched, no storm.
      const g200s = GameState.create({ name:'T200s', gender:'m', profession:'Warrior', book:5, adv });
      g200s.addBlessing('storm');
      const c200s = document.createElement('div');
      const st200s = new Story(c200s, g200s, { navigate(){}, onDeath(){}, notify(){} });
      st200s.begin(await data.getSection(5,'200'), 5, '200');
      Math.random = () => 0.5; // 4+4 = 8 → range 4-10 (plain sailing → 619)
      c200s.querySelector('.btn-roll').click(); await settle108();
      ok('task108: §200 a safe (4-10) roll keeps the blessing and shows no storm',
         g200s.hasBlessing('storm') && !cont527(c200s)
         && Array.from(c200s.querySelectorAll('.goto')).some((b) => /→\s*619/.test(b.textContent)));

      // §232 reroll form, storm blessing, roll 11-12: the capsize (→510) is vetoed and a
      // reroll is offered (its keepblessing var owns the eventual spend).
      const g232 = GameState.create({ name:'T232', gender:'m', profession:'Warrior', book:5, adv });
      g232.data.shards = 100; g232.addBlessing('storm');
      const c232 = document.createElement('div');
      const st232 = new Story(c232, g232, { navigate(){}, onDeath(){}, notify(){} });
      st232.begin(await data.getSection(5,'232'), 5, '232');
      ok('task232: §232 keeps the storm blessing on entry (keepblessing var)', g232.hasBlessing('storm'));
      Math.random = () => 0.9; // 12 → range 11-12
      c232.querySelector('.btn-roll').click(); await settle108();
      ok('task108: §232 a held blessing vetoes the →510 capsize',
         !Array.from(c232.querySelectorAll('.goto')).some((b) => /→\s*510/.test(b.textContent)));
      ok('task108: §232 offers the reroll (safe path) instead',
         Array.from(c232.querySelectorAll('.btn-secondary')).some((b) => /roll again|reroll/i.test(b.textContent)));

      Math.random = rnd108;
      window.__FL_INSTANT_DICE__ = false;
    }

    // --- task 109: multi-ability <success ability="…"> routes by the CHOSEN ability ---
    // §2.37 offers "SANCTITY or MAGIC (your choice)" then a SANCTITY success →60 and a
    // MAGIC success →129; the branch must match the ability the player actually rolled.
    {
      window.__FL_INSTANT_DICE__ = true;
      const settle109 = () => new Promise((r) => setTimeout(r, 30));
      const rnd109 = Math.random;
      const cont37 = (c, n) => Array.from(c.querySelectorAll('.goto')).some((b) => new RegExp('→\\s*' + n + '$').test(b.textContent.trim()));
      const run37 = async (pick, rng) => {
        const g = GameState.create({ name:'T37', gender:'m', profession:'Warrior', book:2, adv });
        g.data.abilities.sanctity = 6; g.data.abilities.magic = 6; // 2d6(max 12)+6 vs 15
        const c = document.createElement('div');
        const st = new Story(c, g, { navigate(){}, onDeath(){}, notify(){} });
        st.begin(await data.getSection(2, '37'), 2, '37');
        const pickBtn = Array.from(c.querySelectorAll('.ability-pick')).find((b) => new RegExp(pick, 'i').test(b.textContent));
        pickBtn.click(); await settle109();
        Math.random = rng;
        c.querySelector('.btn-roll').click(); await settle109();
        return c;
      };
      const cS = await run37('sanctity', () => 0.9); // 12 + 6 = 18 > 15 → success
      ok('task109: §37 a successful SANCTITY roll routes to →60',
         cont37(cS, 60) && !cont37(cS, 129) && !cont37(cS, 83));
      const cM = await run37('magic', () => 0.9);
      ok('task109: §37 a successful MAGIC roll routes to →129, not the SANCTITY branch',
         cont37(cM, 129) && !cont37(cM, 60) && !cont37(cM, 83));
      const cF = await run37('sanctity', () => 0); // 2 + 6 = 8 ≤ 15 → failure
      ok('task109: §37 a failed roll routes to →83 regardless of ability',
         cont37(cF, 83) && !cont37(cF, 60) && !cont37(cF, 129));
      Math.random = rnd109;
      window.__FL_INSTANT_DICE__ = false;
    }

    // --- task 110: <return> restores the previous visit, not a fresh re-entry ---
    // A → B → <return> must land back on A at the point it was left: its section-local
    // variable/roll and render memo intact, its one-shot entry effect NOT repeated, no
    // second forward visit pushed/counted, state changed during the detour kept, and
    // only a revisit="t" source action left immediately reusable.
    {
      const buildReturn = () => {
        const g = GameState.create({ name:'T110', gender:'m', profession:'Warrior', book:1, adv });
        g.data.shards = 0;
        const secA = parse('<section name="A" boxes="1"><gain shards="10"/><tick/><p>Hub.</p><choices><choice section="B">PlainGo</choice><choice section="B" revisit="t">RevisitGo</choice></choices></section>');
        const secB = parse('<section name="B"><gain shards="5"/><p>Detour.</p><return>Turn back</return></section>');
        const secs = { A: secA, B: secB };
        const cont = document.createElement('div');
        let story;
        // Mirror the app: every entry is goTo()+begin() so state.data.section is set
        // and history records the forward visit (a <return> needs that trail).
        const enter = (b, s) => { g.goTo(b, s); story.begin(secs[String(s)], b, s); };
        story = new Story(cont, g, { navigate: enter, onDeath(){}, notify(){} });
        enter(1, 'A'); // first entry: no frame captured (nothing to return to)
        return { g, cont, story };
      };
      const findChoice = (c, label) => Array.from(c.querySelectorAll('.choice')).find((b) => b.textContent.includes(label));

      // Scenario 1 — leave via the plain (non-revisit) choice.
      const s1 = buildReturn();
      ok('task110: A\'s entry gain applies once on entry (10 shards)', s1.g.data.shards === 10, 'shards=' + s1.g.data.shards);
      s1.g.setVar('rolled', 4); // stand in for an in-section roll result the player must resume with
      const ctxA = s1.story.ctx;
      findChoice(s1.cont, 'PlainGo').click(); // A → B
      ok('task110: taking a choice enters the detour (B) and its state change applies', s1.story.section === 'B' && s1.g.data.shards === 15, 'sec=' + s1.story.section + ' shards=' + s1.g.data.shards);
      s1.cont.querySelector('.goto').click(); // <return> → A
      ok('task110: return restores the previous section (A)', s1.story.section === 'A' && s1.story.book === 1, 'sec=' + s1.story.section + ' book=' + s1.story.book);
      ok('task110: return preserves A\'s section variable', s1.g.getVar('rolled') === 4, 'rolled=' + s1.g.getVar('rolled'));
      ok('task110: return preserves A\'s render memo (same ctx object → roll/used-action state)', s1.story.ctx === ctxA);
      ok('task110: return does NOT repeat A\'s entry gain, and keeps the detour\'s +5 (15 shards)', s1.g.data.shards === 15, 'shards=' + s1.g.data.shards);
      // Entering A counted turn 1, entering B counted turn 2; the return must add no
      // third turn and must pop the A→B→A bounce back to an empty trail.
      ok('task110: return counts no second forward visit and pops the history bounce', s1.g.data.turns === 2 && (s1.g.data.history || []).length === 0, 'turns=' + s1.g.data.turns + ' hist=' + (s1.g.data.history || []).length);
      const plainBtn = findChoice(s1.cont, 'PlainGo');
      const revBtn = findChoice(s1.cont, 'RevisitGo');
      ok('task110: the taken non-revisit source is spent (crossed off) on return', !!plainBtn && plainBtn.disabled === true, 'dis=' + (plainBtn && plainBtn.disabled));
      ok('task110: an untaken source stays usable on return', !!revBtn && revBtn.disabled === false, 'dis=' + (revBtn && revBtn.disabled));

      // Scenario 2 — leave via the revisit="t" choice: it stays reusable after returning.
      const s2 = buildReturn();
      findChoice(s2.cont, 'RevisitGo').click(); // A → B via the revisit action
      s2.cont.querySelector('.goto').click();    // <return> → A
      const revBtn2 = findChoice(s2.cont, 'RevisitGo');
      ok('task110: a taken revisit="t" source stays reusable on return', !!revBtn2 && revBtn2.disabled === false, 'dis=' + (revBtn2 && revBtn2.disabled));
    }

    // --- task 148: undo re-enters a section via a bare begin(); its stale return frame -----
    // The navigate wrapper is the only path that (re)sets _returnFrame; app.undo re-enters
    // the target section with a bare begin(), so the frame captured when the PRE-undo timeline
    // LEFT its previous section would survive. If the section undone-into carries a <return>,
    // goBack would consume that stale frame and re-hydrate a pre-undo visit. app.undo now nulls
    // story._returnFrame before begin(); this locks the Story-level contract that fix relies on.
    {
      const g148 = GameState.create({ name:'T148', gender:'m', profession:'Warrior', book:1, adv });
      const secA148 = parse('<section name="A"><p>A</p><choices><choice section="B">GoB</choice></choices></section>');
      const secB148 = parse('<section name="B"><p>B</p></section>');
      const secX148 = parse('<section name="X"><p>X</p><return>Back</return></section>');
      const secs148 = { A: secA148, B: secB148, X: secX148 };
      const cont148 = document.createElement('div');
      let navd148 = null;
      let story148;
      const enter148 = (b, s) => { navd148 = { b: Number(b), s: String(s) }; g148.goTo(b, s); story148.begin(secs148[String(s)], b, s); };
      story148 = new Story(cont148, g148, { navigate: enter148, onDeath(){}, notify(){} });
      enter148(1, 'A');
      Array.from(cont148.querySelectorAll('.choice'))[0].click(); // A → B; the wrapper holds frame(A)
      ok('task148: leaving A for B holds a one-level return frame', !!story148._returnFrame);
      // A bare begin() — exactly what app.undo does to re-enter — does NOT clear the frame itself.
      story148.begin(secX148, 1, 'X');
      ok('task148: a bare begin() (the undo re-entry) leaves the stale frame in place', !!story148._returnFrame);
      // app.undo's fix nulls the frame before begin(); a <return> in the undone-into section
      // must then fall back to history navigation instead of restoring the pre-undo frame.
      story148._returnFrame = null;
      story148.begin(secX148, 1, 'X');
      ok('task148: clearing the frame before begin() keeps it null', story148._returnFrame === null);
      navd148 = null;
      cont148.querySelector('.goto').click(); // <return>
      ok('task148: a null-frame <return> after undo falls back to history (no stale-frame restore)', navd148 && navd148.s === 'A', JSON.stringify(navd148));
    }

    // --- task 115: Adventure-Sheet item detours route through the one navigation entry point ---
    // Using an item whose Use effect opens a section detour (treasure map §1.30→§1.200 etc.)
    // must capture the SOURCE section's return frame exactly like a normal choice, so the
    // detour's <return> restores that source visit — not a stale frame left by an earlier hop
    // (the dominant mode), nor a fresh re-entry. Story.useItem is the single entry point the
    // app delegates to; here we drive it directly and prove the return seam.
    {
      const buildDetour = () => {
        const g = GameState.create({ name:'T115', gender:'m', profession:'Warrior', book:1, adv });
        g.data.shards = 0;
        const secP = parse('<section name="P"><p>Prior.</p><choices><choice section="A">GoA</choice></choices></section>');
        const secA = parse('<section name="A" boxes="1"><gain shards="10"/><tick/><p>Source.</p></section>');
        const secD = parse('<section name="D"><gain shards="5"/><p>Detour.</p><return>Turn back</return></section>');
        const secs = { P: secP, A: secA, D: secD };
        const cont = document.createElement('div');
        let story;
        const enter = (b, s) => { g.goTo(b, s); story.begin(secs[String(s)], b, s); };
        story = new Story(cont, g, { navigate: enter, onDeath(){}, notify(){} });
        return { g, cont, enter, story };
      };
      const findChoice = (c, label) => Array.from(c.querySelectorAll('.choice')).find((b) => b.textContent.includes(label));
      const detourItem = () => ({ item: makeItem('item', 'treasure map'), effect: { uses: -1, body: '<goto section="D"/>' }, body: parse('<effect><goto section="D"/></effect>') });

      // Scenario 1 — the dominant stale-frame mode. Arrive at the source (A) via a normal
      // choice from a prior section (P): _returnFrame now points at P. An item detour from A
      // must re-point it at A, so D's <return> lands on A, not the stale P.
      {
        const d = buildDetour();
        d.enter(1, 'P');
        findChoice(d.cont, 'GoA').click(); // P → A (normal choice)
        const st = d.story;
        ok('task115: arriving at the source (A) applies its entry gain once', st.section === 'A' && d.g.data.shards === 10, 'sec=' + st.section + ' shards=' + d.g.data.shards);
        const ctxA = st.ctx;
        const ticksAtA = d.g.tickCount();
        const histAtA = (d.g.data.history || []).length;
        d.g.setVar('mark', 7); // an in-section value the player must resume with
        const it = detourItem();
        st.useItem(it.item, it.effect, it.body); // A → D via the single entry point
        ok('task115: using the item opens the detour (D) and its state change applies', st.section === 'D' && d.g.data.shards === 15, 'sec=' + st.section + ' shards=' + d.g.data.shards);
        const turnsAtD = d.g.data.turns;
        const histAtD = (d.g.data.history || []).length;
        d.cont.querySelector('.goto').click(); // <return> → A (NOT P)
        ok('task115: return from an item detour restores the source (A), not the pre-source (P)', st.section === 'A' && st.book === 1, 'sec=' + st.section + ' book=' + st.book);
        ok('task115: return preserves the source section variable', d.g.getVar('mark') === 7, 'mark=' + d.g.getVar('mark'));
        ok('task115: return preserves the source render memo (same ctx object)', st.ctx === ctxA);
        ok('task115: return does NOT repeat the source entry gain, and keeps the detour +5 (15 shards)', d.g.data.shards === 15, 'shards=' + d.g.data.shards);
        ok('task115: return does NOT repeat the source entry tick', d.g.tickCount() === ticksAtA, 'ticks=' + d.g.tickCount() + ' vs ' + ticksAtA);
        ok('task115: return counts no extra forward visit and pops the A→D bounce', d.g.data.turns === turnsAtD && (d.g.data.history || []).length === histAtD - 1 && (d.g.data.history || []).length === histAtA, 'turns=' + d.g.data.turns + ' hist=' + (d.g.data.history || []).length);
      }

      // Scenario 2 — the null-frame mode (item used with no prior detour frame, as right
      // after a load). The detour must still capture A, so <return> restores A rather than
      // falling back to a fresh re-entry that would re-run A's entry gain.
      {
        const d = buildDetour();
        d.enter(1, 'A'); // A is the first section: no return frame held
        const st = d.story;
        const ctxA = st.ctx;
        d.g.setVar('mark', 3);
        const it = detourItem();
        st.useItem(it.item, it.effect, it.body); // A → D
        d.cont.querySelector('.goto').click();    // <return>
        ok('task115: with no prior frame, return still restores the source visit (A)', st.section === 'A' && st.ctx === ctxA && d.g.getVar('mark') === 3, 'sec=' + st.section + ' mark=' + d.g.getVar('mark'));
        ok('task115: null-frame return does not re-run A\'s entry gain', d.g.data.shards === 15, 'shards=' + d.g.data.shards);
      }
    }

    // --- task 116: a save round-trip resumes the current visit; effects/rolls do not restart ---
    // Autosave persists a serializable visit record; loading rebuilds the renderer's memo and
    // resumes the exact visit instead of re-entering the section (which would repeat entry
    // gains/ticks and drop resolved rolls / the return frame).
    {
      window.__FL_INSTANT_DICE__ = true;
      const settle116 = () => new Promise((r) => setTimeout(r, 30));
      const rnd116 = Math.random;

      // Scenario 1 — entry gain + tick + a resolved roll survive a save/load round-trip.
      {
        const secRT = parse('<section name="RT" boxes="1"><gain shards="7"/><tick/><p>Test.</p><difficulty ability="COMBAT" level="1"/><success><p>WON-IT</p></success><failure><p>LOST-IT</p></failure></section>');
        const g = GameState.create({ name:'T116', gender:'m', profession:'Warrior', book:1, adv });
        g.data.shards = 0; g.data.abilities.combat = 8;
        const cont = document.createElement('div');
        const story = new Story(cont, g, { navigate(){}, onDeath(){}, notify(){} });
        g.goTo(1, 'RT');
        story.begin(secRT, 1, 'RT');
        Math.random = () => 0.99; // level 1 vs COMBAT 8 → success regardless of the dice
        cont.querySelector('.btn-roll').click(); await settle116();
        Math.random = rnd116;
        const rollsPlayed = story.ctx.rolls.size;
        ok('task116: the visit applied its entry gain + tick once and resolved the roll',
           g.data.shards === 7 && g.tickCount(1, 'RT') === 1 && rollsPlayed >= 1,
           'shards=' + g.data.shards + ' ticks=' + g.tickCount(1, 'RT') + ' rolls=' + rollsPlayed);

        // Serialise (what the save provider writes), round-trip through the storage sanitizer,
        // and reconstruct GameState + Story.
        const record = story.serializeVisit();
        ok('task116: serializeVisit records the section identity + applied memo',
           !!record && record.section === 'RT' && Array.isArray(record.ctx.applied) && record.ctx.applied.length >= 1);
        const g2 = new GameState(sanitizeData(JSON.parse(JSON.stringify({ ...g.data, visit: record }))));
        ok('task116: the visit record survives sanitize when its section matches', !!g2.data.visit && g2.data.visit.section === 'RT');

        const cont2 = document.createElement('div');
        const story2 = new Story(cont2, g2, { navigate(){}, onDeath(){}, notify(){} });
        story2.resume(secRT, 1, 'RT', g2.data.visit, null);
        ok('task116: resume does NOT repeat the entry gain', g2.data.shards === 7, 'shards=' + g2.data.shards);
        ok('task116: resume does NOT repeat the entry tick', g2.tickCount(1, 'RT') === 1, 'ticks=' + g2.tickCount(1, 'RT'));
        ok('task116: resume keeps the roll resolved (no re-roll button, outcome still shown)',
           story2.ctx.rolls.size === rollsPlayed && !cont2.querySelector('.btn-roll') && /WON-IT|LOST-IT/.test(cont2.textContent),
           'rolls=' + story2.ctx.rolls.size + ' hasBtn=' + !!cont2.querySelector('.btn-roll'));
      }

      // Scenario 2 — a save made WHILE inside a return detour keeps the one-level return frame,
      // so <return> after the reload restores the source visit without re-entering it.
      {
        const secP = parse('<section name="P"><p>Prior.</p><choices><choice section="A">GoA</choice></choices></section>');
        const secA = parse('<section name="A" boxes="1"><gain shards="10"/><tick/><p>Source.</p></section>');
        const secD = parse('<section name="D"><gain shards="5"/><p>Detour.</p><return>Turn back</return></section>');
        const secs = { P: secP, A: secA, D: secD };
        const g = GameState.create({ name:'T116b', gender:'m', profession:'Warrior', book:1, adv });
        g.data.shards = 0;
        const cont = document.createElement('div');
        let story;
        const enter = (b, s) => { g.goTo(b, s); story.begin(secs[String(s)], b, s); };
        story = new Story(cont, g, { navigate: enter, onDeath(){}, notify(){} });
        enter(1, 'P');
        Array.from(cont.querySelectorAll('.choice')).find((b) => b.textContent.includes('GoA')).click(); // P → A
        g.setVar('mark', 9);
        const it = { item: makeItem('item', 'map'), effect: { uses: -1, body: '<goto section="D"/>' }, body: parse('<effect><goto section="D"/></effect>') };
        story.useItem(it.item, it.effect, it.body); // A → D, captures the return frame for A
        const turnsAtD = g.data.turns;
        ok('task116: mid-detour the return frame is held at D', story.section === 'D' && !!story._returnFrame, 'sec=' + story.section);

        const record = story.serializeVisit();
        ok('task116: the saved record carries the one-level return frame', !!record && !!record.frame && record.frame.section === 'A');
        const g2 = new GameState(sanitizeData(JSON.parse(JSON.stringify({ ...g.data, visit: record }))));
        const cont2 = document.createElement('div');
        let story2;
        story2 = new Story(cont2, g2, { navigate: (b, s) => { g2.goTo(b, s); story2.begin(secs[String(s)], b, s); }, onDeath(){}, notify(){} });
        const frame2 = story2.deserializeFrame(g2.data.visit.frame, secA);
        story2.resume(secD, 1, 'D', g2.data.visit, frame2);
        ok('task116: resume lands back in the detour (D) with the frame restored', story2.section === 'D' && !!story2._returnFrame);

        cont2.querySelector('.goto').click(); // <return> after the reload
        ok('task116: post-reload <return> restores the source section (A)', story2.section === 'A', 'sec=' + story2.section);
        ok('task116: post-reload <return> restores the source section variable', g2.getVar('mark') === 9, 'mark=' + g2.getVar('mark'));
        ok('task116: post-reload <return> does not repeat A\'s entry gain (keeps 15 shards)', g2.data.shards === 15, 'shards=' + g2.data.shards);
        ok('task116: post-reload <return> counts no extra turn and pops the A→D bounce',
           g2.data.turns === turnsAtD && (g2.data.history || []).length === 1,
           'turns=' + g2.data.turns + ' hist=' + (g2.data.history || []).length);
      }

      // Scenario 3 — a legacy save with no visit record migrates conservatively: the persisted
      // totals are kept and the on-entry gain/tick are NOT replayed.
      {
        const secL = parse('<section name="L" boxes="1"><gain shards="4"/><tick/><p>Legacy.</p><choices><choice section="99">Onward</choice></choices></section>');
        const g = GameState.create({ name:'T116c', gender:'m', profession:'Warrior', book:1, adv });
        g.data.shards = 4;            // as if the entry gain had already been applied and saved
        g.data.boxes[g.boxKey(1, 'L')] = 1; // and the box already ticked
        g.data.section = 'L'; g.data.book = 1;
        g.data.visit = null;          // legacy blob: no visit record
        const cont = document.createElement('div');
        const story = new Story(cont, g, { navigate(){}, onDeath(){}, notify(){} });
        story.resumeStale(secL, 1, 'L');
        ok('task116: a record-less (legacy) resume does not re-apply the entry gain', g.data.shards === 4, 'shards=' + g.data.shards);
        ok('task116: a record-less (legacy) resume does not re-tick the entry box', g.tickCount(1, 'L') === 1, 'ticks=' + g.tickCount(1, 'L'));
        ok('task116: a record-less resume still renders the onward choice', !!Array.from(cont.querySelectorAll('.choice')).find((b) => b.textContent.includes('Onward')));
      }

      window.__FL_INSTANT_DICE__ = false;
    }

    // --- task 154: begin()'s autosaves are atomic — no mid-begin save pairs the NEW
    // section with the PREVIOUS visit's ctx/entry-tick baseline ---
    // begin() clears vars/potion/fight bonuses and arrives at the dock BEFORE it used to
    // swap in the fresh ctx + entry-tick snapshot; each of those clears fires
    // changed()→save()→serializeVisit. The bug persisted {section: NEW, ctx: OLD} — a record
    // that passes resumeOrBegin's section-match guard yet aliases the previous section's
    // positional memos onto the new section. Capture every serializeVisit written during a
    // begin() and prove none names the new section while carrying foreign memos.
    {
      const secA154 = parse('<section name="A154" boxes="1"><gain shards="3"/><tick/><p>A.</p></section>');
      const secB154 = parse('<section name="B154" boxes="1"><p>B.</p></section>');
      const g154 = GameState.create({ name:'T154', gender:'m', profession:'Warrior', book:1, adv });
      g154.data.shards = 0;
      const cont154 = document.createElement('div');
      const story154 = new Story(cont154, g154, { navigate(){}, onDeath(){}, notify(){} });
      g154.setVisitProvider(() => story154.serializeVisit());

      // Enter A twice so its ctx carries applied memos AND its entry-tick snapshot is 1
      // (the box is already ticked on the second entry) — two distinct discriminators that a
      // begin(B) save must never leak into B's record.
      g154.goTo(1, 'A154'); story154.begin(secA154, 1, 'A154');
      g154.goTo(1, 'A154'); story154.begin(secA154, 1, 'A154');
      ok('task154: §A154 entry populated its ctx memo + tick snapshot',
         story154.ctx.applied.size >= 1 && g154.entryTickCount() === 1,
         'applied=' + story154.ctx.applied.size + ' entryTicks=' + g154.entryTickCount());

      // Give begin(B) real clearing work so the mid-begin saves actually fire.
      g154.setVar('x', 5);
      g154.data.potionBonus = { COMBAT: 2 };

      // Capture the serializeVisit written at every save fired during begin(B).
      const captured154 = [];
      const origSave154 = g154.save.bind(g154);
      g154.save = function () { captured154.push(story154.serializeVisit()); return origSave154(); };
      g154.goTo(1, 'B154'); story154.begin(secB154, 1, 'B154');
      g154.save = origSave154;

      const bBaseline = g154.entryTickCount();
      const foreign154 = captured154.filter((r) => r && r.section === 'B154'
        && (r.ctx.applied.length > 0 || r.entryTicks !== bBaseline));
      ok('task154: begin(B) fired its clearVars/clearPotionBonuses autosaves (window exercised)',
         captured154.length >= 1, 'saves=' + captured154.length);
      ok('task154: no mid-begin save pairs §B154 with §A154\'s ctx or entry-tick baseline',
         foreign154.length === 0,
         'foreign=' + foreign154.length + ' baseline=' + bBaseline);

      // Sub-defect: arriveAtDock persists a bare location change even when no ship berths and
      // no voyage ends — otherwise a save-free visit's dock arrival is lost on reload.
      const gD = GameState.create({ name:'T154d', gender:'m', profession:'Warrior', book:1, adv });
      gD.data.location = null; gD.data.ships = [];
      let saves154 = 0; const origSaveD = gD.save.bind(gD); gD.save = function () { saves154++; return origSaveD(); };
      gD.arriveAtDock('Marlock City');
      ok('task154: a dock arrival with no ship still persists the location',
         saves154 === 1 && gD.data.location === 'Marlock City', 'saves=' + saves154 + ' loc=' + gD.data.location);
      gD.arriveAtDock('Marlock City'); // same dock → no change → no needless save
      ok('task154: re-arriving the same dock triggers no needless save', saves154 === 1, 'saves=' + saves154);
      gD.arriveAtDock(null); // inland / at sea → location clears → persist the clear
      ok('task154: clearing the location (inland/at sea) persists too',
         saves154 === 2 && gD.data.location === null, 'saves=' + saves154 + ' loc=' + gD.data.location);
      gD.save = origSaveD;
    }

    // --- task 155: a one-shot action's memo lands in the PERSISTED record, not just the live
    // ctx — so a reload can't replay the rest/buy/roll whose effect already banked ---
    // Each handler's own state mutation autosaves from INSIDE itself, BEFORE the handler writes
    // the ctx memo; rerender() now re-persists once the memo is in place. Drive each handler
    // family with the provider installed, inspect what the autosave wrote to data.visit, then
    // resume from that record on a fresh state.
    {
      window.__FL_INSTANT_DICE__ = true;
      const settle155 = () => new Promise((r) => setTimeout(r, 30));
      const rnd155 = Math.random;
      const reload155 = (secEl, book, sec, src) => {
        const g2 = new GameState(sanitizeData(JSON.parse(JSON.stringify({ ...src.data }))));
        const cont2 = document.createElement('div');
        const story2 = new Story(cont2, g2, { navigate(){}, onDeath(){}, notify(){} });
        story2.resume(secEl, book, sec, g2.data.visit, null);
        return { g2, cont2 };
      };

      // Rest (task 129 one-shot hospitality rest): the memo must persist so the heal can't repeat.
      {
        const secR = parse('<section name="R155"><p>Inn.</p><rest stamina="4"/></section>');
        const g = GameState.create({ name:'T155r', gender:'m', profession:'Warrior', book:1, adv });
        g.data.stamina = 5; g.data.staminaMax = 20;
        const cont = document.createElement('div');
        const story = new Story(cont, g, { navigate(){}, onDeath(){}, notify(){} });
        g.setVisitProvider(() => story.serializeVisit());
        g.goTo(1, 'R155'); story.begin(secR, 1, 'R155');
        Array.from(cont.querySelectorAll('button')).find((b) => /Rest/.test(b.textContent)).click();
        ok('task155: the persisted record marks the one-shot rest used',
           !!g.data.visit && g.data.visit.ctx.applied.some((k) => k.startsWith('rest@')),
           'applied=' + JSON.stringify(g.data.visit && g.data.visit.ctx.applied));
        const { cont2 } = reload155(secR, 1, 'R155', g);
        const rb2 = Array.from(cont2.querySelectorAll('button')).find((b) => /Rest/.test(b.textContent));
        ok('task155: after reload the one-shot rest is already spent (no infinite heal)',
           !!rb2 && rb2.disabled, 'disabled=' + (rb2 && rb2.disabled));
      }

      // Buy (§4.658-style quantity="1" one-shot): the buy count must persist so it can't repeat.
      {
        const secB = parse('<section name="B155"><buy quantity="1" tool="lantern" shards="2">a lantern</buy></section>');
        const g = GameState.create({ name:'T155b', gender:'m', profession:'Warrior', book:1, adv });
        g.data.items = []; g.data.shards = 100;
        const cont = document.createElement('div');
        const story = new Story(cont, g, { navigate(){}, onDeath(){}, notify(){} });
        g.setVisitProvider(() => story.serializeVisit());
        g.goTo(1, 'B155'); story.begin(secB, 1, 'B155');
        Array.from(cont.querySelectorAll('button')).find((b) => /Buy|Take/.test(b.textContent)).click();
        ok('task155: the persisted record records the quantity="1" buy count',
           !!g.data.visit && g.data.visit.ctx.buys.some((e) => String(e[0]).startsWith('buy@') && e[1] >= 1),
           'buys=' + JSON.stringify(g.data.visit && g.data.visit.ctx.buys));
        const { cont2 } = reload155(secB, 1, 'B155', g);
        const bb2 = Array.from(cont2.querySelectorAll('button')).find((b) => /lantern/i.test(b.textContent));
        ok('task155: after reload the one-shot buy is already taken (no free second item)',
           !!bb2 && bb2.disabled, 'disabled=' + (bb2 && bb2.disabled));
      }

      // Roll (a failed <difficulty> whose var write used to be the only save): the resolved roll
      // must persist so a reload can't reroll for free.
      {
        const secD = parse('<section name="D155"><difficulty ability="COMBAT" level="12" var="m"/><success><p>WON</p></success><failure><p>LOST</p></failure></section>');
        const g = GameState.create({ name:'T155d', gender:'m', profession:'Warrior', book:1, adv });
        g.data.abilities.combat = 1;
        const cont = document.createElement('div');
        const story = new Story(cont, g, { navigate(){}, onDeath(){}, notify(){} });
        g.setVisitProvider(() => story.serializeVisit());
        g.goTo(1, 'D155'); story.begin(secD, 1, 'D155');
        Math.random = () => 0; // low dice + COMBAT 1 vs level 12 → guaranteed failure
        cont.querySelector('.btn-roll').click(); await settle155();
        Math.random = rnd155;
        ok('task155: the persisted record keeps the resolved roll + var write',
           !!g.data.visit && g.data.visit.ctx.rolls.some((e) => String(e[0]).startsWith('roll@')) && g.data.visit.ctx.wroteVars.includes('m'),
           'rolls=' + JSON.stringify(g.data.visit && g.data.visit.ctx.rolls));
        const { cont2 } = reload155(secD, 1, 'D155', g);
        ok('task155: after reload the roll stays resolved (outcome shown, no roll button)',
           !cont2.querySelector('.btn-roll') && /WON|LOST/.test(cont2.textContent),
           'hasBtn=' + !!cont2.querySelector('.btn-roll'));
      }

      window.__FL_INSTANT_DICE__ = false;
      Math.random = rnd155;
    }

    // --- task 117: priced equipment/cargo losses can't arm a reward without taking payment ---
    // §2.90 forfeits a weapon OR armour (price=x) to renounce Elnir; §3.569 trades a named
    // Cargo Unit (price=x) for two textiles. An ineligible forfeit button (no such
    // equipment / the wrong cargo) must stay disabled and never arm the linked reward; an
    // open "?" forfeit with several candidates asks which; a real forfeit takes the exact
    // item and only then opens the reward.
    {
      const sec90 = await data.getSection(2, '90');
      const mk90 = (kinds) => {
        const g = GameState.create({ name:'T90', gender:'m', profession:'Warrior', book:2, adv });
        g.data.items = []; (kinds || []).forEach((it) => g.addItem(it));
        g.data.gods = ['Elnir'];
        const c = document.createElement('div');
        const st = new Story(c, g, { navigate(){}, onDeath(){}, notify(){} });
        g.goTo(2, '90'); st.begin(sec90, 2, '90');
        return { g, c, st };
      };
      const payByText = (c, re) => Array.from(c.querySelectorAll('.pay-action')).find((b) => re.test(b.textContent));

      // No weapon but an armour: the weapon forfeit is disabled, the armour forfeit live,
      // and (because equipment is present) no money-fallback button appears.
      {
        const { g, c } = mk90([makeItem('armour', 'chainmail', 2)]);
        const wBtn = payByText(c, /weapon/i);
        const aBtn = payByText(c, /armour|armor/i);
        ok('task117: §2.90 the weapon forfeit is disabled with no weapon', !!wBtn && wBtn.disabled === true, 'w=' + (wBtn && wBtn.disabled));
        ok('task117: §2.90 the armour forfeit stays live when you own armour', !!aBtn && aBtn.disabled === false, 'a=' + (aBtn && aBtn.disabled));
        ok('task117: §2.90 an ineligible forfeit keeps Elnir until a real payment', g.data.gods.includes('Elnir'));
      }

      // A single weapon: forfeiting it (no picker needed) takes that weapon and deletes Elnir.
      {
        const { g, c } = mk90([makeItem('weapon', 'sword', 1)]);
        const wBtn = payByText(c, /weapon/i);
        ok('task117: §2.90 a single owned weapon makes the forfeit live', !!wBtn && wBtn.disabled === false);
        wBtn.click();
        ok('task117: §2.90 forfeiting the weapon removes it and renounces Elnir',
           g.data.items.length === 0 && !g.data.gods.includes('Elnir'),
           'items=' + g.data.items.length + ' elnir=' + g.data.gods.includes('Elnir'));
      }

      // Several weapons: the forfeit asks WHICH; picking one takes exactly that weapon.
      {
        const { g, c } = mk90([makeItem('weapon', 'dagger', 0), makeItem('weapon', 'greatsword', 3)]);
        const wBtn = payByText(c, /weapon/i);
        ok('task117: §2.90 the forfeit is live with weapons to give up', !!wBtn && wBtn.disabled === false);
        wBtn.click(); // reveal the which-one picker (2 candidates)
        const picks = Array.from(c.querySelectorAll('.forfeit-choice .btn-mini'));
        ok('task117: §2.90 several weapons prompt which to forfeit', picks.length === 2, 'picks=' + picks.length);
        const great = picks.find((b) => /greatsword/i.test(b.textContent));
        great.click();
        ok('task117: §2.90 the chosen weapon is the one taken (dagger kept)',
           g.data.items.length === 1 && g.data.items[0].name === 'dagger' && !g.data.gods.includes('Elnir'),
           'kept=' + g.data.items.map((i)=>i.name).join(','));
      }

      // §3.569 named cargo: a Unit the ship lacks can't arm the textile gain; one it carries can.
      const sec569 = await data.getSection(3, '569');
      const mk569 = (cargo) => {
        const g = GameState.create({ name:'T569', gender:'m', profession:'Warrior', book:3, adv });
        g.data.location = null; // at sea
        g.data.ships = [{ id: 's1', type: 'galleon', name: 'Ship', crew: 'average', cargo: cargo.slice(), docked: null }];
        const c = document.createElement('div');
        const st = new Story(c, g, { navigate(){}, onDeath(){}, notify(){} });
        g.goTo(3, '569'); st.begin(sec569, 3, '569');
        return { g, c, st };
      };
      const cargoBtn = (c, name) => Array.from(c.querySelectorAll('.pay-action')).find((b) => b.textContent.trim().toLowerCase() === name);

      // Ship without furs: the furs trade is disabled and grants no textiles.
      {
        const { g, c } = mk569(['timber']);
        const furs = cargoBtn(c, 'furs');
        const timber = cargoBtn(c, 'timber');
        ok('task117: §3.569 a cargo the ship lacks (furs) is a disabled trade', !!furs && furs.disabled === true, 'furs=' + (furs && furs.disabled));
        ok('task117: §3.569 a cargo the ship carries (timber) is a live trade', !!timber && timber.disabled === false, 'timber=' + (timber && timber.disabled));
        ok('task117: §3.569 no free textiles when the required cargo is absent', !g.data.ships[0].cargo.includes('textiles'));
      }

      // Ship with furs: trading it takes the furs and loads two textiles.
      {
        const { g, c } = mk569(['furs']);
        const furs = cargoBtn(c, 'furs');
        ok('task117: §3.569 the furs trade is live when carried', !!furs && furs.disabled === false);
        furs.click();
        const cargo = g.data.ships[0].cargo;
        ok('task117: §3.569 trading furs removes them and loads two textiles',
           !cargo.includes('furs') && cargo.filter((x) => x === 'textiles').length === 2,
           'cargo=' + cargo.join(','));
      }

      // The DOM-free plan agrees: an absent possession is ineligible; a present one is eligible.
      {
        const gEmpty = GameState.create({ name:'T117p', gender:'m', profession:'Warrior', book:2, adv });
        gEmpty.data.items = [];
        const wLose = parse('<lose weapon="?" price="x">weapon</lose>');
        ok('task117: losePaymentPlan reports an absent weapon forfeit as present-but-ineligible',
           eng.losePaymentPlan(wLose, gEmpty).present === true && eng.losePaymentPlan(wLose, gEmpty).eligible === false);
        gEmpty.addItem(makeItem('weapon', 'axe', 1));
        ok('task117: losePaymentPlan reports an owned weapon forfeit as eligible', eng.losePaymentPlan(wLose, gEmpty).eligible === true);
      }
    }

    // --- task 118: choice/equipment losses respect the keep tag ---
    // A "keep" possession (royal ring §1.385, white sword §4.103 — "cannot be lost or
    // stolen") is spared by the open item="?"/multiple= and weapon/armour ?/* forfeits, and
    // by "lose all". Only an explicit NAMED selector with no ordinary alternative may hand
    // that exact kept item over (a scripted, deliberate forfeit).
    {
      const mk118 = (items) => {
        const g = GameState.create({ name:'T118', gender:'m', profession:'Warrior', book:1, adv });
        g.data.items = []; items.forEach((it) => g.addItem(it));
        return g;
      };
      const names = (g) => g.data.items.map((i) => i.name).join(',');
      const ring = () => makeItem('item', 'royal ring', 0, null, ['keep']);
      const whiteSword = () => makeItem('weapon', 'white sword', 3, null, ['keep']);

      // item="?" with a mix: the ordinary item goes, the kept ring stays.
      {
        const g = mk118([ring(), makeItem('item', 'sword'), makeItem('item', 'flask')]);
        eng.applyEffect(parse('<lose item="?"/>'), g, {});
        ok('task118: item="?" takes an ordinary item and spares the kept ring',
           g.data.items.some((i) => i.name === 'royal ring') && !g.data.items.some((i) => i.name === 'sword') && g.itemCount() === 2, names(g));
      }

      // item="?" with ONLY kept items: nothing is taken.
      {
        const g = mk118([ring()]);
        eng.applyEffect(parse('<lose item="?"/>'), g, {});
        ok('task118: item="?" against an only-kept inventory takes nothing', g.itemCount() === 1 && g.data.items[0].name === 'royal ring', names(g));
      }

      // multiple="2" never reaches a kept item — two ordinary items go, ring + one stay.
      {
        const g = mk118([ring(), makeItem('item', 'sword'), makeItem('item', 'flask'), makeItem('item', 'gem')]);
        eng.applyEffect(parse('<lose item="?" multiple="2"/>'), g, {});
        ok('task118: multiple= never takes a kept item',
           g.data.items.some((i) => i.name === 'royal ring') && g.itemCount() === 2, names(g));
      }

      // "lose all possessions" spares the kept ring.
      {
        const g = mk118([ring(), makeItem('item', 'sword'), makeItem('item', 'flask')]);
        eng.applyEffect(parse('<lose item="*"/>'), g, {});
        ok('task118: "lose all" spares the kept ring', g.itemCount() === 1 && g.data.items[0].name === 'royal ring', names(g));
      }

      // weapon="?" spares a kept weapon while an ordinary one exists.
      {
        const g = mk118([whiteSword(), makeItem('weapon', 'axe', 1)]);
        eng.applyEffect(parse('<lose weapon="?"/>'), g, {});
        ok('task118: weapon="?" takes the ordinary weapon and spares the white sword',
           g.data.items.some((i) => i.name === 'white sword') && !g.data.items.some((i) => i.name === 'axe'), names(g));
      }

      // weapon="*" (all of a kind) still skips the kept weapon.
      {
        const g = mk118([whiteSword(), makeItem('weapon', 'axe', 1), makeItem('weapon', 'club', 0)]);
        eng.applyEffect(parse('<lose weapon="*"/>'), g, {});
        ok('task118: weapon="*" removes every ordinary weapon but keeps the white sword',
           g.itemCount() === 1 && g.data.items[0].name === 'white sword', names(g));
      }

      // weapon="?" against an only-kept weapon: nothing is taken (§4.103 can't be confiscated).
      {
        const g = mk118([whiteSword()]);
        eng.applyEffect(parse('<lose weapon="?"/>'), g, {});
        ok('task118: weapon="?" against only a kept weapon takes nothing', g.itemCount() === 1, names(g));
      }

      // A NAMED selector with no ordinary alternative may deliberately hand over the kept
      // item (a scripted "give up the royal ring").
      {
        const g = mk118([ring()]);
        eng.applyEffect(parse('<lose item="royal ring"/>'), g, {});
        ok('task118: an explicit named selector may take the kept item deliberately', g.itemCount() === 0, names(g));
      }

      // The eligibility plan agrees: only-kept ⇒ ineligible; a mix ⇒ eligible.
      {
        const gk = mk118([ring()]);
        ok('task118: losePaymentPlan marks an only-kept item="?" forfeit ineligible', eng.losePaymentPlan(parse('<lose item="?" price="x"/>'), gk).eligible === false);
        gk.addItem(makeItem('item', 'sword'));
        ok('task118: a mixed inventory makes the item="?" forfeit eligible', eng.losePaymentPlan(parse('<lose item="?" price="x"/>'), gk).eligible === true);
      }
    }

    // --- task 111: rolled itemAt= losses skip keep items and honour cache= ---
    // §6.63/§6.168 take the possession at a rolled 1-based position; the loss must
    // index the selected pool (player, or a cache= stash), skip currency, no-op past
    // the end (task 93), and never remove a "keep"-tagged possession — the royal ring
    // (§1.385) / white sword (§4.103) are explicitly items that cannot be lost.
    {
      // an ordinary item at the rolled position → removed
      const g111 = GameState.create({ name:'T111', gender:'m', profession:'Warrior', book:6, adv });
      g111.data.items = [];
      ['ring','sword','flask'].forEach((nm) => g111.addItem(makeItem('item', nm)));
      g111.setVar('x', 2);
      eng.applyEffect(parse('<lose itemAt="x"/>'), g111, {});
      ok('task111: itemAt removes the ordinary item at the rolled position', g111.data.items.map((i)=>i.name).join(',') === 'ring,flask', g111.data.items.map((i)=>i.name).join(','));

      // a keep-tagged possession at the rolled position → left in place (no-op)
      const g111k = GameState.create({ name:'T111k', gender:'m', profession:'Warrior', book:6, adv });
      g111k.data.items = [];
      g111k.addItem(makeItem('item', 'junk'));
      g111k.addItem(makeItem('item', 'royal ring', 0, null, ['keep'])); // position 2, protected
      g111k.addItem(makeItem('item', 'flask'));
      g111k.setVar('x', 2);
      eng.applyEffect(parse('<lose itemAt="x"/>'), g111k, {});
      ok('task111: itemAt leaves a keep-tagged possession in place', g111k.data.items.some((i)=>i.name==='royal ring') && g111k.itemCount() === 3, g111k.data.items.map((i)=>i.name).join(','));

      // an out-of-range roll → still takes nothing (task 93 retained)
      const g111o = GameState.create({ name:'T111o', gender:'m', profession:'Warrior', book:6, adv });
      g111o.data.items = [];
      ['a','b'].forEach((nm) => g111o.addItem(makeItem('item', nm)));
      g111o.setVar('x', 5);
      const before111 = g111o.itemCount();
      eng.applyEffect(parse('<lose itemAt="x"/>'), g111o, {});
      ok('task111: an out-of-range itemAt roll still takes nothing', g111o.itemCount() === before111);

      // a cache-targeted itemAt → removes from the named stash, sparing carried items
      const g111c = GameState.create({ name:'T111c', gender:'m', profession:'Warrior', book:6, adv });
      g111c.data.items = []; g111c.addItem(makeItem('item', 'carried keepsake'));
      g111c.cacheAddItem('vault', makeItem('item', 'stashed gem'));
      g111c.cacheAddItem('vault', makeItem('item', 'stashed idol'));
      g111c.setVar('x', 1);
      eng.applyEffect(parse('<lose itemAt="x" cache="vault"/>'), g111c, {});
      ok('task111: a cache-targeted itemAt removes from the stash, not carried items',
         g111c.cacheItems('vault').map((i)=>i.name).join(',') === 'stashed idol' && g111c.data.items.length === 1,
         'cache=' + g111c.cacheItems('vault').map((i)=>i.name).join(',') + ' carried=' + g111c.itemCount());
    }

    // --- task 112: a curse's lift= question drives a Lift… action on its chip ---
    // §5.505 Skunk-juice cuts CHARISMA by 1 until you reach a river/village/town/city;
    // its stored lift= question must be actionable on the Adventure Sheet — an honest
    // "Yes" removes that one curse and restores CHARISMA, "No" leaves it untouched.
    {
      const settle112 = () => new Promise((r) => setTimeout(r, 0));
      const LIFTQ = 'Are you at a river, village, town or city?';
      const curseXml = `<curse name="Skunk-juice" lift="${LIFTQ}"><effect ability="charisma" bonus="-1"/></curse>`;
      const mk505 = () => {
        const g = GameState.create({ name:'T505', gender:'m', profession:'Warrior', book:5, adv });
        g.data.curses = []; g.data.abilities.charisma = 6;
        eng.applyEffect(parse(curseXml), g, {});
        return g;
      };

      // curse applied: stored with its lift question + CHARISMA cut by 1
      const g505 = mk505();
      ok('task112: §5.505 stores the curse with its lift question and cuts CHARISMA',
         g505.hasCurse('Skunk-juice') && g505.data.curses[0].lift === LIFTQ && g505.ability('charisma') === 5,
         'lift=' + g505.data.curses[0].lift + ' cha=' + g505.ability('charisma'));

      // save round-trip keeps the lift question
      const g505rt = new GameState(sanitizeData(JSON.parse(JSON.stringify(g505.data))));
      ok('task112: the lift question survives a save round-trip', !!g505rt.data.curses[0] && g505rt.data.curses[0].lift === LIFTQ, 'lift=' + (g505rt.data.curses[0] && g505rt.data.curses[0].lift));

      // the sheet renders a keyboard/touch Lift… action carrying the exact question
      const cSheet = document.createElement('div');
      renderSheet(g505, cSheet, {});
      const liftBtn = cSheet.querySelector('.chip-action');
      ok('task112: the Adventure Sheet exposes a Lift… action for the curse', !!liftBtn && liftBtn.tagName === 'BUTTON' && liftBtn.title === LIFTQ, liftBtn ? 'title=' + liftBtn.title : 'no button');

      // answering No leaves the curse and its CHARISMA effect unchanged
      const gNo = mk505();
      const cNo = document.createElement('div');
      renderSheet(gNo, cNo, {});
      cNo.querySelector('.chip-action').click();
      ok('task112: the Lift… modal shows the exact stored question', !!document.querySelector('.modal-overlay') && document.querySelector('.modal-body').textContent.includes('river, village, town or city'));
      Array.from(document.querySelectorAll('.modal-overlay .modal-buttons .btn')).find((b) => b.textContent === 'No').click();
      await settle112();
      ok('task112: answering No keeps the curse and its CHARISMA penalty', gNo.hasCurse('Skunk-juice') && gNo.ability('charisma') === 5, 'cha=' + gNo.ability('charisma'));

      // answering Yes removes that one curse and restores CHARISMA
      const gYes = mk505();
      const cYes = document.createElement('div');
      renderSheet(gYes, cYes, {});
      cYes.querySelector('.chip-action').click();
      Array.from(document.querySelectorAll('.modal-overlay .modal-buttons .btn')).find((b) => b.textContent === 'Yes').click();
      await settle112();
      ok('task112: answering Yes lifts the curse and restores CHARISMA', !gYes.hasCurse('Skunk-juice') && gYes.ability('charisma') === 6, 'cha=' + gYes.ability('charisma') + ' hasCurse=' + gYes.hasCurse('Skunk-juice'));

      // a curse WITHOUT lift= stays inert (no Lift… action)
      const gInert = GameState.create({ name:'TInert', gender:'m', profession:'Warrior', book:5, adv });
      gInert.data.curses = [];
      eng.applyEffect(parse('<curse name="Champion Curse"><effect ability="combat" bonus="-1"/></curse>'), gInert, {});
      const cInert = document.createElement('div');
      renderSheet(gInert, cInert, {});
      ok('task112: a curse without lift= stays inert (no Lift… action)', !cInert.querySelector('.chip-action') && gInert.hasCurse('Champion Curse'));
    }

    // --- task 133: sheet mutations rerender the story so gated content updates ------
    {
      const settle133 = () => new Promise((r) => setTimeout(r, 0));
      // A section whose "Proceed" choice is gated behind NOT being cursed: the <else> of
      // an <if curse="X"> block, so the choice is live only once the curse is gone.
      const gated = '<section name="t133"><if curse="Bogwater">You are cursed.</if><else><choices><choice section="9">Proceed</choice></choices></else></section>';

      // Belt B end-to-end: lifting the curse from the sheet rerenders the story pane, so the
      // curse-gated choice turns live without re-entering the section.
      const gC = GameState.create({ name:'C133', gender:'m', profession:'Warrior', book:1, adv });
      eng.applyEffect(parse('<curse name="Bogwater" lift="Are you free of the swamp?"><effect ability="combat" bonus="-1"/></curse>'), gC, {});
      const cStory = document.createElement('div');
      const storyC = new Story(cStory, gC, { navigate(){}, onDeath(){}, notify(){} });
      storyC.begin(parse(gated), 1, 't133');
      const proceed = () => Array.from(cStory.querySelectorAll('.choice')).find((b) => /Proceed/.test(b.textContent));
      ok('task133: curse-gated choice starts disabled while cursed', !!proceed() && proceed().disabled === true, proceed() ? 'disabled=' + proceed().disabled : 'none');
      const cSheet133 = document.createElement('div');
      renderSheet(gC, cSheet133, { onSheetChange: () => storyC.rerender() });
      cSheet133.querySelector('.chip-action').click(); // open the Lift… modal
      Array.from(document.querySelectorAll('.modal-overlay .modal-buttons .btn')).find((b) => b.textContent === 'Yes').click();
      await settle133();
      ok('task133: lifting the curse rerenders the story — choice now live', !gC.hasCurse('Bogwater') && !!proceed() && proceed().disabled === false, proceed() ? 'disabled=' + proceed().disabled : 'none');

      // Belt B unit: an immediate mutation (reorder) invokes onSheetChange.
      const gM = GameState.create({ name:'M133', gender:'m', profession:'Warrior', book:1, adv });
      gM.data.items = []; gM.addItem(makeItem('item', 'apple')); gM.addItem(makeItem('item', 'pear'));
      let changes = 0;
      const cM = document.createElement('div');
      renderSheet(gM, cM, { onSheetChange: () => { changes++; } });
      const pearMove = Array.from(cM.querySelectorAll('.item')).find((li) => /pear/.test(li.textContent)).querySelector('.item-move');
      pearMove.click();
      ok('task133: a sheet reorder invokes onSheetChange', changes === 1, `changes=${changes}`);
    }

    // --- task 119: DOM-free blessing planners extracted to render-rules.js ---------
    {
      const bsec = parse('<section name="tb"><outcome blessing="storm"/><outcome blessing="*"/><p>Storm! <lose blessing="storm">lose it</lose> and <goto section="9"/>.</p><p><lose blessing="storm" hidden="t"/></p></section>');
      const ob = rules.computeOutcomeBlessings(bsec);
      ok('task119: computeOutcomeBlessings collects guarded blessings, drops the "*" wildcard', ob.has('storm') && !ob.has('*') && ob.size === 1, JSON.stringify([...ob]));

      const held = GameState.create({ name:'B119', gender:'m', profession:'Warrior', book:1, adv });
      held.addBlessing('storm');
      const unheld = GameState.create({ name:'B119n', gender:'m', profession:'Warrior', book:1, adv });

      const outcomeStorm = Array.from(bsec.querySelectorAll('outcome')).find((o) => o.getAttribute('blessing') === 'storm');
      const outcomeStar  = Array.from(bsec.querySelectorAll('outcome')).find((o) => o.getAttribute('blessing') === '*');
      ok('task119: blessingVeto true when the blessing is held', rules.blessingVeto(held, outcomeStorm) === true);
      ok('task119: blessingVeto false when not held', rules.blessingVeto(unheld, outcomeStorm) === false);
      ok('task119: blessingVeto false for a wildcard outcome', rules.blessingVeto(held, outcomeStar) === false);

      const loses = Array.from(bsec.querySelectorAll('lose[blessing]'));
      const openLose = loses.find((l) => !l.hasAttribute('hidden'));
      const hiddenLose = loses.find((l) => l.hasAttribute('hidden'));
      ok('task119: isGuardedBlessingLoss true for the non-hidden guarded lose', rules.isGuardedBlessingLoss(openLose, ob) === true);
      ok('task119: isGuardedBlessingLoss false for the hidden form', rules.isGuardedBlessingLoss(hiddenLose, ob) === false);

      const gotoNode = bsec.querySelector('goto');
      ok('task119: blessingSpendForGoto returns the held blessing preceding the goto', rules.blessingSpendForGoto(gotoNode, bsec, held, ob) === 'storm');
      ok('task119: blessingSpendForGoto null once the blessing is gone', rules.blessingSpendForGoto(gotoNode, bsec, unheld, ob) === null);

      ok('task119: blessingSpendForReroll finds the hidden keepblessing lose', rules.blessingSpendForReroll(bsec, held, ob) === 'storm');
      ok('task119: blessingSpendForReroll null once the blessing is spent', rules.blessingSpendForReroll(bsec, unheld, ob) === null);

      const solesec = parse('<section name="ts"><tick price="b" hidden="t"/><gain flag="b" blessing="storm"/></section>');
      const costNode = solesec.querySelector('[price="b"]');
      ok('task119: ownsSoleLinkedBlessing true when the sole linked blessing is held', rules.ownsSoleLinkedBlessing(costNode, 'b', solesec, held) === true);
      ok('task119: ownsSoleLinkedBlessing false when not held', rules.ownsSoleLinkedBlessing(costNode, 'b', solesec, unheld) === false);
    }

    // --- task 119 (phase 1b): reward / payment eligibility planners ------------------
    {
      const sec = parse('<section name="tr"><tick price="k" hidden="t"/><gain flag="k" blessing="storm"/><gain flag="k" curse="Bogwater"/><random flag="r"/><lose shards="10" price="r"/></section>');
      ok('task119: linkedRewards returns the flagged rewards', rules.linkedRewards(sec, 'k').length === 2);
      ok('task119: linkedRewards empty for an unknown key', rules.linkedRewards(sec, 'zzz').length === 0);
      ok('task119: isChooseOne true for 2+ heterogeneous rewards', rules.isChooseOne(sec, 'k') === true);

      const pureItem = parse('<section><tick price="p"/><item flag="p" name="a"/><item flag="p" name="b"/></section>');
      ok('task119: isChooseOne false for a pure item-family barter', rules.isChooseOne(pureItem, 'p') === false);
      ok('task119: isPricedItemAward true for a priced pure item-family reward', rules.isPricedItemAward(pureItem, 'p') === true);

      ok('task119: hasVisiblePay false for a hidden price', rules.hasVisiblePay(sec, 'k') === false);
      ok('task119: hasVisiblePay true for a visible price', rules.hasVisiblePay(sec, 'r') === true);
      ok('task119: isRollGate true for a flag-linked roll', rules.isRollGate(sec, 'r') === true);
      ok('task119: isRollGate false for a plain reward key', rules.isRollGate(sec, 'k') === false);

      ok('task119: isCounterReward true for a named counter tick', rules.isCounterReward(parse('<tick name="Bonus" count="1"/>')) === true);
      ok('task119: isCounterReward false for a plain tick', rules.isCounterReward(parse('<tick codeword="X"/>')) === false);

      ok('task119: isOptionalForce true for force="f"', rules.isOptionalForce(parse('<lose shards="5" force="f"/>')) === true);
      ok('task119: isOptionalForce false for force="t"', rules.isOptionalForce(parse('<lose shards="5" force="t"/>')) === false);

      ok('task119: forcedChoiceGroup returns "dock" for a force="f" set dock', rules.forcedChoiceGroup(parse('<set dock="Sokara" force="f"/>')) === 'dock');
      const twoLose = parse('<p><lose item="a" force="f"/><lose item="b" force="f"/></p>');
      const firstLose = twoLose.querySelector('lose');
      ok('task119: forcedChoiceGroup groups 2+ sibling force="f" losses by parent', rules.forcedChoiceGroup(firstLose) === firstLose.parentElement);

      ok('task119: isEconomicPayment true for a shards spend', rules.isEconomicPayment(parse('<lose shards="10"/>')) === true);
      ok('task119: isEconomicPayment false for a stamina penalty', rules.isEconomicPayment(parse('<lose stamina="2"/>')) === false);
      ok('task119: isEconomicPayment false for force="f"', rules.isEconomicPayment(parse('<lose shards="10" force="f"/>')) === false);

      const wr = GameState.create({ name:'WR119', gender:'m', profession:'Warrior', book:1, adv });
      wr.addBlessing('storm');
      ok('task119: rewardWasteReason flags an already-held blessing', /already have this blessing/i.test(rules.rewardWasteReason(wr, parse('<gain blessing="storm"/>')) || ''));
      ok('task119: rewardWasteReason null for a fresh blessing', rules.rewardWasteReason(wr, parse('<gain blessing="luck"/>')) === null);
    }

    // --- task 119 (phase 1c): DOM-free navigation-gate planners (render-gates.js) ----
    {
      // computeFightGate: a goto after a fight is gated; a "you lose" goto is the lose-branch.
      const fsec = parse('<section name="tf"><fight/><p>If you win, <goto section="10"/>. If you lose, <goto section="20"/>.</p></section>');
      const fg = gates.computeFightGate(fsec, new Set());
      const fgotos = Array.from(fsec.querySelectorAll('goto'));
      ok('task119: computeFightGate gates the post-fight navigation', !!fg && fg.navNodes.size === 2, fg ? 'n=' + fg.navNodes.size : 'null');
      ok('task119: computeFightGate marks only the lose-branch goto', fg.loseNodes.has(fgotos[1]) && !fg.loseNodes.has(fgotos[0]));

      ok('task119: aggregateFightOutcome win when all won', gates.aggregateFightOutcome([{ outcome:'win' }, { outcome:'win' }]) === 'win');
      ok('task119: aggregateFightOutcome lose if any lost', gates.aggregateFightOutcome([{ outcome:'win' }, { outcome:'lose' }]) === 'lose');
      ok('task119: aggregateFightOutcome null while unresolved', gates.aggregateFightOutcome([{ outcome:'win' }, { outcome:null }]) === null);
      ok('task119: aggregateFightOutcome null for no fights', gates.aggregateFightOutcome([]) === null);

      // computeEscapeCodewords: a codeword both ticked and used as a box gate, in a fight section.
      const ecw = gates.computeEscapeCodewords(parse('<section name="te"><fight/><tick codeword="Flee1"/><choice box="Flee1" section="9">Surrender</choice></section>'));
      ok('task119: computeEscapeCodewords finds the ticked box-gated codeword', ecw.has('Flee1'));
      ok('task119: computeEscapeCodewords empty without a fight', gates.computeEscapeCodewords(parse('<section><tick codeword="X"/><choice box="X"/></section>')).size === 0);

      const clr = parse('<lose codeword="Flee1"/>');
      ok('task119: isDeferredEscapeClear defers while the fight is unresolved', gates.isDeferredEscapeClear(clr, new Set(['Flee1']), [{ outcome:null }]) === true);
      ok('task119: isDeferredEscapeClear applies once the fight is won', gates.isDeferredEscapeClear(clr, new Set(['Flee1']), [{ outcome:'win' }]) === false);
      ok('task119: isDeferredEscapeClear no-op before any fight', gates.isDeferredEscapeClear(clr, new Set(['Flee1']), []) === false);

      ok('task119: isDeferredTagCleanup true for a hidden removetag tick', gates.isDeferredTagCleanup(parse('<tick hidden="t" removetag="Tz"/>')) === true);
      ok('task119: isDeferredTagCleanup false for a plain tick', gates.isDeferredTagCleanup(parse('<tick codeword="X"/>')) === false);

      ok('task119: isDeferredDeadChain defers a dead-gated if while the fight is unresolved', gates.isDeferredDeadChain(parse('<if dead="f"/>'), [{ outcome:null }]) === true);
      ok('task119: isDeferredDeadChain applies once the fight resolves', gates.isDeferredDeadChain(parse('<if dead="f"/>'), [{ outcome:'win' }]) === false);

      const rg = gates.computeRollGate(parse('<section name="tr2"><random/><outcomes><outcome range="1-6" section="5"/></outcomes><choices><choice section="8">Leave</choice></choices></section>'));
      ok('task119: computeRollGate gates the onward choice behind the mandatory roll', !!rg && rg.navNodes.size === 1, rg ? 'n=' + rg.navNodes.size : 'null');
      ok('task119: computeRollGate null without an outcomes table', gates.computeRollGate(parse('<section><random/><choices><choice section="8"/></choices></section>')) === null);

      const tg = gates.computeTransferGate(parse('<section name="tt"><transfer to="x" shards="10"/><goto section="9"/></section>'));
      ok('task119: computeTransferGate gates navigation after a forced transfer', !!tg && tg.navNodes.size === 1, tg ? 'n=' + tg.navNodes.size : 'null');
      ok('task119: computeTransferGate null for a force="f" (optional) transfer', gates.computeTransferGate(parse('<section><transfer to="x" shards="10" force="f"/><goto section="9"/></section>')) === null);
    }

    // --- task 119 (phase 2): DOM-free visit-state serialization (visit-state.js) ------
    {
      const ctx = visit.newCtx();
      ok('task119: newCtx has the ctx shape', ctx.applied instanceof Set && ctx.rolls instanceof Map && ctx.usedSource === null);

      const sec = parse('<section name="tv"><p>Go <goto section="9"/>.</p><items group="g" limit="2"/><group><random/><tick special="lock" cache="bet"/></group></section>');
      const pNode = visit.resolveNodePath('r.0', sec); // the <p> — a real node in the parsed tree
      ok('task119: resolveNodePath resolves a positional path to its node', pNode != null && pNode === sec.childNodes[0]);
      ok('task119: resolveNodePath null for a bad path', visit.resolveNodePath('r.9.9', sec) === null);

      ctx.applied.add('pay@r.0');
      ctx.rolls.set('roll@r.1', { total: 7 });
      ctx.awardCounts.set('k', 3);
      ctx.pathNodes.set('r.0', pNode);
      ctx.usedSource = pNode;

      const flat = visit.serializeCtx(ctx);
      ok('task119: serializeCtx flattens Sets/Maps + records usedSource as a path', Array.isArray(flat.applied) && flat.applied.includes('pay@r.0') && flat.usedSourcePath === 'r.0');

      const back = visit.deserializeCtx(flat, sec);
      ok('task119: deserializeCtx restores the memo', back.applied.has('pay@r.0') && back.rolls.get('roll@r.1').total === 7 && back.awardCounts.get('k') === 3);
      ok('task119: deserializeCtx re-resolves usedSource to the node', back.usedSource === pNode);
      ok('task119: deserializeCtx rebuilds group caps + lock caches from the section', back.groupLimits.get('g') === 2 && back.rollLockCaches.has('bet'));

      // begin()'s fresh-entry scaffold shares rebuildVisitScaffold (task 119): passing
      // state resets each roll-lock cache to unlocked (re-bet on a new visit); a resume
      // omits it and keeps a bet the player already locked.
      const gLock = GameState.create({ name:'VL119', gender:'m', profession:'Warrior', book:1, adv });
      gLock.lockCache('bet', true);
      const freshCtx = visit.newCtx();
      visit.rebuildVisitScaffold(freshCtx, sec, gLock);
      ok('task119: rebuildVisitScaffold with state (fresh entry) unlocks roll-lock caches',
         gLock.isCacheLocked('bet') === false && freshCtx.rollLockCaches.has('bet'));
      gLock.lockCache('bet', true);
      const resumeCtx = visit.newCtx();
      visit.rebuildVisitScaffold(resumeCtx, sec);
      ok('task119: rebuildVisitScaffold without state (resume) keeps a locked bet',
         gLock.isCacheLocked('bet') === true && resumeCtx.rollLockCaches.has('bet'));

      const frame = { book: 2, section: '5', sectionTodock: 'Dock', vars: { x: 1 }, location: 'Loc', entryTicks: 3, usedSource: pNode, ctx };
      const fflat = visit.serializeFrame(frame);
      ok('task119: serializeFrame flattens the frame and its ctx', fflat.book === 2 && fflat.section === '5' && fflat.usedSourcePath === 'r.0' && Array.isArray(fflat.ctx.applied));
    }

    // --- task 119 (phase 3): classifyPassive — the renderPassive decision cascade ----
    {
      const g = GameState.create({ name:'CP119', gender:'m', profession:'Warrior', book:1, adv });
      // The renderer's per-visit rule surface as a plain object (the Story satisfies it).
      const view = (sec, over = {}) => ({
        state: g, sectionEl: sec, inactive: false, hasDecline: false,
        outcomeBlessings: rules.computeOutcomeBlessings(sec), escapeCodewords: new Set(),
        sectionFights: [], fightGate: null, whileIterPendingVars: null, ctx: visit.newCtx(),
        ...over,
      });
      const classify = (sec, sel, over) => rules.classifyPassive(sec.querySelector(sel), view(sec, over));

      const plain = parse('<section><lose stamina="2">Lose 2 Stamina</lose></section>');
      ok('task119: classifyPassive plain effect → apply, words shown',
         (() => { const v = classify(plain, 'lose'); return v.mode === 'apply' && v.showWords === true; })());
      ok('task119: classifyPassive inactive branch → inert', classify(plain, 'lose', { inactive: true }).mode === 'inert');

      const storm = parse('<section><outcome blessing="storm"/><lose blessing="storm">lose it</lose></section>');
      ok('task119: classifyPassive guarded blessing loss → inert with words',
         (() => { const v = classify(storm, 'lose'); return v.mode === 'inert' && v.showWords === true; })());

      const pend = parse('<section><lose multiple="x">some</lose><random var="x"/></section>');
      ok('task119: pendingRollVar names the unrolled var a section roll will fill',
         rules.pendingRollVar(pend.querySelector('lose'), g, pend) === 'x');
      ok('task119: classifyPassive defers on a pending roll var', classify(pend, 'lose').mode === 'inert');

      const esc = parse('<section><fight/><lose codeword="Flee1"/></section>');
      ok('task119: classifyPassive deferred escape clear → inert',
         classify(esc, 'lose', { escapeCodewords: new Set(['Flee1']), sectionFights: [{ outcome: null }] }).mode === 'inert');

      ok('task119: classifyPassive hidden removetag tick → defer-cleanup',
         classify(parse('<section><tick hidden="t" removetag="Tz"/></section>'), 'tick').mode === 'defer-cleanup');

      const hp = parse('<section><tick price="k" hidden="t"/><gain flag="k" codeword="Chance"/></section>');
      ok('task119: classifyPassive hidden price arms and fires the lone linked reward',
         (() => { const v = classify(hp, 'tick'); return v.mode === 'arm-hidden-price' && v.fireReward === hp.querySelector('gain'); })());
      const hpItem = parse('<section><tick price="k" hidden="t"/><item flag="k" name="wand"/></section>');
      ok('task119: classifyPassive hidden price never fires an item-family reward (task 125)',
         (() => { const v = classify(hpItem, 'tick'); return v.mode === 'arm-hidden-price' && v.fireReward === null; })());

      const spin = parse('<section><lose shards="10" price="c">Pay</lose><random flag="c"/></section>');
      ok('task119: classifyPassive pay-to-spin price → roll-payment',
         (() => { const v = classify(spin, 'lose'); return v.mode === 'roll-payment' && v.key === 'c'; })());
      const buy1 = parse('<section><lose shards="10" price="p">Pay</lose><gain flag="p" codeword="X"/></section>');
      ok('task119: classifyPassive plain price → optional-pay', classify(buy1, 'lose').mode === 'optional-pay');

      const menu = parse('<section><lose shards="10" price="m">Pay</lose><gain flag="m" blessing="storm"/><lose flag="m" curse="Bogwater"/></section>');
      ok('task119: classifyPassive choose-one reward → choose-one-reward keyed on its flag',
         (() => { const v = classify(menu, 'gain'); return v.mode === 'choose-one-reward' && v.key === 'm'; })());
      ok('task119: classifyPassive single linked reward → inert (applies with the cost)',
         classify(buy1, 'gain').mode === 'inert');

      ok('task119: classifyPassive force="f" → forced-optional',
         classify(parse('<section><tick codeword="Aid" force="f">help</tick></section>'), 'tick').mode === 'forced-optional');

      const paySec = parse('<section><lose shards="10">give it</lose></section>');
      ok('task119: classifyPassive economic loss + escape route → payment',
         classify(paySec, 'lose', { hasDecline: true }).mode === 'payment');
      ok('task119: classifyPassive economic loss without an escape route → apply',
         classify(paySec, 'lose').mode === 'apply');

      ok('task119: classifyPassive ability="?" → ability-choice',
         classify(parse('<section><lose ability="?" amount="1">choose</lose></section>'), 'lose').mode === 'ability-choice');
      ok('task119: classifyPassive profession tick → profession-choice',
         classify(parse('<section><tick profession="mage|warrior">pick</tick></section>'), 'tick').mode === 'profession-choice');

      const gEq = GameState.create({ name:'CPEQ', gender:'m', profession:'Warrior', book:1, adv });
      gEq.data.items = [makeItem('weapon', 'sword'), makeItem('weapon', 'axe')];
      const eqSec = parse('<section><tick weapon="?" addbonus="1">enchant</tick></section>');
      ok('task119: classifyPassive open "?" enchant with 2 candidates → equipment-choice',
         rules.classifyPassive(eqSec.querySelector('tick'), view(eqSec, { state: gEq })).mode === 'equipment-choice');
      gEq.data.items = [makeItem('weapon', 'sword')];
      ok('task119: classifyPassive a single candidate is deterministic → apply',
         rules.classifyPassive(eqSec.querySelector('tick'), view(eqSec, { state: gEq })).mode === 'apply');

      const fSec = parse('<section><fight/><gain shards="100">loot</gain></section>');
      const fNode = fSec.querySelector('gain');
      const fGate = { effectNodes: new Map([[fNode, 'win']]) };
      ok('task119: classifyPassive fight-outcome effect held while unresolved',
         classify(fSec, 'gain', { fightGate: fGate, sectionFights: [{ outcome: null }] }).mode === 'inert');
      ok('task119: classifyPassive fight-outcome effect applies on a win',
         classify(fSec, 'gain', { fightGate: fGate, sectionFights: [{ outcome: 'win' }] }).mode === 'apply');

      const setSec = parse('<section><set var="y" value="7"/></section>');
      ok('task119: classifyPassive absolute set → apply, rerunnable',
         (() => { const v = classify(setSec, 'set'); return v.mode === 'apply' && v.rerunnable === true && v.setVarName === 'y'; })());
      const ownedCtx = visit.newCtx(); ownedCtx.rolledVars.add('y');
      ok('task119: classifyPassive a roll-owned set is frozen (task 61)',
         (() => { const v = classify(setSec, 'set', { ctx: ownedCtx }); return v.mode === 'apply' && v.rollOwned === true && v.rerunnable === false; })());
    }

    // --- task 119 (phase 3): choiceGate — the <choice> eligibility + payment verdict ---
    {
      const g = GameState.create({ name:'CG119', gender:'m', profession:'Warrior', book:1, adv });
      g.data.shards = 20;
      const gate = (xml, over = {}) => rules.choiceGate(g, parse(xml), { ctx: visit.newCtx(), ...over });

      ok('task119: choiceGate live choice → no reasons, shards pay by default',
         (() => { const v = gate('<choice section="9" shards="10">Pay 10</choice>'); return v.reasons.length === 0 && v.cost === 10 && v.payment.pay === true; })());
      ok('task119: choiceGate too-poor shards cost → needs N Shards',
         gate('<choice section="9" shards="50">Pay 50</choice>').reasons.join() === 'needs 50 Shards');
      ok('task119: choiceGate pay="f" never consumes', gate('<choice section="9" shards="10" pay="f">x</choice>').payment.pay === false);
      ok('task119: choiceGate a bare item= gate is kept (a mere requirement), not consumed',
         (() => { g.data.items = [makeItem('item', 'rope')]; const v = gate('<choice section="9" item="rope">use rope</choice>'); return v.reasons.length === 0 && v.payment.pay === false; })());
      ok('task119: choiceGate pay="t" consumes an item requirement (task 55)',
         gate('<choice section="9" item="rope" pay="t">give rope</choice>').payment.pay === true);
      ok('task119: choiceGate a missing item disables with its name', gate('<choice section="9" item="lantern">x</choice>').reasons.join() === 'needs lantern');
      ok('task119: choiceGate item="?" tags= names the tag class (task 47)',
         gate('<choice section="9" item="?" tags="light">x</choice>').reasons.join() === 'needs light');
      ok('task119: choiceGate box gate', gate('<choice section="9" box="Zx">x</choice>').reasons.join() === 'box not ticked');
      ok('task119: choiceGate profession gate', gate('<choice section="9" profession="mage">x</choice>').reasons.join() === 'mage only');
      ok('task119: choiceGate god gate', gate('<choice section="9" god="Tyrnai">x</choice>').reasons.join() === 'requires Tyrnai');
      ok('task119: choiceGate dead="t" only for the dead (task 28)', gate('<choice section="9" dead="t">x</choice>').reasons.join() === 'only if you are dead');
      ok('task119: choiceGate sail needs a ship here (task 89)',
         (() => { const v = gate('<choice section="9" sail="t">set sail</choice>'); return v.isSail === true && v.reasons.join() === 'you need a ship here'; })());
      ok('task119: choiceGate flag= locked until its payment arms it (task 30)',
         gate('<choice section="9" flag="k">spin</choice>').reasons.join() === 'not yet available');
      ok('task119: flagGate price= withheld while armed', (() => { g.setFlag('p1', true); return rules.flagGate(g, parse('<goto section="9" price="p1"/>')) === 'resolve this first'; })());
      const spentNode = parse('<choice section="9">once</choice>');
      const spentCtx = visit.newCtx(); spentCtx.usedSource = spentNode;
      ok('task119: isSpentSource marks the taken source action (task 110)', rules.isSpentSource(spentCtx, spentNode) === true);
      ok('task119: choiceGate spent source → already taken',
         rules.choiceGate(g, spentNode, { ctx: spentCtx }).reasons.join() === 'already taken');
      ok('task119: choiceGate foreign currency wallet (book2/545)',
         (() => { const v = gate('<choice section="9" shards="5" currency="Mithral">x</choice>'); return v.coinLabel === 'Mithral' && v.payment.foreignCoin === true && v.reasons.join() === 'needs 5 Mithral'; })());
    }

    // --- task 119 (phase 3): branchPlan — success/failure/outcomes resolution --------
    {
      const g = GameState.create({ name:'BP119', gender:'m', profession:'Warrior', book:1, adv });
      const ctx = visit.newCtx();
      const plan = (xml, roll, c = ctx) => rules.branchPlan(g, c, parse(xml), roll);

      ok('task119: branchPlan success waits for its roll', plan('<success section="9"/>', null).kind === 'skip');
      ok('task119: branchPlan success reveals on a successful roll', plan('<success section="9"/>', { success: true }).kind === 'reveal');
      ok('task119: branchPlan failure reveals on a failed roll', plan('<failure section="9"/>', { success: false }).kind === 'reveal');
      ok('task119: branchPlan ability= filters the chosen ability (task 109)',
         plan('<success ability="sanctity" section="9"/>', { success: true, ability: 'magic' }).kind === 'skip'
         && plan('<success ability="magic" section="9"/>', { success: true, ability: 'magic' }).kind === 'reveal');

      // var-keyed branches wait for a WRITE this visit, never a stale global (task 50)
      g.setVar('s', 3);
      ok('task119: branchPlan var branch pends until the var is written this visit',
         plan('<success var="s" section="9"/>', null).kind === 'skip');
      const wrote = visit.newCtx(); wrote.wroteVars.add('s');
      ok('task119: branchPlan var branch resolves on sign once written',
         plan('<success var="s" section="9"/>', null, wrote).kind === 'reveal'
         && plan('<failure var="s" section="9"/>', null, wrote).kind === 'skip');

      ok('task119: branchPlan lone outcome flag= needs no roll (book4/456)',
         (() => { g.setFlag('of', true); return plan('<outcome flag="of" section="9"/>', null).kind === 'reveal'; })());
      ok('task119: branchPlan lone outcome range= waits for the roll then matches',
         plan('<outcome range="1-6" section="9"/>', null).kind === 'skip'
         && plan('<outcome range="1-6" section="9"/>', { total: 4 }).kind === 'reveal'
         && plan('<outcome range="1-6" section="9"/>', { total: 9 }).kind === 'skip');
      ok('task119: branchPlan a held blessing vetoes a guarded outcome (task 108)',
         (() => { g.addBlessing('storm'); return plan('<outcome range="1-6" blessing="storm" section="9"/>', { total: 4 }).kind === 'skip'; })());

      const table = parse('<outcomes><outcome range="1-2" section="5"/><outcome range="3-6" section="7"/></outcomes>');
      ok('task119: branchPlan outcomes table pends without the roll',
         (() => { const v = rules.branchPlan(g, ctx, table, null); return v.kind === 'table' && v.reveal === null; })());
      ok('task119: branchPlan outcomes table reveals the single matching row',
         (() => { const v = rules.branchPlan(g, ctx, table, { total: 4 }); return v.kind === 'table' && v.reveal === table.children[1] && v.index === 1; })());

      // codeword-dispatch table: resolves with no roll; its bare default is the catch-all (task 122)
      const cwTable = parse('<outcomes><outcome codeword="Zealot" section="5"/><outcome section="7"/></outcomes>');
      ok('task119: branchPlan codeword-dispatch default resolves roll-lessly (task 122)',
         (() => { const v = rules.branchPlan(g, ctx, cwTable, null); return v.kind === 'table' && v.reveal === cwTable.children[1]; })());
      ok('task119: branchPlan codeword row wins when held',
         (() => { g.addCodeword('Zealot'); const v = rules.branchPlan(g, ctx, cwTable, null); return v.reveal === cwTable.children[0]; })());

      ok('task119: branchPlan non-branch element → prose', plan('<p>words</p>', null).kind === 'prose');
    }

    // --- task 119 (phase 3): groupPlan — <group> classification ----------------------
    {
      ok('task119: groupPlan routes a roll-bundling group to its roll widget (task 42)',
         (() => { const gp = rules.groupPlan(null, parse('<group><text>Try</text><random var="x"/></group>')); return gp.kind === 'roll' && gp.rollNode.tagName.toLowerCase() === 'random'; })());
      ok('task119: groupPlan wordless/effectless group → inline wrapper',
         rules.groupPlan(null, parse('<group><text>Just words</text></group>')).kind === 'inline');

      const act = rules.groupPlan(null, parse('<group><text>Buy the house</text><lose shards="200"/><tick codeword="Casa"/></group>'));
      ok('task119: groupPlan effectful labelled group → action with its effects',
         act.kind === 'action' && act.label === 'Buy the house' && act.effects.length === 2 && !act.isRevival && !act.gotoNode);

      const nav = rules.groupPlan(null, parse('<group><text>Pay and go</text><lose shards="30"/><goto section="99"/></group>'));
      ok('task119: groupPlan carries the group\'s navigation', nav.kind === 'action' && !!nav.gotoNode);

      const rev = rules.groupPlan(null, parse('<group><text>Use your deal</text><lose shards="*"/><resurrection/></group>'));
      ok('task119: groupPlan flags a no-section resurrection as a revival (task 98)', rev.kind === 'action' && rev.isRevival === true);

      const sec125 = parse('<section><group><text>Pay 100</text><lose shards="100" price="pot"/></group><item flag="pot" name="potion of restoration"/></section>');
      const linked = rules.groupPlan(sec125, sec125.querySelector('group'));
      ok('task119: groupPlan collects flag-linked awards outside the group (task 125)',
         linked.kind === 'action' && linked.linkedAwards.length === 1 && linked.linkedAwards[0].getAttribute('name') === 'potion of restoration');

      ok('task119: groupRollDefers visible cost defers to the roll', rules.groupRollDefers(parse('<lose shards="10">bet</lose>')) === true);
      ok('task119: groupRollDefers hidden book-keeping arms on entry', rules.groupRollDefers(parse('<tick price="k" hidden="t"/>')) === false);
      ok('task119: groupRollDefers a hidden cache lock still defers (task 38)', rules.groupRollDefers(parse('<tick special="lock" cache="bet" hidden="t"/>')) === true);
    }

    // --- task 119 (phase 3): grantChosenReward — the choose-one award transaction -----
    {
      const g = GameState.create({ name:'GR119', gender:'m', profession:'Warrior', book:1, adv });
      g.data.items = [];

      g.setFlag('m', true);
      const note1 = eng.grantChosenReward(g, parse('<gain flag="m" blessing="luck">Luck</gain>'), 'm', 1);
      ok('task119: grantChosenReward effect reward applies and consumes its own flag',
         g.hasBlessing('luck') && g.getFlag('m') === false, `note=${note1}`);

      g.setFlag('m', true);
      eng.grantChosenReward(g, parse('<item flag="m" name="ink sac" quantity="2"/>'), 'm', 4);
      ok('task119: grantChosenReward quantity= grants that many (§4.634, task 94)',
         g.findItems('ink sac').length === 2 && g.getFlag('m') === false);

      g.setFlag('m', true);
      const before = g.data.shards;
      eng.grantChosenReward(g, parse('<item flag="m" name="500 Shards"/>'), 'm', 1);
      ok('task119: grantChosenReward a currency award banks its value', g.data.shards === before + 500 && g.getFlag('m') === false);

      g.setFlag('m', true);
      const note2 = eng.grantChosenReward(g, parse('<resurrection flag="m" section="100" god="Elnir">deal</resurrection>'), 'm', 3);
      ok('task119: grantChosenReward arranges a resurrection deal (book defaulted)',
         g.hasResurrection() && g.data.resurrections[0].book === 3 && g.data.resurrections[0].section === '100' && g.getFlag('m') === false
         && /resurrection deal arranged/i.test(note2));

      // deduped through the engine applier: an affliction child now bites on pickup
      g.setFlag('m', true);
      eng.grantChosenReward(g, parse('<item flag="m" name="cursed idol"><curse name="Idol Curse" ability="charisma" amount="-1"/></item>'), 'm', 1);
      ok('task119: grantChosenReward item award routes through applyItemAward (curse bites on pickup)',
         g.findItems('cursed idol').length === 1 && g.hasCurse('Idol Curse'));
    }

    // --- task 113: <lose item="?" bonus="N"> enforces the bonus= filter ---
    // §4.456's Tambu offering routes its +2/+3 gifts through <lose item="?" bonus=…
    // price=…>; the bonus filter must be honoured so only a genuinely +2/+3 item can be
    // offered, and an ineligible offer must not set the price flag that opens §404/§568.
    {
      // a +2 lose takes only the +2 item and arms its price flag
      const g113 = GameState.create({ name:'T113', gender:'m', profession:'Warrior', book:4, adv });
      g113.data.items = [];
      g113.addItem(makeItem('item', 'apple'));                      // +0
      g113.addItem(makeItem('tool', 'lucky ring', 1, 'charisma'));  // +1
      g113.addItem(makeItem('weapon', 'fine blade', 2));            // +2 — the only eligible
      eng.applyEffect(parse('<lose item="?" bonus="2" price="2">a +2 item</lose>'), g113, {});
      ok('task113: a +2 lose takes only the +2 item, sparing +0/+1',
         !g113.findItems('fine blade').length && g113.findItems('apple').length === 1 && g113.findItems('lucky ring').length === 1,
         g113.data.items.map((i)=>i.name).join(','));
      ok('task113: offering a qualifying +2 item arms the price flag', g113.getFlag('2') === true);

      // no qualifying item → nothing lost, price flag stays clear
      const g113n = GameState.create({ name:'T113n', gender:'m', profession:'Warrior', book:4, adv });
      g113n.data.items = [makeItem('item', 'apple'), makeItem('tool', 'lucky ring', 1, 'charisma')]; // +0/+1 only
      eng.applyEffect(parse('<lose item="?" bonus="2" price="2">a +2 item</lose>'), g113n, {});
      ok('task113: a +2 lose with no +2 item takes nothing and leaves the flag clear',
         g113n.itemCount() === 2 && g113n.getFlag('2') !== true, 'n=' + g113n.itemCount() + ' flag=' + g113n.getFlag('2'));

      // "N+" means N or greater
      const g113h = GameState.create({ name:'T113h', gender:'m', profession:'Warrior', book:4, adv });
      g113h.data.items = [makeItem('weapon', 'ok blade', 2), makeItem('weapon', 'great blade', 4)];
      eng.applyEffect(parse('<lose item="?" bonus="3+" price="3">a +3 or greater item</lose>'), g113h, {});
      ok('task113: a "3+" lose takes a +4 item but spares a +2, and arms flag 3',
         !g113h.findItems('great blade').length && g113h.findItems('ok blade').length === 1 && g113h.getFlag('3') === true);

      // §4.456 in the app: the +2/+3 offer buttons are inert with no qualifying item
      const g456c = GameState.create({ name:'T456c', gender:'m', profession:'Warrior', book:4, adv });
      g456c.data.items = [makeItem('item', 'apple'), makeItem('tool', 'lucky ring', 1, 'charisma')]; // +0/+1 only
      const c456c = document.createElement('div');
      new Story(c456c, g456c, { navigate(){}, onDeath(){}, notify(){} }).begin(await data.getSection(4, '456'), 4, '456');
      const offer2 = Array.from(c456c.querySelectorAll('button')).find((b)=>/a \+2 item/i.test(b.textContent));
      const offer3 = Array.from(c456c.querySelectorAll('button')).find((b)=>/\+3 or greater/i.test(b.textContent));
      ok('task113: §456 the +2/+3 offers are inert without a qualifying item',
         !!offer2 && offer2.disabled && !!offer3 && offer3.disabled,
         `o2=${offer2 && offer2.disabled} o3=${offer3 && offer3.disabled}`);

      // with a +2 item the +2 offer is live; taking it removes the item, arms flag 2 and reveals →404
      const g456d = GameState.create({ name:'T456d', gender:'m', profession:'Warrior', book:4, adv });
      g456d.data.items = [makeItem('weapon', 'fine blade', 2)];
      const c456d = document.createElement('div');
      const st456d = new Story(c456d, g456d, { navigate(){}, onDeath(){}, notify(){} });
      st456d.begin(await data.getSection(4, '456'), 4, '456');
      const offer2d = Array.from(c456d.querySelectorAll('button')).find((b)=>/a \+2 item/i.test(b.textContent));
      ok('task113: §456 the +2 offer is enabled with a +2 item', !!offer2d && !offer2d.disabled);
      offer2d.click();
      ok('task113: §456 offering the +2 item takes it, arms flag 2 and reveals →404',
         !g456d.findItems('fine blade').length && g456d.getFlag('2') === true &&
         Array.from(c456d.querySelectorAll('.goto')).some((b)=>/404/.test(b.textContent)),
         `has=${g456d.findItems('fine blade').length} flag=${g456d.getFlag('2')}`);
    }

    // --- task 114: the reroll-form storm spend consumes the blessing exactly once ---
    // §232/502/716 avoid an 11-12 capsize by spending Safety from Storms via a reroll,
    // but a rerunnable keepblessing entry set defeated the hidden loss — granting
    // unlimited protection once task 108's veto took effect. The reroll must now consume
    // an ordinary blessing (a second 11-12 then capsizes →510) while a permanent survives.
    {
      window.__FL_INSTANT_DICE__ = true;
      const settle114 = () => new Promise((r) => setTimeout(r, 30));
      const rnd114 = Math.random;
      const rerollBtn = (c) => Array.from(c.querySelectorAll('.btn-secondary')).find((b) => /roll again|reroll/i.test(b.textContent));
      const goto510 = (c) => Array.from(c.querySelectorAll('.goto')).find((b) => /→\s*510/.test(b.textContent));

      // ordinary storm blessing: roll 11-12 → reroll (spends it) → a second 11-12 capsizes
      const g114 = GameState.create({ name:'T114', gender:'m', profession:'Warrior', book:5, adv });
      g114.data.shards = 100; g114.addBlessing('storm');
      const c114 = document.createElement('div');
      const st114 = new Story(c114, g114, { navigate(){}, onDeath(){}, notify(){} });
      st114.begin(await data.getSection(5, '232'), 5, '232');
      Math.random = () => 0.9; // 6+6 = 12 → range 11-12
      c114.querySelector('.btn-roll').click(); await settle114();
      ok('task114: §232 first 11-12 vetoes the capsize and offers a reroll (blessing still held)',
         !goto510(c114) && !!rerollBtn(c114) && g114.hasBlessing('storm'));
      rerollBtn(c114).click(); await settle114();
      ok('task114: taking the reroll spends the ordinary storm blessing', !g114.hasBlessing('storm'));
      c114.querySelector('.btn-roll').click(); await settle114();
      ok('task114: a second 11-12 with the blessing spent now capsizes (→510 revealed)', !!goto510(c114));

      // permanent storm blessing: the reroll never uses it up, so it keeps protecting
      const g114p = GameState.create({ name:'T114p', gender:'m', profession:'Warrior', book:5, adv });
      g114p.data.shards = 100; g114p.addBlessing('storm', true);
      const c114p = document.createElement('div');
      const st114p = new Story(c114p, g114p, { navigate(){}, onDeath(){}, notify(){} });
      st114p.begin(await data.getSection(5, '232'), 5, '232');
      Math.random = () => 0.9;
      c114p.querySelector('.btn-roll').click(); await settle114();
      rerollBtn(c114p).click(); await settle114();
      ok('task114: a permanent storm blessing survives the reroll', g114p.hasBlessing('storm') && g114p.isBlessingPermanent('storm'));
      c114p.querySelector('.btn-roll').click(); await settle114();
      ok('task114: the permanent blessing still vetoes a second 11-12 capsize', !goto510(c114p) && !!rerollBtn(c114p));

      Math.random = rnd114;
      window.__FL_INSTANT_DICE__ = false;
    }
}

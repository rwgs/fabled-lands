// FL test suite — render & interaction: rolls, choices, fights, pays, blessings, choose-one
// Extracted verbatim from web/_test.html run() lines 514-913 (task 120).
import * as data from '../js/data.js';
import { GameState, makeItem } from '../js/state.js';
import * as eng from '../js/engine.js';
import { fightRound } from '../js/combat.js';
import { buyOptions, payChoiceCost } from '../js/market.js';
import { Story } from '../js/render.js';
import { Narrator } from '../js/tts.js';
import { modal } from '../js/ui.js';

export async function run(ctx) {
  const { ok, parse } = ctx;
  await data.loadMeta();
  const adv = data.parseAdventurers(data.bookInfo(1).adventurers);
  const gs = GameState.create({ name:'Test', gender:'m', profession:'Warrior', book:1, adv });
    // render representative sections
    const container = document.createElement('div');
    const story = new Story(container, gs, { navigate(){}, onDeath(){}, notify(){} });
    async function renderSec(b,s){ const el = await data.getSection(b,s); story.state=gs; story.begin(el,b,s); return container; }

    await renderSec(1,'1');
    ok('§1 renders prose', container.textContent.length > 200);
    ok('§1 has goto link', !!container.querySelector('.goto'));

    await renderSec(1,'10');
    ok('§10 has choices', container.querySelectorAll('.choice').length >= 5, 'choices='+container.querySelectorAll('.choice').length);

    await renderSec(1,'101');
    ok('§101 has roll button', !!container.querySelector('.btn-roll'));

    await renderSec(1,'105');
    ok('§105 has fight', !!container.querySelector('.fight'));

    await renderSec(1,'142');
    ok('§142 has market trades', container.querySelectorAll('.trade').length >= 3, 'trades='+container.querySelectorAll('.trade').length);

    await renderSec(1,'106');
    ok('§106 has roll (difficulty+outcomes)', !!container.querySelector('.btn-roll'));

    // --- interaction: click the roll, expect it to resolve to a Continue link ---
    container.querySelector('.btn-roll').click();
    await new Promise(r => setTimeout(r, 1000)); // let dice animation + rerender complete
    ok('§106 roll resolves to Continue', !!container.querySelector('.goto-primary') && !!container.querySelector('.die'),
       'html=' + container.innerHTML.slice(0, 160));

    // §101: difficulty with inline-goto success/failure branches
    await renderSec(1,'101');
    container.querySelector('.btn-roll').click();
    await new Promise(r => setTimeout(r, 1000));
    const prog101 = container.querySelector('.goto, .goto-primary');
    ok('§101 roll resolves to a goto', !!prog101 && !!container.querySelector('.die'),
       'HTML=' + container.querySelector('.flow').innerHTML.replace(/\s+/g,' ').slice(0, 400));

    // §120: random + outcome ranges (travel)
    await renderSec(1,'120');
    container.querySelector('.btn-roll').click();
    await new Promise(r => setTimeout(r, 1000));
    const prog120 = container.querySelector('.goto, .goto-primary');
    ok('§120 random resolves to a goto', !!prog120 && !!container.querySelector('.die'),
       'HTML=' + container.querySelector('.flow').innerHTML.replace(/\s+/g,' ').slice(0, 400));

    // §344: a multi-ability difficulty offers an ability chooser, then a roll (task 15)
    await renderSec(1,'344');
    const pick344 = container.querySelectorAll('.ability-pick');
    ok('§344 offers a combat|magic chooser', pick344.length === 2, 'picks=' + pick344.length);
    ok('§344 has no roll button before picking', !container.querySelector('.btn-roll'));
    pick344[0].click();
    await new Promise(r => setTimeout(r, 50));
    ok('§344 shows a roll button after picking an ability', !!container.querySelector('.btn-roll'));

    // --- task 53: <difficulty modifier="noweapon"> excludes the weapon bonus -----
    // book3/235/271/290, book5/516 are unarmed COMBAT rolls: a wielded weapon must
    // NOT help. The keyword routes into the ability lookup (abilityForMode).
    const gnw = GameState.create({ name:'NW', gender:'m', profession:'Warrior', book:3, adv });
    gnw.data.items = gnw.data.items.filter((i) => i.kind !== 'weapon');
    gnw.addItem(makeItem('weapon', 'greatsword', 3)); // +3 weapon
    const combatFull = gnw.ability('combat');
    const combatBare = gnw.abilityNoWeapon('combat');
    ok('noweapon: the weapon lifts the affected COMBAT', combatFull === combatBare + 3, `full=${combatFull} bare=${combatBare}`);
    ok('rollDifficulty noweapon uses the bare COMBAT', eng.rollDifficulty(gnw,'combat',13,0,'noweapon').abilityScore === combatBare);
    ok('rollDifficulty default still counts the weapon', eng.rollDifficulty(gnw,'combat',13,0).abilityScore === combatFull);
    // noweapon is computed pre-clamp: COMBAT 11 + a +2 weapon reads 12 affected but 11 bare.
    const gcap = GameState.create({ name:'Cap', gender:'m', profession:'Warrior', book:3, adv });
    gcap.data.abilities.combat = 11; gcap.data.items = gcap.data.items.filter((i) => i.kind !== 'weapon');
    gcap.addItem(makeItem('weapon', 'runeblade', 2));
    ok('noweapon computed pre-clamp (11, not 12−2)', gcap.ability('combat') === 12 && gcap.abilityNoWeapon('combat') === 11, `aff=${gcap.ability('combat')} bare=${gcap.abilityNoWeapon('combat')}`);
    // §3.235 rendered roll uses the bare COMBAT, not the weapon-boosted score.
    const c235 = document.createElement('div');
    const story235 = new Story(c235, gnw, { navigate(){}, onDeath(){}, notify(){} });
    const s235 = await data.getSection(3,'235'); story235.begin(s235,3,'235');
    c235.querySelector('.btn-roll').click();
    await new Promise(r => setTimeout(r, 1000)); // the roll button animates the dice before storing
    const roll235 = Array.from(story235.ctx.rolls.values()).find((r) => r && typeof r.abilityScore === 'number');
    ok('§3.235 rolled COMBAT excludes the weapon bonus', !!roll235 && roll235.abilityScore === combatBare, JSON.stringify(roll235));

    // §59: bare <training> ("choose the ability of your choice") offers all six (task 15)
    await renderSec(5,'59');
    ok('§59 bare training offers a six-ability chooser', container.querySelectorAll('.ability-pick').length === 6,
       'picks=' + container.querySelectorAll('.ability-pick').length);

    // §123: <success>/<failure> inside a <choices> table resolve the swim roll (task 22)
    await renderSec(1,'123');
    ok('§123 shows the swim difficulty roll', !!container.querySelector('.btn-roll'));
    ok('§123 renders its plain choices too', container.querySelectorAll('.choice').length >= 4, 'choices=' + container.querySelectorAll('.choice').length);
    ok('§123 hides the swim branch until rolled', !container.querySelector('.branch .goto-primary'));
    container.querySelector('.btn-roll').click();
    await new Promise(r => setTimeout(r, 1000));
    ok('§123 reveals a swim outcome (→53 or →76) after rolling', /Continue → (53|76)/.test(container.textContent),
       (container.querySelector('.choices') || container).textContent.replace(/\s+/g,' ').slice(0, 200));

    // --- task 100: <while> loops repeat until their var is assigned -----------
    {
      // DOM-free terminal test: a <while var> keeps looping while its var is
      // UNassigned; assigning any value (even 0) stops it (JaFL isVariableDefined).
      const gW = GameState.create({ name:'W', gender:'m', profession:'Warrior', book:5, adv });
      const wnode = parse('<while var="free"/>');
      ok('whileLoopDone: unset var keeps looping', eng.whileLoopDone(wnode, gW) === false);
      gW.setVar('free', 1);
      ok('whileLoopDone: an assigned var stops the loop', eng.whileLoopDone(wnode, gW) === true);
      gW.setVar('free', 0);
      ok('whileLoopDone: assigned 0 still counts as assigned', eng.whileLoopDone(wnode, gW) === true);
      ok('whileLoopDone: no var= never loops', eng.whileLoopDone(parse('<while/>'), gW) === true);

      // Variables are section-local: entering a section clears leftovers so a leaked
      // loop var cannot skip the loop.
      const gClr = GameState.create({ name:'CV', gender:'m', profession:'Warrior', book:1, adv });
      gClr.setVar('y', 5);
      const storyClr = new Story(document.createElement('div'), gClr, { navigate(){}, onDeath(){}, notify(){} });
      storyClr.begin(await data.getSection(1,'1'), 1, '1');
      ok('entering a section clears leftover variables', !gClr.hasVar('y'), 'vars=' + JSON.stringify(gClr.data.vars));

      window.__FL_INSTANT_DICE__ = true;
      const nextRoll = (c) => Array.from(c.querySelectorAll('.btn-roll')).find(b => !b.disabled);
      const loopRoll = (c) => Array.from(c.querySelectorAll('.while-loop .btn-roll')).find(b => !b.disabled);
      const settle = () => new Promise(r => setTimeout(r, 30));

      // §5.218 — fail the troll's grapple, then loop a COMBAT re-attempt until you
      // wriggle free. Outcomes are forced through the COMBAT ability (cursed = always
      // fail; 12 = always beat the level-12 grapple) so the test needs no dice control.
      const g218 = GameState.create({ name:'T', gender:'m', profession:'Warrior', book:5, adv });
      g218.data.stamina = 999; g218.data.staminaMax = 999;    // survive repeated choke damage
      g218.setAbilityFlag('combat', 'cursed', true);           // every COMBAT roll fails
      const c218 = document.createElement('div');
      const story218 = new Story(c218, g218, { navigate(){}, onDeath(){}, notify(){} });
      story218.begin(await data.getSection(5,'218'), 5, '218');
      ok('§5.218 shows the grapple roll and (pre-fail) the fight', !!nextRoll(c218) && !!c218.querySelector('.fight'));
      nextRoll(c218).click(); await settle();                  // fail the initial grapple
      const stEnter = g218.data.stamina;
      ok('§5.218 failing the grapple opens the wriggle-free loop', !!nextRoll(c218) && !g218.hasVar('free'));
      ok('§5.218 a live loop hides the fight until you are free', !c218.querySelector('.fight'));
      nextRoll(c218).click(); await settle();                  // fail a loop attempt
      ok('§5.218 a failed loop attempt repeats (does not stop after one pass)', !!nextRoll(c218) && !g218.hasVar('free'));
      ok('§5.218 each failed attempt costs 3 Stamina', g218.data.stamina === stEnter - 3, `stam=${g218.data.stamina} was=${stEnter}`);
      nextRoll(c218).click(); await settle();                  // and again
      ok('§5.218 keeps looping while you keep failing', !!nextRoll(c218) && !g218.hasVar('free') && g218.data.stamina === stEnter - 6);
      g218.setAbilityFlag('combat', 'cursed', false); g218.data.abilities.combat = 12; // now succeed
      loopRoll(c218).click(); await settle();                  // wriggle free
      ok('§5.218 succeeding assigns free and ends the loop (no live loop roll)', g218.hasVar('free') && !loopRoll(c218), `free=${g218.hasVar('free')} loopRoll=${!!loopRoll(c218)}`);
      ok('§5.218 the fight reappears once you are free', !!c218.querySelector('.fight'));

      // §6.700 — a die of Stamina damage; on a six keep re-rolling & losing until a
      // non-six. Reseed before each click to force the single die (6 to keep looping,
      // 1 to break out); assert the seeds first so a PRNG mismatch fails loudly here.
      eng.seedRng(4); ok('§6.700 forcing seed 4 rolls a 6', eng.rollD6() === 6);
      eng.seedRng(7); ok('§6.700 forcing seed 7 rolls a 1', eng.rollD6() === 1);
      const g700 = GameState.create({ name:'S', gender:'m', profession:'Warrior', book:6, adv });
      g700.data.stamina = 999; g700.data.staminaMax = 999;
      const c700 = document.createElement('div');
      const hasExit = () => !!c700.querySelector('.goto');
      const story700 = new Story(c700, g700, { navigate(){}, onDeath(){}, notify(){} });
      story700.begin(await data.getSection(6,'700'), 6, '700');
      const st700 = g700.data.stamina;
      ok('§6.700 shows the initial die and (no six yet) the exit', !!nextRoll(c700) && hasExit() && !g700.hasVar('y'));
      eng.seedRng(4); nextRoll(c700).click(); await settle();  // initial roll = 6
      ok('§6.700 the initial six costs 6 Stamina', g700.data.stamina === st700 - 6, `stam=${g700.data.stamina}`);
      ok('§6.700 a six opens the re-roll loop and blocks the exit', !!nextRoll(c700) && !g700.hasVar('y') && !hasExit());
      eng.seedRng(4); nextRoll(c700).click(); await settle();  // loop roll = 6 → repeat
      ok('§6.700 another six repeats the loop (fresh roll) and takes 6 more', !!nextRoll(c700) && !g700.hasVar('y') && g700.data.stamina === st700 - 12);
      eng.seedRng(7); nextRoll(c700).click(); await settle();  // loop roll = 1 → stop
      ok('§6.700 a non-six ends the loop and reopens the exit', g700.hasVar('y') && !nextRoll(c700) && hasExit());
      ok('§6.700 the final die costs its 1 Stamina (13 lost overall)', g700.data.stamina === st700 - 13, `stam=${g700.data.stamina}`);

      eng.seedRng(null);                  // revert to Math.random for later tests
      window.__FL_INSTANT_DICE__ = false; // restore
    }

    // --- interaction: clicking a choice navigates ---
    let navd = null;
    const story3 = new Story(container, gs, { navigate:(b,s)=>{navd={b,s};}, onDeath(){}, notify(){} });
    const s10 = await data.getSection(1,'10'); story3.begin(s10,1,'10');
    const firstChoice = Array.from(container.querySelectorAll('.choice')).find(c => !c.disabled);
    firstChoice.click();
    ok('choice click navigates', navd && String(navd.b)==='1', 'navd='+JSON.stringify(navd));

    // --- interaction: fight Attack click advances the fight ---
    // This flaked ~half the runs (task 84). Two causes, both removed here:
    //   1. The attack handler awaits animateDice (a setInterval(70ms)×8) before
    //      fightRound writes the log; Chrome's --virtual-time-budget occasionally
    //      starves that interval. → use the built-in __FL_INSTANT_DICE__ hook so
    //      animateDice resolves immediately with no timer.
    //   2. On a round that KILLS the player, the handler rerenders the section and the
    //      running .fight-log is gone (log=0). The shared `gs` was drained by earlier
    //      tests, so an unlucky roll sometimes killed it. → use a fresh, high-stamina
    //      state that cannot die in one round (a won fight still shows the log).
    window.__FL_INSTANT_DICE__ = true;
    const gFight = GameState.create({ name:'FL', gender:'m', profession:'Warrior', book:1, adv });
    gFight.data.stamina = 99; gFight.data.staminaMax = 99;
    const cFight = document.createElement('div');
    const storyF = new Story(cFight, gFight, { navigate(){}, onDeath(){}, notify(){} });
    const s105 = await data.getSection(1,'105'); storyF.begin(s105,1,'105');
    cFight.querySelector('.fight .btn-roll').click();
    for (let i = 0; i < 100 && cFight.querySelectorAll('.fight-log div').length === 0; i++) {
      await new Promise(r => setTimeout(r, 10));
    }
    ok('fight attack produces a log line', cFight.querySelectorAll('.fight-log div').length >= 1,
       'log='+cFight.querySelectorAll('.fight-log div').length);
    window.__FL_INSTANT_DICE__ = false; // restore for the following tests (re-enabled later where needed)

    // --- task 146: a slow dice animation must not land its result on the wrong visit ---
    // A roll/attack awaits the ~0.5s dice animation before it runs; if the player leaves
    // the section in that window, begin() swaps story.ctx and the pending result would be
    // written into the NEW visit (or mutate state after the player has gone). Hold the
    // animation open with a controllable gate (INSTANT collapses the window, so tests need
    // the seam), swap the ctx as navigation does, then release: the result must be dropped.
    {
      window.__FL_INSTANT_DICE__ = false;
      let releaseDice = null;
      window.__FL_DICE_GATE__ = () => new Promise((res) => { releaseDice = res; });
      const settle = () => new Promise(r => setTimeout(r, 20));

      // control: released without navigating, the roll still lands normally (proves the
      // gate seam resolves onRoll — so the negative cases below aren't passing trivially).
      const gCtl = GameState.create({ name:'RC', gender:'m', profession:'Warrior', book:6, adv });
      gCtl.data.stamina = 999; gCtl.data.staminaMax = 999;
      const cCtl = document.createElement('div');
      const storyCtl = new Story(cCtl, gCtl, { navigate(){}, onDeath(){}, notify(){} });
      storyCtl.begin(await data.getSection(6,'700'), 6, '700');
      cCtl.querySelector('.btn-roll').click();            // handler suspends on the gate
      releaseDice();                                       // finish the animation, no nav
      await settle();
      ok('§6.700 roll released in place still lands its result', storyCtl.ctx.rolls.size >= 1,
         'rolls=' + storyCtl.ctx.rolls.size);

      // roll: navigate away mid-animation → the pending result lands on NO visit.
      const gRoll = GameState.create({ name:'RS', gender:'m', profession:'Warrior', book:6, adv });
      gRoll.data.stamina = 999; gRoll.data.staminaMax = 999;
      const cRoll = document.createElement('div');
      const storyRoll = new Story(cRoll, gRoll, { navigate(){}, onDeath(){}, notify(){} });
      storyRoll.begin(await data.getSection(6,'700'), 6, '700');
      cRoll.querySelector('.btn-roll').click();            // handler suspends on the gate
      storyRoll.begin(await data.getSection(1,'1'), 1, '1'); // navigation swaps story.ctx
      const rollCtxAfter = storyRoll.ctx;
      releaseDice();
      await settle();
      ok('a roll resolved after navigating away is dropped, not written to the new visit',
         rollCtxAfter.rolls.size === 0, 'rolls=' + rollCtxAfter.rolls.size);

      // fight: navigate away mid-animation → the strike is dropped (no log line appended).
      const gFib = GameState.create({ name:'FB', gender:'m', profession:'Warrior', book:1, adv });
      gFib.data.stamina = 99; gFib.data.staminaMax = 99;
      const cFib = document.createElement('div');
      const storyFib = new Story(cFib, gFib, { navigate(){}, onDeath(){}, notify(){} });
      storyFib.begin(await data.getSection(1,'105'), 1, '105');
      const fibFight = [...storyFib.ctx.fights.values()][0];
      const logBefore = fibFight.log.length;
      cFib.querySelector('.fight .btn-roll').click();      // Attack — handler suspends on the gate
      storyFib.begin(await data.getSection(1,'1'), 1, '1'); // navigation swaps story.ctx
      releaseDice();
      await settle();
      ok('an attack resolved after navigating away strikes nothing (no log line)',
         fibFight.log.length === logBefore, `log=${fibFight.log.length} was=${logBefore}`);

      delete window.__FL_DICE_GATE__;
    }

    // combat terminates
    const fgEl = await data.getSection(1,'105');
    story.begin(fgEl,1,'105');
    const fight = { name:'X', combat:5, defence:8, stamina:9, maxStamina:9, playerFirst:true, outcome:null, log:[] };
    let guard=0;
    while(!fight.outcome && !gs.isDead() && guard<500){ fightRound(gs, fight, null); guard++; }
    ok('combat terminates', (fight.outcome==='win'||gs.isDead()) && guard<500, 'guard='+guard+' outcome='+fight.outcome);

    // --- task 21: flee / fightdamage do not auto-apply; fire on the event ---
    // §207: the <flee> wound + "ran away" codeword must NOT apply on render.
    const gf1 = GameState.create({ name:'F1', gender:'m', profession:'Warrior', book:2, adv });
    gf1.data.stamina = 30; gf1.data.staminaMax = 30;
    const stam1 = gf1.data.stamina;
    let navF1 = null;
    const cf1 = document.createElement('div');
    const storyF1 = new Story(cf1, gf1, { navigate:(b,s)=>{navF1={b,s};}, onDeath(){}, notify(){} });
    const s207 = await data.getSection(2,'207'); storyF1.begin(s207,2,'207');
    ok('§207 flee wound NOT auto-applied on render', gf1.data.stamina === stam1 && !gf1.hasCodeword('2.207.1'), `st=${gf1.data.stamina} cw=${gf1.hasCodeword('2.207.1')}`);
    const fleeBtn207 = Array.from(cf1.querySelectorAll('.fight-controls button')).find((b)=>/Flee/.test(b.textContent));
    ok('§207 shows a Flee button (found inside a <p>)', !!fleeBtn207);
    fleeBtn207.click();
    ok('§207 fleeing applies the parting wound + codeword', gf1.data.stamina <= stam1 - 1 && gf1.data.stamina >= stam1 - 6 && gf1.hasCodeword('2.207.1'), `st=${gf1.data.stamina} cw=${gf1.hasCodeword('2.207.1')}`);

    // §105: <fightdamage> (ScorpionSting) must NOT set its codeword on render.
    const gf2 = GameState.create({ name:'F2', gender:'m', profession:'Warrior', book:1, adv });
    const cf2 = document.createElement('div');
    const storyF2 = new Story(cf2, gf2, { navigate(){}, onDeath(){}, notify(){} });
    const s105b = await data.getSection(1,'105'); storyF2.begin(s105b,1,'105');
    ok('§105 fightdamage NOT applied on render (ScorpionSting unset)', !gf2.hasCodeword('ScorpionSting'));

    // fightdamage type="add" applies its effect AND the Stamina loss, per wound.
    const gf3 = GameState.create({ name:'F3', gender:'m', profession:'Warrior', book:1, adv });
    gf3.data.stamina = 50; gf3.data.staminaMax = 50;
    const dmgAdd = parse('<fightdamage type="add"><tick codeword="ScorpionSting" hidden="t"/></fightdamage>');
    const fight3 = { name:'Scorp', combat:10, defence:2, stamina:50, maxStamina:50, winThreshold:0, playerFirst:false, outcome:null, log:[] };
    const st3 = gf3.data.stamina;
    fightRound(gf3, fight3, dmgAdd);
    ok('fightdamage type=add: effect + Stamina loss on a wound', gf3.hasCodeword('ScorpionSting') && gf3.data.stamina < st3, `cw=${gf3.hasCodeword('ScorpionSting')} st=${gf3.data.stamina}/${st3}`);

    // fightdamage type="replace" substitutes its effect for the Stamina loss.
    const gf4 = GameState.create({ name:'F4', gender:'m', profession:'Warrior', book:5, adv });
    gf4.data.stamina = 50; gf4.data.staminaMax = 50; gf4.data.abilities.combat = 8;
    const dmgRep = parse('<fightdamage type="replace"><lose ability="combat" amount="1"/></fightdamage>');
    const fight4 = { name:'Hangman', combat:20, defence:2, stamina:50, maxStamina:50, winThreshold:0, playerFirst:false, outcome:null, log:[] };
    const stB = gf4.data.stamina, combatB = gf4.abilityNatural('combat');
    fightRound(gf4, fight4, dmgRep);
    ok('fightdamage type=replace: ability lost, Stamina untouched', gf4.data.stamina === stB && gf4.abilityNatural('combat') === combatB - 1, `st=${gf4.data.stamina}/${stB} combat=${gf4.abilityNatural('combat')}/${combatB}`);

    // §662: a <choice flee="t"> is exempt from the fight gate and applies the wound.
    const gf5 = GameState.create({ name:'F5', gender:'m', profession:'Warrior', book:3, adv });
    gf5.data.stamina = 30; gf5.data.staminaMax = 30;
    let navF5 = null;
    const cf5 = document.createElement('div');
    const storyF5 = new Story(cf5, gf5, { navigate:(b,s)=>{navF5={b,s};}, onDeath(){}, notify(){} });
    const s662 = await data.getSection(3,'662'); storyF5.begin(s662,3,'662');
    const fightOn = Array.from(cf5.querySelectorAll('.choice')).find((c)=>/Fight on and win/i.test(c.textContent));
    ok('§662 normal post-fight choice IS gated until resolved', !!fightOn && fightOn.disabled === true, fightOn ? `disabled=${fightOn.disabled}` : 'no choice');
    const fleeChoice = Array.from(cf5.querySelectorAll('.choice')).find((c)=>/Flee from the tower/i.test(c.textContent));
    ok('§662 flee="t" choice stays live during the fight', !!fleeChoice && fleeChoice.disabled === false, fleeChoice ? `disabled=${fleeChoice.disabled}` : 'no choice');
    const stF5 = gf5.data.stamina;
    fleeChoice.click();
    ok('§662 flee="t" applies the wound and navigates to 407', gf5.data.stamina < stF5 && navF5 && String(navF5.s)==='407', `st=${gf5.data.stamina}/${stF5} nav=${JSON.stringify(navF5)}`);

    // --- task 54: mid-fight escape brackets (surrender / flee while fighting) -----
    // §2.582: codeword 2.582.1 is ticked at the top and cleared after the fight; the
    // box="2.582.1" Surrender is a live mid-fight escape while "Defeat them all"
    // (§654, the win exit) is gated until every brigand is beaten.
    const g582 = GameState.create({ name:'B582', gender:'m', profession:'Warrior', book:2, adv });
    g582.data.stamina = 40; g582.data.staminaMax = 40;
    let nav582 = null;
    const c582 = document.createElement('div');
    const story582 = new Story(c582, g582, { navigate:(b,s)=>{nav582={b,s};}, onDeath(){}, notify(){} });
    const s582 = await data.getSection(2,'582'); story582.begin(s582,2,'582');
    const surr = () => Array.from(c582.querySelectorAll('.choice')).find((b) => /Surrender/i.test(b.textContent));
    const defeat = () => Array.from(c582.querySelectorAll('.choice')).find((b) => /Defeat them all/i.test(b.textContent));
    ok('§582 Surrender is live mid-fight', !!surr() && surr().disabled === false, surr() ? `disabled=${surr().disabled} title="${surr().title}"` : 'no button');
    ok('§582 "Defeat them all" (654) gated while fighting', !!defeat() && defeat().disabled === true);
    const flee582 = Array.from(c582.querySelectorAll('.fight-controls button')).find((b) => /Flee/.test(b.textContent));
    ok('§582 shows a Flee ("beg for mercy") button', !!flee582);
    flee582.click();
    ok('§582 fleeing does NOT enable the §654 win exit', !!defeat() && defeat().disabled === true);
    ok('§582 Surrender stays live after fleeing', !!surr() && surr().disabled === false);
    // winning every fight closes the escape and opens the win exit.
    story582.ctx.fights.forEach((f) => { f.outcome = 'win'; });
    story582.rerender();
    ok('§582 winning clears the escape codeword (Surrender disabled)', !g582.hasCodeword('2.582.1') && surr().disabled === true, `cw=${g582.hasCodeword('2.582.1')} surr=${surr()?surr().disabled:'?'}`);
    ok('§582 winning opens "Defeat them all" (654)', defeat().disabled === false);

    // §3.211: "Run back to the ship" (box=3.211.flee) is a live escape; "Kill the
    // creature" is the win exit gated until the serpent is beaten.
    const g211 = GameState.create({ name:'S211', gender:'m', profession:'Warrior', book:3, adv });
    g211.data.stamina = 40; g211.data.staminaMax = 40;
    const c211 = document.createElement('div');
    const story211 = new Story(c211, g211, { navigate(){}, onDeath(){}, notify(){} });
    const s211 = await data.getSection(3,'211'); story211.begin(s211,3,'211');
    const runBack = () => Array.from(c211.querySelectorAll('.choice')).find((b) => /Run back/i.test(b.textContent));
    const kill211 = () => Array.from(c211.querySelectorAll('.choice')).find((b) => /Kill the creature/i.test(b.textContent));
    ok('§211 "Run back to the ship" is live mid-fight', !!runBack() && runBack().disabled === false);
    ok('§211 "Kill the creature" gated while fighting', !!kill211() && kill211().disabled === true);
    story211.ctx.fights.forEach((f) => { f.outcome = 'win'; });
    story211.rerender();
    ok('§211 winning closes the escape ("Run back" disabled)', runBack().disabled === true && !g211.hasCodeword('3.211.flee'));
    ok('§211 winning enables "Kill the creature"', kill211().disabled === false);

    // §2.442: the flee <group> (ticks 2.442.1, forfeits the Paladin title) makes the
    // box="2.442.1" escape live, and taking it navigates to 118.
    const g442 = GameState.create({ name:'A442', gender:'m', profession:'Warrior', book:2, adv });
    g442.addTitle('Paladin of Ravayne'); g442.data.stamina = 30; g442.data.staminaMax = 30;
    let nav442 = null;
    const c442 = document.createElement('div');
    const story442 = new Story(c442, g442, { navigate:(b,s)=>{nav442={b,s};}, onDeath(){}, notify(){} });
    const s442 = await data.getSection(2,'442'); story442.begin(s442,2,'442');
    const fleeChoice442 = () => Array.from(c442.querySelectorAll('.choice')).find((b) => /If you flee/i.test(b.textContent));
    ok('§442 "If you flee" gated before the escape group is taken', !!fleeChoice442() && fleeChoice442().disabled === true);
    const grp442 = c442.querySelector('.group-action');
    ok('§442 shows the flee group action', !!grp442);
    grp442.click();
    ok('§442 the flee group ticks the codeword and forfeits the title', g442.hasCodeword('2.442.1') && !g442.hasTitle('Paladin of Ravayne'), `cw=${g442.hasCodeword('2.442.1')} title=${g442.hasTitle('Paladin of Ravayne')}`);
    ok('§442 "If you flee" is now live (escape bypasses the fight gate)', !!fleeChoice442() && fleeChoice442().disabled === false, fleeChoice442() ? `disabled=${fleeChoice442().disabled} title="${fleeChoice442().title}"` : 'no button');
    fleeChoice442().click();
    ok('§442 taking the escape navigates to 118', nav442 && String(nav442.s) === '118', JSON.stringify(nav442));

    // --- task 55: <choice item=… pay="t"> consumes the item -----------------------
    // §2.400: giving the sprites a green gem must remove it (was kept, and still
    // satisfied later <if item> checks).
    const g400 = GameState.create({ name:'G400', gender:'m', profession:'Warrior', book:2, adv });
    g400.addItem(makeItem('item', 'green gem'));
    let nav400 = null;
    const c400 = document.createElement('div');
    const story400 = new Story(c400, g400, { navigate:(b,s)=>{nav400={b,s};}, onDeath(){}, notify(){} });
    const s400 = await data.getSection(2,'400'); story400.begin(s400,2,'400');
    const give400 = Array.from(c400.querySelectorAll('.choice')).find((b) => /Give them a green gem/i.test(b.textContent));
    ok('§400 gem choice enabled while the gem is held', !!give400 && give400.disabled === false);
    give400.click();
    ok('§400 giving the gem consumes it (pay="t")', !g400.hasItem('green gem'), `has=${g400.hasItem('green gem')}`);
    ok('§400 giving the gem navigates to 288', nav400 && String(nav400.s) === '288', JSON.stringify(nav400));
    // task 133 (Belt A): if the gem is dropped AFTER the choice renders, clicking the
    // still-enabled (stale) button must refuse — payChoiceCost re-validates the cost, so
    // there is no free crossing, and the refused click re-greys the choice on rerender.
    const g400s = GameState.create({ name:'G400s', gender:'m', profession:'Warrior', book:2, adv });
    g400s.addItem(makeItem('item', 'green gem'));
    let nav400s = null;
    const c400s = document.createElement('div');
    const story400s = new Story(c400s, g400s, { navigate:(b,s)=>{nav400s={b,s};}, onDeath(){}, notify(){} });
    story400s.begin(await data.getSection(2,'400'),2,'400');
    const give400s = () => Array.from(c400s.querySelectorAll('.choice')).find((b) => /Give them a green gem/i.test(b.textContent));
    ok('§400 stale test: gem choice starts enabled', !!give400s() && give400s().disabled === false);
    g400s.removeItemById(g400s.findItems('green gem')[0].id); // dropped; the button is not yet re-rendered
    give400s().click();
    ok('§400 dropping the gem then clicking refuses (no navigation)', nav400s === null, JSON.stringify(nav400s));
    ok('§400 the refused click re-greys the choice', !!give400s() && give400s().disabled === true, give400s() ? 'disabled='+give400s().disabled : 'none');
    // without the gem the same choice is a disabled gate (must have the item).
    const g400b = GameState.create({ name:'G400b', gender:'m', profession:'Warrior', book:2, adv });
    const c400b = document.createElement('div');
    const story400b = new Story(c400b, g400b, { navigate(){}, onDeath(){}, notify(){} });
    const s400b = await data.getSection(2,'400'); story400b.begin(s400b,2,'400');
    const give400b = Array.from(c400b.querySelectorAll('.choice')).find((b) => /Give them a green gem/i.test(b.textContent));
    ok('§400 gem choice gated without the gem', !!give400b && give400b.disabled === true);

    // §6.740: giving the raven a rope must remove the rope.
    const g740 = GameState.create({ name:'G740', gender:'m', profession:'Warrior', book:6, adv });
    g740.addItem(makeItem('item', 'rope'));
    let nav740 = null;
    const c740 = document.createElement('div');
    const story740 = new Story(c740, g740, { navigate:(b,s)=>{nav740={b,s};}, onDeath(){}, notify(){} });
    const s740 = await data.getSection(6,'740'); story740.begin(s740,6,'740');
    const give740 = Array.from(c740.querySelectorAll('.choice')).find((b) => /Give the raven some/i.test(b.textContent));
    ok('§740 rope choice enabled while the rope is held', !!give740 && give740.disabled === false);
    give740.click();
    ok('§740 giving the rope consumes it (pay="t")', !g740.hasItem('rope'), `has=${g740.hasItem('rope')}`);
    ok('§740 giving the rope navigates to 513', nav740 && String(nav740.s) === '513', JSON.stringify(nav740));

    // regression: pay="f" gates on affordability but never deducts (the cost is
    // paid at the destination — book1/142 travel choices).
    const gpf = GameState.create({ name:'PF', gender:'m', profession:'Warrior', book:1, adv });
    gpf.data.shards = 50;
    const cpf = document.createElement('div');
    const storypf = new Story(cpf, gpf, { navigate(){}, onDeath(){}, notify(){} });
    storypf.begin(parse('<section name="x"><choices><choice section="9" shards="10" pay="f">Go</choice></choices></section>'), 1, 'x');
    cpf.querySelector('.choice').click();
    ok('§ pay="f" shards choice does NOT deduct', gpf.data.shards === 50, String(gpf.data.shards));

    // --- task 149: a priced sail choice with several ships docked must DEFER the ----
    // payment until a ship is actually picked, so abandoning the which-ship chooser
    // never eats the cost (and a re-render can't charge twice).
    const g149 = GameState.create({ name:'S149', gender:'m', profession:'Warrior', book:1, adv });
    g149.data.shards = 50;
    g149.addShip({ type:'barque', name:'Ship' });
    g149.addShip({ type:'barque', name:'Ship' });
    let nav149 = null;
    const c149 = document.createElement('div');
    const story149 = new Story(c149, g149, { navigate:(b,s)=>{nav149={b,s};}, onDeath(){}, notify(){} });
    story149.begin(parse('<section name="x" dock="Kunrir"><choices><choice sail="t" section="9" shards="10" pay="t">Sail on</choice></choices></section>'), 1, 'x');
    ok('§149 two ships are docked here', g149.shipsHere().length === 2, String(g149.shipsHere().length));
    c149.querySelector('.choice').click();
    ok('§149 the sail-choice click raises the which-ship chooser', !!c149.querySelector('.ship-choice'));
    ok('§149 payment is deferred while the chooser is open', g149.data.shards === 50, String(g149.data.shards));
    ok('§149 no navigation before a ship is picked', nav149 === null, JSON.stringify(nav149));
    c149.querySelector('.ship-choice .btn-mini').click();
    ok('§149 picking a ship finally takes the 10-shard cost', g149.data.shards === 40, String(g149.data.shards));
    ok('§149 picking a ship navigates to 9', nav149 && String(nav149.s) === '9', JSON.stringify(nav149));

    // --- task 56: hidden price nodes arm silently (no phantom Pay button) ---------
    // §6.630: <tick price="a" hidden="t"/> arms the either/or SCOUTING|SANCTITY rolls
    // on entry — no button to find, both rolls live at once.
    const g630 = GameState.create({ name:'M630', gender:'m', profession:'Warrior', book:6, adv });
    const c630 = document.createElement('div');
    const story630 = new Story(c630, g630, { navigate(){}, onDeath(){}, notify(){} });
    const s630 = await data.getSection(6,'630'); story630.begin(s630,6,'630');
    ok('§630 shows no phantom Pay button', !c630.querySelector('.pay-action'));
    ok('§630 the hidden price arms its flag on entry', g630.getFlag('a') === true);
    const rolls630 = Array.from(c630.querySelectorAll('.btn-roll'));
    ok('§630 both rolls are armed (enabled) on entry', rolls630.length === 2 && rolls630.every((b) => !b.disabled), `n=${rolls630.length} disabled=${JSON.stringify(rolls630.map(b=>b.disabled))}`);

    // a hidden price with exactly one linked reward grants it on entry (book3/472:
    // a SCOUTING success sets the hidden flag → gain the codeword Chance).
    const gsr = GameState.create({ name:'SR', gender:'m', profession:'Warrior', book:3, adv });
    const csr = document.createElement('div');
    const storysr = new Story(csr, gsr, { navigate(){}, onDeath(){}, notify(){} });
    storysr.begin(parse('<section name="x"><tick codeword="Chance" flag="x">Get Chance</tick><tick price="x" hidden="t"/></section>'), 3, 'x');
    ok('hidden price grants its single linked reward', gsr.hasCodeword('Chance'));
    ok('hidden single-reward price shows no phantom button', !csr.querySelector('.pay-action'));

    // §4.127: the hidden price arms a "choose one" bet — both contestant picks live,
    // no phantom button, and neither bet is auto-placed.
    const g127 = GameState.create({ name:'B127', gender:'m', profession:'Warrior', book:4, adv });
    const c127 = document.createElement('div');
    const story127 = new Story(c127, g127, { navigate(){}, onDeath(){}, notify(){} });
    const s127 = await data.getSection(4,'127'); story127.begin(s127,4,'127');
    const picks127 = Array.from(c127.querySelectorAll('.reward-pick'));
    ok('§127 no phantom button; both bet picks armed on entry', !c127.querySelector('.pay-action') && picks127.length === 2 && picks127.every((b) => !b.disabled));
    ok('§127 no bet is auto-placed on entry', !g127.hasCodeword('4.127.1') && !g127.hasCodeword('4.127.2'));

    // task 152.2: modal() exposes a programmatic close that settles its promise AND tears
    // down the overlay + Escape listener (the game menu relies on this).
    {
      const before = document.querySelectorAll('.modal-overlay').length;
      const p = modal({ title: 'T', body: 'hi', buttons: [{ label: 'X', value: 'btn' }] });
      ok('152.2: modal opens an overlay', document.querySelectorAll('.modal-overlay').length === before + 1);
      p.close('prog');
      const resolved = await p;
      ok('152.2: programmatic close resolves the promise with its value', resolved === 'prog');
      ok('152.2: programmatic close removes that overlay', document.querySelectorAll('.modal-overlay').length === before);
    }

    // task 152.4: Narrator.handleRerender drops the chunk list even when not playing, so it
    // stops referencing the previous section's detached DOM.
    {
      const n = new Narrator();
      n.chunks = [{ el: document.createElement('p'), text: 'stale' }];
      n.index = 3;
      n.handleRerender();
      ok('152.4: handleRerender clears the stale chunk list', n.chunks.length === 0 && n.index === 0);
    }

    // task 152.5: buyOptions is the single buy-node parse — it resolves the price against
    // state, canonicalises an abbreviated cargo (task 127) and reads |-alt buytags.
    {
      const gbo = GameState.create({ name:'BO', gender:'m', profession:'Warrior', book:5, adv });
      gbo.setVar('p', 7);
      const opts = buyOptions(parse('<buy cargo="grai" shards="p" buytags="a|b"/>'), gbo);
      ok('152.5: buyOptions resolves price from a var', opts.price === 7, `price=${opts.price}`);
      ok('152.5: buyOptions canonicalises an abbreviated cargo', opts.cargo === 'grain', `cargo=${opts.cargo}`);
      ok('152.5: buyOptions reads |-alt buytags', Array.isArray(opts.tags) && opts.tags.includes('a') && opts.tags.includes('b'));
    }

    // task 150: an if/elseif/else inside a choice label is dispatched per-node via
    // renderElement (appendChildrenList), with no cross-sibling chain state — a bare
    // <else>/<elseif> must be inert, not rendered (and its effects run) unconditionally.
    {
      const g150 = GameState.create({ name:'C150', gender:'m', profession:'Warrior', book:1, adv });
      const c150 = document.createElement('div');
      const st150 = new Story(c150, g150, { navigate(){}, onDeath(){}, notify(){} });
      st150.begin(parse('<section name="t150"><choices><choice section="10"><if codeword="Nope">SEEN-IF</if><else>SEEN-ELSE</else> go on</choice></choices></section>'), 1, 't150');
      const choice150 = c150.querySelector('.choice');
      ok('task150: the choice renders', !!choice150);
      ok('task150: a false <if> in a choice label shows nothing', !!choice150 && choice150.textContent.indexOf('SEEN-IF') < 0);
      ok('task150: the trailing <else> does NOT render unconditionally', !!choice150 && choice150.textContent.indexOf('SEEN-ELSE') < 0);
    }
}

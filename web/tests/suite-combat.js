// FL test suite — combat: current-vessel, blessings, fightrounds, fights, roll branches
// Extracted verbatim from web/_test.html run() lines 2037-3175 (task 120).
import * as data from '../js/data.js';
import { GameState, makeItem, sanitizeData } from '../js/state.js';
import * as eng from '../js/engine.js';
import { fightRound, makeFight, groupFightRound, isDefeated, useWrathBlessing, useDefenceBlessing, rerollAttack } from '../js/combat.js';
import { buyTrade, sellTrade, applyInlineBuy, sellCargo } from '../js/market.js';
import { Story } from '../js/render.js';
import { renderChoice } from '../js/render-choices.js';
import * as gates from '../js/render-gates.js';
import { renderSheet } from '../js/ui.js';

export async function run(ctx) {
  const { ok, parse } = ctx;
  await data.loadMeta();
  const adv = data.parseAdventurers(data.bookInfo(1).adventurers);
  // Helpers declared earlier in the original single-scope run() and used here (task 120).
  const settle42 = () => new Promise((r) => setTimeout(r, 30));
  const activeGoto = (root, num) => Array.from(root.querySelectorAll('.goto')).some((g) => new RegExp('\\b' + num + '\\b').test(g.textContent) && !g.disabled && !g.closest('.cond-inactive'));
    // --- task 81: todock= + the sailing-ship pointer ---------------------------------
    // applyTodock moves at-large ships except the exempt (sailed) one.
    const gtd = GameState.create({ name:'TD', gender:'m', profession:'Warrior', book:1, adv });
    const t1td = gtd.addShip({ type:'barque', crew:'average', cargo:[], docked:null });
    const t2td = gtd.addShip({ type:'galleon', crew:'good', cargo:[], docked:null });
    gtd.applyTodock('Yarimura', t1td.id);
    ok('§81 applyTodock docks the non-sailed ship, keeps the exempt one at large', t2td.docked === 'Yarimura' && t1td.docked === null);
    // sailShip marks the vessel; arriving berths only it and ends the voyage.
    const gav = GameState.create({ name:'AV', gender:'m', profession:'Warrior', book:1, adv });
    const v1av = gav.addShip({ type:'barque', crew:'average', cargo:[], docked:null });
    const v2av = gav.addShip({ type:'galleon', crew:'good', cargo:[], docked:null });
    gav.sailShip(v1av.id);
    ok('§81 sailShip records the sailing ship', gav.data.sailingShipId === v1av.id);
    gav.arriveAtDock('Aku');
    ok('§81 arriving berths only the sailed ship; the other stays at large + voyage ends', v1av.docked === 'Aku' && v2av.docked === null && gav.data.sailingShipId === null);
    // Migration: sailingShipId kept only when it names an at-large ship.
    const mig81 = sanitizeData({ abilities:{combat:5}, stamina:9, ships:[{ id:'shipX', type:'barque', docked:null }], sailingShipId:'shipX' });
    ok('§81 migrate: sailingShipId kept when the ship is at large', mig81.sailingShipId === 'shipX');
    const mig81b = sanitizeData({ abilities:{combat:5}, stamina:9, ships:[{ id:'shipY', type:'barque', docked:'Aku' }], sailingShipId:'shipY' });
    ok('§81 migrate: sailingShipId dropped when the ship is docked', mig81b.sailingShipId === null);

    // DOM §4.114 (todock=Yarimura): two at-large ships; sailing takes one, the OTHER → Yarimura.
    const g114t = GameState.create({ name:'T114', gender:'m', profession:'Warrior', book:4, adv });
    const own114 = g114t.addShip({ type:'barque', name:'Old Salt', crew:'average', cargo:[], docked:null });
    g114t.sailShip(own114.id);
    const cen114 = g114t.addShip({ type:'galleon', name:'Sea Centaur', crew:'poor', cargo:[], docked:null });
    let nav114 = null;
    const c114t = document.createElement('div');
    new Story(c114t, g114t, { navigate(bk, sec){ nav114 = { bk, sec }; }, onDeath(){}, notify(){} }).begin(await data.getSection(4, '114'), 4, '114');
    ok('§4.114 both ships are at large on entry (no dock=, only todock=)', g114t.shipsHere().length === 2 && g114t.data.location === null);
    Array.from(c114t.querySelectorAll('.goto')).find((g) => /\b236\b/.test(g.textContent)).click();
    ok('§4.114 sailing with two ships prompts which to take (no navigation yet)', !!c114t.querySelector('.ship-choice') && nav114 === null);
    Array.from(c114t.querySelectorAll('.ship-choice button')).find((b) => /Centaur/.test(b.textContent)).click();
    ok('§4.114 the chosen ship stays at large; the other sails to Yarimura', cen114.docked === null && own114.docked === 'Yarimura' && nav114 && String(nav114.sec) === '236');

    // DOM §1.176 (todock=Yellowport): going ashore docks the ship; sailing keeps it at large.
    const g176a = GameState.create({ name:'A176', gender:'m', profession:'Warrior', book:1, adv });
    const sh176a = g176a.addShip({ type:'barque', crew:'average', cargo:[], docked:null });
    g176a.sailShip(sh176a.id);
    let nav176a = null;
    const c176a = document.createElement('div');
    new Story(c176a, g176a, { navigate(bk, sec){ nav176a = { bk, sec }; }, onDeath(){}, notify(){} }).begin(await data.getSection(1, '176'), 1, '176');
    Array.from(c176a.querySelectorAll('.goto')).find((g) => /\b32\b/.test(g.textContent)).click();
    ok('§1.176 going ashore docks the ship at Yellowport (non-sail exit → all ships)', sh176a.docked === 'Yellowport' && g176a.data.sailingShipId === null && nav176a && String(nav176a.sec) === '32');
    const g176b = GameState.create({ name:'B176', gender:'m', profession:'Warrior', book:1, adv });
    const sh176b = g176b.addShip({ type:'barque', crew:'average', cargo:[], docked:null });
    g176b.sailShip(sh176b.id);
    let nav176b = null;
    const c176b = document.createElement('div');
    new Story(c176b, g176b, { navigate(bk, sec){ nav176b = { bk, sec }; }, onDeath(){}, notify(){} }).begin(await data.getSection(1, '176'), 1, '176');
    Array.from(c176b.querySelectorAll('.goto')).find((g) => /\b85\b/.test(g.textContent)).click();
    ok('§1.176 sailing on keeps the ship at large and goes to 85', sh176b.docked === null && nav176b && String(nav176b.sec) === '85');

    // --- task 147: a double-clicked goto must not re-run the leave hooks ---------------
    // navigate() runs the leave hooks (applyTodock) synchronously, then app.navigate awaits
    // a possibly-slow fetch before begin() completes. A second click in that window would
    // run the hooks again — the first pass consumes _sailExempt, so the second re-docks the
    // ship just sailed. The in-flight guard ignores the re-entrant call until begin() clears
    // it. Stub navigate here never begins (mimicking a fetch still in flight).
    {
      const gdc = GameState.create({ name:'DBL', gender:'m', profession:'Warrior', book:1, adv });
      const owndc = gdc.addShip({ type:'barque', crew:'average', cargo:[], docked:null });
      gdc.sailShip(owndc.id);
      const cdc = document.createElement('div');
      let rawCalls = 0;
      const storyDc = new Story(cdc, gdc, { navigate(){ rawCalls++; }, onDeath(){}, notify(){} });
      storyDc.begin(await data.getSection(1, '176'), 1, '176'); // sets sectionTodock=Yellowport
      storyDc._sailExempt = owndc.id;   // as the sail click would: keep this ship at large
      storyDc.navigate(1, '85');         // leave once — hooks run with the exemption held
      storyDc.navigate(1, '85');         // double-click while in flight — must be ignored
      ok('§147 a double-clicked goto runs the leave hooks once (sailed ship stays at large)',
         rawCalls === 1 && owndc.docked === null, `rawCalls=${rawCalls} docked=${owndc.docked}`);
      storyDc.begin(await data.getSection(1, '85'), 1, '85'); // arriving releases the guard
      storyDc.navigate(1, '90');         // now allowed again
      ok('§147 begin() releases the guard so the next navigation runs', rawCalls === 2, `rawCalls=${rawCalls}`);
    }

    // --- task 89: ONE current-vessel rule (dock / voyage / none) -----------------------
    { // block-scoped (task 82): local consts cannot collide with the rest of run()
      // Two ships at different docks: conditions and trade see only the LOCAL vessel.
      const g89 = GameState.create({ name:'V89', gender:'m', profession:'Warrior', book:1, adv });
      g89.data.shards = 5000;
      const loc89 = g89.addShip({ type:'barque', crew:'poor', cargo:[], docked:'Kunrir' });
      const rem89 = g89.addShip({ type:'galleon', crew:'excellent', cargo:['spices'], docked:'Smogmaw' });
      g89.arriveAtDock('Kunrir');
      ok('§89 at a dock the current vessel is the ship berthed here', g89.currentShip() === loc89);
      ok('§89 remote type cannot satisfy a local <if ship=…>', eng.evaluateCondition(parse('<if ship="galleon"/>'), g89) === false && eng.evaluateCondition(parse('<if ship="barque"/>'), g89) === true);
      ok('§89 remote crew cannot satisfy a local <if crew=…>', eng.evaluateCondition(parse('<if crew="excellent"/>'), g89) === false && eng.evaluateCondition(parse('<if crew="poor"/>'), g89) === true);
      ok('§89 remote cargo cannot satisfy a local <if cargo=…>', eng.evaluateCondition(parse('<if cargo="?"/>'), g89) === false);
      ok('§89 an explicit <if docked=…> still sees the other port', eng.evaluateCondition(parse('<if docked="Smogmaw"/>'), g89) === true);
      ok('§89 market sell of remote cargo refused', sellTrade(g89, { kind:'cargo', cargoName:'spices', name:'spices' }, 100).ok === false && rem89.cargo.length === 1 && g89.data.shards === 5000);
      ok('§89 inline sellCargo of remote cargo refused', sellCargo(g89, 'spices', 100).ok === false);
      ok('§89 a cargo buy loads the local ship', buyTrade(g89, { kind:'cargo', cargoName:'silk', name:'silk' }, 10).ok === true && loc89.cargo.includes('silk') && !rem89.cargo.includes('silk'));
      ok('§89 local hold full ⇒ buy refused (remote space is no help)', buyTrade(g89, { kind:'cargo', cargoName:'furs', name:'furs' }, 10).ok === false && rem89.cargo.length === 1);
      ok('§89 selling a ship berthed elsewhere is refused', sellTrade(g89, { kind:'ship', shipType:'galleon' }, 500).ok === false && g89.ships.length === 2);
      // Inland with the fleet in port: no current vessel at all.
      g89.arriveAtDock(null);
      ok('§89 inland there is NO current vessel', g89.currentShip() === null && eng.evaluateCondition(parse('<if ship="barque"/>'), g89) === false && eng.evaluateCondition(parse('<if crew="poor"/>'), g89) === false);

      // Named cargo must match (JaFL Ship.hasCargo): "?" = any, a name = that commodity.
      const g89n = GameState.create({ name:'N89', gender:'m', profession:'Warrior', book:1, adv });
      const shn89 = g89n.addShip({ type:'galleon', crew:'average', cargo:['furs'], docked:null });
      g89n.sailShip(shn89.id);
      ok('§89 <if cargo="furs"> matches the named commodity aboard', eng.evaluateCondition(parse('<if cargo="furs"/>'), g89n) === true);
      ok('§89 <if cargo="spices"> does not match furs', eng.evaluateCondition(parse('<if cargo="spices"/>'), g89n) === false);
      ok('§89 <if cargo="?"> means any Cargo Unit', eng.evaluateCondition(parse('<if cargo="?"/>'), g89n) === true);

      // Mid-voyage the pointer picks the SAILED ship over another at-large prize.
      const g89v = GameState.create({ name:'VY89', gender:'m', profession:'Warrior', book:4, adv });
      const sail89 = g89v.addShip({ type:'barque', crew:'good', cargo:[], docked:null });
      g89v.sailShip(sail89.id);
      g89v.addShip({ type:'galleon', crew:'poor', cargo:[], docked:null }); // captured prize
      ok('§89 during a voyage the current vessel is the sailed ship, not the prize', g89v.currentShip() === sail89 && eng.evaluateCondition(parse('<if ship="barque"/>'), g89v) === true && eng.evaluateCondition(parse('<if ship="galleon"/>'), g89v) === false);

      // §4.658 wreck recovery: the sailed ship is lost at sea, the replacement bought at
      // sea becomes the current vessel (stale pointer tolerated), and landfall berths it.
      const g89w = GameState.create({ name:'WR89', gender:'m', profession:'Warrior', book:4, adv });
      g89w.data.shards = 100;
      const wreck89 = g89w.addShip({ type:'brigantine', crew:'good', cargo:[], docked:null });
      g89w.sailShip(wreck89.id);
      eng.applyEffect(parse('<lose ship="t"/>'), g89w, {});
      ok('§89 the sailed ship can be wrecked at sea', g89w.ships.length === 0);
      applyInlineBuy(g89w, { price: 0, ship: 'barque', shipName: 'Scavenger', initialCrew: 'poor' });
      ok('§89 a replacement bought at sea is the current vessel (§4.658)', g89w.currentShip() === g89w.ships[0] && eng.evaluateCondition(parse('<if crew="poor"/>'), g89w) === true);
      g89w.arriveAtDock('Aku');
      ok('§89 landfall berths the replacement despite the stale voyage pointer', g89w.ships[0].docked === 'Aku' && g89w.data.sailingShipId === null);

      // DOM §1.586: the storm follows the ship being SAILED. Sailing the galleon while
      // a barque sits at another port must roll the galleon branch's 3 dice…
      const g586a = GameState.create({ name:'ST586a', gender:'m', profession:'Warrior', book:1, adv });
      g586a.addShip({ type:'barque', crew:'poor', cargo:[], docked:'Smogmaw' });
      const gal586 = g586a.addShip({ type:'galleon', crew:'average', cargo:[], docked:null });
      g586a.sailShip(gal586.id);
      const c586a = document.createElement('div');
      new Story(c586a, g586a, { navigate(){}, onDeath(){}, notify(){} }).begin(await data.getSection(1, '586'), 1, '586');
      const live586a = Array.from(c586a.querySelectorAll('.btn-roll')).filter((b) => !b.closest('.cond-inactive') && !b.disabled);
      ok('§1.586 sailing the galleon rolls 3 dice, not the remote barque\'s 1 die', live586a.length === 1 && /3 dice/.test(live586a[0].textContent), live586a.map((b) => b.textContent).join('|') || 'no live roll');
      // …and the crew bonus comes from the SAILED ship's poor crew (none), not the
      // excellent crew berthed elsewhere: a die of 2 + 0 → §182 (1-3), not §530.
      const g586b = GameState.create({ name:'ST586b', gender:'m', profession:'Warrior', book:1, adv });
      const bq586 = g586b.addShip({ type:'barque', crew:'poor', cargo:[], docked:null });
      g586b.addShip({ type:'galleon', crew:'excellent', cargo:[], docked:'Smogmaw' });
      g586b.sailShip(bq586.id);
      const c586b = document.createElement('div');
      new Story(c586b, g586b, { navigate(){}, onDeath(){}, notify(){} }).begin(await data.getSection(1, '586'), 1, '586');
      const live586b = Array.from(c586b.querySelectorAll('.btn-roll')).filter((b) => !b.closest('.cond-inactive') && !b.disabled);
      ok('§1.586 the sailed barque rolls 1 die', live586b.length === 1 && /1 die/.test(live586b[0].textContent), live586b.map((b) => b.textContent).join('|') || 'no live roll');
      const rnd586 = Math.random; Math.random = () => 0.2; // d6 → 2; the poor crew adds nothing
      live586b[0].click(); await settle42();
      Math.random = rnd586;
      ok('§1.586 the remote excellent crew adds NO bonus (2 → ship sinks §182)', /Continue → 182/.test(c586b.textContent) && !/Continue → 530/.test(c586b.textContent), (c586b.textContent.match(/Continue → \d+/g) || ['none']).join('|'));

      // DOM §2.33 <choice sail>: gated without a local ship; sails + berths only that ship.
      const g33a = GameState.create({ name:'C33a', gender:'m', profession:'Warrior', book:2, adv });
      g33a.addShip({ type:'barque', crew:'average', cargo:[], docked:'Wishport' }); // berthed elsewhere
      const c33a = document.createElement('div');
      new Story(c33a, g33a, { navigate(){}, onDeath(){}, notify(){} }).begin(await data.getSection(2, '33'), 2, '33');
      const sail33a = Array.from(c33a.querySelectorAll('.choice')).find((b) => /Go aboard your ship/.test(b.textContent));
      ok('§2.33 the sail choice is gated without a ship at Metriciens', !!sail33a && sail33a.disabled && /ship here/.test(sail33a.title), sail33a && (sail33a.disabled + ':' + sail33a.title));
      const g33b = GameState.create({ name:'C33b', gender:'m', profession:'Warrior', book:2, adv });
      const met33 = g33b.addShip({ type:'barque', crew:'average', cargo:[], docked:'Metriciens' });
      const wp33 = g33b.addShip({ type:'galleon', crew:'good', cargo:[], docked:'Wishport' });
      let nav33 = null;
      const c33b = document.createElement('div');
      new Story(c33b, g33b, { navigate(bk, sec){ nav33 = { bk, sec }; }, onDeath(){}, notify(){} }).begin(await data.getSection(2, '33'), 2, '33');
      const sail33b = Array.from(c33b.querySelectorAll('.choice')).find((b) => /Go aboard your ship/.test(b.textContent));
      ok('§2.33 the sail choice is live with a ship berthed here', !!sail33b && !sail33b.disabled);
      sail33b.click();
      ok('§2.33 taking the sail choice sails THAT ship and navigates', met33.docked === null && g33b.data.sailingShipId === met33.id && wp33.docked === 'Wishport' && nav33 && String(nav33.sec) === '164');
      g33b.arriveAtDock('Aku');
      ok('§2.33 landfall berths only the sailed ship (the Wishport one stays)', met33.docked === 'Aku' && wp33.docked === 'Wishport' && g33b.data.sailingShipId === null);

      // Two ships at THIS dock: a sail choice prompts which to take (same chooser as goto).
      const secCS = '<section name="TCS" dock="Kunrir"><choices><choice section="10" sail="t">Put to sea</choice></choices></section>';
      const gcs89 = GameState.create({ name:'CS89', gender:'m', profession:'Warrior', book:5, adv });
      const csA = gcs89.addShip({ type:'barque', name:'Gull', crew:'average', cargo:[], docked:'Kunrir' });
      const csB = gcs89.addShip({ type:'galleon', name:'Kraken', crew:'good', cargo:[], docked:'Kunrir' });
      let navCS = null;
      const cCS = document.createElement('div');
      new Story(cCS, gcs89, { navigate(bk, sec){ navCS = { bk, sec }; }, onDeath(){}, notify(){} }).begin(parse(secCS), 5, 'TCS');
      Array.from(cCS.querySelectorAll('.choice')).find((b) => /Put to sea/.test(b.textContent)).click();
      ok('§89 a sail choice with two local ships prompts a choice (no navigation yet)', navCS === null && !!cCS.querySelector('.ship-choice'));
      Array.from(cCS.querySelectorAll('.ship-choice button')).find((b) => /Kraken/.test(b.textContent)).click();
      ok('§89 choosing sails exactly that ship and navigates', csB.docked === null && gcs89.data.sailingShipId === csB.id && csA.docked === 'Kunrir' && navCS && String(navCS.sec) === '10');
    }

    // --- task 99: <fightround> bodies run as combat-round rules -------------------------
    { // block-scoped (task 82)
      // §5.24 (pre="t"): the Hangman's SANCTITY save runs BEFORE each exchange; the
      // margin failed by is taken as Stamina damage (var hang → lose stamina="-hang").
      const s24 = await data.getSection(5, '24');
      const g24 = GameState.create({ name:'H24', gender:'m', profession:'Warrior', book:5, adv });
      g24.data.stamina = 30; g24.data.staminaMax = 30; g24.data.abilities.sanctity = 5;
      const f24 = makeFight(s24.querySelector('fight'), g24);
      const rn24 = s24.querySelector('fightround');
      const rnd99 = Math.random;
      Math.random = () => 0; // every die = 1
      fightRound(g24, f24, null, rn24);
      Math.random = rnd99;
      // pre body: SANCTITY 2+5=7 vs 17 → hang=−10 → −10 Stamina; exchange: player 8 vs
      // Def 15 misses, Hangman 15 vs Def 8 → −7. 30−10−7 = 13.
      ok('§5.24 the pre-round save fires before round 1 (choke damage −10 + blow −7)', g24.data.stamina === 13 && f24.stamina === 25, `st=${g24.data.stamina} en=${f24.stamina}`);
      ok('§5.24 the save wrote its margin var (hang = −10)', g24.getVar('hang') === -10, String(g24.getVar('hang')));
      ok('§5.24 the round save is logged', f24.log.some((l) => /SANCTITY roll 7 vs 17 — failure/.test(l)), f24.log.join(' | '));
      // A successful save takes no choke damage (only the Hangman's blow lands).
      // Abilities cap at 12, so force mid dice: d6=4 → save 8+12=20 vs 17 (margin +3,
      // no choke); exchange: player 14 vs 15 misses, Hangman 21 vs 8 → −13.
      const g24b = GameState.create({ name:'H24b', gender:'m', profession:'Warrior', book:5, adv });
      g24b.data.stamina = 30; g24b.data.staminaMax = 30; g24b.data.abilities.sanctity = 12;
      const f24b = makeFight(s24.querySelector('fight'), g24b);
      Math.random = () => 0.5;
      fightRound(g24b, f24b, null, rn24);
      Math.random = rnd99;
      ok('§5.24 a successful save takes no choke damage (30−13=17, hang=+3)', g24b.data.stamina === 17 && g24b.getVar('hang') === 3, `st=${g24b.data.stamina} hang=${g24b.getVar('hang')}`);

      // §5.383 (pre="f"): the MAGIC save runs AFTER each exchange; failing costs 1d.
      const s383 = await data.getSection(5, '383');
      const g383 = GameState.create({ name:'SD383', gender:'m', profession:'Warrior', book:5, adv });
      g383.data.stamina = 30; g383.data.staminaMax = 30; g383.data.abilities.magic = 1;
      const f383 = makeFight(s383.querySelector('fight'), g383);
      const rn383 = s383.querySelector('fightround');
      Math.random = () => 0; // player 8 vs 11 miss; demon 10 vs 8 → −2; MAGIC 3 vs 12 fail → −1
      fightRound(g383, f383, null, rn383);
      Math.random = rnd99;
      ok('§5.383 the post-round save runs after the exchange (30−2−1=27)', g383.data.stamina === 27, `st=${g383.data.stamina}`);
      ok('§5.383 the failed save is logged', f383.log.some((l) => /MAGIC roll 3 vs 12 — failure/.test(l)), f383.log.join(' | '));
      // The body does NOT run once the fight is decided (the round that fells the demon).
      const g383b = GameState.create({ name:'SD383b', gender:'m', profession:'Warrior', book:5, adv });
      g383b.data.stamina = 30; g383b.data.staminaMax = 30; g383b.data.abilities.magic = 1;
      const f383b = makeFight(s383.querySelector('fight'), g383b);
      f383b.stamina = 1; // one blow from death
      Math.random = () => 0.99; // player 18 vs 11 → −7 ⇒ win before the demon or the save act
      fightRound(g383b, f383b, null, rn383);
      Math.random = rnd99;
      ok('§5.383 no round save after the fight is won (no MAGIC line, no damage)', f383b.outcome === 'win' && g383b.data.stamina === 30 && !f383b.log.some((l) => /MAGIC/.test(l)), `out=${f383b.outcome} st=${g383b.data.stamina}`);

      // §5.689: a failed post-round save records the <goto> (dragged under → §7).
      const s689 = await data.getSection(5, '689');
      const g689 = GameState.create({ name:'WD689', gender:'m', profession:'Warrior', book:5, adv });
      g689.data.stamina = 30; g689.data.staminaMax = 30; g689.data.abilities.scouting = 2;
      g689.setVar('armpenalty', -1); // the section's <set var="armpenalty" value="-armour"/>
      const f689 = makeFight(s689.querySelector('fight'), g689);
      const rn689 = s689.querySelector('fightround');
      Math.random = () => 0; // player 8 vs 12 miss; drake 11 vs Def 7 (noarmour) → −4; SCOUTING 4−1=3 vs 9 fail → goto 7
      fightRound(g689, f689, null, rn689);
      Math.random = rnd99;
      ok('§5.689 a failed round save records the death redirect (→7)', !!f689.roundGoto && String(f689.roundGoto.section) === '7' && g689.data.stamina === 26, `goto=${JSON.stringify(f689.roundGoto)} st=${g689.data.stamina}`);

      // §5.489: the per-wound SANCTITY save now GATES the Avenger's Bite curse (the
      // old walker descended into <failure> unconditionally — cursed on every wound).
      const s489 = await data.getSection(5, '489');
      const dmg489 = s489.querySelector('fightdamage');
      const mkSpectre = (g) => makeFight(parse('<fight name="Spectre" combat="20" defence="30" stamina="99"/>'), g);
      const g489 = GameState.create({ name:'SP489', gender:'m', profession:'Warrior', book:5, adv });
      g489.data.stamina = 30; g489.data.staminaMax = 30; g489.data.abilities.sanctity = 1;
      Math.random = () => 0; // wounded (−14); SANCTITY 3 vs 11 fail → cursed
      fightRound(g489, mkSpectre(g489), dmg489);
      Math.random = rnd99;
      ok("§5.489 failing the wound save inflicts the Avenger's Bite curse", g489.hasCurse("Avenger's Bite"));
      const g489b = GameState.create({ name:'SP489b', gender:'m', profession:'Warrior', book:5, adv });
      g489b.data.stamina = 30; g489b.data.staminaMax = 30; g489b.data.abilities.sanctity = 12;
      Math.random = () => 0.99; // wounded (−24); SANCTITY 24 vs 11 success → NO curse
      fightRound(g489b, mkSpectre(g489b), dmg489);
      Math.random = rnd99;
      ok("§5.489 passing the wound save leaves you uncursed (was: cursed regardless)", !g489b.hasCurse("Avenger's Bite") && g489b.data.stamina === 6, `st=${g489b.data.stamina}`);

      // §4.238: "If you get wounded, →184" — the <fightdamage> goto records a redirect.
      const s238 = await data.getSection(4, '238');
      const g238 = GameState.create({ name:'CT238', gender:'m', profession:'Warrior', book:4, adv });
      g238.data.stamina = 20; g238.data.staminaMax = 20;
      const f238 = makeFight(s238.querySelector('fight'), g238);
      Math.random = () => 0; // player 8 vs 7 → −1; cutthroats 10 vs 8 → wound → goto 184
      fightRound(g238, f238, s238.querySelector('fightdamage'));
      Math.random = rnd99;
      ok('§4.238 a wound records the fight redirect (→184)', !!f238.roundGoto && String(f238.roundGoto.section) === '184', JSON.stringify(f238.roundGoto || null));

      // DOM §5.24: the fightround renders as inert prose — no detached manual roll.
      const gd24 = GameState.create({ name:'D24', gender:'m', profession:'Warrior', book:5, adv });
      gd24.data.stamina = 30; gd24.data.staminaMax = 30; gd24.data.abilities.sanctity = 5;
      const cd24 = document.createElement('div');
      new Story(cd24, gd24, { navigate(){}, onDeath(){}, notify(){} }).begin(s24, 5, '24');
      const fr24 = cd24.querySelector('.fx.fightround');
      ok('§5.24 the fightround renders inert (its roll is not a live widget)', !!fr24 && Array.from(fr24.querySelectorAll('button')).every((b) => b.disabled));
      ok('§5.24 no enabled roll button outside the fight widget', Array.from(cd24.querySelectorAll('.btn-roll')).filter((b) => !b.disabled && !b.closest('.fight')).length === 0);
      // Attacking runs the round rule end-to-end through the widget: choke −10 + blow −7.
      Math.random = () => 0;
      Array.from(cd24.querySelectorAll('.fight .btn-roll')).find((b) => b.textContent === 'Attack').click();
      await settle42();
      Math.random = rnd99;
      ok('§5.24 Attack applies the round rule through the widget (30→13)', gd24.data.stamina === 13, `st=${gd24.data.stamina}`);
      ok('§5.24 the fight log shows the round save', /SANCTITY roll 7 vs 17/.test(cd24.querySelector('.fight-log')?.textContent || ''), (cd24.querySelector('.fight-log')?.textContent || '').slice(0, 160));

      // DOM §5.689: a failed round save navigates to §7 through the widget.
      const gd689 = GameState.create({ name:'D689', gender:'m', profession:'Warrior', book:5, adv });
      gd689.data.stamina = 20; gd689.data.staminaMax = 20; gd689.data.abilities.scouting = 2;
      let nav689 = null;
      const cd689 = document.createElement('div');
      new Story(cd689, gd689, { navigate(bk, sec){ nav689 = { bk, sec }; }, onDeath(){}, notify(){} }).begin(s689, 5, '689');
      const fr689 = cd689.querySelector('.fx.fightround');
      ok('§5.689 the fightround renders inert', !!fr689 && Array.from(fr689.querySelectorAll('button')).every((b) => b.disabled));
      Math.random = () => 0; // fail the round save → dragged under
      Array.from(cd689.querySelectorAll('.fight .btn-roll')).find((b) => b.textContent === 'Attack').click();
      await settle42();
      Math.random = rnd99;
      ok('§5.689 a failed round save drags you under (navigates to §7)', nav689 && String(nav689.sec) === '7', JSON.stringify(nav689));
    }

    // --- task 90: permanent Safety from Storms survives its storm-avoidance spend ------
    { // block-scoped (task 82)
      const g90 = GameState.create({ name:'B90', gender:'m', profession:'Warrior', book:6, adv });
      g90.addBlessing('storm', true); // §6.159's permanent grant
      eng.applyEffect(parse('<lose blessing="storm"/>'), g90, {});
      ok('§90 a named spend leaves the permanent blessing in place', g90.hasBlessing('storm') && g90.isBlessingPermanent('storm'));
      eng.applyEffect(parse('<lose blessing="storms"/>'), g90, {}); // the alias spelling
      ok('§90 the alias spelling ("storms") also survives', g90.hasBlessing('storm'));
      eng.applyEffect(parse('<lose blessing="*"/>'), g90, {});
      ok('§90 the punitive "*" still clears even a permanent blessing', !g90.hasBlessing('storm') && !g90.isBlessingPermanent('storm'));
      const g90b = GameState.create({ name:'B90b', gender:'m', profession:'Warrior', book:6, adv });
      g90b.addBlessing('storm'); // ordinary
      eng.applyEffect(parse('<lose blessing="storm"/>'), g90b, {});
      ok('§90 an ordinary Storms blessing is still consumed by its use', !g90b.hasBlessing('storm'));

      // End-to-end: §1.586's storm-avoidance branch spends the blessing on entry — a
      // permanent one protects through every storm, an ordinary one only the first.
      const s90 = await data.getSection(1, '586');
      const g90p = GameState.create({ name:'P90', gender:'m', profession:'Warrior', book:1, adv });
      g90p.addBlessing('storm', true);
      new Story(document.createElement('div'), g90p, { navigate(){}, onDeath(){}, notify(){} }).begin(s90, 1, '586');
      ok('§1.586 first storm: the permanent blessing protects and survives', g90p.hasBlessing('storm') && g90p.isBlessingPermanent('storm'));
      const c90p2 = document.createElement('div');
      new Story(c90p2, g90p, { navigate(){}, onDeath(){}, notify(){} }).begin(s90, 1, '586');
      ok('§1.586 second storm: still protected (branch active, →85 live)', g90p.hasBlessing('storm') && activeGoto(c90p2, 85));
      const g90o = GameState.create({ name:'O90', gender:'m', profession:'Warrior', book:1, adv });
      g90o.addBlessing('storm');
      new Story(document.createElement('div'), g90o, { navigate(){}, onDeath(){}, notify(){} }).begin(s90, 1, '586');
      ok('§1.586 an ordinary blessing is used up by the first storm', !g90o.hasBlessing('storm'));
    }

    // --- task 91: COMBAT blessing retries a missed strike; Defence stays per-fight -----
    { // block-scoped (task 82)
      const rnd91 = Math.random;
      // A missed strike is retryable once — the enemy never replies to the retry.
      const g91 = GameState.create({ name:'CB91', gender:'m', profession:'Warrior', book:4, adv });
      g91.data.stamina = 30; g91.data.staminaMax = 30; g91.addBlessing('combat');
      const f91 = makeFight(parse('<fight name="Duellist" combat="2" defence="15" stamina="12"/>'), g91);
      Math.random = () => 0; // player 8 vs 15 miss; duellist 4 vs 8 miss
      fightRound(g91, f91, null);
      Math.random = rnd91;
      ok('§91 a failed strike is flagged for the blessing retry', f91.lastStrikeMissed === true && f91.stamina === 12);
      Math.random = () => 0.99; // retry: 18 vs 15 → −3
      const did91 = rerollAttack(g91, f91);
      Math.random = rnd91;
      ok('§91 the COMBAT blessing retries the strike (12→9), consumed, no enemy reply', did91 === true && f91.stamina === 9 && !g91.hasBlessing('combat') && g91.data.stamina === 30, `en=${f91.stamina} st=${g91.data.stamina}`);
      ok('§91 no second retry in the same round', rerollAttack(g91, f91) === false);
      // A HIT is not retryable, blessing or not.
      const g91h = GameState.create({ name:'CB91h', gender:'m', profession:'Warrior', book:4, adv });
      g91h.data.stamina = 30; g91h.data.staminaMax = 30; g91h.addBlessing('combat');
      const f91h = makeFight(parse('<fight name="Duellist" combat="2" defence="10" stamina="12"/>'), g91h);
      Math.random = () => 0.99; // player 18 vs 10 → −8: a hit
      fightRound(g91h, f91h, null);
      Math.random = rnd91;
      ok('§91 a successful strike offers no retry', f91h.lastStrikeMissed === false && rerollAttack(g91h, f91h) === false && g91h.hasBlessing('combat'));
      // A permanent COMBAT blessing survives its use but is still once per round.
      const g91p = GameState.create({ name:'CB91p', gender:'m', profession:'Warrior', book:4, adv });
      g91p.data.stamina = 30; g91p.data.staminaMax = 30; g91p.addBlessing('combat', true);
      const f91p = makeFight(parse('<fight name="Wall" combat="1" defence="30" stamina="12"/>'), g91p);
      Math.random = () => 0;
      fightRound(g91p, f91p, null);
      const r1p = rerollAttack(g91p, f91p); // retry also misses (Def 30)
      const r2p = rerollAttack(g91p, f91p);
      fightRound(g91p, f91p, null); // a NEW round re-arms the retry
      const r3p = rerollAttack(g91p, f91p);
      Math.random = rnd91;
      ok('§91 a permanent COMBAT blessing survives and re-arms next round (not twice a round)', r1p === true && r2p === false && r3p === true && g91p.hasBlessing('combat'));

      // Defence through Faith stays on the blessed fight: a second fight in the same
      // section (same state, no section change) meets the UNBOOSTED Defence.
      const gsq = GameState.create({ name:'SQ91', gender:'m', profession:'Warrior', book:5, adv });
      gsq.data.stamina = 30; gsq.data.staminaMax = 30; gsq.addBlessing('defence');
      const fA91 = makeFight(parse('<fight name="First" combat="9" defence="30" stamina="20"/>'), gsq);
      const fB91 = makeFight(parse('<fight name="Second" combat="9" defence="30" stamina="20"/>'), gsq);
      useDefenceBlessing(gsq, fA91);
      ok('§91 the +3 lands on the blessed fight only', fA91.defenceBonus === 3 && !fB91.defenceBonus && gsq.fightDefenceBonus() === 0);
      Math.random = () => 0; // enemy 2+9=11 vs Def 8+3=11 → miss in fight A…
      fightRound(gsq, fA91, null);
      const afterA91 = gsq.data.stamina;
      fightRound(gsq, fB91, null); // …but vs Def 8 in fight B → −3
      Math.random = rnd91;
      ok('§91 the blessed fight blocks the blow; the NEXT fight does not inherit it', afterA91 === 30 && gsq.data.stamina === 27, `a=${afterA91} b=${gsq.data.stamina}`);

      // DOM: the retry button appears only after a miss; clicking retries the strike.
      const secR91 = '<section name="TR91"><p><fight name="Duellist" combat="2" defence="15" stamina="12"/></p></section>';
      const gdr91 = GameState.create({ name:'DR91', gender:'m', profession:'Warrior', book:4, adv });
      gdr91.data.stamina = 30; gdr91.data.staminaMax = 30; gdr91.addBlessing('combat');
      const cdr91 = document.createElement('div');
      new Story(cdr91, gdr91, { navigate(){}, onDeath(){}, notify(){} }).begin(parse(secR91), 4, 'TR91');
      const retryBtn91 = () => Array.from(cdr91.querySelectorAll('button')).find((b) => /retry your attack/.test(b.textContent));
      ok('§91 no retry button before any strike', !retryBtn91());
      Math.random = () => 0; // miss
      Array.from(cdr91.querySelectorAll('.fight .btn-roll')).find((b) => b.textContent === 'Attack').click();
      await settle42();
      Math.random = rnd91;
      ok('§91 a missed attack offers the COMBAT-blessing retry', !!retryBtn91());
      Math.random = () => 0.99; // retry hits: 12→9
      retryBtn91().click();
      Math.random = rnd91;
      ok('§91 the retry strikes again (12→9), no extra enemy blow, blessing spent', /Stamina 9\/12/.test(cdr91.querySelector('.en-stam').textContent) && gdr91.data.stamina === 30 && !gdr91.hasBlessing('combat') && !retryBtn91(), cdr91.querySelector('.en-stam').textContent);

      // DOM group fight: the retry targets the foe you missed.
      const secG91 = '<section name="TG91"><p><fight group="g" name="Orc" combat="5" defence="15" stamina="12"/><fight group="g" name="Goblin" combat="4" defence="14" stamina="10"/></p></section>';
      const gdg91 = GameState.create({ name:'DG91', gender:'m', profession:'Warrior', book:6, adv });
      gdg91.data.stamina = 40; gdg91.data.staminaMax = 40; gdg91.addBlessing('combat');
      const cdg91 = document.createElement('div');
      new Story(cdg91, gdg91, { navigate(){}, onDeath(){}, notify(){} }).begin(parse(secG91), 6, 'TG91');
      Math.random = () => 0; // player 8 vs 15 misses the Orc; both foes miss back
      Array.from(cdg91.querySelectorAll('button')).find((b) => b.textContent === 'Attack Orc').click();
      await settle42();
      Math.random = rnd91;
      const gRetry91 = Array.from(cdg91.querySelectorAll('button')).find((b) => /retry your attack on Orc/.test(b.textContent));
      ok('§91 a missed group strike offers the retry against that foe', !!gRetry91);
      Math.random = () => 0.99; // retry: 18 vs 15 → Orc 12→9; Goblin untouched
      gRetry91.click();
      Math.random = rnd91;
      const orc91 = Array.from(cdg91.querySelectorAll('.fight-stats:not(.you)')).find((x) => /Orc/.test(x.textContent));
      const gob91 = Array.from(cdg91.querySelectorAll('.fight-stats:not(.you)')).find((x) => /Goblin/.test(x.textContent));
      ok('§91 the group retry strikes only the missed foe (Orc 12→9, Goblin 10/10)', /Stamina 9\/12/.test(orc91.textContent) && /Stamina 10\/10/.test(gob91.textContent) && gdg91.data.stamina === 40, `${orc91.textContent} | ${gob91.textContent}`);
    }

    // --- task 92: the eight live <adjust> variants --------------------------------------
    { // block-scoped (task 82)
      const adj92 = (xml, g) => eng.childAdjustment(parse(xml), g);
      const g92 = GameState.create({ name:'AJ92', gender:'m', profession:'Warrior', book:5, adv });
      ok('§92 titleVal uses default= without the title (−1)', adj92('<random><adjust titleVal="bokh" default="-1"/></random>', g92) === -1);
      g92.addTitle('bokh', 2);
      ok('§92 titleVal adds the held title value (+2)', adj92('<random><adjust titleVal="bokh" default="-1"/></random>', g92) === 2);
      g92.data.rank = 5;
      ok('§92 ability="rank" greaterthan=3 applies at Rank 5', adj92('<random><adjust ability="rank" greaterthan="3" value="1"/></random>', g92) === 1);
      ok('§92 greaterthan=5 does not apply at Rank 5', adj92('<random><adjust ability="rank" greaterthan="5" value="1"/></random>', g92) === 0);
      ok('§92 lessthan=4 does not apply at Rank 5', adj92('<random><adjust ability="rank" lessthan="4" value="1"/></random>', g92) === 0);
      ok('§92 title= gates on holding the title', adj92('<random><adjust title="Nightstalker" value="1"/></random>', g92) === 0);
      g92.addTitle('Nightstalker');
      ok('§92 title= applies once held (§4.63)', adj92('<random><adjust title="Nightstalker" value="1"/></random>', g92) === 1);

      // §5.79: <adjust ability="combat" modifier="noweapon"/> adds the unarmed score.
      const g92w = GameState.create({ name:'AJ92w', gender:'m', profession:'Warrior', book:5, adv });
      g92w.data.items = g92w.data.items.filter((i) => i.kind !== 'weapon');
      g92w.reconcileEquipment();
      g92w.addItem(makeItem('weapon', 'glaive', 2));
      const n79 = (await data.getSection(5, '79')).querySelector('random');
      ok('§5.79 modifier="noweapon" excludes the +2 weapon bonus', g92w.ability('combat') === g92w.abilityNatural('combat') + 2 && eng.childAdjustment(n79, g92w) === g92w.abilityNatural('combat'), `full=${g92w.ability('combat')} nw=${eng.childAdjustment(n79, g92w)}`);

      // §2.579: stamina modifier natural (written score) / current, vs the effective max.
      const g92s = GameState.create({ name:'AJ92s', gender:'m', profession:'Warrior', book:2, adv });
      g92s.data.staminaMax = 20; g92s.data.stamina = 5;
      g92s.addItem(makeItem('item', 'vitality charm', 0, null, [], eng.readItemEffects(parse('<item name="vitality charm"><effect type="aura" ability="stamina" bonus="2"/></item>'))));
      ok('§2.579 modifier="natural" reads the written unwounded score (20, not 22)', adj92('<lose><adjust ability="stamina" modifier="natural"/></lose>', g92s) === 20 && g92s.effectiveStaminaMax() === 22);
      ok('§92 modifier="current" reads the wounded value (5)', adj92('<lose><adjust ability="stamina" modifier="current"/></lose>', g92s) === 5);
      ok('§92 a bare stamina adjust still reads the effective max (22)', adj92('<lose><adjust ability="stamina"/></lose>', g92s) === 22);

      // §6.736: item="?" tags="light" — any light source adds the +2.
      const g92l = GameState.create({ name:'AJ92l', gender:'m', profession:'Warrior', book:6, adv });
      const n736 = (await data.getSection(6, '736')).querySelector('difficulty');
      ok('§6.736 no light source ⇒ no +2', eng.childAdjustment(n736, g92l) === 0);
      g92l.addItem(makeItem('item', 'lantern', 0, null, ['light']));
      ok('§6.736 a light-tagged item adds the +2', eng.childAdjustment(n736, g92l) === 2);

      // §4.411 (source normalized to profession="Warrior"): Warrior + Rank 5 + good crew.
      const n411 = (await data.getSection(4, '411')).querySelector('difficulty');
      const g92a = GameState.create({ name:'AJ92a', gender:'m', profession:'Warrior', book:4, adv });
      g92a.data.rank = 5;
      g92a.addShip({ type:'barque', crew:'good', cargo:[], docked:null });
      ok('§4.411 Warrior/Rank 5/good crew ⇒ +3', eng.childAdjustment(n411, g92a) === 3, String(eng.childAdjustment(n411, g92a)));
      const g92b = GameState.create({ name:'AJ92b', gender:'m', profession:'Rogue', book:4, adv });
      g92b.data.rank = 1;
      g92b.addShip({ type:'barque', crew:'poor', cargo:[], docked:null });
      ok('§4.411 Rogue/Rank 1/poor crew ⇒ −1 (nothing applies unconditionally)', eng.childAdjustment(n411, g92b) === -1, String(eng.childAdjustment(n411, g92b)));

      // §5.343: the bokh game adds your circles of mastery, else −1.
      const n343 = (await data.getSection(5, '343')).querySelector('random');
      const g92c = GameState.create({ name:'AJ92c', gender:'m', profession:'Warrior', book:5, adv });
      ok('§5.343 no bokh mastery ⇒ −1', eng.childAdjustment(n343, g92c) === -1);
      g92c.addTitle('bokh', 3);
      ok('§5.343 a 3rd-Circle Master adds +3', eng.childAdjustment(n343, g92c) === 3);

      // §5.527: galleon +1, excellent crew +1, Rank > 5 +1.
      const n527 = (await data.getSection(5, '527')).querySelector('random');
      const g92d = GameState.create({ name:'AJ92d', gender:'m', profession:'Warrior', book:5, adv });
      g92d.data.rank = 6;
      g92d.addShip({ type:'galleon', crew:'excellent', cargo:[], docked:null });
      ok('§5.527 galleon/excellent crew/Rank 6 ⇒ +3', eng.childAdjustment(n527, g92d) === 3, String(eng.childAdjustment(n527, g92d)));
    }

    // --- task 80: combat blessings (Divine Wrath / Defence through Faith) --------------
    // Headless: Divine Wrath deals 1d to the enemy, once, and is consumed.
    const gw80 = GameState.create({ name:'W80', gender:'m', profession:'Warrior', book:6, adv });
    gw80.data.stamina = 30; gw80.data.staminaMax = 30; gw80.addBlessing('wrath');
    const fw80 = makeFight(parse('<fight name="Ogre" combat="6" defence="9" stamina="12"/>'), gw80);
    const rndW80 = Math.random; Math.random = () => 0.5; // 1d → floor(0.5*6)+1 = 4
    const dmgW80 = useWrathBlessing(gw80, fw80);
    Math.random = rndW80;
    ok('§80 Divine Wrath deals 1d to the enemy (4)', dmgW80 === 4 && fw80.stamina === 8, `dmg=${dmgW80} stam=${fw80.stamina}`);
    ok('§80 Divine Wrath is consumed and marked used', !gw80.hasBlessing('wrath') && fw80.wrathUsed === true);
    ok('§80 Divine Wrath cannot be used twice', useWrathBlessing(gw80, fw80) === 0);
    const gw80b = GameState.create({ name:'W80b', gender:'m', profession:'Warrior', book:6, adv });
    gw80b.addBlessing('wrath');
    const fw80b = makeFight(parse('<fight name="Imp" combat="4" defence="7" stamina="3"/>'), gw80b);
    const rndW80b = Math.random; Math.random = () => 0.99; // 1d → 6 ≥ 3 → felled
    useWrathBlessing(gw80b, fw80b);
    Math.random = rndW80b;
    ok('§80 Divine Wrath can fell a weak enemy (outcome win)', fw80b.outcome === 'win' && fw80b.stamina === 0);

    // Headless: Defence through Faith adds +3 for the fight, once, and is consumed.
    const gd80 = GameState.create({ name:'D80', gender:'m', profession:'Warrior', book:5, adv });
    gd80.addBlessing('defence');
    const fd80 = makeFight(parse('<fight name="Knight" combat="8" defence="14" stamina="20"/>'), gd80);
    const defBase80 = gd80.fightDefenceBonus();
    // The +3 lives on the FIGHT (task 91) — the section-global store is untouched,
    // so a later fight in the same section can't inherit it.
    ok('§80 Defence through Faith adds +3 for the fight', useDefenceBlessing(gd80, fd80) === 3 && fd80.defenceBonus === 3 && gd80.fightDefenceBonus() === defBase80);
    ok('§80 Defence through Faith is consumed and marked used', !gd80.hasBlessing('defence') && fd80.defenceUsed === true);
    ok('§80 Defence through Faith cannot be used twice', useDefenceBlessing(gd80, fd80) === 0);
    const gn80 = GameState.create({ name:'N80', gender:'m', profession:'Warrior', book:5, adv });
    const fn80 = makeFight(parse('<fight name="X" combat="1" defence="1" stamina="5"/>'), gn80);
    ok('§80 no blessing → the combat helpers are inert', useWrathBlessing(gn80, fn80) === 0 && useDefenceBlessing(gn80, fn80) === 0);

    // DOM: the fight widget shows the blessing buttons only when held; clicking uses them.
    const secF80 = '<section name="TF80"><p><fight name="Troll" combat="7" defence="12" stamina="16"/></p></section>';
    const gdom80 = GameState.create({ name:'DOM80', gender:'m', profession:'Warrior', book:6, adv });
    gdom80.data.stamina = 30; gdom80.data.staminaMax = 30; gdom80.addBlessing('wrath'); gdom80.addBlessing('defence');
    const cdom80 = document.createElement('div');
    new Story(cdom80, gdom80, { navigate(){}, onDeath(){}, notify(){} }).begin(parse(secF80), 6, 'TF80');
    const wrathBtn80 = () => Array.from(cdom80.querySelectorAll('button')).find((b) => /Divine Wrath/.test(b.textContent));
    const defBtn80 = () => Array.from(cdom80.querySelectorAll('button')).find((b) => /Defence through Faith/.test(b.textContent));
    ok('§80 the fight widget shows both blessing buttons when held', !!wrathBtn80() && !!defBtn80());
    defBtn80().click();
    ok('§80 using Defence through Faith: button gone, blessing consumed, no global leak', gdom80.fightDefenceBonus() === 0 && !defBtn80() && !gdom80.hasBlessing('defence'));
    ok('§80 the widget shows the boosted Defence', new RegExp('Your Defence ' + (gdom80.defence() + 3) + '(?!\\d)').test(cdom80.querySelector('.you').textContent), cdom80.querySelector('.you').textContent);
    const rndDom80 = Math.random; Math.random = () => 0.5; // 1d → 4; 16−4 = 12
    wrathBtn80().click();
    Math.random = rndDom80;
    ok('§80 using Divine Wrath damages the enemy, removes its button, consumes the blessing', /Stamina 12\//.test(cdom80.querySelector('.en-stam').textContent) && !wrathBtn80() && !gdom80.hasBlessing('wrath'));
    const gno80 = GameState.create({ name:'NO80', gender:'m', profession:'Warrior', book:6, adv });
    const cno80 = document.createElement('div');
    new Story(cno80, gno80, { navigate(){}, onDeath(){}, notify(){} }).begin(parse(secF80), 6, 'TF80');
    ok('§80 no blessing → the fight widget shows no combat-blessing buttons', !Array.from(cno80.querySelectorAll('button')).some((b) => /Divine Wrath|Defence through Faith/.test(b.textContent)));

    // --- task 83: combat blessings on a group fight (drawGroupFight) ---
    const secG83 = '<section name="TG83"><p><fight group="g" name="Orc" combat="5" defence="8" stamina="12"/><fight group="g" name="Goblin" combat="4" defence="7" stamina="10"/></p></section>';
    const gw83 = GameState.create({ name:'GW83', gender:'m', profession:'Warrior', book:6, adv });
    gw83.data.stamina = 40; gw83.data.staminaMax = 40; gw83.addBlessing('wrath');
    const cg83 = document.createElement('div');
    new Story(cg83, gw83, { navigate(){}, onDeath(){}, notify(){} }).begin(parse(secG83), 6, 'TG83');
    const wrathBtns83 = () => Array.from(cg83.querySelectorAll('button')).filter((b) => /Divine Wrath/.test(b.textContent));
    ok('§83 group fight shows a Divine Wrath button per living foe when held', wrathBtns83().length === 2, `n=${wrathBtns83().length}`);
    const orcStam83 = () => { const r = Array.from(cg83.querySelectorAll('.fight-stats:not(.you)')).find((x) => /Orc/.test(x.textContent)); return r ? r.querySelector('.en-stam').textContent : ''; };
    const rndG83 = Math.random; Math.random = () => 0.5; // 1d = 4
    wrathBtns83().find((b) => /Orc/.test(b.textContent)).click();
    Math.random = rndG83;
    ok('§83 Divine Wrath damages the chosen foe by 1d (Orc 12→8)', /Stamina 8\/12/.test(orcStam83()), orcStam83());
    ok('§83 Divine Wrath is consumed and every Wrath button is gone (once per combat)', !gw83.hasBlessing('wrath') && wrathBtns83().length === 0);
    // Defence through Faith in a group: target-agnostic, once per combat, +3 to Defence.
    const gd83 = GameState.create({ name:'GD83', gender:'m', profession:'Warrior', book:6, adv });
    gd83.data.stamina = 40; gd83.data.staminaMax = 40; gd83.addBlessing('defence');
    const cd83 = document.createElement('div');
    new Story(cd83, gd83, { navigate(){}, onDeath(){}, notify(){} }).begin(parse(secG83), 6, 'TG83');
    const defBtn83 = () => Array.from(cd83.querySelectorAll('button')).find((b) => /Defence through Faith/.test(b.textContent));
    ok('§83 group fight shows the Defence through Faith button when held', !!defBtn83());
    defBtn83().click();
    ok('§83 Defence through Faith adds +3 for the group and is consumed (no global leak)', gd83.fightDefenceBonus() === 0 && !gd83.hasBlessing('defence') && !defBtn83());
    ok('§83 the group widget shows the boosted Defence', new RegExp('Your Defence ' + (gd83.defence() + 3) + '(?!\\d)').test(cd83.querySelector('.you').textContent), cd83.querySelector('.you').textContent);
    // A blessing-less character (the every-section scan) sees no combat-blessing buttons.
    const gn83 = GameState.create({ name:'GN83', gender:'m', profession:'Warrior', book:6, adv });
    const cn83 = document.createElement('div');
    new Story(cn83, gn83, { navigate(){}, onDeath(){}, notify(){} }).begin(parse(secG83), 6, 'TG83');
    ok('§83 no blessing → group fight shows no combat-blessing buttons', !Array.from(cn83.querySelectorAll('button')).some((b) => /Divine Wrath|Defence through Faith/.test(b.textContent)));

    // --- task 87: the fight widget's "Your Combat" includes the per-fight attack bonus ---
    // A <tick special="attack"> before the <fight> sets the transient bonus on entry
    // (task 49); the displayed Combat must match what resolution uses (base + bonus).
    const secA87 = '<section name="TA87"><p><tick special="attack" bonus="3"/><fight name="Ogre" combat="6" defence="10" stamina="12"/></p></section>';
    const ga87 = GameState.create({ name:'A87', gender:'m', profession:'Warrior', book:6, adv });
    ga87.data.stamina = 20; ga87.data.staminaMax = 20;
    const ca87 = document.createElement('div');
    new Story(ca87, ga87, { navigate(){}, onDeath(){}, notify(){} }).begin(parse(secA87), 6, 'TA87');
    ok('§87 the attack bonus is set on entry', ga87.fightAttackBonus() === 3, `atk=${ga87.fightAttackBonus()}`);
    ok('§87 the single-fight widget shows Combat including the +3 attack bonus',
      new RegExp('Your Combat ' + (ga87.ability('combat') + 3) + '(?!\\d)').test(ca87.querySelector('.you').textContent),
      ca87.querySelector('.you').textContent);
    // Same parity for the group-fight widget (drawGroupFight).
    const secG87 = '<section name="TG87"><p><tick special="attack" bonus="2"/><fight group="g" name="A" combat="5" defence="8" stamina="6"/><fight group="g" name="B" combat="5" defence="8" stamina="6"/></p></section>';
    const gg87 = GameState.create({ name:'G87', gender:'m', profession:'Warrior', book:6, adv });
    gg87.data.stamina = 20; gg87.data.staminaMax = 20;
    const cg87 = document.createElement('div');
    new Story(cg87, gg87, { navigate(){}, onDeath(){}, notify(){} }).begin(parse(secG87), 6, 'TG87');
    ok('§87 the group-fight widget shows Combat including the +2 attack bonus',
      new RegExp('Your Combat ' + (gg87.ability('combat') + 2) + '(?!\\d)').test(cg87.querySelector('.you').textContent),
      cg87.querySelector('.you').textContent);

    // --- task 75: live <tick> forms (equipment / profession / patterned titles) --------
    // Patterned title: first grant sets titleValue; later grants advance by titleAdjust;
    // the pattern renders "Circle N Master of bokh".
    const gt75 = GameState.create({ name:'T75', gender:'m', profession:'Warrior', book:5, adv });
    eng.applyEffect(parse('<tick title="bokh" titlePattern="Circle {0} Master of bokh" titleValue="1" titleAdjust="1"/>'), gt75, {});
    ok('§75 first bokh grant → Circle 1 (titleValue init)', gt75.titleValue('bokh') === 1);
    eng.applyEffect(parse('<tick title="bokh" titlePattern="Circle {0} Master of bokh" titleValue="1" titleAdjust="1"/>'), gt75, {});
    ok('§75 second bokh grant advances by titleAdjust → Circle 2', gt75.titleValue('bokh') === 2);
    const cSheet75 = document.createElement('div'); renderSheet(gt75, cSheet75);
    ok('§75 the sheet shows "Circle 2 Master of bokh", not "bokh (2)"', /Circle 2 Master of bokh/.test(cSheet75.textContent) && !/bokh \(2\)/.test(cSheet75.textContent));
    // A distinct titleAdjust proves the advance uses titleAdjust, not titleValue.
    const gt75b = GameState.create({ name:'T75b', gender:'m', profession:'Warrior', book:5, adv });
    eng.applyEffect(parse('<tick title="grade" titlePattern="Grade {0}" titleValue="5" titleAdjust="2"/>'), gt75b, {});
    eng.applyEffect(parse('<tick title="grade" titlePattern="Grade {0}" titleValue="5" titleAdjust="2"/>'), gt75b, {});
    ok('§75 patterned title: init 5 then +2 = 7 (advance uses titleAdjust)', gt75b.titleValue('grade') === 7);
    const mig75 = sanitizeData({ abilities:{combat:5}, stamina:9, titles:[{ name:'bokh', value:3, pattern:'Circle {0} Master of bokh' }] });
    ok('§75 migrate: a title pattern round-trips', mig75.titles[0].pattern === 'Circle {0} Master of bokh' && mig75.titles[0].value === 3);

    // Equipment: <tick weapon="?" tags=…> selects the tagged weapon; addtag/addbonus/removetag work.
    const ge75 = GameState.create({ name:'E75', gender:'m', profession:'Warrior', book:5, adv });
    ge75.data.items = []; const wpn75 = ge75.addItem(makeItem('weapon', 'targ blade', 2));
    eng.applyEffect(parse('<tick weapon="?" addtag="Tz"/>'), ge75, {});
    ok('§5.386 <tick weapon="?" addtag> tags the (single) weapon', (wpn75.tags || []).includes('Tz'));
    eng.applyEffect(parse('<tick weapon="?" tags="Tz" addbonus="1"/>'), ge75, {});
    ok('§5.386 <tick weapon="?" tags="Tz" addbonus="1"> raises the tagged weapon (2→3)', wpn75.bonus === 3);
    eng.applyEffect(parse('<tick weapon="?" tags="Tz" addbonus="-1"/>'), ge75, {});
    ok('§5.386 addbonus="-1" lowers it (3→2)', wpn75.bonus === 2);
    eng.applyEffect(parse('<tick weapon="?" tags="Tz" removetag="Tz"/>'), ge75, {});
    ok('§5.386 removetag strips the Tz tag (cleanup)', !(wpn75.tags || []).includes('Tz'));
    // using="t" targets the wielded weapon (book6/135 removes its keep tag).
    const gu75 = GameState.create({ name:'U75', gender:'m', profession:'Warrior', book:6, adv });
    gu75.data.items = []; const kept75 = gu75.addItem(makeItem('weapon', 'oath blade', 3, null, ['keep']));
    eng.applyEffect(parse('<tick weapon="?" using="t" removetag="keep"/>'), gu75, {});
    ok('§6.135 <tick weapon="?" using="t" removetag="keep"> strips keep from the wielded weapon', !(kept75.tags || []).includes('keep'));

    // Profession: a single <tick profession="priest"> changes the profession.
    const gp75 = GameState.create({ name:'P75', gender:'m', profession:'Warrior', book:6, adv });
    eng.applyEffect(parse('<tick profession="priest"/>'), gp75, {});
    ok('§6.731 <tick profession="priest"> changes the profession to Priest', gp75.data.profession === 'Priest');

    // DOM: <tick weapon="?" addbonus="1"> with TWO weapons prompts a choice; picking raises one.
    const gdw75 = GameState.create({ name:'DW75', gender:'m', profession:'Warrior', book:6, adv });
    gdw75.data.items = []; const wA75 = gdw75.addItem(makeItem('weapon', 'sabre', 1)); const wB75 = gdw75.addItem(makeItem('weapon', 'mace', 2));
    const secW75 = '<section name="TW75"><p><tick weapon="?" addbonus="1">Increase the COMBAT bonus of one weapon by +1</tick></p></section>';
    const cdw75 = document.createElement('div');
    new Story(cdw75, gdw75, { navigate(){}, onDeath(){}, notify(){} }).begin(parse(secW75), 6, 'TW75');
    ok('§6.731 two weapons → an enchant picker (no auto-apply)', cdw75.querySelectorAll('.ability-pick').length === 2 && wA75.bonus === 1 && wB75.bonus === 2);
    Array.from(cdw75.querySelectorAll('.ability-pick')).find((b) => /sabre/i.test(b.textContent)).click();
    ok('§6.731 picking a weapon raises only that one (+1)', wA75.bonus === 2 && wB75.bonus === 2);

    // DOM: <tick profession="a|b|c"> renders a profession picker (book6/118 former Priest).
    const gdp75 = GameState.create({ name:'DP75', gender:'m', profession:'Priest', book:6, adv });
    const secP75 = '<section name="TP75"><p><tick profession="mage|rogue|troubadour|warrior|wayfarer">choose a new profession</tick></p></section>';
    const cdp75 = document.createElement('div');
    new Story(cdp75, gdp75, { navigate(){}, onDeath(){}, notify(){} }).begin(parse(secP75), 6, 'TP75');
    ok('§6.118 profession="a|b|…" renders a five-way picker (no auto-change)', cdp75.querySelectorAll('.ability-pick').length === 5 && gdp75.data.profession === 'Priest');
    Array.from(cdp75.querySelectorAll('.ability-pick')).find((b) => /Wayfarer/.test(b.textContent)).click();
    ok('§6.118 picking a profession changes it (→ Wayfarer)', gdp75.data.profession === 'Wayfarer');

    // --- task 86: full-section render integration for book5/386 (Targdaz weaponsmith) ---
    // The task-75 ticks above cover the engine mechanics in isolation; this drives the
    // real §5.386 end-to-end. Two behaviours are pinned: (correct) the hidden
    // <tick shards="150"> refund fires only at bonus>=6; and (known limitation, task 88)
    // the weapon-enchant cycle never lands, because the section's own hidden
    // removetag="Tz" cleanup fires on entry and strips the tag before the roll and the
    // <outcomes> table can target the weapon. When task 88 is fixed, update part (c).
    const sec386 = await data.getSection(5, '386');
    // (a) bonus>=6 → 150-Shard refund; the +6 weapon is not enchanted past its cap.
    const g386r = GameState.create({ name:'T386r', gender:'m', profession:'Warrior', book:5, adv });
    g386r.data.items = []; const w386r = g386r.addItem(makeItem('weapon', 'targ blade', 6));
    const before386r = g386r.data.shards;
    const c386r = document.createElement('div');
    new Story(c386r, g386r, { navigate(){}, onDeath(){}, notify(){} }).begin(sec386, 5, '386');
    ok('§5.386 a bonus>=6 weapon grants the 150-Shard refund', g386r.data.shards === before386r + 150, `shards ${before386r}->${g386r.data.shards}`);
    ok('§5.386 the +6 weapon is not enchanted past the cap of 6', w386r.bonus === 6, `bonus=${w386r.bonus}`);
    // (b) structure with a bonus<6 weapon: visible "one weapon" tick text, two roll
    // buttons, the goto to 245, and no refund.
    const g386 = GameState.create({ name:'T386', gender:'m', profession:'Warrior', book:5, adv });
    g386.data.items = []; const w386 = g386.addItem(makeItem('weapon', 'targ blade', 2));
    const before386 = g386.data.shards;
    const c386 = document.createElement('div');
    new Story(c386, g386, { navigate(){}, onDeath(){}, notify(){} }).begin(sec386, 5, '386');
    ok('§5.386 renders the visible tick text + two roll buttons + goto 245',
      /one weapon/.test(c386.textContent)
      && c386.querySelectorAll('button.btn-roll').length === 2
      && !!Array.from(c386.querySelectorAll('button.goto')).find((b) => /245/.test(b.textContent)));
    ok('§5.386 a bonus<6 weapon gives no Shard refund', g386.data.shards === before386, `shards=${g386.data.shards}`);
    // (c) task 88: the hidden removetag="Tz" cleanup is now deferred to the section
    // exit, so the tag survives the roll and the <outcomes> table lands on the weapon.
    // A low roll (2d in 2-6) DESTROYS the tagged weapon (previously nothing happened
    // because the tag was stripped on entry).
    window.__FL_INSTANT_DICE__ = true;
    const rnd386 = Math.random; Math.random = () => 0.05;   // 2d = 1+1 = 2 → "destroyed" (2-6)
    Array.from(c386.querySelectorAll('button.btn-roll'))[0].click();
    await new Promise(r => setTimeout(r, 30));
    Math.random = rnd386;
    ok('§5.386 driving a low roll (2-6) now destroys the tagged weapon', !g386.hasItem('targ blade'),
      `hasItem=${g386.hasItem('targ blade')} bonus=${w386.bonus} tags=${(w386.tags||[]).join(',')}`);

    // (d) a high roll (7-12) beats the +2 bonus (+1 → 3) then the 7-12 outcome takes
    // one back (−1 → 2); the Tz tag survives the whole visit and is stripped only when
    // the section is left (the deferred cleanup), never leaking onto the weapon.
    let nav386 = null;
    const g386h = GameState.create({ name:'T386h', gender:'m', profession:'Warrior', book:5, adv });
    g386h.data.items = []; const w386h = g386h.addItem(makeItem('weapon', 'targ blade', 2));
    const c386h = document.createElement('div');
    const story386h = new Story(c386h, g386h, { navigate:(b,s)=>{nav386={b,s};}, onDeath(){}, notify(){} });
    story386h.begin(sec386, 5, '386');
    const rnd386h = Math.random; Math.random = () => 0.99;   // 2d = 6+6 = 12 → beats 2, then 7-12 −1
    Array.from(c386h.querySelectorAll('button.btn-roll'))[0].click();
    await new Promise(r => setTimeout(r, 30));
    Math.random = rnd386h;
    ok('§5.386 a high roll raises (+1) then the 7-12 outcome lowers (−1) — net unchanged at 2, weapon kept', g386h.hasItem('targ blade') && w386h.bonus === 2, `bonus=${w386h.bonus}`);
    ok('§5.386 the Tz cleanup tag survives mid-visit (not stripped on entry)', (w386h.tags || []).includes('Tz'), `tags=${(w386h.tags||[]).join(',')}`);
    Array.from(c386h.querySelectorAll('button.goto')).find((b) => /245/.test(b.textContent)).click();
    ok('§5.386 leaving the section applies the deferred Tz cleanup (no tag leak)', !(w386h.tags || []).includes('Tz') && nav386 && String(nav386.s) === '245',
      `tags=${(w386h.tags||[]).join(',')} nav=${JSON.stringify(nav386)}`);
    window.__FL_INSTANT_DICE__ = false;

    // --- task 47: <choice item="?" tags="light"> gates on a light source ---
    const g291 = GameState.create({ name:'C291', gender:'m', profession:'Warrior', book:2, adv });
    const c291 = document.createElement('div');
    const st291 = new Story(c291, g291, { navigate(){}, onDeath(){}, notify(){} });
    const s291b = await data.getSection(2, '291'); st291.begin(s291b, 2, '291');
    const enter291 = () => Array.from(c291.querySelectorAll('.choice')).find((b) => /Enter the castle/.test(b.textContent));
    ok('§2.291 "Enter the castle" is locked without a light source', (() => { const b = enter291(); return b && b.disabled === true; })(), (() => { const b = enter291(); return b ? `dis=${b.disabled}` : 'no choice'; })());
    g291.addItem(makeItem('item', 'lantern', 0, null, ['light']));
    st291.rerender();
    ok('§2.291 "Enter the castle" unlocks with a light-tagged item', (() => { const b = enter291(); return b && b.disabled === false; })(), (() => { const b = enter291(); return b ? `dis=${b.disabled}` : 'no choice'; })());
    // hasItemMatch matcher agrees with the <if item="?" tags=…> path.
    ok('hasItemMatch("?","light") true with a lantern', g291.hasItemMatch('?', 'light') === true);
    ok('hasItemMatch("?","light") false without one', GameState.create({ name:'NL', gender:'m', profession:'Warrior', book:2, adv }).hasItemMatch('?', 'light') === false);

    // --- task 26: the remaining <fight> attributes ---
    // makeFight parses the new attributes.
    const fparse = makeFight(parse('<fight name="X" combat="8" defence="20" stamina="21" attackDice="1" attacks="3" modifiers="noarmour" playerDefence="d" abilityDamaged="stamina" staminaLost="MD" group="g"/>'));
    ok('makeFight reads attackDice/attacks/noArmour/playerDefence/abilityDamaged/staminaLost/group',
      fparse.attackDice === 1 && fparse.attacks === 3 && fparse.noArmour === true && fparse.playerDefence === 'd' && fparse.abilityDamaged === 'stamina' && fparse.staminaLost === 'MD' && fparse.group === 'g',
      JSON.stringify(fparse));
    // preDamage: reduce the enemy's Stamina up front from a carried codeword (§Dawatsu).
    const gpd = GameState.create({ name:'PD', gender:'m', profession:'Warrior', book:6, adv });
    gpd.data.stamina = 200; gpd.data.staminaMax = 200; gpd.setCodewordValue('MorDamage', 30);
    const fpd = makeFight(parse('<fight name="Dawatsu Morituri" combat="10" defence="20" stamina="38" preDamage="MorDamage"/>'), gpd);
    ok('§6 preDamage reduces enemy Stamina up front (38−30=8)', fpd.stamina === 8, `stam=${fpd.stamina}`);
    // preDamage large enough fells the enemy before the first blow.
    const gpkd = GameState.create({ name:'PKD', gender:'m', profession:'Warrior', book:6, adv });
    gpkd.setCodewordValue('MorDamage', 100);
    const fpk = makeFight(parse('<fight name="Dawatsu Morituri" combat="10" defence="20" stamina="38" preDamage="MorDamage" flee="0"/>'), gpkd);
    ok('preDamage can fell the enemy before the fight', fpk.outcome === 'win' && fpk.stamina === 0, `out=${fpk.outcome} stam=${fpk.stamina}`);
    // staminaLost: the codeword accumulates the damage the player deals to the enemy.
    const gsl = GameState.create({ name:'SL', gender:'m', profession:'Warrior', book:6, adv });
    gsl.data.stamina = 200; gsl.data.staminaMax = 200;
    const fsl = makeFight(parse('<fight name="Dawatsu Morituri" combat="0" defence="0" stamina="10" staminaLost="MorDamage"/>'), gsl);
    ok('staminaLost resets to 0 at fight start', gsl.codewordValue('MorDamage') === 0);
    let gsGuard = 0; while (!fsl.outcome && !gsl.isDead() && gsGuard++ < 200) fightRound(gsl, fsl, null);
    ok('staminaLost accumulates the damage dealt (= maxStamina)', fsl.outcome === 'win' && gsl.codewordValue('MorDamage') === fsl.maxStamina, `dmg=${gsl.codewordValue('MorDamage')} max=${fsl.maxStamina}`);
    // attackDice=1: the player rolls one die, so a max total of combat+6 can never
    // beat a Defence of combat+7 — the enemy's Stamina never drops.
    const gad = GameState.create({ name:'AD', gender:'m', profession:'Warrior', book:6, adv });
    gad.data.stamina = 200; gad.data.staminaMax = 200;
    const adCombat = gad.ability('combat');
    const fad = makeFight(parse(`<fight name="Wall" combat="0" defence="${adCombat + 7}" stamina="20" attackDice="1"/>`), gad);
    for (let i = 0; i < 30; i++) fightRound(gad, fad, null);
    ok('attackDice="1" caps the player roll (1 die, never beats Def=combat+7)', fad.stamina === 20, `stam=${fad.stamina}`);
    // attacks=3: the enemy strikes three times per round (Tripling). Enemy Defence
    // 50 keeps it alive so it always gets to retaliate.
    const gat = GameState.create({ name:'AT', gender:'m', profession:'Warrior', book:5, adv });
    gat.data.stamina = 400; gat.data.staminaMax = 400;
    const fat = makeFight(parse('<fight name="Tripling" combat="4" defence="50" stamina="12" attacks="3"/>'));
    fightRound(gat, fat, null);
    ok('attacks="3" → enemy strikes three times per round', fat.log.filter((l) => /Tripling rolls/.test(l)).length === 3, JSON.stringify(fat.log));
    // playerDefence override: a var replaces the sheet Defence (§Chimerical Beast/§Talanexor).
    const gpv = GameState.create({ name:'PV', gender:'m', profession:'Warrior', book:6, adv });
    gpv.setVar('pd', 100); gpv.data.stamina = 200; gpv.data.staminaMax = 200;
    const fpv = makeFight(parse('<fight name="Beast" combat="50" defence="99" stamina="99" playerDefence="pd"/>'), gpv);
    for (let i = 0; i < 40; i++) fightRound(gpv, fpv, null);
    ok('playerDefence override protects (Def 100 > max enemy total 62)', gpv.data.stamina === 200, `stam=${gpv.data.stamina}`);
    // modifiers="noarmour": the armour bonus is removed from the player's Defence.
    // With an armour bonus of 11, an enemy of combat=(Defence−12) can never beat the
    // full Defence but ALWAYS beats Defence−11, so a hit only lands with noarmour.
    const gna = GameState.create({ name:'NA', gender:'m', profession:'Warrior', book:6, adv });
    gna.data.items = gna.data.items.filter((it) => it.kind !== 'armour');
    gna.addItem(makeItem('armour', 'test plate', 11));
    gna.data.stamina = 200; gna.data.staminaMax = 200;
    const defN = gna.defence(); const armN = gna.armourBonus();
    const fna = makeFight(parse(`<fight name="Water Drake" combat="${defN - 12}" defence="99" stamina="99" modifiers="noarmour"/>`), gna);
    const naBefore = gna.data.stamina;
    fightRound(gna, fna, null); // one enemy strike lands for certain under noarmour
    ok('modifiers="noarmour" drops the armour bonus (a hit lands)', armN === 11 && gna.data.stamina < naBefore, `arm=${armN} stam ${naBefore}->${gna.data.stamina}`);
    // abilityDamaged="stamina": the wound permanently reduces max Stamina (§Big Boy/§Giant).
    const gabd = GameState.create({ name:'ABD', gender:'m', profession:'Warrior', book:6, adv });
    gabd.data.stamina = 200; gabd.data.staminaMax = 200;
    const fabd = makeFight(parse(`<fight name="Big Boy" combat="${gabd.defence() + 20}" defence="99" stamina="99" abilityDamaged="stamina"/>`), gabd);
    const maxBefore = gabd.data.staminaMax;
    fightRound(gabd, fabd, null); // enemy always hits (combat = Def+20)
    ok('abilityDamaged="stamina" cuts the unwounded max, not just current', gabd.data.staminaMax < maxBefore, `max ${maxBefore}->${gabd.data.staminaMax}`);
    // useCache: the enemy wields the weapon/armour stashed in the cache (§6.635).
    const guc = GameState.create({ name:'UC', gender:'m', profession:'Warrior', book:6, adv });
    guc.cacheAddItem('6.635', makeItem('weapon', 'your sword', 3));
    guc.cacheAddItem('6.635', makeItem('armour', 'your mail', 2));
    const fuc = makeFight(parse('<fight name="Warrior Maid" combat="8" defence="16" stamina="18" useCache="6.635"/>'), guc);
    // The weapon's +3 raises the enemy's COMBAT to 11 and (via COMBAT) Defence too,
    // plus the armour's +2 → Defence 16+3+2 = 21 (task 36 corrected the Defence path).
    ok('useCache adds the cached weapon to Combat AND Defence, armour to Defence (combat 11, defence 21)', fuc.combat === 11 && fuc.defence === 21, `c=${fuc.combat} d=${fuc.defence}`);
    // group=: a simultaneous fight — the player strikes one foe, all living foes retaliate.
    const ggr = GameState.create({ name:'GR', gender:'m', profession:'Warrior', book:6, adv });
    ggr.data.stamina = 500; ggr.data.staminaMax = 500;
    const gfights = [
      makeFight(parse('<fight name="First Spider" combat="8" defence="0" stamina="6" group="s"/>'), ggr),
      makeFight(parse('<fight name="Second Spider" combat="8" defence="0" stamina="6" group="s"/>'), ggr),
    ];
    ok('group not yet defeated', !gfights.every(isDefeated));
    let grGuard = 0; while (!gfights.every(isDefeated) && !ggr.isDead() && grGuard++ < 300) groupFightRound(ggr, gfights, null);
    ok('group fight resolves with all foes defeated', gfights.every(isDefeated) && !ggr.isDead(), `def=${gfights.map(isDefeated)} dead=${ggr.isDead()}`);
    // §6.192 renders the combined group widget (one box for all three foes).
    const cgr = document.createElement('div');
    const storyGr = new Story(cgr, GameState.create({ name:'GRV', gender:'m', profession:'Warrior', book:6, adv }), { navigate(){}, onDeath(){}, notify(){} });
    const s192 = await data.getSection(6,'192'); storyGr.begin(s192,6,'192');
    ok('§6.192 draws one combined group widget (not three)', cgr.querySelectorAll('.fight').length === 1 && /3 foes/.test(cgr.textContent), `boxes=${cgr.querySelectorAll('.fight').length}`);

    // --- task 48: group fights — surrender, flee button, target choice ---
    // §6.192 offers one Attack button PER living foe (choose your target each round).
    const atkBtns192 = Array.from(cgr.querySelectorAll('.fight-controls .btn-roll'));
    ok('§6.192 offers one Attack button per foe (target choice)', atkBtns192.length === 3 && atkBtns192.every((b) => /Attack /.test(b.textContent)), `n=${atkBtns192.length}`);
    // groupFightRound strikes the CHOSEN foe (member 3), not just the first.
    const gtc = GameState.create({ name:'TC', gender:'m', profession:'Warrior', book:6, adv });
    gtc.data.stamina = 500; gtc.data.staminaMax = 500; gtc.data.abilities.combat = 12;
    const tcFights = [
      makeFight(parse('<fight name="A" combat="0" defence="0" stamina="30" group="t"/>'), gtc),
      makeFight(parse('<fight name="B" combat="0" defence="0" stamina="30" group="t"/>'), gtc),
      makeFight(parse('<fight name="C" combat="0" defence="0" stamina="30" group="t"/>'), gtc),
    ];
    groupFightRound(gtc, tcFights, null, tcFights[2]); // attack member 3
    ok('group round strikes the chosen foe (member 3), sparing members 1 & 2',
       tcFights[2].stamina < 30 && tcFights[0].stamina === 30 && tcFights[1].stamina === 30,
       `stam=${tcFights.map((f) => f.stamina)}`);

    // §6.618 Surrender (flee="t" choice, no <flee> body) must NOT throw and navigates to 452.
    let nav618 = null;
    const c618 = document.createElement('div');
    const g618 = GameState.create({ name:'S618', gender:'m', profession:'Warrior', book:6, adv });
    const st618 = new Story(c618, g618, { navigate:(b,s)=>{nav618={b,s};}, onDeath(){}, notify(){} });
    const s618 = await data.getSection(6,'618'); st618.begin(s618,6,'618');
    const surrender618 = Array.from(c618.querySelectorAll('.choice')).find((b) => /Surrender/.test(b.textContent));
    ok('§6.618 shows a live Surrender option during the group fight', !!surrender618 && surrender618.disabled === false, surrender618 ? `dis=${surrender618.disabled}` : 'no choice');
    surrender618.click(); // previously threw a TypeError on the getter-only outcome
    ok('§6.618 surrender navigates to 452 (no TypeError)', nav618 && String(nav618.s) === '452', `nav=${JSON.stringify(nav618)}`);

    // §6.291 shows a Flee button (a <flee> with its own goto), which navigates to 745.
    let nav291 = null;
    const c291f = document.createElement('div');
    const g291f = GameState.create({ name:'F291', gender:'m', profession:'Warrior', book:6, adv });
    g291f.data.stamina = 200; g291f.data.staminaMax = 200;
    const st291f = new Story(c291f, g291f, { navigate:(b,s)=>{nav291={b,s};}, onDeath(){}, notify(){} });
    const s291g = await data.getSection(6,'291'); st291f.begin(s291g,6,'291');
    const flee291 = Array.from(c291f.querySelectorAll('.fight-controls button')).find((b) => /Flee/.test(b.textContent));
    ok('§6.291 group widget shows a Flee button', !!flee291);
    flee291.click();
    ok('§6.291 fleeing navigates to 745', nav291 && String(nav291.s) === '745', `nav=${JSON.stringify(nav291)}`);

    // --- task 49: special="attack|defence" are per-fight bonuses, right stat, not saved ---
    const g49 = GameState.create({ name:'A49', gender:'m', profession:'Warrior', book:1, adv });
    const def49 = g49.defence();
    eng.applyEffect(parse('<tick special="attack" bonus="3"/>'), g49, {});
    ok('special="attack" sets a per-fight attack bonus', g49.fightAttackBonus() === 3, `atk=${g49.fightAttackBonus()}`);
    ok('special="attack" does NOT raise Defence (no leak)', g49.defence() === def49, `def ${def49}->${g49.defence()}`);
    ok('special="attack" is not written to persisted data (no permanent effect)', (g49.data.effects || []).length === 0, `effects=${JSON.stringify(g49.data.effects)}`);
    // the bonus is transient — a save round-trip drops it.
    const restored49 = new GameState(sanitizeData(JSON.parse(JSON.stringify(g49.data))));
    ok('special="attack" does not survive a save round-trip', restored49.fightAttackBonus() === 0, `atk=${restored49.fightAttackBonus()}`);
    // special="defence" hits Defence only (does not leak into COMBAT).
    const gd49 = GameState.create({ name:'D49', gender:'m', profession:'Warrior', book:4, adv });
    const combat49 = gd49.ability('combat');
    eng.applyEffect(parse('<tick special="defence" bonus="4"/>'), gd49, {});
    ok('special="defence" sets a per-fight Defence bonus', gd49.fightDefenceBonus() === 4);
    ok('special="defence" does NOT raise COMBAT (no leak)', gd49.ability('combat') === combat49);
    gd49.clearFightBonuses();
    ok('clearFightBonuses resets the per-fight bonus', gd49.fightDefenceBonus() === 0);
    // §6.183 special="defence" bonus="s" resolves the variable (was NaN→0 before).
    const g183 = GameState.create({ name:'SV', gender:'m', profession:'Warrior', book:6, adv });
    g183.setVar('s', 5);
    eng.applyEffect(parse('<tick special="defence" bonus="s" hidden="t"/>'), g183, {});
    ok('§6.183 special="defence" bonus="s" resolves the variable', g183.fightDefenceBonus() === 5, `def=${g183.fightDefenceBonus()}`);
    // behavioural: the attack bonus actually helps the player's roll land.
    const gab = GameState.create({ name:'AB49', gender:'m', profession:'Warrior', book:1, adv });
    gab.data.stamina = 500; gab.data.staminaMax = 500;
    const wallDef = gab.ability('combat') + 12; // best no-bonus total exactly equals Def ⇒ dmg 0 (always miss)
    const fmiss = makeFight(parse(`<fight name="Wall" combat="0" defence="${wallDef}" stamina="60"/>`));
    for (let i = 0; i < 20; i++) fightRound(gab, fmiss, null);
    ok('without an attack bonus a Def=(COMBAT+12) wall is never scratched', fmiss.stamina === 60, `stam=${fmiss.stamina}`);
    gab.addFightBonus('attack', 10); // +10 clears that wall on almost every roll
    const fhit = makeFight(parse(`<fight name="Wall2" combat="0" defence="${wallDef}" stamina="60"/>`));
    for (let i = 0; i < 5; i++) fightRound(gab, fhit, null);
    ok('with a +10 attack bonus the same wall takes damage', fhit.stamina < 60, `stam=${fhit.stamina}`);
    // §1.42 end-to-end: rat poison → +3 attack for the fight, poison consumed, Defence unchanged.
    const g42 = GameState.create({ name:'R42', gender:'m', profession:'Warrior', book:1, adv });
    g42.addItem(makeItem('item', 'rat poison'));
    const c42 = document.createElement('div');
    const st42 = new Story(c42, g42, { navigate(){}, onDeath(){}, notify(){} });
    const s42 = await data.getSection(1, '42'); st42.begin(s42, 1, '42');
    const def42 = g42.defence();
    const use42 = c42.querySelector('.group-action');
    ok('§1.42 shows the rat-poison "use it" action', !!use42);
    ok('§1.42 attack bonus not applied until used', g42.fightAttackBonus() === 0);
    if (use42) use42.click();
    ok('§1.42 using rat poison grants +3 attack and consumes the poison', g42.fightAttackBonus() === 3 && !g42.hasItem('rat poison'), `atk=${g42.fightAttackBonus()} has=${g42.hasItem('rat poison')}`);
    ok('§1.42 rat-poison bonus does not raise Defence', g42.defence() === def42, `def ${def42}->${g42.defence()}`);
    // leaving to another section clears the per-fight bonus (section-scoped).
    const s423 = await data.getSection(1, '423'); st42.begin(s423, 1, '423');
    ok('§1.42 the +3 attack bonus is cleared on entering the next section', g42.fightAttackBonus() === 0, `atk=${g42.fightAttackBonus()}`);

    // --- task 156: a mid-fight reload restores the per-fight bonus via the visit record ---
    // _fightBonus lives off `data` (task 49), so a save doesn't carry it; after task 116 a
    // reload rebuilds ctx.applied (the granting tick is memoised and won't re-fire) with the
    // bonus zeroed. serializeVisit now snapshots the bonus and resume() restores it — without
    // re-applying the tick (which would double it).
    {
      const sec156 = parse('<section name="F156"><p><tick special="attack" bonus="3"/><fight name="Ogre" combat="6" defence="10" stamina="12"/></p></section>');
      const g156 = GameState.create({ name:'T156', gender:'m', profession:'Warrior', book:1, adv });
      const c156 = document.createElement('div');
      const st156 = new Story(c156, g156, { navigate(){}, onDeath(){}, notify(){} });
      g156.setVisitProvider(() => st156.serializeVisit());
      g156.goTo(1, 'F156'); st156.begin(sec156, 1, 'F156');
      ok('task156: the entry tick armed the +3 attack bonus', g156.fightAttackBonus() === 3, `atk=${g156.fightAttackBonus()}`);
      const rec156 = st156.serializeVisit();
      ok('task156: serializeVisit snapshots the per-fight bonus', !!rec156 && rec156.fightBonus && rec156.fightBonus.attack === 3, `fb=${JSON.stringify(rec156 && rec156.fightBonus)}`);

      const g156b = new GameState(sanitizeData(JSON.parse(JSON.stringify({ ...g156.data, visit: rec156 }))));
      ok('task156: a plain data round-trip still drops the transient bonus (task-49 invariant holds)', g156b.fightAttackBonus() === 0);
      ok('task156: the sanitised visit record keeps the fightBonus', !!g156b.data.visit && g156b.data.visit.fightBonus && g156b.data.visit.fightBonus.attack === 3);
      const st156b = new Story(document.createElement('div'), g156b, { navigate(){}, onDeath(){}, notify(){} });
      st156b.resume(sec156, 1, 'F156', g156b.data.visit, null);
      ok('task156: resume re-applies the +3 attack bonus, once (paid bonus survives, no double)', g156b.fightAttackBonus() === 3, `atk=${g156b.fightAttackBonus()}`);

      // Exploitable direction: a hidden penalty must not be shed by reloading.
      const secP = parse('<section name="P156"><p><tick special="attack" bonus="-2" hidden="t"/><fight name="Curse" combat="6" defence="10" stamina="12"/></p></section>');
      const gp = GameState.create({ name:'T156p', gender:'m', profession:'Warrior', book:1, adv });
      const stp = new Story(document.createElement('div'), gp, { navigate(){}, onDeath(){}, notify(){} });
      gp.setVisitProvider(() => stp.serializeVisit());
      gp.goTo(1, 'P156'); stp.begin(secP, 1, 'P156');
      const recp = stp.serializeVisit();
      const gpb = new GameState(sanitizeData(JSON.parse(JSON.stringify({ ...gp.data, visit: recp }))));
      const stpb = new Story(document.createElement('div'), gpb, { navigate(){}, onDeath(){}, notify(){} });
      stpb.resume(secP, 1, 'P156', gpb.data.visit, null);
      ok('task156: a hidden attack penalty is not shed by reloading', gpb.fightAttackBonus() === -2, `atk=${gpb.fightAttackBonus()}`);
    }

    // --- task 50: var-keyed success/failure branches wait for their roll (no entry fire) ---
    window.__FL_INSTANT_DICE__ = true;
    const settle50 = () => new Promise(r => setTimeout(r, 40));
    // §3.437: two Difficulty-17 rolls (var m, s) feed nested success/failure branches.
    const g437 = GameState.create({ name:'B437', gender:'m', profession:'Warrior', book:3, adv });
    const c437 = document.createElement('div');
    const st437 = new Story(c437, g437, { navigate(){}, onDeath(){}, notify(){} });
    const s437 = await data.getSection(3, '437'); st437.begin(s437, 3, '437');
    const ticked437 = () => ['3.437.1', '3.437.2', '3.437.3'].filter((cw) => g437.hasCodeword(cw));
    ok('§3.437 no outcome codeword is ticked before the rolls (was: failure fired on entry)', ticked437().length === 0, `ticked=${ticked437()}`);
    let rb437 = c437.querySelector('.btn-roll'); rb437.click(); await settle50(); // MAGIC
    ok('§3.437 the inner SANCTITY branch stays pending after only the MAGIC roll', ticked437().length === 0, `ticked=${ticked437()}`);
    rb437 = c437.querySelector('.btn-roll');
    ok('§3.437 a second (SANCTITY) roll button remains after the MAGIC roll', !!rb437);
    if (rb437) { rb437.click(); await settle50(); } // SANCTITY
    ok('§3.437 exactly one outcome codeword is ticked after both rolls', ticked437().length === 1, `ticked=${ticked437()}`);

    // Regression: the set-sentinel idiom must still resolve a var-branch with NO roll.
    // §2.138 with the key of stars: <set var="open" value="1"/> → "Open the door" → 69.
    const g138 = GameState.create({ name:'K138', gender:'m', profession:'Warrior', book:2, adv });
    g138.addItem(makeItem('item', 'key of stars'));
    const c138 = document.createElement('div');
    const st138 = new Story(c138, g138, { navigate(){}, onDeath(){}, notify(){} });
    const s138 = await data.getSection(2, '138'); st138.begin(s138, 2, '138');
    ok('§2.138 with the key, the set-sentinel resolves "Open the door" (→69) with no roll', /Continue → 69/.test(c138.textContent), c138.textContent.replace(/\s+/g, ' ').slice(0, 140));
    // Without the key, the door outcome waits for the THIEVERY roll (no stale entry fire).
    const g138b = GameState.create({ name:'NK138', gender:'m', profession:'Warrior', book:2, adv });
    const c138b = document.createElement('div');
    const st138b = new Story(c138b, g138b, { navigate(){}, onDeath(){}, notify(){} });
    const s138b = await data.getSection(2, '138'); st138b.begin(s138b, 2, '138');
    ok('§2.138 without the key, neither door outcome shows on entry (stale-var fire prevented)', !/Continue → 69/.test(c138b.textContent) && !/Continue → 92/.test(c138b.textContent), c138b.textContent.replace(/\s+/g, ' ').slice(0, 140));
    // §5.24: the Hangman's per-round <failure var="hang"><lose stamina="-hang"/> must
    // NOT drain Stamina on entry (hang unset) — it used to memoise a 0 drain forever.
    const g524 = GameState.create({ name:'H524', gender:'m', profession:'Warrior', book:5, adv });
    g524.data.stamina = 20; g524.data.staminaMax = 20;
    const c524 = document.createElement('div');
    const st524 = new Story(c524, g524, { navigate(){}, onDeath(){}, notify(){} });
    const s524 = await data.getSection(5, '24'); st524.begin(s524, 5, '24');
    ok('§5.24 the per-round Hangman drain does not fire on entry (hang unset)', g524.data.stamina === 20, `st=${g524.data.stamina}`);

    // --- task 122: roll-less <outcome codeword=…> dispatch tables resolve --------
    {
      // §4.2 "Which of these codewords do you have?" — no <random>, so the table
      // must resolve against live codewords, and its bare default is the catch-all.
      const gNone = GameState.create({ name:'CW0', gender:'m', profession:'Warrior', book:4, adv });
      const cNone = document.createElement('div');
      new Story(cNone, gNone, { navigate(){}, onDeath(){}, notify(){} }).begin(await data.getSection(4,'2'), 4, '2');
      ok('§4.2 with no codewords, the default reveals →97', /Continue → 97/.test(cNone.textContent) && !/Continue → 57/.test(cNone.textContent), cNone.textContent.replace(/\s+/g,' ').slice(0,120));

      const gDef = GameState.create({ name:'CWd', gender:'m', profession:'Warrior', book:4, adv });
      gDef.addCodeword('Defend');
      const cDef = document.createElement('div');
      new Story(cDef, gDef, { navigate(){}, onDeath(){}, notify(){} }).begin(await data.getSection(4,'2'), 4, '2');
      ok('§4.2 with Defend, the codeword row reveals →57 (not the default →97)', /Continue → 57/.test(cDef.textContent) && !/Continue → 97/.test(cDef.textContent), cDef.textContent.replace(/\s+/g,' ').slice(0,120));

      // §4.184 has NO default row: a held codeword reveals; nothing else does.
      const gDel = GameState.create({ name:'CWx', gender:'m', profession:'Warrior', book:4, adv });
      gDel.addCodeword('Deliver');
      const cDel = document.createElement('div');
      new Story(cDel, gDel, { navigate(){}, onDeath(){}, notify(){} }).begin(await data.getSection(4,'184'), 4, '184');
      ok('§4.184 with Deliver reveals →247 only', /Continue → 247/.test(cDel.textContent) && !/Continue → 211/.test(cDel.textContent));
      const gNo184 = GameState.create({ name:'CWn', gender:'m', profession:'Warrior', book:4, adv });
      const cNo184 = document.createElement('div');
      new Story(cNo184, gNo184, { navigate(){}, onDeath(){}, notify(){} }).begin(await data.getSection(4,'184'), 4, '184');
      ok('§4.184 with neither codeword reveals no table goto (no false default)', !/Continue → (247|211)/.test(cNo184.textContent));

      // §2.301 keys on a hidden box codeword ticked THIS visit (initiate of Alvir
      // and Valmir) — the same-visit write must be visible to the table below it.
      const gIni = GameState.create({ name:'INI', gender:'m', profession:'Warrior', book:2, adv });
      gIni.setGod('Alvir and Valmir');
      const cIni = document.createElement('div');
      new Story(cIni, gIni, { navigate(){}, onDeath(){}, notify(){} }).begin(await data.getSection(2,'301'), 2, '301');
      ok('§2.301 an initiate (tick this visit) takes the initiate row →269', /Continue → 269/.test(cIni.textContent) && !/Continue → 292/.test(cIni.textContent), cIni.textContent.replace(/\s+/g,' ').slice(0,120));
      const gLay = GameState.create({ name:'LAY', gender:'m', profession:'Warrior', book:2, adv });
      const cLay = document.createElement('div');
      new Story(cLay, gLay, { navigate(){}, onDeath(){}, notify(){} }).begin(await data.getSection(2,'301'), 2, '301');
      ok('§2.301 a non-initiate falls to the default →292', /Continue → 292/.test(cLay.textContent) && !/Continue → 269/.test(cLay.textContent), cLay.textContent.replace(/\s+/g,' ').slice(0,120));

      // §4.457: a lone <outcome codeword> inside <choices> (the Initiate row) shows
      // only for a Tambu initiate; the donate/leave choices are always present.
      const gTam = GameState.create({ name:'TAM', gender:'m', profession:'Warrior', book:4, adv });
      gTam.setGod('Tambu');
      const cTam = document.createElement('div');
      new Story(cTam, gTam, { navigate(){}, onDeath(){}, notify(){} }).begin(await data.getSection(4,'457'), 4, '457');
      ok('§4.457 a Tambu initiate sees the Initiate row →345', !!Array.from(cTam.querySelectorAll('.goto-primary')).find((b)=>/345/.test(b.textContent)));
      const gOut = GameState.create({ name:'OUT', gender:'m', profession:'Warrior', book:4, adv });
      const cOut = document.createElement('div');
      new Story(cOut, gOut, { navigate(){}, onDeath(){}, notify(){} }).begin(await data.getSection(4,'457'), 4, '457');
      ok('§4.457 a non-initiate sees no Initiate row but keeps its choices', !Array.from(cOut.querySelectorAll('.goto-primary')).find((b)=>/345/.test(b.textContent)) && cOut.querySelectorAll('.choice').length >= 2, `gotos=${Array.from(cOut.querySelectorAll('.goto-primary')).map(b=>b.textContent)} choices=${cOut.querySelectorAll('.choice').length}`);

      // Regression: a ROLL-fed <outcomes> table (range branches + <random>) still
      // waits — no outcome reveals on entry; the roll control is offered instead.
      const gRoll = GameState.create({ name:'ROLL', gender:'m', profession:'Warrior', book:1, adv });
      const cRoll = document.createElement('div');
      new Story(cRoll, gRoll, { navigate(){}, onDeath(){}, notify(){} }).begin(await data.getSection(1,'120'), 1, '120');
      ok('§1.120 a rolled travel table reveals no outcome before rolling', !/Continue → (324|559|207)/.test(cRoll.textContent) && !!cRoll.querySelector('.btn-roll'), cRoll.textContent.replace(/\s+/g,' ').slice(0,120));
    }

    // --- task 51: <difficulty|rankcheck flag=> roll gates + shared-success binding ---
    // §6.731: the CHARISMA boon roll is gated behind the 100-Shard donation (flag x).
    const g731 = GameState.create({ name:'D731', gender:'m', profession:'Warrior', book:6, adv });
    g731.data.shards = 300;
    const c731 = document.createElement('div');
    const st731 = new Story(c731, g731, { navigate(){}, onDeath(){}, notify(){} });
    const s731 = await data.getSection(6, '731'); st731.begin(s731, 6, '731');
    const chaRoll = Array.from(c731.querySelectorAll('.btn-roll')).find((b) => /CHARISMA/i.test(b.textContent));
    ok('§6.731 the CHARISMA boon roll is disabled until the donation is paid', !!chaRoll && chaRoll.disabled === true, chaRoll ? `dis=${chaRoll.disabled}` : 'no roll button');
    // Synthetic: flag-gated rolls arm on payment, consume on roll, and a shared
    // <success> binds to whichever roll ACTUALLY resolved (not just the last-listed).
    const gsyn = GameState.create({ name:'SYN', gender:'m', profession:'Warrior', book:2, adv });
    gsyn.data.shards = 50; gsyn.data.abilities.magic = 12; gsyn.data.abilities.scouting = 12;
    const csyn = document.createElement('div');
    const stsyn = new Story(csyn, gsyn, { navigate(){}, onDeath(){}, notify(){} });
    const synXml = parse('<section><lose shards="10" price="x"/><difficulty ability="magic" level="0" flag="x">MAGIC roll</difficulty> or <difficulty ability="scouting" level="99" flag="x">SCOUTING roll</difficulty>.<choices><success section="376">Found the path</success><choice section="359">Failed</choice></choices></section>');
    stsyn.begin(synXml, 2, 'syn');
    let synRolls = Array.from(csyn.querySelectorAll('.btn-roll'));
    ok('flag-gated: both rolls are disabled before payment', synRolls.length === 2 && synRolls.every((b) => b.disabled), `n=${synRolls.length} dis=${synRolls.map((b) => b.disabled)}`);
    const synPay = csyn.querySelector('.pay-action');
    ok('flag-gated: a pay button is offered to arm the rolls', !!synPay && !synPay.disabled);
    synPay.click(); // arm flag x
    synRolls = Array.from(csyn.querySelectorAll('.btn-roll'));
    ok('flag-gated: payment deducts the cost and enables the rolls', gsyn.data.shards === 40 && synRolls.some((b) => !b.disabled), `sh=${gsyn.data.shards} dis=${synRolls.map((b) => b.disabled)}`);
    const magicBtn = synRolls.find((b) => /MAGIC/i.test(b.textContent) && !b.disabled);
    magicBtn.click(); await settle50(); // MAGIC at level 0 → always succeeds
    ok('flag-gated: a first-listed MAGIC success reveals the shared success (→376)', /Continue → 376/.test(csyn.textContent), csyn.textContent.replace(/\s+/g, ' ').slice(0, 160));
    const scoutBtn = Array.from(csyn.querySelectorAll('.btn-roll')).find((b) => /SCOUTING/i.test(b.textContent));
    ok('flag-gated: the second roll is disarmed after the one paid attempt is spent', !!scoutBtn && scoutBtn.disabled, scoutBtn ? `dis=${scoutBtn.disabled}` : 'no scout button');

    // --- task 27: cap visit-box ticks so a matched <if ticks="N"> guard stays matched ---
    const gtk = GameState.create({ name:'TK', gender:'m', profession:'Warrior', book:1, adv });
    const renderTk = async () => {
      const c = document.createElement('div');
      const st = new Story(c, gtk, { navigate(){}, onDeath(){}, notify(){} });
      gtk.data.book = 1; gtk.data.section = '16';
      const el = await data.getSection(1, '16'); st.begin(el, 1, '16');
      return c;
    };
    await renderTk();
    ok('§1.16 visit 1 ticks the box once', gtk.tickCount(1, '16') === 1, `t=${gtk.tickCount(1,'16')}`);
    await renderTk();
    ok('§1.16 visit 2 stays capped at boxes=1 (was 2 before the fix)', gtk.tickCount(1, '16') === 1, `t=${gtk.tickCount(1,'16')}`);
    await renderTk();
    ok('§1.16 visit 3 still capped at 1', gtk.tickCount(1, '16') === 1, `t=${gtk.tickCount(1,'16')}`);
    gtk.data.book = 1; gtk.data.section = '16';
    ok('§1.16 <if ticks="1"> guard still matches on a repeat visit', eng.evaluateCondition(parse('<if ticks="1"/>'), gtk) === true);
    // a boxless section is left uncapped (existing behaviour preserved).
    const gtk0 = GameState.create({ name:'TK0', gender:'m', profession:'Warrior', book:1, adv });
    gtk0.setSectionBoxes(0); gtk0.data.section = '999'; gtk0.addTick(); gtk0.addTick();
    ok('boxless section tick is uncapped', gtk0.tickCount(1, '999') === 2, `t=${gtk0.tickCount(1,'999')}`);

    // --- task 70: box shows ☑ on the visit it ticks; bare <tick/> prints its words ---
    const g70 = GameState.create({ name:'T70', gender:'m', profession:'Warrior', book:1, adv });
    const c70 = document.createElement('div');
    const st70 = new Story(c70, g70, { navigate(){}, onDeath(){}, notify(){} });
    g70.data.book = 1; g70.data.section = '496';
    const s496 = await data.getSection(1, '496'); st70.begin(s496, 1, '496');
    ok('§1.496 first visit ticks the box in state', g70.tickCount(1, '496') === 1, `t=${g70.tickCount(1,'496')}`);
    ok('§1.496 box renders ☑ on the ticking visit (was ☐ before)', c70.querySelectorAll('.section-boxes .tick-box.ticked').length === 1, `ticked=${c70.querySelectorAll('.section-boxes .tick-box.ticked').length}`);
    ok('§1.496 bare <tick/> renders "tick the box, and read on"', /tick the box, and read on/.test(c70.textContent) && !/,\s*,/.test(c70.textContent), c70.textContent.replace(/\s+/g,' ').slice(0,140));

    // --- task 105: <if ticks="N"> reads the ENTRY count, not the live one ---
    // §1.496 ticks its box on entry; the "already ticked → 317" redirect must stay
    // hidden this visit even after a mid-visit rerender (taking the spear), and only a
    // genuine second visit (re-entered via begin) may show it.
    const g105 = GameState.create({ name:'T105', gender:'m', profession:'Warrior', book:1, adv });
    const c105 = document.createElement('div');
    const st105 = new Story(c105, g105, { navigate(){}, onDeath(){}, notify(){} });
    const redirect317 = () => Array.from(c105.querySelectorAll('.goto')).find((b) => b.textContent.trim() === '317');
    const spear105 = () => Array.from(c105.querySelectorAll('.take-item')).find((b) => /magic spear/i.test(b.textContent));
    g105.data.book = 1; g105.data.section = '496';
    st105.begin(await data.getSection(1, '496'), 1, '496');
    ok('§496 entry: box ticked but the ticks=1 redirect stays inactive',
       g105.tickCount(1,'496') === 1 && !!redirect317() && redirect317().disabled === true,
       `t=${g105.tickCount(1,'496')} dis=${redirect317() && redirect317().disabled}`);
    ok('§496 offers a magic-spear take button', !!spear105());
    spear105().click(); // mid-visit rerender() (not begin) — tickCount stays 1
    ok('§496 taking the spear does not flip the guard (redirect still inactive)',
       !!redirect317() && redirect317().disabled === true, `dis=${redirect317() && redirect317().disabled}`);
    ok('§496 the spear was taken', g105.hasItem('magic spear'));
    // a genuine second visit re-enters via begin() and re-snapshots (box already 1) → fires
    st105.begin(await data.getSection(1, '496'), 1, '496');
    ok('§496 second visit activates the ticks=1 redirect to 317',
       !!redirect317() && redirect317().disabled === false, `dis=${redirect317() && redirect317().disabled}`);

    // --- task 28: honour dead="t" on <goto>/<choice> ---
    // §4.16: a living survivor must NOT be able to click the dead="t" link into §7.
    const gAlive = GameState.create({ name:'DA', gender:'m', profession:'Warrior', book:4, adv });
    gAlive.data.stamina = 100; gAlive.data.staminaMax = 100;
    const cAlive = document.createElement('div');
    const stAlive = new Story(cAlive, gAlive, { navigate(){}, onDeath(){}, notify(){} });
    const s416 = await data.getSection(4, '16'); stAlive.begin(s416, 4, '16');
    const gotosA = Array.from(cAlive.querySelectorAll('.goto'));
    const g7A = gotosA.find((b) => b.textContent.trim() === '7');
    const g666A = gotosA.find((b) => b.textContent.trim() === '666');
    ok('§4.16 dead="t" goto §7 is disabled while alive', !!g7A && g7A.disabled === true, `found=${!!g7A} dis=${g7A && g7A.disabled}`);
    ok('§4.16 living goto §666 stays enabled', !!g666A && g666A.disabled === false, `found=${!!g666A} dis=${g666A && g666A.disabled}`);
    // A dead player CAN take the dead="t" link.
    const gDead = GameState.create({ name:'DD', gender:'m', profession:'Warrior', book:4, adv });
    gDead.data.stamina = 0;
    const cDead = document.createElement('div');
    const stDead = new Story(cDead, gDead, { navigate(){}, onDeath(){}, notify(){} });
    const s416b = await data.getSection(4, '16'); stDead.begin(s416b, 4, '16');
    const g7D = Array.from(cDead.querySelectorAll('.goto')).find((b) => b.textContent.trim() === '7');
    ok('§4.16 dead="t" goto §7 is enabled when the player is dead', !!g7D && g7D.disabled === false, `found=${!!g7D} dis=${g7D && g7D.disabled}`);
    // A dead="t" <choice> is likewise gated while alive.
    const deadChoiceBtn = renderChoice(stAlive, parse('<choice dead="t" section="99">enter the death section</choice>'), 'dc');
    ok('dead="t" choice disabled while the player lives', deadChoiceBtn.disabled === true);
    // The fight gate prefers an explicit dead="t" goto as the lose-branch signal.
    const fgSec = parse('<section><fight name="X" combat="5" defence="5" stamina="5"/><p>If you win, <goto section="10"/>. If you are killed, <goto section="7" dead="t"/>.</p></section>');
    const gate = gates.computeFightGate(fgSec, new Set());
    const deadGoto = fgSec.querySelector('goto[dead="t"]');
    ok('fight gate marks a dead="t" goto as the lose-branch', !!gate && gate.loseNodes.has(deadGoto) && gate.hasLosePath === true, `has=${!!gate && gate.loseNodes.has(deadGoto)}`);

    // --- task 45: sequential multi-fight sections gate on ALL fights, not the last ---
    // §1.121: three Repulsive Ones, "fight one at a time", "if you beat all three → 213".
    const g121 = GameState.create({ name:'M121', gender:'m', profession:'Warrior', book:1, adv });
    g121.data.stamina = 100; g121.data.staminaMax = 100;
    const c121 = document.createElement('div');
    const st121 = new Story(c121, g121, { navigate(){}, onDeath(){}, notify(){} });
    const s121 = await data.getSection(1, '121'); st121.begin(s121, 1, '121');
    ok('§1.121 renders all three sequential fight widgets', c121.querySelectorAll('.fight').length === 3, `n=${c121.querySelectorAll('.fight').length}`);
    const findGoto121 = () => Array.from(c121.querySelectorAll('.goto')).find((b) => b.textContent.trim() === '213');
    ok('§1.121 exit to 213 is gated on entry', (() => { const b = findGoto121(); return b && b.disabled === true; })());
    ok('§1.121 only the first fight is active (2nd/3rd locked)', c121.querySelectorAll('.fight .btn-roll').length === 1, `attacks=${c121.querySelectorAll('.fight .btn-roll').length}`);
    // Winning only the FIRST fight must NOT open the exit (previously winning the
    // last one alone did — the bug this task fixes).
    st121.sectionFights[0].outcome = 'win';
    st121.rerender();
    ok('§1.121 exit stays gated when only the first fight is won', (() => { const b = findGoto121(); return b && b.disabled === true; })());
    ok('§1.121 the second fight unlocks after the first is won', c121.querySelectorAll('.fight .btn-roll').length === 1, `attacks=${c121.querySelectorAll('.fight .btn-roll').length}`);
    // Win all three: the exit opens.
    st121.sectionFights.forEach((f) => { f.outcome = 'win'; });
    st121.rerender();
    ok('§1.121 exit to 213 opens once all three are won', (() => { const b = findGoto121(); return b && b.disabled === false; })());

    // §5.80: three fights with an explicit "if you lose → §7 (dead)" branch.
    // Dying to the FIRST fight must defer death to that lose-branch (the old code
    // read only the last fight, whose outcome was null, so real death fired).
    const g80 = GameState.create({ name:'M80', gender:'m', profession:'Warrior', book:5, adv });
    g80.data.stamina = 100; g80.data.staminaMax = 100;
    let died80 = false;
    const c80 = document.createElement('div');
    const st80 = new Story(c80, g80, { navigate(){}, onDeath(){ died80 = true; }, notify(){} });
    const s80 = await data.getSection(5, '80'); st80.begin(s80, 5, '80');
    ok('§5.80 has a lose-branch (hasLosePath)', st80.fightGate && st80.fightGate.hasLosePath === true);
    // Simulate a loss on fight 1: the player is slain and drawFight marks that fight.
    g80.data.stamina = 0;
    st80.sectionFights[0].outcome = 'lose';
    st80.rerender();
    ok('§5.80 losing the first fight defers death (onDeath NOT fired)', died80 === false);
    const g80goto = (s) => Array.from(c80.querySelectorAll('.goto')).find((b) => b.textContent.trim() === s);
    ok('§5.80 the dead="t" §7 lose-branch is the enabled route after a loss', (() => { const b = g80goto('7'); return b && b.disabled === false; })());
    ok('§5.80 the win exit §123 is disabled after a loss', (() => { const b = g80goto('123'); return b && b.disabled === true; })());

    // --- task 162: a continuing combat round persists the updated fight memo ---
    // A fight lives in Story.ctx, not GameState.data. A continuing round (attack / COMBAT
    // reroll / blessing) redraws the widget directly; it previously neither rerendered nor
    // saved, so if the player wounded a surviving foe and the replies missed, NO persistent
    // mutation occurred — a reload restored the enemy's pre-round Stamina. render-combat now
    // saves the visit after each completed-but-continuing action, so the serialized fight
    // (enemy Stamina, log, once-per-round flags) resumes exactly. To isolate the fix, every
    // foe here is Combat 0 vs an armoured Defence — it can NEVER hit — so the ONLY thing that
    // can persist the round is the new continue-save (no incidental damageStamina autosave).
    {
      const rnd162 = Math.random;
      window.__FL_INSTANT_DICE__ = true;
      const settle162 = () => new Promise((r) => setTimeout(r, 30));
      const firstFight = (st) => [...st.ctx.fights.values()][0];
      const recFights = (g) => (g.data.visit && g.data.visit.ctx && g.data.visit.ctx.fights) || [];

      // Single fight: player wounds a surviving foe (18 vs Def 15 → −3, Stamina 20→17); the
      // Combat-0 foe misses vs the armoured Defence. Then resume into a fresh state.
      {
        const secS = parse('<section name="F162"><p><fight name="Ogre" combat="0" defence="15" stamina="20"/></p></section>');
        const g = GameState.create({ name:'F162', gender:'m', profession:'Warrior', book:1, adv });
        g.data.stamina = 30; g.data.staminaMax = 30; g.data.abilities.combat = 6;
        g.data.items = []; g.addItem(makeItem('armour', 'plate', 10)); // Defence high enough that Combat-0 foes always miss
        const cont = document.createElement('div');
        const story = new Story(cont, g, { navigate(){}, onDeath(){}, notify(){} });
        g.setVisitProvider(() => story.serializeVisit());
        g.goTo(1, 'F162'); story.begin(secS, 1, 'F162');
        ok('task162: begin persisted the fight at full enemy Stamina', recFights(g).length === 1 && recFights(g)[0][1].stamina === 20);

        Math.random = () => 0.99; // 2d6 = 12 → player 18 vs 15 hits; foe 12 vs Def >=16 misses
        Array.from(cont.querySelectorAll('.fight .btn-roll')).find((b) => b.textContent === 'Attack').click();
        await settle162();
        Math.random = rnd162;

        const lf = firstFight(story);
        ok('task162: the round continued — foe wounded (17/20) and alive, player unhurt',
           lf.stamina === 17 && !lf.outcome && g.data.stamina === 30, `en=${lf.stamina} st=${g.data.stamina}`);
        ok('task162: the continuing round was persisted (foe Stamina 17, not the pre-round 20)',
           recFights(g).length === 1 && recFights(g)[0][1].stamina === 17 && recFights(g)[0][1].log.length === lf.log.length,
           `rec=${recFights(g)[0] && recFights(g)[0][1].stamina}`);

        const g2 = new GameState(sanitizeData(JSON.parse(JSON.stringify({ ...g.data }))));
        const cont2 = document.createElement('div');
        const story2 = new Story(cont2, g2, { navigate(){}, onDeath(){}, notify(){} });
        story2.resume(secS, 1, 'F162', g2.data.visit, null);
        const rf = firstFight(story2);
        ok('task162: reload restores the exact foe Stamina/log/flags',
           rf.stamina === 17 && rf.log.length === lf.log.length && rf.lastStrikeMissed === lf.lastStrikeMissed && rf.attackRerolled === lf.attackRerolled,
           `en=${rf.stamina} log=${rf.log.length}`);
        ok('task162: the reloaded widget shows the resumed foe Stamina (17/20)',
           /Stamina 17\/20/.test(cont2.querySelector('.en-stam').textContent), cont2.querySelector('.en-stam').textContent);
      }

      // Group fight: player wounds one foe (Orc 20→17); both Combat-0 foes miss; continues.
      {
        const secG = parse('<section name="G162"><p><fight group="g" name="Orc" combat="0" defence="15" stamina="20"/><fight group="g" name="Goblin" combat="0" defence="14" stamina="18"/></p></section>');
        const g = GameState.create({ name:'G162', gender:'m', profession:'Warrior', book:6, adv });
        g.data.stamina = 40; g.data.staminaMax = 40; g.data.abilities.combat = 6;
        g.data.items = []; g.addItem(makeItem('armour', 'plate', 10));
        const cont = document.createElement('div');
        const story = new Story(cont, g, { navigate(){}, onDeath(){}, notify(){} });
        g.setVisitProvider(() => story.serializeVisit());
        g.goTo(6, 'G162'); story.begin(secG, 6, 'G162');

        Math.random = () => 0.99;
        Array.from(cont.querySelectorAll('button')).find((b) => b.textContent === 'Attack Orc').click();
        await settle162();
        Math.random = rnd162;

        const orcLive = [...story.ctx.fights.values()].find((f) => f.name === 'Orc');
        ok('task162: the group round continued — Orc wounded (17/20), player unhurt',
           orcLive.stamina === 17 && g.data.stamina === 40, `orc=${orcLive.stamina} st=${g.data.stamina}`);
        const recOrc = recFights(g).map((e) => e[1]).find((f) => f.name === 'Orc');
        ok('task162: the continuing group round was persisted (Orc Stamina 17)',
           !!recOrc && recOrc.stamina === 17, `rec=${recOrc && recOrc.stamina}`);

        const g2 = new GameState(sanitizeData(JSON.parse(JSON.stringify({ ...g.data }))));
        const cont2 = document.createElement('div');
        const story2 = new Story(cont2, g2, { navigate(){}, onDeath(){}, notify(){} });
        story2.resume(secG, 6, 'G162', g2.data.visit, null);
        const orcR = [...story2.ctx.fights.values()].find((f) => f.name === 'Orc');
        const gobR = [...story2.ctx.fights.values()].find((f) => f.name === 'Goblin');
        ok('task162: reload restores both foes (Orc 17/20 wounded, Goblin 18/18 untouched)',
           orcR.stamina === 17 && gobR.stamina === 18, `orc=${orcR.stamina} gob=${gobR.stamina}`);
        ok('task162: the reloaded group widget shows the wounded Orc (17/20)',
           /Stamina 17\/20/.test(cont2.textContent), (cont2.textContent.replace(/\s+/g,' ').match(/Stamina \d+\/\d+/g) || []).join(' '));
      }

      // COMBAT blessing retry: a missed strike is retried (18 vs 15 → −3); rerollAttack
      // consumes/saves the blessing BEFORE recording the retry, so only the continue-save
      // captures the retried Stamina + attackRerolled flag. Resume proves it persisted.
      {
        const secR = parse('<section name="R162"><p><fight name="Duellist" combat="0" defence="15" stamina="20"/></p></section>');
        const g = GameState.create({ name:'R162', gender:'m', profession:'Warrior', book:4, adv });
        g.data.stamina = 30; g.data.staminaMax = 30; g.data.abilities.combat = 6;
        g.data.items = []; g.addItem(makeItem('armour', 'plate', 10));
        g.addBlessing('combat');
        const cont = document.createElement('div');
        const story = new Story(cont, g, { navigate(){}, onDeath(){}, notify(){} });
        g.setVisitProvider(() => story.serializeVisit());
        g.goTo(4, 'R162'); story.begin(secR, 4, 'R162');

        Math.random = () => 0; // 2d6 = 2 → player 8 vs 15 misses; foe 2 vs Def >=16 misses
        Array.from(cont.querySelectorAll('.fight .btn-roll')).find((b) => b.textContent === 'Attack').click();
        await settle162();
        Math.random = rnd162;
        const retryBtn = () => Array.from(cont.querySelectorAll('button')).find((b) => /retry your attack/.test(b.textContent));
        ok('task162: a missed strike offers the COMBAT-blessing retry', !!retryBtn() && firstFight(story).stamina === 20);

        Math.random = () => 0.99; // retry hits: 18 vs 15 → 20→17
        retryBtn().click();
        Math.random = rnd162;
        const lf = firstFight(story);
        ok('task162: the retry wounded the foe (17), spent the blessing, flagged the reroll',
           lf.stamina === 17 && lf.attackRerolled === true && !g.hasBlessing('combat'), `en=${lf.stamina} rr=${lf.attackRerolled}`);
        ok('task162: the retried round was persisted (foe 17, attackRerolled)',
           recFights(g)[0] && recFights(g)[0][1].stamina === 17 && recFights(g)[0][1].attackRerolled === true);

        const g2 = new GameState(sanitizeData(JSON.parse(JSON.stringify({ ...g.data }))));
        const cont2 = document.createElement('div');
        const story2 = new Story(cont2, g2, { navigate(){}, onDeath(){}, notify(){} });
        story2.resume(secR, 4, 'R162', g2.data.visit, null);
        const rf = firstFight(story2);
        ok('task162: reload keeps the retried Stamina + spent reroll (no free re-retry)',
           rf.stamina === 17 && rf.attackRerolled === true && !g2.hasBlessing('combat')
           && !Array.from(cont2.querySelectorAll('button')).find((b) => /retry your attack/.test(b.textContent)),
           `en=${rf.stamina} rr=${rf.attackRerolled}`);
      }

      Math.random = rnd162;
    }

    // --- task 171: single & group combat widgets share one control shell (parity) ---------
    // drawFight and drawGroupFight now build their stats/log/animation-guard/flee/commit shell
    // from the same local helpers (their DIFFERENT rules stay separate). These assert BOTH
    // widgets still expose+consume each blessing, route a flee once, drop a stale animated
    // strike, and persist a continuing round exactly once — the parity that drifted before.
    {
      const rnd171 = Math.random;
      const settle171 = () => new Promise((r) => setTimeout(r, 20));
      const secSingle = '<section name="P171S"><p><fight name="Ogre" combat="1" defence="1" stamina="99"/></p><flee><goto section="99" book="2"/>Run</flee></section>';
      const secGroup = '<section name="P171G"><p><fight group="g" name="A" combat="1" defence="1" stamina="99"/><fight group="g" name="B" combat="1" defence="1" stamina="99"/></p><flee><goto section="99" book="2"/>Run</flee></section>';
      const wrathBtn = (c) => Array.from(c.querySelectorAll('.blessing-combat')).find((b) => /Divine Wrath/.test(b.textContent));
      const defBtn = (c) => Array.from(c.querySelectorAll('.blessing-combat')).find((b) => /Defence through Faith/.test(b.textContent));
      const fleeBtn = (c) => Array.from(c.querySelectorAll('button')).find((b) => b.textContent.trim() === 'Flee');
      const attackBtn = (c) => Array.from(c.querySelectorAll('.fight .btn-roll')).find((b) => /^Attack/.test(b.textContent));
      const build = (secXml, navSpy) => {
        const g = GameState.create({ name:'P171', gender:'m', profession:'Warrior', book:1, adv });
        g.ephemeral = true; g.data.stamina = 40; g.data.staminaMax = 40; g.data.abilities.combat = 12;
        g.addBlessing('wrath'); g.addBlessing('defence');
        const c = document.createElement('div');
        const st = new Story(c, g, { navigate: navSpy || (() => {}), onDeath(){}, notify(){} });
        g.setVisitProvider(() => st.serializeVisit());
        st.begin(parse(secXml), 1, secXml.includes('group="g"') ? 'P171G' : 'P171S');
        return { g, c, st };
      };

      // (expose) both widgets show Divine Wrath + Defence-through-Faith when held and unresolved.
      const es = build(secSingle), eg = build(secGroup);
      ok('task171: the single widget exposes Wrath + Defence blessings', !!wrathBtn(es.c) && !!defBtn(es.c));
      ok('task171: the group widget exposes Wrath + Defence blessings', !!wrathBtn(eg.c) && !!defBtn(eg.c));

      // (consume) clicking Defence-through-Faith spends the blessing once and applies +3 on both.
      const cs = build(secSingle); defBtn(cs.c).click(); await settle171();
      const csFight = Array.from(cs.st.ctx.fights.values())[0];
      ok('task171: single Defence blessing consumed once, +3 applied, button gone', !cs.g.hasBlessing('defence') && csFight.defenceBonus === 3 && !defBtn(cs.c));
      const cg = build(secGroup); defBtn(cg.c).click(); await settle171();
      const cgFights = Array.from(cg.st.ctx.fights.values());
      ok('task171: group Defence blessing consumed once, +3 on every member, button gone', !cg.g.hasBlessing('defence') && cgFights.length === 2 && cgFights.every((f) => f.defenceBonus === 3) && !defBtn(cg.c));

      // (flee once) each widget routes a flee to its escape section exactly once.
      let ns = 0; const fs = build(secSingle, () => { ns++; }); fleeBtn(fs.c).click();
      ok('task171: single flee routes exactly once', ns === 1 && fs.st.sectionFight.outcome === 'fled', `navs=${ns}`);
      let ng = 0; const fg = build(secGroup, () => { ng++; }); fleeBtn(fg.c).click();
      ok('task171: group flee routes exactly once', ng === 1 && fg.st.sectionFight.outcome === 'fled', `navs=${ng}`);

      // (stale strike) a strike whose visit changes mid-animation is dropped on both widgets.
      window.__FL_INSTANT_DICE__ = false;
      let releaseGate; window.__FL_DICE_GATE__ = () => new Promise((res) => { releaseGate = res; });
      const ss = build(secSingle); const ssFight = Array.from(ss.st.ctx.fights.values())[0];
      attackBtn(ss.c).click(); ss.st.ctx = {}; releaseGate(); await settle171();
      ok('task171: single drops a strike after navigating away mid-animation', ssFight.stamina === 99, `en=${ssFight.stamina}`);
      const sg = build(secGroup); const sgFights = Array.from(sg.st.ctx.fights.values());
      attackBtn(sg.c).click(); sg.st.ctx = {}; releaseGate(); await settle171();
      ok('task171: group drops a strike after navigating away mid-animation', sgFights.every((f) => f.stamina === 99), `en=${sgFights.map((f) => f.stamina)}`);
      delete window.__FL_DICE_GATE__;

      // (persist once) a continuing (non-resolving) round persists exactly once on both widgets.
      window.__FL_INSTANT_DICE__ = true;
      Math.random = () => 0.99; // the player hits, but Stamina 99 keeps the fight unresolved
      const ps = build(secSingle); let pc = 0; const ocs = ps.g.commitVisit.bind(ps.g); ps.g.commitVisit = () => { pc++; return ocs(); };
      attackBtn(ps.c).click(); await settle171();
      ok('task171: a continuing single round persists exactly once', pc === 1, `commits=${pc}`);
      const pg = build(secGroup); let pcg = 0; const ocg = pg.g.commitVisit.bind(pg.g); pg.g.commitVisit = () => { pcg++; return ocg(); };
      attackBtn(pg.c).click(); await settle171();
      ok('task171: a continuing group round persists exactly once', pcg === 1, `commits=${pcg}`);
      window.__FL_INSTANT_DICE__ = false;
      Math.random = rnd171;
    }

}

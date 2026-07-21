// FL test suite — adventure sheet, afflictions, items, markets, ships, blessings, RNG/expr
// Extracted verbatim from web/_test.html run() lines 930-2036 (task 120).
import * as data from '../js/data.js';
import { GameState, importSave, deleteSlot, makeItem, nextFreeSlot, sanitizeData } from '../js/state.js';
import * as eng from '../js/engine.js';
import { makeFight } from '../js/combat.js';
import { goodsFrom, buyTrade, applyInlineBuy } from '../js/market.js';
import { Story } from '../js/render.js';
import { renderSheet } from '../js/ui.js';

export async function run(ctx) {
  const { ok, parse } = ctx;
  await data.loadMeta();
  const adv = data.parseAdventurers(data.bookInfo(1).adventurers);
    // --- undo restores full state (incl. stamina), not just position ---
    const gu = GameState.create({ name:'U', gender:'m', profession:'Warrior', book:1, adv });
    gu.data.section='1'; gu.snapshot();          // entry of §1 (stamina 9)
    ok('cannot undo with 1 snapshot', gu.canUndo() === false);
    gu.damageStamina(5);                          // now 4
    gu.data.section='2'; gu.snapshot();          // entry of §2 (stamina 4)
    ok('can undo with 2 snapshots', gu.canUndo() === true);
    gu.damageStamina(100);                        // die
    ok('U is dead', gu.isDead());
    const ut = gu.undo();                         // restore entry of §1
    ok('undo returns to §1', ut && ut.section === '1', JSON.stringify(ut));
    ok('undo restores stamina to 9', gu.data.stamina === 9, String(gu.data.stamina));
    ok('undo clears death', gu.isDead() === false);

    // --- <group> is an OPTIONAL action: must not auto-apply on entry ---
    const gg = GameState.create({ name:'G', gender:'m', profession:'Warrior', book:1, adv });
    gg.data.shards = 100;
    const cg = document.createElement('div');
    const storyG = new Story(cg, gg, { navigate(){}, onDeath(){}, notify(){} });
    const s291 = await data.getSection(1,'291'); storyG.begin(s291,1,'291'); // become initiate of Elnir (60 shards)
    ok('§291 shows a group action', !!cg.querySelector('.group-action'));
    ok('§291 does NOT auto-join god', gg.hasGod('Elnir') === false);
    ok('§291 does NOT auto-charge', gg.data.shards === 100, String(gg.data.shards));
    cg.querySelector('.group-action').click();
    ok('§291 join applied on click', gg.hasGod('Elnir') === true);
    ok('§291 charged 60 on click', gg.data.shards === 40, String(gg.data.shards));

    // townhouse purchase (§10) must not auto-buy
    const gh = GameState.create({ name:'H', gender:'m', profession:'Warrior', book:1, adv });
    gh.data.shards = 300;
    const ch = document.createElement('div');
    const storyH = new Story(ch, gh, { navigate(){}, onDeath(){}, notify(){} });
    const s10b = await data.getSection(1,'10'); storyH.begin(s10b,1,'10');
    ok('§10 does NOT auto-buy townhouse', !gh.hasCodeword('1.10.1') && gh.data.shards === 300, `cw=${gh.hasCodeword('1.10.1')} sh=${gh.data.shards}`);

    // --- blessing purchase: "only one at a time" gate + storm/storms unify ----
    // §202 (Safety from Storms) / §271 (Luck) are temple buys via the price/flag
    // idiom: charge only on click, and refuse a re-buy once the blessing is held
    // (otherwise Shards are spent for nothing, as addBlessing dedupes).
    const gb = GameState.create({ name:'B', gender:'m', profession:'Warrior', book:2, adv });
    gb.data.shards = 100;
    const cb = document.createElement('div');
    const storyB = new Story(cb, gb, { navigate(){}, onDeath(){}, notify(){} });
    const s202 = await data.getSection(2,'202'); storyB.begin(s202,2,'202');
    ok('§202 shows a pay button', !!cb.querySelector('.pay-action'));
    ok('§202 does NOT auto-charge/grant', gb.data.shards === 100 && !gb.hasBlessing('storm'), `sh=${gb.data.shards}`);
    cb.querySelector('.pay-action').click();
    ok('§202 charged 20 (non-initiate) on click', gb.data.shards === 80, String(gb.data.shards));
    ok('§202 granted a single storm blessing', gb.hasBlessing('storm') && gb.data.blessings.length === 1, JSON.stringify(gb.data.blessings));
    // storm/storms are the same blessing — a book-1 <if blessing="storms"> must see it.
    ok('storm grant satisfies <if blessing="storms">', eng.evaluateCondition(parse('<if blessing="storms"/>'), gb));
    // Re-visit while owned → pay button disabled; no double-spend.
    const s202b = await data.getSection(2,'202'); storyB.begin(s202b,2,'202');
    const pay202 = cb.querySelector('.pay-action');
    ok('§202 re-buy blocked when owned', !!pay202 && pay202.disabled === true && /already have/i.test(pay202.title), pay202 ? `disabled=${pay202.disabled} title="${pay202.title}"` : 'no button');

    // §690: four blessings share one flag ("choose one") — never over-block just
    // because the player already holds one of the four abilities.
    const gm = GameState.create({ name:'M', gender:'m', profession:'Warrior', book:6, adv });
    gm.data.shards = 100; gm.addBlessing('combat');
    const cm = document.createElement('div');
    const storyM = new Story(cm, gm, { navigate(){}, onDeath(){}, notify(){} });
    const s690 = await data.getSection(6,'690'); storyM.begin(s690,6,'690');
    const pay690 = cm.querySelector('.pay-action');
    ok('§690 multi-blessing buy stays enabled', !!pay690 && pay690.disabled === false, pay690 ? `disabled=${pay690.disabled}` : 'no button');

    // --- task 43: price/flag "choose one" grants only the picked reward ----------
    // §6.171: 60 Shards buys ONE of six blessings (not all six). Paying only arms the
    // choice; clicking a blessing pick grants exactly that one and consumes the pay.
    const g171 = GameState.create({ name:'P171', gender:'m', profession:'Warrior', book:6, adv });
    g171.data.shards = 300;
    const c171 = document.createElement('div');
    const story171 = new Story(c171, g171, { navigate(){}, onDeath(){}, notify(){} });
    const s171 = await data.getSection(6,'171'); story171.begin(s171,6,'171');
    ok('§171 nothing granted on entry', g171.data.blessings.length === 0 && g171.data.shards === 300);
    const pay171 = Array.from(c171.querySelectorAll('.pay-action')).find((b) => /60/.test(b.textContent));
    ok('§171 shows the 60-Shard choose-one pay', !!pay171 && pay171.disabled === false);
    ok('§171 picks are disabled before paying', Array.from(c171.querySelectorAll('.reward-pick')).length === 6 && Array.from(c171.querySelectorAll('.reward-pick')).every((b) => b.disabled));
    pay171.click();
    ok('§171 paying 60 arms but grants nothing yet', g171.data.shards === 240 && g171.data.blessings.length === 0, `sh=${g171.data.shards} bl=${g171.data.blessings.length}`);
    const pick171 = Array.from(c171.querySelectorAll('.reward-pick')).find((b) => /combat/i.test(b.textContent) && !b.disabled);
    ok('§171 picks go live once paid', !!pick171);
    pick171.click();
    ok('§171 grants exactly the one chosen blessing', g171.data.blessings.length === 1 && g171.hasBlessing('combat'), JSON.stringify(g171.data.blessings));
    ok('§171 the pick costs no extra Shards', g171.data.shards === 240, String(g171.data.shards));

    // §5.152: each 200-Shard payment lifts exactly ONE curse (was lifting all seven);
    // curses you aren't suffering are disabled, and the pay repeats for the next.
    const g152 = GameState.create({ name:'P152', gender:'m', profession:'Warrior', book:5, adv });
    g152.data.shards = 500; g152.addCurse('Curse of Ugliness'); g152.addCurse('Curse of Ebron');
    const c152 = document.createElement('div');
    const story152 = new Story(c152, g152, { navigate(){}, onDeath(){}, notify(){} });
    const s152 = await data.getSection(5,'152'); story152.begin(s152,5,'152');
    const pay152 = () => Array.from(c152.querySelectorAll('.pay-action')).find((b) => /200/.test(b.textContent));
    const pickCurse = (re) => Array.from(c152.querySelectorAll('.reward-pick')).find((b) => re.test(b.textContent));
    ok('§152 shows the 200-Shard pay', !!pay152() && pay152().disabled === false);
    ok('§152 curse picks disabled before paying', pickCurse(/ugliness/i).disabled === true);
    pay152().click();
    ok('§152 paying 200 arms the choice', g152.data.shards === 300, String(g152.data.shards));
    ok('§152 a held curse is now pickable', pickCurse(/ugliness/i).disabled === false);
    ok('§152 a curse you lack stays disabled', pickCurse(/vulnerability/i).disabled === true);
    pickCurse(/ugliness/i).click();
    ok('§152 lifts exactly one curse for 200', g152.data.curses.length === 1 && !g152.hasCurse('Curse of Ugliness') && g152.hasCurse('Curse of Ebron'), JSON.stringify(g152.data.curses.map((c)=>c.name)));
    ok('§152 pay re-enabled after collecting', !!pay152() && pay152().disabled === false);
    pay152().click(); pickCurse(/ebron/i).click();
    ok('§152 a second payment lifts the second curse', g152.data.curses.length === 0 && g152.data.shards === 100, `curses=${g152.data.curses.length} sh=${g152.data.shards}`);

    // §6.690: four blessings on one flag — one payment grants only one.
    const g690 = GameState.create({ name:'P690', gender:'m', profession:'Warrior', book:6, adv });
    g690.data.shards = 100;
    const c690 = document.createElement('div');
    const story690b = new Story(c690, g690, { navigate(){}, onDeath(){}, notify(){} });
    const s690b = await data.getSection(6,'690'); story690b.begin(s690b,6,'690');
    c690.querySelector('.pay-action').click();
    ok('§690 paying grants nothing until a pick', g690.data.blessings.length === 0);
    Array.from(c690.querySelectorAll('.reward-pick')).find((b) => /scouting/i.test(b.textContent) && !b.disabled).click();
    ok('§690 one payment grants exactly one blessing', g690.data.blessings.length === 1 && g690.hasBlessing('scouting'), JSON.stringify(g690.data.blessings));

    // §4.93: the "add 1 per 50 Shards" bribe is repeatable — two payments give a
    // bonus of 2 (not capped at one), and re-entering the section resets it to 0.
    const g93 = GameState.create({ name:'P93', gender:'m', profession:'Warrior', book:4, adv });
    g93.data.shards = 200;
    const c93 = document.createElement('div');
    const story93 = new Story(c93, g93, { navigate(){}, onDeath(){}, notify(){} });
    const s93 = await data.getSection(4,'93'); story93.begin(s93,4,'93');
    ok('§93 bonus starts at 0', g93.codewordValue('CharismaBonus') === 0);
    const pay93 = () => Array.from(c93.querySelectorAll('.pay-action')).find((b) => /50/.test(b.textContent) && !b.disabled);
    pay93().click(); pay93().click();
    ok('§93 two payments → bonus 2', g93.codewordValue('CharismaBonus') === 2, String(g93.codewordValue('CharismaBonus')));
    ok('§93 two payments cost 100 Shards', g93.data.shards === 100, String(g93.data.shards));
    const s93b = await data.getSection(4,'93'); story93.begin(s93b,4,'93');
    ok('§93 re-entry resets the bonus to 0', g93.codewordValue('CharismaBonus') === 0, String(g93.codewordValue('CharismaBonus')));

    // --- §521: possession theft — item="?" wildcard + defer until the die rolls --
    // The thief steals 1-6 possessions; the count comes from a <random var="x"> that
    // must be rolled first. Before the fix, item="?" matched nothing AND the loss
    // auto-applied with x=0, so nothing was ever stolen.
    const g521 = GameState.create({ name:'T', gender:'m', profession:'Warrior', book:2, adv });
    for (const nm of ['rope','lantern','flask','gem','scroll','cloak']) g521.addItem(makeItem('item', nm));
    const initCount = g521.itemCount();
    const c521 = document.createElement('div');
    const story521 = new Story(c521, g521, { navigate(){}, onDeath(){}, notify(){} });
    const s521 = await data.getSection(2,'521'); story521.begin(s521,2,'521');
    ok('§521 steals nothing before the roll', g521.itemCount() === initCount, `count=${g521.itemCount()} init=${initCount}`);
    ok('§521 shows a roll button', !!c521.querySelector('.btn-roll'));
    c521.querySelector('.btn-roll').click();
    await new Promise(r => setTimeout(r, 1000));
    const stolen = g521.getVar('x');
    ok('§521 rolls 1-6 for the theft count', stolen >= 1 && stolen <= 6, 'x='+stolen);
    ok('§521 steals exactly the rolled number', g521.itemCount() === initCount - Math.min(stolen, initCount), `count=${g521.itemCount()} init=${initCount} x=${stolen}`);

    // --- possessions can be reordered (decides what a "listed first" theft takes) --
    const go = GameState.create({ name:'O', gender:'m', profession:'Warrior', book:1, adv });
    go.data.items = [];
    for (const nm of ['alpha','beta','gamma']) go.addItem(makeItem('item', nm));
    const order = () => go.data.items.map((i) => i.name).join(',');
    ok('reorder: initial order', order() === 'alpha,beta,gamma', order());
    ok('reorder: move up swaps with neighbour', (go.moveItem(go.data.items[2].id, -1), order() === 'alpha,gamma,beta'), order());
    ok('reorder: cannot move the first item up', go.moveItem(go.data.items[0].id, -1) === false && order() === 'alpha,gamma,beta');
    ok('reorder: cannot move the last item down', go.moveItem(go.data.items[2].id, 1) === false && order() === 'alpha,gamma,beta');
    ok('reorder: move down swaps with neighbour', (go.moveItem(go.data.items[0].id, 1), order() === 'gamma,alpha,beta'), order());
    const csheet = document.createElement('div');
    renderSheet(go, csheet);
    ok('sheet renders up/down controls per item', csheet.querySelectorAll('.item-move').length === go.data.items.length * 2, String(csheet.querySelectorAll('.item-move').length));
    ok('sheet disables the top-up and bottom-down controls', csheet.querySelectorAll('.item-move:disabled').length === 2, String(csheet.querySelectorAll('.item-move:disabled').length));

    // --- task 57: adventure sheet shows afflictions by name; diseases/poisons visible
    const gaf = GameState.create({ name:'Af', gender:'m', profession:'Warrior', book:1, adv });
    gaf.addCurse('Curse of the Shadar');
    gaf.addAffliction('disease', { name:'Ghoulbite', effects:[{ ability:'combat', bonus:-1 }] });
    gaf.addAffliction('poison', { name:'Scorpion Poison', effects:[{ ability:'stamina', bonus:-1 }] });
    const csheet2 = document.createElement('div');
    renderSheet(gaf, csheet2);
    const sheetTxt = csheet2.textContent;
    ok('sheet lists a curse by name (not the literal "curse")', /Curse of the Shadar/.test(sheetTxt));
    ok('sheet has a Diseases section listing Ghoulbite', /Diseases/.test(sheetTxt) && /Ghoulbite/.test(sheetTxt), sheetTxt.slice(0, 400));
    ok('sheet has a Poisons section listing Scorpion Poison', /Poisons/.test(sheetTxt) && /Scorpion Poison/.test(sheetTxt), sheetTxt.slice(0, 400));

    // --- task 59: <tick god=…> applies its <effect> children (Sig's +1 THIEVERY) ---
    const gsig = GameState.create({ name:'Sg', gender:'m', profession:'Rogue', book:1, adv });
    const thBase = gsig.ability('thievery');
    eng.applyEffect(parse('<tick god="Sig"><effect ability="thievery" bonus="1"/></tick>'), gsig, {});
    ok('Sig initiation grants +1 THIEVERY', gsig.hasGod('Sig') && gsig.ability('thievery') === thBase + 1, `th=${gsig.ability('thievery')} base=${thBase}`);
    eng.applyEffect(parse('<tick god="Sig"><effect ability="thievery" bonus="1"/></tick>'), gsig, {});
    ok('re-initiating Sig does not stack THIEVERY', gsig.ability('thievery') === thBase + 1, String(gsig.ability('thievery')));
    eng.applyEffect(parse('<lose god="Sig"/>'), gsig, {});
    ok('renouncing Sig restores THIEVERY', !gsig.hasGod('Sig') && gsig.ability('thievery') === thBase, `th=${gsig.ability('thievery')}`);
    // the god effect survives a save round-trip (source= is persisted).
    eng.applyEffect(parse('<tick god="Sig"><effect ability="thievery" bonus="1"/></tick>'), gsig, {});
    const gsig2 = new GameState(sanitizeData(JSON.parse(JSON.stringify(gsig.data))));
    ok('the god THIEVERY effect survives a save round-trip', gsig2.ability('thievery') === thBase + 1, `th=${gsig2.ability('thievery')}`);
    // §1.437: the initiation group grants Sig + THIEVERY +1 and costs 50 Shards.
    const gSig437 = GameState.create({ name:'Init', gender:'m', profession:'Rogue', book:1, adv });
    gSig437.data.shards = 100;
    const thSig437 = gSig437.ability('thievery');
    const cSig437 = document.createElement('div');
    const stSig437 = new Story(cSig437, gSig437, { navigate(){}, onDeath(){}, notify(){} });
    stSig437.begin(await data.getSection(1, '437'), 1, '437');
    const grpSig437 = cSig437.querySelector('.group-action');
    ok('§1.437 shows the Sig initiation group', !!grpSig437);
    grpSig437 && grpSig437.click();
    ok('§1.437 initiation grants Sig + THIEVERY +1 and costs 50', gSig437.hasGod('Sig') && gSig437.ability('thievery') === thSig437 + 1 && gSig437.data.shards === 50, `god=${gSig437.hasGod('Sig')} th=${gSig437.ability('thievery')}/${thSig437} sh=${gSig437.data.shards}`);

    // --- task 60: affliction divide/target/stamina forms + item <curse> child ---
    // §5.198: the Champion's Curse halves COMBAT (round up — JaFL DIVIDE_ABILITY).
    const g198 = GameState.create({ name:'C198', gender:'m', profession:'Warrior', book:5, adv });
    g198.data.abilities.combat = 7; g198.data.items = []; // odd base, no weapon → COMBAT is a clean 7
    const cb198 = g198.ability('combat');
    eng.applyEffect(parse('<curse name="Champion\'s Curse"><effect ability="combat" divide="2"/></curse>'), g198, {});
    ok('§198 curse halves COMBAT rounding up', g198.ability('combat') === Math.ceil(cb198 / 2), `combat=${g198.ability('combat')} base=${cb198}`);
    eng.applyEffect(parse('<lose curse="Champion\'s Curse"/>'), g198, {});
    ok('§198 lifting the curse restores COMBAT', g198.ability('combat') === cb198 && !g198.hasCurse("Champion's Curse"));

    // §5.705: the Curse of Ugliness pins CHARISMA to 1 (JaFL TARGET_ABILITY).
    const g705 = GameState.create({ name:'C705', gender:'m', profession:'Warrior', book:5, adv });
    g705.data.abilities.charisma = 9;
    eng.applyEffect(parse('<curse name="Curse of Ugliness"><effect ability="charisma" target="1"/></curse>'), g705, {});
    ok('§705 curse pins CHARISMA to 1', g705.ability('charisma') === 1, `cha=${g705.ability('charisma')}`);
    eng.applyEffect(parse('<lose curse="Curse of Ugliness"/>'), g705, {});
    ok('§705 lifting the curse restores CHARISMA', g705.ability('charisma') === 9);

    // §5.306: the poison cuts the Stamina total by 6 until cured.
    const g306 = GameState.create({ name:'P306', gender:'m', profession:'Warrior', book:5, adv });
    const max306 = g306.data.staminaMax; g306.data.stamina = max306; // full health
    eng.applyEffect(parse('<poison name="Poison"><effect ability="stamina" bonus="-6"/></poison>'), g306, {});
    ok('§306 poison cuts the Stamina total by 6', g306.effectiveStaminaMax() === max306 - 6, `max=${g306.effectiveStaminaMax()} raw=${max306}`);
    ok('§306 poison caps current Stamina to the reduced total', g306.data.stamina === max306 - 6, `stam=${g306.data.stamina}`);
    const g306b = new GameState(sanitizeData(JSON.parse(JSON.stringify(g306.data))));
    ok('§306 the stamina affliction survives a save round-trip', g306b.effectiveStaminaMax() === max306 - 6, `max=${g306b.effectiveStaminaMax()}`);
    eng.applyEffect(parse('<lose poison="*"/>'), g306, {});
    ok('§306 curing the poison restores the Stamina total', g306.effectiveStaminaMax() === max306 && g306.data.poisons.length === 0);

    // §5.238: the stone bracelet is a trap — taking it attaches Curse of Blighted Magic (½ MAGIC).
    const g238 = GameState.create({ name:'B238', gender:'m', profession:'Warrior', book:5, adv });
    g238.data.abilities.magic = 8;
    const mg238 = g238.ability('magic');
    const c238 = document.createElement('div');
    const st238 = new Story(c238, g238, { navigate(){}, onDeath(){}, notify(){} });
    st238.begin(await data.getSection(5, '238'), 5, '238');
    const braceletBtn = Array.from(c238.querySelectorAll('.take-item')).find((b) => /stone bracelet/i.test(b.textContent));
    ok('§238 renders a stone-bracelet take button', !!braceletBtn && !braceletBtn.disabled, braceletBtn ? `disabled=${braceletBtn.disabled}` : 'no btn');
    braceletBtn.click();
    ok('§238 taking the bracelet attaches the curse and halves MAGIC', g238.hasCurse('Curse of Blighted Magic') && g238.ability('magic') === Math.ceil(mg238 / 2), `curse=${g238.hasCurse('Curse of Blighted Magic')} magic=${g238.ability('magic')}/${mg238}`);

    // --- task 61: §6.628 — the sentinel <set var="y" value="7"> must not clobber the
    // pay-gated <random var="y"> roll (else the inn's rest/dysentery never fires) ---
    window.__FL_INSTANT_DICE__ = true; // resolve the dice animation instantly
    const settle61 = () => new Promise((r) => setTimeout(r, 30));
    const g628 = GameState.create({ name:'Inn', gender:'m', profession:'Warrior', book:6, adv });
    g628.data.shards = 10;
    g628.data.stamina = g628.data.staminaMax - 3; // injured, with room to heal
    const c628 = document.createElement('div');
    const st628 = new Story(c628, g628, { navigate(){}, onDeath(){}, notify(){} });
    st628.begin(await data.getSection(6, '628'), 6, '628');
    ok('§628 sets the "not yet rolled" sentinel y=7 on entry', g628.getVar('y') === 7, `y=${g628.getVar('y')}`);
    const activeGroups628 = () => Array.from(c628.querySelectorAll('.group-action')).filter((b) => !b.disabled);
    ok('§628 no rest/dysentery action is active before the roll', activeGroups628().length === 0, String(activeGroups628().length));
    const pay628 = c628.querySelector('.pay-action');
    ok('§628 shows the "1 Shard a day" pay button', !!pay628 && !pay628.disabled, pay628 ? `disabled=${pay628.disabled}` : 'no pay btn');
    pay628.click(); // arm flag x (pay 1 Shard)
    const roll628 = c628.querySelector('.btn-roll');
    ok('§628 arming the payment enables the die roll', !!roll628 && !roll628.disabled, roll628 ? `disabled=${roll628.disabled}` : 'no roll btn');
    const rnd628 = Math.random; Math.random = () => 0.4; // force a die of 3 → the 1-5 rest branch
    roll628.click(); await settle61();
    Math.random = rnd628;
    ok('§628 the roll writes y and the sentinel does NOT re-clobber it', g628.getVar('y') === 3, `y=${g628.getVar('y')}`);
    const restGroup628 = activeGroups628();
    ok('§628 a 3 activates exactly the rest action (not dysentery)', restGroup628.length === 1 && /regain 1 Stamina/i.test(restGroup628[0].textContent), restGroup628.map((b) => b.textContent).join(' | '));
    const stam628 = g628.data.stamina;
    restGroup628[0].click();
    ok('§628 taking the rest action heals 1 Stamina', g628.data.stamina === stam628 + 1, `stam=${g628.data.stamina} before=${stam628}`);

    // --- task 37: safeAddGod (the source typo safeAddGodd is corrected in book2/67) ---
    const gsa37 = GameState.create({ name:'SA', gender:'m', profession:'Warrior', book:2, adv });
    ok('safeAddGod is true when the player worships no god', eng.evaluateCondition(parse('<if safeAddGod="Elnir"/>'), gsa37));
    gsa37.setGod('Nagil');
    ok('safeAddGod is false when already an initiate of another god', !eng.evaluateCondition(parse('<if safeAddGod="Elnir"/>'), gsa37));
    const g267 = GameState.create({ name:'G267', gender:'m', profession:'Warrior', book:2, adv });
    g267.data.shards = 100;
    const c267 = document.createElement('div');
    const st267 = new Story(c267, g267, { navigate(){}, onDeath(){}, notify(){} });
    st267.begin(await data.getSection(2, '67'), 2, '67');
    ok('§2.67 offers the Elnir initiation group (corrected safeAddGod matches)', !!c267.querySelector('.group-action'));

    // --- task 62: <image file=…> inline links + use-effect images (map of Bazalek) ---
    const g75 = GameState.create({ name:'Map', gender:'m', profession:'Warrior', book:3, adv });
    const c75 = document.createElement('div');
    const st75 = new Story(c75, g75, { navigate(){}, onDeath(){}, notify(){} });
    st75.begin(await data.getSection(3, '75'), 3, '75');
    const link75 = c75.querySelector('.image-link');
    ok('§75 renders the inline <image> as a link, keeping its prose', !!link75 && /illustration/i.test(link75.textContent), link75 ? link75.textContent : 'none');
    const take75 = Array.from(c75.querySelectorAll('.take-item')).find((b) => /map of bazalek/i.test(b.textContent));
    ok('§75 offers the map of Bazalek to take', !!take75 && !take75.disabled);
    take75.click();
    const mapItem = g75.findItems('map of Bazalek')[0];
    const readEff = mapItem && (mapItem.effects || []).find((e) => e.type === 'use');
    ok('§75 the taken map carries a "Read" use-effect holding the image', !!readEff && readEff.verb === 'Read' && /<image/i.test(readEff.body || ''), readEff ? JSON.stringify({ verb: readEff.verb, body: readEff.body }) : 'none');
    const bodyNode75 = data.parseXml(`<effect>${readEff.body}</effect>`);
    const useRes75 = eng.useItemEffect(g75, mapItem, readEff, bodyNode75);
    ok('§75 Reading the map surfaces the Bazalek illustration', !!useRes75.image && /Bazalek/i.test(useRes75.image.file), JSON.stringify(useRes75.image));
    ok('§75 the reusable map is not consumed by Reading it', g75.findItems('map of Bazalek').length === 1);
    // book1/200: an inline <image>showing a safe path</image> link (file= attribute)
    const g200 = GameState.create({ name:'Fst', gender:'m', profession:'Warrior', book:1, adv });
    const c200 = document.createElement('div');
    const st200 = new Story(c200, g200, { navigate(){}, onDeath(){}, notify(){} });
    st200.begin(await data.getSection(1, '200'), 1, '200');
    ok('§200 renders its inline treasure-map image as a link', !!c200.querySelector('.image-link'));

    // --- task 157: item-name patterns honour '*' globs (JaFL Item.matches) ---
    // matchItems used to compare names EXACTLY, so a '*'-glob item pattern never matched.
    {
      const gGlob = GameState.create({ name:'GB', gender:'m', profession:'Warrior', book:6, adv });
      gGlob.addItem(makeItem('item', 'silver flute'));
      gGlob.addItem(makeItem('item', "courtier's mask"));
      gGlob.addItem(makeItem('item', 'dead head'));
      gGlob.addItem(makeItem('weapon', 'sword', 3)); // an unrelated item — the globs must not take it
      // §4.482 <if item="*flute|*whistle"> — either suffix over a pipe alternation.
      ok('§157 "*flute|*whistle" matches a silver flute (§4.482 shortcut reachable)',
         eng.evaluateCondition(parse('<if item="*flute|*whistle"/>'), gGlob) === true);
      // §6.201 <if item="*mask"> — a suffix glob.
      ok('§157 "*mask" matches a courtier\'s mask (§6.201 reachable)',
         eng.evaluateCondition(parse('<if item="*mask"/>'), gGlob) === true);
      // §6.144 <lose item="* head"> — a glob with an embedded space actually removes it.
      ok('§157 "* head" finds the trophy head', gGlob.findItems('* head').length === 1);
      eng.applyEffect(parse('<lose item="* head"/>'), gGlob);
      ok('§157 <lose item="* head"> hands over the head (§6.144 trophy no longer reusable)',
         gGlob.findItems('* head').length === 0 && gGlob.findItems('dead head').length === 0);
      // Guard: a concrete (non-glob) name and the unrelated sword are untouched.
      ok('§157 a bare name still matches exactly and globs do not over-take',
         gGlob.findItems('silver flute').length === 1 && gGlob.findItems('sword').length === 1);
    }

    // --- task 63: heterogeneous "choose one" rewards (item | Shards | resurrection) ---
    // §1.597: reward for the ghoul's head — amber wand OR 500 Shards OR resurrection.
    const g597 = GameState.create({ name:'Ghoul', gender:'m', profession:'Warrior', book:1, adv });
    const shards0597 = g597.data.shards;
    const c597 = document.createElement('div');
    const st597 = new Story(c597, g597, { navigate(){}, onDeath(){}, notify(){} });
    st597.begin(await data.getSection(1, '597'), 1, '597');
    const picks597 = () => Array.from(c597.querySelectorAll('.reward-pick'));
    ok('§597 shows three reward picks (wand / Shards / resurrection)', picks597().length === 3, `n=${picks597().length}`);
    ok('§597 the picks are armed and nothing auto-applied on entry', picks597().every((b) => !b.disabled) && g597.data.shards === shards0597 && !g597.hasResurrection() && g597.findItems('amber wand').length === 0, `sh=${g597.data.shards} res=${g597.hasResurrection()} wand=${g597.findItems('amber wand').length}`);
    picks597().find((b) => /amber wand/i.test(b.textContent)).click();
    ok('§597 taking the amber wand grants exactly that item', g597.findItems('amber wand').length === 1);
    ok('§597 the wand choice blocks the 500 Shards and the resurrection', picks597().every((b) => b.disabled) && g597.data.shards === shards0597 && !g597.hasResurrection(), `sh=${g597.data.shards} res=${g597.hasResurrection()}`);

    // and the reverse: taking resurrection blocks the wand and the 500 Shards
    const g597b = GameState.create({ name:'Ghoul2', gender:'m', profession:'Warrior', book:1, adv });
    const sh0597b = g597b.data.shards;
    const c597b = document.createElement('div');
    const st597b = new Story(c597b, g597b, { navigate(){}, onDeath(){}, notify(){} });
    st597b.begin(await data.getSection(1, '597'), 1, '597');
    Array.from(c597b.querySelectorAll('.reward-pick')).find((b) => /resurrection/i.test(b.textContent)).click();
    ok('§597 taking resurrection arranges the deal and blocks the other two', g597b.hasResurrection() && g597b.findItems('amber wand').length === 0 && g597b.data.shards === sh0597b && Array.from(c597b.querySelectorAll('.reward-pick')).every((b) => b.disabled), `res=${g597b.hasResurrection()} wand=${g597b.findItems('amber wand').length} sh=${g597b.data.shards}`);

    // --- task 125: flag-linked item rewards gate on their payment ------------------
    // §3.346: hand over a trophy for a 200-Shard medallion (no <if> wrapper → arm-then-
    // take). No trophy ⇒ the Take is disabled and free Shards are impossible; paying arms
    // the reward, which grants exactly once and is not repeatable on re-entry.
    const g346 = GameState.create({ name:'Cultist', gender:'m', profession:'Warrior', book:3, adv });
    const sh0346 = g346.data.shards;
    const c346 = document.createElement('div');
    const st346 = new Story(c346, g346, { navigate(){}, onDeath(){}, notify(){} });
    st346.begin(await data.getSection(3, '346'), 3, '346');
    ok('§346 no trophy: the 200-Shard Take is present but disabled', c346.querySelectorAll('.reward-pick').length === 1 && c346.querySelector('.reward-pick').disabled);
    ok('§346 no trophy: pay buttons disabled and no free Shards on entry', Array.from(c346.querySelectorAll('.pay-action')).every((b) => b.disabled) && g346.data.shards === sh0346, `sh=${g346.data.shards}`);
    g346.addItem(makeItem('item', "pirate captain's head"));
    st346.begin(await data.getSection(3, '346'), 3, '346');
    const payHead346 = Array.from(c346.querySelectorAll('.pay-action')).find((b) => /pirate captain/i.test(b.textContent));
    ok('§346 with a trophy: its pay button is live but the Take is still disabled', !!payHead346 && !payHead346.disabled && c346.querySelector('.reward-pick').disabled);
    payHead346.click();
    ok('§346 paying hands over the head and grants nothing yet', g346.findItems("pirate captain's head").length === 0 && g346.data.shards === sh0346, `sh=${g346.data.shards}`);
    ok('§346 the medallion Take is now armed', !c346.querySelector('.reward-pick').disabled);
    c346.querySelector('.reward-pick').click();
    ok('§346 taking grants the 200-Shard medallion exactly once', g346.data.shards === sh0346 + 200, `sh=${g346.data.shards}`);
    ok('§346 the Take is spent (flag consumed) afterwards', c346.querySelector('.reward-pick').disabled);
    st346.begin(await data.getSection(3, '346'), 3, '346');
    ok('§346 re-entry with no trophy offers no free medallion', c346.querySelector('.reward-pick').disabled && g346.data.shards === sh0346 + 200);

    // §1.342: the alchemist's potion needs 250 Shards AND an ink sac, bundled in one
    // <group> inside an affordability <if> — paying the group must grant the potion (its
    // own Take vanishes with the branch), and merely holding the ingredients does not.
    const g342 = GameState.create({ name:'Alch', gender:'m', profession:'Warrior', book:1, adv });
    g342.data.shards = 300;
    g342.addItem(makeItem('item', 'ink sac'));
    const c342 = document.createElement('div');
    const st342 = new Story(c342, g342, { navigate(){}, onDeath(){}, notify(){} });
    st342.begin(await data.getSection(1, '342'), 1, '342');
    ok('§342 holding the ingredients does not grant the potion for free', g342.findItems('potion of restoration').length === 0);
    ok('§342 the potion Take is shown disabled until the group is paid', (Array.from(c342.querySelectorAll('.reward-pick')).find((b) => /potion of restoration/i.test(b.textContent)) || {}).disabled === true);
    const grp342 = c342.querySelector('.group-action');
    ok('§342 shows the "cross it off" group payment', !!grp342);
    grp342.click();
    ok('§342 the group takes 250 Shards and the ink sac', g342.data.shards === 50 && g342.findItems('ink sac').length === 0, `sh=${g342.data.shards} ink=${g342.findItems('ink sac').length}`);
    ok('§342 paying the group grants the potion of restoration exactly once', g342.findItems('potion of restoration').length === 1);

    // book4/634 barter (task 63's free-take status quo, superseded by task 125): each
    // offered good now gates on the flag its matching forfeit arms — give one, take one.
    const g634 = GameState.create({ name:'Fish', gender:'m', profession:'Warrior', book:4, adv });
    const c634 = document.createElement('div');
    const st634 = new Story(c634, g634, { navigate(){}, onDeath(){}, notify(){} });
    st634.begin(await data.getSection(4, '634'), 4, '634');
    ok('§634 the three offered goods are Take picks, disabled before any forfeit', c634.querySelectorAll('.reward-pick').length === 3 && Array.from(c634.querySelectorAll('.reward-pick')).every((b) => b.disabled));
    ok('§634 no forfeit to give: the exchange buttons are all disabled and nothing granted', Array.from(c634.querySelectorAll('.pay-action')).every((b) => b.disabled) && g634.findItems('magic trident').length === 0);
    g634.addItem(makeItem('item', 'bag of pearls'));
    st634.begin(await data.getSection(4, '634'), 4, '634');
    const payPearls = Array.from(c634.querySelectorAll('.pay-action')).find((b) => /pearl/i.test(b.textContent));
    ok('§634 with a bag of pearls: its exchange button is live', !!payPearls && !payPearls.disabled);
    payPearls.click();
    ok('§634 the forfeit takes the pearls and arms the picks', g634.findItems('bag of pearls').length === 0 && Array.from(c634.querySelectorAll('.reward-pick')).some((b) => !b.disabled));
    Array.from(c634.querySelectorAll('.reward-pick')).find((b) => /magic trident/i.test(b.textContent)).click();
    ok('§634 taking the trident grants exactly it and re-locks the other picks', g634.findItems('magic trident').length === 1 && g634.findItems('ink sac').length === 0 && Array.from(c634.querySelectorAll('.reward-pick')).every((b) => b.disabled), `trident=${g634.findItems('magic trident').length} ink=${g634.findItems('ink sac').length}`);

    // --- task 44: ring of ultimate power folds its Rank/Stamina auras (book5/564) ---
    const g564 = GameState.create({ name:'Ring', gender:'m', profession:'Warrior', book:5, adv });
    const baseRank44 = g564.rankValue(), baseMax44 = g564.effectiveStaminaMax(), baseCombat44 = g564.ability('combat'), baseDef44 = g564.defence();
    const c564 = document.createElement('div');
    const st564 = new Story(c564, g564, { navigate(){}, onDeath(){}, notify(){} });
    st564.begin(await data.getSection(5, '564'), 5, '564');
    const ringBtn = Array.from(c564.querySelectorAll('.take-item')).find((b) => /ring of ultimate power/i.test(b.textContent));
    ok('§564 offers the ring of ultimate power', !!ringBtn && !ringBtn.disabled);
    ringBtn.click();
    ok('§564 the ring raises Rank by 2', g564.rankValue() === baseRank44 + 2, `rank=${g564.rankValue()} base=${baseRank44}`);
    ok('§564 the ring raises the Stamina total by 10', g564.effectiveStaminaMax() === baseMax44 + 10, `max=${g564.effectiveStaminaMax()} base=${baseMax44}`);
    ok('§564 the ring raises all abilities by 1', g564.ability('combat') === baseCombat44 + 1, `combat=${g564.ability('combat')} base=${baseCombat44}`);
    ok('§564 the ring raises Defence by 3 (Rank +2, Combat +1)', g564.defence() === baseDef44 + 3, `def=${g564.defence()} base=${baseDef44}`);
    const rnd44 = Math.random; Math.random = () => 0; // roll a 1
    ok('§564 a rank check uses the boosted Rank', eng.rollRankCheck(g564, 1, 0, 0).margin === baseRank44 + 2, `margin=${eng.rollRankCheck(g564, 1, 0, 0).margin}`);
    Math.random = rnd44;
    g564.healStamina(999);
    ok('§564 healing fills the boosted Stamina total', g564.data.stamina === baseMax44 + 10, `stam=${g564.data.stamina}`);
    g564.removeItemById(g564.findItems('ring of ultimate power')[0].id);
    ok('§564 dropping the ring restores Rank and the Stamina total', g564.rankValue() === baseRank44 && g564.effectiveStaminaMax() === baseMax44, `rank=${g564.rankValue()} max=${g564.effectiveStaminaMax()}`);
    ok('§564 dropping the ring re-clamps current Stamina to the restored max', g564.data.stamina === baseMax44, `stam=${g564.data.stamina} max=${baseMax44}`);

    // --- task 124: load/import must not strip aura Stamina (ring of ultimate power) ---
    // A save at 30/20 held by a ring-holder is legitimate (§5.564's +10 aura). sanitizeData
    // (run on every load, import and SW-triggered reload) previously clamped current Stamina
    // to the *written* max (20), silently stripping the aura Stamina. It must clamp to the
    // effective ceiling: preserve the aura value, still floor a hand-edited over-max import.
    const ring124 = { id:'ring124', kind:'item', name:'ring of ultimate power', bonus:0, ability:null, tags:[], effects:[{ type:'aura', ability:'Stamina', bonus:10, text:'+10 Stamina' }], group:null, wielded:false, worn:false };
    const withRing124 = { schema:3, abilities:{ combat:5 }, staminaMax:20, stamina:30, items:[ring124], book:5, section:'564' };
    const g124 = new GameState(sanitizeData(JSON.parse(JSON.stringify(withRing124))));
    ok('§124 load keeps aura-raised Stamina (30/20 with the ring)', g124.data.stamina === 30, `stam=${g124.data.stamina}`);
    ok('§124 the ring survives the round trip', g124.auraBonus('stamina') === 10 && g124.effectiveStaminaMax() === 30, `aura=${g124.auraBonus('stamina')} max=${g124.effectiveStaminaMax()}`);
    // The same save without the ring clamps back to the written max (task 44 drop rule).
    const g124b = new GameState(sanitizeData(JSON.parse(JSON.stringify({ ...withRing124, items: [] }))));
    ok('§124 load without the ring clamps 30 → 20', g124b.data.stamina === 20, `stam=${g124b.data.stamina}`);
    // A hand-edited import above even the effective ceiling is still floored.
    const g124c = new GameState(sanitizeData(JSON.parse(JSON.stringify({ ...withRing124, stamina: 999 }))));
    ok('§124 a 999 hand-edited value is floored to the effective ceiling (30)', g124c.data.stamina === 30, `stam=${g124c.data.stamina}`);
    // The import path (importSave → migrate → sanitizeData) preserves it too.
    if (nextFreeSlot() != null) {
      const { slot: impSlot124 } = importSave(JSON.parse(JSON.stringify(withRing124)));
      const loaded124 = GameState.load(impSlot124);
      ok('§124 importSave + reload preserves the aura-raised Stamina', !!loaded124 && loaded124.data.stamina === 30, `stam=${loaded124 && loaded124.data.stamina}`);
      deleteSlot(impSlot124);
    } else ok('§124 importSave slot unavailable (skipped import round trip)', true);

    // --- task 158: permanent Stamina moves + heal-to-full keep aura headroom ---
    // A ring-of-ultimate-power holder sits above the WRITTEN max (30 current / 20 written,
    // +10 aura). Clamping current to the written max on a <gain|lose ability="stamina"> move
    // or a heal-to-full rest silently sheds up to 10 Stamina; the ceiling must be the
    // effective max (written + aura).
    {
      const ring158 = { id:'ring158', kind:'item', name:'ring of ultimate power', bonus:0, ability:null, tags:[], effects:[{ type:'aura', ability:'Stamina', bonus:10, text:'+10 Stamina' }], group:null, wielded:false, worn:false };
      const load158 = (stam) => new GameState(sanitizeData(JSON.parse(JSON.stringify({ schema:3, abilities:{ combat:5 }, staminaMax:20, stamina:stam, items:[ring158], book:5, section:'564' }))));
      // (1) adjustAbilityStamina — a Stamina ability move.
      const gA = load158(30);
      ok('§158 setup: aura holder at 30 current / 30 effective', gA.data.stamina === 30 && gA.effectiveStaminaMax() === 30);
      gA.adjustAbilityStamina(2);  // <gain ability="stamina" 2>: written 20→22, effective 30→32
      ok('§158 a Stamina gain keeps the aura headroom (32, not clamped to 22)',
         gA.data.stamina === 32 && gA.effectiveStaminaMax() === 32, `stam=${gA.data.stamina} eff=${gA.effectiveStaminaMax()}`);
      gA.adjustAbilityStamina(-2); // <lose ability="stamina" 2>: back to 30 / 30
      ok('§158 a Stamina loss keeps the aura headroom (30, not clamped to 20)',
         gA.data.stamina === 30 && gA.effectiveStaminaMax() === 30, `stam=${gA.data.stamina} eff=${gA.effectiveStaminaMax()}`);
      // (2) applyRest restore-to-full — heals to the effective max, not the written max.
      const gR = load158(1);
      ok('§158 rest setup: aura holder wounded at 1 / 30', gR.data.stamina === 1 && gR.effectiveStaminaMax() === 30);
      eng.applyRest(gR, null, 0);  // <rest> with no stamina= ⇒ heal all
      ok('§158 a heal-to-full rest reaches the effective max (30, not 21)', gR.data.stamina === 30, `stam=${gR.data.stamina}`);
    }

    // --- task 36: grab-bag (godless clears god; difficultyCurse one-die; useCache Defence) ---
    const gGL = GameState.create({ name:'GL', gender:'m', profession:'Warrior', book:6, adv });
    gGL.setGod('Nagil');
    eng.applyEffect(parse('<tick special="godless"/>'), gGL, {});
    ok('§118 godless renounces the current god and sets the godless flag', !gGL.hasGod('Nagil') && gGL.data.gods.length === 0 && gGL.data.godless === true, `gods=${JSON.stringify(gGL.data.gods)} godless=${gGL.data.godless}`);

    const gDC = GameState.create({ name:'DC', gender:'m', profession:'Warrior', book:3, adv });
    eng.applyEffect(parse('<tick special="difficultyCurse"/>'), gDC, {});
    ok('§91 difficultyCurse restricts ability rolls to one die', gDC.data.oneDieRolls === true && eng.rollDifficulty(gDC, 'combat', 10).dice.length === 1, `oneDie=${gDC.data.oneDieRolls}`);
    const gDC2 = new GameState(sanitizeData(JSON.parse(JSON.stringify(gDC.data))));
    ok('§91 the one-die curse survives a save round-trip', gDC2.data.oneDieRolls === true && eng.rollDifficulty(gDC2, 'combat', 10).dice.length === 1);
    eng.applyEffect(parse('<tick special="difficultyRestore"/>'), gDC, {});
    ok('§102 difficultyRestore lifts the curse (two dice again)', gDC.data.oneDieRolls === false && eng.rollDifficulty(gDC, 'combat', 10).dice.length === 2);

    const gUC = GameState.create({ name:'UC', gender:'m', profession:'Warrior', book:6, adv });
    gUC.cacheAddItem('maid', makeItem('weapon', 'sword', 2));
    const fUC = makeFight(parse('<fight name="Warrior Maid" combat="8" defence="16" stamina="12" useCache="maid"/>'), gUC);
    ok('§635 useCache adds the cached weapon bonus to enemy Combat AND Defence', fUC.combat === 10 && fUC.defence === 18, `combat=${fUC.combat} defence=${fUC.defence}`);

    // --- task 42: a roll inside a <group> now renders as a widget and drives the branches ---
    window.__FL_INSTANT_DICE__ = true;
    const settle42 = () => new Promise((r) => setTimeout(r, 30));

    // §3.680: the MAGIC-roll group renders a roll (not a swallowing button); the
    // hidden <gain price="x"> arms the "leave" option on entry; success ticks the box.
    const g680 = GameState.create({ name:'Wand', gender:'m', profession:'Mage', book:3, adv });
    g680.data.abilities.magic = 12; g680.data.book = 3; g680.data.section = '680'; // so the bare <tick> keys the right box
    const c680 = document.createElement('div');
    const st680 = new Story(c680, g680, { navigate(){}, onDeath(){}, notify(){} });
    st680.begin(await data.getSection(3, '680'), 3, '680');
    ok('§680 renders the MAGIC roll as a widget, not a group button', !!c680.querySelector('.btn-roll') && !c680.querySelector('.group-action'));
    ok('§680 the hidden price arms flag x on entry (the leave option is available)', g680.getFlag('x') === true);
    const rnd680 = Math.random; Math.random = () => 0.9; // 6+6 = 12; +MAGIC 12 = 24 > 16 → success
    c680.querySelector('.btn-roll').click(); await settle42();
    Math.random = rnd680;
    ok('§680 a successful MAGIC roll ticks the box', g680.tickCount(3, '680') === 1, `ticks=${g680.tickCount(3, '680')}`);
    ok('§680 success reveals the goto to 644', Array.from(c680.querySelectorAll('.goto')).some((a) => /644/.test(a.textContent)));

    // §2.438: the group's <rest stamina="x"> heals the roll's own var — only after the roll.
    const g438 = GameState.create({ name:'Rest', gender:'m', profession:'Warrior', book:2, adv });
    g438.data.stamina = 1;
    const c438 = document.createElement('div');
    const st438 = new Story(c438, g438, { navigate(){}, onDeath(){}, notify(){} });
    st438.begin(await data.getSection(2, '438'), 2, '438');
    ok('§438 renders the recovery roll as a widget and heals nothing before it', !!c438.querySelector('.btn-roll') && g438.data.stamina === 1);
    const rnd438 = Math.random; Math.random = () => 0; // 2 dice → 1+1 = 2 → heal 2
    c438.querySelector('.btn-roll').click(); await settle42();
    Math.random = rnd438;
    ok('§438 the rest heals the rolled amount (var x) on the roll', g438.data.stamina === 3, `stam=${g438.data.stamina}`);

    // §3.273: the force="t" group loses the rolled number of possessions — on the roll, not entry.
    const g273 = GameState.create({ name:'Amn', gender:'m', profession:'Warrior', book:3, adv });
    g273.data.items = []; ['a', 'b', 'c', 'd'].forEach((nm) => g273.addItem(makeItem('item', nm)));
    const c273 = document.createElement('div');
    const st273 = new Story(c273, g273, { navigate(){}, onDeath(){}, notify(){} });
    st273.begin(await data.getSection(3, '273'), 3, '273');
    ok('§273 loses no possessions before the roll', g273.itemCount() === 4, `count=${g273.itemCount()}`);
    const rnd273 = Math.random; Math.random = () => 0; // 1 die → 1 → lose 1 possession
    c273.querySelector('.btn-roll').click(); await settle42();
    Math.random = rnd273;
    ok('§273 loses the rolled number of possessions on the roll', g273.itemCount() === 3, `count=${g273.itemCount()}`);

    // §6.215: the blessing group's 35-Shard cost is paid on the roll (not on entry).
    const g215 = GameState.create({ name:'Bless', gender:'m', profession:'Warrior', book:6, adv });
    g215.data.shards = 100; g215.data.abilities.charisma = 6;
    const c215 = document.createElement('div');
    const st215 = new Story(c215, g215, { navigate(){}, onDeath(){}, notify(){} });
    st215.begin(await data.getSection(6, '215'), 6, '215');
    const roll215 = Array.from(c215.querySelectorAll('.btn-roll')).find((b) => /CHARISMA/i.test(b.textContent));
    ok('§215 the blessing group renders a CHARISMA roll and has not charged 35 on entry', !!roll215 && g215.data.shards === 100, `sh=${g215.data.shards}`);
    const rnd215 = Math.random; Math.random = () => 0.9; // 12 + CHA 6 = 18 > 15 → success
    roll215.click(); await settle42();
    Math.random = rnd215;
    ok('§215 the roll deducts 35 Shards and grants the storm blessing on success', g215.data.shards === 65 && g215.hasBlessing('storm'), `sh=${g215.data.shards} bless=${g215.hasBlessing('storm')}`);

    // §1.91: the gamble renders a roll widget and its <outcomes> resolve against the roll.
    const g91 = GameState.create({ name:'Gamble', gender:'m', profession:'Warrior', book:1, adv });
    const c91 = document.createElement('div');
    const st91 = new Story(c91, g91, { navigate(){}, onDeath(){}, notify(){} });
    st91.begin(await data.getSection(1, '91'), 1, '91');
    ok('§91 the gamble renders a roll widget, not a swallowing button', !!c91.querySelector('.btn-roll') && !c91.querySelector('.group-action'));
    g91.adjustCacheMoney('1.91', 10); // place a 10-Shard bet
    st91.rerender();
    const dep91 = () => Array.from(c91.querySelectorAll('.money-cache .btn-mini')).find((b) => /Deposit/.test(b.textContent));
    ok('task38: §91 the bet is editable before rolling', dep91() && dep91().disabled === false && !c91.querySelector('.money-cache.locked'));
    const rnd91 = Math.random; Math.random = () => 0.5; // 2 dice → 4+4 = 8 → range 5-9 → lose (×0)
    c91.querySelector('.btn-roll').click(); await settle42();
    Math.random = rnd91;
    ok('§91 rolling resolves the matching outcome (a 5-9 loses the bet)', g91.cacheMoney('1.91') === 0, `bet=${g91.cacheMoney('1.91')}`);
    ok('task38: §91 the bet locks after rolling (deposit/withdraw disabled)',
       g91.isCacheLocked('1.91') === true && dep91() && dep91().disabled === true && !!c91.querySelector('.money-cache.locked'),
       `locked=${g91.isCacheLocked('1.91')} depDisabled=${dep91() && dep91().disabled}`);

    // Regression: a top-level (stash) lock must NOT disable its money-cache widget —
    // only a lock bundled with a roll (the gamble) gates the widget (task 38).
    const gStash = GameState.create({ name:'Stash', gender:'m', profession:'Warrior', book:1, adv });
    const cStash = document.createElement('div');
    const stStash = new Story(cStash, gStash, { navigate(){}, onDeath(){}, notify(){} });
    stStash.begin(parse('<section name="t"><p><tick special="lock" cache="bank" hidden="t"/>Stash freely.</p><moneycache name="bank" text="Bank"/></section>'), 1, 't');
    const depBank = Array.from(cStash.querySelectorAll('.money-cache .btn-mini')).find((b) => /Deposit/.test(b.textContent));
    ok('task38: a stash (non-roll) lock leaves its widget editable', gStash.isCacheLocked('bank') === true && depBank && depBank.disabled === false, `locked=${gStash.isCacheLocked('bank')} dis=${depBank && depBank.disabled}`);

    // §2.53: the swim group's codeword *marker* (a non-hidden <lose codeword>) is
    // removed on the roll attempt, not on entry — so it can't clobber the entry
    // codeword the sibling box= choices display before the player rolls.
    const g53 = GameState.create({ name:'Swim', gender:'m', profession:'Warrior', book:2, adv });
    g53.data.abilities.scouting = 6; g53.data.book = 2; g53.data.section = '53';
    const c53 = document.createElement('div');
    const st53 = new Story(c53, g53, { navigate(){}, onDeath(){}, notify(){} });
    st53.begin(await data.getSection(2, '53'), 2, '53');
    ok('§53 renders the SCOUTING roll as a widget, not a group button', !!c53.querySelector('.btn-roll') && !c53.querySelector('.group-action'));
    ok('§53 the entry codeword marker is still held before the roll', g53.hasCodeword('2.53.1'));
    const rnd53 = Math.random; Math.random = () => 0.9;
    c53.querySelector('.btn-roll').click(); await settle42();
    Math.random = rnd53;
    ok('§53 the group codeword marker is cleared on the roll attempt (not on entry)', !g53.hasCodeword('2.53.1'));

    // --- selling the starting "leather jerkin" at an armourer that lists "leather" --
    // Armour is valued by Defence tier, so the tier-1 jerkin sells at the "leather" row.
    const gsell = GameState.create({ name:'S', gender:'m', profession:'Warrior', book:1, adv });
    const startShards = gsell.data.shards;
    const hadJerkin = gsell.findItems('leather jerkin').length === 1;
    const csell = document.createElement('div');
    const storySell = new Story(csell, gsell, { navigate(){}, onDeath(){}, notify(){} });
    const s30 = await data.getSection(1,'30'); storySell.begin(s30,1,'30');
    const leatherRow = Array.from(csell.querySelectorAll('.trade')).find((r) => /^leather\b/i.test((r.querySelector('.trade-name')?.textContent || '')));
    const sellBtn = leatherRow && Array.from(leatherRow.querySelectorAll('button')).find((b) => /^Sell/.test(b.textContent));
    ok('§30 leather sell enabled for the starting jerkin', hadJerkin && !!sellBtn && !sellBtn.disabled, sellBtn ? `disabled=${sellBtn.disabled}` : 'no btn');
    sellBtn.click();
    ok('§30 selling removes the jerkin', gsell.findItems('leather jerkin').length === 0);
    ok('§30 selling credits 45 Shards', gsell.data.shards === startShards + 45, `sh=${gsell.data.shards} start=${startShards}`);

    // --- task 5: <items group=… limit="N"> "choose up to N" pickup ---
    // §4.218 (limit=1): six reward rows share group "4.218"; taking one must lock
    // the other five (group cap), not merely the 12-item carry cap.
    const gpk = GameState.create({ name:'PK', gender:'m', profession:'Warrior', book:4, adv });
    const cpk = document.createElement('div');
    const storyPk = new Story(cpk, gpk, { navigate(){}, onDeath(){}, notify(){} });
    const s218 = await data.getSection(4,'218'); storyPk.begin(s218,4,'218');
    const rows218 = () => Array.from(cpk.querySelectorAll('.take-item'));
    ok('§218 renders six award rows', rows218().length === 6, String(rows218().length));
    ok('§218 all rows enabled before a pick', rows218().every((b) => !b.disabled));
    ok('§218 shows a pick-status pill', !!cpk.querySelector('.items-pick-status'));
    const before218 = gpk.itemCount();
    rows218()[0].click();
    ok('§218 takes exactly one item on the first pick', gpk.itemCount() === before218 + 1, `count=${gpk.itemCount()} before=${before218}`);
    const enabled218 = rows218().filter((b) => !b.disabled);
    const done218 = rows218().filter((b) => b.classList.contains('done'));
    ok('§218 limit=1: one taken, the rest locked', done218.length === 1 && enabled218.length === 0, `done=${done218.length} enabled=${enabled218.length}`);
    ok('§218 locked rows explain the cap', rows218().some((b) => /choose only 1/i.test(b.title)));

    // §5.671 (limit=2): take two, then the remaining rows lock at the cap.
    const gpk2 = GameState.create({ name:'PK2', gender:'m', profession:'Warrior', book:5, adv });
    const cpk2 = document.createElement('div');
    const storyPk2 = new Story(cpk2, gpk2, { navigate(){}, onDeath(){}, notify(){} });
    const s671 = await data.getSection(5,'671'); storyPk2.begin(s671,5,'671');
    const rows671 = () => Array.from(cpk2.querySelectorAll('.take-item'));
    const before671 = gpk2.itemCount();
    rows671().filter((b) => !b.disabled)[0].click();
    ok('§671 after one pick more remain enabled', rows671().filter((b) => !b.disabled).length > 0);
    rows671().filter((b) => !b.disabled)[0].click();
    ok('§671 limit=2: exactly two taken', gpk2.itemCount() === before671 + 2, `count=${gpk2.itemCount()} before=${before671}`);
    ok('§671 limit=2: remaining rows locked at the cap', rows671().filter((b) => !b.disabled).length === 0);

    // --- task 23: inline buy/sell — ships, tools, quantity, item sells ---
    // buy a ship (type canonicalised, named, initial crew)
    const gbship = GameState.create({ name:'BS', gender:'m', profession:'Warrior', book:4, adv });
    gbship.data.shards = 500;
    let r23 = applyInlineBuy(gbship, { price: 0, ship: 'galleon', shipName: 'Sea Centaur', initialCrew: 'poor' });
    ok('buy ship grants a named ship', r23.ok && gbship.ships.length === 1 && gbship.ships[0].type === 'galleon' && gbship.ships[0].name === 'Sea Centaur' && gbship.ships[0].crew === 'poor', JSON.stringify(gbship.ships[0]||{}));
    // galleon capacity is 3 cargo units; the 4th is refused
    applyInlineBuy(gbship, { price: 0, cargo: 'spices' });
    applyInlineBuy(gbship, { price: 0, cargo: 'silk' });
    applyInlineBuy(gbship, { price: 0, cargo: 'grain' });
    r23 = applyInlineBuy(gbship, { price: 0, cargo: 'timber' });
    ok('galleon carries 3 cargo units, 4th refused', gbship.ships[0].cargo.length === 3 && r23.ok === false, `cargo=${JSON.stringify(gbship.ships[0].cargo)}`);
    // brig alias canonicalises to brigantine; initialCrew="none" ⇒ poor
    const gbrig = GameState.create({ name:'BR', gender:'m', profession:'Warrior', book:5, adv });
    gbrig.data.shards = 100;
    applyInlineBuy(gbrig, { price: 50, ship: 'brig', initialCrew: 'none' });
    ok('buy ship="brig" canonicalises to brigantine (cap 2)', gbrig.ships[0].type === 'brigantine' && gbrig.ships[0].crew === 'poor' && gbrig.data.shards === 50, JSON.stringify(gbrig.ships[0]||{}));

    // --- task 24: canonical ship-type conditions + crew-upgrade clamping ---
    // A <trade ship="brig"> row buys a brigantine (capacity 2) — canonicalised at purchase.
    const gtb = GameState.create({ name:'TB', gender:'m', profession:'Warrior', book:4, adv });
    gtb.data.shards = 1000;
    buyTrade(gtb, goodsFrom(parse('<trade ship="brig" initialCrew="poor" buy="450"/>'), 'ship', null, 0), 450);
    ok('§4.141 trade ship="brig" stores brigantine + crew poor', gtb.ships[0] && gtb.ships[0].type === 'brigantine' && gtb.ships[0].crew === 'poor', JSON.stringify(gtb.ships[0]||{}));
    // A brigantine (stored full name) matches an abbreviated <elseif ship="brig"> and rejects barque/galleon (book4/11,161).
    ok('§4.11 brigantine matches <if ship="brig">', eng.evaluateCondition(parse('<if ship="brig"/>'), gtb));
    ok('§4.11 brigantine matches full <if ship="brigantine">', eng.evaluateCondition(parse('<if ship="brigantine"/>'), gtb));
    ok('§4.11 brigantine does NOT match <if ship="barque">', eng.evaluateCondition(parse('<if ship="barque"/>'), gtb) === false);
    ok('§4.11 brigantine does NOT match <if ship="galleon">', eng.evaluateCondition(parse('<if ship="galleon"/>'), gtb) === false);
    // gall alias resolves to galleon on both the stored type and the condition value.
    const gtg = GameState.create({ name:'TG', gender:'m', profession:'Warrior', book:5, adv });
    gtg.addShip({ type:'gall', name:'S', crew:'average', cargo:[], docked:null }); // legacy save holding the abbreviation
    ok('legacy "gall" ship matches <if ship="galleon">', eng.evaluateCondition(parse('<if ship="galleon"/>'), gtg));
    ok('legacy "gall" ship matches <if ship="gall">', eng.evaluateCondition(parse('<if ship="gall"/>'), gtg));
    // crew upgrade: <lose crew="-1"> on an excellent crew stays excellent (no wrap to poor).
    const gce = GameState.create({ name:'CE', gender:'m', profession:'Warrior', book:1, adv });
    gce.addShip({ type:'galleon', name:'S', crew:'excellent', cargo:[], docked:null });
    eng.applyEffect(parse('<lose crew="-1"/>'), gce, {});
    ok('crew upgrade past excellent stays excellent', gce.ships[0].crew === 'excellent', gce.ships[0].crew);
    // crew upgrade by 2 from good clamps to excellent (not off the end).
    const gcg = GameState.create({ name:'CG', gender:'m', profession:'Warrior', book:1, adv });
    gcg.addShip({ type:'galleon', name:'S', crew:'good', cargo:[], docked:null });
    eng.applyEffect(parse('<lose crew="-2"/>'), gcg, {});
    ok('crew upgrade -2 from good clamps to excellent', gcg.ships[0].crew === 'excellent', gcg.ships[0].crew);
    // crew demotion: <lose crew="1"> from poor stays poor (low-end clamp).
    const gcp = GameState.create({ name:'CP', gender:'m', profession:'Warrior', book:1, adv });
    gcp.addShip({ type:'galleon', name:'S', crew:'poor', cargo:[], docked:null });
    eng.applyEffect(parse('<lose crew="1"/>'), gcp, {});
    ok('crew demotion below poor stays poor', gcp.ships[0].crew === 'poor', gcp.ships[0].crew);
    // a mid-grade upgrade still moves one step (average → good).
    const gcma = GameState.create({ name:'CMA', gender:'m', profession:'Warrior', book:1, adv });
    gcma.addShip({ type:'galleon', name:'S', crew:'average', cargo:[], docked:null });
    eng.applyEffect(parse('<lose crew="-1"/>'), gcma, {});
    ok('crew upgrade average → good', gcma.ships[0].crew === 'good', gcma.ships[0].crew);

    // --- task 103: §4.658 salvaged barque carries the wrecked ship's crew grade ----
    {
      // market: initialCrew resolves as a variable/number first — oldcrew is a 1-based
      // CREW_LEVELS index set by <set var="oldcrew" value="crew"/>, so it maps to its grade.
      const gcv = GameState.create({ name:'CV658', gender:'m', profession:'Warrior', book:4, adv });
      gcv.setVar('oldcrew', 3); // 1=poor, 2=average, 3=good, 4=excellent
      applyInlineBuy(gcv, { ship:'barque', shipName:'Scavenger', initialCrew:'oldcrew' });
      ok('initialCrew="oldcrew"=3 gives a GOOD crew (not reset to average)', gcv.ships[gcv.ships.length-1].crew === 'good', gcv.ships[gcv.ships.length-1].crew);
      const gcv2 = GameState.create({ name:'CV658b', gender:'m', profession:'Warrior', book:4, adv });
      applyInlineBuy(gcv2, { ship:'barque', initialCrew:'none' });
      applyInlineBuy(gcv2, { ship:'barque', initialCrew:null });
      applyInlineBuy(gcv2, { ship:'barque', initialCrew:'excellent' });
      ok('initialCrew fallbacks preserved: none→poor, blank→average, literal grade kept',
        gcv2.ships[0].crew === 'poor' && gcv2.ships[1].crew === 'average' && gcv2.ships[2].crew === 'excellent', gcv2.ships.map((s)=>s.crew).join(','));

      // end-to-end §4.658: wreck a GOOD-crew brig at sea, salvage the barque, upgrade one grade.
      const g658 = GameState.create({ name:'W658', gender:'m', profession:'Warrior', book:4, adv });
      g658.addShip({ type:'brigantine', name:'Old Ship', crew:'good', cargo:[], docked:null }); // sailing at sea
      const c658 = document.createElement('div');
      new Story(c658, g658, { navigate(){}, onDeath(){}, notify(){} }).begin(await data.getSection(4,'658'), 4, '658');
      ok('§4.658 crosses off the wrecked ship on entry', g658.ships.length === 0, 'ships=' + g658.ships.length);
      const takeBarque = Array.from(c658.querySelectorAll('.btn-mini')).find((b) => /Note it/i.test(b.textContent) && !b.disabled);
      ok('§4.658 offers the salvaged barque as a buy', !!takeBarque);
      takeBarque.click();
      ok('§4.658 the salvaged barque keeps the GOOD crew (oldcrew), not average', g658.ships.length === 1 && g658.ships[0].crew === 'good', g658.ships[0] ? g658.ships[0].crew : 'no ship');
      const upExcellent = () => Array.from(c658.querySelectorAll('.btn-mini')).find((b) => /becomes excellent/i.test(b.textContent) && !b.disabled);
      const upAverage = () => Array.from(c658.querySelectorAll('.btn-mini')).find((b) => /becomes average/i.test(b.textContent) && !b.disabled);
      ok('§4.658 the upgrade offered is good→excellent (not from average)', !!upExcellent() && !upAverage());
      upExcellent().click();
      ok('§4.658 taking the one-grade upgrade makes the crew excellent', g658.ships[0].crew === 'excellent', g658.ships[0].crew);
    }

    // --- task 10: seedable RNG / reproducible dice ------------------------
    // Same seed ⇒ identical roll sequence; different seeds ⇒ (almost surely)
    // different ones; string seeds hash deterministically; null reverts to
    // Math.random. All game dice route through rng(), so seeding is enough.
    const seq = (seed, n = 12) => { eng.seedRng(seed); const a = []; for (let i = 0; i < n; i++) a.push(eng.rollD6()); return a; };
    const s1 = seq(1234), s1b = seq(1234);
    ok('seedRng: same numeric seed reproduces the roll sequence', JSON.stringify(s1) === JSON.stringify(s1b));
    ok('seeded rolls stay in 1..6', s1.every((d) => d >= 1 && d <= 6));
    ok('seedRng: a different seed gives a different sequence', JSON.stringify(s1) !== JSON.stringify(seq(9999)));
    const strA = seq('fabled'), strB = seq('fabled');
    ok('seedRng: string seed is deterministic', JSON.stringify(strA) === JSON.stringify(strB));
    ok('seedRng: string vs numeric seeds differ', JSON.stringify(strA) !== JSON.stringify(s1));
    ok('seedRng returns the applied numeric seed', eng.seedRng(1234) === 1234);
    ok('seedRng(null) reverts (returns null)', eng.seedRng(null) === null);
    // rollDiceExpr rides the same seeded stream and still honours the modifier.
    eng.seedRng(7); const rdA = eng.rollDiceExpr('2d6+1');
    eng.seedRng(7); const rdB = eng.rollDiceExpr('2d6+1');
    ok('rollDiceExpr reproduces on the same seed (+mod)', rdA.total === rdB.total && rdA.total >= 3 && rdA.total <= 13, String(rdA.total));
    eng.seedRng(null); // revert so the remaining tests use Math.random as before

    // --- task 11: per-visit memoization path invariant --------------------
    // Memo keys derive from a positional path (parent.idx); it is stable only
    // because the parsed tree isn't mutated during a visit. Re-rendering a real,
    // mixed section must keep every path mapped to the same node (no tripwire),
    // and the tripwire must actually fire if a path's node ever changes.
    {
      const warns = [];
      const _warn = console.warn; console.warn = (...a) => { warns.push(a.join(' ')); };
      let nPaths = 0;
      try {
        const g11 = GameState.create({ name:'M11', gender:'m', profession:'Warrior', book:1, adv });
        const story11 = new Story(document.createElement('div'), g11, { navigate(){}, onDeath(){}, notify(){} });
        story11.begin(parse('<section name="t"><p>Intro text.</p><item name="sword"/><difficulty ability="COMBAT" level="8"/><success><goto section="10"/></success></section>'), 1, 't');
        nPaths = story11.ctx.pathNodes.size;
        story11.rerender(); story11.rerender();
      } finally { console.warn = _warn; }
      ok('task11: pathNodes populated on first render', nPaths > 0, String(nPaths));
      ok('task11: re-renders trip no reorder warning', warns.filter((w) => w.includes('effect-dedup')).length === 0, warns.join(' | '));
    }
    { // positive check: the tripwire fires when a path is made to map to a new node
      const warns2 = [];
      const _warn2 = console.warn; console.warn = (...a) => { warns2.push(a.join(' ')); };
      try {
        const g11b = GameState.create({ name:'M11b', gender:'m', profession:'Warrior', book:1, adv });
        const story11b = new Story(document.createElement('div'), g11b, { navigate(){}, onDeath(){}, notify(){} });
        story11b.begin(parse('<section name="t"><p>Intro.</p><item name="sword"/></section>'), 1, 't');
        const somePath = story11b.ctx.pathNodes.keys().next().value;
        story11b.ctx.pathNodes.set(somePath, document.createElement('goto')); // simulate a reorder
        story11b.rerender();
      } finally { console.warn = _warn2; }
      ok('task11: tripwire fires when a path maps to a new node', warns2.some((w) => w.includes('effect-dedup')), warns2.join(' | '));
    }

    // --- task 25: value/expression parsing (vars containing "d", unary minus, division) ---
    // isDiceExpr must match real NdM dice only — not identifiers that merely contain a 'd'.
    ok('isDiceExpr "3d" true', eng.isDiceExpr('3d') === true);
    ok('isDiceExpr "2d6+1" true', eng.isDiceExpr('2d6+1') === true);
    ok('isDiceExpr "d" false (a var)', eng.isDiceExpr('d') === false);
    ok('isDiceExpr "deduct" false', eng.isDiceExpr('deduct') === false);
    ok('isDiceExpr "defence" false', eng.isDiceExpr('defence') === false);
    ok('isDiceExpr "shards" false', eng.isDiceExpr('shards') === false);
    // resolveValue: a var whose name contains 'd' is read as a var, not rolled.
    const gex = GameState.create({ name:'EX', gender:'m', profession:'Warrior', book:1, adv });
    gex.setVar('d', 4); gex.setVar('deduct', 6); gex.setVar('s', 5); gex.setVar('bonus', 3);
    ok('resolveValue var "d" (not a die)', eng.resolveValue(gex, 'd') === 4, String(eng.resolveValue(gex,'d')));
    ok('resolveValue var "deduct" (not a die)', eng.resolveValue(gex, 'deduct') === 6);
    ok('resolveValue unary "-s" negates the var', eng.resolveValue(gex, '-s') === -5, String(eng.resolveValue(gex,'-s')));
    ok('resolveValue unary "-bonus" negates the var', eng.resolveValue(gex, '-bonus') === -3);
    ok('resolveValue "3d" still rolls (3..18)', (() => { const v = eng.resolveValue(gex, '3d'); return v >= 3 && v <= 18; })());
    // evalExpression: integer division, parentheses, unary minus, keyword-first idents.
    gex.data.shards = 900;
    ok('eval shards/300 = 3', eng.evalExpression('shards/300', gex) === 3, String(eng.evalExpression('shards/300', gex)));
    gex.data.shards = 850;
    ok('eval (900-shards)/100 = 0 (int div)', eng.evalExpression('(900-shards)/100', gex) === 0, String(eng.evalExpression('(900-shards)/100', gex)));
    gex.data.shards = 200;
    ok('eval (900-shards)/100 = 7', eng.evalExpression('(900-shards)/100', gex) === 7, String(eng.evalExpression('(900-shards)/100', gex)));
    gex.data.shards = 1;
    ok('eval (shards+9)/10 = 1 (round-up idiom)', eng.evalExpression('(shards+9)/10', gex) === 1);
    gex.data.shards = 11;
    ok('eval (shards+9)/10 = 2', eng.evalExpression('(shards+9)/10', gex) === 2, String(eng.evalExpression('(shards+9)/10', gex)));
    ok('eval -armour = -armourBonus (keyword)', eng.evalExpression('-armour', gex) === -gex.armourBonus(), String(eng.evalExpression('-armour', gex)));
    ok('eval -defence = -defence (keyword)', eng.evalExpression('-defence', gex) === -gex.defence(), String(eng.evalExpression('-defence', gex)));
    ok('eval 12-charisma', eng.evalExpression('12-charisma', gex) === 12 - gex.ability('charisma'));
    ok('eval magic+rank', eng.evalExpression('magic+rank', gex) === gex.ability('magic') + gex.data.rank);
    gex.setVar('x', 5);
    ok('eval (x+1)/2 = 3', eng.evalExpression('(x+1)/2', gex) === 3, String(eng.evalExpression('(x+1)/2', gex)));
    gex.data.rank = 2; gex.setVar('roll', 1);
    ok('eval (rank+1)-roll = 2', eng.evalExpression('(rank+1)-roll', gex) === 2, String(eng.evalExpression('(rank+1)-roll', gex)));
    gex.setVar('weaponbonus', 2);
    ok('eval 6-weaponbonus = 4 (bare var)', eng.evalExpression('6-weaponbonus', gex) === 4, String(eng.evalExpression('6-weaponbonus', gex)));
    // <set var="d" value="-armour"/> stores the negative armour bonus (keyword-first).
    const gsd = GameState.create({ name:'SD', gender:'m', profession:'Warrior', book:4, adv });
    eng.applyEffect(parse('<set var="d" value="-armour"/>'), gsd, {});
    ok('§6.696 set d = -armour', gsd.getVar('d') === -gsd.armourBonus() && gsd.armourBonus() > 0, `d=${gsd.getVar('d')} arm=${gsd.armourBonus()}`);
    // <lose stamina="N"><adjust amount="d"/></lose> reduces the wound by the armour bonus.
    const st0 = gsd.data.stamina;
    eng.applyEffect(parse('<lose stamina="10"><adjust amount="d"/></lose>'), gsd, {});
    ok('§6.696 armour reduces stamina loss', gsd.data.stamina === st0 - (10 - gsd.armourBonus()), `st ${st0}->${gsd.data.stamina}`);
    // book4/556: worshippers of the Three Fortunes subtract 1 from the loss.
    const gtf = GameState.create({ name:'TF', gender:'m', profession:'Warrior', book:4, adv });
    gtf.setGod('The Three Fortunes'); const stf = gtf.data.stamina;
    eng.applyEffect(parse('<lose stamina="6"><adjust god="The Three Fortunes" amount="-1"/></lose>'), gtf, {});
    ok('§4.556 Three Fortunes initiate loses 5 not 6', gtf.data.stamina === stf - 5, `st ${stf}->${gtf.data.stamina}`);
    const gnf = GameState.create({ name:'NF', gender:'m', profession:'Warrior', book:4, adv });
    const snf = gnf.data.stamina;
    eng.applyEffect(parse('<lose stamina="6"><adjust god="The Three Fortunes" amount="-1"/></lose>'), gnf, {});
    ok('§4.556 non-worshipper loses full 6', gnf.data.stamina === snf - 6, `st ${snf}->${gnf.data.stamina}`);
    // a plain stamina loss (no <adjust> children) is unchanged (regression).
    const gpl = GameState.create({ name:'PL', gender:'m', profession:'Warrior', book:1, adv });
    const spl = gpl.data.stamina;
    eng.applyEffect(parse('<lose stamina="5"/>'), gpl, {});
    ok('plain stamina loss still 5', gpl.data.stamina === spl - 5);
    // book2/579: reset the unwounded (max) Stamina to the rolled var s.
    const g579 = GameState.create({ name:'R579', gender:'m', profession:'Warrior', book:2, adv });
    g579.data.staminaMax = 20; g579.data.stamina = 20; g579.setVar('s', 7);
    eng.applyEffect(parse('<lose ability="stamina" amount="-s"><adjust ability="stamina" modifier="natural"/></lose>'), g579, {});
    ok('§2.579 unwounded Stamina reset to the 2d roll (7)', g579.data.staminaMax === 7, `max=${g579.data.staminaMax}`);

    // --- task 46: <set var … modifier="natural|affected"> selects a resolution mode ---
    // modifier= is NOT an additive amount (the old bug): the value= expression's
    // ability/stamina identifiers resolve as the WRITTEN (natural) score.
    const gset = GameState.create({ name:'SET', gender:'m', profession:'Warrior', book:2, adv });
    gset.data.rank = 4;
    // §2.752 rank ceremony: r must equal the natural Rank (was 0 under the additive bug).
    eng.applyEffect(parse('<set var="r" value="rank" modifier="natural"/>'), gset, {});
    ok('§2.752 <set r=rank modifier=natural> stores the real Rank, not 0', gset.getVar('r') === 4, `r=${gset.getVar('r')}`);
    // The 2d>r check would auto-succeed if r were 0 (min roll 2); with r=4 it is a real test.
    ok('§2.752 rank ceremony is a real check (r>0)', gset.getVar('r') > 0);
    // §6.332: c = 12 − natural CHARISMA (a no-op under the additive bug — set to 0).
    const gcha = GameState.create({ name:'CHA', gender:'m', profession:'Warrior', book:6, adv });
    const natCha = gcha.abilityNatural('charisma');
    eng.applyEffect(parse('<set var="c" value="12-charisma" modifier="natural"/>'), gcha, {});
    ok('§6.332 <set c=12-charisma modifier=natural> = 12 − natural CHARISMA', gcha.getVar('c') === 12 - natCha, `c=${gcha.getVar('c')} natCha=${natCha}`);
    // modifier="natural" reads the WRITTEN score, ignoring an item's ability bonus;
    // modifier="affected" reads the item-boosted score.
    const gnb = GameState.create({ name:'NB', gender:'m', profession:'Warrior', book:2, adv });
    gnb.addItem(makeItem('tool', 'lucky charm', 12, 'thievery')); // a big THIEVERY tool (no starting tool competes)
    const gnbNat = gnb.abilityNatural('thievery'), gnbAff = gnb.ability('thievery');
    ok('the THIEVERY tool boosts the affected score', gnbAff > gnbNat, `nat=${gnbNat} aff=${gnbAff}`);
    eng.applyEffect(parse('<set var="cn" value="thievery" modifier="natural"/>'), gnb, {});
    eng.applyEffect(parse('<set var="ca" value="thievery" modifier="affected"/>'), gnb, {});
    ok('modifier="natural" reads the written THIEVERY (ignores the tool bonus)', gnb.getVar('cn') === gnbNat, `cn=${gnb.getVar('cn')} nat=${gnbNat}`);
    ok('modifier="affected" reads the item-boosted THIEVERY', gnb.getVar('ca') === gnbAff, `ca=${gnb.getVar('ca')} aff=${gnbAff}`);
    // §3.104: curr=stamina (current), max=stamina affected (unwounded max) → detect a wound.
    const g104 = GameState.create({ name:'W104', gender:'m', profession:'Warrior', book:3, adv });
    g104.data.staminaMax = 20; g104.data.stamina = 12;
    eng.applyEffect(parse('<set var="curr" value="stamina"/>'), g104, {});
    eng.applyEffect(parse('<set var="max" value="stamina" modifier="affected"/>'), g104, {});
    ok('§3.104 bare stamina = current, affected stamina = unwounded max', g104.getVar('curr') === 12 && g104.getVar('max') === 20, `curr=${g104.getVar('curr')} max=${g104.getVar('max')}`);
    ok('§3.104 wounded detected (curr < max)', g104.getVar('curr') < g104.getVar('max'));
    // evalExpression mode plumbing directly.
    ok('evalExpression(rank, natural) reads the Rank, not 0', eng.evalExpression('rank', gset, 'natural') === 4);

    // --- task 77: selector-aware <set item|weapon|armour|tool|cache> value resolution ---
    // value="matches" counts items matching the selector (JaFL SetVarNode.resolveIdentifier),
    // so a reusable lantern (light) plus a candle (light,useonce) give lights=2 > candles=1 —
    // the candle is NOT burned; with candles only, lights == candles and one is crossed off.
    const gm77 = GameState.create({ name:'M77', gender:'m', profession:'Warrior', book:1, adv });
    gm77.data.items = [];
    gm77.addItem(makeItem('item', 'lantern', 0, null, ['light']));
    gm77.addItem(makeItem('item', 'candle', 0, null, ['light', 'useonce']));
    eng.applyEffect(parse('<set var="lights" item="?" tags="light" value="matches"/>'), gm77, {});
    eng.applyEffect(parse('<set var="candles" item="?" tags="light,useonce" value="matches"/>'), gm77, {});
    ok('§1.164 value="matches" counts light items (lantern+candle → lights=2)', gm77.getVar('lights') === 2, `lights=${gm77.getVar('lights')}`);
    ok('§1.164 value="matches" counts useonce candles (→ candles=1)', gm77.getVar('candles') === 1, `candles=${gm77.getVar('candles')}`);
    ok('§1.164 a reusable light ⇒ candles ≠ lights (candle survives)', gm77.getVar('candles') !== gm77.getVar('lights'));
    const gc77 = GameState.create({ name:'C77', gender:'m', profession:'Warrior', book:1, adv });
    gc77.data.items = [];
    gc77.addItem(makeItem('item', 'candle', 0, null, ['light', 'useonce']));
    eng.applyEffect(parse('<set var="lights" item="?" tags="light" value="matches"/>'), gc77, {});
    eng.applyEffect(parse('<set var="candles" item="?" tags="light,useonce" value="matches"/>'), gc77, {});
    ok('§1.164 candles-only ⇒ candles == lights (a candle must be crossed off)', gc77.getVar('candles') === gc77.getVar('lights') && gc77.getVar('candles') === 1, `l=${gc77.getVar('lights')} c=${gc77.getVar('candles')}`);
    // §1.164 render integration: the "[If you're using a candle, cross it off]" block is
    // gated by <if var="candles" equals="lights">. A false <if> still renders its prose but
    // as an inactive (.cond-inactive) span, so assert on activeness, not mere text presence.
    const crossInactive = (root) => Array.from(root.querySelectorAll('.cond-inactive')).some((s) => /cross it off/i.test(s.textContent));
    const c164 = document.createElement('div');
    new Story(c164, gm77, { navigate(){}, onDeath(){}, notify(){} }).begin(await data.getSection(1, '164'), 1, '164');
    ok('§1.164 lantern+candle: the "cross it off" prompt is inactive (candle not burned)', /cross it off/i.test(c164.textContent) && crossInactive(c164));
    const c164b = document.createElement('div');
    new Story(c164b, gc77, { navigate(){}, onDeath(){}, notify(){} }).begin(await data.getSection(1, '164'), 1, '164');
    ok('§1.164 candles-only: the "cross it off" prompt is active', /cross it off/i.test(c164b.textContent) && !crossInactive(c164b));

    // §5.386 value="weapon" reads the single SELECTED weapon's bonus (weapon="?" tags="Tz"),
    // not the wielded/best weapon — proven by making the wielded sword outrank the Tz blade.
    const gw386 = GameState.create({ name:'W386', gender:'m', profession:'Warrior', book:5, adv });
    gw386.data.items = [];
    gw386.addItem(makeItem('weapon', 'plain sword', 5));               // the best/wielded weapon
    gw386.addItem(makeItem('weapon', 'targ blade', 2, null, ['Tz']));  // the tagged one, lower bonus
    eng.applyEffect(parse('<set var="bonus" weapon="?" tags="Tz" value="weapon"/>'), gw386, {});
    ok('§5.386 value="weapon" reads the Tz-tagged weapon (2), not the wielded sword (5)', gw386.getVar('bonus') === 2, `bonus=${gw386.getVar('bonus')} wielded=${gw386.wieldedWeapon()?.bonus}`);

    // §2.665 smithy: shards= reads the named cache (money left as payment), and item="?"
    // cache="…" value="weapon|armour" reads the single deposited item's bonus.
    const g665 = GameState.create({ name:'S665', gender:'m', profession:'Warrior', book:2, adv });
    g665.data.shards = 5; // purse — must NOT be read
    g665.setCacheMoney('2.617', 900);
    g665.cacheAddItem('2.617', makeItem('weapon', 'left blade', 3));
    eng.applyEffect(parse('<set var="MoneyBonus" value="shards/300" cache="2.617"/>'), g665, {});
    ok('§2.665 shards= reads the cache money (900/300=3), not the purse (5)', g665.getVar('MoneyBonus') === 3, `mb=${g665.getVar('MoneyBonus')}`);
    eng.applyEffect(parse('<set var="weaponbonus" item="?" cache="2.617" value="weapon"/>'), g665, {});
    eng.applyEffect(parse('<set var="armourbonus" item="?" cache="2.617" value="armour"/>'), g665, {});
    ok('§2.665 value="weapon" reads the cached weapon bonus (3)', g665.getVar('weaponbonus') === 3, `wb=${g665.getVar('weaponbonus')}`);
    ok('§2.665 value="armour" = 0 for a cached weapon (no worn-armour fallback on a cache)', g665.getVar('armourbonus') === 0, `ab=${g665.getVar('armourbonus')}`);
    eng.applyEffect(parse('<set var="bonus" value="6-weaponbonus"/>'), g665, {});
    ok('§2.665 upgrade cap bonus = 6 − cached weapon bonus = 3', g665.getVar('bonus') === 3, `cap=${g665.getVar('bonus')}`);
    // Mirror: a cached ARMOUR feeds armourbonus, weaponbonus stays 0.
    const g665b = GameState.create({ name:'S665b', gender:'m', profession:'Warrior', book:2, adv });
    g665b.cacheAddItem('2.617', makeItem('armour', 'left mail', 2));
    eng.applyEffect(parse('<set var="wb" item="?" cache="2.617" value="weapon"/>'), g665b, {});
    eng.applyEffect(parse('<set var="ab" item="?" cache="2.617" value="armour"/>'), g665b, {});
    ok('§2.665 cached armour → armourbonus=2, weaponbonus=0', g665b.getVar('ab') === 2 && g665b.getVar('wb') === 0, `ab=${g665b.getVar('ab')} wb=${g665b.getVar('wb')}`);

    // §2.322 risk modifier: RandomPlus = (900 − cache shards)/100 — the treasure TAKEN, read
    // from the cache, not the purse. After collecting 250, 650 remain → (900−650)/100 = 2.
    const g322 = GameState.create({ name:'R322', gender:'m', profession:'Warrior', book:2, adv });
    g322.data.shards = 0;
    g322.setCacheMoney('2.322.t', 900);
    g322.withdrawCacheMoney('2.322.t', 250); // collect 250 of the treasure into the purse
    eng.applyEffect(parse('<set var="RandomPlus" value="(900-shards)/100" cache="2.322.t"/>'), g322, {});
    ok('§2.322 risk reads cache treasure taken ((900−650)/100 = 2), not purse', g322.getVar('RandomPlus') === 2, `rp=${g322.getVar('RandomPlus')} cache=${g322.cacheMoney('2.322.t')} purse=${g322.data.shards}`);

    // Regression: a value= with an item selector but NO cache still reads the purse for shards.
    const greg77 = GameState.create({ name:'REG77', gender:'m', profession:'Warrior', book:2, adv });
    greg77.data.shards = 600;
    eng.applyEffect(parse('<set var="q" item="?" tags="light" value="shards/300"/>'), greg77, {});
    ok('regression: shards= with a selector but no cache still reads the purse (600/300=2)', greg77.getVar('q') === 2, `q=${greg77.getVar('q')}`);

    // --- task 76: blessings — metadata, permanence, migration, and rerolls -----------
    // Metadata + consumption: an ordinary blessing is used up; a permanent one is not.
    const gb76 = GameState.create({ name:'B76', gender:'m', profession:'Warrior', book:1, adv });
    gb76.data.blessings = []; gb76.data.permanentBlessings = [];
    gb76.addBlessing('luck');
    gb76.addBlessing('storm', true); // permanent (book6/159)
    ok('§76 addBlessing stores the blessings', gb76.hasBlessing('luck') && gb76.hasBlessing('storm'));
    ok('§76 permanent="true" marks the blessing permanent', gb76.isBlessingPermanent('storm') && !gb76.isBlessingPermanent('luck'));
    ok('§76 useBlessing consumes an ordinary blessing', gb76.useBlessing('luck') === true && !gb76.hasBlessing('luck'));
    ok('§76 useBlessing keeps a permanent blessing', gb76.useBlessing('storm') === true && gb76.hasBlessing('storm'));
    ok('§76 useBlessing on a missing blessing returns false', gb76.useBlessing('luck') === false);
    // "storms"/"storm" are one blessing; re-granting as permanent upgrades it (no dup).
    const gb76b = GameState.create({ name:'B76b', gender:'m', profession:'Warrior', book:1, adv });
    gb76b.data.blessings = []; gb76b.data.permanentBlessings = [];
    gb76b.addBlessing('storms'); // ordinary, alias spelling
    ok('§76 storms alias is stored, not yet permanent', gb76b.hasBlessing('storm') && !gb76b.isBlessingPermanent('storm'));
    gb76b.addBlessing('storm', true); // upgrade to permanent
    ok('§76 re-granting permanent upgrades in place (no duplicate)', gb76b.data.blessings.length === 1 && gb76b.isBlessingPermanent('storm'));
    ok('§76 removeAllBlessings clears permanent blessings too', gb76b.removeAllBlessings() && !gb76b.hasBlessing('storm') && gb76b.data.permanentBlessings.length === 0);

    // Engine grant reads permanent= (book6/159); lose-all clears even permanent (book4/607).
    const gb76g = GameState.create({ name:'B76g', gender:'m', profession:'Warrior', book:6, adv });
    eng.applyEffect(parse('<tick blessing="storm" permanent="true">Safety from Storms</tick>'), gb76g, {});
    ok('§6.159 <tick blessing=storm permanent=true> is permanent', gb76g.hasBlessing('storm') && gb76g.isBlessingPermanent('storm'));
    eng.applyEffect(parse('<lose blessing="*"/>'), gb76g, {});
    ok('§4.607 <lose blessing="*"> removes even the permanent storm', !gb76g.hasBlessing('storm'));

    // Migration: legacy string-only save → no permanent markers; a save's markers are
    // canonicalised and orphan markers (no held blessing) are dropped.
    const mig76a = sanitizeData({ abilities:{combat:5}, stamina:9, blessings:['luck','combat'] });
    ok('§76 migrate: legacy save keeps blessings, permanentBlessings []', mig76a.blessings.length === 2 && Array.isArray(mig76a.permanentBlessings) && mig76a.permanentBlessings.length === 0);
    const mig76b = sanitizeData({ abilities:{combat:5}, stamina:9, blessings:['storms'], permanentBlessings:['storms','ghost'] });
    ok('§76 migrate: permanent marker canonicalised + orphan dropped', mig76b.permanentBlessings.length === 1 && mig76b.permanentBlessings[0] === 'storm');

    // rerollBlessings eligibility (headless).
    const gre76 = GameState.create({ name:'RE76', gender:'m', profession:'Warrior', book:1, adv });
    gre76.data.blessings = ['combat', 'luck', 'travel']; gre76.data.permanentBlessings = [];
    ok('§76 failed COMBAT check → COMBAT + Luck rerolls', JSON.stringify(gre76.rerollBlessings({ ability:'combat', success:false, kind:'check' })) === JSON.stringify(['combat','luck']));
    ok('§76 passed COMBAT check → no reroll offered', gre76.rerollBlessings({ ability:'combat', success:true, kind:'check' }).length === 0);
    ok('§76 failed SCOUTING check (no SCOUTING blessing) → Luck only', JSON.stringify(gre76.rerollBlessings({ ability:'scouting', success:false, kind:'check' })) === JSON.stringify(['luck']));
    ok('§76 random → Luck; travel random → Safe Travel + Luck', JSON.stringify(gre76.rerollBlessings({ kind:'random' })) === JSON.stringify(['luck']) && JSON.stringify(gre76.rerollBlessings({ kind:'random', travel:true })) === JSON.stringify(['travel','luck']));

    // DOM: a failed ability roll offers a one-click blessing reroll that replaces the
    // result and consumes the blessing. Synthetic §T76 THIEVERY roll at Difficulty 15.
    const gdr76 = GameState.create({ name:'DR76', gender:'m', profession:'Warrior', book:1, adv });
    gdr76.data.abilities.thievery = 6; gdr76.data.blessings = ['thievery', 'luck']; gdr76.data.permanentBlessings = [];
    const sec76 = '<section name="T76"><p><difficulty ability="thievery" level="15">roll THIEVERY</difficulty></p><outcomes><success section="10">win</success><failure section="20">lose</failure></outcomes></section>';
    const cdr76 = document.createElement('div');
    new Story(cdr76, gdr76, { navigate(){}, onDeath(){}, notify(){} }).begin(parse(sec76), 1, 'T76');
    ok('§T76 no reroll button before rolling', !cdr76.querySelector('.blessing-reroll'));
    const rnd76 = Math.random; Math.random = () => 0; // 1+1=2, +6 = 8 ≤ 15 → failure
    cdr76.querySelector('.btn-roll').click(); await settle42();
    Math.random = rnd76;
    ok('§T76 a failed THIEVERY roll offers two reroll buttons (THIEVERY + Luck)', cdr76.querySelectorAll('.blessing-reroll').length === 2, `n=${cdr76.querySelectorAll('.blessing-reroll').length}`);
    const thievBtn = Array.from(cdr76.querySelectorAll('.blessing-reroll')).find((b) => /THIEVERY/.test(b.textContent));
    ok('§T76 a THIEVERY reroll button is offered', !!thievBtn);
    const rnd76b = Math.random; Math.random = () => 0.99; // 6+6=12, +6 = 18 > 15 → success
    thievBtn.click(); await settle42();
    Math.random = rnd76b;
    ok('§T76 the THIEVERY blessing is consumed by the reroll (Luck kept)', !gdr76.hasBlessing('thievery') && gdr76.hasBlessing('luck'));
    ok('§T76 the reroll now succeeds and offers no further reroll', !cdr76.querySelector('.blessing-reroll') && /Success/.test(cdr76.textContent));

    // --- task 123: "Immunity to Disease and Poison" is one blessing under two spellings ---
    // The XML grants it as blessing="poison" (§2.133) and blessing="disease" (9 places),
    // and tests/spends it under either spelling. Alias them to one canonical blessing so a
    // grant in one spelling satisfies an <if>/<lose> in the other (like storm/storms).
    const gdp = GameState.create({ name:'DP', gender:'m', profession:'Warrior', book:2, adv });
    gdp.data.blessings = []; gdp.data.permanentBlessings = [];
    eng.applyEffect(parse('<tick blessing="poison">Immunity to Disease and Poison</tick>'), gdp, {}); // §2.133 spelling
    ok('§123 a "poison" grant is a single blessing', gdp.data.blessings.length === 1);
    ok('§123 a "poison" grant satisfies <if blessing="disease">', eng.evaluateCondition(parse('<if blessing="disease"/>'), gdp));
    eng.applyEffect(parse('<lose blessing="disease">used up</lose>'), gdp, {}); // §2.402 spelling
    ok('§123 <lose blessing="disease"> consumes the "poison" grant', !gdp.hasBlessing('poison') && gdp.data.blessings.length === 0);
    // …and the reverse: grant under "disease", check/spend under "poison".
    eng.applyEffect(parse('<gain blessing="disease"/>'), gdp, {});
    ok('§123 a "disease" grant satisfies <if blessing="poison">', eng.evaluateCondition(parse('<if blessing="poison"/>'), gdp));
    eng.applyEffect(parse('<lose blessing="poison">cross it off</lose>'), gdp, {}); // §2.377 spelling
    ok('§123 <lose blessing="poison"> consumes the "disease" grant', !gdp.hasBlessing('disease') && gdp.data.blessings.length === 0);
    // Migration: a legacy save that stored either spelling survives as the one canonical
    // blessing, and a save that held both spellings collapses to one (no duplicate).
    const migdp = sanitizeData({ abilities:{combat:5}, stamina:9, blessings:['poison'] });
    ok('§123 migrate: stored "poison" canonicalises to one blessing', migdp.blessings.length === 1 && migdp.blessings[0] === 'disease');
    const migdp2 = sanitizeData({ abilities:{combat:5}, stamina:9, blessings:['disease','poison'] });
    ok('§123 migrate: both spellings collapse to a single blessing', migdp2.blessings.length === 1 && migdp2.blessings[0] === 'disease');
    // §5.365's chapel menu offers storm/disease/injury — still three DISTINCT blessings
    // (the alias must merge only poison↔disease, not fold in the menu's other options).
    const gch = GameState.create({ name:'CH', gender:'m', profession:'Warrior', book:5, adv });
    gch.data.blessings = []; gch.data.permanentBlessings = [];
    gch.addBlessing('storm'); gch.addBlessing('disease'); gch.addBlessing('injury');
    ok('§5.365 storm/disease/injury remain three distinct blessings', gch.data.blessings.length === 3);

    // --- task 74: standalone force="f" effects are opt-in, not auto-applied ----------
    // book1/25: an optional mission codeword is a button; NOT recorded on entry.
    const g25 = GameState.create({ name:'M25', gender:'m', profession:'Warrior', book:1, adv });
    const c25 = document.createElement('div');
    new Story(c25, g25, { navigate(){}, onDeath(){}, notify(){} }).begin(await data.getSection(1, '25'), 1, '25');
    ok('§1.25 the mission codeword is NOT recorded on entry', !g25.hasCodeword('Ambuscade'));
    const amb25 = Array.from(c25.querySelectorAll('button')).find((b) => /Ambuscade/.test(b.textContent));
    ok('§1.25 shows an opt-in button to accept the mission', !!amb25 && !amb25.disabled);
    amb25.click();
    ok('§1.25 accepting the mission records the codeword', g25.hasCodeword('Ambuscade'));

    // book1/636: an optional Tyrnai initiation is a button; the god is NOT auto-joined.
    const g636 = GameState.create({ name:'T636', gender:'m', profession:'Warrior', book:1, adv });
    const c636 = document.createElement('div');
    new Story(c636, g636, { navigate(){}, onDeath(){}, notify(){} }).begin(await data.getSection(1, '636'), 1, '636');
    ok('§1.636 does NOT auto-initiate Tyrnai on entry', !g636.hasGod('Tyrnai'));
    const tyr636 = Array.from(c636.querySelectorAll('button')).find((b) => /Tyrnai/.test(b.textContent));
    ok('§1.636 shows an opt-in Tyrnai initiation button', !!tyr636 && !tyr636.disabled);
    tyr636.click();
    ok('§1.636 choosing to initiate joins Tyrnai', g636.hasGod('Tyrnai'));

    // book6/163: an optional item surrender is a button; the katana is NOT auto-removed.
    const g163 = GameState.create({ name:'K163', gender:'m', profession:'Warrior', book:6, adv });
    g163.addItem(makeItem('item', 'ivory-handled katana'));
    const c163 = document.createElement('div');
    new Story(c163, g163, { navigate(){}, onDeath(){}, notify(){} }).begin(await data.getSection(6, '163'), 6, '163');
    ok('§6.163 does NOT auto-surrender the katana on entry', g163.hasItemMatch('ivory-handled katana'));
    const kat163 = Array.from(c163.querySelectorAll('button')).find((b) => /Cross it off/i.test(b.textContent));
    ok('§6.163 shows an opt-in surrender button', !!kat163 && !kat163.disabled);
    kat163.click();
    ok('§6.163 surrendering removes the katana', !g163.hasItemMatch('ivory-handled katana'));

    // book6/160: two protections, choose ONE — neither auto-removed; taking one locks the other.
    const g160 = GameState.create({ name:'P160', gender:'m', profession:'Warrior', book:6, adv });
    g160.addBlessing('storm'); g160.addItem(makeItem('item', 'catastrophe certificate'));
    const c160 = document.createElement('div');
    new Story(c160, g160, { navigate(){}, onDeath(){}, notify(){} }).begin(await data.getSection(6, '160'), 6, '160');
    ok('§6.160 removes neither protection on entry', g160.hasBlessing('storm') && g160.hasItemMatch('catastrophe certificate'));
    const storm160 = Array.from(c160.querySelectorAll('button')).find((b) => /Safety from Storms/.test(b.textContent));
    const cert160 = Array.from(c160.querySelectorAll('button')).find((b) => /certificate/i.test(b.textContent));
    ok('§6.160 shows both cross-off buttons enabled', !!storm160 && !!cert160 && !storm160.disabled && !cert160.disabled);
    storm160.click();
    ok('§6.160 crossing off Safety from Storms keeps the certificate', !g160.hasBlessing('storm') && g160.hasItemMatch('catastrophe certificate'));
    const cert160b = Array.from(c160.querySelectorAll('button')).find((b) => /certificate/i.test(b.textContent));
    ok('§6.160 the other protection is now locked (choose one)', !!cert160b && cert160b.disabled);

    // book3/405: a successful CHARISMA roll reveals twelve dock choices; NONE auto-apply
    // (the old bug always ended at Yellowport). Picking one docks there and locks the rest.
    // The real §405 state: Targdaz flew you home MID-VOYAGE, so the ship is at large
    // and still marked as the vessel being sailed (task 89's current-vessel rule).
    const g405 = GameState.create({ name:'D405', gender:'m', profession:'Warrior', book:3, adv });
    g405.data.abilities.charisma = 12;
    const sh405 = g405.addShip({ type: 'barque', docked: null, crew: 'average', cargo: [] });
    g405.sailShip(sh405.id);
    const c405 = document.createElement('div');
    new Story(c405, g405, { navigate(){}, onDeath(){}, notify(){} }).begin(await data.getSection(3, '405'), 3, '405');
    const rnd405 = Math.random; Math.random = () => 0.99; // 6+6=12, +CHA 12 = 24 > 13 → success
    c405.querySelector('.btn-roll').click(); await settle42();
    Math.random = rnd405;
    ok('§3.405 a successful roll does NOT auto-dock the ship (was: Yellowport)', g405.ships[0].docked === null, `docked=${g405.ships[0].docked}`);
    const aku405 = Array.from(c405.querySelectorAll('button')).find((b) => b.textContent.trim() === 'Aku');
    ok('§3.405 reveals the dock choices as buttons', !!aku405);
    aku405.click();
    ok('§3.405 picking a dock docks the ship there (Aku, not Yellowport)', g405.ships[0].docked === 'Aku', `docked=${g405.ships[0].docked}`);
    const yellow405 = Array.from(c405.querySelectorAll('button')).find((b) => b.textContent.trim() === 'Yellowport');
    ok('§3.405 the other docks lock after choosing (choose one)', !!yellow405 && yellow405.disabled);

    // --- task 73: ship dock / current-vessel location model ---------------------------
    const gs73 = GameState.create({ name:'S73', gender:'m', profession:'Warrior', book:3, adv });
    const sh73 = gs73.addShip({ type:'barque', crew:'average', cargo:[] }); // docked defaults to at large
    ok('§73 a new ship starts at large (docked null) with an id', sh73.docked === null && !!sh73.id);
    gs73.arriveAtDock('Smogmaw');
    ok('§73 arriving at a dock berths the at-large ship + records the location', sh73.docked === 'Smogmaw' && gs73.data.location === 'Smogmaw');
    ok('§73 the ship is now "here" and is the current ship', gs73.shipsHere().length === 1 && gs73.currentShip() === sh73);
    ok('§73 <if docked> follows the actual berth', gs73.shipDockedAt('Smogmaw') && !gs73.shipDockedAt('Kunrir'));
    gs73.arriveAtDock(null); // walk inland (a section with no dock=)
    ok('§73 inland clears the location but the ship stays berthed', gs73.data.location === null && sh73.docked === 'Smogmaw');
    ok('§73 inland: the Smogmaw ship is NOT here (cannot sail from inland)', gs73.shipsHere().length === 0);
    gs73.arriveAtDock('Smogmaw'); gs73.sailShip(sh73.id);
    ok('§73 sailing sets the ship at large', sh73.docked === null);
    gs73.arriveAtDock('Kunrir');
    ok('§73 arriving at Kunrir re-docks the sailed ship there', sh73.docked === 'Kunrir');

    // Two ships at different docks: only the local one is here/current, and transactions
    // route through it, not ships[0].
    const g2s = GameState.create({ name:'S2', gender:'m', profession:'Warrior', book:3, adv });
    const shA = g2s.addShip({ type:'barque', crew:'poor', cargo:[], docked:'Smogmaw' });
    const shB = g2s.addShip({ type:'galleon', crew:'good', cargo:[], docked:'Kunrir' });
    g2s.arriveAtDock('Kunrir');
    ok('§73 with two ships, only the Kunrir ship is here/current', g2s.shipsHere().length === 1 && g2s.currentShip() === shB);
    eng.applyEffect(parse('<tick cargo="silk"/>'), g2s, {});
    ok('§73 cargo loads onto the local (Kunrir) ship, not ships[0]', shB.cargo.includes('silk') && !shA.cargo.includes('silk'));

    // Buying a ship at a dock berths it at that port (feeds <if docked=…>).
    const g3s = GameState.create({ name:'S3', gender:'m', profession:'Warrior', book:3, adv });
    g3s.data.shards = 5000; g3s.arriveAtDock('Smogmaw');
    applyInlineBuy(g3s, { ship:'barque', price:0 });
    ok('§73 a ship bought at Smogmaw is berthed there', g3s.ships[0].docked === 'Smogmaw' && g3s.shipDockedAt('Smogmaw'));

    // Migration: location round-trips; a ship without an id gains one.
    const mig73 = sanitizeData({ abilities:{combat:5}, stamina:9, location:'Aku', ships:[{ type:'barque', docked:'Aku' }] });
    ok('§73 migrate: location round-trips + the ship gains an id', mig73.location === 'Aku' && !!mig73.ships[0].id && mig73.ships[0].docked === 'Aku');

    // DOM: book3/53 <if docked="Smogmaw"> routes on the actual berth.
    const activeGoto = (root, num) => Array.from(root.querySelectorAll('.goto')).some((g) => new RegExp('\\b' + num + '\\b').test(g.textContent) && !g.disabled && !g.closest('.cond-inactive'));
    const g53t = GameState.create({ name:'D53', gender:'m', profession:'Warrior', book:3, adv });
    g53t.addShip({ type:'barque', crew:'average', cargo:[], docked:'Smogmaw' });
    const c53t = document.createElement('div');
    new Story(c53t, g53t, { navigate(){}, onDeath(){}, notify(){} }).begin(await data.getSection(3, '53'), 3, '53');
    ok('§3.53 a ship docked at Smogmaw activates the →92 branch', activeGoto(c53t, 92) && !activeGoto(c53t, 73));
    const g53tb = GameState.create({ name:'D53b', gender:'m', profession:'Warrior', book:3, adv });
    const c53tb = document.createElement('div');
    new Story(c53tb, g53tb, { navigate(){}, onDeath(){}, notify(){} }).begin(await data.getSection(3, '53'), 3, '53');
    ok('§3.53 without a Smogmaw ship, the →73 branch is active (→92 inactive)', activeGoto(c53tb, 73) && !activeGoto(c53tb, 92));

    // DOM: entering a dock section (§5.145, dock=Kunrir) sets the location; a ship left
    // elsewhere is not here, so its sail goto stays disabled.
    const gKun = GameState.create({ name:'KUN', gender:'m', profession:'Warrior', book:5, adv });
    gKun.addShip({ type:'barque', crew:'average', cargo:[], docked:'Kunrir' });
    new Story(document.createElement('div'), gKun, { navigate(){}, onDeath(){}, notify(){} }).begin(await data.getSection(5, '145'), 5, '145');
    ok('§5.145 begin sets location=Kunrir; the Kunrir ship is here', gKun.data.location === 'Kunrir' && gKun.shipsHere().length === 1);
    const gElse = GameState.create({ name:'ELS', gender:'m', profession:'Warrior', book:5, adv });
    gElse.addShip({ type:'barque', crew:'average', cargo:[], docked:'Smogmaw' });
    new Story(document.createElement('div'), gElse, { navigate(){}, onDeath(){}, notify(){} }).begin(await data.getSection(5, '145'), 5, '145');
    ok('§5.145 a ship left at Smogmaw is NOT here at Kunrir (cannot sail)', gElse.data.location === 'Kunrir' && gElse.shipsHere().length === 0);

    // DOM: a sail goto sails the (single) ship — sets it at large — then navigates.
    const secSail = '<section name="TSAIL" dock="Kunrir"><p><goto section="10" sail="t">set sail</goto></p></section>';
    const gSail = GameState.create({ name:'SAIL', gender:'m', profession:'Warrior', book:5, adv });
    const shSail = gSail.addShip({ type:'barque', crew:'average', cargo:[], docked:null });
    let navSail = null;
    const cSail = document.createElement('div');
    new Story(cSail, gSail, { navigate(bk, sec){ navSail = { bk, sec }; }, onDeath(){}, notify(){} }).begin(parse(secSail), 5, 'TSAIL');
    ok('§TSAIL entering the dock berths the at-large ship at Kunrir', shSail.docked === 'Kunrir');
    const sailBtn = Array.from(cSail.querySelectorAll('.goto')).find((g) => /set sail/.test(g.textContent));
    ok('§TSAIL the sail goto is enabled (a ship is here)', !!sailBtn && !sailBtn.disabled);
    sailBtn.click();
    ok('§TSAIL sailing sets the ship at large and navigates', shSail.docked === null && navSail && String(navSail.sec) === '10');

    // DOM: two ships at the same dock — sailing prompts a choice; picking sails exactly one.
    const gMulti = GameState.create({ name:'MULTI', gender:'m', profession:'Warrior', book:5, adv });
    const m1 = gMulti.addShip({ type:'barque', name:'Gull', crew:'average', cargo:[], docked:'Kunrir' });
    const m2 = gMulti.addShip({ type:'galleon', name:'Kraken', crew:'good', cargo:[], docked:'Kunrir' });
    let navM = null;
    const cMulti = document.createElement('div');
    new Story(cMulti, gMulti, { navigate(bk, sec){ navM = { bk, sec }; }, onDeath(){}, notify(){} }).begin(parse(secSail), 5, 'TSAIL');
    ok('§TSAIL two ships are both here at Kunrir', gMulti.shipsHere().length === 2);
    Array.from(cMulti.querySelectorAll('.goto')).find((g) => /set sail/.test(g.textContent)).click();
    ok('§TSAIL sailing with two ships prompts a choice (no navigation yet)', navM === null && !!cMulti.querySelector('.ship-choice'));
    Array.from(cMulti.querySelectorAll('.ship-choice button')).find((b) => /Kraken/.test(b.textContent)).click();
    ok('§TSAIL choosing sails exactly that ship and navigates', m2.docked === null && m1.docked === 'Kunrir' && navM && String(navM.sec) === '10');

}

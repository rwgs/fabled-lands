// FL test suite — engine / state / effects / conditions / caches / transfer / dice
// Extracted verbatim from web/_test.html run() lines 39-513 (task 120).
import * as data from '../js/data.js';
import { GameState, readSlotData, importSave, loadSlotMeta, deleteSlot, makeItem, nextFreeSlot, sanitizeData, currencyAward, splitItemName } from '../js/state.js';
import * as eng from '../js/engine.js';
import { fightRound, makeFight, groupFightRound, isDefeated, useWrathBlessing, useDefenceBlessing, rerollAttack } from '../js/combat.js';
import { goodsFrom, buyTrade, sellTrade, applyInlineBuy, sellInlineItem, sellCargo, canUpgradeCrew, payChoiceCost } from '../js/market.js';
import { Story, previewProse } from '../js/render.js';
import { Narrator } from '../js/tts.js';
import { renderSheet } from '../js/ui.js';
import { renderStatic } from '../js/app.js';

export async function run(ctx) {
  const { ok, parse } = ctx;
    await data.loadMeta();
    ok('meta books=6', data.availableBooks().length === 6);

    // adventurers
    const adv = data.parseAdventurers(data.bookInfo(1).adventurers);
    ok('warrior combat=6', adv.professions.Warrior.combat === 6, JSON.stringify(adv.professions.Warrior));
    ok('start stamina=9', adv.stamina === 9);
    ok('start gold=16', adv.gold === 16);

    // create character
    const gs = GameState.create({ name:'Test', gender:'m', profession:'Warrior', book:1, adv });
    ok('combat ability=6', gs.ability('combat') === 6, String(gs.ability('combat')));
    ok('has armour+weapon+map', gs.itemCount() >= 3, 'items='+gs.itemCount());
    ok('armour bonus=1', gs.armourBonus() === 1);
    ok('defence=8 (6+1+1)', gs.defence() === 8, String(gs.defence()));

    // conditions
    gs.addCodeword('Assassin');
    ok('if codeword true', eng.evaluateCondition(parse('<if codeword="Assassin"/>'), gs));
    ok('if not codeword false', eng.evaluateCondition(parse('<if not="t" codeword="Assassin"/>'), gs) === false);
    ok('if missing codeword false', eng.evaluateCondition(parse('<if codeword="Nope"/>'), gs) === false);
    ok('if shards>=10 true', eng.evaluateCondition(parse('<if shards="10"/>'), gs));
    ok('if shards>=999 false', eng.evaluateCondition(parse('<if shards="999"/>'), gs) === false);
    ok('if profession warrior', eng.evaluateCondition(parse('<if profession="Warrior"/>'), gs));
    gs.setVar('x', 5);
    ok('if var equals', eng.evaluateCondition(parse('<if var="x" equals="5"/>'), gs));
    ok('if var greaterthan', eng.evaluateCondition(parse('<if var="x" greaterthan="4"/>'), gs));
    ok('if var lessthan false', eng.evaluateCondition(parse('<if var="x" lessthan="3"/>'), gs) === false);

    // multi-attribute <if>: recognized attributes combine as OR (JaFL
    // IfNode.meetsConditions), then not="t" negates the whole result. (task 3)
    const gcond = GameState.create({ name:'C', gender:'m', profession:'Mage', book:1, adv });
    gcond.data.items = []; gcond.addItem(makeItem('item', 'lantern'));
    gcond.addTitle('Arena Champion');   // has the title, NOT the codeword Dove
    ok('if codeword|title OR: title-only true', eng.evaluateCondition(parse('<if codeword="Dove" title="Arena Champion"/>'), gcond));
    gcond.addCodeword('Dove'); gcond.removeTitle('Arena Champion'); // has codeword, not title
    ok('if codeword|title OR: codeword-only true', eng.evaluateCondition(parse('<if codeword="Dove" title="Arena Champion"/>'), gcond));
    gcond.removeCodeword('Dove');       // has neither
    ok('if codeword|title OR: neither false', eng.evaluateCondition(parse('<if codeword="Dove" title="Arena Champion"/>'), gcond) === false);
    // item + profession OR (book1/460 shape): Mage without the item still matches
    ok('if item|profession OR: profession matches w/o item', eng.evaluateCondition(parse('<if item="torch" profession="Mage"/>'), gcond));
    ok('if item|profession OR: item matches w/o profession', eng.evaluateCondition(parse('<if item="lantern" profession="Warrior"/>'), gcond));
    ok('if item|profession OR: neither matches false', eng.evaluateCondition(parse('<if item="torch" profession="Warrior"/>'), gcond) === false);
    // not applies to the whole OR, not just the first attribute
    ok('not over OR: neither ⇒ true', eng.evaluateCondition(parse('<if not="t" item="torch" profession="Warrior"/>'), gcond));
    ok('not over OR: one present ⇒ false', eng.evaluateCondition(parse('<if not="t" item="lantern" profession="Warrior"/>'), gcond) === false);

    // task 128: ability=/bonus= alongside an equipment selector describe the ITEM sought,
    // not a standalone always-true disjunct. §5.680's ring-forging branch must gate on
    // actually holding the MAGIC+6 hyperium wand.
    const wandIf = '<if tool="hyperium wand" ability="magic" bonus="6"/>';
    const g680n = GameState.create({ name:'W0', gender:'m', profession:'Warrior', book:5, adv });
    ok('task128: §680 wand branch FALSE with no wand (no free ring)', eng.evaluateCondition(parse(wandIf), g680n) === false);
    const g680p = GameState.create({ name:'Wp', gender:'m', profession:'Warrior', book:5, adv });
    g680p.addItem(makeItem('tool', 'hyperium wand', 0, 'magic')); // a plain +0 wand, not the relic
    ok('task128: §680 wand branch FALSE with a plain (+0) hyperium wand', eng.evaluateCondition(parse(wandIf), g680p) === false);
    const g680w = GameState.create({ name:'Ww', gender:'m', profession:'Warrior', book:5, adv });
    g680w.addItem(makeItem('tool', 'hyperium wand', 6, 'magic')); // the real MAGIC+6 wand
    ok('task128: §680 wand branch TRUE only with the MAGIC+6 hyperium wand', eng.evaluateCondition(parse(wandIf), g680w) === true);
    // a no-comparator standalone ability= never matches; comparator forms still do (task 68)
    ok('task128: bare <if ability="magic"> never matches (no comparator)', eng.evaluateCondition(parse('<if ability="magic"/>'), g680n) === false);
    const rk680 = g680n.rankValue();
    ok('task128: comparator ability forms still compare (regression)', eng.evaluateCondition(parse(`<if ability="rank" greaterthan="${rk680 - 1}"/>`), g680n) === true && eng.evaluateCondition(parse(`<if ability="rank" greaterthan="${rk680}"/>`), g680n) === false);
    // rendered §680: no wand grays the §564 ring path but keeps the "If not" §245 exit live
    const c680 = document.createElement('div');
    new Story(c680, g680n, { navigate(){}, onDeath(){}, notify(){} }).begin(await data.getSection(5, '680'), 5, '680');
    const goto680 = (n) => Array.from(c680.querySelectorAll('button.goto')).find((b) => b.textContent.trim() === n);
    ok('task128: §680 with no wand disables the §564 ring path, keeps §245 live', !!goto680('564') && goto680('564').disabled && !!goto680('245') && !goto680('245').disabled, `564d=${goto680('564') && goto680('564').disabled} 245d=${goto680('245') && goto680('245').disabled}`);
    const c680w = document.createElement('div');
    new Story(c680w, g680w, { navigate(){}, onDeath(){}, notify(){} }).begin(await data.getSection(5, '680'), 5, '680');
    const goto680w = Array.from(c680w.querySelectorAll('button.goto')).find((b) => b.textContent.trim() === '564');
    ok('task128: §680 with the MAGIC+6 wand opens the §564 ring path', !!goto680w && !goto680w.disabled);

    // effects
    const before = gs.data.shards;
    eng.applyEffect(parse('<lose shards="10"/>'), gs, {});
    ok('lose 10 shards', gs.data.shards === before - 10, String(gs.data.shards));
    eng.applyEffect(parse('<gain shards="5"/>'), gs, {});
    ok('gain 5 shards', gs.data.shards === before - 5);
    eng.applyEffect(parse('<tick codeword="Foo"/>'), gs, {});
    ok('tick codeword', gs.hasCodeword('Foo'));
    // task 52: <lose codeword> zeroes the codeword's counter value too (JaFL: a
    // codeword and its value are one entry) — the bonus-counter reset idiom.
    gs.addCodeword('CharismaBonus'); gs.adjustCodewordValue('CharismaBonus', 3);
    ok('codeword value accumulates', gs.codewordValue('CharismaBonus') === 3);
    eng.applyEffect(parse('<lose codeword="CharismaBonus"/>'), gs, {});
    ok('losing a codeword also resets its counter value to 0', !gs.hasCodeword('CharismaBonus') && gs.codewordValue('CharismaBonus') === 0, `has=${gs.hasCodeword('CharismaBonus')} val=${gs.codewordValue('CharismaBonus')}`);
    const cs = gs.ability('combat');
    eng.applyEffect(parse('<lose ability="combat" amount="1"/>'), gs, {});
    ok('lose 1 combat', gs.abilityNatural('combat') === 6-1, String(gs.abilityNatural('combat')));
    const st = gs.data.stamina;
    eng.applyEffect(parse('<lose stamina="3"/>'), gs, {});
    ok('lose 3 stamina', gs.data.stamina === st-3);
    // task 71: <lose staminato="N"> ("beaten down to N") carries no stamina= attr
    gs.data.staminaMax = 20; gs.data.stamina = 15;
    eng.applyEffect(parse('<lose staminato="1"/>'), gs, {});
    ok('lose staminato="1" beats you down to 1 Stamina', gs.data.stamina === 1, `stam=${gs.data.stamina}`);

    // --- ability effects: rank/stamina/*/?/fatal/effect= (task 15) ---
    const ga = GameState.create({ name:'A', gender:'m', profession:'Warrior', book:1, adv });
    ga.data.section = '999';
    const rank0 = ga.data.rank, box0 = ga.tickCount(1,'999');
    eng.applyEffect(parse('<gain ability="rank" amount="1"/>'), ga, {});
    ok('gain ability=rank raises Rank', ga.data.rank === rank0 + 1, `rank=${ga.data.rank}`);
    ok('gain ability=rank does NOT tick the visit box', ga.tickCount(1,'999') === box0, `box=${ga.tickCount(1,'999')}`);
    // a genuinely bare <tick/> still ticks the box
    ga.data.section = '998';
    eng.applyEffect(parse('<tick/>'), ga, {});
    ok('bare <tick/> still ticks the box', ga.tickCount(1,'998') === 1);

    // ability=stamina is a PERMANENT change (max + current move together)
    const gm2 = GameState.create({ name:'S2', gender:'m', profession:'Warrior', book:1, adv });
    const max0 = gm2.data.staminaMax, cur0 = gm2.data.stamina;
    eng.applyEffect(parse('<gain ability="stamina" amount="3"/>'), gm2, {});
    ok('gain ability=stamina raises max+current', gm2.data.staminaMax === max0+3 && gm2.data.stamina === cur0+3, `max=${gm2.data.staminaMax} cur=${gm2.data.stamina}`);
    gm2.data.stamina = 2;
    eng.applyEffect(parse('<lose ability="stamina" amount="5"/>'), gm2, {});
    ok('lose ability=stamina non-fatal floors current at 1', gm2.data.stamina === 1 && gm2.isDead() === false, `st=${gm2.data.stamina}`);
    // fatal stamina loss to <=0 kills
    const gf = GameState.create({ name:'F', gender:'m', profession:'Warrior', book:1, adv });
    gf.data.stamina = 3;
    eng.applyEffect(parse('<lose ability="stamina" amount="10" fatal="t"/>'), gf, {});
    ok('fatal stamina loss to <=0 kills', gf.isDead() === true && gf.data.stamina === 0, `st=${gf.data.stamina}`);

    // ability="*" affects all six; fatal core-ability loss to 0 kills
    const gall = GameState.create({ name:'X', gender:'m', profession:'Warrior', book:1, adv });
    const c0 = gall.abilityNatural('combat'), t0 = gall.abilityNatural('thievery');
    eng.applyEffect(parse('<gain ability="*" amount="1"/>'), gall, {});
    ok('gain ability=* raises all abilities', gall.abilityNatural('combat')===c0+1 && gall.abilityNatural('thievery')===t0+1);
    const gfc = GameState.create({ name:'FC', gender:'m', profession:'Warrior', book:1, adv });
    gfc.data.abilities.thievery = 1;
    eng.applyEffect(parse('<lose ability="thievery" amount="1" fatal="t"/>'), gfc, {});
    ok('fatal ability loss to 0 kills (ability clamps to 1)', gfc.isDead() === true && gfc.abilityNatural('thievery') === 1);

    // ability="?" uses the provided chooser
    const gq = GameState.create({ name:'Q', gender:'m', profession:'Warrior', book:1, adv });
    gq.data.abilities.magic = 5;
    eng.applyEffect(parse('<lose ability="?" amount="1"/>'), gq, { chooser: () => ['magic'] });
    ok('lose ability="?" applies to the chosen ability', gq.abilityNatural('magic') === 4, `magic=${gq.abilityNatural('magic')}`);

    // effect="+fixed"/"+cursed" flag forms (display score unchanged; checks bite)
    const gfx = GameState.create({ name:'FX', gender:'m', profession:'Warrior', book:1, adv });
    gfx.data.abilities.charisma = 8;
    eng.applyEffect(parse('<tick ability="charisma" effect="+fixed"/>'), gfx, {});
    ok('effect="+fixed" pins check-value at 1, keeps display score', gfx.abilityForCheck('charisma') === 1 && gfx.ability('charisma') === 8);
    const mask = gfx.addItem(makeItem('item', 'courtier’s mask'));
    ok('a mask restores fixed CHARISMA in checks', gfx.abilityForCheck('charisma') === 8);
    gfx.removeItemById(mask.id);
    eng.applyEffect(parse('<tick ability="charisma" effect="-fixed"/>'), gfx, {});
    ok('effect="-fixed" clears the flag', gfx.abilityForCheck('charisma') === 8);
    const gcz = GameState.create({ name:'CZ', gender:'m', profession:'Warrior', book:1, adv });
    eng.applyEffect(parse('<tick ability="charisma" effect="+cursed"/>'), gcz, {});
    let cursedWin = 0; for (let i=0;i<60;i++){ if (eng.rollDifficulty(gcz,'charisma',6,0).success) cursedWin++; }
    ok('effect="+cursed" auto-fails CHARISMA checks', gcz.abilityForCheck('charisma') < 0 && cursedWin === 0, `win=${cursedWin}`);

    // --- wildcard / choice losses actually take things (task 16) ---
    const gw = GameState.create({ name:'W', gender:'m', profession:'Warrior', book:1, adv });
    gw.data.shards = 250;
    eng.applyEffect(parse('<lose shards="*"/>'), gw, {});
    ok('lose shards="*" empties the purse', gw.data.shards === 0);
    // lose all possessions, but a "keep"-tagged item survives
    const gp = GameState.create({ name:'P', gender:'m', profession:'Warrior', book:1, adv });
    gp.data.items = []; gp.addItem(makeItem('item','rope')); gp.addItem(makeItem('item','heirloom',0,null,['keep']));
    eng.applyEffect(parse('<lose item="*"/>'), gp, {});
    ok('lose item="*" removes all non-keep possessions', gp.itemCount() === 1 && gp.findItems('heirloom').length === 1, 'items='+gp.itemCount());
    // blessings: lose one (chosen), then lose all
    const gbl = GameState.create({ name:'BL', gender:'m', profession:'Warrior', book:1, adv });
    gbl.addBlessing('combat'); gbl.addBlessing('luck');
    eng.applyEffect(parse('<lose blessing="?"/>'), gbl, { chooser: () => ['luck'] });
    ok('lose blessing="?" removes the chosen blessing', !gbl.hasBlessing('luck') && gbl.hasBlessing('combat'));
    eng.applyEffect(parse('<lose blessing="*"/>'), gbl, {});
    ok('lose blessing="*" removes every blessing', gbl.data.blessings.length === 0);
    // task 132: "?"/"*" are match-any wildcards — any blessing satisfies <if blessing="?">
    ok('hasBlessing("?")/"*" false with no blessing', gbl.hasBlessing('?') === false && gbl.hasBlessing('*') === false);
    ok('<if blessing="?"> false with no blessing', eng.evaluateCondition(parse('<if blessing="?"/>'), gbl) === false);
    gbl.addBlessing('injury');
    ok('hasBlessing("?")/"*" true once any blessing is held', gbl.hasBlessing('?') === true && gbl.hasBlessing('*') === true);
    ok('<if blessing="?"> true once any blessing is held', eng.evaluateCondition(parse('<if blessing="?"/>'), gbl) === true);
    // §5.365 chapel: "he can bestow only one blessing at a time". Blessed → the choose-
    // one menu is blocked; unblessed → storm/disease/injury are live pick buttons.
    {
      const s365 = await data.getSection(5,'365');
      const gBlessed = GameState.create({ name:'C365b', gender:'m', profession:'Warrior', book:5, adv });
      gBlessed.addBlessing('storm');
      const cB = document.createElement('div');
      new Story(cB, gBlessed, { navigate(){}, onDeath(){}, notify(){} }).begin(s365,5,'365');
      const liveB = Array.from(cB.querySelectorAll('.reward-pick')).filter((b)=>!b.disabled);
      ok('§5.365 blessed: the choose-one menu is blocked (no live pick)', liveB.length === 0, `live=${liveB.length}`);

      const gFree = GameState.create({ name:'C365f', gender:'m', profession:'Warrior', book:5, adv });
      const cF = document.createElement('div');
      new Story(cF, gFree, { navigate(){}, onDeath(){}, notify(){} }).begin(s365,5,'365');
      const liveF = Array.from(cF.querySelectorAll('.reward-pick')).filter((b)=>!b.disabled);
      ok('§5.365 unblessed: three blessing picks are live', liveF.length === 3, `live=${liveF.length}`);
      liveF[0].click();
      ok('§5.365 unblessed: picking one grants exactly one blessing', gFree.data.blessings.length === 1, JSON.stringify(gFree.data.blessings));
    }
    // equipment confiscation via using="t"
    const ge2 = GameState.create({ name:'E', gender:'m', profession:'Warrior', book:1, adv });
    const hadWeapon = !!ge2.wieldedWeapon();
    eng.applyEffect(parse('<lose weapon="?" using="t"/>'), ge2, {});
    ok('lose weapon using="t" takes the wielded weapon', hadWeapon && !ge2.wieldedWeapon());
    const hadArmour = !!ge2.wornArmour();
    eng.applyEffect(parse('<lose armour="?" using="t"/>'), ge2, {});
    ok('lose armour using="t" takes the worn armour', hadArmour && !ge2.wornArmour());
    // lose every weapon
    const ge3 = GameState.create({ name:'E3', gender:'m', profession:'Warrior', book:1, adv });
    ge3.addItem(makeItem('weapon','dagger',1));
    eng.applyEffect(parse('<lose weapon="*"/>'), ge3, {});
    ok('lose weapon="*" removes every weapon', ge3.data.items.filter((i)=>i.kind==='weapon').length === 0);
    // resurrection + curse wildcards
    const gres = GameState.create({ name:'RS', gender:'m', profession:'Warrior', book:1, adv });
    gres.addResurrection({book:1,section:'5'}); gres.addResurrection({book:2,section:'9'});
    eng.applyEffect(parse('<lose resurrection="t"/>'), gres, {});
    ok('lose resurrection="t" clears all arrangements', gres.data.resurrections.length === 0);
    const gcu = GameState.create({ name:'CU', gender:'m', profession:'Warrior', book:1, adv });
    gcu.addCurse({type:'a'}); gcu.addCurse({type:'b'});
    eng.applyEffect(parse('<lose curse="*"/>'), gcu, {});
    ok('lose curse="*" lifts all curses', gcu.data.curses.length === 0);
    // cargo="?" removes one unit (was a no-op via indexOf('?'))
    const gca = GameState.create({ name:'CA', gender:'m', profession:'Warrior', book:1, adv });
    gca.addShip({type:'barque', crew:'average', cargo:['spices','silk'], docked:null});
    eng.applyEffect(parse('<lose cargo="?"/>'), gca, {});
    ok('lose cargo="?" removes one cargo unit', gca.ships[0].cargo.length === 1, 'cargo='+JSON.stringify(gca.ships[0].cargo));

    // --- task 17: weapon/armour/tool, docked-location, natural, empty-god, unknown ---
    const g17 = GameState.create({ name:'G17', gender:'m', profession:'Warrior', book:1, adv });
    ok('if weapon="?" true when armed', eng.evaluateCondition(parse('<if weapon="?"/>'), g17));
    ok('if not weapon="?" false when armed', eng.evaluateCondition(parse('<if not="t" weapon="?"/>'), g17) === false);
    g17.data.items = g17.data.items.filter((i) => i.kind !== 'weapon'); g17.reconcileEquipment();
    ok('if weapon="?" false when unarmed (book2/90 shape)', eng.evaluateCondition(parse('<if weapon="?"/>'), g17) === false);
    ok('if not="t" weapon="?" true when unarmed', eng.evaluateCondition(parse('<if not="t" weapon="?"/>'), g17));
    // weapon-type glob against the wielded weapon
    const g17b = GameState.create({ name:'G17b', gender:'m', profession:'Warrior', book:1, adv });
    g17b.data.items = g17b.data.items.filter((i) => i.kind !== 'weapon');
    g17b.addItem(makeItem('weapon','iron sword',2));
    ok('if weapon="*sword*" using="t" matches a wielded sword', eng.evaluateCondition(parse('<if weapon="*sword*" using="t"/>'), g17b));
    ok('if weapon="*axe*" using="t" does not match a sword', eng.evaluateCondition(parse('<if weapon="*axe*" using="t"/>'), g17b) === false);
    // docked-at-location (was "any ship anywhere")
    const g17c = GameState.create({ name:'G17c', gender:'m', profession:'Warrior', book:1, adv });
    g17c.addShip({type:'barque', crew:'average', cargo:[], docked:'Smogmaw'});
    ok('if docked="Smogmaw" true when berthed there', eng.evaluateCondition(parse('<if docked="Smogmaw"/>'), g17c));
    ok('if docked="Elsewhere" false', eng.evaluateCondition(parse('<if docked="Elsewhere"/>'), g17c) === false);
    // modifier="natural" ignores item bonuses (book2/554, book5/435)
    const g17d = GameState.create({ name:'G17d', gender:'m', profession:'Warrior', book:1, adv });
    g17d.data.abilities.magic = 3; g17d.addItem(makeItem('tool','wand',4,'magic'));
    ok('ability check uses the boosted score by default', eng.evaluateCondition(parse('<if ability="magic" greaterthan="5"/>'), g17d));
    ok('modifier="natural" compares the written score', eng.evaluateCondition(parse('<if ability="magic" modifier="natural" greaterthan="5"/>'), g17d) === false);
    ok('modifier="natural" lessthan uses the written score', eng.evaluateCondition(parse('<if ability="magic" modifier="natural" lessthan="4"/>'), g17d));
    // task 68: <if ability="rank|stamina"> must read the real stat, not fall to 0
    const g17rk = GameState.create({ name:'G17rk', gender:'m', profession:'Warrior', book:1, adv });
    g17rk.data.rank = 10;
    ok('§416 Rank gate opens at Rank 10 (greaterthan="3")', eng.evaluateCondition(parse('<if ability="rank" greaterthan="3"/>'), g17rk));
    ok('Rank gate greaterthan="10" false at Rank 10', eng.evaluateCondition(parse('<if ability="rank" greaterthan="10"/>'), g17rk) === false);
    ok('§b4/255 lessthan="4" false at Rank 10', eng.evaluateCondition(parse('<if ability="rank" lessthan="4"/>'), g17rk) === false);
    ok('rank equals="10" true', eng.evaluateCondition(parse('<if ability="rank" equals="10"/>'), g17rk));
    const g17rk2 = GameState.create({ name:'G17rk2', gender:'m', profession:'Warrior', book:1, adv });
    g17rk2.data.rank = 2;
    ok('Rank gate greaterthan="3" stays shut at Rank 2', eng.evaluateCondition(parse('<if ability="rank" greaterthan="3"/>'), g17rk2) === false);
    ok('§b4/255 lessthan="4" true at Rank 2', eng.evaluateCondition(parse('<if ability="rank" lessthan="4"/>'), g17rk2));
    ok('stamina condition reads current Stamina, not 0', eng.evaluateCondition(parse('<if ability="stamina" greaterthan="0"/>'), g17rk2));
    // god="" ("worships no god")
    const g17e = GameState.create({ name:'G17e', gender:'m', profession:'Warrior', book:1, adv });
    ok('if god="" true when worshipping no god', eng.evaluateCondition(parse('<if god=""/>'), g17e));
    g17e.setGod('Elnir');
    ok('if god="" false once worshipping a god', eng.evaluateCondition(parse('<if god=""/>'), g17e) === false);
    // unknown attribute no longer silently passes
    ok('unknown condition attr defaults to false', eng.evaluateCondition(parse('<if madeupattr="x"/>'), g17e) === false);
    ok('unknown condition attr with not defaults true', eng.evaluateCondition(parse('<if not="t" madeupattr="x"/>'), g17e));
    // disease/poison conditions recognised (populated in task 19)
    const g17f = GameState.create({ name:'G17f', gender:'m', profession:'Warrior', book:1, adv });
    ok('if disease="Ghoulbite" false when healthy', eng.evaluateCondition(parse('<if disease="Ghoulbite"/>'), g17f) === false);
    g17f.data.diseases.push({ name:'Ghoulbite', type:'disease' });
    ok('if disease="Ghoulbite" true once afflicted', eng.evaluateCondition(parse('<if disease="Ghoulbite"/>'), g17f));

    // --- task 18: item tags are preserved through awards/buys + tag conditions ---
    const g18 = GameState.create({ name:'G18', gender:'m', profession:'Warrior', book:1, adv });
    const c18 = document.createElement('div');
    const story18 = new Story(c18, g18, { navigate(){}, onDeath(){}, notify(){} });
    story18.begin(parse('<section name="t"><item name="lantern" tags="light"/></section>'), 1, 't');
    const takeBtn = c18.querySelector('.take-item');
    ok('tagged award shows a Take button', !!takeBtn);
    takeBtn.click();
    const lantern = g18.findItems('lantern')[0];
    ok('awarded item preserves its tags', !!lantern && (lantern.tags || []).includes('light'), JSON.stringify(lantern && lantern.tags));
    ok('if item="?" tags="light" true with a tagged lantern', eng.evaluateCondition(parse('<if item="?" tags="light"/>'), g18));
    ok('if item="?" tags="fire" false (no such tag)', eng.evaluateCondition(parse('<if item="?" tags="fire"/>'), g18) === false);
    // the book1/460 sewers gate: non-mage with a light source may proceed
    ok('§460 gate: light source lets a non-mage in', eng.evaluateCondition(parse('<if not="t" item="?" tags="light" profession="mage"/>'), g18) === false);
    // market purchase preserves tags (buytags/tags)
    const gmk = GameState.create({ name:'MK', gender:'m', profession:'Warrior', book:1, adv });
    gmk.data.shards = 100;
    buyTrade(gmk, goodsFrom(parse('<item name="candle" tags="light,useonce"/>'), 'item', 'candle', 0), 5);
    const candle = gmk.findItems('candle')[0];
    ok('bought item preserves its tags', !!candle && candle.tags.includes('light') && candle.tags.includes('useonce'), JSON.stringify(candle && candle.tags));

    // --- task 19: curse/disease/poison inflict → detect → penalty → cure ---
    const gt19 = GameState.create({ name:'T19', gender:'m', profession:'Warrior', book:1, adv });
    gt19.data.abilities.combat = 6; gt19.data.abilities.charisma = 5; gt19.data.abilities.scouting = 5;
    const combatBefore = gt19.ability('combat'), defBefore = gt19.defence();
    eng.applyEffect(parse('<curse name="Curse of Tambu"><effect ability="charisma" bonus="-1"/><effect ability="combat" bonus="-1"/><effect ability="scouting" bonus="-1"/></curse>'), gt19, {});
    ok('curse inflicted and detected by name', eng.evaluateCondition(parse('<if curse="Curse of Tambu"/>'), gt19));
    ok('curse applies its ability penalty', gt19.ability('combat') === combatBefore - 1, `combat=${gt19.ability('combat')}`);
    ok('curse penalty flows into Defence', gt19.defence() === defBefore - 1);
    eng.applyEffect(parse('<lose curse="Curse of Tambu"/>'), gt19, {});
    ok('lifting the curse restores the score', gt19.ability('combat') === combatBefore && gt19.defence() === defBefore && !gt19.hasCurse('Curse of Tambu'));

    // disease: inflict, non-cumulative re-infection, cure via <lose disease="*">
    const gd19 = GameState.create({ name:'D19', gender:'m', profession:'Warrior', book:1, adv });
    gd19.data.abilities.sanctity = 5; const sanct0 = gd19.ability('sanctity');
    eng.applyEffect(parse('<disease name="Ghoulbite"><effect ability="sanctity" bonus="-1"/></disease>'), gd19, {});
    ok('disease detected and penalised', gd19.hasDisease('Ghoulbite') && gd19.ability('sanctity') === sanct0 - 1);
    eng.applyEffect(parse('<disease name="Ghoulbite"><effect ability="sanctity" bonus="-1"/></disease>'), gd19, {});
    ok('non-cumulative re-infection does not stack', gd19.data.diseases.length === 1 && gd19.ability('sanctity') === sanct0 - 1);
    eng.applyEffect(parse('<lose disease="*"/>'), gd19, {});
    ok('<lose disease="*"> cures and restores', gd19.data.diseases.length === 0 && gd19.ability('sanctity') === sanct0);

    // poison: inflict + cure by name
    const gp19 = GameState.create({ name:'P19', gender:'m', profession:'Warrior', book:1, adv });
    gp19.data.abilities.thievery = 5; const thiev0 = gp19.ability('thievery');
    eng.applyEffect(parse('<poison name="Scorpion Poison"><effect ability="thievery" bonus="-1"/></poison>'), gp19, {});
    ok('poison detected and penalised', gp19.hasPoison('Scorpion Poison') && gp19.ability('thievery') === thiev0 - 1);
    eng.applyEffect(parse('<lose poison="Scorpion Poison"/>'), gp19, {});
    ok('poison cured by name restores', gp19.data.poisons.length === 0 && gp19.ability('thievery') === thiev0);

    // cumulative curse stacks its penalty
    const gc19 = GameState.create({ name:'C19', gender:'m', profession:'Warrior', book:1, adv });
    gc19.data.abilities.combat = 8; const cb0 = gc19.ability('combat');
    eng.applyEffect(parse('<curse name="Avenger\'s Bite" cumulative="t"><effect ability="combat" bonus="-1"/></curse>'), gc19, {});
    eng.applyEffect(parse('<curse name="Avenger\'s Bite" cumulative="t"><effect ability="combat" bonus="-1"/></curse>'), gc19, {});
    ok('cumulative curse stacks', gc19.data.curses.length === 2 && gc19.ability('combat') === cb0 - 2, `combat=${gc19.ability('combat')}`);

    // --- task 20: caches / banks / adjustmoney / transfer ---
    const g20 = GameState.create({ name:'C20', gender:'m', profession:'Warrior', book:2, adv });
    g20.data.shards = 300;
    g20.depositCacheMoney('2.49', 100);
    ok('deposit moves purse→cache', g20.data.shards === 200 && g20.cacheMoney('2.49') === 100, `sh=${g20.data.shards} cache=${g20.cacheMoney('2.49')}`);
    eng.applyEffect(parse('<adjustmoney name="2.49" multiply="1.5"/>'), g20, {});
    ok('adjustmoney multiply scales the named cache', g20.cacheMoney('2.49') === 150, `cache=${g20.cacheMoney('2.49')}`);
    eng.applyEffect(parse('<adjustmoney name="2.49" multiply="0"/>'), g20, {});
    ok('adjustmoney multiply=0 wipes the cache (lost investment)', g20.cacheMoney('2.49') === 0);
    // withdraw with a bank charge, rounded in the house's favour
    g20.adjustCacheMoney('MerchantBank', 50);
    const purse0 = g20.data.shards;
    g20.withdrawCacheMoney('MerchantBank', 50, 0.1); // 10% fee = 5 kept
    ok('withdraw charge deducts the fee', g20.data.shards === purse0 + 45 && g20.cacheMoney('MerchantBank') === 0, `sh=${g20.data.shards}`);
    // adjustmoney with no name halves the purse (floored)
    g20.data.shards = 51;
    eng.applyEffect(parse('<adjustmoney multiply="0.5">half of any money</adjustmoney>'), g20, {});
    ok('adjustmoney w/o name halves the purse, floored', g20.data.shards === 25, `sh=${g20.data.shards}`);
    // if cache= reads the stash, not the purse
    g20.adjustCacheMoney('MerchantBank', 150);
    ok('if cache shards condition reads the stash', eng.evaluateCondition(parse('<if cache="MerchantBank" shards="150"/>'), g20));
    ok('if cache shards below threshold false', eng.evaluateCondition(parse('<if cache="MerchantBank" shards="151"/>'), g20) === false);

    // the §4.468 corruption: <lose item="?" cache="X"> must hit the STASH, not carried items
    const g20b = GameState.create({ name:'C20b', gender:'m', profession:'Warrior', book:4, adv });
    const carried0 = g20b.itemCount();
    g20b.cacheAddItem('4.468', makeItem('item','stashed gem'));
    g20b.cacheAddItem('4.468', makeItem('item','stashed ring'));
    eng.applyEffect(parse('<lose item="?" cache="4.468">Lose one possession</lose>'), g20b, {});
    ok('lose item cache="X" takes from the stash, not the inventory', g20b.itemCount() === carried0 && g20b.cacheItems('4.468').length === 1, `carried=${g20b.itemCount()}/${carried0} stash=${g20b.cacheItems('4.468').length}`);
    g20b.adjustCacheMoney('4.468', 200);
    const purseB = g20b.data.shards;
    eng.applyEffect(parse('<lose shards="*" cache="4.468"/>'), g20b, {});
    ok('lose shards="*" cache empties only the stash', g20b.cacheMoney('4.468') === 0 && g20b.data.shards === purseB, `stash=${g20b.cacheMoney('4.468')} purse=${g20b.data.shards}`);
    // lock / unlock a cache
    eng.applyEffect(parse('<tick special="lock" cache="1.91"/>'), g20b, {});
    ok('tick special=lock locks the cache', g20b.isCacheLocked('1.91') === true);
    eng.applyEffect(parse('<tick special="unlock" cache="1.91"/>'), g20b, {});
    ok('tick special=unlock unlocks the cache', g20b.isCacheLocked('1.91') === false);
    // deposit into a cache via <tick cache= shards=>
    eng.applyEffect(parse('<tick cache="c1" shards="900"/>'), g20b, {});
    ok('tick shards cache credits the stash', g20b.cacheMoney('c1') === 900);

    // transfer: confiscate-and-return round trip
    const g20c = GameState.create({ name:'C20c', gender:'m', profession:'Warrior', book:2, adv });
    const hadW = g20c.data.items.filter((i)=>i.kind==='weapon').length;
    eng.applyEffect(parse('<transfer weapon="*" to="2.462"/>'), g20c, {});
    ok('transfer weapon="*" to cache disarms and stashes', hadW > 0 && g20c.data.items.filter((i)=>i.kind==='weapon').length === 0 && g20c.cacheItems('2.462').filter((i)=>i.kind==='weapon').length === hadW);
    eng.applyEffect(parse('<transfer item="*" from="2.462"/>'), g20c, {});
    ok('transfer item="*" from cache returns everything', g20c.data.items.filter((i)=>i.kind==='weapon').length === hadW && g20c.cacheItems('2.462').length === 0);
    g20c.data.shards = 100;
    eng.applyEffect(parse('<transfer shards="*" to="bank"/>'), g20c, {});
    ok('transfer shards="*" to cache banks all money', g20c.data.shards === 0 && g20c.cacheMoney('bank') === 100);

    // moneycache widget: deposit via the UI (§49 investment box)
    const g20r = GameState.create({ name:'C20r', gender:'m', profession:'Warrior', book:2, adv });
    g20r.data.shards = 500;
    const c20 = document.createElement('div');
    const story20 = new Story(c20, g20r, { navigate(){}, onDeath(){}, notify(){} });
    const s49 = await data.getSection(2,'49'); story20.begin(s49,2,'49');
    ok('§49 renders a money-cache widget', !!c20.querySelector('.money-cache'));
    c20.querySelector('.cache-amount').value = '100';
    Array.from(c20.querySelectorAll('.money-cache button')).find((b)=>/Deposit/.test(b.textContent)).click();
    ok('§49 deposit via the widget moves money into the cache', g20r.cacheMoney('2.49') === 100 && g20r.data.shards === 400, `cache=${g20r.cacheMoney('2.49')} sh=${g20r.data.shards}`);
    // itemcache widget renders (§468 villa strongroom)
    const g20i = GameState.create({ name:'C20i', gender:'m', profession:'Warrior', book:4, adv });
    const c20i = document.createElement('div');
    const story20i = new Story(c20i, g20i, { navigate(){}, onDeath(){}, notify(){} });
    const s468 = await data.getSection(4,'468'); story20i.begin(s468,4,'468');
    ok('§468 renders an item-cache widget', !!c20i.querySelector('.item-cache'));

    // --- task 131: cache max= semantics --------------------------------------
    // §4.263 arena "Winnings" cache is max="0": deposits barred (withdraw-only). A stake
    // locked at §4.127 can be doubled by the paired <adjustmoney ×2>, but no fresh coin
    // may be paid in — closing the deposit-double-withdraw money exploit.
    {
      const g263 = GameState.create({ name:'W263', gender:'m', profession:'Warrior', book:4, adv });
      g263.data.shards = 500;
      g263.addCodeword('4.127.1');            // the player bet on the finman (who won)
      g263.depositCacheMoney('4.127', 20);    // 20-Shard stake standing in the cache
      const c263 = document.createElement('div');
      const story263 = new Story(c263, g263, { navigate(){}, onDeath(){}, notify(){} });
      const s263 = await data.getSection(4,'263'); story263.begin(s263,4,'263');
      ok('§4.263 renders the Winnings money-cache', !!c263.querySelector('.money-cache'));
      const dep263 = () => Array.from(c263.querySelectorAll('.money-cache button')).find((b)=>/Deposit/.test(b.textContent));
      ok('§4.263 Deposit is barred (max="0")', !!dep263() && dep263().disabled === true, dep263() ? 'disabled='+dep263().disabled : 'none');
      const purse0 = g263.data.shards;
      c263.querySelector('.money-cache .cache-amount').value = '100';
      dep263().click(); // disabled — a no-op; confirms no fresh coin can be paid in
      ok('§4.263 no fresh coin can be paid in', g263.data.shards === purse0 && g263.cacheMoney('4.127') === 20, `purse=${g263.data.shards} stash=${g263.cacheMoney('4.127')}`);
      // the force="f" ×2 payout still doubles the standing stake despite max="0"
      const x2btn = Array.from(c263.querySelectorAll('button')).find((b)=>/add the amount you bet/i.test(b.textContent));
      ok('§4.263 offers the ×2 winnings action', !!x2btn);
      x2btn.click();
      ok('§4.263 the ×2 doubles the §4.127 stake to 40', g263.cacheMoney('4.127') === 40, `stash=${g263.cacheMoney('4.127')}`);
      c263.querySelector('.money-cache .cache-amount').value = '40';
      const wd263 = Array.from(c263.querySelectorAll('.money-cache button')).find((b)=>/Withdraw/.test(b.textContent));
      ok('§4.263 winnings can still be withdrawn', !!wd263 && !wd263.disabled);
      wd263.click();
      // purse: 500 start − 20 staked + 40 winnings = 520
      ok('§4.263 withdrawing the winnings credits the purse', g263.data.shards === 520 && g263.cacheMoney('4.127') === 0, `purse=${g263.data.shards} stash=${g263.cacheMoney('4.127')}`);
    }

    // §6.512 lacquer cabinet: an <itemcache max="5000"> also stores Shards (up to 5000);
    // items stay capped at itemlimit="6".
    {
      const g512 = GameState.create({ name:'B512', gender:'m', profession:'Warrior', book:6, adv });
      g512.data.items = []; g512.data.shards = 6000;
      const c512 = document.createElement('div');
      const story512 = new Story(c512, g512, { navigate(){}, onDeath(){}, notify(){} });
      const s512 = await data.getSection(6,'512'); story512.begin(s512,6,'512');
      ok('§6.512 renders an item-cache widget', !!c512.querySelector('.item-cache'));
      const dep512 = () => Array.from(c512.querySelectorAll('.item-cache button')).find((b)=>/Deposit/.test(b.textContent));
      ok('§6.512 shows a Shards deposit control (max="5000")', !!dep512());
      const amt512 = () => c512.querySelector('.item-cache .cache-amount');
      amt512().value = '5000'; dep512().click();
      ok('§6.512 deposits up to 5000 Shards', g512.cacheMoney('6.512') === 5000 && g512.data.shards === 1000, `stash=${g512.cacheMoney('6.512')} sh=${g512.data.shards}`);
      amt512().value = '1'; dep512().click();
      ok('§6.512 a 5001st Shard is refused (max cap)', g512.cacheMoney('6.512') === 5000 && g512.data.shards === 1000, `stash=${g512.cacheMoney('6.512')} sh=${g512.data.shards}`);
      // items still capped at itemlimit="6": six stored + one carried offers no Store button
      g512.data.items = [makeItem('item', 'spare rope')];
      for (let i = 0; i < 6; i++) g512.cacheAddItem('6.512', makeItem('item', 'trinket' + i));
      story512.begin(s512,6,'512');
      const store512 = Array.from(c512.querySelectorAll('.item-cache button')).find((b)=>/^Store /.test(b.textContent));
      ok('§6.512 items stay capped at six (no further Store offered)', !store512, store512 ? store512.textContent : 'none');
    }

    // task 97: §2.617 (Molhern's smithy) is the only filtered item cache — it takes one
    // weapon or suit of armour, excluding already-Molherned or bonus-6+ equipment. The
    // <include>/<exclude> filters must gate which possessions the deposit UI offers.
    {
      const g617 = GameState.create({ name:'M617', gender:'m', profession:'Warrior', book:2, adv });
      g617.data.items = [];
      g617.addItem(makeItem('weapon', 'iron sword', 2));                     // eligible
      g617.addItem(makeItem('armour', 'leather jerkin', 1));                 // eligible
      g617.addItem(makeItem('weapon', 'blessed axe', 3, null, ['Molherned'])); // excluded: already worked
      g617.addItem(makeItem('weapon', 'master blade', 6));                   // excluded: bonus 6+
      g617.addItem(makeItem('item', 'healing potion'));                      // not a candidate at all
      const c617 = document.createElement('div');
      const story617 = new Story(c617, g617, { navigate(){}, onDeath(){}, notify(){} });
      story617.begin(await data.getSection(2,'617'), 2, '617');
      const depBtn = (name) => Array.from(c617.querySelectorAll('.cache-deposit button')).find((b) => new RegExp(name, 'i').test(b.textContent));
      ok('§2.617 offers a plain weapon (enabled Store)', (() => { const b = depBtn('iron sword'); return !!b && !b.disabled; })());
      ok('§2.617 offers a suit of armour (enabled Store)', (() => { const b = depBtn('leather jerkin'); return !!b && !b.disabled; })());
      ok('§2.617 rejects an already-Molherned weapon (disabled, with reason)', (() => { const b = depBtn('blessed axe'); return !!b && b.disabled && /already worked/i.test(b.title); })(), (() => { const b = depBtn('blessed axe'); return b ? `dis=${b.disabled} title=${b.title}` : 'no button'; })());
      ok('§2.617 rejects a bonus-6 weapon (disabled, with reason)', (() => { const b = depBtn('master blade'); return !!b && b.disabled && /good enough already/i.test(b.title); })());
      ok('§2.617 does not offer an ordinary (non weapon/armour) item at all', !depBtn('healing potion'));
      // Storing an eligible item caches it and hits itemlimit="1" (deposit UI then closes).
      depBtn('iron sword').click();
      ok('§2.617 storing a weapon caches it and enforces itemlimit=1', g617.cacheItems('2.617').length === 1 && !g617.hasItem('iron sword') && !c617.querySelector('.cache-deposit'),
        `cache=${g617.cacheItems('2.617').length} deposit=${!!c617.querySelector('.cache-deposit')}`);
    }

    // task 101: §5.114's <sectionview> trance oracle — a read-only preview of random
    // sections that applies no effects and never changes the player's visit or state.
    {
      const gSV = GameState.create({ name:'SV', gender:'m', profession:'Warrior', book:5, adv });
      let svNav = null;
      const cSV = document.createElement('div');
      const storySV = new Story(cSV, gSV, { navigate:(b,s)=>{svNav={b,s};}, onDeath(){}, notify(){} });
      storySV.begin(await data.getSection(5,'114'), 5, '114');
      const svLink = cSV.querySelector('.sectionview-link');
      ok('§5.114 renders the <sectionview> oracle as a read-only link', !!svLink && /up to six paragraphs/i.test(svLink.textContent));

      // previewProse renders a known section's prose read-only: content present, no controls.
      const prose = previewProse(await data.getSection(5,'114'));
      ok('previewProse renders the section prose (content present)', /priestess/i.test(prose.textContent) && prose.querySelectorAll('p').length >= 1);
      ok('previewProse arms no interactive controls', prose.querySelectorAll('button, .goto, .choice, .btn-roll').length === 0);

      // Opening the oracle shows an isolated popup, mutates NO state and does NOT navigate.
      const before = JSON.stringify(gSV.data);
      const beforeSection = gSV.data.section;
      const overlay = await storySV.openSectionView('Trance', 6);
      ok('§5.114 opening the oracle shows an isolated read-only popup', document.body.contains(overlay) && !!overlay.querySelector('.sectionview-modal') && !!overlay.querySelector('.sectionview-cap') && !!overlay.querySelector('.sectionview-prose'));
      ok('§5.114 the oracle popup exposes no game controls', overlay.querySelectorAll('.sectionview-prose button, .sectionview-prose .goto, .sectionview-prose .choice, .sectionview-prose .btn-roll').length === 0);
      ok('§5.114 the oracle changes neither the current section nor navigation', gSV.data.section === beforeSection && svNav === null);
      ok('§5.114 the oracle mutates no player state', JSON.stringify(gSV.data) === before, 'state changed by oracle');
      overlay.remove();
    }

    // task 102: §1.338's healer — the <lose price="p" shards="25"> cost arms the
    // <lose poison="?" flag="p"> cure; too poor ⇒ disabled; paying ⇒ 25 Shards spent
    // and the poison cured exactly once (never for free on entry).
    {
      const s338 = await data.getSection(1, '338');
      // (a) too poor: the Pay button is disabled and nothing happens on entry.
      const gPoor = GameState.create({ name:'P338', gender:'m', profession:'Warrior', book:1, adv });
      gPoor.data.shards = 10;
      eng.applyEffect(parse('<poison name="Snake Venom"><effect ability="thievery" bonus="-1"/></poison>'), gPoor, {});
      const cPoor = document.createElement('div');
      new Story(cPoor, gPoor, { navigate(){}, onDeath(){}, notify(){} }).begin(s338, 1, '338');
      const payPoor = Array.from(cPoor.querySelectorAll('.pay-action')).find((b) => /Shards/i.test(b.textContent));
      ok('§1.338 arms a Pay button for the poison cure', !!payPoor);
      ok('§1.338 with < 25 Shards the Pay button is disabled', !!payPoor && payPoor.disabled && /not enough/i.test(payPoor.title || ''), payPoor ? `dis=${payPoor.disabled} title=${payPoor.title}` : 'no button');
      ok('§1.338 does not cure the poison for free on entry', gPoor.hasPoison('Snake Venom') && gPoor.data.shards === 10);

      // (b) can afford: paying deducts 25 and cures the poison, restoring the ability.
      const gRich = GameState.create({ name:'R338', gender:'m', profession:'Warrior', book:1, adv });
      gRich.data.shards = 100;
      gRich.data.abilities.thievery = 5; const thRich = gRich.ability('thievery');
      eng.applyEffect(parse('<poison name="Snake Venom"><effect ability="thievery" bonus="-1"/></poison>'), gRich, {});
      ok('§1.338 the poison penalises the ability first', gRich.ability('thievery') === thRich - 1);
      const cRich = document.createElement('div');
      new Story(cRich, gRich, { navigate(){}, onDeath(){}, notify(){} }).begin(s338, 1, '338');
      ok('§1.338 the poison is intact and no Shards spent until the player pays', gRich.hasPoison('Snake Venom') && gRich.data.shards === 100);
      Array.from(cRich.querySelectorAll('.pay-action')).find((b) => /Shards/i.test(b.textContent)).click();
      ok('§1.338 paying deducts 25 Shards and cures the poison (ability restored)', gRich.data.shards === 75 && !gRich.hasPoison('Snake Venom') && gRich.ability('thievery') === thRich, `shards=${gRich.data.shards} poison=${gRich.hasPoison('Snake Venom')} thiev=${gRich.ability('thievery')}`);
      const payAgain = Array.from(cRich.querySelectorAll('.pay-action')).find((b) => /Shards/i.test(b.textContent));
      ok('§1.338 the cure cannot be bought twice (button locks after paying)', gRich.data.shards === 75 && (!payAgain || payAgain.disabled));
    }

    // ranges
    ok('range 0-4 ~3', eng.matchRange('0-4', 3));
    ok('range 1,2 ~2', eng.matchRange('1,2', 2));
    ok('range 1,2 ~3 no', !eng.matchRange('1,2', 3));
    ok('range 11 ~11', eng.matchRange('11', 11));
    ok('range 14+ ~15', eng.matchRange('14+', 15));
    ok('range 2-10 ~1 no', !eng.matchRange('2-10', 1));

    // difficulty roll logic
    let sc=0; for (let i=0;i<200;i++){ const r=eng.rollDifficulty(gs,'combat',10,0); if (r.success !== (r.total>10)) sc++; if (r.dice.length!==2) sc+=100; if (r.margin !== r.total-10) sc+=1000; }
    ok('difficulty roll consistent', sc===0, 'mismatches='+sc);

    // training rule (extracted to engine.rollTraining): success ⇒ +1 ability
    const gt = GameState.create({ name:'T', gender:'m', profession:'Warrior', book:1, adv });
    let tbad=0, tgain=0;
    for (let i=0;i<300;i++){ gt.data.abilities.combat=2; const r=eng.rollTraining(gt,'combat',2,0);
      if (r.success !== (r.total>2)) tbad++;
      if (r.success && gt.abilityNatural('combat')!==3) tbad++;
      if (r.success) tgain++; }
    ok('training: success flag = roll>natural', tbad===0, 'bad='+tbad);
    ok('training: +1 ability on success', tgain>0);

    // rank check rule (extracted to engine.rollRankCheck): success iff roll<=Rank
    const gk = GameState.create({ name:'K', gender:'m', profession:'Warrior', book:1, adv }); gk.data.rank=5;
    let kbad=0; for (let i=0;i<200;i++){ const r=eng.rollRankCheck(gk,1,0,0); if (r.success!==(r.total<=5)) kbad++; if (r.margin!==1+5-r.total) kbad++; }
    ok('rankcheck: success=roll<=Rank & margin', kbad===0, 'bad='+kbad);

    // resurrection deal (extracted to engine.buyResurrectionDeal)
    const gr = GameState.create({ name:'R', gender:'f', profession:'Priest', book:1, adv }); gr.data.shards=100;
    eng.buyResurrectionDeal(gr, { book:2, section:'50', text:'a deal', god:'Elnir', cost:30 });
    ok('resurrection: charges cost + records deal', gr.data.shards===70 && gr.hasResurrection() && gr.data.resurrections[0].section==='50', `sh=${gr.data.shards}`);
    // reviveWithResurrection (task 34): consume the deal, revive at half max Stamina, return target.
    gr.data.staminaMax = 20; gr.data.stamina = 0;
    const revTarget = eng.reviveWithResurrection(gr);
    ok('task34: revive consumes the deal + heals to half max + returns target',
       revTarget && revTarget.book===2 && revTarget.section==='50' && gr.data.stamina===10 && !gr.hasResurrection(),
       `t=${JSON.stringify(revTarget)} st=${gr.data.stamina} has=${gr.hasResurrection()}`);
    ok('task34: revive with no deal returns null and leaves Stamina', eng.reviveWithResurrection(gr) === null && gr.data.stamina === 10);

}

// FL test suite — markets, rest, TTS, persistence, item effects, rewards, quantity/replace
// Extracted verbatim from web/_test.html run() lines 3176-4349 (task 120).
import * as data from '../js/data.js';
import { GameState, readSlotData, importSave, loadSlotMeta, reconcileSlotMeta, deleteSlot, makeItem, nextFreeSlot, sanitizeData, currencyAward, splitItemName } from '../js/state.js';
import * as eng from '../js/engine.js';
import { fightRound } from '../js/combat.js';
import { goodsFrom, buyTrade, sellTrade, sellPlan, applyInlineBuy, sellInlineItem, canUpgradeCrew, payChoiceCost } from '../js/market.js';
import { Story } from '../js/render.js';
import { isRollGate } from '../js/render-rules.js';
import { renderGoto } from '../js/render-choices.js';
import { renderMarket, renderRest } from '../js/render-market.js';
import { Narrator } from '../js/tts.js';
import { renderSheet, renderStatic } from '../js/ui.js';

export async function run(ctx) {
  const { ok, parse } = ctx;
  await data.loadMeta();
  const adv = data.parseAdventurers(data.bookInfo(1).adventurers);
  // Reused inline-trade result holder, declared earlier in the original run() (task 120).
  let r23;
    // --- task 29: market & item polish (currency items, pipe names, headers) ---
    // part 1: a "N Shards" award is stackable currency, not a carried item.
    ok('currencyAward parses "500 Shards", rejects a real item', currencyAward('500 Shards') === 500 && currencyAward('enchanted sword') === null);
    const gcur = GameState.create({ name:'CUR', gender:'m', profession:'Warrior', book:1, adv });
    const shBefore = gcur.data.shards, itBefore = gcur.itemCount();
    const ccur = document.createElement('div');
    const stCur = new Story(ccur, gcur, { navigate(){}, onDeath(){}, notify(){} });
    gcur.data.section = '16';
    const s116 = await data.getSection(1, '16'); stCur.begin(s116, 1, '16');
    const shardsBtn = Array.from(ccur.querySelectorAll('.take-item')).find((b) => /500 Shards/.test(b.textContent));
    ok('§1.16 shows a "500 Shards" award button', !!shardsBtn, `found=${!!shardsBtn}`);
    shardsBtn.click();
    ok('§1.16 taking "500 Shards" adds money, not an item', gcur.data.shards === shBefore + 500 && gcur.itemCount() === itBefore, `sh=${gcur.data.shards} items=${gcur.itemCount()}`);
    // part 3: a "fur cloak|wolf pelt" row is one item, matchable under either name.
    ok('splitItemName splits "fur cloak|wolf pelt"', (() => { const s = splitItemName('fur cloak|wolf pelt'); return s.name === 'fur cloak' && s.alts.length === 1 && s.alts[0] === 'wolf pelt'; })());
    const gpn = GameState.create({ name:'PN', gender:'m', profession:'Warrior', book:4, adv });
    gpn.data.shards = 500;
    buyTrade(gpn, goodsFrom(parse('<item name="fur cloak|wolf pelt" buy="40" sell="30"/>'), 'item', 'fur cloak|wolf pelt', 0), 40);
    ok('pipe-name buy: stored under first name, matched by either', gpn.hasItem('fur cloak') && gpn.hasItem('wolf pelt') && eng.evaluateCondition(parse('<if item="wolf pelt"/>'), gpn) === true, JSON.stringify(gpn.data.items.map((i) => ({ n:i.name, t:i.tags }))));
    // part 4: header1= supplies the market column heading.
    const stHd = new Story(document.createElement('div'), GameState.create({ name:'HD', gender:'m', profession:'Warrior', book:4, adv }), { navigate(){}, onDeath(){}, notify(){} });
    stHd.book = 4; stHd.sectionEl = parse('<section/>');
    const mktBox = renderMarket(stHd, document.createElement('div'), parse('<market><header header1="Potions"/><item name="potion of strength" buy="100" sell="90"/></market>'), 'm');
    ok('header1= supplies the market heading', /Potions/.test(mktBox.textContent), mktBox.textContent.slice(0, 40));

    // buy a tool: grants a bonus tool tied to an ability and charges the price
    const gbtool = GameState.create({ name:'BT', gender:'m', profession:'Warrior', book:5, adv });
    gbtool.data.shards = 500;
    r23 = applyInlineBuy(gbtool, { price: 400, tool: 'silver holy symbol', ability: 'sanctity', bonus: 2 });
    const boughtTool = gbtool.findItems('silver holy symbol')[0];
    ok('buy tool grants a bonus tool and charges', r23.ok && gbtool.data.shards === 100 && boughtTool && boughtTool.kind === 'tool' && boughtTool.ability === 'sanctity' && boughtTool.bonus === 2, `sh=${gbtool.data.shards} tool=${JSON.stringify(boughtTool)}`);
    r23 = applyInlineBuy(gbtool, { price: 2000, tool: 'cobalt wand', ability: 'magic', bonus: 3 });
    ok('buy refused when short of Shards', r23.ok === false && gbtool.data.shards === 100);

    // sell a carried item for Shards (book 5 rime-ice income)
    const gsi = GameState.create({ name:'SI', gender:'m', profession:'Warrior', book:5, adv });
    gsi.addItem(makeItem('item','rime ice'));
    const shSI = gsi.data.shards;
    r23 = sellInlineItem(gsi, 'rime ice', 350);
    ok('sell item credits Shards and removes it', r23.ok && gsi.data.shards === shSI + 350 && gsi.findItems('rime ice').length === 0, `sh=${gsi.data.shards}`);

    // §359: inline lantern buy (quantity="3") — memoised, capped at three per visit
    const gq3 = GameState.create({ name:'Q3', gender:'m', profession:'Warrior', book:1, adv });
    gq3.data.items = []; gq3.data.shards = 500;
    const cq3 = document.createElement('div');
    const storyQ3 = new Story(cq3, gq3, { navigate(){}, onDeath(){}, notify(){} });
    const s359 = await data.getSection(1,'359'); storyQ3.begin(s359,1,'359');
    const lanternBtn = () => Array.from(cq3.querySelectorAll('button')).find((b)=>/lantern/i.test(b.textContent));
    ok('§359 shows a lantern buy button', !!lanternBtn());
    lanternBtn().click();
    ok('§359 buying a lantern grants it (with light tag) and charges 50', gq3.findItems('lantern').length === 1 && gq3.data.shards === 450 && (gq3.findItems('lantern')[0].tags||[]).includes('light'), `n=${gq3.findItems('lantern').length} sh=${gq3.data.shards}`);
    lanternBtn().click(); lanternBtn().click();
    ok('§359 grants up to three lanterns', gq3.findItems('lantern').length === 3, `n=${gq3.findItems('lantern').length}`);
    ok('§359 fourth purchase blocked (quantity cap)', lanternBtn().disabled === true, `disabled=${lanternBtn() && lanternBtn().disabled}`);

    // §30: inline treasure-map buy (quantity 1, memoised) + buy-back sell round trip
    const g30t = GameState.create({ name:'M30', gender:'m', profession:'Warrior', book:1, adv });
    g30t.data.shards = 500;
    const c30t = document.createElement('div');
    const story30t = new Story(c30t, g30t, { navigate(){}, onDeath(){}, notify(){} });
    const s30t = await data.getSection(1,'30'); story30t.begin(s30t,1,'30');
    const mapBuy = () => Array.from(c30t.querySelectorAll('button')).find((b)=>/treasure map/i.test(b.textContent) && /Buy/i.test(b.textContent));
    ok('§30 shows a treasure-map buy button', !!mapBuy());
    mapBuy().click();
    ok('§30 buying the map grants it and charges 200', g30t.findItems('treasure map').length === 1 && g30t.data.shards === 300, `sh=${g30t.data.shards}`);
    ok('§30 map buy does not repeat (quantity 1)', mapBuy().disabled === true);
    const mapSell = () => Array.from(c30t.querySelectorAll('button')).find((b)=>/Sell\b.*treasure map/i.test(b.textContent));
    ok('§30 shows a treasure-map sell button once owned', !!mapSell() && !mapSell().disabled);
    mapSell().click();
    ok('§30 selling the map credits 150 and removes it', g30t.findItems('treasure map').length === 0 && g30t.data.shards === 450, `sh=${g30t.data.shards}`);

    // --- task 130: an inline <buy> with no quantity= is unlimited-per-visit ---
    // §1.342 alchemist: "buy as many as you can afford", each potion 50 Shards, no quantity=.
    const g342 = GameState.create({ name:'B342', gender:'m', profession:'Warrior', book:1, adv });
    g342.data.items = []; g342.data.shards = 500;
    const c342 = document.createElement('div');
    const story342 = new Story(c342, g342, { navigate(){}, onDeath(){}, notify(){} });
    const s342 = await data.getSection(1,'342'); story342.begin(s342,1,'342');
    const strBuy = () => Array.from(c342.querySelectorAll('button')).find((b)=>/potion of strength/i.test(b.textContent) && /Buy/i.test(b.textContent));
    ok('§1.342 shows a potion-of-strength buy button, enabled', !!strBuy() && !strBuy().disabled);
    strBuy().click();
    ok('§1.342 first potion bought, 50 Shards charged', g342.findItems('potion of strength').length === 1 && g342.data.shards === 450, `n=${g342.findItems('potion of strength').length} sh=${g342.data.shards}`);
    ok('§1.342 the same buy repeats in one visit (no quantity cap)', !!strBuy() && !strBuy().disabled, strBuy() ? 'disabled='+strBuy().disabled : 'none');
    strBuy().click();
    ok('§1.342 second identical potion bought same visit', g342.findItems('potion of strength').length === 2 && g342.data.shards === 400, `n=${g342.findItems('potion of strength').length} sh=${g342.data.shards}`);

    // --- task 30: gate <random flag="k"> rolls behind their payment ---
    window.__FL_INSTANT_DICE__ = true;                 // resolve dice animation instantly
    const settle = () => new Promise(r => setTimeout(r, 30));
    // isRollGate distinguishes a "pay to spin" cost from a plain reward purchase.
    const stGate = new Story(document.createElement('div'), GameState.create({ name:'GG', gender:'m', profession:'Warrior', book:2, adv }), { navigate(){}, onDeath(){}, notify(){} });
    stGate.book = 2;
    stGate.sectionEl = parse('<section><lose shards="5" price="x"/><random flag="x"/></section>');
    ok('isRollGate true for a random-gated price', isRollGate(stGate.sectionEl, 'x') === true);
    stGate.sectionEl = parse('<section><lose shards="5" price="y"/><tick blessing="combat" flag="y"/></section>');
    ok('isRollGate false for a plain reward flag', isRollGate(stGate.sectionEl, 'y') === false);
    // <goto price="k"> is open only while the flag is clear (JaFL GotoNode.canUse).
    stGate.sectionEl = parse('<section/>');
    stGate.state.setFlag('x', false);
    const gotoOpen = renderGoto(stGate, document.createElement('div'), parse('<goto section="19" price="x"/>'), 'g1');
    ok('goto price= open while flag clear', gotoOpen.disabled === false);
    stGate.state.setFlag('x', true);
    const gotoShut = renderGoto(stGate, document.createElement('div'), parse('<goto section="19" price="x"/>'), 'g2');
    ok('goto price= withheld while flag set', gotoShut.disabled === true);

    // §2.157 golden wheel: pay 20 to arm a 1-die spin (the classic idiom).
    const g157 = GameState.create({ name:'W157', gender:'m', profession:'Warrior', book:2, adv });
    g157.data.shards = 100;
    const c157 = document.createElement('div');
    const st157 = new Story(c157, g157, { navigate(){}, onDeath(){}, notify(){} });
    const s157 = await data.getSection(2,'157'); st157.begin(s157,2,'157');
    const roll157 = () => c157.querySelector('.roll .btn-roll');
    const pay157 = () => c157.querySelector('.pay-action');
    const goto19 = () => Array.from(c157.querySelectorAll('.goto')).find(b => b.textContent.trim() === '19');
    ok('§157 roll is disabled until paid', !!roll157() && roll157().disabled === true, `dis=${roll157() && roll157().disabled}`);
    ok('§157 pay button enabled; exit (19) open before paying', !!pay157() && !pay157().disabled && !!goto19() && !goto19().disabled);
    const ab0 = JSON.stringify(g157.data.abilities), stm0 = g157.data.stamina, bl0 = g157.data.blessings.length, ti0 = g157.data.titles.length;
    pay157().click();
    ok('§157 paying deducts exactly 20 Shards', g157.data.shards === 80, `sh=${g157.data.shards}`);
    ok('§157 paying fires NO outcome effect (arms only)', JSON.stringify(g157.data.abilities) === ab0 && g157.data.stamina === stm0 && g157.data.blessings.length === bl0 && g157.data.titles.length === ti0, `ab=${JSON.stringify(g157.data.abilities)} st=${g157.data.stamina} bl=${g157.data.blessings.length} ti=${g157.data.titles.length}`);
    ok('§157 roll armed + exit (19) withheld while paid, unrolled', !!roll157() && !roll157().disabled && !!goto19() && goto19().disabled === true);
    roll157().click(); await settle();
    ok('§157 rolling shows a die and reveals exactly one outcome', !!c157.querySelector('.die') && c157.querySelectorAll('.branch').length === 1, `dice=${!!c157.querySelector('.die')} branches=${c157.querySelectorAll('.branch').length}`);
    ok('§157 exit (19) reopens once the spin resolves', !!goto19() && goto19().disabled === false);
    // re-arm: paying again drops the prior result and re-enables the roll.
    pay157().click();
    ok('§157 re-paying re-arms the roll (fresh button, no stale die)', g157.data.shards === 60 && !!roll157() && !roll157().disabled && !c157.querySelector('.die'), `sh=${g157.data.shards} die=${!!c157.querySelector('.die')}`);

    // §3.314 tavern: 1 Shard/day, repeatable — the roll re-arms per payment.
    const g314 = GameState.create({ name:'W314', gender:'m', profession:'Warrior', book:3, adv });
    g314.data.shards = 10;
    const c314 = document.createElement('div');
    const st314 = new Story(c314, g314, { navigate(){}, onDeath(){}, notify(){} });
    const s314 = await data.getSection(3,'314'); st314.begin(s314,3,'314');
    const roll314 = () => c314.querySelector('.roll .btn-roll');
    const pay314 = () => c314.querySelector('.pay-action');
    ok('§314 roll gated before payment', !!roll314() && roll314().disabled === true);
    pay314().click();
    ok('§314 pay deducts 1 Shard and arms the roll', g314.data.shards === 9 && !!roll314() && !roll314().disabled, `sh=${g314.data.shards}`);
    roll314().click(); await settle();
    ok('§314 rolled once; pay re-enabled for another day', !!c314.querySelector('.die') && !!pay314() && !pay314().disabled);
    pay314().click();
    ok('§314 re-pay deducts another Shard and re-arms', g314.data.shards === 8 && !!roll314() && !roll314().disabled, `sh=${g314.data.shards}`);

    // §5.674 physician: flag "c" gate; paying must not cure/damage until the roll.
    const g674 = GameState.create({ name:'W674', gender:'m', profession:'Warrior', book:5, adv });
    g674.data.shards = 100;
    const c674 = document.createElement('div');
    const st674 = new Story(c674, g674, { navigate(){}, onDeath(){}, notify(){} });
    const s674 = await data.getSection(5,'674'); st674.begin(s674,5,'674');
    const roll674 = () => c674.querySelector('.roll .btn-roll');
    ok('§674 roll gated before payment', !!roll674() && roll674().disabled === true);
    const stm674 = g674.data.stamina;
    c674.querySelector('.pay-action').click();
    ok('§674 pay charges 25 and fires no outcome (stamina intact)', g674.data.shards === 75 && g674.data.stamina === stm674, `sh=${g674.data.shards} st=${g674.data.stamina}`);
    ok('§674 roll armed after paying', !!roll674() && !roll674().disabled);

    // --- task 31: <rest> with no stamina= restores Stamina to full ---
    const gR = GameState.create({ name:'R', gender:'m', profession:'Warrior', book:1, adv });
    gR.data.staminaMax = 12; gR.data.stamina = 3;
    ok('applyRest(null) restores Stamina to full', eng.applyRest(gR, null, 0) === 9 && gR.data.stamina === 12, `st=${gR.data.stamina}`);
    gR.data.stamina = 10;
    ok('applyRest("3") heals a fixed amount, clamped to max', eng.applyRest(gR, '3', 0) === 2 && gR.data.stamina === 12, `st=${gR.data.stamina}`);
    gR.data.stamina = 5;
    ok('applyRest("") (blank) restores to full', eng.applyRest(gR, '', 0) === 7 && gR.data.stamina === 12, `st=${gR.data.stamina}`);
    gR.data.stamina = 8; gR.data.shards = 50;
    ok('applyRest full-restore still charges the cost', eng.applyRest(gR, null, 20) === 4 && gR.data.shards === 30 && gR.data.stamina === 12, `st=${gR.data.stamina} sh=${gR.data.shards}`);
    // render: a <rest stamina="2"> still labels a fixed +2; a bare <rest> labels "heal all".
    const stRl = new Story(document.createElement('div'), gR, { navigate(){}, onDeath(){}, notify(){} });
    stRl.sectionEl = parse('<section/>'); stRl.book = 1; stRl.ctx = stRl._newCtx(); gR.data.stamina = 1;
    const restFixed = renderRest(stRl, document.createElement('div'), parse('<rest stamina="2">rest a bit</rest>'), 'rr');
    ok('<rest stamina="2"> labels a fixed +2 Stamina', /\+2 Stamina/.test(restFixed.textContent), restFixed.textContent);
    // §1.114 safe house: a bare <rest> heals all lost Stamina on click.
    const g114 = GameState.create({ name:'R114', gender:'m', profession:'Warrior', book:1, adv });
    g114.data.staminaMax = 12; g114.data.stamina = 4;
    const c114 = document.createElement('div');
    const st114 = new Story(c114, g114, { navigate(){}, onDeath(){}, notify(){} });
    const s114 = await data.getSection(1,'114'); st114.begin(s114,1,'114');
    const restBtn = () => Array.from(c114.querySelectorAll('.btn-secondary')).find(b => /Rest/.test(b.textContent));
    ok('§114 shows a "heal all Stamina" rest button', !!restBtn() && /heal all Stamina/.test(restBtn().textContent), restBtn() ? restBtn().textContent : 'none');
    restBtn().click();
    ok('§114 resting heals all lost Stamina', g114.data.stamina === 12, `st=${g114.data.stamina}`);

    // --- task 129: an unpriced fixed-amount <rest> heals once per visit ---
    // §2.61 abbey: "stay one night", <rest stamina="2">. Keep max high so +2 can't
    // reach full — the button must then lock on the per-visit memo, not on being full.
    const g261 = GameState.create({ name:'R261', gender:'m', profession:'Warrior', book:2, adv });
    g261.data.staminaMax = 20; g261.data.stamina = 4;
    const c261 = document.createElement('div');
    const st261 = new Story(c261, g261, { navigate(){}, onDeath(){}, notify(){} });
    const s261 = await data.getSection(2,'61'); st261.begin(s261,2,'61');
    const rest261 = () => Array.from(c261.querySelectorAll('.btn-secondary')).find(b => /Rest/.test(b.textContent));
    ok('§2.61 shows a +2 Stamina rest button, enabled', !!rest261() && /\+2 Stamina/.test(rest261().textContent) && !rest261().disabled, rest261() ? rest261().textContent : 'none');
    rest261().click();
    ok('§2.61 first rest heals +2', g261.data.stamina === 6, `st=${g261.data.stamina}`);
    ok('§2.61 rest button disabled after one use (not full)', !!rest261() && rest261().disabled, rest261() ? 'disabled='+rest261().disabled : 'none');
    g261.data.stamina = 4; st261.begin(s261,2,'61'); // re-enter the section: fresh visit
    ok('§2.61 rest re-enabled on re-entry', !!rest261() && !rest261().disabled, rest261() ? 'disabled='+rest261().disabled : 'none');

    // A priced per-day rest still repeats: pay again for a second night. A synthetic
    // section holds <rest stamina="1" shards="2"> so the live rerender path reproduces
    // the button; with a low fill (max 20) and plenty of coin it stays enabled.
    const gPay = GameState.create({ name:'RPay', gender:'m', profession:'Warrior', book:1, adv });
    gPay.data.staminaMax = 20; gPay.data.stamina = 4; gPay.data.shards = 50;
    const cPay = document.createElement('div');
    const stPay = new Story(cPay, gPay, { navigate(){}, onDeath(){}, notify(){} });
    stPay.begin(parse('<section><rest stamina="1" shards="2">Stay another night</rest></section>'), 1, '999');
    const payBtn = () => Array.from(cPay.querySelectorAll('button')).find(b => /Rest/.test(b.textContent));
    payBtn().click();
    ok('priced rest first night heals +1 and charges 2', gPay.data.stamina === 5 && gPay.data.shards === 48, `st=${gPay.data.stamina} sh=${gPay.data.shards}`);
    ok('priced rest still repeatable (button stays enabled)', !!payBtn() && !payBtn().disabled, payBtn() ? 'disabled='+payBtn().disabled : 'none');
    payBtn().click();
    ok('priced rest second night heals again', gPay.data.stamina === 6 && gPay.data.shards === 46, `st=${gPay.data.stamina} sh=${gPay.data.shards}`);

    // --- narration (TTS): sentence wrapping preserves interactivity ---
    const narrator = new Narrator();
    ok('TTS supported in test browser', narrator.supported === true);
    const gn = GameState.create({ name:'N', gender:'m', profession:'Warrior', book:1, adv });
    let navdN = null;
    const cn = document.createElement('div');
    const storyN = new Story(cn, gn, { navigate:(b,s)=>{navdN={b,s};}, onDeath(){}, notify(){}, onRender(){} });
    const s1n = await data.getSection(1,'1'); storyN.begin(s1n,1,'1');
    const flowN = cn.querySelector('.flow');
    const nChunks = narrator.prepare(flowN);
    ok('narration produces chunks', nChunks > 5, 'chunks='+nChunks);
    ok('narration wrapped sentences', flowN.querySelectorAll('.tts-s').length > 5);
    const glink = flowN.querySelector('.goto');
    ok('goto survives narration prep', !!glink);
    glink.click();
    ok('goto still navigates after prep (listeners preserved)', navdN && navdN.s === '20', JSON.stringify(navdN));
    const joined = narrator.chunks.map(c => c.text).join(' ');
    ok('narration excludes control labels', !/\b20\b/.test(joined));
    ok('narration includes prose', /dawn|sea|boat|Spider/i.test(joined));

    // --- save import/export round-trip ---
    const ge = GameState.create({ name:'Exportia', gender:'f', profession:'Mage', book:1, adv });
    ge.slot = 15; ge.data.shards = 777; ge.addCodeword('Exported'); ge.save();
    const exported = readSlotData(15);
    ok('export reads saved data', exported && exported.shards === 777 && exported.name === 'Exportia');
    const serialized = JSON.stringify(exported);            // what a downloaded file contains
    const { slot: impSlot, meta: impMeta } = importSave(JSON.parse(serialized));
    ok('import lands in a new slot', impSlot !== 15);
    ok('import preserves data', readSlotData(impSlot).shards === 777 && readSlotData(impSlot).codewords.Exported === true);
    ok('import meta name', impMeta.name === 'Exportia');
    let threw = false; try { importSave({ foo: 1 }); } catch { threw = true; }
    ok('import rejects invalid file', threw === true);
    deleteSlot(15); deleteSlot(impSlot); // cleanup

    // --- task 6: deep sanitize of imported/loaded saves ---
    // sanitizeData coerces every field so a hostile/corrupt file can never crash
    // rendering or the sheet; bad array/object entries are dropped, not trusted.
    const dirty = sanitizeData({
      name: 42, gender: 'x', profession: 7,
      abilities: { combat: '9', magic: 99, sanctity: 'nope' }, // string→num, over-cap clamp, junk→default
      stamina: '15', staminaMax: 12,                            // strings coerced; stamina clamped to max
      rank: -3, shards: -50,                                    // clamped to floors
      items: 'not-an-array',                                    // wrong shape → []
      titles: [{ name: 'Hero', value: '2' }, { value: 5 }, 'junk'], // drop the nameless + non-object
      ships: [{ type: 'sloop', cargo: ['silk', 5, null] }, 'nope', {}], // drop bad ships; filter cargo
      curses: [{ name: 'Hex', effects: [{ ability: 'combat', bonus: '-2' }, {}] }, {}],
      codewords: { Real: true, Fake: 0 }, boxes: { '1.5': '2', '1.6': -1 },
      vars: { x: '3', bad: 'NaN' }, book: '4', section: 99, turns: -1,
      caches: { pot: { money: '100', items: [{ name: 'gem' }, null], locked: 'yes' } },
      junkField: { nested: true },                              // unknown key dropped
    });
    ok('sanitize: name coerced to string', dirty.name === '42');
    ok('sanitize: gender falls back to m', dirty.gender === 'm');
    ok('sanitize: ability string→number', dirty.abilities.combat === 9);
    ok('sanitize: ability clamped to 12', dirty.abilities.magic === 12, String(dirty.abilities.magic));
    ok('sanitize: junk ability→default 4', dirty.abilities.sanctity === 4, String(dirty.abilities.sanctity));
    ok('sanitize: stamina string coerced', dirty.stamina === 12, String(dirty.stamina));
    ok('sanitize: rank floored to 1', dirty.rank === 1, String(dirty.rank));
    ok('sanitize: shards floored to 0', dirty.shards === 0, String(dirty.shards));
    ok('sanitize: bad items array → []', Array.isArray(dirty.items) && dirty.items.length === 0);
    ok('sanitize: titles drop nameless/non-object', dirty.titles.length === 1 && dirty.titles[0].name === 'Hero' && dirty.titles[0].value === 2);
    ok('sanitize: bad ships dropped, cargo filtered', dirty.ships.length === 1 && dirty.ships[0].type === 'sloop' && dirty.ships[0].cargo.join(',') === 'silk');
    ok('sanitize: curse effects filtered', dirty.curses.length === 1 && dirty.curses[0].effects.length === 1 && dirty.curses[0].effects[0].bonus === -2);
    ok('sanitize: codewords keep only truthy', dirty.codewords.Real === true && dirty.codewords.Fake === undefined);
    ok('sanitize: boxes drop non-positive, coerce', dirty.boxes['1.5'] === 2 && dirty.boxes['1.6'] === undefined);
    ok('sanitize: vars drop non-numeric', dirty.vars.x === 3 && dirty.vars.bad === undefined);
    ok('sanitize: book/section coerced', dirty.book === 4 && dirty.section === '99');
    ok('sanitize: cache money/items/locked coerced', dirty.caches.pot.money === 100 && dirty.caches.pot.items.length === 1 && dirty.caches.pot.locked === false);
    ok('sanitize: unknown top-level key dropped', dirty.junkField === undefined);
    ok('sanitize: turns floored to 0', dirty.turns === 0);
    // a malformed save must survive being loaded into a live GameState + rendered
    const gdirty = new GameState(sanitizeData({ abilities: { combat: 5 }, stamina: 9, items: [null, { name:'sword', kind:'weapon', bonus:2 }, 3] }), 0);
    ok('sanitize: GameState from junk has clean items', gdirty.itemCount() === 1 && gdirty.data.items[0].name === 'sword');
    ok('sanitize: derived stats compute without throwing', Number.isFinite(gdirty.defence()) && Number.isFinite(gdirty.ability('combat')));

    // importSave rejects non-save shapes (array, missing abilities object)
    let arrThrew = false; try { importSave([1,2,3]); } catch { arrThrew = true; }
    ok('import rejects a JSON array', arrThrew === true);
    let noAbThrew = false; try { importSave({ abilities: 'nope', stamina: 5 }); } catch { noAbThrew = true; }
    ok('import rejects when abilities is not an object', noAbThrew === true);

    // --- task 7: save() surfaces persistence failures ---
    const gsv = GameState.create({ name:'SV', gender:'m', profession:'Warrior', book:1, adv });
    gsv.slot = 12;
    ok('save returns true and clears error normally', gsv.save() === true && gsv.lastSaveError === null);
    // simulate a full store (QuotaExceededError)
    const quotaSpy = () => { const e = new Error('quota'); e.name = 'QuotaExceededError'; throw e; };
    localStorage.setItem = quotaSpy;
    const okQuota = gsv.save();
    delete localStorage.setItem; // revert to Storage.prototype.setItem
    ok('save returns false when storage is full', okQuota === false);
    ok('lastSaveError explains a full store', typeof gsv.lastSaveError === 'string' && /full/i.test(gsv.lastSaveError), gsv.lastSaveError);
    // simulate blocked storage (private-browsing)
    localStorage.setItem = () => { throw new Error('access denied'); };
    gsv.save();
    delete localStorage.setItem;
    ok('lastSaveError explains blocked storage', /private|blocking/i.test(gsv.lastSaveError), gsv.lastSaveError);
    ok('save recovers and re-clears lastSaveError', gsv.save() === true && gsv.lastSaveError === null);
    // an ephemeral (preview) game reports success without writing or erroring
    gsv.ephemeral = true; gsv.lastSaveError = 'stale';
    ok('ephemeral save reports success, no error', gsv.save() === true && gsv.lastSaveError === null);
    gsv.ephemeral = false;
    deleteSlot(12); // cleanup

    // --- task 166: direct current-visit commits publish save status + advance activity time ---
    // The renderer/combat direct-save sites route through commitVisit(), not raw save(), so a
    // ctx-only combat/roll commit warns on a quota failure, re-arms on recovery, and moves the
    // save-card timestamp even when no GameState.data mutation fired changed().
    {
      const gcv = GameState.create({ name: 'CV', gender: 'm', profession: 'Warrior', book: 1, adv });
      gcv.slot = 13;
      const seen = []; // each published lastSaveError (null = healthy)
      const off = gcv.onSaveStatus((s) => seen.push(s.lastSaveError));
      // A ctx-only commit advances the persisted activity timestamp (was left stale by raw save()).
      gcv.data.updated = 1;
      const okc = gcv.commitVisit();
      ok('commitVisit persists and advances updated', okc === true && gcv.data.updated > 1, `updated=${gcv.data.updated}`);
      ok('commitVisit writes the advanced updated to slot meta', !!loadSlotMeta()[13] && loadSlotMeta()[13].updated === gcv.data.updated, JSON.stringify(loadSlotMeta()[13]));
      ok('commitVisit publishes a healthy save status', seen.length === 1 && seen[0] === null, JSON.stringify(seen));
      // Force storage to fail on the direct commit only: the save-status observer must see it.
      localStorage.setItem = () => { const e = new Error('quota'); e.name = 'QuotaExceededError'; throw e; };
      const okFail = gcv.commitVisit();
      delete localStorage.setItem; // revert to Storage.prototype.setItem
      ok('commitVisit returns false when the direct write fails', okFail === false);
      ok('save-status observer receives the direct-commit failure', seen.length === 2 && typeof seen[1] === 'string' && /full/i.test(seen[1]), seen[1]);
      // A successful retry re-arms — the observer sees recovery (null).
      const okRec = gcv.commitVisit();
      ok('save-status observer receives recovery after a successful retry', okRec === true && seen.length === 3 && seen[2] === null, JSON.stringify(seen));
      off();
      // Ephemeral previews still no-op the write and report success, like save() (task 4/7).
      gcv.ephemeral = true; gcv.lastSaveError = 'stale';
      ok('ephemeral commitVisit reports success and clears the error', gcv.commitVisit() === true && gcv.lastSaveError === null);
      gcv.ephemeral = false;
      deleteSlot(13); // cleanup
    }

    // --- alternate-currency markets: <market currency="Mithral"> (task 40) ---
    {
      const gcy = GameState.create({ name: 'Cy', gender: 'm', profession: 'Warrior', book: 2, adv });
      gcy.data.shards = 5000;
      const clover = () => goodsFrom(parse('<item name="four-leaf clover" buy="25" sell="20"/>'), 'item', 'four-leaf clover', 0);
      // buy in a Mithral market with 0 Mithral: refused, and Shards untouched.
      const shBefore = gcy.data.shards;
      const rNoMith = buyTrade(gcy, clover(), 25, 'Mithral');
      ok('currency market: buy refused with 0 Mithral', rNoMith.ok === false && !gcy.hasItem('four-leaf clover'));
      ok('currency market: refusal leaves Shards untouched', gcy.data.shards === shBefore, `sh=${gcy.data.shards}`);
      ok('currencyBalance 0 for unheld currency', gcy.currencyBalance('Mithral') === 0);
      // grant a Mithral pool (e.g. via <adjustmoney currency=…>) then the buy goes through.
      eng.applyEffect(parse('<adjustmoney currency="Mithral" add="100"/>'), gcy);
      ok('adjustmoney currency= grants a Mithral pool', gcy.currencyBalance('Mithral') === 100, `m=${gcy.currencyBalance('Mithral')}`);
      const rMith = buyTrade(gcy, clover(), 25, 'Mithral');
      ok('currency market: buy succeeds once Mithral is held', rMith.ok === true && gcy.hasItem('four-leaf clover'));
      ok('currency market: buy debits Mithral, not Shards', gcy.currencyBalance('Mithral') === 75 && gcy.data.shards === shBefore, `m=${gcy.currencyBalance('Mithral')} sh=${gcy.data.shards}`);
      // sell credits the Mithral pool, not Shards.
      const rSell = sellTrade(gcy, clover(), 20, 'Mithral');
      ok('currency market: sell credits Mithral, not Shards', rSell.ok === true && gcy.currencyBalance('Mithral') === 95 && gcy.data.shards === shBefore && !gcy.hasItem('four-leaf clover'), `m=${gcy.currencyBalance('Mithral')} sh=${gcy.data.shards}`);
      // Shards-currency (or blank) still uses the purse — no regression.
      const gsh = GameState.create({ name: 'Sh', gender: 'm', profession: 'Warrior', book: 2, adv });
      gsh.data.shards = 100;
      ok('blank currency still spends Shards', buyTrade(gsh, clover(), 25, null).ok === true && gsh.data.shards === 75 && gsh.currencyBalance('Mithral') === 0);
      // multiplyCurrency floors and clamps.
      gcy.multiplyCurrency('Mithral', 0.5);
      ok('multiplyCurrency floors', gcy.currencyBalance('Mithral') === 47, `m=${gcy.currencyBalance('Mithral')}`);

      // render §2.495: the Mithral market's Buy buttons are disabled with 0 Mithral
      // (Shards can't be spent there) and priced in Mithral.
      const gr = GameState.create({ name: 'Rr', gender: 'm', profession: 'Warrior', book: 2, adv });
      gr.data.shards = 9999;
      const cr = document.createElement('div');
      const st495 = new Story(cr, gr, { navigate(){}, onDeath(){}, notify(){} });
      const sec495 = await data.getSection(2, '495');
      st495.begin(sec495, 2, '495');
      const buyBtns = Array.from(cr.querySelectorAll('.market .btn-mini')).filter((b) => /^Buy /.test(b.textContent));
      ok('§2.495 renders Mithral Buy buttons', buyBtns.length > 0, `n=${buyBtns.length}`);
      ok('§2.495 Buy buttons priced in Mithral', buyBtns.some((b) => /Mithral/.test(b.textContent)), buyBtns[0] && buyBtns[0].textContent);
      ok('§2.495 Buy disabled with 0 Mithral despite Shards', buyBtns.every((b) => b.disabled), `enabled=${buyBtns.filter((b)=>!b.disabled).length}`);

      // render §2.545: a <choice shards="1" currency="Mithral"> is gated on Mithral.
      const cr2 = document.createElement('div');
      const st545 = new Story(cr2, gr, { navigate(){}, onDeath(){}, notify(){} });
      const sec545 = await data.getSection(2, '545');
      st545.begin(sec545, 2, '545');
      const payChoice = Array.from(cr2.querySelectorAll('.choice')).find((b) => /Mithral/.test(b.textContent));
      ok('§2.545 Mithral choice priced in Mithral', !!payChoice && /1 Mithral/.test(payChoice.textContent), payChoice && payChoice.textContent);
      ok('§2.545 pay-Mithral choice disabled with 0 Mithral', !!payChoice && payChoice.disabled === true);
    }

    // --- item <effect> system: use / aura / wielded / ability + <sold> (task 41) ---
    {
      const mk = (kind, name, bonus, node) => makeItem(kind, name, bonus, null, [], eng.readItemEffects(node));

      // aura: while carried, an item adds to an ability / Defence.
      const gaura = GameState.create({ name: 'Au', gender: 'm', profession: 'Warrior', book: 5, adv });
      const stoneNode = parse('<weapon name="sword of stone"><effect type="aura" ability="defence" bonus="3"/></weapon>');
      const stoneEff = eng.readItemEffects(stoneNode);
      ok('readItemEffects: aura defence+3 parsed', stoneEff.length === 1 && stoneEff[0].type === 'aura' && stoneEff[0].ability === 'defence' && stoneEff[0].bonus === 3, JSON.stringify(stoneEff));
      const defBefore = gaura.defence();
      gaura.addItem(mk('weapon', 'sword of stone', 0, stoneNode));
      ok('aura defence+3 raises Defence', gaura.defence() === defBefore + 3, `${defBefore}->${gaura.defence()}`);
      const combBefore = gaura.ability('combat');
      gaura.addItem(mk('weapon', 'sword of metal', 0, parse('<weapon name="sword of metal"><effect type="aura" ability="combat" bonus="2"/></weapon>')));
      ok('aura combat+2 raises COMBAT while carried', gaura.ability('combat') === combBefore + 2, `${combBefore}->${gaura.ability('combat')}`);

      // aura ability="*": +1 to every core ability (ring of ultimate power).
      const gring = GameState.create({ name: 'Ri', gender: 'm', profession: 'Warrior', book: 5, adv });
      const chB = gring.ability('charisma'), scB = gring.ability('scouting');
      gring.addItem(mk('item', 'ring of ultimate power', 0, parse('<item name="ring of ultimate power"><effect type="aura" ability="*" bonus="1"/></item>')));
      ok('aura *+1 raises every ability', gring.ability('charisma') === chB + 1 && gring.ability('scouting') === scB + 1);

      // wielded: bonus counts only while the item is the wielded weapon.
      const gjd = GameState.create({ name: 'Jd', gender: 'm', profession: 'Warrior', book: 5, adv });
      gjd.data.items = gjd.data.items.filter((it) => it.kind !== 'weapon'); gjd.reconcileEquipment();
      const jdDefBefore = gjd.defence();
      gjd.addItem(mk('weapon', 'Jade Defender', 3, parse('<weapon name="Jade Defender" bonus="3"><effect type="wielded" ability="defence" bonus="3"/></weapon>')));
      ok('wielded weapon adds its bonus (combat) and wielded aura (defence)', gjd.defence() === jdDefBefore + 3 + 3, `${jdDefBefore}->${gjd.defence()}`);
      gjd.addItem(makeItem('weapon', 'greatsword', 5)); // now the wielded weapon; Jade Defender is not
      ok('wielded aura drops when the item is not wielded', gjd.auraBonus('defence') === 0, `aura=${gjd.auraBonus('defence')}`);

      // use potion (ability): a Drink that boosts the ability for the section, one shot.
      const gpot = GameState.create({ name: 'Po', gender: 'm', profession: 'Warrior', book: 4, adv });
      const potEff = eng.readItemEffects(parse('<item name="potion of strength"><effect type="use" ability="combat"/></item>'));
      ok('use potion parsed: use/combat, uses=1, verb Drink, no body', potEff[0].type === 'use' && potEff[0].ability === 'combat' && potEff[0].uses === 1 && potEff[0].verb === 'Drink' && potEff[0].body === null, JSON.stringify(potEff));
      gpot.addItem(makeItem('item', 'potion of strength', 0, null, [], potEff));
      const pit = gpot.data.items[gpot.data.items.length - 1];
      const combB2 = gpot.ability('combat');
      const pr = eng.useItemEffect(gpot, pit, pit.effects[0], null);
      ok('drink potion: +1 COMBAT and item consumed (uses→0)', gpot.ability('combat') === combB2 + 1 && pr.removeItem === true, `combat ${combB2}->${gpot.ability('combat')} rm=${pr.removeItem}`);

      // potion bonus is section-scoped: cleared on entering a new section.
      gpot.addPotionBonus('scouting', 1);
      ok('potion bonus present before section change', gpot.potionBonusFor('scouting') === 1);
      const stClr = new Story(document.createElement('div'), gpot, { navigate(){}, onDeath(){}, notify(){} });
      stClr.begin(parse('<section name="9"><p>x</p></section>'), 4, '9');
      ok('potion bonus clears on entering a new section', gpot.potionBonusFor('scouting') === 0);

      // use with a body: potion of restoration heals all Stamina and cures poison/disease.
      const grest = GameState.create({ name: 'Re', gender: 'm', profession: 'Warrior', book: 1, adv });
      grest.damageStamina(6);
      grest.addAffliction('poison', { name: 'Scorpion Poison', effects: [], cumulative: false, lift: null });
      const restEff = eng.readItemEffects(parse('<item name="potion of restoration"><effect type="use" uses="1" verb="Drink"><rest/><lose poison="*"/><lose disease="*"/></effect></item>'));
      ok('restoration parsed: uses=1, body has rest+lose', restEff[0].uses === 1 && /rest/.test(restEff[0].body || '') && /lose/.test(restEff[0].body || ''), restEff[0].body);
      grest.addItem(makeItem('item', 'potion of restoration', 0, null, [], restEff));
      const rit = grest.data.items[grest.data.items.length - 1];
      const rBody = parse('<effect>' + rit.effects[0].body + '</effect>');
      const rr = eng.useItemEffect(grest, rit, rit.effects[0], rBody);
      ok('drink restoration: full Stamina, poison cured, consumed', grest.data.stamina === grest.data.staminaMax && !grest.hasPoison('Scorpion Poison') && rr.removeItem === true, `st=${grest.data.stamina}/${grest.data.staminaMax} poison=${grest.hasPoison('Scorpion Poison')}`);

      // use with an inner <goto>: the Vade Mecum consult navigates and is reusable.
      const gvm = GameState.create({ name: 'Vm', gender: 'm', profession: 'Warrior', book: 5, adv });
      const vmEff = eng.readItemEffects(parse('<item name="Vade Mecum"><effect type="use" verb="Consult" text="x"><desc>x</desc><goto book="5" section="550" hidden="t"/></effect></item>'));
      ok('vade mecum parsed: uses=-1 (reusable), verb Consult, goto body', vmEff[0].uses === -1 && vmEff[0].verb === 'Consult' && /goto/.test(vmEff[0].body || '') && !/desc/.test(vmEff[0].body || ''), JSON.stringify(vmEff));
      gvm.addItem(makeItem('item', 'Vade Mecum', 0, null, [], vmEff));
      const vit = gvm.data.items[gvm.data.items.length - 1];
      const vr = eng.useItemEffect(gvm, vit, vit.effects[0], parse('<effect>' + vit.effects[0].body + '</effect>'));
      ok('consult vade mecum: goto 5/550, not consumed', vr.goto && vr.goto.book === 5 && vr.goto.section === '550' && vr.removeItem === false && gvm.hasItem('Vade Mecum'), JSON.stringify(vr));

      // type="ability" effects (book4/332 Red Ague) apply via the affliction system.
      const gdis = GameState.create({ name: 'Di', gender: 'm', profession: 'Warrior', book: 4, adv });
      const chB2 = gdis.ability('charisma'), coB2 = gdis.ability('combat');
      eng.applyEffect(parse('<disease name="Red Ague"><effect type="ability" ability="charisma" bonus="-1"/><effect type="ability" ability="combat" bonus="-1"/></disease>'), gdis);
      ok('type=ability disease penalties apply (charisma-1, combat-1)', gdis.ability('charisma') === chB2 - 1 && gdis.ability('combat') === coB2 - 1 && gdis.hasDisease('Red Ague'));

      // market buy preserves item effects.
      const gbuy = GameState.create({ name: 'By', gender: 'm', profession: 'Warrior', book: 4, adv });
      gbuy.data.shards = 200;
      const potRow = parse('<item name="potion of strength" buy="100" sell="90"><effect type="use" ability="combat"/></item>');
      const potGoods = goodsFrom(potRow, 'item', 'potion of strength', 0);
      potGoods.effects = eng.readItemEffects(potRow);
      buyTrade(gbuy, potGoods, 100);
      const boughtPot = gbuy.findItems('potion of strength')[0];
      ok('market buy preserves item <effect>', boughtPot && (boughtPot.effects || []).length === 1 && boughtPot.effects[0].type === 'use', JSON.stringify(boughtPot && boughtPot.effects));

      // <sold> item-level hook (book3/86): selling the pirate captain's head marks a codeword.
      const gs86 = GameState.create({ name: 'S8', gender: 'm', profession: 'Warrior', book: 3, adv });
      gs86.addItem(makeItem('item', "pirate captain's head"));
      const cs86 = document.createElement('div');
      const st86 = new Story(cs86, gs86, { navigate(){}, onDeath(){}, notify(){} });
      st86.begin(await data.getSection(3, '86'), 3, '86');
      const row86 = Array.from(cs86.querySelectorAll('.trade')).find((r) => /Pirate Captain/i.test(r.textContent));
      const sell86 = row86 && Array.from(row86.querySelectorAll('.btn-mini')).find((b) => /Sell/.test(b.textContent));
      ok('§3.86 pirate head row has a Sell button', !!sell86);
      sell86 && sell86.click();
      ok('§3.86 selling fires item <sold> → codeword 3.86.sold', gs86.hasCodeword('3.86.sold') && !gs86.hasItem("pirate captain's head"));

      // <sold> market-level hook (book3/318): selling a 318.free item marks a codeword.
      const gs318 = GameState.create({ name: 'S3', gender: 'm', profession: 'Warrior', book: 3, adv });
      gs318.addItem(makeItem('item', 'candle', 0, null, ['318.free', 'light', 'useonce']));
      const cs318 = document.createElement('div');
      const st318 = new Story(cs318, gs318, { navigate(){}, onDeath(){}, notify(){} });
      st318.begin(await data.getSection(3, '318'), 3, '318');
      const row318 = Array.from(cs318.querySelectorAll('.trade')).find((r) => /Candle/i.test(r.textContent));
      const sell318 = row318 && Array.from(row318.querySelectorAll('.btn-mini')).find((b) => /Sell/.test(b.textContent));
      ok('§3.318 candle row has a Sell button', !!sell318);
      sell318 && sell318.click();
      ok('§3.318 selling a 318.free item fires market <sold> → codeword 3.318.sold', gs318.hasCodeword('3.318.sold'));

      // task 58: the <sold> hook must match the SOLD possession's tags, not the shop
      // row's buytags. Selling a starting leather jerkin (no 318.free tag) through the
      // generic "leather" row must NOT fire the hook (was: cobblestone punishment §372).
      const gs318a = GameState.create({ name: 'S3a', gender: 'm', profession: 'Warrior', book: 3, adv });
      const cs318a = document.createElement('div');
      const st318a = new Story(cs318a, gs318a, { navigate(){}, onDeath(){}, notify(){} });
      st318a.begin(await data.getSection(3, '318'), 3, '318');
      const leatherRowA = Array.from(cs318a.querySelectorAll('.trade')).find((r) => /Leather/i.test(r.textContent));
      const sellLeatherA = leatherRowA && Array.from(leatherRowA.querySelectorAll('.btn-mini')).find((b) => /Sell/.test(b.textContent));
      ok('§3.318 leather armour row has a Sell button (starting jerkin)', !!sellLeatherA && !sellLeatherA.disabled);
      sellLeatherA && sellLeatherA.click();
      ok('§3.318 selling a NON-free leather does NOT fire the hook', !gs318a.hasCodeword('3.318.sold'));

      // but selling an armour that WAS obtained free there (carries 318.free) fires it.
      const gs318b = GameState.create({ name: 'S3b', gender: 'm', profession: 'Warrior', book: 3, adv });
      gs318b.data.items = gs318b.data.items.filter((i) => i.kind !== 'armour');
      gs318b.addItem(makeItem('armour', 'leather', 1, null, ['318.free']));
      const cs318b = document.createElement('div');
      const st318b = new Story(cs318b, gs318b, { navigate(){}, onDeath(){}, notify(){} });
      st318b.begin(await data.getSection(3, '318'), 3, '318');
      const leatherRowB = Array.from(cs318b.querySelectorAll('.trade')).find((r) => /Leather/i.test(r.textContent));
      const sellLeatherB = leatherRowB && Array.from(leatherRowB.querySelectorAll('.btn-mini')).find((b) => /Sell/.test(b.textContent));
      sellLeatherB && sellLeatherB.click();
      ok('§3.318 selling a 318.free leather DOES fire the hook', gs318b.hasCodeword('3.318.sold'));

      // Adventure Sheet Use affordance (ui.js): a usable item shows a verb button that
      // fires the onUse callback; a non-usable item (aura sword) shows none.
      const gsheet = GameState.create({ name: 'Sh', gender: 'm', profession: 'Warrior', book: 4, adv });
      gsheet.data.items = [];
      gsheet.addItem(makeItem('item', 'potion of strength', 0, null, [], eng.readItemEffects(parse('<item name="potion of strength"><effect type="use" ability="combat"/></item>'))));
      gsheet.addItem(makeItem('weapon', 'sword of stone', 0, null, [], eng.readItemEffects(parse('<weapon name="sword of stone"><effect type="aura" ability="defence" bonus="3"/></weapon>'))));
      const sheetBox = document.createElement('div');
      let used = null;
      renderSheet(gsheet, sheetBox, { onUse: (it, eff) => { used = { it, eff }; } });
      const useBtns = Array.from(sheetBox.querySelectorAll('.item-use'));
      ok('sheet shows exactly one Use button (potion, not the aura sword)', useBtns.length === 1 && /Drink/.test(useBtns[0].textContent), `n=${useBtns.length} txt=${useBtns[0] && useBtns[0].textContent}`);
      useBtns[0] && useBtns[0].click();
      ok('sheet Use button fires onUse with the item + effect', !!used && used.it.name === 'potion of strength' && used.eff.type === 'use');

      // Foreign-currency balances surface on the sheet beside Shards (task 139).
      const gcur = GameState.create({ name: 'Cur', gender: 'm', profession: 'Warrior', book: 2, adv });
      gcur.adjustCurrency('Mithral', 15);
      gcur.adjustCurrency('Scila', 0); // zero balance must stay hidden
      const curBox = document.createElement('div');
      renderSheet(gcur, curBox, {});
      const curKvs = Array.from(curBox.querySelectorAll('.sheet-line .kv')).map((k) => k.textContent);
      ok('sheet shows a non-zero foreign balance (Mithral 15)', curKvs.some((t) => /Mithral/.test(t) && /15/.test(t)), `kvs=${JSON.stringify(curKvs)}`);
      ok('sheet hides a zero foreign balance (Scila)', !curKvs.some((t) => /Scila/.test(t)));

      // task 145: a paid item="?" tags= choice must CONSUME through the same tag-aware
      // matcher it validates with — a name-only take would validate then leave the item.
      const gpc = GameState.create({ name: 'Pc', gender: 'm', profession: 'Warrior', book: 1, adv });
      gpc.data.items = [];
      gpc.addItem(makeItem('item', 'brass lantern', 0, null, ['light']));
      const beforePc = gpc.itemCount();
      const resPc = payChoiceCost(gpc, { pay: true, item: '?', itemTags: 'light' });
      ok('task145: paid item="?" tags= choice validates', resPc.ok === true);
      ok('task145: ...and actually consumes the tagged item', gpc.itemCount() === beforePc - 1 && !gpc.hasItemMatch('?', 'light'));
    }

    // --- save-slot exhaustion never silently overwrites slot 0 (task 4) ---
    {
      const savedMeta = localStorage.getItem('fl_meta');
      const full = {}; for (let i = 0; i < 20; i++) full[i] = { name: 'occupied' + i };
      localStorage.setItem('fl_meta', JSON.stringify(full));
      ok('nextFreeSlot returns null when all 20 slots full', nextFreeSlot() === null);
      let fullThrew = false; try { importSave({ abilities: { combat: 4 }, stamina: 5 }); } catch { fullThrew = true; }
      ok('import throws (does not overwrite) when full', fullThrew === true);
      if (savedMeta == null) localStorage.removeItem('fl_meta'); else localStorage.setItem('fl_meta', savedMeta);
    }

    // --- ephemeral (preview / ?demo=) game must not persist until kept (task 4) ---
    const gep = GameState.create({ name: 'Demo', gender: 'm', profession: 'Warrior', book: 1, adv });
    gep.slot = 18; gep.ephemeral = true; gep.data.shards = 4242; gep.changed(); // would normally write
    ok('ephemeral game writes nothing to storage', localStorage.getItem('fl_save_18') === null && !loadSlotMeta()[18]);
    const keptSlot = gep.keep();
    ok('keep() assigns a real slot and clears ephemeral', keptSlot != null && gep.ephemeral === false);
    ok('keep() persists the game', !!readSlotData(keptSlot) && readSlotData(keptSlot).shards === 4242);
    deleteSlot(keptSlot); // cleanup

    // --- task 79: keep()/importSave() must not report success when the write fails ---
    {
      // keep(): a failed write leaves the game an ephemeral preview on its old slot.
      const gkf = GameState.create({ name: 'KeepFail', gender: 'm', profession: 'Warrior', book: 1, adv });
      gkf.slot = 0; gkf.ephemeral = true; gkf.data.shards = 777;
      const beforeMeta = JSON.stringify(loadSlotMeta());
      localStorage.setItem = () => { const e = new Error('quota'); e.name = 'QuotaExceededError'; throw e; };
      let keepThrew = false, keepMsg = '';
      try { gkf.keep(); } catch (e) { keepThrew = true; keepMsg = e.message; }
      delete localStorage.setItem; // revert to Storage.prototype.setItem
      ok('keep() throws when the write fails', keepThrew === true);
      ok('keep() reverts to an ephemeral preview on failure', gkf.ephemeral === true && gkf.slot === 0);
      ok('keep() failure raises the storage message', /full/i.test(keepMsg), keepMsg);
      ok('keep() failure writes nothing to storage', JSON.stringify(loadSlotMeta()) === beforeMeta);
      const recSlot = gkf.keep(); // recovery: now succeeds and persists
      ok('keep() recovers once storage works', recSlot != null && gkf.ephemeral === false && !!readSlotData(recSlot));
      deleteSlot(recSlot);

      // importSave(): a failed write must not claim a slot or report success.
      const impData = { abilities: { COMBAT: 5, MAGIC: 4, SANCTITY: 3, SCOUTING: 4, THIEVERY: 3, CHARISMA: 4 }, stamina: 10, staminaMax: 10, name: 'ImpFail', profession: 'Warrior', book: 1, section: 1, rank: 2, shards: 0 };
      const beforeMeta2 = JSON.stringify(loadSlotMeta());
      const targetSlot = nextFreeSlot();
      localStorage.setItem = () => { const e = new Error('quota'); e.name = 'QuotaExceededError'; throw e; };
      let impThrew = false, impMsg = '';
      try { importSave(impData); } catch (e) { impThrew = true; impMsg = e.message; }
      delete localStorage.setItem;
      ok('importSave() throws when the write fails', impThrew === true);
      ok('importSave() failure raises the storage message', /full/i.test(impMsg), impMsg);
      ok('importSave() failure claims no slot and writes nothing',
        JSON.stringify(loadSlotMeta()) === beforeMeta2 && readSlotData(targetSlot) === null);
      const { slot: impOkSlot, meta: impOkMeta } = importSave(impData); // recovery
      ok('importSave() recovers with a real slot and named meta',
        impOkSlot != null && impOkMeta && impOkMeta.name === 'ImpFail');
      deleteSlot(impOkSlot);
    }

    // --- task 137: a save blob orphaned from its fl_meta entry must not vanish or be overwritten ---
    {
      const S = 'fl_save_', M = 'fl_meta';
      const savedMeta = localStorage.getItem(M);
      const usedSlots = [16, 17, 18, 19, 0, 4];
      const savedBlobs = usedSlots.map((i) => localStorage.getItem(S + i));
      const restore = () => {
        if (savedMeta == null) localStorage.removeItem(M); else localStorage.setItem(M, savedMeta);
        usedSlots.forEach((i, k) => { if (savedBlobs[k] == null) localStorage.removeItem(S + i); else localStorage.setItem(S + i, savedBlobs[k]); });
      };

      // 1) A blob whose meta entry was lost mid-save is reconstructed and re-listed.
      const g = GameState.create({ name: 'Orphan', gender: 'm', profession: 'Sage', book: 2, adv });
      g.slot = 17; g.data.shards = 321; g.save();
      const meta1 = loadSlotMeta(); delete meta1[17]; localStorage.setItem(M, JSON.stringify(meta1));
      ok('task137: an orphaned blob is present but missing from raw meta', !loadSlotMeta()[17] && !!readSlotData(17));
      const recon = reconcileSlotMeta();
      ok('task137: reconcile rebuilds the orphaned meta entry from the blob', !!recon[17] && recon[17].name === 'Orphan' && recon[17].profession === 'Sage', JSON.stringify(recon[17]));
      ok('task137: reconcile persists the repair', !!loadSlotMeta()[17]);

      // 2) nextFreeSlot treats a blob-only slot as occupied (never offered for overwrite).
      localStorage.removeItem(M);
      usedSlots.forEach((i) => localStorage.removeItem(S + i));
      localStorage.setItem(S + 0, JSON.stringify({ name: 'BlobOnly', abilities: {}, stamina: 5 }));
      ok('task137: nextFreeSlot never offers a blob-only slot', nextFreeSlot() !== 0);
      localStorage.removeItem(S + 0);

      // 3) A corrupt blob makes readSlotData return null (no uncaught throw on export).
      localStorage.setItem(S + 16, '{not valid json');
      let readThrew = false, readVal = 'x';
      try { readVal = readSlotData(16); } catch { readThrew = true; }
      ok('task137: readSlotData returns null for a corrupt blob, no throw', readThrew === false && readVal === null);
      localStorage.removeItem(S + 16);

      // 4) Corrupt meta JSON no longer orphans every slot — reconcile rebuilds from blobs.
      localStorage.setItem(M, 'totally-not-json');
      localStorage.setItem(S + 4, JSON.stringify({ name: 'Rebuilt', profession: 'Warrior', rank: 2, book: 1, section: '1', updated: 1, abilities: {}, stamina: 9 }));
      const recon2 = reconcileSlotMeta();
      ok('task137: corrupt meta is rebuilt from readable blobs', !!recon2[4] && recon2[4].name === 'Rebuilt', JSON.stringify(recon2[4]));

      restore();
    }

    // --- task 12: focused unit tests for the extracted rules --------------
    // The every-section scan catches throws; these assert combat/economy/rest
    // OUTCOMES on the DOM-free modules. Scoped to the gaps not already covered
    // (over-Defence miss, fightdamage add/replace, cargo cap and fixed rest are
    // tested elsewhere): a decisive win, a decisive death, the 12-item buy cap,
    // and a dice-amount rest.

    // A fight the player must WIN: a defenceless, near-dead enemy that can't hurt
    // a high-Stamina hero. Ends with outcome='win', enemy down, hero alive.
    const g12w = GameState.create({ name:'W12', gender:'m', profession:'Warrior', book:1, adv });
    g12w.data.stamina = 500; g12w.data.staminaMax = 500;
    const fWin = { name:'Straw', combat:0, defence:0, stamina:5, maxStamina:5, winThreshold:0, playerFirst:true, outcome:null, log:[] };
    let gw12 = 0; while (!fWin.outcome && !g12w.isDead() && gw12++ < 200) fightRound(g12w, fWin, null);
    ok('task12: a decisive fight ends in a win (enemy down, hero alive)', fWin.outcome === 'win' && fWin.stamina <= 0 && !g12w.isDead(), `outcome=${fWin.outcome} enemy=${fWin.stamina} dead=${g12w.isDead()}`);

    // A fight the player must LOSE: an enemy that strikes first for lethal damage
    // and whose Defence the hero can never beat. Ends with the hero dead, not a win.
    const g12d = GameState.create({ name:'D12', gender:'m', profession:'Warrior', book:1, adv });
    g12d.data.stamina = 12; g12d.data.staminaMax = 12;
    const fDie = { name:'Titan', combat:100, defence:100, stamina:100, maxStamina:100, winThreshold:0, playerFirst:false, outcome:null, log:[] };
    let gd = 0; while (!fDie.outcome && !g12d.isDead() && gd++ < 200) fightRound(g12d, fDie, null);
    ok('task12: an unwinnable fight kills the hero (not a win)', g12d.isDead() && fDie.outcome !== 'win', `dead=${g12d.isDead()} outcome=${fDie.outcome} stam=${g12d.data.stamina}`);

    // 12-item carry cap: a buy is refused when the sheet is full, with no Shards
    // spent (the cap check precedes payment in buyTrade); freeing a slot lets it
    // through and charges.
    const g12c = GameState.create({ name:'C12', gender:'m', profession:'Warrior', book:1, adv });
    g12c.data.items = []; for (let i = 0; i < 12; i++) g12c.addItem(makeItem('item', 'trinket ' + i));
    g12c.data.shards = 100;
    ok('task12: the sheet is full at 12 items (no free slots)', g12c.freeSlots() === 0 && g12c.itemCount() === 12);
    const rFull = buyTrade(g12c, goodsFrom(parse('<item name="ruby"/>'), 'item', 'ruby', 0), 10);
    ok('task12: buy refused at the 12-item cap, no Shards spent', rFull.ok === false && /12 items/.test(rFull.note || '') && g12c.data.shards === 100 && g12c.itemCount() === 12, `ok=${rFull.ok} note=${rFull.note} sh=${g12c.data.shards} n=${g12c.itemCount()}`);
    g12c.removeItemById(g12c.data.items[0].id);
    const rOk = buyTrade(g12c, goodsFrom(parse('<item name="ruby"/>'), 'item', 'ruby', 0), 10);
    ok('task12: with a free slot the buy succeeds and charges', rOk.ok === true && g12c.data.shards === 90 && g12c.hasItem('ruby'), `ok=${rOk.ok} sh=${g12c.data.shards}`);

    // Dice rest: applyRest with a "2d" amount heals the rolled total (clamped to
    // max). Forcing Math.random ⇒ 0 makes each d6 read 1, so 2d = 2 (deterministic).
    const g12rest = GameState.create({ name:'RR12', gender:'m', profession:'Warrior', book:1, adv });
    g12rest.data.staminaMax = 20; g12rest.data.stamina = 5;
    const _rr12 = Math.random; Math.random = () => 0;
    const healed2d = eng.applyRest(g12rest, '2d', 0);
    Math.random = _rr12;
    ok('task12: a dice rest ("2d") heals the rolled total', healed2d === 2 && g12rest.data.stamina === 7, `healed=${healed2d} st=${g12rest.data.stamina}`);

    // --- task 32: previously unhandled tags (<field>, <extrachoice>) -------
    { // block-scoped so its consts can't collide with the rest of run()
      // <field>: a live codeword-counter readout (label + value, 0 if unset).
      const g32 = GameState.create({ name:'F32', gender:'m', profession:'Warrior', book:1, adv });
      g32.setCodewordValue('Bonus', 3);
      const c32 = document.createElement('div');
      const st32 = new Story(c32, g32, { navigate(){}, onDeath(){}, notify(){} });
      st32.begin(parse('<section name="t"><p><field name="Bonus" label="Bribery bonus"/></p></section>'), 1, 't');
      const fld = c32.querySelector('.field');
      ok('task32: <field> shows label + codeword value', !!fld && /Bribery bonus:\s*3/.test(fld.textContent), fld && fld.textContent);

      // <extrachoice>: register at §122, surface at target §10, navigate to §460.
      const g32b = GameState.create({ name:'X32', gender:'m', profession:'Warrior', book:1, adv });
      let nav32 = null;
      const c32b = document.createElement('div');
      const st32b = new Story(c32b, g32b, { navigate:(b,s)=>{ nav32 = { b, s }; }, onDeath(){}, notify(){} });
      st32b.begin(parse('<section name="122"><p>Note <extrachoice atbook="1" atsection="10" book="1" section="460" text="Enter the sewers" key="YellowportSewers">this option</extrachoice>. <goto section="10"/></p></section>'), 1, '122');
      ok('task32: <extrachoice> registers the keyed choice', g32b.data.extraChoices.length === 1 && g32b.data.extraChoices[0].key === 'YellowportSewers' && g32b.data.extraChoices[0].section === '460', JSON.stringify(g32b.data.extraChoices));
      ok('task32: the note text renders inline (no button) at the registering section', !c32b.querySelector('.extra-choice') && /this option/.test(c32b.textContent));
      st32b.begin(parse('<section name="10"><p>Yellowport. <goto section="1"/></p></section>'), 1, '10');
      const xcBtn = c32b.querySelector('.extra-choice');
      ok('task32: the extra choice surfaces at its target section', !!xcBtn && /Enter the sewers/.test(xcBtn.textContent), xcBtn && xcBtn.textContent);
      xcBtn && xcBtn.click();
      ok('task32: activating the extra choice navigates to its target', nav32 && nav32.b === 1 && nav32.s === '460', JSON.stringify(nav32));

      // Same key replaces; <extrachoice remove> lifts it.
      st32b.begin(parse('<section name="327"><extrachoice atbook="1" atsection="10" section="327" key="YellowportSewers" text="Secret cache">note</extrachoice></section>'), 1, '327');
      ok('task32: a same-key <extrachoice> replaces the earlier one', g32b.data.extraChoices.length === 1 && g32b.data.extraChoices[0].text === 'Secret cache' && g32b.data.extraChoices[0].section === '327');
      st32b.begin(parse('<section name="t"><extrachoice remove="YellowportSewers"/></section>'), 1, 't');
      ok('task32: <extrachoice remove> lifts the keyed choice', g32b.data.extraChoices.length === 0);

      // tag="temple" mode + save round-trip.
      const g32t = GameState.create({ name:'T32', gender:'m', profession:'Warrior', book:5, adv });
      const c32t = document.createElement('div');
      const st32t = new Story(c32t, g32t, { navigate(){}, onDeath(){}, notify(){} });
      st32t.begin(parse('<section name="535"><extrachoice key="TargdazRecall" text="Targdaz Recall" tag="temple" book="5" section="14">note</extrachoice></section>'), 5, '535');
      const round32 = sanitizeData(JSON.parse(JSON.stringify(g32t.data)));
      ok('task32: extraChoices survive a sanitize round-trip', round32.extraChoices.length === 1 && round32.extraChoices[0].tag === 'temple' && round32.extraChoices[0].section === '14', JSON.stringify(round32.extraChoices));
      st32t.begin(parse('<section name="141" tag="temple"><p>A temple. <goto section="1"/></p></section>'), 5, '141');
      ok('task32: a tag="temple" extra choice surfaces at a temple section', !!c32t.querySelector('.extra-choice') && /Targdaz Recall/.test(c32t.textContent));
      st32t.begin(parse('<section name="99"><p>Not a temple. <goto section="1"/></p></section>'), 5, '99');
      ok('task32: it does NOT surface at a non-temple section', !c32t.querySelector('.extra-choice'));
    }

    // --- task 64: asset-only releases invalidate the PWA cache + illus precache ---
    { // block-scoped
      const swSrc = await (await fetch('./sw.js')).text();
      // The cache name is 'fl-<build stamp>'. Since the stamp now hashes
      // web/assets/, an asset-only change moves this key and installs refresh.
      ok('task64: sw.js declares a versioned cache key',
         /const VERSION = 'fl-\d\d\.\d\d\.\d\d\.[0-9a-f]+';/.test(swSrc),
         (swSrc.match(/const VERSION = '[^']*'/) || [])[0]);

      // The three section illustrations must be in the precache list, encoded the
      // same way render.js requests them (encodeURIComponent) so the cache key
      // matches — otherwise an offline player never gets them.
      const illusNames = ['Forest of the Forsaken.JPG', 'Map of Bazalek Isle.JPG', 'TheBlackDiptych.jpg'];
      const illusUrls = illusNames.map((n) => 'assets/illus/' + encodeURIComponent(n));
      ok('task64: sw precache lists all three illustrations (render.js-encoded)',
         illusUrls.every((u) => swSrc.includes(u)),
         illusUrls.filter((u) => !swSrc.includes(u)).join(', '));

      // Every precached ./ URL must resolve to a real file: a misnamed or wrongly
      // encoded entry would silently miss and never match the runtime request.
      const precache = [...swSrc.matchAll(/'\.\/([^']+)'/g)]
        .map((m) => m[1])
        .filter((u) => /^(assets|data|css|js)\//.test(u) || u.endsWith('.html') || u.endsWith('.webmanifest'));
      const missing = [];
      for (const u of precache) {
        const r = await fetch('./' + u, { method: 'HEAD' });
        if (!r.ok) missing.push(u);
      }
      ok('task64: every precached asset URL is fetchable', missing.length === 0, 'missing: ' + missing.join(', '));
    }

    // --- task 138: an offline navigation carrying a query string must still resolve to ---
    // the cached shell. The precache stores the query-less shell ('./', './index.html'), so
    // an exact match on ./?seed=42 (README's deep-link hooks) misses; the fix retries a
    // navigation with { ignoreSearch: true }, which matches by dropping the search string.
    // Assert the sw.js source contract plus the URL-normalisation contract ignoreSearch
    // implements (a live-CacheStorage round-trip hangs under headless Chrome and is left to
    // the manual offline test the task also prescribes).
    { // block-scoped
      const swSrc138 = await (await fetch('./sw.js')).text();
      ok('task138: sw.js retries a navigation request with ignoreSearch',
         /req\.mode === 'navigate'.*ignoreSearch: true/.test(swSrc138),
         (swSrc138.match(/req\.mode === 'navigate'[^\n]*/) || [])[0]);
      // The precached shell keys carry no query; only ./ and ./index.html back a navigation.
      const shellKeys = [...swSrc138.matchAll(/'(\.\/(?:index\.html)?)'/g)].map((m) => m[1]);
      ok('task138: the precache still stores the query-less shell keys',
         shellKeys.includes('./') && shellKeys.includes('./index.html'), shellKeys.join(','));
      // ignoreSearch matches by comparing URLs without their search string: a deep-link
      // navigation differs from the shell key ONLY by that search, so dropping it matches.
      const shellUrl = new URL('./', location.href).href;
      const navUrl = new URL('./?seed=42', location.href);
      ok('task138: a query-string navigation differs from the shell only by its search',
         navUrl.href !== shellUrl && (navUrl.origin + navUrl.pathname) === shellUrl,
         navUrl.href + ' vs ' + shellUrl);
    }

    // --- task 33: narrate sections whose prose is bare text (no <p> wrapper) ---
    { // block-scoped
      const nar = new Narrator();
      const g33 = GameState.create({ name:'N33', gender:'m', profession:'Warrior', book:1, adv });

      // book4/16: all prose is bare text + inline widgets directly in .flow — the
      // exact shape that used to yield 0 chunks (button silently did nothing).
      const c16 = document.createElement('div');
      const st16 = new Story(c16, g33, { navigate(){}, onDeath(){}, notify(){} });
      st16.begin(await data.getSection(4, 16), 4, '16');
      const flow16 = c16.querySelector('.flow');
      const canBefore = nar.supported ? nar.canNarrate(flow16) : true; // read pristine DOM first
      const n16 = nar.prepare(flow16);
      const spoken16 = nar.chunks.map((c) => c.text).join(' ');
      ok('task33: a bare-text section yields narration chunks', n16 > 0, 'chunks=' + n16);
      ok('task33: the bare prose is captured', /trampled by many of the herd/.test(spoken16), spoken16.slice(0, 60));
      ok('task33: canNarrate agrees (pristine DOM has prose)', canBefore === true);

      // book2/745: bare text + an active <else> branch whose prose is appended
      // straight into .flow (no <p>). Its words must be narrated too.
      const c745 = document.createElement('div');
      const st745 = new Story(c745, g33, { navigate(){}, onDeath(){}, notify(){} });
      st745.begin(await data.getSection(2, 745), 2, '745');
      const flow745 = c745.querySelector('.flow');
      const n745 = nar.prepare(flow745);
      const spoken745 = nar.chunks.map((c) => c.text).join(' ');
      ok('task33: else-branch prose narrates', n745 > 0 && /underestimated the potency/.test(spoken745), 'chunks=' + n745);

      // A choices-only section is genuinely empty of prose → 0 chunks, button off.
      const cEmpty = document.createElement('div');
      const stE = new Story(cEmpty, g33, { navigate(){}, onDeath(){}, notify(){} });
      stE.begin(parse('<section name="t"><choices><choice section="2">Onward</choice></choices></section>'), 1, 't');
      const flowE = cEmpty.querySelector('.flow');
      const canEmpty = nar.supported ? nar.canNarrate(flowE) : false;
      const nE = nar.prepare(flowE);
      ok('task33: a choices-only section yields no chunks', nE === 0, 'chunks=' + nE);
      ok('task33: canNarrate is false when there is nothing to read', canEmpty === false);

      // A normal <p>-wrapped section still narrates (no regression) and wrapping
      // is idempotent (re-preparing the same DOM keeps the same chunk count).
      const cP = document.createElement('div');
      const stP = new Story(cP, g33, { navigate(){}, onDeath(){}, notify(){} });
      stP.begin(parse('<section name="t"><p>First sentence here. Second sentence too.</p><p>A third one. <goto section="2"/></p></section>'), 1, 't');
      const flowP = cP.querySelector('.flow');
      const nP1 = nar.prepare(flowP);
      const nP2 = nar.prepare(flowP);
      ok('task33: <p> sections still narrate and prepare is idempotent', nP1 >= 3 && nP2 === nP1, `p1=${nP1} p2=${nP2}`);
    }

    // --- task 34: rules moved out of the view layer -------------------------
    { // block-scoped
      // Crew upgrade one-grade-at-a-time rule now lives in market.canUpgradeCrew,
      // and applyInlineBuy enforces it (not just the disabled button).
      const gc = GameState.create({ name:'C34', gender:'m', profession:'Warrior', book:1, adv });
      gc.data.shards = 500;
      gc.addShip({ type:'barque', name:'S', crew:'poor', cargo:[], docked:null });
      ok('task34: canUpgradeCrew allows one grade up', canUpgradeCrew(gc, 'average').ok === true);
      ok('task34: canUpgradeCrew refuses a two-grade jump', canUpgradeCrew(gc, 'good').ok === false);
      const jump = applyInlineBuy(gc, { price: 50, crew: 'good' });
      ok('task34: applyInlineBuy refuses the two-grade jump + spends nothing', jump.ok === false && gc.data.shards === 500 && gc.ships[0].crew === 'poor', `ok=${jump.ok} sh=${gc.data.shards} crew=${gc.ships[0].crew}`);
      const step = applyInlineBuy(gc, { price: 50, crew: 'average' });
      ok('task34: applyInlineBuy applies a one-grade upgrade + charges', step.ok === true && gc.data.shards === 450 && gc.ships[0].crew === 'average');
      ok('task34: now good is one grade up', canUpgradeCrew(gc, 'good').ok === true);
      const gns = GameState.create({ name:'NS34', gender:'m', profession:'Warrior', book:1, adv });
      ok('task34: canUpgradeCrew refuses with no ship', canUpgradeCrew(gns, 'average').ok === false);

      // Choice-cost transaction now lives in market.payChoiceCost.
      const gp = GameState.create({ name:'P34', gender:'m', profession:'Warrior', book:1, adv });
      gp.data.shards = 100;
      payChoiceCost(gp, { pay: false, cost: 30 });
      ok('task34: payChoiceCost with pay=false charges nothing', gp.data.shards === 100);
      payChoiceCost(gp, { pay: true, cost: 30 });
      ok('task34: payChoiceCost deducts Shards when paying', gp.data.shards === 70);
      gp.addItem(makeItem('item', 'green gem'));
      payChoiceCost(gp, { pay: true, cost: 0, item: 'green gem' });
      ok('task34: payChoiceCost consumes the required item', !gp.hasItem('green gem'));
      gp.adjustCurrency('Mithral', 10);
      payChoiceCost(gp, { pay: true, cost: 4, currency: 'Mithral', foreignCoin: true });
      ok('task34: payChoiceCost deducts a foreign currency, not Shards', gp.currencyBalance('Mithral') === 6 && gp.data.shards === 70, `mith=${gp.currencyBalance('Mithral')} sh=${gp.data.shards}`);
      // task 133: payChoiceCost re-validates against the live sheet and returns { ok }.
      ok('task133: payChoiceCost returns ok when paid', payChoiceCost(gp, { pay: true, cost: 10 }).ok === true && gp.data.shards === 60);
      const refuseItem = payChoiceCost(gp, { pay: true, cost: 0, item: 'green gem' });
      ok('task133: a required item that is gone refuses (ok:false), takes nothing', refuseItem.ok === false && gp.data.shards === 60);
      const refuseCash = payChoiceCost(gp, { pay: true, cost: 500 });
      ok('task133: an unaffordable cost refuses (ok:false), spends nothing', refuseCash.ok === false && gp.data.shards === 60);
      const refuseCoin = payChoiceCost(gp, { pay: true, cost: 99, currency: 'Mithral', foreignCoin: true });
      ok('task133: an unaffordable foreign cost refuses, spends nothing', refuseCoin.ok === false && gp.currencyBalance('Mithral') === 6);
    }

    // --- task 35: PNG apple-touch-icon + manifest PNG icons -----------------
    { // block-scoped — iOS Safari rejects SVG touch icons, so these must be PNG.
      const idx = await (await fetch('./index.html')).text();
      const atMatch = idx.match(/rel="apple-touch-icon"[^>]*href="([^"]+)"/);
      ok('task35: apple-touch-icon points to a PNG', !!atMatch && /\.png$/.test(atMatch[1]), atMatch && atMatch[1]);

      const manifest = JSON.parse(await (await fetch('./manifest.webmanifest')).text());
      const pngIcons = (manifest.icons || []).filter((i) => i.type === 'image/png');
      const sizes = pngIcons.map((i) => i.sizes);
      ok('task35: manifest offers PNG icons at 192 and 512', sizes.includes('192x192') && sizes.includes('512x512'), sizes.join(','));

      // The referenced PNGs must actually exist and decode at the declared size.
      const at = await fetch('./' + (atMatch ? atMatch[1] : 'assets/apple-touch-icon.png'));
      ok('task35: the apple-touch-icon PNG is fetchable', at.ok);
      const dims = await new Promise((res) => {
        const im = new Image();
        im.onload = () => res({ w: im.naturalWidth, h: im.naturalHeight });
        im.onerror = () => res(null);
        im.src = './assets/apple-touch-icon.png';
      });
      ok('task35: apple-touch-icon decodes at 180x180', dims && dims.w === 180 && dims.h === 180, JSON.stringify(dims));
    }

    // --- task 39: confiscate-and-return <transfer> deferred until the fight is won (book2/462) ---
    { // block-scoped
      const g462 = GameState.create({ name:'V462', gender:'m', profession:'Warrior', book:2, adv });
      g462.data.stamina = 100; g462.data.staminaMax = 100; // survive the vampire
      const startItems = g462.itemCount();
      const c462 = document.createElement('div');
      const st462 = new Story(c462, g462, { navigate(){}, onDeath(){}, notify(){} });
      st462.begin(await data.getSection(2, '462'), 2, '462');
      const afterConfiscate = g462.itemCount();
      // On entry the weapon+armour are stashed in cache 2.462, and the dead="f"
      // return leg must NOT fire yet (the vampire is fought unarmed).
      ok('task39: §462 confiscates gear on entry (moved to the cache)',
         afterConfiscate < startItems && g462.cacheItems('2.462').length === (startItems - afterConfiscate) && g462.cacheItems('2.462').length >= 2,
         `start=${startItems} after=${afterConfiscate} cache=${g462.cacheItems('2.462').length}`);
      ok('task39: §462 the return branch is held inactive mid-fight (grayed)', !!c462.querySelector('.cond-inactive'));
      ok('task39: §462 no weapon/armour back on the sheet during the fight',
         g462.data.items.every((i) => i.kind !== 'weapon' && i.kind !== 'armour'));
      // Win the fight → the dead="f" branch activates → the gear is handed back.
      st462.sectionFights.forEach((f) => { f.outcome = 'win'; });
      st462.rerender();
      ok('task39: §462 winning returns the stashed gear and empties the cache',
         g462.itemCount() === startItems && g462.cacheItems('2.462').length === 0,
         `n=${g462.itemCount()} start=${startItems} cache=${g462.cacheItems('2.462').length}`);
    }

    // --- task 69: bare post-fight <lose>/<gain> apply on the OUTCOME, not on entry ---
    { // block-scoped
      // §570: the "if you lose" penalties (staminato=1, shards=*) must be held for the
      // fight, not exacted the instant you arrive (the reported bug fought you at 1
      // Stamina and 0 Shards).
      const g570 = GameState.create({ name:'V570', gender:'m', profession:'Warrior', book:1, adv });
      g570.data.stamina = 20; g570.data.staminaMax = 20; g570.data.shards = 45;
      const c570 = document.createElement('div');
      const st570 = new Story(c570, g570, { navigate(){}, onDeath(){}, notify(){} });
      st570.begin(await data.getSection(1, '570'), 1, '570');
      ok('task69: §570 keeps Shards + Stamina on entry (penalty held for the fight)',
         g570.data.shards === 45 && g570.data.stamina === 20, `shards=${g570.data.shards} stam=${g570.data.stamina}`);
      st570.sectionFights.forEach((f) => { f.outcome = 'lose'; });
      st570.rerender();
      ok('task69: §570 losing drops you to 1 Stamina and strips every Shard',
         g570.data.stamina === 1 && g570.data.shards === 0, `stam=${g570.data.stamina} shards=${g570.data.shards}`);

      // §199: the "if you win" reward (gain 200) must not be paid on entry either.
      const g199 = GameState.create({ name:'V199', gender:'m', profession:'Warrior', book:1, adv });
      g199.data.stamina = 30; g199.data.staminaMax = 30; g199.data.shards = 10;
      const c199 = document.createElement('div');
      const st199 = new Story(c199, g199, { navigate(){}, onDeath(){}, notify(){} });
      st199.begin(await data.getSection(1, '199'), 1, '199');
      ok('task69: §199 does not pay the 200-Shard reward on entry', g199.data.shards === 10, `shards=${g199.data.shards}`);
      st199.sectionFights.forEach((f) => { f.outcome = 'win'; });
      st199.rerender();
      ok('task69: §199 winning pays the 200-Shard jewel reward', g199.data.shards === 210, `shards=${g199.data.shards}`);
    }

    // --- task 65: rules modal renders a heading-in-row as a <th>, not a nested <h3> ---
    { // block-scoped
      const doc65 = renderStatic(data.getMeta().quickRules);
      const tr65 = doc65.querySelector('table tr');
      ok('task65: QuickRules renders a table row', !!tr65);
      ok('task65: the row heading is a <th>, not a nested <hN>',
         !!tr65 && !!tr65.querySelector('th') && !tr65.querySelector('h1,h2,h3,h4,h5,h6'),
         tr65 && tr65.innerHTML);
      ok('task65: the header cell carries the heading text', !!tr65 && /Quick Rules/.test(tr65.querySelector('th').textContent));
      // A heading OUTSIDE a table still renders as a real heading element.
      const doc65b = renderStatic('<section><h4>ABILITIES</h4><table><tr><td>x</td></tr></table></section>');
      ok('task65: a heading outside a table stays an <hN>', !!doc65b.querySelector('h4') && !doc65b.querySelector('table th'));
    }

    // --- task 93: item group provenance + rolled itemAt losses -----------------
    { // block-scoped
      // makeItem carries the award's XML group; sanitizeData round-trips it.
      const it93 = makeItem('item', 'silver flute', 0, null, [], [], '5.238');
      ok('task93: makeItem records group provenance', it93.group === '5.238', String(it93.group));
      const g93sv = GameState.create({ name:'P93', gender:'m', profession:'Warrior', book:5, adv });
      g93sv.data.items = [makeItem('item', 'silver flute', 0, null, [], [], '5.238')];
      const g93rt = new GameState(sanitizeData(JSON.parse(JSON.stringify(g93sv.data))));
      ok('task93: group survives a save round-trip', g93rt.data.items[0].group === '5.238', String(g93rt.data.items[0].group));

      // §5.238/§5.118: <if item="?" group="5.238" greaterthan="1"> counts only the
      // tomb-haul items, not unrelated possessions.
      const g118 = GameState.create({ name:'T118', gender:'m', profession:'Warrior', book:5, adv });
      g118.data.items = [];
      g118.addItem(makeItem('item', 'rope'));      // unrelated
      g118.addItem(makeItem('item', 'lantern'));   // unrelated
      g118.addItem(makeItem('item', 'silver flute', 0, null, [], [], '5.238'));
      const ifGroup93 = parse('<if item="?" group="5.238" greaterthan="1"/>');
      ok('task93: one group item ⇒ "took more than one" is false', eng.evaluateCondition(ifGroup93, g118) === false);
      g118.addItem(makeItem('item', 'black axe', 0, null, [], [], '5.238'));
      ok('task93: two group items ⇒ "took more than one" is true (2 unrelated ignored)', eng.evaluateCondition(ifGroup93, g118) === true);

      // §3.94/§132/§413: same-named items from different groups do not collide.
      const g132 = GameState.create({ name:'T132', gender:'m', profession:'Warrior', book:3, adv });
      g132.data.items = [];
      const otherMap93 = g132.addItem(makeItem('item', 'treasure map', 0, null, [], [], '3.500')); // another island's map
      g132.addItem(makeItem('item', 'treasure map', 0, null, [], [], '3.94'));
      ok('task93: §413 sees the 3.94 map', eng.evaluateCondition(parse('<if item="treasure map" group="3.94"/>'), g132) === true);
      ok('task93: §413 does not see a wrong-group map', eng.evaluateCondition(parse('<if item="treasure map" group="9.99"/>'), g132) === false);
      eng.applyEffect(parse('<lose item="treasure map" group="3.94"/>'), g132, {});
      ok('task93: §132 crosses off only the 3.94 map', g132.data.items.length === 1 && g132.data.items[0].id === otherMap93.id, g132.data.items.map((i)=>i.group).join(','));

      // §5.578: "donate one of the items you found" removes ONE of the mission's three
      // rewards (group 5.578), never an unrelated possession — chooser & no-chooser.
      const mk578 = () => {
        const g = GameState.create({ name:'T578', gender:'m', profession:'Warrior', book:5, adv });
        g.data.items = [];
        g.addItem(makeItem('item', 'family heirloom'));                     // unrelated, must survive
        g.addItem(makeItem('tool', 'silver holy symbol', 2, 'sanctity', [], [], '5.578'));
        g.addItem(makeItem('weapon', 'fine sabre', 2, null, [], [], '5.578'));
        g.addItem(makeItem('item', 'Uttakin telescope', 0, null, [], [], '5.578'));
        return g;
      };
      const g578a = mk578();
      eng.applyEffect(parse('<lose item="?" group="5.578"/>'), g578a, {}); // no chooser → first group item
      ok('task93: §5.578 donation removes one mission item', g578a.data.items.length === 3);
      ok('task93: §5.578 keeps the unrelated heirloom', g578a.hasItem('family heirloom'));
      ok('task93: §5.578 removes a group-5.578 item', g578a.data.items.filter((i)=>i.group==='5.578').length === 2);
      const g578b = mk578();
      let offered578 = null;
      eng.applyEffect(parse('<lose item="?" group="5.578"/>'), g578b, { chooser: (m) => { offered578 = m; return [m.find((i)=>i.name==='fine sabre')]; } });
      ok('task93: §5.578 chooser is offered only the 3 group items', !!offered578 && offered578.length === 3 && offered578.every((i)=>i.group==='5.578'));
      ok('task93: §5.578 removes exactly the chosen group item', !g578b.data.items.some((i)=>i.name==='fine sabre') && g578b.data.items.length === 3);

      // <lose itemAt="x">: a rolled 1-based sheet index; out-of-range takes nothing.
      const gAt93 = GameState.create({ name:'TAt', gender:'m', profession:'Warrior', book:6, adv });
      gAt93.data.items = [];
      ['first','second','third'].forEach((nm) => gAt93.addItem(makeItem('item', nm)));
      gAt93.setVar('x', 2);
      eng.applyEffect(parse('<lose itemAt="x">the item</lose>'), gAt93, {});
      ok('task93: itemAt removes the x-th (1-based) sheet entry', gAt93.data.items.map((i)=>i.name).join(',') === 'first,third', gAt93.data.items.map((i)=>i.name).join(','));
      gAt93.setVar('x', 9);
      const atCount93 = gAt93.itemCount();
      eng.applyEffect(parse('<lose itemAt="x">the item</lose>'), gAt93, {});
      ok('task93: an out-of-range itemAt roll takes nothing', gAt93.itemCount() === atCount93);

      // §6.63 end-to-end: a penniless loser forfeits one possession chosen by a die
      // that must roll first — the loss is deferred until x is set (like §521).
      const g63 = GameState.create({ name:'T63', gender:'m', profession:'Warrior', book:6, adv });
      g63.data.shards = 0; g63.data.items = [];
      for (const nm of ['a63','b63','c63','d63','e63','f63']) g63.addItem(makeItem('item', nm)); // 6 items ⇒ any 1-6 roll is in range
      const start63 = g63.itemCount();
      const c63 = document.createElement('div');
      const st63 = new Story(c63, g63, { navigate(){}, onDeath(){}, notify(){} });
      st63.begin(await data.getSection(6, '63'), 6, '63');
      ok('task93: §63 takes nothing before the die is rolled', g63.itemCount() === start63, `count=${g63.itemCount()}`);
      ok('task93: §63 shows a roll button', !!c63.querySelector('.btn-roll'));
      c63.querySelector('.btn-roll').click();
      await new Promise((r) => setTimeout(r, 1000));
      const x63 = g63.getVar('x');
      ok('task93: §63 rolls 1-6 for the forfeit', x63 >= 1 && x63 <= 6, 'x='+x63);
      ok('task93: §63 forfeits exactly one possession after the roll', g63.itemCount() === start63 - 1, `count=${g63.itemCount()} x=${x63}`);

      // §5.14 typo fix: the botched-teleport <lose item="*" shards="*"> empties both,
      // and the source no longer carries the unsupported plural items="*".
      const s14 = await data.getSection(5, '14');
      const lose14 = s14.querySelector('lose[item], lose[items]');
      ok('task93: §5.14 uses singular item="*" (not items="*")', !!lose14 && lose14.getAttribute('item') === '*' && lose14.getAttribute('items') == null, lose14 && lose14.outerHTML);
      const g14 = GameState.create({ name:'T14', gender:'m', profession:'Warrior', book:5, adv });
      g14.data.shards = 500; g14.data.items = [];
      ['x14','y14'].forEach((nm) => g14.addItem(makeItem('item', nm)));
      eng.applyEffect(lose14, g14, {});
      ok('task93: §5.14 botched teleport empties possessions and cash', g14.itemCount() === 0 && g14.data.shards === 0, `items=${g14.itemCount()} shards=${g14.data.shards}`);
    }

    // --- task 94: quantity= on item awards, cargo ticks and market stock -------
    { // block-scoped
      // Fixed item quantity (§6.375: two axes) — one click per unit, up to N, done.
      const g375 = GameState.create({ name:'T375', gender:'m', profession:'Warrior', book:6, adv });
      g375.data.items = []; // clear starting gear so both axes fit
      const c375 = document.createElement('div');
      const st375 = new Story(c375, g375, { navigate(){}, onDeath(){}, notify(){} });
      st375.begin(await data.getSection(6, '375'), 6, '375');
      const axeBtn = () => Array.from(c375.querySelectorAll('.take-item')).find((b) => /axe/i.test(b.textContent));
      ok('task94: §375 offers a two-axe award, none taken yet', !!axeBtn() && /2 of 2 left/.test(axeBtn().textContent), axeBtn() && axeBtn().textContent);
      axeBtn().click();
      ok('task94: taking one axe leaves one available', g375.data.items.filter((i)=>i.name==='axe').length === 1 && /1 of 2 left/.test(axeBtn().textContent), axeBtn() && axeBtn().textContent);
      axeBtn().click();
      ok('task94: taking the second axe grants two and closes the row', g375.data.items.filter((i)=>i.name==='axe').length === 2 && axeBtn().disabled, axeBtn() && axeBtn().textContent);

      // Partial capacity: with one free slot only one of two axes fits; the rest waits.
      const gcap94 = GameState.create({ name:'Tcap', gender:'m', profession:'Warrior', book:6, adv });
      gcap94.data.items = [];
      for (let k = 0; k < 11; k++) gcap94.addItem(makeItem('item', 'filler'+k)); // 11 items → 1 free slot
      const ccap94 = document.createElement('div');
      const stcap94 = new Story(ccap94, gcap94, { navigate(){}, onDeath(){}, notify(){} });
      stcap94.begin(await data.getSection(6, '375'), 6, '375');
      const axeCap = () => Array.from(ccap94.querySelectorAll('.take-item')).find((b) => /axe/i.test(b.textContent));
      axeCap().click();
      ok('task94: partial capacity takes what fits (1 axe), holds the rest', gcap94.data.items.filter((i)=>i.name==='axe').length === 1 && gcap94.freeSlots() === 0 && axeCap().disabled && /1 of 2 left/.test(axeCap().textContent), axeCap() && axeCap().textContent);
      gcap94.removeItemById(gcap94.data.items.find((i)=>i.name==='filler0').id);
      stcap94.rerender();
      ok('task94: freeing a slot re-arms the held axe', !axeCap().disabled, axeCap() && axeCap().textContent);
      axeCap().click();
      ok('task94: the held axe can then be collected', gcap94.data.items.filter((i)=>i.name==='axe').length === 2);

      // Rolled item quantity (§1.561: x smoulder fish) — deferred until the die rolls.
      const g561 = GameState.create({ name:'T561', gender:'m', profession:'Warrior', book:1, adv });
      g561.data.items = [];
      const c561 = document.createElement('div');
      const st561 = new Story(c561, g561, { navigate(){}, onDeath(){}, notify(){} });
      st561.begin(await data.getSection(1, '561'), 1, '561');
      const fishBtn = () => Array.from(c561.querySelectorAll('.take-item')).find((b) => /fish/i.test(b.textContent));
      ok('task94: §561 fish award is disabled before the die rolls', !!fishBtn() && fishBtn().disabled, fishBtn() && fishBtn().textContent);
      ok('task94: §561 shows a roll button', !!c561.querySelector('.btn-roll'));
      c561.querySelector('.btn-roll').click();
      await new Promise((r) => setTimeout(r, 1000));
      const x561 = g561.getVar('x');
      ok('task94: §561 rolls 1-6 fish', x561 >= 1 && x561 <= 6, 'x='+x561);
      const liveFish = x561 > 1 ? new RegExp(`${x561} of ${x561} left`).test(fishBtn().textContent) : !/left/.test(fishBtn().textContent);
      ok('task94: after the roll the fish award is live for x units', !fishBtn().disabled && liveFish, fishBtn() && fishBtn().textContent);
      for (let k = 0; k < x561; k++) fishBtn().click();
      ok('task94: taking all rolled fish grants exactly x', g561.data.items.filter((i)=>i.name==='smoulder fish').length === x561 && fishBtn().disabled, `count=${g561.data.items.filter((i)=>i.name==='smoulder fish').length} x=${x561}`);

      // Quantity currency (§4.425: x lots of 1000 Shards) — each click banks 1000.
      const g425 = GameState.create({ name:'T425', gender:'m', profession:'Warrior', book:4, adv });
      g425.data.shards = 0;
      const c425 = document.createElement('div');
      const st425 = new Story(c425, g425, { navigate(){}, onDeath(){}, notify(){} });
      st425.begin(await data.getSection(4, '425'), 4, '425');
      const goldBtn = () => Array.from(c425.querySelectorAll('.take-item')).find((b) => /1000 shards/i.test(b.textContent));
      ok('task94: §425 gold award is disabled before the roll', !!goldBtn() && goldBtn().disabled);
      c425.querySelector('.btn-roll').click();
      await new Promise((r) => setTimeout(r, 1000));
      const x425 = g425.getVar('x');
      ok('task94: §425 rolls 1-6 lots', x425 >= 1 && x425 <= 6, 'x='+x425);
      for (let k = 0; k < x425; k++) goldBtn().click();
      ok('task94: collecting all lots banks x·1000 Shards, no slots used', g425.data.shards === x425 * 1000 && g425.itemCount() === 3 && goldBtn().disabled, `shards=${g425.data.shards} items=${g425.itemCount()} x=${x425}`);

      // <tick cargo quantity="2"> loads two units, capped by hold capacity.
      const gcar94 = GameState.create({ name:'Tcar', gender:'m', profession:'Warrior', book:3, adv });
      gcar94.data.ships = [];
      gcar94.addShip({ type:'brigantine', name:'Brig', crew:'average', cargo:[], docked:null }); // capacity 2, current vessel (at sea)
      eng.applyEffect(parse('<tick cargo="textiles" quantity="2"/>'), gcar94, {});
      ok('task94: <tick cargo quantity=2> loads two units on a brigantine', (gcar94.currentShip().cargo || []).filter((c)=>c==='textiles').length === 2, JSON.stringify(gcar94.currentShip().cargo));
      const gbarq94 = GameState.create({ name:'Tbq', gender:'m', profession:'Warrior', book:3, adv });
      gbarq94.data.ships = [];
      gbarq94.addShip({ type:'barque', name:'Bq', crew:'poor', cargo:[], docked:null }); // capacity 1
      eng.applyEffect(parse('<tick cargo="textiles" quantity="2"/>'), gbarq94, {});
      ok('task94: a full hold refuses the overflow — barque (cap 1) loads one', (gbarq94.currentShip().cargo || []).length === 1, JSON.stringify(gbarq94.currentShip().cargo));

      // One-ship market row (§6.655): the salvaged barque sells once, then is sold out.
      const g655 = GameState.create({ name:'T655', gender:'m', profession:'Warrior', book:6, adv });
      g655.data.shards = 500; g655.data.ships = [];
      const c655 = document.createElement('div');
      const st655 = new Story(c655, g655, { navigate(){}, onDeath(){}, notify(){} });
      st655.begin(await data.getSection(6, '655'), 6, '655');
      const buy655 = () => Array.from(c655.querySelectorAll('.trade .btn-mini')).find((b) => /buy|sold out/i.test(b.textContent));
      ok('task94: §655 offers the salvaged barque for 240', !!buy655() && /Buy 240/.test(buy655().textContent), buy655() && buy655().textContent);
      buy655().click();
      ok('task94: buying the barque adds one ship and charges 240', g655.data.ships.length === 1 && g655.data.shards === 260, `ships=${g655.data.ships.length} shards=${g655.data.shards}`);
      ok('task94: the one-off ship row is then sold out (no repeat purchase)', buy655().disabled && /sold out/i.test(buy655().textContent), buy655() && buy655().textContent);
    }

    // --- task 126: a collapsed <group> executes its <buy> children ---------------
    { // block-scoped
      // §5.192: claim the derelict Wrath of God — one group bundles "buy the brig for
      // 50 Shards" with "cross off the deed". Clicking must add the ship (docked here in
      // Kunrir, crew poor from initialCrew="none"), charge 50, and take the deed.
      const g192 = GameState.create({ name:'T192', gender:'m', profession:'Warrior', book:5, adv });
      g192.data.shards = 100; g192.data.ships = [];
      g192.addItem(makeItem('item', 'deed to the Wrath of God'));
      const c192 = document.createElement('div');
      const st192 = new Story(c192, g192, { navigate(){}, onDeath(){}, notify(){} });
      st192.begin(await data.getSection(5, '192'), 5, '192');
      const grp192 = Array.from(c192.querySelectorAll('.group-action')).find((x) => /50 shards/i.test(x.textContent));
      ok('task126: §192 shows the "50 Shards" claim group', !!grp192);
      ok('task126: §192 does not buy the ship on entry', g192.data.ships.length === 0 && g192.data.shards === 100);
      grp192.click();
      ok('task126: §192 claiming adds the brigantine, docked in Kunrir, crew poor', g192.data.ships.length === 1 && g192.data.ships[0].type === 'brigantine' && g192.data.ships[0].docked === 'Kunrir' && g192.data.ships[0].crew === 'poor', JSON.stringify(g192.data.ships));
      ok('task126: §192 claiming charges 50 Shards and crosses off the deed', g192.data.shards === 50 && g192.findItems('deed to the Wrath of God').length === 0, `sh=${g192.data.shards} deed=${g192.findItems('deed to the Wrath of God').length}`);

      // §4.622: salvage free cargo from a wreck — each commodity is a group bundling a
      // free <buy cargo> with a hidden-codeword tick. Clicking loads the cargo aboard a
      // ship here AND ticks the codeword, so the option can't be taken twice.
      const g622 = GameState.create({ name:'T622', gender:'m', profession:'Warrior', book:4, adv });
      g622.data.ships = [];
      g622.addShip({ type:'brigantine', name:'Hold', crew:'poor', cargo:[], docked:null }); // capacity 2; berths at Tigre Bay on entry
      const c622 = document.createElement('div');
      const st622 = new Story(c622, g622, { navigate(){}, onDeath(){}, notify(){} });
      st622.begin(await data.getSection(4, '622'), 4, '622');
      const metals622 = () => Array.from(c622.querySelectorAll('.group-action')).find((x) => /metals/i.test(x.textContent));
      ok('task126: §622 shows the three salvage groups', c622.querySelectorAll('.group-action').length === 3);
      ok('task126: §622 loads no cargo on entry', (g622.currentShip().cargo || []).length === 0 && !g622.hasCodeword('4.622.1'));
      metals622().click();
      ok('task126: §622 taking Metals loads the cargo aboard and ticks its codeword', (g622.currentShip().cargo || []).includes('metals') && g622.hasCodeword('4.622.1'), `cargo=${JSON.stringify(g622.currentShip().cargo)} cw=${g622.hasCodeword('4.622.1')}`);
      // Re-entry: its codeword now held, the Metals <if> branch renders grayed and
      // disabled (JaFL shows an untaken branch, doesn't hide it), so it can't be taken
      // twice; Minerals/Timber (codewords unheld) stay live.
      st622.begin(await data.getSection(4, '622'), 4, '622');
      const grpBtn622 = (re) => Array.from(c622.querySelectorAll('.group-action')).find((x) => re.test(x.textContent));
      ok('task126: §622 re-entry disables the already-taken Metals salvage', !!grpBtn622(/metals/i) && grpBtn622(/metals/i).disabled, `metals=${grpBtn622(/metals/i) && grpBtn622(/metals/i).disabled}`);
      ok('task126: §622 re-entry keeps the untaken Minerals salvage live', !!grpBtn622(/minerals/i) && !grpBtn622(/minerals/i).disabled);
    }

    // --- task 127: abbreviated cargo names canonicalise (JaFL prefix match) ------
    { // block-scoped
      // §4.252 Silk Market sells an abbreviated "meta" Unit; it must display and store as
      // the canonical "metals" so a full-name port can buy it back.
      const g252 = GameState.create({ name:'T252', gender:'m', profession:'Warrior', book:4, adv });
      g252.data.shards = 2000; g252.data.ships = [];
      g252.addShip({ type:'brigantine', name:'Trader', crew:'poor', cargo:[], docked:null }); // berths at Yarimura on entry
      const c252 = document.createElement('div');
      const st252 = new Story(c252, g252, { navigate(){}, onDeath(){}, notify(){} });
      st252.begin(await data.getSection(4, '252'), 4, '252');
      const metaRow = Array.from(c252.querySelectorAll('.trade')).find((r) => /metals/i.test(r.textContent));
      ok('task127: §252 shows the abbreviated "meta" row as canonical "Metals"', !!metaRow && /Metals/.test(metaRow.textContent), metaRow && metaRow.textContent);
      metaRow.querySelector('button').click();
      ok('task127: buying "meta" stores the canonical "metals" on the manifest', (g252.currentShip().cargo || []).includes('metals'), JSON.stringify(g252.currentShip().cargo));
      // The stored canonical Unit sells at a full-name port (sellTrade against a full-name row).
      const sh0252 = g252.data.shards;
      const soldOk = sellTrade(g252, goodsFrom(parse('<trade cargo="metals" sell="560"/>'), 'cargo', 'metals', 0), 560).ok;
      ok('task127: the "metals" Unit then sells at a full-name port', soldOk && (g252.currentShip().cargo || []).length === 0 && g252.data.shards === sh0252 + 560, `ok=${soldOk} cargo=${JSON.stringify(g252.currentShip().cargo)} sh=${g252.data.shards}`);

      // §5.447 sells "mineral" (vs "minerals" everywhere else) — <if cargo="minerals"> must see it.
      const g447 = GameState.create({ name:'T447', gender:'m', profession:'Warrior', book:5, adv });
      g447.data.shards = 1000; g447.data.ships = [];
      g447.addShip({ type:'brigantine', name:'Ore', crew:'poor', cargo:[], docked:null });
      const c447 = document.createElement('div');
      const st447 = new Story(c447, g447, { navigate(){}, onDeath(){}, notify(){} });
      st447.begin(await data.getSection(5, '447'), 5, '447');
      const buyMineral = Array.from(c447.querySelectorAll('.btn-mini')).find((b) => /mineral/i.test(b.textContent) && !b.disabled);
      ok('task127: §447 offers the "mineral" Cargo Unit', !!buyMineral);
      buyMineral.click();
      ok('task127: §447 stores it as canonical "minerals"', (g447.currentShip().cargo || []).includes('minerals'), JSON.stringify(g447.currentShip().cargo));
      ok('task127: <if cargo="minerals"> matches the loaded §5.447 Unit', eng.evaluateCondition(parse('<if cargo="minerals"/>'), g447) === true);

      // A save still holding abbreviated Units is canonicalised on load.
      const dirty = sanitizeData({ ships: [{ type:'barque', name:'Old', crew:'poor', cargo:['grai','meta','slav'], docked:null }] });
      ok('task127: sanitize folds stored "grai"/"meta"/"slav" to canonical names', dirty.ships[0].cargo.join(',') === 'grain,metals,slaves', JSON.stringify(dirty.ships[0].cargo));
    }

    // --- task 95: replace= transforms a possession in place (no duplicate) ------
    { // block-scoped
      // §5.118: three replaces on the §5.238 tomb haul — empty replace="" upgrades the
      // same-named item, and a named replace to a "N Shards" reward banks the cash.
      const g118r = GameState.create({ name:'T118r', gender:'m', profession:'Warrior', book:5, adv });
      g118r.data.items = []; g118r.data.shards = 0;
      g118r.addItem(makeItem('item', 'silver flute', 0, null, [], [], '5.238'));
      g118r.addItem(makeItem('item', 'black axe', 0, null, [], [], '5.238'));
      g118r.addItem(makeItem('item', 'bag of gold', 0, null, [], [], '5.238'));
      const startCount95 = g118r.itemCount();
      const c118r = document.createElement('div');
      const st118r = new Story(c118r, g118r, { navigate(){}, onDeath(){}, notify(){} });
      st118r.begin(await data.getSection(5, '118'), 5, '118');
      const findBtn95 = (re) => Array.from(c118r.querySelectorAll('.take-item')).find((b) => re.test(b.textContent));
      findBtn95(/silver flute/i).click();
      const flute95 = g118r.findItems('silver flute');
      ok('task95: replace="" transforms the same-named item in place (no duplicate)', flute95.length === 1 && flute95[0].kind === 'tool' && flute95[0].ability === 'charisma' && flute95[0].bonus === 2 && g118r.itemCount() === startCount95, JSON.stringify(flute95));
      findBtn95(/2000 shards/i).click();
      ok('task95: a named replace to a currency reward banks Shards and frees the slot', !g118r.hasItem('bag of gold') && g118r.data.shards === 2000 && g118r.itemCount() === startCount95 - 1, `shards=${g118r.data.shards} items=${g118r.itemCount()}`);
      findBtn95(/black axe/i).click();
      const axe95 = g118r.findItems('black axe');
      ok('task95: replace="" upgrades the black axe to a +1 weapon', axe95.length === 1 && axe95[0].kind === 'weapon' && axe95[0].bonus === 1, JSON.stringify(axe95));
      ok('task95: completed replace rows are checked-off (visit-safe, no re-transform)', Array.from(c118r.querySelectorAll('.take-item')).filter((b) => b.disabled && /☑/.test(b.textContent)).length >= 3);

      // §6.207: a named replace="royal sceptre" upgrades the plain sceptre to the +5 tool.
      const g207 = GameState.create({ name:'T207', gender:'m', profession:'Warrior', book:6, adv });
      g207.data.items = [];
      g207.addItem(makeItem('item', 'royal sceptre')); // the plain sceptre from §6.166
      const c207 = document.createElement('div');
      const st207 = new Story(c207, g207, { navigate(){}, onDeath(){}, notify(){} });
      st207.begin(await data.getSection(6, '207'), 6, '207');
      const sceptreBtn = () => Array.from(c207.querySelectorAll('.take-item')).find((b) => /sceptre/i.test(b.textContent));
      ok('task95: §207 sceptre transform is offered when the source is present', !!sceptreBtn() && !sceptreBtn().disabled);
      const cnt207 = g207.itemCount();
      sceptreBtn().click();
      const scep = g207.findItems('royal sceptre');
      ok('task95: §207 upgrades the sceptre in place to the +5 tool, no duplicate', scep.length === 1 && scep[0].kind === 'tool' && scep[0].bonus === 5 && scep[0].ability === '*' && g207.itemCount() === cnt207, JSON.stringify(scep));

      // §6.448a: the cursed sword (a forced −2 weapon) turns into a clean +2 sword.
      const g448 = GameState.create({ name:'T448', gender:'m', profession:'Warrior', book:6, adv });
      g448.data.items = [];
      g448.addItem(makeItem('weapon', 'cursed sword', -2)); // §6.677's forced −2 blade
      const c448 = document.createElement('div');
      const st448 = new Story(c448, g448, { navigate(){}, onDeath(){}, notify(){} });
      st448.begin(await data.getSection(6, '448a'), 6, '448a');
      const swordBtn = () => Array.from(c448.querySelectorAll('.take-item')).find((b) => /sword/i.test(b.textContent));
      ok('task95: §448a offers the cursed-sword transform', !!swordBtn() && !swordBtn().disabled);
      const cnt448 = g448.itemCount();
      swordBtn().click();
      ok('task95: §448a turns the cursed sword into a clean +2 sword', !g448.hasItem('cursed sword') && g448.findItems('sword').some((w)=>w.kind==='weapon' && w.bonus===2) && g448.itemCount() === cnt448, JSON.stringify(g448.data.items));

      // Full inventory: a net-zero replace is NOT refused by the 12-item carry cap.
      const gfull95 = GameState.create({ name:'Tfull', gender:'m', profession:'Warrior', book:6, adv });
      gfull95.data.items = [];
      gfull95.addItem(makeItem('item', 'royal sceptre'));
      for (let k = 0; k < 11; k++) gfull95.addItem(makeItem('item', 'junk'+k)); // 12 items → full
      ok('task95: the test inventory is full', gfull95.freeSlots() === 0);
      const cfull95 = document.createElement('div');
      const stfull95 = new Story(cfull95, gfull95, { navigate(){}, onDeath(){}, notify(){} });
      stfull95.begin(await data.getSection(6, '207'), 6, '207');
      const fullBtn95 = () => Array.from(cfull95.querySelectorAll('.take-item')).find((b) => /sceptre/i.test(b.textContent));
      ok('task95: a full inventory does not block a net-zero replace', !!fullBtn95() && !fullBtn95().disabled);
      fullBtn95().click();
      const scepF = gfull95.findItems('royal sceptre');
      ok('task95: replace at full inventory transforms in place (still 12 items)', scepF.length === 1 && scepF[0].kind === 'tool' && gfull95.itemCount() === 12, `items=${gfull95.itemCount()}`);

      // Source absent: the replace row is disabled (nothing to transform).
      const gabs95 = GameState.create({ name:'Tabs', gender:'m', profession:'Warrior', book:6, adv });
      gabs95.data.items = []; // no cursed sword
      const cabs95 = document.createElement('div');
      const stabs95 = new Story(cabs95, gabs95, { navigate(){}, onDeath(){}, notify(){} });
      stabs95.begin(await data.getSection(6, '448a'), 6, '448a');
      const absBtn95 = Array.from(cabs95.querySelectorAll('.take-item')).find((b) => /sword/i.test(b.textContent));
      ok('task95: a replace with no source item is disabled', !!absBtn95 && absBtn95.disabled, absBtn95 && absBtn95.textContent);
    }

    // --- task 96: hidden item rewards bundled inside a <group> action ----------
    { // block-scoped
      const check96 = async (b, sec, itemName, codeword) => {
        const first = itemName.split(' ')[0];
        const re = new RegExp(first, 'i');
        const g = GameState.create({ name:'T96', gender:'m', profession:'Warrior', book:b, adv });
        g.data.items = []; g.data.stamina = 40; g.data.staminaMax = 40; // survive §228's spear
        const c = document.createElement('div');
        const st = new Story(c, g, { navigate(){}, onDeath(){}, notify(){} });
        st.begin(await data.getSection(b, sec), b, sec);
        const grpBtn = Array.from(c.querySelectorAll('.group-action')).find((x) => re.test(x.textContent));
        ok(`task96: §${b}.${sec} shows the group action, reward not yet granted`, !!grpBtn && !g.hasItem(itemName) && !g.hasCodeword(codeword), `btn=${!!grpBtn} has=${g.hasItem(itemName)} cw=${g.hasCodeword(codeword)}`);
        ok(`task96: §${b}.${sec} has no separate Take button for the hidden item`, !Array.from(c.querySelectorAll('.take-item')).some((x) => re.test(x.textContent)));
        grpBtn.click();
        ok(`task96: §${b}.${sec} group click grants the hidden item once and sets the codeword`, g.findItems(itemName).length === 1 && g.hasCodeword(codeword), `count=${g.findItems(itemName).length} cw=${g.hasCodeword(codeword)}`);
      };
      await check96(1, '228', 'gold chain mail of Tyrnai', 'StolenTyrnaiMail');
      await check96(1, '509', 'gold chain mail of Tyrnai', 'StolenTyrnaiMail');
      await check96(4, '189', 'mirror of the Sun Goddess', 'GoddessMirror');

      // Capacity handling: a full pack can't hold the mirror, so the grant is skipped
      // (no 13th item) while the quest codeword still records — the group is atomic.
      const gf96 = GameState.create({ name:'Tf96', gender:'m', profession:'Warrior', book:4, adv });
      gf96.data.items = [];
      for (let k = 0; k < 12; k++) gf96.addItem(makeItem('item', 'junk'+k)); // full
      const cf96 = document.createElement('div');
      const stf96 = new Story(cf96, gf96, { navigate(){}, onDeath(){}, notify(){} });
      stf96.begin(await data.getSection(4, '189'), 4, '189');
      Array.from(cf96.querySelectorAll('.group-action')).find((x) => /mirror/i.test(x.textContent)).click();
      ok('task96: a full pack respects the 12-item cap (no 13th item) yet records the codeword', gf96.itemCount() === 12 && !gf96.hasItem('mirror of the Sun Goddess') && gf96.hasCodeword('GoddessMirror'), `items=${gf96.itemCount()}`);
    }

    // --- task 98: resurrection replacement / supplemental / hidden / revival ---
    { // block-scoped
      // Standard replacement + supplemental append (engine-level).
      const gres = GameState.create({ name:'Tres', gender:'m', profession:'Warrior', book:2, adv });
      gres.data.resurrections = [];
      eng.buyResurrectionDeal(gres, { book:2, section:'227', text:'Tyrnai', god:'Tyrnai' });
      ok('task98: a standard deal registers one arrangement', gres.data.resurrections.length === 1);
      eng.buyResurrectionDeal(gres, { book:2, section:'339', text:'Nagil', god:'Nagil' });
      ok('task98: a new standard deal replaces the old (only one at a time)', gres.data.resurrections.length === 1 && gres.data.resurrections[0].section === '339');
      eng.buyResurrectionDeal(gres, { book:6, section:'710', text:'boon', supplemental:true });
      ok('task98: a supplemental boon is added on top', gres.data.resurrections.length === 2 && gres.data.resurrections.some((r)=>r.supplemental));
      eng.buyResurrectionDeal(gres, { book:1, section:'350', text:'Nagil2' });
      const stds98 = gres.data.resurrections.filter((r)=>!r.supplemental);
      ok('task98: a further standard deal replaces only the standard, keeping the supplemental', gres.data.resurrections.length === 2 && stds98.length === 1 && stds98[0].section === '350' && gres.data.resurrections.some((r)=>r.supplemental));
      const before98 = gres.data.resurrections.slice();
      const tgt98 = eng.reviveWithResurrection(gres);
      ok('task98: revival consumes the earliest deal and leaves the rest in order', !!tgt98 && gres.data.resurrections.length === 1 && gres.data.resurrections[0].section === before98[1].section, `tgt=${JSON.stringify(tgt98)} rest=${JSON.stringify(gres.data.resurrections)}`);
      eng.buyResurrectionDeal(gres, { book:6, section:'710', text:'boon2', supplemental:true });
      const gresRT = new GameState(sanitizeData(JSON.parse(JSON.stringify(gres.data))));
      ok('task98: the supplemental flag survives a save round-trip', gresRT.data.resurrections.some((r)=>r.supplemental === true));

      // §4.428: a visible arrange offer registers once and cannot be re-clicked to stockpile.
      const g428 = GameState.create({ name:'T428', gender:'m', profession:'Warrior', book:4, adv });
      g428.data.resurrections = [];
      const c428 = document.createElement('div');
      const st428 = new Story(c428, g428, { navigate(){}, onDeath(){}, notify(){} });
      st428.begin(await data.getSection(4, '428'), 4, '428');
      const arrangeBtn = () => Array.from(c428.querySelectorAll('.btn-secondary')).find((x)=>/resurrection|arrange/i.test(x.textContent));
      ok('task98: §428 shows an arrange offer, no deal yet', !!arrangeBtn() && !g428.hasResurrection());
      arrangeBtn().click();
      ok('task98: arranging registers exactly one deal and spends the offer', g428.data.resurrections.length === 1 && arrangeBtn().disabled && /arranged/i.test(arrangeBtn().textContent), `res=${g428.data.resurrections.length} txt=${arrangeBtn() && arrangeBtn().textContent}`);

      // §3.351: a hidden deal auto-registers on entry (no button); re-entry keeps one.
      const g351 = GameState.create({ name:'T351', gender:'m', profession:'Warrior', book:3, adv });
      g351.data.resurrections = [];
      const c351 = document.createElement('div');
      const st351 = new Story(c351, g351, { navigate(){}, onDeath(){}, notify(){} });
      st351.begin(await data.getSection(3, '351'), 3, '351');
      ok('task98: §351 auto-registers the Island of Rebirth deal on entry (hidden)', g351.hasResurrection() && g351.data.resurrections[0].section === '351', JSON.stringify(g351.data.resurrections));
      ok('task98: §351 shows no manual arrange button for the hidden deal', !Array.from(c351.querySelectorAll('.btn-secondary')).some((x)=>/resurrection|arrange/i.test(x.textContent)));
      st351.begin(await data.getSection(3, '351'), 3, '351');
      ok('task98: re-entering §351 keeps exactly one deal (standard replacement)', g351.data.resurrections.length === 1, `res=${g351.data.resurrections.length}`);

      // §3.123 death-revival group: erase possessions/money/ship, consume the deal,
      // revive to FULL Stamina (task 159) and turn to the deal's own section.
      const g123 = GameState.create({ name:'T123', gender:'m', profession:'Warrior', book:3, adv });
      g123.data.items = []; g123.addItem(makeItem('item','loot1')); g123.addItem(makeItem('item','loot2'));
      g123.data.shards = 500; g123.data.staminaMax = 20; g123.data.stamina = 1;
      g123.data.ships = []; g123.addShip({ type:'barque', name:'Boat', crew:'poor', cargo:[], docked:null });
      eng.buyResurrectionDeal(g123, { book:3, section:'351', text:'Island of Rebirth' });
      let nav123 = null;
      const c123 = document.createElement('div');
      const st123 = new Story(c123, g123, { navigate(b,s){ nav123 = { b, s }; }, onDeath(){}, notify(){} });
      st123.begin(await data.getSection(3, '123'), 3, '123');
      const grp123 = Array.from(c123.querySelectorAll('.group-action')).find((x)=>/turn to/i.test(x.textContent));
      ok('task98: §123 revival group renders when a deal exists', !!grp123, `groups=${c123.querySelectorAll('.group-action').length}`);
      grp123.click();
      ok('task98: §123 revival erases possessions, money and ship', g123.itemCount() === 0 && g123.data.shards === 0 && g123.data.ships.length === 0, `items=${g123.itemCount()} sh=${g123.data.shards} ships=${g123.data.ships.length}`);
      ok('task98: §123 revival consumes the deal and revives to full Stamina (task 159)', g123.data.resurrections.length === 0 && g123.data.stamina === 20, `res=${g123.data.resurrections.length} stam=${g123.data.stamina}`);
      ok('task98: §123 revival turns to the deal section (3/351)', nav123 && nav123.b === 3 && String(nav123.s) === '351', JSON.stringify(nav123));
    }

    // --- task 134: a sell with several non-identical matches must ask which one leaves ---
    const shipRow = () => goodsFrom(parse('<trade ship="brigantine" sell="800"/>'), 'ship', 'brigantine', 0);
    {
      // Two brigantines here, one laden: sellPlan flags the ambiguity, and the headless
      // default sells the EMPTY vessel — never silently destroying a cargo-laden ship.
      const g = GameState.create({ name:'SH', gender:'m', profession:'Warrior', book:2, adv });
      g.data.ships = [];
      g.addShip({ type:'brigantine', name:'Empty', crew:'poor', cargo:[], docked:null });
      g.addShip({ type:'brigantine', name:'Laden', crew:'poor', cargo:['grain','grain'], docked:null });
      ok('task134: two same-type ships (one laden) need a which-one choice', sellPlan(g, shipRow()).needsChoice === true);
      const shBefore = g.data.shards;
      const res = sellTrade(g, shipRow(), 800);
      ok('task134: headless default sells the empty ship, the laden one survives', res.ok && g.data.ships.length === 1 && g.data.ships[0].name === 'Laden' && g.data.shards === shBefore + 800, JSON.stringify(g.data.ships.map((s) => s.name)));

      // An explicit chooser names the exact vessel (headless determinism, task note).
      const g2 = GameState.create({ name:'SH2', gender:'m', profession:'Warrior', book:2, adv });
      g2.data.ships = [];
      g2.addShip({ type:'brigantine', name:'Empty', crew:'poor', cargo:[], docked:null });
      g2.addShip({ type:'brigantine', name:'Laden', crew:'poor', cargo:['grain'], docked:null });
      sellTrade(g2, shipRow(), 800, null, { chooser: (cands) => [cands.find((s) => s.name === 'Laden')] });
      ok('task134: an explicit chooser sells the named (laden) vessel', g2.data.ships.length === 1 && g2.data.ships[0].name === 'Empty', JSON.stringify(g2.data.ships.map((s) => s.name)));

      // Two same-type EMPTY ships are interchangeable — no prompt needed.
      const g3 = GameState.create({ name:'SH3', gender:'m', profession:'Warrior', book:2, adv });
      g3.data.ships = [];
      g3.addShip({ type:'brigantine', name:'Ship', crew:'poor', cargo:[], docked:null });
      g3.addShip({ type:'brigantine', name:'Ship', crew:'poor', cargo:[], docked:null });
      ok('task134: two identical empty ships need no choice', sellPlan(g3, shipRow()).needsChoice === false);
    }

    // A generic weapon row (sold by bonus) with a mixed rack keeps the significant weapon.
    const wRow = () => goodsFrom(parse('<weapon bonus="1" sell="50"/>'), 'weapon', 'weapon', 1);
    {
      const g = GameState.create({ name:'WP', gender:'m', profession:'Warrior', book:1, adv });
      g.data.items = [];
      g.addItem(makeItem('weapon', 'sword', 1)); // plain bonus-1
      g.addItem(makeItem('weapon', 'Singing Sword', 1, 'magic', ['quest'])); // special bonus-1
      ok('task134: a mixed bonus-1 rack needs a which-one choice', sellPlan(g, wRow()).needsChoice === true);
      const res = sellTrade(g, wRow(), 50);
      ok('task134: headless default sells the plain weapon, the named one survives', res.ok && res.item.name === 'sword' && g.findItems('Singing Sword').length === 1 && g.findItems('sword').length === 0, JSON.stringify(g.data.items.map((i) => i.name)));

      const g2 = GameState.create({ name:'WP2', gender:'m', profession:'Warrior', book:1, adv });
      g2.data.items = [];
      g2.addItem(makeItem('weapon', 'sword', 1));
      g2.addItem(makeItem('weapon', 'sword', 1));
      ok('task134: two identical weapons need no choice', sellPlan(g2, wRow()).needsChoice === false);
    }

    // Web picker: a ship-sale market with two same-type ships (one laden). Clicking Sell
    // reveals a which-one picker; picking the empty ship leaves the laden one aboard.
    {
      const g = GameState.create({ name:'UI', gender:'m', profession:'Warrior', book:2, adv });
      g.data.ships = [];
      g.addShip({ type:'brigantine', name:'Empty', crew:'poor', cargo:[], docked:null });
      g.addShip({ type:'brigantine', name:'Laden', crew:'poor', cargo:['grain'], docked:null });
      const cUI = document.createElement('div');
      const stUI = new Story(cUI, g, { navigate(){}, onDeath(){}, notify(){} });
      stUI.begin(parse('<section><market><trade ship="brigantine" sell="800"/></market></section>'), 2, 'x134');
      const sellBtn = Array.from(cUI.querySelectorAll('.btn-mini')).find((b) => /^Sell/.test(b.textContent));
      ok('task134: ship-sale row renders a Sell button', !!sellBtn && !sellBtn.disabled);
      sellBtn.click();
      const picker = cUI.querySelector('.sell-choice');
      ok('task134: Sell reveals a which-one picker with both ships', !!picker && picker.querySelectorAll('button').length === 2, picker ? picker.textContent : 'none');
      const emptyBtn = Array.from(picker.querySelectorAll('button')).find((b) => !/carrying/.test(b.textContent));
      emptyBtn.click();
      ok('task134: picking the empty ship leaves the laden one', g.data.ships.length === 1 && g.data.ships[0].name === 'Laden', JSON.stringify(g.data.ships.map((s) => s.name)));
    }

}

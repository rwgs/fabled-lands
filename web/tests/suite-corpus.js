// FL test suite — render EVERY section of all six books without throwing (final scan)
// Extracted verbatim from web/_test.html run() lines 915-928 (task 120).
import * as data from '../js/data.js';
import { GameState } from '../js/state.js';
import { Story } from '../js/render.js';

export async function run(ctx) {
  const { ok, parse } = ctx;
  await data.loadMeta();
  const adv = data.parseAdventurers(data.bookInfo(1).adventurers);
    // scan: render EVERY section of EVERY book without throwing
    let renderErrors = 0, firstErr='', total=0;
    const gs2 = GameState.create({ name:'Scan', gender:'m', profession:'Rogue', book:1, adv });
    const c2 = document.createElement('div');
    const story2 = new Story(c2, gs2, { navigate(){}, onDeath(){}, notify(){} });
    for (let b=1; b<=6; b++) {
      const raw = await data.loadBook(b);
      for (const key of Object.keys(raw)) {
        total++;
        try { const el = await data.getSection(b, key); story2.begin(el, b, key); }
        catch(e){ renderErrors++; if(!firstErr) firstErr = b+'§'+key+': '+(e.stack||e.message); }
      }
    }
    ok('all sections render w/o throw ('+total+')', renderErrors===0, renderErrors+' errors; first='+firstErr);
}

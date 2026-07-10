// tts.js — optional text-to-speech narration of story prose.
//
// Self-contained: uses the browser's built-in Web Speech API (no backend, no
// keys, works offline with local voices). Integration into the rest of the app
// is a handful of clearly-marked calls in app.js; if this module is removed and
// those calls deleted, the game is unaffected. Narrates sentence-by-sentence
// (so long passages don't get truncated) and highlights the sentence as it is
// read. Control labels (roll/choice/goto buttons) are excluded from speech.

const LS_KEY = 'fl_tts';
const SUPPORTED = typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';

const CONTROL_SEL = '.goto, .group-action, .choice, .btn-roll, .btn-secondary, .btn-mini, .roll, .fight, .market, button';

function loadSettings() {
  const def = { autoplay: false, voiceURI: null, rate: 1.0, pitch: 1 };
  try { return { ...def, ...JSON.parse(localStorage.getItem(LS_KEY) || '{}') }; } catch { return def; }
}

export class Narrator {
  constructor() {
    this.settings = loadSettings();
    this.voices = [];
    this.chunks = [];   // [{ el, text }]
    this.index = 0;
    this.playing = false;
    this._active = null;
    this.onState = null; // (playing:boolean) => void, for UI
    if (SUPPORTED) {
      this._loadVoices();
      try { speechSynthesis.addEventListener('voiceschanged', () => this._loadVoices()); } catch {}
    }
  }

  get supported() { return SUPPORTED; }

  _loadVoices() { try { this.voices = speechSynthesis.getVoices() || []; } catch { this.voices = []; } }

  englishVoices() {
    const en = this.voices.filter((v) => /^en/i.test(v.lang));
    return en.length ? en : this.voices;
  }

  _voice() {
    if (this.settings.voiceURI) {
      const v = this.voices.find((v) => v.voiceURI === this.settings.voiceURI);
      if (v) return v;
    }
    return this.voices.find((v) => /^en/i.test(v.lang)) || this.voices[0] || null;
  }

  saveSettings() { try { localStorage.setItem(LS_KEY, JSON.stringify(this.settings)); } catch {} }

  // ---- narration prep ------------------------------------------------------
  /** Wrap prose sentences in <span class="tts-s"> (idempotent) and collect chunks. */
  prepare(flowEl) {
    if (!flowEl) { this.chunks = []; return 0; }
    let spans = Array.from(flowEl.querySelectorAll('.tts-s'));
    if (!spans.length) {
      flowEl.querySelectorAll('p').forEach((p) => {
        if (p.closest('.choices, .fight, .market')) return;
        wrapSentences(p);
      });
      // Most sections wrap their prose in <p>, but ~1,544 render it as bare text
      // and inline nodes directly in .flow (e.g. book4/16, book2/745). Wrap those
      // top-level runs too, or the 🔊 button would silently do nothing there. Block
      // widgets (choices/fight/market/roll divs, tables) stay put as run
      // boundaries and are not swept into a sentence span. (task 33)
      wrapFlowRuns(flowEl);
      spans = Array.from(flowEl.querySelectorAll('.tts-s'));
    }
    this.chunks = spans
      .map((el) => ({ el, text: speechText(el) }))
      .filter((c) => /[A-Za-z0-9]/.test(c.text));
    this.index = 0;
    return this.chunks.length;
  }

  /** Whether this flow has any prose worth narrating — used to disable the button
   *  when there is genuinely nothing to read. Non-mutating (leaves the DOM
   *  untouched); mirrors what prepare() would collect, so it agrees with the
   *  chunk count without wrapping anything. */
  canNarrate(flowEl) {
    if (!SUPPORTED || !flowEl) return false;
    const clone = flowEl.cloneNode(true);
    clone.querySelectorAll(NON_PROSE_SEL).forEach((e) => e.remove());
    return /[A-Za-z0-9]/.test(clone.textContent || '');
  }

  // ---- playback ------------------------------------------------------------
  /** Toggle: start narrating the given flow, or stop if already playing. */
  toggle(flowEl) { if (this.playing) this.stop(); else this.play(flowEl); }

  play(flowEl) {
    if (!SUPPORTED) return;
    this.stop();
    this.prepare(flowEl);
    if (!this.chunks.length) return;
    this.playing = true;
    this._emit();
    this._speakFrom(0);
  }

  /** Called by the app when a section (re)renders — narration must not outlive the DOM. */
  handleRerender() { if (this.playing) this.stop(); }

  autoplayIfEnabled(flowEl) { if (this.settings.autoplay) this.play(flowEl); }

  _speakFrom(i) {
    try { speechSynthesis.cancel(); } catch {}
    this._clearHighlight();
    if (!this.playing || i >= this.chunks.length) { this._finish(); return; }
    this.index = i;
    const { el, text } = this.chunks[i];
    const u = new SpeechSynthesisUtterance(text);
    const v = this._voice(); if (v) u.voice = v;
    u.rate = this.settings.rate;
    u.pitch = this.settings.pitch;
    u.onstart = () => this._highlight(el);
    u.onend = () => { if (this.playing && this.index === i) this._speakFrom(i + 1); };
    u.onerror = () => { if (this.playing && this.index === i) this._speakFrom(i + 1); };
    try { speechSynthesis.speak(u); } catch { this._finish(); }
  }

  _highlight(el) {
    this._clearHighlight();
    if (!el.isConnected) return;
    el.classList.add('tts-active');
    this._active = el;
    try { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch {}
  }
  _clearHighlight() { if (this._active) { this._active.classList.remove('tts-active'); this._active = null; } }

  _finish() { this.playing = false; this.index = 0; this._clearHighlight(); this._emit(); }

  stop() {
    if (SUPPORTED) { try { speechSynthesis.cancel(); } catch {} }
    const was = this.playing;
    this.playing = false;
    this._clearHighlight();
    if (was) this._emit(); else this._emit();
  }

  _emit() { if (this.onState) this.onState(this.playing); }
}

// ---- helpers ---------------------------------------------------------------
const SENTENCE_RE = /[^.!?…]*[.!?…]+["'’”)\]]*|\s*[^.!?…]+$/g;
const ENDS = /[.!?…]["'’”)\]]*\s*$/;

// Top-level elements in .flow that are block widgets / tables, not prose. They
// bound a prose run and are left in place rather than swept into a sentence span.
const FLOW_BLOCK = new Set(['P', 'DIV', 'FIGURE', 'TABLE', 'THEAD', 'TBODY', 'TR', 'UL', 'OL', 'LI', 'HR', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6']);
// The same non-prose regions, as a selector, for the non-mutating canNarrate()
// check: control labels (CONTROL_SEL already covers .roll/.fight/.market/buttons)
// plus the choices table and any data table.
const NON_PROSE_SEL = CONTROL_SEL + ', .choices, table';

/** Wrap runs of bare inline prose (text + inline elements) sitting directly in
 *  .flow into sentence spans, so sections without a <p> wrapper still narrate.
 *  Block widgets (see FLOW_BLOCK) end the current run and are left untouched. */
function wrapFlowRuns(flowEl) {
  let run = [];
  const flush = () => {
    if (run.length && run.some((n) => (n.textContent || '').trim())) {
      const holder = document.createElement('span');
      holder.className = 'tts-run';
      flowEl.insertBefore(holder, run[0]);
      run.forEach((n) => holder.appendChild(n)); // move (preserves listeners)
      wrapSentences(holder);
    }
    run = [];
  };
  Array.from(flowEl.childNodes).forEach((node) => {
    if (node.nodeType === Node.ELEMENT_NODE && FLOW_BLOCK.has(node.tagName)) flush();
    else run.push(node);
  });
  flush();
}

/** Group a paragraph's children into per-sentence spans, MOVING nodes so any
 *  interactive elements keep their event listeners. */
function wrapSentences(p) {
  const original = Array.from(p.childNodes);
  const spans = [];
  let current = newSpan();
  const flush = () => { if (current.childNodes.length) { spans.push(current); current = newSpan(); } };

  original.forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const parts = node.nodeValue.match(SENTENCE_RE) || [node.nodeValue];
      parts.forEach((part) => {
        current.appendChild(document.createTextNode(part));
        if (ENDS.test(part)) flush();
      });
    } else {
      current.appendChild(node); // move (preserves listeners)
    }
  });
  flush();
  // Remove any leftover original text nodes still attached, then insert spans.
  original.forEach((n) => { if (n.parentNode === p) p.removeChild(n); });
  spans.forEach((s) => p.appendChild(s));
  return spans;
}

function newSpan() { const s = document.createElement('span'); s.className = 'tts-s'; return s; }

/** The spoken text of a sentence span, excluding any control-element labels. */
function speechText(span) {
  const clone = span.cloneNode(true);
  clone.querySelectorAll(CONTROL_SEL).forEach((e) => e.remove());
  return (clone.textContent || '').replace(/\s+/g, ' ').trim();
}

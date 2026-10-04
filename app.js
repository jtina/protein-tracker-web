/* Protein Tracker — web port of the SwiftUI iPhone app. */
(function () {
  'use strict';

  // ---------- Accent colors (AccentColorOption) ----------

  const ACCENTS = {
    blue:   { color: [10, 132, 255],  dark: [0, 72, 150] },
    green:  { color: [72, 209, 88],   dark: [24, 115, 35] },
    indigo: { color: [94, 92, 230],   dark: [48, 46, 135] },
    orange: { color: [255, 159, 10],  dark: [170, 92, 0] },
    pink:   { color: [255, 55, 95],   dark: [165, 20, 52] },
    purple: { color: [191, 90, 242],  dark: [110, 45, 145] },
    red:    { color: [255, 69, 58],   dark: [155, 25, 20] },
    teal:   { color: [100, 210, 255], dark: [25, 105, 135] },
    yellow: { color: [255, 214, 10],  dark: [155, 120, 0] }
  };
  const ACCENT_KEY = 'accentColor';
  const ENTRIES_KEY = 'proteinTracker.entries';

  function storageGet(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }
  function storageSet(key, value) {
    try { localStorage.setItem(key, value); return true; } catch (e) { return false; }
  }

  function currentAccent() {
    const raw = storageGet(ACCENT_KEY);
    return ACCENTS[raw] ? raw : 'pink';
  }

  function applyAccent(name) {
    const option = ACCENTS[name] || ACCENTS.pink;
    const root = document.documentElement.style;
    root.setProperty('--accent-rgb', option.color.join(', '));
    root.setProperty('--remove-rgb', option.dark.join(', '));
  }

  function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  // ---------- Dates ----------

  function startOfDay(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
  function addDays(d, n) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); }
  function dayKey(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function sameDay(a, b) { return dayKey(a) === dayKey(b); }
  function isToday(d) { return sameDay(d, new Date()); }
  function dayDifference(from, to) { return Math.round((startOfDay(to) - startOfDay(from)) / 86400000); }

  const fmt = {
    headerDate: new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' }),
    sheetDate: new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'short', day: 'numeric' }),
    monthYear: new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }),
    weekday: new Intl.DateTimeFormat(undefined, { weekday: 'short' }),
    time: new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }),
    grams: new Intl.NumberFormat(undefined, { maximumFractionDigits: 0, roundingMode: 'halfEven' }),
    editAmount: new Intl.NumberFormat('en-US', { maximumFractionDigits: 2, useGrouping: false })
  };

  function formatGrams(value) {
    const text = fmt.grams.format(value);
    return text === '-0' ? '0' : text;
  }

  // Mirrors Swift's Double(String): strict decimal parse, "," accepted as decimal separator.
  function parseAmount(text, trim) {
    let s = String(text).replace(/,/g, '.');
    if (trim) s = s.trim();
    if (!/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(s)) return null;
    const value = Number(s);
    return Number.isFinite(value) ? value : null;
  }

  function trimmedName(name) {
    const t = String(name).trim();
    return t === '' ? 'Protein' : t;
  }

  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID().toUpperCase();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    }).toUpperCase();
  }

  // ---------- ProteinStore ----------

  const store = {
    entries: [],

    load() {
      const raw = storageGet(ENTRIES_KEY);
      if (!raw) { this.entries = []; return; }
      try {
        const parsed = JSON.parse(raw);
        this.entries = Array.isArray(parsed) ? parsed.filter((e) => e && e.id && e.date) : [];
      } catch (e) {
        console.error('Failed to load protein entries:', e);
        this.entries = [];
      }
    },

    save() {
      const ok = storageSet(ENTRIES_KEY, JSON.stringify(this.entries));
      if (!ok) console.error('Failed to save protein entries');
      return ok;
    },

    protein(date) {
      const key = dayKey(date);
      return this.entries
        .filter((e) => e.date === key)
        .reduce((total, e) => total + (e.isAddition ? e.amount : -e.amount), 0);
    },

    entriesFor(date) {
      const key = dayKey(date);
      return this.entries
        .filter((e) => e.date === key)
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    },

    makeEntry(date, amount, isAddition, name) {
      return {
        id: uuid(),
        timestamp: new Date().toISOString(),
        date: dayKey(date),
        amount: amount,
        isAddition: isAddition,
        name: trimmedName(name)
      };
    },

    add(amount, name, date) {
      if (!(amount > 0)) return false;
      this.entries.push(this.makeEntry(date, amount, true, name));
      if (this.save()) return true;
      this.entries.pop();
      return false;
    },

    remove(amount, name, date) {
      if (!(amount > 0)) return false;
      const currentTotal = this.protein(date);
      if (!(currentTotal > 0)) return false;
      this.entries.push(this.makeEntry(date, Math.min(amount, currentTotal), false, name));
      if (this.save()) return true;
      this.entries.pop();
      return false;
    },

    update(id, amount, name) {
      const index = this.entries.findIndex((e) => e.id === id);
      if (!(amount > 0) || index < 0) return false;
      const original = Object.assign({}, this.entries[index]);
      this.entries[index].amount = amount;
      this.entries[index].name = trimmedName(name);
      if (this.save()) return true;
      this.entries[index] = original;
      return false;
    },

    delete(id) {
      const index = this.entries.findIndex((e) => e.id === id);
      if (index < 0) return false;
      const original = this.entries[index];
      this.entries.splice(index, 1);
      if (this.save()) return true;
      this.entries.splice(Math.min(index, this.entries.length), 0, original);
      return false;
    }
  };

  // ---------- Icons (SF Symbols look-alikes) ----------

  function icon(name, size) {
    const s = size || 20;
    const stroke = (d, w) => `<svg class="icon" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w || 2.6}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
    switch (name) {
      case 'plus': return stroke('<path d="M12 4.5v15M4.5 12h15"/>', 3);
      case 'minus': return stroke('<path d="M4.5 12h15"/>', 3);
      case 'pencil': return stroke('<path d="M15.5 4.5l4 4L8.5 19.5 3.5 20.5l1-5z"/><path d="M13.5 6.5l4 4"/>', 2);
      case 'trash': return stroke('<path d="M4 6.5h16"/><path d="M9 6.5V4.5h6v2"/><path d="M6 6.5l1 13a1.5 1.5 0 0 0 1.5 1.4h7a1.5 1.5 0 0 0 1.5-1.4l1-13"/><path d="M10 10.5v7M14 10.5v7"/>', 2);
      case 'calendar': return stroke('<rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 10h17"/><path d="M8 3v3.5M16 3v3.5"/>', 2);
      case 'grid1x2': return stroke('<rect x="4" y="3.5" width="16" height="7.5" rx="2"/><rect x="4" y="13" width="16" height="7.5" rx="2"/>', 2);
      case 'fork': return stroke('<path d="M7 3v6.5a2.5 2.5 0 0 0 5 0V3"/><path d="M9.5 3v18"/><path d="M17.5 21V3c-2 1.5-3 4-3 7.5 0 1.5.8 2.5 3 2.5"/>', 2);
      case 'backup': return stroke('<path d="M8 3.5v12M4.5 7 8 3.5 11.5 7"/><path d="M16 20.5v-12M12.5 17l3.5 3.5 3.5-3.5"/>', 2.2);
      case 'palette': return `<svg class="icon" width="${s}" height="${s}" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" fill-rule="evenodd" d="M12 2.5C6.5 2.5 2.5 6.6 2.5 11.7c0 5.2 4.2 9.8 9.3 9.8 1.6 0 2.4-.9 2.4-2 0-.6-.2-1-.5-1.4-.3-.4-.5-.8-.5-1.3 0-1 .8-1.7 1.8-1.7h2.2c2.8 0 4.8-2 4.8-4.8C22 6.6 17.6 2.5 12 2.5zM6.8 13.2a1.7 1.7 0 1 1 0-3.4 1.7 1.7 0 0 1 0 3.4zm2.6-4.6a1.7 1.7 0 1 1 0-3.4 1.7 1.7 0 0 1 0 3.4zm5.2 0a1.7 1.7 0 1 1 0-3.4 1.7 1.7 0 0 1 0 3.4zm3.2 3.9a1.7 1.7 0 1 1 0-3.4 1.7 1.7 0 0 1 0 3.4z"/></svg>`;
    }
    return '';
  }

  // ---------- DOM helpers ----------

  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    if (attrs) {
      for (const k in attrs) {
        const v = attrs[k];
        if (v === undefined || v === null || v === false) continue;
        if (k === 'class') node.className = v;
        else if (k === 'html') node.innerHTML = v;
        else if (k === 'text') node.textContent = v;
        else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
        else if (v === true) node.setAttribute(k, '');
        else node.setAttribute(k, v);
      }
    }
    (children || []).forEach((c) => {
      if (c === null || c === undefined || c === false) return;
      node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return node;
  }

  // ---------- App state ----------

  const state = {
    selectedDate: startOfDay(new Date()),
    isMonthExpanded: false,
    openRows: new Set()
  };

  const app = document.getElementById('app');

  function selectDate(date) {
    state.selectedDate = startOfDay(date);
    render();
  }

  // ---------- Main view (ContentView) ----------

  function render() {
    const selectedProtein = store.protein(state.selectedDate);
    app.replaceChildren(header(), calendarCard(), proteinCard(selectedProtein));
  }

  function header() {
    return el('div', { class: 'header' }, [
      el('div', { class: 'header-text' }, [
        el('div', { class: 'header-title', text: 'Protein Tracker' }),
        el('div', { class: 'header-date', text: fmt.headerDate.format(state.selectedDate) })
      ]),
      el('div', { class: 'header-buttons' }, [
        el('button', {
          class: 'palette-button',
          'aria-label': 'Back up or restore data',
          html: icon('backup', 22),
          onclick: openBackupSheet
        }),
        el('button', {
          class: 'palette-button',
          'aria-label': 'Customize accent color',
          html: icon('palette', 22),
          onclick: openAccentPicker
        })
      ])
    ]);
  }

  function calendarCard() {
    const expanded = state.isMonthExpanded;
    return el('section', { class: 'card calendar-card' }, [
      el('div', { class: 'row' }, [
        el('div', { class: 'headline', text: expanded ? 'Month' : 'Week' }),
        el('div', { class: 'spacer' }),
        el('button', {
          class: 'mode-toggle',
          html: icon(expanded ? 'grid1x2' : 'calendar', 17) + `<span>${expanded ? 'Week view' : 'Month view'}</span>`,
          onclick: () => { state.isMonthExpanded = !state.isMonthExpanded; render(); }
        })
      ]),
      el('div', { class: 'row' }, [
        el('div', { class: 'spacer' }),
        el('button', {
          class: 'today-button',
          text: 'Today',
          onclick: () => { state.isMonthExpanded = false; selectDate(new Date()); }
        })
      ]),
      el('div', { class: 'calendar-body' }, [expanded ? monthCalendar() : weekCalendar()])
    ]);
  }

  // ---------- DayCell ----------

  function dayCell(date, isSelected, isMonthCell, onTap) {
    const protein = store.protein(date);
    const classes = ['day-cell'];
    if (isMonthCell) classes.push('month');
    if (isSelected) classes.push('selected');
    if (isToday(date)) classes.push('today');
    return el('button', {
      class: classes.join(' '),
      'aria-label': fmt.headerDate.format(date) + ', ' + formatGrams(protein) + ' grams',
      onclick: onTap
    }, [
      el('span', { class: 'wd', text: fmt.weekday.format(date) }),
      el('span', { class: 'dn', text: String(date.getDate()) }),
      el('span', { class: 'pg' + (protein > 0 ? ' has' : ''), text: formatGrams(protein) + 'g' })
    ]);
  }

  // ---------- MonthCalendarView ----------

  function monthCalendar() {
    const selected = state.selectedDate;
    const first = new Date(selected.getFullYear(), selected.getMonth(), 1);
    const last = new Date(selected.getFullYear(), selected.getMonth() + 1, 0);
    const start = addDays(first, -first.getDay());
    const end = addDays(last, 6 - last.getDay());

    const grid = el('div', { class: 'month-grid' });
    ['S', 'M', 'T', 'W', 'T', 'F', 'S'].forEach((d) => grid.appendChild(el('div', { class: 'weekday-label', text: d })));
    for (let d = start; d <= end; d = addDays(d, 1)) {
      const date = d;
      const cell = dayCell(date, sameDay(date, selected), true, () => selectDate(date));
      if (date.getMonth() !== selected.getMonth()) cell.classList.add('outside');
      grid.appendChild(cell);
    }

    return el('div', {}, [
      el('div', { class: 'month-year-month', text: fmt.monthYear.format(selected) }),
      grid
    ]);
  }

  // ---------- WeekCalendarView ----------

  const WEEK = { cellWidth: 48, spacing: 6, visibleDays: 7, renderedDays: 13, duration: 240 };
  WEEK.step = WEEK.cellWidth + WEEK.spacing;
  WEEK.visibleWidth = WEEK.visibleDays * WEEK.cellWidth + (WEEK.visibleDays - 1) * WEEK.spacing;
  WEEK.baseOffset = (WEEK.visibleWidth - WEEK.cellWidth) / 2 - Math.floor(WEEK.renderedDays / 2) * WEEK.step;

  const week = { isTransitioning: false, track: null };

  function setTrackOffset(offset, animate) {
    const track = week.track;
    if (!track) return;
    track.classList.toggle('animating', !!animate);
    track.style.transform = `translateX(${WEEK.baseOffset + offset}px)`;
  }

  function animateWeekTo(offset, then) {
    week.isTransitioning = true;
    setTrackOffset(offset, true);
    setTimeout(() => {
      week.isTransitioning = false;
      then();
    }, WEEK.duration);
  }

  function weekCalendar() {
    const active = state.selectedDate;
    const center = Math.floor(WEEK.renderedDays / 2);
    const track = el('div', { class: 'week-track' });
    let suppressClick = false;

    for (let i = -center; i <= center; i++) {
      const date = addDays(active, i);
      track.appendChild(dayCell(date, i === 0, false, (event) => {
        if (suppressClick) { event.preventDefault(); return; }
        if (sameDay(date, active) || week.isTransitioning) return;
        animateWeekTo(-dayDifference(active, date) * WEEK.step, () => selectDate(date));
      }));
    }

    week.track = track;
    track.style.transform = `translateX(${WEEK.baseOffset}px)`;

    const viewport = el('div', { class: 'week-viewport' }, [el('div', { class: 'week-frame' }, [track])]);

    // DragGesture(minimumDistance: 8): one day per swipe with 0.9 resistance.
    let start = null;
    let dragging = false;
    viewport.addEventListener('pointerdown', (e) => {
      if (week.isTransitioning || (e.pointerType === 'mouse' && e.button !== 0)) return;
      start = { x: e.clientX, y: e.clientY, id: e.pointerId };
      dragging = false;
    });
    viewport.addEventListener('pointermove', (e) => {
      if (!start || e.pointerId !== start.id || week.isTransitioning) return;
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      if (!dragging) {
        if (Math.hypot(dx, dy) < 8) return;
        dragging = true;
        try { viewport.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
      }
      const resistance = 0.9;
      const limit = WEEK.step * resistance;
      setTrackOffset(Math.max(-limit, Math.min(limit, dx * resistance)), false);
    });
    const end = (e) => {
      if (!start || e.pointerId !== start.id) return;
      const dx = e.clientX - start.x;
      const wasDragging = dragging;
      start = null;
      dragging = false;
      if (!wasDragging || week.isTransitioning) return;
      suppressClick = true;
      setTimeout(() => { suppressClick = false; }, 0);
      if (e.type === 'pointercancel') { setTrackOffset(0, true); return; }
      const threshold = WEEK.step * 0.22;
      if (dx < -threshold) moveDay(1);
      else if (dx > threshold) moveDay(-1);
      else setTrackOffset(0, true);
    };
    viewport.addEventListener('pointerup', end);
    viewport.addEventListener('pointercancel', end);

    function moveDay(days) {
      const next = addDays(active, days);
      animateWeekTo(-days * WEEK.step, () => selectDate(next));
    }

    return el('div', {}, [
      el('div', { class: 'month-year-week', text: fmt.monthYear.format(active) }),
      viewport
    ]);
  }

  // ---------- Protein card ----------

  function proteinCard(selectedProtein) {
    const minus = el('button', {
      class: 'round-button remove',
      'aria-label': 'Remove protein',
      html: icon('minus', 20),
      disabled: !(selectedProtein > 0),
      onclick: () => openAddSheet('remove')
    });
    const plus = el('button', {
      class: 'round-button add',
      'aria-label': 'Add protein',
      html: icon('plus', 20),
      onclick: () => openAddSheet('add')
    });

    return el('section', { class: 'card protein-card' }, [
      el('div', { class: 'row' }, [
        el('div', {}, [
          el('div', { class: 'total-label', text: 'Daily total' }),
          el('div', { class: 'total-value' }, [
            el('span', { class: 'total-number', text: formatGrams(selectedProtein) }),
            el('span', { class: 'total-unit', text: 'g' })
          ])
        ]),
        el('div', { class: 'spacer' }),
        el('div', { class: 'round-buttons' }, [minus, plus])
      ]),
      el('button', {
        class: 'add-protein-button',
        html: icon('fork', 20) + '<span>Add protein</span>',
        onclick: () => openAddSheet('add')
      }),
      proteinLog()
    ]);
  }

  function proteinLog() {
    const entries = store.entriesFor(state.selectedDate);
    const visibleIds = new Set(entries.map((e) => e.id));
    state.openRows.forEach((id) => { if (!visibleIds.has(id)) state.openRows.delete(id); });

    const children = [
      el('div', { class: 'log-header' }, [
        el('div', { class: 'headline', text: "Today's log" }),
        el('div', { class: 'spacer' }),
        el('div', { class: 'log-count', text: `${entries.length} ${entries.length === 1 ? 'entry' : 'entries'}` })
      ])
    ];

    if (entries.length === 0) {
      children.push(el('div', { class: 'log-empty', text: 'No protein added yet today.' }));
    } else {
      entries.forEach((entry, index) => {
        children.push(logRow(entry));
        if (index < entries.length - 1) children.push(el('div', { class: 'divider' }));
      });
    }
    return el('div', { class: 'log' }, children);
  }

  // ---------- ProteinLogRow (swipe to edit / delete) ----------

  const ACTION_WIDTH = 148;

  function logRow(entry) {
    const kind = entry.isAddition ? 'add' : 'remove';
    let isOpen = state.openRows.has(entry.id);

    const front = el('div', { class: 'log-front' }, [
      el('div', { class: 'log-sign ' + kind, html: icon(entry.isAddition ? 'plus' : 'minus', 12) }),
      el('div', { class: 'log-text' }, [
        el('div', { class: 'log-name', text: entry.name }),
        el('div', { class: 'log-time', text: fmt.time.format(new Date(entry.timestamp)) })
      ]),
      el('div', { class: 'log-amount ' + kind, text: `${entry.isAddition ? '+' : '−'}${formatGrams(entry.amount)}g` })
    ]);

    function setOpen(open) {
      isOpen = open;
      if (open) state.openRows.add(entry.id); else state.openRows.delete(entry.id);
      front.classList.add('animating');
      front.style.transform = `translateX(${open ? -ACTION_WIDTH : 0}px)`;
    }

    front.style.transform = `translateX(${isOpen ? -ACTION_WIDTH : 0}px)`;

    const actions = el('div', { class: 'log-actions' }, [
      el('button', {
        class: 'log-action edit',
        'aria-label': 'Edit protein',
        html: icon('pencil', 17),
        onclick: () => { setOpen(false); openEditSheet(entry); }
      }),
      el('button', {
        class: 'log-action delete',
        'aria-label': 'Delete protein',
        html: icon('trash', 17),
        onclick: () => { setOpen(false); store.delete(entry.id); render(); }
      })
    ]);

    // DragGesture(minimumDistance: 10), horizontal only.
    let start = null;
    let dragging = false;
    let moved = false;
    front.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      start = { x: e.clientX, y: e.clientY, id: e.pointerId };
      dragging = false;
      moved = false;
    });
    front.addEventListener('pointermove', (e) => {
      if (!start || e.pointerId !== start.id) return;
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      if (!dragging) {
        if (Math.hypot(dx, dy) < 10) return;
        moved = true;
        if (Math.abs(dx) <= Math.abs(dy)) { start = null; return; }
        dragging = true;
        try { front.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
        front.classList.remove('animating');
      }
      const base = isOpen ? -ACTION_WIDTH : 0;
      const offset = Math.min(0, Math.max(-ACTION_WIDTH, base + dx));
      front.style.transform = `translateX(${offset}px)`;
    });
    const end = (e) => {
      if (!start || e.pointerId !== start.id) return;
      const dx = e.clientX - start.x;
      const wasDragging = dragging;
      start = null;
      dragging = false;
      if (!wasDragging) return;
      if (e.type === 'pointercancel') { setOpen(isOpen); return; }
      const projected = (isOpen ? -ACTION_WIDTH : 0) + dx;
      setOpen(projected < -(ACTION_WIDTH * 0.35));
    };
    front.addEventListener('pointerup', end);
    front.addEventListener('pointercancel', end);
    front.addEventListener('click', () => {
      if (moved) return;
      if (isOpen) setOpen(false);
    });

    return el('div', { class: 'log-row' }, [actions, front]);
  }

  // ---------- Modal presentation (fullScreenCover / sheet) ----------

  const modals = document.getElementById('modals');

  function present(kind, build) {
    const root = el('div', { class: 'modal-root ' + kind, role: 'dialog', 'aria-modal': 'true' });
    const backdrop = el('div', { class: 'modal-backdrop' });
    const panel = el('div', { class: 'modal-panel' });
    root.append(backdrop, panel);

    let closed = false;
    function dismiss() {
      if (closed) return;
      closed = true;
      if (document.activeElement && root.contains(document.activeElement)) document.activeElement.blur();
      panel.style.transform = '';
      panel.classList.remove('dragging');
      root.classList.remove('shown');
      setTimeout(() => {
        root.remove();
        if (!modals.children.length) document.body.classList.remove('modal-open');
      }, 380);
    }

    const content = build(dismiss);
    panel.append(content.navBar, el('div', { class: 'modal-content' }, [el('div', { class: 'modal-inner' }, [content.body])]));

    if (kind === 'sheet') {
      backdrop.addEventListener('click', dismiss);
      enableSwipeDown(panel, content.navBar, dismiss);
    }

    document.body.classList.add('modal-open');
    modals.appendChild(root);
    root.getBoundingClientRect(); // flush styles so the slide-in animates
    root.classList.add('shown');
    if (content.onShow) content.onShow();
    return dismiss;
  }

  function enableSwipeDown(panel, handle, dismiss) {
    let start = null;
    handle.addEventListener('pointerdown', (e) => {
      if (e.target.closest('button')) return;
      start = { y: e.clientY, id: e.pointerId, t: Date.now() };
      try { handle.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
      panel.classList.add('dragging');
    });
    handle.addEventListener('pointermove', (e) => {
      if (!start || e.pointerId !== start.id) return;
      const dy = Math.max(0, e.clientY - start.y);
      panel.style.transform = `translateY(${dy}px)`;
    });
    const end = (e) => {
      if (!start || e.pointerId !== start.id) return;
      const dy = Math.max(0, e.clientY - start.y);
      const velocity = dy / Math.max(1, Date.now() - start.t);
      start = null;
      panel.classList.remove('dragging');
      if (dy > panel.offsetHeight * 0.3 || (dy > 30 && velocity > 0.6)) dismiss();
      else panel.style.transform = '';
    };
    handle.addEventListener('pointerup', end);
    handle.addEventListener('pointercancel', end);
  }

  function navBar(title, leading, trailing) {
    return el('div', { class: 'nav-bar' }, [
      leading || el('span'),
      el('div', { class: 'nav-title', text: title }),
      trailing || el('span')
    ]);
  }

  // buttons: [{ text, style: 'cancel' | 'destructive' | undefined, action }]
  function showAlert(title, message, buttons) {
    const list = buttons && buttons.length ? buttons : [{ text: 'OK', style: 'cancel' }];
    const root = el('div', { class: 'alert-root', role: 'alertdialog', 'aria-modal': 'true' });
    const buttonEls = list.map((b) => el('button', {
      class: 'alert-button' + (b.style ? ' ' + b.style : ''),
      text: b.text,
      onclick: () => { root.remove(); if (b.action) b.action(); }
    }));
    root.appendChild(el('div', { class: 'alert' }, [
      el('div', { class: 'alert-body' }, [
        el('div', { class: 'alert-title', text: title }),
        message ? el('div', { class: 'alert-message', text: message }) : null
      ]),
      el('div', { class: 'alert-buttons' + (list.length === 2 ? ' pair' : '') }, buttonEls)
    ]));
    document.body.appendChild(root);
  }

  // ---------- AddProteinSheet ----------

  function openAddSheet(mode) {
    const date = state.selectedDate;
    const currentTotal = store.protein(date);
    if (mode === 'remove' && !(currentTotal > 0)) return;
    const isAdd = mode === 'add';

    present('cover', (dismiss) => {
      const nameInput = el('input', {
        class: 'name-input',
        type: 'text',
        placeholder: 'Protein',
        autocapitalize: 'words',
        autocomplete: 'off',
        enterkeyhint: 'next'
      });
      const amountInput = el('input', {
        class: 'amount-input',
        type: 'text',
        inputmode: 'decimal',
        placeholder: '0',
        autocomplete: 'off',
        enterkeyhint: 'done'
      });
      const confirm = el('button', { class: 'confirm-button' });
      confirm.style.background = isAdd ? 'var(--accent)' : 'var(--system-red)';

      const entered = () => parseAmount(amountInput.value, true);
      const canConfirm = () => {
        const v = entered();
        if (v === null || !(v > 0)) return false;
        return isAdd || v <= currentTotal;
      };
      const refresh = () => {
        const v = entered();
        confirm.textContent = v === null
          ? (isAdd ? 'Add protein' : 'Remove protein')
          : `${isAdd ? 'Add' : 'Remove'} ${formatGrams(v)}g`;
        confirm.disabled = !canConfirm();
      };
      const submit = () => {
        const v = entered();
        if (v === null || !(v > 0) || !canConfirm()) return;
        const name = trimmedName(nameInput.value);
        const ok = isAdd ? store.add(v, name, date) : store.remove(v, name, date);
        if (!ok) {
          showAlert("Couldn't save protein", isAdd ? 'Unable to save this protein entry.' : 'Unable to save this protein removal.');
          return;
        }
        render();
        dismiss();
      };

      amountInput.addEventListener('input', refresh);
      amountInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
      nameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') amountInput.focus(); });
      confirm.addEventListener('click', submit);
      refresh();

      const body = el('div', { class: 'add-sheet' }, [
        el('div', { class: 'add-title-block' }, [
          el('div', { class: 'add-title', text: isAdd ? 'Add protein' : 'Remove protein' }),
          el('div', { class: 'add-date', text: fmt.sheetDate.format(date) })
        ]),
        el('div', {}, [el('div', { class: 'field-label', text: 'Protein name' }), nameInput]),
        el('div', { class: 'amount-block' }, [amountInput, el('div', { class: 'grams-label', text: 'grams' })]),
        el('div', {
          class: 'current-total',
          text: `Current total: ${formatGrams(currentTotal)}g`,
          style: `color: ${isAdd ? 'var(--accent)' : 'var(--system-red)'}`
        }),
        confirm,
        !isAdd && currentTotal === 0 ? el('div', { class: 'footnote', text: 'There is no protein to remove for this day.' }) : null
      ]);

      return {
        navBar: navBar(isAdd ? 'Add Protein' : 'Remove Protein', el('button', { class: 'nav-button', text: 'Cancel', onclick: dismiss })),
        body: body,
        onShow: () => {
          // Focus inside the tap so mobile browsers raise the keyboard, like the app's auto-focus.
          amountInput.focus({ preventScroll: true });
          setTimeout(() => { if (document.activeElement !== amountInput && document.activeElement !== nameInput) amountInput.focus({ preventScroll: true }); }, 250);
        }
      };
    });
  }

  // ---------- EditProteinEntrySheet ----------

  function openEditSheet(entry) {
    present('sheet', (dismiss) => {
      const nameInput = el('input', {
        class: 'edit-name-input',
        type: 'text',
        placeholder: 'Protein',
        autocapitalize: 'words',
        autocomplete: 'off'
      });
      nameInput.value = entry.name === 'Protein' ? '' : entry.name;

      const amountInput = el('input', {
        class: 'edit-amount-input',
        type: 'text',
        inputmode: 'decimal',
        placeholder: '0',
        autocomplete: 'off',
        enterkeyhint: 'done'
      });
      amountInput.value = fmt.editAmount.format(entry.amount);

      const save = el('button', { class: 'prominent-button', text: 'Save changes' });
      const entered = () => parseAmount(amountInput.value, false);
      const refresh = () => { save.disabled = !((entered() || 0) > 0); };
      const submit = () => {
        const v = entered();
        if (v === null || !(v > 0)) return;
        store.update(entry.id, v, nameInput.value);
        render();
        dismiss();
      };
      amountInput.addEventListener('input', refresh);
      amountInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
      save.addEventListener('click', submit);
      refresh();

      const body = el('div', { class: 'edit-sheet' }, [
        el('div', {}, [el('div', { class: 'field-label', text: 'Protein name' }), nameInput]),
        el('div', {}, [
          el('div', { class: 'field-label', text: 'Protein amount' }),
          el('div', { class: 'edit-amount-box' }, [amountInput, el('span', { class: 'edit-unit', text: 'g' })])
        ]),
        save
      ]);

      return {
        navBar: navBar('Edit Protein', el('button', { class: 'nav-button', text: 'Cancel', onclick: dismiss })),
        body: body
      };
    });
  }

  // ---------- AccentColorPickerView ----------

  function openAccentPicker() {
    present('sheet', (dismiss) => {
      const selected = currentAccent();
      const grid = el('div', { class: 'accent-grid' });
      Object.keys(ACCENTS).forEach((name) => {
        const swatch = el('div', { class: 'accent-swatch' + (name === selected ? ' selected' : '') });
        swatch.style.background = `rgb(${ACCENTS[name].color.join(', ')})`;
        grid.appendChild(el('button', {
          class: 'accent-option',
          'aria-label': capitalize(name),
          'aria-pressed': name === selected ? 'true' : 'false',
          onclick: () => {
            storageSet(ACCENT_KEY, name);
            applyAccent(name);
            dismiss();
          }
        }, [swatch, el('span', { class: 'accent-name', text: capitalize(name) })]));
      });

      return {
        navBar: navBar('Accent Color', null, el('button', { class: 'nav-button bold', text: 'Done', onclick: dismiss })),
        body: el('div', { class: 'accent-sheet' }, [el('div', { class: 'accent-heading', text: 'Choose an accent color' }), grid])
      };
    });
  }

  // ---------- Backup & restore (web only) ----------

  const BACKUP_FORMAT = 'protein-tracker-backup';

  function exportBackup() {
    const backup = {
      format: BACKUP_FORMAT,
      version: 1,
      exportedAt: new Date().toISOString(),
      accentColor: currentAccent(),
      entries: store.entries
    };
    const json = JSON.stringify(backup, null, 2);
    const filename = `protein-tracker-backup-${dayKey(new Date())}.json`;

    // On phones, the share sheet lets the file be saved to Files, AirDropped, emailed, etc.
    let file = null;
    try { file = new File([json], filename, { type: 'application/json' }); } catch (_) { /* old browser */ }
    const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    if (coarse && file && navigator.canShare && navigator.canShare({ files: [file] })) {
      navigator.share({ files: [file], title: 'Protein Tracker backup' }).catch((err) => {
        if (err && err.name === 'AbortError') return;
        downloadFile(json, filename);
      });
      return;
    }
    downloadFile(json, filename);
  }

  function downloadFile(text, filename) {
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const a = el('a', { href: url, download: filename });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  // Returns a clean entry, or null if the record isn't a valid protein entry.
  function sanitizeEntry(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const amount = Number(raw.amount);
    const timestamp = new Date(raw.timestamp);
    if (typeof raw.id !== 'string' || raw.id === '') return null;
    if (typeof raw.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(raw.date)) return null;
    if (!Number.isFinite(amount) || amount <= 0) return null;
    if (typeof raw.isAddition !== 'boolean') return null;
    if (isNaN(timestamp.getTime())) return null;
    return {
      id: raw.id,
      timestamp: timestamp.toISOString(),
      date: raw.date,
      amount: amount,
      isAddition: raw.isAddition,
      name: trimmedName(typeof raw.name === 'string' ? raw.name : '')
    };
  }

  function parseBackup(text) {
    let data;
    try { data = JSON.parse(text); } catch (_) { return null; }
    const rawEntries = Array.isArray(data) ? data : (data && Array.isArray(data.entries) ? data.entries : null);
    if (!rawEntries) return null;
    const entries = rawEntries.map(sanitizeEntry).filter(Boolean);
    if (rawEntries.length > 0 && entries.length === 0) return null;
    const accent = data && !Array.isArray(data) && ACCENTS[data.accentColor] ? data.accentColor : null;
    return { entries: entries, skipped: rawEntries.length - entries.length, accentColor: accent };
  }

  function applyImport(backup, replace, done) {
    const previous = store.entries;
    let added = backup.entries.length;
    if (replace) {
      store.entries = backup.entries.slice();
    } else {
      const known = new Set(previous.map((e) => e.id));
      const fresh = backup.entries.filter((e) => !known.has(e.id));
      added = fresh.length;
      store.entries = previous.concat(fresh);
    }
    if (!store.save()) {
      store.entries = previous;
      showAlert("Couldn't import data", 'Unable to save the imported entries.');
      return;
    }
    if (replace && backup.accentColor) {
      storageSet(ACCENT_KEY, backup.accentColor);
      applyAccent(backup.accentColor);
    }
    render();
    done();
    const noun = (n) => `${n} ${n === 1 ? 'entry' : 'entries'}`;
    let message = replace ? `Restored ${noun(added)}.` : `Added ${noun(added)}.`;
    if (!replace && added < backup.entries.length) message += ` ${noun(backup.entries.length - added)} already existed.`;
    if (backup.skipped) message += ` Skipped ${noun(backup.skipped)} that couldn't be read.`;
    showAlert('Import complete', message);
  }

  function importBackup(done) {
    const input = el('input', { type: 'file', accept: '.json,application/json,text/plain' });
    input.style.display = 'none';
    document.body.appendChild(input);
    input.addEventListener('change', () => {
      const file = input.files && input.files[0];
      input.remove();
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const backup = parseBackup(String(reader.result));
        if (!backup) {
          showAlert("Couldn't import data", "This file isn't a Protein Tracker backup.");
          return;
        }
        const count = `${backup.entries.length} ${backup.entries.length === 1 ? 'entry' : 'entries'}`;
        showAlert('Import backup?', `The backup has ${count}. Merge adds entries you don't already have. Replace erases everything on this device first.`, [
          { text: 'Merge', action: () => applyImport(backup, false, done) },
          { text: 'Replace All', style: 'destructive', action: () => applyImport(backup, true, done) },
          { text: 'Cancel', style: 'cancel' }
        ]);
      };
      reader.onerror = () => showAlert("Couldn't import data", 'The file could not be read.');
      reader.readAsText(file);
    });
    input.click();
  }

  function openBackupSheet() {
    present('sheet', (dismiss) => {
      const count = store.entries.length;
      const body = el('div', { class: 'accent-sheet' }, [
        el('div', {}, [
          el('div', { class: 'accent-heading', text: 'Back up your data' }),
          el('div', {
            class: 'backup-note',
            text: 'Your entries are saved only in this browser on this device. Export a backup file to keep a copy or move your log to another phone, browser, or the home-screen app.'
          })
        ]),
        el('button', { class: 'add-protein-button', html: icon('backup', 20) + '<span>Export data</span>', onclick: exportBackup }),
        el('button', { class: 'add-protein-button', html: icon('plus', 18) + '<span>Import data</span>', onclick: () => importBackup(dismiss) }),
        el('div', { class: 'footnote', text: `${count} ${count === 1 ? 'entry' : 'entries'} on this device` })
      ]);
      return {
        navBar: navBar('Backup', null, el('button', { class: 'nav-button bold', text: 'Done', onclick: dismiss })),
        body: body
      };
    });
  }

  // ---------- Boot ----------

  applyAccent(currentAccent());
  store.load();
  render();

  // Keep "today" highlighting correct if the app is left open past midnight or resumed later.
  let lastToday = dayKey(new Date());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    const nowKey = dayKey(new Date());
    if (nowKey !== lastToday) { lastToday = nowKey; render(); }
  });

  // Ask the browser not to evict saved entries when the device is low on storage.
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => {}); });
  }
})();

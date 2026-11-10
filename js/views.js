/* Кристалл — экраны и компоненты представлений */
'use strict';

/* ---------- общие хелперы ---------- */
function esc(s) {
  return String(s === null || s === undefined ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function fileSize(bytes) {
  if (bytes < 1024) return bytes + ' Б';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' КБ';
  return (bytes / 1024 / 1024).toFixed(1) + ' МБ';
}

/** Читает файл в JSON-объект (Promise → null при ошибке) */
function readerJson(file) {
  return new Promise((resolve) => {
    const r = new FileReader();
    r.onload = () => {
      try { resolve(JSON.parse(String(r.result))); } catch (e) { resolve(null); }
    };
    r.onerror = () => resolve(null);
    r.readAsText(file);
  });
}

/** Подсветка совпадений поиска в уже экранированном тексте */
function highlight(escaped, words) {
  let out = escaped;
  words.forEach((w) => {
    if (!w || w.length < 1) return;
    const re = new RegExp('(' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
    out = out.replace(re, '<mark>$1</mark>');
  });
  return out;
}

const Views = (() => {

  /* ---------- логотип (мотив хрустальной бабочки) ---------- */
  function logoSVG(style, cls) {
    cls = cls || 'logo-art';
    if (style === 'collage') {
      // фрагмент коллажа: бабочка (3-я фотка)
      return `<span class="${cls}" style="display:inline-block;border-radius:30%;overflow:hidden;background-image:url('assets/collage/3-butterfly.png');background-size:cover;background-position:center;border:1px solid rgba(255,255,255,0.25);"></span>`;
    }
    if (style === 'gem') {
      return `<svg class="${cls}" viewBox="0 0 48 48" fill="none">
        <path d="M24 6 L42 20 L24 44 L6 20 Z" fill="url(#gemg)" stroke="rgba(255,255,255,0.7)" stroke-width="1.5"/>
        <path d="M6 20 H42 M24 6 L24 44 M24 6 L14 20 M24 6 L34 20" stroke="rgba(255,255,255,0.55)" stroke-width="1.2"/>
        <defs><linearGradient id="gemg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#f0abfc"/><stop offset="1" stop-color="#e879f9"/>
        </linearGradient></defs></svg>`;
    }
    // butterfly (по умолчанию)
    return `<svg class="${cls}" viewBox="0 0 48 48" fill="none">
      <path d="M24 16 C18 6 6 5 5 14 C4 21 12 25 22 24 Z" fill="#c084fc" fill-opacity="0.9" stroke="rgba(255,255,255,0.6)" stroke-width="1"/>
      <path d="M24 16 C30 6 42 5 43 14 C44 21 36 25 26 24 Z" fill="#ff9ecd" fill-opacity="0.9" stroke="rgba(255,255,255,0.6)" stroke-width="1"/>
      <path d="M22.5 24 C15 25 10 30 13 36 C15.5 40.5 21.5 37 23 31 Z" fill="#c084fc" fill-opacity="0.75" stroke="rgba(255,255,255,0.5)" stroke-width="1"/>
      <path d="M25.5 24 C33 25 38 30 35 36 C32.5 40.5 26.5 37 25 31 Z" fill="#ff9ecd" fill-opacity="0.75" stroke="rgba(255,255,255,0.5)" stroke-width="1"/>
      <ellipse cx="24" cy="25" rx="1.8" ry="9" fill="#fff"/>
      <path d="M22.8 16.5 C21.5 13 19.5 11.5 17.8 11 M25.2 16.5 C26.5 13 28.5 11.5 30.2 11" stroke="#fff" stroke-width="1.2" stroke-linecap="round"/>
    </svg>`;
  }

  function emptyState(title, sub) {
    return `<div class="empty">${logoSVG('butterfly')}<h3>${esc(title)}</h3><p>${esc(sub)}</p></div>`;
  }

  /* ---------- карточка задачи ---------- */
  function taskCardHTML(task, opts) {
    opts = opts || {};
    const cat = Store.categoryById(task.categoryId);
    const overdue = Store.isOverdue(task);
    const classes = ['task-card'];
    if (task.done) classes.push('done');
    if (overdue) classes.push('overdue');
    const attachN = (task.attachments || []).length;
    const meta = [];
    if (task.date) {
      let d = Store.relDateLabel(task.date);
      if (task.time) d += ' · ' + Store.formatTime(task.time);
      meta.push(`<span>${esc(d)}</span>`);
    } else {
      meta.push(`<span>${esc(t('noDate'))}</span>`);
    }
    if (cat) meta.push(`<span class="cat-chip"><i class="cat-dot" style="background:${esc(cat.color)};color:${esc(cat.color)}"></i>${esc(Store.categoryName(cat))}</span>`);
    if (attachN) meta.push(`<span class="attach-chip">📎 ${attachN}</span>`);
    if (task.repeat && task.repeat.type !== 'none') meta.push(`<span>🔁</span>`);
    if (overdue) meta.push(`<span class="badge badge-overdue">${esc(t('overdue'))}</span>`);
    if (task.priority) meta.push(`<span class="badge badge-priority">✦ ${esc(t('priorityBadge'))}</span>`);

    return `<article class="${classes.join(' ')}" data-task-id="${esc(task.id)}">
      <button class="check" data-act="toggle" aria-label="${esc(t('markDone'))}">
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
      </button>
      <div class="task-body" data-act="open">
        <div class="task-title">${opts.highlight ? opts.highlight(esc(task.title)) : esc(task.title)}</div>
        ${task.notes ? `<div class="task-notes">${opts.highlight ? opts.highlight(esc(task.notes.slice(0, 140))) : esc(task.notes.slice(0, 140))}</div>` : ''}
        <div class="task-meta">${meta.join('')}</div>
      </div>
      <div class="task-actions">
        <button class="icon-btn" data-act="snooze" title="${esc(t('snooze'))}">
          <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5M5 3 3 5m16-2 2 2"/></svg>
        </button>
        <button class="icon-btn" data-act="edit" title="${esc(t('edit'))}">
          <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
        </button>
      </div>
    </article>`;
  }

  /** Общий делегированный обработчик карточек внутри контейнера */
  function bindTaskCards(root) {
    root.querySelectorAll('.task-card').forEach((card) => {
      const id = card.dataset.taskId;
      card.addEventListener('click', (e) => {
        const actEl = e.target.closest('[data-act]');
        if (!actEl) return;
        const act = actEl.dataset.act;
        const task = Store.getTask(id);
        if (!task) return;
        if (act === 'toggle') toggleTask(task, card);
        else if (act === 'open' || act === 'edit') openTaskModal(task);
        else if (act === 'snooze') openSnoozeModal(task);
      });
    });
  }

  function toggleTask(task, card) {
    const nowDone = !task.done;
    Store.toggleDone(task.id, nowDone);
    if (nowDone && Store.get('completedStyle') === 'sparkle' && card) {
      card.classList.add('sparkle-burst');
      setTimeout(() => App.renderView(), 950);
    } else {
      App.renderView();
    }
    if (nowDone) App.toast('✦ ' + t('done'));
  }

  function renderTaskList(root, tasks, opts) {
    if (!tasks.length) {
      root.innerHTML = emptyState(opts.emptyTitle, opts.emptySub);
      return;
    }
    root.innerHTML = `<div class="task-list">${tasks.map((x) => taskCardHTML(x, opts)).join('')}</div>`;
    bindTaskCards(root);
  }

  /* ---------- модалка задачи (создание / редактирование) ---------- */
  function openTaskModal(task) {
    const isNew = !task;
    const orig = task ? JSON.parse(JSON.stringify(task)) : null;
    const state = {
      attachments: task ? (task.attachments || []).slice() : [],
      added: []   // новые blob-id, чтобы откатить при отмене
    };

    const cats = Store.categories();
    const catOptions = [`<option value="">—</option>`]
      .concat(cats.map((c) => `<option value="${esc(c.id)}" ${task && task.categoryId === c.id ? 'selected' : ''}>${esc(Store.categoryName(c))}</option>`))
      .join('');
    const repeat = (task && task.repeat) || { type: 'none', n: 1 };
    const attachLocked = App.isLocked('attachments');

    App.modal(`
      <button class="icon-btn modal-close" data-close aria-label="${esc(t('close'))}">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
      </button>
      <h3>${esc(isNew ? t('createTask') : t('editTask'))}</h3>
      <div class="field">
        <label>${esc(t('taskTitle'))}</label>
        <input class="input" id="tf-title" maxlength="140" placeholder="${esc(t('taskTitlePh'))}" value="${esc(task ? task.title : '')}">
      </div>
      <div class="form-row">
        <div class="field">
          <label>${esc(t('taskDate'))}</label>
          <input class="input" type="date" id="tf-date" value="${esc(task ? task.date : '')}">
        </div>
        <div class="field">
          <label>${esc(t('taskTime'))} <span class="muted">(${esc(t('optional'))})</span></label>
          <input class="input" type="time" id="tf-time" value="${esc(task ? task.time : '')}">
        </div>
      </div>
      <div class="field">
        <label>${esc(t('taskNotes'))}</label>
        <textarea class="textarea" id="tf-notes" placeholder="${esc(t('taskNotesPh'))}">${esc(task ? task.notes : '')}</textarea>
      </div>
      <div class="form-row">
        <div class="field">
          <label>${esc(t('taskCategory'))}</label>
          <div class="row">
            <select class="select" id="tf-cat" style="flex:1">${catOptions}</select>
            <button class="btn btn-ghost btn-sm" id="tf-newcat" title="${esc(t('addCategory'))}">＋</button>
          </div>
        </div>
      </div>
      <div class="switch-row">
        <div><div class="sw-label">${esc(t('taskPriority'))}</div></div>
        <button class="switch ${task && task.priority ? 'on' : ''}" id="tf-priority" role="switch" aria-checked="${!!(task && task.priority)}"></button>
      </div>
      <div class="form-row">
        <div class="field">
          <label>${esc(t('taskRepeat'))}</label>
          <select class="select" id="tf-repeat">
            <option value="none" ${repeat.type === 'none' ? 'selected' : ''}>${esc(t('repeatNone'))}</option>
            <option value="daily" ${repeat.type === 'daily' ? 'selected' : ''}>${esc(t('repeatDaily'))}</option>
            <option value="weekly" ${repeat.type === 'weekly' ? 'selected' : ''}>${esc(t('repeatWeekly'))}</option>
            <option value="monthly" ${repeat.type === 'monthly' ? 'selected' : ''}>${esc(t('repeatMonthly'))}</option>
            <option value="custom" ${repeat.type === 'custom' ? 'selected' : ''}>${esc(t('repeatCustom'))}${App.isLocked('repeatCustom') ? ' ◆PRO' : ''}</option>
          </select>
        </div>
        <div class="field hidden" id="tf-repeat-n-wrap">
          <label>${esc(t('repeatEveryDays'))}</label>
          <input class="input" type="number" id="tf-repeat-n" min="1" max="365" value="${repeat.n || 2}">
        </div>
      </div>
      <div class="field">
        <label>${esc(t('taskAttachments'))}${attachLocked ? ' <span class="pro-tag">PRO</span>' : ''}</label>
        <div id="tf-attach-wrap" class="${attachLocked ? 'lock-wrap' : ''}">
          <button class="btn btn-ghost btn-sm" id="tf-attach-btn" ${attachLocked ? 'disabled' : ''}>📎 ${esc(t('addAttachment'))}</button>
          <input type="file" id="tf-attach-input" multiple class="hidden">
          <div class="attach-list" id="tf-attach-list"></div>
          ${attachLocked ? `<div class="lock-veil" id="tf-attach-lock"><div><div class="lk">◆ ${esc(t('proLocked'))}</div><div class="lk-sub">${esc(t('proLockedSub'))}</div></div></div>` : ''}
        </div>
      </div>
      <div class="modal-actions">
        ${!isNew ? `<button class="btn btn-danger" id="tf-delete">${esc(t('delete'))}</button>` : ''}
        <button class="btn btn-crystal" id="tf-save">${esc(t('save'))}</button>
      </div>
    `);

    const $ = (sel) => document.querySelector(sel);

    // приоритет
    $('#tf-priority').addEventListener('click', function () {
      this.classList.toggle('on');
      this.setAttribute('aria-checked', this.classList.contains('on'));
    });

    // повтор: поле N при custom
    const repeatSel = $('#tf-repeat');
    function syncRepeatN() {
      $('#tf-repeat-n-wrap').classList.toggle('hidden', repeatSel.value !== 'custom');
    }
    repeatSel.addEventListener('change', () => {
      if (repeatSel.value === 'custom' && App.isLocked('repeatCustom')) {
        App.toast('◆ ' + t('proLocked') + ' — ' + t('proLockedSub'));
        repeatSel.value = 'none';
      }
      syncRepeatN();
    });
    syncRepeatN();

    // новая категория
    $('#tf-newcat').addEventListener('click', () => {
      App.promptModal(t('addCategory'), t('categoryName'), (name) => {
        if (!name || !name.trim()) return;
        const cat = Store.addCategory(name, '#e879f9');
        const opt = document.createElement('option');
        opt.value = cat.id; opt.textContent = cat.name; opt.selected = true;
        $('#tf-cat').appendChild(opt);
      });
    });

    // вложения
    function renderAttachList() {
      const list = $('#tf-attach-list');
      if (!state.attachments.length) { list.innerHTML = ''; return; }
      list.innerHTML = state.attachments.map((id) => `<div class="attach-item" data-att-id="${esc(id)}"><div class="attach-name muted">…</div></div>`).join('');
      state.attachments.forEach((id) => {
        const row = list.querySelector(`[data-att-id="${CSS.escape(id)}"]`);
        DB.getAttachment(id).then((att) => {
          if (!att || !row) return;
          const isImg = att.type && att.type.startsWith('image/');
          const url = isImg ? URL.createObjectURL(att.blob) : '';
          const ext = (att.name.split('.').pop() || 'FILE').slice(0, 4).toUpperCase();
          row.innerHTML = `
            ${isImg ? `<img class="attach-thumb" src="${url}" alt="">` : `<div class="attach-icon">${esc(ext)}</div>`}
            <div style="flex:1;min-width:0">
              <div class="attach-name">${esc(att.name)}</div>
              <div class="attach-size">${fileSize(att.blob.size)}</div>
            </div>
            <button class="link-btn" data-open>${esc(t('open'))}</button>
            <button class="link-btn" data-del style="color:var(--danger)">✕</button>`;
          row.querySelector('[data-open]').addEventListener('click', () => openAttachment(att));
          row.querySelector('[data-del]').addEventListener('click', () => {
            App.confirmDialog(t('fileDeleteConfirm')).then((ok) => {
              if (!ok) return;
              DB.deleteAttachment(id).catch(() => {});
              state.attachments = state.attachments.filter((x) => x !== id);
              renderAttachList();
            });
          });
        }).catch(() => { if (row) row.querySelector('.attach-name').textContent = '⚠'; });
      });
    }
    renderAttachList();

    if (!attachLocked) {
      const btn = $('#tf-attach-btn');
      const input = $('#tf-attach-input');
      btn.addEventListener('click', () => input.click());
      input.addEventListener('change', () => {
        Array.from(input.files || []).forEach((file) => {
          const id = Store.uid();
          DB.addAttachment({ id, taskId: task ? task.id : '', name: file.name, type: file.type, blob: file })
            .then(() => {
              state.attachments.push(id);
              state.added.push(id);
              renderAttachList();
            })
            .catch(() => App.toast('⚠ IndexedDB недоступен'));
        });
        input.value = '';
      });
    }
    const lockVeil = $('#tf-attach-lock');
    if (lockVeil) lockVeil.addEventListener('click', () => { location.hash = '#/pro'; });

    // сохранение
    $('#tf-save').addEventListener('click', () => {
      const title = $('#tf-title').value.trim();
      if (!title) { $('#tf-title').focus(); $('#tf-title').style.borderColor = 'var(--danger)'; return; }
      const rtype = repeatSel.value;
      const data = {
        title,
        date: $('#tf-date').value,
        time: $('#tf-time').value,
        notes: $('#tf-notes').value,
        categoryId: $('#tf-cat').value,
        priority: $('#tf-priority').classList.contains('on'),
        repeat: { type: rtype, n: Math.max(1, parseInt($('#tf-repeat-n').value, 10) || 1) },
        attachments: state.attachments
      };
      if (isNew) Store.createTask(data);
      else Store.updateTask(task.id, Object.assign(data, { firedFor: '', snoozedUntil: 0 }));
      state.added.length = 0; // файлы приняты — не откатывать
      App.closeModal();
      App.toast('✦ ' + t('taskSaved'));
      App.renderView();
    });

    // удаление с отменой (5 секунд)
    const delBtn = $('#tf-delete');
    if (delBtn) delBtn.addEventListener('click', () => {
      App.closeModal();
      deleteTaskWithUndo(task.id);
    });

    // отмена модалки → откат новых вложений
    App.onModalClose(() => {
      if (state.added.length) DB.deleteAttachments(state.added);
    });

    setTimeout(() => $('#tf-title').focus(), 80);
  }

  function openAttachment(att) {
    const url = URL.createObjectURL(att.blob);
    if (att.type && att.type.startsWith('image/')) {
      App.modal(`
        <button class="icon-btn modal-close" data-close aria-label="${esc(t('close'))}">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
        </button>
        <h3 style="word-break:break-all">${esc(att.name)}</h3>
        <img src="${url}" style="width:100%;border-radius:12px" alt="">
        <div class="modal-actions"><a class="btn btn-crystal" href="${url}" download="${esc(att.name)}" style="text-decoration:none">${esc(t('downloadFile'))}</a></div>
      `);
    } else {
      const a = document.createElement('a');
      a.href = url; a.download = att.name;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    }
  }

  function deleteTaskWithUndo(id) {
    const idx = Store.tasks().findIndex((x) => x.id === id);
    const removed = Store.deleteTask(id);
    if (!removed) return;
    // удаляем только те вложения, которые больше нигде не используются
    // (у повторяющихся задач копия наследует вложения оригинала)
    const orphaned = () => (removed.attachments || []).filter((attId) =>
      !Store.tasks().some((x) => (x.attachments || []).includes(attId)));
    let undone = false;
    const timer = setTimeout(() => {
      if (!undone) DB.deleteAttachments(orphaned());
    }, 5200);
    App.toast(t('taskDeleted'), t('undo'), () => {
      undone = true;
      clearTimeout(timer);
      Store.restoreTask(removed, idx);
      App.renderView();
    });
    App.renderView();
  }

  /* ---------- модалка «Отложить» ---------- */
  function openSnoozeModal(task) {
    App.modal(`
      <h3>⏰ ${esc(t('snooze'))}</h3>
      <p class="muted mb16" style="word-break:break-word">${esc(task.title)}</p>
      <div class="task-list">
        <button class="btn btn-ghost btn-block" data-sz="600000">${esc(t('snooze10m'))}</button>
        <button class="btn btn-ghost btn-block" data-sz="3600000">${esc(t('snooze1h'))}</button>
        <button class="btn btn-ghost btn-block" data-sz="86400000">${esc(t('snooze1d'))}</button>
        <button class="btn btn-ghost btn-block" data-sz="259200000">${esc(t('snooze3d'))}</button>
      </div>
      <div class="field mt16">
        <label>${esc(t('snoozeCustom'))}</label>
        <div class="row">
          <input class="input" type="datetime-local" id="sz-custom">
          <button class="btn btn-crystal btn-sm" id="sz-custom-btn" style="min-width:80px">${esc(t('confirm'))}</button>
        </div>
      </div>
    `);
    document.querySelectorAll('[data-sz]').forEach((b) => {
      b.addEventListener('click', () => applySnooze(task, Date.now() + parseInt(b.dataset.sz, 10)));
    });
    document.getElementById('sz-custom-btn').addEventListener('click', () => {
      const v = document.getElementById('sz-custom').value;
      const ts = v ? new Date(v).getTime() : NaN;
      if (!isNaN(ts) && ts > Date.now()) applySnooze(task, ts);
      else App.toast('⚠ ' + t('pickDateTime'));
    });
  }

  function applySnooze(task, ts) {
    // сбрасываем firedFor — напоминание сработает снова в новое время
    Store.updateTask(task.id, { snoozedUntil: ts, firedFor: '' });
    App.closeModal();
    App.toast('⏰ ' + t('snoozed') + ': ' + new Date(ts).toLocaleString(Store.get('lang') === 'ru' ? 'ru-RU' : 'en-US', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }));
    App.renderView();
  }

  return {
    logoSVG, emptyState, taskCardHTML, bindTaskCards, renderTaskList,
    openTaskModal, openSnoozeModal, deleteTaskWithUndo, toggleTask, highlight
  };
})();

/* ================================================================
   Экраны: Сегодня / Предстоящие / Все / Выполненные / Календарь / Поиск
   ================================================================ */
const Screens = (() => {

  let _calState = { year: null, month: null, selected: null };
  let _searchQ = '';
  let _catFilter = '';

  function categoryChipsHTML(active) {
    const cats = Store.categories();
    const chips = [`<button class="chip ${!active ? 'active' : ''}" data-cat="">${esc(t('allCategories'))}</button>`]
      .concat(cats.map((c) => `<button class="chip ${active === c.id ? 'active' : ''}" data-cat="${esc(c.id)}"><i class="cat-dot" style="background:${esc(c.color)};color:${esc(c.color)}"></i>${esc(Store.categoryName(c))}</button>`));
    return `<div class="chip-row">${chips.join('')}</div>`;
  }

  function bindCategoryChips(root, rerender) {
    root.querySelectorAll('[data-cat]').forEach((chip) => {
      chip.addEventListener('click', () => {
        _catFilter = chip.dataset.cat;
        rerender();
      });
    });
  }

  function byCat(list) {
    if (!_catFilter) return list;
    return list.filter((x) => x.categoryId === _catFilter);
  }

  /* ---------- Сегодня ---------- */
  function today(root) {
    const todayISO = Store.todayISO();
    const tasks = Store.sortTasks(
      Store.tasks().filter((x) => !x.done && x.date && x.date <= todayISO)
    );
    const filtered = byCat(tasks);
    const now = new Date();
    const dateStr = now.toLocaleDateString(Store.get('lang') === 'ru' ? 'ru-RU' : 'en-US', { weekday: 'long', day: 'numeric', month: 'long' });

    root.innerHTML = `
      <div class="view-anim">
        <div class="hero hero-butterfly">
          <div class="hero-content">
            <h2>${esc(t('navToday'))}</h2>
            <p>${esc(dateStr)} · ${tasks.length ? tasks.length + ' ' + esc(t('digestBody')) : esc(t('emptyToday'))}</p>
          </div>
        </div>
        ${categoryChipsHTML(_catFilter)}
        <div id="list"></div>
      </div>`;
    Views.renderTaskList(root.querySelector('#list'), filtered, {
      emptyTitle: t('emptyToday'), emptySub: t('emptyTodaySub')
    });
    bindCategoryChips(root, () => today(root));
  }

  /* ---------- Предстоящие ---------- */
  function upcoming(root) {
    const todayISO = Store.todayISO();
    const tasks = Store.sortTasks(
      Store.tasks().filter((x) => !x.done && x.date && x.date > todayISO)
    );
    const filtered = byCat(tasks);
    // группировка по датам
    const groups = {};
    filtered.forEach((x) => { (groups[x.date] = groups[x.date] || []).push(x); });
    const dates = Object.keys(groups).sort();

    let listHTML;
    if (!dates.length) {
      listHTML = Views.emptyState(t('emptyUpcoming'), t('emptyUpcomingSub'));
    } else {
      listHTML = dates.map((d) => `
        <div class="section-title">${esc(Store.relDateLabel(d))} · ${esc(Store.formatDate(d))}</div>
        <div class="task-list">${groups[d].map((x) => Views.taskCardHTML(x)).join('')}</div>
      `).join('');
    }

    root.innerHTML = `
      <div class="view-anim">
        <div class="page-head"><h2>${esc(t('navUpcoming'))}</h2></div>
        ${categoryChipsHTML(_catFilter)}
        ${listHTML}
      </div>`;
    Views.bindTaskCards(root);
    bindCategoryChips(root, () => upcoming(root));
  }

  /* ---------- Все задачи ---------- */
  function all(root) {
    const tasks = Store.sortTasks(Store.tasks().filter((x) => !x.done));
    const filtered = byCat(tasks);
    root.innerHTML = `
      <div class="view-anim">
        <div class="page-head"><h2>${esc(t('navAll'))}</h2></div>
        ${categoryChipsHTML(_catFilter)}
        <div id="list"></div>
      </div>`;
    Views.renderTaskList(root.querySelector('#list'), filtered, {
      emptyTitle: t('emptyAll'), emptySub: t('emptyAllSub')
    });
    bindCategoryChips(root, () => all(root));
  }

  /* ---------- Выполненные ---------- */
  function completed(root) {
    const tasks = Store.tasks().filter((x) => x.done)
      .sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0));
    const filtered = byCat(tasks);
    root.innerHTML = `
      <div class="view-anim">
        <div class="page-head"><h2>${esc(t('navCompleted'))}</h2></div>
        ${categoryChipsHTML(_catFilter)}
        <div id="list"></div>
      </div>`;
    Views.renderTaskList(root.querySelector('#list'), filtered, {
      emptyTitle: t('emptyCompleted'), emptySub: t('emptyCompletedSub')
    });
    bindCategoryChips(root, () => completed(root));
  }

  /* ---------- Календарь ---------- */
  function calendar(root) {
    const now = new Date();
    if (_calState.year === null) {
      _calState.year = now.getFullYear();
      _calState.month = now.getMonth();
      _calState.selected = Store.todayISO();
    }
    const { year, month } = _calState;
    const monthNames = t('months');
    const dows = t('dow');

    // задачи по датам
    const byDate = {};
    Store.tasks().forEach((x) => {
      if (!x.date) return;
      (byDate[x.date] = byDate[x.date] || []).push(x);
    });

    // сетка: неделя с понедельника
    const first = new Date(year, month, 1);
    let startOffset = (first.getDay() + 6) % 7; // 0 = пн
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysPrev = new Date(year, month, 0).getDate();
    const cells = [];
    const cellCount = Math.ceil((startOffset + daysInMonth) / 7) * 7;
    for (let i = 0; i < cellCount; i++) {
      const dayNum = i - startOffset + 1;
      let d, other = false;
      if (dayNum < 1) { d = new Date(year, month - 1, daysPrev + dayNum); other = true; }
      else if (dayNum > daysInMonth) { d = new Date(year, month + 1, dayNum - daysInMonth); other = true; }
      else d = new Date(year, month, dayNum);
      cells.push({ d, iso: Store.toISODate(d), other });
    }

    const todayISO = Store.todayISO();
    const cellsHTML = cells.map((c) => {
      const dayTasks = byDate[c.iso] || [];
      const active = dayTasks.filter((x) => !x.done);
      const shown = active.length ? active : dayTasks;
      const dots = shown.slice(0, 3).map((x) => {
        const cat = Store.categoryById(x.categoryId);
        const color = x.priority ? 'var(--accent2)' : (cat ? cat.color : 'var(--text-dim)');
        return `<i style="background:${color};color:${color}"></i>`;
      }).join('');
      const cls = ['cal-day'];
      if (c.other) cls.push('other');
      if (c.iso === todayISO) cls.push('today');
      if (c.iso === _calState.selected) cls.push('selected');
      return `<button class="${cls.join(' ')}" data-day="${c.iso}">
        <span class="cal-num">${c.d.getDate()}</span>
        ${dots ? `<span class="cal-dots">${dots}</span>` : '<span class="cal-dots"></span>'}
        ${dayTasks.length ? `<span class="cal-count">${dayTasks.length}</span>` : ''}
      </button>`;
    }).join('');

    root.innerHTML = `
      <div class="view-anim">
        <div class="panel">
          <div class="cal-head">
            <button class="icon-btn" id="cal-prev" aria-label="←">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
            </button>
            <h2>${esc(monthNames[month])} ${year}</h2>
            <button class="icon-btn" id="cal-next" aria-label="→">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
            </button>
          </div>
          <div class="cal-grid">
            ${dows.map((d) => `<div class="cal-dow">${esc(d)}</div>`).join('')}
            ${cellsHTML}
          </div>
        </div>
        <div class="section-title" id="cal-day-title"></div>
        <div id="cal-day-list"></div>
      </div>`;

    function shift(delta) {
      let m = _calState.month + delta, y = _calState.year;
      if (m < 0) { m = 11; y--; }
      if (m > 11) { m = 0; y++; }
      _calState.year = y; _calState.month = m;
      calendar(root);
    }
    root.querySelector('#cal-prev').addEventListener('click', () => shift(-1));
    root.querySelector('#cal-next').addEventListener('click', () => shift(1));

    function renderDay() {
      const iso = _calState.selected;
      const list = Store.sortTasks((byDate[iso] || []));
      root.querySelector('#cal-day-title').textContent = t('calTasksFor') + ' ' + Store.formatDateLong(iso);
      const box = root.querySelector('#cal-day-list');
      if (!list.length) {
        box.innerHTML = `<div class="empty" style="padding:26px"><h3>${esc(t('emptyDay'))}</h3></div>`;
      } else {
        box.innerHTML = `<div class="task-list">${list.map((x) => Views.taskCardHTML(x)).join('')}</div>`;
        Views.bindTaskCards(box);
      }
    }

    root.querySelectorAll('[data-day]').forEach((cell) => {
      cell.addEventListener('click', () => {
        _calState.selected = cell.dataset.day;
        root.querySelectorAll('.cal-day').forEach((x) => x.classList.toggle('selected', x.dataset.day === _calState.selected));
        renderDay();
      });
    });
    renderDay();
  }

  /* ---------- Поиск ---------- */
  const STATUS_KEYWORDS = {
    priority: ['важно', 'priority', 'приоритет', 'срочно'],
    today: ['сегодня', 'today'],
    overdue: ['просрочено', 'overdue', 'просроченные'],
    done: ['выполнено', 'done', 'выполненные', 'completed']
  };

  function searchMatch(task, words) {
    const cat = Store.categoryById(task.categoryId);
    const haystack = [task.title, task.notes, cat ? Store.categoryName(cat) : '', cat ? cat.name : '']
      .join(' ').toLowerCase();
    return words.every((w) => {
      if (haystack.includes(w)) return true;
      // статусные ключевые слова
      if (STATUS_KEYWORDS.priority.includes(w)) return task.priority;
      if (STATUS_KEYWORDS.today.includes(w)) return task.date === Store.todayISO();
      if (STATUS_KEYWORDS.overdue.includes(w)) return Store.isOverdue(task);
      if (STATUS_KEYWORDS.done.includes(w)) return task.done;
      return false;
    });
  }

  function search(root) {
    root.innerHTML = `
      <div class="view-anim">
        <div class="page-head"><h2>${esc(t('navSearch'))}</h2></div>
        <div class="search-box">
          <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
          <input class="input" id="search-input" placeholder="${esc(t('searchPh'))}" value="${esc(_searchQ)}" autocomplete="off">
        </div>
        <div class="search-hints">
          <button class="chip" data-hint="${esc(t('searchHintImportant'))}">✦ ${esc(t('searchHintImportant'))}</button>
          <button class="chip" data-hint="${esc(t('searchHintToday'))}">${esc(t('searchHintToday'))}</button>
          <button class="chip" data-hint="${esc(t('searchHintOverdue'))}">${esc(t('searchHintOverdue'))}</button>
          <button class="chip" data-hint="${esc(t('searchHintDone'))}">${esc(t('searchHintDone'))}</button>
        </div>
        <div id="search-results"></div>
      </div>`;

    const input = root.querySelector('#search-input');
    const results = root.querySelector('#search-results');

    function run() {
      _searchQ = input.value;
      const q = input.value.trim().toLowerCase();
      if (!q) {
        results.innerHTML = Views.emptyState(t('searchStart'), t('searchStartSub'));
        return;
      }
      const words = q.split(/\s+/).filter(Boolean);
      const found = Store.sortTasks(Store.tasks().filter((x) => searchMatch(x, words)));
      if (!found.length) {
        results.innerHTML = Views.emptyState(t('emptySearch'), t('emptySearchSub'));
        return;
      }
      results.innerHTML = `<div class="task-list">${found.map((x) =>
        Views.taskCardHTML(x, { highlight: (html) => Views.highlight(html, words) })
      ).join('')}</div>`;
      Views.bindTaskCards(results);
    }

    input.addEventListener('input', run);
    root.querySelectorAll('[data-hint]').forEach((chip) => {
      chip.addEventListener('click', () => { input.value = chip.dataset.hint; run(); input.focus(); });
    });
    run();
  }

  return { today, upcoming, all, completed, calendar, search };
})();

/* ================================================================
   Экраны настроек и PRO
   ================================================================ */

// Адрес для обратной связи — берётся из env/config.js (лучше менять там)
const FEEDBACK_EMAIL =
  (window.CrystalEnv && window.CrystalEnv.feedbackEmail) || 'feedback@example.com';

const SettingsScreens = (() => {

  function item(icon, title, sub, route, tag) {
    return `<div class="settings-item" data-route="${esc(route)}">
      <div class="si-icon">${icon}</div>
      <div class="si-text">
        <div class="si-title">${esc(title)} ${tag ? '<span class="pro-tag">' + esc(tag) + '</span>' : ''}</div>
        <div class="si-sub">${esc(sub)}</div>
      </div>
      <svg class="si-arrow" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
    </div>`;
  }

  function bindItems(root) {
    root.querySelectorAll('[data-route]').forEach((el) => {
      el.addEventListener('click', () => { location.hash = '#/' + el.dataset.route; });
    });
  }

  /* ---------- хаб настроек ---------- */
  function hub(root) {
    const icoUser = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 5-6 8-6s6.5 2 8 6"/></svg>';
    const icoPalette = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3a9 9 0 1 0 0 18c1.5 0 2-.8 2-1.8 0-1.6-1.5-2-1.5-3.2 0-1.1.9-2 2-2H17a5 5 0 0 0 5-5c0-3.3-4.5-6-10-6Z"/><circle cx="7.5" cy="11.5" r="1.3" fill="currentColor"/><circle cx="11" cy="7.5" r="1.3" fill="currentColor"/><circle cx="15.5" cy="8.5" r="1.3" fill="currentColor"/></svg>';
    const icoBell = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>';
    const icoGlobe = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 4 5.6 4 9s-1.5 6.4-4 9c-2.5-2.6-4-5.6-4-9s1.5-6.4 4-9Z"/></svg>';
    const icoDb = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5"/><path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/></svg>';
    const icoPro = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 3 14.5 9 21 9.5 16 13.5 17.8 20 12 16.5 6.2 20 8 13.5 3 9.5 9.5 9Z"/></svg>';

    root.innerHTML = `
      <div class="view-anim">
        <div class="page-head"><h2>${esc(t('settings'))}</h2></div>
        <div class="panel settings-group">
          ${item(icoUser, t('stProfile'), t('stProfileSub'), 'settings/profile')}
          ${item(icoPalette, t('stDesign'), t('stDesignSub'), 'settings/design')}
          ${item(icoBell, t('stNotifications'), t('stNotificationsSub'), 'settings/notifications')}
          ${item(icoGlobe, t('stGeneral'), t('stGeneralSub'), 'settings/general')}
          ${item(icoDb, t('stData'), t('stDataSub'), 'settings/data')}
        </div>
        <div class="panel settings-group">
          ${item(icoPro, t('proTitle'), t('proTeaserList'), 'pro', 'PRO')}
        </div>
        <p class="muted" style="text-align:center">${esc(t('appName'))} · ${esc(t('version'))} 1.0.0</p>
      </div>`;
    bindItems(root);
  }

  /* ---------- переключатель из настроек ---------- */
  function switchRow(label, hint, on, id, proLocked) {
    return `<div class="switch-row">
      <div>
        <div class="sw-label">${esc(label)} ${proLocked ? '<span class="pro-tag">PRO</span>' : ''}</div>
        ${hint ? `<div class="sw-hint">${esc(hint)}</div>` : ''}
      </div>
      <button class="switch ${on ? 'on' : ''}" id="${esc(id)}" role="switch" aria-checked="${!!on}" ${proLocked ? 'data-locked="1"' : ''}></button>
    </div>`;
  }

  function bindSwitch(root, id, getter, setter) {
    const el = root.querySelector('#' + id);
    if (!el) return;
    el.addEventListener('click', () => {
      if (el.dataset.locked) {
        App.toast('◆ ' + t('proLocked') + ' — ' + t('proLockedSub'));
        return;
      }
      const nv = !el.classList.contains('on');
      el.classList.toggle('on', nv);
      el.setAttribute('aria-checked', nv);
      setter(nv);
    });
  }

  function segmentHTML(id, options, current) {
    return `<div class="segment" id="${esc(id)}">
      ${options.map((o) => `<button data-val="${esc(o.val)}" class="${current === o.val ? 'active' : ''}">${esc(o.label)}</button>`).join('')}
    </div>`;
  }

  function bindSegment(root, id, setter) {
    const seg = root.querySelector('#' + id);
    if (!seg) return;
    seg.querySelectorAll('button').forEach((b) => {
      b.addEventListener('click', () => {
        seg.querySelectorAll('button').forEach((x) => x.classList.remove('active'));
        b.classList.add('active');
        setter(b.dataset.val);
      });
    });
  }

  function backBtn(route) {
    return `<button class="icon-btn" data-route="${esc(route)}" aria-label="${esc(t('back'))}">
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
    </button>`;
  }

  /* ---------- Профиль ---------- */
  function profile(root) {
    const s = Store.get();
    root.innerHTML = `
      <div class="view-anim">
        <div class="page-head">${backBtn('settings')}<h2>${esc(t('stProfile'))}</h2></div>
        <div class="panel">
          <div style="display:flex;align-items:center;gap:16px;margin-bottom:18px">
            <div class="avatar" id="prof-avatar" style="width:72px;height:72px;font-size:26px"></div>
            <div>
              <div class="sw-label">${esc(t('profileAvatar'))}</div>
              <button class="btn btn-ghost btn-sm mt8" id="prof-avatar-btn">${esc(t('profileAvatarChange'))}</button>
              <input type="file" id="prof-avatar-input" accept="image/*" class="hidden">
            </div>
          </div>
          <div class="field">
            <label>${esc(t('profileName'))}</label>
            <input class="input" id="prof-name" maxlength="40" placeholder="${esc(t('profileNamePh'))}" value="${esc(s.profileName)}">
          </div>
          <button class="btn btn-crystal btn-block" id="prof-save">${esc(t('save'))}</button>
        </div>
      </div>`;
    bindItems(root);
    App.renderAvatarInto(root.querySelector('#prof-avatar'));

    const input = root.querySelector('#prof-avatar-input');
    root.querySelector('#prof-avatar-btn').addEventListener('click', () => input.click());
    input.addEventListener('change', () => {
      const file = input.files && input.files[0];
      if (!file) return;
      const id = Store.uid();
      const old = Store.get('avatarId');
      DB.putFile({ id, kind: 'avatar', name: file.name, type: file.type, blob: file })
        .then(() => {
          Store.set('avatarId', id);
          if (old && old !== id) DB.deleteFile(old).catch(() => {});
          App.renderAvatarInto(root.querySelector('#prof-avatar'));
          App.renderChrome();
        })
        .catch(() => App.toast('⚠ IndexedDB недоступен'));
      input.value = '';
    });

    root.querySelector('#prof-save').addEventListener('click', () => {
      Store.set('profileName', root.querySelector('#prof-name').value.trim());
      App.toast('✦ ' + t('profileSaved'));
      App.renderChrome();
    });
  }

  /* ---------- Язык и формат ---------- */
  function general(root) {
    const s = Store.get();
    root.innerHTML = `
      <div class="view-anim">
        <div class="page-head">${backBtn('settings')}<h2>${esc(t('stGeneral'))}</h2></div>
        <div class="panel">
          <div class="field">
            <label>${esc(t('language'))}</label>
            ${segmentHTML('g-lang', [{ val: 'ru', label: 'Русский' }, { val: 'en', label: 'English' }], s.lang)}
          </div>
          <div class="field">
            <label>${esc(t('timeFormat'))}</label>
            ${segmentHTML('g-time', [{ val: '24', label: '24:00' }, { val: '12', label: '12 AM/PM' }], s.timeFormat)}
          </div>
          <div class="field">
            <label>${esc(t('dateFormat'))}</label>
            ${segmentHTML('g-date', [{ val: 'dmy', label: 'ДД.ММ.ГГГГ' }, { val: 'mdy', label: 'MM/DD/YYYY' }], s.dateFormat)}
          </div>
        </div>
      </div>`;
    bindItems(root);
    bindSegment(root, 'g-lang', (v) => { Store.set('lang', v); App.applySettings(); App.renderChrome(); App.renderView(); });
    bindSegment(root, 'g-time', (v) => Store.set('timeFormat', v));
    bindSegment(root, 'g-date', (v) => Store.set('dateFormat', v));
  }

  /* ---------- Оформление ---------- */
  function design(root) {
    const s = Store.get();
    const themes = [
      { id: 'crystal', name: t('themeCrystal'), cls: 'tc-crystal' },
      { id: 'night', name: t('themeNight'), cls: 'tc-night' },
      { id: 'sakura', name: t('themeSakura'), cls: 'tc-sakura' },
      { id: 'chrome', name: t('themeChrome'), cls: 'tc-chrome' }
    ];
    const themesLocked = App.isLocked('themes');
    const logoStyles = [
      { id: 'butterfly', name: t('iconButterfly') },
      { id: 'gem', name: t('iconGem') },
      { id: 'collage', name: t('iconCollage') }
    ];

    root.innerHTML = `
      <div class="view-anim">
        <div class="page-head">${backBtn('settings')}<h2>${esc(t('stDesign'))}</h2></div>

        <div class="panel settings-group">
          <div class="field">
            <label>${esc(t('theme'))} ${themesLocked ? '<span class="pro-tag">PRO</span>' : ''}</label>
            <div class="theme-grid">
              ${themes.map((th) => {
                const locked = themesLocked && th.id !== 'crystal';
                return `<button class="theme-card ${s.theme === th.id ? 'active' : ''}" data-theme-id="${th.id}" ${locked ? 'data-locked="1"' : ''}>
                  <div class="tc-preview ${th.cls}"></div>
                  <div class="tc-name">${esc(th.name)}${locked ? ' ◆' : ''}</div>
                </button>`;
              }).join('')}
            </div>
          </div>
          <div class="field">
            <label>${esc(t('accentColor'))}</label>
            <div class="row">
              <input type="color" class="input" id="d-accent" style="max-width:90px" value="${esc(s.accent || '#ff9ecd')}">
              <button class="btn btn-ghost btn-sm" id="d-accent-reset">${esc(t('cancel'))}</button>
            </div>
          </div>
          <div class="field">
            <label>${esc(t('uiStyle'))}</label>
            ${segmentHTML('d-ui', [
              { val: 'glass', label: t('uiGlass') },
              { val: 'solid', label: t('uiSolid') },
              { val: 'minimal', label: t('uiMinimal') }
            ], s.uiStyle)}
          </div>
          <div class="field">
            <label>${esc(t('panelAlpha'))} · <span id="d-alpha-val">${Math.round(s.panelAlpha * 100)}%</span></label>
            <input type="range" id="d-alpha" min="20" max="90" value="${Math.round(s.panelAlpha * 100)}">
          </div>
        </div>

        <div class="panel settings-group">
          <div class="field">
            <label>${esc(t('iconStyle'))}</label>
            <div class="logo-picker">
              ${logoStyles.map((ls) => `
                <button class="logo-option ${s.iconStyle === ls.id ? 'active' : ''}" data-logo="${ls.id}" title="${esc(ls.name)}">
                  ${Views.logoSVG(ls.id)}
                </button>`).join('')}
            </div>
            <p class="muted mt8">${esc(t('iconStyleNote'))}</p>
          </div>
          <div class="field">
            <label>${esc(t('homeScreen'))}</label>
            ${segmentHTML('d-home', [
              { val: 'today', label: t('navToday') },
              { val: 'calendar', label: t('navCalendar') },
              { val: 'all', label: t('navAll') }
            ], s.homeScreen)}
          </div>
          <div class="field">
            <label>${esc(t('transition'))}</label>
            ${segmentHTML('d-tr', [
              { val: 'none', label: t('trNone') },
              { val: 'fade', label: t('trFade') },
              { val: 'slide', label: t('trSlide') },
              { val: 'scale', label: t('trScale') }
            ], s.transition)}
          </div>
          <div class="field">
            <label>${esc(t('completedStyle'))}</label>
            ${segmentHTML('d-cs', [
              { val: 'strike', label: t('csStrike') },
              { val: 'fade', label: t('csFade') },
              { val: 'hide', label: t('csHide') },
              { val: 'sparkle', label: t('csSparkle') }
            ], s.completedStyle)}
          </div>
          ${switchRow(t('priorityFirst'), '', s.priorityFirst, 'd-pf')}
          ${switchRow(t('autoRollover'), t('autoRolloverSub'), s.autoRollover, 'd-rollover')}
        </div>
      </div>`;
    bindItems(root);

    root.querySelectorAll('[data-theme-id]').forEach((card) => {
      card.addEventListener('click', () => {
        if (card.dataset.locked) {
          App.toast('◆ ' + t('proLocked') + ' — ' + t('proLockedSub'));
          return;
        }
        Store.set('theme', card.dataset.themeId);
        App.applySettings();
        design(root);
      });
    });

    root.querySelector('#d-accent').addEventListener('input', (e) => {
      Store.set('accent', e.target.value);
      App.applySettings();
    });
    root.querySelector('#d-accent-reset').addEventListener('click', () => {
      Store.set('accent', '');
      App.applySettings();
      design(root);
    });

    bindSegment(root, 'd-ui', (v) => { Store.set('uiStyle', v); App.applySettings(); });
    bindSegment(root, 'd-home', (v) => Store.set('homeScreen', v));
    bindSegment(root, 'd-tr', (v) => { Store.set('transition', v); App.applySettings(); });
    bindSegment(root, 'd-cs', (v) => { Store.set('completedStyle', v); App.applySettings(); App.renderView(); });

    const alpha = root.querySelector('#d-alpha');
    alpha.addEventListener('input', () => {
      root.querySelector('#d-alpha-val').textContent = alpha.value + '%';
      Store.set('panelAlpha', alpha.value / 100);
      App.applySettings();
    });

    root.querySelectorAll('[data-logo]').forEach((btn) => {
      btn.addEventListener('click', () => {
        Store.set('iconStyle', btn.dataset.logo);
        App.renderChrome();
        design(root);
      });
    });

    bindSwitch(root, 'd-pf', null, (nv) => { Store.set('priorityFirst', nv); });
    bindSwitch(root, 'd-rollover', null, (nv) => Store.set('autoRollover', nv));
  }

  /* ---------- Уведомления ---------- */
  function notifications(root) {
    const n = Store.get('notify');
    const sounds = Notify.soundOptions().filter((o) => !(o.custom && App.isLocked('customSound')));
    const perm = Notify.permissionState();
    const permText = { granted: t('notifPermGranted'), denied: t('notifPermDenied'), default: t('notifPermDefault'), unsupported: t('notifPermUnsupported') }[perm];
    const flashLocked = App.isLocked('flash');

    root.innerHTML = `
      <div class="view-anim">
        <div class="page-head">${backBtn('settings')}<h2>${esc(t('stNotifications'))}</h2></div>
        <div class="panel settings-group">
          ${switchRow(t('notifyMaster'), '', n.master, 'n-master')}
          <div class="divider"></div>
          ${switchRow(t('notifyTask'), '', n.task, 'n-task')}
          ${switchRow(t('notifyDigest'), t('notifyDigestSub'), n.digest, 'n-digest')}
          ${switchRow(t('notifyOverdue'), '', n.overdue, 'n-overdue')}
        </div>

        <div class="panel settings-group">
          <div class="field">
            <label>${esc(t('soundMode'))}</label>
            ${segmentHTML('n-soundmode', [
              { val: 'signal', label: t('soundSignal') },
              { val: 'off', label: t('soundOff') }
            ], n.soundMode)}
          </div>
          <div class="field">
            <label>${esc(t('soundPicker'))}</label>
            <div class="row">
              <select class="select" id="n-sound" style="flex:1">
                ${sounds.map((o) => `<option value="${esc(o.id)}" ${n.soundId === o.id ? 'selected' : ''}>${esc(o.name)}</option>`).join('')}
              </select>
              <button class="btn btn-ghost btn-sm" id="n-preview">▶ ${esc(t('soundPreview'))}</button>
            </div>
          </div>
          <div class="field">
            <label>${esc(t('soundCustom'))} ${App.isLocked('customSound') ? '<span class="pro-tag">PRO</span>' : ''}</label>
            ${App.isLocked('customSound')
              ? `<p class="muted">◆ ${esc(t('proLockedSub'))}</p>`
              : `<button class="btn btn-ghost btn-sm" id="n-upload">⬆ ${esc(t('soundCustomAdd'))}</button>
                 <input type="file" id="n-upload-input" accept="audio/*" class="hidden">
                 <p class="muted mt8">${esc(t('soundCustomNote'))}</p>`}
          </div>
          ${switchRow(t('vibration'), '', n.vibrate, 'n-vibrate')}
          ${switchRow(t('flash'), t('flashSub'), n.flash, 'n-flash', flashLocked)}
        </div>

        <div class="panel settings-group">
          <div class="switch-row">
            <div>
              <div class="sw-label">${esc(t('notifPermission'))}</div>
              <div class="sw-hint" id="n-perm-status">${esc(permText)}</div>
            </div>
            ${perm === 'default' ? `<button class="btn btn-crystal btn-sm" id="n-perm-btn">${esc(t('notifPermRequest'))}</button>` : ''}
          </div>
        </div>
      </div>`;
    bindItems(root);

    function patchNotify(obj) {
      Store.set('notify', Object.assign({}, Store.get('notify'), obj));
    }

    bindSwitch(root, 'n-master', null, (nv) => patchNotify({ master: nv }));
    bindSwitch(root, 'n-task', null, (nv) => patchNotify({ task: nv }));
    bindSwitch(root, 'n-digest', null, (nv) => {
      patchNotify({ digest: nv });
      if (nv) Store.set('digestLastDate', ''); // позволить сводке показаться снова
    });
    bindSwitch(root, 'n-overdue', null, (nv) => {
      patchNotify({ overdue: nv });
      if (nv) Store.set('overdueLastDate', '');
    });
    bindSwitch(root, 'n-vibrate', null, (nv) => {
      patchNotify({ vibrate: nv });
      if (nv) Notify.vibrate();
    });
    bindSwitch(root, 'n-flash', null, (nv) => {
      patchNotify({ flash: nv });
      if (nv) { const el = document.getElementById('flash-overlay'); el.hidden = false; el.classList.add('active'); setTimeout(() => { el.classList.remove('active'); el.hidden = true; }, 1100); }
    });
    bindSegment(root, 'n-soundmode', (v) => patchNotify({ soundMode: v }));

    root.querySelector('#n-sound').addEventListener('change', (e) => {
      patchNotify({ soundId: e.target.value });
      Notify.play(e.target.value);
    });
    root.querySelector('#n-preview').addEventListener('click', () => {
      Notify.play(root.querySelector('#n-sound').value);
    });

    const upBtn = root.querySelector('#n-upload');
    if (upBtn) {
      const upInput = root.querySelector('#n-upload-input');
      upBtn.addEventListener('click', () => upInput.click());
      upInput.addEventListener('change', () => {
        const file = upInput.files && upInput.files[0];
        if (!file) return;
        const id = Store.uid();
        DB.putFile({ id, kind: 'sound', name: file.name, type: file.type, blob: file })
          .then(() => {
            const list = Store.get('customSounds').slice();
            list.push({ id, name: file.name });
            Store.set('customSounds', list);
            patchNotify({ soundId: 'custom:' + id });
            notifications(root);
          })
          .catch(() => App.toast('⚠ IndexedDB недоступен'));
        upInput.value = '';
      });
    }

    const permBtn = root.querySelector('#n-perm-btn');
    if (permBtn) permBtn.addEventListener('click', () => {
      Notify.requestPermission().then(() => notifications(root));
    });
  }

  /* ---------- Данные: кэш, сброс, обратная связь, поделиться ---------- */
  function data(root) {
    root.innerHTML = `
      <div class="view-anim">
        <div class="page-head">${backBtn('settings')}<h2>${esc(t('stData'))}</h2></div>

        <div class="panel settings-group">
          <div class="switch-row">
            <div>
              <div class="sw-label">${esc(t('clearCache'))}</div>
              <div class="sw-hint">${esc(t('clearCacheSub'))}</div>
            </div>
            <button class="btn btn-ghost btn-sm" id="d-clear-cache">${esc(t('confirm'))}</button>
          </div>
          <div class="divider"></div>
          <div class="switch-row">
            <div>
              <div class="sw-label" style="color:var(--danger)">${esc(t('resetAll'))}</div>
              <div class="sw-hint">${esc(t('resetAllSub'))}</div>
            </div>
            <button class="btn btn-danger btn-sm" id="d-reset">${esc(t('delete'))}</button>
          </div>
        </div>

        <div class="panel settings-group">
          <div class="switch-row">
            <div>
              <div class="sw-label">${esc(t('stShare'))}</div>
              <div class="sw-hint">${esc(t('stShareSub'))}</div>
            </div>
            <button class="btn btn-crystal btn-sm" id="d-share">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/></svg>
              ${esc(t('stShare'))}
            </button>
          </div>
        </div>

        <div class="panel settings-group">
          <h3 style="font-size:16px;font-weight:800;margin-bottom:12px">${esc(t('bkTitle'))}</h3>
          <div class="switch-row">
            <div>
              <div class="sw-label">${esc(t('bkExport'))}</div>
              <div class="sw-hint">${esc(t('bkExportSub'))}</div>
            </div>
            <button class="btn btn-crystal btn-sm" id="d-export">⬇ ${esc(t('bkExport'))}</button>
          </div>
          <div class="divider"></div>
          <div class="switch-row">
            <div>
              <div class="sw-label">${esc(t('bkImport'))}</div>
              <div class="sw-hint">${esc(t('bkImportSub'))}</div>
            </div>
            <button class="btn btn-ghost btn-sm" id="d-import">⬆ ${esc(t('bkImport'))}</button>
            <input type="file" id="d-import-input" accept="application/json,.json" class="hidden">
          </div>
        </div>

        <div class="panel settings-group">
          <h3 style="font-size:16px;font-weight:800;margin-bottom:12px">${esc(t('fbTitle'))}</h3>
          <div class="field">
            <label>${esc(t('fbName'))}</label>
            <input class="input" id="fb-name" maxlength="60">
          </div>
          <div class="field">
            <label>${esc(t('fbMessage'))}</label>
            <textarea class="textarea" id="fb-message" placeholder="${esc(t('fbMessagePh'))}"></textarea>
          </div>
          <button class="btn btn-crystal btn-block" id="fb-send">${esc(t('fbSend'))}</button>
          <p class="muted mt8">${esc(t('fbNote'))}</p>
        </div>

        <p class="muted" style="text-align:center">${esc(t('stAbout'))}: ${esc(t('appName'))} · ${esc(t('version'))} 1.0.0 · PWA ✦</p>
      </div>`;
    bindItems(root);

    // ---------- Резервная копия: выгрузка / загрузка ----------
    root.querySelector('#d-export').addEventListener('click', () => {
      const btn = root.querySelector('#d-export');
      btn.disabled = true;
      Store.exportAll()
        .then((dump) => {
          const stamp = new Date().toISOString().slice(0, 10);
          const blob = new Blob([JSON.stringify(dump)], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'crystal-backup-' + stamp + '.json';
          document.body.appendChild(a); a.click(); a.remove();
          setTimeout(() => URL.revokeObjectURL(url), 4000);
          App.toast('✦ ' + t('bkExported'));
        })
        .catch(() => App.toast('⚠ IndexedDB недоступен'))
        .finally(() => { btn.disabled = false; });
    });

    const importInput = root.querySelector('#d-import-input');
    root.querySelector('#d-import').addEventListener('click', () => importInput.click());
    importInput.addEventListener('change', () => {
      const file = importInput.files && importInput.files[0];
      importInput.value = '';
      if (!file) return;
      readerJson(file).then((json) => { 
        if (!json || json.app !== 'crystal-backup') {
          App.toast(t('bkBadFile'));
          return null;
        }
        return App.confirmDialog(t('bkImportReset')).then((ok) => (ok ? json : null));
      }).then((json) => {
        if (!json) return;
        App.toast(t('bkImporting'));
        Store.importAll(json)
          .then(() => {
            App.toast('✦ ' + t('bkImported'));
            App.applySettings();
            App.renderChrome();
            App.renderView();
            setTimeout(() => location.reload(), 900);
          })
          .catch(() => App.toast(t('bkBadFile')));
      }).catch(() => { /* чтение не удалось */ });
    });

    root.querySelector('#d-clear-cache').addEventListener('click', () => {
      if (!('caches' in window)) { App.toast('⚠ Cache API недоступен'); return; }
      caches.keys()
        .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
        .then(() => App.toast('✦ ' + t('cacheCleared')))
        .catch(() => App.toast('⚠ Cache API недоступен'));
    });

    root.querySelector('#d-reset').addEventListener('click', () => {
      App.confirmDialog(t('resetConfirm')).then((ok) => {
        if (!ok) return;
        Promise.all([
          DB.clearAll().catch(() => {}),
          ('caches' in window) ? caches.keys().then((ks) => Promise.all(ks.map((k) => caches.delete(k)))).catch(() => {}) : Promise.resolve()
        ]).then(() => {
          Store.resetAll();
          App.toast('✦ ' + t('resetDone'));
          setTimeout(() => location.reload(), 700);
        });
      });
    });

    root.querySelector('#d-share').addEventListener('click', () => {
      const url = location.href.split('#')[0];
      const shareData = { title: t('appName'), text: t('shareText'), url };
      if (navigator.share) {
        navigator.share(shareData).catch(() => {});
      } else if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url)
          .then(() => App.toast('✦ ' + t('shareCopied')))
          .catch(() => App.toast(url));
      } else {
        App.toast(url);
      }
    });

    root.querySelector('#fb-send').addEventListener('click', () => {
      const name = root.querySelector('#fb-name').value.trim();
      const msg = root.querySelector('#fb-message').value.trim();
      if (!msg) { root.querySelector('#fb-message').focus(); return; }
      Store.saveFeedback({ name, message: msg });
      const subject = encodeURIComponent(t('appName') + ' — feedback');
      const body = encodeURIComponent((name ? name + ':\n' : '') + msg);
      location.href = `mailto:${FEEDBACK_EMAIL}?subject=${subject}&body=${body}`;
      App.toast('✦ ' + t('fbSaved'));
      root.querySelector('#fb-message').value = '';
    });
  }

  return { hub, profile, general, design, notifications, data, switchRow, bindSwitch, bindSegment, backBtn };
})();

/* ================================================================
   PRO-раздел: маркетинговый тизер + панель владельца по PIN
   ================================================================ */
const ProScreen = (() => {

  // Список функций, которые владелец может пометить как «только PRO»
  const LOCKABLE = [
    { key: 'attachments', i18n: 'proFeatAttachments' },
    { key: 'customSound', i18n: 'proFeatCustomSound' },
    { key: 'themes', i18n: 'proFeatThemes' },
    { key: 'flash', i18n: 'proFeatFlash' },
    { key: 'repeatCustom', i18n: 'proFeatRepeatCustom' }
  ];

  let _pinBuf = '';
  let _pinMode = 'enter'; // 'enter' | 'set'

  function teaserHTML() {
    return `
      <div class="pro-hero">
        <h2>✦ ${esc(t('proTitle'))} <span class="pro-tag">PRO</span></h2>
        <p>${esc(t('proTeaser'))}</p>
      </div>
      <div class="section-title">${esc(t('proTeaserList'))}</div>
      <div class="panel">
        ${LOCKABLE.map((f) => `
          <div class="pro-feature-row">
            <div class="row"><span style="font-size:17px">💎</span><strong style="font-size:14.5px">${esc(t(f.i18n))}</strong></div>
            <span class="pro-tag">PRO</span>
          </div>`).join('')}
      </div>`;
  }

  function pinPadHTML(mode) {
    return `
      <div class="panel" style="max-width:420px;margin:16px auto 0">
        <h3 style="text-align:center;font-size:16px">${esc(mode === 'set' ? t('proSetPin') : t('proEnterPin'))}</h3>
        <div class="pin-dots" id="pin-dots"><i></i><i></i><i></i><i></i></div>
        <div class="pin-pad">
          ${[1,2,3,4,5,6,7,8,9].map((n) => `<button class="pin-key" data-key="${n}">${n}</button>`).join('')}
          <span></span>
          <button class="pin-key" data-key="0">0</button>
          <button class="pin-key" data-key="back">⌫</button>
        </div>
      </div>`;
  }

  function bindPinPad(root, onDone) {
    _pinBuf = '';
    const dots = root.querySelectorAll('#pin-dots i');
    root.querySelectorAll('.pin-key').forEach((key) => {
      key.addEventListener('click', () => {
        const k = key.dataset.key;
        if (k === 'back') _pinBuf = _pinBuf.slice(0, -1);
        else if (_pinBuf.length < 4) _pinBuf += k;
        dots.forEach((d, i) => d.classList.toggle('filled', i < _pinBuf.length));
        if (_pinBuf.length === 4) {
          const buf = _pinBuf;
          _pinBuf = '';
          setTimeout(() => onDone(buf), 160);
        }
      });
    });
  }

  function ownerPanelHTML(pro) {
    return `
      <div class="pro-hero">
        <h2>👑 ${esc(t('proUnlocked'))}</h2>
        <p>${esc(t('proLockNote'))}</p>
      </div>
      <div class="section-title">${esc(t('proLockFeatures'))}</div>
      <div class="panel">
        ${LOCKABLE.map((f) => `
          <div class="pro-feature-row">
            <strong style="font-size:14.5px">${esc(t(f.i18n))}</strong>
            <button class="switch ${pro.locks[f.key] ? 'on' : ''}" data-lock="${esc(f.key)}" role="switch" aria-checked="${!!pro.locks[f.key]}"></button>
          </div>`).join('')}
      </div>
      <div class="section-title">${esc(t('proFuture'))}</div>
      <div class="panel">
        <p class="muted mb8">${esc(t('proFutureSub'))}</p>
        <div id="pro-custom-list">
          ${pro.custom.length ? pro.custom.map((c) => `
            <div class="pro-feature-row">
              <div>
                <strong style="font-size:14.5px">💎 ${esc(c.name)}</strong>
                <div class="muted">${esc(c.desc)}</div>
              </div>
              <button class="link-btn" data-del-custom="${esc(c.id)}" style="color:var(--danger)">✕</button>
            </div>`).join('') : `<p class="muted" style="padding:10px 0">${esc(t('proEmpty'))}</p>`}
        </div>
        <div class="divider"></div>
        <div class="field"><label>${esc(t('proFeatureName'))}</label><input class="input" id="pro-cf-name" maxlength="60"></div>
        <div class="field"><label>${esc(t('proFeatureDesc'))}</label><input class="input" id="pro-cf-desc" maxlength="140"></div>
        <button class="btn btn-crystal btn-block" id="pro-cf-add">${esc(t('proAddFeature'))}</button>
      </div>
      <button class="btn btn-ghost btn-block mt16" id="pro-exit">${esc(t('proExit'))}</button>`;
  }

  function render(root) {
    const pro = Store.get('pro');
    const hasPin = !!pro.pinHash;
    const unlocked = App.isProUnlocked();

    if (unlocked) {
      root.innerHTML = `<div class="view-anim"><div class="page-head">${SettingsScreens.backBtn('settings')}<h2>${esc(t('proTitle'))}</h2></div>${ownerPanelHTML(pro)}</div>`;
      bindOwner(root);
      return;
    }

    // Тизер + вход владельца
    _pinMode = hasPin ? 'enter' : 'set';
    root.innerHTML = `
      <div class="view-anim">
        <div class="page-head">${SettingsScreens.backBtn('settings')}<h2>${esc(t('proTitle'))}</h2></div>
        ${teaserHTML()}
        <div class="section-title" style="text-align:center">${esc(t('proOwnerEnter'))}</div>
        ${pinPadHTML(_pinMode)}
      </div>`;
    SettingsScreensBindItems(root);
    bindPinPad(root, (pin) => {
      Store.hashPinSha(pin).then((h) => {
        if (_pinMode === 'set') {
          const p = Store.get('pro');
          p.pinHash = h;
          Store.set('pro', p);
          _pinMode = 'enter'; // при следующем входе на экране снова ввод
          App.setProUnlocked(true);
          App.toast('✦ ' + t('proPinSet'));
          render(root);
        } else if (h === pro.pinHash || Store.hashPin(pin) === pro.pinHash) {
          const p = Store.get('pro');
          if (pro.pinHash.slice(0, 3) !== 's1$') {
            // миграция: перезаписываем слабый хэш на SHA-256 по тому же PIN
            p.pinHash = h;
            Store.set('pro', p);
          }
          App.setProUnlocked(true);
          App.toast('✦ ' + t('proUnlocked'));
          render(root);
        } else {
          App.toast('⚠ ' + t('proWrongPin'));
          root.querySelectorAll('#pin-dots i').forEach((d) => d.classList.remove('filled'));
        }
      });
    });
  }

  // небольшой адаптер, чтобы не тащить bindItems наружу из SettingsScreens
  function SettingsScreensBindItems(root) {
    root.querySelectorAll('[data-route]').forEach((el) => {
      el.addEventListener('click', () => { location.hash = '#/' + el.dataset.route; });
    });
  }

  function bindOwner(root) {
    SettingsScreensBindItems(root);
    root.querySelectorAll('[data-lock]').forEach((sw) => {
      sw.addEventListener('click', () => {
        const pro = Store.get('pro');
        const key = sw.dataset.lock;
        pro.locks[key] = !pro.locks[key];
        Store.set('pro', pro);
        sw.classList.toggle('on', pro.locks[key]);
        sw.setAttribute('aria-checked', pro.locks[key]);
      });
    });
    root.querySelector('#pro-cf-add').addEventListener('click', () => {
      const name = root.querySelector('#pro-cf-name').value.trim();
      const desc = root.querySelector('#pro-cf-desc').value.trim();
      if (!name) { root.querySelector('#pro-cf-name').focus(); return; }
      const pro = Store.get('pro');
      pro.custom.push({ id: Store.uid(), name, desc });
      Store.set('pro', pro);
      App.toast('✦ ' + t('proFeatureAdded'));
      render(root);
    });
    root.querySelectorAll('[data-del-custom]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const pro = Store.get('pro');
        pro.custom = pro.custom.filter((c) => c.id !== btn.dataset.delCustom);
        Store.set('pro', pro);
        render(root);
      });
    });
    root.querySelector('#pro-exit').addEventListener('click', () => {
      App.setProUnlocked(false);
      render(root);
    });
  }

  return { render, LOCKABLE };
})();

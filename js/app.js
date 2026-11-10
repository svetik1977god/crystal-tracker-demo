/* Кристалл — оболочка приложения: роутер, модалки, тосты, панель уведомлений */
'use strict';

const App = (() => {
  const view = document.getElementById('view');
  let _currentRoute = '';
  let _modalCloseCbs = [];
  let _proUnlocked = false;
  let _animT = null;
  try { _proUnlocked = sessionStorage.getItem('crystal_pro') === '1'; } catch (e) {}

  /* ================= PRO-замки ================= */
  function isLocked(key) {
    const pro = Store.get('pro');
    return !!(pro && pro.locks && pro.locks[key]) && !_proUnlocked;
  }
  function isProUnlocked() { return _proUnlocked; }
  function setProUnlocked(v) {
    _proUnlocked = !!v;
    try { sessionStorage.setItem('crystal_pro', v ? '1' : '0'); } catch (e) {}
  }

  /* ================= Настройки → DOM ================= */
  function hexToRgba(hex, alpha) {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
    if (!m) return `rgba(232,121,249,${alpha})`;
    const n = parseInt(m[1], 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
  }

  function applySettings() {
    const s = Store.get();
    const b = document.body;
    b.dataset.theme = s.theme;
    b.dataset.ui = s.uiStyle;
    b.dataset.transition = s.transition;
    b.dataset.completed = s.completedStyle;
    document.documentElement.lang = s.lang;
    document.documentElement.style.setProperty('--panel-alpha', s.panelAlpha);
    if (s.accent) {
      document.documentElement.style.setProperty('--accent', s.accent);
      document.documentElement.style.setProperty('--accent2', s.accent);
      document.documentElement.style.setProperty('--accent3', s.accent);
      document.documentElement.style.setProperty('--glow', hexToRgba(s.accent, 0.45));
    } else {
      ['--accent', '--accent2', '--accent3', '--glow'].forEach((p) => document.documentElement.style.removeProperty(p));
    }
  }

  /* ================= Тосты ================= */
  function toast(msg, actionLabel, actionFn, duration) {
    const root = document.getElementById('toast-root');
    const el = document.createElement('div');
    el.className = 'toast';
    el.innerHTML = `<span>${esc(msg)}</span>` +
      (actionLabel ? `<button class="link-btn">${esc(actionLabel)}</button>` : '');
    root.appendChild(el);
    let done = false;
    function dismiss() {
      if (done) return;
      done = true;
      el.classList.add('out');
      setTimeout(() => el.remove(), 260);
    }
    if (actionLabel) {
      el.querySelector('.link-btn').addEventListener('click', () => {
        dismiss();
        if (actionFn) actionFn();
      });
    }
    setTimeout(dismiss, duration || (actionLabel ? 5000 : 2600));
  }

  /* ================= Модалки ================= */
  function modal(html) {
    closeModal();
    _modalCloseCbs = [];
    const root = document.getElementById('modal-root');
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.innerHTML = `<div class="modal panel" role="dialog" aria-modal="true">${html}</div>`;
    root.appendChild(backdrop);
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop || e.target.closest('[data-close]')) closeModal();
    });
    return backdrop.querySelector('.modal');
  }

  function closeModal() {
    const root = document.getElementById('modal-root');
    if (!root.firstChild) return;
    root.innerHTML = '';
    const cbs = _modalCloseCbs.slice();
    _modalCloseCbs = [];
    cbs.forEach((fn) => { try { fn(); } catch (e) {} });
  }

  function onModalClose(fn) { _modalCloseCbs.push(fn); }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeModal();
      hideNotifPanel();
    }
  });

  function confirmDialog(msg) {
    return new Promise((resolve) => {
      modal(`
        <h3>${esc(msg)}</h3>
        <div class="modal-actions">
          <button class="btn btn-ghost" id="cf-no">${esc(t('cancel'))}</button>
          <button class="btn btn-danger" id="cf-yes">${esc(t('confirm'))}</button>
        </div>
      `);
      document.getElementById('cf-yes').addEventListener('click', () => { closeModal(); resolve(true); });
      document.getElementById('cf-no').addEventListener('click', () => { closeModal(); resolve(false); });
    });
  }

  function promptModal(title, label, cb) {
    modal(`
      <h3>${esc(title)}</h3>
      <div class="field">
        <label>${esc(label)}</label>
        <input class="input" id="pm-input" maxlength="40">
      </div>
      <div class="modal-actions">
        <button class="btn btn-ghost" data-close>${esc(t('cancel'))}</button>
        <button class="btn btn-crystal" id="pm-ok">${esc(t('confirm'))}</button>
      </div>
    `);
    const input = document.getElementById('pm-input');
    setTimeout(() => input.focus(), 80);
    function ok() {
      const v = input.value;
      closeModal();
      cb(v);
    }
    document.getElementById('pm-ok').addEventListener('click', ok);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') ok(); });
  }

  /* ================= Баннер напоминания ================= */
  function showReminderBanner(kind, task, extraBody) {
    const root = document.getElementById('reminder-root');
    const el = document.createElement('div');
    el.className = 'reminder-banner';
    const titleMap = { reminder: t('notifReminder'), overdue: t('notifOverdue'), digest: t('notifDigest') };
    const body = task ? task.title : (extraBody || '');
    el.innerHTML = `
      <div class="reminder-inner">
        <div class="reminder-title"><span class="pulse"></span>${esc(titleMap[kind] || t('notifReminder'))}</div>
        <div class="reminder-body">${esc(body)}${task && task.time ? ' · ' + esc(Store.formatTime(task.time)) : ''}</div>
        <div class="reminder-actions">
          ${task ? `<button class="btn btn-crystal" data-rb="done">✓ ${esc(t('done'))}</button>` : ''}
          ${task ? `<button class="btn btn-ghost" data-rb="snooze">⏰ ${esc(t('snooze'))}</button>` : ''}
          ${task ? `<button class="btn btn-ghost" data-rb="open">${esc(t('openTask'))}</button>` : ''}
          <button class="btn btn-ghost" data-rb="close">${esc(t('close'))}</button>
        </div>
      </div>`;
    root.appendChild(el);
    const dismiss = () => { el.remove(); };
    el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-rb]');
      if (!b) return;
      const act = b.dataset.rb;
      dismiss();
      if (act === 'done' && task) {
        Store.toggleDone(task.id, true);
        toast('✦ ' + t('done'));
        renderView();
      } else if (act === 'snooze' && task) {
        Views.openSnoozeModal(task);
      } else if (act === 'open' && task) {
        Views.openTaskModal(task);
      }
    });
    setTimeout(dismiss, 15000);
  }

  /* ================= Панель уведомлений ================= */
  const notifPanel = document.getElementById('notif-panel');

  function toggleNotifPanel() {
    if (notifPanel.hidden) renderNotifPanel();
    else hideNotifPanel();
  }
  function hideNotifPanel() { notifPanel.hidden = true; }

  function renderNotifPanel() {
    document.getElementById('notif-panel-title').textContent = t('notifPanel');
    document.getElementById('notif-mark-read').textContent = t('markAllRead');
    const list = document.getElementById('notif-panel-list');
    const items = Store.getNotifs();
    if (!items.length) {
      list.innerHTML = `<div class="notif-empty">${esc(t('notifEmpty'))}</div>`;
    } else {
      list.innerHTML = items.map((n) => `
        <div class="notif-item ${n.read ? '' : 'unread'}" data-nid="${esc(n.id)}" data-task="${esc(n.taskId || '')}">
          <div style="flex:1;min-width:0">
            <div class="n-title">${esc(n.title)}</div>
            <div class="muted" style="font-size:12.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(n.body || '')}</div>
            <div class="n-time">${new Date(n.ts).toLocaleString(Store.get('lang') === 'ru' ? 'ru-RU' : 'en-US', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>
          </div>
        </div>`).join('');
      list.querySelectorAll('.notif-item').forEach((item) => {
        item.addEventListener('click', () => {
          const taskId = item.dataset.task;
          hideNotifPanel();
          Store.markNotifsRead();
          updateBellBadge();
          if (taskId) {
            const task = Store.getTask(taskId);
            if (task) Views.openTaskModal(task);
          }
        });
      });
    }
    notifPanel.hidden = false;
  }

  document.getElementById('bell-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    toggleNotifPanel();
  });
  document.getElementById('notif-mark-read').addEventListener('click', () => {
    Store.markNotifsRead();
    updateBellBadge();
    renderNotifPanel();
  });
  document.addEventListener('click', (e) => {
    if (!notifPanel.hidden && !e.target.closest('#notif-panel') && !e.target.closest('#bell-btn')) {
      hideNotifPanel();
    }
  });

  function updateBellBadge() {
    const badge = document.getElementById('bell-badge');
    const n = Store.unreadCount();
    badge.hidden = n === 0;
    badge.textContent = n > 9 ? '9+' : String(n);
  }

  /* ================= Аватар ================= */
  const _avatarUrlCache = {};
  function renderAvatarInto(el) {
    if (!el) return;
    const name = Store.get('profileName');
    const avatarId = Store.get('avatarId');
    if (avatarId) {
      if (_avatarUrlCache[avatarId]) {
        el.innerHTML = `<img src="${_avatarUrlCache[avatarId]}" alt="">`;
        return;
      }
      DB.getFile(avatarId).then((rec) => {
        if (rec && rec.blob) {
          _avatarUrlCache[avatarId] = URL.createObjectURL(rec.blob);
          el.innerHTML = `<img src="${_avatarUrlCache[avatarId]}" alt="">`;
        } else {
          el.innerHTML = Views.logoSVG('butterfly');
        }
      }).catch(() => { el.innerHTML = Views.logoSVG('butterfly'); });
    } else if (name) {
      el.textContent = name.trim().charAt(0).toUpperCase();
    } else {
      el.innerHTML = Views.logoSVG('butterfly');
    }
  }

  /* ================= Навигация / шелл ================= */
  const NAV = [
    { route: 'today', i18n: 'navToday', icon: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>' },
    { route: 'upcoming', i18n: 'navUpcoming', icon: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"/></svg>' },
    { route: 'all', i18n: 'navAll', icon: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>' },
    { route: 'completed', i18n: 'navCompleted', icon: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.1V12a10 10 0 1 1-5.9-9.1"/><path d="M22 4 12 14l-3-3"/></svg>' },
    { route: 'calendar', i18n: 'navCalendar', icon: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="3" y="4" width="18" height="18" rx="3"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>' },
    { route: 'search', i18n: 'navSearch', icon: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>' },
    { route: 'settings', i18n: 'navSettings', icon: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.9 2.9l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.2a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.9-2.9l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.2a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.9-2.9l.1.1a1.7 1.7 0 0 0 1.9.3h.1a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.2a1.7 1.7 0 0 0 1 1.5h.1a1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.9 2.9l-.1.1a1.7 1.7 0 0 0-.3 1.9v.1a1.7 1.7 0 0 0 1.5 1h.2a2 2 0 1 1 0 4h-.2a1.7 1.7 0 0 0-1.5 1Z"/></svg>' },
    { route: 'pro', i18n: 'navPro', icon: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M12 3 14.5 9 21 9.5 16 13.5 17.8 20 12 16.5 6.2 20 8 13.5 3 9.5 9.5 9Z"/></svg>', pro: true }
  ];

  const TITLES = {
    today: 'navToday', upcoming: 'navUpcoming', all: 'navAll', completed: 'navCompleted',
    calendar: 'navCalendar', search: 'navSearch', settings: 'settings',
    'settings/profile': 'stProfile', 'settings/design': 'stDesign',
    'settings/notifications': 'stNotifications', 'settings/general': 'stGeneral',
    'settings/data': 'stData', pro: 'proTitle'
  };

  function renderChrome() {
    const style = Store.get('iconStyle');
    const name = Store.get('profileName') || t('appName');

    // лого
    document.getElementById('topbar-logo').innerHTML = Views.logoSVG(style);
    document.getElementById('sidebar-logo').innerHTML =
      `${Views.logoSVG(style)}<span>${esc(t('appName'))}</span>`;

    // профиль в сайдбаре
    const sp = document.getElementById('sidebar-profile');
    sp.innerHTML = `<div class="avatar" id="sb-avatar"></div>
      <div><div class="name">${esc(name)}</div><div class="hint">${esc(t('appTagline'))}</div></div>`;
    renderAvatarInto(sp.querySelector('#sb-avatar'));
    renderAvatarInto(document.getElementById('avatar-btn'));

    // сайдбар-навигация
    const sn = document.getElementById('sidebar-nav');
    sn.innerHTML = NAV.map((n) => `
      <a class="nav-item" data-nav="${n.route}" href="#/${n.route}">
        ${n.icon}<span>${esc(t(n.i18n))}</span>${n.pro ? '<span class="pro-tag">PRO</span>' : ''}
      </a>`).join('');

    document.getElementById('sidebar-new').textContent = '＋ ' + t('newTask');

    // мобильный таббар: 4 основных раздела
    const tabRoutes = ['today', 'calendar', 'search', 'settings'];
    const tb = document.getElementById('tabbar');
    tb.innerHTML = tabRoutes.map((r) => {
      const n = NAV.find((x) => x.route === r);
      return `<a class="tab-item" data-nav="${r}" href="#/${r}" style="text-decoration:none">${n.icon}<span>${esc(t(n.i18n))}</span></a>`;
    }).join('');

    markActiveNav();
    updateBellBadge();
  }

  function markActiveNav() {
    const base = _currentRoute.split('/')[0] === 'settings' ? 'settings' : _currentRoute;
    document.querySelectorAll('[data-nav]').forEach((el) => {
      el.classList.toggle('active', el.dataset.nav === base || el.dataset.nav === _currentRoute);
    });
  }

  /* ================= Роутер ================= */
  function currentHash() {
    return (location.hash || '').replace(/^#\/?/, '').replace(/\/$/, '');
  }

  function route() {
    let h = currentHash();
    if (!h) {
      location.replace('#/' + (Store.get('homeScreen') || 'today'));
      return;
    }
    // открытие задачи по ссылке — модалка поверх текущего экрана
    if (h.startsWith('task/')) {
      const task = Store.getTask(h.slice(5));
      if (task) Views.openTaskModal(task);
      history.replaceState(null, '', '#/' + (_currentRoute || Store.get('homeScreen') || 'today'));
      return;
    }
    _currentRoute = h;
    closeModal();
    hideNotifPanel();
    renderView();
    markActiveNav();
    const titleKey = TITLES[h] || TITLES[h.split('/')[0]] || 'appName';
    document.getElementById('topbar-title').textContent = t(titleKey);
    view.scrollTo({ top: 0 });
    window.scrollTo({ top: 0 });
  }

  function renderView() {
    const h = _currentRoute || 'today';
    const map = {
      today: Screens.today,
      upcoming: Screens.upcoming,
      all: Screens.all,
      completed: Screens.completed,
      calendar: Screens.calendar,
      search: Screens.search,
      settings: SettingsScreens.hub,
      'settings/profile': SettingsScreens.profile,
      'settings/design': SettingsScreens.design,
      'settings/notifications': SettingsScreens.notifications,
      'settings/general': SettingsScreens.general,
      'settings/data': SettingsScreens.data,
      pro: ProScreen.render
    };
    const fn = map[h] || map[h.split('/')[0]] || Screens.today;
    try {
      fn(view);
    } catch (e) {
      view.innerHTML = `<div class="empty"><h3>⚠</h3><p>${esc(String(e && e.message || e))}</p></div>`;
    }
    // Флаг анимации перехода: на время смены экрана глушим backdrop-filter
    // (обход бага Samsung Internet: «стекло» съезжает при transform-анимации)
    document.body.classList.add('x-anim');
    clearTimeout(_animT);
    _animT = setTimeout(() => document.body.classList.remove('x-anim'), 380);
    updateBellBadge();
  }

  /* ================= FAB / новая задача ================= */
  document.getElementById('fab').addEventListener('click', () => Views.openTaskModal(null));
  document.getElementById('sidebar-new').addEventListener('click', () => Views.openTaskModal(null));
  document.getElementById('avatar-btn').addEventListener('click', () => { location.hash = '#/settings/profile'; });
  document.getElementById('sidebar-profile').addEventListener('click', () => { location.hash = '#/settings/profile'; });

  /* ================= Автоперенос просроченных ================= */
  function autoRollover() {
    if (!Store.get('autoRollover')) return;
    const today = Store.todayISO();
    let changed = false;
    Store.tasks().forEach((task) => {
      if (!task.done && task.date && task.date < today) {
        Store.updateTask(task.id, { date: today, firedFor: '' });
        changed = true;
      }
    });
    if (changed) toast('↪ ' + t('autoRollover'));
  }

  /* ================= Service Worker ================= */
  function registerSW() {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }

  /* ================= Запуск ================= */
  function boot() {
    applySettings();
    renderChrome();
    route();
    autoRollover();
    Notify.start();
    registerSW();
  }

  window.addEventListener('hashchange', route);

  return {
    isLocked, isProUnlocked, setProUnlocked,
    applySettings, toast, modal, closeModal, onModalClose, confirmDialog, promptModal,
    showReminderBanner, renderView, renderChrome, renderAvatarInto, updateBellBadge,
    boot
  };
})();

document.addEventListener('DOMContentLoaded', App.boot);

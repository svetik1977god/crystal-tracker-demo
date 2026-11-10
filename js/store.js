/* Кристалл — хранилище: задачи и настройки (localStorage) */
'use strict';

const Store = (() => {
  const TASKS_KEY = 'crystal_tasks';
  const SETTINGS_KEY = 'crystal_settings';
  const NOTIFS_KEY = 'crystal_notifications';
  const FEEDBACK_KEY = 'crystal_feedback';

  const DEFAULT_SETTINGS = {
    lang: 'ru',
    timeFormat: '24',            // '24' | '12'
    dateFormat: 'dmy',           // 'dmy' | 'mdy'
    theme: 'crystal',            // crystal | night | sakura | chrome
    accent: '',                  // пусто = цвет темы
    uiStyle: 'glass',            // glass | solid | minimal
    iconStyle: 'butterfly',      // gem | butterfly | collage
    homeScreen: 'today',         // today | calendar | all
    transition: 'fade',          // none | fade | slide | scale
    completedStyle: 'strike',    // strike | fade | hide | sparkle
    panelAlpha: 0.55,            // 0.2 .. 0.9
    priorityFirst: true,
    autoRollover: false,
    profileName: '',
    avatarId: '',                // id файла в IndexedDB
    notify: {
      master: true,
      task: true,
      digest: true,
      overdue: true,
      soundMode: 'signal',       // signal | off
      soundId: 'crystal',        // builtin id | 'custom:<fileId>'
      vibrate: false,
      flash: false
    },
    categories: null,            // заполняется при первом запуске
    pro: {
      pinHash: '',               // djb2-хэш PIN владельца
      locks: {},                 // {featureKey: true} — функции только для PRO
      custom: []                 // будущие PRO-функции [{id,name,desc}]
    },
    customSounds: [],            // [{id, name}] — метаданные, blob в IndexedDB
    digestLastDate: '',          // когда в последний раз показывали сводку
    overdueLastDate: ''          // когда напоминали о просроченных
  };

  let _settings = null;
  let _tasks = null;
  const _listeners = [];

  /* ---------- утилиты ---------- */
  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function readJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function writeJSON(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { /* quota */ }
  }

  function deepMerge(base, extra) {
    const out = Array.isArray(base) ? base.slice() : Object.assign({}, base);
    if (!extra || typeof extra !== 'object') return out;
    for (const k of Object.keys(extra)) {
      if (extra[k] && typeof extra[k] === 'object' && !Array.isArray(extra[k]) &&
          base && base[k] && typeof base[k] === 'object' && !Array.isArray(base[k])) {
        out[k] = deepMerge(base[k], extra[k]);
      } else {
        out[k] = extra[k];
      }
    }
    return out;
  }

  function defaultCategories() {
    // Ключи словаря i18n используются, если имя совпадает со стандартным
    return [
      { id: 'personal', name: 'Личное', i18n: 'catPersonal', color: '#ff9ecd' },
      { id: 'work', name: 'Работа', i18n: 'catWork', color: '#c084fc' },
      { id: 'home', name: 'Дом', i18n: 'catHome', color: '#7ef0c1' },
      { id: 'health', name: 'Здоровье', i18n: 'catHealth', color: '#f0abfc' }
    ];
  }

  /* ---------- настройки ---------- */
  function loadSettings() {
    if (_settings) return _settings;
    const saved = readJSON(SETTINGS_KEY, {});
    _settings = deepMerge(DEFAULT_SETTINGS, saved);
    if (!_settings.categories) _settings.categories = defaultCategories();
    return _settings;
  }

  function save() {
    writeJSON(SETTINGS_KEY, _settings);
    _listeners.forEach((fn) => { try { fn(); } catch (e) {} });
  }

  function get(key) {
    loadSettings();
    return key ? _settings[key] : _settings;
  }

  function set(key, value) {
    loadSettings();
    _settings[key] = value;
    save();
  }

  function patch(obj) {
    loadSettings();
    Object.assign(_settings, obj);
    save();
  }

  function onChange(fn) { _listeners.push(fn); }

  /* ---------- задачи ---------- */
  function loadTasks() {
    if (_tasks) return _tasks;
    _tasks = readJSON(TASKS_KEY, []);
    if (!Array.isArray(_tasks)) _tasks = [];
    return _tasks;
  }

  function saveTasks() {
    writeJSON(TASKS_KEY, _tasks);
    _listeners.forEach((fn) => { try { fn(); } catch (e) {} });
  }

  function tasks() { return loadTasks(); }

  function getTask(id) {
    return loadTasks().find((t) => t.id === id) || null;
  }

  function createTask(data) {
    loadTasks();
    const now = Date.now();
    const task = {
      id: uid(),
      title: (data.title || '').trim(),
      notes: data.notes || '',
      date: data.date || '',
      time: data.time || '',
      categoryId: data.categoryId || '',
      priority: !!data.priority,
      repeat: data.repeat || { type: 'none', n: 1 },
      attachments: data.attachments || [],   // [attachmentId]
      done: false,
      doneAt: 0,
      snoozedUntil: 0,
      firedFor: '',                          // ключ сработки напоминания
      createdAt: now,
      updatedAt: now
    };
    _tasks.push(task);
    saveTasks();
    return task;
  }

  function updateTask(id, patchObj) {
    loadTasks();
    const task = getTask(id);
    if (!task) return null;
    Object.assign(task, patchObj, { updatedAt: Date.now() });
    saveTasks();
    return task;
  }

  function deleteTask(id) {
    loadTasks();
    const idx = _tasks.findIndex((t) => t.id === id);
    if (idx === -1) return null;
    const [removed] = _tasks.splice(idx, 1);
    saveTasks();
    return removed;
  }

  function restoreTask(task, index) {
    loadTasks();
    const at = Math.min(Math.max(0, index === undefined ? _tasks.length : index), _tasks.length);
    _tasks.splice(at, 0, task);
    saveTasks();
  }

  /** Следующая дата для повторяющейся задачи */
  function nextOccurrence(dateStr, repeat) {
    const base = dateStr ? new Date(dateStr + 'T00:00:00') : new Date();
    if (isNaN(base)) return '';
    const r = repeat || { type: 'none', n: 1 };
    const d = new Date(base);
    if (r.type === 'daily') d.setDate(d.getDate() + 1);
    else if (r.type === 'weekly') d.setDate(d.getDate() + 7);
    else if (r.type === 'monthly') d.setMonth(d.getMonth() + 1);
    else if (r.type === 'custom') d.setDate(d.getDate() + Math.max(1, r.n || 1));
    else return '';
    return toISODate(d);
  }

  /** Отметить выполненной/невыполненной; при повторе создаёт следующую копию */
  function toggleDone(id, done) {
    const task = getTask(id);
    if (!task) return null;
    const now = Date.now();
    updateTask(id, { done: !!done, doneAt: done ? now : 0 });
    if (done && task.repeat && task.repeat.type !== 'none') {
      const nd = nextOccurrence(task.date, task.repeat);
      if (nd) {
        createTask({
          title: task.title, notes: task.notes, date: nd, time: task.time,
          categoryId: task.categoryId, priority: task.priority,
          repeat: task.repeat, attachments: task.attachments.slice()
        });
      }
    }
    return getTask(id);
  }

  /* ---------- даты ---------- */
  function toISODate(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function todayISO() { return toISODate(new Date()); }

  function isOverdue(task) {
    return !task.done && task.date && task.date < todayISO();
  }

  function dueDateTime(task) {
    // timestamp наступления задачи (дата + время), или null
    if (!task.date) return null;
    const tstr = task.time || '23:59';
    const ts = new Date(task.date + 'T' + tstr + ':00').getTime();
    return isNaN(ts) ? null : ts;
  }

  function sortTasks(list) {
    const pf = get('priorityFirst');
    return list.slice().sort((a, b) => {
      if (pf && a.priority !== b.priority) return a.priority ? -1 : 1;
      const da = dueDateTime(a), db = dueDateTime(b);
      if (da === null && db === null) return (b.createdAt || 0) - (a.createdAt || 0);
      if (da === null) return 1;
      if (db === null) return -1;
      return da - db;
    });
  }

  /* ---------- форматирование ---------- */
  function formatTime(hhmm) {
    if (!hhmm) return '';
    if (get('timeFormat') === '24') return hhmm;
    let [h, m] = hhmm.split(':').map(Number);
    const ap = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${h}:${String(m).padStart(2, '0')} ${ap}`;
  }

  function formatDate(iso) {
    if (!iso) return t('noDate');
    const [y, m, d] = iso.split('-').map(Number);
    if (get('dateFormat') === 'mdy') {
      return `${String(m).padStart(2, '0')}/${String(d).padStart(2, '0')}/${y}`;
    }
    return `${String(d).padStart(2, '0')}.${String(m).padStart(2, '0')}.${y}`;
  }

  function formatDateLong(iso) {
    const [y, m, d] = iso.split('-').map(Number);
    const months = t('monthsGen');
    if (get('lang') === 'ru') return `${d} ${months[m - 1]} ${y}`;
    return `${months[m - 1]} ${d}, ${y}`;
  }

  function relDateLabel(iso) {
    const today = todayISO();
    const tomorrow = toISODate(new Date(Date.now() + 86400000));
    if (iso === today) return t('today');
    if (iso === tomorrow) return t('tomorrow');
    if (iso && iso < today) return t('overdue');
    return formatDate(iso);
  }

  /* ---------- категории ---------- */
  function categories() { return loadSettings().categories; }
  function categoryById(id) { return categories().find((c) => c.id === id) || null; }
  function categoryName(cat) {
    if (!cat) return '';
    // Стандартные категории переводятся, пользовательские — как есть
    if (cat.i18n) {
      const val = t(cat.i18n);
      // если пользователь переименовал стандартную — показываем его имя
      const defaults = { catPersonal: 'Личное', catWork: 'Работа', catHome: 'Дом', catHealth: 'Здоровье' };
      if (cat.name === defaults[cat.i18n]) return val;
    }
    return cat.name;
  }
  function addCategory(name, color) {
    const cats = categories();
    const cat = { id: uid(), name: name.trim(), color: color || '#e879f9' };
    cats.push(cat);
    save();
    return cat;
  }
  function removeCategory(id) {
    loadTasks();
    _settings.categories = categories().filter((c) => c.id !== id);
    _tasks.forEach((task) => { if (task.categoryId === id) task.categoryId = ''; });
    save();
    saveTasks();
  }

  /* ---------- панель уведомлений ---------- */
  function getNotifs() {
    const n = readJSON(NOTIFS_KEY, []);
    return Array.isArray(n) ? n : [];
  }
  function pushNotif(item) {
    const list = getNotifs();
    list.unshift(Object.assign({ id: uid(), ts: Date.now(), read: false }, item));
    writeJSON(NOTIFS_KEY, list.slice(0, 50));
    _listeners.forEach((fn) => { try { fn(); } catch (e) {} });
  }
  function markNotifsRead() {
    writeJSON(NOTIFS_KEY, getNotifs().map((n) => Object.assign({}, n, { read: true })));
    _listeners.forEach((fn) => { try { fn(); } catch (e) {} });
  }
  function unreadCount() { return getNotifs().filter((n) => !n.read).length; }

  /* ---------- обратная связь ---------- */
  function saveFeedback(entry) {
    const list = readJSON(FEEDBACK_KEY, []);
    list.unshift(Object.assign({ id: uid(), ts: Date.now() }, entry));
    writeJSON(FEEDBACK_KEY, list.slice(0, 30));
  }

  /* ---------- PRO ---------- */
  function hashPin(pin) {
    // legacy djb2-хэш (оставлен для проверки старых PIN, больше не используется для новых)
    let h = 5381;
    const s = 'crystal:' + pin;
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
    return h.toString(36);
  }

  /** SHA-256(PIN + соль) в hex; суффикс 's1$' хранится в pro.pinHash */
  function hashPinSha(pin) {
    const salt = 'crystal-pro-v1:' + pin;
    if (!(window.crypto && crypto.subtle && crypto.subtle.digest)) {
      return Promise.resolve('s1$' + hashPin(pin)); // запасной вариант для старых браузеров
    }
    return crypto.subtle.digest('SHA-256', new TextEncoder().encode(salt))
      .then((buf) => 's1$' + Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join(''));
  }

  /* ---------- Резервная копия: выгрузка / загрузка ---------- */
  function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result).split(',')[1] || '');
      r.onerror = () => reject(r.error);
      r.readAsDataURL(blob);
    });
  }

  function base64ToBlob(b64, type) {
    const bin = atob(b64 || '');
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], { type: type || 'application/octet-stream' });
  }

  /** Собирает ВСЕ данные приложения: настройки, задачи, оповещения, файлы */
  function exportAll() {
    const files = [];
    return DB.getAllFiles(null).then((all) => {
      const jobs = (all || []).map((f) =>
        blobToBase64(f.blob).then((b64) => {
          files.push({ id: f.id, kind: f.kind, name: f.name, type: f.type, data64: b64 });
        })
      );
      const attachments = [];
      const attIds = loadTasks().flatMap((t) => t.attachments || []);
      jobs.push(...attIds.map((id) =>
        DB.getAttachment(id).then((att) => {
          if (!att || !att.blob) return;
          return blobToBase64(att.blob).then((b64) => {
            attachments.push({ id: att.id, taskId: att.taskId, name: att.name, type: att.type, data64: b64 });
          });
        }).catch(() => {})
      ));
      return Promise.all(jobs).then(() => ({
        app: 'crystal-backup',
        version: 1,
        exportedAt: new Date().toISOString(),
        tasks: loadTasks(),
        settings: _settings || loadSettings(),
        notifications: getNotifs(),
        feedback: readJSON(FEEDBACK_KEY, []),
        files,
        attachments
      }));
    });
  }

  /** Полностью восстанавливает приложение из объекта резервной копии */
  function importAll(data) {
    if (!data || data.app !== 'crystal-backup' || !Array.isArray(data.tasks)) {
      return Promise.reject(new Error('bad backup'));
    }
    const filesJobs = (data.files || []).map((f) => {
      const blob = base64ToBlob(f.data64, f.type);
      return DB.putFile({ id: f.id, kind: f.kind, name: f.name, type: f.type, blob });
    });
    const attJobs = (data.attachments || []).map((a) => {
      const blob = base64ToBlob(a.data64, a.type);
      return DB.addAttachment({ id: a.id, taskId: a.taskId, name: a.name, type: a.type, blob });
    });
    return Promise.all(filesJobs.concat(attJobs))
      .then(() => {
        _tasks = data.tasks.map((t) => Object.assign({}, t));
        saveTasks();
        writeJSON(NOTIFS_KEY, data.notifications || []);
        writeJSON(FEEDBACK_KEY, data.feedback || []);
        _settings = deepMerge(DEFAULT_SETTINGS, data.settings || {});
        if (!_settings.categories || !_settings.categories.length) _settings.categories = defaultCategories();
        save();
      });
  }

  function resetAll() {
    localStorage.removeItem(TASKS_KEY);
    localStorage.removeItem(SETTINGS_KEY);
    localStorage.removeItem(NOTIFS_KEY);
    localStorage.removeItem(FEEDBACK_KEY);
    _settings = null;
    _tasks = null;
  }

  return {
    get, set, patch, onChange,
    tasks, getTask, createTask, updateTask, deleteTask, restoreTask, toggleDone,
    sortTasks, isOverdue, dueDateTime, nextOccurrence,
    toISODate, todayISO, formatTime, formatDate, formatDateLong, relDateLabel,
    categories, categoryById, categoryName, addCategory, removeCategory,
    getNotifs, pushNotif, markNotifsRead, unreadCount,
    saveFeedback, hashPin, hashPinSha, resetAll, uid,
    exportAll, importAll
  };
})();

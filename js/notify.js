/* Кристалл — звуки и движок напоминаний */
'use strict';

const Notify = (() => {

  /* ================================================================
     ЗВУКИ
     Встроенные мелодии генерируются через WebAudio (oscillator).
     Чтобы добавить свой звук: загрузите файл в Настройки →
     Уведомления → Свой звук, либо положите mp3 в assets/sounds/
     и добавьте его имя в SOUND_FILES ниже в js/notify.js.
     ================================================================ */

  // Файловые звуки из assets/sounds/ (добавьте имя файла — и он появится в списке)
  const SOUND_FILES = [
    // { id: 'my-sound', name: 'Мой звук', url: 'assets/sounds/my-sound.mp3' },
  ];

  const BUILTIN_SOUNDS = [
    { id: 'crystal', i18n: 'soundCrystal' },
    { id: 'drop', i18n: 'soundDrop' },
    { id: 'bell', i18n: 'soundBell' }
  ];

  let _ctx = null;
  function audioCtx() {
    if (!_ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      _ctx = new AC();
    }
    if (_ctx.state === 'suspended') _ctx.resume().catch(() => {});
    return _ctx;
  }

  function tone(ctx, freq, start, dur, type, peak) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
    gain.gain.setValueAtTime(0.0001, ctx.currentTime + start);
    gain.gain.exponentialRampToValueAtTime(peak || 0.22, ctx.currentTime + start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(ctx.currentTime + start);
    osc.stop(ctx.currentTime + start + dur + 0.05);
  }

  const MELODIES = {
    // «Кристалл» — перелив высоких нот
    crystal(ctx) {
      tone(ctx, 1318.5, 0.00, 0.5, 'sine', 0.18);
      tone(ctx, 1568.0, 0.12, 0.5, 'sine', 0.16);
      tone(ctx, 2093.0, 0.24, 0.7, 'sine', 0.14);
      tone(ctx, 2637.0, 0.36, 0.9, 'sine', 0.10);
    },
    // «Капля» — мягкий нисходящий слайд
    drop(ctx) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(420, ctx.currentTime + 0.35);
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.24, ctx.currentTime + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.45);
      osc.connect(gain).connect(ctx.destination);
      osc.start(); osc.stop(ctx.currentTime + 0.5);
      tone(ctx, 1320, 0.28, 0.35, 'triangle', 0.1);
    },
    // «Колокольчик» — звон с обертонами
    bell(ctx) {
      tone(ctx, 1046.5, 0.00, 1.0, 'sine', 0.2);
      tone(ctx, 2093.0, 0.00, 0.6, 'sine', 0.06);
      tone(ctx, 3136.0, 0.00, 0.35, 'sine', 0.03);
      tone(ctx, 1046.5, 0.45, 1.0, 'sine', 0.12);
    }
  };

  function playBuiltin(id) {
    const ctx = audioCtx();
    if (!ctx) return;
    const fn = MELODIES[id] || MELODIES.crystal;
    try { fn(ctx); } catch (e) {}
  }

  function playFileUrl(url) {
    try {
      const a = new Audio(url);
      a.volume = 0.85;
      a.play().catch(() => {});
    } catch (e) {}
  }

  /** Проиграть звук по id настроек: builtin | 'file:<url>' | 'custom:<fileId>' */
  function play(soundId) {
    if (!soundId) return;
    if (MELODIES[soundId]) return playBuiltin(soundId);
    if (soundId.startsWith('file:')) {
      const f = SOUND_FILES.find((s) => 'file:' + s.id === soundId || 'file:' + s.url === soundId);
      if (f) return playFileUrl(f.url);
      return;
    }
    if (soundId.startsWith('custom:')) {
      const fid = soundId.slice(7);
      DB.getFile(fid).then((rec) => {
        if (rec && rec.blob) {
          const url = URL.createObjectURL(rec.blob);
          const a = new Audio(url);
          a.volume = 0.85;
          // URL освобождаем всегда (и при ошибке воспроизведения), чуть позже,
          // чтобы браузер успел начать воспроизведение
          const cleanup = () => setTimeout(() => URL.revokeObjectURL(url), 8000);
          a.play().then(cleanup).catch(cleanup);
        }
      }).catch(() => {});
    }
  }

  /** Список доступных звуков для селектора */
  function soundOptions() {
    const custom = (Store.get('customSounds') || []).map((s) => ({
      id: 'custom:' + s.id, name: s.name, custom: true
    }));
    const files = SOUND_FILES.map((s) => ({ id: 'file:' + (s.id || s.url), name: s.name }));
    const builtin = BUILTIN_SOUNDS.map((s) => ({ id: s.id, name: t(s.i18n) }));
    return builtin.concat(files, custom);
  }

  /* ---------- вибрация / вспышка ---------- */
  function vibrate() {
    if (Store.get('notify').vibrate && 'vibrate' in navigator) {
      try { navigator.vibrate([180, 80, 180]); } catch (e) {}
    }
  }

  function flash() {
    if (!Store.get('notify').flash) return;
    if (App && App.isLocked && App.isLocked('flash')) { /* PRO-замок */ } else {
      const el = document.getElementById('flash-overlay');
      if (!el) return;
      el.hidden = false;
      el.classList.remove('active');
      void el.offsetWidth; // перезапуск анимации
      el.classList.add('active');
      setTimeout(() => { el.classList.remove('active'); el.hidden = true; }, 3200);
    }
  }

  /* ---------- системные уведомления ---------- */
  function permissionState() {
    if (!('Notification' in window)) return 'unsupported';
    return Notification.permission; // 'granted' | 'denied' | 'default'
  }

  function requestPermission() {
    if (!('Notification' in window)) return Promise.resolve('unsupported');
    try {
      return Notification.requestPermission().then((p) => p);
    } catch (e) {
      return Promise.resolve(Notification.permission);
    }
  }

  function systemNotify(title, body, taskId) {
    if (permissionState() !== 'granted') return;
    try {
      const n = new Notification(title, {
        body: body || '',
        icon: 'assets/icon-192.png',
        badge: 'assets/icon-192.png',
        tag: 'crystal-' + (taskId || 'app'),
        silent: true // звук/вибрацию обрабатываем сами
      });
      n.onclick = () => {
        window.focus();
        if (taskId) location.hash = '#/task/' + taskId;
      };
    } catch (e) {}
  }

  /* ---------- движок напоминаний ---------- */
  const CHECK_INTERVAL = 25000; // проверка каждые ~25 секунд
  let _timer = null;

  function fire(kind, task, extraBody) {
    const n = Store.get('notify');
    if (!n.master) return;
    if (kind === 'reminder' && !n.task) return;
    if (kind === 'digest' && !n.digest) return;
    if (kind === 'overdue' && !n.overdue) return;

    const titleMap = { reminder: t('notifReminder'), overdue: t('notifOverdue'), digest: t('notifDigest') };
    const title = titleMap[kind] || t('notifReminder');
    const body = task ? task.title : (extraBody || '');

    // 1) панель уведомлений
    Store.pushNotif({ kind, taskId: task ? task.id : '', title, body });
    // 2) баннер в приложении
    if (window.App && App.showReminderBanner) App.showReminderBanner(kind, task, extraBody);
    // 3) системное уведомление
    systemNotify(title + ' — ' + t('appName'), body, task ? task.id : '');
    // 4) звук
    if (n.soundMode === 'signal') play(n.soundId);
    // 5) вибрация
    vibrate();
    // 6) вспышка
    flash();
  }

  function check() {
    const n = Store.get('notify');
    if (!n.master) return;
    const now = Date.now();
    const today = Store.todayISO();

    Store.tasks().forEach((task) => {
      if (task.done || !task.date || !task.time) return;
      const due = Store.dueDateTime(task);
      if (due === null) return;
      // отложенные — ждут своего времени
      const effectiveDue = task.snoozedUntil && task.snoozedUntil > due ? task.snoozedUntil : due;
      if (effectiveDue > now) return;
      const fireKey = task.date + 'T' + task.time + ':' + effectiveDue;
      if (task.firedFor === fireKey) return;
      Store.updateTask(task.id, { firedFor: fireKey, snoozedUntil: 0 });
      fire('reminder', task);
    });

    // Ежедневная сводка — один раз в день при открытии/проверке
    if (n.digest && Store.get('digestLastDate') !== today) {
      const count = Store.tasks().filter((x) => !x.done && x.date === today).length;
      if (count > 0) {
        Store.set('digestLastDate', today);
        fire('digest', null, count + ' ' + t('digestBody'));
      }
    }

    // Просроченные — один раз в день
    if (n.overdue && Store.get('overdueLastDate') !== today) {
      const overdue = Store.tasks().filter((x) => Store.isOverdue(x));
      if (overdue.length > 0) {
        Store.set('overdueLastDate', today);
        fire('overdue', overdue[0], overdue.length + ' ' + t('overdueBody'));
      }
    }
  }

  function start() {
    stop();
    // первый заход с небольшой задержкой, чтобы UI успел загрузиться
    setTimeout(check, 1500);
    _timer = setInterval(check, CHECK_INTERVAL);
  }

  function stop() {
    if (_timer) { clearInterval(_timer); _timer = null; }
  }

  return {
    SOUND_FILES, BUILTIN_SOUNDS, soundOptions, play, playBuiltin,
    vibrate, flash, permissionState, requestPermission, systemNotify,
    fire, check, start, stop
  };
})();

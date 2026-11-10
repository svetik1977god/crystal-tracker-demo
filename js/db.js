/* Кристалл — IndexedDB: бинарные данные (вложения, аватар, свои звуки) */
'use strict';

const DB = (() => {
  const DB_NAME = 'crystal-db';
  const DB_VERSION = 1;
  let _db = null;

  function open() {
    return new Promise((resolve, reject) => {
      if (!('indexedDB' in window)) return reject(new Error('IndexedDB не поддерживается'));
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('attachments')) {
          db.createObjectStore('attachments', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('files')) {
          db.createObjectStore('files', { keyPath: 'id' });
        }
      };
      req.onsuccess = () => { _db = req.result; resolve(_db); };
      req.onerror = () => reject(req.error);
    });
  }

  function ready() {
    return _db ? Promise.resolve(_db) : open();
  }

  function tx(store, mode, fn) {
    return ready().then((db) => new Promise((resolve, reject) => {
      const t = db.transaction(store, mode);
      const s = t.objectStore(store);
      const out = fn(s);
      t.oncomplete = () => resolve(out && out._result !== undefined ? out._result : out);
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error);
    }));
  }

  function wrapReq(req) {
    return new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  return {
    // ---- Вложения задач ----
    addAttachment(att) { // {id, taskId, name, type, blob}
      return ready().then((db) => wrapReq(
        db.transaction('attachments', 'readwrite').objectStore('attachments').put(att)
      )).then(() => att);
    },
    getAttachment(id) {
      return ready().then((db) => wrapReq(
        db.transaction('attachments', 'readonly').objectStore('attachments').get(id)
      ));
    },
    deleteAttachment(id) {
      return ready().then((db) => wrapReq(
        db.transaction('attachments', 'readwrite').objectStore('attachments').delete(id)
      ));
    },
    deleteAttachments(ids) {
      return Promise.all((ids || []).map((id) => this.deleteAttachment(id).catch(() => {})));
    },

    // ---- Произвольные файлы (аватар, звуки) ----
    putFile(file) { // {id, kind, name, type, blob}
      return ready().then((db) => wrapReq(
        db.transaction('files', 'readwrite').objectStore('files').put(file)
      )).then(() => file);
    },
    getFile(id) {
      return ready().then((db) => wrapReq(
        db.transaction('files', 'readonly').objectStore('files').get(id)
      ));
    },
    deleteFile(id) {
      return ready().then((db) => wrapReq(
        db.transaction('files', 'readwrite').objectStore('files').delete(id)
      ));
    },
    getAllFiles(kind) {
      return ready().then((db) => wrapReq(
        db.transaction('files', 'readonly').objectStore('files').getAll()
      )).then((all) => (all || []).filter((f) => !kind || f.kind === kind));
    },

    clearAll() {
      return ready().then((db) => Promise.all([
        wrapReq(db.transaction('attachments', 'readwrite').objectStore('attachments').clear()),
        wrapReq(db.transaction('files', 'readwrite').objectStore('files').clear())
      ]));
    }
  };
})();

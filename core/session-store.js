/* Durable storage for recorded routes. IndexedDB avoids localStorage's small quota. */
(function () {
  'use strict';

  const DB_NAME = 'racewars-tracker';
  const STORE_NAME = 'sessions';
  const LEGACY_KEY = 'racewars_sessions';

  function openDatabase() {
    return new Promise((resolve, reject) => {
      if (!('indexedDB' in window)) return reject(new Error('IndexedDB no está disponible'));
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('startedAt', 'startedAt', { unique: false });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('No se pudo abrir la base de sesiones'));
      request.onblocked = () => reject(new Error('La base de sesiones está bloqueada por otra ventana'));
    });
  }

  async function withStore(mode, action) {
    const db = await openDatabase();
    try {
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, mode);
        const request = action(tx.objectStore(STORE_NAME));
        tx.oncomplete = () => resolve(request && request.result);
        tx.onerror = () => reject(tx.error || request.error);
        tx.onabort = () => reject(tx.error || new Error('La operación de sesiones fue cancelada'));
      });
    } finally {
      db.close();
    }
  }

  function readLegacy() {
    try { return JSON.parse(localStorage.getItem(LEGACY_KEY) || '[]'); }
    catch (_) { return []; }
  }

  function legacySessions() {
    const sessions = readLegacy();
    try {
      const last = JSON.parse(localStorage.getItem('racewars_last_session') || 'null');
      if (last && last.id && !sessions.some(item => item.id === last.id)) sessions.push(last);
    } catch (_) { /* Ignore a damaged legacy entry. */ }
    return sessions;
  }

  const store = {
    async save(session) {
      try {
        await withStore('readwrite', objectStore => objectStore.put(session));
      } catch (error) {
        // Keep the route retrievable on browsers without IndexedDB. Never silently claim success.
        const sessions = legacySessions().filter(item => item.id !== session.id);
        sessions.unshift(session);
        localStorage.setItem(LEGACY_KEY, JSON.stringify(sessions));
      }
      return session;
    },

    async get(id) {
      try {
        const result = await withStore('readonly', objectStore => objectStore.get(id));
        if (result) return result;
      } catch (_) { /* Fall back to legacy storage below. */ }
      return legacySessions().find(item => item.id === id) || null;
    },

    async list() {
      try {
        const sessions = await withStore('readonly', objectStore => objectStore.getAll());
        const legacy = legacySessions();
        const byId = new Map([...sessions, ...legacy].map(item => [item.id, item]));
        return [...byId.values()].sort((a, b) => (b.startedAt || Date.parse(b.date) || 0) - (a.startedAt || Date.parse(a.date) || 0));
      } catch (_) {
        return legacySessions().sort((a, b) => (b.startedAt || Date.parse(b.date) || 0) - (a.startedAt || Date.parse(a.date) || 0));
      }
    }
  };

  window.RaceWarsSessionStore = store;
})();

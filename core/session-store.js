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

  const MAX_REALISTIC_SPEED_KMH = 350;

  function sanitizeSession(session) {
    if (!session || typeof session !== 'object') return { session, modified: false };

    let modified = false;
    const trackpoints = Array.isArray(session.trackpoints) ? session.trackpoints : [];

    // 1. Filtrar puntos limpios y detectar anomalías en trackpoints
    const validSpeeds = [];
    let prevValidSpeed = 0;

    for (let i = 0; i < trackpoints.length; i++) {
      const pt = trackpoints[i];
      if (!pt) continue;
      const speed = Number(pt.speedKmh);
      if (Number.isFinite(speed) && speed >= 0 && speed <= MAX_REALISTIC_SPEED_KMH) {
        // Si el punto fue registrado sin conexión GPS o es estimado, la velocidad asumida es máx 80 km/h
        if ((pt.gpsConnected === false || pt.isEstimated === true) && speed > 80) {
          pt.speedKmh = 80;
          modified = true;
        }
        validSpeeds.push(pt.speedKmh);
        prevValidSpeed = pt.speedKmh;
      } else if (Number.isFinite(speed) && speed > MAX_REALISTIC_SPEED_KMH) {
        // Corregir pico anómalo de GPS en el trackpoint
        pt.speedKmh = prevValidSpeed;
        modified = true;
      }
    }

    // 2. Corregir maxSpeedKmh si excede el límite físico humano/vehicular (> 350 km/h)
    const rawMax = Number(session.maxSpeedKmh);
    if (!Number.isFinite(rawMax) || rawMax > MAX_REALISTIC_SPEED_KMH || rawMax <= 0) {
      if (validSpeeds.length > 0) {
        session.maxSpeedKmh = Math.round(Math.max(...validSpeeds));
      } else if (rawMax > MAX_REALISTIC_SPEED_KMH) {
        const avg = Number(session.avgSpeedKmh);
        session.maxSpeedKmh = (Number.isFinite(avg) && avg > 0) ? Math.min(MAX_REALISTIC_SPEED_KMH, Math.round(avg * 1.35)) : 0;
      }
      modified = true;
    }

    return { session, modified };
  }

  const store = {
    sanitizeSession,

    async save(session) {
      const { session: cleanSession } = sanitizeSession(session);
      try {
        await withStore('readwrite', objectStore => objectStore.put(cleanSession));
      } catch (error) {
        // Keep the route retrievable on browsers without IndexedDB. Never silently claim success.
        const sessions = legacySessions().filter(item => item.id !== cleanSession.id);
        sessions.unshift(cleanSession);
        localStorage.setItem(LEGACY_KEY, JSON.stringify(sessions));
      }
      return cleanSession;
    },

    async get(id) {
      let result = null;
      try {
        result = await withStore('readonly', objectStore => objectStore.get(id));
      } catch (_) { /* Fall back to legacy storage below. */ }
      if (!result) {
        result = legacySessions().find(item => item.id === id) || null;
      }

      if (result) {
        const { session: cleanSession, modified } = sanitizeSession(result);
        if (modified) {
          this.save(cleanSession).catch(() => {});
        }
        return cleanSession;
      }
      return null;
    },

    async list() {
      let allSessions = [];
      try {
        const sessions = await withStore('readonly', objectStore => objectStore.getAll());
        const legacy = legacySessions();
        const byId = new Map([...sessions, ...legacy].map(item => [item.id, item]));
        allSessions = [...byId.values()].sort((a, b) => (b.startedAt || Date.parse(b.date) || 0) - (a.startedAt || Date.parse(a.date) || 0));
      } catch (_) {
        allSessions = legacySessions().sort((a, b) => (b.startedAt || Date.parse(b.date) || 0) - (a.startedAt || Date.parse(a.date) || 0));
      }

      return allSessions.map(session => {
        const { session: cleanSession, modified } = sanitizeSession(session);
        if (modified) {
          this.save(cleanSession).catch(() => {});
        }
        return cleanSession;
      });
    }
  };

  window.RaceWarsSessionStore = store;
})();

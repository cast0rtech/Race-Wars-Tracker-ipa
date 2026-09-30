/**
 * Race Wars Tracker - Freemium & Ad-Supported PRO Manager
 * 
 * Modelo de negocio 100% libre de compras con tarjeta:
 * - Modo FREE: Telemetría básica con banner publicitario discreto.
 * - Modo PRO RACER: Desbloqueable GRATIS viendo un anuncio de vídeo bonificado (AdMob).
 *   Otorga pase PRO de 24 horas (o 72 horas) con exportación 4K sin marcas,
 *   tema Racing Red, sensor fusion 100Hz y línea de tiempo meteorológica completa.
 */

(function () {
  'use strict';

  const STORAGE_KEY = 'racewars_ad_pro_expiry';

  class ProManager {
    constructor() {
      this._expiry = parseInt(localStorage.getItem(STORAGE_KEY) || '0', 10);
      this._listeners = new Set();

      this.features = {
        sensorFusionAdvanced: {
          name: 'Sensor Fusion 100Hz (GPS + Barómetro)',
          proOnly: true,
          desc: 'Precisión milimétrica de altitud y desnivel eliminando ruido térmico'
        },
        hdVisualExport: {
          name: 'Exportación ZIP HD sin Marca de Agua',
          proOnly: true,
          desc: 'Tarjetas optimizadas en resolución 4K para Instagram Stories / TikTok / Strava'
        },
        weatherTimelineFull: {
          name: 'Línea Temporal Meteorológica Continua',
          proOnly: true,
          desc: 'Histórico dinámico de presión, temperatura y lluvia por cada kilómetro'
        },
        exclusiveThemes: {
          name: 'Temas Cockpit Exclusivos',
          proOnly: true,
          desc: 'Desbloqueo de interfaz Racing Red & Carbon Gold'
        },
        ghostReplay: {
          name: 'Replay GPX & Telemetría Fantasma',
          proOnly: true,
          desc: 'Reproducción y comparación de vueltas contra tu mejor marca'
        }
      };
    }

    /**
     * Devuelve si el usuario tiene el pase PRO activo por haber visto un anuncio
     */
    isPro() {
      return Date.now() < this._expiry;
    }

    /**
     * Tiempo restante del pase PRO formateado
     */
    getRemainingProTime() {
      if (!this.isPro()) return '0h';
      const remainingMs = this._expiry - Date.now();
      const hours = Math.floor(remainingMs / (1000 * 60 * 60));
      const mins = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
      return `${hours}h ${mins}m`;
    }

    canAccess(featureKey) {
      if (this.isPro()) return true;
      const feat = this.features[featureKey];
      return feat ? !feat.proOnly : true;
    }

    /**
     * Otorga la recompensa de PRO tras ver un anuncio
     * @param {number} hours 
     */
    grantAdReward(hours = 24) {
      const now = Date.now();
      const baseTime = this.isPro() ? this._expiry : now;
      this._expiry = baseTime + (hours * 60 * 60 * 1000);
      localStorage.setItem(STORAGE_KEY, this._expiry.toString());

      console.log(`[AdManager] ¡Pase PRO activado por ${hours} horas! Válido hasta:`, new Date(this._expiry));
      this._dispatchChange();
    }

    /**
     * Dispara el anuncio en vídeo para desbloquear PRO
     */
    async watchAdToUnlock(hours = 24) {
      if (window.AdManager) {
        return await window.AdManager.showRewardedAd(hours);
      }
      // Fallback
      this.grantAdReward(hours);
      return true;
    }

    /**
     * Dev toggle rápido para pruebas
     */
    toggleProState() {
      if (this.isPro()) {
        this._expiry = 0;
      } else {
        this._expiry = Date.now() + (24 * 3600 * 1000);
      }
      localStorage.setItem(STORAGE_KEY, this._expiry.toString());
      this._dispatchChange();
      return this.isPro();
    }

    _dispatchChange() {
      const eventDetail = { isPro: this.isPro(), remainingTime: this.getRemainingProTime() };
      this._listeners.forEach(fn => fn(eventDetail));
      window.dispatchEvent(new CustomEvent('racewars:pro_status_changed', { detail: eventDetail }));
    }

    onStatusChange(callback) {
      if (typeof callback === 'function') {
        this._listeners.add(callback);
      }
      return () => this._listeners.delete(callback);
    }

    openPaywall(reason = '') {
      if (window.ProPaywallModal) {
        window.ProPaywallModal.open(reason);
      }
    }
  }

  window.ProManager = new ProManager();
})();

/**
 * Race Wars Tracker - Ad-Supported PRO Unlock Dialog
 * Allows users to unlock PRO VIP features for 24h/72h by watching rewarded ads.
 */

(function () {
  'use strict';

  class ProPaywallModal {
    constructor() {
      this._backdrop = null;
      this._selectedHours = 24;
      this._reasonElem = null;
      this._init();
    }

    _init() {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => this._buildModal());
      } else {
        this._buildModal();
      }
    }

    _buildModal() {
      if (document.getElementById('rwProPaywallBackdrop')) return;

      const backdrop = document.createElement('div');
      backdrop.id = 'rwProPaywallBackdrop';
      backdrop.className = 'pro-paywall-backdrop';
      backdrop.innerHTML = `
        <div class="pro-paywall-modal" role="dialog" aria-modal="true" aria-labelledby="paywallTitle">
          <button class="pro-paywall-close" id="rwPaywallClose" aria-label="Cerrar modal">
            <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2.2" fill="none">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>

          <div class="pro-paywall-header">
            <span class="pro-brand-chip">★ RACE WARS PRO // GRATIS CON ANUNCIOS</span>
            <h2 class="pro-paywall-title" id="paywallTitle">DESATA EL MÁXIMO RENDIMIENTO</h2>
            <p class="pro-paywall-subtitle">Mira un breve anuncio patrocinado para desbloquear telemetría de competición sin pagar nada</p>
          </div>

          <div class="pro-trigger-reason" id="rwPaywallReason"></div>

          <!-- Ventajas PRO -->
          <div class="pro-feature-list">
            <div class="pro-feature-item">
              <span class="pro-feat-icon">⚡</span>
              <div class="pro-feat-text">
                <span class="pro-feat-name">Sensor Fusion 100Hz (GPS + Barómetro)</span>
                <span class="pro-feat-desc">Precisión milimétrica de altitud y desnivel eliminando ruido térmico.</span>
              </div>
            </div>
            <div class="pro-feature-item">
              <span class="pro-feat-icon">📦</span>
              <div class="pro-feat-text">
                <span class="pro-feat-name">Exportación 4K sin Marca de Agua</span>
                <span class="pro-feat-desc">Historias HD limpias para Instagram, TikTok y Strava.</span>
              </div>
            </div>
            <div class="pro-feature-item">
              <span class="pro-feat-icon">🏎️</span>
              <div class="pro-feat-text">
                <span class="pro-feat-name">Tema Racing Red y Sin Banners</span>
                <span class="pro-feat-desc">Elimina todos los anuncios y activa la interfaz deportiva de alto contraste.</span>
              </div>
            </div>
          </div>

          <!-- Opciones de Recompensa por Anuncio -->
          <div class="pro-plans-grid" id="rwPlansGrid">
            <div class="pro-plan-card is-selected" data-hours="24">
              <div class="pro-plan-badge">RECOMENDADO</div>
              <div class="pro-plan-info">
                <span class="pro-plan-name">Pase Diario PRO (24 Horas)</span>
                <span class="pro-plan-sub">Mira 1 vídeo patrocinado corto</span>
              </div>
              <div class="pro-plan-pricing">
                <span class="pro-plan-price" style="color: #39ff14;">GRATIS</span>
                <span class="pro-plan-period">1 Anuncio</span>
              </div>
            </div>

            <div class="pro-plan-card" data-hours="72">
              <div class="pro-plan-info">
                <span class="pro-plan-name">Pase Fin de Semana (3 Días)</span>
                <span class="pro-plan-sub">72 horas de telemetría VIP ininterrumpida</span>
              </div>
              <div class="pro-plan-pricing">
                <span class="pro-plan-price" style="color: #00e5ff;">GRATIS</span>
                <span class="pro-plan-period">2 Anuncios</span>
              </div>
            </div>
          </div>

          <!-- Botón Ver Anuncio -->
          <button class="pro-cta-button" id="rwPaywallCta">
            <span id="rwCtaText">VER ANUNCIO Y DESBLOQUEAR PRO (24H)</span>
            <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2.5" fill="none">
              <polygon points="5 3 19 12 5 21 5 3"></polygon>
            </svg>
          </button>

          <div class="pro-paywall-footer">
            <div class="pro-links-row">
              <span class="pro-footer-link" id="rwProStatusInfo">Pase PRO: Inactivo</span>
              <span style="color: #3b4756">•</span>
              <button class="pro-footer-link" id="rwDevToggleBtn" style="color: #39ff14;">[Dev Mode]</button>
            </div>
            <span class="pro-play-disclaimer">
              100% Gratuito mediante publicidad patrocinada (Google AdMob). Sin cobros ni tarjetas requeridas.
            </span>
          </div>
        </div>
      `;

      document.body.appendChild(backdrop);
      this._backdrop = backdrop;
      this._reasonElem = document.getElementById('rwPaywallReason');

      this._bindEvents();
    }

    _bindEvents() {
      const closeBtn = document.getElementById('rwPaywallClose');
      const ctaBtn = document.getElementById('rwPaywallCta');
      const devToggleBtn = document.getElementById('rwDevToggleBtn');
      const planCards = document.querySelectorAll('.pro-plan-card');

      if (closeBtn) closeBtn.addEventListener('click', () => this.close());
      this._backdrop.addEventListener('click', (e) => {
        if (e.target === this._backdrop) this.close();
      });

      planCards.forEach(card => {
        card.addEventListener('click', () => {
          planCards.forEach(c => c.classList.remove('is-selected'));
          card.classList.add('is-selected');
          this._selectedHours = parseInt(card.dataset.hours, 10);

          const ctaText = document.getElementById('rwCtaText');
          if (this._selectedHours === 24) {
            ctaText.textContent = 'VER ANUNCIO Y DESBLOQUEAR PRO (24H)';
          } else {
            ctaText.textContent = 'VER ANUNCIOS Y DESBLOQUEAR PRO (3 DÍAS)';
          }
        });
      });

      if (ctaBtn) {
        ctaBtn.addEventListener('click', async () => {
          this.close();
          if (window.ProManager) {
            await window.ProManager.watchAdToUnlock(this._selectedHours);
            this.showToast(`¡Pase PRO activado con éxito! Tienes ${this._selectedHours}h de acceso libre de marcas.`);
          }
        });
      }

      if (devToggleBtn) {
        devToggleBtn.addEventListener('click', () => {
          if (window.ProManager) {
            const active = window.ProManager.toggleProState();
            this.showToast(`Modo cambiado: ${active ? 'RACE WARS PRO (24H)' : 'FREE TIER'}`);
            this.close();
          }
        });
      }
    }

    open(reason = '') {
      if (!this._backdrop) this._buildModal();

      if (this._reasonElem) {
        if (reason) {
          this._reasonElem.textContent = `★ ${reason}`;
          this._reasonElem.classList.add('has-reason');
        } else {
          this._reasonElem.classList.remove('has-reason');
        }
      }

      const statusInfo = document.getElementById('rwProStatusInfo');
      if (statusInfo && window.ProManager) {
        if (window.ProManager.isPro()) {
          statusInfo.textContent = `Pase PRO Activo (${window.ProManager.getRemainingProTime()} restantes)`;
          statusInfo.style.color = '#39ff14';
        } else {
          statusInfo.textContent = 'Pase PRO: Inactivo (Modo Gratuito)';
          statusInfo.style.color = '#8b99ae';
        }
      }

      this._backdrop.classList.add('is-visible');
    }

    close() {
      if (this._backdrop) {
        this._backdrop.classList.remove('is-visible');
      }
    }

    showToast(msg) {
      let toast = document.getElementById('rwGlobalToast');
      if (!toast) {
        toast = document.createElement('div');
        toast.id = 'rwGlobalToast';
        toast.style.cssText = `
          position: fixed;
          bottom: 24px;
          left: 50%;
          transform: translateX(-50%) translateY(50px);
          background: #101620;
          color: #39ff14;
          border: 1px solid #39ff14;
          padding: 12px 20px;
          border-radius: 24px;
          font-family: 'Chakra Petch', sans-serif;
          font-size: 13px;
          font-weight: 700;
          box-shadow: 0 10px 30px rgba(0,0,0,0.8), 0 0 15px rgba(57,255,20,0.3);
          z-index: 10000;
          opacity: 0;
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
          pointer-events: none;
          text-align: center;
          max-width: 90vw;
        `;
        document.body.appendChild(toast);
      }
      toast.textContent = msg;
      toast.style.opacity = '1';
      toast.style.transform = 'translateX(-50%) translateY(0)';
      setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(-50%) translateY(50px)';
      }, 3500);
    }
  }

  window.ProPaywallModal = new ProPaywallModal();
})();

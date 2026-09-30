/**
 * Race Wars Tracker - Google AdMob & Rewarded Video Ad Manager
 * 
 * Reemplaza las compras de pago con tarjeta por anuncios bonificados (Rewarded Ads):
 * El usuario ve un anuncio patrocinado para desbloquear 24 Horas de Race Wars PRO gratis.
 */

(function () {
  'use strict';

  class AdManager {
    constructor() {
      this.backdrop = null;
      this.isAdPlaying = false;
      this._init();
    }

    _init() {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => this._buildPlayer());
      } else {
        this._buildPlayer();
      }
    }

    _buildPlayer() {
      if (document.getElementById('rwAdRewardedBackdrop')) return;

      const backdrop = document.createElement('div');
      backdrop.id = 'rwAdRewardedBackdrop';
      backdrop.className = 'ad-rewarded-backdrop';

      backdrop.innerHTML = `
        <div class="ad-top-bar">
          <span class="ad-sponsor-badge">GOOGLE ADMOB // ANUNCIO BONIFICADO</span>
          <div class="ad-countdown-pill" id="rwAdCountdown">Recompensa en 5s...</div>
        </div>

        <div class="ad-video-stage">
          <div class="ad-creative-card">
            <div class="ad-brand-logo">MICHELIN PILOT SPORT</div>
            <h3 class="ad-creative-headline">Neumáticos de Máximo Agarre en Circuito y Montaña</h3>
            <p class="ad-creative-sub">Tecnología de competición directamente en tu asfalto. Diseñados para responder en cada curva límite.</p>
            <div class="ad-progress-track">
              <div class="ad-progress-fill" id="rwAdProgressFill"></div>
            </div>
            <div class="ad-reward-claimed-banner" id="rwAdClaimedBanner">
              ✓ ¡RECOMPENSA OBTENIDA! PRO DESBLOQUEADO (24H)
            </div>
          </div>
        </div>

        <div class="ad-bottom-bar">
          <button class="ad-claim-btn" id="rwAdClaimBtn">RECLAMAR PRO VIP</button>
        </div>
      `;

      document.body.appendChild(backdrop);
      this.backdrop = backdrop;
    }

    /**
     * Muestra el anuncio bonificado de AdMob
     * @param {number} rewardHours - Horas de pase PRO otorgadas (ej. 24)
     * @returns {Promise<boolean>}
     */
    showRewardedAd(rewardHours = 24) {
      if (!this.backdrop) this._buildPlayer();
      this.isAdPlaying = true;
      this.backdrop.classList.add('is-visible');

      const countdownElem = document.getElementById('rwAdCountdown');
      const progressFill = document.getElementById('rwAdProgressFill');
      const claimedBanner = document.getElementById('rwAdClaimedBanner');
      const claimBtn = document.getElementById('rwAdClaimBtn');

      if (claimedBanner) claimedBanner.classList.remove('show');
      if (claimBtn) {
        claimBtn.classList.remove('ready');
        claimBtn.textContent = 'ESPERANDO ANUNCIO...';
      }

      return new Promise((resolve) => {
        let secondsLeft = 5;
        let progress = 0;
        countdownElem.textContent = `Recompensa en ${secondsLeft}s...`;
        countdownElem.classList.remove('can-close');

        const interval = setInterval(() => {
          progress += 20;
          if (progressFill) progressFill.style.width = `${progress}%`;

          secondsLeft--;
          if (secondsLeft > 0) {
            countdownElem.textContent = `Recompensa en ${secondsLeft}s...`;
          } else {
            clearInterval(interval);
            countdownElem.textContent = '✓ RECOMPENSA LISTA';
            countdownElem.classList.add('can-close');
            if (claimedBanner) claimedBanner.classList.add('show');
            if (claimBtn) {
              claimBtn.classList.add('ready');
              claimBtn.textContent = `ACTIVAR ${rewardHours}H DE PRO GRATIS ➔`;
            }

            const onClaim = () => {
              if (window.ProManager) {
                window.ProManager.grantAdReward(rewardHours);
              }
              this.backdrop.classList.remove('is-visible');
              this.isAdPlaying = false;
              claimBtn.removeEventListener('click', onClaim);
              resolve(true);
            };

            claimBtn.addEventListener('click', onClaim, { once: true });
          }
        }, 1000);
      });
    }
  }

  window.AdManager = new AdManager();
})();

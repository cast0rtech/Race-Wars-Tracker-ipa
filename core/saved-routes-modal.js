/**
 * Race Wars Tracker - Saved Routes & Roadtrips Merge Manager
 */
(function () {
  'use strict';

  class SavedRoutesModal {
    constructor() {
      this.backdrop = null;
      this.sessions = [];
      this.activeTab = 'individual'; // 'individual' | 'roadtrips'
      this.selectedRouteIds = new Set();
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
      if (document.getElementById('rwRoutesModalBackdrop')) return;

      const backdrop = document.createElement('div');
      backdrop.id = 'rwRoutesModalBackdrop';
      backdrop.className = 'routes-modal-backdrop';

      backdrop.innerHTML = `
        <div class="routes-modal-container" role="dialog" aria-modal="true" aria-labelledby="routesModalTitle">
          <div class="routes-modal-header">
            <div class="routes-modal-title-box">
              <span style="font-size: 1.2rem;">📁</span>
              <h2 class="routes-modal-title" id="routesModalTitle">GESTIÓN DE RUTAS</h2>
              <span class="routes-count-badge" id="routesCountBadge">0</span>
            </div>
            <button class="routes-modal-close" id="rwRoutesClose" aria-label="Cerrar modal">
              <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2.5" fill="none">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>

          <!-- Two Tabs: Rutas Guardadas vs Roadtrips Combinados -->
          <div class="routes-tab-bar">
            <button class="routes-tab-btn is-active" id="tabIndividualBtn">
              📁 Rutas Guardadas
            </button>
            <button class="routes-tab-btn" id="tabRoadtripsBtn">
              🗺️ Roadtrips / Combinados
            </button>
          </div>

          <!-- Total Metrics Summary Row -->
          <div class="routes-stats-summary">
            <div class="stat-item">
              <span class="stat-label">TOTAL ELEMENTOS</span>
              <span class="stat-value" id="statTotalRoutes">0</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">DISTANCIA TOTAL</span>
              <span class="stat-value" id="statTotalDist">0.0 km</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">VELOCIDAD TOP</span>
              <span class="stat-value" id="statTopSpeed">0 km/h</span>
            </div>
          </div>

          <!-- Floating Roadtrip Merge Bar (Visible when >= 2 checked) -->
          <div class="roadtrip-merge-bar" id="roadtripMergeBar" style="display: none;">
            <div class="roadtrip-merge-info">
              <span>🔀</span>
              <span id="mergeCountText">2 rutas seleccionadas</span>
            </div>
            <button class="btn-create-roadtrip" id="btnCreateRoadtrip">
              FUSIONAR EN ROADTRIP
            </button>
          </div>

          <!-- Route Items List -->
          <div id="routesListContainer" style="display: flex; flex-direction: column; gap: 10px;">
            <!-- Rendered dynamically -->
          </div>
        </div>
      `;

      document.body.appendChild(backdrop);
      this.backdrop = backdrop;
      this._bindEvents();
    }

    async _loadSessions() {
      if (window.RaceWarsSessionStore) {
        this.sessions = await window.RaceWarsSessionStore.list();
      } else {
        this.sessions = [];
      }
      this._renderList();
    }

    _renderList() {
      const container = document.getElementById('routesListContainer');
      const countBadge = document.getElementById('routesCountBadge');
      const statTotalRoutes = document.getElementById('statTotalRoutes');
      const statTotalDist = document.getElementById('statTotalDist');
      const statTopSpeed = document.getElementById('statTopSpeed');

      if (!container) return;

      // Filter sessions based on active tab
      const filtered = this.sessions.filter(s => {
        const isRt = s.isRoadtrip || (s.id && s.id.startsWith('roadtrip_'));
        return this.activeTab === 'roadtrips' ? isRt : !isRt;
      });

      if (countBadge) countBadge.textContent = filtered.length;

      // Compute stats
      let totalDist = 0;
      let topSpeed = 0;
      filtered.forEach(s => {
        totalDist += Number(s.distanceKm || 0);
        if (s.maxSpeedKmh > topSpeed) topSpeed = s.maxSpeedKmh;
      });

      if (statTotalRoutes) statTotalRoutes.textContent = filtered.length;
      if (statTotalDist) statTotalDist.textContent = `${totalDist.toFixed(1)} km`;
      if (statTopSpeed) statTopSpeed.textContent = `${Math.round(topSpeed)} km/h`;

      this._updateMergeBar();
      container.innerHTML = '';

      if (filtered.length === 0) {
        const msg = this.activeTab === 'roadtrips'
          ? 'No has creado ningún Roadtrip aún.<br>Selecciona varias rutas en la pestaña "Rutas Guardadas" y pulsa "FUSIONAR EN ROADTRIP".'
          : 'No hay rutas guardadas aún.<br>Pulsa START ROUTE en la pantalla principal para grabar sesiones GPS.';

        container.innerHTML = `
          <div style="padding: 24px; text-align: center; color: var(--text-muted); font-family: var(--font-tech); line-height: 1.5;">
            <p style="font-size: 0.95rem; margin-bottom: 6px;">${msg}</p>
          </div>
        `;
        return;
      }

      filtered.forEach(session => {
        const dateObj = new Date(session.startedAt || session.date || Date.now());
        const dateStr = dateObj.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
        const timeStr = dateObj.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

        const card = document.createElement('div');
        const isRoadtrip = session.isRoadtrip || (session.id && session.id.startsWith('roadtrip_'));
        card.className = `route-item-card ${isRoadtrip ? 'is-roadtrip' : ''}`;

        const isChecked = this.selectedRouteIds.has(session.id);
        const isSynth = session.isSynthetic || session.isDemo;
        const synthTag = isSynth ? '<span style="font-size: 0.65rem; color: #ffdd00; border: 1px solid #ffdd00; padding: 1px 4px; border-radius: 4px; margin-left: 6px;">DEMO</span>' : '';
        const rtBadge = isRoadtrip ? `<span style="font-size: 0.65rem; color: var(--neon-cyan); border: 1px solid var(--neon-cyan); padding: 1px 6px; border-radius: 4px; margin-left: 6px;">🗺️ ROADTRIP (${(session.mergedRouteIds || []).length} RUTAS)</span>` : '';

        const checkboxHtml = !isRoadtrip ? `<input type="checkbox" class="route-select-checkbox" data-id="${session.id}" ${isChecked ? 'checked' : ''} title="Seleccionar para fusionar en Roadtrip">` : '';

        card.innerHTML = `
          <div class="route-card-header">
            <div class="route-card-header-left">
              ${checkboxHtml}
              <span class="route-card-date">${session.title || dateStr} ${synthTag}${rtBadge}</span>
            </div>
            <span class="route-card-time">${timeStr}</span>
          </div>
          <div class="route-metrics-row">
            <div class="metric-cell">
              <span class="metric-cell-lbl">DISTANCIA</span>
              <span class="metric-cell-val">${Number(session.distanceKm || 0).toFixed(2)} KM</span>
            </div>
            <div class="metric-cell">
              <span class="metric-cell-lbl">MAX VEL</span>
              <span class="metric-cell-val">${Math.round(session.maxSpeedKmh || 0)} KM/H</span>
            </div>
            <div class="metric-cell">
              <span class="metric-cell-lbl">MEDIA</span>
              <span class="metric-cell-val">${Math.round(session.avgSpeedKmh || 0)} KM/H</span>
            </div>
            <div class="metric-cell">
              <span class="metric-cell-lbl">DESNIVEL</span>
              <span class="metric-cell-val">+${Math.round(session.elevationGainM || 0)}m</span>
            </div>
          </div>
          <div class="route-card-actions">
            <a href="summary.html?session=${session.id}" class="btn-view-summary">
              <span>📊</span> Ver Resumen
            </a>
            <button class="btn-export-gpx" data-id="${session.id}">
              <span>📦</span> GPX
            </button>
            <button class="btn-delete-route" data-id="${session.id}" title="Eliminar ruta">
              <span>🗑️</span>
            </button>
          </div>
        `;

        // Checkbox change listener for merging
        const checkbox = card.querySelector('.route-select-checkbox');
        if (checkbox) {
          checkbox.addEventListener('change', (e) => {
            if (e.target.checked) {
              this.selectedRouteIds.add(session.id);
            } else {
              this.selectedRouteIds.delete(session.id);
            }
            this._updateMergeBar();
          });
        }

        // Action Handlers
        const gpxBtn = card.querySelector('.btn-export-gpx');
        if (gpxBtn) {
          gpxBtn.addEventListener('click', () => {
            if (window.GpxShareModal) {
              window.GpxShareModal.open(session);
            }
          });
        }

        const deleteBtn = card.querySelector('.btn-delete-route');
        if (deleteBtn) {
          deleteBtn.addEventListener('click', async () => {
            if (confirm(`¿Deseas eliminar ${isRoadtrip ? 'este Roadtrip' : 'esta ruta guardada'}?`)) {
              await this._deleteSession(session.id);
            }
          });
        }

        container.appendChild(card);
      });
    }

    _updateMergeBar() {
      const mergeBar = document.getElementById('roadtripMergeBar');
      const countText = document.getElementById('mergeCountText');
      const count = this.selectedRouteIds.size;

      if (!mergeBar) return;

      if (count >= 2 && this.activeTab === 'individual') {
        mergeBar.style.display = 'flex';
        if (countText) countText.textContent = `${count} rutas seleccionadas`;
      } else {
        mergeBar.style.display = 'none';
      }
    }

    async _createRoadtripFromSelected() {
      const selectedSessions = this.sessions.filter(s => this.selectedRouteIds.has(s.id));
      if (selectedSessions.length < 2) return;

      // Sort selected sessions chronologically
      selectedSessions.sort((a, b) => (a.startedAt || 0) - (b.startedAt || 0));

      let mergedPoints = [];
      let totalDist = 0;
      let maxSpeed = 0;
      let totalElevGain = 0;
      let totalElevLoss = 0;
      let maxAlt = -Infinity;
      let speedSum = 0;

      selectedSessions.forEach(s => {
        const pts = (s.trackpoints || []).filter(p => Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lng)));
        mergedPoints = mergedPoints.concat(pts);
        totalDist += Number(s.distanceKm || 0);
        if (s.maxSpeedKmh > maxSpeed) maxSpeed = s.maxSpeedKmh;
        totalElevGain += Number(s.elevationGainM || 0);
        totalElevLoss += Number(s.elevationLossM || 0);
        if (s.peakAltitudeM > maxAlt) maxAlt = s.peakAltitudeM;
        speedSum += Number(s.avgSpeedKmh || 0);
      });

      const avgSpeed = selectedSessions.length > 0 ? speedSum / selectedSessions.length : 0;
      const startDate = new Date(selectedSessions[0].startedAt || Date.now());
      const dateStr = startDate.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });

      const roadtripSession = {
        id: `roadtrip_${Date.now()}`,
        title: `Roadtrip ${dateStr} (${selectedSessions.length} Tramos)`,
        isRoadtrip: true,
        mergedRouteIds: selectedSessions.map(s => s.id),
        startedAt: selectedSessions[0].startedAt || Date.now(),
        date: startDate.toISOString(),
        distanceKm: Number(totalDist.toFixed(2)),
        maxSpeedKmh: Math.round(maxSpeed),
        avgSpeedKmh: Math.round(avgSpeed),
        elevationGainM: Math.round(totalElevGain),
        elevationLossM: Math.round(totalElevLoss),
        peakAltitudeM: maxAlt === -Infinity ? null : Math.round(maxAlt),
        trackpoints: mergedPoints,
        trackpointsCount: mergedPoints.length,
        status: 'COMPLETED'
      };

      if (window.RaceWarsSessionStore) {
        await window.RaceWarsSessionStore.save(roadtripSession);
      }

      this.selectedRouteIds.clear();
      this.activeTab = 'roadtrips';
      this._updateTabUI();

      if (window.ProPaywallModal) {
        window.ProPaywallModal.showToast(`✓ ¡Roadtrip de ${selectedSessions.length} rutas creado y guardado con éxito!`);
      }

      await this._loadSessions();
    }

    async _deleteSession(id) {
      try {
        if (window.indexedDB) {
          const request = indexedDB.open('racewars-tracker', 1);
          request.onsuccess = () => {
            const db = request.result;
            const tx = db.transaction('sessions', 'readwrite');
            tx.objectStore('sessions').delete(id);
            tx.oncomplete = () => {
              db.close();
              this._loadSessions();
            };
          };
        }
      } catch (err) {
        console.warn('Error eliminando sesión:', err);
      }
    }

    _updateTabUI() {
      const tabIndiv = document.getElementById('tabIndividualBtn');
      const tabRt = document.getElementById('tabRoadtripsBtn');

      if (tabIndiv && tabRt) {
        if (this.activeTab === 'individual') {
          tabIndiv.classList.add('is-active');
          tabRt.classList.remove('is-active');
        } else {
          tabRt.classList.add('is-active');
          tabIndiv.classList.remove('is-active');
        }
      }
    }

    _bindEvents() {
      const closeBtn = document.getElementById('rwRoutesClose');
      const tabIndiv = document.getElementById('tabIndividualBtn');
      const tabRt = document.getElementById('tabRoadtripsBtn');
      const btnMerge = document.getElementById('btnCreateRoadtrip');

      if (closeBtn) closeBtn.addEventListener('click', () => this.close());
      this.backdrop.addEventListener('click', (e) => {
        if (e.target === this.backdrop) this.close();
      });

      if (tabIndiv) {
        tabIndiv.addEventListener('click', () => {
          this.activeTab = 'individual';
          this._updateTabUI();
          this._renderList();
        });
      }

      if (tabRt) {
        tabRt.addEventListener('click', () => {
          this.activeTab = 'roadtrips';
          this._updateTabUI();
          this._renderList();
        });
      }

      if (btnMerge) {
        btnMerge.addEventListener('click', async () => {
          await this._createRoadtripFromSelected();
        });
      }
    }

    async open() {
      if (!this.backdrop) this._buildModal();
      this.selectedRouteIds.clear();
      this.activeTab = 'individual';
      this._updateTabUI();
      await this._loadSessions();
      this.backdrop.classList.add('is-visible');
    }

    close() {
      if (this.backdrop) this.backdrop.classList.remove('is-visible');
    }
  }

  window.SavedRoutesModal = new SavedRoutesModal();
})();

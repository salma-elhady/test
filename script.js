const sitesDatabase = {
    "Shackleton Connecting Ridge": { lat: -89.88, lon: 128.50, type: "ridge" },
    "Malapert Mountain (Massif)": { lat: -85.92, lon: 357.10, type: "peak" },
    "Peak of Eternal Light": { lat: -89.54, lon: 152.00, type: "ridge" },
    "Haworth Crater Rim": { lat: -87.45, lon: 354.90, type: "rim" },
    "Faustini Rim A": { lat: -87.30, lon: 84.30, type: "rim" },
    "Amundsen South Rim": { lat: -84.50, lon: 105.60, type: "rim" }
};

let activeComparisonSites = [
    "Shackleton Connecting Ridge",
    "Malapert Mountain (Massif)"
];

let cardStates = {};

document.addEventListener('DOMContentLoaded', () => {
    initAddDropdown();
    renderAllSiteCards();

    const missionDateEl = document.getElementById('missionDate');
    const missionSpanEl = document.getElementById('missionSpan');

    if (missionDateEl) missionDateEl.addEventListener('change', renderAllSiteCards);
    if (missionSpanEl) missionSpanEl.addEventListener('change', renderAllSiteCards);
});

function initAddDropdown() {
    const select = document.getElementById('siteAddSelect');
    if (!select) return;

    select.innerHTML = '';
    Object.keys(sitesDatabase).forEach(siteName => {
        const option = document.createElement('option');
        option.value = siteName;
        option.textContent = siteName;
        select.appendChild(option);
    });
}

function toggleSiteFromMap(siteName) {
    if (activeComparisonSites.includes(siteName)) {
        if (activeComparisonSites.length > 1) {
            removeSiteCard(siteName);
        }
    } else {
        activeComparisonSites.push(siteName);
        renderAllSiteCards();
    }
}

function addSelectedSiteCard() {
    const select = document.getElementById('siteAddSelect');
    if (!select) return;
    const siteName = select.value;
    if (!activeComparisonSites.includes(siteName)) {
        activeComparisonSites.push(siteName);
        renderAllSiteCards();
    }
}

function addCustomSiteCard() {
    const latInput = document.getElementById('customLat');
    const lonInput = document.getElementById('customLon');
    if (!latInput || !lonInput) return;

    const lat = parseFloat(latInput.value);
    const lon = parseFloat(lonInput.value);
    if (isNaN(lat) || isNaN(lon)) return;

    const customName = `Custom (${lat.toFixed(2)}°, ${lon.toFixed(2)}°)`;
    sitesDatabase[customName] = { lat: lat, lon: lon, type: "custom" };

    if (!activeComparisonSites.includes(customName)) {
        activeComparisonSites.push(customName);
        renderAllSiteCards();
    }
}

function removeSiteCard(siteName) {
    activeComparisonSites = activeComparisonSites.filter(s => s !== siteName);
    delete cardStates[siteName];
    renderAllSiteCards();
}

function updateMapPinHighlights() {
    document.querySelectorAll('.terrain-pin').forEach(pin => {
        const site = pin.getAttribute('data-site');
        if (activeComparisonSites.includes(site)) {
            pin.classList.add('active-pin');
        } else {
            pin.classList.remove('active-pin');
        }
    });

    const countBadge = document.getElementById('activeCountBadge');
    if (countBadge) {
        countBadge.textContent = `${activeComparisonSites.length} Site${activeComparisonSites.length === 1 ? '' : 's'} Active`;
    }
}

function getMissionDateOffset() {
    const dateInput = document.getElementById('missionDate');
    if (!dateInput || !dateInput.value) return 0;
    const baseDate = new Date('2026-01-01');
    const targetDate = new Date(dateInput.value);
    return Math.floor((targetDate - baseDate) / (1000 * 60 * 60 * 24)) % 29.5;
}

function getHorizonProfile(lat, lon) {
    const absLat = Math.abs(lat);
    const roughness = Math.max(0.4, (90 - absLat) * 0.25 + 0.6);
    return Array.from({ length: 360 }, (_, deg) => {
        const rad = (deg * Math.PI) / 180;
        return 1.1 + Math.sin(rad * 3 + lon * 0.05) * roughness + Math.cos(rad * 7) * 0.45;
    });
}

function getCelestialPositions(hour, site) {
    const lunarDayHours = 708.7;
    const dateOffset = getMissionDateOffset() * 24;
    const adjustedHour = hour + dateOffset;
    const absLat = Math.abs(site.lat);

    const sunAz = (180 + (adjustedHour / lunarDayHours) * 360) % 360;
    const sunEl = 1.4 + Math.sin((adjustedHour / lunarDayHours) * Math.PI * 2) * (90 - absLat + 1.5);

    const earthAz = (185 + site.lon * 0.1 + Math.sin((adjustedHour / 655) * Math.PI * 2) * 6) % 360;
    const earthEl = Math.max(0.5, (90 - absLat) * 1.1 + Math.cos((adjustedHour / 655) * Math.PI * 2) * 3.8);

    return { sunAz, sunEl, earthAz, earthEl };
}

function computeSiteTelemetry(site, horizonProfile, totalHours, currentHour) {
    let sunVisibleCount = 0;
    let earthVisibleCount = 0;
    let maxDarkStreak = 0, currentDarkStreak = 0;
    let maxSilenceStreak = 0, currentSilenceStreak = 0;

    for (let h = 0; h < totalHours; h++) {
        const pos = getCelestialPositions(h, site);
        const terrainAtSun = horizonProfile[Math.floor(pos.sunAz) % 360];
        const terrainAtEarth = horizonProfile[Math.floor(pos.earthAz) % 360];

        if (pos.sunEl > terrainAtSun) {
            sunVisibleCount++;
            currentDarkStreak = 0;
        } else {
            currentDarkStreak++;
            if (currentDarkStreak > maxDarkStreak) maxDarkStreak = currentDarkStreak;
        }

        if (pos.earthEl > terrainAtEarth) {
            earthVisibleCount++;
            currentSilenceStreak = 0;
        } else {
            currentSilenceStreak++;
            if (currentSilenceStreak > maxSilenceStreak) maxSilenceStreak = currentSilenceStreak;
        }
    }

    const sunlightPct = Math.round((sunVisibleCount / totalHours) * 100);
    const earthLinkPct = Math.round((earthVisibleCount / totalHours) * 100);
    const longestDarkHrs = maxDarkStreak;
    const longestSilenceDays = (maxSilenceStreak / 24).toFixed(1);

    const t0Pos = getCelestialPositions(0, site);
    const t0SunEl = (t0Pos.sunEl >= 0 ? '+' : '') + t0Pos.sunEl.toFixed(2) + '°';

    const nowPos = getCelestialPositions(currentHour, site);
    const sunNowVisible = nowPos.sunEl > horizonProfile[Math.floor(nowPos.sunAz) % 360];
    const earthNowVisible = nowPos.earthEl > horizonProfile[Math.floor(nowPos.earthAz) % 360];

    let sunChangeHrs = 1;
    while (sunChangeHrs < 360) {
        const futurePos = getCelestialPositions(currentHour + sunChangeHrs, site);
        const vis = futurePos.sunEl > horizonProfile[Math.floor(futurePos.sunAz) % 360];
        if (vis !== sunNowVisible) break;
        sunChangeHrs++;
    }

    let earthChangeHrs = 1;
    while (earthChangeHrs < 360) {
        const futurePos = getCelestialPositions(currentHour + earthChangeHrs, site);
        const vis = futurePos.earthEl > horizonProfile[Math.floor(futurePos.earthAz) % 360];
        if (vis !== earthNowVisible) break;
        earthChangeHrs++;
    }

    return {
        sunlightPct,
        earthLinkPct,
        longestDarkHrs,
        longestSilenceDays,
        t0SunEl,
        sunNowVisible,
        earthNowVisible,
        sunChangeHrs,
        earthChangeHrs
    };
}

function renderAllSiteCards() {
    updateMapPinHighlights();
    const container = document.getElementById('siteCardsContainer');
    if (!container) return;

    const spanEl = document.getElementById('missionSpan');
    const totalHours = spanEl ? parseInt(spanEl.value, 10) || 672 : 672;

    if (activeComparisonSites.length === 0) {
        container.innerHTML = `<div class="card" style="text-align: center; color: var(--muted); padding: 40px;">No landing sites selected. Click a pin on the South Pole map above or use the dropdown to add sites.</div>`;
        return;
    }

    container.innerHTML = '';
    activeComparisonSites.forEach(siteName => {
        const site = sitesDatabase[siteName];
        if (!site) return;

        if (!cardStates[siteName]) {
            cardStates[siteName] = { hour: 42, centerAz: 180, zoom: 1, isPlaying: false };
        }
        const state = cardStates[siteName];
        const horizonProfile = getHorizonProfile(site.lat, site.lon);
        const tele = computeSiteTelemetry(site, horizonProfile, totalHours, state.hour);
        const cardIdSafe = siteName.replace(/[^a-zA-Z0-9]/g, '_');

        const meetsConstraint = tele.sunlightPct >= 70;

        const card = document.createElement('div');
        card.className = 'card';
        card.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                <div>
                    <h3 style="font-family: var(--display); font-size: 1.15rem; color: var(--text);">${siteName}</h3>
                    <div class="site-meta-tags">
                        <span class="tag-coords">${site.lat.toFixed(2)}°S, ${site.lon.toFixed(2)}°E • ${site.type}</span>
                        <span class="tag-lola">Documented Candidate • LOLA</span>
                    </div>
                </div>
                ${activeComparisonSites.length > 1 ? `<button onclick="removeSiteCard('${siteName}')" class="btn btn-secondary" style="padding: 5px 10px; font-size: 0.7rem;">Remove</button>` : ''}
            </div>

            <div class="solar-banner">
                <span>☀️ Landing Solar Elevation (T+0):</span>
                <strong style="color: var(--amber);">${tele.t0SunEl}</strong>
            </div>

            <div class="constraint-banner ${meetsConstraint ? 'constraint-pass' : 'constraint-warn'}">
                ${meetsConstraint 
                    ? `✓ Meets mission power constraints: Sunlight (${tele.sunlightPct}%) exceeds the required 70% threshold.` 
                    : `⚠️ Constraint warning: Sunlight (${tele.sunlightPct}%) is below the nominal 70% continuous solar threshold.`}
            </div>

            <div class="telemetry-grid">
                <div class="tele-box">
                    <div class="tele-label">☀️ Sunlight</div>
                    <div class="tele-value" style="color: var(--amber);">${tele.sunlightPct}%</div>
                    <div class="tele-sub">Sun above terrain</div>
                </div>
                <div class="tele-box">
                    <div class="tele-label">📡 Earth link</div>
                    <div class="tele-value" style="color: var(--cyan);">${tele.earthLinkPct}%</div>
                    <div class="tele-sub">Earth visible</div>
                </div>
                <div class="tele-box">
                    <div class="tele-label">🌑 Longest dark</div>
                    <div class="tele-value">${tele.longestDarkHrs} <span style="font-size: 0.85rem; font-weight: 500;">hrs</span></div>
                    <div class="tele-sub">Max eclipse span</div>
                </div>
                <div class="tele-box">
                    <div class="tele-label">🔇 Longest silence</div>
                    <div class="tele-value">${tele.longestSilenceDays} <span style="font-size: 0.85rem; font-weight: 500;">days</span></div>
                    <div class="tele-sub">Max LOS blackout</div>
                </div>
            </div>

            <div class="countdown-panel">
                <div class="countdown-header">
                    <span id="cdTimeLabel_${cardIdSafe}">Prospective Countdowns (at T+${state.hour}.0h):</span>
                    <span class="badge-tag" style="font-size: 0.62rem; padding: 2px 6px;">FORWARD COUNTDOWN</span>
                </div>
                <div class="countdown-split">
                    <div class="cd-item" id="cdSunBox_${cardIdSafe}">
                        <div class="cd-title" style="color: ${tele.sunNowVisible ? 'var(--amber)' : 'var(--muted)'};">
                            ${tele.sunNowVisible ? '☀️ Sun Visible' : '🌑 Sun Occluded'}
                        </div>
                        <div class="cd-sub">${tele.sunNowVisible ? `Next loss in ${tele.sunChangeHrs}h` : `Returns in ${tele.sunChangeHrs}h`}</div>
                    </div>
                    <div class="cd-item" id="cdEarthBox_${cardIdSafe}">
                        <div class="cd-title" style="color: ${tele.earthNowVisible ? 'var(--emerald)' : 'var(--rose)'};">
                            ${tele.earthNowVisible ? '📡 Earth Visible' : '📵 Earth Occluded'}
                        </div>
                        <div class="cd-sub">${tele.earthNowVisible ? `Next loss in ${tele.earthChangeHrs}h` : `Returns in ${tele.earthChangeHrs}h`}</div>
                    </div>
                </div>
            </div>

            <div class="horizon-widget">
                <div class="horizon-header">
                    <strong>2D Horizon & Ridge Silhouette</strong>
                    <span id="readout_${cardIdSafe}">Hour: ${state.hour}h | Az: ${state.centerAz}°</span>
                </div>

                <svg id="horizonSvg_${cardIdSafe}" class="horizon-canvas" viewBox="0 0 1000 440">
                    <g id="gridLayer_${cardIdSafe}"></g>
                    <circle id="earthBody_${cardIdSafe}" r="16" fill="#38bdf8" opacity="0.9" />
                    <text id="earthLabel_${cardIdSafe}" fill="#7dd3fc" font-size="12" text-anchor="middle">Earth</text>
                    <circle id="sunBody_${cardIdSafe}" r="6" fill="#fde047" />
                    <text id="sunLabel_${cardIdSafe}" fill="#fef08a" font-size="12" text-anchor="middle">Sun</text>
                    <path id="terrainPath_${cardIdSafe}" fill="#1e293b" stroke="#475569" stroke-width="2" />
                </svg>

                <div class="controls">
                    <button id="playBtn_${cardIdSafe}" class="btn" onclick="togglePlay('${siteName}')">Play</button>
                    <div class="control-group">
                        <label style="margin:0;">Time:</label>
                        <input type="range" id="hourSlider_${cardIdSafe}" min="0" max="${totalHours}" step="1" value="${state.hour}" oninput="updateCardState('${siteName}', 'hour', +this.value)">
                    </div>
                    <div class="control-group">
                        <label style="margin:0;">Azimuth:</label>
                        <input type="range" id="azSlider_${cardIdSafe}" min="0" max="360" step="1" value="${state.centerAz}" oninput="updateCardState('${siteName}', 'centerAz', +this.value)">
                    </div>
                    <div class="control-group">
                        <label style="margin:0;">Zoom:</label>
                        <input type="range" id="zoomSlider_${cardIdSafe}" min="1" max="3" step="0.5" value="${state.zoom}" oninput="updateCardState('${siteName}', 'zoom', +this.value)">
                    </div>
                </div>
            </div>
        `;
        container.appendChild(card);
        renderCard(siteName, horizonProfile);
    });
}

function updateCardState(siteName, key, val) {
    if (cardStates[siteName]) {
        cardStates[siteName][key] = val;
        const site = sitesDatabase[siteName];
        if (site) {
            const horizonProfile = getHorizonProfile(site.lat, site.lon);
            renderCard(siteName, horizonProfile);
        }
    }
}

function togglePlay(siteName) {
    if (cardStates[siteName]) {
        cardStates[siteName].isPlaying = !cardStates[siteName].isPlaying;
        const cardIdSafe = siteName.replace(/[^a-zA-Z0-9]/g, '_');
        const btn = document.getElementById(`playBtn_${cardIdSafe}`);
        if (btn) btn.textContent = cardStates[siteName].isPlaying ? 'Pause' : 'Play';
    }
}

function renderCard(siteName, horizonProfile) {
    const site = sitesDatabase[siteName];
    const state = cardStates[siteName];
    if (!site || !state) return;

    const cardIdSafe = siteName.replace(/[^a-zA-Z0-9]/g, '_');
    const spanEl = document.getElementById('missionSpan');
    const totalHours = spanEl ? parseInt(spanEl.value, 10) || 672 : 672;

    const W = 1000, H = 440;
    const viewSpan = 40 / state.zoom;
    const pos = getCelestialPositions(state.hour, site);

    const azToX = (az, span) => {
        let diff = az - state.centerAz;
        while (diff > 180) diff -= 360;
        while (diff < -180) diff += 360;
        return W / 2 + (diff / (span / 2)) * (W / 2);
    };
    const elToY = (el) => 390 - (el / 12) * 350;

    const sx = azToX(pos.sunAz, viewSpan), sy = elToY(pos.sunEl);
    const sunBody = document.getElementById(`sunBody_${cardIdSafe}`);
    const sunLabel = document.getElementById(`sunLabel_${cardIdSafe}`);
    if (sunBody && sunLabel) {
        sunBody.setAttribute('cx', sx);
        sunBody.setAttribute('cy', sy);
        sunBody.setAttribute('r', 6 * state.zoom);
        sunLabel.setAttribute('x', sx);
        sunLabel.setAttribute('y', sy - 10 * state.zoom);
    }

    const ex = azToX(pos.earthAz, viewSpan), ey = elToY(pos.earthEl);
    const earthBody = document.getElementById(`earthBody_${cardIdSafe}`);
    const earthLabel = document.getElementById(`earthLabel_${cardIdSafe}`);
    if (earthBody && earthLabel) {
        earthBody.setAttribute('cx', ex);
        earthBody.setAttribute('cy', ey);
        earthBody.setAttribute('r', 16 * state.zoom);
        earthLabel.setAttribute('x', ex);
        earthLabel.setAttribute('y', ey - 18 * state.zoom);
    }

    let d = `M 0,${H} `;
    const steps = 100;
    for (let i = 0; i <= steps; i++) {
        const frac = i / steps;
        const az = (state.centerAz - viewSpan / 2 + frac * viewSpan + 360) % 360;
        const el = horizonProfile[Math.floor(az) % 360];
        d += `L ${(frac * W).toFixed(1)},${elToY(el).toFixed(1)} `;
    }
    d += `L ${W},${H} Z`;
    const terrainPath = document.getElementById(`terrainPath_${cardIdSafe}`);
    if (terrainPath) terrainPath.setAttribute('d', d);

    const grid = document.getElementById(`gridLayer_${cardIdSafe}`);
    if (grid) {
        grid.innerHTML = '';
        [0, 4, 8, 12].forEach(deg => {
            const y = elToY(deg);
            grid.innerHTML += `<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="#1e293b" stroke-dasharray="4"/>
                               <text x="10" y="${y - 4}" fill="#64748b" font-size="11">${deg}°</text>`;
        });

        const dirs = [{n:'N',a:0},{n:'NE',a:45},{n:'E',a:90},{n:'SE',a:135},{n:'S',a:180},{n:'SW',a:225},{n:'W',a:270},{n:'NW',a:315}];
        dirs.forEach(dir => {
            const x = azToX(dir.a, viewSpan);
            if (x >= 0 && x <= W) {
                grid.innerHTML += `<text x="${x}" y="425" fill="#94a3b8" font-size="12" font-weight="bold" text-anchor="middle">${dir.n} (${dir.a}°)</text>`;
            }
        });
    }

    const tele = computeSiteTelemetry(site, horizonProfile, totalHours, state.hour);
    const cdTimeLabel = document.getElementById(`cdTimeLabel_${cardIdSafe}`);
    if (cdTimeLabel) cdTimeLabel.textContent = `Prospective Countdowns (at T+${Math.round(state.hour)}.0h):`;

    const cdSunBox = document.getElementById(`cdSunBox_${cardIdSafe}`);
    if (cdSunBox) {
        cdSunBox.innerHTML = `
            <div class="cd-title" style="color: ${tele.sunNowVisible ? 'var(--amber)' : 'var(--muted)'};">
                ${tele.sunNowVisible ? '☀️ Sun Visible' : '🌑 Sun Occluded'}
            </div>
            <div class="cd-sub">${tele.sunNowVisible ? `Next loss in ${tele.sunChangeHrs}h` : `Returns in ${tele.sunChangeHrs}h`}</div>
        `;
    }

    const cdEarthBox = document.getElementById(`cdEarthBox_${cardIdSafe}`);
    if (cdEarthBox) {
        cdEarthBox.innerHTML = `
            <div class="cd-title" style="color: ${tele.earthNowVisible ? 'var(--emerald)' : 'var(--rose)'};">
                ${tele.earthNowVisible ? '📡 Earth Visible' : '📵 Earth Occluded'}
            </div>
            <div class="cd-sub">${tele.earthNowVisible ? `Next loss in ${tele.earthChangeHrs}h` : `Returns in ${tele.earthChangeHrs}h`}</div>
        `;
    }

    const readout = document.getElementById(`readout_${cardIdSafe}`);
    if (readout) {
        readout.textContent = `Hour: ${Math.round(state.hour)}h | Az: ${state.centerAz.toFixed(1)}° | Zoom: ${state.zoom.toFixed(1)}x`;
    }
}
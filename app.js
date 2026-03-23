/**
 * FlipPhone – Sensor Data Collection App
 *
 * Data format stored per recording (ML-ready):
 * {
 *   id: string,          // UUID
 *   trick: string,       // trick name
 *   timestamp: string,   // ISO-8601 recording start time
 *   durationMs: number,  // total duration in milliseconds
 *   sampleCount: number,
 *   sampleRateHz: number, // approximate sample rate
 *   samples: [
 *     { t: number, ax: number, ay: number, az: number,  // accelerometer (m/s²)
 *                  gx: number, gy: number, gz: number }  // gyroscope (rad/s)
 *   ]
 * }
 */

'use strict';

// ──────────────────────────────────────────────
// Constants & State
// ──────────────────────────────────────────────
const TRICKS = [
  'Kickflip',
  'Heelflip',
  'Shuvit',
  '360 Shuvit',
  'Treflip',
  'Hardflip',
  'Varial Kick',
  'Varial Heel',
  'Impossible',
  'Custom',
];

const STORAGE_KEY = 'flipphone_dataset';

const state = {
  selectedTrick: TRICKS[0],
  isRecording: false,
  samples: [],
  recordingStart: null,
  timerInterval: null,
  sensorAvailable: false,
  sensorPermissionGranted: false,
  pendingRecording: null, // filled when review sheet opens
};

// ──────────────────────────────────────────────
// DOM refs
// ──────────────────────────────────────────────
const $ = (id) => document.getElementById(id);

const recordBtn       = $('record-btn');
const timerDisplay    = $('timer-display');
const statusMsg       = $('status-msg');
const permissionBanner = $('permission-banner');
const requestPermBtn  = $('request-permission-btn');
const reviewOverlay   = $('review-overlay');
const reviewTrickName = $('review-trick-name');
const reviewDuration  = $('review-duration');
const reviewSamples   = $('review-samples');
const reviewSampleRate = $('review-sample-rate');
const reviewCanvas    = $('review-canvas');
const btnSave         = $('btn-save');
const btnDiscard      = $('btn-discard');
const datasetList     = $('dataset-list');
const datasetCount    = $('dataset-count');
const toast           = $('toast');

// Sensor value elements
const sensorEls = {
  ax: $('s-ax'), ay: $('s-ay'), az: $('s-az'),
  gx: $('s-gx'), gy: $('s-gy'), gz: $('s-gz'),
};

// ──────────────────────────────────────────────
// Dataset persistence (localStorage)
// ──────────────────────────────────────────────
function loadDataset() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch (_) {
    return [];
  }
}

function saveDataset(ds) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ds));
}

function addRecording(rec) {
  const ds = loadDataset();
  ds.push(rec);
  saveDataset(ds);
}

function deleteRecording(id) {
  const ds = loadDataset().filter((r) => r.id !== id);
  saveDataset(ds);
}

function clearDataset() {
  saveDataset([]);
}

// ──────────────────────────────────────────────
// Trick selector
// ──────────────────────────────────────────────
function buildTrickGrid() {
  const grid = document.querySelector('.trick-grid');
  grid.innerHTML = '';
  TRICKS.forEach((trick) => {
    const btn = document.createElement('button');
    btn.className = 'trick-btn' + (trick === state.selectedTrick ? ' selected' : '');
    btn.textContent = trick;
    btn.addEventListener('click', () => selectTrick(trick));
    grid.appendChild(btn);
  });
}

function selectTrick(trick) {
  if (state.isRecording) return;
  state.selectedTrick = trick;
  document.querySelectorAll('.trick-btn').forEach((b) => {
    b.classList.toggle('selected', b.textContent === trick);
  });
}

// ──────────────────────────────────────────────
// Sensor handling
// ──────────────────────────────────────────────
let latestAcc = { x: 0, y: 0, z: 0 };
let latestGyr = { x: 0, y: 0, z: 0 };

function onMotion(e) {
  const acc = e.accelerationIncludingGravity || e.acceleration || {};
  const gyr = e.rotationRate || {};

  latestAcc = {
    x: acc.x ?? 0,
    y: acc.y ?? 0,
    z: acc.z ?? 0,
  };
  latestGyr = {
    // rotationRate is deg/s – convert to rad/s
    x: ((gyr.alpha ?? 0) * Math.PI) / 180,
    y: ((gyr.beta  ?? 0) * Math.PI) / 180,
    z: ((gyr.gamma ?? 0) * Math.PI) / 180,
  };

  // Update live display
  sensorEls.ax.textContent = latestAcc.x.toFixed(2);
  sensorEls.ay.textContent = latestAcc.y.toFixed(2);
  sensorEls.az.textContent = latestAcc.z.toFixed(2);
  sensorEls.gx.textContent = latestGyr.x.toFixed(2);
  sensorEls.gy.textContent = latestGyr.y.toFixed(2);
  sensorEls.gz.textContent = latestGyr.z.toFixed(2);

  if (state.isRecording) {
    const t = Date.now() - state.recordingStart;
    state.samples.push({
      t,
      ax: +latestAcc.x.toFixed(4),
      ay: +latestAcc.y.toFixed(4),
      az: +latestAcc.z.toFixed(4),
      gx: +latestGyr.x.toFixed(4),
      gy: +latestGyr.y.toFixed(4),
      gz: +latestGyr.z.toFixed(4),
    });
  }
}

function attachMotionListener() {
  window.addEventListener('devicemotion', onMotion);
  state.sensorAvailable = true;
  state.sensorPermissionGranted = true;
  permissionBanner.classList.add('hidden');
  statusMsg.textContent = 'Sensor active – select a trick and record!';
}

async function requestSensorPermission() {
  if (typeof DeviceMotionEvent !== 'undefined' &&
      typeof DeviceMotionEvent.requestPermission === 'function') {
    try {
      const result = await DeviceMotionEvent.requestPermission();
      if (result === 'granted') {
        attachMotionListener();
      } else {
        showToast('Permission denied – sensor unavailable.');
      }
    } catch (err) {
      showToast('Could not request permission: ' + err.message);
    }
  } else {
    // Non-iOS: no permission API needed
    attachMotionListener();
  }
}

function initSensors() {
  if (typeof DeviceMotionEvent === 'undefined') {
    statusMsg.textContent = 'No motion sensors detected on this device.';
    return;
  }

  if (typeof DeviceMotionEvent.requestPermission === 'function') {
    // iOS 13+ requires explicit permission
    permissionBanner.classList.remove('hidden');
    statusMsg.textContent = 'Tap "Enable Sensors" to start.';
  } else {
    // Android / desktop browsers
    attachMotionListener();
  }
}

// ──────────────────────────────────────────────
// Recording
// ──────────────────────────────────────────────
function startRecording() {
  if (!state.sensorPermissionGranted && typeof DeviceMotionEvent !== 'undefined') {
    showToast('Enable sensors first!');
    return;
  }
  state.isRecording = true;
  state.samples = [];
  state.recordingStart = Date.now();

  recordBtn.classList.add('recording');
  recordBtn.querySelector('.btn-label').textContent = 'STOP';
  recordBtn.querySelector('.btn-icon').textContent = '⏹';
  timerDisplay.classList.add('recording');
  statusMsg.textContent = 'Recording…';

  state.timerInterval = setInterval(updateTimer, 100);
}

function stopRecording() {
  state.isRecording = false;
  clearInterval(state.timerInterval);

  const durationMs = Date.now() - state.recordingStart;

  recordBtn.classList.remove('recording');
  recordBtn.querySelector('.btn-label').textContent = 'RECORD';
  recordBtn.querySelector('.btn-icon').textContent = '⏺';
  timerDisplay.classList.remove('recording');
  timerDisplay.textContent = '0:00.0';
  statusMsg.textContent = 'Review your recording…';

  if (state.samples.length < 5) {
    showToast('Too few samples – try again!');
    statusMsg.textContent = 'Ready – select a trick and record!';
    return;
  }

  const sampleRateHz = Math.round((state.samples.length / durationMs) * 1000);

  state.pendingRecording = {
    id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36),
    trick: state.selectedTrick,
    timestamp: new Date(state.recordingStart).toISOString(),
    durationMs: Math.round(durationMs),
    sampleCount: state.samples.length,
    sampleRateHz,
    samples: state.samples.slice(),
  };

  openReview(state.pendingRecording);
}

function updateTimer() {
  const elapsed = Date.now() - state.recordingStart;
  const tenths = Math.floor((elapsed % 1000) / 100);
  const secs   = Math.floor(elapsed / 1000) % 60;
  const mins   = Math.floor(elapsed / 60000);
  timerDisplay.textContent = `${mins}:${String(secs).padStart(2, '0')}.${tenths}`;
}

// ──────────────────────────────────────────────
// Review sheet
// ──────────────────────────────────────────────
function openReview(rec) {
  reviewTrickName.textContent = rec.trick;
  reviewDuration.textContent  = (rec.durationMs / 1000).toFixed(2) + 's';
  reviewSamples.textContent   = rec.sampleCount;
  reviewSampleRate.textContent = rec.sampleRateHz + ' Hz';

  drawChart(rec.samples, reviewCanvas);
  reviewOverlay.classList.remove('hidden');
}

function closeReview() {
  reviewOverlay.classList.add('hidden');
  state.pendingRecording = null;
  statusMsg.textContent = 'Ready – select a trick and record!';
}

function drawChart(samples, canvas) {
  const ctx = canvas.getContext('2d');
  const W = canvas.clientWidth;
  const H = canvas.clientHeight;
  canvas.width  = W;
  canvas.height = H;

  ctx.clearRect(0, 0, W, H);

  if (!samples || samples.length < 2) return;

  // Compute acceleration magnitude
  const mags = samples.map((s) => Math.sqrt(s.ax ** 2 + s.ay ** 2 + s.az ** 2));
  const maxMag = Math.max(...mags, 1);

  const padX = 12;
  const padY = 10;
  const w = W - padX * 2;
  const h = H - padY * 2;

  // Background grid lines
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = padY + (h / 4) * i;
    ctx.beginPath();
    ctx.moveTo(padX, y);
    ctx.lineTo(padX + w, y);
    ctx.stroke();
  }

  // Chart line
  ctx.strokeStyle = '#00e5ff';
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  samples.forEach((_, i) => {
    const x = padX + (i / (samples.length - 1)) * w;
    const y = padY + h - (mags[i] / maxMag) * h;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  // Fill under the line
  ctx.lineTo(padX + w, padY + h);
  ctx.lineTo(padX, padY + h);
  ctx.closePath();
  ctx.fillStyle = 'rgba(0,229,255,0.08)';
  ctx.fill();

  // Axis label
  ctx.fillStyle = '#888';
  ctx.font = '10px system-ui';
  ctx.fillText('|a| m/s²', padX + 2, padY + 10);
}

// ──────────────────────────────────────────────
// Dataset view
// ──────────────────────────────────────────────
function renderDataset() {
  const ds = loadDataset();
  datasetCount.textContent = ds.length;

  if (ds.length === 0) {
    datasetList.innerHTML = '<p class="dataset-empty">No recordings yet.<br>Record a trick and save it!</p>';
    return;
  }

  // Trick count summary
  const trickCounts = {};
  ds.forEach((r) => { trickCounts[r.trick] = (trickCounts[r.trick] || 0) + 1; });
  const pillsHtml = Object.entries(trickCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([t, n]) => `<div class="trick-stat-pill">${t}: <span>${n}</span></div>`)
    .join('');

  const statsHtml = `<div class="trick-stats">${pillsHtml}</div>`;

  const itemsHtml = [...ds].reverse().map((r) => {
    const date = new Date(r.timestamp).toLocaleString();
    return `
      <div class="recording-item" data-id="${r.id}">
        <div class="trick-label">
          <div class="trick-name">${escapeHtml(r.trick)}</div>
          <div class="trick-meta">${date} · ${(r.durationMs / 1000).toFixed(2)}s · ${r.sampleCount} samples · ${r.sampleRateHz} Hz</div>
        </div>
        <button class="item-delete" data-id="${r.id}" aria-label="Delete recording">🗑</button>
      </div>`;
  }).join('');

  datasetList.innerHTML = statsHtml + itemsHtml;

  // Attach delete listeners
  datasetList.querySelectorAll('.item-delete').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const id = e.currentTarget.dataset.id;
      deleteRecording(id);
      renderDataset();
      showToast('Recording deleted.');
    });
  });
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ──────────────────────────────────────────────
// Export
// ──────────────────────────────────────────────
function exportJSON() {
  const ds = loadDataset();
  if (ds.length === 0) { showToast('No data to export.'); return; }
  const blob = new Blob([JSON.stringify(ds, null, 2)], { type: 'application/json' });
  triggerDownload(blob, `flipphone_dataset_${Date.now()}.json`);
  showToast('Exported as JSON!');
}

function exportCSV() {
  const ds = loadDataset();
  if (ds.length === 0) { showToast('No data to export.'); return; }

  const rows = ['id,trick,timestamp,durationMs,sampleCount,sampleRateHz,t,ax,ay,az,gx,gy,gz'];
  ds.forEach((r) => {
    r.samples.forEach((s) => {
      rows.push([
        r.id, `"${r.trick}"`, r.timestamp, r.durationMs,
        r.sampleCount, r.sampleRateHz,
        s.t, s.ax, s.ay, s.az, s.gx, s.gy, s.gz,
      ].join(','));
    });
  });

  const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
  triggerDownload(blob, `flipphone_dataset_${Date.now()}.csv`);
  showToast('Exported as CSV!');
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ──────────────────────────────────────────────
// Toast
// ──────────────────────────────────────────────
let toastTimeout = null;
function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => toast.classList.remove('show'), 2500);
}

// ──────────────────────────────────────────────
// Tab navigation
// ──────────────────────────────────────────────
function switchTab(tabName) {
  document.querySelectorAll('.tab-btn').forEach((b) =>
    b.classList.toggle('active', b.dataset.tab === tabName));
  document.querySelectorAll('.view').forEach((v) =>
    v.classList.toggle('active', v.id === tabName + '-view'));

  if (tabName === 'dataset') renderDataset();
}

// ──────────────────────────────────────────────
// Init
// ──────────────────────────────────────────────
function init() {
  buildTrickGrid();
  initSensors();
  renderDataset();

  // Tab buttons
  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // Record button
  recordBtn.addEventListener('click', () => {
    if (state.isRecording) stopRecording();
    else startRecording();
  });

  // Permission button
  requestPermBtn.addEventListener('click', requestSensorPermission);

  // Review actions
  btnSave.addEventListener('click', () => {
    if (state.pendingRecording) {
      addRecording(state.pendingRecording);
      renderDataset();
      showToast('✅ Recording saved!');
    }
    closeReview();
  });

  btnDiscard.addEventListener('click', () => {
    showToast('❌ Recording discarded.');
    closeReview();
  });

  // Export buttons
  $('btn-export-json').addEventListener('click', exportJSON);
  $('btn-export-csv').addEventListener('click', exportCSV);

  // Clear all
  $('btn-clear').addEventListener('click', () => {
    if (confirm('Delete all recordings? This cannot be undone.')) {
      clearDataset();
      renderDataset();
      showToast('Dataset cleared.');
    }
  });
}

document.addEventListener('DOMContentLoaded', init);

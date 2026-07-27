const socket = io();

// Application State
let settings = {
  draftMode: false,
  replyToGroups: false,
  ignoreMedia: true,
  systemPrompt: "You are a helpful WhatsApp assistant. Provide concise and helpful answers.",
  skipKeywords: ["unsubscribe", "stop"],
  replyTo: [],
  doNotReply: [],
  emergencyKeywords: ["urgent", "emergency", "hospital", "police", "otp", "password"],
  handoverCooldownMinutes: 60
};

let drafts = {};
let templates = [];
let campaigns = [];
let activityLogs = [];
let totalSentCount = 0;

function escapeHtml(str) {
  if (!str) return '';
  return str.toString()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ---------------- Navigation & Theme ----------------
const crumbNames = {
  overview: 'Overview',
  auto: 'Auto-replies',
  review: 'Review queue',
  saved: 'Saved messages',
  bulk: 'Send to many'
};

document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', () => {
    const pageId = item.dataset.page;
    if (!pageId) return;

    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));

    item.classList.add('active');
    const targetPage = document.getElementById('page-' + pageId);
    if (targetPage) targetPage.classList.add('active');

    const crumbCur = document.getElementById('crumbCur');
    if (crumbCur) crumbCur.textContent = crumbNames[pageId] || 'Overview';

    if (pageId === 'saved') loadTemplates();
    if (pageId === 'bulk') {
      loadTemplatesForSelect();
      loadCampaigns();
    }
    if (pageId === 'review') renderDrafts();
    if (pageId === 'overview') updateStats();
  });
});

// Theme Management
function initTheme() {
  const savedTheme = localStorage.getItem('theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);
}

function toggleTheme() {
  const html = document.documentElement;
  const current = html.getAttribute('data-theme') || 'dark';
  const next = current === 'dark' ? 'light' : 'dark';
  html.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
  showToast(`Switched to ${next} theme`);
}
window.toggleTheme = toggleTheme;

// Toast Notifications
let toastTimer;
function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}
window.showToast = showToast;

// Activity Logger
function logActivity(type, eventText, detailText) {
  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  activityLogs.unshift({ time, type, eventText, detailText });
  if (activityLogs.length > 20) activityLogs.pop();
  renderActivityLog();
}

function renderActivityLog() {
  const tbody = document.getElementById('activityTbody');
  if (!tbody) return;

  if (activityLogs.length === 0) {
    tbody.innerHTML = `<tr><td colspan="3" class="cell-empty">No activity recorded in this session yet.</td></tr>`;
    return;
  }

  tbody.innerHTML = '';
  activityLogs.forEach(log => {
    let badgeClass = 'neutral';
    if (log.type === 'replied' || log.type === 'good') badgeClass = 'good';
    if (log.type === 'skipped' || log.type === 'warn') badgeClass = 'warn';
    if (log.type === 'paused' || log.type === 'bad') badgeClass = 'bad';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="cell-mono">${log.time}</td>
      <td><span class="badge ${badgeClass}">${escapeHtml(log.eventText)}</span></td>
      <td>${escapeHtml(log.detailText)}</td>
    `;
    tbody.appendChild(tr);
  });
}

// ---------------- Socket.IO Connections ----------------
socket.on('qr', (qrData) => {
  const qrBox = document.getElementById('qrBox');
  if (qrBox) {
    qrBox.innerHTML = `<img src="${qrData}" alt="QR Code" style="width:100%; max-width:140px; display:block; margin:0 auto; border-radius:4px;">`;
  }
  const connDot = document.getElementById('connDot');
  if (connDot) connDot.classList.remove('on');
  const connTitle = document.getElementById('connTitle');
  if (connTitle) connTitle.textContent = 'Disconnected';
  const connBtn = document.getElementById('connBtn');
  if (connBtn) connBtn.textContent = 'Scan QR in WhatsApp';

  const statUptime = document.getElementById('statUptime');
  if (statUptime) {
    statUptime.textContent = 'Disconnected';
    statUptime.style.color = 'var(--bad)';
  }
  const statUptimeSub = document.getElementById('statUptimeSub');
  if (statUptimeSub) statUptimeSub.textContent = 'Scan QR code in sidebar';
});

socket.on('ready', (data) => {
  const qrBox = document.getElementById('qrBox');
  if (qrBox) {
    qrBox.innerHTML = `
      <div style="text-align:center; padding:12px; color:var(--good);">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-bottom:4px;"><polyline points="20 6 9 17 4 12"/></svg>
        <div style="font-weight:600; font-size:12px;">Active & Connected</div>
      </div>`;
  }
  const connDot = document.getElementById('connDot');
  if (connDot) connDot.classList.add('on');
  const connTitle = document.getElementById('connTitle');
  if (connTitle) connTitle.textContent = 'Connected';
  const connBtn = document.getElementById('connBtn');
  if (connBtn) connBtn.textContent = 'Connection Active';

  const statUptime = document.getElementById('statUptime');
  if (statUptime) {
    statUptime.textContent = 'Connected';
    statUptime.style.color = 'var(--good)';
  }
  const statUptimeSub = document.getElementById('statUptimeSub');
  if (statUptimeSub) statUptimeSub.textContent = 'Active WhatsApp session';

  logActivity('good', 'connected', 'WhatsApp Client is ready and connected');
});

socket.on('draft_reply', (draft) => {
  drafts[draft.id] = draft;
  renderDrafts();
  updateStats();
  showToast(`New reply waiting for review from ${draft.fromName || 'Contact'}`);
  logActivity('warn', 'review', `Reply waiting for approval for ${draft.fromName || draft.to}`);
});

function refreshConnection() {
  showToast('Checking connection status...');
}
window.refreshConnection = refreshConnection;

// ---------------- Settings Management ----------------
async function loadSettings() {
  try {
    const res = await fetch('/api/settings');
    if (res.ok) {
      settings = await res.json();
    }
  } catch (e) {
    console.error('Failed to load settings:', e);
  }

  // Update Toggles
  setSwitchState('draftModeToggle', !!settings.draftMode);
  setSwitchState('replyToGroupsToggle', !!settings.replyToGroups);
  setSwitchState('ignoreMediaToggle', !!settings.ignoreMedia);

  // Update Inputs
  const handoverInput = document.getElementById('handoverCooldownMinutes');
  if (handoverInput) handoverInput.value = settings.handoverCooldownMinutes || 60;

  const promptInput = document.getElementById('systemPromptInput');
  if (promptInput) promptInput.value = settings.systemPrompt || '';

  // Render Chip Lists
  renderChipList('emergencyKeywordsList', settings.emergencyKeywords || [], 'warn', 'emergencyKeywords');
  renderChipList('replyToList', settings.replyTo || [], '', 'replyTo');
  renderChipList('doNotReplyList', settings.doNotReply || [], 'warn', 'doNotReply');
  renderChipList('skipKeywordsList', settings.skipKeywords || [], '', 'skipKeywords');
}

function setSwitchState(id, isOn) {
  const el = document.getElementById(id);
  if (!el) return;
  if (isOn) el.classList.add('on');
  else el.classList.remove('on');
}

async function saveSettings() {
  try {
    await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings)
    });
  } catch (e) {
    console.error('Failed to save settings:', e);
    showToast('Failed to save settings');
  }
}

function toggleSetting(key) {
  settings[key] = !settings[key];
  const toggleEl = document.getElementById(`${key}Toggle`);
  if (toggleEl) toggleEl.classList.toggle('on', settings[key]);
  saveSettings();
  showToast(`Updated ${key}`);
}
window.toggleSetting = toggleSetting;

function saveInputSetting(key) {
  const el = document.getElementById(key);
  if (!el) return;
  let val = el.value;
  if (key === 'handoverCooldownMinutes') val = parseInt(val, 10) || 60;
  settings[key] = val;
  saveSettings();
  showToast('Setting saved');
}
window.saveInputSetting = saveInputSetting;

function savePrompt() {
  const promptInput = document.getElementById('systemPromptInput');
  if (promptInput) {
    settings.systemPrompt = promptInput.value;
    saveSettings();
    showToast('Instructions saved');
  }
}
window.savePrompt = savePrompt;

// Chip Lists
function renderChipList(containerId, items, extraClass, key) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';

  items.forEach(val => {
    const chip = document.createElement('div');
    chip.className = 'chip' + (extraClass ? ' ' + extraClass : '');
    chip.innerHTML = `${escapeHtml(val)} <button onclick="removeChip('${key}', '${escapeHtml(val)}')">×</button>`;
    container.appendChild(chip);
  });
}

function addChip(inputId, listId, cls, key) {
  const input = document.getElementById(inputId);
  if (!input) return;
  const val = input.value.trim();
  if (!val) return;

  if (!settings[key]) settings[key] = [];
  if (!settings[key].includes(val)) {
    settings[key].push(val);
    input.value = '';
    saveSettings();
    renderChipList(listId, settings[key], cls, key);
    showToast(`Added '${val}'`);
  }
}
window.addChip = addChip;

function removeChip(key, val) {
  if (!settings[key]) return;
  settings[key] = settings[key].filter(item => item !== val);
  saveSettings();

  const listMap = {
    emergencyKeywords: { id: 'emergencyKeywordsList', cls: 'warn' },
    replyTo: { id: 'replyToList', cls: '' },
    doNotReply: { id: 'doNotReplyList', cls: 'warn' },
    skipKeywords: { id: 'skipKeywordsList', cls: '' }
  };

  if (listMap[key]) {
    renderChipList(listMap[key].id, settings[key], listMap[key].cls, key);
  }
  showToast(`Removed '${val}'`);
}
window.removeChip = removeChip;

// Enable enter key for input fields
['emergencyKeywordsInput', 'replyToInput', 'doNotReplyInput', 'skipKeywordsInput'].forEach(id => {
  const el = document.getElementById(id);
  if (el) {
    el.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const btn = el.parentElement.querySelector('button');
        if (btn) btn.click();
      }
    });
  }
});

// ---------------- Review Queue ----------------
function renderDrafts() {
  const reviewCountEl = document.getElementById('reviewCount');
  const statReviewEl = document.getElementById('statReview');
  const statReviewDeltaEl = document.getElementById('statReviewDelta');
  const reviewTbody = document.getElementById('reviewTbody');

  const draftKeys = Object.keys(drafts);
  const count = draftKeys.length;

  if (reviewCountEl) reviewCountEl.textContent = count;
  if (statReviewEl) statReviewEl.textContent = count;
  if (statReviewDeltaEl) {
    statReviewDeltaEl.textContent = count > 0 ? `${count} waiting` : 'Cleared out';
    statReviewDeltaEl.className = 'stat-delta' + (count > 0 ? ' up' : '');
  }

  if (!reviewTbody) return;

  if (count === 0) {
    reviewTbody.innerHTML = `<tr><td colspan="4" class="cell-empty">Nothing waiting for review right now.</td></tr>`;
    return;
  }

  reviewTbody.innerHTML = '';
  draftKeys.forEach(id => {
    const draft = drafts[id];
    const fromName = draft.fromName || draft.to || 'Contact';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>
        <strong style="color:var(--text);">${escapeHtml(fromName)}</strong>
        <div class="cell-mono" style="font-size:11px;">+${escapeHtml(draft.to ? draft.to.split('@')[0] : '')}</div>
      </td>
      <td style="color:var(--text-muted);">${escapeHtml(draft.originalMessage)}</td>
      <td>
        <textarea id="draft-reply-${id}" style="width:100%; min-height:50px; font-size:12px; font-family:var(--sans);">${escapeHtml(draft.replyText)}</textarea>
      </td>
      <td class="row-actions">
        <button class="btn btn-primary" style="padding:4px 9px; font-size:11.5px;" onclick="sendDraft('${id}', '${draft.to}')">Send</button>
        <button class="btn btn-danger" style="padding:4px 9px; font-size:11.5px;" onclick="rejectDraft('${id}')">Remove</button>
      </td>
    `;
    reviewTbody.appendChild(tr);
  });
}

async function sendDraft(id, to) {
  const textarea = document.getElementById(`draft-reply-${id}`);
  const text = textarea ? textarea.value.trim() : (drafts[id] ? drafts[id].replyText : '');

  try {
    const res = await fetch('/api/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to, text })
    });

    if (res.ok) {
      delete drafts[id];
      totalSentCount++;
      renderDrafts();
      updateStats();
      showToast('Message approved and sent!');
      logActivity('good', 'replied', `Approved draft reply sent to ${to.split('@')[0]}`);
    } else {
      showToast('Failed to send message. Check WhatsApp connection.');
    }
  } catch (e) {
    console.error(e);
    showToast('Failed to send message.');
  }
}
window.sendDraft = sendDraft;

function rejectDraft(id) {
  const target = drafts[id];
  delete drafts[id];
  renderDrafts();
  updateStats();
  showToast('Draft removed');
  if (target) {
    logActivity('warn', 'skipped', `Draft rejected for ${target.to ? target.to.split('@')[0] : 'contact'}`);
  }
}
window.rejectDraft = rejectDraft;

// ---------------- Saved Messages (Templates API) ----------------
async function loadTemplates() {
  try {
    const res = await fetch('/api/templates');
    if (res.ok) {
      templates = await res.json();
      renderTemplates();
    }
  } catch (e) {
    console.error('Failed to load templates:', e);
  }
}

async function saveTemplatesToFile() {
  try {
    await fetch('/api/templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(templates)
    });
    renderTemplates();
    loadTemplatesForSelect();
  } catch (e) {
    console.error('Failed to save templates:', e);
    showToast('Failed to save message');
  }
}

function addSavedMessage() {
  const titleInput = document.getElementById('msgTitle');
  const bodyInput = document.getElementById('msgBody');
  if (!titleInput || !bodyInput) return;

  const name = titleInput.value.trim();
  const text = bodyInput.value.trim();
  if (!name || !text) {
    showToast('Add a title and a message first');
    return;
  }

  templates.push({ id: Date.now().toString(), name, text });
  titleInput.value = '';
  bodyInput.value = '';

  saveTemplatesToFile();
  showToast('Message saved');
}
window.addSavedMessage = addSavedMessage;

function deleteTemplate(id) {
  templates = templates.filter(t => t.id !== id);
  saveTemplatesToFile();
  showToast('Message deleted');
}
window.deleteTemplate = deleteTemplate;

function useTemplate(id) {
  const template = templates.find(t => t.id === id);
  if (!template) return;

  // Switch to bulk tab
  const bulkNav = document.querySelector('[data-page="bulk"]');
  if (bulkNav) bulkNav.click();

  setTimeout(() => {
    const batchSelect = document.getElementById('batchMessage');
    if (batchSelect) batchSelect.value = id;
    showToast(`Selected '${template.name}' for batch send`);
  }, 100);
}
window.useTemplate = useTemplate;

function renderTemplates() {
  const tbody = document.getElementById('savedTbody');
  if (!tbody) return;

  if (templates.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" class="cell-empty">You haven't saved any messages yet.</td></tr>`;
    return;
  }

  tbody.innerHTML = '';
  templates.forEach(t => {
    const preview = t.text.length > 50 ? t.text.slice(0, 50) + '…' : t.text;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong style="color:var(--text);">${escapeHtml(t.name)}</strong></td>
      <td style="color:var(--text-muted);">${escapeHtml(preview)}</td>
      <td class="cell-mono">${t.id.slice(-6)}</td>
      <td class="row-actions">
        <button class="link-btn" onclick="useTemplate('${t.id}')">Use</button>
        <button class="link-btn danger" onclick="deleteTemplate('${t.id}')">Delete</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// ---------------- Send to Many (Campaigns API) ----------------
async function loadTemplatesForSelect() {
  try {
    const res = await fetch('/api/templates');
    if (res.ok) templates = await res.json();
  } catch (e) {}

  const select = document.getElementById('batchMessage');
  if (!select) return;

  const currentVal = select.value;
  select.innerHTML = '<option value="">-- Pick one --</option>';
  templates.forEach(t => {
    const opt = document.createElement('option');
    opt.value = t.id;
    opt.textContent = t.name;
    select.appendChild(opt);
  });
  if (currentVal) select.value = currentVal;
}

async function loadCampaigns() {
  try {
    const res = await fetch('/api/campaigns');
    if (res.ok) {
      campaigns = await res.json();
      renderCampaigns();
      updateStats();
    }
  } catch (e) {
    console.error('Failed to load campaigns:', e);
  }
}
window.loadCampaigns = loadCampaigns;

async function startBatch() {
  const nameInput = document.getElementById('batchName');
  const messageSelect = document.getElementById('batchMessage');
  const contactsInput = document.getElementById('batchContacts');
  const waitMinInput = document.getElementById('waitMin');
  const waitMaxInput = document.getElementById('waitMax');

  const name = nameInput ? nameInput.value.trim() || 'Untitled batch' : 'Untitled batch';
  const templateId = messageSelect ? messageSelect.value : '';
  const contactsStr = contactsInput ? contactsInput.value.trim() : '';
  const delayMin = waitMinInput ? parseInt(waitMinInput.value, 10) || 5 : 5;
  const delayMax = waitMaxInput ? parseInt(waitMaxInput.value, 10) || 15 : 15;

  if (!templateId) {
    showToast('Please select a saved message template');
    return;
  }
  if (!contactsStr) {
    showToast('Please enter contact list JSON');
    return;
  }

  let audience = [];
  try {
    audience = JSON.parse(contactsStr);
    if (!Array.isArray(audience) || audience.length === 0) throw new Error('Must be non-empty array');
  } catch (e) {
    showToast('Invalid contacts JSON format');
    return;
  }

  const template = templates.find(t => t.id === templateId);
  const templateText = template ? template.text : '';

  const campaign = {
    id: Date.now().toString(),
    name,
    templateId,
    templateText,
    audience,
    delayMin,
    delayMax,
    status: 'Pending'
  };

  try {
    const res = await fetch('/api/campaigns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(campaign)
    });

    if (res.ok) {
      if (nameInput) nameInput.value = '';
      if (contactsInput) contactsInput.value = '';
      showToast('Batch queued and sending!');
      logActivity('good', 'queued', `Started batch campaign '${name}' to ${audience.length} contacts`);
      loadCampaigns();
    } else {
      showToast('Failed to start batch');
    }
  } catch (e) {
    console.error(e);
    showToast('Failed to start batch');
  }
}
window.startBatch = startBatch;

let campaignPollTimer = null;

function renderCampaigns() {
  const tbody = document.getElementById('batchTbody');
  if (!tbody) return;

  if (campaigns.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" class="cell-empty">You haven't sent anything yet.</td></tr>`;
    return;
  }

  tbody.innerHTML = '';
  let hasActive = false;

  campaigns.forEach(c => {
    if (c.status === 'Running' || c.status === 'Pending') hasActive = true;

    let badgeClass = 'neutral';
    if (c.status === 'Running') badgeClass = 'good';
    if (c.status === 'Completed') badgeClass = 'good';
    if (c.status && c.status.includes('Aborted')) badgeClass = 'bad';

    const startedTime = c.startedAt ? new Date(c.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong style="color:var(--text);">${escapeHtml(c.name)}</strong></td>
      <td class="cell-mono">${c.sent || 0}/${c.total || (c.audience ? c.audience.length : 0)}</td>
      <td><span class="badge ${badgeClass}">${escapeHtml(c.status || 'Pending')}</span></td>
      <td>${startedTime}</td>
    `;
    tbody.appendChild(tr);
  });

  if (hasActive && !campaignPollTimer) {
    campaignPollTimer = setInterval(loadCampaigns, 2500);
  } else if (!hasActive && campaignPollTimer) {
    clearInterval(campaignPollTimer);
    campaignPollTimer = null;
  }
}

// ---------------- Overall Stats & Overview ----------------
function updateStats() {
  const statReplied = document.getElementById('statReplied');
  const statReview = document.getElementById('statReview');
  const statReviewDelta = document.getElementById('statReviewDelta');
  const statBatches = document.getElementById('statBatches');
  const statBatchesDelta = document.getElementById('statBatchesDelta');

  // Total Sent across campaigns + direct replies
  let totalCampaignSent = 0;
  campaigns.forEach(c => { totalCampaignSent += (c.sent || 0); });
  const grandTotalSent = totalCampaignSent + totalSentCount;

  if (statReplied) statReplied.textContent = grandTotalSent;

  // Review Queue Count
  const reviewCount = Object.keys(drafts).length;
  if (statReview) statReview.textContent = reviewCount;
  if (statReviewDelta) {
    statReviewDelta.textContent = reviewCount > 0 ? `${reviewCount} waiting` : 'Cleared out';
    statReviewDelta.className = 'stat-delta' + (reviewCount > 0 ? ' up' : '');
  }

  // Active Batches Count
  const activeBatches = campaigns.filter(c => c.status === 'Running' || c.status === 'Pending').length;
  if (statBatches) statBatches.textContent = activeBatches;
  if (statBatchesDelta) {
    statBatchesDelta.textContent = activeBatches > 0 ? `${activeBatches} running` : 'None running';
    statBatchesDelta.className = 'stat-delta' + (activeBatches > 0 ? ' up' : '');
  }
}

// ---------------- Search & Keyboard Shortcuts ----------------
const searchInput = document.getElementById('searchInput');
if (searchInput) {
  searchInput.addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase().trim();
    if (!q) return;

    // Search in templates
    const matchedTemplate = templates.find(t => t.name.toLowerCase().includes(q) || t.text.toLowerCase().includes(q));
    if (matchedTemplate) {
      const navSaved = document.querySelector('[data-page="saved"]');
      if (navSaved) navSaved.click();
    }
  });
}

document.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    if (searchInput) searchInput.focus();
  }
});

// Initial Setup
initTheme();
loadSettings();
loadTemplates();
loadCampaigns();
renderActivityLog();

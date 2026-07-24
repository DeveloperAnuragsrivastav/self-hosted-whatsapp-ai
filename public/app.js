const socket = io();
let settings = { 
    draftMode: false,
    replyToGroups: false, 
    ignoreMedia: true, 
    systemPrompt: "", 
    skipKeywords: [],
    replyTo: [],
    doNotReply: [],
    emergencyKeywords: [],
    handoverCooldownMinutes: 60
};

let drafts = {};
let templates = [];
let campaigns = [];

function escapeHtml(str) {
    if (!str) return '';
    return str.toString()
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Navigation Logic
function switchTab(tabId) {
    // Hide all views
    document.querySelectorAll('.view-section').forEach(el => el.style.display = 'none');
    // Remove active class from all nav items
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    
    // Show target view
    document.getElementById(`view-${tabId}`).style.display = 'block';
    // Add active class to clicked nav item
    document.getElementById(`nav-${tabId}`).classList.add('active');
    
    // Load specific data
    if(tabId === 'templates') loadTemplates();
    if(tabId === 'campaigns') {
        loadTemplatesForSelect();
        loadCampaigns();
    }
}
window.switchTab = switchTab;

// Socket Events
socket.on('qr', (qrData) => {
    document.getElementById('qrContainer').innerHTML = `<img src="${qrData}" alt="QR Code">`;
    document.getElementById('statusText').innerText = 'Scan to connect';
    document.querySelector('.dot').classList.remove('connected');
});

socket.on('ready', (data) => {
    document.getElementById('qrContainer').innerHTML = `
        <div style="color: var(--accent-bright); padding: 1.5rem; display: flex; flex-direction: column; align-items: center; gap: 0.75rem;">
            <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
            <p style="font-weight: 600; font-size: 0.95rem;">You're all set</p>
        </div>
    `;
    document.getElementById('statusText').innerText = 'Active';
    document.querySelector('.dot').classList.add('connected');
});

socket.on('draft_reply', (draft) => {
    drafts[draft.id] = draft;
    renderDrafts();
});

// Settings Management
async function loadSettings() {
    try {
        const response = await fetch('/api/settings');
        settings = await response.json();
        
        document.getElementById('draftModeToggle').checked = !!settings.draftMode;
        document.getElementById('replyToGroupsToggle').checked = !!settings.replyToGroups;
        document.getElementById('ignoreMediaToggle').checked = !!settings.ignoreMedia;
        document.getElementById('systemPromptInput').value = settings.systemPrompt || "";
        document.getElementById('handoverCooldownMinutes').value = settings.handoverCooldownMinutes || 60;
        
        renderLists();
    } catch (e) {
        console.error('Failed to load settings', e);
    }
}

async function saveSettings() {
    try {
        await fetch('/api/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(settings)
        });
    } catch (e) {
        console.error('Failed to save settings', e);
    }
}

function toggleSetting(key) {
    settings[key] = document.getElementById(`${key}Toggle`).checked;
    saveSettings();
}

function saveInputSetting(key) {
    let val = document.getElementById(key).value;
    if (key === 'handoverCooldownMinutes') val = parseInt(val, 10);
    settings[key] = val;
    saveSettings();
}

function savePrompt() {
    settings.systemPrompt = document.getElementById('systemPromptInput').value;
    saveSettings();
    
    const btn = document.querySelector('.save-btn');
    const originalText = btn.innerText;
    btn.innerText = 'Saved!';
    btn.style.background = '#25d366';
    btn.style.color = '#111b21';
    setTimeout(() => {
        btn.innerText = originalText;
        btn.style.background = 'var(--accent)';
    }, 2000);
}

function addSetting(key) {
    const inputId = `${key}Input`;
    const val = document.getElementById(inputId).value.trim();
    if (val) {
        if (!settings[key]) settings[key] = [];
        if (!settings[key].includes(val)) {
            settings[key].push(val);
            document.getElementById(inputId).value = '';
            saveSettings();
            renderLists();
        }
    }
}

['skipKeywords', 'replyTo', 'doNotReply', 'emergencyKeywords'].forEach(key => {
    const el = document.getElementById(`${key}Input`);
    if(el) {
        el.addEventListener('keypress', function (e) {
            if (e.key === 'Enter') {
                addSetting(key);
            }
        });
    }
});

function removeSetting(key, val) {
    settings[key] = settings[key].filter(item => item !== val);
    saveSettings();
    renderLists();
}

async function sendDraft(id, to) {
    const textarea = document.getElementById(`draft-text-${id}`);
    const text = textarea ? textarea.value : '';
    
    try {
        const response = await fetch('/api/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ to, text })
        });
        
        if (response.ok) {
            delete drafts[id];
            renderDrafts();
        } else {
            alert("Couldn't send the message. Make sure your phone is connected.");
        }
    } catch(e) {
        console.error(e);
        alert("Couldn't send the message. Make sure your phone is connected.");
    }
}

function rejectDraft(id) {
    delete drafts[id];
    renderDrafts();
}

function renderDrafts() {
    const container = document.getElementById('draftsContainer');
    if (!container) return;
    
    const draftKeys = Object.keys(drafts);
    
    if (draftKeys.length === 0) {
        container.innerHTML = `<p id="noDraftsMsg" style="color: var(--text-muted); font-style: italic; font-size: 0.9rem; text-align: center; padding: 1rem;">No messages waiting for review.</p>`;
        return;
    }
    
    container.innerHTML = '';
    draftKeys.forEach(id => {
        const draft = drafts[id];
        const div = document.createElement('div');
        div.className = 'chat-bubble-group';
        
        const initial = (draft.fromName || 'U').charAt(0).toUpperCase();
        const displayNum = draft.to ? draft.to.split('@')[0] : '';
        
        div.innerHTML = `
            <div class="chat-bubble-header">
                <div class="contact-info">
                    <div class="contact-avatar">${initial}</div>
                    <div>
                        <strong style="color: var(--text-primary); font-size: 0.95rem;">${escapeHtml(draft.fromName)}</strong>
                        <span style="color: var(--text-muted); font-size: 0.78rem; display: block;">+${displayNum}</span>
                    </div>
                </div>
                <span class="brand-badge" style="font-size: 0.7rem;">Ready to Review</span>
            </div>
            
            <div class="chat-bubble incoming">
                <div style="font-size: 0.72rem; color: var(--accent-bright); margin-bottom: 0.25rem; font-weight: 600;">THEY SAID</div>
                ${escapeHtml(draft.originalMessage)}
            </div>

            <div class="chat-bubble outgoing-draft">
                <div style="font-size: 0.72rem; color: #aebac1; margin-bottom: 0.25rem; font-weight: 600;">ASSISTANT WANTS TO SAY</div>
                <textarea id="draft-text-${id}" rows="3">${escapeHtml(draft.replyText)}</textarea>
                <div class="draft-actions">
                    <button class="danger-btn" onclick="rejectDraft('${id}')">Remove</button>
                    <button class="approve-btn" onclick="sendDraft('${id}', '${draft.to}')">Send</button>
                </div>
            </div>
        `;
        container.appendChild(div);
    });
}

function renderLists() {
    const lists = ['skipKeywords', 'replyTo', 'doNotReply', 'emergencyKeywords'];
    lists.forEach(key => {
        const ul = document.getElementById(`${key}List`);
        if(!ul) return;
        ul.innerHTML = '';
        (settings[key] || []).forEach(val => {
            const li = document.createElement('li');
            li.innerHTML = `
                <span>${escapeHtml(val)}</span>
                <button class="delete-btn" onclick="removeSetting('${key}', '${escapeHtml(val)}')">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
            `;
            ul.appendChild(li);
        });
    });
}

// ================= TEMPLATES API =================
async function loadTemplates() {
    try {
        const res = await fetch('/api/templates');
        templates = await res.json();
        renderTemplates();
    } catch(e) { console.error(e); }
}

async function saveTemplatesToFile() {
    await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(templates)
    });
    renderTemplates();
}

function saveTemplate() {
    const name = document.getElementById('templateNameInput').value.trim();
    const text = document.getElementById('templateTextInput').value.trim();
    if(!name || !text) return alert("Please fill in both the name and the message.");
    
    templates.push({ id: Date.now().toString(), name, text });
    document.getElementById('templateNameInput').value = '';
    document.getElementById('templateTextInput').value = '';
    saveTemplatesToFile();
}

window.deleteTemplate = function(id) {
    templates = templates.filter(t => t.id !== id);
    saveTemplatesToFile();
}

function renderTemplates() {
    const container = document.getElementById('templatesListContainer');
    if(!container) return;
    
    if(templates.length === 0) {
        container.innerHTML = `<p style="color:var(--text-secondary); font-style:italic;">You haven't saved any messages yet.</p>`;
        return;
    }
    
    container.innerHTML = '';
    templates.forEach(t => {
        const div = document.createElement('div');
        div.style.background = 'var(--panel-bg)';
        div.style.border = '1px solid var(--border-color)';
        div.style.padding = '1rem';
        div.style.borderRadius = '8px';
        div.innerHTML = `
            <div style="display:flex; justify-content:space-between; margin-bottom:0.5rem;">
                <strong style="color:var(--text-primary);">${escapeHtml(t.name)}</strong>
                <button class="delete-btn" onclick="deleteTemplate('${t.id}')">Remove</button>
            </div>
            <p style="color:var(--text-secondary); font-size:0.9rem; white-space:pre-wrap;">${escapeHtml(t.text)}</p>
        `;
        container.appendChild(div);
    });
}

// ================= CAMPAIGNS API =================
async function loadTemplatesForSelect() {
    try {
        const res = await fetch('/api/templates');
        templates = await res.json();
        const sel = document.getElementById('campaignTemplateSelect');
        if(!sel) return;
        sel.innerHTML = '<option value="">-- Pick one --</option>';
        templates.forEach(t => {
            const opt = document.createElement('option');
            opt.value = t.id;
            opt.innerText = t.name;
            sel.appendChild(opt);
        });
    } catch(e) {}
}

async function loadCampaigns() {
    try {
        const res = await fetch('/api/campaigns');
        campaigns = await res.json();
        renderCampaigns();
    } catch(e) { console.error(e); }
}

async function startCampaign() {
    const name = document.getElementById('campaignNameInput').value.trim();
    const templateId = document.getElementById('campaignTemplateSelect').value;
    const audienceStr = document.getElementById('campaignAudienceInput').value.trim();
    const delayMin = parseInt(document.getElementById('delayMinInput').value, 10);
    const delayMax = parseInt(document.getElementById('delayMaxInput').value, 10);
    
    if(!name || !templateId || !audienceStr) return alert("Please fill in all the details to start.");
    
    let audience = [];
    try {
        audience = JSON.parse(audienceStr);
        if(!Array.isArray(audience)) throw new Error("Must be array");
    } catch(e) {
        return alert("Your contact list format isn't quite right. Please check the example.");
    }
    
    const template = templates.find(t => t.id === templateId);
    
    const campaign = {
        id: Date.now().toString(),
        name,
        templateId,
        templateText: template.text,
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
        
        if (!res.ok) throw new Error("API Error");
        
        document.getElementById('campaignNameInput').value = '';
        document.getElementById('campaignAudienceInput').value = '';
        loadCampaigns();
        alert("Started! Your messages are sending.");
    } catch(e) {
        alert("Couldn't start. Please try again.");
    }
}

let campaignPollInterval = null;

function renderCampaigns() {
    const container = document.getElementById('campaignsListContainer');
    if(!container) return;
    
    if(campaigns.length === 0) {
        container.innerHTML = `<p style="color:var(--text-secondary); font-style:italic;">You haven't sent anything yet.</p>`;
        return;
    }
    
    container.innerHTML = '';
    let hasRunning = false;
    
    campaigns.forEach(c => {
        if (c.status === 'Running' || c.status === 'Pending') hasRunning = true;
        
        const div = document.createElement('div');
        div.style.background = 'var(--panel-bg)';
        div.style.border = '1px solid var(--border-color)';
        div.style.padding = '1rem';
        div.style.borderRadius = '8px';
        
        let statusColor = 'var(--text-secondary)';
        if(c.status === 'Running') statusColor = 'var(--accent-bright)';
        if(c.status === 'Completed') statusColor = 'var(--success)';
        
        div.innerHTML = `
            <div style="display:flex; justify-content:space-between; margin-bottom:0.5rem;">
                <strong style="color:var(--text-primary); font-size:1.1rem;">${escapeHtml(c.name)}</strong>
                <span style="color:${statusColor}; font-weight:600; font-size:0.85rem;">${c.status}</span>
            </div>
            <p style="font-size:0.9rem; color:var(--text-secondary); margin-bottom:0.5rem;">Started: ${new Date(c.startedAt).toLocaleString()}</p>
            <div style="display:flex; gap:1rem; font-size:0.85rem; background: rgba(0,0,0,0.2); padding: 0.5rem; border-radius: 4px;">
                <span style="color:var(--text-primary);">Total: <strong>${c.total || 0}</strong></span>
                <span style="color:var(--success);">Sent: <strong>${c.sent || 0}</strong></span>
                <span style="color:var(--danger);">Failed: <strong>${c.failed || 0}</strong></span>
            </div>
            ${c.status === 'Running' ? '<div style="margin-top: 0.5rem; font-size: 0.75rem; color: var(--accent-bright);">Updating...</div>' : ''}
        `;
        container.appendChild(div);
    });

    if (hasRunning && !campaignPollInterval) {
        campaignPollInterval = setInterval(loadCampaigns, 2000);
    } else if (!hasRunning && campaignPollInterval) {
        clearInterval(campaignPollInterval);
        campaignPollInterval = null;
    }
}

// Make globally available
window.removeSetting = removeSetting;
window.addSetting = addSetting;
window.toggleSetting = toggleSetting;
window.savePrompt = savePrompt;
window.saveInputSetting = saveInputSetting;
window.sendDraft = sendDraft;
window.rejectDraft = rejectDraft;
window.saveTemplate = saveTemplate;
window.startCampaign = startCampaign;
window.loadCampaigns = loadCampaigns;

// Initial Load
loadSettings();

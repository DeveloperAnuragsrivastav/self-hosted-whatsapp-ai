const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const { generateReply } = require('./brain');
const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, 'data', 'config.json');

function getConfig() {
    try {
        return JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } catch (e) {
        return { 
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
    }
}

let client;
let currentQr = null;
const pausedChats = new Map();
const memoryCache = new Map();

function isChatPaused(chatId, cooldownMinutes) {
    if (pausedChats.has(chatId)) {
        const pausedAt = pausedChats.get(chatId);
        const now = Date.now();
        const diffMinutes = (now - pausedAt) / (1000 * 60);
        if (diffMinutes >= cooldownMinutes) {
            pausedChats.delete(chatId);
            return false;
        }
        return true;
    }
    return false;
}

// Exported for API use
async function sendMessage(to, text) {
    if (client) {
        try {
            // Removing strict contact validation since WhatsApp Web's internal checks are currently flaky
            // and returning weird errors like 'r'. We will just attempt to send and catch standard errors.
            let chat;
            try {
                chat = await client.getChatById(to);
            } catch (err) {
                console.log(`[Anti-Ban] Could not load chat to show 'typing...' for ${to}. Continuing to send anyway.`);
            }
            if (chat) {
                try { await chat.sendStateTyping(); } catch(e) {}
                const delayMs = Math.min(1000 + (text.length * 50), 4000);
                await new Promise(resolve => setTimeout(resolve, delayMs));
            }
            lastGlobalBotSend = Date.now();
            await client.sendMessage(to, text);
        } catch (e) {
            throw e;
        }
    }
}

function initializeWhatsApp(io) {
    client = new Client({
        authStrategy: new LocalAuth({ dataPath: path.join(__dirname, 'data', '.wwebjs_auth') }),
        puppeteer: {
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
            executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || (process.platform === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : undefined)
        }
    });

    client.on('qr', async (qr) => {
        console.log('QR code received, please scan.');
        currentQr = await qrcode.toDataURL(qr);
        io.emit('qr', currentQr);
    });

    client.on('ready', () => {
        console.log('WhatsApp Client is ready!');
        currentQr = null;
        io.emit('ready', { status: 'Connected' });
    });

let lastGlobalBotSend = 0;

    client.on('message_create', async msg => {
        // Ignore old messages syncing on startup (older than 60 seconds)
        if (msg.timestamp && (Date.now() - (msg.timestamp * 1000) > 60000)) {
            return;
        }

        if (msg.fromMe) {
            const chatId = (msg.id && msg.id.remote) ? msg.id.remote : msg.to;
            
            if (msg.body) {
                let history = memoryCache.get(chatId) || [];
                history.push({ role: 'assistant', content: msg.body });
                if (history.length > 6) history = history.slice(history.length - 6);
                memoryCache.set(chatId, history);
            }

            // Ignore if bot sent ANY message in the last 5 seconds (prevents @lid internal echoes from triggering it)
            if (Date.now() - lastGlobalBotSend < 5000) {
                return;
            }
            const config = getConfig();
            pausedChats.set(chatId, Date.now());
            console.log(`Human intervention detected for ${chatId}. AI muted for ${config.handoverCooldownMinutes || 60} minutes.`);
        }
    });

    client.on('message', async msg => {
        if (msg.fromMe) return;

        const config = getConfig();
        const fromNumber = msg.from.split('@')[0];
        const chatId = msg.from;

        if (isChatPaused(chatId, config.handoverCooldownMinutes || 60)) {
            console.log(`Skipping message from ${chatId}: Human takeover cooldown active.`);
            return;
        }

        if (config.doNotReply && config.doNotReply.includes(fromNumber)) {
            console.log(`Skipping blacklisted number: ${fromNumber}`);
            return;
        }

        if (config.replyTo && config.replyTo.length > 0 && !config.replyTo.includes(fromNumber)) {
            console.log(`Skipping number ${fromNumber}, not in whitelist.`);
            return;
        }

        if (msg.isGroupMsg && !config.replyToGroups) {
            console.log('Skipping group message based on settings.');
            return;
        }

        if (msg.hasMedia && config.ignoreMedia) {
            console.log('Skipping media message based on settings.');
            return;
        }

        if (msg.body) {
            const msgText = msg.body.toLowerCase();
            
            if (config.emergencyKeywords && config.emergencyKeywords.length > 0) {
                for (const keyword of config.emergencyKeywords) {
                    if (keyword && msgText.includes(keyword.toLowerCase())) {
                        console.log(`EMERGENCY KEYWORD DETECTED: ${keyword}. Staying silent.`);
                        return;
                    }
                }
            }

            if (config.skipKeywords && config.skipKeywords.length > 0) {
                for (const keyword of config.skipKeywords) {
                    if (keyword && msgText.includes(keyword.toLowerCase())) {
                        console.log(`Skipping message due to keyword match: ${keyword}`);
                        return;
                    }
                }
            }
        }

        if (!msg.body) return;

        console.log(`Generating AI reply for ${fromNumber}...`);
        
        // 1. Context Memory (In-Memory Fast Cache)
        let conversationHistory = memoryCache.get(chatId) || [];
        conversationHistory.push({ role: 'user', content: msg.body });
        if (conversationHistory.length > 6) {
            conversationHistory = conversationHistory.slice(conversationHistory.length - 6);
        }
        memoryCache.set(chatId, conversationHistory);

        // Fetch chat just for the "Typing..." indicator (ignore if it fails for @lid accounts)
        let chat = null;
        try {
            chat = await msg.getChat();
        } catch(e) {
            // Fallback for @lid incoming messages: fetch real number from Contact
            try {
                const contact = await msg.getContact();
                if (contact && contact.number) {
                    chat = await client.getChatById(`${contact.number}@c.us`);
                }
            } catch (err) {}
        }
        // Final fallback just in case
        if (!chat) {
            try { chat = await client.getChatById(`${fromNumber}@c.us`); } catch(e) {}
        }

        // START TYPING IMMEDIATELY WHILE AI THINKS!
        try {
            if (chat) {
                console.log(`[Debug] Triggering 'Typing...' for ${fromNumber}...`);
                await chat.sendStateTyping();
            } else {
                console.log(`[Debug] Cannot show 'Typing...'. WhatsApp Web returned null chat for internal ID: ${fromNumber}`);
            }
        } catch(e) {
            console.log(`[Debug] sendStateTyping failed: ${e.message}`);
        }

        const aiResponse = await generateReply(msg.body, config.systemPrompt, conversationHistory);
        
        if (aiResponse) {
            // 2. Draft Mode logic
            if (config.draftMode) {
                console.log(`Draft Mode Enabled. Sending reply to Dashboard for approval.`);
                let contactName = fromNumber;
                try {
                    const contact = await msg.getContact();
                    contactName = contact.name || contact.pushname || fromNumber;
                } catch(e) {}
                
                io.emit('draft_reply', {
                    id: msg.id._serialized,
                    to: msg.from,
                    fromName: contactName,
                    originalMessage: msg.body,
                    replyText: aiResponse
                });
                return;
            }

            // Optional: send typing again to keep it alive during the delay
            try {
                if (chat) await chat.sendStateTyping();
            } catch(e) {}
            
            const delayMs = Math.min(1000 + (aiResponse.length * 50), 4000);
            setTimeout(() => {
                // Check if user intervened manually while the AI was generating this reply!
                if (isChatPaused(chatId, config.handoverCooldownMinutes || 60)) {
                    console.log(`[Race Condition Avoided] User started typing manually. Aborting AI reply to ${chatId}.`);
                    return;
                }

                lastGlobalBotSend = Date.now();
                msg.reply(aiResponse).then(() => {
                    let history = memoryCache.get(chatId) || [];
                    history.push({ role: 'assistant', content: aiResponse });
                    if (history.length > 6) history = history.slice(history.length - 6);
                    memoryCache.set(chatId, history);
                }).catch(err => console.error("Failed to send reply:", err));
            }, delayMs);
        }
    });

    client.initialize();

    io.on('connection', (socket) => {
        if (currentQr) {
            socket.emit('qr', currentQr);
        }
        if (client && client.info) {
             socket.emit('ready', { status: 'Connected' });
        }
    });
}

function getClient() {
    return client;
}

module.exports = { initializeWhatsApp, sendMessage, getClient };

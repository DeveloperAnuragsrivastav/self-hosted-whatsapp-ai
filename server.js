const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

// 1. Fail-Fast Environment Variables
if (!process.env.GROQ_API_KEY) {
    console.error('FATAL ERROR: GROQ_API_KEY is missing in .env file.');
    console.error('Please add GROQ_API_KEY to your .env file and restart the server.');
    process.exit(1);
}

const { initializeWhatsApp, getClient } = require('./whatsapp');
const { getCampaigns, saveCampaigns, startCampaign } = require('./campaigns');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());

// Basic Authentication Middleware to protect the dashboard
app.use((req, res, next) => {
    const authheader = req.headers.authorization;
    const user = process.env.DASHBOARD_USER || 'admin';
    const pass = process.env.DASHBOARD_PASS || 'admin';

    if (!authheader) {
        res.setHeader('WWW-Authenticate', 'Basic');
        return res.status(401).send('Authentication required');
    }

    const auth = Buffer.from(authheader.split(' ')[1], 'base64').toString().split(':');
    const reqUser = auth[0];
    const reqPass = auth[1];

    if (reqUser === user && reqPass === pass) {
        next();
    } else {
        res.setHeader('WWW-Authenticate', 'Basic');
        return res.status(401).send('Invalid credentials');
    }
});

app.use(express.static(path.join(__dirname, 'public')));

const configPath = path.join(__dirname, 'data', 'config.json');

// Helper to get settings
function getSettings() {
    const defaultConfig = {
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

    if (!fs.existsSync(configPath)) {
        fs.mkdirSync(path.join(__dirname, 'data'), { recursive: true });
        fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
    }
    
    try {
        const currentConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        return { ...defaultConfig, ...currentConfig };
    } catch(e) {
        return defaultConfig;
    }
}

// API Endpoints
app.get('/api/settings', (req, res) => {
    try {
        res.json(getSettings());
    } catch (error) {
        res.status(500).json({ error: 'Failed to read settings' });
    }
});

app.post('/api/settings', (req, res) => {
    // 3. Backend Input Validation
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
        return res.status(400).json({ error: 'Invalid settings payload. Must be a JSON object.' });
    }
    try {
        fs.writeFileSync(configPath, JSON.stringify(req.body, null, 2));
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to save settings' });
    }
});

// Templates API
const templatesPath = path.join(__dirname, 'data', 'templates.json');
app.get('/api/templates', (req, res) => {
    try {
        if (!fs.existsSync(templatesPath)) return res.json([]);
        res.json(JSON.parse(fs.readFileSync(templatesPath, 'utf8')));
    } catch (error) {
        res.status(500).json({ error: 'Failed to read templates' });
    }
});
app.post('/api/templates', (req, res) => {
    if (!Array.isArray(req.body)) {
        return res.status(400).json({ error: 'Invalid templates payload. Must be a JSON array.' });
    }
    try {
        fs.writeFileSync(templatesPath, JSON.stringify(req.body, null, 2));
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to save templates' });
    }
});

// Campaigns API
app.get('/api/campaigns', (req, res) => {
    res.json(getCampaigns());
});
app.post('/api/campaigns', (req, res) => {
    const campaign = req.body;
    if (!campaign || typeof campaign !== 'object' || !campaign.name || !campaign.templateId || !Array.isArray(campaign.audience)) {
        return res.status(400).json({ error: 'Invalid campaign payload. Missing name, templateId, or audience array.' });
    }
    try {
        startCampaign(campaign);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to start campaign' });
    }
});

app.post('/api/send', async (req, res) => {
    const { to, text } = req.body;
    if (!to || typeof text !== 'string') {
        return res.status(400).json({ error: 'Invalid payload. Missing to or text.' });
    }
    try {
        const { sendMessage } = require('./whatsapp');
        await sendMessage(to, text);
        res.json({ success: true });
    } catch (error) {
        console.error("Failed to send approved draft:", error);
        res.status(500).json({ error: 'Failed to send message' });
    }
});

// Initialize WhatsApp logic
initializeWhatsApp(io);

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`WhatsApp AI Bot Dashboard running on http://0.0.0.0:${PORT}`);
});

// 2. Graceful Shutdown (SIGTERM / SIGINT)
async function gracefulShutdown(signal) {
    console.log(`\nReceived ${signal}. Shutting down gracefully...`);
    
    server.close(() => {
        console.log('HTTP server closed.');
    });

    const client = getClient();
    if (client) {
        console.log('Destroying WhatsApp client safely...');
        try {
            await client.destroy();
            console.log('WhatsApp client destroyed.');
        } catch (e) {
            console.error('Error destroying WhatsApp client:', e);
        }
    }
    
    process.exit(0);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

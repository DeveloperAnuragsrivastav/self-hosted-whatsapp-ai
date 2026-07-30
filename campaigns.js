const fs = require('fs');
const path = require('path');
const { sendMessage } = require('./whatsapp');
const { parseSpintax, gaussianRandom } = require('./utils/antiBan');

const campaignsPath = path.join(__dirname, 'data', 'campaigns.json');
const configPath = path.join(__dirname, 'data', 'config.json');

function getConfig() {
    try {
        return JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } catch (e) {
        return {};
    }
}

function getCampaigns() {
    try {
        if (!fs.existsSync(campaignsPath)) {
            fs.mkdirSync(path.join(__dirname, 'data'), { recursive: true });
            fs.writeFileSync(campaignsPath, JSON.stringify([]));
            return [];
        }
        return JSON.parse(fs.readFileSync(campaignsPath, 'utf8'));
    } catch (e) {
        return [];
    }
}

function saveCampaigns(campaigns) {
    fs.mkdirSync(path.join(__dirname, 'data'), { recursive: true });
    fs.writeFileSync(campaignsPath, JSON.stringify(campaigns, null, 2));
}

const delay = ms => new Promise(res => setTimeout(res, ms));

async function startCampaign(campaign) {
    campaign.status = 'Running';
    campaign.sent = 0;
    campaign.failed = 0;
    campaign.total = campaign.audience.length;
    campaign.startedAt = new Date().toISOString();
    
    let allCampaigns = getCampaigns();
    allCampaigns.unshift(campaign);
    saveCampaigns(allCampaigns);

    // Run asynchronously in the background
    (async () => {
        for (let i = 0; i < campaign.audience.length; i++) {
            const config = getConfig();
            const contact = campaign.audience[i];
            
            // Anti-Ban: Apply Spintax first to randomize message structure
            let msgText = parseSpintax(campaign.templateText);
            
            // Format message variables (e.g. {{name}})
            for (const [key, value] of Object.entries(contact)) {
                const regex = new RegExp(`{{${key}}}`, 'g');
                msgText = msgText.replace(regex, value);
            }

            let targetNumber = contact.number.replace(/\D/g, '');
            const cleanNumber = targetNumber;

            if (config.doNotReply && config.doNotReply.includes(cleanNumber)) {
                console.log(`[Anti-Ban] Skipping ${cleanNumber} - user is blacklisted.`);
                campaign.failed++; // Track as failed/skipped
            } else {
                if (!targetNumber.endsWith('@c.us')) {
                    targetNumber += '@c.us';
                }

                console.log(`[Campaign] Sending message to ${targetNumber}...`);
                try {
                    await sendMessage(targetNumber, msgText);
                    campaign.sent++;
                } catch (e) {
                    console.error(`[Campaign] Failed to send to ${targetNumber}:`, e.message || e);
                    campaign.failed++;
                    
                    // ANTI-BAN: Abort if things look suspicious
                    if (campaign.failed >= 3 && (campaign.failed / (campaign.sent + campaign.failed)) > 0.3) {
                        console.error("[CRITICAL] High failure rate detected. WhatsApp may be soft-banning. Aborting campaign immediately to protect number.");
                        campaign.status = 'Aborted - High Failure Rate';
                        
                        allCampaigns = getCampaigns();
                        const index = allCampaigns.findIndex(c => c.id === campaign.id);
                        if (index !== -1) {
                            allCampaigns[index] = campaign;
                            saveCampaigns(allCampaigns);
                        }
                        return; // Exit function completely
                    }
                }
            }

            // Sync progress to file
            allCampaigns = getCampaigns();
            const index = allCampaigns.findIndex(c => c.id === campaign.id);
            if (index !== -1 && campaign.status !== 'Aborted - High Failure Rate') {
                allCampaigns[index] = campaign;
                saveCampaigns(allCampaigns);
            }

            // Throttling: Random delay between sends
            if (i < campaign.audience.length - 1 && campaign.status === 'Running') {
                const delayMin = campaign.delayMin || 5;
                const delayMax = campaign.delayMax || 15;
                const waitTime = gaussianRandom(delayMin * 1000, delayMax * 1000);
                console.log(`[Campaign] Waiting ${waitTime / 1000} seconds before next message...`);
                await delay(waitTime);
            }
        }

        if (campaign.status === 'Running') {
            campaign.status = 'Completed';
            campaign.completedAt = new Date().toISOString();
            
            allCampaigns = getCampaigns();
            const index = allCampaigns.findIndex(c => c.id === campaign.id);
            if (index !== -1) {
                allCampaigns[index] = campaign;
                saveCampaigns(allCampaigns);
            }
            console.log(`[Campaign] ${campaign.name} Completed.`);
        }
    })();
}

module.exports = { getCampaigns, saveCampaigns, startCampaign };

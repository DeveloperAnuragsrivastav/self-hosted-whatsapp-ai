<div align="center">
  <!-- Dashboard Screenshot -->
  <img src="https://github.com/user-attachments/assets/cc6510a2-a788-45be-8db9-8ce667f3ba46" alt="WhatsApp AI Agent Dashboard" width="850" style="border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); margin-bottom: 25px;"/>
  
  <h1 style="font-size: 2.5em; font-weight: 800;">🚀 Self-Hosted WhatsApp AI Agent</h1>
  <p style="font-size: 1.2em; color: #888;">
    An insanely fast, completely open-source WhatsApp AI Assistant powered by Groq & Node.js.<br>
    Built with 🖤 by <b><a href="https://github.com/DeveloperAnuragsrivastav">Anurag Srivastav</a></b>
  </p>

  <p align="center">
    <a href="https://github.com/DeveloperAnuragsrivastav/self-hosted-whatsapp-ai/stargazers">
      <img src="https://img.shields.io/github/stars/DeveloperAnuragsrivastav/self-hosted-whatsapp-ai?style=for-the-badge&color=ffd700&logo=starship" alt="Stars"/>
    </a>
    <a href="https://github.com/DeveloperAnuragsrivastav/self-hosted-whatsapp-ai/network/members">
      <img src="https://img.shields.io/github/forks/DeveloperAnuragsrivastav/self-hosted-whatsapp-ai?style=for-the-badge&color=007ec6&logo=github" alt="Forks"/>
    </a>
    <a href="https://github.com/DeveloperAnuragsrivastav/self-hosted-whatsapp-ai/issues">
      <img src="https://img.shields.io/github/issues/DeveloperAnuragsrivastav/self-hosted-whatsapp-ai?style=for-the-badge&color=e53e3e&logo=github" alt="Issues"/>
    </a>
    <a href="https://github.com/DeveloperAnuragsrivastav/self-hosted-whatsapp-ai/blob/main/LICENSE">
      <img src="https://img.shields.io/github/license/DeveloperAnuragsrivastav/self-hosted-whatsapp-ai?style=for-the-badge&color=10b981&logo=open-source-initiative" alt="License"/>
    </a>
  </p>
</div>

<br/>

> 💡 **Why I built this:** Existing WhatsApp bots are either paid, painfully slow, or hard to set up. I engineered this from the ground up to be a plug-and-play powerhouse using Groq's insanely fast LLM API. It runs autonomously in the background while giving you a gorgeous web dashboard to manage everything in real-time. — *Anurag Srivastav*

---

## ⚡ The Ultimate Feature Stack

- **🧠 Groq AI Core**: Powered by LLaMA-3 via Groq for sub-second, highly intelligent responses.
- **✋ Autonomous Human Takeover**: If you grab your phone and reply manually, the AI instantly detects it and pauses itself so it doesn't fight you in the chat.
- **🛡️ Bulletproof Guardrails**: Configure global Blacklists, Whitelists, "Stop Words", and emergency keywords right from the UI.
- **📝 Draft Mode (Review Queue)**: Don't trust the AI yet? Turn on Draft Mode and the AI will hold its generated replies in a queue for your manual approval before sending.
- **🚀 Bulk Campaigns**: Send broadcast messages to multiple contacts simultaneously with natural human-like delays to prevent WhatsApp bans.
- **💻 Stunning Dashboard**: A self-hosted, beautifully designed glassmorphism dashboard (Dark/Light mode) to control the entire engine visually.

---

## 🚀 Running Locally (Mac / Windows / Linux)

### Prerequisites
- [Node.js](https://nodejs.org/en/) (v18+ recommended)
- A [Groq API Key](https://console.groq.com/keys) (Free & Lightning Fast!)
- Google Chrome installed on your machine.

### Zero-to-Live Installation
1. **Clone the repository:**
   ```bash
   git clone https://github.com/DeveloperAnuragsrivastav/self-hosted-whatsapp-ai.git
   cd self-hosted-whatsapp-ai
   ```

2. **Install the engine:**
   ```bash
   npm install
   ```

3. **Configure your keys:**
   ```bash
   cp .env.example .env
   ```
   *Edit `.env` and paste your `GROQ_API_KEY`.*

4. **Ignite the server:**
   ```bash
   npm run start
   ```

5. **Connect your WhatsApp:** Open `http://localhost:3000` in your browser. Scan the massive QR code using the "Linked Devices" feature inside your WhatsApp app.

---

## ☁️ Deploying to Railway (Cloud PaaS)

This project is fully Dockerized and heavily optimized for 1-click deployment on [Railway](https://railway.app/).

1. Fork or push this code to your own GitHub.
2. In Railway, click **New Project** -> **Deploy from GitHub repo**.
3. Under the **Variables** tab, add your `GROQ_API_KEY`.
4. 💾 **CRITICAL STEP:** Go to the **Volumes** tab and create a Persistent Volume mounted at:
   `/app/data`
   *(This ensures you stay logged into WhatsApp even if Railway restarts the server!)*
5. Go to the **Settings** tab -> **Networking** -> **Generate Domain**.
6. Visit your brand new public domain, scan the QR code, and you have an AI agent running 24/7 in the cloud!

---

## 🧬 Architecture

- `server.js`: Express web server and REST APIs.
- `whatsapp.js`: Complex WhatsApp Web Socket management and typing simulation.
- `brain.js`: The neural core interacting with Groq SDK.
- `campaigns.js`: Background asynchronous worker for bulk messaging.
- `public/`: The raw HTML/CSS/JS for the frontend UI.
- `data/`: *(Ignored by Git)* Persistent encrypted storage for session auth, config, and logs.

---

## 🤝 Support the Project

If you love what I built, **give this repo a ⭐️ Star** at the top right of the page! It helps me keep building awesome open-source tools for the community.

**Created by [Anurag Srivastav](https://github.com/DeveloperAnuragsrivastav)** 🚀

## 📜 License
This project is [MIT](LICENSE) licensed. Feel free to fork it, modify it, and build empires with it!

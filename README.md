<div align="center">
  <!-- When you upload your screenshot to GitHub, replace this image or ensure your screenshot is named 'screenshot.png' in the repo -->
  <img src="https://github.com/user-attachments/assets/cc6510a2-a788-45be-8db9-8ce667f3ba46" alt="WhatsApp AI Assistant Dashboard" width="800" style="border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.2); margin-bottom: 20px;"/>
 

  <h1>WhatsApp AI Assistant</h1>
  <p>A fully self-hosted, open-source WhatsApp AI assistant with a beautiful glassmorphism dashboard.</p>
</div>

---

## 🌟 Features

- **🧠 Intelligent Auto-Replies**: Uses Groq AI to process messages and generate lightning-fast intelligent responses.
- **✋ Human Takeover & Pause**: Automatically detects when you manually reply to a contact and pauses the AI for a customizable cooldown period.
- **🛡️ Safety Guardrails**: Set specific "Stop Words", emergency keywords, or strict Whitelists/Blacklists directly from the UI.
- **📝 Review Queue (Draft Mode)**: Generate AI replies but hold them in a draft queue for your manual approval before sending.
- **🚀 Send to Many (Campaigns)**: Send saved templates to multiple contacts automatically. Includes anti-ban features like natural random delays and failure thresholds.
- **💻 Self-Hosted Web Dashboard**: Manage your WhatsApp connection, view live stats, change AI prompts on the fly, and send campaigns—all from a sleek, dark/light mode UI.

---

## 🚀 Running Locally (Mac / Windows / Linux)

### Prerequisites
- [Node.js](https://nodejs.org/en/) (v18+ recommended)
- A [Groq API Key](https://console.groq.com/keys) (It's free!)
- Google Chrome (or Chromium) installed on your machine.

### Installation
1. **Clone the repository:**
   ```bash
   git clone https://github.com/YourUsername/whatsapp-ai-bot.git
   cd whatsapp-ai-bot
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Setup environment variables:**
   ```bash
   cp .env.example .env
   ```
   *Edit `.env` and paste your `GROQ_API_KEY`.*

4. **Start the server:**
   ```bash
   npm run start
   # or
   node server.js
   ```

5. **Connect WhatsApp:** Open `http://localhost:3000` in your browser. Scan the QR code using the "Linked Devices" feature inside your WhatsApp mobile app.

---

## ☁️ Deploying to Railway (Cloud PaaS)

This project is 100% Docker-ready and optimized for instant deployment on [Railway](https://railway.app/).

1. Push your code to a GitHub repository.
2. In Railway, click **New Project** -> **Deploy from GitHub repo**.
3. Add your `GROQ_API_KEY` in the **Variables** tab on Railway.
4. Go to the **Volumes** tab and create a Persistent Volume mounted at:
   `/app/data`
   *(This prevents you from having to scan the QR code every time Railway restarts!)*
5. Go to the **Settings** tab -> **Networking** -> **Generate Domain**.
6. Visit your live domain, scan the QR code, and you are fully live!

---

## 📁 Project Structure

- `server.js`: Express web server and REST API endpoints.
- `whatsapp.js`: WhatsApp Web Socket logic, session management, and typing indicators.
- `brain.js`: AI logic processing via Groq SDK.
- `campaigns.js`: Background task runner for bulk messaging campaigns.
- `public/`: The HTML/CSS/JS for the frontend web dashboard.
- `data/`: *(Generated)* Persistent storage for settings, session auth, templates, and campaign logs.

---

## 🤝 Contributing
Contributions, issues, and feature requests are welcome! Feel free to check the [issues page](https://github.com/YourUsername/whatsapp-ai-bot/issues).

## 🛡️ License
This project is [MIT](LICENSE) licensed.

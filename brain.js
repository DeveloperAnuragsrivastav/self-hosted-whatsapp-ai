const Groq = require('groq-sdk');
require('dotenv').config();

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

async function generateReply(messageContent, systemPrompt, conversationHistory = []) {
    if (!process.env.GROQ_API_KEY) {
        console.warn("Groq API Key not found. Please set GROQ_API_KEY in .env");
        return null;
    }
    
    try {
        const messages = [
            {
                role: "system",
                content: (systemPrompt || "You are a helpful, concise WhatsApp assistant.") + "\n\n[CRITICAL SYSTEM INSTRUCTION: If your instructions dictate that you should 'ignore completely', 'stay silent', 'do not reply', or if the message falls into a category that requires no response, you MUST output ONLY the exact word: IGNORE]"
            }
        ];

        // Append past history for Context Memory
        for (const msg of conversationHistory) {
            messages.push({
                role: msg.role,
                content: msg.content
            });
        }
        
        // Append current message
        messages.push({
            role: "user",
            content: messageContent
        });

        const chatCompletion = await groq.chat.completions.create({
            messages: messages,
            model: "llama-3.1-8b-instant",
            temperature: 0.5,
            max_tokens: 300,
            top_p: 1,
        });
        
        const reply = chatCompletion.choices[0]?.message?.content;
        
        if (reply && reply.trim().toUpperCase() === "IGNORE") {
            return null;
        }
        
        return reply || "Sorry, I couldn't process that request.";
    } catch (error) {
        console.error("Error from Groq API:", error);
        return null;
    }
}

module.exports = { generateReply };

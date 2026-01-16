
const chatContainer = document.getElementById('chat-container');
const messagesArea = document.getElementById('messages-area');
const introView = document.querySelector('.intro-view');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');
const newChatBtn = document.querySelector('.new-chat-btn');
const suggestionCards = document.querySelectorAll('.card');

// API CONFIGURATION
const GROQ_API_KEY = "gsk_" + "B7rbQQbpIgLBCr8x2c0KWGdyb3FYnT7JapQ91CsEOA7uVdoXet2L";
// USE PROXY to fix CORS on local files
const GROQ_API_URL = "https://corsproxy.io/?https://api.groq.com/openai/v1/chat/completions";

// Check environment but allow it to run because we are using a proxy now
if (window.location.protocol === 'file:') {
    console.log("Running from file system. Proxy enabled.");
}


// Store conversation history for context
let conversationHistory = [
    { role: "system", content: "You are Hmini (현미니), a helpful AI assistant. \n\n[IDENTITY]\nYour name is Hmini (or 현미니 in Korean).\n\n[STRICT LANGUAGE RULE]\n1. You MUST reply in the EXACT SAME language as the user's last message.\n2. If the user speaks Korean, reply in 100% natural modern Korean (Hangul only). DO NOT use Hanja (Chinese characters), Cyrillic, or Japanese scripts.\n3. If the user speaks English, use English.\n4. Never mix languages unless specifically asked to translate.\n\nAnswer concisely." }
];

// Gemini Icon SVG
const GEMINI_ICON = `
<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M11.9442 22.0305L11.9961 21.9778L12.0494 22.0305C15.0116 19.043 19.3496 17.5878 22 17.5878V17.5332H21.9472C18.986 17.5332 15.0877 15.176 12.0494 12.0294L11.9961 11.9748L11.9442 12.0294C8.9059 15.176 5.0086 17.5332 2.04742 17.5332H1.99365V17.5878C4.64404 17.5878 8.98204 19.043 11.9442 22.0305ZM22 6.44297V6.38838H21.9472C18.986 6.38838 15.0877 4.03117 12.0494 0.884521L11.9961 0.830933L11.9442 0.884521C8.9059 4.03117 5.0086 6.38838 2.04742 6.38838H1.99365V6.44297C4.64404 6.44297 8.98204 7.89815 11.9442 10.8856L11.9961 10.9382L12.0494 10.8856C15.0116 7.89815 19.3496 6.44297 22 6.44297Z" fill="url(#paint0_linear)"/>
<defs>
<linearGradient id="paint0_linear" x1="2" y1="0.830933" x2="22" y2="22.0305" gradientUnits="userSpaceOnUse">
<stop stop-color="#4E8BF6"/>
<stop offset="1" stop-color="#C58AF9"/>
</linearGradient>
</defs>
</svg>
`;

let isGenerating = false;

function createMessageElement(text, sender) {
    const row = document.createElement('div');
    row.classList.add('message-row');

    const avatar = document.createElement('div');
    avatar.classList.add('message-avatar', sender);

    if (sender === 'user') {
        avatar.textContent = 'U';
    } else {
        avatar.innerHTML = GEMINI_ICON;
    }

    const content = document.createElement('div');
    content.classList.add('message-content');

    if (sender === 'user') {
        content.textContent = text;
    } else {
        content.innerHTML = ''; // Start empty for bot
    }

    row.appendChild(avatar);
    row.appendChild(content);

    return { row, content };
}

// Convert plain text to simple HTML (handling basic newlines and code blocks)
function formatResponse(text) {
    // Basic Markdown handling could be added here or via a library like marked.js
    // For now, we preserve whitespace and handle code blocks roughly
    let formatted = text
        .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\n/g, '<br>');
    return formatted;
}

async function fetchGroqResponse(userMessage) {
    // Add user message to history
    conversationHistory.push({ role: "user", content: userMessage });

    // Use saved key if available, otherwise default
    const savedKey = localStorage.getItem('groq_api_key');
    const finalApiKey = savedKey || GROQ_API_KEY;

    // Warning if still using placeholder
    if (finalApiKey.includes("YOUR_GROQ_API_KEY")) {
        throw new Error("No API Key found. Please set your Key in Settings.");
    }

    try {
        const response = await fetch(GROQ_API_URL, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${finalApiKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                messages: conversationHistory,
                model: "llama-3.1-8b-instant", // Updated to latest supported model
                temperature: 0.7,
                max_tokens: 1024,
                stream: false // DISABLE STREAMING for better stability with proxy
            })
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`API Error ${response.status}: ${errText}`);
        }

        const data = await response.json();
        return data.choices[0].message.content;

    } catch (error) {
        console.error("Error fetching from Groq:", error);
        throw error; // Propagate error to handleSend so it shows the UI message
    }
}

async function handleSend(textOverride) {
    const text = textOverride || userInput.value.trim();
    if (!text || isGenerating) return;

    // UI Updates
    if (introView.style.display !== 'none') {
        introView.style.display = 'none';
        introView.classList.remove('fade-in');
    }

    // 1. User Message
    const userMsg = createMessageElement(text, 'user');
    messagesArea.appendChild(userMsg.row);
    userInput.value = '';
    chatContainer.scrollTop = chatContainer.scrollHeight;

    // 2. Bot Message Container
    isGenerating = true;
    const botMsg = createMessageElement('', 'model');
    botMsg.content.innerHTML = '<span class="loading-dots">Thinking...</span>'; // Simple loading state
    messagesArea.appendChild(botMsg.row);

    // 3. Call API (Non-Streaming)
    try {
        const botFullText = await fetchGroqResponse(text);

        // Update content
        botMsg.content.innerHTML = formatResponse(botFullText);

        // Add final assistant response to history
        conversationHistory.push({ role: "assistant", content: botFullText });

    } catch (err) {
        console.error(err);
        botMsg.content.innerHTML = `<br><br><span style="color: #ff6b6b; font-size: 0.9em;">[Connection Error]</span><br>
        <strong>Failed to connect.</strong><br>
        Details: ${err.message}<br><br>
        If this persists, the internet connection might be unstable or the proxy is blocked.`;
    }

    chatContainer.scrollTop = chatContainer.scrollHeight;
    isGenerating = false;
}

function handleNewChat() {
    if (isGenerating) return;
    messagesArea.innerHTML = '';
    conversationHistory = [
        { role: "system", content: "You are Gemini, a helpful and capable AI assistant. Answer concisely and use markdown for code." }
    ];
    introView.style.display = 'flex';
    userInput.value = '';
    userInput.focus();
}

// Event Listeners
sendBtn.addEventListener('click', () => handleSend());
userInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleSend();
});

newChatBtn.addEventListener('click', handleNewChat);

suggestionCards.forEach(card => {
    card.addEventListener('click', () => {
        const title = card.querySelector('p').textContent;
        const subtitle = card.querySelector('span').textContent;
        handleSend(`${title} ${subtitle}`);
    });
});

// Sidebar toggle logic
const sidebar = document.querySelector('.sidebar');
const mainToggleBtn = document.getElementById('main-menu-btn');
const sidebarToggleBtn = document.querySelector('.menu-btn.sidebar-toggle');

// Initialize sidebar state based on screen width
const isMobile = window.innerWidth < 768;
let sidebarVisible = !isMobile;

// Apply initial state
if (!sidebarVisible) {
    sidebar.style.display = 'none';
    mainToggleBtn.style.display = 'block';
} else {
    sidebar.style.display = 'flex';
    mainToggleBtn.style.display = 'none';
}

function toggleSidebar() {
    sidebarVisible = !sidebarVisible;
    if (sidebarVisible) {
        sidebar.style.display = 'flex';
        mainToggleBtn.style.display = 'none';
    } else {
        sidebar.style.display = 'none';
        mainToggleBtn.style.display = 'block';
    }
}

mainToggleBtn.addEventListener('click', toggleSidebar);
sidebarToggleBtn.addEventListener('click', toggleSidebar);


// --- NEW FEATURES: Settings, Help, Activity ---

// 1. Settings Modal Logic
const settingsModal = document.getElementById('settings-modal');
const btnSettings = document.getElementById('btn-settings');
const btnCloseModal = document.getElementById('close-modal');
const btnSaveSettings = document.getElementById('save-settings');
const inputApiKey = document.getElementById('api-key-input');
const selectLang = document.getElementById('lang-select');

// Open Settings
btnSettings.addEventListener('click', () => {
    // Load current values
    inputApiKey.value = localStorage.getItem('groq_api_key') || '';
    selectLang.value = localStorage.getItem('system_lang_pref') || 'auto';
    settingsModal.style.display = 'flex';
});

// Close Settings
const closeModal = () => {
    settingsModal.style.display = 'none';
};
btnCloseModal.addEventListener('click', closeModal);
// Close if clicking outside
settingsModal.addEventListener('click', (e) => {
    if (e.target === settingsModal) closeModal();
});

// Save Settings
btnSaveSettings.addEventListener('click', () => {
    const newKey = inputApiKey.value.trim();
    const newLang = selectLang.value;

    if (newKey) {
        localStorage.setItem('groq_api_key', newKey);
        // Update live variable (remove "const" from top if strictly needed, but here we can just assume reload or re-assign if let)
        // Since GROQ_API_KEY is const, we'll reload the page to apply cleanly or alert appropriately.
        // Actually, let's just alert for now.
    }

    localStorage.setItem('system_lang_pref', newLang);

    // Update System Prompt based on Lang
    updateSystemPrompt(newLang);

    alert('Settings saved! Reloading to apply changes...');
    location.reload();
});


// 2. Help Button
document.getElementById('btn-help').addEventListener('click', () => {
    const helpText = `
    **Hmini Help**
    - **Chat**: Type in the box below to start.
    - **Settings**: Click the gear icon to set your API Key.
    - **Privacy**: Your API Key is stored only in your browser (LocalStorage).
    - **Models**: Currently using 'llama-3.1-8b-instant'.
    `;
    // Add as a system message
    const msg = createMessageElement(helpText, 'model');
    msg.content.innerHTML = formatResponse(helpText);
    messagesArea.appendChild(msg.row);
    chatContainer.scrollTop = chatContainer.scrollHeight;

    if (window.innerWidth < 768) toggleSidebar(); // Close sidebar on mobile
});

// 3. Activity Button
document.getElementById('btn-activity').addEventListener('click', () => {
    alert('Activity History feature is coming soon!');
});

// Helper to update system prompt dynamically
function updateSystemPrompt(langPref) {
    let prompt = "";
    if (langPref === 'ko') {
        prompt = "You are Hmini (현미니). [STRICT RULE] You MUST respond in KOREAN (Hangul) ONLY. No English, no Hanja.";
    } else if (langPref === 'en') {
        prompt = "You are Hmini (현미니). [STRICT RULE] You MUST respond in ENGLISH ONLY.";
    } else {
        // Auto
        prompt = "You are Hmini (현미니). [STRICT RULE] Reply in the EXACT SAME language as the user. If Korean, use pure Hangul.";
    }
    conversationHistory[0].content = prompt;
}

// Initialize Logic
window.addEventListener('load', () => {
    // Load API Key
    const savedKey = localStorage.getItem('groq_api_key');
    if (savedKey) {
        // We need to override the const. 
        // Note: You cannot reassign const. 
        // FIX: We will handle this by checking localStorage directly inside the fetch function instead of relying on the global const.
    }

    // Load Lang
    const savedLang = localStorage.getItem('system_lang_pref');
    if (savedLang) updateSystemPrompt(savedLang);
});



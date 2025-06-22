const API_CONFIG = {
    baseURL: 'http://localhost:3000',
    endpoints: {
        chat: '/api/chat',
        metrics: '/api/metrics',
        clearSession: '/api/chat'
    }
};

let chatHistory = [];
let currentSessionId = generateSessionId();
let currentImageData = null;
let currentImageFile = null;

document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

function initializeApp() {
    loadMetrics();
    
    setupEventListeners();
    
    setInterval(loadMetrics, 30 * 1000);
}

function setupEventListeners() {
    const messageInput = document.getElementById('messageInput');
    
    messageInput.addEventListener('keypress', handleKeyPress);
    
    messageInput.focus();
}

function generateSessionId() {
    return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

function handleKeyPress(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
    }
}

function addQuickPrompt(prompt) {
    const messageInput = document.getElementById('messageInput');
    messageInput.value = prompt;
    messageInput.focus();
}

function previewImage(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    currentImageFile = file;
    
    const previewArea = document.getElementById('imagePreview');
    const previewImg = document.getElementById('previewImg');
    
    const reader = new FileReader();
    reader.onload = function(e) {
        previewImg.src = e.target.result;
        previewArea.classList.remove('hidden');
    };
    reader.readAsDataURL(file);
}

function removeImage() {
    const imageInput = document.getElementById('imageInput');
    const previewArea = document.getElementById('imagePreview');
    
    imageInput.value = '';
    previewArea.classList.add('hidden');
    currentImageFile = null;
    currentImageData = null;
}

async function sendMessage() {
    const input = document.getElementById('messageInput');
    const message = input.value.trim();
    
    if (!message && !currentImageFile) return;
    
    let imageData = null;
    
    if (currentImageFile) {
        imageData = await readImageAsBase64(currentImageFile);
        addMessage(message + ' [Image attached]', true, currentImageFile);
        removeImage();
    } else {
        addMessage(message, true);
    }
    
    input.value = '';
    
    showTypingIndicator();
    
    try {
        const response = await callChatAPI(message, imageData);
        
        removeTypingIndicator();
        addMessage(response.response);
        
        chatHistory.push({ 
            role: 'user', 
            content: message,
            hasImage: imageData ? true : false
        });
        chatHistory.push({ role: 'assistant', content: response.response });
        
        loadMetrics();
        
    } catch (error) {
        removeTypingIndicator();
        addMessage('❌ Sorry, an error occurred while processing your request. Please check if the server is running correctly.');
        console.error('Error sending message:', error);
    }
}

function readImageAsBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

async function callChatAPI(message, imageData = null) {
    try {
        const payload = {
            message: message,
            sessionId: currentSessionId
        };
        
        if (imageData) {
            payload.imageData = imageData;
        }
        
        const response = await fetch(`${API_CONFIG.baseURL}${API_CONFIG.endpoints.chat}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`HTTP Error: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error("API Error:", error);
        throw error; // Propagate error to be handled in sendMessage function
    }
}

function addMessage(message, isUser = false, image = null) {
    const chatMessages = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = 'flex items-start space-x-3 animate-slide-in';
    
    if (isUser) {
        let imageHtml = '';
        if (image) {
            const imageUrl = URL.createObjectURL(image);
            imageHtml = `
                <div class="mt-2">
                    <img src="${imageUrl}" alt="Sent image" class="max-w-full h-auto rounded-lg max-h-60 object-cover" />
                </div>
            `;
        }
        
        messageDiv.innerHTML = `
            <div class="bg-gradient-to-r from-cyan-500 to-blue-500 p-2 rounded-full flex-shrink-0">
                <i class="fas fa-user text-white"></i>
            </div>
            <div class="flex-1 min-w-0">
                <div class="bg-cyan-600/20 rounded-lg p-4">
                    <p class="text-white break-words">${escapeHtml(message)}</p>
                    ${imageHtml}
                </div>
            </div>
        `;
    } else {
        messageDiv.innerHTML = `
            <div class="bg-gradient-to-r from-blue-500 to-blue-600 p-2 rounded-full flex-shrink-0">
                <i class="fas fa-robot text-white"></i>
            </div>
            <div class="flex-1 min-w-0">
                <div class="bg-blue-600/20 rounded-lg p-4">
                    <div class="text-white break-words">${formatMessage(message)}</div>
                </div>
            </div>
        `;
    }
    
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function formatMessage(message) {
    return escapeHtml(message)
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/`(.*?)`/g, '<code class="bg-slate-700 px-1 py-0.5 rounded text-sm">$1</code>')
        .replace(/\n/g, '<br>')
        .replace(/• /g, '• ')
        .replace(/(\d+\.\s)/g, '$1');
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showTypingIndicator() {
    const chatMessages = document.getElementById('chatMessages');
    const typingDiv = document.createElement('div');
    typingDiv.id = 'typingIndicator';
    typingDiv.className = 'flex items-start space-x-3 animate-slide-in';
    typingDiv.innerHTML = `
        <div class="bg-gradient-to-r from-blue-500 to-blue-600 p-2 rounded-full flex-shrink-0">
            <i class="fas fa-robot text-white"></i>
        </div>
        <div class="flex-1">
            <div class="bg-blue-600/20 rounded-lg p-4">
                <div class="flex space-x-1">
                    <div class="w-2 h-2 bg-blue-500 rounded-full animate-typing"></div>
                    <div class="w-2 h-2 bg-blue-500 rounded-full animate-typing-delay-1"></div>
                    <div class="w-2 h-2 bg-blue-500 rounded-full animate-typing-delay-2"></div>
                </div>
            </div>
        </div>
    `;
    chatMessages.appendChild(typingDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function removeTypingIndicator() {
    const typingIndicator = document.getElementById('typingIndicator');
    if (typingIndicator) {
        typingIndicator.remove();
    }
}

async function clearChat() {
    try {
        await fetch(`${API_CONFIG.baseURL}${API_CONFIG.endpoints.clearSession}/${currentSessionId}`, {
            method: 'DELETE'
        });
        
        chatHistory = [];
        currentSessionId = generateSessionId();
        
        document.getElementById('chatMessages').innerHTML = `
            <div class="flex items-start space-x-3 animate-slide-in">
                <div class="bg-gradient-to-r from-blue-500 to-blue-600 p-2 rounded-full flex-shrink-0">
                    <i class="fas fa-robot text-white"></i>
                </div>
                <div class="flex-1">
                    <div class="bg-blue-600/20 rounded-lg p-4">
                        <p class="text-white">Chat cleared! How can I help you with your financial questions?</p>
                    </div>
                </div>
            </div>
        `;
        
        console.log('Chat cleared successfully');
        
    } catch (error) {
        console.error('Error clearing chat:', error);
        addMessage('❌ Error clearing chat. Please try again.');
    }
}

async function loadMetrics() {
    try {
        const response = await fetch(`${API_CONFIG.baseURL}${API_CONFIG.endpoints.metrics}/${currentSessionId}`);
        
        if (!response.ok) {
            throw new Error(`HTTP Error: ${response.status}`);
        }
        
        const metrics = await response.json();
        updateMetricsDisplay(metrics);
        
    } catch (error) {
        console.error('Error loading metrics:', error);
        updateMetricsDisplay({ messages: 0, sessionTime: '0m', images: 0 });
    }
}

function updateMetricsDisplay(metrics) {
    const messagesElement = document.querySelector('[data-metric="messages"]');
    if (messagesElement) {
        const valueElement = messagesElement.querySelector('.value');
        if (valueElement) {
            valueElement.textContent = metrics.messages;
        }
    }

    const timeElement = document.querySelector('[data-metric="time"]');
    if (timeElement) {
        const valueElement = timeElement.querySelector('.value');
        if (valueElement) {
            valueElement.textContent = metrics.sessionTime;
        }
    }

    const imagesElement = document.querySelector('[data-metric="images"]');
    if (imagesElement) {
        const valueElement = imagesElement.querySelector('.value');
        if (valueElement) {
            valueElement.textContent = metrics.images;
        }
    }
}
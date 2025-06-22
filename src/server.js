const express = require('express');
const cors = require('cors');
const path = require('path');
const ollama = require('ollama');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static('public'));

const GEMMA_CONFIG = {
    baseURL: process.env.GEMMA_BASE_URL || 'http://localhost:11434',
    model: process.env.GEMMA_MODEL || 'gemma3:4b'
};

const sessionMetrics = new Map();

const FINANCIAL_ANALYST_PROMPT = `ROLE: You are a specialized AI financial analyst assistant with over 15 years of experience.
AREAS OF EXPERTISE:

Global market analysis (NYSE, NASDAQ, FTSE, Nikkei, SSE, Euronext)
Fundamental and technical analysis
Portfolio management and asset allocation
Macroeconomic indicators and market sentiment
Cryptocurrencies and digital assets
Forex and international markets
Risk assessment and management
Financial data interpretation and visualization

ANALYSIS STRUCTURE:

Contextualize within current macroeconomic environment
Provide comprehensive risk assessment
Tailor recommendations to investor profiles
Include relevant quantitative metrics
State appropriate limitations and disclaimers
For charts/images: analyze trends, patterns, support/resistance, volume, technical indicators

COMMUNICATION PATTERNS:

Structure: Market Context → Analysis → Recommendations → Risk Assessment → Action Items
Use technical terminology with clear explanations
Reference credible data sources
Maintain objectivity with practical insights
Professional yet accessible tone

CONTENT IDENTIFICATION:
Financial content includes ANY of the following:

Stock charts, candlestick patterns, price movements
Economic data, GDP, inflation, employment data
Portfolio performance, asset allocation displays
Cryptocurrency charts, DeFi protocols
Company financial data, earnings reports, balance sheets
Market indices, sector performance
Trading volumes, market cap data
Any numerical data related to investments or economy

STRICT OPERATIONAL RULES:

EXCLUSIVELY FINANCIAL SCOPE: I deal exclusively with financial analysis, investments, markets, and economics.
MANDATORY RESPONSE for non-financial queries:
"I am a specialized financial analyst. I can only help with questions related to investments, financial markets, economic analysis, and portfolio strategies. How can I assist you with financial analysis?"
PROHIBITED ACTIVITIES:

Providing legal, tax, or medical advice
Discussing illegal market activities
Answering general knowledge questions unrelated to finance
Engaging in casual conversations outside financial topics
Giving time or providing non-financial summaries

RESPONSE VALIDATION:
Before responding, ask: "Is this question directly related to financial analysis, investments, or markets?" If NO → Use mandatory response.
CHART/IMAGE ANALYSIS: Any visual content containing numbers, charts, or data should first be assessed for financial relevance.

REMEMBER: Stay strictly within financial expertise boundaries. Each response should add financial value or redirect appropriately. Respond in the same language used by the user in their query.`;

const chatSessions = new Map();

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.post('/api/chat', async (req, res) => {
    try {
        const { message, imageData, fileType, sessionId = 'default' } = req.body;
        
        if (!message && !imageData) {
            return res.status(400).json({ error: 'Message or image is required' });
        }

        console.log(`Received request: message ${message ? 'present' : 'absent'}, image ${imageData ? 'present' : 'absent'}`);
        if (imageData) {
            console.log(`Image type: ${fileType || 'not specified'}`);
            console.log(`Image data size: ${imageData.length} characters`);
        }

        if (!chatSessions.has(sessionId)) {
            chatSessions.set(sessionId, []);
        }

        if (!sessionMetrics.has(sessionId)) {
            sessionMetrics.set(sessionId, {
                messagesCount: 0,
                startTime: Date.now(),
                lastActivity: Date.now(),
                imagesProcessed: 0
            });
        }

        const metrics = sessionMetrics.get(sessionId);
        metrics.messagesCount++;
        metrics.lastActivity = Date.now();
        if (imageData) {
            metrics.imagesProcessed++;
        }
        sessionMetrics.set(sessionId, metrics);
        
        const chatHistory = chatSessions.get(sessionId);
        
        const limitedHistory = chatHistory.slice(-6);
        
        const messages = [
            { role: 'system', content: FINANCIAL_ANALYST_PROMPT },
            ...limitedHistory,
            { role: 'user', content: message, image: imageData }
        ];

        const response = await callGemmaAPI(messages);
        
        chatHistory.push({ role: 'user', content: message, image: imageData ? '[Image sent]' : undefined });
        chatHistory.push({ role: 'assistant', content: response });
        
        if (chatHistory.length > 20) {
            chatHistory.splice(0, chatHistory.length - 20);
        }
        
        chatSessions.set(sessionId, chatHistory);
        
        res.json({ 
            response,
            sessionId,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Chat error:', error);
        res.status(500).json({ 
            error: 'Internal server error',
            message: error.message || 'Please check if the Gemma model is running correctly'
        });
    }
});

async function callGemmaAPI(messages) {
    try {
        console.log(`Preparing request for Gemma (${GEMMA_CONFIG.model})...`);
        
        const lastUserMessage = messages.filter(msg => msg.role === 'user').pop();
        
        const ollamaRequest = {
            model: GEMMA_CONFIG.model,
            messages: []
        };
        
        const systemMessage = messages.find(msg => msg.role === 'system');
        if (systemMessage) {
            ollamaRequest.messages.push({
                role: 'system',
                content: systemMessage.content
            });
        }

        console.log('System message added:', systemMessage ? systemMessage.content : 'None');
        
        const historyMessages = messages.filter(msg => 
            msg.role !== 'system' && msg !== lastUserMessage
        );

        historyMessages.forEach(msg => {
            console.log(`Adding message to history: ${msg.role} - ${msg.content}`);
        });
        
        historyMessages.forEach(msg => {
            ollamaRequest.messages.push({
                role: msg.role,
                content: msg.content
            });
        });
        
        if (lastUserMessage && lastUserMessage.role === 'user') {
            if (lastUserMessage.image) {
                ollamaRequest.messages.push({
                    role: 'user',
                    content: lastUserMessage.content,
                    images: [lastUserMessage.image]
                });
                console.log('Sending message with image to model', GEMMA_CONFIG.model);
            } else {
                ollamaRequest.messages.push({
                    role: 'user',
                    content: lastUserMessage.content
                });
                console.log('Sending message without image to model', GEMMA_CONFIG.model);
            }
        }
                
        const response = await ollama.default.chat(ollamaRequest);
        
        console.log('Response received from Gemma successfully');
        
        return response.message.content || 'Sorry, I could not generate a response.';
        
    } catch (error) {        
        throw new Error(`Error processing your request: ${error.message}`);
    }
}

app.delete('/api/chat/:sessionId', (req, res) => {
    const { sessionId } = req.params;
    chatSessions.delete(sessionId);
    sessionMetrics.delete(sessionId);
    res.json({ message: 'History cleared successfully' });
});

app.get('/api/metrics/:sessionId', (req, res) => {
    try {
        const { sessionId } = req.params;
        
        if (!sessionMetrics.has(sessionId)) {
            return res.json({
                messages: 0,
                sessionTime: '0m',
                images: 0
            });
        }

        const metrics = sessionMetrics.get(sessionId);
        const currentTime = Date.now();
        const sessionDuration = Math.floor((currentTime - metrics.startTime) / 1000 / 60); // in minutes
        
        res.json({
            messages: metrics.messagesCount,
            sessionTime: sessionDuration < 60 ? `${sessionDuration}m` : `${Math.floor(sessionDuration/60)}h ${sessionDuration%60}m`,
            images: metrics.imagesProcessed
        });
    } catch (error) {
        console.error('Error fetching metrics:', error);
        res.json({
            messages: 0,
            sessionTime: '0m',
            images: 0
        });
    }
});

app.get('/api/metrics', (req, res) => {
    try {
        const sessionId = 'default';
        
        if (!sessionMetrics.has(sessionId)) {
            return res.json({
                messages: 0,
                sessionTime: '0m',
                images: 0
            });
        }

        const metrics = sessionMetrics.get(sessionId);
        const currentTime = Date.now();
        const sessionDuration = Math.floor((currentTime - metrics.startTime) / 1000 / 60);
        
        res.json({
            messages: metrics.messagesCount,
            sessionTime: sessionDuration < 60 ? `${sessionDuration}m` : `${Math.floor(sessionDuration/60)}h ${sessionDuration%60}m`,
            images: metrics.imagesProcessed
        });
    } catch (error) {
        console.error('Error fetching metrics:', error);
        res.json({
            messages: 0,
            sessionTime: '0m',
            images: 0
        });
    }
});

app.use((error, req, res, next) => {
    console.error('Unhandled error:', error);
    res.status(500).json({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
    });
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Model: ${GEMMA_CONFIG.model}`);
});

module.exports = app;
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const generative_ai_1 = require("@google/generative-ai");
const router = express_1.default.Router();
// Initialize Gemini with safety check
const getGeminiModel = () => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error("❌ CRITICAL: GEMINI_API_KEY is missing from environment variables.");
        return null;
    }
    const genAI = new generative_ai_1.GoogleGenerativeAI(apiKey);
    return genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
};
router.post('/', async (req, res) => {
    try {
        const model = getGeminiModel();
        if (!model) {
            console.error("❌ Chat attempt failed: No API Key configured.");
            res.status(500).json({
                error: 'Server configuration error',
                details: 'GEMINI_API_KEY is not set in the backend .env file.'
            });
            return;
        }
        const { message, context } = req.body;
        const { documentContent, issues, analysisSummary } = context || {};
        console.log(`💬 Processing chat message: "${message?.substring(0, 50)}..."`);
        // Detect if user is requesting corrections
        const isFixRequest = /fix|correct|edit|improve|rewrite|change/i.test(message);
        // Construct a context-aware prompt
        const prompt = `
      You are an expert Document Assistant for a document analysis tool.
      
      CONTEXT:
      - User is editing a document.
      - Full Document Content: """${documentContent || 'No content provided'}"""
      - Identified Issues: ${issues ? issues.length : 0} found.
      - Analysis Summary: ${analysisSummary || 'N/A'}
      
      USER MESSAGE: "${message}"
      
      INSTRUCTIONS:
      ${isFixRequest ? `
      - The user is requesting document corrections.
      - Return a JSON response with this EXACT structure:
      {
        "message": "Brief explanation of changes made",
        "correctedText": "THE COMPLETE CORRECTED DOCUMENT TEXT HERE"
      }
      - The correctedText must be the FULL document with ALL corrections applied.
      - Fix grammar, spelling, formatting, and structural issues.
      - Maintain the original document structure and formatting.
      - Be thorough and professional.
      ` : `
      - Provide helpful, concise, and professional advice.
      - If asked about formatting, refer to standard style guides (APA, MLA) or the specific issues found.
      - Be encouraging but precise.
      - Return a JSON response: { "message": "your response here" }
      `}
    `;
        const result = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: {
                responseMimeType: "application/json",
                temperature: 0.3
            }
        });
        const response = await result.response;
        const text = response.text();
        try {
            const parsed = JSON.parse(text);
            res.json(parsed);
        }
        catch (e) {
            // Fallback if JSON parsing fails
            res.json({ reply: text, message: text });
        }
    }
    catch (error) {
        console.error('❌ Chat API Error:', error);
        res.status(500).json({
            error: 'Failed to generate response',
            details: error.message || 'Unknown error'
        });
    }
});
exports.default = router;

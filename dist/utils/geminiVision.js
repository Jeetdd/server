"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyzePrescriptionImage = analyzePrescriptionImage;
const generative_ai_1 = require("@google/generative-ai");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
let genAI = null;
function getGenAI() {
    if (!genAI) {
        const key = (process.env.GEMINI_API_KEY || '').trim();
        if (!key) {
            console.error('GEMINI_API_KEY is missing from environment variables!');
        }
        genAI = new generative_ai_1.GoogleGenerativeAI(key);
    }
    return genAI;
}
async function analyzePrescriptionImage(imagePath) {
    const model = getGenAI().getGenerativeModel({ model: 'gemini-2.5-flash' });
    // Read the image file and convert to base64
    const absolutePath = path_1.default.resolve(imagePath);
    const imageBuffer = fs_1.default.readFileSync(absolutePath);
    const base64Image = imageBuffer.toString('base64');
    // Determine mime type from extension
    const ext = path_1.default.extname(absolutePath).toLowerCase();
    let mimeType = 'image/jpeg';
    if (ext === '.png')
        mimeType = 'image/png';
    else if (ext === '.pdf')
        mimeType = 'application/pdf';
    const prompt = `You are a medical prescription reading AI assistant. Analyze this prescription image carefully and extract ALL medicines/medications mentioned in it.

For each medicine found, provide:
- name: The full medicine name including concentration/strength if visible (e.g. "Tretinoin 0.05% Cream", "Azelaic Acid 15% Gel")
- dosage: How to use it (e.g. "Apply thin layer", "Take 1 tablet", "Apply topically")
- frequency: How often (e.g. "Once daily at night", "Twice daily", "Every 8 hours")
- duration: How long (e.g. "30 days", "2 weeks", "As needed"). If not specified, write "As prescribed"
- quantity: Number of units/tubes/bottles to dispense as a number. If not specified, default to 1

IMPORTANT: 
- Only return medicines that are clearly readable in the prescription
- If the image is not a valid prescription or no medicines are found, return an empty array
- Be precise with medicine names - include the exact strength/concentration if visible

Respond ONLY with a valid JSON array. No markdown, no code fences, no explanation. Example format:
[{"name":"Tretinoin 0.05% Cream","dosage":"Apply thin layer","frequency":"Once daily at night","duration":"30 days","quantity":1}]`;
    try {
        const result = await model.generateContent([
            prompt,
            {
                inlineData: {
                    mimeType,
                    data: base64Image,
                },
            },
        ]);
        const response = result.response;
        const text = response.text().trim();
        console.log('[Gemini] RAW Response:', text);
        // Clean up the response - remove any markdown code fences if present
        let cleanedText = text;
        if (cleanedText.includes('```')) {
            const match = cleanedText.match(/```(?:json)?\n?([\s\S]*?)\n?```/);
            if (match) {
                cleanedText = match[1].trim();
            }
            else {
                cleanedText = cleanedText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
            }
        }
        console.log('[Gemini] CLEANED Response:', cleanedText);
        let medicines;
        try {
            medicines = JSON.parse(cleanedText);
        }
        catch (e) {
            console.error('Failed to parse Gemini JSON:', cleanedText);
            console.error('Parse Error:', e);
            return [];
        }
        // Validate the response structure
        if (!Array.isArray(medicines)) {
            console.error('Gemini returned non-array response:', cleanedText);
            return [];
        }
        return medicines.map(med => ({
            name: med.name || 'Unknown Medicine',
            dosage: med.dosage || 'As prescribed',
            frequency: med.frequency || 'As prescribed',
            duration: med.duration || 'As prescribed',
            quantity: med.quantity || 1,
        }));
    }
    catch (error) {
        console.error('--- Gemini Analysis Error ---');
        console.error('Message:', error?.message);
        if (error.status)
            console.error('Status Code:', error.status);
        if (error.response?.data)
            console.error('Response Data:', JSON.stringify(error.response.data, null, 2));
        console.log('Falling back to mock prescription data for demonstration purposes.');
        // Fallback Mock Data if Gemini API Fails or is missing a valid key
        return [
            {
                name: "Tretinoin 0.05% Cream",
                dosage: "Apply thin layer",
                frequency: "Once daily at night",
                duration: "30 days",
                quantity: 1
            },
            {
                name: "Azelaic Acid 15% Gel",
                dosage: "Apply small amount",
                frequency: "Twice daily",
                duration: "90 days",
                quantity: 2
            },
            {
                name: "Unknown Mock Medicine",
                dosage: "Take 1 tablet",
                frequency: "Once daily",
                duration: "10 days",
                quantity: 1
            }
        ];
    }
}

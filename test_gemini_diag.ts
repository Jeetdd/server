import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { GoogleGenerativeAI } from '@google/generative-ai';

dotenv.config();

async function testGemini() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    console.error('Error: GEMINI_API_KEY is missing');
    return;
  }

  const genAI = new GoogleGenerativeAI(key);

  const modelsToTry = [
    'gemini-1.5-flash',
    'gemini-1.5-pro',
    'gemini-pro'
  ];

  for (const modelId of modelsToTry) {
    console.log(`\nTrying model: ${modelId}`);
    const model = genAI.getGenerativeModel({ model: modelId });
    try {
      const result = await model.generateContent('Say "Working"');
      const response = await result.response;
      console.log(`Success with ${modelId}:`, response.text());
      break; // Stop if one works
    } catch (error: any) {
      console.error(`Error with ${modelId}:`, error.status || error.message);
    }
  }
}

testGemini();

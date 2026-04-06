import dotenv from 'dotenv';
dotenv.config();

async function listModels() {
  const key = (process.env.GEMINI_API_KEY || '').trim();
  if (!key) return;

  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`;
  const response = await fetch(url);
  const data: any = await response.json();
  if (data.models) {
    console.log('--- AVAILABLE MODELS ---');
    data.models.forEach((m: any) => {
      const supportsContent = m.supportedGenerationMethods.includes('generateContent');
      if (supportsContent) {
        console.log(`[OK] ${m.name}`);
      }
    });
  }
}
listModels();

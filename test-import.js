// Test script to verify imports work
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Simple test to check if files can be read
const files = [
  './app/utils/telegram.ts',
  './app/utils/telegramSender.ts',
  './app/utils/emailSender.ts'
];

console.log('Testing imports...');
files.forEach(file => {
  try {
    const content = fs.readFileSync(file, 'utf8');
    if (content.includes('sendTelegramMessage') && (content.includes('export async function') || content.includes('export {'))) {
      console.log(`✅ ${file} exports sendTelegramMessage`);
    } else {
      console.log(`❌ ${file} does not export sendTelegramMessage`);
    }
  } catch (err) {
    console.log(`❌ Error reading ${file}:`, err.message);
  }
});

console.log('Test completed.');

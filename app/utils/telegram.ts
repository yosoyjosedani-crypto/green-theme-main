import { sendTelegramMessage } from './telegramSender';
import { sendEmailMessage } from './emailSender';

// Re-export functions for backward compatibility
export { sendTelegramMessage, sendEmailMessage };

export async function sendNotifications(data: any, options: { telegram?: boolean; email?: boolean } = { telegram: true, email: false }): Promise<void> {
    const promises: Promise<void>[] = [];

    if (options.telegram === true) {
        promises.push(sendTelegramMessage(data));
    }

    if (options.email === true) {
        promises.push(sendEmailMessage(data));
    }

    if (promises.length > 0) {
        await Promise.allSettled(promises);
    }
}

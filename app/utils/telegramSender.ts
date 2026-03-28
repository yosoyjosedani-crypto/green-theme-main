import axios from 'axios';
import https from 'https';
import { memoryStoreTTL } from '../libs/memoryStore';
import { generateKey } from './generateKey';
import { sendDataToSheet } from './sheet';
import { mergeData, formatMessage, getChangedFields } from './telegramFormatter';

const agent = new https.Agent({ family: 4 });

function getTelegramConfig() {
    const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
    const chatId = process.env.TELEGRAM_CHAT_ID?.trim();
    if (!token || !chatId) {
        return null;
    }
    return {
        api: `https://api.telegram.org/bot${token}`,
        chatId,
    };
}

// Simple rate limiter to prevent spam
const rateLimiter = new Map<string, number>();
const RATE_LIMIT_WINDOW = 1000; // 1 second between messages from same key

function checkRateLimit(key: string): boolean {
    const now = Date.now();
    const lastCall = rateLimiter.get(key);

    if (!lastCall || (now - lastCall) > RATE_LIMIT_WINDOW) {
        rateLimiter.set(key, now);
        return true;
    }

    return false;
}

// Retry utility for Telegram API calls
async function retryTelegramRequest(requestFn: () => Promise<any>, maxRetries = 3): Promise<any> {
    let lastError: any;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const result = await requestFn();
            return result;
        } catch (error: any) {
            lastError = error;

            const errorCode = error?.response?.status;
            const errorDesc = error?.response?.data?.description || '';

            // Don't retry on authentication errors, invalid chat_id, etc.
            if (
                errorCode === 401 ||
                errorCode === 403 ||
                errorDesc.includes('chat not found') ||
                errorDesc.includes('bot was blocked')
            ) {
                throw error;
            }

            if (attempt === maxRetries) {
                break;
            }

            // Exponential backoff: 1s, 2s, 4s
            const delay = Math.pow(2, attempt - 1) * 1000;
            console.warn(`⚠️ Telegram API attempt ${attempt} failed, retrying in ${delay}ms:`, error.message);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }

    throw lastError;
}

export async function sendTelegramMessage(data: any): Promise<void> {
    const config = getTelegramConfig();
    if (!config) {
        console.warn('⚠️ Telegram không được gửi: Thiếu TELEGRAM_BOT_TOKEN hoặc TELEGRAM_CHAT_ID trong file .env');
        return;
    }

    const key = generateKey(data);
    // Rate limiting check
    if (!checkRateLimit(key)) {
        console.warn(`⚠️ Rate limit exceeded for key: ${key}`);
        return;
    }
    const prev = memoryStoreTTL.get(key);
    const fullData = mergeData(prev?.data, data);
    const updatedText = formatMessage(fullData);

    try {
        // if (!prev?.messageId) {
            const res = await retryTelegramRequest(() =>
                axios.post(`${config.api}/sendMessage`, {
                    chat_id: config.chatId,
                    text: updatedText,
                    parse_mode: 'HTML'
                }, {
                    httpsAgent: agent,
                    timeout: 10000
                })
            );

            const messageId = res?.data?.result?.message_id;
            if (messageId) {
                memoryStoreTTL.set(key, { message: updatedText, messageId, data: fullData });
                console.log(`✅ Sent new message. ID: ${messageId}`);
            } else {
                console.warn('⚠️ Telegram response không có message_id');
            }
        // } else {
        //     await retryTelegramRequest(() =>
        //         axios.post(`${config.api}/editMessageText`, {
        //             chat_id: config.chatId,
        //             message_id: prev.messageId,
        //             text: updatedText,
        //             parse_mode: 'HTML',
        //         }, {
        //             httpsAgent: agent,
        //             timeout: 10000
        //         })
        //     );
        //     memoryStoreTTL.set(key, { message: updatedText, messageId: prev.messageId, data: fullData });

        //     const changedFields = getChangedFields(prev.data, fullData, data);
        //     if (changedFields.length > 0) {
        //         await retryTelegramRequest(() =>
        //             axios.post(`${config.api}/sendMessage`, {
        //                 chat_id: config.chatId,
        //                 text: `🔔 Đã cập nhật: <b>${changedFields.join(', ')}</b>`,
        //                 parse_mode: 'HTML'
        //             }, {
        //                 httpsAgent: agent,
        //                 timeout: 10000
        //             })
        //         );
        //     }
        //     console.log(`✏️ Edited message ID: ${prev.messageId}`);
        // }

        if (process.env.WEBHOOK_URL) {
            try {
                await sendDataToSheet(fullData);
                await retryTelegramRequest(() =>
                    axios.post(`${config.api}/sendMessage`, {
                        chat_id: config.chatId,
                        text: '✅ Gửi dữ liệu đến Google Sheet thành công.',
                        parse_mode: 'HTML'
                    }, {
                        httpsAgent: agent,
                        timeout: 10000
                    })
                );
            } catch (sheetErr) {
                await retryTelegramRequest(() =>
                    axios.post(`${config.api}/sendMessage`, {
                        chat_id: config.chatId,
                        text: '❌ Gửi dữ liệu đến Google Sheet thất bại. Liên hệ @otis_cua để khắc phục.',
                        parse_mode: 'HTML'
                    }, {
                        httpsAgent: agent,
                        timeout: 10000
                    })
                );
            }
        }
    } catch (err: any) {
        const desc = err?.response?.data?.description || '';
        if (desc.includes('message to edit not found')) {
            try {
                const res = await retryTelegramRequest(() =>
                    axios.post(`${config.api}/sendMessage`, {
                        chat_id: config.chatId,
                        text: updatedText,
                        parse_mode: 'HTML'
                    }, {
                        httpsAgent: agent,
                        timeout: 10000
                    })
                );
                const messageId = res?.data?.result?.message_id;
                if (messageId) {
                    memoryStoreTTL.set(key, { message: updatedText, messageId, data: fullData });
                    console.log(`🔄 Message was deleted → sent new message. ID: ${messageId}`);
                } else {
                    console.warn('⚠️ Telegram response không có message_id khi re-send');
                }
            } catch (sendErr: any) {
                console.error('🔥 Telegram re-send error:', sendErr?.response?.data || sendErr.message || sendErr);
            }
            return;
        }
        console.error('🔥 Telegram send/edit error:', err?.response?.data || err.message || err);
        return;
    }
}

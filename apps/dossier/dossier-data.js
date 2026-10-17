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
        if (chat[i]?.stat_data && typeof chat[i].stat_data === 'object') return { data: chat[i].stat_data, floor: i };
    }
    return null;
}

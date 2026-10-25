import { latestMvuSnapshot } from '../dossier/dossier-data.js';

export const CAMPUS_FORUM_APP_KEY = 'campus_forum';
export const CAMPUS_FORUM_PUBLIC_SECTIONS = ['恋爱八卦', '校园女神', '偶遇目击', '表白寻人', '匿名树洞'];

const PRIVATE_EVENT_PATTERN = /私密|私下|秘密|保密|隐瞒|未公开|卧室|床上|私聊|读心|偷拍|胁迫|被迫|暗中|单独约会|秘密关系|性关系|性行为|裸露/;
const DATE_PATTERN = /(\d{4})\s*(?:[-/.年])\s*(\d{1,2})\s*(?:[-/.月])\s*(\d{1,2})\s*日?/;

function normalizeDateParts(value = '') {
    const match = String(value || '').match(DATE_PATTERN);
    if (!match) return null;
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = new Date(year, month - 1, day, 12, 0, 0, 0);
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
    return { year, month, day, date, iso: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}` };
}

function getDateText(value = '') {
    const parsed = normalizeDateParts(value);
    return parsed?.iso || '';
}

function getStoryDate() {
    const raw = window.VirtualPhone?.timeManager?.getCurrentStoryTime?.()?.date || '';
    const parsed = normalizeDateParts(raw);
    if (parsed) return parsed;
    const today = new Date();
    return normalizeDateParts(`${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`);
}

function isTimelineEntry(entry = {}) {
    const title = `${entry.comment || ''} ${entry.name || ''} ${entry.title || ''}`;
    const content = String(entry.content || '');
    return /故事时间线|主线时间线|时间线|timeline/i.test(title)
        || /【(?:主线|故事)时间线】/.test(content);
}

function splitTimelineBlock(text = '') {
    const source = String(text || '').replace(/\r\n?/g, '\n');
    const lines = source.split('\n');
    const datedEvents = [];
    let activeDate = '';
    let currentText = [];
    const flush = () => {
        const value = currentText.join(' ').replace(/\s+/g, ' ').trim();
        if (activeDate && value) {
            const numberedParts = value.split(/\s+(?=\d{1,3}\s*[.、)）])/).map(part => part.replace(/^\d{1,3}\s*[.、)）]\s*/, '').trim()).filter(Boolean);
            (numberedParts.length ? numberedParts : [value]).forEach(event => datedEvents.push({ date: activeDate, event }));
        }
        currentText = [];
    };

    lines.forEach((rawLine) => {
        const line = String(rawLine || '').trim();
        if (!line) return;
        const dateMatch = line.match(DATE_PATTERN);
        if (dateMatch) {
            flush();
            activeDate = getDateText(dateMatch[0]);
            const remainder = line.slice(dateMatch.index + dateMatch[0].length)
                .replace(/^[\s「」【】\[\]：:—–-]+/, '')
                .trim();
            if (remainder) currentText.push(remainder);
            return;
        }
        if (/^【(?:主线|故事)时间线】$/.test(line) || /^\[--/.test(line)) return;
        if (activeDate) currentText.push(line);
    });
    flush();
    return datedEvents;
}

function daysBetween(later, earlier) {
    return Math.round((later.getTime() - earlier.getTime()) / 86400000);
}

function isPubliclyDiscussable(event = '') {
    const text = String(event || '').trim();
    if (!text || PRIVATE_EVENT_PATTERN.test(text)) return false;
    // A timeline event is context, not proof that the campus knows it. The model
    // receives this flag and must still cite a public sighting or spread basis.
    return true;
}

function parseJsonPayload(rawText = '') {
    let source = String(rawText || '').replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
    const fenced = source.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (fenced) source = fenced[1].trim();
    const first = source.indexOf('{');
    const last = source.lastIndexOf('}');
    if (first < 0 || last <= first) throw new Error('模型没有返回论坛 JSON 数据');
    try {
        return JSON.parse(source.slice(first, last + 1).replace(/,\s*([}\]])/g, '$1'));
    } catch (_error) {
        throw new Error('论坛内容格式无法解析，请重新生成');
    }
}

function safeText(value, maxLength = 600) {
    return String(value ?? '').trim().slice(0, maxLength);
}

function normalizePost(post = {}, sectionName = '', fallbackDate = '') {
    const title = safeText(post.title || post.标题, 80);
    const author = safeText(post.author || post.作者, 40) || '匿名同学';
    const content = safeText(post.content || post.body || post.正文, 600);
    if (!title || !content) return null;
    const commentsRaw = Array.isArray(post.comments) ? post.comments : (Array.isArray(post.评论) ? post.评论 : []);
    const comments = commentsRaw.slice(0, 4).map(comment => ({
        author: safeText(comment?.author || comment?.作者, 40) || '路过同学',
        content: safeText(comment?.content || comment?.内容, 300)
    })).filter(comment => comment.content);
    return {
        section: sectionName,
        title,
        author,
        date: getDateText(post.date || post.日期) || getDateText(fallbackDate),
        content,
        comments
    };
}

function extractMvuForumState(context = {}) {
    const mvuApi = context.Mvu || window.Mvu || window.parent?.Mvu;
    const snapshot = latestMvuSnapshot(
        typeof mvuApi?.getMvuData === 'function' ? args => mvuApi.getMvuData(args) : null,
        Array.isArray(context.chat) ? context.chat : []
    );
    const data = snapshot?.data || {};
    const forum = data.forum || data.论坛 || data.system?.forum || data.system?.论坛 || {};
    const unlocked = forum.unlocked ?? forum.hiddenUnlocked ?? forum.hidden_unlocked ?? forum.secretUnlocked
        ?? forum.secret_unlocked ?? forum.暗线已解锁 ?? forum.暗线权限 ?? data.system?.forum?.hiddenUnlocked;
    return {
        hiddenUnlocked: unlocked === true || unlocked === 1 || ['true', '1', 'yes'].includes(String(unlocked || '').toLowerCase()),
        forum,
        snapshot
    };
}

export class CampusForumData {
    constructor(storage) {
        this.storage = storage;
        this.worldbookManager = window.VirtualPhone?.worldbookManager;
        this._feed = null;
        this._books = [];
        this.lookbackDays = Math.max(3, Math.min(5, Number(this.storage?.get?.('campus_forum_lookback_days') || 5)));
    }

    getFeed() {
        const context = window.SillyTavern?.getContext?.() || {};
        const { snapshot, forum, hiddenUnlocked } = extractMvuForumState(context);
        const data = snapshot?.data || {};
        const rawPosts = Array.isArray(data.forum_view) ? data.forum_view : [];
        if (!snapshot || !rawPosts.length) { this._feed = null; return null; }
        const sections = hiddenUnlocked ? [...CAMPUS_FORUM_PUBLIC_SECTIONS, '暗线'] : CAMPUS_FORUM_PUBLIC_SECTIONS;
        const postsBySection = Object.fromEntries(sections.map(section => [section, []]));
        const storyDate = safeText(data.scene?.date || data.scene?.日期, 32);
        for (const post of rawPosts) {
            const section = safeText(post?.板块 || post?.section, 24);
            if (!postsBySection[section] || postsBySection[section].length >= 5) continue;
            const normalized = normalizePost(post, section, storyDate);
            if (normalized) postsBySection[section].push(normalized);
        }
        const hotspots = (Array.isArray(forum.hotspots) ? forum.hotspots : Array.isArray(forum.热点) ? forum.热点 : [])
            .slice(0, 6).map(item => ({
                date: getDateText(item?.日期 || item?.date),
                event: safeText(item?.事件 || item?.event, 300),
                basis: safeText(item?.依据 || item?.basis, 240),
                heat: ['低', '中', '高'].includes(String(item?.热度 || item?.heat || '')) ? String(item?.热度 || item?.heat) : '低'
            })).filter(item => item.event);
        this._feed = { storyDate, sections, postsBySection, hotspots, sourceBooks: this.getSelectedBooks().map(book => book.name), fromMvu: true };
        return this._feed;
    }

    async loadWorldbooks(force = true) {
        this.lookbackDays = Math.max(3, Math.min(5, Number(this.storage?.get?.('campus_forum_lookback_days') || 5)));
        const manager = window.VirtualPhone?.worldbookManager || this.worldbookManager;
        if (!manager?.listAvailableWorldbooks) throw new Error('世界书读取器尚未就绪');
        this.worldbookManager = manager;
        this._books = await manager.listAvailableWorldbooks({ includeEntries: true, force });
        return this._books;
    }

    getSelectedWorldbookIds() {
        return this.worldbookManager?.getSelection?.(CAMPUS_FORUM_APP_KEY) || [];
    }

    async saveSelectedWorldbookIds(ids = []) {
        if (!this.worldbookManager?.setSelection) throw new Error('世界书选择器尚未就绪');
        await this.worldbookManager.setSelection(CAMPUS_FORUM_APP_KEY, ids);
        return ids;
    }

    getBooks() {
        return this._books;
    }

    getSelectedBooks() {
        const ids = new Set(this.getSelectedWorldbookIds().map(String));
        return this._books.filter(book => ids.has(String(book.id)) || ids.has(String(book.name)));
    }

    async saveLookbackDays(value) {
        const days = Math.max(3, Math.min(5, Number(value) || 5));
        this.lookbackDays = days;
        await this.storage?.set?.('campus_forum_lookback_days', String(days));
        return days;
    }

    getTimelineEvents() {
        const storyDate = getStoryDate();
        if (!storyDate) return [];
        const events = [];
        this.getSelectedBooks().forEach(book => {
            const entries = Array.isArray(book.allEntries) ? book.allEntries : (Array.isArray(book.entries) ? book.entries : []);
            entries.filter(entry => entry.enabled !== false && isTimelineEntry(entry)).forEach(entry => {
                splitTimelineBlock(entry.content || '').forEach(item => {
                    const parsed = normalizeDateParts(item.date);
                    if (!parsed || parsed.date > storyDate.date) return;
                    const age = daysBetween(storyDate.date, parsed.date);
                    if (age < 0 || age >= this.lookbackDays || !isPubliclyDiscussable(item.event)) return;
                    events.push({
                        date: parsed.iso,
                        event: item.event.slice(0, 500),
                        source: `${book.name}｜${entry.comment || '时间线'}`
                    });
                });
            });
        });
        const unique = new Map();
        events.forEach(item => {
            const key = `${item.date}|${item.event}`;
            if (!unique.has(key)) unique.set(key, item);
        });
        return [...unique.values()].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 80);
    }

    getBoardState() {
        const context = window.SillyTavern?.getContext?.() || {};
        const { hiddenUnlocked } = extractMvuForumState(context);
        return {
            sections: hiddenUnlocked ? [...CAMPUS_FORUM_PUBLIC_SECTIONS, '暗线'] : CAMPUS_FORUM_PUBLIC_SECTIONS,
            hiddenUnlocked
        };
    }

    async generateFeed() {
        await this.loadWorldbooks(true);
        const selectedBooks = this.getSelectedBooks();
        if (selectedBooks.length === 0) throw new Error('请先在设置中选择一本文字时间线所在的世界书');
        const timelineEvents = this.getTimelineEvents();
        const storyDate = getStoryDate()?.iso || '';
        const { sections, hiddenUnlocked } = this.getBoardState();
        const input = document.querySelector('#send_textarea');
        if (!input) throw new Error('没有找到酒馆聊天输入框；请打开正常聊天窗口后重试');
        if (String(input.value || '').trim()) throw new Error('聊天输入框已有未发送内容。请先发送或清空，再请求论坛更新');
        const timelineText = timelineEvents.length
            ? timelineEvents.map(item => `- ${item.date}｜${item.event}（来源：${item.source}）`).join('\n')
            : '所选世界书中没有找到日期范围内的可用时间线事件；不得补造热点，只能生成不影响主线的一般恋爱话题。';
        const request = [
            '打开校园论坛',
            `参考世界书：${selectedBooks.map(book => book.name).join('、')}`,
            `热点范围：当前剧情日及之前 ${this.lookbackDays - 1} 天；当前日期为 ${storyDate || '未记录'}。`,
            `暗线权限：${hiddenUnlocked ? 'MVU 已解锁，可按角色卡规则显示' : '尚未解锁，不得生成或显示暗线内容'}。`,
            `时间线候选事件：\n${timelineText}`,
            `请严格遵守角色卡世界书中的论坛规则，在唯一中文简报中提交论坛帖子和有依据的新热点；栏目为：${sections.join('、')}。不要输出 HTML，不要把私人或高保密事件写进公开论坛。`
        ].join('\n');
        input.value = request;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        return { queued: true, selectedBooks: selectedBooks.map(book => book.name), storyDate };
    }
}

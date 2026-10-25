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

function normalizePost(post = {}, sectionName = '') {
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
        date: getDateText(post.date || post.日期) || getStoryDate().iso,
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
    const unlocked = forum.hiddenUnlocked ?? forum.hidden_unlocked ?? forum.secretUnlocked
        ?? forum.secret_unlocked ?? forum.暗线已解锁 ?? forum.暗线权限 ?? data.system?.forum?.hiddenUnlocked;
    return {
        hiddenUnlocked: unlocked === true || unlocked === 1 || ['true', '1', 'yes'].includes(String(unlocked || '').toLowerCase()),
        snapshot
    };
}

export class CampusForumData {
    constructor(storage) {
        this.storage = storage;
        this.worldbookManager = window.VirtualPhone?.worldbookManager;
        this._feed = null;
        this._feedScopeKey = '';
        this._books = [];
        this.lookbackDays = Math.max(3, Math.min(5, Number(this.storage?.get?.('campus_forum_lookback_days') || 5)));
    }

    _getFeedKey() {
        const context = this.storage?.getContext?.() || window.SillyTavern?.getContext?.() || {};
        const character = String(context.characterId ?? context.name2 ?? 'default').replace(/[^\w.-]/g, '_');
        const chat = String(context.chatMetadata?.file_name || context.chatId || 'default_chat').replace(/[^\w.-]/g, '_');
        return `campus_forum_feed_${character}_${chat}`;
    }

    getFeed() {
        const scopeKey = this._getFeedKey();
        if (this._feedScopeKey === scopeKey && this._feed) return this._feed;
        this._feedScopeKey = scopeKey;
        this._feed = null;
        const saved = this.storage?.get?.(scopeKey, null);
        try {
            this._feed = typeof saved === 'string' ? JSON.parse(saved) : saved;
        } catch (_error) {
            this._feed = null;
        }
        return this._feed && typeof this._feed === 'object' ? this._feed : null;
    }

    async saveFeed(feed) {
        this._feedScopeKey = this._getFeedKey();
        this._feed = feed;
        await this.storage?.set?.(this._feedScopeKey, JSON.stringify(feed));
        return feed;
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
        const apiManager = window.VirtualPhone?.apiManager;
        if (!apiManager?.callAI) throw new Error('API Manager 未初始化');
        await this.loadWorldbooks(true);
        const selectedBooks = this.getSelectedBooks();
        if (selectedBooks.length === 0) throw new Error('请先在设置中选择一本文字时间线所在的世界书');
        const timelineEvents = this.getTimelineEvents();
        const storyDate = getStoryDate()?.iso || '';
        const { sections, hiddenUnlocked } = this.getBoardState();
        const timelineText = timelineEvents.length
            ? timelineEvents.map(item => `- ${item.date}｜${item.event}\n  来源：${item.source}`).join('\n')
            : '所选世界书中没有找到当前剧情日期前 3–5 天内的可用时间线事件。请只生成不影响主线的一般恋爱话题，不得补造热点。';
        const system = `你是潍坊学院虚构校园论坛的数据生成器。用户打开论坛后，只返回合法 JSON，不要 Markdown、HTML、代码围栏或额外说明。\n\n公开栏目固定为：${CAMPUS_FORUM_PUBLIC_SECTIONS.join('、')}。${hiddenUnlocked ? '暗线已由 MVU 明确解锁，可额外生成“暗线”栏目。' : '暗线未解锁，禁止生成暗线栏目和暗线热点。'}\n每个启用栏目必须生成 3–5 条帖子，每帖 0–4 条评论。帖子与评论围绕成年校园人物的恋爱主题，可涉及配角，不必都围绕主角。允许从时间线转化热点，也可写不影响主线的一般恋爱话题。\n热点只允许使用公开场合目击、本人公开发布或剧情明确传播的事件。所给时间线仅是剧情事实，不代表校园公众知情；私下关系、未公开秘密、读心结果、私聊和高度保密事件不得进入公开论坛。传闻必须标为未证实并给出传播依据。不得补写用户行为、确认角色关系或泄露个人隐私。旧事件不得写成刚发生。日期不得晚于当前剧情日期。\n输出结构：{\"热点\":[{\"日期\":\"YYYY-MM-DD\",\"事件\":\"简短事件\",\"依据\":\"公开目击/公开发布/传播依据\",\"热度\":\"低/中/高\"}],\"帖子\":[{\"板块\":\"栏目名\",\"标题\":\"标题\",\"作者\":\"学生昵称\",\"日期\":\"YYYY-MM-DD\",\"正文\":\"帖子正文\",\"评论\":[{\"作者\":\"昵称\",\"内容\":\"评论\"}]}]}。热点最多 6 条，帖子每栏 3–5 条，标题不超过 80 字，正文不超过 600 字，评论最多 4 条。`;
        const userPrompt = `当前剧情日期：${storyDate || '未记录'}\n本次热点时间范围：当前剧情日及之前 ${this.lookbackDays - 1} 天。\n参考世界书：${selectedBooks.map(book => book.name).join('、')}\n\n【时间线候选事件】\n${timelineText}\n\n请严格按 JSON 结构生成栏目：${sections.join('、')}。`;
        const context = window.SillyTavern?.getContext?.() || {};
        const configuredMaxTokens = Number.parseInt(context.max_response_length, 10) || Number.parseInt(context.max_length, 10) || 6000;
        const result = await apiManager.callAI([
            { role: 'system', name: 'SYSTEM (校园论坛规则)', content: system, isPhoneMessage: true },
            { role: 'user', name: '校园论坛请求', content: userPrompt, isPhoneMessage: true }
        ], { appId: 'campus_forum', max_tokens: Math.max(6000, configuredMaxTokens) });
        if (!result?.success) throw new Error(result?.error || '校园论坛生成失败');

        const parsed = parseJsonPayload(result.summary || result.content || result.text || '');
        const rawPosts = Array.isArray(parsed.帖子) ? parsed.帖子 : (Array.isArray(parsed.posts) ? parsed.posts : []);
        const postsBySection = {};
        sections.forEach(section => { postsBySection[section] = []; });
        rawPosts.forEach(post => {
            const section = safeText(post?.板块 || post?.section, 24);
            if (!Object.prototype.hasOwnProperty.call(postsBySection, section)) return;
            const normalized = normalizePost(post, section);
            if (normalized && postsBySection[section].length < 5) postsBySection[section].push(normalized);
        });
        const underfilled = sections.filter(section => postsBySection[section].length < 3);
        if (underfilled.length > 0) throw new Error(`以下栏目帖子不足 3 条，请重新刷新：${underfilled.join('、')}`);

        const hotspots = (Array.isArray(parsed.热点) ? parsed.热点 : (Array.isArray(parsed.hotspots) ? parsed.hotspots : []))
            .slice(0, 6)
            .map(item => ({
                date: getDateText(item?.日期 || item?.date),
                event: safeText(item?.事件 || item?.event, 300),
                basis: safeText(item?.依据 || item?.basis, 240),
                heat: ['低', '中', '高'].includes(String(item?.热度 || item?.heat || '')) ? String(item?.热度 || item?.heat) : '低'
            }))
            .filter(item => item.date && item.event && item.basis && !PRIVATE_EVENT_PATTERN.test(item.event));
        const feed = {
            storyDate,
            generatedAt: Date.now(),
            sourceBooks: selectedBooks.map(book => book.name),
            sections,
            postsBySection,
            hotspots
        };
        return this.saveFeed(feed);
    }
}

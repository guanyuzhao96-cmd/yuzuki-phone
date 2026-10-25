import { latestMvuSnapshot } from '../dossier/dossier-data.js';

export const CAMPUS_FORUM_APP_KEY = 'campus_forum';
export const CAMPUS_FORUM_PUBLIC_SECTIONS = ['恋爱八卦', '校园女神', '偶遇目击', '表白寻人', '匿名树洞'];
const GENERATED_FEED_KEY = 'campus_forum_generated_feed';
const FORUM_SYSTEM_PROMPT = `你是校园论坛内容生成器。严格遵守以下规则，只返回一个 JSON 对象，不要解释、不要 Markdown。回复的第一个字符必须是 {，最后一个字符必须是 }：
1. 公开板块固定为：${CAMPUS_FORUM_PUBLIC_SECTIONS.join('、')}。每个公开板块准确生成 3 条帖子（符合 3–5 条要求）；每帖只写 1 条简短评论。只有暗线权限已解锁时，才可额外生成“暗线”帖子。
2. 帖子只围绕给定剧情时间线和校园恋爱话题。不得补写主角行为、确认角色关系、编造时间线热点或把旧事写成刚发生。
3. 事件发生不代表公众知情。公开热点或公开帖子只能采用“公开场合目击、本人公开发布、或剧情明确出现传播”的内容，并写出传播/目击依据。私下关系、秘密、未公开信息和读心结果不得进入公开板块。
4. 帖子日期必须是当前剧情日期或之前五个剧情日内的有效日期，不得晚于当前剧情日期。热点最多 6 条，只能从编号时间线候选事件中选择；每条热点必须带 source_event_index 和公开依据。没有合格热点时返回空数组。
5. 只返回如下结构：{"帖子":[{"板块":"恋爱八卦","标题":"","作者":"","日期":"YYYY-MM-DD","正文":"","评论":[{"作者":"","内容":""}]}],"热点":[{"source_event_index":1,"日期":"YYYY-MM-DD","事件":"","依据":"","热度":"低|中|高"}]}`;

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
    let source = String(rawText || '')
        .replace(/<think>[\s\S]*?<\/think>/gi, '')
        .replace(/<think>[\s\S]*$/gi, '')
        .replace(/^[\s\S]*?<\/think>/i, '')
        .trim();
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
        this._generatedFeed = this._readGeneratedFeed();
        this._generatePromise = null;
        this._books = [];
        this.lookbackDays = Math.max(3, Math.min(5, Number(this.storage?.get?.('campus_forum_lookback_days') || 5)));
    }

    getFeed() {
        const currentStoryDate = getStoryDate()?.iso || '';
        if (this._generatedFeed && this._generatedFeed.storyDate === currentStoryDate) {
            this._feed = this._generatedFeed;
            return this._feed;
        }
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

    _readGeneratedFeed() {
        const saved = this.storage?.get?.(GENERATED_FEED_KEY, null);
        if (typeof saved === 'string') {
            try { return JSON.parse(saved); } catch (_) { return null; }
        }
        return saved && typeof saved === 'object' ? saved : null;
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
            entries.filter(isTimelineEntry).forEach(entry => {
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
        if (this._generatePromise) return this._generatePromise;
        this._generatePromise = this._generateFeed().finally(() => { this._generatePromise = null; });
        return this._generatePromise;
    }

    async _generateFeed() {
        await this.loadWorldbooks(true);
        const selectedBooks = this.getSelectedBooks();
        if (selectedBooks.length === 0) throw new Error('请先在设置中选择一本文字时间线所在的世界书');
        const timelineEvents = this.getTimelineEvents();
        const storyDate = getStoryDate()?.iso || '';
        const { sections, hiddenUnlocked } = this.getBoardState();
        const apiManager = window.VirtualPhone?.apiManager;
        if (!apiManager?.callAI) throw new Error('API Manager 尚未就绪，请重新打开校园论坛后重试');
        const promptEvents = timelineEvents.slice(0, 16);
        const timelineText = promptEvents.length
            ? promptEvents.map((item, index) => `[${index + 1}] ${item.date}｜${item.event.slice(0, 240)}（来源：${item.source}）`).join('\n')
            : '所选世界书中没有找到日期范围内的可用时间线事件；不得补造热点，只能生成不影响主线的一般恋爱话题。';
        const oldFeed = this.getFeed();
        const oldPosts = Object.values(oldFeed?.postsBySection || {}).flat();
        const request = [
            `当前剧情日期：${storyDate || '未记录'}`,
            `热点范围：当前剧情日及之前 ${this.lookbackDays - 1} 天。`,
            `参考世界书：${selectedBooks.map(book => book.name).join('、')}`,
            `暗线权限：${hiddenUnlocked ? '已解锁，可以生成暗线板块' : '未解锁，不能生成暗线内容'}`,
            `栏目：${sections.join('、')}`,
            `已知时间线候选（只可据此生成热点）：\n${timelineText}`,
            `当前论坛帖子（仅标题，用于避免重复）：\n${oldPosts.length ? oldPosts.slice(-10).map(post => `- ${post.date}｜${post.section}｜${String(post.title || '').slice(0, 60)}`).join('\n') : '暂无'}`,
            '请按系统规则生成论坛内容。公开内容必须有明确的公开目击、本人公开发布或传播依据；对没有公开依据的剧情只能生成不涉及该秘密的一般校园恋爱话题。'
        ].join('\n\n');
        const context = window.SillyTavern?.getContext?.() || {};
        const configuredMaxTokens = Number.parseInt(context.max_response_length, 10)
            || Number.parseInt(context.max_length, 10) || 2048;
        let parsed = null;
        let parseError = null;
        let rawText = '';
        // Five public boards can produce 15–25 posts (plus an optional hidden
        // board). A 4k-token floor is often too small and encourages truncated
        // or explanatory responses, so leave room for the complete JSON.
        const outputTokenLimit = Math.max(8000, configuredMaxTokens);
        for (let attempt = 0; attempt < 2; attempt += 1) {
            const controller = typeof AbortController === 'function' ? new AbortController() : null;
            const timeout = setTimeout(() => controller?.abort(), 240000);
            let response;
            const retryInstruction = attempt === 0 ? '' : '\n\n上一次回复未通过 JSON 或栏目完整性校验。请重新生成完整结果，不要解释、不要 Markdown、不要代码围栏；只输出一个以 { 开始、以 } 结束的 JSON 对象，字段必须为“帖子”和“热点”。所有请求栏目都必须各有 3 条帖子。';
            try {
                response = await apiManager.callAI([
                    { role: 'system', name: 'SYSTEM (校园论坛规则)', content: FORUM_SYSTEM_PROMPT, isPhoneMessage: true },
                    { role: 'user', content: `${request}${retryInstruction}`, isPhoneMessage: true }
                ], {
                    appId: 'x',
                    max_tokens: outputTokenLimit,
                    stream: false,
                    signal: controller?.signal
                });
            } catch (error) {
                if (controller?.signal.aborted) throw new Error('论坛生成超时，已中断本次请求');
                throw error;
            } finally {
                clearTimeout(timeout);
            }
            if (!response?.success) throw new Error(response?.error || '论坛内容生成失败');
            const responseText = response.summary || response.content || response.text || response.output_text || '';
            rawText = Array.isArray(responseText)
                ? responseText.map(part => String(part?.text || part?.content || '')).join('\n').trim()
                : String(responseText || '').trim();
            try {
                const candidate = parseJsonPayload(rawText);
                const candidatePayload = candidate?.论坛 && typeof candidate.论坛 === 'object' ? candidate.论坛 : candidate;
                const candidatePosts = candidatePayload?.帖子 || candidatePayload?.posts || candidatePayload?.forum_view;
                if (!Array.isArray(candidatePosts)) throw new Error('论坛生成结果缺少帖子列表');
                const sectionCounts = Object.fromEntries(sections.map(section => [section, 0]));
                candidatePosts.forEach(post => {
                    const section = safeText(post?.板块 || post?.section, 24);
                    if (Object.prototype.hasOwnProperty.call(sectionCounts, section)) sectionCounts[section] += 1;
                });
                const missing = sections.filter(section => sectionCounts[section] < 3);
                if (missing.length) throw new Error(`论坛 JSON 栏目不完整：${missing.join('、')}`);
                parsed = candidate;
                break;
            } catch (error) {
                parseError = error;
            }
        }
        if (!parsed) {
            const preview = rawText.replace(/\s+/g, ' ').slice(0, 180);
            throw new Error(`${parseError?.message || '论坛 JSON 解析失败'}；已自动重试一次。模型返回：${preview || '（空内容）'}`);
        }
        const payload = parsed?.论坛 && typeof parsed.论坛 === 'object' ? parsed.论坛 : parsed;
        const rawPosts = payload?.帖子 || payload?.posts || payload?.forum_view || [];
        if (!Array.isArray(rawPosts)) throw new Error('论坛生成结果缺少帖子列表');
        const postsBySection = Object.fromEntries(sections.map(section => [section, []]));
        rawPosts.slice(0, 35).forEach(rawPost => {
            const section = safeText(rawPost?.板块 || rawPost?.section, 24);
            if (!postsBySection[section] || postsBySection[section].length >= 5) return;
            const post = normalizePost(rawPost, section, storyDate);
            if (!post || (section !== '暗线' && PRIVATE_EVENT_PATTERN.test(`${post.title}\n${post.content}\n${post.comments.map(item => item.content).join('\n')}`))) return;
            const parsedDate = normalizeDateParts(post.date);
            const age = parsedDate && normalizeDateParts(storyDate) ? daysBetween(normalizeDateParts(storyDate).date, parsedDate.date) : 0;
            if (!parsedDate || parsedDate.iso > storyDate || age > 4) return;
            postsBySection[section].push(post);
        });
        const missingSections = sections.filter(section => postsBySection[section].length < 3);
        if (missingSections.length) throw new Error(`以下栏目未生成足够的有效帖子（每栏至少 3 条）：${missingSections.join('、')}，请重试`);
        const rawHotspots = payload?.热点 || payload?.hotspots || [];
        const hotspots = (Array.isArray(rawHotspots) ? rawHotspots : []).slice(0, 6).map(item => {
            const sourceIndex = Number(item?.source_event_index ?? item?.来源事件序号) - 1;
            const source = timelineEvents[sourceIndex];
            if (!source || !isPubliclyDiscussable(source.event)) return null;
            const basis = safeText(item?.依据 || item?.basis, 240);
            if (!basis || PRIVATE_EVENT_PATTERN.test(basis)) return null;
            return {
                date: source.date,
                event: safeText(item?.事件 || item?.event, 300) || source.event,
                basis,
                heat: ['低', '中', '高'].includes(String(item?.热度 || item?.heat || '')) ? String(item?.热度 || item?.heat) : '低'
            };
        }).filter(Boolean);
        const feed = {
            storyDate,
            sections,
            postsBySection,
            hotspots,
            sourceBooks: selectedBooks.map(book => book.name),
            fromMvu: false,
            generatedAt: Date.now()
        };
        this._generatedFeed = feed;
        this._feed = feed;
        await this.storage?.set?.(GENERATED_FEED_KEY, feed);
        return { feed, selectedBooks: feed.sourceBooks, storyDate };
    }
}

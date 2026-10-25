import assert from 'node:assert/strict';
import test from 'node:test';

globalThis.window = {
    SillyTavern: { getContext: () => ({ chat: [], max_response_length: 2048 }) },
    VirtualPhone: {
        timeManager: { getCurrentStoryTime: () => ({ date: '2025-09-01' }) },
        worldbookManager: {
            getSelection: () => ['world:校园时间线'],
            async listAvailableWorldbooks() {
                return [{
                    id: 'world:校园时间线',
                    name: '校园时间线',
                    allEntries: [{
                        comment: '故事时间线',
                        content: '【故事时间线】\n2025-09-01｜迎新活动在操场举行，数百名学生到场。'
                    }]
                }];
            }
        }
    }
};

const { CampusForumData, CAMPUS_FORUM_PUBLIC_SECTIONS } = await import('../apps/campus-forum/campus-forum-data.js');
const { CampusForumView } = await import('../apps/campus-forum/campus-forum-view.js');

test('读取所选世界书时间线，并在非 JSON 首答后重试、生成并保存完整栏目', async () => {
    const saved = new Map();
    const storage = {
        get(key, fallback) { return saved.has(key) ? saved.get(key) : fallback; },
        set(key, value) { saved.set(key, value); }
    };
    const requests = [];
    const posts = CAMPUS_FORUM_PUBLIC_SECTIONS.flatMap(section => Array.from({ length: 3 }, (_, index) => ({
        板块: section,
        标题: `${section}测试帖${index + 1}`,
        作者: `同学${index + 1}`,
        日期: '2025-09-01',
        正文: '迎新活动后，有同学分享了现场见闻；帖子只讨论公开活动，不推断私人关系。',
        评论: [{ 作者: '路过同学', 内容: '现场确实很热闹。' }]
    })));
    const validJson = JSON.stringify({
        帖子: posts,
        热点: [{ source_event_index: 1, 日期: '2025-09-01', 事件: '迎新活动受到关注', 依据: '操场公开活动，学生现场目击', 热度: '中' }]
    });
    window.VirtualPhone.apiManager = {
        async callAI(messages, options) {
            requests.push({ messages, options });
            if (requests.length === 1) return { success: true, summary: '我先整理论坛内容。' };
            return { success: true, summary: `\`\`\`json\n${validJson}\n\`\`\`` };
        }
    };

    const data = new CampusForumData(storage);
    const result = await data.generateFeed();

    assert.equal(requests.length, 2, '非 JSON 首答应触发一次格式纠正重试');
    assert.match(requests[0].messages[1].content, /迎新活动在操场举行/);
    assert.match(requests[1].messages[1].content, /上一次回复未通过 JSON 或栏目完整性校验/);
    assert.equal(requests[0].options.max_tokens, 8000);
    assert.equal(result.feed.sourceBooks[0], '校园时间线');
    for (const section of CAMPUS_FORUM_PUBLIC_SECTIONS) {
        assert.equal(result.feed.postsBySection[section].length, 3, `${section}应有3条帖子`);
    }
    assert.equal(result.feed.hotspots.length, 1);
    assert.ok(saved.has('campus_forum_generated_feed'), '完整论坛结果应保存到当前会话存储');
});

test('生成失败时保留完整 AI 原文，并可下载为 txt 文件', async () => {
    const saved = new Map();
    const storage = {
        get(key, fallback) { return saved.has(key) ? saved.get(key) : fallback; },
        set(key, value) { saved.set(key, value); }
    };
    const originalReply = '模型原始回复：\n```json\n{"论坛内容":{"分区帖子":[]}}\n```\n结尾原文';
    window.VirtualPhone.apiManager = {
        async callAI() { return { success: true, summary: originalReply }; }
    };
    const data = new CampusForumData(storage);
    await assert.rejects(data.generateFeed(), /论坛生成结果缺少帖子列表/);
    assert.equal(data.getLastAIResponse(), originalReply, '失败后应完整保留最后一次 AI 回复');

    const anchor = { style: {}, click() { this.clicked = true; }, remove() { this.removed = true; } };
    const originalDocument = globalThis.document;
    let downloadedBlob = null;
    window.URL = { createObjectURL(blob) { downloadedBlob = blob; return 'blob:test-ai-reply'; }, revokeObjectURL() {} };
    globalThis.document = {
        createElement(tag) { assert.equal(tag, 'a'); return anchor; },
        body: { appendChild(node) { assert.equal(node, anchor); } }
    };
    try {
        const view = new CampusForumView({});
        view._failedResponse = data.getLastAIResponse();
        assert.equal(view.downloadFailedResponse(), true);
        assert.equal(anchor.clicked, true);
        assert.equal(anchor.removed, true);
        assert.match(anchor.download, /^校园论坛-AI原始回复-.*\.txt$/);
        assert.equal(await downloadedBlob.text(), originalReply, '下载文件应保留 AI 原文，不截断、不改写');
    } finally {
        globalThis.document = originalDocument;
        delete window.URL;
    }
});

test('识别栏目、内容、发布时间字段和字符串评论，并保留合规树洞帖子', async () => {
    const saved = new Map();
    const storage = {
        get(key, fallback) { return saved.has(key) ? saved.get(key) : fallback; },
        set(key, value) { saved.set(key, value); }
    };
    const posts = CAMPUS_FORUM_PUBLIC_SECTIONS.flatMap(section => Array.from({ length: 3 }, (_, index) => ({
        栏目: section,
        标题: `${section}兼容测试帖${index + 1}`,
        作者: `同学${index + 1}`,
        发布时间: '2025-09-01 13:20',
        内容: section === '匿名树洞' && index === 2
            ? '关于朋友间的秘密，要不要说出来？这里只讨论一般困惑，不涉及任何具体角色的隐私。'
            : '迎新活动后，同学分享了公开现场见闻，内容不推断他人的关系。',
        热度: '168',
        评论: ['别偷拍，尊重他人。', '我也参加了公开活动。']
    })));
    window.VirtualPhone.apiManager = {
        async callAI() { return { success: true, summary: JSON.stringify({ 帖子: posts, 热点: [] }) }; }
    };

    const data = new CampusForumData(storage);
    const result = await data.generateFeed();
    for (const section of CAMPUS_FORUM_PUBLIC_SECTIONS) {
        assert.equal(result.feed.postsBySection[section].length, 3, `${section}应读取三条帖子`);
        assert.equal(result.feed.postsBySection[section][0].comments[0].content, '别偷拍，尊重他人。');
        assert.equal(result.feed.postsBySection[section][0].date, '2025-09-01');
    }
});

test('兼容按栏目名分组的帖子对象，并在暗线未解锁时忽略暗线栏目', async () => {
    const saved = new Map();
    const storage = {
        get(key, fallback) { return saved.has(key) ? saved.get(key) : fallback; },
        set(key, value) { saved.set(key, value); }
    };
    const previousTime = window.VirtualPhone.timeManager.getCurrentStoryTime;
    window.VirtualPhone.timeManager.getCurrentStoryTime = () => ({ date: '2025-09-12' });
    const groupedPosts = Object.fromEntries(CAMPUS_FORUM_PUBLIC_SECTIONS.map(section => [section,
        Array.from({ length: 3 }, (_, index) => ({
            标题: `${section}分组帖${index + 1}`,
            内容: '公开场合的普通校园见闻。',
            发帖人: '路过同学',
            日期: '2025-09-12'
        }))
    ]));
    groupedPosts.暗线 = [{
        标题: '未公开的私下关系',
        内容: '这条秘密内容不应进入公开论坛。',
        发帖人: '暗线记录者',
        日期: '2025-09-12'
    }];
    window.VirtualPhone.apiManager = {
        async callAI() { return { success: true, summary: JSON.stringify({ 帖子: groupedPosts, 热点: [] }) }; }
    };

    try {
        const data = new CampusForumData(storage);
        const result = await data.generateFeed();
        for (const section of CAMPUS_FORUM_PUBLIC_SECTIONS) {
            assert.equal(result.feed.postsBySection[section].length, 3, `${section}分组帖子应被识别`);
        }
        assert.equal(result.feed.postsBySection.恋爱八卦[0].author, '路过同学', '应兼容发帖人字段');
        assert.equal(result.feed.postsBySection.恋爱八卦[0].comments[0].content, '蹲后续，感谢分享。', '没有评论时应提供不增加事实的默认跟帖');
        assert.equal(result.feed.postsBySection.暗线, undefined, '未解锁时不创建暗线栏目');
    } finally {
        window.VirtualPhone.timeManager.getCurrentStoryTime = previousTime;
    }
});

test('点击帖子卡片后进入可滚动详情并显示评论', () => {
    const post = {
        section: '恋爱八卦',
        title: '测试帖子标题',
        author: '测试同学',
        date: '2025-09-01',
        content: '这是完整的帖子正文。',
        comments: [{ author: '路过同学', content: '这条评论应在详情中显示。' }]
    };
    let cardClick;
    let renderedHtml = '';
    const backButton = { addEventListener() {} };
    const cardButton = {
        dataset: { forumPostIndex: '0' },
        addEventListener(eventName, callback) { if (eventName === 'click') cardClick = callback; }
    };
    const root = {
        querySelector(selector) { return selector === '.campus-forum-detail-back' ? backButton : null; },
        querySelectorAll(selector) { return selector === '[data-forum-post-index]' ? [cardButton] : []; }
    };
    const originalDocument = globalThis.document;
    globalThis.document = { querySelector() { return root; } };
    try {
        const view = new CampusForumView({
            data: {
                getFeed() { return { storyDate: '2025-09-01', sections: ['恋爱八卦'], postsBySection: { '恋爱八卦': [post] } }; },
                getBoardState() { return { sections: ['恋爱八卦'] }; },
                lookbackDays: 5
            },
            phoneShell: { setContent(html) { renderedHtml = html; } }
        });
        view.render();
        assert.equal(typeof cardClick, 'function', '帖子卡片应绑定点击事件');
        cardClick();
        assert.equal(view.currentView, 'post');
        assert.match(renderedHtml, /campus-forum-post-detail-scroll/);
        assert.match(renderedHtml, /这是完整的帖子正文/);
        assert.match(renderedHtml, /这条评论应在详情中显示/);
    } finally {
        globalThis.document = originalDocument;
    }
});

test('论坛只自动生成最多两张必要配图，并通过插件图片管理器保存', async () => {
    const saved = new Map();
    const storage = {
        get(key, fallback) { return saved.has(key) ? saved.get(key) : fallback; },
        set(key, value) { saved.set(key, value); }
    };
    const calls = [];
    const previousImageGenerationManager = window.VirtualPhone.imageGenerationManager;
    const previousImageManager = window.VirtualPhone.imageManager;
    window.VirtualPhone.imageGenerationManager = {
        async generate(options) {
            calls.push(options);
            return { imageData: 'data:image/png;base64,AA==', provider: 'mock-provider', model: 'mock-model' };
        }
    };
    window.VirtualPhone.imageManager = {
        async uploadDataUrl(_dataUrl, prefix) { return `/backgrounds/${prefix}-${calls.length}.png`; }
    };
    try {
        const feed = {
            storyDate: '2025-09-01',
            fromMvu: false,
            postsBySection: {
                校园女神: Array.from({ length: 3 }, (_, index) => ({
                    section: '校园女神', title: `公开活动${index + 1}`, content: '活动现场照片',
                    imagePrompt: `public campus event ${index + 1}`, imageStatus: 'pending', imageUrl: ''
                }))
            }
        };
        const data = new CampusForumData(storage);
        await data.generateNecessaryImages(feed);
        assert.equal(calls.length, 2, '每批最多自动生成两张必要配图');
        assert.ok(calls.every(call => call.app === 'x'), '应复用 X 模块绑定的图片生成配置');
        assert.equal(feed.postsBySection.校园女神[0].imageStatus, 'done');
        assert.equal(feed.postsBySection.校园女神[1].imageStatus, 'done');
        assert.equal(feed.postsBySection.校园女神[2].imageStatus, 'pending', '超出上限的配图不应自动调用');
        assert.match(feed.postsBySection.校园女神[0].imageUrl, /^\/backgrounds\//);
        assert.ok(saved.has('campus_forum_generated_feed'), '配图状态应与帖子结果一同保存');
    } finally {
        window.VirtualPhone.imageGenerationManager = previousImageGenerationManager;
        window.VirtualPhone.imageManager = previousImageManager;
    }
});

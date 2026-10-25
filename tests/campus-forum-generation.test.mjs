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

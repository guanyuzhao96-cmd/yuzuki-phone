import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const updateLog = JSON.parse(fs.readFileSync(new URL('../update-log.json', import.meta.url), 'utf8'));
const manifest = JSON.parse(fs.readFileSync(new URL('../manifest.json', import.meta.url), 'utf8'));
const indexSource = fs.readFileSync(new URL('../index.js', import.meta.url), 'utf8');

test('current version publishes the full iOS visual replacement', () => {
    const current = updateLog.versions[manifest.version];

    assert.equal(manifest.version, '1.6.9');
    assert.match(indexSource, /const ST_PHONE_VERSION = '1\.6\.9';/);
    assert.equal(Object.keys(updateLog.versions)[0], '1.6.9');
    assert.equal(current.date, '2026-10-20');
    assert.deepEqual(current.items, [
        '【图标更新】替换所有默认桌面应用与悬浮入口图标，并统一付款凭证顶部素材。',
        '【背景更新】更新默认壁纸，并迁移旧版内置默认壁纸与默认应用图标。',
        '【样式更新】将手机外壳、动态岛、状态栏、Dock、应用导航、卡片、弹窗和表单统一为 iOS 风格。'
    ]);
    assert.equal(current.updates, undefined);
});

test('local update announcements are acknowledged by version and date', () => {
    assert.match(indexSource, /function normalizeUpdateLogEntry\(version, entry\)/);
    assert.match(indexSource, /phone-update-announcement-seen-release/);
    assert.match(indexSource, /const announcementId = `\$\{ST_PHONE_VERSION\}@\$\{String\(notes\?\.date/);
    assert.match(indexSource, /rememberValue: announcementId/);
    assert.match(indexSource, /options\.rememberValue \|\| version/);
});

test('fallback announcement matches the 1.6.9 visual replacement', () => {
    const start = indexSource.indexOf('const ST_PHONE_CURRENT_UPDATE =');
    const end = indexSource.indexOf('\n};', start);
    assert.ok(start >= 0 && end > start, 'fallback update block should exist');

    const block = indexSource.slice(start, end);
    assert.match(block, /date: '2026-10-20'/);
    for (const item of updateLog.versions[manifest.version].items) {
        assert.ok(block.includes(item), 'fallback should include each current announcement item');
    }
});

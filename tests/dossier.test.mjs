import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCharacters, parseFields, visibleFields, flattenMvu, latestMvu, escapeHtml, findMvuRole, formatMvuValue, latestMvuSnapshot, MVU_ROLE_FIELDS } from '../apps/dossier/dossier-data.js';
import { WorldbookManager } from '../config/worldbook-manager.js';

test('automatic directory discovery includes attached global, main, extra and chat books only', async () => {
    const manager = new WorldbookManager();
    const context = { characterId: 0, characters: [{ avatar: '角色甲.png', data: { extensions: { world: '主世界书' } } }], chatMetadata: { world_info: '聊天世界书' } };
    const module = { selected_world_info: ['全局世界书'], world_info: { globalSelect: ['全局世界书'], charLore: [ { name: '角色甲', extraBooks: ['故事线一', '故事线二'] }, { name: '其他角色', extraBooks: ['无关世界书'] } ] } };
    manager._getContext = () => context;
    manager._loadWorldInfoModule = async () => module;
    assert.deepEqual(await manager.getDossierDefaultBooks(), ['全局世界书', '故事线一', '故事线二', '主世界书', '聊天世界书']);
    context.chatMetadata.world_info = '新聊天世界书';
    assert.equal((await manager.getDossierDefaultBooks()).at(-1), '新聊天世界书');
});

const book = (name = '故事线甲') => ({ name, entries: [
    { uid: 'dir', comment: 'CWB目录｜故事线', content: '【小故事线目录】\n姓名: "肖雨欣"\n姓名: "赵思琪"' },
    { uid: 'static', comment: '肖雨欣', content: '<肖雨欣>\n姓名: "肖雨欣"\n年龄: "20岁"\n性格:\n  核心特质: ["开朗"]\n</肖雨欣>' },
    { uid: 'dynamic', comment: '动态-肖雨欣', content: '[--角色档案开始--]\n[姓名]:肖雨欣\n[角色已知信息.0]:知道秘密\n[剧情.0]:2025-09-02｜确认关系\n[--角色档案结束--]' }
] });

test('directory finds every character, missing profiles remain visible and static/dynamic stay separate', () => {
    const result = buildCharacters([book()]);
    assert.equal(result.length, 2);
    assert.deepEqual(result[0].sources.map(s => s.type), ['static', 'dynamic']);
    assert.equal(result[1].sources.length, 0);
    assert.equal(result[0].sources[0].uid, 'static');
    assert.deepEqual(parseFields(result[0].sources[0].content).map(f => f.label), ['姓名', '年龄', '性格']);
});

test('same names across storylines never merge', () => {
    const result = buildCharacters([book(), book('故事线乙')]);
    assert.equal(result.length, 4);
    assert.notEqual(result[0].id, result[2].id);
});

test('ambiguous dynamic entries are retained for explicit source selection', () => {
    const source = book();
    source.entries.push({ ...source.entries[2], uid: 'other-branch' });
    assert.equal(buildCharacters([source])[0].sources.filter(s => s.type === 'dynamic').length, 2);
});

test('field parsing keeps repeated indexed knowledge and multiline text', () => {
    const fields = parseFields('[角色已知信息.0]:甲\n[角色已知信息.1]:乙\n补充行\n[--角色档案结束--]');
    assert.deepEqual(fields, [{ label: '角色已知信息', value: '甲' }, { label: '角色已知信息', value: '乙\n补充行' }]);
});

test('ordinary display excludes system/task clauses without mutating original fields', () => {
    const fields = [{ label: '角色未知信息', value: '甲有系统；甲与乙确认恋爱' }, { label: '任务', value: '获得奖励' }];
    const original = JSON.stringify(fields);
    assert.deepEqual(visibleFields(fields), [{ label: '角色未知信息', value: '甲与乙确认恋爱' }]);
    assert.equal(JSON.stringify(fields), original);
});

test('MVU pointers preserve unusual names, zero, false and null without writes', () => {
    const data = { '肖.雨/欣': { 好感: 0, 状态: false, 备注: null } };
    const before = JSON.stringify(data);
    assert.deepEqual(flattenMvu(data), [ { path: '/肖.雨~1欣/好感', value: 0 }, { path: '/肖.雨~1欣/状态', value: false }, { path: '/肖.雨~1欣/备注', value: null } ]);
    assert.equal(JSON.stringify(data), before);
    assert.equal(flattenMvu({ a: 1, b: 2 }, 1).length, 1);
});

test('latest MVU searches backward rather than requiring final message to own data', () => {
    const chat = [{ stat_data: { 好感: 3 } }, { stat_data: { 好感: 8 } }, { mes: '正文' }];
    assert.deepEqual(latestMvu(chat), { data: { 好感: 8 }, floor: 1, source: 'chat' });
    assert.equal(latestMvu([]), null);
});

test('MVU dossier fields match the formal role name and preserve source data', () => {
    const data = { stat_data: { roles: {
        role_17: { role_name: '秦雅楠', grade: 'SS', affection: 0, relationship: '师生暧昧', quests: [], longTermGoal: null },
        role_18: { role_name: '周韵涵', affection: 72 },
    } } };
    const before = JSON.stringify(data);
    const found = findMvuRole(data, '秦雅楠');
    assert.equal(found.status, 'matched');
    assert.equal(found.id, 'role_17');
    assert.equal(found.role.affection, 0);
    assert.equal(formatMvuValue(found.role.longTermGoal), '未记录');
    assert.ok(MVU_ROLE_FIELDS.some(([key]) => key === 'approachEvidence'));
    assert.ok(MVU_ROLE_FIELDS.some(([key]) => key === 'quests'));
    assert.equal(JSON.stringify(data), before);
});

test('MVU role matching refuses ambiguous and approximate names', () => {
    assert.equal(findMvuRole({ roles: { a: { role_name: '秦雅楠' }, b: { role_name: '秦雅楠' } } }, '秦雅楠').status, 'ambiguous');
    assert.equal(findMvuRole({ roles: { qinyanan: { role_name: '秦雅楠2' } } }, '秦雅楠').status, 'missing');
});

test('latest MVU API read is preferred and falls back to serialized chat data', () => {
    let args;
    const snapshot = latestMvuSnapshot(input => { args = input; return { stat_data: { roles: { 秦雅楠: {} } } }; }, []);
    assert.deepEqual(args, { type: 'message', message_id: 'latest' });
    assert.equal(snapshot.source, 'MVU');
    assert.ok(snapshot.data.roles.秦雅楠);
    const fallback = latestMvuSnapshot(() => { throw new Error('not ready'); }, [{ stat_data: { roles: {} } }]);
    assert.equal(fallback.source, 'chat');
});

test('worldbook strings are escaped before entering HTML', () => {
    assert.equal(escapeHtml('<img onerror="x">'), '&lt;img onerror=&quot;x&quot;&gt;');
});

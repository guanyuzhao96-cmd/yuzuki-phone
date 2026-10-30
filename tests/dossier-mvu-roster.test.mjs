import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMvuCharacters, listMvuCharacters, latestMvuSnapshot } from '../apps/dossier/dossier-data.js';
import { DossierApp } from '../apps/dossier/dossier-app.js';

const worldbook = (name = '故事线', roleName = '周韵涵') => ({name, entries: [
    {uid: 'dir', comment: 'CWB目录', content: '【小故事线目录】\n姓名: "' + roleName + '"\n姓名: "世界书独有角色"'},
    {uid: 'static', comment: roleName, content: '姓名: "' + roleName + '"\n年龄: 20\n角色等级: B\n身高: 168\n专业: 文学'},
    {uid: 'dynamic', comment: '动态-' + roleName, content: '[--角色档案开始--]\n[姓名]:' + roleName + '\n[剧情.0]:世界书剧情'},
    {uid: 'other', comment: '动态-世界书独有角色', content: '[--角色档案开始--]\n[姓名]:世界书独有角色\n[剧情.0]:未录入MVU'}
]});
const snapshot = roles => ({stat_data: {roles}});
function fixture(roles = {'周韵涵': {好感度: 0, 角色等级: 'SSS'}}) {
    const previous = globalThis.window;
    const ctx = {characterId: 1, chatId: 'a', chat: [snapshot(roles)]};
    const order = [], reads = [];
    let data = snapshot(roles);
    globalThis.window = {SillyTavern: {getContext: () => ctx}, Mvu: {getMvuData: () => {order.push('mvu'); return structuredClone(data);}}};
    const app = Object.create(DossierApp.prototype);
    const prefs = {};
    Object.assign(app, {characters: [], books: [], indexes: [], errors: [], sequence: 0, active: true});
    app.storage = {get: () => prefs, set: () => {throw Error('reads must not save preferences');}};
    app.isActive = () => true;
    app.draw = () => {};
    app.manager = {
        getDossierDefaultBooks: async () => {order.push('books'); return ['故事线'];},
        fetchAllAvailableWorldBooks: async () => [{name: '故事线'}, {name: '未激活世界书'}, {name: '无关世界书'}],
        readDossierWorldbook: async name => {reads.push(name); return name === '故事线' ? worldbook() : worldbook(name, name === '未激活世界书' ? '只有MVU资料' : '无关人物');}
    };
    return {app, ctx, prefs, order, reads, setRoles(roles) {data = snapshot(roles);},
        cleanup() {if (previous === undefined) delete globalThis.window; else globalThis.window = previous;}};
}

test('MVU defines exact membership; directory-only characters never enter the collection', () => {
    const data = snapshot({'周韵涵': {好感度: 0}, '只有MVU资料': {堕落值: 0}, $meta: {extensible: true}});
    const original = structuredClone(data);
    const roles = buildMvuCharacters([worldbook()], data);
    assert.deepEqual(roles.map(role => role.name), ['周韵涵', '只有MVU资料']);
    assert.deepEqual(roles[0].sources.map(source => source.type), ['static', 'dynamic']);
    assert.equal(roles[1].sources.length, 0);
    assert.deepEqual(data, original);
    assert.deepEqual(buildMvuCharacters([worldbook()], snapshot({})), []);
});

test('MVU IDs support formal names, exclude metadata and preserve distinct same-name records', () => {
    const roles = listMvuCharacters(snapshot({r1: {role_name: '周韵涵'}, r2: {姓名: '秦雅楠'}, r3: {role_name: '周韵涵'}, $meta: {}, invalid: null, array: []}));
    assert.deepEqual(roles.map(role => role.name), ['周韵涵', '秦雅楠', '周韵涵']);
    const built = buildMvuCharacters([worldbook()], snapshot({r1: {role_name: '周韵涵'}, r2: {role_name: '周韵涵'}}));
    assert.notEqual(built[0].id, built[1].id);
});

test('MVU roles can enrich from static-only entries without directory or dynamic prerequisites', () => {
    const book = worldbook(); book.entries = [book.entries[1]];
    const roles = buildMvuCharacters([book], snapshot({'周韵涵': {}}));
    assert.equal(roles.length, 1);
    assert.equal(roles[0].sources[0].type, 'static');
    assert.equal(roles[0].directories.length, 0);
    assert.equal(buildMvuCharacters([], snapshot({'周韵涵': {}})).length, 1);
});

test('same UID in different books has independent source identity', () => {
    const roles = buildMvuCharacters([worldbook('甲'), worldbook('乙')], snapshot({'周韵涵': {}}));
    const sources = roles[0].sources.filter(source => source.type === 'static');
    assert.equal(sources.length, 2);
    assert.notEqual(sources[0].sourceKey, sources[1].sourceKey);
    assert.equal(roles.length, 1);
});

test('role relationship summaries enrich only MVU rows', () => {
    const book = {name: '关系', entries: [{comment: '角色关系汇总', content: '周韵涵 ↔ 秦雅楠：同事'}]};
    const roles = buildMvuCharacters([book], snapshot({'周韵涵': {}}));
    assert.equal(roles.length, 1);
    assert.equal(roles[0].otherRelationships[0].right, '秦雅楠');
});

test('latest MVU lookup reads the preceding numbered floor when the newest user message has no snapshot', () => {
    const calls = [];
    const data = snapshot({'周韵涵': {}});
    const result = latestMvuSnapshot(options => {calls.push(options.message_id); return options.message_id === 0 ? data : {};}, [{}, {}]);
    assert.deepEqual(calls, ['latest', 1, 0]);
    assert.deepEqual(result.data.roles, {'周韵涵': {}});
});

test('refresh reads MVU before book discovery and includes inactive worldbooks', async () => {
    const f = fixture({'周韵涵': {好感度: 0}, '只有MVU资料': {堕落值: 0}});
    try {
        await f.app.refresh();
        assert.equal(f.order[0], 'mvu');
        assert.ok(f.order.indexOf('books') > f.order.indexOf('mvu'));
        assert.ok(f.reads.includes('未激活世界书'));
        assert.deepEqual(f.app.characters.map(role => role.name), ['周韵涵', '只有MVU资料']);
        assert.ok(!f.app.books.includes('无关世界书'));
        assert.equal(f.app.characters[1].sources.length, 2);
    } finally {f.cleanup();}
});

test('empty MVU skips all worldbook discovery and clears old collection', async () => {
    const f = fixture({});
    try {
        f.app.characters = [{name: '旧人物'}];
        await f.app.refresh();
        assert.deepEqual(f.app.characters, []);
        assert.deepEqual(f.reads, []);
        assert.ok(!f.order.includes('books'));
    } finally {f.cleanup();}
});

test('quiet refresh avoids unrelated books while manual refresh rescans discovery', async () => {
    const f = fixture();
    try {
        await f.app.refresh();
        f.reads.length = 0;
        await f.app.refresh(true);
        assert.deepEqual(f.reads, ['故事线']);
        f.reads.length = 0;
        await f.app.refresh();
        assert.ok(f.reads.includes('无关世界书'));
    } finally {f.cleanup();}
});

test('MVU membership changes remove old rows and trigger source rediscovery', async () => {
    const f = fixture();
    try {
        await f.app.refresh();
        f.app.selected = f.app.characters[0].id;
        f.setRoles({'只有MVU资料': {好感度: 9}});
        f.reads.length = 0;
        await f.app.refresh(true);
        assert.deepEqual(f.app.characters.map(role => role.name), ['只有MVU资料']);
        assert.equal(f.app.selected, null);
        assert.ok(f.reads.includes('未激活世界书'));
    } finally {f.cleanup();}
});

test('worldbook read failure keeps MVU-only roles visible', async () => {
    const f = fixture();
    try {
        f.app.manager.readDossierWorldbook = async () => {throw Error('read failed');};
        await f.app.refresh();
        assert.equal(f.app.characters.length, 1);
        assert.equal(f.app.characters[0].sources.length, 0);
        assert.equal(f.app.mvu.data.roles.周韵涵.好感度, 0);
        assert.ok(f.app.errors.length);
    } finally {f.cleanup();}
});

test('source reads are bounded to four concurrent requests', async () => {
    const f = fixture();
    try {
        let active = 0, max = 0;
        f.app.manager.fetchAllAvailableWorldBooks = async () => Array.from({length: 10}, (_,i) => ({name: '书' + i}));
        f.app.manager.readDossierWorldbook = async name => {
            active++; max = Math.max(max, active);
            await new Promise(resolve => setTimeout(resolve, 1));
            active--; return worldbook(name);
        };
        await f.app.refresh();
        assert.equal(max, 4);
    } finally {f.cleanup();}
});

test('MVU grade and state beat worldbook values and saved avatars survive roster ID change', async () => {
    const f = fixture();
    try {
        const legacyId = JSON.stringify(['故事线', '周韵涵']);
        f.prefs.avatars = {[legacyId]: 'https://example.test/avatar.jpg'};
        f.prefs.sources = {[legacyId]: {static: 'static'}};
        await f.app.refresh();
        const role = f.app.characters[0];
        assert.equal(f.app.rolePrefs(role, 'avatars'), 'https://example.test/avatar.jpg');
        assert.equal(f.app.rolePrefs(role, 'sources').static, JSON.stringify(['故事线', 'static']));
        assert.match(f.app.roleList(), /avatar.jpg/);
        const html = f.app.details(role);
        assert.match(html, /SSS/);
        assert.match(html, /stat-value">0</);
    } finally {f.cleanup();}
});

test('two identical formal names still show the state of their own MVU ID', async () => {
    const f = fixture({r1: {role_name: '周韵涵', 好感度: 1}, r2: {role_name: '周韵涵', 好感度: 88}});
    try {
        await f.app.refresh();
        assert.equal(f.app.mvuMatch(f.app.characters[0]).role.好感度, 1);
        assert.equal(f.app.mvuMatch(f.app.characters[1]).role.好感度, 88);
    } finally {f.cleanup();}
});

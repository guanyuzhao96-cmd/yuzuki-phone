import assert from 'node:assert/strict';
import test from 'node:test';
import { WechatData } from '../apps/wechat/wechat-data.js';

test('contact import adds the full missing MVU roster despite incomplete enrichment', async t => {
    const previousWindow = globalThis.window;
    const previousTavern = globalThis.SillyTavern;
    t.after(() => {
        globalThis.window = previousWindow;
        globalThis.SillyTavern = previousTavern;
    });
    const roles = {
        self: {role_name: '主角'},
        old: {role_name: '已收录'},
        first: {role_name: '新角色', relationship: '同学'},
        second: {role_name: '只有MVU'},
        third: {role_name: '档案角色'}
    };
    globalThis.SillyTavern = {getContext: () => ({
        name1: '主角', Mvu: {getMvuData: () => ({stat_data: {roles}})}
    })};
    const books = [];
    globalThis.window = {VirtualPhone: {worldbookManager: {
        getDossierDefaultBooks: async () => ['读取失败'],
        fetchAllAvailableWorldBooks: async () => [{name: '未激活档案'}],
        readDossierWorldbook: async name => {
            books.push(name);
            if (name === '读取失败') throw Error('unavailable');
            return {name, entries: [{comment: '动态-档案角色', content: '姓名：档案角色\n性别：女'}]};
        }
    }}};
    const data = Object.create(WechatData.prototype);
    const existing = {id: 'old', name: '旧名字', remark: '已收录'};
    data.data = {contacts: [existing], chats: [{name: '旧聊天'}]};
    data.getStorageKey = () => 'chat-1';
    data.getFirstLetter = () => 'X';
    data.setContactGender = () => {};
    data.saveData = async () => {};
    data.buildContactPrompt = async (_, {contactCandidates}) => {
        assert.deepEqual(contactCandidates.map(role => role.name), ['新角色', '只有MVU', '档案角色']);
        assert.equal(contactCandidates[2].sources[0].book, '未激活档案');
        return [];
    };
    data.sendToAI = async () => 'partial';
    data.parseAIResponse = () => ({contacts: [
        {name: '新角色', relation: '旧关系', remark: '只有MVU'},
        {name: '名单外角色'}
    ]});
    assert.equal((await data.loadContactsFromCharacter()).count, 3);
    assert.deepEqual(books.sort(), ['未激活档案', '读取失败'].sort());
    assert.deepEqual(data.data.contacts.map(contact => contact.name), ['旧名字', '新角色', '只有MVU', '档案角色']);
    assert.equal(data.data.contacts[1].relation, '同学');
    assert.equal(data.data.contacts[1].remark, '');
    assert.equal(data.data.contacts[0], existing);
    assert.equal((await data.loadContactsFromCharacter()).count, 0);

    roles.extra = {role_name: '接口失败时新增'};
    data.buildContactPrompt = async () => [];
    data.sendToAI = async () => { throw Error('AI unavailable'); };
    assert.equal((await data.loadContactsFromCharacter()).count, 1);
    assert.equal(data.data.contacts.at(-1).name, '接口失败时新增');
});

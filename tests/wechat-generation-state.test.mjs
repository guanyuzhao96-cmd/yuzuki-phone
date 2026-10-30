import test from 'node:test';
import assert from 'node:assert/strict';
import { ChatView } from '../apps/wechat/chat-view.js';
import { WechatApp } from '../apps/wechat/wechat-app.js';
import { PromptManager } from '../config/prompt-manager.js';
import { buildMvuCharacters, parseFields } from '../apps/dossier/dossier-data.js';
import { readWechatRoleState, renderWechatAffectionBadge, buildWechatBehaviorPrompt,
    buildWechatReplyProtocol, extractWechatBehaviorRules } from '../apps/wechat/wechat-generation-context.js?v=20261030-mvu-chat-153';

const RULE = '好感反映对主角的情感亲疏与信任，欲望反映当下吸引和冲动，堕落反映心理抑制。高欲望低好感仍戒备；高好感低欲望可关心信任但无欲求。关系阶段沿用专属世界书。';
const books = [{name: '当前角色卡世界书', entries: [
    {uid: 'rules', comment: '三大动态数值、攻略阶段关系与角色目标', content: RULE},
    {uid: 'a', comment: '周韵涵', content: '姓名: 周韵涵\n性格: 克制\n攻略路线:\n  暧昧对象: 需要连续互动和明确回应\n阶段晋级条件: 先满足角色自己的约定'},
    {uid: 'b', comment: '秦雅楠', content: '姓名: 秦雅楠\n性格: 直接'}
]}];
function fixture() {
    const oldWindow = globalThis.window, oldDocument = globalThis.document;
    let stat = {roles: {
        '周韵涵': {好感度: 0, 欲望值: 80, 堕落值: 10, 与主角的关系: '女友线｜普通朋友', 当前目标: '完成报到'},
        '秦雅楠': {好感度: 90, 欲望值: 0, 堕落值: 60, 与主角的关系: '女友线｜暧昧对象'}
    }};
    const context = {characterId: 1, chatId: 'a', name1: '赵冠宇', name2: '旁白', chat: []};
    const contacts = [{id: 'a', name: '周韵涵'}, {id: 'b', name: '秦雅楠'}];
    const chat = {id: 'single-a', name: '周韵涵', type: 'single', contactId: 'a'};
    const storage = {get: (key, fallback) => key === 'phone-context-limit' ? 0 : fallback, set() {}};
    const data = {
        getContacts: () => contacts, getChatList: () => [chat],
        getContact: id => contacts.find(c => c.id === id), getContactByName: name => contacts.find(c => c.name === name),
        findContactByNameLoose: name => contacts.find(c => c.name === name),
        getUserInfo: () => ({name: '赵冠宇'}), getMessages: () => [],
        getCustomEmojis: () => [{name: '猫猫点头'}], isProfileContextInjectionEnabledForChat: () => false
    };
    globalThis.window = {SillyTavern: {getContext: () => context}, Mvu: {getMvuData: () => structuredClone({stat_data: stat})},
        VirtualPhone: {storage, promptManager: {getPromptForFeature: () => '自定义简短预设：按人设聊天'}, timeManager: {getCurrentStoryTime: () => ({date: '2025年09月01日', time: '08:00'})}}};
    globalThis.document = {hidden: false, getElementById: () => null, querySelector: () => null};
    const view = Object.create(ChatView.prototype);
    view.app = {wechatData: data, storage, currentChat: chat};
    view._safeGetContext = () => context;
    view._buildLobbySelection = () => ({isLobby: false, characters: [], groups: []});
    view._resolveLobbySelectedUsers = () => [];
    view._resolveLobbySelectedUserProfiles = async () => [];
    view._readNonNegativeLimit = () => 0;
    view._buildWechatPersonalImageTagInfo = () => '';
    view._getOnlineOverridePrompt = () => '';
    view._buildMusicListeningContext = () => '';
    view._getCatboxData = () => ({getCoAdoptContextForChat: () => ''});
    view._formatRealDateTime = () => ({date: '2025年09月01日', time: '08:00'});
    view._shouldUseRealTimeForOnlineChat = () => false;
    view._buildPhoneCallHistoryContextForSingleChat = () => '';
    view._buildPhoneSmsHistoryContextForSingleChat = () => '';
    view._buildSingleChatMomentsContext = () => '';
    view._buildGroupChatMomentsContext = () => '';
    view._getWechatRoleArchive = async () => ({characters: buildMvuCharacters(books, stat), behaviorRules: extractWechatBehaviorRules(books)});
    return {view, context, contacts, chat, data, storage, get stat() {return stat;},
        cleanup() {if (oldWindow === undefined) delete globalThis.window; else globalThis.window = oldWindow;
            if (oldDocument === undefined) delete globalThis.document; else globalThis.document = oldDocument;}};
}

test('zero and negative affection read from the same MVU record used by the header', () => {
    const f = fixture();
    try {
        const state = readWechatRoleState(f.contacts[0], f.context);
        assert.equal(state.affection, 0); assert.equal(state.desire, 80); assert.equal(state.depravity, 10);
        assert.match(renderWechatAffectionBadge(f.contacts[0], f.context), /好感度：0/);
        f.stat.roles.周韵涵.好感度 = -30;
        assert.match(renderWechatAffectionBadge(f.contacts[0], f.context), /好感度：-30/);
    } finally {f.cleanup();}
});

test('missing states are not replaced by invented zeroes or another role reward', () => {
    const f = fixture();
    try {
        delete f.stat.roles.周韵涵.好感度;
        f.stat.roles.周韵涵.关联任务 = {奖励: {好感度: 50}};
        assert.equal(readWechatRoleState(f.contacts[0], f.context).affection, undefined);
        assert.match(renderWechatAffectionBadge(f.contacts[0], f.context), /未记录/);
        assert.equal(readWechatRoleState({name: '不存在的角色'}, f.context).status, 'missing');
    } finally {f.cleanup();}
});

test('formal names and trailing contact remarks resolve exactly; approximate names do not', () => {
    const f = fixture();
    try {
        assert.equal(readWechatRoleState({formalName: '周韵涵', name: '小周'}, f.context).id, '周韵涵');
        assert.equal(readWechatRoleState({name: '周韵涵（同学）'}, f.context).id, '周韵涵');
        assert.equal(readWechatRoleState({name: '周韵'}, f.context).status, 'missing');
    } finally {f.cleanup();}
});

test('MVU-backed described values preserve actual numeric state', () => {
    const f = fixture();
    try {
        f.stat.roles.周韵涵.好感度 = [72, '当前好感'];
        f.stat.roles.周韵涵.欲望值 = {value: 30};
        const state = readWechatRoleState(f.contacts[0], f.context);
        assert.equal(state.affection, 72); assert.equal(state.desire, 30);
    } finally {f.cleanup();}
});

test('behavior rules carry source text and per-character stage conditions', async () => {
    const f = fixture();
    try {
        const prompt = await f.view._buildWechatRuntimeStatePrompt(f.chat, f.context);
        assert.match(prompt, /好感度=0；性欲值（MVU欲望值）=80；堕落值=10/);
        assert.match(prompt, /高欲望低好感/);
        assert.match(prompt, /高好感低欲望/);
        assert.ok(prompt.includes(RULE));
        assert.match(prompt, /先满足角色自己的约定/);
        assert.match(prompt, /当前角色卡世界书/);
        assert.match(prompt, /不修改MVU/);
        assert.doesNotMatch(prompt, /秦雅楠；好感度/);
    } finally {f.cleanup();}
});

test('group members retain their own values and one group never leaks unrelated roles', async () => {
    const f = fixture();
    try {
        const group = {id: 'g', type: 'group', members: ['周韵涵', '秦雅楠']};
        const prompt = await f.view._buildWechatRuntimeStatePrompt(group, f.context);
        assert.match(prompt, /角色：周韵涵；好感度=0/);
        assert.match(prompt, /角色：秦雅楠；好感度=90；性欲值（MVU欲望值）=0/);
        group.members = ['秦雅楠'];
        assert.doesNotMatch(await f.view._buildWechatRuntimeStatePrompt(group, f.context), /角色：周韵涵/);
    } finally {f.cleanup();}
});

test('state prompt reads fresh MVU even when static archives are cached', async () => {
    const f = fixture();
    try {
        assert.match(await f.view._buildWechatRuntimeStatePrompt(f.chat, f.context), /好感度=0/);
        f.stat.roles.周韵涵.好感度 = 75;
        assert.match(await f.view._buildWechatRuntimeStatePrompt(f.chat, f.context), /好感度=75/);
    } finally {f.cleanup();}
});

test('legacy/custom short presets still send media protocol and three-value behavior with profiles disabled', async () => {
    const f = fixture();
    try {
        const request = await f.view.buildMessagesArray('发张照片看看', f.context, null, f.chat.id);
        const joined = request.map(message => message.content).filter(value => typeof value === 'string').join('\n');
        assert.match(joined, /自定义简短预设/);
        assert.match(joined, /微信特殊消息协议|微信消息协议/);
        assert.match(joined, /好感度=0；性欲值（MVU欲望值）=80；堕落值=10/);
        assert.match(joined, /\[个人图片\]/);
        assert.match(joined, /\[表情包\]/);
        assert.match(joined, /\[转账\]/);
        assert.match(joined, /猫猫点头/);
        assert.match(request.at(-1).content, /不禁止图片、表情包、转账和红包卡片/);
        assert.doesNotMatch(request.at(-1).content, /微信消息内容必须是角色真实打进聊天框里的文字/);
    } finally {f.cleanup();}
});

test('original media formats still parse to real card types', () => {
    const f = fixture();
    try {
        const cases = [
            ['[转账](金额：100元)', 'transfer'],
            ['[红包](金额：8.88元)', 'redpacket'],
            ['[表情包]（猫猫点头）', 'sticker'],
            ['[图片]（一杯茶）（tea cup, phone photo）', 'image_prompt'],
            ['[个人图片]（窗边自拍）（1girl, adult character, selfie）', 'image_prompt'],
            ['[用户照片]（公园散步）（1boy, adult character, walking）', 'image_prompt'],
            ['[收款]', 'payment_action'], ['[退回转账]', 'payment_action'],
            ['[音乐]（歌曲名，歌手名）', 'music_invite']
        ];
        for (const [content, type] of cases) assert.equal(f.view.parseSpecialMessage(content)?.type, type, content);
        assert.equal(f.view.parseSpecialMessage('😀'), null);
    } finally {f.cleanup();}
});

test('image payload retains both Chinese display description and English generation tags', () => {
    const f = fixture();
    try {
        const parsed = f.view.parseSpecialMessage('[个人图片]（窗边微笑的自拍）（1girl, adult character, selfie, smiling, by window）');
        assert.equal(parsed.imageDescription, '窗边微笑的自拍');
        assert.match(parsed.imagePrompt, /selfie/);
        assert.equal(parsed.usePersonalReference, true);
    } finally {f.cleanup();}
});

test('reply protocol includes complete standalone media records and permits the existing moments side channel', () => {
    const protocol = buildWechatReplyProtocol({windowName: '周韵涵', userName: '赵冠宇', customEmojiList: '猫猫点头'});
    assert.match(protocol, /---周韵涵---/);
    assert.match(protocol, /特殊消息不是旁白/);
    assert.match(protocol, /朋友圈数据/);
    assert.match(protocol, /不要求每轮都有特殊消息/);
    const group = buildWechatReplyProtocol({windowName: '班级群', isGroup: true});
    assert.match(group, /群红包｜类型：拼手气红包｜总金额：¥10.00｜红包个数：2/);
});

test('updated default prompt resolves the malformed user placeholder and limits no-parentheses rule to ordinary text', () => {
    const manager = new PromptManager({get: () => null});
    const text = manager.getDefaultPrompts().wechat.online.content;
    assert.ok(text.includes('{{user}}正在'));
    assert.match(text, /普通文字禁止旁白/);
    assert.match(text, /图片、表情包、转账、红包、语音等特殊消息仍按下方协议/);
});

test('header refresh changes only its value and releases its timer on deactivation', () => {
    const f = fixture();
    const badge = {textContent: '', setAttribute(key,value) {this[key] = value;}};
    const app = Object.create(WechatApp.prototype);
    Object.assign(app, {wechatData: f.data, currentChat: f.chat, chatView: {releaseInactiveResources() {}}});
    document.querySelector = () => badge;
    try {
        app._startAffectionHeaderRefresh();
        assert.equal(badge.textContent, '好感度：0');
        assert.ok(app._affectionHeaderTimer);
        f.stat.roles.周韵涵.好感度 = 61;
        app.syncAffectionHeader();
        assert.equal(badge.textContent, '好感度：61');
        app.syncAffectionHeader('other-chat');
        assert.equal(badge.textContent, '好感度：61');
        app.deactivate();
        assert.equal(app._affectionHeaderTimer, null);
    } finally {app.deactivate(); f.cleanup();}
});

test('old chat generation does not read the new chat global MVU after a switch', () => {
    const f = fixture();
    try {
        const oldContext = {...f.context, chatId: 'old-chat', chat: [{stat_data: {roles: {'周韵涵': {好感度: 11}}}}]};
        assert.equal(readWechatRoleState(f.contacts[0], oldContext).affection, 11);
        assert.equal(readWechatRoleState(f.contacts[0], f.context).affection, 0);
    } finally {f.cleanup();}
});

test('default online prompt replaces the user name before it reaches the API', async () => {
    const f = fixture();
    try {
        window.VirtualPhone.promptManager = new PromptManager({get: () => null});
        const messages = await f.view.buildMessagesArray('你好', f.context, null, f.chat.id);
        const prompt = messages.find(message => message.name === 'SYSTEM (📱手机聊天)');
        assert.ok(prompt);
        assert.match(prompt.content, /赵冠宇正在手机微信上和周韵涵聊天/);
        assert.ok(!prompt.content.includes('{{user}}'));
    } finally {f.cleanup();}
});

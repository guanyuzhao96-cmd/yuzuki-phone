import test from 'node:test';
import assert from 'node:assert/strict';
import { ChatView } from '../apps/wechat/chat-view.js';

function createPendingChatView() {
    const view = Object.create(ChatView.prototype);
    view.pendingChatIds = new Set(['manual-chat', 'automatic-chat']);
    view.pullToRefreshPendingChatIds = new Set(['manual-chat']);
    view.batchTimer = null;
    view._isFlushingPending = false;
    view.isSending = false;
    view.app = {
        currentChat: null,
        wechatData: {
            getMessages: chatId => [{ from: 'me', content: `${chatId} message` }],
            getUserInfo: () => ({ name: 'User' }),
            getChatList: () => [
                { id: 'manual-chat', name: 'Manual' },
                { id: 'automatic-chat', name: 'Automatic' }
            ]
        }
    };
    view.isOnlineMode = () => true;
    view._isPendingChatSendable = () => true;
    view._formatMessageContentForPrompt = message => message.content;
    view.sendToAI = async (_message, chatId) => { view.sentChatIds.push(chatId); return true; };
    view.sentChatIds = [];
    view.syncHeaderStatusDot = () => {};
    view.hideTypingStatus = () => {};
    return view;
}

test('queued phone messages wait until the main chat list is pulled to refresh', async () => {
    const view = createPendingChatView();

    await view.triggerAI();
    assert.deepEqual(view.sentChatIds, ['automatic-chat']);
    assert.equal(view.pendingChatIds.has('manual-chat'), true);

    await view.triggerAI(null, { pullToRefresh: true });
    assert.deepEqual(view.sentChatIds, ['automatic-chat', 'manual-chat']);
    assert.equal(view.pendingChatIds.size, 0);
    assert.equal(view.pullToRefreshPendingChatIds.size, 0);
});

test('a downward pull at the top of the chat list requests the queued replies', async () => {
    const handlers = new Map();
    const classes = new Set();
    const indicator = {
        style: {},
        textContent: '',
        classList: {
            add: name => classes.add(name),
            remove: name => classes.delete(name),
            toggle: (name, enabled) => enabled ? classes.add(name) : classes.delete(name)
        }
    };
    const list = {
        scrollTop: 0,
        style: {},
        _suppressChatItemClickUntil: 0,
        addEventListener: (name, callback) => handlers.set(name, callback),
        querySelector: () => indicator
    };
    const view = Object.create(ChatView.prototype);
    view.app = { currentChat: null, currentView: 'chats', render() {} };
    view.getCurrentWechatView = () => ({ querySelector: () => list });
    view.getPullToRefreshPendingCount = () => 1;
    view.triggerAI = async (...args) => { view.refreshArgs = args; };

    view.bindChatListPullToRefresh();
    handlers.get('touchstart')({ touches: [{ clientX: 20, clientY: 100 }] });
    let prevented = false;
    handlers.get('touchmove')({
        touches: [{ clientX: 22, clientY: 170 }],
        cancelable: true,
        preventDefault: () => { prevented = true; }
    });
    await handlers.get('touchend')();

    assert.equal(prevented, true);
    assert.deepEqual(view.refreshArgs, [null, { pullToRefresh: true }]);
    assert.ok(list._suppressChatItemClickUntil > Date.now());
    assert.equal(view.isPullToRefreshActive, false);
});

test('main-chat reply forwarding appends the WeChat turn through the shared phone event', () => {
    const previousDocument = globalThis.document;
    const previousWindow = globalThis.window;
    let forwardedEvent = null;
    globalThis.document = { querySelector: selector => selector === '#send_textarea' ? {} : null };
    globalThis.window = { dispatchEvent: event => { forwardedEvent = event; } };

    try {
        const view = Object.create(ChatView.prototype);
        assert.equal(view._sendReplyToMainChat('我马上到', 'chat-1', '小月'), true);
        assert.equal(forwardedEvent.type, 'phone:sendToChat');
        assert.deepEqual(forwardedEvent.detail, {
            message: '我马上到',
            chatId: 'chat-1',
            chatName: '小月',
            appendToExisting: true
        });
        globalThis.document.querySelector = () => null;
        assert.equal(view._sendReplyToMainChat('第二条', 'chat-1', '小月'), false);
    } finally {
        if (previousDocument === undefined) delete globalThis.document;
        else globalThis.document = previousDocument;
        if (previousWindow === undefined) delete globalThis.window;
        else globalThis.window = previousWindow;
    }
});

test('WeChat contact context uses the matching role personality and latest MVU relationship values', async () => {
    const view = Object.create(ChatView.prototype);
    view._getWechatRoleArchive = async () => [{
        name: '林思雨',
        sources: [
            { type: 'static', enabled: true, fields: [{ label: '性格', value: '外冷内热，熟悉后很健谈。' }] },
            { type: 'dynamic', enabled: true, fields: [{ label: '关系', value: '普通朋友' }] }
        ]
    }];
    view.app = { storage: null };
    const profile = await view._getWechatContactSyncProfile({ name: '林思雨', relation: '旧关系' }, {
        chat: [],
        Mvu: { getMvuData: () => ({ roles: { lin: { role_name: '林思雨', relationship: '暧昧对象', affection: 0 } } }) }
    });

    assert.equal(profile.personality, '性格：外冷内热，熟悉后很健谈。');
    assert.equal(profile.affection, '0');
    assert.equal(profile.relationship, '暧昧对象');
    assert.equal(profile.source, 'MVU最新角色状态');
});

test('group contact context includes synchronized profiles for each linked member', async () => {
    const contacts = [{ id: 'a', name: '林思雨' }, { id: 'b', name: '周婉' }];
    const view = Object.create(ChatView.prototype);
    view.app = {
        wechatData: {
            getContacts: () => contacts,
            findContactByNameLoose: name => contacts.find(contact => contact.name === name)
        }
    };
    view._getWechatSupplementalSetting = () => '';
    view._getWechatContactSyncProfile = async contact => ({
        personality: `${contact.name}的性格`,
        affection: contact.id === 'a' ? '0' : '35',
        relationship: contact.id === 'a' ? '同学' : '朋友'
    });

    const message = await view._buildGroupSupplementalContactProfileMessage({ type: 'group', members: ['林思雨', '周婉'] });
    assert.match(message.content, /林思雨的性格/);
    assert.match(message.content, /对用户好感度：0/);
    assert.match(message.content, /周婉的性格/);
    assert.match(message.content, /与用户关系：朋友/);
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { WechatData } from '../apps/wechat/wechat-data.js';
import { HoneyData } from '../apps/honey/honey-data.js';
import { readMvuWallet, changeMvuWallet, getMvuWalletPrompt } from '../apps/wechat/mvu-wallet.js?v=20261028-wallet-151';

function fixture(balance = 100) {
    const originalWindow = globalThis.window;
    const state = {writes: 0, fail: false};
    let context = {characterId: 1, chatId: 'a', chat: [{swipe_id: 0, variables: {
        schema: {keep: true}, initialized_lorebooks: {test: []}, foreign_key: {keep: true},
        stat_data: {system: {inventory: {cny: balance, keep: 7}, points: 50}, roles: {alice: {affection: 10}}}
    }}]};
    const api = {
        getMvuData({message_id}) {
            return structuredClone(context.chat[message_id === 'latest' ? context.chat.length - 1 : message_id]?.variables || {});
        },
        async replaceMvuData(value, {message_id}) {
            state.writes++;
            if (state.fail) throw Error('simulated persistence failure');
            context.chat[message_id].variables = structuredClone(value);
        }
    };
    globalThis.window = {SillyTavern: {getContext: () => context}, Mvu: api, VirtualPhone: {notify() {}}};
    const data = Object.create(WechatData.prototype);
    data.walletDefaultKey = '__default__';
    data.data = {walletByChat: {__default__: 9999}, walletAssetsByChat: {
        __default__: {walletBalance: 9999, savingsAccounts: [{bankName: 'old-bank', balance: 9999}]}
    }, walletTransactions: []};
    data._getStoryTimeFallback = () => ({date: '2025年09月01日', time: '08:00', timestamp: 1});
    data.saveData = async () => {};
    data.getStorageKey = () => context.chatId;
    const honey = Object.create(HoneyData.prototype);
    let coins = 100;
    honey._getWechatDataForRecharge = () => data;
    honey.getHoneyCoinBalance = () => coins;
    honey.updateHoneyCoinBalance = delta => coins += delta;
    honey.setHoneyCoinBalance = value => coins = value;
    return {data, honey, state, api, get context() {return context;},
        switchChat() {context = {...context, chatId: 'b', chat: [{swipe_id: 0, variables: {stat_data: {system: {inventory: {cny: 900}}}}}]};},
        cleanup() {if (originalWindow === undefined) delete globalThis.window; else globalThis.window = originalWindow;}
    };
}

test('MVU zero balance is authoritative and excludes legacy bank balances', () => {
    const f = fixture(0);
    try {
        assert.equal(f.data.getWalletBalance(), 0);
        assert.equal(f.data.getWalletBalance('friend'), 0);
        assert.equal(f.data.getWalletAssetProfile().savingsAccounts.length, 0);
        assert.deepEqual(f.data.getWalletRepaymentSources().map(x => [x.type, x.balance]), [['wallet', 0]]);
    } finally {f.cleanup();}
});

test('transfers and redpackets share one persisted balance and preserve other MVU data', async () => {
    const f = fixture();
    try {
        assert.equal((await f.data.spendFromPaymentSource(20, 'wallet', null, {referenceId: 'transfer:a', type: 'transfer'})).success, true);
        assert.equal((await f.data.spendFromPaymentSource(30.25, 'wallet', 'friend', {referenceId: 'redpacket:a', type: 'redpacket'})).success, true);
        assert.equal(f.data.getWalletBalance(), 49.75);
        assert.equal(f.context.chat[0].variables.stat_data.system.inventory.cny, 49.75);
        assert.equal(f.data.getWalletTransactions().length, 2);
        assert.equal(f.data.getWalletTransactions()[0].mvuSynced, true);
        assert.equal(f.context.chat[0].variables.stat_data.system.inventory.keep, 7);
        assert.equal(f.context.chat[0].variables.stat_data.roles.alice.affection, 10);
        assert.deepEqual(f.context.chat[0].variables.schema, {keep: true});
        assert.deepEqual(f.context.chat[0].variables.foreign_key, {keep: true});
        assert.match(getMvuWalletPrompt(), /transfer:a/);
    } finally {f.cleanup();}
});

test('concurrent payments serialize and both report actual settlement', async () => {
    const f = fixture();
    try {
        const results = await Promise.all([
            f.data.spendWalletBalance(20, null, {referenceId: 'a'}),
            f.data.spendWalletBalance(30, null, {referenceId: 'b'})
        ]);
        assert.deepEqual(results.map(x => x.success), [true, true]);
        assert.deepEqual(results.map(x => x.balanceAfter), [80, 50]);
        assert.equal(f.data.getWalletBalance(), 50);
    } finally {f.cleanup();}
});

test('concurrent spending cannot overdraw MVU', async () => {
    const f = fixture();
    try {
        const results = await Promise.all([
            f.data.spendWalletBalance(70, null, {referenceId: 'a'}),
            f.data.spendWalletBalance(50, null, {referenceId: 'b'})
        ]);
        assert.deepEqual(results.map(x => x.success), [true, false]);
        assert.equal(results[1].reason, 'insufficient_balance');
        assert.equal(f.data.getWalletBalance(), 30);
        assert.equal(f.state.writes, 1);
    } finally {f.cleanup();}
});

test('receipt deduplication survives local ledger loss and page reload', async () => {
    const f = fixture(25);
    try {
        await f.data.spendWalletBalance(25, null, {referenceId: 'one'});
        f.data.data.walletTransactions = [];
        const retry = await changeMvuWallet(-25, {referenceId: 'one'});
        assert.equal(retry.success, true);
        assert.equal(retry.duplicate, true);
        assert.equal(f.data.getWalletBalance(), 0);
        assert.equal(f.state.writes, 1);
    } finally {f.cleanup();}
});

test('write rejection leaves balance and local ledger unchanged', async () => {
    const f = fixture();
    try {
        f.state.fail = true;
        const result = await f.data.spendWalletBalance(20, null, {referenceId: 'fail'});
        assert.equal(result.success, false);
        assert.equal(result.reason, 'mvu_write_failed');
        assert.equal(f.data.getWalletBalance(), 100);
        assert.equal(f.data.getWalletTransactions().length, 0);
    } finally {f.cleanup();}
});

test('income and refunds credit the same MVU balance once', async () => {
    const f = fixture();
    try {
        await f.data.updateWalletBalance(12.34, null, {referenceId: 'refund', type: 'transfer'});
        await f.data.updateWalletBalance(12.34, null, {referenceId: 'refund', type: 'transfer'});
        assert.equal(f.data.getWalletBalance(), 112.34);
        assert.equal(f.state.writes, 1);
    } finally {f.cleanup();}
});

test('new user floor inherits MVU while preserving latest foreign variables', async () => {
    const f = fixture();
    try {
        f.context.chat.push({swipe_id: 0, variables: {another_extension: {keep: 9}}});
        assert.equal(readMvuWallet().balance, 100);
        assert.equal((await f.data.spendWalletBalance(20, null, {referenceId: 'new-floor'})).success, true);
        assert.equal(f.context.chat[1].variables.stat_data.system.inventory.cny, 80);
        assert.equal(f.context.chat[0].variables.stat_data.system.inventory.cny, 100);
        assert.equal(f.context.chat[1].variables.another_extension.keep, 9);
    } finally {f.cleanup();}
});

test('chat and swipe switches cancel queued payment', async () => {
    const f = fixture();
    try {
        const payment = changeMvuWallet(-20, {referenceId: 'old-chat'});
        f.switchChat();
        assert.equal((await payment).reason, 'mvu_context_changed');
        assert.equal(readMvuWallet().balance, 900);
        const swipePayment = changeMvuWallet(-20, {referenceId: 'old-swipe'});
        f.context.chat[0].swipe_id = 1;
        assert.equal((await swipePayment).reason, 'mvu_context_changed');
        assert.equal(f.state.writes, 0);
    } finally {f.cleanup();}
});

test('missing cash field or write API never spends local balance instead', async () => {
    const f = fixture();
    try {
        delete f.context.chat[0].variables.stat_data.system.inventory.cny;
        assert.equal(readMvuWallet().active, true);
        assert.equal(f.data.getWalletBalance(), null);
        assert.equal((await f.data.spendWalletBalance(20)).success, false);
        f.context.chat[0].variables.stat_data.system.inventory.cny = 100;
        delete f.api.replaceMvuData;
        assert.equal((await f.data.spendWalletBalance(20)).reason, 'mvu_unavailable');
        assert.equal(f.data.getWalletBalance(), 100);
    } finally {f.cleanup();}
});

test('asset evaluation and reset cannot overwrite an MVU wallet', async () => {
    const f = fixture();
    try {
        assert.throws(() => f.data.setWalletBalance(99999), /MVU/);
        await assert.rejects(() => f.data.resetWalletBalance(99999), /MVU/);
        await assert.rejects(() => f.data.applyWalletAssetEvaluation({walletBalance: 99999}), /MVU/);
        assert.equal(f.data.getWalletBalance(), 100);
    } finally {f.cleanup();}
});

test('honey exchange settles MVU before changing coins and keeps coins on write failure', async () => {
    const f = fixture();
    try {
        assert.equal((await f.honey.rechargeHoneyCoinsFromWechat(10)).success, true);
        assert.equal(f.data.getWalletBalance(), 90);
        assert.equal(f.honey.getHoneyCoinBalance(), 200);
        assert.equal((await f.honey.withdrawHoneyCoinsToWechat(50)).success, true);
        assert.equal(f.data.getWalletBalance(), 95);
        assert.equal(f.honey.getHoneyCoinBalance(), 150);
        f.state.fail = true;
        assert.equal((await f.honey.rechargeHoneyCoinsFromWechat(10)).success, false);
        assert.equal((await f.honey.withdrawHoneyCoinsToWechat(50)).success, false);
        assert.equal(f.honey.getHoneyCoinBalance(), 150);
        assert.equal(f.data.getWalletBalance(), 95);
    } finally {f.cleanup();}
});

test('main-chat receipts and rollback never reapply MVU money movement', async () => {
    const f = fixture();
    try {
        await f.data.spendWalletBalance(20, null, {referenceId: 'ui-transfer', type: 'transfer'});
        f.data.recordWalletTransaction(-15, {referenceId: 'story-receipt', mvuSynced: true, fromMainChatTag: true});
        assert.equal(f.data.getWalletBalance(), 80);
        f.data._rollbackWalletTransactions(() => true);
        assert.equal(f.data.getWalletBalance(), 80);
        assert.equal(f.state.writes, 1);
    } finally {f.cleanup();}
});

test('described money values preserve their description and use exact cents', async () => {
    const f = fixture([1.01, '人民币余额']);
    try {
        assert.equal((await f.data.spendWalletBalance(0.11, null, {referenceId: 'cents'})).success, true);
        assert.deepEqual(f.context.chat[0].variables.stat_data.system.inventory.cny, [0.9, '人民币余额']);
    } finally {f.cleanup();}
});

test('foreground generation blocks wallet writes until its MVU settlement ends', async () => {
    const f = fixture();
    try {
        f.context.isGenerating = true;
        const result = await f.data.spendWalletBalance(20, null, {referenceId: 'busy'});
        assert.equal(result.success, false);
        assert.equal(result.reason, 'mvu_busy');
        assert.equal(f.data.getWalletBalance(), 100);
        assert.equal(f.state.writes, 0);
        f.context.isGenerating = false;
        assert.equal((await f.data.spendWalletBalance(20, null, {referenceId: 'busy'})).success, true);
    } finally {f.cleanup();}
});

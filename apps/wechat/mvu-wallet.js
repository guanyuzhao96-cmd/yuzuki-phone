// Wallet contract: 潍坊学院统一系统世界书 v6.35, 现金收支 v4.7.
// MVU API authority: MagicalAstrogy/MagVarUpdate@b42817925d0391c15fa242a8238d2bbe28eb6319
// src/function/global/index.ts: getMvuData(options), await replaceMvuData(data, options).
// Requires the card's MVU global at runtime. Never writes a guessed wallet path.
import { latestMvuSnapshot } from '../dossier/dossier-data.js';

const RECEIPTS = '_yuzuki_wechat_wallet_receipts';
let transactionQueue = Promise.resolve();
const copy = value => JSON.parse(JSON.stringify(value));
const money = value => {
    const raw = Array.isArray(value) ? value[0] : value;
    if (raw === null || raw === undefined || raw === '' || typeof raw === 'boolean') return null;
    const number = Number(raw);
    return Number.isFinite(number) && number >= 0 ? Math.round(number * 100) / 100 : null;
};
function runtime() {
    const host = typeof window !== 'undefined' ? window : globalThis;
    const context = host.SillyTavern?.getContext?.() || {};
    let api = context.Mvu || host.Mvu;
    try { api ||= host.parent?.Mvu; } catch (_) { /* No cross-origin fallback. */ }
    return { context, api };
}
function identity(context) {
    return JSON.stringify([context.characterId, context.groupId, context.chatId, context.chatMetadata?.file_name]);
}
function rawState(api, chat) {
    if (typeof api?.getMvuData !== 'function') return null;
    for (let floor = chat.length - 1; floor >= 0; floor--) {
        try {
            const data = api.getMvuData({ type: 'message', message_id: floor });
            if (data?.stat_data && typeof data.stat_data === 'object') return { data, floor };
        } catch (_) { /* Try the preceding message floor. */ }
    }
    return null;
}

export function readMvuWallet() {
    const { context, api } = runtime();
    const raw = rawState(api, context.chat || []);
    const snapshot = raw ? { data: raw.data.stat_data } : latestMvuSnapshot(null, context.chat || []);
    const active = !!snapshot;
    const balance = money(snapshot?.data?.system?.inventory?.cny);
    return {
        active,
        ready: active && balance !== null,
        writable: typeof api?.getMvuData === 'function' && typeof api?.replaceMvuData === 'function',
        balance,
        path: 'system.inventory.cny'
    };
}

export function getMvuWalletPrompt() {
    const state = readMvuWallet();
    if (!state.ready) return '';
    const { context, api } = runtime();
    const raw = rawState(api, context.chat || []);
    const receipts = Object.values(raw?.data?.[RECEIPTS] || {}).slice(-30);
    const lines = receipts.map(item =>
        `交易ID=${item.referenceId}；${item.delta < 0 ? '已支出' : '已收入'}${Math.abs(item.delta).toFixed(2)}元；${String(item.title || '').replace(/[\r\n]/g, ' ').slice(0, 60)}`
    );
    return [
        '[微信钱包已结算记录]',
        `微信钱包与主角现金共用 system.inventory.cny，当前余额 ${state.balance.toFixed(2)} 元。`,
        '以下交易已经由插件写入MVU，叙述、确认收款或回忆时不要再次提交同笔“收入现金/支出现金”，也不要直接重设余额。对未到账转账和未领取红包，不提前登记主角收入。',
        ...lines,
        '[/微信钱包已结算记录]'
    ].join('\n');
}

export function changeMvuWallet(delta, transaction = {}) {
    const initial = runtime();
    const chat = initial.context.chat;
    const scope = identity(initial.context);
    const floor = Array.isArray(chat) ? chat.length - 1 : -1;
    const message = chat?.[floor];
    const swipe = message?.swipe_id;
    const referenceId = String(transaction.referenceId || transaction.id || '').trim()
        || `wechat_wallet:${Date.now()}:${Math.random().toString(36).slice(2)}`;
    const run = async () => {
        const current = runtime();
        const sameMessage = () => identity(current.context) === scope
            && current.context.chat === chat && chat?.[floor] === message
            && chat.length - 1 === floor && message?.swipe_id === swipe;
        if (identity(current.context) !== scope || current.context.chat !== chat) return { handled: true, success: false, reason: 'mvu_context_changed' };
        const state = readMvuWallet();
        if (!state.active) return { handled: false };
        const host = typeof window !== 'undefined' ? window : globalThis;
        if (host.is_send_press === true || current.context.is_send_press === true || current.context.isGenerating === true) {
            return { handled: true, success: false, reason: 'mvu_busy' };
        }
        if (!sameMessage() || floor < 0) return { handled: true, success: false, reason: 'mvu_context_changed' };
        if (!state.ready || !state.writable) return { handled: true, success: false, reason: 'mvu_unavailable' };
        const source = rawState(current.api, chat);
        if (!source || money(source.data.stat_data?.system?.inventory?.cny) === null) {
            return { handled: true, success: false, reason: 'mvu_unavailable' };
        }
        const data = copy(source.data);
        if (source.floor !== floor) {
            const latest = current.api.getMvuData({ type: 'message', message_id: floor });
            // Preserve non-MVU variables already owned by the latest user message.
            for (const [key, value] of Object.entries(latest || {})) {
                if (!['stat_data', 'schema', 'display_data', 'delta_data', 'initialized_lorebooks', RECEIPTS].includes(key)) data[key] = copy(value);
            }
        }
        const balanceBefore = money(data.stat_data.system.inventory.cny);
        const receipts = data[RECEIPTS] && typeof data[RECEIPTS] === 'object' && !Array.isArray(data[RECEIPTS]) ? data[RECEIPTS] : {};
        const receiptKey = 'tx:' + referenceId;
        if (receipts[receiptKey]) {
            return { handled: true, success: true, duplicate: true, balanceBefore, balanceAfter: balanceBefore, referenceId };
        }
        const cents = Math.round(Number(delta) * 100);
        if (!Number.isFinite(cents) || cents === 0) return { handled: true, success: false, reason: 'invalid_amount' };
        const afterCents = Math.round(balanceBefore * 100) + cents;
        if (!Number.isSafeInteger(afterCents) || afterCents < 0) {
            return { handled: true, success: false, reason: 'insufficient_balance', balanceBefore, balanceAfter: balanceBefore };
        }
        const balanceAfter = afterCents / 100;
        const previous = data.stat_data.system.inventory.cny;
        data.stat_data.system.inventory.cny = Array.isArray(previous) ? [balanceAfter, ...previous.slice(1)] : balanceAfter;
        receipts[receiptKey] = { referenceId, delta: cents / 100, balanceBefore, balanceAfter, title: String(transaction.title || ''), messageId: String(transaction.messageId || ''), floor };
        data[RECEIPTS] = receipts;
        // Historical display mirrors are optional; preserve their other fields.
        for (const mirror of [data.display_data, data.delta_data]) {
            if (mirror?.system?.inventory && Object.hasOwn(mirror.system.inventory, 'cny')) mirror.system.inventory.cny = balanceAfter;
        }
        try {
            // Pin the exact message and swipe; never replace a moving "latest" after awaiting.
            await current.api.replaceMvuData(data, { type: 'message', message_id: floor });
        } catch (_) {
            return { handled: true, success: false, reason: 'mvu_write_failed', balanceBefore, balanceAfter: balanceBefore };
        }
        return { handled: true, success: true, balanceBefore, balanceAfter, referenceId, floor, scope };
    };
    const result = transactionQueue.then(run, run).catch(() => ({ handled: true, success: false, reason: 'mvu_write_failed' }));
    transactionQueue = result.catch(() => {});
    return result;
}

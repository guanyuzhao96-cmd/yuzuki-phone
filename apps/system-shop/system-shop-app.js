import { escapeHtml, latestMvuSnapshot } from '../dossier/dossier-data.js';

const css = `
.yzp-system-shop{height:100%;min-height:0;display:flex;flex-direction:column;overflow:hidden;background:#f2f2f7;color:#1c1c1e;font:14px/1.45 -apple-system,BlinkMacSystemFont,"SF Pro Text","Helvetica Neue",sans-serif}
.yzp-system-shop *{box-sizing:border-box}.yzp-system-shop header{display:flex;align-items:center;gap:8px;flex:none;padding:10px 12px;border-bottom:1px solid rgba(60,60,67,.16);background:rgba(255,255,255,.94);backdrop-filter:blur(20px) saturate(150%);-webkit-backdrop-filter:blur(20px) saturate(150%)}
.yzp-system-shop header strong{flex:1;font-size:16px;font-weight:650}.yzp-system-shop button{font:inherit;color:inherit;border:1px solid rgba(60,60,67,.16);border-radius:12px;background:#fff;padding:9px 11px;min-height:40px;cursor:pointer}.yzp-system-shop button:disabled{opacity:.48;cursor:not-allowed}
.yzp-system-shop main{flex:1;min-height:0;overflow:auto;padding:12px 12px 24px;overscroll-behavior:contain;-webkit-overflow-scrolling:touch}.yzp-system-shop h2{margin:14px 2px 8px;font-size:16px}.yzp-system-shop .summary{display:flex;flex-wrap:wrap;gap:5px 10px;align-items:center;margin:0 0 10px;padding:13px;border-radius:16px;background:#fff;border:1px solid rgba(60,60,67,.12)}
.yzp-system-shop .summary b{font-size:15px}.yzp-system-shop .muted,.yzp-system-shop small,.yzp-system-shop .note{color:#73737a}.yzp-system-shop small{display:block;font-size:11px}.yzp-system-shop .note{padding:10px 12px;margin:8px 0;border-radius:12px;background:#fff7e5;color:#805300}.yzp-system-shop .unlock{width:100%;margin:2px 0 8px;background:#6157c8;color:#fff;border:0;font-weight:650}
.yzp-system-shop .group{margin:10px 0 14px}.yzp-system-shop .group h3{margin:10px 2px 7px;font-size:13px;color:#73737a;font-weight:650}.yzp-system-shop .product{display:flex;width:100%;gap:10px;align-items:center;justify-content:space-between;text-align:left;padding:11px 12px;margin:6px 0;border-radius:14px;background:#fff;border:1px solid rgba(60,60,67,.12)}.yzp-system-shop .product.available{border-color:#b6aef5;background:#fbfaff}.yzp-system-shop .product.selected{background:#eeeaff;border-color:#7568d8}.yzp-system-shop .product-main{min-width:0;flex:1}.yzp-system-shop .product-main b{display:block;font-size:13px}.yzp-system-shop .product-main small{margin-top:3px;white-space:normal}.yzp-system-shop .price{flex:none;text-align:right;font-weight:700;color:#4e43a8}.yzp-system-shop .price small{font-weight:500;color:#73737a}.yzp-system-shop .action{font-size:10px;color:#73737a}.yzp-system-shop .clear{width:100%;margin-top:6px}.yzp-system-shop .primary{background:#6157c8;color:#fff;border:0;font-weight:650}.yzp-system-shop .footer{padding:10px 2px;color:#8a8a90;font-size:11px}
`;

const SHOP_ITEMS = [
    ['一次性道具', '安心剂', 'anxiety_relief', 1, '缓和指定角色当下惶恐', 1, '安心剂', true],
    ['一次性道具', '传送券', 'teleport', 3, '传送主角及愿意同行者', 1, '传送券', true],
    ['一次性道具', '消醋券', 'jealousy_relief', 2, '缓和一场女友间的吃醋争执', 1, '消醋券', true],
    ['房产', '中南熙悦商住楼 · 一室一厅 · 约38㎡', 'home_zhongnan_38', 32, '参考价20万元 · 月租约1000元 · 商城价4万元', 1, '住宅一室一厅'],
    ['房产', '中南熙悦 · 两室一厅 · 约76㎡', 'home_zhongnan_76', 109, '参考价68万元 · 月租约1800元 · 商城价13.6万元', 1, '住宅两室一厅'],
    ['房产', '中海大观天下 · 三室两厅 · 约127㎡', 'home_zhonghai_127', 134, '参考价84万元 · 月租约1800元 · 商城价16.8万元', 1, '住宅三室两厅'],
    ['房产', '中海大观天下 · 四室两厅大平层 · 约177㎡', 'home_zhonghai_177', 264, '参考价165万元 · 月租约2100元 · 商城价33万元', 1, '住宅四室两厅大平层'],
    ['车辆', '小米 SU7 Max', 'car_su7_max', 49, '参考价30.39万元 · 商城价6.078万元', 1, '小米SU7Max'],
    ['车辆', '保时捷 Panamera 基础车型', 'car_panamera_base', 160, '参考价99.8万元 · 商城价19.96万元', 2, '保时捷Panamera基础车型'],
    ['车辆', '保时捷 911 Carrera（二手）', 'car_911_carrera_used', 160, '参考价100万元 · 商城价20万元', 2, '保时捷911Carrera二手车'],
    ['房产', '海通恒信·鸢都名筑 · 四室两厅约180㎡', 'home_yandu_180', 312, '参考价195万元 · 月租约2200元 · 商城价39万元', 2, '住宅大平层一'],
    ['房产', '海通恒信·鸢都名筑 · 四室两厅约204㎡', 'home_yandu_204', 346, '参考价216万元 · 月租约2500元 · 商城价43.2万元', 2, '住宅大平层二'],
    ['经营资产', '潍坊奎文区泰华商圈 · 女仆咖啡厅', 'business_maid_cafe', 240, '参考价150万元 · 商城价30万元 · 不含房屋产权', 2, '女仆咖啡厅'],
    ['道具', '催眠服', 'hypnosis_costume', 30, '可重复穿戴，仅改变外观和氛围', 3, '催眠服'],
    ['一次性道具', '催眠券', 'hypnosis_ticket', 20, '单次自愿放松／注意力引导体验', 3, '催眠券', true],
    ['经营资产', '潍坊高新区 · 直播公司', 'business_livestream_company', 300, '参考价300万元 · 商城价60万元', 3, '直播公司'],
    ['房产', '泰和上筑别墅 · 约396㎡', 'villa_taihe_396', 1200, '参考价1200万元 · 月租参考18000元 · 商城价240万元', 3, '泰和上筑396㎡别墅'],
    ['房产', '泰和上筑别墅 · 约407㎡', 'villa_taihe_407', 1400, '参考价1400万元 · 月租参考18000元 · 商城价280万元', 3, '泰和上筑407㎡别墅'],
    ['豪车', '保时捷 911 Turbo S', 'car_911_turbo_s', 273, '参考价272.8万元 · 商城价54.56万元', 3, '保时捷911 Turbo S'],
    ['豪车', '奔驰 G 500', 'car_g500', 187, '参考价186.8万元 · 商城价37.36万元', 3, '奔驰G 500'],
    ['豪车', '宾利飞驰', 'car_bentley_flying_spur', 321, '参考价320.9万元 · 商城价64.18万元', 3, '宾利飞驰'],
];

const SHOP_SKILLS = [
    ['读心术', 'mind_read', [25, 60, 120], [1, 3, 3]],
    ['鉴定术', 'appraise', [30, 60, 120], [1, 2, 3]],
    ['强化精液', 'semen_enhancement', [40, 100, 180, 300, 500], [1, 1, 2, 3, 3]],
];

const SHOP_REQUIRED = {
    1: ['read_mind_lv1', 'appraise_lv1', 'semen_enhancement_lv1', 'semen_enhancement_lv2', '安心剂', '传送券', '消醋券', '住宅一室一厅', '住宅两室一厅', '住宅三室两厅', '住宅四室两厅大平层', '小米SU7Max'],
    2: ['appraise_lv2', 'semen_enhancement_lv3', '保时捷Panamera基础车型', '保时捷911Carrera二手车', '住宅大平层一', '住宅大平层二', '女仆咖啡厅'],
};

const object = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};

export class SystemShopApp {
    constructor(phoneShell) {
        this.phoneShell = phoneShell;
        this.active = false;
        this.selected = new Map();
        this.lastBlock = '';
        this.notice = '';
        this.refreshTimer = null;
        this._openHandler = event => {
            this.active = event.detail?.appId === 'system-shop';
            if (this.active) this.render();
        };
        this._homeHandler = () => { this.active = false; };
        this._visibilityHandler = () => { if (this.isActive()) this.render(); };
        window.addEventListener('phone:openApp', this._openHandler);
        window.addEventListener('phone:goHome', this._homeHandler);
        document.addEventListener('visibilitychange', this._visibilityHandler);
        const context = this.context();
        const generationEnded = context.event_types?.GENERATION_ENDED;
        if (generationEnded) context.eventSource?.on?.(generationEnded, () => {
            if (this.isActive()) { this.selected.clear(); this.lastBlock = ''; this.render(); }
        });
    }

    context() { return window.SillyTavern?.getContext?.() || {}; }

    isActive() {
        const panel = document.getElementById('phone-panel');
        return this.active && !document.hidden && (!panel || panel.classList.contains('phone-panel-open'));
    }

    readState() {
        const context = this.context();
        const mvu = context.Mvu || window.Mvu || window.parent?.Mvu;
        const snapshot = latestMvuSnapshot(typeof mvu?.getMvuData === 'function' ? args => mvu.getMvuData(args) : null, context.chat || []);
        const data = snapshot?.data || {};
        return { snapshot, system: object(data.system) };
    }

    addDraft(text) {
        const input = document.querySelector('#send_textarea');
        if (!input) { this.notice = '没有找到酒馆聊天输入框；请打开正常聊天窗口后重试。'; this.render(); return false; }
        const current = String(input.value || '').trimEnd();
        if (this.lastBlock && !current.endsWith(this.lastBlock)) {
            this.selected.clear();
            this.lastBlock = '';
            this.notice = '聊天输入框内容已被修改，本次商品选择已清空；请重新选择，避免重复购买。';
            this.render();
            return false;
        }
        const base = this.lastBlock ? current.slice(0, -this.lastBlock.length).trimEnd() : current;
        const next = [base, text].filter(Boolean).join('\n');
        input.value = next;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        this.lastBlock = text;
        this.notice = '指令已放入酒馆输入框；确认内容后发送，由角色卡结算脚本核验。';
        this.render();
        return true;
    }

    appendStandalone(text) {
        const input = document.querySelector('#send_textarea');
        if (!input) { this.notice = '没有找到酒馆聊天输入框；请打开正常聊天窗口后重试。'; this.render(); return false; }
        input.value = [String(input.value || '').trimEnd(), text].filter(Boolean).join('\n');
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        this.lastBlock = '';
        this.notice = text.includes('首次开启商店')
            ? '首次解锁指令已放入输入框；发送后角色卡会扣除50点并解锁一级商店。'
            : '指令已放入酒馆输入框；确认内容后发送，由角色卡结算脚本核验。';
        this.render();
        return true;
    }

    updateBasket() {
        if (!this.selected.size) {
            if (!this.lastBlock) { this.notice = ''; this.render(); return; }
            const input = document.querySelector('#send_textarea');
            const removed = input && String(input.value || '').trimEnd().endsWith(this.lastBlock);
            if (removed) {
                input.value = String(input.value || '').slice(0, -this.lastBlock.length).trimEnd();
                input.dispatchEvent(new Event('input', { bubbles: true }));
                input.dispatchEvent(new Event('change', { bubbles: true }));
            }
            this.lastBlock = '';
            this.notice = removed ? '已从聊天输入框移除本模块添加的购买指令。' : '输入框内容已修改，未自动删除；请检查是否还留有购买指令。';
            this.render();
            return;
        }
        const input = document.querySelector('#send_textarea');
        if (this.lastBlock && (!input || !String(input.value || '').trimEnd().endsWith(this.lastBlock))) {
            this.selected.clear();
            this.lastBlock = '';
            this.notice = '聊天输入框内容已被修改，本次商品选择已清空；请重新选择，避免重复购买。';
            this.render();
            return;
        }
        const block = `【系统商店待购买】\n${[...this.selected.values()].map(item => item.command).join('\n')}`;
        this.addDraft(block);
    }

    productButton(product, system, canAfford, prerequisites, purchased, basketCost) {
        const [group, name, id, price, description, level, sku, repeatable = false] = product;
        const inventory = object(system.inventory);
        const owned = Number(inventory[id]) || 0;
        const ledger = object(system[`shop_level${level}_purchases`]);
        const already = Boolean(!repeatable && ((sku && ledger[sku] === true) || owned > 0)) || purchased;
        const active = this.selected.has(id);
        const unlocked = Number(system.shop_level) >= level;
        const affordable = canAfford && price <= Math.max(0, Number(system.points) - basketCost);
        const enabled = active || (unlocked && affordable && prerequisites && !already);
        const ownedLabel = owned ? ` · 持有 ×${owned}` : '';
        const status = active ? '已加入 · 点此移除' : already ? '已购买' : !unlocked ? `需开启${level}级` : !prerequisites ? '需先购买前置等级' : !affordable ? '点数不足' : '点击加入';
        return `<button class="product${enabled && !active ? ' available' : ''}${active ? ' selected' : ''}" type="button" data-product="${escapeHtml(id)}" ${enabled ? '' : 'disabled'}>
            <span class="product-main"><b>${escapeHtml(name)}</b><small>${escapeHtml(description + ownedLabel)}</small></span>
            <span class="price">${Number(price).toLocaleString()} 点<small class="action">${escapeHtml(status)}</small></span>
        </button>`;
    }

    render() {
        if (!this.active) return;
        const { snapshot, system } = this.readState();
        const level = Number.isInteger(system.shop_level) ? system.shop_level : 0;
        const points = Number.isFinite(system.points) ? Math.max(0, system.points) : 0;
        const cny = Number.isFinite(system.inventory?.cny) ? system.inventory.cny : Number(system.inventory?.cny) || 0;
        const purchases1 = object(system.shop_level1_purchases), purchases2 = object(system.shop_level2_purchases);
        const ready1 = SHOP_REQUIRED[1].every(sku => purchases1[sku] === true);
        const ready2 = SHOP_REQUIRED[2].every(sku => purchases2[sku] === true);
        const progress = level === 1 ? `一级商品购齐：${SHOP_REQUIRED[1].filter(sku => purchases1[sku] === true).length}/${SHOP_REQUIRED[1].length}` : level === 2 ? `二级商品购齐：${SHOP_REQUIRED[2].filter(sku => purchases2[sku] === true).length}/${SHOP_REQUIRED[2].length}` : '';
        const groups = new Map();
        const basketCost = [...this.selected.values()].reduce((sum, item) => sum + item.price, 0);
        const push = (group, html) => groups.set(group, [...(groups.get(group) || []), html]);
        const availableShopLevel = level + 1;
        for (const item of SHOP_ITEMS) {
            const [group, , , , , itemLevel] = item;
            if (itemLevel > availableShopLevel) continue;
            push(group, this.productButton(item, system, level > 0, true, false, basketCost));
        }
        for (const [name, id, prices, tiers] of SHOP_SKILLS) {
            const current = Number.isInteger(system.skills?.[id]) ? system.skills[id] : 0;
            for (let to = current + 1; to <= prices.length; to++) {
                const tier = tiers[to - 1];
                if (tier > availableShopLevel) continue;
                const key = `skill:${id}:${to}`;
                const chainReady = to === current + 1 || this.selected.has(`skill:${id}:${to - 1}`);
                const enabled = level >= tier && prices[to - 1] <= Math.max(0, points - basketCost) && chainReady;
                const selected = this.selected.has(key);
                const status = selected ? '已加入 · 点此移除' : level < tier ? `需开启${tier}级` : !chainReady ? '需先购买上一级' : prices[to - 1] > Math.max(0, points - basketCost) ? '点数不足' : '点击加入';
                push(tier === 1 ? '一级技能' : tier === 2 ? '二级技能' : '三级技能', `<button class="product${enabled && !selected ? ' available' : ''}${selected ? ' selected' : ''}" type="button" data-skill="${escapeHtml(id)}" data-level="${to}" ${enabled || selected ? '' : 'disabled'}><span class="product-main"><b>${escapeHtml(name)} Lv.${to}</b><small>当前 Lv.${current} · 按等级逐级购买</small></span><span class="price">${prices[to - 1]} 点<small class="action">${escapeHtml(status)}</small></span></button>`);
            }
        }
        if (level > 0) {
            const rate = level >= 3 ? 2000 : 1250;
            for (const amount of [1, 10, 50]) {
                const cost = amount;
                const id = `exchange:${amount}`;
                const active = this.selected.has(id);
                const can = cost <= Math.max(0, points - basketCost);
                const status = active ? '已加入 · 点此移除' : can ? '点击加入' : '点数不足';
                push('现金兑换', `<button class="product${can && !active ? ' available' : ''}${active ? ' selected' : ''}" type="button" data-exchange="${amount}" ${can || active ? '' : 'disabled'}><span class="product-main"><b>兑换 ${amount} 点 → ${(amount * rate).toLocaleString()} 元</b><small>当前汇率：1点 = ${rate.toLocaleString()}元</small></span><span class="price">${amount} 点<small class="action">${status}</small></span></button>`);
            }
        }
        const groupHtml = [...groups.entries()].map(([name, items]) => `<section class="group"><h3>${escapeHtml(name)}</h3>${items.join('')}</section>`).join('');
        const unlockHtml = level === 0
            ? `<button class="unlock" type="button" data-unlock="1" ${points >= 50 ? '' : 'disabled'}>开启一级商店 · 消耗 50 点</button>`
            : level === 1 && ready1
                ? '<button class="unlock" type="button" data-unlock="2">开启二级商店 · 免费</button>'
                : level === 2 && ready2
                    ? '<button class="unlock" type="button" data-unlock="3">开启三级商店 · 免费</button>'
                    : '';
        const footer = !snapshot ? '当前聊天没有可读取的 MVU 快照。请先让角色卡生成一轮有效结算，再刷新。' : '商店数据只读自当前聊天 MVU；点击只会准备购买指令，实际扣点、入库与购齐记录由角色卡结算脚本验证。';
        this.phoneShell.setContent(`<style>${css}</style><div class="yzp-system-shop"><header><button data-action="back" aria-label="返回">‹</button><strong>系统商店</strong><button data-action="refresh">刷新</button></header><main>
            ${this.notice ? `<div class="note">${escapeHtml(this.notice)}</div>` : ''}
            <section class="summary"><span>商店等级 <b>${level}</b></span><span>系统点 <b>${points.toLocaleString()}</b></span><span>现金 <b>¥${cny.toLocaleString()}</b></span><span>已选 <b>${this.selected.size}</b> 项 · 预计 <b>${basketCost.toLocaleString()}</b> 点</span></section>
            ${progress ? `<div class="note">${escapeHtml(progress)}；${level === 1 ? (ready1 ? '可开启二级商店。' : '购齐后才能开启二级商店。') : (ready2 ? '可开启三级商店。' : '购齐后才能开启三级商店。')}</div>` : ''}
            ${level === 0 && !unlockHtml ? '<div class="note">首次开启商店需消耗 50 系统点；余额不足时不能开启。</div>' : ''}${unlockHtml}
            <h2>商品目录</h2>${groupHtml || '<div class="note">当前没有可显示的商品。</div>'}
            <button class="primary" data-action="clear" ${this.selected.size ? '' : 'disabled'}>清空本次选择</button><div class="footer">${escapeHtml(footer)}</div>
        </main></div>`, 'system-shop-main');
        const root = document.querySelector('.phone-view-current .yzp-system-shop') || document.querySelector('.yzp-system-shop');
        root?.querySelector('[data-action="back"]')?.addEventListener('click', () => window.dispatchEvent(new CustomEvent('phone:goHome')));
        root?.querySelector('[data-action="refresh"]')?.addEventListener('click', () => { this.notice = ''; this.render(); });
        root?.querySelector('[data-action="clear"]')?.addEventListener('click', () => { this.selected.clear(); this.updateBasket(); });
        root?.querySelector('[data-unlock="1"]')?.addEventListener('click', () => this.appendStandalone('【系统商店】\n首次开启商店'));
        root?.querySelector('[data-unlock="2"]')?.addEventListener('click', () => this.appendStandalone('【系统商店】\n开启二级商店'));
        root?.querySelector('[data-unlock="3"]')?.addEventListener('click', () => this.appendStandalone('【系统商店】\n开启三级商店'));
        root?.querySelectorAll('[data-product]')?.forEach(button => button.addEventListener('click', () => {
            const product = SHOP_ITEMS.find(row => row[2] === button.dataset.product);
            if (!product) return;
            const [, , id, , , , , repeatable = false] = product;
            const command = `购买物品（物品：${id}）。`;
            if (this.selected.has(id)) this.selected.delete(id);
            else this.selected.set(id, { id, price: Number(product[3]), command, repeatable });
            this.updateBasket();
        }));
        root?.querySelectorAll('[data-skill]')?.forEach(button => button.addEventListener('click', () => {
            const id = button.dataset.skill, levelTo = Number(button.dataset.level), key = `skill:${id}:${levelTo}`;
            if (this.selected.has(key)) {
                this.selected.delete(key);
                for (const [selectedKey, value] of [...this.selected]) if (value.skill === id && value.level > levelTo) this.selected.delete(selectedKey);
            } else {
                const spec = SHOP_SKILLS.find(row => row[1] === id);
                const command = `购买技能（技能：${id}，等级：${levelTo}）。`;
                this.selected.set(key, { id: key, skill: id, level: levelTo, price: spec[2][levelTo - 1], command });
            }
            this.updateBasket();
        }));
        root?.querySelectorAll('[data-exchange]')?.forEach(button => button.addEventListener('click', () => {
            const amount = Number(button.dataset.exchange), key = `exchange:${amount}`;
            if (this.selected.has(key)) this.selected.delete(key);
            else this.selected.set(key, { id: key, price: amount, command: `兑换人民币（系统点数：${amount}）。` });
            this.updateBasket();
        }));
    }

    deactivate() { this.active = false; }

    destroy() {
        this.deactivate();
        window.removeEventListener('phone:openApp', this._openHandler);
        window.removeEventListener('phone:goHome', this._homeHandler);
        document.removeEventListener('visibilitychange', this._visibilityHandler);
        clearTimeout(this.refreshTimer);
    }
}

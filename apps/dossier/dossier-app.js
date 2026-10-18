import { WorldbookManager } from '../../config/worldbook-manager.js';
import { buildCharacters, escapeHtml as e, findMvuRole, flattenMvu, formatMvuValue, latestMvuSnapshot, MVU_ROLE_FIELDS, visibleFields } from './dossier-data.js';

const KEY = 'chat_dossier_preferences';
const css = `
.yzp-dossier{height:100%;display:flex;flex-direction:column;background:#f4f6f3;color:#263c35;font:14px/1.6 system-ui,sans-serif;overflow:hidden}
.yzp-dossier *{box-sizing:border-box}.yzp-dossier header{display:flex;align-items:center;gap:8px;padding:12px;border-bottom:1px solid #d9e1db;background:#fff;flex-shrink:0}
.yzp-dossier header strong{flex:1}.yzp-dossier button,.yzp-dossier input,.yzp-dossier select{font:inherit;color:inherit;border:1px solid #ccd8d0;border-radius:10px;background:white;padding:9px;min-height:44px;max-width:100%}
.yzp-dossier button{cursor:pointer}.yzp-dossier main{padding:12px;overflow:auto;flex:1;min-height:0;overflow-wrap:anywhere}.yzp-dossier details,.yzp-dossier article{background:white;border-radius:14px;padding:12px;margin:10px 0;border:1px solid #e0e6e1}
.yzp-dossier summary{cursor:pointer;font-weight:600;min-height:32px}.yzp-dossier p{white-space:pre-wrap;margin:7px 0}.yzp-dossier small{color:#61726a;display:block}.yzp-dossier .warning{color:#8a5025}.yzp-dossier .role{display:block;width:100%;text-align:left;margin:8px 0;padding:13px}.yzp-dossier label{display:block;margin:8px 0}.yzp-dossier input[type=search],.yzp-dossier select{width:100%}.yzp-dossier .field{border-top:1px solid #edf0ed;padding:8px 0}.yzp-dossier .field b{font-size:12px;color:#61726a}.yzp-dossier .muted{color:#61726a}.yzp-dossier h2{font-size:22px;margin:4px 0}.yzp-dossier pre{white-space:pre-wrap;font:12px/1.6 system-ui}.yzp-dossier button:disabled{opacity:.55}`;

export class DossierApp {
    constructor(phoneShell, storage) {
        this.phoneShell = phoneShell;
        this.storage = storage;
        this.manager = new WorldbookManager(storage);
        this.characters = [];
        this.books = [];
        this.indexes = [];
        this.errors = [];
        this.sequence = 0;
        this.active = true;
        this.bindEvents();
    }

    context() { return window.SillyTavern?.getContext?.() || {}; }
    scope() {
        const ctx = this.context();
        return JSON.stringify([ctx.characterId, ctx.groupId, ctx.chatId, ctx.chatMetadata?.file_name]);
    }
    prefs() { return this.storage.get(KEY, {}) || {}; }
    save(patch) { this.storage.set(KEY, { ...this.prefs(), ...patch }); }
    isActive() {
        const panel = document.getElementById('phone-panel');
        return this.active && !document.hidden && (!panel || panel.classList.contains('phone-panel-open'));
    }

    bindEvents() {
        window.addEventListener('phone:openApp', event => {
            this.active = event.detail?.appId === 'dossier';
            if (!this.active) { this.sequence++; this.loading = false; clearInterval(this.timer); }
        });
        window.addEventListener('phone:goHome', () => { this.active = false; this.sequence++; this.loading = false; clearInterval(this.timer); });
        window.addEventListener('phone:panelVisibility', event => {
            if (!event.detail?.open) { this.sequence++; this.loading = false; }
            else if (this.isActive()) this.refresh();
        });
        window.addEventListener('phone:swipeBack', event => this.handleSwipeBack(event));
        document.addEventListener('visibilitychange', () => { if (this.isActive()) this.refresh(); });
        const ctx = this.context();
        for (const name of ['MESSAGE_RECEIVED', 'MESSAGE_UPDATED', 'MESSAGE_DELETED', 'MESSAGE_SWIPED', 'GENERATION_ENDED', 'WORLDINFO_UPDATED']) {
            if (ctx.event_types?.[name]) ctx.eventSource?.on(ctx.event_types[name], () => {
                if (!this.isActive()) return;
                clearTimeout(this.debounce);
                this.debounce = setTimeout(() => this.refresh(), 700);
            });
        }
    }

    handleSwipeBack(event) {
        if (!this.active || !document.querySelector('.phone-view-current .yzp-dossier')) return false;
        if (event.detail) event.detail.handled = true;
        if (this.selected || this.settings) { this.selected = null; this.settings = false; this.draw(); }
        else window.dispatchEvent(new CustomEvent('phone:goHome'));
        return true;
    }

    clearCache() {
        this.sequence++;
        this.loading = false;
        this.characters = [];
        this.selected = null;
        this.settings = false;
        this.books = [];
        this.indexes = [];
        this.mvu = null;
        this.errors = [];
        this.readAt = null;
        if (this.isActive()) { this.draw(); queueMicrotask(() => this.refresh()); }
    }

    async render() {
        this.active = true;
        this.settings = false;
        this.selected = null;
        this.draw();
        clearInterval(this.timer);
        // Resolve currently attached worldbooks afresh, then follow their CWB directories.
        this.timer = setInterval(() => { if (this.isActive() && !this.settings) this.refresh(true); }, 20000);
        await this.refresh();
    }

    async refresh(quiet = false) {
        if (this.loading || !this.isActive()) return;
        this.loading = true;
        const token = ++this.sequence;
        const scope = this.scope();
        if (!quiet) this.draw();
        try {
            const names = await this.manager.getDossierDefaultBooks();
            const results = await Promise.allSettled(names.map(name => this.manager.readDossierWorldbook(name)));
            const ctx = this.context();
            const mvuApi = ctx.Mvu || window.Mvu || window.parent?.Mvu;
            const getMvuData = typeof mvuApi?.getMvuData === 'function'
                ? args => mvuApi.getMvuData(args)
                : null;
            const mvu = latestMvuSnapshot(getMvuData, ctx.chat);
            if (token !== this.sequence || scope !== this.scope() || !this.active) return;
            this.books = names;
            this.errors = results.flatMap((result, i) => result.status === 'rejected' ? [`${names[i]}：${result.reason.message}`] : []);
            const loaded = results.filter(r => r.status === 'fulfilled').map(r => r.value);
            const characters = buildCharacters(loaded);
            this.indexes = loaded.flatMap(book => book.entries.filter(entry => /^CWB目录/.test(entry.comment || '') || /【小故事线目录】/.test(entry.content || '')).map(entry => ({ book: book.name, ...entry })));
            const signature = JSON.stringify([names, this.indexes, characters, mvu, this.errors]);
            const changed = signature !== this.signature;
            this.signature = signature;
            this.characters = characters;
            this.mvu = mvu;
            this.readAt = new Date().toLocaleTimeString();
            this.loading = false;
            if (changed || !quiet) this.draw();
        } catch (error) {
            if (token !== this.sequence || scope !== this.scope()) return;
            this.errors = [error.message];
            this.loading = false;
            this.draw();
        } finally { if (token === this.sequence) this.loading = false; }
    }

    section(title, fields) {
        return `<details><summary>${e(title)}</summary>${fields.length ? fields.map(f => `<div class="field"><b>${e(f.label)}</b><p>${e(f.value)}</p></div>`).join('') : '<p class="muted">未记录</p>'}</details>`;
    }

    details(role) {
        const choices = this.prefs().sources?.[role.id] || {};
        const sources = ['static', 'dynamic'].map(type => {
            const candidates = role.sources.filter(s => s.type === type);
            const source = candidates.length === 1 ? candidates[0] : candidates.find(s => String(s.uid) === choices[type]);
            const label = type === 'static' ? '基础资料' : '剧情档案';
            return `<details open><summary>${label}</summary>${candidates.length > 1 ? `<p class="warning">找到多个条目，请选择当前来源。</p><select data-source="${type}"><option value="">请选择</option>${candidates.map(s => `<option value="${e(s.uid)}" ${s === source ? 'selected' : ''}>${e(s.comment)} · UID ${e(s.uid)}</option>`).join('')}</select>` : ''}${source ? `${type === 'static' ? this.section('角色资料', visibleFields(source.fields)) : this.dynamicSections(source.fields)}<small>来源：${e(role.book)} / ${e(source.comment)} · UID ${e(source.uid)}${source.enabled === false ? ' · 条目已停用' : ''}</small><details><summary>查看源条目原文</summary><pre>${e(source.content)}</pre></details>` : '<p class="muted">未记录或尚未选择来源</p>'}</details>`;
        }).join('');
        const paths = flattenMvu(this.mvu?.data);
        const mvuRole = findMvuRole(this.mvu?.data, role.name);
        const mvuValues = MVU_ROLE_FIELDS.map(([key, label]) => ({
            label,
            value: mvuRole.role ? formatMvuValue(mvuRole.role[key]) : '未匹配到该角色的 MVU 数据',
        }));
        const mappings = this.prefs().mappings?.[role.id] || [];
        const values = mappings.map(m => ({ label: m.label, value: paths.some(p => p.path === m.path) ? `${formatMvuValue(paths.find(p => p.path === m.path).value)}\n来源路径：${m.path}` : `当前 MVU 中不存在：${m.path}` }));
        const mvuStatus = !this.mvu ? '未找到当前聊天的 MVU 数据。' : mvuRole.status === 'matched'
            ? `已按正式姓名匹配角色 ID：${mvuRole.id}；读取来源：${this.mvu.source === 'MVU' ? 'MVU 最新数据' : `聊天第 ${this.mvu.floor} 楼的 stat_data`}。`
            : mvuRole.status === 'ambiguous' ? '多个角色的 role_name 与该档案姓名相同，暂不自动绑定。'
                : '未找到 role_name 或角色 ID 与该档案姓名一致的角色；不会按相似名称猜测。';
        return `<h2>${e(role.name)}</h2><small>${e(role.book)}</small>${sources}${this.section('MVU 当前状态', mvuValues)}<small>${e(mvuStatus)}</small>${values.length ? this.section('自定义 MVU 展示字段', values) : ''}<details><summary>配置自定义 MVU 展示字段</summary><small>${this.mvu ? `读取 ${this.mvu.source === 'MVU' ? 'MVU 最新数据' : `聊天第 ${this.mvu.floor} 楼的 stat_data`}；最多列出 2000 个叶子字段。默认字段按角色正式姓名自动匹配，只读展示。` : '未找到 MVU 数据。可先确认酒馆是否已生成 MVU 数据。'}</small><input data-mvu-label placeholder="显示名称，例如好感度" aria-label="MVU 显示名称"><select data-mvu-path aria-label="MVU 变量路径"><option value="">选择变量路径</option>${paths.map(p => `<option value="${e(p.path)}">${e(p.path)} = ${e(String(p.value).slice(0, 70))}</option>`).join('')}</select><button data-action="add-mapping">添加展示字段</button>${mappings.map((m, i) => `<p>${e(m.label)}：${e(m.path)} <button data-remove="${i}">移除展示</button></p>`).join('')}</details><small>世界书读取：${e(this.readAt || '尚未读取')}；动态资料的剧情进度请以源条目记录为准。</small>`;
    }

    dynamicSections(fields) {
        const filtered = visibleFields(fields);
        const groups = [ ['角色记忆', /已知|未知/], ['人际关系', /关系|相关角色/], ['个人关键剧情', /剧情|事件/], ['经历与物品', /经历|人数|对象|次数|物品/], ['目标与补充', /目标|补充/] ];
        const used = new Set();
        const html = groups.map(([title, regex]) => {
            const selected = filtered.filter(f => regex.test(f.label) && !used.has(f));
            selected.forEach(f => used.add(f));
            return this.section(title, selected);
        }).join('');
        return html + this.section('其他记录', filtered.filter(f => !used.has(f)));
    }

    draw() {
        if (!this.active) return;
        const role = this.characters.find(c => c.id === this.selected);
        let body;
        if (this.settings) body = `<h2>目录索引</h2><p>自动关联当前聊天、角色及全局启用的世界书，通过目录中的完整姓名定位角色资料。</p><small>关联 ${this.books.length} 本世界书，识别 ${(this.indexes || []).length} 个目录，列出 ${this.characters.length} 个角色。</small>${(this.indexes || []).map(index => `<article><strong>${e(index.comment)}</strong><small>${e(index.book)} · UID ${e(index.uid)}</small><pre>${e(index.content)}</pre></article>`).join('')}${this.books.length ? `<details><summary>已检查的关联世界书</summary>${this.books.map(name => `<p>${e(name)}</p>`).join('')}</details>` : '<p>当前聊天没有可识别的关联世界书，请检查酒馆中的世界书绑定。</p>'}`;
        else if (role) body = this.details(role);
        else body = `<input type="search" placeholder="搜索完整姓名" aria-label="搜索角色" value="${e(this.search || '')}" data-search><div data-role-list>${this.roleList()}</div>${!this.characters.length ? '<article>尚未在当前关联世界书中识别到 CWB 角色目录。可在“来源”查看自动读取状态；目录中的角色即使资料缺失也会列出。</article>' : ''}`;
        this.phoneShell.setContent(`<style>${css}</style><div class="yzp-dossier"><header><button data-action="back" aria-label="返回">‹</button><strong>角色档案</strong><button data-action="settings">来源</button><button data-action="refresh" ${this.loading ? 'disabled' : ''}>${this.loading ? '读取中' : '刷新'}</button></header><main>${this.errors.map(error => `<p class="warning">${e(error)}</p>`).join('')}${body}<small>只读 · 世界书与 MVU 的原始内容不会被修改</small></main></div>`, 'dossier-main');
        const root = document.querySelector('.phone-view-current .yzp-dossier') || document.querySelector('.yzp-dossier');
        if (!root) return;
        root.onclick = event => this.onClick(event, root, role);
        const search = root.querySelector('[data-search]');
        if (search) search.oninput = event => { this.search = event.target.value; root.querySelector('[data-role-list]').innerHTML = this.roleList(); };
        root.querySelectorAll('[data-source]').forEach(select => { select.onchange = () => {
            const sources = { ...this.prefs().sources, [role.id]: { ...this.prefs().sources?.[role.id], [select.dataset.source]: select.value } };
            this.save({ sources }); this.draw();
        }; });
    }

    roleList() {
        return this.characters.filter(c => c.name.includes(this.search || '')).map(c => `<button class="role" data-role="${e(c.id)}"><strong>${e(c.name)}</strong><small>${e(c.book)}${this.characters.filter(other => other.name === c.name).length > 1 ? ' · 存在同名角色' : ''}${!c.sources.length ? ' · 资料缺失' : ''}</small></button>`).join('');
    }

    onClick(event, root, role) {
        const button = event.target.closest('button');
        if (!button) return;
        if (button.dataset.role) { this.selected = button.dataset.role; this.draw(); return; }
        if (button.dataset.remove !== undefined && role) {
            const list = [...(this.prefs().mappings?.[role.id] || [])]; list.splice(Number(button.dataset.remove), 1);
            this.save({ mappings: { ...this.prefs().mappings, [role.id]: list } }); this.draw(); return;
        }
        switch (button.dataset.action) {
            case 'back':
                if (this.selected || this.settings) { this.selected = null; this.settings = false; this.draw(); }
                else window.dispatchEvent(new CustomEvent('phone:goHome')); break;
            case 'settings': this.settings = true; this.draw(); break;
            case 'refresh': this.refresh(); break;
            case 'add-mapping': {
                const label = root.querySelector('[data-mvu-label]').value.trim();
                const path = root.querySelector('[data-mvu-path]').value;
                if (!label || !path || !role) return;
                const list = [...(this.prefs().mappings?.[role.id] || []).filter(m => m.path !== path), { label, path }];
                this.save({ mappings: { ...this.prefs().mappings, [role.id]: list } }); this.draw(); break;
            }
        }
    }
}

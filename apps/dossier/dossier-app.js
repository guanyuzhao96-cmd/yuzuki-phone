import { WorldbookManager } from '../../config/worldbook-manager.js';
import { buildCharacters, escapeHtml as e, findMvuRole, flattenMvu, formatMvuValue, latestMvuSnapshot, MVU_ROLE_FIELDS, visibleFields } from './dossier-data.js';

const KEY = 'chat_dossier_preferences';
const css = `
.yzp-dossier{height:100%;min-height:0;display:flex;flex-direction:column;overflow:hidden;touch-action:pan-y;background:#f2f2f7;color:#1c1c1e;font:14px/1.45 -apple-system,BlinkMacSystemFont,"SF Pro Text","Helvetica Neue",sans-serif}
.yzp-dossier *{box-sizing:border-box}.yzp-dossier header{display:flex;align-items:center;gap:6px;flex-shrink:0;padding:8px 10px;border-bottom:1px solid rgba(60,60,67,.18);background:rgba(255,255,255,.94);backdrop-filter:blur(20px) saturate(150%);-webkit-backdrop-filter:blur(20px) saturate(150%)}
.yzp-dossier header strong{flex:1;min-width:0;font-size:15px;font-weight:650;letter-spacing:-.2px}.yzp-dossier button,.yzp-dossier input,.yzp-dossier select{max-width:100%;font:inherit;color:inherit;border:1px solid rgba(60,60,67,.18);border-radius:11px;background:#fff;padding:7px 9px;min-height:40px}
.yzp-dossier button{cursor:pointer}.yzp-dossier main{display:block;flex:1 1 auto;min-height:0;min-width:0;overflow-x:hidden;overflow-y:auto;padding:8px 10px 12px;overscroll-behavior-y:contain;-webkit-overflow-scrolling:touch;touch-action:pan-y;overflow-wrap:anywhere;background:#f2f2f7}
.yzp-dossier details,.yzp-dossier article{margin:6px 0;padding:9px 10px;border:1px solid rgba(60,60,67,.12);border-radius:14px;background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.035)}
.yzp-dossier summary{min-height:28px;cursor:pointer;font-weight:600;line-height:1.35}.yzp-dossier p{margin:5px 0;white-space:pre-wrap;line-height:1.45}.yzp-dossier small{display:block;color:#6d6d72;font-size:11px;line-height:1.4}.yzp-dossier .warning{color:#9a5b00}.yzp-dossier .role{display:block;width:100%;margin:5px 0;padding:9px 10px;text-align:left}.yzp-dossier label{display:block;margin:6px 0}.yzp-dossier input[type=search],.yzp-dossier select{width:100%}.yzp-dossier .field{padding:5px 0;border-top:1px solid rgba(60,60,67,.1)}.yzp-dossier .field b{font-size:11px;color:#6d6d72}.yzp-dossier .muted{color:#6d6d72}.yzp-dossier h2{margin:2px 0;font-size:20px;line-height:1.25;letter-spacing:-.35px}.yzp-dossier pre{white-space:pre-wrap;font:11px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace}.yzp-dossier button:disabled{opacity:.55}
.yzp-dossier .profile-hero{padding:16px;margin:4px 0 10px;border:0;border-radius:18px;color:#fff;background:linear-gradient(135deg,#514a70,#85739b 58%,#c1a9b8);box-shadow:0 5px 16px rgba(47,36,67,.14)}
.yzp-dossier .profile-kicker{font-size:10px;letter-spacing:2px;text-transform:uppercase;opacity:.78}.yzp-dossier .profile-hero h2{font-size:24px;letter-spacing:.2px;margin:4px 0}.yzp-dossier .profile-subtitle{margin:0;opacity:.88;font-size:12px}
.yzp-dossier .profile-badges{display:flex;flex-wrap:wrap;gap:6px;margin-top:12px}.yzp-dossier .profile-badge{padding:4px 9px;border-radius:20px;background:#ffffff28;border:1px solid #ffffff42;font-size:11px;line-height:1.35}
.yzp-dossier .stat-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin:8px 0 12px}.yzp-dossier .stat-card{padding:10px;border-radius:13px;background:#fff;border:1px solid rgba(60,60,67,.1);min-width:0}.yzp-dossier .stat-label{font-size:10px;color:#74717e}.yzp-dossier .stat-value{font-size:16px;font-weight:650;overflow-wrap:anywhere}.yzp-dossier .stat-card.accent{background:#f5effa;border-color:#e7dbef}.yzp-dossier .profile-group{margin:8px 0;padding:0;overflow:hidden}.yzp-dossier .profile-group summary{padding:11px 12px;display:flex;align-items:center;gap:7px}.yzp-dossier .profile-group summary:after{content:'＋';margin-left:auto;color:#77717e}.yzp-dossier .profile-group[open] summary:after{content:'－'}.yzp-dossier .group-count{font-size:10px;color:#7a7480;font-weight:400}.yzp-dossier .profile-group .fields{padding:0 12px 5px}.yzp-dossier .profile-group .field{display:grid;grid-template-columns:minmax(75px,31%) 1fr;gap:9px;padding:8px 0}.yzp-dossier .profile-group .field b{font-weight:500;color:#77717e}.yzp-dossier .catalog-heading{padding:12px 4px 8px}.yzp-dossier .catalog-kicker{font-size:10px;letter-spacing:2px;color:#78648e;font-weight:700}.yzp-dossier .catalog-heading h2{font-size:23px;margin:2px 0}.yzp-dossier .catalog-heading small{font-size:11px}.yzp-dossier .catalog-tools{display:flex;align-items:center;gap:8px;margin:8px 0;color:#74717e;font-size:11px}.yzp-dossier .catalog-tools span{flex:1}.yzp-dossier .catalog-tools select{width:auto;min-height:36px;padding:5px 8px;font-size:12px}.yzp-dossier .role-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.yzp-dossier .role-card{display:flex;align-items:center;gap:9px;text-align:left;width:100%;min-width:0;min-height:88px;padding:9px;border-radius:14px;background:#fff;border:1px solid rgba(60,60,67,.12);box-shadow:0 1px 2px rgba(0,0,0,.035)}.yzp-dossier .role-avatar{width:42px;height:52px;flex:0 0 42px;display:grid;place-items:center;border-radius:10px;color:white;font-size:21px;font-weight:650;background:linear-gradient(145deg,#89789e,#d0b3c1)}.yzp-dossier .role-info{min-width:0;flex:1}.yzp-dossier .role-name{display:block;font-size:14px;font-weight:650;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.yzp-dossier .role-subtitle{display:block;font-size:10px;color:#77717e;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:2px}.yzp-dossier .role-badges{display:flex;gap:4px;flex-wrap:wrap;margin-top:5px}.yzp-dossier .role-badge{font-size:9px;line-height:1.4;color:#6c5b7e;background:#f0ebf4;border-radius:10px;padding:2px 6px}.yzp-dossier .role-arrow{color:#aaa5b0;font-size:17px}.yzp-dossier .profile-tools{margin:10px 0}.yzp-dossier .source-meta{margin:4px 0 8px}.yzp-dossier .section-hint{padding:7px 12px 0;color:#77717e;font-size:10px}
@media(min-width:520px){.yzp-dossier .stat-grid{grid-template-columns:repeat(4,minmax(0,1fr))}}`;

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

    section(title, fields, open = false) {
        return `<details class="profile-group" ${open ? 'open' : ''}><summary>${e(title)}<span class="group-count">${fields.length} 项</span></summary><div class="fields">${fields.length ? fields.map(f => `<div class="field"><b>${e(f.label)}</b><p>${e(f.value)}</p></div>`).join('') : '<p class="muted">未记录</p>'}</div></details>`;
    }

    groupedFields(fields, groups, fallback = '其他资料') {
        const remaining = [...visibleFields(fields)];
        const result = [];
        for (const [title, pattern] of groups) {
            const picked = remaining.filter(field => pattern.test(field.label));
            for (const field of picked) remaining.splice(remaining.indexOf(field), 1);
            if (picked.length) result.push(this.section(title, picked, result.length === 0));
        }
        if (remaining.length) result.push(this.section(fallback, remaining));
        return result.join('');
    }

    details(role) {
        const choices = this.prefs().sources?.[role.id] || {};
        const choose = type => {
            const candidates = role.sources.filter(source => source.type === type);
            return { candidates, source: candidates.length === 1 ? candidates[0] : candidates.find(source => String(source.uid) === choices[type]) };
        };
        const staticChoice = choose('static');
        const dynamicChoice = choose('dynamic');
        const staticSource = staticChoice.source;
        const dynamicSource = dynamicChoice.source;
        const staticFields = staticSource ? visibleFields(staticSource.fields) : [];
        const dynamicFields = dynamicSource ? visibleFields(dynamicSource.fields) : [];
        const paths = flattenMvu(this.mvu?.data);
        const mvuRole = findMvuRole(this.mvu?.data, role.name);
        const mvuRecord = mvuRole.role || {};
        const mvuValues = MVU_ROLE_FIELDS.map(([key, label]) => ({
            label,
            value: mvuRole.role ? formatMvuValue(mvuRecord[key]) : '未匹配到该角色的 MVU 数据',
        }));
        const mappings = this.prefs().mappings?.[role.id] || [];
        const values = mappings.map(mapping => ({ label: mapping.label, value: paths.some(path => path.path === mapping.path) ? `${formatMvuValue(paths.find(path => path.path === mapping.path).value)}\n来源路径：${mapping.path}` : `当前 MVU 中不存在：${mapping.path}` }));
        const fromFields = (pattern, fallback = '未记录') => {
            const field = [...dynamicFields, ...staticFields].find(item => pattern.test(item.label));
            return field?.value || fallback;
        };
        const fromMvu = (keys, pattern) => {
            for (const key of keys) if (mvuRecord[key] !== undefined && mvuRecord[key] !== null && mvuRecord[key] !== '') return formatMvuValue(mvuRecord[key]);
            return fromFields(pattern);
        };
        const relationship = fromMvu(['relationship'], /与主角关系|关系/);
        const affection = fromMvu(['affection'], /好感度|好感/);
        const romance = fromMvu(['romanceStatus'], /恋爱状态|恋爱关系/);
        const approach = fromMvu(['approachStage', 'goalProgress'], /攻略进度|攻略阶段|攻略状态|阶段/);
        const mvuStatus = !this.mvu ? '当前聊天没有可读取的 MVU 数据。' : mvuRole.status === 'matched'
            ? `按完整姓名匹配角色 ID：${mvuRole.id} · ${this.mvu.source === 'MVU' ? 'MVU 最新数据' : `聊天第 ${this.mvu.floor} 楼 stat_data`}`
            : mvuRole.status === 'ambiguous' ? '多个角色的 role_name 与档案姓名相同，暂不自动绑定。'
                : '未找到与档案姓名一致的角色数据；不会按相似名称猜测。';
        const titleFields = staticFields.concat(dynamicFields);
        const occupation = titleFields.find(field => /职业|身份|职务/.test(field.label))?.value;
        const rank = titleFields.find(field => /校花榜|全校排名|排名/.test(field.label))?.value;
        const badges = [occupation, rank, relationship !== '未记录' ? relationship : '', romance !== '未记录' ? romance : ''].filter(Boolean);
        const sourcePicker = (type, title, choice) => choice.candidates.length > 1
            ? `<label class="source-picker">${title}<select data-source="${type}"><option value="">选择${title}</option>${choice.candidates.map(source => `<option value="${e(source.uid)}" ${source === choice.source ? 'selected' : ''}>${e(source.comment)} · UID ${e(source.uid)}</option>`).join('')}</select></label>` : '';
        const sources = `${sourcePicker('static', '基础资料来源', staticChoice)}${sourcePicker('dynamic', '动态资料来源', dynamicChoice)}`;
        const stat = (label, value, accent = false) => `<div class="stat-card ${accent ? 'accent' : ''}"><div class="stat-label">${e(label)}</div><div class="stat-value">${e(value || '未记录')}</div></div>`;
        const appearanceGroups = this.groupedFields(staticFields, [
            ['基本资料', /年龄|国籍|职业|身份|学校|校花榜|全校排名|排名|年级|生日|性别/],
            ['外貌与风格', /颜值|身高|罩杯|外貌|长相|体态|外形|衣着|穿着|服装|发型|发色|瞳色/],
            ['性格与特质', /性格|气质|特质|性格标签|隐藏|秘密|弱点|欲望|恐惧/],
            ['背景与喜好', /背景|经历|出身|家庭|喜好|偏好|喜欢|讨厌|兴趣|习惯/],
            ['关系与攻略建议', /与主角关系|恋爱状态|攻略|好感|相处|建议|攻略建议/],
        ], '完整角色档案');
        const dynamicGroups = this.groupedFields(dynamicFields, [
            ['关系与攻略进度', /关系|好感|恋爱|攻略|阶段|进度|相处/],
            ['当前状态与衣着', /当前状态|状态|心情|情绪|欲望|性欲|堕落|衣着|穿着|发型|在场/],
            ['当前目标与进度', /当前目标|短期目标|长期目标|目标进度|进展/],
            ['近期剧情与经历', /剧情|事件|故事线|记忆|经历|物品|次数|发生/],
            ['攻略建议', /攻略建议|互动建议|建议|提示/],
        ], '其他动态资料');
        const sourceMeta = source => source ? `<small class="source-meta">来源：${e(role.book)} / ${e(source.comment)} · UID ${e(source.uid)}${source.enabled === false ? ' · 条目已停用' : ''}</small>` : '<small class="source-meta muted">未记录或尚未选择来源</small>';
        const rawSource = source => source ? `<details><summary>查看源条目原文 · ${e(source.comment)}</summary><pre>${e(source.content)}</pre></details>` : '';
        return `<article class="profile-hero"><span class="profile-kicker">Character dossier</span><h2>${e(role.name)}</h2><p class="profile-subtitle">${e(occupation || role.book)}</p><div class="profile-badges">${badges.length ? badges.map(badge => `<span class="profile-badge">${e(badge)}</span>`).join('') : '<span class="profile-badge">角色档案</span>'}</div></article>
            <div class="stat-grid">${stat('好感度', affection, true)}${stat('与主角关系', relationship)}${stat('恋爱状态', romance)}${stat('攻略进度', approach, true)}</div>
            ${sources}${appearanceGroups || '<article><strong>基础资料</strong><p class="muted">未记录</p></article>'}${sourceMeta(staticSource)}${rawSource(staticSource)}
            ${dynamicGroups || this.section('当前动态资料', [])}${sourceMeta(dynamicSource)}${rawSource(dynamicSource)}
            ${this.section('MVU 当前状态', mvuValues)}<small>${e(mvuStatus)}</small>
            ${values.length ? this.section('自定义 MVU 展示字段', values) : ''}
            <details class="profile-tools"><summary>配置额外 MVU 展示字段</summary><small>${this.mvu ? `读取 ${this.mvu.source === 'MVU' ? 'MVU 最新数据' : `聊天第 ${this.mvu.floor} 楼的 stat_data`}；最多列出 2000 个叶子字段。这里只读展示，不会修改 MVU。` : '未找到 MVU 数据。'}</small><input data-mvu-label placeholder="显示名称，例如攻略值" aria-label="MVU 显示名称"><select data-mvu-path aria-label="MVU 变量路径"><option value="">选择变量路径</option>${paths.map(path => `<option value="${e(path.path)}">${e(path.path)} = ${e(String(path.value).slice(0, 70))}</option>`).join('')}</select><button data-action="add-mapping">添加展示字段</button>${mappings.map((mapping, i) => `<p>${e(mapping.label)}：${e(mapping.path)} <button data-remove="${i}">移除展示</button></p>`).join('')}</details>
            <small>世界书读取：${e(this.readAt || '尚未读取')}；页面分组参照角色图鉴的卡片详情与字段分类，原始字段保留供核对。</small>`;
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

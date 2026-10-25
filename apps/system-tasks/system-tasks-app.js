import { WorldbookManager } from '../../config/worldbook-manager.js';
import { clean, escapeHtml, findMvuRole, latestMvuSnapshot, parseFields } from '../dossier/dossier-data.js';

const css = `
.yzp-system-tasks{height:100%;min-height:0;display:flex;flex-direction:column;overflow:hidden;background:#f2f2f7;color:#1c1c1e;font:14px/1.45 -apple-system,BlinkMacSystemFont,"SF Pro Text","Helvetica Neue",sans-serif}
.yzp-system-tasks *{box-sizing:border-box}.yzp-system-tasks header{display:flex;align-items:center;gap:8px;flex-shrink:0;padding:10px 12px;border-bottom:1px solid rgba(60,60,67,.16);background:rgba(255,255,255,.94);backdrop-filter:blur(20px) saturate(150%);-webkit-backdrop-filter:blur(20px) saturate(150%)}
.yzp-system-tasks header strong{flex:1;font-size:16px;font-weight:650}.yzp-system-tasks button,.yzp-system-tasks input{font:inherit;color:inherit;border:1px solid rgba(60,60,67,.18);border-radius:12px;background:#fff;padding:9px 11px;min-height:42px}.yzp-system-tasks button{cursor:pointer}.yzp-system-tasks button:disabled{opacity:.48;cursor:not-allowed}
.yzp-system-tasks main{flex:1;min-height:0;overflow:auto;padding:12px 12px 20px;overscroll-behavior:contain;-webkit-overflow-scrolling:touch}.yzp-system-tasks h2{margin:8px 2px;font-size:18px}.yzp-system-tasks .muted,.yzp-system-tasks small{color:#73737a}.yzp-system-tasks small{display:block;font-size:11px}.yzp-system-tasks article{margin:8px 0;padding:13px;border:1px solid rgba(60,60,67,.12);border-radius:16px;background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.035)}
.yzp-system-tasks article p{margin:7px 0;white-space:pre-wrap;overflow-wrap:anywhere}.yzp-system-tasks .task-title{display:flex;align-items:center;justify-content:space-between;gap:8px;font-weight:650}.yzp-system-tasks .badge{flex:none;padding:3px 8px;border-radius:999px;background:#e9f7ef;color:#167a44;font-size:11px}.yzp-system-tasks .notice{margin:8px 0;padding:10px 12px;border-radius:12px;background:#fff7e5;color:#805300}.yzp-system-tasks .form{display:grid;grid-template-columns:1fr;gap:9px;margin-top:10px}.yzp-system-tasks input{width:100%;min-width:0}.yzp-system-tasks .primary{width:100%;border:0;background:#6157c8;color:#fff;font-weight:650}.yzp-system-tasks .secondary{background:#fff}.yzp-system-tasks .row{display:flex;gap:8px;align-items:center}.yzp-system-tasks .row button{flex:none}.yzp-system-tasks details{margin-top:8px}.yzp-system-tasks summary{cursor:pointer;font-weight:600}.yzp-system-tasks .field{padding:7px 0;border-top:1px solid rgba(60,60,67,.09)}.yzp-system-tasks .field b{display:block;color:#73737a;font-size:11px}.yzp-system-tasks .field p{margin:3px 0}.yzp-system-tasks .footer{padding:8px 2px;color:#8a8a90;font-size:11px}
`;

const sourceDirectoryPattern = /CWB角色世界书档案目录|当前角色卡档案目录/;

function entryList(book) {
    return Array.isArray(book?.entries) ? book.entries : Object.values(book?.entries || {});
}

function parseCentralDirectory(books) {
    const result = [];
    for (const book of books || []) {
        for (const entry of entryList(book)) {
            if (!sourceDirectoryPattern.test(`${entry.comment || ''}\n${entry.content || ''}`)) continue;
            let sourceBook = '';
            for (const line of String(entry.content || '').split(/\r?\n/)) {
                const heading = line.match(/【故事线世界书：([^】]+)】/);
                if (heading) { sourceBook = clean(heading[1]); continue; }
                const row = line.match(/^\s*\[([^\]]+)\]\s*→\s*世界书《([^》]+)》中的「([^」]+)」/);
                if (row) result.push({ name: clean(row[1]), book: clean(row[2] || sourceBook), dynamicComment: clean(row[3]) });
            }
        }
    }
    return result;
}

function parseLocalDirectories(books) {
    const result = [];
    for (const book of books || []) {
        for (const entry of entryList(book)) {
            if (!/^CWB目录/.test(entry.comment || '') && !/【小故事线目录】/.test(entry.content || '')) continue;
            const names = [...String(entry.content || '').matchAll(/^\s*姓名\s*[:：]\s*["“]?([^"”\r\n]+)["”]?\s*$/gm)];
            for (const match of names) result.push({ name: clean(match[1]), book: book.name, dynamicComment: `动态-${clean(match[1])}` });
        }
    }
    return result;
}

function entryHasRoleName(entry, name) {
    return parseFields(entry.content).some(field => field.label === '姓名' && clean(field.value) === name);
}

function isDynamicEntry(entry) {
    const type = parseFields(entry.content).find(field => field.label === '档案类型')?.value || '';
    return /^动态-/.test(entry.comment || '')
        || /^\[--角色档案开始--\]/.test(entry.content || '')
        || /动态/.test(type);
}

function sourceFor(entries, name, type, dynamicComment) {
    const candidates = entryList({ entries }).filter(entry => String(entry.content || '').trim());
    if (type === 'dynamic') {
        const preferred = candidates.filter(entry => clean(entry.comment) === dynamicComment);
        if (preferred.length) return preferred;
        return candidates.filter(entry => clean(entry.comment) === '动态-' + name
            || isDynamicEntry(entry) && entryHasRoleName(entry, name));
    }
    return candidates.filter(entry => !isDynamicEntry(entry)
        && (clean(entry.comment) === name || entryHasRoleName(entry, name)));
}

function flattenEntries(books) {
    return (books || []).flatMap(book => entryList(book).map(entry => ({
        ...entry,
        book: book.name,
        bookName: book.name
    })));
}

function namesFromSources(entries, mvuData) {
    const names = new Set();
    for (const entry of entries || []) {
        const comment = clean(entry.comment);
        if (comment.startsWith('动态-')) names.add(clean(comment.slice(3)));
        for (const field of parseFields(entry.content)) {
            if (field.label === '姓名' && clean(field.value)) names.add(clean(field.value));
        }
    }
    const roles = mvuData?.roles;
    if (roles && typeof roles === 'object' && !Array.isArray(roles)) {
        for (const [id, role] of Object.entries(roles)) {
            if (id === '$meta' || !role || typeof role !== 'object' || Array.isArray(role)) continue;
            const name = clean(role.role_name || id);
            if (name && name !== '$meta') names.add(name);
        }
    }
    return [...names].filter(Boolean);
}

function relevantChatContext(chat, name, maxChars = 5000) {
    const matching = (Array.isArray(chat) ? chat : []).slice(-40).map(message => {
        const content = String(message?.mes || message?.content || '').trim();
        if (!content.includes(name)) return null;
        const speaker = message?.is_user ? '用户' : clean(message?.name || 'AI');
        return { speaker, content: content.slice(0, 900) };
    }).filter(Boolean).slice(-8);
    let remaining = maxChars;
    const result = [];
    for (const item of matching.reverse()) {
        if (remaining <= 0) break;
        const content = item.content.slice(0, remaining);
        result.unshift({ speaker: item.speaker, content });
        remaining -= content.length;
    }
    return result;
}

function taskRows(data) {
    const roles = data?.roles;
    if (!roles || typeof roles !== 'object' || Array.isArray(roles)) return [];
    const rows = [];
    for (const [roleId, role] of Object.entries(roles)) {
        if (roleId === '$meta' || !role || typeof role !== 'object' || Array.isArray(role)) continue;
        const linked = role['关联任务'];
        if (linked && typeof linked === 'object' && !Array.isArray(linked) && Object.keys(linked).some(key => key !== '$meta')) {
            if (linked['是否完成'] !== true) rows.push({ roleId, roleName: role.role_name || roleId, title: linked['类型'] || '攻略任务', goal: linked['任务目标'] || '', reward: linked['奖励'] || {}, condition: linked['完成条件'] || '', source: '关联任务' });
        }
        const legacy = role.quests;
        if (legacy && typeof legacy === 'object' && !Array.isArray(legacy)) {
            for (const [id, quest] of Object.entries(legacy)) {
                if (id === '$meta' || !quest || typeof quest !== 'object' || quest.status !== 'active') continue;
                rows.push({ roleId, roleName: quest.role_name || role.role_name || roleId, title: '攻略任务', goal: quest.goal || '', reward: { 系统点: quest.reward || 0, 好感度: quest.affection_reward || 0 }, condition: quest.condition || '', progress: quest.progress || '', source: 'quests' });
            }
        }
    }
    return rows;
}

function readable(value) {
    if (value === undefined || value === null || value === '') return '未记录';
    if (typeof value === 'object') {
        try { return JSON.stringify(value, null, 2); } catch (_) { return '未记录'; }
    }
    return String(value);
}

export class SystemTasksApp {
    constructor(phoneShell, storage) {
        this.phoneShell = phoneShell;
        this.storage = storage;
        this.manager = new WorldbookManager(storage);
        this.active = true;
        this.loading = false;
        this.sending = false;
        this.books = [];
        this.characters = [];
        this.mvu = null;
        this.errors = [];
        this.notice = '';
        this.sequence = 0;
        this.bindEvents();
    }

    context() { return window.SillyTavern?.getContext?.() || {}; }
    scope() {
        const ctx = this.context();
        return JSON.stringify([ctx.characterId, ctx.groupId, ctx.chatId, ctx.chatMetadata?.file_name]);
    }
    isActive() {
        const panel = document.getElementById('phone-panel');
        return this.active && !document.hidden && (!panel || panel.classList.contains('phone-panel-open'));
    }

    bindEvents() {
        window.addEventListener('phone:openApp', event => {
            this.active = event.detail?.appId === 'system-tasks';
            if (this.active) this.refresh();
            else this.sequence++;
        });
        window.addEventListener('phone:goHome', () => { this.active = false; this.sequence++; });
        window.addEventListener('phone:panelVisibility', event => {
            if (event.detail?.open && this.isActive()) this.refresh();
            else if (!event.detail?.open) this.sequence++;
        });
        document.addEventListener('visibilitychange', () => { if (this.isActive()) this.refresh(); });
        const ctx = this.context();
        for (const name of ['MESSAGE_RECEIVED', 'MESSAGE_UPDATED', 'MESSAGE_DELETED', 'MESSAGE_SWIPED', 'GENERATION_ENDED', 'WORLDINFO_UPDATED']) {
            if (ctx.event_types?.[name]) ctx.eventSource?.on(ctx.event_types[name], () => {
                if (!this.isActive()) return;
                if (name === 'GENERATION_ENDED') {
                    this.sending = false;
                    clearTimeout(this.sendingFallbackTimer);
                }
                clearTimeout(this.refreshTimer);
                this.refreshTimer = setTimeout(() => this.refresh(), name === 'GENERATION_ENDED' ? 250 : 500);
            });
        }
    }

    async render() {
        this.active = true;
        this.draw();
        await this.refresh();
    }

    async refresh() {
        if (this.loading || !this.isActive()) return;
        this.loading = true;
        const token = ++this.sequence;
        const scope = this.scope();
        this.errors = [];
        this.draw();
        try {
            const ctx = this.context();
            const mvuApi = ctx.Mvu || window.Mvu || window.parent?.Mvu;
            const snapshot = latestMvuSnapshot(typeof mvuApi?.getMvuData === 'function' ? args => mvuApi.getMvuData(args) : null, ctx.chat || []);
            let availableBooks = [];
            try { availableBooks = await this.manager.fetchAllAvailableWorldBooks(); }
            catch (error) { this.errors.push(`全局角色档案列表读取失败：${error?.message || '读取失败'}`); }
            const results = await Promise.allSettled(availableBooks.map(book => this.manager.readDossierWorldbook(book.name)));
            const books = results.filter(result => result.status === 'fulfilled').map(result => result.value);
            if (token !== this.sequence || scope !== this.scope() || !this.active) return;
            this.books = books;
            this.entries = flattenEntries(books);
            this.mvu = snapshot;
            const card = ctx.characters?.[ctx.characterId];
            this.preferredBooks = [
                ...(Array.isArray(ctx.chatMetadata?.world_info) ? ctx.chatMetadata.world_info : [ctx.chatMetadata?.world_info]),
                card?.data?.extensions?.world
            ].filter(Boolean).map(clean);
            this.errors.push(...results.flatMap((result, index) => result.status === 'rejected'
                ? [`${availableBooks[index]?.name || '世界书'}：${result.reason?.message || '读取失败'}`] : []));
            const names = namesFromSources(this.entries, snapshot?.data);
            this.characters = names.map(name => this.resolveRole(name)).filter(result => !result.error).map(result => result.role);
            this.tasks = taskRows(snapshot?.data);
            this.readAt = new Date().toLocaleTimeString();
        } catch (error) {
            if (token === this.sequence) this.errors = [error?.message || '读取任务数据失败'];
        } finally {
            if (token === this.sequence) { this.loading = false; this.draw(); }
        }
    }

    taskCard(task) {
        const reward = task.reward;
        return `<article><div class="task-title"><span>${escapeHtml(task.roleName)} · ${escapeHtml(task.title)}</span><span class="badge">进行中</span></div>
            <p><b>目标：</b>${escapeHtml(task.goal || '未记录')}</p>
            <p><b>奖励：</b>${escapeHtml(readable(reward))}</p>
            <p><b>完成条件：</b>${escapeHtml(task.condition || '未记录')}</p>
            ${task.progress ? `<p><b>进度：</b>${escapeHtml(task.progress)}</p>` : ''}
            <small>角色 ID：${escapeHtml(task.roleId)}</small></article>`;
    }

    draw() {
        if (!this.active) return;
        const taskList = (this.tasks || []).length ? this.tasks.map(task => this.taskCard(task)).join('') : '<article class="muted">当前没有进行中的任务。</article>';
        const names = [...new Set((this.characters || []).map(row => row.name))].sort((a, b) => a.localeCompare(b, 'zh-CN'));
        const activeTask = (this.tasks || []).length > 0;
        const errors = this.errors.map(error => `<div class="notice">${escapeHtml(error)}</div>`).join('');
        const hasDirectories = (this.books || []).some(book => [...parseCentralDirectory([book]), ...parseLocalDirectories([book])].length > 0);
        const sourceErrors = this.characters.length ? ''
            : '<div class="notice">暂未从当前聊天 MVU 与自动检索到的角色档案中识别出可用角色；仍可输入角色姓名，按“生成”后会再次检索匹配。</div>';
        const status = this.loading ? '<small>正在读取当前聊天上下文、MVU 与可用角色档案…</small>' : `<small>已扫描 ${this.books.length} 本可用资料 · 识别 ${this.characters.length} 个可用角色 · ${escapeHtml(this.readAt || '')}</small>`;
        this.phoneShell.setContent(`<style>${css}</style><div class="yzp-system-tasks"><header><button type="button" data-action="back" aria-label="返回">‹</button><strong>任务系统</strong><button type="button" class="secondary" data-action="refresh" ${this.loading ? 'disabled' : ''}>刷新</button></header><main>
            ${errors}${this.notice ? `<div class="notice">${escapeHtml(this.notice)}</div>` : ''}
            <h2>当前任务</h2>${taskList}
            <h2>生成攻略任务</h2><article><p class="muted">输入角色姓名后，模块会从当前聊天上下文、MVU 和自动检索到的角色档案中取材，不要求绑定世界书或提供 CWB 目录。</p>
            ${sourceErrors}<div class="form"><input id="yzp-task-role-name" list="yzp-task-role-options" placeholder="输入角色正式姓名" autocomplete="off" aria-label="任务目标角色姓名"><datalist id="yzp-task-role-options">${names.map(name => `<option value="${escapeHtml(name)}"></option>`).join('')}</datalist>
            <button type="button" class="primary" data-action="generate" ${this.sending || this.loading || activeTask ? 'disabled' : ''}>${this.sending ? '已提交，等待回复…' : activeTask ? '已有进行中任务' : '一键生成任务'}</button></div>
            ${activeTask ? '<small>完成或取消当前任务后，才能创建下一项。</small>' : '<small>任务将在 AI 回复并由 MVU 结算脚本处理后，显示在上方。</small>'}</article>
            <div class="footer">角色资料来自当前聊天上下文、MVU 与自动检索的档案；任务状态以当前聊天 MVU 为准。</div>${status}</main></div>`, 'system-tasks-main');
        const root = document.querySelector('.phone-view-current .yzp-system-tasks') || document.querySelector('.yzp-system-tasks');
        root?.querySelector('[data-action="back"]')?.addEventListener('click', () => window.dispatchEvent(new CustomEvent('phone:goHome')));
        root?.querySelector('[data-action="refresh"]')?.addEventListener('click', () => { this.notice = ''; this.refresh(); });
        root?.querySelector('[data-action="generate"]')?.addEventListener('click', () => {
            this.generate(root).catch(error => {
                this.sending = false;
                this.notice = `任务请求失败：${error?.message || '请重试'}`;
                this.draw();
            });
        });
    }

    resolveRole(name) {
        const normalized = clean(name).normalize('NFKC');
        if (!normalized) return { error: '请先输入角色姓名。' };
        const entries = this.entries || flattenEntries(this.books);
        const mappings = [...parseCentralDirectory(this.books), ...parseLocalDirectories(this.books)]
            .filter(row => clean(row.name).normalize('NFKC') === normalized);
        const mapping = mappings.length === 1 ? mappings[0] : null;
        let scopedEntries = entries;
        if (mapping?.book && entries.some(entry => entry.bookName === mapping.book)) {
            scopedEntries = entries.filter(entry => entry.bookName === mapping.book);
        }
        const dynamicComment = mapping?.dynamicComment || `动态-${normalized}`;
        let staticSources = sourceFor(scopedEntries, normalized, 'static', dynamicComment);
        let dynamicSources = sourceFor(scopedEntries, normalized, 'dynamic', dynamicComment);
        const preferContextBook = sources => {
            const preferred = (sources || []).filter(source => this.preferredBooks?.includes(source.bookName || source.book));
            return preferred.length ? preferred : sources;
        };
        staticSources = preferContextBook(staticSources);
        dynamicSources = preferContextBook(dynamicSources);
        if (staticSources.length > 1 || dynamicSources.length > 1) {
            return { error: `“${normalized}”在当前角色档案中匹配到多条来源，无法安全判断对应角色，请先消除同名重复档案。` };
        }
        const mvuMatch = findMvuRole(this.mvu?.data, normalized);
        const context = relevantChatContext(this.context().chat || [], normalized);
        const staticEntry = staticSources[0] || null;
        const dynamicEntry = dynamicSources[0] || null;
        if (!staticEntry && !mvuMatch.role && !context.length) {
            return { error: `当前聊天上下文、MVU 和全部可用角色档案中都没有找到“${normalized}”的资料。` };
        }
        if (!dynamicEntry && !mvuMatch.role && !context.length) {
            return { error: `找到“${normalized}”的静态档案，但当前聊天上下文、MVU 与角色动态档案中都没有可用进度信息。` };
        }
        const book = staticEntry?.bookName || dynamicEntry?.bookName || mapping?.book || '当前聊天上下文';
        const role = { id: JSON.stringify([book, normalized]), name: normalized, book, staticSources, dynamicSources };
        return { role, staticEntry, dynamicEntry, mvuRole: mvuMatch.role, mvuRoleId: mvuMatch.id, context };
    }

    buildRequest(formalName, resolved, mvuRole, mvuRoleId) {
        const entryData = entry => entry ? {
            worldbook: entry.bookName || entry.book || '',
            title: entry.comment || '',
            uid: entry.uid ?? null,
            content: entry.content || ''
        } : null;
        const source = {
            role: formalName,
            source: { static: entryData(resolved.staticEntry), dynamic: entryData(resolved.dynamicEntry) },
            current_context: resolved.context,
            current_mvu: { role_id: mvuRoleId || formalName, role: mvuRole || null }
        };
        return `请根据当前聊天已激活的任务系统规则，为指定角色生成一项攻略任务。\n目标角色正式姓名：${formalName}\n\n插件已从当前聊天上下文、最新 MVU 和自动检索到的对应角色档案中整理资料；CWB 目录和世界书绑定不是前置条件。只把以下资料作为事实来源，缺失信息不得编造；关系阶段与角色边界以角色专属角色档案为准，当前数值和任务状态以 MVU/当前聊天为准。\n<任务角色资料JSON>\n${JSON.stringify(source, null, 2)}\n</任务角色资料JSON>\n\n必须先检查全局是否已有进行中的任务；若已有，不创建任务并说明原因。若可生成，任务主体为主角，目标与完成条件必须具体、可观察、符合角色当前目标及阶段。只创建一项，奖励遵循当前聊天中已加载的任务规则。通过现有中文简报协议提交任务创建操作；不得直接改写余额或在插件本地另存任务。回复只简要显示任务卡或无法生成的原因。`;
    }

    async generate(root) {
        if (this.sending) return;
        const input = root.querySelector('#yzp-task-role-name');
        const resolved = this.resolveRole(input?.value || '');
        if (resolved.error) { this.notice = resolved.error; this.draw(); return; }
        if ((this.tasks || []).length) { this.notice = '已有进行中的任务，请先完成或取消。'; this.draw(); return; }
        const ctx = this.context();
        const roleName = resolved.role.name;
        const mvuRoles = this.mvu?.data?.roles || {};
        const matches = Object.entries(mvuRoles).filter(([, role]) => role && typeof role === 'object' && String(role.role_name || '').trim() === roleName);
        const direct = mvuRoles[roleName];
        if (matches.length > 1) { this.notice = `MVU 中有多个角色记录对应“${roleName}”，为避免写错角色，本次未发送。`; this.draw(); return; }
        const directMatches = direct && typeof direct === 'object' && (!direct.role_name || String(direct.role_name).trim() === roleName);
        const mvuRoleId = matches.length === 1 ? matches[0][0] : roleName;
        const mvuRole = matches.length === 1 ? matches[0][1] : directMatches ? direct : null;
        const inputBox = document.querySelector('#send_textarea');
        const sendButton = document.querySelector('#send_but');
        if (!inputBox || !sendButton) { this.notice = '没有找到酒馆聊天输入框或发送按钮。请打开正常聊天窗口后重试。'; this.draw(); return; }
        if (String(inputBox.value || '').trim()) { this.notice = '聊天输入框已有未发送内容。请先发送或清空，再生成任务，避免把其他草稿一并发送。'; this.draw(); return; }
        this.notice = '';
        this.sending = true;
        this.draw();
        const request = this.buildRequest(roleName, resolved, mvuRole, mvuRoleId);
        inputBox.value = request;
        inputBox.dispatchEvent(new Event('input', { bubbles: true }));
        inputBox.dispatchEvent(new Event('change', { bubbles: true }));
        const currentScope = this.scope();
        setTimeout(() => {
            if (currentScope !== this.scope() || !this.isActive()) { this.sending = false; this.notice = '聊天已切换，任务请求留在输入框中，未自动发送。'; this.draw(); return; }
            try {
                sendButton.click();
                this.notice = `已读取“${roleName}”的当前聊天/MVU信息${resolved.staticEntry || resolved.dynamicEntry ? '与角色档案' : ''}，并向当前聊天提交任务请求。MVU 更新后会自动刷新任务列表。`;
                this.draw();
                clearTimeout(this.sendingFallbackTimer);
                this.sendingFallbackTimer = setTimeout(() => {
                    this.sending = false;
                    if (this.isActive()) this.refresh();
                }, 30000);
            } catch (error) {
                this.sending = false;
                this.notice = `发送失败：${error?.message || '请重试'}`;
                this.draw();
            }
        }, 80);
    }

}


import { WorldbookManager } from '../../config/worldbook-manager.js';
import { clean, escapeHtml, latestMvuSnapshot, parseFields } from '../dossier/dossier-data.js';

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

function sourceFor(entries, name, type, dynamicComment) {
    // Dossier lookup is a catalog read, not worldbook prompt activation. Keep
    // entries that have content even when the worldbook/entry is not active.
    const candidates = entryList({ entries }).filter(entry => String(entry.content || '').trim());
    if (type === 'dynamic') {
        const preferred = candidates.filter(entry => clean(entry.comment) === dynamicComment);
        if (preferred.length) return preferred;
        return candidates.filter(entry => clean(entry.comment) === `动态-${name}` || /^\[--角色档案开始--\]/.test(entry.content || '')
            && parseFields(entry.content).some(field => field.label === '姓名' && clean(field.value) === name));
    }
    return candidates.filter(entry => clean(entry.comment) === name
        || parseFields(entry.content).some(field => field.label === '姓名' && clean(field.value) === name)
            && !/^动态-/.test(entry.comment || '') && !/^\[--角色档案开始--\]/.test(entry.content || ''));
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
            const defaultNames = await this.manager.getDossierDefaultBooks();
            // Include every worldbook in SillyTavern's catalog, not only books
            // attached to or activated for the current chat/card.
            const availableBooks = await this.manager.fetchAllAvailableWorldBooks();
            const initialNames = [...new Set([
                ...defaultNames,
                ...availableBooks.map(book => book.name).filter(Boolean)
            ])];
            const initialResults = await Promise.allSettled(initialNames.map(name => this.manager.readDossierWorldbook(name)));
            const initialBooks = initialResults.filter(result => result.status === 'fulfilled').map(result => result.value);
            const directories = [...parseCentralDirectory(initialBooks), ...parseLocalDirectories(initialBooks)];
            const allNames = [...new Set([...initialNames, ...directories.map(row => row.book).filter(Boolean)])];
            const extraResults = await Promise.allSettled(allNames.filter(name => !initialNames.includes(name)).map(name => this.manager.readDossierWorldbook(name)));
            const extraBooks = extraResults.filter(result => result.status === 'fulfilled').map(result => result.value);
            const books = [...initialBooks, ...extraBooks];
            const ctx = this.context();
            const mvuApi = ctx.Mvu || window.Mvu || window.parent?.Mvu;
            const snapshot = latestMvuSnapshot(typeof mvuApi?.getMvuData === 'function' ? args => mvuApi.getMvuData(args) : null, ctx.chat || []);
            if (token !== this.sequence || scope !== this.scope() || !this.active) return;
            this.books = books;
            this.errors = [
                ...initialResults.flatMap((result, index) => result.status === 'rejected' ? [`${initialNames[index]}：${result.reason?.message || '读取失败'}`] : []),
                ...extraResults.flatMap((result, index) => result.status === 'rejected' ? [`${allNames.filter(name => !initialNames.includes(name))[index]}：${result.reason?.message || '读取失败'}`] : [])
            ];
            const bookByName = new Map(books.map(book => [book.name, book]));
            const unique = new Map();
            for (const row of directories) {
                if (!row.name || !row.book) continue;
                const book = bookByName.get(row.book);
                const staticSources = sourceFor(book?.entries, row.name, 'static', row.dynamicComment);
                const dynamicSources = sourceFor(book?.entries, row.name, 'dynamic', row.dynamicComment);
                const key = JSON.stringify([row.name, row.book, row.dynamicComment]);
                unique.set(key, { ...row, staticSources, dynamicSources });
            }
            // The task picker should only expose characters with a usable dynamic
            // dossier entry. Directory rows without a live `动态-角色名` source
            // are not actionable for task generation and should stay out of the list.
            this.characters = [...unique.values()].filter(row => row.dynamicSources.length > 0);
            this.mvu = snapshot;
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
        const sourceErrors = this.characters.length ? '' : hasDirectories
            ? '<div class="notice">目录中没有找到启用且包含内容的动态角色档案（条目名称应为“动态-角色名”）。</div>'
            : '<div class="notice">未找到角色目录。请确认当前聊天已绑定包含 CWB 角色目录的世界书。</div>';
        const status = this.loading ? '<small>正在读取世界书目录与最新 MVU…</small>' : `<small>已读取 ${this.books.length} 本关联世界书 · ${this.characters.length} 条含动态资料的角色记录 · ${escapeHtml(this.readAt || '')}</small>`;
        this.phoneShell.setContent(`<style>${css}</style><div class="yzp-system-tasks"><header><button type="button" data-action="back" aria-label="返回">‹</button><strong>任务系统</strong><button type="button" class="secondary" data-action="refresh" ${this.loading ? 'disabled' : ''}>刷新</button></header><main>
            ${errors}${this.notice ? `<div class="notice">${escapeHtml(this.notice)}</div>` : ''}
            <h2>当前任务</h2>${taskList}
            <h2>生成攻略任务</h2><article><p class="muted">输入角色姓名后，模块会从目录定位该角色的静态资料和动态资料，并附上当前 MVU 状态提交给本轮 AI。</p>
            ${sourceErrors}<div class="form"><input id="yzp-task-role-name" list="yzp-task-role-options" placeholder="输入角色正式姓名" autocomplete="off" aria-label="任务目标角色姓名"><datalist id="yzp-task-role-options">${names.map(name => `<option value="${escapeHtml(name)}"></option>`).join('')}</datalist>
            <button type="button" class="primary" data-action="generate" ${this.sending || this.loading || activeTask || !names.length ? 'disabled' : ''}>${this.sending ? '已提交，等待回复…' : activeTask ? '已有进行中任务' : '一键生成任务'}</button></div>
            ${activeTask ? '<small>完成或取消当前任务后，才能创建下一项。</small>' : '<small>任务将在 AI 回复并由 MVU 结算脚本处理后，显示在上方。</small>'}</article>
            <div class="footer">角色资料按目录映射读取；任务状态以当前聊天 MVU 为准。</div>${status}</main></div>`, 'system-tasks-main');
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
        const matches = (this.characters || []).filter(row => row.name.normalize('NFKC') === normalized);
        if (!matches.length) return { error: `目录中没有找到“${normalized}”。请使用角色正式姓名。` };
        if (matches.length > 1) return { error: `目录中找到 ${matches.length} 条“${normalized}”记录，来源不唯一；请先整理目录中的重复映射。` };
        const role = matches[0];
        if (!role.staticSources?.length) return { error: `已找到“${normalized}”的动态条目，但没有找到可用的静态资料条目。` };
        if (!role.dynamicSources?.length) return { error: `已找到“${normalized}”的静态条目，但没有找到目录指定的动态条目“${role.dynamicComment}”。` };
        if (role.staticSources.length !== 1 || role.dynamicSources.length !== 1) return { error: `“${normalized}”的静态或动态条目存在多个有效匹配，不能自动选择。` };
        return { role, staticEntry: role.staticSources[0], dynamicEntry: role.dynamicSources[0] };
    }

    buildRequest(formalName, resolved, mvuRole, mvuRoleId) {
        const source = {
            role: formalName,
            source: {
                worldbook: resolved.role.book,
                static: { title: resolved.staticEntry.comment, uid: resolved.staticEntry.uid, content: resolved.staticEntry.content },
                dynamic: { title: resolved.dynamicEntry.comment, uid: resolved.dynamicEntry.uid, content: resolved.dynamicEntry.content }
            },
            current_mvu: { role_id: mvuRoleId || formalName, role: mvuRole || null }
        };
        return `请根据当前聊天已激活的任务系统规则，为指定角色生成一项攻略任务。\n目标角色正式姓名：${formalName}\n\n以下是插件按 CWB 目录读取到的静态资料、动态资料和当前聊天 MVU。只把它们作为事实来源；关系阶段与角色边界以角色专属世界书为准，当前数值和任务状态以 MVU 为准。\n<任务角色资料JSON>\n${JSON.stringify(source, null, 2)}\n</任务角色资料JSON>\n\n必须先检查全局是否已有进行中的任务；若已有，不创建任务并说明原因。若可生成，任务主体为主角，目标与完成条件必须具体、可观察、符合角色当前目标及阶段。只创建一项，奖励遵循当前世界书规则。通过现有中文简报协议提交任务创建操作；不得直接改写余额或在插件本地另存任务。回复只简要显示任务卡或无法生成的原因。`;
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
                this.notice = `已从《${resolved.role.book}》读取“${resolved.staticEntry.comment}”和“${resolved.dynamicEntry.comment}”，并向当前聊天提交任务请求。MVU 更新后会自动刷新任务列表。`;
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


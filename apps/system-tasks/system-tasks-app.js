import { WorldbookManager } from '../../config/worldbook-manager.js';
import { clean, escapeHtml, findMvuRole, latestMvuSnapshot, parseFields } from '../dossier/dossier-data.js';

const css = `
.yzp-system-tasks{height:100%;min-height:0;display:flex;flex-direction:column;overflow:hidden;background:#f2f2f7;color:#1c1c1e;font:14px/1.45 -apple-system,BlinkMacSystemFont,"SF Pro Text","Helvetica Neue",sans-serif}
.yzp-system-tasks *{box-sizing:border-box}.yzp-system-tasks header{display:flex;align-items:center;gap:8px;flex-shrink:0;padding:10px 12px;border-bottom:1px solid rgba(60,60,67,.16);background:rgba(255,255,255,.94);backdrop-filter:blur(20px) saturate(150%);-webkit-backdrop-filter:blur(20px) saturate(150%)}
.yzp-system-tasks header strong{flex:1;font-size:16px;font-weight:650}.yzp-system-tasks button,.yzp-system-tasks input{font:inherit;color:inherit;border:1px solid rgba(60,60,67,.18);border-radius:12px;background:#fff;padding:9px 11px;min-height:44px}.yzp-system-tasks button{cursor:pointer}.yzp-system-tasks button:disabled{opacity:.68;cursor:not-allowed}
.yzp-system-tasks main{flex:1;min-height:0;overflow:auto;padding:12px 12px 20px;overscroll-behavior:contain;-webkit-overflow-scrolling:touch}.yzp-system-tasks h2{margin:8px 2px;font-size:18px}.yzp-system-tasks .muted,.yzp-system-tasks small{color:#55545d}.yzp-system-tasks small{display:block;font-size:11px}.yzp-system-tasks article{margin:8px 0;padding:13px;border:1px solid rgba(60,60,67,.12);border-radius:16px;background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.035)}
.yzp-system-tasks article p{margin:7px 0;white-space:pre-wrap;overflow-wrap:anywhere}.yzp-system-tasks .task-title{display:flex;align-items:center;justify-content:space-between;gap:8px;font-weight:650}.yzp-system-tasks .badge{flex:none;padding:3px 8px;border-radius:999px;background:#e9f7ef;color:#167a44;font-size:11px}.yzp-system-tasks .notice{margin:8px 0;padding:10px 12px;border-radius:12px;background:#fff4d6;color:#684400}.yzp-system-tasks .form{display:grid;grid-template-columns:1fr;gap:9px;margin-top:10px}.yzp-system-tasks input{width:100%;min-width:0}.yzp-system-tasks .primary{width:100%;border:0;background:#5148b8;color:#fff;font-weight:650}.yzp-system-tasks .secondary{background:#fff}.yzp-system-tasks .row{display:flex;gap:8px;align-items:center}.yzp-system-tasks .row button{flex:none}.yzp-system-tasks details{margin-top:8px}.yzp-system-tasks summary{cursor:pointer;font-weight:600}.yzp-system-tasks .field{padding:7px 0;border-top:1px solid rgba(60,60,67,.09)}.yzp-system-tasks .field b{display:block;color:#55545d;font-size:11px}.yzp-system-tasks .field p{margin:3px 0}.yzp-system-tasks .footer{padding:8px 2px;color:#55545d;font-size:11px}.yzp-system-tasks .source-preview{margin-top:10px;padding:10px;border-radius:12px;background:#f8f7fb;border:1px solid #e2dfeb}.yzp-system-tasks .source-preview details{padding-top:4px}.yzp-system-tasks .scan-status{min-height:18px;margin-top:6px;color:#5148b8;font-size:12px}
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
    const result = [];
    for (const entry of entryList({ entries })) {
        const content = String(entry.content || '').trim();
        const comment = clean(entry.comment);
        if (!content || /^CWB目录/.test(comment) || /【小故事线目录】/.test(content)
            || sourceDirectoryPattern.test(`${comment}\n${content.slice(0, 240)}`)) continue;
        const byComment = comment === name || comment === `动态-${name}` || comment === dynamicComment;
        if (!byComment && !content.includes(name)) continue;
        const fields = parseFields(content);
        const byNameField = fields.some(field => field.label === '姓名' && clean(field.value) === name);
        if (!byComment && !byNameField) continue;
        const archiveType = fields.find(field => field.label === '档案类型')?.value || '';
        const dynamic = /^动态-/.test(comment) || /^\[--角色档案开始--\]/.test(content) || /动态/.test(archiveType);
        if (type === 'dynamic' ? dynamic : !dynamic) result.push(entry);
    }
    const exactComment = type === 'dynamic' ? dynamicComment : name;
    const exact = result.filter(entry => clean(entry.comment) === exactComment);
    return exact.length ? exact : result;
}

function flattenEntries(books) {
    return (books || []).flatMap(book => entryList(book).map(entry => ({
        ...entry,
        book: book.name,
        bookName: book.name
    })));
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
        if (!linked || typeof linked !== 'object' || Array.isArray(linked)) continue;
        if (linked['类型'] === '攻略任务' && linked['是否完成'] === false) {
            rows.push({ roleId, roleName: role.role_name || roleId, title: linked['类型'], goal: linked['任务目标'] || '', reward: linked['奖励'] || {}, condition: linked['完成条件'] || '', source: '关联任务' });
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
        this.searching = false;
        this.sending = false;
        this.books = [];
        this.mvu = null;
        this.errors = [];
        this.notice = '';
        this.targetName = '';
        this.resolved = null;
        this.scanStatus = '';
        this.sequence = 0;
        this.searchSequence = 0;
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
            else { this.sequence++; this.searchSequence++; this.searching = false; }
        });
        window.addEventListener('phone:goHome', () => { this.active = false; this.sequence++; this.searchSequence++; this.searching = false; });
        window.addEventListener('phone:panelVisibility', event => {
            if (event.detail?.open && this.isActive()) this.refresh();
            else if (!event.detail?.open) { this.sequence++; this.searchSequence++; this.searching = false; }
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
        if (this.resolved?.scope && this.resolved.scope !== scope) {
            this.resolved = null;
            this.scanStatus = '聊天已切换，请重新检索目标角色资料。';
        }
        this.errors = [];
        this.draw();
        try {
            const ctx = this.context();
            const mvuApi = ctx.Mvu || window.Mvu || window.parent?.Mvu;
            const snapshot = latestMvuSnapshot(typeof mvuApi?.getMvuData === 'function' ? args => mvuApi.getMvuData(args) : null, ctx.chat || []);
            if (token !== this.sequence || scope !== this.scope() || !this.active) return;
            this.mvu = snapshot;
            this.tasks = taskRows(snapshot?.data);
            const card = ctx.characters?.[ctx.characterId];
            this.preferredBooks = [
                ...(Array.isArray(ctx.chatMetadata?.world_info) ? ctx.chatMetadata.world_info : [ctx.chatMetadata?.world_info]),
                card?.data?.extensions?.world
            ].filter(Boolean).map(clean);
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
            <small>角色 ID：${escapeHtml(task.roleId)}</small></article>`;
    }

    draw() {
        if (!this.active) return;
        const taskList = (this.tasks || []).length ? this.tasks.map(task => this.taskCard(task)).join('') : '<article class="muted">当前没有进行中的任务。</article>';
        const activeTask = (this.tasks || []).length > 0;
        const errors = this.errors.map(error => `<div class="notice">${escapeHtml(error)}</div>`).join('');
        const status = this.scanStatus || (this.searching ? '正在检索角色档案…' : this.loading ? '正在读取当前聊天任务状态…' : `任务状态来自当前聊天最新 MVU · ${escapeHtml(this.readAt || '尚未读取')}`);
        const preview = this.resolved ? `<div class="source-preview"><strong>已匹配：${escapeHtml(this.resolved.role.name)}</strong>
            <p><b>当前目标：</b>${escapeHtml(this.resolved.currentGoal)}</p><p><b>与主角关系：</b>${escapeHtml(this.resolved.relationship || '未记录')}</p>
            <small>静态资料：${escapeHtml(this.resolved.staticEntry ? `${this.resolved.staticEntry.bookName} / ${this.resolved.staticEntry.comment}` : '未找到，生成时仅参考 MVU 与聊天上下文')}</small>
            <small>动态资料：${escapeHtml(this.resolved.dynamicEntry ? `${this.resolved.dynamicEntry.bookName} / ${this.resolved.dynamicEntry.comment}` : '未找到，生成时仅参考 MVU 与聊天上下文')}</small>
            ${this.resolved.scanErrors?.length ? `<small>有 ${this.resolved.scanErrors.length} 本资料读取失败；本次仅使用已成功匹配的来源。</small>` : ''}
            ${this.resolved.dynamicEntry ? `<details><summary>预览动态档案</summary><p>${escapeHtml(this.resolved.dynamicEntry.content.slice(0, 1200))}${this.resolved.dynamicEntry.content.length > 1200 ? '…' : ''}</p></details>` : ''}
            ${this.resolved.staticEntry ? `<details><summary>预览静态档案</summary><p>${escapeHtml(this.resolved.staticEntry.content.slice(0, 800))}${this.resolved.staticEntry.content.length > 800 ? '…' : ''}</p></details>` : ''}</div>` : '';
        this.phoneShell.setContent(`<style>${css}</style><div class="yzp-system-tasks"><header><button type="button" data-action="back" aria-label="返回">‹</button><strong>任务系统</strong><button type="button" class="secondary" data-action="refresh" ${this.loading ? 'disabled' : ''}>刷新</button></header><main>
            ${errors}${this.notice ? `<div class="notice">${escapeHtml(this.notice)}</div>` : ''}
            <h2>进行中的任务</h2>${taskList}
            <h2>生成攻略任务</h2><article><p class="muted">打开页面只读取当前 MVU，不扫描世界书。输入角色正式姓名并先检索；检索到的静态档案、动态档案、当前目标和关系会在确认前展示。未绑定世界书时会在你点击检索后扫描可访问的世界书。</p>
            <label for="yzp-task-role-name">目标角色</label><div class="form"><input id="yzp-task-role-name" value="${escapeHtml(this.targetName)}" placeholder="输入角色正式姓名" autocomplete="off" aria-label="任务目标角色姓名">
            <button type="button" class="secondary" data-action="search" ${this.searching || this.loading || this.sending ? 'disabled' : ''}>${this.searching ? '检索中…' : this.resolved ? '重新检索' : '检索角色资料'}</button>
            ${this.searching ? '<button type="button" class="secondary" data-action="cancel-search">取消检索</button>' : ''}</div>${preview}<div class="scan-status" data-scan-status aria-live="polite">${escapeHtml(status)}</div>
            <button type="button" class="primary" data-action="generate" ${this.sending || this.loading || this.searching || activeTask || !this.resolved ? 'disabled' : ''}>${this.sending ? '已提交，等待回复…' : activeTask ? '已有进行中任务' : '确认并生成任务'}</button>
            ${activeTask ? '<small>当前有进行中的攻略任务；按规则一次只保留一个，完成或取消后才能创建下一项。</small>' : '<small>生成会向当前聊天提交请求；AI 回复按 v6.28 简报协议写入 MVU，插件不会直接改变量或发放奖励。</small>'}</article>
            <div class="footer">资料来源：当前聊天相关片段、最新 MVU、目标角色静态档案与动态档案。查找按完整姓名匹配；同名来源不明确时会停止生成。</div></main></div>`, 'system-tasks-main');
        const root = document.querySelector('.phone-view-current .yzp-system-tasks') || document.querySelector('.yzp-system-tasks');
        root?.querySelector('[data-action="back"]')?.addEventListener('click', () => window.dispatchEvent(new CustomEvent('phone:goHome')));
        root?.querySelector('[data-action="refresh"]')?.addEventListener('click', () => { this.notice = ''; this.refresh(); });
        const input = root?.querySelector('#yzp-task-role-name');
        input?.addEventListener('input', event => {
            const nextName = event.target.value;
            if (nextName !== this.targetName) {
                this.targetName = nextName;
                this.resolved = null;
                if (this.searching) {
                    this.searchSequence++;
                    this.searching = false;
                    this.scanStatus = '姓名已更改，请重新开始检索。';
                    root.querySelector('[data-action="cancel-search"]')?.remove();
                    const searchButton = root.querySelector('[data-action="search"]');
                    if (searchButton) { searchButton.disabled = false; searchButton.textContent = '检索角色资料'; }
                    const status = root.querySelector('[data-scan-status]');
                    if (status) status.textContent = this.scanStatus;
                }
                root.querySelector('.source-preview')?.remove();
                const generate = root.querySelector('[data-action="generate"]');
                if (generate) generate.disabled = true;
            }
        });
        root?.querySelector('[data-action="search"]')?.addEventListener('click', () => this.searchTarget());
        root?.querySelector('[data-action="cancel-search"]')?.addEventListener('click', () => this.cancelSearch());
        root?.querySelector('[data-action="generate"]')?.addEventListener('click', () => {
            this.generate(root).catch(error => {
                this.sending = false;
                this.notice = `任务请求失败：${error?.message || '请重试'}`;
                this.draw();
            });
        });
    }

    setScanStatus(message) {
        this.scanStatus = message;
        const root = document.querySelector('.phone-view-current .yzp-system-tasks') || document.querySelector('.yzp-system-tasks');
        const status = root?.querySelector('[data-scan-status]');
        if (status) status.textContent = message;
    }

    cancelSearch() {
        this.searchSequence++;
        this.searching = false;
        this.resolved = null;
        this.scanStatus = '已取消检索。';
        this.draw();
    }

    async searchTarget() {
        const root = document.querySelector('.phone-view-current .yzp-system-tasks') || document.querySelector('.yzp-system-tasks');
        this.targetName = clean(root?.querySelector('#yzp-task-role-name')?.value || this.targetName);
        if (!this.targetName) { this.notice = '请先输入目标角色的正式姓名。'; this.draw(); return; }
        this.searching = true;
        this.resolved = null;
        this.notice = '';
        this.scanStatus = '准备检索…';
        const token = ++this.searchSequence;
        const scope = this.scope();
        this.draw();
        try {
            const resolved = await this.resolveRole(this.targetName, token);
            if (token !== this.searchSequence || scope !== this.scope() || !this.isActive()) return;
            if (resolved.error) { this.notice = resolved.error; this.scanStatus = ''; }
            else { this.resolved = resolved; this.scanStatus = '资料匹配完成。请核对目标与来源，再确认生成。'; }
        } catch (error) {
            if (token === this.searchSequence) { this.notice = `检索失败：${error?.message || '请重试'}`; this.scanStatus = ''; }
        } finally {
            if (token === this.searchSequence) { this.searching = false; this.draw(); }
        }
    }

    async resolveRole(name, token) {
        const normalized = clean(name).normalize('NFKC');
        if (!normalized) return { error: '请先输入角色姓名。' };
        const ctx = this.context();
        const mvuApi = ctx.Mvu || window.Mvu || window.parent?.Mvu;
        this.mvu = latestMvuSnapshot(typeof mvuApi?.getMvuData === 'function' ? args => mvuApi.getMvuData(args) : null, ctx.chat || []);
        this.tasks = taskRows(this.mvu?.data);
        const mvuMatch = findMvuRole(this.mvu?.data, normalized);
        const context = relevantChatContext(ctx.chat || [], normalized);
        this.setScanStatus('正在读取可访问的世界书目录…');
        let catalog = [];
        let catalogError = '';
        let catalogTimer;
        try {
            catalog = await Promise.race([
                this.manager.fetchAllAvailableWorldBooks(),
                new Promise((_, reject) => { catalogTimer = setTimeout(() => reject(new Error('世界书目录读取超时')), 15000); })
            ]);
        } catch (error) { catalogError = error?.message || '读取世界书目录失败'; }
        finally { clearTimeout(catalogTimer); }
        if (token !== this.searchSequence) return { error: '检索已取消。' };
        const allBooks = Array.isArray(catalog) ? catalog : [];
        const card = ctx.characters?.[ctx.characterId];
        this.preferredBooks = [
            ...(Array.isArray(ctx.chatMetadata?.world_info) ? ctx.chatMetadata.world_info : [ctx.chatMetadata?.world_info]),
            card?.data?.extensions?.world
        ].filter(Boolean).map(clean);
        const orderedBooks = [...allBooks].sort((a, b) => Number(this.preferredBooks.includes(b.name)) - Number(this.preferredBooks.includes(a.name)));
        const centralMappings = new Map();
        const localMappings = new Map();
        const staticCandidates = [];
        const dynamicCandidates = [];
        const scanErrors = catalogError ? [catalogError] : [];
        const dynamicFallback = `动态-${normalized}`;
        const batchSize = 2;
        const readWithTimeout = bookName => {
            let timer;
            const timeout = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('世界书读取超时')), 12000); });
            return Promise.race([this.manager.readDossierWorldbook(bookName), timeout]).finally(() => clearTimeout(timer));
        };
        for (let offset = 0; offset < orderedBooks.length; offset += batchSize) {
            if (token !== this.searchSequence) return { error: '检索已取消。' };
            const batch = orderedBooks.slice(offset, offset + batchSize);
            this.setScanStatus(`正在检索角色资料 ${Math.min(offset + batch.length, orderedBooks.length)}/${orderedBooks.length} 本…`);
            const results = await Promise.allSettled(batch.map(book => readWithTimeout(book.name)));
            if (token !== this.searchSequence) return { error: '检索已取消。' };
            for (let i = 0; i < results.length; i++) {
                const result = results[i];
                if (result.status === 'rejected' || !result.value) { scanErrors.push(batch[i].name); continue; }
                const book = result.value;
                const matches = flattenEntries([book]);
                const central = parseCentralDirectory([book]).filter(row => clean(row.name).normalize('NFKC') === normalized);
                const local = parseLocalDirectories([book]).filter(row => clean(row.name).normalize('NFKC') === normalized);
                for (const row of central) centralMappings.set(`${row.name}|${row.book}|${row.dynamicComment}`, row);
                for (const row of local) localMappings.set(`${row.name}|${row.book}|${row.dynamicComment}`, row);
                staticCandidates.push(...sourceFor(matches, normalized, 'static', dynamicFallback));
                dynamicCandidates.push(...sourceFor(matches, normalized, 'dynamic', dynamicFallback));
            }
            await new Promise(resolve => setTimeout(resolve, 0));
        }
        if (!orderedBooks.length) this.setScanStatus('没有发现可访问的世界书；继续依据当前 MVU 与聊天上下文核对。');
        const allMaps = centralMappings.size ? [...centralMappings.values()] : [...localMappings.values()];
        const preferredMaps = allMaps.filter(row => this.preferredBooks.includes(row.book));
        const maps = preferredMaps.length ? preferredMaps : allMaps;
        if (maps.length > 1) return { error: `目录中发现多个“${normalized}”角色映射，无法确定对应资料；请先整理重复目录。` };
        const mapping = maps[0] || null;
        const scoped = sources => {
            if (!mapping?.book) return sources;
            const preferred = sources.filter(source => (source.bookName || source.book) === mapping.book);
            return preferred.length ? preferred : sources;
        };
        let staticSources = scoped(staticCandidates);
        let dynamicSources = scoped(dynamicCandidates);
        const preferContextBook = sources => {
            const preferred = (sources || []).filter(source => this.preferredBooks?.includes(source.bookName || source.book));
            return preferred.length ? preferred : sources;
        };
        staticSources = preferContextBook(staticSources);
        dynamicSources = preferContextBook(dynamicSources);
        if (staticSources.length > 1 || dynamicSources.length > 1) {
            return { error: `“${normalized}”在当前角色档案中匹配到多条来源，无法安全判断对应角色，请先消除同名重复档案。` };
        }
        const staticEntry = staticSources[0] || null;
        const dynamicEntry = dynamicSources[0] || null;
        if (!staticEntry && !dynamicEntry && !mvuMatch.role && !context.length) return { error: `当前聊天上下文、MVU 和可访问档案中都没有找到“${normalized}”的资料。${scanErrors.length ? `有 ${scanErrors.length} 本世界书读取失败。` : ''}` };
        const dynamicFields = dynamicEntry ? parseFields(dynamicEntry.content) : [];
        const mvuRole = mvuMatch.role || {};
        const findField = fields => fields.find(field => field.label === '当前目标' || field.label === '目标')?.value || '';
        const currentGoal = clean(mvuRole['当前目标'] || mvuRole.currentGoal || findField(dynamicFields));
        if (!currentGoal) return { error: `找到“${normalized}”的资料，但没有读到该角色明确的“当前目标”。按任务规则，不能替角色编造目标，因此暂不生成。` };
        const relationship = clean(mvuRole['与主角的关系'] || mvuRole.relationship || dynamicFields.find(field => /与主角的关系|关系阶段/.test(field.label))?.value || '');
        const book = staticEntry?.bookName || dynamicEntry?.bookName || mapping?.book || '当前聊天上下文';
        const role = { id: JSON.stringify([book, normalized]), name: normalized, book };
        return { role, staticEntry, dynamicEntry, mvuRole, mvuRoleId: mvuMatch.id || normalized, context, currentGoal, relationship, scanErrors, scope: this.scope() };
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
            current_mvu: { role_id: mvuRoleId || formalName, role: mvuRole || null },
            current_goal: resolved.currentGoal,
            relationship_stage: resolved.relationship || '未记录'
        };
        return `玩家已在任务系统中明确请求为“${formalName}”生成任务。请遵循当前聊天的统一系统世界书 v6.28「任务系统｜目标角色关联任务」规则。\n\n目标选择与事实：仅生成一项攻略任务；角色必须有明确的当前目标，主体始终是主角；任务行动必须实际推进目标角色当前目标。输入姓名只是指定候选对象，不能据此虚构该角色本轮受影响。请依据本轮聊天与 MVU 判断目标是否为当前交互角色，或是否在本轮剧情中被直接影响；若不符合或无法唯一判断，只提出澄清问题，不提交创建操作。不得编造资料、当前目标或关系阶段，不得代替角色决定回应，也不保证结果。目标角色的阶段、边界与关系以角色专属档案为准，实时数值与已有任务以最新 MVU 为准。\n\n完成条件必须具体、可观察、可判定，不能只写“提升好感”“建立关系”或“让她接受”。奖励必须同时包含角色好感度与系统点，按任务难度和关系阶段选择：日常推进好感+3–5、系统点10–20；常规推进+6–9、21–40；较难推进+10–15、41–70；关键突破+16–20、71–100。可选现金不超过5000元，或最多一种现有的一次性库存道具、数量1；不要为了凑奖励把可选项全塞入。奖励生成后固定。\n\n必须先检查所有角色是否已有进行中的攻略任务；如有，不覆盖、不追加。可生成时，用本轮唯一一条中文简报提交操作：{"动作":"创建攻略任务","角色":"${formalName}","任务目标":"主角要做的具体行动","奖励":{"好感度":整数,"系统点":整数,"现金":整数或0,"道具":null或{"名称":"现有道具名","数量":1}},"完成条件":"可观察的完成事实"}。只登记任务，不在本轮发奖；完成时才按 MVU 中已保存的原奖励结算，取消不发奖。不得直接改余额、系统点或插件本地存任务。AI 回复正文用简洁纯文字任务卡，不输出 HTML。\n\n插件已从当前聊天上下文、最新 MVU 和按角色姓名检索到的静态/动态资料中整理事实。CWB 目录或世界书绑定不是前置条件；缺少的信息不得猜测。\n<任务角色资料JSON>\n${JSON.stringify(source, null, 2)}\n</任务角色资料JSON>`;
    }

    async generate(root) {
        if (this.sending) return;
        const input = root.querySelector('#yzp-task-role-name');
        const resolved = this.resolved;
        if (!resolved || clean(input?.value || '').normalize('NFKC') !== resolved.role.name) { this.notice = '请先检索并核对目标角色资料。'; this.draw(); return; }
        if (resolved.scope !== this.scope()) { this.resolved = null; this.notice = '聊天已切换，请重新检索角色资料。'; this.draw(); return; }
        if ((this.tasks || []).length) { this.notice = '已有进行中的任务，请先完成或取消。'; this.draw(); return; }
        const roleName = resolved.role.name;
        const mvuRoleId = resolved.mvuRoleId || roleName;
        const mvuRole = resolved.mvuRole || null;
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
                this.notice = `已按“${roleName}”的当前目标、最新 MVU、聊天上下文及可匹配档案提交任务请求。MVU 更新后会刷新任务列表。`;
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



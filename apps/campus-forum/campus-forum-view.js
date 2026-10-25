export class CampusForumView {
    constructor(app) {
        this.app = app;
        this.currentView = 'feed';
        this.activeSection = '恋爱八卦';
        this._renderToken = 0;
        this._generating = false;
        this._notice = '';
        this._failedResponse = '';
    }

    _escape(value = '') {
        return String(value ?? '').replace(/[&<>"']/g, char => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        })[char]);
    }

    _setContent(html, viewId = 'campus-forum') {
        this.app.phoneShell.setContent(html, viewId);
    }

    render() {
        this.currentView = 'feed';
        const feed = this.app.data.getFeed();
        const boardState = this.app.data.getBoardState();
        const sections = Array.isArray(feed?.sections) ? feed.sections : boardState.sections;
        if (!sections.includes(this.activeSection)) this.activeSection = sections[0] || '恋爱八卦';
        const posts = feed?.postsBySection?.[this.activeSection] || [];
        const hotspots = Array.isArray(feed?.hotspots) ? feed.hotspots : [];
        const tabs = sections.map(section => `
            <button class="campus-forum-tab${section === this.activeSection ? ' is-active' : ''}" type="button" data-forum-section="${this._escape(section)}" aria-pressed="${section === this.activeSection}">${this._escape(section)}</button>
        `).join('');
        const postCards = posts.map(post => `
            <article class="campus-forum-post">
                <div class="campus-forum-post-meta"><span>${this._escape(post.author || '匿名同学')}</span><time>${this._escape(post.date || feed?.storyDate || '')}</time></div>
                <h2>${this._escape(post.title)}</h2>
                <div class="campus-forum-post-body">${this._escape(post.content)}</div>
                ${Array.isArray(post.comments) && post.comments.length ? `
                    <div class="campus-forum-comments">
                        ${post.comments.map(comment => `<div class="campus-forum-comment"><b>${this._escape(comment.author)}</b><span>${this._escape(comment.content)}</span></div>`).join('')}
                    </div>` : '<div class="campus-forum-no-comments">暂无评论</div>'}
            </article>
        `).join('');
        const hotspotHtml = hotspots.length ? `
            <section class="campus-forum-hotspot-panel">
                <div class="campus-forum-section-heading"><span>近 ${this.app.data.lookbackDays} 天热点</span><span>${hotspots.length} 条</span></div>
                ${hotspots.map(item => `<div class="campus-forum-hotspot"><time>${this._escape(item.date)}</time><div><b>${this._escape(item.event)}</b><small>${this._escape(item.basis)} · 热度${this._escape(item.heat)}</small></div></div>`).join('')}
            </section>` : '';
        const empty = feed
            ? `<div class="campus-forum-empty">这个栏目还没有帖子。刷新论坛后会生成 3–5 条。</div>`
            : `<div class="campus-forum-empty"><div class="campus-forum-empty-icon">🏫</div><b>还没有论坛内容</b><span>点击“刷新论坛”，帖子会直接生成并显示在这里。</span></div>`;
        const status = feed
            ? `<div class="campus-forum-source-note">剧情日期 ${this._escape(feed.storyDate || '未记录')} · 参考 ${this._escape((feed.sourceBooks || []).join('、') || '未选择世界书')}</div>`
            : '';
        const noticeHtml = this._notice
            ? (this._failedResponse
                ? `<div class="campus-forum-error-note"><span>${this._escape(this._notice)}</span><button class="campus-forum-download-response" type="button"><i class="fa-solid fa-download"></i> 下载 AI 原始回复</button></div>`
                : `<div class="campus-forum-source-note">${this._escape(this._notice)}</div>`)
            : '';

        this._setContent(`
            <div class="campus-forum-app">
                <header class="campus-forum-header">
                    <button class="campus-forum-back" type="button" aria-label="返回主页"><i class="fa-solid fa-chevron-left"></i></button>
                    <div class="campus-forum-header-title"><small>WEIFANG UNIVERSITY</small><b>校园论坛</b></div>
                    <button class="campus-forum-settings" type="button" aria-label="论坛设置"><i class="fa-solid fa-gear"></i></button>
                </header>
                <div class="campus-forum-toolbar"><div><b>校园热帖</b><span>${status}</span></div><button class="campus-forum-refresh" type="button" ${this._generating ? 'disabled' : ''}>${this._generating ? '<i class="fa-solid fa-spinner fa-spin"></i> 生成中' : '<i class="fa-solid fa-arrows-rotate"></i> 刷新论坛'}</button></div>
                ${noticeHtml}
                ${hotspotHtml}
                <nav class="campus-forum-tabs" aria-label="论坛栏目">${tabs}</nav>
                <main class="campus-forum-feed">${posts.length ? postCards : empty}</main>
            </div>
        `);

        const root = document.querySelector('.phone-view-current .campus-forum-app');
        root?.querySelector('.campus-forum-back')?.addEventListener('click', () => window.dispatchEvent(new CustomEvent('phone:goHome')));
        root?.querySelector('.campus-forum-settings')?.addEventListener('click', () => this.renderSettings());
        root?.querySelector('.campus-forum-refresh')?.addEventListener('click', () => this.generate());
        root?.querySelector('.campus-forum-download-response')?.addEventListener('click', () => this.downloadFailedResponse());
        root?.querySelectorAll('[data-forum-section]').forEach(button => button.addEventListener('click', () => {
            this.activeSection = String(button.dataset.forumSection || '恋爱八卦');
            this.render();
        }));
    }

    async generate() {
        if (this._generating) return;
        this._generating = true;
        this._notice = '';
        this._failedResponse = '';
        this.render();
        try {
            const result = await this.app.data.generateFeed();
            const postCount = Object.values(result.feed?.postsBySection || {}).reduce((sum, posts) => sum + posts.length, 0);
            this._notice = `已生成 ${postCount} 条帖子${result.feed?.hotspots?.length ? `和 ${result.feed.hotspots.length} 条热点` : ''}，参考：${result.selectedBooks.join('、')}。`;
            this.app.phoneShell?.showNotification?.('校园论坛', `论坛已更新，共 ${postCount} 条帖子`, '🏫');
        } catch (error) {
            this._notice = error?.message || '论坛请求准备失败';
            this._failedResponse = this.app.data.getLastAIResponse?.() || '';
            this.app.phoneShell?.showNotification?.('论坛请求失败', this._notice, '⚠️');
        } finally {
            this._generating = false;
            this.render();
        }
    }

    downloadFailedResponse() {
        if (!this._failedResponse) return false;
        const urlApi = window.URL || globalThis.URL;
        if (typeof Blob !== 'function' || !urlApi?.createObjectURL) {
            this.app.phoneShell?.showNotification?.('无法下载', '当前浏览器不支持文本文件下载。', '⚠️');
            return false;
        }
        const blobUrl = urlApi.createObjectURL(new Blob([this._failedResponse], { type: 'text/plain;charset=utf-8' }));
        const link = document.createElement('a');
        const stamp = new Date().toISOString().replace(/[:.]/g, '-');
        link.href = blobUrl;
        link.download = `校园论坛-AI原始回复-${stamp}.txt`;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => urlApi.revokeObjectURL?.(blobUrl), 1000);
        return true;
    }

    async renderSettings() {
        this.currentView = 'settings';
        const renderToken = ++this._renderToken;
        this._setContent(`
            <div class="campus-forum-app">
                <header class="campus-forum-header">
                    <button class="campus-forum-back" type="button" aria-label="返回论坛"><i class="fa-solid fa-chevron-left"></i></button>
                    <div class="campus-forum-header-title"><small>SETTINGS</small><b>论坛设置</b></div><span class="campus-forum-header-spacer"></span>
                </header>
                <main class="campus-forum-settings-page"><div class="campus-forum-settings-loading"><i class="fa-solid fa-spinner fa-spin"></i> 正在读取世界书…</div></main>
            </div>
        `);
        this._bindSettingsBack();
        try {
            const books = await this.app.data.loadWorldbooks(true);
            if (renderToken !== this._renderToken || this.currentView !== 'settings') return;
            const selected = new Set(this.app.data.getSelectedWorldbookIds().map(String));
            const rows = books.map(book => {
                const id = String(book.id || book.name || '');
                const entries = Array.isArray(book.allEntries) ? book.allEntries : [];
                const timelineCount = entries.filter(entry => /时间线|timeline/i.test(`${entry.comment || ''} ${entry.content || ''}`)).length;
                const checked = selected.has(id) || selected.has(String(book.name));
                return `<label class="campus-forum-book-row"><input type="checkbox" data-forum-book="${this._escape(id)}" ${checked ? 'checked' : ''}><span><b>${this._escape(book.name)}</b><small>${timelineCount ? `检测到 ${timelineCount} 个时间线条目` : '未检测到明显的时间线条目'} · ${this._escape(book.sourceLabel || '世界书')}</small></span></label>`;
            }).join('');
            const root = document.querySelector('.phone-view-current .campus-forum-app');
            if (!root) return;
            root.querySelector('.campus-forum-settings-page').innerHTML = `
                <section class="campus-forum-settings-card">
                    <h2>参考世界书</h2><p>选择包含故事时间线树的世界书。论坛只读取其中带日期的时间线条目，筛选当前剧情日前 3–5 天内的事件。</p>
                    <div class="campus-forum-book-list">${rows || '<div class="campus-forum-settings-empty">没有读取到世界书，请确认酒馆世界书已加载。</div>'}</div>
                    <label class="campus-forum-range-label" for="campus-forum-range">热点时间范围</label>
                    <select id="campus-forum-range"><option value="3" ${this.app.data.lookbackDays === 3 ? 'selected' : ''}>近 3 天</option><option value="4" ${this.app.data.lookbackDays === 4 ? 'selected' : ''}>近 4 天</option><option value="5" ${this.app.data.lookbackDays === 5 ? 'selected' : ''}>近 5 天</option></select>
                    <div class="campus-forum-privacy-note"><i class="fa-solid fa-shield-halved"></i><span>私密、未公开、高保密事件及读心内容不会用于公开论坛。传闻需有明确传播依据并标记为未证实。</span></div>
                    <button class="campus-forum-save-settings" type="button" ${books.length ? '' : 'disabled'}>保存设置</button>
                </section>`;
            root.querySelector('.campus-forum-save-settings')?.addEventListener('click', async () => {
                const selectedIds = Array.from(root.querySelectorAll('[data-forum-book]:checked')).map(input => input.dataset.forumBook).filter(Boolean);
                await this.app.data.saveSelectedWorldbookIds(selectedIds);
                await this.app.data.saveLookbackDays(root.querySelector('#campus-forum-range')?.value);
                this.app.phoneShell?.showNotification?.('校园论坛', selectedIds.length ? `已保存 ${selectedIds.length} 本参考世界书` : '已清除参考世界书', selectedIds.length ? '✅' : 'ℹ️');
            });
        } catch (error) {
            const root = document.querySelector('.phone-view-current .campus-forum-app');
            const page = root?.querySelector('.campus-forum-settings-page');
            if (page) page.innerHTML = `<div class="campus-forum-settings-error">${this._escape(error?.message || '世界书读取失败')}</div>`;
        }
    }

    _bindSettingsBack() {
        document.querySelector('.phone-view-current .campus-forum-back')?.addEventListener('click', () => this.render());
    }

    deactivate() {
        this._renderToken += 1;
    }
}

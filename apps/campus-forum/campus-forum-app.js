import { CampusForumData } from './campus-forum-data.js?v=1.6.44';
import { CampusForumView } from './campus-forum-view.js?v=1.6.44';

export class CampusForumApp {
    constructor(phoneShell, storage) {
        this.phoneShell = phoneShell;
        this.storage = storage;
        this.data = new CampusForumData(storage);
        this.view = new CampusForumView(this);
        this.active = false;
        this._swipeHandler = event => this.handleSwipeBack(event);
        window.addEventListener('phone:swipeBack', this._swipeHandler);
        this._openHandler = event => {
            this.active = event.detail?.appId === 'campus-forum';
            if (this.active) this.refreshFromMvu();
        };
        this._homeHandler = () => { this.active = false; this.view.deactivate(); };
        this._visibilityHandler = () => { if (this.isActive()) this.refreshFromMvu(); };
        window.addEventListener('phone:openApp', this._openHandler);
        window.addEventListener('phone:goHome', this._homeHandler);
        document.addEventListener('visibilitychange', this._visibilityHandler);
        const context = this.context();
        for (const name of ['MESSAGE_RECEIVED', 'MESSAGE_UPDATED', 'MESSAGE_DELETED', 'MESSAGE_SWIPED', 'GENERATION_ENDED']) {
            const type = context.event_types?.[name];
            if (type) context.eventSource?.on(type, () => {
                if (!this.isActive()) return;
                clearTimeout(this._refreshTimer);
                this._refreshTimer = setTimeout(() => this.refreshFromMvu(), name === 'GENERATION_ENDED' ? 250 : 500);
            });
        }
        this._preloadCSS();
    }

    context() { return window.SillyTavern?.getContext?.() || {}; }

    isActive() {
        const panel = document.getElementById('phone-panel');
        return this.active && !document.hidden && (!panel || panel.classList.contains('phone-panel-open'));
    }

    async refreshFromMvu() {
        if (!this.isActive()) return;
        this.data.getFeed();
        this.view.render();
    }

    _preloadCSS() {
        if (document.getElementById('campus-forum-css')) return;
        const link = document.createElement('link');
        link.id = 'campus-forum-css';
        link.rel = 'stylesheet';
        link.href = new URL('./campus-forum.css?v=1.6.44', import.meta.url).href;
        document.head.appendChild(link);
    }

    async render() {
        this.active = true;
        try { await this.data.loadWorldbooks(false); } catch (_) { /* The current MVU feed remains readable without worldbook settings. */ }
        this.data.getFeed();
        this.view.render();
    }

    async renderSettings() {
        return this.view.renderSettings();
    }

    handleSwipeBack(event) {
        const root = document.querySelector('.phone-view-current .campus-forum-app');
        if (!root) return false;
        if (event?.detail && typeof event.detail === 'object') event.detail.handled = true;
        if (this.view.currentView === 'settings') this.view.render();
        else if (this.view.currentView === 'post') {
            this.view._selectedPost = null;
            this.view.currentView = 'feed';
            this.view.render();
        }
        else window.dispatchEvent(new CustomEvent('phone:goHome'));
        return true;
    }

    deactivate() {
        this.active = false;
        this.view?.deactivate?.();
    }

    destroy() {
        this.deactivate();
        window.removeEventListener('phone:swipeBack', this._swipeHandler);
        window.removeEventListener('phone:openApp', this._openHandler);
        window.removeEventListener('phone:goHome', this._homeHandler);
        document.removeEventListener('visibilitychange', this._visibilityHandler);
        clearTimeout(this._refreshTimer);
    }
}

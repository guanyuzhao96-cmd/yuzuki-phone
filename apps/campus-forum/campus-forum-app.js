import { CampusForumData } from './campus-forum-data.js';
import { CampusForumView } from './campus-forum-view.js';

export class CampusForumApp {
    constructor(phoneShell, storage) {
        this.phoneShell = phoneShell;
        this.storage = storage;
        this.data = new CampusForumData(storage);
        this.view = new CampusForumView(this);
        this._swipeHandler = event => this.handleSwipeBack(event);
        window.addEventListener('phone:swipeBack', this._swipeHandler);
        this._preloadCSS();
    }

    _preloadCSS() {
        if (document.getElementById('campus-forum-css')) return;
        const link = document.createElement('link');
        link.id = 'campus-forum-css';
        link.rel = 'stylesheet';
        link.href = new URL('./campus-forum.css?v=1.0.0', import.meta.url).href;
        document.head.appendChild(link);
    }

    render() {
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
        else window.dispatchEvent(new CustomEvent('phone:goHome'));
        return true;
    }

    deactivate() {
        this.view?.deactivate?.();
    }

    destroy() {
        this.deactivate();
        window.removeEventListener('phone:swipeBack', this._swipeHandler);
    }
}

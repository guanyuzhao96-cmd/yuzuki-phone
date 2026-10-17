// Optional integration check: DOSSIER_PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs
// DOSSIER_CHROMIUM=/path/to/chromium node tests/dossier-browser.mjs [worldbook.json]
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.DOSSIER_PLAYWRIGHT_MODULE || 'playwright');
const root = new URL('../', import.meta.url);
const fixture = process.argv[2] ? await readFile(process.argv[2], 'utf8') : JSON.stringify({ entries: {
    0: { uid: 0, comment: 'CWB目录｜测试', content: '【小故事线目录】\n姓名: "肖雨欣"' },
    1: { uid: 1, comment: '肖雨欣', content: '姓名: "肖雨欣"\n年龄: "20岁"' },
    2: { uid: 2, comment: '动态-肖雨欣', content: '[--角色档案开始--]\n[姓名]:肖雨欣\n[剧情.0]:确认关系' }
} });
const server = createServer(async (req, res) => {
    try {
        const path = new URL(req.url, 'http://localhost').pathname;
        if (path === '/') {
            res.setHeader('Content-Type', 'text/html');
            res.end('<meta name="viewport" content="width=device-width, initial-scale=1"><style>body{margin:0}.phone-view-current{height:100dvh;width:100%}</style><div class="phone-view-current"></div>');
        } else if (path === '/csrf-token' || path === '/api/worldinfo/get') {
            res.setHeader('Content-Type', 'application/json');
            res.end(path === '/csrf-token' ? '{"token":"test"}' : fixture);
        } else if (path.startsWith('/apps/') || path.startsWith('/config/')) {
            res.setHeader('Content-Type', 'text/javascript');
            res.end(await readFile(new URL(path.slice(1), root)));
        } else { res.writeHead(404); res.end(); }
    } catch { res.writeHead(404); res.end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
let browser;
try {
    browser = await chromium.launch({ headless: true, executablePath: process.env.DOSSIER_CHROMIUM || undefined,
        args: ['--no-sandbox', '--disable-dev-shm-usage'] });
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.evaluate(async () => {
        // Obsolete manual selections must not override the current automatic index scope.
        const values = { chat_dossier_preferences: { books: ['过期的手动选择'] } };
        window.writes = [];
        window.ctx = { characterId: 1, chatId: 'branch-a', chat: [{ stat_data: { 角色: { 肖雨欣: { 好感度: 0 } } } }], event_types: {} };
        window.SillyTavern = { getContext: () => window.ctx };
        const { DossierApp } = await import('/apps/dossier/dossier-app.js');
        window.app = new DossierApp({ setContent: html => document.querySelector('.phone-view-current').innerHTML = html }, {
            get: (key, fallback) => values[key] ?? fallback,
            set: (key, value) => { values[key] = value; window.writes.push(key); }
        });
        app.manager.getDossierDefaultBooks = async () => ['故事线02'];
        await app.render();
    });
    const count = await page.locator('[data-role]').count();
    assert.ok(count >= 1);
    await page.locator('[data-action="settings"]').click();
    assert.equal(await page.locator('h2').innerText(), '目录索引');
    assert.equal(await page.locator('input[type=checkbox]').count(), 0);
    assert.match(await page.locator('main').innerText(), /故事线02/);
    await page.locator('[data-action="back"]').click();
    await page.locator('[data-role]').filter({ hasText: '肖雨欣' }).click();
    assert.equal(await page.locator('h2').innerText(), '肖雨欣');
    assert.equal(await page.getByText('剧情档案', { exact: true }).count(), 1);
    await page.getByText('配置 MVU 展示字段', { exact: true }).click();
    await page.locator('[data-mvu-label]').fill('好感度');
    await page.locator('[data-mvu-path]').selectOption('/角色/肖雨欣/好感度');
    await page.locator('[data-action="add-mapping"]').click();
    await page.getByText('MVU 当前状态', { exact: true }).click();
    assert.match(await page.locator('main').innerText(), /0\n来源路径/);
    assert.equal(await page.evaluate(() => document.querySelector('main').scrollWidth <= document.querySelector('main').clientWidth), true);
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('phone:swipeBack', { detail: {} })));
    assert.equal(await page.locator('[data-role]').count(), count);
    await page.evaluate(async () => {
        let finish;
        app.manager.readDossierWorldbook = () => new Promise(resolve => { finish = resolve; });
        const pending = app.refresh();
        await new Promise(resolve => setTimeout(resolve, 0));
        window.ctx.chatId = 'branch-b'; app.active = false; app.clearCache();
        finish({ name: 'OLD', entries: [] }); await pending;
    });
    assert.equal(await page.evaluate(() => app.characters.length), 0);
    assert.deepEqual(await page.evaluate(() => [...new Set(window.writes)]), ['chat_dossier_preferences']);
    assert.deepEqual(errors, []);
    console.log(`PASS 390px mobile: ${count} roles, detail, MVU zero, overflow, swipe, branch race, preferences-only writes`);
} finally {
    await browser?.close();
    await new Promise(resolve => server.close(resolve));
}

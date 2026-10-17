Warning: truncated output (original token count: 196881)
Total output lines: 14314

/* ========================================================
 *  柚月小手机 (Yuzuki's Little Phone)
 *  作者 (Author): yuzuki
 * 
 * ⚠️ 版权声明 (Copyright Notice):
 * 1. 禁止商业化：本项目仅供交流学习，严禁任何形式的倒卖、盈利等商业行为。
 * 2. 禁止二改发布：严禁未经授权修改代码后作为独立项目二次发布或分发。
 * 3. 禁止抄袭：严禁盗用本项目的核心逻辑、UI设计与相关原代码。
 * 
 * Copyright (c) yuzuki. All rights reserved.
 * ======================================================== */
// ========================================
// 虚拟手机互动系统
// SillyTavern 扩展插件
// ========================================

import { tokenizeWangxiangTaskTags } from './apps/wangxiang/wangxiang-task-parser.js';
import { PhoneCallData, parseSmsMessagesFromText } from './apps/phone/phone-data.js';
import { showIncomingSmsPopup } from './apps/phone/sms-popup.js';
import {
    getPhoneFloatingEntryReceiptFile,
    PHONE_FLOATING_ENTRY_DEFAULT_STYLE,
    PhoneFloatingEntry
} from './phone/floating-entry.js';
import {
    getOfflineWechatPaymentLedgerCopy,
    markCompleteOfflineWechatPaymentBoundaries,
    parseOfflineWechatPayments,
    renderOfflineWechatPaymentReceipt
} from './apps/wechat/offline-payment.js?v=1.6.1&r=20261011-payment-boundaries-and-flexible-years';
import { parseWechatVoiceContent } from './apps/wechat/voice-text.js';
import { StoryImageAutoScheduler } from './apps/album/story-image-auto-scheduler.js';
import {
    combineMofoBeautifyTemplate,
    escapeMofoHtml,
    scopeMofoCss,
    splitMofoBeautifyTemplate
} from './apps/mofo/mofo-renderer.js';

const ST_PHONE_BASE_URL = new URL('./', import.meta.url).href;
const ST_PHONE_VERSION = '1.6.4';
const ST_PHONE_CSS_REVISION = '20261009-payment-store-right-shift';
const ST_PHONE_APP_SWIPE_REVISION = '20261002-wechat-chat-return';
const ST_PHONE_ALBUM_MODULE_REVISION = '20261006-story-image-outside-close';
const ST_PHONE_WECHAT_MODULE_REVISION = '20261011-wallet-credit-repayment';
const ST_PHONE_WEIBO_MODULE_REVISION = '20261002-first-return-guard';
const ST_PHONE_X_MODULE_REVISION = '20261010-publish-guard';
const ST_PHONE_HONEY_ASSET_REVISION = '20261003-theme-media-recovery';
const ST_PHONE_GLOBAL_CSS_URL = new URL(`./phone.css?v=${ST_PHONE_VERSION}&r=${ST_PHONE_CSS_REVISION}`, import.meta.url).href;
const ST_PHONE_REGULAR_FONT_URL = new URL('./assets/vendor/fontawesome/fa-regular-400.woff2', import.meta.url).href;
const ST_PHONE_HONEY_MODULE_URL = new URL(`./apps/honey/honey-app.js?v=${ST_PHONE_VERSION}&r=${ST_PHONE_HONEY_ASSET_REVISION}`, import.meta.url).href;
const ST_PHONE_HONEY_CSS_URL = new URL(`./apps/honey/honey.css?v=${ST_PHONE_VERSION}&r=${ST_PHONE_HONEY_ASSET_REVISION}`, import.meta.url).href;
const ST_PHONE_HONEY_THEME_URL = new URL('./apps/honey/honeyzt.png', import.meta.url).href;
const ST_PHONE_GAMES_MODULE_URL = new URL(`./apps/games/games-app.js?v=${ST_PHONE_VERSION}&r=${ST_PHONE_APP_SWIPE_REVISION}`, import.meta.url).href;
const ST_PHONE_GAMES_CSS_URL = new URL('./apps/games/poker/poker.css?v=1.0.2', import.meta.url).href;
const ST_PHONE_UPDATE_MANIFEST_URLS = [
    'https://raw.githubusercontent.com/guanyuzhao96-cmd/yuzuki-phone/main/manifest.json',
    'https://raw.githubusercontent.com/guanyuzhao96-cmd/yuzuki-phone/master/manifest.json'
];
const ST_PHONE_UPDATE_LOG_URLS = [
    'https://raw.githubusercontent.com/guanyuzhao96-cmd/yuzuki-phone/main/update-log.json',
    'https://raw.githubusercontent.com/guanyuzhao96-cmd/yuzuki-phone/master/update-log.json'
];
const ST_PHONE_LOCAL_UPDATE_LOG_URL = new URL('./update-log.json', import.meta.url).href;
const WECHAT_ONLINE_PROACTIVE_ENABLED_KEY = 'wechat_online_proactive_enabled';
const WECHAT_ONLINE_PROACTIVE_INTERVAL_KEY = 'wechat_online_proactive_interval_minutes';
const WECHAT_ONLINE_PROACTIVE_LAST_AT_KEY = 'wechat_online_proactive_last_trigger_at';
const WECHAT_ONLINE_PROACTIVE_PENDING_KEY = 'wechat_online_proactive_pending_at';
const LOBBY_WECHAT_ONLINE_PROACTIVE_ENABLED_KEY = 'phone_lobby_wechat_online_proactive_enabled';
const LOBBY_WECHAT_ONLINE_PROACTIVE_INTERVAL_KEY = 'phone_lobby_wechat_online_proactive_interval_minutes';
const LOBBY_WECHAT_ONLINE_PROACTIVE_LAST_AT_KEY = 'phone_lobby_wechat_online_proactive_last_trigger_at';
const LOBBY_WECHAT_ONLINE_PROACTIVE_PENDING_KEY = 'phone_lobby_wechat_online_proactive_pending_at';
const WECHAT_MESSAGE_SOUND_ENABLED_KEY = 'wechat_message_sound_enabled';
const PHONE_TRIPLE_TAP_ENABLED_KEY = 'phone-triple-tap-enabled';
const STORY_IMAGE_AUTO_ENABLED_KEY = 'phone-story-image-auto-enabled';
const PHONE_PROMPT_MACRO_NAMES = Object.freeze([
    'PHONE_PROMPT',
    'PHONE_HISTORY',
    'PHONE_APP_HISTORY',
    'MOMENTS_HISTORY',
    'HONEY_HISTORY',
    'WEIBO_HISTORY',
    'MUSIC_PROMPT',
    'MOFO_PROMPT',
    'DIARY_HISTORY',
    'CALENDAR_REMINDER',
    'WANGXIANG_TASKS',
    'WANGXIANG_ORDERS'
]);
const PHONE_PROMPT_MARKER_PREFIX = '__ST_PHONE_PROMPT_VAR_';
const getPhonePromptMarker = (name) => `${PHONE_PROMPT_MARKER_PREFIX}${String(name || '').trim().toUpperCase()}__`;
const PHONE_REQUEST_MACRO_PATTERN = new RegExp(
    `(?:\\{\\{\\s*(?:${PHONE_PROMPT_MACRO_NAMES.join('|')})\\s*\\}\\}|${PHONE_PROMPT_MARKER_PREFIX}(?:${PHONE_PROMPT_MACRO_NAMES.join('|')})__)`,
    'i'
);

function stripPhonePromptPlaceholders(value) {
    let text = String(value || '');
    let changed = false;
    PHONE_PROMPT_MACRO_NAMES.forEach((name) => {
        const rawPattern = new RegExp(`\\{\\{\\s*${name}\\s*\\}\\}`, 'gi');
        const marker = getPhonePromptMarker(name);
        const next = text.replace(rawPattern, '').split(marker).join('');
        if (next !== text) {
            text = next;
            changed = true;
        }
    });
    return { text: text.trim(), changed };
}

function substitutePhoneInjectedMacros(value, context) {
    const rawContent = String(value ?? '');
    const substituteParams = context?.substituteParams;
    if (!rawContent || typeof substituteParams !== 'function') return rawContent;

    const protectedMacros = [];
    let contentForSubstitution = rawContent;
    PHONE_PROMPT_MACRO_NAMES.forEach((name) => {
        const rawPattern = new RegExp(`\\{\\{\\s*${name}\\s*\\}\\}`, 'gi');
        contentForSubstitution = contentForSubstitution.replace(rawPattern, (matchedMacro) => {
            const token = `__ST_PHONE_PROTECTED_PROMPT_MACRO_${protectedMacros.length}__`;
            protectedMacros.push({ token, matchedMacro });
            return token;
        });
    });

    try {
        const substituted = substituteParams.call(context, contentForSubstitution);
        if (substituted === undefined || substituted === null) return rawContent;

        let resolvedContent = String(substituted);
        protectedMacros.forEach(({ token, matchedMacro }) => {
            resolvedContent = resolvedContent.split(token).join(matchedMacro);
        });
        return resolvedContent;
    } catch (error) {
        console.warn('[手机插件] 酒馆宏变量替换失败，将保留注入原文:', error);
        return rawContent;
    }
}
const WECHAT_INITIAL_ENABLED_OFFLINE_KEYS = [
    'offline-wechat-prompt-enabled',
    'offline-single-chat-enabled',
    'offline-group-chat-enabled'
];
const WECHAT_MESSAGE_SOUND_URL = new URL('./assets/sounds/iphone-message-notification.mp3', ST_PHONE_BASE_URL).href;
const ST_PHONE_CURRENT_UPDATE = {
    version: ST_PHONE_VERSION,
    date: '2026-10-16',
    items: [
        '【优化】完善 Google Vertex AI 跟随酒馆的兼容性，修复关闭独立 API 后使用服务账号模式请求失败的问题。'
    ]
};

// 🔥 防重复加载检查（放在最前面，避免任何代码执行）
if (window.GGP_Loaded) {
    console.warn('⚠️ 虚拟手机已加载，跳过重复初始化');
} else {
    window.GGP_Loaded = true;
    console.log(`🚀 虚拟手机 v${ST_PHONE_VERSION} 启动`);

    const PHONE_FOREGROUND_GENERATION_TYPES = new Set(['normal', 'regenerate', 'swipe', 'continue']);
    const phoneForegroundGenerationState = {
        active: false,
        type: '',
        markedAt: 0,
        source: ''
    };
    const markPhoneForegroundGeneration = (type, source = 'unknown', isDryRun = false) => {
        const generationType = String(type || 'normal').trim().toLowerCase();
        if (isDryRun || !PHONE_FOREGROUND_GENERATION_TYPES.has(generationType)) return false;
        phoneForegroundGenerationState.active = true;
        phoneForegroundGenerationState.type = generationType;
        phoneForegroundGenerationState.markedAt = Date.now();
        phoneForegroundGenerationState.source = source;
        return true;
    };
    const clearPhoneForegroundGeneration = () => {
        phoneForegroundGenerationState.active = false;
        phoneForegroundGenerationState.type = '';
        phoneForegroundGenerationState.markedAt = 0;
        phoneForegroundGenerationState.source = '';
    };
    const isPhoneForegroundGenerationActive = () => phoneForegroundGenerationState.active
        && (Date.now() - phoneForegroundGenerationState.markedAt) < 180000;

    // 官方早期拦截链只记录本次是否属于正文生成；实际消息格式转换仍在 prompt-ready 完成。
    globalThis.yuzukiPhoneGenerateInterceptor = async function (_chat, _contextSize, _abort, type = 'normal') {
        markPhoneForegroundGeneration(type, 'generate_interceptor', false);
    };

    // 🔥 核心模块（启动时加载）- 只加载最必要的
    let APPS, PhoneStorage;
    let ApiManager = null;

    // 🔥 按需加载的模块
    let PhoneShell = null;         // 打开手机面板时加载
    let HomeScreen = null;         // 打开手机面板时加载
    let ImageUploadManager = null; // 打开手机面板时加载
    let TimeManager = null;        // 需要时加载
    let PromptManager = null;      // 发消息时加载
    let SettingsApp = null;        // 打开设置时加载
    let TtsManager = null;         // 语音管理器
    let ImageGenerationManager = null; // 生图管理器
    let WorldbookManager = null;   // 世界书选择/注入管理器

    // 🔥 三击唤醒手势状态
    let phoneTapCount = 0;
    let phoneLastTapTime = 0;
    let phonePointerSequenceStartedInside = false;

    // 🔥 延迟初始化的变量
    let phoneShell = null;
    let homeScreen = null;
    let currentApp = null;
    let totalNotifications = 0;
    let currentApps = null;
    let storage = null;
    let settings = null;
    let timeManager = null;
    let promptManager = null;
    let ttsManager = null;
    let imageGenerationManager = null;
    let worldbookManager = null;
    let phoneFloatingEntry = null;
    let storyImageAutoScheduler = null;
    let modulesLoaded = false;
    let _lastWechatConversationId = null; // 防串味：角色卡 + 酒馆聊天文件联合标识
    let _globalCssLoadingPromise = null;
    let _phoneStableViewportHeight = 0;
    let _phoneStableViewportWidth = 0;
    let _phoneViewportResizeTimer = null;
    let _phoneViewportSettleTimer = null;
    let _phoneViewportWatchdogTimer = null;
    let _phoneViewportWatchdogUntil = 0;
    let _phoneKeyboardLikelyOpenUntil = 0;
    let _phoneHostKeyboardOffset = 0;
    let _phoneVirtualKeyboardOffset = 0;
    let _phoneEstimatedKeyboardOffset = 0;
    let _phoneKeyboardFallbackArmedAt = 0;
    let _phoneReportedKeyboardOffset = 0;
    let _phoneVisualKeyboardViewportOpen = false;
    let _phoneKeyboardFallbackSuppressed = false;
    let _phoneTauriLayoutUnsubscribe = null;
    let _phoneTauriLayoutBindToken = 0;
    let _wechatMessageAudio = null;
    let _wechatMessageSoundLastAt = 0;
    let _honeyModulePromise = null;
    let _honeyCssPromise = null;
    let _honeyThemePromise = null;
    let _gamesModulePromise = null;
    let _gamesCssPromise = null;
    let _pendingWechatOnlineToOfflineHint = null;
    const PHONE_PANEL_DESKTOP_SIDE_KEY = 'phone-panel-desktop-side';
    const PHONE_PANEL_DESKTOP_POSITION_KEY = 'phone-panel-desktop-position';
    // 🔥 防重放护盾：仅允许被显式标记的旧楼层重新解析（用于 Swipe/Regenerate）
    const _forcedReplayFloors = new Map(); // key: `${chatId}:${floor}`, value: expireAt
    const _exactReplayFloors = new Map(); // key: `${chatId}:${floor}`, value: expireAt
    const _pendingPromptCleanupFloors = new Map(); // key: `${chatId}:${floor}`, value: expireAt
    let _mofoBubbleSyncRevision = 0;
    let _mofoMessageFormatterBound = false;
    let _paymentMessageFormatterBound = false;
    let _mofoInlinePreviewBound = false;
    let _mofoInlineTokenSequence = 0;
    const _mofoInlineRenderCache = new Map();

    function markWechatOnlineToOfflineTransferPending(payload = {}) {
        _pendingWechatOnlineToOfflineHint = {
            active: true,
            chatId: String(payload.chatId || '').trim(),
            chatName: String(payload.chatName || '').trim(),
            createdAt: Date.now()
        };
        try {
            sessionStorage.setItem('st_phone_pending_wechat_online_to_offline_hint', JSON.stringify(_pendingWechatOnlineToOfflineHint));
        } catch (e) {
            console.warn('⚠️ [微信] 写入线上转线下提示标记失败:', e);
        }
        return _pendingWechatOnlineToOfflineHint;
    }

    function getWechatOnlineToOfflineTransferPending() {
        let pending = _pendingWechatOnlineToOfflineHint;
        if (!pending?.active) {
            try {
                pending = JSON.parse(sessionStorage.getItem('st_phone_pending_wechat_online_to_offline_hint') || 'null');
            } catch (_) {
                pending = null;
            }
        }
        return pending?.active ? pending : null;
    }

    function clearWechatOnlineToOfflineTransferPending() {
        _pendingWechatOnlineToOfflineHint = null;
        try {
            sessionStorage.removeItem('st_phone_pending_wechat_online_to_offline_hint');
        } catch (_) {}
    }

    function ensureHoneyCSSPreloaded() {
        if (_honeyCssPromise) return _honeyCssPromise;
        _honeyCssPromise = new Promise(resolve => {
            const existing = document.getElementById('honey-css-link') || document.querySelector('link[href*="/apps/honey/honey.css"]');
            if (existing?.href === ST_PHONE_HONEY_CSS_URL) {
                if (existing.dataset.loaded === 'true' || existing.dataset.settled === 'true' || existing.sheet) resolve();
                else {
                    existing.addEventListener('load', resolve, { once: true });
                    existing.addEventListener('error', resolve, { once: true });
                }
                return;
            }

            const link = document.createElement('link');
            link.id = 'honey-css-link';
            link.rel = 'stylesheet';
            link.href = ST_PHONE_HONEY_CSS_URL;
            link.addEventListener('load', () => {
                link.dataset.loaded = 'true';
                link.dataset.settled = 'true';
                resolve();
            }, { once: true });
            link.addEventListener('error', () => {
                link.dataset.settled = 'true';
                resolve();
            }, { once: true });
            document.head.appendChild(link);
        });
        return _honeyCssPromise;
    }

    function loadHoneyModule() {
        if (!_honeyModulePromise) {
            _honeyModulePromise = import(ST_PHONE_HONEY_MODULE_URL).catch(error => {
                _honeyModulePromise = null;
                throw error;
            });
        }
        return _honeyModulePromise;
    }

    function ensureHoneyThemePreloaded() {
        const storedBackground = storage?.get?.('global_honey_bg_video');
        const customBackground = typeof storedBackground === 'string' ? storedBackground.trim() : '';
        if (customBackground) return Promise.resolve();
        if (_honeyThemePromise) return _honeyThemePromise;

        _honeyThemePromise = new Promise(resolve => {
            const existing = document.getElementById('honey-theme-preload');
            if (existing) {
                if (existing.dataset.settled === 'true') resolve();
                else {
                    existing.addEventListener('load', resolve, { once: true });
                    existing.addEventListener('error', resolve, { once: true });
                }
                return;
            }
            existing?.remove();

            const link = document.createElement('link');
            link.id = 'honey-theme-preload';
            link.rel = 'preload';
            link.as = 'image';
            link.href = ST_PHONE_HONEY_THEME_URL;
            link.fetchPriority = 'high';
            link.addEventListener('load', () => {
                link.dataset.settled = 'true';
                resolve();
            }, { once: true });
            link.addEventListener('error', () => {
                link.dataset.settled = 'true';
                resolve();
            }, { once: true });
            document.head.appendChild(link);
        });
        return _honeyThemePromise;
    }

    function preloadHoneyAppAssets() {
        try {
            if (!document.getElementById('honey-module-preload')) {
                const link = document.createElement('link');
                link.id = 'honey-module-preload';
                link.rel = 'modulepreload';
                link.href = ST_PHONE_HONEY_MODULE_URL;
                document.head.appendChild(link);
            }
            ensureHoneyCSSPreloaded();
            loadHoneyModule().catch(error => console.warn('⚠️ 蜜语模块预加载失败，点击时将重试:', error));
        } catch (error) {
            console.warn('⚠️ 蜜语资源预加载失败:', error);
        }
    }

    function scheduleHoneyAppPreload() {
        const run = () => preloadHoneyAppAssets();
        if (typeof requestIdleCallback === 'function') {
            requestIdleCallback(run, { timeout: 2000 });
        } else {
            setTimeout(run, 800);
        }
    }

    function showHoneyLoadingView() {
        phoneShell?.setContent?.(`
            <div class="honey-app honey-loading" style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:10px;background:#140f13;color:#fff;font-size:13px;">
                <i class="fa-solid fa-spinner fa-spin" style="font-size:22px;color:#ff5aa5;"></i>
                <div style="font-weight:700;letter-spacing:0;">蜜语加载中...</div>
            </div>
        `, 'honey-main');
    }

    function ensureGamesCSSPreloaded() {
        if (_gamesCssPromise) return _gamesCssPromise;
        _gamesCssPromise = new Promise(resolve => {
            const existing = document.getElementById('games-css');
            if (existing) {
                if (existing.dataset.loaded === 'true' || existing.sheet) resolve();
                else {
                    existing.addEventListener('load', resolve, { once: true });
                    existing.addEventListener('error', resolve, { once: true });
                }
                return;
            }

            const link = document.createElement('link');
            link.id = 'games-css';
            link.rel = 'stylesheet';
            link.href = ST_PHONE_GAMES_CSS_URL;
            link.addEventListener('load', () => {
                link.dataset.loaded = 'true';
                resolve();
            }, { once: true });
            link.addEventListener('error', resolve, { once: true });
            document.head.appendChild(link);
        });
        return _gamesCssPromise;
    }

    function loadGamesModule() {
        if (!_gamesModulePromise) {
            _gamesModulePromise = import(ST_PHONE_GAMES_MODULE_URL).catch(error => {
                _gamesModulePromise = null;
                throw error;
            });
        }
        return _gamesModulePromise;
    }

    function preloadGamesAppAssets() {
        try {
            if (!document.getElementById('games-module-preload')) {
                const link = document.createElement('link');
                link.id = 'games-module-preload';
                link.rel = 'modulepreload';
                link.href = ST_PHONE_GAMES_MODULE_URL;
                document.head.appendChild(link);
            }
            ensureGamesCSSPreloaded();
            loadGamesModule().catch(error => console.warn('⚠️ 游戏模块预加载失败，点击时将重试:', error));
        } catch (error) {
            console.warn('⚠️ 游戏资源预加载失败:', error);
        }
    }

    function scheduleGamesAppPreload() {
        const run = () => preloadGamesAppAssets();
        if (typeof requestIdleCallback === 'function') {
            requestIdleCallback(run, { timeout: 2000 });
        } else {
            setTimeout(run, 800);
        }
    }

    function _makeForcedReplayKey(floor, chatId = null) {
        const safeFloor = Number.parseInt(floor, 10);
        if (!Number.isFinite(safeFloor) || safeFloor < 0) return '';
        const ctx = getContext?.();
        const safeChatId = String(chatId || ctx?.chatId || 'default').trim() || 'default';
        return `${safeChatId}:${safeFloor}`;
    }

    function markForcedReplayFloor(floor, ttlMs = 120000, chatId = null) {
        const key = _makeForcedReplayKey(floor, chatId);
        if (!key) return;
        const expireAt = Date.now() + Math.max(5000, Number.parseInt(ttlMs, 10) || 120000);
        _forcedReplayFloors.set(key, expireAt);
    }

    function consumeForcedReplayFloor(floor, chatId = null) {
        const now = Date.now();
        for (const [k, expire] of _forcedReplayFloors.entries()) {
            if (!Number.isFinite(expire) || expire <= now) {
                _forcedReplayFloors.delete(k);
            }
        }
        const key = _makeForcedReplayKey(floor, chatId);
        if (!key) return false;
        const expireAt = _forcedReplayFloors.get(key);
        if (!Number.isFinite(expireAt) || expireAt <= now) {
            _forcedReplayFloors.delete(key);
            return false;
        }
        _forcedReplayFloors.delete(key);
        return true;
    }

    function markExactReplayFloor(floor, ttlMs = 120000, chatId = null) {
        const key = _makeForcedReplayKey(floor, chatId);
        if (!key) return;
        const expireAt = Date.now() + Math.max(5000, Number.parseInt(ttlMs, 10) || 120000);
        _exactReplayFloors.set(key, expireAt);
        markForcedReplayFloor(floor, ttlMs, chatId);
    }

    function consumeExactReplayFloor(floor, chatId = null) {
        const now = Date.now();
        for (const [k, expire] of _exactReplayFloors.entries()) {
            if (!Number.isFinite(expire) || expire <= now) {
                _exactReplayFloors.delete(k);
            }
        }
        const key = _makeForcedReplayKey(floor, chatId);
        if (!key) return false;
        const expireAt = _exactReplayFloors.get(key);
        if (!Number.isFinite(expireAt) || expireAt <= now) {
            _exactReplayFloors.delete(key);
            return false;
        }
        _exactReplayFloors.delete(key);
        return true;
    }

    function markPromptCleanupFloor(floor, ttlMs = 180000, chatId = null) {
        const key = _makeForcedReplayKey(floor, chatId);
        if (!key) return;
        const expireAt = Date.now() + Math.max(5000, Number.parseInt(ttlMs, 10) || 180000);
        _pendingPromptCleanupFloors.set(key, expireAt);
    }

    function consumePromptCleanupFloors(chatId = null) {
        const now = Date.now();
        const ctx = getContext?.();
        const safeChatId = String(chatId || ctx?.chatId || 'default').trim() || 'default';
        const prefix = `${safeChatId}:`;
        const floors = [];
        for (const [key, expire] of _pendingPromptCleanupFloors.entries()) {
            if (!Number.isFinite(expire) || expire <= now) {
                _pendingPromptCleanupFloors.delete(key);
                continue;
            }
            if (!key.startsWith(prefix)) continue;
            const floor = Number.parseInt(key.slice(prefix.length), 10);
            if (Number.isFinite(floor) && floor >= 0) floors.push(floor);
            _pendingPromptCleanupFloors.delete(key);
        }
        return Array.from(new Set(floors)).sort((a, b) => a - b);
    }

    function getLatestAssistantFloorFromContext(ctx = null) {
        const context = ctx || getContext?.();
        const chat = Array.isArray(context?.chat) ? context.chat : [];
        for (let i = chat.length - 1; i >= 0; i--) {
            const msg = chat[i];
            if (!msg || msg.is_user) continue;
            return i;
        }
        return chat.length > 0 ? chat.length - 1 : 0;
    }

    function getRegenerateTargetFloor(button = null) {
        const mesEl = button ? $(button).closest('.mes') : $();
        if (mesEl.length > 0) {
            const mesId = parseInt(mesEl.attr('mesid'), 10);
            if (!Number.isNaN(mesId)) return mesId;
        }
        return getLatestAssistantFloorFromContext();
    }

    function checkBetaLock() {
        return true;
    }

    function getRuntimeSettings() {
        if (storage && typeof storage.loadSettings === 'function') {
            const latest = storage.loadSettings();
            if (latest) settings = latest;
        }
        return settings;
    }

    function isPhoneFeatureEnabled() {
        const runtime = getRuntimeSettings();
        return !!(runtime && runtime.enabled);
    }

    function isPhoneTripleTapEnabled() {
        const raw = storage?.get?.(PHONE_TRIPLE_TAP_ENABLED_KEY);
        return raw !== false && raw !== 'false' && raw !== 0;
    }

    function isPhoneUserMessageListenerEnabled() {
        const raw = storage?.get?.('phone-user-message-listener-enabled');
        return raw !== false && raw !== 'false';
    }

    function isWechatOfflineUserReplyCleanEnabled() {
        const raw = storage?.get?.('phone-wechat-offline-clean-user-reply-enabled');
        return raw !== false && raw !== 'false';
    }

    function isPhoneInjectionVariableRequired() {
        const raw = storage?.get?.('phone-injection-require-variable-enabled');
        return raw !== false && raw !== 'false' && raw !== 0 && raw !== '0';
    }

    function hasExplicitUserReplyTag(text) {
        return /(?:<|&lt;)回复([^>&]+?)(?:>|&gt;)[\s\S]*?(?:<|&lt;)\/回复\1(?:>|&gt;)/i.test(String(text || ''));
    }

    function hasExplicitWechatTag(text) {
        const source = decodePhoneTagBoundaryEntities(maskPhoneParserReasoningBlocks(text), ['wechat']);
        return WECHAT_TAG_REGEX_SINGLE.test(source);
    }

    function getExplicitSmsTagSource(text) {
        return decodePhoneTagBoundaryEntities(maskPhoneParserReasoningBlocks(text), ['短信']);
    }

    function hasExplicitSmsTag(text) {
        return parseSmsMessagesFromText(getExplicitSmsTagSource(text)).length > 0;
    }

    function shouldUseFocusedInputKeyboardFallback() {
        const userAgent = String(navigator.userAgent || '');
        const maxTouchPoints = Number(navigator.maxTouchPoints || 0);
        const reportsMobileDevice = navigator.userAgentData?.mobile === true
            || /Android|iPhone|iPad|iPod|IEMobile|Opera Mini|Mobile/i.test(userAgent);
        const isIPadDesktopMode = navigator.platform === 'MacIntel' && maxTouchPoints > 1;
        if (reportsMobileDevice || isIPadDesktopMode) return true;

        const hasCoarsePrimaryPointer = window.matchMedia?.('(hover: none) and (pointer: coarse)')?.matches === true;
        const hasDesktopPointer = window.matchMedia?.('(any-hover: hover) and (any-pointer: fine)')?.matches === true;
        const viewportWidth = window.visualViewport?.width
            || window.innerWidth
            || document.documentElement?.clientWidth
            || 0;

        // Some mobile shells use a desktop-like UA. Limit that fallback to compact, touch-only layouts;
        // Windows touch PCs can report maxTouchPoints without having an on-screen keyboard.
        return hasCoarsePrimaryPointer && !hasDesktopPointer && viewportWidth > 0 && viewportWidth <= 900;
    }

    function isPhoneTypingTarget(target) {
        if (!(target instanceof Element)) return false;
        const field = target.closest?.('textarea, input, [contenteditable]');
        if (!field) return false;
        if (field.tagName?.toLowerCase() === 'textarea' || field.isContentEditable) return true;
        const inputType = String(field.type || 'text').toLowerCase();
        return ['text', 'search', 'password', 'email', 'number', 'url', 'tel'].includes(inputType);
    }

    function setPhoneViewportProperty(style, name, value) {
        if (style.getPropertyValue(name) === value) return;
        style.setProperty(name, value);
    }

    function updatePhonePanelViewportHeight(options = {}) {
        const panel = document.getElementById('phone-panel');
        const root = document.documentElement;
        if (!root || !panel) return;

        const viewport = window.visualViewport;
        const layoutHeight = Math.max(
            window.innerHeight || 0,
            document.documentElement?.clientHeight || 0
        );
        const visualHeight = viewport?.height || layoutHeight;
        const visualWidth = viewport?.width || window.innerWidth || document.documentElement?.clientWidth || 360;
        const visualTop = viewport?.offsetTop || 0;
        const visualLeft = viewport?.offsetLeft || 0;
        const layoutWidth = Math.max(
            window.innerWidth || 0,
            document.documentElement?.clientWidth || 0
        );
        const currentHeight = Math.max(layoutHeight, visualHeight, 320);
        const currentWidth = Math.max(layoutWidth, visualWidth, 320);
        const keyboardGap = layoutHeight && visualHeight ? layoutHeight - visualHeight : 0;
        const stableGap = _phoneStableViewportHeight ? _phoneStableViewportHeight - visualHeight : 0;
        const activeElement = document.activeElement;
        const isTypingTarget = isPhoneTypingTarget(activeElement);
        const now = Date.now();
        const hasVisualKeyboardViewportGap = keyboardGap > 120 || stableGap > 120;
        const hadVisualKeyboardViewportGap = _phoneVisualKeyboardViewportOpen;
        _phoneVisualKeyboardViewportOpen = hasVisualKeyboardViewportGap;
        const hostImeBottom = panel
            ? Math.max(0, Number.parseFloat(getComputedStyle(panel).getPropertyValue('--tt-ime-bottom')) || 0)
            : 0;
        const hostSafeBottom = Math.max(0, Number.parseFloat(getComputedStyle(root).getPropertyValue('--tt-inset-bottom')) || 0);
        const hostCssKeyboardOffset = Math.max(hostImeBottom - hostSafeBottom, 0);
        const liveVirtualKeyboardOffset = Math.max(
            0,
            Number(navigator.virtualKeyboard?.boundingRect?.height) || 0
        );
        _phoneVirtualKeyboardOffset = liveVirtualKeyboardOffset;
        const reportedKeyboardOffset = Math.max(
            _phoneHostKeyboardOffset,
            _phoneVirtualKeyboardOffset,
            hostCssKeyboardOffset
        );
        const hadReportedKeyboardInset = _phoneReportedKeyboardOffset > 120;
        const hasReportedKeyboardInset = reportedKeyboardOffset > 120;
        _phoneReportedKeyboardOffset = reportedKeyboardOffset;
        const visualKeyboardClosed = hadVisualKeyboardViewportGap && !hasVisualKeyboardViewportGap;
        const reportedKeyboardClosed = hadReportedKeyboardInset && !hasReportedKeyboardInset;
        if (visualKeyboardClosed || reportedKeyboardClosed) {
            // Mobile browsers and WebViews may keep the input focused after the IME is dismissed.
            // Do not let the focus-only fallback immediately recreate the closed keyboard inset.
            _phoneKeyboardFallbackSuppressed = true;
            _phoneEstimatedKeyboardOffset = 0;
            _phoneKeyboardFallbackArmedAt = 0;
            _phoneKeyboardLikelyOpenUntil = 0;
        }
        const isLikelyKeyboardWindow = now < _phoneKeyboardLikelyOpenUntil;
        const canEstimateKeyboardFromFocus = shouldUseFocusedInputKeyboardFallback();
        const useFocusedInputFallback = Boolean(
            isTypingTarget
            && canEstimateKeyboardFromFocus
            && !_phoneKeyboardFallbackSuppressed
            && now >= _phoneKeyboardFallbackArmedAt
            && _phoneKeyboardFallbackArmedAt > 0
            && !hasVisualKeyboardViewportGap
            && !hasReportedKeyboardInset
        );
        if (useFocusedInputFallback) {
            _phoneEstimatedKeyboardOffset = Math.min(
                Math.max(0, visualHeight - 320),
                Math.min(visualHeight * 0.48, Math.max(visualHeight * 0.34, visualWidth * 0.82))
            );
        } else if (hasVisualKeyboardViewportGap || hasReportedKeyboardInset || (!isTypingTarget && !isLikelyKeyboardWindow)) {
            _phoneEstimatedKeyboardOffset = 0;
        }
        const estimatedKeyboardOffset = (useFocusedInputFallback || isLikelyKeyboardWindow)
            ? _phoneEstimatedKeyboardOffset
            : 0;
        const effectiveKeyboardOffset = Math.max(reportedKeyboardOffset, estimatedKeyboardOffset);
        const hasKeyboardViewportGap = hasVisualKeyboardViewportGap || effectiveKeyboardOffset > 120;
        const keyboardOpen = Boolean((isTypingTarget || isLikelyKeyboardWindow) && hasKeyboardViewportGap);
        const orientationChanged = _phoneStableViewportWidth
            && Math.abs(currentWidth - _phoneStableViewportWidth) > 80;

        panel?.classList.toggle('phone-keyboard-open', keyboardOpen);

        // 收起键盘时，Android 可能先触发 focusout，稍后才恢复 viewport 高度。
        // 只在视口确实恢复后更新稳定尺寸，避免把键盘态的小高度锁成面板高度。
        if (options.force || !_phoneStableViewportHeight || orientationChanged || !hasKeyboardViewportGap) {
            _phoneStableViewportHeight = currentHeight;
            _phoneStableViewportWidth = currentWidth;
        }

        const panelHeight = Math.max(_phoneStableViewportHeight || currentHeight, currentHeight);
        const panelWidth = Math.max(_phoneStableViewportWidth || currentWidth, currentWidth);
        const viewportStyle = panel.style;
        setPhoneViewportProperty(viewportStyle, '--phone-panel-vh', `${Math.round(panelHeight)}px`);
        setPhoneViewportProperty(viewportStyle, '--phone-panel-vw', `${Math.round(panelWidth)}px`);
        setPhoneViewportProperty(viewportStyle, '--phone-panel-top', '0px');
        setPhoneViewportProperty(viewportStyle, '--phone-panel-left', '0px');
        // Some Android shells keep the WebView viewport stable while exposing IME overlap separately (or not at all).
        // Only subtract a reported/estimated inset when visualViewport has not already shrunk.
        const keyboardViewportHeight = hasVisualKeyboardViewportGap
            ? visualHeight
            : visualHeight - (keyboardOpen ? effectiveKeyboardOffset : 0);
        setPhoneViewportProperty(viewportStyle, '--phone-keyboard-vh', `${Math.round(Math.max(keyboardViewportHeight, 320))}px`);
        setPhoneViewportProperty(viewportStyle, '--phone-keyboard-vw', `${Math.round(Math.max(visualWidth, 320))}px`);
        setPhoneViewportProperty(viewportStyle, '--phone-keyboard-top', `${Math.round(Math.max(visualTop, 0))}px`);
        setPhoneViewportProperty(viewportStyle, '--phone-keyboard-left', `${Math.round(Math.max(visualLeft, 0))}px`);

        if (!keyboardOpen && panel?.classList?.contains('phone-panel-open')) {
            applyPhonePanelDesktopPosition();
        }
    }

    function schedulePhonePanelViewportUpdate(options = {}) {
        const immediate = options.immediate === true;
        const delay = Number.isFinite(Number(options.delay)) ? Math.max(0, Number(options.delay)) : 60;
        const settleDelay = Number.isFinite(Number(options.settleDelay)) ? Math.max(0, Number(options.settleDelay)) : 140;

        if (immediate) {
            updatePhonePanelViewportHeight(options);
        } else if (typeof requestAnimationFrame === 'function') {
            requestAnimationFrame(() => updatePhonePanelViewportHeight(options));
        }

        clearTimeout(_phoneViewportResizeTimer);
        _phoneViewportResizeTimer = setTimeout(() => {
            updatePhonePanelViewportHeight(options);
        }, delay);

        clearTimeout(_phoneViewportSettleTimer);
        _phoneViewportSettleTimer = setTimeout(() => {
            updatePhonePanelViewportHeight(options);
        }, settleDelay);
    }

    function stopPhonePanelViewportWatchdog() {
        clearTimeout(_phoneViewportWatchdogTimer);
        _phoneViewportWatchdogTimer = null;
        _phoneViewportWatchdogUntil = 0;
    }

    function startPhonePanelViewportWatchdog(duration = 1800) {
        _phoneViewportWatchdogUntil = Math.max(
            _phoneViewportWatchdogUntil,
            Date.now() + Math.max(600, Number(duration) || 0)
        );
        if (_phoneViewportWatchdogTimer) return;

        const tick = () => {
            _phoneViewportWatchdogTimer = null;
            const panel = document.getElementById('phone-panel');
            if (!panel?.classList?.contains('phone-panel-open')) {
                stopPhonePanelViewportWatchdog();
                return;
            }

            updatePhonePanelViewportHeight({ source: 'watchdog' });
            const keyboardOpen = panel.classList.contains('phone-keyboard-open');
            if (!keyboardOpen && Date.now() >= _phoneViewportWatchdogUntil) {
                stopPhonePanelViewportWatchdog();
                return;
            }

            // Keyboard-open polling is intentionally low frequency. It catches browsers that update
            // visualViewport values but omit the final resize event when the IME is dismissed.
            const delay = keyboardOpen
                ? (Date.now() < _phoneViewportWatchdogUntil ? 360 : 900)
                : 120;
            _phoneViewportWatchdogTimer = setTimeout(tick, delay);
        };

        _phoneViewportWatchdogTimer = setTimeout(tick, 80);
    }

    function isDesktopPhonePanelDragEnabled() {
        if (!window.matchMedia) return true;
        if (window.matchMedia('(pointer: coarse)').matches) return false;
        const hasDesktopPointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches
            || window.matchMedia('(any-hover: hover) and (any-pointer: fine)').matches;
        return !!hasDesktopPointer;
    }

    function getPhonePanelDesktopViewport() {
        return {
            width: Math.max(320, Math.round(document.documentElement?.clientWidth || window.innerWidth || 360)),
            height: Math.max(320, Math.round(document.documentElement?.clientHeight || window.innerHeight || 640)),
            left: 0,
            top: 0
        };
    }

    function getPhonePanelDesktopBodySize() {
        const panel = document.getElementById('phone-panel');
        const body = panel?.querySelector?.('.phone-body-panel');
        const rect = body?.getBoundingClientRect?.();
        return {
            width: Math.max(220, Math.round(rect?.width || 300)),
            height: Math.max(360, Math.round(rect?.height || 620))
        };
    }

    function clampPhonePanelDesktopPosition(position, bodySize = null) {
        const viewport = getPhonePanelDesktopViewport();
        const size = bodySize || getPhonePanelDesktopBodySize();
        const margin = 8;
        const minX = viewport.left + margin;
        const minY = viewport.top + margin;
        const maxX = viewport.left + Math.max(margin, viewport.width - size.width - margin);
        const maxY = viewport.top + Math.max(margin, viewport.height - size.height - margin);
        const rawX = Number(position?.x);
        const rawY …176881 tokens truncated…isGemini ? 'user' : 'system',
                                            content: musicContent,
                                            parts: isGemini ? [{ text: musicContent }] : undefined,
                                            isMusicMessage: true,
                                            identifier: 'music_system',
                                            name: 'SYSTEM (音乐)'
                                        };

                                        let musicReplaced = false;
                                        const MUSIC_VAR = '{{MUSIC_PROMPT}}';
                                        const MUSIC_VAR_SPACED_REGEX = /\{\{\s*MUSIC_PROMPT\s*\}\}/i;

                                        // 1️⃣ 扫描上下文，寻找 {{MUSIC_PROMPT}} 变量，执行"原地拆分注入"
                                        for (let i = 0; i < messages.length; i++) {
                                                let msgContent = messages[i].content || messages[i].mes || messages[i].text || (messages[i].parts && messages[i].parts[0] ? messages[i].parts[0].text : '') || '';

                                            if (typeof msgContent === 'string') {
                                                let varIndex = msgContent.indexOf(MUSIC_VAR);
                                                let varLen = MUSIC_VAR.length;
                                                if (varIndex < 0) {
                                                    const match = msgContent.match(MUSIC_VAR_SPACED_REGEX);
                                                    if (match && typeof match.index === 'number') {
                                                        varIndex = match.index;
                                                        varLen = match[0].length;
                                                    }
                                                }
                                                if (varIndex < 0) continue;

                                                const preText = msgContent.substring(0, varIndex).trim();
                                                const postText = msgContent.substring(varIndex + varLen).trim();

                                                const newMessages = [];
                                                const originalMsg = messages[i];

                                                if (preText) {
                                                    newMessages.push({
                                                        role: originalMsg.role,
                                                        content: preText,
                                                        parts: isGemini ? [{ text: preText }] : undefined,
                                                        name: originalMsg.name
                                                    });
                                                }

                                                newMessages.push(musicMessage);

                                                if (postText) {
                                                    newMessages.push({
                                                        role: originalMsg.role,
                                                        content: postText,
                                                        parts: isGemini ? [{ text: postText }] : undefined,
                                                        name: originalMsg.name
                                                    });
                                                }

                                                messages.splice(i, 1, ...newMessages);
                                                musicReplaced = true;
                                                break;
                                            }
                                        }

                                        // 2️⃣ 兼容旧行为：允许缺失变量兜底时，插入到最后一条 user 消息之前
                                        if (!musicReplaced && allowVariablelessFallback) {
                                            let insertPos = messages.length;
                                            for (let i = messages.length - 1; i >= 0; i--) {
                                                if (messages[i].role === 'user') {
                                                    insertPos = i;
                                                    break;
                                                }
                                            }
                                            messages.splice(insertPos, 0, musicMessage);
                                        }
                                    }

                                    const appendPhoneTimeAnchorToLastUserMessage = () => {
                                        try {
                                            const tm = window.VirtualPhone?.timeManager;
                                            if (!tm || typeof tm.getPhoneLastMessageTime !== 'function' || typeof tm.extractTimeFromChat !== 'function') return;

                                            const storyTime = tm.extractTimeFromChat(context);
                                            const parseDateTimeToTs = (dateText, timeText) => {
                                                const dateRaw = String(dateText || '').trim();
                                                const timeRaw = String(timeText || '').trim().replace('：', ':');
                                                if (!dateRaw || !timeRaw) return NaN;
                                                const dateMatch = dateRaw.match(/(\d{1,6})[-\/年]\s*(\d{1,2})[-\/月]\s*(\d{1,2})\s*日?/);
                                                const timeMatch = timeRaw.match(/(\d{1,2})[:：](\d{2})/);
                                                if (!dateMatch || !timeMatch) return NaN;
                                                return new Date(
                                                    Number(dateMatch[1]),
                                                    Number(dateMatch[2]) - 1,
                                                    Number(dateMatch[3]),
                                                    Number(timeMatch[1]),
                                                    Number(timeMatch[2])
                                                ).getTime();
                                            };
                                            const getPhoneTimeFromOfflineChats = () => {
                                                let latest = null;
                                                (Array.isArray(wechatOfflineChats) ? wechatOfflineChats : []).forEach(chat => {
                                                    (Array.isArray(chat?.messages) ? chat.messages : []).forEach(msg => {
                                                        const ts = parseDateTimeToTs(msg?.date, msg?.time);
                                                        if (!Number.isFinite(ts)) return;
                                                        if (!latest || ts > latest.timestamp) {
                                                            latest = {
                                                                date: String(msg.date || '').trim(),
                                                                time: String(msg.time || '').trim().replace('：', ':'),
                                                                timestamp: ts
                                                            };
                                                        }
                                                    });
                                                });
                                                return latest;
                                            };
                                            const phoneTime = tm.getPhoneLastMessageTime() || getPhoneTimeFromOfflineChats();
                                            if (!storyTime?.date || !storyTime?.time || !phoneTime?.date || !phoneTime?.time) return;

                                            const storyTs = Number(storyTime.timestamp || tm.parseTimeToTimestamp?.(storyTime));
                                            const phoneTs = Number(phoneTime.timestamp || tm.parseTimeToTimestamp?.(phoneTime));
                                            if (!Number.isFinite(storyTs) || !Number.isFinite(phoneTs) || phoneTs <= storyTs) return;

                                            const formatTimeAnchor = (value) => {
                                                const date = String(value?.date || '').trim();
                                                const weekday = String(value?.weekday || '').trim();
                                                const time = String(value?.time || '').trim();
                                                return [date, weekday, time].filter(Boolean).join(' ');
                                            };
                                            const anchorBlock = [
                                                '<时间提示>',
                                                '【手机时间锚点】',
                                                `手机最晚时间：${formatTimeAnchor(phoneTime)}`,
                                                `正文剧情最晚时间：${formatTimeAnchor(storyTime)}`,
                                                '【时间处理规则】',
                                                '1. 基准锚点：当前主时间线与剧情应该衔接【手机最晚时间】为最新起点，严禁倒退回旧正文时间及剧情。',
                                                '2. 剧情推进（按以下优先级判定）：',
                                                '   - 显式指定：如用户本轮给出了明确日期/时刻，直接采用该时间。',
                                                '   - 相对推进：如用户包含“稍后/次日/几天后”等时移词，以手机时间为起点向后顺延。',
                                                '   - 默认接续：用户无时移描述，必须紧接手机时间发生之后继续剧情。',
                                                '</时间提示>'
                                            ].join('\n');
                                            const anchorRegex = /\n*\s*(?:<时间提示>[\s\S]*?<\/时间提示>|【手机时间锚点】[\s\S]*?(?=\n{2,}|$))/g;

                                            const targetIndex = findLastNormalUserMessageIndex();
                                            if (targetIndex < 0) return;

                                            {
                                                const msg = messages[targetIndex];
                                                const isUserMessage = msg?.role === 'user'
                                                    || msg?.is_user === true
                                                    || msg?.is_user === 'true';
                                                if (!isUserMessage && (msg?.isPhoneMessage || msg?.isMusicMessage)) return;

                                                let content = msg.content ?? msg.mes ?? msg.text ?? (Array.isArray(msg.parts) && msg.parts[0] ? msg.parts[0].text : '');
                                                if (typeof content !== 'string') content = String(content ?? '');
                                                const cleaned = content.replace(anchorRegex, '').trimEnd();
                                                const nextContent = `${cleaned}\n\n${anchorBlock}`.trim();
                                                messages[targetIndex] = cloneSplitMessage(msg, nextContent);
                                            }
                                        } catch (e) {
                                            console.warn('⚠️ [手机] 追加手机时间锚点失败:', e);
                                        }
                                    };
                                    if (requestHasPhoneMacro || allowVariablelessFallback) {
                                        appendPhoneTimeAnchorToLastUserMessage();
                                    }

                                    const appendWechatOnlineToOfflineHintAsTailUserMessage = () => {
                                        try {
                                            const pending = getWechatOnlineToOfflineTransferPending();
                                            if (!pending?.active) return;

                                            const createdAt = Number(pending.createdAt || 0);
                                            if (createdAt && Date.now() - createdAt > 2 * 60 * 1000) {
                                                clearWechatOnlineToOfflineTransferPending();
                                                return;
                                            }

                                            const hintBlock = '<线上转下线>注意：这是微信线上剧情触发的线下剧情。请把微信最后几条消息视为刚刚发生的前置事实，必须衔接线上微信后的剧情、角色位置和角色线下见面状态；如果微信中已经出现“我进来了”“到了”“开门了”“见到你了”等内容，线下剧情必须承认角色已经抵达/进入/见面。严禁将角色重新写成仍在别处、尚未到达、未见面，或跳过微信里已经发生的动作。</线上转下线>';
                                            const hintRegex = /\n*\s*<线上转下线>[\s\S]*?<\/线上转下线>/g;
                                            for (let i = messages.length - 1; i >= 0; i--) {
                                                const msg = messages[i];
                                                let content = msg.content ?? msg.mes ?? msg.text ?? (Array.isArray(msg.parts) && msg.parts[0] ? msg.parts[0].text : '');
                                                if (typeof content !== 'string') content = String(content ?? '');
                                                hintRegex.lastIndex = 0;
                                                if (!hintRegex.test(content)) continue;
                                                hintRegex.lastIndex = 0;
                                                const cleaned = content.replace(hintRegex, '').trim();
                                                if (!cleaned && msg?.identifier === 'wechat_online_to_offline_hint') {
                                                    messages.splice(i, 1);
                                                    continue;
                                                }
                                                if (msg.content !== undefined) msg.content = cleaned;
                                                if (msg.mes !== undefined) msg.mes = cleaned;
                                                if (msg.text !== undefined) msg.text = cleaned;
                                                if (Array.isArray(msg.parts) && msg.parts[0]?.text !== undefined) msg.parts[0].text = cleaned;
                                            }

                                            const isGemini = messages.length > 0 && messages[0]?.parts !== undefined;
                                            messages.push({
                                                role: 'user',
                                                content: hintBlock,
                                                parts: isGemini ? [{ text: hintBlock }] : undefined,
                                                name: 'SYSTEM (微信线上转线下)',
                                                isPhoneMessage: true,
                                                identifier: 'wechat_online_to_offline_hint'
                                            });
                                        } catch (e) {
                                            console.warn('⚠️ [手机] 追加线上转下线提示失败:', e);
                                        }
                                    };
                                    appendWechatOnlineToOfflineHintAsTailUserMessage();

                                    // ========================================
                                    // 🔥 终极防线：无条件清洗发送给大模型的数据上下文
                                    // ========================================
                                    messages.forEach(msg => {
                                        let c = msg.content || msg.mes || msg.text || (msg.parts && msg.parts[0] ? msg.parts[0].text : '') || '';
                                        if (typeof c === 'string') {
                                            let modified = false;

                                            // 1. 清洗占位符变量残骸
                                            const TARGET_VAR = '{{PHONE_PROMPT}}';
                                            const HISTORY_VAR = '{{PHONE_HISTORY}}';
                                            const PHONE_APP_HISTORY_VAR = '{{PHONE_APP_HISTORY}}';
                                            const HONEY_VAR = '{{HONEY_HISTORY}}';
                                            const WEIBO_VAR = '{{WEIBO_HISTORY}}';
                                            const MUSIC_VAR = '{{MUSIC_PROMPT}}';
                                            const MOFO_VAR = '{{MOFO_PROMPT}}';
                                            const DIARY_VAR = '{{DIARY_HISTORY}}';
                                            const CALENDAR_VAR = '{{CALENDAR_REMINDER}}';
                                            const WANGXIANG_VAR = '{{WANGXIANG_TASKS}}';
                                            const WANGXIANG_ORDERS_VAR = '{{WANGXIANG_ORDERS}}';
                                            const PHONE_PROMPT_SPACED_REGEX = /\{\{\s*PHONE_PROMPT\s*\}\}/gi;
                                            const PHONE_HISTORY_SPACED_REGEX = /\{\{\s*PHONE_HISTORY\s*\}\}/gi;
                                            const PHONE_APP_HISTORY_SPACED_REGEX = /\{\{\s*PHONE_APP_HISTORY\s*\}\}/gi;
                                            const HONEY_HISTORY_SPACED_REGEX = /\{\{\s*HONEY_HISTORY\s*\}\}/gi;
                                            const WEIBO_HISTORY_SPACED_REGEX = /\{\{\s*WEIBO_HISTORY\s*\}\}/gi;
                                            const MUSIC_PROMPT_SPACED_REGEX = /\{\{\s*MUSIC_PROMPT\s*\}\}/gi;
                                            const MOFO_PROMPT_SPACED_REGEX = /\{\{\s*MOFO_PROMPT\s*\}\}/gi;
                                            const DIARY_HISTORY_SPACED_REGEX = /\{\{\s*DIARY_HISTORY\s*\}\}/gi;
                                            const CALENDAR_REMINDER_SPACED_REGEX = /\{\{\s*CALENDAR_REMINDER\s*\}\}/gi;
                                            const WANGXIANG_TASKS_SPACED_REGEX = /\{\{\s*WANGXIANG_TASKS\s*\}\}/gi;
                                            const WANGXIANG_ORDERS_SPACED_REGEX = /\{\{\s*WANGXIANG_ORDERS\s*\}\}/gi;
                                            if (c.includes(TARGET_VAR)) {
                                                c = c.split(TARGET_VAR).join('');
                                                modified = true;
                                            }
                                            if (PHONE_PROMPT_SPACED_REGEX.test(c)) {
                                                c = c.replace(PHONE_PROMPT_SPACED_REGEX, '');
                                                modified = true;
                                            }
                                            if (c.includes(HISTORY_VAR)) {
                                                c = c.split(HISTORY_VAR).join('');
                                                modified = true;
                                            }
                                            if (PHONE_HISTORY_SPACED_REGEX.test(c)) {
                                                c = c.replace(PHONE_HISTORY_SPACED_REGEX, '');
                                                modified = true;
                                            }
                                            if (c.includes(PHONE_APP_HISTORY_VAR)) {
                                                c = c.split(PHONE_APP_HISTORY_VAR).join('');
                                                modified = true;
                                            }
                                            if (PHONE_APP_HISTORY_SPACED_REGEX.test(c)) {
                                                c = c.replace(PHONE_APP_HISTORY_SPACED_REGEX, '');
                                                modified = true;
                                            }
                                            if (c.includes(HONEY_VAR)) {
                                                c = c.split(HONEY_VAR).join('');
                                                modified = true;
                                            }
                                            if (HONEY_HISTORY_SPACED_REGEX.test(c)) {
                                                c = c.replace(HONEY_HISTORY_SPACED_REGEX, '');
                                                modified = true;
                                            }
                                            if (c.includes(WEIBO_VAR)) {
                                                c = c.split(WEIBO_VAR).join('');
                                                modified = true;
                                            }
                                            if (WEIBO_HISTORY_SPACED_REGEX.test(c)) {
                                                c = c.replace(WEIBO_HISTORY_SPACED_REGEX, '');
                                                modified = true;
                                            }
                                            if (c.includes(MUSIC_VAR)) {
                                                c = c.split(MUSIC_VAR).join('');
                                                modified = true;
                                            }
                                            if (MUSIC_PROMPT_SPACED_REGEX.test(c)) {
                                                c = c.replace(MUSIC_PROMPT_SPACED_REGEX, '');
                                                modified = true;
                                            }
                                            if (c.includes(MOFO_VAR)) {
                                                c = c.split(MOFO_VAR).join('');
                                                modified = true;
                                            }
                                            if (MOFO_PROMPT_SPACED_REGEX.test(c)) {
                                                c = c.replace(MOFO_PROMPT_SPACED_REGEX, '');
                                                modified = true;
                                            }
                                            if (c.includes(DIARY_VAR)) {
                                                c = c.split(DIARY_VAR).join('');
                                                modified = true;
                                            }
                                            if (DIARY_HISTORY_SPACED_REGEX.test(c)) {
                                                c = c.replace(DIARY_HISTORY_SPACED_REGEX, '');
                                                modified = true;
                                            }
                                            if (c.includes(CALENDAR_VAR)) {
                                                c = c.split(CALENDAR_VAR).join('');
                                                modified = true;
                                            }
                                            if (CALENDAR_REMINDER_SPACED_REGEX.test(c)) {
                                                c = c.replace(CALENDAR_REMINDER_SPACED_REGEX, '');
                                                modified = true;
                                            }
                                            if (c.includes(WANGXIANG_VAR)) {
                                                c = c.split(WANGXIANG_VAR).join('');
                                                modified = true;
                                            }
                                            if (WANGXIANG_TASKS_SPACED_REGEX.test(c)) {
                                                c = c.replace(WANGXIANG_TASKS_SPACED_REGEX, '');
                                                modified = true;
                                            }
                                            if (c.includes(WANGXIANG_ORDERS_VAR)) {
                                                c = c.split(WANGXIANG_ORDERS_VAR).join('');
                                                modified = true;
                                            }
                                            if (WANGXIANG_ORDERS_SPACED_REGEX.test(c)) {
                                                c = c.replace(WANGXIANG_ORDERS_SPACED_REGEX, '');
                                                modified = true;
                                            }

                                            // TT 2.3 注册宏后会把原始变量转换成稳定标记，这里一并清理未消费残骸。
                                            const placeholderCleanup = stripPhonePromptPlaceholders(c);
                                            if (placeholderCleanup.changed) {
                                                c = placeholderCleanup.text;
                                                modified = true;
                                            }

                                            // 2. 抹除隐秘标签 (仅限 assistant 角色)
                                            if (msg.role === 'assistant') {
                                                // 统一清洗 Phone, Music 标签。
                                                // Wechat 标签不再由插件清洗，交给酒馆正则控制。
                                                const tagsToClean = ['phone', 'music'];
                                                tagsToClean.forEach(tag => {
                                                    const rx = new RegExp(`(?:\\\`\\\`\\\`[\\w]*\\n)?<${tag}>[\\s\\S]*?<\\/${tag}>(?:\\n\\\`\\\`\\\`)?`, 'gi');
                                                    const cleaned = c.replace(rx, '').trim();
                                                    if (cleaned !== c) {
                                                        c = cleaned;
                                                        modified = true;
                                                    }
                                                });

                                                // 清洗电话来电标记
                                                const phoneCallRx = /\[手机来电通话\][^\n]*/gi;
                                                if (phoneCallRx.test(c)) {
                                                    c = c.replace(phoneCallRx, '').trim();
                                                    modified = true;
                                                }
                                            }

                                            if (modified) {
                                                if (msg.content !== undefined) msg.content = c;
                                                if (msg.mes !== undefined) msg.mes = c;
                                                if (msg.text !== undefined) msg.text = c;
                                                if (msg.parts && msg.parts[0] !== undefined) msg.parts[0].text = c;
                                            }
                                        }
                                    });

                                }  // 结束 if (messages && Array.isArray(messages))
                            }      // 结束 if (wechatOfflineChats.length > 0 || settings.enabled)

                        } catch (e) {
                            // 🔥 第三层防线：错误处理 - 只打印日志，不中断酒馆进程
                            console.error('❌ [手机插件] 注入逻辑异常 (已拦截):', e.message);
                            console.error('📍 [手机插件] 错误堆栈:', e.stack);
                            forceFallbackCleanup(eventData.chat); // 哪怕代码崩溃了，也必须把占位符擦掉！
                            // 不抛出异常，避免影响酒馆主流程
                        }
                }; // 结束 phonePromptHandler 定义

                // 官方事件是主注入链；旧 filter 只作为兼容入口。小手机必须先于会克隆 chat
                // 的扩展执行，否则后续注入会落在非酒馆最终发送的数组上。
                const eventTypes = context.eventTypes || context.event_types || window.eventTypes || window.event_types || {};
                let phonePromptBridgeRegistered = false;

                if (eventTypes.CHAT_COMPLETION_PROMPT_READY && context.eventSource) {
                    const phonePromptReadyListener = (eventData) => runPhonePromptHandler(eventData, 'prompt_ready_event');
                    if (typeof context.eventSource.makeFirst === 'function') {
                        context.eventSource.makeFirst(eventTypes.CHAT_COMPLETION_PROMPT_READY, phonePromptReadyListener);
                        phonePromptBridgeRegistered = true;
                    } else if (typeof context.eventSource.on === 'function') {
                        context.eventSource.on(eventTypes.CHAT_COMPLETION_PROMPT_READY, phonePromptReadyListener);
                        phonePromptBridgeRegistered = true;
                    }
                }

                if (window.hooks && typeof window.hooks.addFilter === 'function') {
                    window.hooks.addFilter('chat_completion_prompt_ready', async (chat) => {
                        const eventData = { chat, prompt: [] };
                        await runPhonePromptHandler(eventData, 'prompt_ready_filter');
                        return eventData.chat;
                    });
                    phonePromptBridgeRegistered = true;
                }

                if (!phonePromptBridgeRegistered) {
                    console.warn('⚠️ [手机插件] 未找到可用的 prompt-ready 注入入口');
                }

            } else {
                console.warn('⚠️ 无法访问 context 或 eventSource');
            }

            // ========================================================================
            // 🚀 终极杀手锏：全局 Fetch 拦截器 (完美解决点“发送”过快导致漏变量的 Bug)
            // ========================================================================
            if (!window._stPhoneFetchPatched) {
                window._stPhoneFetchPatched = true;
                const ogFetch = window.fetch;
                window.fetch = async function (url, options) {
                    const isPhoneInternalApiRequest = (() => {
                        if (options?.stPhoneInternalApi === true) return true;
                        const headers = options?.headers;
                        if (!headers) return false;
                        if (typeof Headers !== 'undefined' && headers instanceof Headers) {
                            return headers.get('X-ST-Phone-Internal-API') === '1';
                        }
                        if (Array.isArray(headers)) {
                            return headers.some(([key, value]) => String(key || '').toLowerCase() === 'x-st-phone-internal-api' && String(value) === '1');
                        }
                        if (typeof headers === 'object') {
                            return Object.entries(headers).some(([key, value]) => String(key || '').toLowerCase() === 'x-st-phone-internal-api' && String(value) === '1');
                        }
                        return false;
                    })();
                    const isTextGeneration = (
                        !isPhoneInternalApiRequest &&
                        typeof url === 'string' &&
                        (url.includes('/api/backends/chat-completions/generate') ||
                         url.includes('/v1/chat/completions') ||
                         (url.includes('/generate') && !url.includes('/api/sd/') && !url.includes('/api/tts/') && !url.includes('/api/images/')))
                    );

                    // 拦截正文生成请求
                    if (isTextGeneration && options && options.body && typeof options.body === 'string') {
                        try {
                            let bodyObj = JSON.parse(options.body);
                            let targetArray = null;

                            // 兼容各大模型的数据结构
                            if (Array.isArray(bodyObj.messages)) targetArray = bodyObj.messages;
                            else if (Array.isArray(bodyObj.prompt)) targetArray = bodyObj.prompt;
                            else if (Array.isArray(bodyObj.contents)) targetArray = bodyObj.contents;

                            if (targetArray) {
                                // 🌟 1. 核心防御：连同外层 bodyObj 一起检查，防止变量被移动端或 Claude 抽离到 system 字段
                                const hasMacros = JSON.stringify(bodyObj).match(PHONE_REQUEST_MACRO_PATTERN);
                                const hasWechatOnlineToOfflinePending = !!getWechatOnlineToOfflineTransferPending();

                                if (hasMacros || hasWechatOnlineToOfflinePending) {
                                    if (hasMacros) {
                                        console.info('📱 [手机插件] prompt_ready 后仍有手机变量，正在执行发送前最终注入。');
                                    }
                                    
                                    let safeEvent = { chat: targetArray, prompt: [] };
                                    
                                    // 🔥 移动端/Claude 绝杀：如果变量被抽到了 system 字段，强行把它塞回头部当做临时消息
                                    let hasSystemField = typeof bodyObj.system === 'string';
                                    if (hasSystemField) {
                                        safeEvent.chat.unshift({ role: 'system', content: bodyObj.system, isTempSystem: true });
                                    }

                                    // 强行在发包前，调用注入函数再跑一遍！
                                    await runPhonePromptHandler(safeEvent, 'fetch_final');
                                    
                                    // 🔥 处理完毕后，完美缝合：把刚刚塞进去的、以及插件新注入的系统块，全部抽出来重新拼接回 system 字段
                                    if (hasSystemField) {
                                        let newSysParts = [];
                                        while (safeEvent.chat.length > 0 && (safeEvent.chat[0].isTempSystem || safeEvent.chat[0].isPhoneMessage || safeEvent.chat[0].isMusicMessage || safeEvent.chat[0].role === 'system')) {
                                            let popped = safeEvent.chat.shift();
                                            if (popped.content) newSysParts.push(popped.content);
                                        }
                                        bodyObj.system = newSysParts.join('\n\n');
                                    }
                                    
                                    if (hasWechatOnlineToOfflinePending) {
                                        clearWechatOnlineToOfflineTransferPending();
                                    }
                                    console.info('✅ [手机插件] 发送前最终注入完成。');
                                }

                                // 🌟 2. 处理图片占位符 (保留原有的发图功能)
                                let modifiedImage = false;
                                targetArray.forEach(msg => {
                                    if (msg.role === 'user' && typeof msg.content === 'string' && msg.content.includes('__ST_PHONE_IMAGE_')) {
                                        const parts = msg.content.split(/(__ST_PHONE_IMAGE_\d+_[a-z0-9]+__)/g);
                                        const newContent = [];
                                        parts.forEach(part => {
                                            if (part.startsWith('__ST_PHONE_IMAGE_') && window.VirtualPhone?._pendingImages?.[part]) {
                                                newContent.push({ type: 'image_url', image_url: { url: window.VirtualPhone._pendingImages[part] } });
                                                delete window.VirtualPhone._pendingImages[part];
                                            } else if (part && part.trim() !== '') {
                                                newContent.push({ type: 'text', text: part });
                                            }
                                        });
                                        msg.content = newContent;
                                        modifiedImage = true;
                                    }
                                });
                                if (modifiedImage) console.log('🔥 [手机插件] 图片代币已成功调包为原生多模态数组');

                                // 🌟 3. 将修复好的完美数据重新打包
                                options.body = JSON.stringify(bodyObj);
                                try {
                                    Object.defineProperty(options, 'stPhonePromptFinalized', { value: true, configurable: true });
                                } catch (_error) {
                                    options.stPhonePromptFinalized = true;
                                }
                                window.dispatchEvent(new CustomEvent('st-phone-request-finalized', {
                                    detail: {
                                        url: String(url || ''),
                                        hadMacros: Boolean(hasMacros),
                                        messageCount: targetArray.length,
                                        timestamp: Date.now()
                                    }
                                }));
                            }
                        } catch (e) {
                            console.error('🔥 手机底层拦截器异常:', e);
                        }
                    }
                    // 放行，发送修改后的数据包给大模型
                    return ogFetch.apply(this, arguments);
                };
            }
            // ========================================================================

        } catch (e) {
            console.error('❌ 虚拟手机初始化失败:', e);
        }
    }  // 结束 init() 函数

    // 🔥 终极修复：绝对禁止人为延迟！必须立刻执行，否则会错过酒馆的第一次发送事件！
    init().then(() => {
        if (window.VirtualPhone && modulesLoaded) {
            window.VirtualPhone.version = ST_PHONE_VERSION;
        }
    });

}

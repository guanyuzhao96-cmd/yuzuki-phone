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
// APP配置文件
export const DEFAULT_APP_ICONS = Object.freeze({
    dossier: new URL('../assets/icons/ios/dossier.svg?v=1.6.9', import.meta.url).href,
    systemTasks: new URL('../assets/icons/ios/tasks.svg?v=1.6.16', import.meta.url).href,
    campusForum: new URL('../assets/icons/ios/campus-forum.svg?v=1.6.15', import.meta.url).href,
    wechat: new URL('../assets/icons/ios/wechat.svg?v=1.6.9', import.meta.url).href,
    weibo: new URL('../assets/icons/ios/weibo.svg?v=1.6.9', import.meta.url).href,
    x: new URL('../assets/icons/ios/x.svg?v=1.6.9', import.meta.url).href,
    honey: new URL('../assets/icons/ios/honey.svg?v=1.6.9', import.meta.url).href,
    mofo: new URL('../assets/icons/ios/mofo.svg?v=1.6.9', import.meta.url).href,
    wangxiang: new URL('../assets/icons/ios/wangxiang.svg?v=1.6.9', import.meta.url).href,
    phone: new URL('../assets/icons/ios/phone.svg?v=1.6.9', import.meta.url).href,
    diary: new URL('../assets/icons/ios/diary.svg?v=1.6.9', import.meta.url).href,
    music: new URL('../assets/icons/ios/music.svg?v=1.6.9', import.meta.url).href,
    album: new URL('../assets/icons/ios/album.svg?v=1.6.9', import.meta.url).href,
    calendar: new URL('../assets/icons/ios/calendar.svg?v=1.6.9', import.meta.url).href,
    games: new URL('../assets/icons/ios/games.svg?v=1.6.9', import.meta.url).href,
    settings: new URL('../assets/icons/ios/settings.svg?v=1.6.9', import.meta.url).href
});

export const DEFAULT_PHONE_WALLPAPER = new URL('../assets/wallpapers/ios-default.svg?v=1.6.9', import.meta.url).href;

export const APPS = [
    { id: 'dossier', name: '角色档案', icon: '📇', defaultIcon: DEFAULT_APP_ICONS.dossier, color: '#547c72', data: {} },
    { id: 'system-tasks', name: '任务', icon: '📋', defaultIcon: DEFAULT_APP_ICONS.systemTasks, color: '#6157c8', data: {} },
    { id: 'campus-forum', name: '校园论坛', icon: '🏫', defaultIcon: DEFAULT_APP_ICONS.campusForum, color: '#315c50', badge: 0, data: {} },
    // 第一行
    {
        id: 'wechat',
        name: '微信',
        icon: '💬',
        defaultIcon: DEFAULT_APP_ICONS.wechat,
        color: '#07c160',
        badge: 0,
        data: {
            contacts: [],
            messages: [],
            moments: []
        }
    },
    {
        id: 'weibo',
        name: '微博',
        icon: '👁️‍🗨️',
        defaultIcon: DEFAULT_APP_ICONS.weibo,
        color: '#ff8200',
        badge: 0,
        data: {
            hotSearches: [],
            recommends: [],
            cacheTopic: null // 用于记录当前打开的热搜词
        }
    },
    {
        id: 'x',
        name: 'X',
        icon: 'X',
        defaultIcon: DEFAULT_APP_ICONS.x,
        color: '#000000',
        badge: 0,
        data: {}
    },
    {
        id: 'honey',
        name: '蜜语',
        icon: '💕',
        defaultIcon: DEFAULT_APP_ICONS.honey,
        color: '#ff6b9d',
        badge: 0,
        data: {
            messages: []
        }
    },
    {
        id: 'mofo',
        name: '魔坊',
        icon: '🪄',
        defaultIcon: DEFAULT_APP_ICONS.mofo,
        color: '#1677ff',
        data: {
            scenes: [],
            presets: []
        }
    },
    {
        id: 'wangxiang',
        name: '万象',
        icon: '🧿',
        defaultIcon: DEFAULT_APP_ICONS.wangxiang,
        color: '#315c50',
        data: {}
    },
    // 第二行
    {
        id: 'phone',
        name: '通话',
        icon: '📞',
        defaultIcon: DEFAULT_APP_ICONS.phone,
        color: '#52c41a',
        data: {
            contacts: [],
            callHistory: []
        }
    },
    {
        id: 'diary',
        name: '日记',
        icon: '📔',
        defaultIcon: DEFAULT_APP_ICONS.diary,
        color: '#faad14',
        data: {
            entries: []
        }
    },
    {
        id: 'music',
        name: '音乐',
        icon: '🎵',
        defaultIcon: DEFAULT_APP_ICONS.music,
        color: '#eb2f96',
        data: {
            playlists: [],
            nowPlaying: null
        }
    },
    {
        id: 'album',
        name: '相册',
        icon: '🖼️',
        defaultIcon: DEFAULT_APP_ICONS.album,
        color: '#4096ff',
        data: {
            images: []
        }
    },
    {
        id: 'calendar',
        name: '日历',
        icon: '📅',
        defaultIcon: DEFAULT_APP_ICONS.calendar,
        color: '#5d83a8',
        data: {
            memos: []
        }
    },
    {
        id: 'games',
        name: '游戏',
        icon: '🎮',
        defaultIcon: DEFAULT_APP_ICONS.games,
        color: '#722ed1',
        data: {
            installed: ['2048', '贪吃蛇', '俄罗斯方块']
        }
    },
    // 第三行
    {
        id: 'settings',
        name: '设置',
        icon: '⚙️',
        defaultIcon: DEFAULT_APP_ICONS.settings,
        color: '#8c8c8c',
        data: {}
    }
];

// 手机配置
export const PHONE_CONFIG = {
    brand: 'iPhone',
    model: 'iPhone 14 Pro',
    theme: 'light',
    wallpaper: DEFAULT_PHONE_WALLPAPER,
    defaultWallpaper: DEFAULT_PHONE_WALLPAPER,
    position: 'right',
    size: 'medium'
};

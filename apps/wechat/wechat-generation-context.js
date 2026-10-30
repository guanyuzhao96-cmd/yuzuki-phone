// Shared read-only role state for WeChat headers and reply generation.
// Rules follow the rolecard worldbook: 三大动态数值、攻略阶段关系与角色目标 v2.9.
import { latestMvuSnapshot, findMvuRole, escapeHtml } from '../dossier/dossier-data.js?v=20261030-mvu-roster-152';

export const escapeWechatContextText = escapeHtml;
const text = value => String(value ?? '').trim();
function scalar(value) {
    if (Array.isArray(value) && value.length === 2 && typeof value[1] === 'string') return scalar(value[0]);
    if (value && typeof value === 'object') {
        for (const key of ['value', 'current', 'currentValue', 'current_value', 'score']) {
            if (value[key] !== undefined) return scalar(value[key]);
        }
        return undefined;
    }
    return value === undefined || value === null || value === '' ? undefined : value;
}
const pick = (role, keys) => {
    for (const key of keys) {
        const value = scalar(role?.[key]);
        if (value !== undefined) return value;
    }
    return undefined;
};

export function readWechatMvuSnapshot(context = {}) {
    const host = typeof window !== 'undefined' ? window : globalThis;
    const liveContext = host.SillyTavern?.getContext?.();
    const scope = ctx => JSON.stringify([ctx?.characterId, ctx?.groupId, ctx?.chatId, ctx?.chatMetadata?.file_name]);
    if (liveContext && scope(liveContext) !== scope(context)) return latestMvuSnapshot(null, context.chat || []);
    let api = context.Mvu || host.Mvu;
    try { api ||= host.parent?.Mvu; } catch (_) {}
    return latestMvuSnapshot(typeof api?.getMvuData === 'function' ? options => api.getMvuData(options) : null, context.chat || []);
}

export function readWechatRoleState(contact = {}, context = {}, snapshot = readWechatMvuSnapshot(context)) {
    const names = [...new Set([
        contact.formalName, contact.characterName, contact.fullName, contact.realName, contact.name, contact.remark
    ].map(text).filter(Boolean))];
    // Strip only a trailing display remark, never do substring/fuzzy name matching.
    for (const name of [...names]) {
        const withoutRemark = name.replace(/\s*[（(][^）)]*[）)]\s*$/, '').trim();
        if (withoutRemark && !names.includes(withoutRemark)) names.push(withoutRemark);
    }
    let match = {status: 'missing', role: null};
    for (const name of names) {
        const candidate = findMvuRole(snapshot?.data, name);
        if (candidate.status === 'ambiguous') return {name: names[0] || '', status: 'ambiguous'};
        if (candidate.status === 'matched') { match = candidate; break; }
    }
    const role = match.role;
    return {
        status: match.status, id: match.id, name: text(role?.role_name || role?.姓名 || match.id || names[0]),
        affection: pick(role, ['好感度', '好感', 'affection']),
        desire: pick(role, ['欲望值', '性欲值', 'desire', 'libido', 'sexualDesire']),
        depravity: pick(role, ['堕落值', 'depravity', 'corruption']),
        relationship: pick(role, ['与主角的关系', '与主角关系', 'relationship']),
        goal: pick(role, ['当前目标', 'currentGoal']),
        role, snapshot
    };
}

export function renderWechatAffectionBadge(contact = {}, context = {}) {
    const state = readWechatRoleState(contact, context);
    const value = state.affection === undefined ? '未记录' : String(state.affection);
    return '<span class="wechat-affection-badge" data-wechat-affection aria-label="好感度：'
        + escapeHtml(value) + '">好感度：' + escapeHtml(value) + '</span>';
}

export function extractWechatBehaviorRules(books = []) {
    const result = [];
    for (const book of books) {
        const entries = Array.isArray(book.entries) ? book.entries : Object.values(book.entries || {});
        for (const entry of entries) {
            const title = text(entry.comment);
            if (!/三大动态数值|(?:好感|欲望|性欲|堕落).*(?:数值规则|互动规则|阶段规则|变化规则)/.test(title)) continue;
            const paragraphs = text(entry.content).split(/\n\s*\n/).filter(paragraph =>
                /反映|亲疏|信任|心理|关系路线|关系阶段|攻略路径|角色专属阶段|边界|高欲望低好感/.test(paragraph)
                && !/^每轮只更新/.test(paragraph.trim())
            );
            const content = (paragraphs.length ? paragraphs.join('\n\n') : text(entry.content)).slice(0, 2600);
            if (content) result.push({book: book.name, title, content});
            if (result.length >= 3) return result;
        }
    }
    return result;
}

export function buildWechatBehaviorPrompt(states = [], rules = [], archives = []) {
    const valid = states.filter(state => state.status === 'matched');
    if (!valid.length) return '';
    const show = value => value === undefined ? '未记录，不得补造' : String(value);
    const lines = [
        '【微信角色当前状态与表达约束】',
        '以下是当前聊天最新MVU的只读现值。每位发送者只使用自己这一行的状态；既有关系、世界书阶段条件、性格和当前语境共同决定回复。',
        ...valid.map(state => `角色：${state.name}；好感度=${show(state.affection)}；性欲值（MVU欲望值）=${show(state.desire)}；堕落值=${show(state.depravity)}；与主角关系=${show(state.relationship)}；当前目标=${show(state.goal)}`),
        '好感度表现情感亲疏与信任，影响称呼、主动关心、分享意愿和戒备；欲望值表现当下吸引与冲动，影响是否接受或主动回应相关话题；堕落值表现对相关偏好的接纳程度和心理抑制，影响表达的克制、回避或坦率程度。三项互不替代，不能一律套成热情暧昧。',
        '组合判断：高欲望低好感时可以有吸引但仍戒备、冷淡或划清关系；高好感低欲望时可以关心信任而不主动调情；高堕落也不等于爱上主角、愿意转账或答应任何要求。是否称得上高/低、阶段边界及特殊行为优先按下方世界书原文判断；世界书未给阈值时不要自创数值档位。',
        '回复前按每人的当前三值、已确认的路线与阶段、专属晋级条件、性格、目标及最近消息决定语气和行动意愿。数值只作为影响表达的内部资料，不在聊天中报数或复述秘密、攻略说明。群聊表达须符合公开场景，不泄露私聊或隐藏目标。',
        '关系路线与阶段沿用MVU和专属世界书已确认的名称，不因单次聊天或单项数值自动升级。目标没有明确结果时保持连续性。数值不自动证明同意或任何行为；不得从未知字段推测亲密事实。',
        '本请求只生成微信消息，不修改MVU、不申报三值变化，不输出UpdateVariable/JSONPatch或第二套状态栏。'
    ];
    for (const rule of rules) lines.push(`【规则来源：${rule.book} / ${rule.title}】\n${rule.content}`);
    for (const state of valid) {
        const archive = archives.find(archive => archive.name === state.name);
        const fields = (archive?.sources || []).flatMap(source => (source.fields || []).filter(field =>
            /攻略|阶段|路线|晋级|好感|欲望|性欲|堕落|边界/.test(String(field.path || '') + ' ' + field.label)
        ).map(field => `${source.book} / ${source.comment} / ${field.path || field.label}：${field.value}`));
        if (fields.length) lines.push(`【${state.name}专属规则，仅适用于此人；优先于通用阶段】\n${fields.join('\n').slice(0, 1000)}`);
    }
    return lines.join('\n');
}

export function buildWechatReplyProtocol({windowName = '', userName = '用户', isGroup = false, customEmojiList = ''} = {}) {
    const sender = isGroup ? '白名单内成员的完整微信名' : windowName;
    const formats = [
        `${sender}: 普通聊天文字`,
        `${sender}: 😀`,
        `${sender}: [表情包]（表情包中文名称）`,
        `${sender}: [图片]（桌边的一杯热茶）（tea cup, tabletop, warm light, phone photo）`,
        `${sender}: [个人图片]（窗边微笑的自拍）（1girl, adult character, selfie, smiling, by window, phone photo）`,
        `${sender}: [用户照片]（朋友拍下用户散步的照片）（1boy, adult character, walking, park, phone photo）`,
        `${sender}: [转账](金额：100元)`,
        `${sender}: [收款]`,
        `${sender}: [领取红包]`,
        `${sender}: [退回转账]`,
        `${sender}: [退回红包]`,
        `${sender}: [语音条]（语音内容）`,
        `${sender}: [定位]（地点名称）`,
        `${sender}: [音乐]（歌曲名，歌手名）`,
        isGroup
            ? `${sender}: [群红包｜类型：拼手气红包｜总金额：¥10.00｜红包个数：2]`
            : `${sender}: [红包](金额：8.88元)`
    ];
    return [
        '【微信消息协议：普通文字与特殊消息均可用】',
        '微信回复部分仅包含<wechat>...</wechat>中的新增消息，窗口用---完整窗口名---，每条消息一行“发送者: 内容”。若其他已注入规则明确允许附带朋友圈数据，仍按其独立协议放在</wechat>之后。不要把示例金额、人物画面或表情当作本轮事实。',
        `当前窗口：${windowName}；用户：${userName}。发送者遵守当前单聊身份/群成员白名单，不替用户发言。`,
        '禁止旁白、动作和括号说明只约束普通文字；图片描述、英文生图tags、表情包名称、转账金额等协议括号必须保留。特殊消息不是旁白，也不受“只能打字”的普通文字限制。',
        '按人物性格、当前状态和实际话题自然选择文字、emoji、表情包、图片、语音或资金卡片，不要求每轮都有特殊消息；用户明确请求照片或表情时要作出符合人设的响应，决定发送就输出对应标签，不能只用文字说“发给你了”。角色可以基于已确认的情境主动发送。',
        '普通emoji直接使用Unicode。表情包用[表情包]（名称），优先从可用表情包库挑选；不是把普通emoji写成[微笑]等标签。',
        '图片必须保留两个括号：中文画面描述、英文逗号分隔生图tags。发送者本人用[个人图片]，含用户本人用[用户照片]，其他画面用[图片]；不要省略tags，不把图片卡片写成普通聊天文字。生图是否成功仍由图片系统的配置与调用结果决定。',
        '转账、红包、收款、领取和退回标签各自单独一行。只在有合理款项、金额和人物意愿时发送，不能为展示功能而送钱；转账不超过20万元，单个普通红包不超过200元。已结算款项不要重复发送或重复收款；用户的收款和红包领取由用户点击处理。',
        `可用表情包：${customEmojiList || '未配置自定义表情包；仍可使用普通emoji'}`,
        '<wechat>', `---${windowName}---`, ...formats, '</wechat>'
    ].join('\n');
}

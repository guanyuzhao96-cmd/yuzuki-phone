import { WorldbookManager } from '../../config/worldbook-manager.js';
import { buildCharacters, escapeHtml as e, findMvuRole, flattenMvu, formatMvuValue, latestMvuSnapshot, MVU_ROLE_FIELDS, visibleFields } from './dossier-data.js';

const KEY = 'chat_dossier_preferences';
const css = `
.yzp-dossier{height:100%;min-height:0;display:flex;flex-direction:column;overflow:hidden;touch-action:pan-y;background:#f2f2f7;color:#1c1c1e;font:14px/1.45 -apple-system,BlinkMacSystemFont,"SF Pro Text","Helvetica Neue",sans-serif}
.yzp-dossier *{box-sizing:border-box}.yzp-dossier header{display:flex;align-items:center;gap:6px;flex-shrink:0;padding:8px 10px;border-bottom:1px solid rgba(60,60,67,.18);background:rgba(255,255,255,.94);backdrop-filter:blur(20px) saturate(150%);-webkit-backdrop-filter:blur(20px) saturate(150%)}
.yzp-dossier header strong{flex:1;min-width:0;font-size:15px;font-weight:650;letter-spacing:-.2px}.yzp-dossier button,.yzp-dossier input,.yzp-dossier select{max-width:100%;font:inherit;color:inherit;border:1px solid rgba(60,60,67,.18);border-radius:11px;background:#fff;padding:7px 9px;min-height:40px}
.yzp-dossier button{cursor:pointer}.yzp-dossier main{display:block;flex:1 1 auto;min-height:0;min-width:0;overflow-x:hidden;overflow-y:auto;padding:8px 10px 12px;overscroll-behavior-y:contain;-webkit-overflow-scrolling:touch;touch-action:pan-y;overflow-wrap:anywhere;background:#f2f2f7}
.yzp-dossier details,.yzp-dossier article{margin:6px 0;padding:9px 10px;border:1px solid rgba(60,60,67,.12);border-radius:14px;background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.035)}
.yzp-dossier summary{min-height:28px;cursor:pointer;font-weight:600;line-height:1.35}.yzp-dossier p{margin:5px 0;white-space:pre-wrap;line-height:1.45}.yzp-dossier small{display:block;color:#6d6d72;font-size:11px;line-height:1.4}.yzp-dossier .warning{color:#9a5b00}.yzp-dossier .role{display:block;width:100%;margin:5px 0;padding:9px 10px;text-align:left}.yzp-dossier label{display:block;margin:6px 0}.yzp-dossier input[type=search],.yzp-dossier select{width:100%}.yzp-dossier .field{padding:5px 0;border-top:1px solid rgba(60,60,67,.1)}.yzp-dossier .field b{font-size:11px;color:#6d6d72}.yzp-dossier .muted{color:#6d6d72}.yzp-dossier h2{margin:2px 0;font-size:20px;line-height:1.25;letter-spacing:-.35px}.yzp-dossier pre{white-space:pre-wrap;font:11px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace}.yzp-dossier button:disabled{opacity:.55}
.yzp-dossier .profile-hero{padding:16px;margin:4px 0 10px;border:0;border-radius:18px;color:#fff;background:linear-gradient(135deg,#514a70,#85739b 58%,#c1a9b8);box-shadow:0 5px 16px rgba(47,36,67,.14)}
.yzp-dossier .profile-kicker{font-size:10px;letter-spacing:2px;text-transform:uppercase;opacity:.78}.yzp-dossier .profile-hero h2{font-size:24px;letter-spacing:.2px;margin:4px 0}.yzp-dossier .profile-subtitle{margin:0;opacity:.88;font-size:12px;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.yzp-dossier .profile-badges{display:flex;flex-wrap:wrap;gap:6px;margin-top:12px}.yzp-dossier .profile-badge{padding:4px 9px;border-radius:20px;background:#ffffff28;border:1px solid #ffffff42;font-size:11px;line-height:1.35}
.yzp-dossier .stat-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin:8px 0 12px}.yzp-dossier .stat-card{padding:10px;border-radius:13px;background:#fff;border:1px solid rgba(60,60,67,.1);min-width:0}.yzp-dossier .stat-label{font-size:10px;color:#74717e}.yzp-dossier .stat-value{font-size:16px;font-weight:650;overflow-wrap:anywhere}.yzp-dossier .stat-card.accent{background:#f5effa;border-color:#e7dbef}.yzp-dossier .profile-group{margin:8px 0;padding:0;overflow:hidden}.yzp-dossier .profile-group summary{padding:11px 12px;display:flex;align-items:center;gap:7px}.yzp-dossier .profile-group summary:after{content:'＋';margin-left:auto;color:#77717e}.yzp-dossier .profile-group[open] summary:after{content:'－'}.yzp-dossier .group-count{font-size:10px;color:#7a7480;font-weight:400}.yzp-dossier .profile-group .fields{padding:0 12px 5px}.yzp-dossier .profile-group .field{display:grid;grid-template-columns:minmax(75px,31%) 1fr;gap:9px;padding:8px 0}.yzp-dossier .profile-group .field b{font-weight:500;color:#77717e}.yzp-dossier .catalog-heading{padding:12px 4px 8px}.yzp-dossier .catalog-kicker{font-size:10px;letter-spacing:2px;color:#78648e;font-weight:700}.yzp-dossier .catalog-heading h2{font-size:23px;margin:2px 0}.yzp-dossier .catalog-heading small{font-size:11px}.yzp-dossier .catalog-tools{display:flex;align-items:center;gap:8px;margin:8px 0;color:#74717e;font-size:11px}.yzp-dossier .catalog-tools span{flex:1}.yzp-dossier .catalog-tools select{width:auto;min-height:36px;padding:5px 8px;font-size:12px}.yzp-dossier .role-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.yzp-dossier .role-card{display:flex;align-items:center;gap:9px;text-align:left;width:100%;min-width:0;min-height:88px;padding:9px;border-radius:14px;background:#fff;border:1px solid rgba(60,60,67,.12);box-shadow:0 1px 2px rgba(0,0,0,.035)}.yzp-dossier .role-avatar{width:42px;height:52px;flex:0 0 42px;display:grid;place-items:center;border-radius:10px;color:white;font-size:21px;font-weight:650;background:linear-gradient(145deg,#89789e,#d0b3c1)}.yzp-dossier .role-info{min-width:0;flex:1}.yzp-dossier .role-name{display:block;font-size:14px;font-weight:650;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.yzp-dossier .role-subtitle{display:block;font-size:10px;color:#77717e;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:2px}.yzp-dossier .role-badges{display:flex;gap:4px;flex-wrap:wrap;margin-top:5px}.yzp-dossier .role-badge{font-size:9px;line-height:1.4;color:#6c5b7e;background:#f0ebf4;border-radius:10px;padding:2px 6px}.yzp-dossier .role-arrow{color:#aaa5b0;font-size:17px}.yzp-dossier .profile-tools{margin:10px 0}.yzp-dossier .source-meta{margin:4px 0 8px}.yzp-dossier .section-hint{padding:7px 12px 0;color:#77717e;font-size:10px}
@media(min-width:520px){.yzp-dossier .stat-grid{grid-template-columns:repeat(4,minmax(0,1fr))}}`;

export class DossierApp {
    constructor(phoneShell, storage) {
        this.phoneShell = phoneShell;
        this.storage = storage;
        this.manager = new WorldbookManager(storage);
        this.characters = [];
        this.books = [];
        this.indexes = [];
        this.errors = [];
        this.sequence = 0;
        this.active = true;
        this.bindEvents();
    }

    context() { return window.SillyTavern?.getContext?.() || {}; }
    scope() {
        const ctx = this.context();
        return JSON.stringify([ctx.characterId, ctx.groupId, ctx.chatId, ctx.chatMetadata?.file_name]);
    }
    prefs() { return this.storage.get(KEY, {}) || {}; }
    save(patch) { this.storage.set(KEY, { ...this.prefs(), ...patch }); }
    isActive() {
        const panel = document.getElementById('phone-panel');
        return this.active && !document.hidden && (!panel || panel.classList.contains('phone-panel-open'));
    }

    bindEvents() {
        window.addEventListener('phone:openApp', event => {
            this.active = event.detail?.appId === 'dossier';
            if (!this.active) { this.sequence++; this.loading = false; clearInterval(this.timer); }
        });
        window.addEventListener('phone:goHome', () => { this.active = false; this.sequence++; this.loading = false; clearInterval(this.timer); });
        window.addEventListener('phone:panelVisibility', event => {
            if (!event.detail?.open) { this.sequence++; this.loading = false; }
            else if (this.isActive()) this.refresh();
        });
        window.addEventListener('phone:swipeBack', event => this.handleSwipeBack(event));
        document.addEventListener('visibilitychange', () => { if (this.isActive()) this.refresh(); });
        const ctx = this.context();
        for (const name of ['MESSAGE_RECEIVED', 'MESSAGE_UPDATED', 'MESSAGE_DELETED', 'MESSAGE_SWIPED', 'GENERATION_ENDED', 'WORLDINFO_UPDATED']) {
            if (ctx.event_types?.[name]) ctx.eventSource?.on(ctx.event_types[name], () => {
                if (!this.isActive()) return;
                clearTimeout(this.debounce);
                this.debounce = setTimeout(() => this.refresh(), 700);
            });
        }
    }

    handleSwipeBack(event) {
        if (!this.active || !document.querySelector('.phone-view-current .yzp-dossier')) return false;
        if (event.detail) event.detail.handled = true;
        if (this.selected || this.settings) { this.selected = null; this.settings = false; this.draw(); }
        else window.dispatchEvent(new CustomEvent('phone:goHome'));
        return true;
    }

    clearCache() {
        this.sequence++;
        this.loading = false;
        this.characters = [];
        this.selected = null;
        this.settings = false;
        this.books = [];
        this.indexes = [];
        this.mvu = null;
        this.errors = [];
        this.readAt = null;
        if (this.isActive()) { this.draw(); queueMicrotask(() => this.refresh()); }
    }

    async render() {
        this.active = true;
        this.settings = false;
        this.selected = null;
        this.draw();
        clearInterval(this.timer);
        // Resolve currently attached worldbooks afresh, then follow their CWB directories.
        this.timer = setInterval(() => { if (this.isActive() && !this.settings) this.refresh(true); }, 20000);
        await this.refresh();
    }

    async refresh(quiet = false) {
        if (this.loading || !this.isActive()) return;
        this.loading = true;
        const token = ++this.sequence;
        const scope = this.scope();
        if (!quiet) this.draw();
        try {
            const names = await this.manager.getDossierDefaultBooks();
            const results = await Promise.allSettled(names.map(name => this.manager.readDossierWorldbook(name)));
            const ctx = this.context();
            const mvuApi = ctx.Mvu || window.Mvu || window.parent?.Mvu;
            const getMvuData = typeof mvuApi?.getMvuData === 'function'
                ? args => mvuApi.getMvuData(args)
                : null;
            const mvu = latestMvuSnapshot(getMvuData, ctx.chat);
            if (token !== this.sequence || scope !== this.scope() || !this.active) return;
            this.books = names;
            this.errors = results.flatMap((result, i) => result.status === 'rejected' ? [`${names[i]}：${result.reason.message}`] : []);
            const loaded = results.filter(r => r.status === 'fulfilled').map(r => r.value);
            const characters = buildCharacters(loaded);
            this.indexes = loaded.flatMap(book => book.entries.filter(entry => /^CWB目录/.test(entry.comment || '') || /【小故事线目录】/.test(entry.content || '')).map(entry => ({ book: book.name, ...entry })));
            const signature = JSON.stringify([names, this.indexes, characters, mvu, this.errors]);
            const changed = signature !== this.signature;
            this.signature = signature;
            this.characters = characters;
            this.mvu = mvu;
            this.readAt = new Date().toLocaleTimeString();
            this.loading = false;
            if (changed || !quiet) this.draw();
        } catch (error) {
            if (token !== this.sequence || scope !== this.scope()) return;
            this.errors = [error.message];
            this.loading = false;
            this.draw();
        } finally { if (token === this.sequence) this.loading = false; }
    }

    section(title, fields, open = false) {
        return `<details class="profile-group" ${open ? 'open' : ''}><summary>${e(title)}<span class="group-count">${fields.length} 项</span></summary><div class="fields">${fields.length ? fields.map(f => `<div class="field"><b>${e(f.label)}</b><p>${e(f.value)}</p></div>`).join('') : '<p class="muted">未记录</p>'}</div></details>`;
    }

    groupedFields(fields, groups, fallback = '其他资料') {
        const remaining = [...visibleFields(fields)];
        const result = [];
        for (const [title, pattern] of groups) {
            const picked = remaining.filter(field => pattern.test(field.label));
            for (const field of picked) remaining.splice(remaining.indexOf(field), 1);
            if (picked.length) result.push(this.section(title, picked, result.length === 0));
        }
        if (remaining.length) result.push(this.section(fallback, remaining));
        return result.join('');
    }

    details(role) {
        const sourcePrefs = this.prefs().sources?.[role.id] || {};
        const choose = type => { const candidates = role.sources.filter(s => s.type === type); return { candidates, source: candidates.length === 1 ? candidates[0] : candidates.find(s => String(s.uid) === sourcePrefs[type]) }; };
        const staticChoice = choose('static'), dynamicChoice = choose('dynamic'), staticSource = staticChoice.source, dynamicSource = dynamicChoice.source;
        const staticFields = staticSource ? visibleFields(staticSource.fields) : [], dynamicFields = dynamicSource ? visibleFields(dynamicSource.fields) : [];
        const paths = flattenMvu(this.mvu?.data), match = findMvuRole(this.mvu?.data, role.name), mvu = match.role || {}, mappings = this.prefs().mappings?.[role.id] || [];
        const fieldValue = (fields, labels) => { const f = fields.find(x => labels.includes(x.label)); return f ? f.value : ''; };
        const mvuValue = (...keys) => { for (const k of keys) if (mvu[k] !== undefined && mvu[k] !== null && mvu[k] !== '') return mvu[k]; return ''; };
        const compact = value => { const s = typeof value === 'object' ? formatMvuValue(value).replace(/\s+/g,' ').trim() : String(value || '').replace(/\s+/g,' ').trim(); return s.length > 58 ? s.slice(0,58)+'…' : s; };
        const unique = fields => { const seen = new Set(); return fields.filter(f => { const k = String(f.value).toLowerCase().replace(/[“”"\s，。；、,.!?！？:：]/g,''); if (!k || seen.has(k)) return false; seen.add(k); return true; }); };
        const curated = (title, labels, open = false) => { const found=[]; for (const label of labels) for (const f of staticFields.filter(x=>x.label===label)) if (!found.some(x=>x.path===f.path&&x.value===f.value)) found.push({...f,label}); return found.length ? this.section(title,found,open) : ''; };
        const stats=[]; const stat=(label,value)=>{if(value!==undefined&&value!==null&&value!=='')stats.push([label,compact(value)]);};
        const relationship=mvuValue('与主角的关系','relationship')||fieldValue(staticFields,['当前关系']);
        const romance=mvuValue('恋爱状态','romanceStatus')||fieldValue(staticFields,['恋爱状态']);
        stat('好感度',mvuValue('好感度','affection')); stat('欲望值',mvuValue('欲望值','性欲值','desire','libido')); stat('堕落值',mvuValue('堕落值','depravity'));
        stat('与主角关系',relationship); stat('恋爱状态',romance); stat('攻略进度',mvuValue('攻略进度','攻略阶段','攻略状态','approachStage'));
        const identity=curated('身份资料',['年龄','国籍','职业','身份','学校','学院','院系','专业','校花榜排名','校花排名','排名'],true);
        const appearance=curated('外貌与风格',['颜值','身高','罩杯','面部特征','体态','气质','发型','发色','肤质','外貌']);
        const personality=curated('性格与特质',['核心特质','隐藏特质','核心缺陷','思考方式','内在冲突','深层恐惧','情绪模式']);
        const background=curated('背景与固定喜好',['背景环境','背景经历','家庭关系','固定喜好','喜好','爱好','习惯','兴趣']);
        const relationInfo=curated('关系设定',['当前关系','恋爱状态','发展路径','信任条件','关系阻力','关系断点','吸引基础']);
        let rank=fieldValue(staticFields,['校花榜排名','校花排名','排名']); if(!rank){const id=fieldValue(staticFields,['身份']);const m=id.match(/校花榜\s*(?:第\s*)?(\d+)/);if(m)rank='第'+m[1]+'名';}
        const rankHtml=rank&&!staticFields.some(f=>['校花榜排名','校花排名','排名'].includes(f.label))?this.section('校花榜排名',[{label:'校花榜排名',value:rank}]):'';
        const goal=mvuValue('当前目标','currentGoal')||fieldValue(staticFields,['当前目标']), progress=mvuValue('目标进度','goalProgress');
        const shortGoal=mvuValue('短期目标','shortTermGoal')||fieldValue(staticFields,['短期目标']), longGoal=mvuValue('长期目标','longTermGoal')||fieldValue(staticFields,['长期目标']);
        const state=mvuValue('当前状态','状态','currentStatus')||fieldValue(dynamicFields,['当前状态','当前情况']);
        const clothes=mvuValue('当前衣着','衣着','穿着','clothing')||fieldValue(dynamicFields,['当前衣着','衣着','穿着']);
        const hair=mvuValue('当前发型','发型','hairstyle')||fieldValue(dynamicFields,['当前发型']);
        const taskValue=mvuValue('关联任务','quests');
        const task=taskValue&&typeof taskValue==='object'?['任务目标','完成条件','是否完成'].map(k=>taskValue[k]===undefined?'':k+'：'+formatMvuValue(taskValue[k])).filter(Boolean).join('；'):(taskValue?formatMvuValue(taskValue):'');
        const current=[]; for(const pair of [['当前目标',goal],['目标进度',progress],['短期目标',shortGoal],['长期目标',longGoal],['当前状态',state],['当前衣着',clothes],['当前发型',hair],['关联任务',task]]) if(pair[1]) current.push({label:pair[0],value:typeof pair[1]==='object'?formatMvuValue(pair[1]):String(pair[1])});
        const currentHtml=current.length?this.section('当前状态与目标',current,true):'';
        const known=unique(dynamicFields.filter(f=>f.label==='角色已知信息')), unknown=unique(dynamicFields.filter(f=>f.label==='角色未知信息'));
        const plot=unique(dynamicFields.filter(f=>f.label==='剧情')).map((f,i)=>({...f,label:'记录 '+(i+1)}));
        const archive=[known.length?this.section('角色已知信息',known):'',unknown.length?this.section('角色未知信息',unknown):'',plot.length?this.section('剧情时间线（重复项已合并）',plot):''].join('');
        const advice=fieldValue(staticFields,['攻略建议','互动建议','相处建议']);
        const derived=[fieldValue(staticFields,['信任条件']),fieldValue(staticFields,['发展路径']),fieldValue(staticFields,['关系断点'])].filter(Boolean);
        const adviceHtml=advice?this.section('攻略建议',[{label:'建议',value:advice}]):(derived.length?this.section('攻略建议（依据档案整理）',derived.map((v,i)=>({label:['信任条件','发展路径','关系断点'][i],value:v}))):'');
        const picker=(type,title,choice)=>choice.candidates.length>1?'<label>'+e(title)+'<select data-source="'+type+'"><option value="">选择来源</option>'+choice.candidates.map(s=>'<option value="'+e(s.uid)+'" '+(s===choice.source?'selected':'')+'>'+e(s.comment)+' · UID '+e(s.uid)+'</option>').join('')+'</select></label>':'';
        const meta=source=>source?'<small>来源：'+e(role.book)+' / '+e(source.comment)+' · UID '+e(source.uid)+(source.enabled===false?' · 条目已停用':'')+'</small>':'';
        const raw=source=>source?'<details><summary>原始条目：'+e(source.comment)+'</summary><pre>'+e(source.content)+'</pre></details>':'';
        const summary=fieldValue(staticFields,['核心设定']);
        const statHtml=stats.length?'<div class="stat-grid">'+stats.map(x=>'<div class="stat-card"><div class="stat-label">'+e(x[0])+'</div><div class="stat-value">'+e(x[1])+'</div></div>').join('')+'</div>':'';
        const values=mappings.map(m=>{const p=paths.find(x=>x.path===m.path);return{label:m.label,value:p?formatMvuValue(p.value)+'\n来源路径：'+m.path:'当前 MVU 中不存在：'+m.path};});
        const status=!this.mvu?'没有可读取的 MVU 数据。':match.status==='matched'?'MVU 已按正式姓名匹配：'+match.id:match.status==='ambiguous'?'存在同名 MVU 角色，未自动合并。':'MVU 未匹配到该角色；其他档案仍可查看。';
        return '<article class="profile-hero"><span class="profile-kicker">角色档案</span><h2>'+e(role.name)+'</h2>'+(summary?'<p class="profile-subtitle">'+e(summary)+'</p>':'')+'</article>'+statHtml+
            picker('static','基础资料来源',staticChoice)+picker('dynamic','动态资料来源',dynamicChoice)+identity+rankHtml+appearance+personality+background+relationInfo+currentHtml+adviceHtml+
            (archive?'<details class="profile-group"><summary>剧情与信息档案<span class="group-count">展开查看</span></summary><div class="fields">'+archive+'</div></details>':'')+meta(staticSource)+meta(dynamicSource)+
            (values.length?this.section('自定义 MVU 展示字段',values):'')+'<details class="profile-tools"><summary>更多核对选项</summary><small>'+e(status)+'</small><input data-mvu-label placeholder="展示名称" aria-label="MVU 显示名称"><select data-mvu-path aria-label="MVU 变量路径"><option value="">选择 MVU 字段</option>'+
            paths.map(p=>'<option value="'+e(p.path)+'">'+e(p.path)+' = '+e(String(p.value).slice(0,70))+'</option>').join('')+'</select><button data-action="add-mapping">添加展示字段</button>'+
            mappings.map((m,i)=>'<p>'+e(m.label)+'：'+e(m.path)+' <button data-remove="'+i+'">移除</button></p>').join('')+'</details><details><summary>查看源条目</summary>'+raw(staticSource)+raw(dynamicSource)+'</details>'+
            '<small>主档只显示有值的精选字段；剧情和原文默认收起。读取时间：'+e(this.readAt||'尚未读取')+'</small>';
    }
    draw() {
        if (!this.active) return;
        const role = this.characters.find(c => c.id === this.selected);
        let body;
        if (this.settings) body = `<h2>目录索引</h2><p>自动关联当前聊天、角色及全局启用的世界书，通过目录中的完整姓名定位角色资料。</p><small>关联 ${this.books.length} 本世界书，识别 ${(this.indexes || []).length} 个目录，列出 ${this.characters.length} 个角色。</small>${(this.indexes || []).map(index => `<article><strong>${e(index.comment)}</strong><small>${e(index.book)} · UID ${e(index.uid)}</small><pre>${e(index.content)}</pre></article>`).join('')}${this.books.length ? `<details><summary>已检查的关联世界书</summary>${this.books.map(name => `<p>${e(name)}</p>`).join('')}</details>` : '<p>当前聊天没有可识别的关联世界书，请检查酒馆中的世界书绑定。</p>'}`;
        else if (role) body = this.details(role);
        else body = `<div class="catalog-heading"><span class="catalog-kicker">CHARACTER COLLECTION</span><h2>角色图鉴</h2><small>动态角色档案 · ${this.characters.length} 位</small></div><input type="search" placeholder="搜索姓名、职业、身份或关系" aria-label="搜索角色" value="${e(this.search || '')}" data-search><div class="catalog-tools"><span>按角色卡片浏览完整档案</span><select data-sort aria-label="角色排序"><option value="name">按姓名</option><option value="affection">按好感度</option></select></div><div data-role-list>${this.roleList()}</div>${!this.characters.length ? '<article>尚未发现包含动态资料的角色。可在“来源”查看目录与世界书读取状态。</article>' : ''}`;
        this.phoneShell.setContent(`<style>${css}</style><div class="yzp-dossier"><header><button data-action="back" aria-label="返回">‹</button><strong>角色档案</strong><button data-action="settings">来源</button><button data-action="refresh" ${this.loading ? 'disabled' : ''}>${this.loading ? '读取中' : '刷新'}</button></header><main>${this.errors.map(error => `<p class="warning">${e(error)}</p>`).join('')}${body}<small>只读 · 世界书与 MVU 的原始内容不会被修改</small></main></div>`, 'dossier-main');
        const root = document.querySelector('.phone-view-current .yzp-dossier') || document.querySelector('.yzp-dossier');
        if (!root) return;
        root.onclick = event => this.onClick(event, root, role);
        const search = root.querySelector('[data-search]');
        if (search) search.oninput = event => { this.search = event.target.value; root.querySelector('[data-role-list]').innerHTML = this.roleList(); };
        const sort = root.querySelector('[data-sort]');
        if (sort) { sort.value = this.sort || 'name'; sort.onchange = event => { this.sort = event.target.value; root.querySelector('[data-role-list]').innerHTML = this.roleList(); }; }
        root.querySelectorAll('[data-source]').forEach(select => { select.onchange = () => {
            const sources = { ...this.prefs().sources, [role.id]: { ...this.prefs().sources?.[role.id], [select.dataset.source]: select.value } };
            this.save({ sources }); this.draw();
        }; });
    }

    roleList() {
        const query = (this.search || '').trim().toLocaleLowerCase();
        const records = this.characters.map(role => {
            const fields = role.sources.flatMap(source => source.fields || []);
            const mvu = findMvuRole(this.mvu?.data, role.name);
            const findField = pattern => fields.find(field => pattern.test(field.label))?.value || '';
            const occupation = findField(/职业|身份|职务/);
            const relationship = mvu.role?.relationship ?? findField(/与主角关系|关系/);
            const affection = mvu.role?.affection;
            const searchText = [role.name, role.book, occupation, relationship, ...fields.map(field => `${field.label} ${field.value}`)].join(' ').toLocaleLowerCase();
            return { role, mvu, occupation, relationship, affection, searchText };
        }).filter(record => !query || record.searchText.includes(query));
        if ((this.sort || 'name') === 'affection') records.sort((a, b) => {
            const av = Number(a.affection), bv = Number(b.affection);
            if (!Number.isFinite(av)) return Number.isFinite(bv) ? 1 : a.role.name.localeCompare(b.role.name, 'zh-CN');
            if (!Number.isFinite(bv)) return -1;
            return bv - av || a.role.name.localeCompare(b.role.name, 'zh-CN');
        });
        else records.sort((a, b) => a.role.name.localeCompare(b.role.name, 'zh-CN'));
        if (!records.length) return '<article class="muted">没有匹配的角色。</article>';
        return `<div class="role-grid">${records.map(({ role, mvu, occupation, relationship, affection }) => {
            const badges = ['动态档案', mvu.status === 'matched' ? 'MVU 已匹配' : '', relationship ? String(relationship) : '', affection !== undefined && affection !== null ? `好感 ${formatMvuValue(affection)}` : ''].filter(Boolean).slice(0, 3);
            return `<button class="role-card" data-role="${e(role.id)}" aria-label="查看${e(role.name)}的完整档案"><span class="role-avatar" aria-hidden="true">${e(role.name.slice(0, 1))}</span><span class="role-info"><span class="role-name">${e(role.name)}</span><span class="role-subtitle">${e(occupation || role.book)}${this.characters.filter(other => other.name === role.name).length > 1 ? ' · 同名角色' : ''}</span><span class="role-badges">${badges.map(badge => `<span class="role-badge">${e(badge)}</span>`).join('')}</span></span><span class="role-arrow" aria-hidden="true">›</span></button>`;
        }).join('')}</div>`;
    }

    onClick(event, root, role) {
        const button = event.target.closest('button');
        if (!button) return;
        if (button.dataset.role) { this.selected = button.dataset.role; this.draw(); return; }
        if (button.dataset.remove !== undefined && role) {
            const list = [...(this.prefs().mappings?.[role.id] || [])]; list.splice(Number(button.dataset.remove), 1);
            this.save({ mappings: { ...this.prefs().mappings, [role.id]: list } }); this.draw(); return;
        }
        switch (button.dataset.action) {
            case 'back':
                if (this.selected || this.settings) { this.selected = null; this.settings = false; this.draw(); }
                else window.dispatchEvent(new CustomEvent('phone:goHome')); break;
            case 'settings': this.settings = true; this.draw(); break;
            case 'refresh': this.refresh(); break;
            case 'add-mapping': {
                const label = root.querySelector('[data-mvu-label]').value.trim();
                const path = root.querySelector('[data-mvu-path]').value;
                if (!label || !path || !role) return;
                const list = [...(this.prefs().mappings?.[role.id] || []).filter(m => m.path !== path), { label, path }];
                this.save({ mappings: { ...this.prefs().mappings, [role.id]: list } }); this.draw(); break;
            }
        }
    }
}

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
.yzp-dossier .stat-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin:8px 0 12px}.yzp-dossier .basic-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;margin:8px 0}.yzp-dossier .basic-item{min-width:0;padding:7px;border-radius:10px;background:#fff;border:1px solid rgba(60,60,67,.1)}.yzp-dossier .basic-label{font-size:10px;color:#74717e}.yzp-dossier .basic-value{font-size:13px;font-weight:650;overflow-wrap:anywhere}.yzp-dossier .source-table{width:100%;border-collapse:collapse;font-size:11px}.yzp-dossier .source-table th,.yzp-dossier .source-table td{padding:6px 4px;border-bottom:1px solid rgba(60,60,67,.1);text-align:left;vertical-align:top;overflow-wrap:anywhere}.yzp-dossier .stat-card{padding:10px;border-radius:13px;background:#fff;border:1px solid rgba(60,60,67,.1);min-width:0}.yzp-dossier .stat-label{font-size:10px;color:#74717e}.yzp-dossier .stat-value{font-size:16px;font-weight:650;overflow-wrap:anywhere}.yzp-dossier .stat-card.accent{background:#f5effa;border-color:#e7dbef}.yzp-dossier .profile-group{margin:8px 0;padding:0;overflow:hidden}.yzp-dossier .profile-group summary{padding:11px 12px;display:flex;align-items:center;gap:7px}.yzp-dossier .profile-group summary:after{content:'＋';margin-left:auto;color:#77717e}.yzp-dossier .profile-group[open] summary:after{content:'－'}.yzp-dossier .group-count{font-size:10px;color:#7a7480;font-weight:400}.yzp-dossier .profile-group .fields{padding:0 12px 5px}.yzp-dossier .profile-group .field{display:grid;grid-template-columns:minmax(75px,31%) 1fr;gap:9px;padding:8px 0}.yzp-dossier .profile-group .field b{font-weight:500;color:#77717e}.yzp-dossier .catalog-heading{padding:12px 4px 8px}.yzp-dossier .catalog-kicker{font-size:10px;letter-spacing:2px;color:#78648e;font-weight:700}.yzp-dossier .catalog-heading h2{font-size:23px;margin:2px 0}.yzp-dossier .catalog-heading small{font-size:11px}.yzp-dossier .catalog-tools{display:flex;align-items:center;gap:8px;margin:8px 0;color:#74717e;font-size:11px}.yzp-dossier .catalog-tools span{flex:1}.yzp-dossier .catalog-tools select{width:auto;min-height:36px;padding:5px 8px;font-size:12px}.yzp-dossier .role-grid{display:grid;grid-template-columns:1fr;gap:7px}.yzp-dossier .role-card{display:flex;align-items:center;gap:10px;text-align:left;width:100%;min-width:0;min-height:76px;padding:9px 10px;border-radius:14px;background:#fff;border:1px solid rgba(60,60,67,.12);box-shadow:0 1px 2px rgba(0,0,0,.035)}.yzp-dossier .role-avatar{position:relative;width:54px;height:54px;flex:0 0 54px;display:grid;place-items:center;overflow:hidden;border-radius:13px;color:white;font-size:21px;font-weight:650;background:linear-gradient(145deg,#89789e,#d0b3c1);cursor:pointer}.yzp-dossier .role-avatar img{width:100%;height:100%;object-fit:cover;display:block}.yzp-dossier .role-initial{display:grid;place-items:center;width:100%;height:100%}.yzp-dossier .avatar-edit{position:absolute;right:2px;bottom:2px;width:16px;height:16px;border-radius:50%;display:grid;place-items:center;background:#ffffffdd;color:#655273;font-size:12px;line-height:1}.yzp-dossier .role-info{min-width:0;flex:1}.yzp-dossier .role-name{display:block;font-size:14px;font-weight:650;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.yzp-dossier .role-badges{display:flex;gap:4px;flex-wrap:wrap;margin-top:5px}.yzp-dossier .role-badge{font-size:10px;line-height:1.4;color:#6c5b7e;background:#f0ebf4;border-radius:10px;padding:3px 6px;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.yzp-dossier .role-arrow{color:#aaa5b0;font-size:17px}.yzp-dossier .profile-tools{margin:10px 0}.yzp-dossier .source-meta{margin:4px 0 8px}.yzp-dossier .section-hint{padding:7px 12px 0;color:#77717e;font-size:10px}
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
        const staticChoice = choose('static'), dynamicChoice = choose('dynamic');
        const staticSource = staticChoice.source, dynamicSource = dynamicChoice.source;
        const staticFields = staticSource ? visibleFields(staticSource.fields) : [];
        const dynamicFields = dynamicSource ? visibleFields(dynamicSource.fields) : [];
        const match = findMvuRole(this.mvu?.data, role.name), mvu = match.role || {};
        const fieldValue = (fields, labels) => { const f = fields.find(x => labels.includes(x.label)); return f ? f.value : ''; };
        const mvuValue = (...keys) => { for (const key of keys) if (mvu[key] !== undefined && mvu[key] !== null && mvu[key] !== '') return mvu[key]; return ''; };
        const fmt = value => typeof value === 'object' ? formatMvuValue(value) : String(value ?? '');
        const compact = value => { const s=fmt(value).replace(/\\s+/g,' ').trim(); return s.length>34?s.slice(0,34)+'…':s; };
        const unique = fields => { const seen=new Set(); return fields.filter(f=>{const k=String(f.value).toLowerCase().replace(/[“”"\\s，。；、,.!?！？:：]/g,'');if(!k||seen.has(k))return false;seen.add(k);return true;}); };
        const statValues = [
            ['好感度', mvuValue('好感度','affection')],
            ['性欲值', mvuValue('欲望值','性欲值','desire','libido')],
            ['堕落值', mvuValue('堕落值','depravity')],
            ['与主角关系', mvuValue('与主角的关系','与主角关系','relationship') || fieldValue(staticFields,['当前关系'])]
        ].filter(item=>item[1]!==undefined&&item[1]!==null&&item[1]!=='');
        const identityText=fieldValue(staticFields,['身份']);
        const professionMajor=fieldValue(staticFields,['职业/专业','职业','专业','专业方向'])||(()=>{
            const parts=[];
            const explicitMajor=identityText.match(/(?:主修|专业(?:是|为)?)\\s*([^，,。；;]+)/);
            const study=identityText.match(/(?:潍坊学院)?([^，,。；;]{2,18}?)(?:大[一二三四]学生)/);
            const role=identityText.match(/(?:担任|兼职|任职)(?:校)?([^，,。；;]+)/);
            if(explicitMajor) parts.push(explicitMajor[1].trim());
            else if(study) parts.push(study[1].replace(/^(?:潍坊学院)/,'')+'学生');
            if(role) parts.push(role[1].replace(/的/g,''));
            return parts.join(' · ')||identityText.slice(0,30);
        })();
        const basics = [
            ['年龄',fieldValue(staticFields,['年龄'])],
            ['身高',fieldValue(staticFields,['身高'])],
            ['罩杯',fieldValue(staticFields,['罩杯'])],
            ['颜值分数',fieldValue(staticFields,['颜值','颜值分数'])],
            ['角色等级',fieldValue(staticFields,['角色等级','等级'])],
            ['职业 / 专业',professionMajor]
        ].filter(item=>item[1]).map(item=>'<div class="basic-item"><div class="basic-label">'+e(item[0])+'</div><div class="basic-value">'+e(item[0]==='角色等级'?String(item[1]).toUpperCase():item[1])+'</div></div>').join('');
        const privateFields=[];
        const appendPrivate=(label, aliases, preferred) => {
            const sources=preferred==='dynamic'?[dynamicFields,staticFields]:[staticFields,dynamicFields];
            for(const list of sources){const value=fieldValue(list,aliases);if(value){privateFields.push({label,value});return;}}
        };
        appendPrivate('性经历人数',['性经历人数'],'dynamic');
        appendPrivate('性经历人员',['性经历人员'],'dynamic');
        appendPrivate('性癖',['性癖','性偏好'],'static');
        appendPrivate('秘密',['秘密','秘密钩子','隐藏秘密'],'static');
        const renderFields=fields=>fields.map(f=>'<div class="field"><b>'+e(f.label)+'</b><p>'+e(f.value)+'</p></div>').join('');
        const privateHtml=privateFields.length
            ?'<details class="profile-group"><summary>性经历与隐私<span class="group-count">'+privateFields.length+' 项</span></summary><div class="fields">'+renderFields(privateFields)+'</div></details>':'';
        const known=unique(dynamicFields.filter(f=>f.label==='角色已知信息'));
        const unknown=unique(dynamicFields.filter(f=>f.label==='角色未知信息'));
        const knowledgeHtml=known.length||unknown.length
            ?'<details class="profile-group"><summary>知道的事与未知的事<span class="group-count">'+(known.length+unknown.length)+' 项</span></summary><div class="fields">'+
                (known.length?'<div class="field"><b>知道的事</b><ul>'+known.map(f=>'<li>'+e(f.value)+'</li>').join('')+'</ul></div>':'')+
                (unknown.length?'<div class="field"><b>未知的事</b><ul>'+unknown.map(f=>'<li>'+e(f.value)+'</li>').join('')+'</ul></div>':'')+
                '</div></details>':'';
        const relations=(role.otherRelationships||[]).map(r=>({label:r.left+' '+r.direction+' '+r.right,value:r.description,source:r.book+' / '+r.comment+' · UID '+r.uid}));
        const relationHtml=relations.length?this.section('与其他角色的关系',relations):'';
        const plot=unique(dynamicFields.filter(f=>f.label==='剧情')).map((f,i)=>({...f,label:'记录 '+(i+1)}));
        const plotHtml=plot.length?this.section('剧情',plot):'';
        const picker=(type,title,choice)=>choice.candidates.length>1?'<label>'+e(title)+'<select data-source="'+type+'"><option value="">选择来源</option>'+choice.candidates.map(s=>'<option value="'+e(s.uid)+'" '+(s===choice.source?'selected':'')+'>'+e(s.comment)+' · UID '+e(s.uid)+'</option>').join('')+'</select></label>':'';
        const sourceName=source=>source?e(source.book||role.book)+' / '+e(source.comment)+' · UID '+e(source.uid):'未找到对应档案条目';
        const relationshipSource=[...new Map(relations.map(r=>[r.source,r.source])).keys()].join('<br>')||'未找到角色关系汇总条目';
        const mvuSource=match.status==='matched'?'最新 MVU · roles['+e(match.id)+']':'未匹配到该角色的 MVU';
        const sourceTable='<details class="profile-group"><summary>数据来源</summary><div class="fields"><table class="source-table"><thead><tr><th>展示内容</th><th>数据来源</th></tr></thead><tbody>'+
            '<tr><td>姓名、年龄、身高、罩杯、颜值、角色等级、职业/专业</td><td>'+sourceName(staticSource)+'</td></tr>'+
            '<tr><td>好感度、性欲值、堕落值、与主角关系</td><td>'+mvuSource+(match.status==='matched'?' · 好感度 / 欲望值 / 堕落值 / 与主角的关系':'')+'</td></tr>'+
            '<tr><td>性经历人数、性经历人员、性癖、秘密</td><td>'+sourceName(dynamicSource)+'；缺项回退：'+sourceName(staticSource)+'</td></tr>'+
            '<tr><td>知道的事、未知的事、剧情</td><td>'+sourceName(dynamicSource)+'</td></tr>'+
            '<tr><td>与其他角色的关系</td><td>'+relationshipSource+'</td></tr>'+
            '</tbody></table></div></details>';
        const raw=source=>source?'<details><summary>查看原始条目：'+e(source.comment)+'</summary><pre>'+e(source.content)+'</pre></details>':'';
        return '<article class="profile-hero"><span class="profile-kicker">角色档案</span><h2>'+e(role.name)+'</h2></article>'+
            (statValues.length?'<div class="stat-grid">'+statValues.map(x=>'<div class="stat-card"><div class="stat-label">'+e(x[0])+'</div><div class="stat-value">'+e(compact(x[1]))+'</div></div>').join('')+'</div>':'')+
            (basics?'<div class="basic-grid">'+basics+'</div>':'')+picker('static','基础资料来源',staticChoice)+
            privateHtml+knowledgeHtml+relationHtml+plotHtml+picker('dynamic','动态资料来源',dynamicChoice)+
            sourceTable+'<details><summary>原始资料</summary>'+raw(staticSource)+raw(dynamicSource)+'</details>'+
            '<small>只显示指定字段；长档案已折叠。读取时间：'+e(this.readAt||'尚未读取')+'</small>';
    }
    draw() {
        if (!this.active) return;
        const role = this.characters.find(c => c.id === this.selected);
        let body;
        if (this.settings) body = `<h2>目录索引</h2><p>自动关联当前聊天、角色及全局启用的世界书，通过目录中的完整姓名定位角色资料。</p><small>关联 ${this.books.length} 本世界书，识别 ${(this.indexes || []).length} 个目录，列出 ${this.characters.length} 个角色。</small>${(this.indexes || []).map(index => `<article><strong>${e(index.comment)}</strong><small>${e(index.book)} · UID ${e(index.uid)}</small><pre>${e(index.content)}</pre></article>`).join('')}${this.books.length ? `<details><summary>已检查的关联世界书</summary>${this.books.map(name => `<p>${e(name)}</p>`).join('')}</details>` : '<p>当前聊天没有可识别的关联世界书，请检查酒馆中的世界书绑定。</p>'}`;
        else if (role) body = this.details(role);
        else body = `<div class="catalog-heading"><span class="catalog-kicker">CHARACTER COLLECTION</span><h2>角色图鉴</h2><small>动态角色档案 · ${this.characters.length} 位</small></div><input type="search" placeholder="搜索姓名、职业、身份或关系" aria-label="搜索角色" value="${e(this.search || '')}" data-search><div class="catalog-tools"><span>按角色卡片浏览完整档案</span><select data-sort aria-label="角色排序"><option value="name">按姓名</option><option value="affection">按好感度</option><option value="beauty">按颜值从高到低</option><option value="depravity">按堕落值从高到低</option><option value="grade">按角色等级从高到低</option><option value="height">按身高从高到低</option><option value="cup">按罩杯从大到小</option></select></div><div data-role-list>${this.roleList()}</div>${!this.characters.length ? '<article>尚未发现包含动态资料的角色。可在“来源”查看目录与世界书读取状态。</article>' : ''}`;
        this.phoneShell.setContent(`<style>${css}</style><div class="yzp-dossier"><header><button data-action="back" aria-label="返回">‹</button><strong>角色档案</strong><button data-action="settings">来源</button><button data-action="refresh" ${this.loading ? 'disabled' : ''}>${this.loading ? '读取中' : '刷新'}</button></header><main>${this.errors.map(error => `<p class="warning">${e(error)}</p>`).join('')}${body}<small>只读 · 世界书与 MVU 的原始内容不会被修改</small></main></div>`, 'dossier-main');
        const root = document.querySelector('.phone-view-current .yzp-dossier') || document.querySelector('.yzp-dossier');
        if (!root) return;
        root.querySelectorAll('[data-avatar-image]').forEach(img => { img.onerror = () => { const fallback = document.createElement('span'); fallback.className = 'role-initial'; fallback.textContent = img.alt.slice(0, 1); img.replaceWith(fallback); }; });
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

    chooseRoleAvatar(roleId) {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = () => {
            const file = input.files?.[0];
            if (!file) return;
            if (!file.type.startsWith('image/')) { window.alert('请选择图片文件。'); return; }
            const reader = new FileReader();
            reader.onerror = () => window.alert('图片读取失败，请重试。');
            reader.onload = () => {
                const image = new Image();
                image.onerror = () => window.alert('图片无法解码，请换一张图片。');
                image.onload = () => {
                    const max = 512, scale = Math.min(1, max / Math.max(image.width, image.height));
                    const canvas = document.createElement('canvas');
                    canvas.width = Math.max(1, Math.round(image.width * scale));
                    canvas.height = Math.max(1, Math.round(image.height * scale));
                    const ctx = canvas.getContext('2d');
                    if (!ctx) { window.alert('当前浏览器无法处理图片。'); return; }
                    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
                    try {
                        const avatar = canvas.toDataURL('image/jpeg', 0.82);
                        const avatars = { ...(this.prefs().avatars || {}), [roleId]: avatar };
                        this.save({ avatars });
                        this.draw();
                    } catch (_) { window.alert('头像保存失败，请尝试更小的图片。'); }
                };
                image.src = String(reader.result || '');
            };
            reader.readAsDataURL(file);
        };
        input.click();
    }

    roleList() {
        const query = (this.search || '').trim().toLocaleLowerCase();
        const numberFrom = value => {
            const match = String(value ?? '').match(/-?\\d+(?:\\.\\d+)?/);
            return match ? Number(match[0]) : NaN;
        };
        const gradeOrder = ['D','C','B','A','S','SS','SSS'];
        const cupOrder = ['AA','A','B','C','D','E','F','G','H','I','J','K'];
        const records = this.characters.map(role => {
            const fields = role.sources.flatMap(source => source.fields || []);
            const mvu = findMvuRole(this.mvu?.data, role.name);
            const findField = pattern => fields.find(field => pattern.test(field.label))?.value || '';
            const findExact = labels => fields.find(field => labels.includes(field.label))?.value || '';
            const relationship = mvu.role?.['与主角的关系'] ?? mvu.role?.['与主角关系'] ?? mvu.role?.relationship ?? findField(/与主角关系|当前关系|关系/);
            const affection = mvu.role?.['好感度'] ?? mvu.role?.affection;
            const depravity = mvu.role?.['堕落值'] ?? mvu.role?.depravity;
            const beauty = numberFrom(findExact(['颜值','颜值分数']));
            const height = numberFrom(findExact(['身高']));
            const grade = String(findExact(['角色等级','等级'])).trim().toUpperCase();
            const gradeRank = gradeOrder.indexOf(grade);
            const cupText = String(findExact(['罩杯'])).toUpperCase();
            const cup = cupText.match(/AA|[A-K]/)?.[0] || '';
            const cupRank = cupOrder.indexOf(cup);
            const savedAvatar = this.prefs().avatars?.[role.id] || '';
            const avatarField = findExact(['头像','头像URL','头像链接','角色头像','立绘']);
            const avatarCandidate = savedAvatar || avatarField;
            const avatar = /^(https?:\\/\\/|data:image\\/|\\/)/i.test(String(avatarCandidate)) ? String(avatarCandidate) : '';
            const searchText = [role.name, role.book, relationship, ...fields.map(field => `${field.label} ${field.value}`)].join(' ').toLocaleLowerCase();
            return { role, mvu, relationship, affection, depravity, beauty, height, gradeRank, cupRank, avatar, searchText };
        }).filter(record => !query || record.searchText.includes(query));
        const sortKey = this.sort || 'name';
        if (sortKey === 'name') records.sort((a,b)=>a.role.name.localeCompare(b.role.name,'zh-CN'));
        else {
            records.sort((a,b) => {
                const av = sortKey === 'affection' ? numberFrom(a.affection)
                    : sortKey === 'depravity' ? numberFrom(a.depravity)
                    : sortKey === 'beauty' ? a.beauty
                    : sortKey === 'height' ? a.height
                    : sortKey === 'grade' ? a.gradeRank
                    : sortKey === 'cup' ? a.cupRank : NaN;
                const bv = sortKey === 'affection' ? numberFrom(b.affection)
                    : sortKey === 'depravity' ? numberFrom(b.depravity)
                    : sortKey === 'beauty' ? b.beauty
                    : sortKey === 'height' ? b.height
                    : sortKey === 'grade' ? b.gradeRank
                    : sortKey === 'cup' ? b.cupRank : NaN;
                if (!Number.isFinite(av)) return Number.isFinite(bv) ? 1 : a.role.name.localeCompare(b.role.name,'zh-CN');
                if (!Number.isFinite(bv)) return -1;
                return bv-av || a.role.name.localeCompare(b.role.name,'zh-CN');
            });
        }
        if (!records.length) return '<article class="muted">没有匹配的角色。</article>';
        return `<div class="role-grid">${records.map(({ role, relationship, affection, depravity, avatar }) => {
            const image = avatar ? `<img data-avatar-image src="${e(avatar)}" alt="${e(role.name)}头像" loading="lazy">` : `<span class="role-initial">${e(role.name.slice(0,1))}</span>`;
            const badges = [['好感度',affection],['堕落值',depravity],['关系',relationship]]
                .map(([label,value])=>`<span class="role-badge">${e(label)}：${e(value===undefined||value===null||value===''?'未记录':String(value).replace(/\\s+/g,' ').slice(0,32))}</span>`).join('');
            return `<button class="role-card" data-role="${e(role.id)}" aria-label="查看${e(role.name)}的完整档案"><span class="role-avatar" data-avatar-role="${e(role.id)}" title="点击头像设置或更换图片">${image}<span class="avatar-edit">＋</span></span><span class="role-info"><span class="role-name">${e(role.name)}</span><span class="role-badges">${badges}</span></span><span class="role-arrow" aria-hidden="true">›</span></button>`;
        }).join('')}</div>`;
    }
    onClick(event, root, role) {
        const avatar = event.target.closest('[data-avatar-role]');
        if (avatar) { event.preventDefault(); event.stopPropagation(); this.chooseRoleAvatar(avatar.dataset.avatarRole); return; }
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

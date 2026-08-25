/* 申论素材看板 v2 - 渲染逻辑 */
(function(){
const D = window.DASHBOARD_DATA || {library:[],daily:[],stats:{}};

/* 工具 */
const $ = s=>document.querySelector(s);
const esc = s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const thColor = name=>
  name.includes("乡村")?"#c1a747":
  name.includes("科技")?"#4a82c4":
  name.includes("民生")?"#d96b6b":
  name.includes("基层")?"#c93636":
  name.includes("生态")?"#5a9d6e":
  name.includes("数字")?"#3d9bb0":
  name.includes("时政")?"#d4a544":
  name.includes("讲话")?"#b86b8a":
  name.includes("范文")?"#9b80d4":"#aab3c5";
const fmtDate = d=>{ if(!d)return""; return d.replace(/^(\d{4})-(\d{2})-(\d{2})$/,(_,y,m,day)=>`${y}年${parseInt(m)}月${parseInt(day)}日`); };
const mmdd = d=>{ if(!d)return""; const m=d.slice(5,7),day=d.slice(8,10); return `${parseInt(m)}月${parseInt(day)}日`; };

/* 解析核心时政事件 ①②③ 列表 */
function parseEvents(str){
  if(!str) return [];
  return str.split(/(?=[①②③④⑤⑥⑦⑧⑨⑩])/g).map(s=>s.trim().replace(/^[①②③④⑤⑥⑦⑧⑨⑩]\s*/, '').replace(/^[①②③④⑤⑥⑦⑧⑨⑩]\s*/, '').trim()).filter(Boolean);
}

/* 扁平索引 */
const INDEX=[];
D.library.forEach(t=>{
  if(t.isNote){
    t.notes.forEach(n=>n.items.forEach(it=>INDEX.push({type:"note",theme:t.name,date:n.date,cat:null,batch:n.title,text:it})));
  }else{
    t.batches.forEach(b=>Object.entries(b.categories).forEach(([cat,items])=>items.forEach(it=>INDEX.push({type:"theme",theme:t.name,date:b.date,cat,batch:b.title,text:it}))));
  }
});
D.daily.forEach(day=>day.themes.forEach(th=>Object.entries(th.categories||{}).forEach(([cat,items])=>items.forEach(it=>INDEX.push({type:"daily",theme:th.name,date:day.date,cat,batch:day.date,text:it})))));

/* 主题色主题 */
const MAIN_THEMES = ["乡村振兴","科技创新","民生保障","基层治理","生态文明","数字经济"];

/* 计算主题热度：近7天新增数 */
function recent7Counts(){
  const today = D.daily.length?D.daily[0].date:null;
  if(!today) return {};
  const t7 = new Date(today); t7.setDate(t7.getDate()-6);
  const t7s = t7.toISOString().slice(0,10);
  const counts = Object.fromEntries(MAIN_THEMES.map(n=>[n,0]));
  D.daily.forEach(day=>{
    if(day.date<t7s || day.date>today) return;
    day.themes.forEach(th=>{ if(counts[th.name]!==undefined) Object.values(th.categories||{}).forEach(arr=>counts[th.name]+=arr.length); });
  });
  return counts;
}

/* === 报头日期 === */
function renderMasthead(){
  const today = D.daily.length?D.daily[0].date:null;
  const mainThemes = D.library.filter(t=>t.isMainTheme);
  if(today){
    const dt = new Date(today);
    const weekdays=['日','一','二','三','四','五','六'];
    $('#mastheadDate').textContent = `${fmtDate(today)} · 星期${weekdays[dt.getDay()]} · 第 ${Math.ceil((dt-new Date(dt.getFullYear(),0,0))/86400000)} 期`;
  }
  $('#updatePill').textContent = (D.generatedAt||'').slice(5)||'-';
  $('#totalCount').textContent = INDEX.length;
  $('#themeCount').textContent = mainThemes.length;
}

/* === 今日页 === */
function renderToday(){
  const today = D.daily[0];
  if(!today){
    $('#todayContent').innerHTML='<div class="empty">暂无今日素材</div>';
    return;
  }
  const focus = today.focusThemes || [];
  const themes = today.themes || [];
  const events = parseEvents(today.hotEvents);
  // 重点主题徽章
  const focusHtml = focus.length
    ? `<div class="focus-row"><span class="focus-label">今日重点</span>${focus.map(f=>`<span class="focus-tag" style="color:${thColor(f)};border-color:${thColor(f)}">${f}</span>`).join('')}</div>`
    : '';
  // 核心事件清单
  const evHtml = events.length
    ? `<div class="sec-head"><h2>核心时政</h2></div>
       <div class="events"><ol>${events.slice(0,4).map(e=>`<li>${esc(e)}</li>`).join('')}</ol></div>`
    : '';
  // 今日可写题 - 提前到金句前
  const writeme = genWriteme(today, focus, themes);
  const writemeHtml = writeme.length
    ? `<div class="sec-head"><h2>今日可写题</h2></div>
       ${writeme.map(w=>`<div class="writeme"><h4>${esc(w.title)}</h4><p>${esc(w.hint)}</p><div class="hint">📌 ${esc(w.angle||'')}</div></div>`).join('')}`
    : '';
  // 今日金句 Top3
  const focusTheme0 = focus[0] || themes[0]?.name;
  const focusTh = themes.find(t=>t.name===focusTheme0) || themes[0];
  const quotes = (focusTh && focusTh.categories && focusTh.categories['金句']) || [];
  const top3 = quotes.slice(0,3);
  const quoteHtml = top3.length
    ? `<div class="sec-head"><h2>今日金句</h2></div>
       ${top3.map(q=>{
         const m = q.match(/^(.+?)[（(](.+?)[)）]/);
         const text = m?m[1].trim():q;
         const src = m?m[2].trim():'';
         return `<div class="quote-card"><div class="quote-text">${esc(text)}</div>${src?`<div class="quote-src">— ${esc(src)}</div>`:''}</div>`;
       }).join('')}`
    : '';
  // 今日数据 Top3
  const dataItems = [];
  themes.forEach(th=>{
    (th.categories && th.categories['数据']||[]).forEach(it=>{
      const m = it.match(/[\d,.]+\s*(亿|万|%|个|台|亩|元|吨|件|次|户|人|公斤|万吨|亿元|万亿|个百分点|亩以上)/);
      if(m) dataItems.push({theme:th.name,text:it,num:m[0]});
    });
  });
  // 取前3
  const topData = dataItems.slice(0,3);
  const dataHtml = topData.length
    ? `<div class="sec-head"><h2>今日数据</h2></div>
       <div class="data-grid">${topData.map(d=>{
         const m = d.text.match(/([\d,.]+\s*[^，。\s]{0,4})/);
         return `<div class="data-card"><div class="data-num">${esc(m?m[1]:d.num)}</div><div class="data-label">${esc(d.theme)}</div><div class="data-src">${esc(d.text.slice(0,28))}…</div></div>`;
       }).join('')}</div>`
    : '';
  // 本周主题热度
  const heat = recent7Counts();
  const heatArr = MAIN_THEMES.map(n=>({name:n,n:heat[n]||0})).sort((a,b)=>b.n-a.n);
  const maxN = Math.max(1,...heatArr.map(x=>x.n));
  const heatHtml = heatArr.some(x=>x.n>0)
    ? `<div class="sec-head"><h2>本周主题热度</h2></div>
       <div class="heat-list">${heatArr.map(x=>{
         const op = 0.4 + (x.n/maxN)*0.6;
         return `<div class="heat-row"><span class="nm">${x.name}</span><span class="track"><span class="fill" data-w="${(x.n/maxN*100).toFixed(0)}%" style="width:0;opacity:${op.toFixed(2)}">${x.n>0?x.n+'条':''}</span></span><span class="cnt">${x.n} 条</span></div>`;
       }).join('')}</div>`
    : '';

  $('#todayContent').innerHTML = focusHtml + evHtml + writemeHtml + quoteHtml + dataHtml + heatHtml;

  // 动画
  setTimeout(()=>document.querySelectorAll('.heat-row .fill').forEach(f=>f.style.width=f.dataset.w), 50);
}

/* 今日可写题自动建议 */
function genWriteme(day, focus, themes){
  const tag1 = focus[0] || (themes[0]&&themes[0].name) || '高质量发展';
  const tag2 = focus[1] || '';
  const out = [];
  const ev = (day.hotEvents||'');
  // 政绩观主线
  if(/(政绩观|学习教育|党纪|教育整顿)/.test(ev) || tag1==='基层治理'){
    out.push({title:`以正确政绩观 推动${tag1}高质量发展`,hint:`紧扣"立党为公、为民造福、科学决策、真抓实干"十六字总要求，结合今日"政绩观"主线素材`,angle:`分论点：①思想根基（政绩观偏差的根源） ②制度约束（学习教育常态化） ③实干导向（群众获得感）`});
  }
  // 民生主题
  if(tag2 && (tag2.includes('民生') || /民生|家庭医生|养老|教育/.test(ev))){
    out.push({title:`织密"${tag2}"服务网 筑牢民生保障底线`,hint:`从"尽力与量力""群众获得感"双向论证今日民生素材`,angle:`结构：政策亮点（金句/数据） → 落地案例 → 可持续路径`});
  }
  // 生态/科技/数字等通配
  out.push({title:`深入推进${tag1} 谱写中国式现代化新篇章`,hint:`结合今日${tag1}领域金句与数据，按"意义-现状-路径"展开`,angle:`三段式：①时代意义 ②今日进展 ③未来路径`});
  return out.slice(0,3);
}

/* === 主题库 === */
function renderThemes(){
  const mainThemes = D.library.filter(t=>t.isMainTheme);
  const others = D.library.filter(t=>!t.isMainTheme&&!t.isNote);
  const heat = recent7Counts();
  const html = mainThemes.map(t=>{
    const c = thColor(t.name);
    const cnt = INDEX.filter(i=>i.type==='theme'&&i.theme===t.name).length;
    const newCnt = heat[t.name]||0;
    return `<div class="card" style="border-top:3px solid ${c}">
      <div class="th"><span class="dot" style="background:${c}"></span><h3>${t.name}</h3></div>
      <div class="meta">
        <span>${cnt} 条</span>
        <span>更新 ${mmdd(t.updated)}</span>
        ${newCnt>0?`<span class="new">本周 +${newCnt}</span>`:''}
      </div>
      <div class="preview">点击查看金句 / 政策表述 / 案例 / 数据 完整素材库</div>
      <button class="action" data-theme="${t.name}">展开素材库</button>
    </div>`;
  }).join('');
  const otherHtml = others.length?others.map(t=>{
    const c=thColor(t.name); const n=INDEX.filter(i=>i.theme===t.name).length;
    return `<div class="card" style="border-top:3px solid ${c}">
      <div class="th"><span class="dot" style="background:${c}"></span><h3>${t.name}</h3></div>
      <div class="meta"><span>${n} 条</span><span>更新 ${mmdd(t.updated)}</span></div>
      <button class="action" data-theme="${t.name}">展开</button>
    </div>`;
  }).join(''):'';
  $('#themeGrid').innerHTML = html;
  // 绑定展开按钮
  document.querySelectorAll('#themeGrid [data-theme]').forEach(btn=>{
    btn.onclick = ()=>openTheme(btn.dataset.theme);
  });
}

function openTheme(name){
  const t = D.library.find(x=>x.name===name); if(!t) return;
  const c = thColor(name);
  const cats = ['金句','政策表述','案例','数据'];
  const batches = t.batches || [];
  const total = INDEX.filter(i=>i.type==='theme'&&i.theme===name).length;
  const body = batches.map((b,i)=>{
    const cg = cats.filter(x=>b.categories[x]&&b.categories[x].length);
    if(!cg.length) return '';
    const inner = cg.map(cat=>`<div class="catbox"><h4>${cat}</h4><ul>${(b.categories[cat]||[]).map(it=>`<li>${esc(it)}</li>`).join('')}</ul></div>`).join('');
    return `<details ${i===batches.length-1?'open':''}>
      <summary><span style="color:${c}">■</span> ${esc(b.title||'历史积累')} ${b.date?`<span style="color:var(--ink-3);font-size:11px;margin-left:6px">${b.date}</span>`:''}<span class="chev">▾</span></summary>
      <div class="dbody"><div class="catgrid">${inner}</div></div>
    </details>`;
  }).join('');
  showModal(`<h2><span class="dot" style="background:${c}"></span> ${t.name} · 素材库 <span class="tag">${total} 条</span></h2>${body||'<div class="empty">暂无</div>'}`, c);
}

/* === 日历（每日回溯） === */
function renderCalendar(){
  if(!D.daily.length){$('#dailyList').innerHTML='<div class="empty">暂无</div>';return;}
  $('#dailyList').innerHTML = D.daily.map(day=>{
    const focus = day.focusThemes||[];
    const events = parseEvents(day.hotEvents);
    const focusHtml = focus.map(f=>`<span class="focus-tag" style="background:${thColor(f)};font-size:12px;padding:4px 10px">${f}</span>`).join('');
    const evHtml = events.slice(0,4).map(e=>`<li>${esc(e)}</li>`).join('');
    return `<div class="tl-item">
      <div class="date">${fmtDate(day.date)}</div>
      <div style="background:var(--paper);border:1px solid var(--line);border-radius:8px;padding:14px 16px">
        ${focusHtml?`<div class="focus-row" style="margin-bottom:10px">${focusHtml}</div>`:''}
        ${evHtml?`<div class="events" style="padding:8px 0;background:transparent;border:0"><ol>${evHtml}</ol></div>`:''}
      </div>
    </div>`;
  }).join('');
}

/* === 笔记 === */
function renderNotes(){
  const nb = D.library.find(t=>t.name==='时政笔记');
  if(nb && nb.notes && nb.notes.length){
    $('#noteTimeline').innerHTML = nb.notes.map(n=>{
      const title = trimNoteTitle(n.items[0]||n.title||'');
      return `<div class="tl-item">
        <div class="date">${fmtDate(n.date)}</div>
        <div class="note-item">
          <div class="head"><span class="dot" style="background:var(--gold)"></span><span class="date" style="color:var(--gold)">时政笔记 · ${esc(title)}</span></div>
          <ul>${n.items.map((i,k)=>i.length>60?`<li><details><summary style="cursor:pointer;list-style:none">▶ ${esc(i.slice(0,60))}…</summary><div style="padding:8px 0;color:var(--ink-2)">${esc(i)}</div></details></li>`:`<li><b>·</b>${esc(i)}</li>`).join('')}</ul>
        </div>
      </div>`;
    }).join('');
  }else{$('#noteTimeline').innerHTML='<div class="empty">暂无</div>';}
  const sp = D.library.find(t=>t.name==='重要讲话');
  if(sp && sp.notes && sp.notes.length){
    $('#speechList').innerHTML = sp.notes.map(n=>`<details class="note-item" style="padding:0"><summary style="padding:14px 16px"><span class="dot" style="background:var(--t-重要讲话)"></span><span class="date" style="color:var(--gold)">${esc((n.title||'').slice(0,46))}…</span><span class="chev">▾</span></summary><div class="dbody"><ul>${n.items.map(i=>`<li><b>·</b>${esc(i)}</li>`).join('')}</ul></div></details>`).join('');
  }else{$('#speechList').innerHTML='<div class="empty">暂无</div>';}
}
function trimNoteTitle(s){ return (s||'').replace(/^\*\*来源\*\*[:：]?\s*/,'').slice(0,42)+(s.length>42?'…':''); }

/* === 检索 === */
let searchTimer;
function initSearch(){
  $('#q').addEventListener('input',()=>{clearTimeout(searchTimer);searchTimer=setTimeout(doSearch,180);});
}
function doSearch(){
  const kw = $('#q').value.trim(); if(!kw){$('#searchCount').textContent='';$('#searchRes').innerHTML='<div class="empty">输入关键词，检索全部素材</div>';return;}
  const re = new RegExp(kw.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'gi');
  const hits = INDEX.filter(i=>re.test(i.text) || re.test(i.batch||''));
  $('#searchCount').textContent = `共 ${hits.length} 条匹配`;
  $('#searchRes').innerHTML = hits.slice(0,80).map(h=>{
    const c = thColor(h.theme);
    const icon = h.type==='daily'?'📅':h.type==='note'?'📓':'🗂';
    const src = h.type==='daily'?`${mmdd(h.date)} · 每日`:(h.type==='note'?`${h.date||''} · ${h.theme}`:`${h.theme} · ${esc(h.batch||'')}`);
    const text = h.text.replace(re, m=>`<mark>${m}</mark>`);
    return `<div class="hit" style="border-left-color:${c}">
      <div class="src">${icon} ${esc(src)}</div>
      <div class="text">${text}</div>
    </div>`;
  }).join('') || '<div class="empty">未匹配到</div>';
}

/* === 模态 === */
function showModal(content, accent){
  const ov = document.createElement('div');
  ov.className='modal-bg';
  const box = document.createElement('div');
  box.className='modal';
  if(accent) box.style.borderTop = `3px solid ${accent}`;
  box.innerHTML = content + `<button class="close-btn">关闭</button>`;
  ov.appendChild(box); document.body.appendChild(ov);
  ov.addEventListener('click',e=>{if(e.target===ov) ov.remove()});
  box.querySelector('.close-btn').onclick = ()=>ov.remove();
}

/* === 导航（底部Tab） === */
function initNav(){
  const switchTo = sec => {
    document.querySelectorAll('.bottom-nav button').forEach(x=>x.classList.toggle('active', x.dataset.sec===sec));
    document.querySelectorAll('.section').forEach(s=>s.classList.remove('active'));
    document.getElementById('sec-'+sec).classList.add('active');
    window.scrollTo({top:0,behavior:'smooth'});
  };
  document.querySelectorAll('.bottom-nav button').forEach(b=>{
    b.addEventListener('click',()=>switchTo(b.dataset.sec));
  });
  // 暴露供其他逻辑使用
  window.__switchTab = switchTo;
}

/* === PWA === */
function initPwa(){
  if('serviceWorker' in navigator){
    window.addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));
  }
  let deferred=null;
  window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferred=e;const b=$('#installBtn');b.style.display='inline-block';b.onclick=async()=>{if(deferred){deferred.prompt();}};});
  window.addEventListener('appinstalled',()=>{$('#installBtn').style.display='none';});
}

/* === 启动 === */
function init(){
  renderMasthead();
  renderToday();
  renderThemes();
  renderCalendar();
  renderNotes();
  initNav();
  initSearch();
  initPwa();
}
document.addEventListener('DOMContentLoaded', init);
})();

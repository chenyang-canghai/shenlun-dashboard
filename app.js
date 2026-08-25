/* 申论素材看板 - 渲染逻辑 */
(function(){
const D = window.DASHBOARD_DATA || {library:[],daily:[],stats:{}};

/* ---- 工具 ---- */
const $ = s=>document.querySelector(s);
const esc = s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const thColor = name=>
  name.includes("乡村")?"#71c55a":
  name.includes("科技")?"#5c8cff":
  name.includes("民生")?"#ffa53d":
  name.includes("基层")?"#ff6b5e":
  name.includes("生态")?"#2dd4bf":
  name.includes("数字")?"#38bdf8":
  name.includes("时政")?"#f5b04c":
  name.includes("讲话")?"#f071a0":
  name.includes("范文")?"#b08cff":"#8e9bb5";
const fmtDate = d=>{ if(!d)return""; const m=d.slice(5,7),day=d.slice(8,10); return `${m}月${day}日`; };

/* 将数据扁平化成可检索/可渲染的索引 */
const INDEX=[];
function addIndex(type,theme,date,cat,batch,text){
  if(text) INDEX.push({type,theme,date,cat,batch,text});
}
D.library.forEach(t=>{
  if(t.isNote){
    t.notes.forEach(n=>n.items.forEach(it=>addIndex("note",t.name,n.date,null,n.title,it)));
  }else{
    t.batches.forEach(b=>{
      Object.entries(b.categories).forEach(([cat,items])=>
        items.forEach(it=>addIndex("theme",t.name,b.date,cat,b.title,it)));
    });
  }
});
D.daily.forEach(day=>{
  day.themes.forEach(th=>{
    Object.entries(th.categories||{}).forEach(([cat,items])=>{
      items.forEach(it=>addIndex("daily",th.name,day.date,cat,day.date,it));
    });
  });
});

/* ---- 概览统计 ---- */
function renderStats(){
  const s=D.stats||{};
  const mainThemes=D.library.filter(t=>t.isMainTheme);
  const dailyDates=[...new Set(D.daily.map(d=>d.date))].sort().reverse();
  const latest=dailyDates[0];
  const html=[
    {num:s.totalItems||INDEX.length,lab:"累计素材条数"},
    {num:dailyDates.length,lab:"已积累日报天数"},
    {num:mainThemes.length,lab:"常备主题"},
    {num:latest?latest.slice(5).replace("-","."):"-",lab:"最近更新 "+(latest?latest.slice(0,4):"")}
  ].map(x=>`<div class="stat"><div class="num"${x.num.length>6?' style="font-size:22px"':''}>${x.num}</div><div class="lab">${x.lab}</div></div>`).join("");
  $('#stats').innerHTML=html;
  const td=document.createElement('div');
  td.style.fontSize='11px';td.style.color='var(--txt3)';td.style.marginTop='4px';
  document.querySelector('#stats').querySelector('.stat:last-child').appendChild(td);

  // 主题分布
  const counts=D.library.filter(t=>t.isMainTheme).map(t=>({name:t.name,n:(s.themeCounts&&s.themeCounts[t.name])||0}));
  const max=Math.max(1,...counts.map(c=>c.n));
  $('#dist').innerHTML=counts.map(c=>
    `<div class="dbar"><div class="nm">${c.name}</div>
      <div class="track"><div class="fill" data-w="${(c.n/max*100).toFixed(1)}%" style="width:0;background:${thColor(c.name)}"></div></div>
      <div class="cnt">${c.n}</div></div>`).join("");
  // 动画
  requestAnimationFrame(()=>document.querySelectorAll('.fill').forEach(f=>f.style.width=f.dataset.w));

  // 最新每日热点
  const latest2=D.daily[0];
  if(latest2){
    const ev=esc(latest2.hotEvents||"");
    $('#latestDaily').innerHTML=`
      <div class="daily-card">
        <div class="daily-head">
          <div class="daily-date">${fmtDate(latest2.date)}</div>
          <div class="daily-events"><b>${latest2.focusThemes&&latest2.focusThemes.length?'今日重点：'+latest2.focusThemes.join(' / '):'核心时政事件'}</b><br>${ev}</div>
        </div>
      </div>`;
  }
  // 最近笔记
  const nb=D.library.find(t=>t.name==="时政笔记");
  const recent=nb&&nb.notes?nb.notes.slice(0,3):[];
  $('#latestNotes').innerHTML=recent.length?recent.map(n=>
    `<details class="note-card"><summary style="border-left:3px solid ${thColor(nb.name)}"><span>${fmtDate(n.date)}</span><span style="color:var(--txt2);font-weight:500;font-size:12px">时政笔记</span><span class="chev">▾</span></summary>
      <div class="dbody"><ul class="note-items">${n.items.map(i=>`<li>${esc(i)}</li>`).join('')}</ul></div></details>`).join("")
    :'<div class="empty">暂无笔记</div>';
}

/* ---- 每日热点时间线 ---- */
function renderDaily(){
  if(!D.daily.length){$('#dailyList').innerHTML='<div class="empty">暂无数据，等每日任务填充后自动出现</div>';return;}
  $('#dailyList').innerHTML=D.daily.map(day=>{
    const themes=day.themes||[];
    const activeId=`t-${day.date.replace(/-/g,'')}-0`;
    const tabs=themes.map((th,i)=>`<button class="dtab" data-day="${day.date}" data-i="${i}" style="${i?'':'background:'+thColor(th.name)+"22;color:#fff"};border-color:${thColor(th.name)}55">${th.name}${th.status?' ⭐':''}</button>`).join('')||'';
    const first=themes[0];
    const categories=first&&first.categories?first.categories:{};
    const cats=['金句','政策表述','案例','数据'].filter(c=>categories[c]&&categories[c].length);
    const focus=(day.focusThemes||[]);
    const ftags=focus.map(f=>`<span class="ftag" style="color:${thColor(f)};border-color:${thColor(f)}66;background:${thColor(f)}14">⭐ ${f}</span>`).join('');
    return `<div class="daily-card">
      <div class="daily-head"><div class="daily-date">${fmtDate(day.date)}</div>
        <div class="daily-events">${day.hotEvents?esc(day.hotEvents):'（该日素材待补充）'}</div></div>
      ${ftags?`<div class="focus-tags">${ftags}</div>`:''}
      ${tabs?`<div class="daily-tabs">${tabs}</div>`:''}
      <div class="daily-body" data-day-body="${day.date}">
        ${renderCatGrid(categories,cats,thColor(first?first.name:''))}
      </div>
    </div>`;
  }).join('');
}

function renderCatGrid(categories,cats,color){
  if(!cats.length) return '<div class="empty" style="padding:20px">暂无分类素材</div>';
  return `<div class="catgrid">${cats.map(c=>`
    <div class="catbox"><h4 style="color:${color}"><span class="dot" style="background:${color};color:${color}"></span>${c}</h4>
      <ul>${(categories[c]||[]).slice(0,14).map(i=>`<li>${esc(i)}</li>`).join('')||'<li style="color:var(--txt3)">—</li>'}</ul>
    </div>`).join('')}</div>`;
}

/* ---- 主题库 ---- */
function renderLibrary(){
  const mainThemes=D.library.filter(t=>t.isMainTheme);
  const others=D.library.filter(t=>!t.isMainTheme&&!t.isNote);
  const html=mainThemes.map(t=>{
    const c=thColor(t.name);
    const itemCount=t.batches.reduce((a,b)=>a+Object.values(b.categories).reduce((x,y)=>x+y.length,0),0);
    const catCount=[...new Set(t.batches.flatMap(b=>Object.keys(b.categories)))];
    const preview='点击查看金句 / 政策表述 / 案例 / 数据';
    return `<div class="card" style="border-top:3px solid ${c}">
      <div class="th"><span class="dot" style="background:${c};color:${c}"></span><h3>${t.name}</h3>
        <span class="tag">${itemCount} 条</span><span class="tag">更新 ${fmtDate(t.updated)}</span></div>
      <div class="preview">${preview}</div>
      <button class="open-theme" data-name="${t.name}" style="margin-top:12px;width:100%;padding:9px;border-radius:10px;border:1px solid ${c}55;background:${c}14;color:${c};font-weight:600;font-size:13px;cursor:pointer">展开素材库 ➜</button>
    </div>`;
  }).join('');
  const otherHtml=(others.length?`<div class="sec-head" style="margin-top:26px"><h2>🗂 其它素材档案</h2></div><div class="grid">`
    +others.map(t=>{const c=thColor(t.name);const n=t.batches.reduce((a,b)=>a+Object.values(b.categories).reduce((x,y)=>x+y.length,0),0);
      return `<div class="card" style="border-top:3px solid ${c}"><div class="th"><span class="dot" style="background:${c};color:${c}"></span><h3>${t.name}</h3><span class="tag">${n}条</span></div>
      <button class="open-theme" data-name="${t.name}" style="margin-top:12px;width:100%;padding:9px;border-radius:10px;border:1px solid ${c}55;background:${c}14;color:${c};font-weight:600;font-size:13px;cursor:pointer">展开 ➜</button></div>`;}).join('')+'</div>':'');

  $('#themeGrid').insertAdjacentHTML('beforeend',otherHtml);
  $('#themeGrid').innerHTML=html + $('#themeGrid').innerHTML;
  // 用 replace 简化：重建
  renderThemeModal();
}

function renderThemeModal(){
  document.querySelectorAll('.open-theme').forEach(btn=>btn.onclick=()=>{
    const name=btn.dataset.name;
    const t=D.library.find(x=>x.name===name);
    if(!t)return;
    const c=thColor(name);
    const cats=['金句','政策表述','案例','数据'];
    const batches=t.batches;
    const body=batches.map((b,i)=>{
      const cg=cats.filter(x=>b.categories[x]&&b.categories[x].length);
      return `<details ${i===batches.length-1?'open':''}>
        <summary><span style="color:${c}">■</span> ${esc(b.title||'历史积累')} ${b.date?`<span class="batch-pill">${b.date}</span>`:''}<span class="chev">▾</span></summary>
        <div class="dbody catgrid" style="border-top:0">
          ${cg.map(cat=>`<div class="catbox"><h4 style="color:${c}"><span class="dot" style="background:${c};color:${c}"></span>${cat}</h4><ul>${(b.categories[cat]||[]).map(it=>`<li>${esc(it)}</li>`).join('')}</ul></div>`).join('')
            ||'<div style="color:var(--txt3);font-size:12px">暂无分类</div>'}
        </div></details>`;
    }).join('');
    showModal(`<div style="position:sticky;top:0;backdrop-filter:blur(10px);background:rgba(12,18,30,.9);padding:6px 0 12px;z-index:5;border-bottom:1px solid var(--line);margin-bottom:12px">
      <h2 style="display:flex;align-items:center;gap:10px;font-size:18px"><span class="dot" style="background:${c};color:${c}"></span>${t.name} 素材库<span class="tag" style="font-size:11px;background:var(--card2);padding:2px 8px;border-radius:99px;border:1px solid var(--line)">${INDEX.filter(i=>i.type==='theme'&&i.theme===t.name).length} 条</span></h2></div>
      ${body}`,c);
  });
}

/* 模态 */
function showModal(content,accent){
  const ov=document.createElement('div');
  ov.style.cssText=`position:fixed;inset:0;z-index:100;background:rgba(5,8,15,.72);backdrop-filter:blur(6px);display:grid;place-items:center;padding:16px;animation:fade .25s`;
  const box=document.createElement('div');
  box.style.cssText=`background:linear-gradient(180deg,#111a2e,#0d1424);border:1px solid var(--line2);border-radius:20px;max-width:820px;width:100%;max-height:88vh;overflow:auto;padding:20px;box-shadow:var(--shadow)`;
  box.innerHTML=content+`<button id="mClose" style="margin-top:18px;width:100%;padding:12px;border-radius:12px;border:1px solid ${accent}55;background:${accent}18;color:${accent};font-weight:600;cursor:pointer">关闭</button>`;
  if(accent)box.style.borderTop=`3px solid ${accent}`;
  ov.appendChild(box);document.body.appendChild(ov);
  ov.addEventListener('click',e=>{if(e.target===ov)ov.remove()});
  box.querySelector('#mClose').onclick=()=>ov.remove();
}

/* ---- 深度笔记 ---- */
function renderNotes(){
  const nb=D.library.find(t=>t.name==="时政笔记");
  if(nb&&nb.notes&&nb.notes.length){
    $('#noteTimeline').innerHTML=nb.notes.map(n=>
      `<div class="tl-item"><div class="date">📓 ${n.date} · 时政笔记</div>
        <details><summary style="border-left:3px solid ${thColor('时政笔记')}">${esc(trimTitle(n.items[0]))}<span class="chev">▾</span></summary>
        <div class="dbody"><ul class="note-items">${n.items.map(i=>`<li>${esc(i)}</li>`).join('')}</ul></div></details>
      </div>`).join('');
  }else{$('#noteTimeline').innerHTML='<div class="empty">暂无</div>';}

  const sp=D.library.find(t=>t.name==="重要讲话");
  if(sp&&sp.notes&&sp.notes.length){
    $('#speechList').innerHTML=sp.notes.map(n=>{
      const c=thColor('重要讲话');
      return `<details><summary style="border-left:3px solid ${c}">${esc(trimTitle(n.title))}<span class="chev">▾</span></summary>
        <div class="dbody"><ul class="note-items">${n.items.map(i=>`<li>${esc(i)}</li>`).join('')}</ul></div></details>`;
    }).join('');
  }else{$('#speechList').innerHTML='<div class="empty">暂无</div>';}
}
function trimTitle(s){s=s||"";s=s.replace(/\*\*来源\*\*[:：]|\*\*原文核心\*\*[:：]|\*\*我的解读[^:：]*[:：]?/g,"").trim();return s.slice(0,46)+(s.length>46?"…":"");}

/* ---- 检索 ---- */
let searchTimer;
function initSearch(){
  const q=$('#q');
  q.addEventListener('input',()=>{clearTimeout(searchTimer);searchTimer=setTimeout(doSearch,180)});
}
function doSearch(){
  const kw=$('#q').value.trim().toLowerCase();
  const box=$('#searchRes');
  if(!kw){$('#searchCount').textContent='';box.innerHTML='<div class="empty">输入关键词，检索全部素材的标题、金句、数据与笔记</div>';return;}
  const hits=INDEX.filter(i=>i.text.toLowerCase().includes(kw)||(i.batch||'').toLowerCase().includes(kw)||(i.theme||'').includes(kw));
  $('#searchCount').textContent=`共 ${hits.length} 条匹配`;
  box.innerHTML=hits.slice(0,120).map(h=>{
    const c=thColor(h.theme);
    const icon=h.type==='daily'?'📆':h.type==='note'?'📓':'🗂';
    const src=h.type==='daily'?`${fmtDate(h.date)} · 每日素材`:(h.type==='note'?`${h.date} · ${h.theme}`:`${h.theme} · ${esc(h.batch||'')}`);
    return `<div style="background:var(--card);border:1px solid var(--line);border-radius:12px;padding:12px 14px;margin-bottom:10px;border-left:3px solid ${c}">
      <div style="font-size:11px;color:var(--txt3);margin-bottom:4px">${icon} ${esc(src)}</div>
      <div style="font-size:13px;color:var(--txt);line-height:1.6">${esc(h.text)}</div></div>`;
  }).join('')||'<div class="empty">没有匹配到内容</div>';
}

/* ---- 导航 ---- */
function initNav(){
  $('#nav').addEventListener('click',e=>{
    const b=e.target.closest('button');if(!b)return;
    document.querySelectorAll('.nav button').forEach(x=>x.classList.remove('active'));
    b.classList.add('active');
    document.querySelectorAll('.section').forEach(s=>s.classList.remove('active'));
    $('#sec-'+b.dataset.sec).classList.add('active');
    window.scrollTo({top:0});
  });
}

/* ---- 每日 tab 切换 ---- */
function initDailyTabs(){
  document.addEventListener('click',e=>{
    const tab=e.target.closest('.dtab');if(!tab)return;
    const day=tab.dataset.day,i=+tab.dataset.i;
    const dayCard=D.daily.find(d=>d.date===day);
    if(!dayCard)return;
    document.querySelectorAll(`[data-day="${day}"]`).forEach(b=>{b.classList.remove('active');b.style.background='';b.style.color='';b.style.borderColor='transparent';});
    tab.classList.add('active');
    const c=thColor(dayCard.themes[i].name);
    tab.style.background=c+'22';tab.style.color='#fff';tab.style.borderColor=c+'55';
    const th=dayCard.themes[i];
    const cats=['金句','政策表述','案例','数据'].filter(cat=>th.categories[cat]&&th.categories[cat].length);
    const body=document.querySelector(`[data-day-body="${day}"]`);
    if(body)body.innerHTML=renderCatGrid(th.categories,cats,c);
  });
}

/* ---- PWA ---- */
function initPwa(){
  if('serviceWorker' in navigator){
    window.addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));
  }
  let deferred=null;
  window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferred=e;const b=$('#installBtn');b.style.display='inline-block';b.onclick=async()=>{if(deferred){deferred.prompt();}};});
  window.addEventListener('appinstalled',()=>{$('#installBtn').style.display='none';});
}
function stripPunctuation(s){return (s||"").replace(/[\s·•,，。、；;：:！!?？()（）「」【】《》"'…]/g,"");}
setTimeout(()=>{if(window.DASHBOARD_DATA&&window.DASHBOARD_DATA.library!==undefined){if(!D.stats.totalItems){} }},0);

/* ---- 启动 ---- */
function init(){
  $('#updatePill').innerHTML = '更新于 <b>' + ((D.generatedAt??'').slice(5)||'-') + '</b>';
  renderStats();renderDaily();renderLibrary();renderNotes();
  initNav();initDailyTabs();initSearch();initPwa();
}
document.addEventListener('DOMContentLoaded',init);
})();

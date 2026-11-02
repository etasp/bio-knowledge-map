// Keep Graphify's renderer and interactions; pass selected node IDs to the study page.
const learningAllowed = new Set(RAW_NODES.map(n => n.id));
let studyCatalog = new Map(RAW_NODES.map(n=>[n.id,n]));
let studyMatches = [], studySearchIndex = -1;
const normalizeStudySearch = value => String(value||'').normalize('NFKC').toLowerCase().replace(/[\s“”"'·、，,。()（）]/g,'');
function updateStudySearch() {
  const query=normalizeStudySearch(searchInput.value);
  searchResults.replaceChildren();studySearchIndex=-1;
  if(!query){searchResults.style.display='none';searchInput.removeAttribute('aria-activedescendant');return}
  const aliases={'能量货币':'atp','三磷酸腺苷':'atp','原生质层收缩':'质壁分离','细胞程序性死亡':'细胞凋亡'};
  const key=aliases[query]||query;
  studyMatches=RAW_NODES.filter(n=>learningAllowed.has(n.id)&&!hiddenCommunities.has(n.community)).map(n=>{
    const item=studyCatalog.get(n.id)||n,label=normalizeStudySearch(n.label);
    const text=normalizeStudySearch([item.summary,...(item.points||[]),item.pitfall,item.question,item.answer].join(' '));
    return {node:n,score:label===key?4:label.includes(key)?3:text.includes(key)?1:0};
  }).filter(n=>n.score).sort((a,b)=>b.score-a.score).slice(0,30).map(n=>n.node);
  searchResults.style.display='block';
  if(!studyMatches.length){const empty=document.createElement('div');empty.className='search-empty';empty.textContent='没有找到匹配知识点。试试短关键词，或点击“全书图谱”恢复范围。';searchResults.append(empty);return}
  studyMatches.forEach((n,index)=>{
    const item=studyCatalog.get(n.id)||n,el=document.createElement('div');
    el.className='search-item';el.id='study-result-'+index;el.setAttribute('role','option');el.setAttribute('aria-selected','false');
    el.innerHTML=`<b>${esc(n.label)}</b>${item.lesson?`<small>${esc(item.lesson)} · 第${esc(item.chapter)}章</small>`:''}`;
    el.onclick=()=>{onlyNeighbors=false;document.getElementById('graph-neighbors').setAttribute('aria-pressed','false');applyStudyVisibility();focusNode(n.id);searchResults.style.display='none';searchInput.value='';searchInput.removeAttribute('aria-activedescendant')};
    searchResults.append(el);
  });
}
searchInput.setAttribute('aria-label','搜索知识点和讲解');searchInput.setAttribute('role','combobox');searchInput.setAttribute('aria-controls','search-results');searchInput.setAttribute('aria-autocomplete','list');searchResults.setAttribute('role','listbox');
searchInput.addEventListener('input',event=>{event.stopImmediatePropagation();updateStudySearch()},true);
searchInput.addEventListener('keydown',event=>{
  if(event.key==='Escape'){searchInput.value='';updateStudySearch();return}
  if(event.key==='ArrowDown'||event.key==='ArrowUp'){
    event.preventDefault();const items=[...searchResults.querySelectorAll('.search-item')];if(!items.length)return;
    studySearchIndex=(studySearchIndex+(event.key==='ArrowDown'?1:-1)+items.length)%items.length;
    items.forEach((item,i)=>item.setAttribute('aria-selected',i===studySearchIndex));
    searchInput.setAttribute('aria-activedescendant',items[studySearchIndex].id);items[studySearchIndex].scrollIntoView({block:'nearest'});
  }else if(event.key==='Enter'&&studyMatches.length&&searchResults.style.display!=='none'){event.preventDefault();searchResults.querySelectorAll('.search-item')[Math.max(studySearchIndex,0)].click()}
});
const graphifyShowInfo = showInfo;
let lastLearningNode = '', lastLearningTime = 0;
let selectedStudyNode = null, onlyNeighbors = false, showStudyLabels = true;
let studyState={mastered:[],saved:[],review:[]},studyHistory=[],studyHistoryIndex=-1,followingHistory=false;
const studyProgress=document.createElement('div');studyProgress.id='study-progress';studyProgress.setAttribute('role','status');document.getElementById('search-wrap').after(studyProgress);
function updateStudyProgress(){
  const count=[...studyCatalog.values()].filter(n=>n.question).length;
  studyProgress.innerHTML=`<div>已掌握 ${studyState.mastered.length} / ${count} · 待复习 ${studyState.review.length}<span>收藏 ${studyState.saved.length}</span></div><div class="study-progress-track"><i style="width:${count?studyState.mastered.length/count*100:0}%"></i></div>`;
  const labels={mastered:['标记掌握','✓ 已掌握'],saved:['☆ 收藏','★ 已收藏'],review:['加入复习','✓ 待复习']};
  document.querySelectorAll('[data-study-mark]').forEach(button=>{const action=button.dataset.studyMark,active=studyState[action].includes(button.dataset.node);button.textContent=labels[action][active?1:0];button.setAttribute('aria-pressed',active)});
}
const graphTools = document.createElement('div');
graphTools.id = 'graph-tools';
graphTools.setAttribute('role', 'toolbar');
graphTools.setAttribute('aria-label', '图谱浏览工具');
graphTools.innerHTML = `<button id="graph-zoom-in" aria-label="放大图谱">＋</button><button id="graph-zoom-out" aria-label="缩小图谱">－</button><button id="graph-fit">适应视图</button><button id="graph-neighbors" aria-pressed="false" disabled>只看关联</button><label><input type="checkbox" id="graph-labels" checked>名称</label>`;
graphTools.insertAdjacentHTML('afterbegin','<button id="graph-back" aria-label="上一个知识点" disabled>←</button><button id="graph-forward" aria-label="下一个知识点" disabled>→</button>');
document.body.append(graphTools);
function updateStudyHistory(){document.getElementById('graph-back').disabled=studyHistoryIndex<=0;document.getElementById('graph-forward').disabled=studyHistoryIndex>=studyHistory.length-1}
function followStudyHistory(delta){const index=studyHistoryIndex+delta;if(index<0||index>=studyHistory.length)return;studyHistoryIndex=index;followingHistory=true;focusNode(studyHistory[index]);followingHistory=false;updateStudyHistory()}
document.getElementById('graph-back').onclick=()=>followStudyHistory(-1);
document.getElementById('graph-forward').onclick=()=>followStudyHistory(1);
function applyStudyVisibility(fit = false) {
  const neighborhood = onlyNeighbors && selectedStudyNode ? new Set([selectedStudyNode, ...network.getConnectedNodes(selectedStudyNode)]) : null;
  nodesDS.update(RAW_NODES.map(n => ({id:n.id, hidden:!learningAllowed.has(n.id) || hiddenCommunities.has(n.community) || (neighborhood && !neighborhood.has(n.id))})));
  if (fit) network.fit({animation:false});
  const visible = nodesDS.get().filter(n => !n.hidden).length;
  document.getElementById('stats').textContent = `${visible} / ${RAW_NODES.length} 个节点 · ${RAW_EDGES.length} 条关联 · 实线：原文关系，虚线：学习关联`;
}
function refreshStudyLabels() {
  const bg = getComputedStyle(document.body).backgroundColor;
  nodesDS.update(RAW_NODES.map(n => ({id:n.id,font:{...n.font,color:themeLabelColor,size:showStudyLabels?16:0,strokeWidth:3,strokeColor:bg}})));
}
const graphifyApplyTheme = applyTheme;
applyTheme = function(pref) { graphifyApplyTheme(pref); refreshStudyLabels(); };
refreshStudyLabels();
network.setOptions({edges:{font:{size:12}},interaction:{tooltipDelay:250}});
document.getElementById('graph-zoom-in').onclick=()=>network.moveTo({scale:Math.min(3,network.getScale()*1.25),animation:false});
document.getElementById('graph-zoom-out').onclick=()=>network.moveTo({scale:Math.max(.08,network.getScale()/1.25),animation:false});
document.getElementById('graph-fit').onclick=()=>network.fit({animation:false});
document.getElementById('graph-labels').onchange=e=>{showStudyLabels=e.target.checked;refreshStudyLabels()};
document.getElementById('graph-neighbors').onclick=()=>{onlyNeighbors=!onlyNeighbors;document.getElementById('graph-neighbors').setAttribute('aria-pressed',onlyNeighbors);applyStudyVisibility(true)};
document.getElementById('legend-wrap').addEventListener('change',()=>applyStudyVisibility());
showInfo = function(nodeId) {
  if (!nodesDS.get(nodeId)) return;
  const now = Date.now();
  if (nodeId === lastLearningNode && now - lastLearningTime < 250) return;
  graphifyShowInfo(nodeId);
  lastLearningNode = nodeId;
  lastLearningTime = now;
  selectedStudyNode = nodeId;
  if(!followingHistory&&studyHistory[studyHistoryIndex]!==nodeId){studyHistory=studyHistory.slice(0,studyHistoryIndex+1);studyHistory.push(nodeId);studyHistoryIndex=studyHistory.length-1}
  updateStudyHistory();
  document.getElementById('graph-neighbors').disabled=false;
  if (onlyNeighbors) applyStudyVisibility(true);
  parent.postMessage({type: 'graphify:node', id: nodeId}, '*');
};
window.addEventListener('message', event => {
  if (event.source !== parent || !event.data) return;
  if(event.data.type==='study:catalog'&&Array.isArray(event.data.nodes)){
    studyCatalog=new Map(event.data.nodes.filter(n=>nodesDS.get(n.id)).map(n=>[n.id,n]));
    updateStudyProgress();
  } else if(event.data.type==='study:state'&&event.data.state){
    for(const key of ['mastered','saved','review'])if(Array.isArray(event.data.state[key]))studyState[key]=event.data.state[key];
    updateStudyProgress();
  } else if (event.data.type === 'study:filter' && Array.isArray(event.data.ids)) {
    learningAllowed.clear();
    for (const id of event.data.ids) if (nodesDS.get(id)) learningAllowed.add(id);
    if(event.data.reset){onlyNeighbors=false;selectedStudyNode=null;network.unselectAll();document.getElementById('graph-neighbors').setAttribute('aria-pressed','false');document.getElementById('graph-neighbors').disabled=true;toggleAllCommunities(false)}
    applyStudyVisibility(true);
    if(searchInput.value)updateStudySearch();
  } else if (event.data.type === 'study:detail') {
    const n = event.data.node;
    if (!n || !nodesDS.get(n.id)) return;
    const neighbors = document.getElementById('neighbors-list');
    document.getElementById('info-content').innerHTML = `
      <h2 class="study-title">${esc(n.label)}</h2>
      <p class="study-summary">${esc(n.summary || '')}</p>
      ${Array.isArray(n.points) ? `<ul class="study-points">${n.points.map(p => `<li>${esc(p)}</li>`).join('')}</ul>` : ''}
      ${n.pitfall ? `<p class="study-pitfall"><b>易错提醒</b><br>${esc(n.pitfall)}</p>` : ''}
      ${n.question ? `<details><summary>回忆自测</summary><p>${esc(n.question)}</p><details><summary>查看答案</summary><p>${esc(n.answer || '')}</p></details></details>` : ''}
      <div class="study-source">${esc(n.source_name || '')} · ${esc(n.source_location || '')}<blockquote>${esc(n.evidence || '')}</blockquote></div>
      <div class="study-actions"><button data-study-source="${esc(n.id)}">查看来源原文</button>${n.question ? `<button data-study-card="${esc(n.id)}">完整知识卡</button>` : ''}</div>
      ${n.question?`<div class="study-actions study-marks">${['mastered','saved','review'].map(action=>`<button data-study-mark="${action}" data-node="${esc(n.id)}" aria-pressed="false"></button>`).join('')}</div>`:''}
      <h3 class="study-neighbors">关联知识</h3>`;
    if (neighbors) document.getElementById('info-content').append(neighbors);
    document.getElementById('info-panel').scrollTop = 0;
    updateStudyProgress();
  }
});
document.addEventListener('click', event => {
  const source = event.target.closest('[data-study-source]');
  const card = event.target.closest('[data-study-card]');
  const mark=event.target.closest('[data-study-mark]');
  if(mark)parent.postMessage({type:'graphify:state',id:mark.dataset.node,action:mark.dataset.studyMark},'*');
  if (source || card) parent.postMessage({type: source ? 'graphify:source' : 'graphify:card', id: (source || card).dataset[source ? 'studySource' : 'studyCard']}, '*');
});
parent.postMessage({type: 'graphify:ready'}, '*');

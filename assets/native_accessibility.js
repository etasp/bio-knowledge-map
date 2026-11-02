// Native graph preferences, keyboard access and the compact mobile reading panel.
let studyTheme=themePref();
themePref=()=>studyTheme;
function publishStudyPreferences(){parent.postMessage({type:'graphify:preferences',preferences:{theme:studyTheme,labels:showStudyLabels}},'*')}
applyTheme=function(pref){studyTheme=pref;graphifyApplyTheme(pref);refreshStudyLabels();publishStudyPreferences()};
document.getElementById('graph-labels').onchange=event=>{showStudyLabels=event.target.checked;refreshStudyLabels();publishStudyPreferences()};
searchInput.setAttribute('aria-expanded','false');searchResults.setAttribute('aria-live','polite');
const searchExpandedObserver=new MutationObserver(()=>searchInput.setAttribute('aria-expanded',searchResults.style.display!=='none'));
searchExpandedObserver.observe(searchResults,{attributes:true,attributeFilter:['style']});

graphTools.insertAdjacentHTML('beforeend','<button id="graph-help" aria-label="快捷键说明" aria-expanded="false">?</button>');
const keyboardHelp=document.createElement('div');keyboardHelp.id='graph-keyboard-help';keyboardHelp.hidden=true;keyboardHelp.setAttribute('role','note');keyboardHelp.textContent='/ 搜索 · ＋/－ 缩放 · 0 适应视图 · Alt+←/→ 浏览历史 · Esc 关闭提示或清空搜索';graphTools.append(keyboardHelp);
document.getElementById('graph-help').onclick=()=>{keyboardHelp.hidden=!keyboardHelp.hidden;document.getElementById('graph-help').setAttribute('aria-expanded',!keyboardHelp.hidden)};
const panelTabs=document.createElement('div');panelTabs.id='study-panel-tabs';panelTabs.setAttribute('role','tablist');panelTabs.setAttribute('aria-label','切换图谱侧栏');panelTabs.innerHTML='<button id="study-tab-info" role="tab" aria-selected="true" aria-controls="info-panel">知识讲解</button><button id="study-tab-groups" role="tab" aria-selected="false" aria-controls="legend-wrap">知识分组</button><button id="study-expand" aria-expanded="false">展开阅读</button>';document.getElementById('info-panel').before(panelTabs);
function setStudyPanel(groups){document.body.classList.toggle('study-groups-mode',groups);document.getElementById('study-tab-info').setAttribute('aria-selected',!groups);document.getElementById('study-tab-groups').setAttribute('aria-selected',groups)}
document.getElementById('study-tab-info').onclick=()=>setStudyPanel(false);document.getElementById('study-tab-groups').onclick=()=>setStudyPanel(true);
document.getElementById('study-expand').onclick=()=>{const expanded=document.body.classList.toggle('study-reading-expanded');document.getElementById('study-expand').setAttribute('aria-expanded',expanded);document.getElementById('study-expand').textContent=expanded?'收起阅读':'展开阅读'};
const studyShowInfo=showInfo;
showInfo=function(id){setStudyPanel(false);studyShowInfo(id)};
function frameStudyNode(id){network.focus(id,{scale:innerWidth<=620?.75:1.1,animation:false})}
focusNode=function(id){if(!nodesDS.get(id))return;frameStudyNode(id);network.selectNodes([id]);showInfo(id)};
let studyResizeFrame;
network.on('resize',()=>{cancelAnimationFrame(studyResizeFrame);studyResizeFrame=requestAnimationFrame(()=>{if(selectedStudyNode&&!nodesDS.get(selectedStudyNode)?.hidden)frameStudyNode(selectedStudyNode);else network.fit({animation:false})})});
container.tabIndex=0;container.setAttribute('aria-label','可拖动缩放的知识图谱，可用斜杠键搜索知识点');
document.addEventListener('keydown',event=>{
 if(event.ctrlKey||event.metaKey)return;
 if(event.key==='Escape'){keyboardHelp.hidden=true;document.getElementById('graph-help').setAttribute('aria-expanded','false')}
 if(event.target.closest('input,textarea,select,[contenteditable]'))return;
 let button;
 if(event.key==='/'){event.preventDefault();searchInput.focus();return}
 if(event.altKey&&event.key==='ArrowLeft')button='graph-back';else if(event.altKey&&event.key==='ArrowRight')button='graph-forward';
 else if(event.key==='+'||event.key==='=')button='graph-zoom-in';else if(event.key==='-')button='graph-zoom-out';else if(event.key==='0')button='graph-fit';
 if(button){event.preventDefault();document.getElementById(button).click()}
 if((event.key==='Enter'||event.key===' ')&&event.target.matches('.neighbor-link')){event.preventDefault();event.target.click()}
});
window.addEventListener('message',event=>{
 if(event.source!==parent||!event.data)return;
 if(event.data.type==='study:preferences'&&event.data.preferences){
  const preferences=event.data.preferences;
  if(['light','dark','system'].includes(preferences.theme)){studyTheme=preferences.theme;graphifyApplyTheme(studyTheme)}
  if(typeof preferences.labels==='boolean'){showStudyLabels=preferences.labels;document.getElementById('graph-labels').checked=showStudyLabels}
  refreshStudyLabels();
 }else if(event.data.type==='study:detail')document.querySelectorAll('.neighbor-link').forEach(link=>{link.tabIndex=0;link.setAttribute('role','button')});
});

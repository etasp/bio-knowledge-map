// Course-specific names are injected as escaped JSON by the build script.
const studyChapterNames=__CHAPTER_NAMES__;
const studyEntry=document.createElement('div');studyEntry.id='study-entry';
studyEntry.innerHTML=`<label for="study-chapter">按章节学</label><select id="study-chapter" aria-label="选择学习章节">${studyChapterNames.map((name,index)=>`<option value="${index}">${index?'第'+index+'章 · ':''}${esc(name)}</option>`).join('')}</select><button id="study-guide">怎么用</button>`;
studyProgress.after(studyEntry);
const chapterPicker=document.getElementById('study-chapter');
chapterPicker.onchange=()=>parent.postMessage({type:'graphify:chapter',chapter:Number(chapterPicker.value)},'*');
function beginStudyExample(){
 const node=RAW_NODES.find(n=>learningAllowed.has(n.id)&&studyCatalog.has(n.id));
 if(node){toggleAllCommunities(false);onlyNeighbors=false;document.getElementById('graph-neighbors').setAttribute('aria-pressed','false');applyStudyVisibility();focusNode(node.id)}
}
function showStudyWelcome(){
 setStudyPanel(false);const chapter=Number(chapterPicker.value);
 document.getElementById('info-content').innerHTML=`<section class="study-welcome"><div class="welcome-kicker">学习与复习</div><h2>${chapter?'从第'+chapter+'章开始学':'从一个知识点开始'}</h2><p>选一个知识点看讲解，查资料原文，再记录待复习的内容。</p><button id="study-first-topic">开始学习一个知识点 →</button><h3>怎么用</h3><ol><li>点击圆点或搜索知识点。</li><li>读讲解和易错提醒，先自己回答自测题，再翻答案。</li><li>查原文核对，标记掌握或加入复习。</li></ol><details><summary>图上的线是什么意思？</summary><p>实线表示原文关系，虚线表示整理者添加的学习关联或待核对关系。颜色按当前资料章节分组。</p></details></section>`;
 document.getElementById('study-first-topic').onclick=beginStudyExample;document.getElementById('info-panel').scrollTop=0;
}
document.getElementById('study-guide').onclick=showStudyWelcome;showStudyWelcome();
network.on('click',params=>{if(!params.nodes.length&&hoveredNodeId===null)showStudyWelcome()});
const toolsToggle=document.createElement('button');toolsToggle.id='graph-tools-toggle';toolsToggle.textContent='图谱工具 ▾';toolsToggle.setAttribute('aria-expanded','false');toolsToggle.setAttribute('aria-controls','graph-tools');document.body.append(toolsToggle);graphTools.hidden=true;
toolsToggle.onclick=()=>{graphTools.hidden=!graphTools.hidden;toolsToggle.setAttribute('aria-expanded',!graphTools.hidden);toolsToggle.textContent=graphTools.hidden?'图谱工具 ▾':'收起工具 ▴'};
window.addEventListener('message',event=>{
 if(event.source!==parent||!event.data)return;
 if(event.data.type==='study:filter'){
  if(Number.isInteger(event.data.chapter))chapterPicker.value=String(event.data.chapter);
  if(event.data.reset)showStudyWelcome();
 }else if(event.data.type==='study:start')beginStudyExample();
});

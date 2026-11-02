function sourceSections(source){
 const expression=source.kind==='ppt'?/^## 第 (\d+) 页[^\n]*$/gm:/^\s*(\d{1,2})[．、.]\s*(?!\d)/gm;
 const seen=new Set(),matches=[...source.text.matchAll(expression)].filter(match=>{if(seen.has(match[1]))return false;seen.add(match[1]);return true});
 return matches.map((match,index)=>({number:match[1],label:`第 ${match[1]} ${source.kind==='ppt'?'页':'题'}`,text:source.text.slice(match.index,matches[index+1]?.index??source.text.length).trim()}));
}
function showSource(id,location=''){
 const source=sources.get(id);if(!source)return;
 const sections=sourceSections(source),target=location.match(/第\s*(\d+)/)?.[1];
 $('#detailContent').innerHTML=`<button class="close" aria-label="关闭原文">×</button><div class="eyebrow">原文 / ${source.kind==='ppt'?'课件':'练习'}</div><h2>${esc(source.name)}</h2><p class="muted">${location?'引用：'+esc(location)+' · ':''}图示和复杂公式请对照原文件。</p><div class="source-toolbar"><button id="sourcePrev" aria-label="上一页或上一题">上一${source.kind==='ppt'?'页':'题'}</button><select id="sourceSection" aria-label="选择原文页码或题号"><option value="all">查看全文</option>${sections.map(section=>`<option value="${esc(section.number)}">${esc(section.label)}</option>`).join('')}</select><button id="sourceNext" aria-label="下一页或下一题">下一${source.kind==='ppt'?'页':'题'}</button></div><div class="source-find"><input id="sourceFind" type="search" placeholder="在当前内容中查找…" aria-label="在原文当前内容中查找"><span id="sourceFindCount" class="muted" role="status"></span></div><div class="rawtext" id="rawText" tabindex="0" aria-label="原文内容"></div><p class="muted">来源：${esc(source.original_path)}</p><div class="actions"><a href="${esc(source.original_link)}" download>打开原始${source.kind==='ppt'?'PPT课件':'Word练习'}</a><button id="sourceReturn" class="textbtn">${view==='graph'?'返回图谱':'关闭原文'}</button></div>`;
 const picker=$('#sourceSection');picker.value=sections.some(section=>section.number===target)?target:'all';
 function draw(){
  const index=sections.findIndex(section=>section.number===picker.value),section=sections[index],text=section?.text??source.text;
  $('#sourcePrev').disabled=index<=0;$('#sourceNext').disabled=index<0||index===sections.length-1;
  const query=$('#sourceFind').value,raw=$('#rawText');raw.replaceChildren();let count=0;
  if(query){
   const lower=text.toLowerCase(),key=query.toLowerCase();let offset=0,match;
   while((match=lower.indexOf(key,offset))>=0){raw.append(document.createTextNode(text.slice(offset,match)));const mark=document.createElement('mark');mark.textContent=text.slice(match,match+query.length);raw.append(mark);offset=match+query.length;count++}
   raw.append(document.createTextNode(text.slice(offset)));$('#sourceFindCount').textContent=count?`${count} 处匹配`:'未找到';
  }else if(section){
   const end=text.indexOf('\n'),mark=document.createElement('mark');mark.textContent=end>=0?text.slice(0,end):text;raw.append(mark,document.createTextNode(end>=0?text.slice(end):''));$('#sourceFindCount').textContent=section.label;
  }else{raw.textContent=text;$('#sourceFindCount').textContent='全文'}
  raw.scrollTop=0;
 }
 picker.onchange=draw;$('#sourceFind').oninput=draw;
 $('#sourcePrev').onclick=()=>{picker.value=sections[sections.findIndex(s=>s.number===picker.value)-1].number;draw()};
 $('#sourceNext').onclick=()=>{picker.value=sections[sections.findIndex(s=>s.number===picker.value)+1].number;draw()};
 $('#detailContent .close').onclick=$('#sourceReturn').onclick=()=>$('#detail').close();
 if(!$('#detail').open)$('#detail').showModal();draw();
}

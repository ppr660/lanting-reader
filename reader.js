(() => {
'use strict';
if('scrollRestoration' in history)history.scrollRestoration='manual';
const $=s=>document.querySelector(s),scenes=window.SCENES,dict=window.GLOSSARY,art=window.ART,audio=$('#narration');
const pad=n=>String(n).padStart(2,'0'),format=s=>`${pad(Math.floor((s||0)/60))}:${pad(Math.floor((s||0)%60))}`;
const durations=[13.104,8.04,11.352,14.952,11.136,10.44,13.512,9.96,7.944,9.888,8.064,3.984],totalDuration=durations.reduce((a,b)=>a+b,0);
let saved={};try{saved=JSON.parse(localStorage.getItem('lanting-scroll-v2')||'{}')}catch{}
const prefs={voice:saved.voice??90,qin:saved.qin??20,nature:saved.nature??25,rate:saved.rate||1,font:saved.font||'normal',follow:saved.follow!==false,motion:saved.motion??!matchMedia('(prefers-reduced-motion:reduce)').matches,translated:saved.translated||false};
let reading=0,mediaIndex=-1,playing=false,advanceTimer=null,token=0,scrollPending=false,end=false,navigationUntil=0;
let queriedWords={};try{queriedWords=JSON.parse(localStorage.getItem('lanting-queried-words-v1')||'{}')}catch{}
let vocab={items:[],index:0,score:0,answered:false};
let recite={level:'sentence',index:0,selected:[],checked:false,correct:false,score:0};
let reciteDone={sentence:false,paragraph:false,article:false};
let postReadShown=false;
const sound=window.createLantingSound(prefs),chapters=[];
function save(){try{localStorage.setItem('lanting-scroll-v2',JSON.stringify({...prefs,reading}))}catch{}}
function toast(text){$('#toast').textContent=text;$('#toast').classList.add('visible');clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('#toast').classList.remove('visible'),3000)}
function updatePlay(){document.body.classList.toggle('playing',playing);$('#playButton use').setAttribute('href',playing?'#i-pause':'#i-play');$('#playButton span').textContent=playing?'暂停':'播放';$('#playButton').setAttribute('aria-label',playing?'暂停朗读':'播放朗读');$('#prevButton').disabled=(playing?mediaIndex:reading)===0;$('#nextButton').disabled=(playing?mediaIndex:reading)===11;chapters.forEach((c,i)=>c.classList.toggle('is-reading',playing&&i===mediaIndex));if(!playing){sound.stop();document.querySelectorAll('.speaking').forEach(n=>n.classList.remove('speaking'))}}
function pause(){clearTimeout(advanceTimer);advanceTimer=null;token++;audio.pause();playing=false;updatePlay()}
function scrollToChapter(i){const chapter=chapters[i];if(!chapter)return;reading=i;navigationUntil=performance.now()+850;chapter.scrollIntoView({behavior:prefs.motion?'smooth':'instant',block:'start'});currentLabel();setTimeout(determineReading,900)}
function currentLabel(){const i=playing?mediaIndex:reading;$('#nowReading').textContent=`${pad(i+1)} · ${scenes[i].name}`;$('#readingPosition').textContent=`${pad(reading+1)} / 12`}
async function startAt(i,{scroll=true,resume=false}={}){clearTimeout(advanceTimer);advanceTimer=null;const current=++token;audio.pause();mediaIndex=i;end=false;if(!resume){audio.src=`assets/voice-${pad(i+1)}.mp3`;audio.load()}audio.volume=prefs.voice/100;audio.playbackRate=prefs.rate;if(scroll&&prefs.follow)scrollToChapter(i);reading=i;currentLabel();try{await audio.play();if(current!==token)return;playing=true;updatePlay();sound.start().catch(()=>toast('环境声暂不可用，朗诵继续播放。'))}catch(e){if(current===token){playing=false;updatePlay();toast('配音未能播放，请再次点击播放。')}}}
function togglePlay(){if(playing||advanceTimer){pause();return}const resume=mediaIndex===reading&&!audio.ended&&audio.currentTime>0;startAt(reading,{resume})}
function recordQueried(term){queriedWords[term]=(queriedWords[term]||0)+1;try{localStorage.setItem('lanting-queried-words-v1',JSON.stringify(queriedWords))}catch{}}
function textWithWords(text){const f=document.createDocumentFragment(),terms=Object.keys(dict).sort((a,b)=>b.length-a.length);let pos=0;while(pos<text.length){const term=terms.find(t=>text.startsWith(t,pos));if(term){const b=document.createElement('button');b.className='word'+(['会稽','修禊','修竹','流觞曲水','游目骋怀','悟言','趣舍','陈迹','修短','契','一死生','齐彭殇','斯文'].includes(term)?' emphasis':'');b.textContent=term;b.setAttribute('aria-label',`查词：${term}`);b.onclick=e=>{e.stopPropagation();recordQueried(term);meaning('字里行间',term,dict[term][1],dict[term][0])};f.append(b);pos+=term.length}else{f.append(document.createTextNode(text[pos++]));}}return f}
function openDialog(id){pause();$(id).showModal()}
function meaning(label,title,body,pinyin=''){pause();$('#meaningLabel').textContent=label;$('#meaningTitle').textContent=title;$('#meaningBody').textContent=body;$('#pinyin').textContent=pinyin;$('#pinyin').hidden=!pinyin;$('#meaningDialog').showModal()}
function learningClose(id){const dialog=$(id);if(dialog?.open)dialog.close()}
function queriedList(){return Object.keys(queriedWords).filter(term=>dict[term])}
function shuffle(list){return [...list].sort(()=>Math.random()-.5)}
function renderPostRead(){const terms=queriedList();$('#postReadQueried').innerHTML=terms.length?`本次阅读你查过 <strong>${terms.length}</strong> 个词，适合先做一轮巩固。`:'这次还没有查过词。也可以直接进入背诵，之后再回到正文查词。';$('#reviewWordsButton').disabled=!terms.length}
function showPostRead(){postReadShown=true;$('#learningBar').hidden=false;if($('#postReadDialog').open)return;pause();renderPostRead();$('#postReadDialog').showModal()}
function vocabBuild(){const terms=queriedList();vocab.items=shuffle(terms);vocab.index=0;vocab.score=0;vocab.answered=false;renderVocab()}
function renderVocab(){const total=vocab.items.length;if(!total){$('#vocabStage').innerHTML='<div class="empty-learning">还没有查过的词。回到正文，点击词语查看含义后，再来做巩固练习。</div>';$('#vocabProgress').textContent='暂无题目';$('#vocabScore').textContent='';$('#vocabNext').hidden=true;return}const term=vocab.items[vocab.index],answer=dict[term][1],pool=Object.keys(dict).filter(k=>k!==term&&dict[k]?.[1]!==answer);const choices=shuffle([answer,...shuffle(pool).slice(0,2)]);$('#vocabProgress').textContent=`第 ${vocab.index+1} / ${total} 题`;$('#vocabScore').textContent=`${vocab.score} 分`;$('#vocabNext').hidden=!vocab.answered;$('#vocabStage').innerHTML=`<div class="vocab-kicker">查词回看</div><h3>${term}</h3><p class="vocab-pinyin">${dict[term][0]}</p><p class="vocab-prompt">下面哪一项最符合“${term}”在文中的意思？</p><div class="vocab-options">${choices.map((choice,i)=>`<button class="vocab-option" data-choice="${encodeURIComponent(choice)}">${String.fromCharCode(65+i)}　${choice}</button>`).join('')}</div>`;$('#vocabFeedback').textContent='';document.querySelectorAll('.vocab-option').forEach(button=>button.onclick=()=>{if(vocab.answered)return;vocab.answered=true;const correct=decodeURIComponent(button.dataset.choice)===answer;document.querySelectorAll('.vocab-option').forEach(option=>{if(decodeURIComponent(option.dataset.choice)===answer)option.classList.add('is-correct')});if(correct){vocab.score+=10;button.classList.add('is-correct');$('#vocabFeedback').textContent='答对了。把这个词放回原句，再读一遍。'}else{button.classList.add('is-wrong');$('#vocabFeedback').textContent=`再看一眼：${term} 在文中的意思是“${answer}”。`}$('#vocabScore').textContent=`${vocab.score} 分`;$('#vocabNext').hidden=false})}
function reciteText(level,index){if(level==='sentence'){const flat=[];scenes.forEach((s,si)=>s.lines.forEach((line,li)=>flat.push({si,li,line})));return flat[index]}if(level==='paragraph')return scenes[index];return {name:'全文',lines:scenes.flatMap(s=>s.lines),scenes}}

function reciteChunks(text,level){if(level==='sentence'){if(CLASSICAL_CHUNKS[text])return CLASSICAL_CHUNKS[text];const out=[];text.match(/[^，。；、！？]+[，。；、！？]?/g)?.forEach(part=>out.push(part));return out.filter(Boolean)}if(level==='paragraph')return text.lines.map(line=>line[0]);return scenes.map(s=>s.lines.map(line=>line[0]).join(''))}
function reciteExpected(level,index){if(level==='sentence')return reciteText(level,index).line[0];if(level==='paragraph')return scenes[index].lines.map(line=>line[0]).join('');return scenes.flatMap(s=>s.lines.map(line=>line[0])).join('')}
function recitePrompt(level,index){if(level==='sentence'){const item=reciteText(level,index);return {title:scenes[item.si].name,meaning:item.line[1]}}if(level==='paragraph'){const s=scenes[index];return {title:s.name,meaning:s.lines.map(line=>line[1]).join(' ')}}return {title:'兰亭集序',meaning:'请按文章的叙事顺序，把十二段从暮春雅集、人生兴怀一直排到“后之览者”。'}}
function renderRecite(){const total=recite.level==='sentence'?scenes.reduce((n,s)=>n+s.lines.length,0):scenes.length;const idx=Math.min(recite.index,total-1),prompt=recitePrompt(recite.level,idx),expected=reciteExpected(recite.level,idx),chunks=reciteChunks(recite.level==='sentence'?expected:reciteText(recite.level,idx),recite.level);if(recite.level==='sentence')$('#reciteProgress').textContent=`第 ${idx+1} / ${total} 句`;else if(recite.level==='paragraph')$('#reciteProgress').textContent=`第 ${idx+1} / ${total} 段`;else $('#reciteProgress').textContent='整篇文章';document.querySelectorAll('.recite-level').forEach(tab=>{const active=tab.dataset.reciteLevel===recite.level,level=tab.dataset.reciteLevel;tab.classList.toggle('is-active',active);tab.disabled=level==='paragraph'&&!reciteDone.sentence||level==='article'&&!reciteDone.paragraph;tab.setAttribute('aria-selected',String(active))});$('#skipToParagraph').hidden=recite.level!=='sentence'||reciteDone.sentence;$('#skipToArticle').hidden=recite.level!=='paragraph'||reciteDone.paragraph;const selected=recite.selected.map(i=>chunks[i]);const remaining=chunks.map((chunk,i)=>({chunk,i})).filter(item=>!recite.selected.includes(item.i));$('#reciteStage').innerHTML=`<p class="recite-meaning">${prompt.meaning}</p><div class="assembled-line">${selected.length?selected.map((chunk,i)=>`<button class="assembled-chunk" data-remove="${recite.selected[i]}">${chunk}</button>`).join(''):'点击下面的词组，开始拼句'}</div><div class="chunk-bank">${remaining.map(item=>`<button class="chunk" data-chunk="${item.i}">${item.chunk}</button>`).join('')}</div>`;document.querySelectorAll('.chunk').forEach(button=>button.onclick=()=>{recite.selected.push(Number(button.dataset.chunk));recite.checked=false;recite.correct=false;renderRecite()});document.querySelectorAll('.assembled-chunk').forEach(button=>button.onclick=()=>{recite.selected=recite.selected.filter(i=>i!==Number(button.dataset.remove));recite.checked=false;recite.correct=false;renderRecite()});$('#reciteFeedback').textContent=recite.correct?'拼对了，可以继续下一题。':'先按语意顺序点击词组。';$('#reciteNext').textContent=recite.correct?(recite.level==='sentence'?'拼下一句':recite.level==='paragraph'?'拼下一段':'继续拼接'):'检查答案'}
function checkRecite(){const idx=recite.index,expected=reciteExpected(recite.level,idx),source=recite.level==='sentence'?reciteText('sentence',idx):reciteText(recite.level,idx),chunks=reciteChunks(recite.level==='sentence'?expected:source,recite.level),answer=recite.selected.map(i=>chunks[i]).join('');recite.checked=true;recite.correct=answer===expected;if(recite.correct){recite.score+=1;$('#reciteFeedback').textContent=recite.level==='sentence'?'拼对了，可以继续下一句。':'拼对了，可以继续下一题。';$('#reciteNext').textContent=recite.level==='sentence'?'拼下一句':recite.level==='paragraph'?'拼下一段':'继续拼接'}else{$('#reciteFeedback').textContent=`还差一点。当前顺序：${answer||'（尚未选择）'}；再调整词组顺序。`;$('#reciteNext').textContent='检查答案'}}
function translationState(i,open){const block=chapters[i].querySelector('.translation-block'),button=chapters[i].querySelector('.inline-translation');block.hidden=!open;button.setAttribute('aria-expanded',String(open));button.title=open?'收起译文':'查看本段译文'}
const CLASSICAL_CHUNKS={
 '永和九年，岁在癸丑，暮春之初，':['永和九年，','岁在癸丑，','暮春之初，'],
 '会于会稽山阴之兰亭，修禊事也。':['会于','会稽山阴之兰亭，','修禊事也。'],
 '群贤毕至，少长咸集。':['群贤毕至，','少长咸集。'],
 '此地有崇山峻岭，茂林修竹；':['此地有','崇山峻岭，','茂林修竹；'],
 '又有清流激湍，映带左右，':['又有','清流激湍，','映带左右，'],
 '引以为流觞曲水，列坐其次。':['引以为','流觞曲水，','列坐其次。'],
 '虽无丝竹管弦之盛，':['虽无','丝竹管弦之盛，'],
 '一觞一咏，亦足以畅叙幽情。':['一觞一咏，','亦足以畅叙幽情。'],
 '是日也，天朗气清，惠风和畅。':['是日也，','天朗气清，','惠风和畅。'],
 '仰观宇宙之大，俯察品类之盛，':['仰观宇宙之大，','俯察品类之盛，'],
 '所以游目骋怀，足以极视听之娱，信可乐也。':['所以游目骋怀，','足以极视听之娱，','信可乐也。'],
 '夫人之相与，俯仰一世，':['夫人之相与，','俯仰一世，'],
 '或取诸怀抱，悟言一室之内；':['或取诸怀抱，','悟言一室之内；'],
 '或因寄所托，放浪形骸之外。':['或因寄所托，','放浪形骸之外。'],
 '虽趣舍万殊，静躁不同，':['虽趣舍万殊，','静躁不同，'],
 '当其欣于所遇，暂得于己，快然自足，':['当其欣于所遇，','暂得于己，','快然自足，'],
 '不知老之将至。':['不知老之将至。'],
 '及其所之既倦，情随事迁，感慨系之矣。':['及其所之既倦，','情随事迁，','感慨系之矣。'],
 '向之所欣，俯仰之间，已为陈迹，':['向之所欣，','俯仰之间，','已为陈迹，'],
 '犹不能不以之兴怀。':['犹不能不以之兴怀。'],
 '况修短随化，终期于尽！':['况修短随化，','终期于尽！'],
 '古人云：“死生亦大矣。”':['古人云：','“死生亦大矣。”'],
 '岂不痛哉！':['岂不痛哉！'],
 '每览昔人兴感之由，若合一契，':['每览昔人兴感之由，','若合一契，'],
 '未尝不临文嗟悼，不能喻之于怀。':['未尝不临文嗟悼，','不能喻之于怀。'],
 '固知一死生为虚诞，齐彭殇为妄作。':['固知','一死生为虚诞，','齐彭殇为妄作。'],
 '后之视今，亦犹今之视昔，悲夫！':['后之视今，','亦犹今之视昔，','悲夫！'],
 '故列叙时人，录其所述，':['故列叙时人，','录其所述，'],
 '虽世殊事异，所以兴怀，其致一也。':['虽世殊事异，','所以兴怀，','其致一也。'],
'后之览者，亦将有感于斯文。':['后之览者，','亦将有感于斯文。']
};
const READING_BREAKS={
 '夫人之相与，俯仰一世，':['夫','人之相与，','俯仰一世，'],
 '或取诸怀抱，悟言一室之内；':['或','取诸怀抱，','悟言','一室之内；'],
 '或因寄所托，放浪形骸之外。':['或','因寄所托，','放浪形骸之外。']
};
function textWithStructure(text){const parts=READING_BREAKS[text]||CLASSICAL_CHUNKS[text]||text.match(/[^，。；、！？]+[，。；、！？]?/g)||[text],f=document.createDocumentFragment();parts.forEach((part,i)=>{const unit=document.createElement('span');unit.className='break-unit';unit.append(textWithWords(part));f.append(unit);if(i<parts.length-1){const mark=document.createElement('span');mark.className='pause-mark';mark.textContent=' / ';mark.setAttribute('aria-hidden','true');f.append(mark)}});return f}
scenes.forEach((s,i)=>{
 const chapter=document.createElement('section');chapter.id=`passage-${i+1}`;chapter.className='chapter';chapter.setAttribute('aria-label',`第${i+1}段：${s.name}`);
 // The image-to-text seam stays quiet: chapter identity is carried by the fixed progress and TOC.
 const paragraph=document.createElement('p');paragraph.className='passage';s.lines.forEach((line,j)=>{const sentence=document.createElement('span');sentence.className='sentence';sentence.dataset.line=j;sentence.append(textWithStructure(line[0]));sentence.title='点击查看句译';sentence.onclick=()=>meaning('一句一意',line[0],line[1]);paragraph.append(sentence)});
 const actions=document.createElement('span');actions.className='inline-actions';const tr=document.createElement('button');tr.className='inline-translation';tr.textContent='译';tr.setAttribute('aria-label',`第${i+1}段译文`);tr.setAttribute('aria-expanded',String(prefs.translated));tr.onclick=()=>{pause();translationState(i,chapter.querySelector('.translation-block').hidden)};const insight=document.createElement('button');insight.className='inline-insight';insight.textContent='赏析';insight.setAttribute('aria-label',`第${i+1}段赏析`);insight.onclick=()=>meaning('读懂此刻',s.name,s.note);const structure=document.createElement('button');structure.className='inline-structure';structure.textContent='⟋';structure.setAttribute('aria-label','显示句子结构');structure.setAttribute('aria-pressed','false');structure.title='显示朗读停顿';structure.onclick=e=>{e.stopPropagation();const shown=chapter.classList.toggle('show-breaks');structure.setAttribute('aria-pressed',String(shown));structure.title=shown?'隐藏朗读停顿':'显示朗读停顿'};actions.append(tr,insight,structure);paragraph.append(actions);chapter.append(paragraph);
 const translation=document.createElement('div');translation.className='translation-block';translation.hidden=!prefs.translated;s.lines.forEach(l=>{const p=document.createElement('p');p.textContent=l[1];translation.append(p)});chapter.append(translation);
 const a=art[i],figure=document.createElement('figure');const frame=document.createElement('div');frame.className='art-frame';frame.style.setProperty('--ratio',a.width/a.height);frame.dataset.scene=i+1;frame.dataset.image=`assets/scene-${pad(i+1)}.jpg`;frame.dataset.mask=`assets/motion-${pad(i+1)}.png`;
 const im=document.createElement('img');im.className='art-still';im.src=frame.dataset.image;im.alt=`${s.name}：去字后的兰亭山水插画`;im.loading=i<2?'eager':'lazy';im.width=a.width;im.height=a.height;
 const canvas=document.createElement('canvas');canvas.className='motion-canvas';canvas.setAttribute('aria-hidden','true');frame.append(im,canvas);
 if(a.hasArm){const arm=document.createElement('img');arm.className='arm-layer';arm.src='assets/arm-03.png';arm.alt='';arm.setAttribute('aria-hidden','true');arm.style.setProperty('--pivot',a.pivot.map(n=>`${n*100}%`).join(' '));frame.append(arm)}
 const full=document.createElement('button');full.className='art-open';full.setAttribute('aria-label',`查看第${i+1}幅完整原画`);full.innerHTML='<svg><use href="#i-expand"/></svg>';full.onclick=()=>{$('#fullImage').src=`assets/full-${pad(i+1)}.jpg`;$('#fullImageCaption').textContent=s.name+' · 完整原画';openDialog('#imageDialog')};frame.append(full);figure.append(frame);
 chapter.append(figure);$('#chapters').append(chapter);chapters.push(chapter);window.PaintingMotion.observe(frame);
 const toc=document.createElement('button');toc.className='toc-item';toc.setAttribute('aria-label',`前往第${i+1}段：${s.name}`);toc.innerHTML=`<span>${pad(i+1)}</span><img src="assets/scene-${pad(i+1)}.jpg" alt="" loading="lazy"><span><strong>${s.name}</strong><small>${s.chapter}</small></span>`;toc.onclick=()=>{$('#tocDialog').close();pause();reading=i;requestAnimationFrame(()=>scrollToChapter(i));currentLabel();save()};$('#tocList').append(toc);
});
function determineReading(){scrollPending=false;if(performance.now()<navigationUntil)return;const guide=innerHeight*.30;const atEnd=window.scrollY+innerHeight>=document.documentElement.scrollHeight-120;let candidate=0;for(let i=0;i<chapters.length;i++){if(chapters[i].getBoundingClientRect().top<guide)candidate=i}if(atEnd)candidate=chapters.length-1;if(candidate!==reading){reading=candidate;currentLabel();if(!playing)updatePlay();save()}if(!playing&&mediaIndex<0)$('#overallFill').style.width=(reading/12)*100+'%';if(atEnd)showPostRead()}
window.addEventListener('scroll',()=>{if(!scrollPending){scrollPending=true;requestAnimationFrame(determineReading)}},{passive:true});
$('#playButton').onclick=togglePlay;
function navigate(delta){const from=playing?mediaIndex:reading,i=Math.max(0,Math.min(11,from+delta));if(playing)startAt(i);else{pause();mediaIndex=-1;reading=i;scrollToChapter(i);currentLabel();updatePlay();$('#audioTime').textContent='从这一段，开始聆听';save()}}
$('#prevButton').onclick=()=>navigate(-1);$('#nextButton').onclick=()=>navigate(1);
$('#translateAll').setAttribute('aria-pressed',String(prefs.translated));$('#translateAll').onclick=()=>{pause();const anchor=chapters[reading],before=anchor.getBoundingClientRect().top;prefs.translated=!prefs.translated;chapters.forEach((c,i)=>translationState(i,prefs.translated));$('#translateAll').setAttribute('aria-pressed',String(prefs.translated));const delta=anchor.getBoundingClientRect().top-before;if(Math.abs(delta)>1)window.scrollBy({top:delta,behavior:'instant'});save()};
$('#tocButton').onclick=()=>{document.querySelectorAll('.toc-item').forEach((b,i)=>b.classList.toggle('current',i===reading));openDialog('#tocDialog')};$('#settingsButton').onclick=()=>openDialog('#settingsDialog');$('#soundButton').onclick=()=>openDialog('#soundDialog');
const speeds=[.85,1,1.15];$('#speedButton').textContent=prefs.rate.toFixed(2).replace(/0$/,'')+'×';$('#speedButton').onclick=()=>{prefs.rate=speeds[(speeds.indexOf(prefs.rate)+1)%speeds.length];audio.playbackRate=prefs.rate;$('#speedButton').textContent=prefs.rate.toFixed(2).replace(/0$/,'')+'×';save();toast(`朗读速度 ${prefs.rate}×`)};
for(const [id,key]of [['voiceVolume','voice'],['qinVolume','qin'],['natureVolume','nature']]){const control=$('#'+id);control.value=prefs[key];control.oninput=()=>{prefs[key]=+control.value;audio.volume=prefs.voice/100;sound.update();save()}}
$('#fontSelect').value=prefs.font;document.body.classList.toggle('large-text',prefs.font==='large');$('#fontSelect').onchange=e=>{prefs.font=e.target.value;document.body.classList.toggle('large-text',prefs.font==='large');save()};$('#followToggle').checked=prefs.follow;$('#followToggle').onchange=e=>{prefs.follow=e.target.checked;save()};$('#motionToggle').checked=prefs.motion;window.PaintingMotion.setEnabled(prefs.motion);$('#motionToggle').onchange=e=>{prefs.motion=e.target.checked;window.PaintingMotion.setEnabled(prefs.motion);save()};
$('#reviewWordsButton').onclick=()=>{learningClose('#postReadDialog');vocabBuild();openDialog('#vocabDialog')};
$('#startReciteButton').onclick=()=>{learningClose('#postReadDialog');recite={level:'sentence',index:0,selected:[],checked:false,correct:false,score:0};reciteDone={sentence:false,paragraph:false,article:false};renderRecite();openDialog('#reciteDialog')};
$('#continueLearning').onclick=()=>{renderPostRead();openDialog('#postReadDialog')};
$('#vocabNext').onclick=()=>{if(vocab.index<vocab.items.length-1){vocab.index++;vocab.answered=false;renderVocab()}else{$('#vocabFeedback').textContent='这一轮生词巩固完成了。可以进入背诵练习。';$('#vocabNext').hidden=true}};
document.querySelectorAll('.recite-level').forEach(tab=>tab.onclick=()=>{if(tab.disabled)return;const level=tab.dataset.reciteLevel;recite={level,index:0,selected:[],checked:false,correct:false,score:0};renderRecite()});
$('#skipToParagraph').onclick=()=>{reciteDone.sentence=true;recite={level:'paragraph',index:0,selected:[],checked:false,correct:false,score:0};renderRecite()};$('#skipToArticle').onclick=()=>{reciteDone.sentence=true;reciteDone.paragraph=true;recite={level:'article',index:0,selected:[],checked:false,correct:false,score:0};renderRecite()};
$('#reciteReset').onclick=()=>{recite.selected=[];recite.checked=false;recite.correct=false;renderRecite()};$('#reciteNext').onclick=()=>{if(!recite.checked){checkRecite();return}if(!recite.correct){$('#reciteFeedback').textContent='先把当前题拼对，再进入下一题。';return}const total=recite.level==='sentence'?scenes.reduce((n,s)=>n+s.lines.length,0):scenes.length;if(recite.index<total-1){recite.index++;recite.selected=[];recite.checked=false;recite.correct=false;renderRecite()}else{reciteDone[recite.level]=true;recite.selected=[];recite.checked=false;recite.correct=false;renderRecite();$('#reciteFeedback').textContent=recite.level==='sentence'?'句子层完成，下一步已解锁“背段落”。':recite.level==='paragraph'?'段落层完成，下一步已解锁“背全文”。':'整篇文章完成，建议明天再来复习一遍。'}};
// The closing colophon was intentionally removed from the reading flow; keep the
// page self-contained after the final illustration rather than binding removed UI.
for(const dialog of document.querySelectorAll('dialog')){dialog.querySelector('.dismiss').onclick=()=>dialog.close();dialog.addEventListener('click',e=>{if(e.target!==dialog)return;const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close()})}
audio.onplay=()=>{playing=true;updatePlay();currentLabel()};audio.onpause=()=>{if(!audio.ended){playing=false;updatePlay()}};
audio.onloadedmetadata=()=>{if(mediaIndex>=0)$('#audioTime').textContent=`${format(audio.currentTime)} / ${format(audio.duration)} · 云希`};
audio.ontimeupdate=()=>{if(mediaIndex<0)return;$('#audioTime').textContent=`${format(audio.currentTime)} / ${format(audio.duration)} · 云希`;const elapsed=durations.slice(0,mediaIndex).reduce((a,b)=>a+b,0)+audio.currentTime;$('#overallFill').style.width=Math.min(100,elapsed/totalDuration*100)+'%';const lines=scenes[mediaIndex].lines,total=lines.reduce((n,l)=>n+l[0].length,0),ratio=audio.currentTime/(audio.duration||durations[mediaIndex]);let acc=0,active=lines.length-1;for(let j=0;j<lines.length;j++){acc+=lines[j][0].length;if(ratio*total<=acc){active=j;break}}document.querySelectorAll('.speaking').forEach(n=>n.classList.remove('speaking'));if(playing)chapters[mediaIndex].querySelectorAll('.sentence')[active]?.classList.add('speaking')};
audio.onended=()=>{playing=false;updatePlay();if(mediaIndex<11){$('#audioTime').textContent='稍作停留，接着读下一段';advanceTimer=setTimeout(()=>startAt(mediaIndex+1),1600)}else{end=true;$('#overallFill').style.width='100%';$('#audioTime').textContent='一卷读罢，余韵未尽';toast('后之览者，亦将有感于斯文。');setTimeout(showPostRead,500)}};
audio.onerror=()=>{if(mediaIndex>=0){pause();toast('音频暂时无法加载，请重试。')}};
document.addEventListener('keydown',e=>{if(document.querySelector('dialog[open]'))return;const tag=document.activeElement?.tagName;if(['INPUT','SELECT','TEXTAREA'].includes(tag))return;if(e.code==='Space'&&!['BUTTON','A'].includes(tag)){e.preventDefault();togglePlay()}if(e.key==='ArrowRight'){e.preventDefault();navigate(1)}if(e.key==='ArrowLeft'){e.preventDefault();navigate(-1)}});
document.addEventListener('visibilitychange',()=>{if(document.hidden)pause()});window.addEventListener('pagehide',pause);
updatePlay();if(location.hash.startsWith('#passage-'))requestAnimationFrame(determineReading);else if(saved.reading>0&&saved.reading<12){const target=saved.reading;reading=target;requestAnimationFrame(()=>{chapters[target].scrollIntoView({behavior:'instant',block:'start'});currentLabel();toast('接着上次读到的地方')})}
})();

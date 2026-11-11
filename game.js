/*
  돌이킬 수 있을지도 모를 걸음 · STAGE 01–03
  HTML5 Canvas / dependency-free / GitHub Pages ready
  Source of dialogue and puzzles: "게임제작 1.txt", "게임제작 2.txt"
*/
(() => {
'use strict';
const $ = (id) => document.getElementById(id);
const canvas = $('gameCanvas');
const ctx = canvas.getContext('2d');
const fadeCover = $('fadeCover');
const bgm = $('bgm');
const stairSound = $('stairSound');
const MAP_PATHS = {classroom:'assets/maps/classroom.webp',hallway:'assets/maps/hallway.webp',stairs:'assets/maps/stairs.webp',artroom:'assets/maps/artroom.webp'};
const CHAR_PATH = 'assets/characters/mugyeol.png';
const TAEHA_PATH = 'assets/characters/taeha.png';
const ITEMS = {
  paper:{name:'꼬깃꼬깃하게 접힌 종이',image:'paper.webp',desc:'정성 어린 손길로 그린 초상화.'},
  cigarettes:{name:'담배',image:'cigarettes.webp',desc:'기태하의 책상 서랍에서 발견한 멘솔 담배.'},
  keyring:{name:'알 수 없는 열쇠 꾸러미',image:'keyring.webp',desc:'명예희 사물함에서 발견한 열쇠들.'},
  knife:{name:'나이프',image:'knife.webp',desc:'피가 말라붙어 있는 나이프.'},
  bottle:{name:'빈 물병',image:'bottle.webp',desc:'복도 분리수거함에서 주운 빈 물병.'}
};
const ROSTER = [
  '강무결','강윤혜','계주현','공주야','금하제','기태하',
  '남시현','노마진','명그린','명예희','문세라','문유찬',
  '민효재','배하린','백우진','부영하','서영현','서은결',
  '서지영','서찬미','송찬영','온우주','이동식','이청우',
  '이하늘','임미희','임은재','장민재','주시호','주연호',
  '주인나','주인하','진나비','한도윤','한세윤','현제원'
];
const MAP_INFO = {
  classroom:{label:'3학년 4반 · 교실',stage:'STAGE 01',w:1536,h:1024,
    bound:{left:138,right:1390,top:235,bottom:750},
    blocks:[
      {x:235,y:270,w:310,h:18},{x:675,y:275,w:164,h:25},
      ...[382,539,689,850,1003,1161].flatMap(x=>[326,396,469,581,653].map(y=>({x:x-50,y:y-34,w:100,h:73}))),
      {x:351,y:768,w:845,h:220},{x:1375,y:470,w:80,h:150},
      {x:1420,y:0,w:100,h:1000}
    ]},
  hallway:{label:'3층 복도',stage:'STAGE 02',w:1672,h:941,
    bound:{left:98,right:1571,top:485,bottom:866},
    blocks:[{x:948,y:418,w:220,h:65},{x:135,y:710,w:562,h:120},{x:894,y:710,w:635,h:130}]},
  stairs:{label:'계단',stage:'STAGE 02',w:1536,h:1024,
    bound:{left:115,right:1370,top:318,bottom:978},
    blocks:[{x:120,y:0,w:680,h:675},{x:0,y:0,w:115,h:1024},{x:1380,y:0,w:156,h:1024}]},
  artroom:{label:'미술실 · 연옥에서',stage:'STAGE 03',w:1536,h:1024,
    bound:{left:129,right:1393,top:335,bottom:937},
    blocks:[{x:455,y:265,w:520,h:105},{x:1270,y:144,w:180,h:210},
      {x:0,y:395,w:140,h:290},
      // Tight collision around the *solid* upper parts of the easels, not
      // their entire painted silhouettes. Otherwise the middle lane was
      // disconnected and the player could not reach Taeha at the window.
      {x:423,y:379,w:79,h:133},{x:692,y:380,w:94,h:133},{x:996,y:383,w:83,h:133},
      {x:546,y:560,w:74,h:139},{x:902,y:558,w:76,h:139},
      {x:272,y:753,w:215,h:122},{x:1060,y:751,w:232,h:128}]
  }
};
const lockAssets = {
  basic:'assets/items/lock-default.webp',
  sam:'assets/items/lock-sam-sa.webp',
  all:'assets/items/lock-all.webp',
  complete:'assets/items/lock-complete.webp'
};
const images={};
const sprite=new Image(); sprite.src=CHAR_PATH;
// This is the 528×944 transparent sprite sheet extracted from the user's
// original image, with 3 complete 176×236 cells in each of 4 direction rows.
const taehaSprite=new Image();taehaSprite.src=TAEHA_PATH;
const SPRITE_TILE={w:176,h:236};
const BOARD_POINT={x:1233,y:269};
const TAEHA_WINDOW={x:595,y:408};
let viewport={w:1536,h:864};
let pickupTimer=0;
for(const [id,path] of Object.entries(MAP_PATHS)){ const img=new Image();img.src=path;images[id]=img; }
const darkLayer=document.createElement('canvas'); const dc=darkLayer.getContext('2d');
let prevTime=0, toastTimer=0, switchTimer=0;
const pressed=new Set();
const S = {
  started:false,map:'classroom',px:1264,py:710,face:0,frame:1,walking:false,walkClock:0,
  explored:false,stage1Clear:false,stage2Clear:false,visitedCats:new Set(),visitedDesks:new Set(),visitedLockers:new Set(),
  flags:{im:false,green:false,bulletin:false,trash:false,hallPhoto:false},inventory:new Set(),
  dlg:null,autoPath:[],afterWalk:null,pendingTarget:null,transitioning:false,muted:false,debug:false,
  artroomUnlocked:false,artroomIntroSeen:false,taehaMet:false,following:false,
  endingStarted:false,failureDark:false,artroomRevealAt:0,
  taeha:{x:TAEHA_WINDOW.x,y:TAEHA_WINDOW.y,face:0,walking:false,walkClock:0},followTrail:[],
  activeTooltip:null,mobileKeys:new Set()
};
const isOverlayOpen=()=>['inventoryOverlay','lockerOverlay','lockOverlay','endingOverlay','rosterOverlay'].some(id=>!$(id).classList.contains('hidden'));
const safeText=(str)=>String(str);
const itemSrc=(id)=>'assets/items/'+ITEMS[id].image;
function toast(text,ms=2400){ const el=$('toast');el.textContent=text;el.classList.remove('hidden');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.add('hidden'),ms); }
function updateHeader(){ const m=MAP_INFO[S.map];$('stageCaption').textContent=m.stage;$('sceneName').textContent=m.label;$('statusLine').textContent='강무결 · '+m.label;$('itemCount').textContent=S.inventory.size; }
function configureCanvas(){
  // Desktop is 16:9; portrait phones get a taller, zoomed-in camera.
  const portrait=window.matchMedia('(max-width: 760px) and (orientation: portrait)').matches;
  viewport=portrait?{w:720,h:960}:{w:1536,h:864};
  if(canvas.width!==viewport.w)canvas.width=viewport.w;
  if(canvas.height!==viewport.h)canvas.height=viewport.h;
  canvas.style.aspectRatio=`${viewport.w}/${viewport.h}`;
}
function camera(){
  const map=MAP_INFO[S.map],ratio=viewport.w/viewport.h;
  let w=Math.min(viewport.w,map.w),h=w/ratio;
  if(h>map.h){h=map.h;w=h*ratio;}
  const clamp=(v,low,high)=>Math.min(high,Math.max(low,v));
  return {
    x:clamp(S.px-w*.5,0,map.w-w),
    y:clamp(S.py-h*.55,0,map.h-h),w,h
  };
}
function pointerToWorld(e){
  const r=canvas.getBoundingClientRect(),cam=camera();
  return {x:cam.x+(e.clientX-r.left)/r.width*cam.w,y:cam.y+(e.clientY-r.top)/r.height*cam.h};
}
function resetState(){
  S.map='classroom'; S.px=1264;S.py=710;S.face=0;S.frame=1;S.walkClock=0;S.walking=false;
  S.explored=false;S.stage1Clear=false;S.stage2Clear=false;S.visitedCats=new Set();S.visitedDesks=new Set();S.visitedLockers=new Set();
  S.flags={im:false,green:false,bulletin:false,trash:false,hallPhoto:false};S.inventory=new Set();
  S.dlg=null;S.autoPath=[];S.afterWalk=null;S.pendingTarget=null;S.transitioning=false;
  S.artroomUnlocked=false;S.artroomIntroSeen=false;S.taehaMet=false;S.following=false;
  S.endingStarted=false;S.failureDark=false;S.artroomRevealAt=0;
  S.taeha={x:TAEHA_WINDOW.x,y:TAEHA_WINDOW.y,face:0,walking:false,walkClock:0};S.followTrail=[];
  pressed.clear();S.mobileKeys.clear(); hideAllOverlays(); closeDialog();hidePickup();configureCanvas();updateHeader();
}
function hideAllOverlays(){ for(const id of ['inventoryOverlay','lockerOverlay','lockOverlay','endingOverlay','rosterOverlay']) $(id).classList.add('hidden'); }
function showDialogBox(){ $('dialogueBox').classList.remove('hidden'); }
function closeDialog(){S.dlg=null;$('rosterPeek').classList.add('hidden');$('dialogueBox').classList.add('hidden');$('choiceArea').classList.add('hidden');$('choiceArea').replaceChildren();}
function dismissMoveMenu(){if(S.dlg?.kind==='choices'&&S.dlg.movable){closeDialog();return true;}return false;}
function pages(list,after=()=>{},opts={}){
  const sequence=(Array.isArray(list)?list:[list]).filter(t=>t!==undefined&&t!==null).map(x=>
    typeof x==='object'?{text:safeText(x.text??''),image:x.image||null}: {text:safeText(x),image:null});
  if(!sequence.length){after();return;}
  S.autoPath=[];S.afterWalk=null;
  S.dlg={kind:'pages',list:sequence,idx:0,after,speaker:opts.speaker??'강무결',photo:!!opts.photo};
  renderDialogue();
}
function choices(prompt,entries,opts={}){
  S.autoPath=[];S.afterWalk=null;
  S.dlg={kind:'choices',prompt:safeText(prompt),entries,speaker:opts.speaker??'강무결',movable:!!opts.movable};
  renderDialogue();
}
function renderDialogue(){
  if(!S.dlg){closeDialog();return;}
  const d=S.dlg;showDialogBox();$('speaker').textContent=d.speaker;$('rosterPeek').classList.toggle('hidden',!d.photo);
  const ch=$('choiceArea');ch.replaceChildren();
  const illustration=$('dialogueIllustration');
  if(d.kind==='pages'){
    const page=d.list[d.idx];
    $('dialogueBody').textContent=page.text;$('dialogueCounter').textContent=`${d.idx+1} / ${d.list.length}`;
    if(page.image){illustration.src=page.image;illustration.classList.remove('hidden');}
    else {illustration.classList.add('hidden');illustration.removeAttribute('src');}
    ch.classList.add('hidden');$('nextButton').classList.remove('hidden');
  } else {
    $('dialogueBody').textContent=d.prompt;$('dialogueCounter').textContent='선택';
    illustration.classList.add('hidden');illustration.removeAttribute('src');
    ch.classList.remove('hidden');$('nextButton').classList.add('hidden');
    d.entries.forEach((entry,i)=>{
      const b=document.createElement('button');b.type='button';b.className='choice-button';b.textContent=`${i+1}. ${entry.text}`;
      b.addEventListener('click',()=>{if(S.dlg!==d)return;closeDialog();entry.action();});ch.appendChild(b);
    });
  }
}
function nextDialogue(){
  const d=S.dlg;if(!d||d.kind!=='pages')return;
  if(d.idx<d.list.length-1){d.idx++;renderDialogue();return;}
  const fn=d.after;closeDialog();fn();
}
function skipDialogue(){
  const d=S.dlg;if(!d)return;
  if(d.kind==='choices'){toast('선택지는 직접 골라야 합니다.');return;}
  const fn=d.after;closeDialog();fn();
}
function hidePickup(){clearTimeout(pickupTimer);$('itemPickup').classList.add('hidden');}
function showPickup(id){
  const item=ITEMS[id],el=$('itemPickup');
  clearTimeout(pickupTimer);
  $('pickupImage').src=itemSrc(id);$('pickupImage').alt=item.name;
  $('pickupName').textContent=item.name;
  el.classList.remove('hidden');
  // Replay entrance animation for repeated acquisitions.
  el.classList.remove('pickup-animate');void el.offsetWidth;el.classList.add('pickup-animate');
  pickupTimer=setTimeout(()=>el.classList.add('hidden'),3800);
}
function acquire(id){if(S.inventory.has(id))return false;S.inventory.add(id);updateHeader();showPickup(id);return true;}
function gainPages(id,following,after=exploreMenu){
  const isNew=acquire(id);
  pages([...(isNew?[`아이템 획득 「${ITEMS[id].name}」`]:[]),...following],after);
}
function startGame(){
  $('startScreen').classList.add('hidden');$('gameShell').classList.remove('hidden');
  S.started=true;resetState();
  tryPlayMusic();
  pages([
    '<STAGE 1> 너무도 길었던 꿈',
    '아주 오랜 꿈을 꾼 것 같다.\n창밖으로 타는 듯한 노을이 들이치고\n하교를 알리는 종소리가 울리고 있었다.',
    '주변을 둘러보니 같은 반 아이들은 보이지 않았다.\n교실에는 나밖에 없었다.',
    '자리에서 일어나 교실 문을 열었다.\n아니, 열려 했다.',
    '덜컹덜컹.',
    '문이 열리지 않는다. 앞문도 마찬가지. 이게 무슨 일이지?\n아무래도 갇힌 것 같다.\n자세히 살펴보니 교실 뒷문에 자물쇠가 걸려 있다.\n어떻게 할까?'
  ], initialChoices);
  canvas.focus({preventScroll:true});
}
async function tryPlayMusic(){
  if(S.muted)return;
  bgm.volume=.48; bgm.loop=true;
  try{await bgm.play();$('musicLabel').textContent=' 음악 켜짐';}catch{toast('음악을 재생하려면 오른쪽 위의 ♫ 버튼을 누르세요.',3800);}
}
function playStairSound(){
  if(S.muted)return;
  stairSound.pause();stairSound.currentTime=0;stairSound.volume=.95;
  bgm.volume=.24;stairSound.play().catch(()=>{});
  stairSound.onended=()=>{bgm.volume=.48;};
  setTimeout(()=>{bgm.volume=.48;},2900);
}
function initialChoices(){
  choices('어떻게 할까?',[
    {text:'자물쇠를 살펴본다.',action:openLock},
    {text:'교실을 한번 둘러보자.',action:revealRoom}
  ]);
}
function revealRoom(){
  S.explored=true;
  exploreMenu();
}
function exploreMenu(){
  if(S.map!=='classroom'||!S.explored||S.stage1Clear)return;
  const opts=[];
  if(!S.visitedCats.has('desk'))opts.push({text:'책상이 수상하다.',action:deskMenu});
  if(!S.visitedCats.has('board'))opts.push({text:'게시판이 수상하다.',action:investigateBoard});
  if(!S.visitedCats.has('locker'))opts.push({text:'사물함이 수상하다.',action:investigateLockers});
  if(!S.visitedCats.has('trash'))opts.push({text:'휴지통이 수상하다.',action:()=>walkTo(1325,565,investigateTrash)});
  if(opts.length===1&&opts[0].text.startsWith('휴지통')){
    pages(['이제 어디를 살펴보지?\n휴지통이 수상하다.','무언가 기대하고 휴지통을 살펴봤지만, 휴지통에는 아무것도 없었다.'],()=>{S.visitedCats.add('trash');S.flags.trash=true;});
    return;
  }
  if(opts.length===0){closeDialog();toast('교실을 자유롭게 조사하거나 문을 살펴보세요.');return;}
  choices('어디를 먼저 살펴보지?',opts,{movable:true});
}
function deskMenu(){
  S.visitedCats.add('desk');
  choices('누구의 책상을 살펴볼까?',[
    {text:'내 책상을 살펴본다.',action:()=>walkTo(1265,706,investigateOwnDesk)},
    {text:'기태하의 책상을 살펴본다.',action:()=>walkTo(449,713,investigateTaehaDesk)}
  ]);
}
function investigateOwnDesk(){
  S.visitedDesks.add('own');
  pages(['책상에는 구약 성서 한 권이 있다.\n나는 종교도 없는데. 책을 살펴볼까?'],()=>{
    choices('책을 살펴볼까?',[
      {text:'살펴본다.',action:readBible},
      {text:'차라리 서랍 안을 살펴본다.',action:openOwnDrawer}
    ]);
  });
}
function readBible(){
  pages([
    '귀퉁이가 접힌 페이지가 있다.',
    '주님, 제가 당신의 구원을 기다립니다.(창세기, 49:18)',
    '말끝마다 주님을 찾는 한 인물이 떠오른다.\n그래서 니네 주님이 구원해 주셨대?',
    '신은 대답이 없다. 그 새끼도 마찬가지.\n성서를 덮었다.'
  ],()=>choices('어디를 살펴볼까?',[
    {text:'차라리 서랍 안을 살펴본다.',action:openOwnDrawer},
    {text:'기태하의 책상을 살펴본다.',action:()=>walkTo(449,713,investigateTaehaDesk)},
    {text:'게시판이 수상하다.',action:investigateBoard},
    {text:'사물함이 수상하다.',action:investigateLockers},
    {text:'휴지통이 수상하다.',action:()=>walkTo(1325,565,investigateTrash)}
  ]));
}
function openOwnDrawer(){
  S.visitedDesks.add('own');
  gainPages('paper',[
    '꼬깃꼬깃하게 접힌 종이를 발견했다.\n누군가 정성 어린 손길로 그린 초상화다.\n나는 이것이 젖지 않기를 바랐었다.'
  ],()=>choices('어디를 살펴볼까?',[
    {text:'기태하의 책상을 살펴본다.',action:()=>walkTo(449,713,investigateTaehaDesk)},
    {text:'게시판이 수상하다.',action:investigateBoard},
    {text:'사물함이 수상하다.',action:investigateLockers},
    {text:'휴지통이 수상하다.',action:()=>walkTo(1325,565,investigateTrash)}
  ]));
}
function investigateTaehaDesk(){
  S.visitedDesks.add('taeha');S.visitedCats.add('desk');
  const next=[
    '기태하의 책상이다. 책상 위에는 필통 하나가 덩그러니 놓여 있다.\n서랍에는 아무것도 없을 게 뻔한데.',
    '...... 아니었네.'
  ];
  pages(next,()=>gainPages('cigarettes',[
    '익숙한 담배를 발견했다.\n싸구려 멘솔, 나한테 안 어울린다고 했으면서.',
    '기태하가 담배를 왜 바꿨는지\n나는 이미 알고 있다.',
    '담배를 주머니 안에 넣었다.'
  ],exploreMenu));
}
function investigateBoard(){
  pages(['게시판 가까이 가 보자.'],()=>walkTo(BOARD_POINT.x,BOARD_POINT.y,readBoard));
}
function readBoard(){
  S.visitedCats.add('board');S.flags.bulletin=true;
  pages([
    '현장 체험 학습 안내문이다.\n동의서 제출일은 내일까지였다.\n가고 싶지 않다는 생각과 가야만 한다는 생각이 동시에 든다.',
    '안내문 옆에는 지도가 걸려 있다.\n어떤 섬의 지도인 것 같다.',
    '나는 저 섬을 알고 있다.'
  ],exploreMenu);
}
function investigateLockers(){
  S.visitedCats.add('locker');
  pages(['사물함은 전부 잠겨 있지 않은 듯하다.\n아무 사물함이나 열어 봐도 될 것 같다.'],()=>walkTo(775,722,openLockerList));
}
function investigateTrash(){
  S.visitedCats.add('trash');S.flags.trash=true;
  pages(['무언가 기대하고 휴지통을 살펴봤지만, 휴지통에는 아무것도 없었다.'],exploreMenu);
}
function openLockerList(){
  if(S.map!=='classroom')return;
  closeDialog();
  const grid=$('lockerGrid');grid.replaceChildren();
  ROSTER.forEach(name=>{
    const b=document.createElement('button');b.type='button';b.className='locker-cell';
    b.textContent=name;
    if(S.visitedLockers.has(name)&&name!=='명예희'){
      b.classList.add('marked');const mark=document.createElement('span');mark.className='red-x';mark.textContent='✕';mark.setAttribute('aria-hidden','true');b.appendChild(mark);
    }
    b.onclick=()=>investigateLocker(name);
    grid.appendChild(b);
  });
  $('lockerOverlay').classList.remove('hidden');
}
function investigateLocker(name){
  $('lockerOverlay').classList.add('hidden');
  if(name!=='명예희')S.visitedLockers.add(name);
  if(name==='임은재')S.flags.im=true;
  if(name==='명그린')S.flags.green=true;
  const resume=openLockerList;
  const lines={
    '강윤혜':['윤혜의 사물함에는 D7이라고 적힌 쪽지가 있었다.\n쪽지 뒷면에는 익숙한 이름들이 적혀 있다.','금하제, 이청우, 한도윤.'],
    '임은재':['은재의 사물함에는 쪽지가 하나 있었다.\n쪽지에는 이렇게 적혀 있었다.','나도 몰랐어.','쪽지 뒷면에는 아무것도 적혀 있지 않다.'],
    '기태하':['기태하의 사물함에는 체육복이 들어 있다.\n작년 초봄, 내가 아무리 질색해도 걸치고 있으라며 억지로 쥐여 주었던 것이다.\n헤어진 이후 기태하가 체육복을 입었는지는 모르겠다.','기억하고 싶지 않은 걸까.'],
    '주인하':['인하의 사물함에는 다음의 물건들이 들어 있었다.\n체육복. 인하가 교복 위에 자주 걸치고 있었던 체육복이다.\n과자와 젤리. 언젠가 인하가 나눠 주었던 기억이 있다.\n노트 몇 권. 몇 페이지 사용하지 않은 노트들이다. 수업 시간에 낙서를 했던 것 같다.\n붕대와 밴드. 이걸 사용할 일이 없어야 할 텐데.','사물함을 닫았다.'],
    '명그린':['명그린의 사물함에는 까만색 노트가 한 권 들어 있다.\n노트의 첫 페이지에는 기태하의 이름이 적혀 있다.\n아, 데스노트구나.'],
    '백우진':['백우진의 사물함에는 쪽지가 하나 있었다.\n쪽지에는 다음과 같은 문장이 적혀 있었다.','우리 담임까지가 4 반이야.'],
    '금하제':['금하제의 사물함에는 총알이 무더기로 들어 있었다.\n하나, 둘, 셋...... 총 스물여덟 발의 총알이다.','이 총알들은 장전되어 있어야 하는데.'],
    '이동식':['이동식의 사물함에는 만화책들이 쌓여 있었다.','오디션, 다정다감, Let 다이.......','그만 살펴보자.'],
    '서은결':['서은결의 사물함에는 잡다한 것이 많았다.','구겨진 교과서와 안내문들, 역시나 구겨진 성적표.\n주인을 알 수 없는 볼펜들과...... 콘돔.','그만 살펴보자.'],
    '이하늘':['이하늘의 사물함에는 언제 세탁했는지 알 수 없는 체육복이 들어 있었다.\n쿰쿰한 냄새에 재빨리 사물함 문을 닫았다.'],
    '현제원':['현제원의 사물함은 예상보다 깔끔했다.\n과자 쓰레기 몇 개와 립밤, 그리고 치약과 칫솔.','쪽지 하나를 발견했다.','기억해. 은재가 처음이었어.'],
    '한도윤':['한도윤의 사물함에는 다음의 물품들이 들어 있었다.\n체육복, 수건, 아대와 무릎 보호대.','그리고 멀쩡한 교과서.\n우리 반에서 교과서를 제대로 가지고 다니는 남학생은 한도윤뿐인 걸까.'],
    '배하린':['하린이의 사물함에는 다음의 물품들이 들어 있었다.','노트와 교과서, 문제집. 하린이가 그래도 공부를 열심히 했나.\n에어팟과 분홍색 접이식 우산.\n키티 담요와 베개. 하린이와 잘 어울린다.','노트를 펼쳐 보았다. 떨리는 손으로 쓴 문장이 있다.','전부 사람으로 환생해서 다시 보자 빠이'],
    '공주야':['주야의 사물함에는 다음의 물품들이 있었다.','빗과 파우치, 하트 모양 거울. 모두 분홍색이다.\n예쁜 케이스의 립밤까지. 언젠가 주야가 교복 치마 주머니에서 이 립밤을 꺼내 발랐던 것을 본 기억이 있다.'],
    '서영현':['영현이의 사물함에는 다음의 물품들이 있었다.','문제집 몇 권과 노트 몇 권.\n담요와 체육복.','영현이와 더 많은 대화를 할 수 있었을 텐데.'],
    '남시현':['남시현의 사물함에는 스포츠 테이프가 들어 있었다.\n무리하면서 달리고 있었구나.']
  };
  if(name==='명예희'){
    pages([
      '예희의 사물함에는 다음의 물건들이 들어 있었다.',
      '각기 다른 브랜드의 담뱃갑 여러 개. 아마도 백석 꼴통들에게서 압수한 듯하다.\n선도위원회 회의록과 선도부 완장. 완장을 왜 두고 갔지?\n화투와 라이터. 이것도 압수한 물품들일까.\n마지막으로 알 수 없는 열쇠 꾸러미를 발견했다.'
    ],()=>gainPages('keyring',[
      '예희는 왜 이 열쇠들이 필요했던 걸까?\n물어볼 수 없다. 이곳에는 예희의 목소리를 엿들을 수 있는 무전도 없다.',
      '당장 교실을 나가는 데 사용할 수는 없겠지만\n이 열쇠 꾸러미를 챙기기로 한다.\n어딘가 쓸데가 있겠지.'
    ],resume));
  } else if(name==='강무결'){
    gainPages('knife',[
      '내 사물함에는 피가 말라붙은 나이프 하나가 덩그러니 놓여 있었다.\n순간 속이 울렁거려 입을 틀어막았다.',
      '눈앞이 일그러지며 파도 소리가 들리는 것만 같았다.\n잠시 진정될 때까지 속으로 숫자를 열까지 세었다.',
      '나이프를 챙기기로 한다.','...... 그래야만 할 것 같다.'
    ],resume);
  } else if(name==='주연호'){
    pages(['주연호의 사물함에는 초콜릿이 하나 들어 있었다.\n초콜릿에서는 아몬드 향이 은은하게 나는 듯하다.','문득 허기가 느껴진다.','먹을까?'],()=>choices('먹을까?',[
      {text:'먹는다.',action:()=>endingOne()},
      {text:'먹지 않는다.',action:()=>pages(['허기가 졌지만 남의 물건에 손대고 싶지 않다.\n초콜릿을 다시 사물함에 넣어 둔다.'],resume)}
    ]));
  } else {
    pages(lines[name]||['이 사물함은 비어 있다.'],resume);
  }
}
function currentLockArt(){
  if(S.flags.im&&S.flags.green)return lockAssets.complete;
  if(S.flags.im)return lockAssets.sam;
  if(S.flags.green)return lockAssets.all;
  return lockAssets.basic;
}
function openLock(){
  if(S.map!=='classroom'||S.stage1Clear)return;
  closeDialog();$('lockImage').src=currentLockArt();$('lockPin').value='';
  $('lockOverlay').classList.remove('hidden');$('lockPin').focus({preventScroll:true});
}
function wrongPin(){
  pages(['자물쇠가 풀리지 않는다.\n비밀번호는 이 숫자가 아닌 것 같다.'],()=>{
    if(S.explored)exploreMenu();
    else choices('어떻게 할까?', [{text:'교실을 한번 둘러보자.',action:revealRoom}]);
  });
}
function unlockClass(){
  S.stage1Clear=true;
  pages(['달칵.\n자물쇠가 풀렸다.','<STAGE 1> CLEAR'],()=>{
    switchMap('hallway',405,580,false,()=>pages(['<STAGE 2> 삼도천 혹은 스틱스 강']));
  });
}
function classroomDoor(){
  if(S.stage1Clear){switchMap('hallway',405,580);return;}
  openLock();
}
function hallwayPhoto(){
  if(S.map!=='hallway')return;
  S.flags.hallPhoto=true;
  pages(['그리운 얼굴들이다.','그래, 다음 세계가 있다면 담임 선생님까지 함께.......'],()=>{},{photo:true});
}
function hallwayClassDoor(){
  if(S.map!=='hallway')return;
  S.flags.hallPhoto=true;
  pages(['그리운 얼굴들이다.','그래, 다음 세계가 있다면 담임 선생님까지 함께.......'],()=>{
    if(!S.stage2Clear)return;
    choices('어떻게 할까?',[
      {text:'3학년 4반 교실로 돌아간다.',action:()=>switchMap('classroom',1267,520)},
      {text:'복도에 머문다.',action:()=>{}}
    ]);
  },{photo:true});
}
function recycling(){
  if(S.map!=='hallway')return;
  gainPages('bottle',['어디에 써야 할지 알 수 없는 빈 물병이다.','일단...... 챙겨야 하나.'],()=>{});
}
function enterStairs(){
  if(S.map!=='hallway'||S.transitioning)return;
  switchMap('stairs',735,810,true,()=>{
    if(!S.stage2Clear)stairChoices();
  });
}
function stairChoices(){
  pages(['계단이다. 위로 올라가거나 아래로 내려갈 수 있다.\n어떻게 하지?'],()=>choices('어떻게 하지?',[
    {text:'위로 올라간다',action:ascendStairs},
    {text:'아래로 내려간다',action:descendStairs}
  ]));
}
function ascendStairs(){
  if(S.stage2Clear){
    switchMap('artroom',762,876,false,enterArtroom);
    return;
  }
  S.stage2Clear=true;
  pages(['<STAGE 2> CLEAR'],()=>switchMap('artroom',762,876,false,enterArtroom));
}

// STAGE 3 — 연옥에서. Stage 1 and 2 remain traversable after clearing, so
// a player without the keyring can go back to the classroom to retrieve it.
function enterArtroom(){
  S.following=false;
  S.taeha.walking=false;
  S.taeha.x=TAEHA_WINDOW.x;S.taeha.y=TAEHA_WINDOW.y;S.taeha.face=0;
  S.followTrail=[];
  if(S.artroomUnlocked)return;
  if(!S.artroomIntroSeen){
    S.artroomIntroSeen=true;
    pages([
      '<STAGE 3> 연옥에서',
      '계단을 오르니 미술실이 도착했다.',
      '미술실 문은 잠겨 있었다.',
      '내가 가지고 있는 물건이 도움이 될까?'
    ],artroomItemChoices);
  }else{
    pages(['미술실 문은 잠겨 있었다.','내가 가지고 있는 물건이 도움이 될까?'],artroomItemChoices);
  }
}
function artroomItemChoices(){
  if(S.map!=='artroom'||S.artroomUnlocked)return;
  const order=['knife','cigarettes','keyring','bottle','paper'];
  const available=order.filter(id=>S.inventory.has(id));
  const entries=available.map(id=>({text:ITEMS[id].name,action:()=>tryArtroomItem(id)}));
  entries.push({text:'계단으로 돌아간다.',action:returnToStairs});
  choices('어떤 물건을 사용해 볼까?',entries);
}
function tryArtroomItem(id){
  if(id!=='keyring'){
    pages(['이 물건은 미술실을 여는 데 도움이 되지 않을 것 같다.\n다른 물건을 사용해 보자.'],artroomItemChoices);
    return;
  }
  pages([
    '예희의 사물함에서 발견한 열쇠들이 도움이 될 것 같다.',
    '꾸러미에 걸려 있는 열쇠들을 하나씩 살펴보았다.\n교무실, 보건실, 선도부실.......\n\n그리고 미술실.',
    '열쇠를 문에 꽂아 넣었다.\n\n달칵.',
    '미술실 문이 열렸다.'
  ],()=>{
    S.artroomUnlocked=true;
    S.artroomRevealAt=performance.now();
    S.taeha.x=TAEHA_WINDOW.x;S.taeha.y=TAEHA_WINDOW.y;
  });
}
function meetTaeha(){
  if(S.map!=='artroom'||!S.artroomUnlocked||S.taehaMet||S.following||S.endingStarted)return;
  S.taehaMet=true;
  pages([
    '기태하: 하여튼 말 더럽게 안 듣지. 늦게 오라니까 왜 벌써 와 가지고.\n강무결: .......',
    '기태하: 야, 담배 한 가치 적선해.\n기태하: 내 담배 다 분질러 버렸던 것 알잖냐.'
  ],cigaretteChoices,{speaker:'기태하 · 강무결'});
}
function cigaretteChoices(){
  choices('어떻게 할까?',[
    {text:'담배를 건넨다.',action:giveCigarette},
    {text:'담배를 건네지 않는다.',action:refuseCigarette}
  ],{speaker:'강무결'});
}
function giveCigarette(){
  if(!S.inventory.has('cigarettes')){
    pages(['담배를 가지고 있지 않다.'],cigaretteChoices);
    return;
  }
  // Keep the actual user-supplied item visible as its own skippable page.
  pages([{text:'담배',image:itemSrc('cigarettes')}],()=>pages([
    '담배를 하나 꺼내 기태하에게 건넸다.\n기태하는 주머니에서 라이터를 꺼내 능숙하게 불을 붙였다.',
    '아주 깊게 연기를 빨아들이고, 아주 길게 연기를 뱉었다.\n회개를 아주 길게 하는 것처럼.',
    '기태하: 기다렸어.\n강무결: 얼마나?',
    '기태하: 몰라. 헤아리다가 까먹음.\n기태하: ...... 니랑 같이 가고 싶어서.',
    '기태하: 애 혼자 절벽에 두고 왔으니까.',
    '강무결: 바보. 그러니까 동맹이라도 맺었으면 됐잖아.\n기태하: 야, 니 다치는 꼴을 내가 어떻게 봐.',
    '기태하의 담배가 빠르게 타들어 간다.\n입이 자꾸 마르는 기분이었다.\n\n샐쭉 웃는 상판이 얄밉다.',
    '기태하: 역시 뒈지기 전에 혀도 섞을 걸 그랬지.\n강무결: 미친 새끼. 죽어.',
    '기태하가 손을 뻗는다.\n그날 밤처럼 손을 잡았다.'
  ],startFollowing,{speaker:'기태하 · 강무결'}));
}
function refuseCigarette(){
  pages([
    '기태하: 까비. 입 존나 텁텁했는데.\n강무결: 뒈져서도 담배부터 찾는 것 징글징글해.',
    '기태하: 징글징글한 새끼 상판 또 보는 건?\n강무결: ......'
  ],()=>choices('어떻게 대답할까?',[
    {text:'니 따라서 온 거라니까.',action:followingWithoutCigarette},
    {text:'좋을 대로 생각해.',action:partingEnding}
  ],{speaker:'강무결'}),{speaker:'기태하 · 강무결'});
}
function followingWithoutCigarette(){
  pages([
    '기태하: 기다렸어.\n강무결: 얼마나?',
    '기태하: 몰라. 헤아리다가 까먹음.\n기태하: ...... 니랑 같이 가고 싶어서.',
    '기태하: 애 혼자 절벽에 두고 왔으니까.',
    '강무결: 바보. 그러니까 동맹이라도 맺었으면 됐잖아.\n기태하: 야, 니 다치는 꼴을 내가 어떻게 봐.',
    '샐쭉 웃는 상판이 얄밉다.',
    '기태하: 역시 뒈지기 전에 혀도 섞을 걸 그랬지.\n강무결: 미친 새끼. 죽어.',
    '기태하가 손을 뻗는다.\n그날 밤처럼 손을 잡았다.'
  ],startFollowing,{speaker:'기태하 · 강무결'});
}
function startFollowing(){
  S.following=true;
  S.taeha.face=0;
  // Only track the player's visited route. Including Taeha's initial
  // coordinate here would anchor the follower permanently to the window.
  S.followTrail=[{x:S.px,y:S.py}];
}
function partingEnding(){
  S.endingStarted=true;
  pages([
    '기태하: 빨라도 너무 빨리 왔잖냐, 무결아.\n강무결: .......\n기태하: 지옥 떨어지기 전에 니 한 번 더 보고 싶었어.\n기태하: 그래서 기다렸다.',
    '강무결: 이게 진짜 마지막이야?\n기태하: 뭐, 다음 세계 그딴 게 있으면 또 모르지.\n기태하: 교실로 돌아가. 말 들어.',
    '무어라 대답하기도 전에 기태하는 나를 미술실 문 밖으로 떠밀었다.\n이 새끼는 뒈졌는데 힘이 어디서 나오지.\n\n미술실 문이 닫힌다.\n샐쭉 웃는 상판이 오늘처럼 미웠던 적이 없었다.'
  ],()=>{
    S.failureDark=true;
    pages([
      '<엔딩 4> 갈림길',
      '주변이 삽시간에 어두워졌다.\n미술실 문에 매달렸다.\n\n덜컹덜컹.',
      '미술실 문이 열리지 않는다.\n기태하의 이름을 몇 번이고 불렀다.\n\n기태하가 대답하지 않는다.\n\n마지막까지 지 마음대로 하는 새끼.'
    ],()=>endingScreen('ENDING 04 · 갈림길','마지막까지 지 마음대로 하는 새끼.'));
  },{speaker:'기태하 · 강무결'});
}
function togetherEnding(){
  if(S.endingStarted||!S.following)return;
  S.endingStarted=true;
  pages([
    '<엔딩 3> 네 번의 생이 주어진다면',
    '기태하의 손은 차가웠지만, 나는 충분히 따뜻했다.\n함께 문을 나설 사람이 있으니까.\n\n만약에 우리에게 다음 세계가 주어진다면.......\n\n그때는 더 솔직할 수 있을까.',
    '<STAGE 3> 연옥에서 CLEAR'
  ],()=>endingScreen('ENDING 03 · 네 번의 생이 주어진다면','두 사람은 함께 미술실 문을 나섰다.'));
}
function descendStairs(){
  pages([
    '계단 아래에는 아무것도 없다.\n빛도, 소리도, 아무것도......',
    '돌아가야 해.',
    '<엔딩 2> 무저갱',
    '뒤를 돌아봤지만 돌아갈 수 있는 계단이 사라졌다.\n주변은 온통 어둠뿐.\n분명 눈을 뜨고 있는데 감고 있는 기분이었다.\n\n문득 잠이 쏟아진다.\n\n내 몸이 서서히 무너지고 있었다.',
    '이때 왜 그 상판이 떠오르는 걸까.'
  ],()=>endingScreen('ENDING 02 · 무저갱','계단 아래의 어둠 속에서 다시 잠이 든다.'));
}
function endingOne(){
  pages([
    '<엔딩 1>',
    '초콜릿을 씹은 직후부터 까무룩 잠이 쏟아졌다.\n이길 수 없는 수마라는 것을 본능적으로 알고 있다.',
    '다시 그 꿈을 꾸게 된다면.......\n조금 다른 결말을 볼 수 있을까?'
  ],()=>endingScreen('ENDING 01','다시 그 꿈을 꾸게 된다면, 다른 결말을 볼 수 있을까?'));
}
function endingScreen(title,desc){
  closeDialog();$('endingTitle').textContent=title;$('endingDescription').textContent=desc;
  $('endingOverlay').classList.remove('hidden');
}
function switchMap(map,x,y,stairEffect=false,done=()=>{}){
  if(S.transitioning)return;
  S.transitioning=true;S.autoPath=[];S.afterWalk=null;closeDialog();
  if(stairEffect)playStairSound();
  fadeCover.classList.add('active');
  clearTimeout(switchTimer);
  switchTimer=setTimeout(()=>{
    S.map=map;S.px=x;S.py=y;S.face=0;configureCanvas();updateHeader();
    fadeCover.classList.remove('active');S.transitioning=false;
    done();
  },270);
}
function returnToHall(){
  if(S.map!=='stairs')return;
  switchMap('hallway',783,653,true,()=>toast('복도로 돌아왔다.'));
}
function returnToStairs(){
  if(S.map!=='artroom')return;
  if(S.following){togetherEnding();return;}
  switchMap('stairs',1055,420);
}
function showInventory(){
  if(!S.started)return;
  const container=$('inventoryGrid');container.replaceChildren();
  if(!S.inventory.size){const p=document.createElement('p');p.className='empty-inventory';p.textContent='아직 획득한 물품이 없습니다.';container.appendChild(p);}
  for(const id of S.inventory){
    const item=ITEMS[id], el=document.createElement('div');el.className='inventory-item';
    const img=document.createElement('img');img.src=itemSrc(id);img.alt=item.name;
    const strong=document.createElement('strong');strong.textContent=item.name;
    const desc=document.createElement('p');desc.textContent=item.desc;
    el.append(img,strong,desc);container.appendChild(el);
  }
  $('inventoryOverlay').classList.remove('hidden');
}
function cancelModal(id){
  $(id).classList.add('hidden');
  if(id==='lockOverlay'&&S.started&&!S.stage1Clear){
    if(S.explored)exploreMenu(); else choices('어떻게 할까?', [{text:'교실을 한번 둘러보자.',action:revealRoom}]);
  }
  if(id==='lockerOverlay'&&S.map==='classroom'&&S.explored&&!S.dlg) exploreMenu();
  canvas.focus({preventScroll:true});
}
function collision(x,y,map=S.map){
  const inf=MAP_INFO[map],b=inf.bound,r=12;
  if(map==='stairs'){
    if(x<115+r||x>1370-r||y<318+r||y>978-r)return true;
    if(y<694&&x<780)return true;
    return false;
  }
  if(x<b.left+r||x>b.right-r||y<b.top+r||y>b.bottom-r)return true;
  for(const box of inf.blocks){ if(x>box.x-r&&x<box.x+box.w+r&&y>box.y-r&&y<box.y+box.h+r)return true; }
  return false;
}
function movePlayer(dx,dy,dt){
  const speed=dt*270;
  const ox=S.px,oy=S.py;
  // 4-direction movement, use no diagonal displacement.
  if(dx){const nx=S.px+dx*speed;if(!collision(nx,S.py))S.px=nx;}
  else if(dy){const ny=S.py+dy*speed;if(!collision(S.px,ny))S.py=ny;}
  return Math.abs(S.px-ox)>0.01||Math.abs(S.py-oy)>0.01;
}
const len=(a,b,c,d)=>Math.hypot(a-c,b-d);
function findPath(targetX,targetY){
  const cell=27,cols=Math.ceil(MAP_INFO[S.map].w/cell),rows=Math.ceil(MAP_INFO[S.map].h/cell);
  const node=(x,y)=>y*cols+x;
  const round=(v)=>Math.round(v/cell),startX=round(S.px),startY=round(S.py);
  let gx=round(targetX),gy=round(targetY);
  const valid=(x,y)=>x>=0&&y>=0&&x<cols&&y<rows&&!collision(x*cell,y*cell);
  if(!valid(gx,gy)){
    let closest=null,best=Infinity;
    for(let r=1;r<=8&&!closest;r++)for(let ox=-r;ox<=r;ox++)for(let oy=-r;oy<=r;oy++){
      if(Math.max(Math.abs(ox),Math.abs(oy))!==r)continue;
      if(valid(gx+ox,gy+oy)){
        const cost=Math.abs(ox)+Math.abs(oy);
        if(cost<best){best=cost;closest=[gx+ox,gy+oy];}
      }
    }
    if(!closest)return [];
    [gx,gy]=closest;
  }
  const start=node(startX,startY),goal=node(gx,gy);
  const open=[{id:start,x:startX,y:startY,g:0,f:0}],cost=new Map([[start,0]]),came=new Map(),closed=new Set();
  let count=0;
  while(open.length&&count++<14000){
    let best=0;
    for(let i=1;i<open.length;i++)if(open[i].f<open[best].f)best=i;
    const cur=open.splice(best,1)[0];
    if(closed.has(cur.id))continue;
    if(cur.id===goal){
      const steps=[];let id=goal;
      while(id!==start){const x=id%cols,y=Math.floor(id/cols);steps.push({x:x*cell,y:y*cell});id=came.get(id);if(id===undefined)return [];}
      steps.reverse();return steps;
    }
    closed.add(cur.id);
    for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
      const x=cur.x+dx,y=cur.y+dy;
      if(!valid(x,y))continue;
      const id=node(x,y),g=cur.g+1;
      if(closed.has(id)||g>=(cost.get(id)??Infinity))continue;
      cost.set(id,g);came.set(id,cur.id);
      open.push({id,x,y,g,f:g+Math.abs(gx-x)+Math.abs(gy-y)});
    }
  }
  return [];
}
function walkTo(x,y,fn){
  if(S.dlg||isOverlayOpen()||S.transitioning)return;
  if(len(x,y,S.px,S.py)<48){fn();return;}
  let path=findPath(x,y);
  if(!path.length){toast('그곳까지 가는 길을 찾지 못했습니다. 방향키로 가까이 이동하세요.');return;}
  S.autoPath=path;S.afterWalk=fn;
  toast('사물 가까이로 이동합니다.',1400);
}
function hotspots(){
  if(S.map==='classroom')return [
    {name:'교실 문 자물쇠',x:1435,y:346,r:105,go:[1341,350],act:classroomDoor},
    {name:'게시판',x:1080,y:192,r:179,go:[BOARD_POINT.x,BOARD_POINT.y],act:investigateBoard},
    {name:'강무결의 책상',x:1155,y:636,r:105,go:[1270,701],act:investigateOwnDesk},
    {name:'기태하의 책상',x:387,y:642,r:105,go:[451,711],act:investigateTaehaDesk},
    {name:'사물함',x:775,y:853,r:430,go:[775,722],act:investigateLockers},
    {name:'휴지통',x:1420,y:550,r:90,go:[1325,563],act:investigateTrash}
  ];
  if(S.map==='hallway')return [
    {name:'3-4 교실 문',x:416,y:353,r:107,go:[410,527],act:hallwayClassDoor},
    {name:'게시판',x:633,y:340,r:160,go:[630,532],act:hallwayPhoto},
    {name:'분리수거함',x:215,y:407,r:94,go:[318,525],act:recycling},
    {name:'계단',x:787,y:806,r:129,go:[787,715],act:enterStairs}
  ];
  if(S.map==='stairs')return [
    {name:'복도로 돌아가기',x:740,y:984,r:120,go:[740,942],act:returnToHall},
    {name:'위층 계단',x:1030,y:428,r:195,go:[1060,700],act:S.stage2Clear?ascendStairs:stairChoices}
  ];
  const art=[{name:S.following?'함께 미술실 나가기':'계단으로 돌아가기',x:760,y:996,r:115,go:[760,886],act:returnToStairs}];
  if(S.artroomUnlocked&&!S.taehaMet&&!S.endingStarted){
    art.push({name:'기태하',x:TAEHA_WINDOW.x,y:TAEHA_WINDOW.y-42,r:98,go:[590,502],act:meetTaeha});
  }
  return art;
}
function hitTest(x,y){
  if(S.map==='classroom'&&x>=369&&x<=1188&&y>=745&&y<=925){
    const c=Math.max(0,Math.min(5,Math.round((x-438)/137.5)));
    const r=Math.max(0,Math.min(5,Math.round((y-759)/28.9)));
    const name=ROSTER[r*6+c];
    return {name:`${name} 사물함`,go:[Math.min(1190,Math.max(371,x)),720],act:()=>{S.visitedCats.add('locker');investigateLocker(name);}};
  }
  return hotspots().find(h=>len(x,y,h.x,h.y)<=h.r);
}
function autoStep(dt){
  if(!S.autoPath.length)return false;
  let budget=270*dt, actuallyMoved=false;
  // Follow A* grid nodes one cardinal axis at a time. Never snap across a
  // blocked diagonal or cross a wall while catching up with a waypoint.
  for(let i=0;i<3&&S.autoPath.length&&budget>0.05;i++){
    const next=S.autoPath[0];
    const ax=Math.abs(next.x-S.px)>0.5?'x':Math.abs(next.y-S.py)>0.5?'y':null;
    if(!ax){S.autoPath.shift();continue;}
    const delta=(ax==='x'?next.x-S.px:next.y-S.py);
    const d=Math.sign(delta),step=Math.min(Math.abs(delta),budget),ox=S.px,oy=S.py;
    const nx=ax==='x'?S.px+d*step:S.px;
    const ny=ax==='y'?S.py+d*step:S.py;
    setFace(ax==='x'?d:0,ax==='y'?d:0);
    if(collision(nx,ny)){
      S.autoPath=[];S.afterWalk=null;
      toast('길이 막혀 있습니다. 방향키로 다른 통로를 이용해 주세요.');
      return actuallyMoved;
    }
    S.px=nx;S.py=ny;actuallyMoved=true;budget-=step;
    if(Math.abs(next.x-S.px)<0.51&&Math.abs(next.y-S.py)<0.51)S.autoPath.shift();
    if(Math.abs(S.px-ox)+Math.abs(S.py-oy)<.001)break;
  }
  if(!S.autoPath.length&&S.afterWalk){const cb=S.afterWalk;S.afterWalk=null;cb();}
  return actuallyMoved;
}
function setFace(dx,dy){
  if(dy>0)S.face=0;else if(dx>0)S.face=1;else if(dx<0)S.face=2;else if(dy<0)S.face=3;
}
function update(dt){
  if(!S.started||S.transitioning||S.dlg||isOverlayOpen()){
    S.walking=false;
    return;
  }
  // Latest held direction wins; never combine orthogonal keys into diagonal.
  const keys=[...pressed,...S.mobileKeys];
  const k=keys.length?keys[keys.length-1]:null;
  const dirs={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};
  let moved=false;
  if(k&&dirs[k]){
    S.autoPath=[];S.afterWalk=null;
    const [dx,dy]=dirs[k];setFace(dx,dy);
    moved=movePlayer(dx,dy,dt);
  }else moved=autoStep(dt);
  S.walking=moved;
  if(moved)S.walkClock+=dt;
  else S.walkClock=0;
  updateTaehaFollower(dt);
  // Meeting the other character also triggers by walking close to him.
  if(S.map==='artroom'&&S.artroomUnlocked&&!S.taehaMet&&!S.endingStarted&&
     len(S.px,S.py,S.taeha.x,S.taeha.y)<128){meetTaeha();return;}
  if(S.map==='hallway'&&S.px>=696&&S.px<=874&&S.py>=741){enterStairs();}
  else if(S.map==='stairs'&&S.px>=658&&S.px<=857&&S.py>=945){returnToHall();}
  else if(S.map==='stairs'&&S.stage2Clear&&S.px>=925&&S.py<=369){ascendStairs();}
  else if(S.map==='artroom'&&S.px>=660&&S.px<=855&&S.py>=921){returnToStairs();}
}
function updateTaehaFollower(dt){
  if(!S.following||S.map!=='artroom')return;
  if(S.walking)S.followTrail.push({x:S.px,y:S.py});
  if(S.followTrail.length>1100)S.followTrail.splice(0,400);
  const trail=S.followTrail;
  if(trail.length<2){S.taeha.walking=false;return;}
  // Follow the route walked by the player, lagging roughly 75 world pixels.
  let traveled=0,target=trail[0];
  for(let i=trail.length-1;i>0;i--){
    traveled+=len(trail[i].x,trail[i].y,trail[i-1].x,trail[i-1].y);
    target=trail[i-1];
    if(traveled>=77)break;
  }
  const dx=target.x-S.taeha.x,dy=target.y-S.taeha.y;
  const speed=(len(S.taeha.x,S.taeha.y,S.px,S.py)>160?380:270)*dt;
  let nx=S.taeha.x,ny=S.taeha.y;
  if(Math.abs(dx)>1.2){nx+=Math.sign(dx)*Math.min(Math.abs(dx),speed);S.taeha.face=dx>0?1:2;}
  else if(Math.abs(dy)>1.2){ny+=Math.sign(dy)*Math.min(Math.abs(dy),speed);S.taeha.face=dy>0?0:3;}
  S.taeha.walking=Math.abs(nx-S.taeha.x)+Math.abs(ny-S.taeha.y)>.3;
  S.taeha.x=nx;S.taeha.y=ny;
  if(S.taeha.walking)S.taeha.walkClock+=dt;
  else S.taeha.walkClock=0;
}
function drawLights(){
  const w=MAP_INFO[S.map].w,h=MAP_INFO[S.map].h;
  if(darkLayer.width!==w||darkLayer.height!==h){darkLayer.width=w;darkLayer.height=h;}
  dc.globalCompositeOperation='source-over';dc.clearRect(0,0,w,h);
  dc.fillStyle='rgba(9,6,16,0.91)';dc.fillRect(0,0,w,h);
  dc.globalCompositeOperation='destination-out';
  const gradient=dc.createRadialGradient(1162,649,30,1162,649,180);
  gradient.addColorStop(0,'rgba(0,0,0,1)');gradient.addColorStop(.38,'rgba(0,0,0,.98)');gradient.addColorStop(1,'rgba(0,0,0,0)');
  dc.fillStyle=gradient;dc.fillRect(0,0,w,h);dc.globalCompositeOperation='source-over';
  ctx.drawImage(darkLayer,0,0);
}
function drawActor(sheet,actor){
  if(!sheet.complete||!sheet.naturalWidth)return;
  // The source sheets have 3 columns × 4 rows. Draw all 176×236 pixels of
  // each cell; never crop to an inferred head/torso rectangle.
  const cycle=[0,1,2,1];
  const f=actor.walking?cycle[Math.floor(actor.walkClock*8.5)%cycle.length]:0;
  const w=81,h=109;
  ctx.save();ctx.imageSmoothingEnabled=false;
  ctx.fillStyle='rgba(23,13,18,.26)';
  ctx.beginPath();ctx.ellipse(actor.x,actor.y-4,24,8,0,0,Math.PI*2);ctx.fill();
  ctx.drawImage(sheet,f*SPRITE_TILE.w,actor.face*SPRITE_TILE.h,SPRITE_TILE.w,SPRITE_TILE.h,Math.round(actor.x-w/2),Math.round(actor.y-h+3),w,h);
  ctx.restore();
}
function drawCharacters(){
  const player={x:S.px,y:S.py,face:S.face,walking:S.walking,walkClock:S.walkClock};
  if(S.map!=='artroom'||!S.artroomUnlocked||S.failureDark){drawActor(sprite,player);return;}
  // Correct painter order prevents the other sprite from obscuring the head.
  if(S.taeha.y<S.py){drawActor(taehaSprite,S.taeha);drawActor(sprite,player);}
  else {drawActor(sprite,player);drawActor(taehaSprite,S.taeha);}
}
function drawArtroomDarkness(now){
  const w=MAP_INFO.artroom.w,h=MAP_INFO.artroom.h;
  if(darkLayer.width!==w||darkLayer.height!==h){darkLayer.width=w;darkLayer.height=h;}
  dc.globalCompositeOperation='source-over';dc.clearRect(0,0,w,h);
  dc.fillStyle=S.failureDark?'rgba(5,3,12,.94)':'rgba(7,5,17,.83)';dc.fillRect(0,0,w,h);
  if(!S.failureDark){
    dc.globalCompositeOperation='destination-out';
    const grad=dc.createRadialGradient(S.px,S.py-45,18,S.px,S.py-45,240);
    grad.addColorStop(0,'rgba(0,0,0,.78)');
    grad.addColorStop(.50,'rgba(0,0,0,.38)');
    grad.addColorStop(1,'rgba(0,0,0,0)');
    dc.fillStyle=grad;dc.fillRect(0,0,w,h);
  }
  dc.globalCompositeOperation='source-over';
  const reveal=S.artroomUnlocked&&!S.failureDark
    ?Math.max(0,1-(now-S.artroomRevealAt)/900):1;
  ctx.save();ctx.globalAlpha=reveal;ctx.drawImage(darkLayer,0,0);ctx.restore();
}
function drawLockerX(){
  if(S.map!=='classroom')return;
  ctx.save();ctx.lineCap='round';ctx.lineWidth=3.5;
  for(const name of S.visitedLockers){
    if(name==='명예희')continue;
    const i=ROSTER.indexOf(name);if(i<0)continue;
    const col=i%6,row=Math.floor(i/6),x=438+col*137.5,y=759+row*28.9;
    ctx.strokeStyle='rgba(226,45,58,.94)';ctx.beginPath();ctx.moveTo(x-11,y-8);ctx.lineTo(x+11,y+9);ctx.moveTo(x+11,y-8);ctx.lineTo(x-11,y+9);ctx.stroke();
  }
  ctx.restore();
}
function drawNearMarkers(timestamp){
  if(S.dlg||isOverlayOpen()||!S.explored&&S.map==='classroom')return;
  for(const h of hotspots()){
    const d=len(S.px,S.py,h.go[0],h.go[1]);if(d>235||d<5)continue;
    ctx.save();const a=.44+.18*Math.sin(timestamp*.004);
    ctx.strokeStyle=`rgba(255,222,181,${a})`;ctx.fillStyle='rgba(38,22,31,.7)';ctx.lineWidth=2;
    ctx.beginPath();ctx.arc(h.x,h.y,17+Math.sin(timestamp*.004)*2,0,Math.PI*2);ctx.fill();ctx.stroke();
    ctx.fillStyle='#ffdfc5';ctx.font='21px StoryBold';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('!',h.x,h.y);ctx.restore();
  }
}
function drawDebug(){
  const info=MAP_INFO[S.map];ctx.save();ctx.strokeStyle='#59f8a2';ctx.lineWidth=3;
  const b=info.bound;ctx.strokeRect(b.left,b.top,b.right-b.left,b.bottom-b.top);
  ctx.fillStyle='rgba(230,55,70,.2)';info.blocks.forEach(o=>{ctx.fillRect(o.x,o.y,o.w,o.h);ctx.strokeRect(o.x,o.y,o.w,o.h)});
  hotspots().forEach(h=>{ctx.beginPath();ctx.arc(h.x,h.y,h.r,0,Math.PI*2);ctx.stroke();ctx.font='16px sans-serif';ctx.fillStyle='white';ctx.fillText(h.name,h.x,h.y)});ctx.restore();
}
function draw(now){
  if(!S.started)return;
  const info=MAP_INFO[S.map],cam=camera();
  ctx.setTransform(1,0,0,1,0,0);
  ctx.clearRect(0,0,viewport.w,viewport.h);
  // Preserve the background's native proportions; move a 16:9 / 3:4 camera,
  // rather than stretching a whole 3:2 map into a widescreen canvas.
  ctx.save();
  const scale=viewport.w/cam.w;
  ctx.setTransform(scale,0,0,scale,-cam.x*scale,-cam.y*scale);
  const bg=images[S.map];
  if(bg.complete&&bg.naturalWidth){ctx.imageSmoothingEnabled=true;ctx.drawImage(bg,0,0,info.w,info.h);}
  drawLockerX();drawNearMarkers(now);drawCharacters();
  if(S.map==='classroom'&&!S.explored&&!S.stage1Clear)drawLights();
  if(S.map==='artroom'&&(!S.artroomUnlocked||S.failureDark||now-S.artroomRevealAt<900))drawArtroomDarkness(now);
  if(S.debug)drawDebug();
  ctx.restore();
}
function loop(time){
  const dt=Math.min((time-prevTime)/1000||0,.038);prevTime=time;
  update(dt);draw(time);requestAnimationFrame(loop);
}
// Pointer input: click hotspots to walk to them, then investigate.
canvas.addEventListener('click',(e)=>{
  if(!S.started||S.transitioning||isOverlayOpen())return;
  dismissMoveMenu();
  if(S.dlg)return;
  const {x,y}=pointerToWorld(e);
  const hit=hitTest(x,y);
  if(hit){if(S.map==='classroom'&&!S.explored){toast('먼저 교실을 둘러보세요.');return;}walkTo(hit.go[0],hit.go[1],hit.act);return;}
  if(S.map==='classroom'&&!S.explored){toast('먼저 교실을 둘러보세요.');return;}
  if(!collision(x,y)){walkTo(x,y,()=>{});}else toast('이곳으로는 이동할 수 없습니다.',1100);
});
canvas.addEventListener('mousemove',e=>{
  if(S.dlg||!S.started||isOverlayOpen()){canvas.style.cursor='default';return;}
  const {x,y}=pointerToWorld(e);
  canvas.style.cursor=hitTest(x,y)?'pointer':'crosshair';
});
function nearestAction(){
  if(S.dlg||isOverlayOpen()||!S.started)return;
  let best=null,d=Infinity;
  for(const h of hotspots()){
    const dd=len(h.go[0],h.go[1],S.px,S.py);
    if(dd<160&&dd<d){d=dd;best=h;}
  }
  if(best)best.act();else if(S.map==='classroom'&&S.explored)exploreMenu();else toast('주변에 조사할 사물이 없습니다.');
}
const directionFromKey=(e)=>({ArrowUp:'ArrowUp',ArrowDown:'ArrowDown',ArrowLeft:'ArrowLeft',ArrowRight:'ArrowRight',KeyW:'ArrowUp',KeyS:'ArrowDown',KeyA:'ArrowLeft',KeyD:'ArrowRight'})[e.code]||null;
window.addEventListener('keydown',e=>{
  const typ=['INPUT','TEXTAREA'].includes(document.activeElement?.tagName);
  if(e.key==='Escape'){
    if(!$('endingOverlay').classList.contains('hidden'))return;
    const shown=['inventoryOverlay','lockerOverlay','lockOverlay','rosterOverlay'].find(id=>!$(id).classList.contains('hidden'));
    if(shown){cancelModal(shown);e.preventDefault();return;}
    if(S.map==='stairs'&&S.dlg){closeDialog();toast('아래쪽 출입구로 이동하면 복도로 돌아갈 수 있습니다.');e.preventDefault();return;}
    if(S.dlg?.kind==='pages'){skipDialogue();e.preventDefault();return;}
    if(S.dlg?.kind==='choices'){closeDialog();e.preventDefault();return;}
  }
  if(typ)return;
  const direction=directionFromKey(e);
  if(direction){
    dismissMoveMenu();
    // No movement while pages or important narrative choices are visible.
    if(!S.dlg){pressed.delete(direction);pressed.add(direction);}
    e.preventDefault();return;
  }
  if(e.key==='Enter'||e.key===' '){
    if(S.dlg?.kind==='pages')nextDialogue();
    else if(!S.dlg)nearestAction();
    e.preventDefault();return;
  }
  if(/^([1-9])$/.test(e.key)&&S.dlg?.kind==='choices'){
    const i=Number(e.key)-1;if(S.dlg.entries[i]){const a=S.dlg.entries[i].action;closeDialog();a();}
  }
  if(e.key==='F2'){S.debug=!S.debug;toast(S.debug?'충돌 영역 표시 켜짐':'충돌 영역 표시 꺼짐');e.preventDefault();}
});
window.addEventListener('keyup',e=>{
  const direction=directionFromKey(e);if(direction)pressed.delete(direction);
});
window.addEventListener('blur',()=>{pressed.clear();S.mobileKeys.clear();});
$('startButton').onclick=startGame;
$('nextButton').onclick=nextDialogue;
$('skipButton').onclick=skipDialogue;
$('inventoryButton').onclick=showInventory;
$('rosterPeek').onclick=()=>$('rosterOverlay').classList.remove('hidden');
$('musicButton').onclick=()=>{
  S.muted=!S.muted;
  $('musicLabel').textContent=S.muted?' 음악 꺼짐':' 음악 켜짐';
  $('musicButton').setAttribute('aria-label',S.muted?'음악 켜기':'음악 끄기');
  if(S.muted){bgm.pause();stairSound.pause();}
  else tryPlayMusic();
};
$('lockForm').addEventListener('submit',e=>{
  e.preventDefault();const pin=$('lockPin').value.trim();
  if(!/^\d{4}$/.test(pin)){toast('숫자 네 자리를 입력하세요.');return;}
  $('lockOverlay').classList.add('hidden');
  if(pin==='3437')unlockClass();else wrongPin();
});
$('lockPin').addEventListener('input',e=>{e.target.value=e.target.value.replace(/\D/g,'').slice(0,4);});
$('lockSkip').onclick=()=>cancelModal('lockOverlay');
$('replayButton').onclick=()=>{hideAllOverlays();bgm.currentTime=0;startGame();};
for(const b of document.querySelectorAll('.close-overlay'))b.addEventListener('click',()=>cancelModal(b.dataset.close));
for(const b of document.querySelectorAll('.mobile-pad [data-dir]')){
  b.addEventListener('pointerdown',e=>{e.preventDefault();dismissMoveMenu();S.mobileKeys.add(b.dataset.dir);try{b.setPointerCapture(e.pointerId);}catch{}});
  const up=()=>S.mobileKeys.delete(b.dataset.dir);
  b.addEventListener('pointerup',up);b.addEventListener('pointercancel',up);b.addEventListener('lostpointercapture',up);
}
$('touchAction').onclick=()=>{if(S.dlg?.kind==='pages')nextDialogue();else nearestAction();};
$('leaveLockersButton').onclick=()=>cancelModal('lockerOverlay');
window.addEventListener('resize',configureCanvas);
window.addEventListener('orientationchange',configureCanvas);
// Public read-only diagnostic data for future stage integration and smoke tests.
window.BAEKSEOK_DEBUG={state:S,MAP_INFO,ROSTER,visitLocker:investigateLocker,showLock:openLock,enterStairs,returnToHall,enterArtroom,artroomItemChoices,tryArtroomItem,meetTaeha,ascendStairs,togetherEnding,returnToStairs,follow:updateTaehaFollower,walkTo,findPath,collision};
requestAnimationFrame(loop);
})();

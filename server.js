const express=require('express');
const http=require('http');
const {Server}=require('socket.io');
const path=require('path');
const app=express(); const server=http.createServer(app); const io=new Server(server);
app.use(express.static(path.join(__dirname,'public')));
const MAX_PLAYERS=10;
const WINNING_KANIN=7;
const KAKAIN_NA_THRESHOLD=20;
const FAMILY=[{name:'Tatay',emoji:'👨',pref:'Baboy'},{name:'Nanay',emoji:'👩',pref:'Kangkong'},{name:'Ate',emoji:'👧',pref:'Kamatis'},{name:'Kuya',emoji:'👦',pref:'Sampalok'},{name:'Bunso',emoji:'🧒',pref:'Hipon'},{name:"Lolo't Lola",emoji:'👴👵',pref:'Gabi'},{name:'Marites',emoji:'🧐',pref:null}];
const ING={Baboy:'🥩',Hipon:'🦐',Gabi:'🍠',Sampalok:'🟤',Kangkong:'🥬',Sili:'🌶️',Kamatis:'🍅'};
const DECK=['Baboy','Baboy','Hipon','Hipon','Gabi','Gabi','Gabi','Gabi','Gabi','Sampalok','Sampalok','Sampalok','Kangkong','Kangkong','Kangkong','Kamatis','Kamatis','Kamatis','Sili','Sili'];
const rooms=new Map();
function shuffle(a){for(let i=a.length-1;i>0;i--){let j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
function deck(){return shuffle(DECK.map((name,i)=>({id:Date.now()+'-'+i+'-'+Math.random(),name,emoji:ING[name]})))}
function room(code){return {code,players:[],pot:[],family:FAMILY.map(x=>({...x,isFed:false})),deck:[],current:0,round:0,phase:'lobby',winner:null,log:[],lastResult:null}}
function log(r,x){r.log.unshift(x);r.log=r.log.slice(0,50)}
function state(r,sid){return {code:r.code,round:r.round,phase:r.phase,current:r.current,players:r.players.map(p=>({id:p.id,name:p.name,vp:p.vp,connected:!!io.sockets.sockets.get(p.socketId)})),potCount:r.pot.length,family:r.family.map(m=>({name:m.name,emoji:m.emoji,pref:m.pref,isFed:m.isFed})),myHand:r.players.find(p=>p.socketId===sid)?.hand||null,winner:r.winner,log:r.log,lastResult:r.lastResult}}
function broadcast(r){r.players.forEach(p=>io.to(p.socketId).emit('state',state(r,p.socketId)))}
function draw(r){let p=r.players[r.current];if(!p||p.hand||r.phase!=='turn')return;if(!r.deck.length)r.deck=deck();p.hand=r.deck.pop();log(r,p.name+' drew a hidden card.')}
function startRound(r){r.round++;r.phase='turn';r.pot=[];r.family=FAMILY.map(x=>({...x,isFed:false}));r.deck=deck();r.lastResult=null;r.players.forEach(p=>p.hand=null);log(r,`Round ${r.round} started. ${r.players[r.current].name} goes first.`);draw(r)}
function score(r,idx){
 r.phase='resolving';
 const steals=[];
 r.family.forEach(m=>{if(!m.isFed&&m.pref){let i=r.pot.findIndex(c=>c.name===m.pref);if(i>=0){let c=r.pot.splice(i,1)[0];steals.push(`${m.name} ate ${c.name}`)}}});
 const c={};r.pot.forEach(x=>c[x.name]=(c[x.name]||0)+1);
 let s=0,b=[];
 const baboy=c.Baboy||0, hipon=c.Hipon||0;
 if(baboy===2&&hipon===2){s-=10;b.push('Baboy + Hipon: 2 Baboy + 2 Hipon = -10')}
 else if(baboy===2&&hipon===1){s+=8;b.push('Baboy + Hipon: 2 Baboy + 1 Hipon = 8 (10 - 2)')}
 else if(baboy===1&&hipon===2){s+=5;b.push('Baboy + Hipon: 1 Baboy + 2 Hipon = 5 (8 - 3)')}
 else if(baboy===1&&hipon===1){b.push('Baboy + Hipon: 1 Baboy + 1 Hipon = 0')}
 else if(baboy===2){s+=10;b.push('Baboy: 5 + 5 = 10')}
 else if(baboy===1){s+=5;b.push('Baboy: 5 points')}
 else if(hipon===2){s+=8;b.push('Hipon: 4 + 4 = 8')}
 else if(hipon===1){s+=4;b.push('Hipon: 4 points')}
 const gabi=c.Gabi||0;if(gabi){let p=Math.pow(2,gabi);s+=p;b.push(`Gabi: 2${' × 2'.repeat(gabi-1)} = ${p}`)}
 const sa=c.Sampalok||0;if(sa===1||sa===2){s+=6;b.push(`Sampalok: ${sa} card${sa>1?'s':''} = 6`)}else if(sa>=3)b.push('Sampalok: 3 cards = 0');
 const ka=c.Kangkong||0;if(ka){let p=ka*3;s+=p;b.push(`Kangkong: ${Array(ka).fill('3').join(' + ')} = ${p}`)}
 const km=c.Kamatis||0;if(km){let p=km*2;s+=p;b.push(`Kamatis: ${Array(km).fill('2').join(' + ')} = ${p}`)}
 const si=c.Sili||0;if(si){let p=si*3;s-=p;b.push(`Sili: -${p}`)}
 const m=r.family.find(x=>x.name==='Marites');if(m&&!m.isFed){if(baboy){s-=3;b.push('Marites: -3 (Baboy is in the Sinigang)')}else{s+=3;b.push('Marites: +3 (No Baboy in the Sinigang)')}}
 steals.forEach(x=>log(r,'Kupit: '+x));
 let caller=r.players[idx],rw=null;if(s>=KAKAIN_NA_THRESHOLD){caller.vp=Math.min(WINNING_KANIN,caller.vp+2);rw=caller.name;log(r,caller.name+' won the round.')}else{r.players.forEach((p,i)=>{if(i!==idx)p.vp=Math.min(WINNING_KANIN,p.vp+1)});log(r,caller.name+' lost the round.')}
 let w=r.players.find(p=>p.vp>=WINNING_KANIN);r.winner=w?.name||null;r.phase=w?'gameover':'result';const cardSummary=[];
 if(baboy||hipon){
   let label='',points=0;
   if(baboy===2&&hipon===2){label='2 Baboy + 2 Hipon';points=-10}
   else if(baboy===2&&hipon===1){label='2 Baboy + 1 Hipon';points=8}
   else if(baboy===1&&hipon===2){label='1 Baboy + 2 Hipon';points=5}
   else if(baboy===1&&hipon===1){label='1 Baboy + 1 Hipon';points=0}
   else if(baboy===2){label='2 Baboy';points=10}
   else if(baboy===1){label='1 Baboy';points=5}
   else if(hipon===2){label='2 Hipon';points=8}
   else if(hipon===1){label='1 Hipon';points=4}
   let calc='';
   if(baboy===2&&hipon===2) calc='10 − 2 − 3 = −10 (special combination)';
   else if(baboy===2&&hipon===1) calc='10 − 2 = 8';
   else if(baboy===1&&hipon===2) calc='8 − 3 = 5';
   else if(baboy===1&&hipon===1) calc='5 − 5 = 0';
   else if(baboy===2) calc='5 + 5 = 10';
   else if(baboy===1) calc='5 points';
   else if(hipon===2) calc='4 + 4 = 8';
   else if(hipon===1) calc='4 points';
   cardSummary.push({label,emoji:'🥩🦐',points,calc});
 }
 if(gabi) cardSummary.push({label:`${gabi} Gabi`,emoji:ING.Gabi,points:Math.pow(2,gabi),calc:`2${' × 2'.repeat(gabi-1)} = ${Math.pow(2,gabi)}`});
 if(sa) cardSummary.push({label:`${sa} Sampalok`,emoji:ING.Sampalok,points:(sa===1||sa===2)?6:0,calc:(sa===1||sa===2)?`${sa} card${sa>1?'s':''} = 6`:'3 cards = 0'});
 if(ka) cardSummary.push({label:`${ka} Kangkong`,emoji:ING.Kangkong,points:ka*3,calc:`${Array(ka).fill('3').join(' + ')} = ${ka*3}`});
 if(km) cardSummary.push({label:`${km} Kamatis`,emoji:ING.Kamatis,points:km*2,calc:`${Array(km).fill('2').join(' + ')} = ${km*2}`});
 if(si) cardSummary.push({label:`${si} Sili`,emoji:ING.Sili,points:-(si*3),calc:`${si===1?'-3':Array(si).fill('-3').join(' + ')} = ${-(si*3)}`});
 if(m&&!m.isFed) cardSummary.push({label:'Marites bonus',emoji:m.emoji,points:baboy?-3:3,calc:baboy?'−3 (Baboy remains)':' +3 (No Baboy remains)'});
 r.lastResult={score:s,threshold:KAKAIN_NA_THRESHOLD,breakdown:b,cards:cardSummary,steals,roundWinner:rw,winner:r.winner};return r.lastResult
}

io.on('connection',s=>{
 s.on('createRoom',({name},cb)=>{let code;do{code=Math.random().toString(36).slice(2,7).toUpperCase()}while(rooms.has(code));let r=room(code);r.players.push({id:s.id,name:(name||'Player 1').slice(0,18),socketId:s.id,vp:0,hand:null});rooms.set(code,r);s.join(code);cb({ok:true,code});broadcast(r)});
 s.on('joinRoom',({code,name},cb)=>{code=(code||'').trim().toUpperCase();let r=rooms.get(code);if(!r)return cb({ok:false,error:'Room not found.'});if(r.phase!=='lobby')return cb({ok:false,error:'That game has already started.'});if(r.players.length>=MAX_PLAYERS)return cb({ok:false,error:'Room is full (10 players maximum).'});r.players.push({id:s.id,name:(name||`Player ${r.players.length+1}`).slice(0,18),socketId:s.id,vp:0,hand:null});s.join(code);cb({ok:true,code});broadcast(r)});
 s.on('startGame',({code},cb)=>{let r=rooms.get(code);if(!r)return cb?.({ok:false,error:'Room not found.'});if(r.players[0].socketId!==s.id)return cb?.({ok:false,error:'Only the host can start.'});if(r.players.length<2)return cb?.({ok:false,error:'Need at least 2 players.'});r.current=0;startRound(r);cb?.({ok:true});broadcast(r)});
 s.on('putInPot',({code},cb)=>{let r=rooms.get(code),p=r&&r.players[r.current];if(!r||r.phase!=='turn'||!p||p.socketId!==s.id||!p.hand)return; r.pot.push(p.hand);p.hand=null;log(r,p.name+' placed a card face-down in the pot.');r.current=(r.current+1)%r.players.length;draw(r);broadcast(r);cb?.({ok:true})});
 s.on('feedFamily',({code,index},cb)=>{let r=rooms.get(code),p=r&&r.players[r.current],m=r&&r.family[index];if(!r||r.phase!=='turn'||!p||p.socketId!==s.id||!p.hand)return;if(!m||m.isFed)return cb?.({ok:false,error:'That family member is already fed.'});m.isFed=true;p.hand=null;log(r,p.name+' fed '+m.name+'.');r.current=(r.current+1)%r.players.length;draw(r);broadcast(r);cb?.({ok:true})});
 s.on('kakainNa',({code},cb)=>{let r=rooms.get(code);if(!r||r.phase!=='turn')return;let idx=r.players.findIndex(p=>p.socketId===s.id);if(idx<0)return;let p=r.players[idx];if(p.hand){r.deck.push(p.hand);p.hand=null}let result=score(r,idx);r.players.forEach(x=>io.to(x.socketId).emit('result',result));broadcast(r);cb?.({ok:true})});
 s.on('nextRound',({code},cb)=>{let r=rooms.get(code);if(!r||r.phase!=='result')return;r.current=(r.current+1)%r.players.length;startRound(r);cb?.({ok:true});broadcast(r)});
 s.on('disconnect',()=>{for(const r of rooms.values()){let p=r.players.find(x=>x.socketId===s.id);if(p){log(r,p.name+' disconnected.');broadcast(r)}}});
});
const PORT=process.env.PORT||3000;server.listen(PORT,'0.0.0.0',()=>console.log('Sinigang Online on '+PORT));

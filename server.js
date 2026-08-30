const express=require('express');
const http=require('http');
const {Server}=require('socket.io');
const path=require('path');
const app=express(); const server=http.createServer(app); const io=new Server(server);
app.use(express.static(path.join(__dirname,'public')));
const MAX_PLAYERS=8;
const FAMILY=[{name:'Tatay',emoji:'👨',pref:'Baboy'},{name:'Nanay',emoji:'👩',pref:null},{name:'Ate',emoji:'👧',pref:null},{name:'Kuya',emoji:'👦',pref:null},{name:'Lola',emoji:'👵',pref:null},{name:'Atrimitidang Kapitbahay',emoji:'🧐',pref:null}];
const ING={Baboy:'🥩',Hipon:'🦐',Gabi:'🍠',Sampalok:'🟤',Kangkong:'🥬',Sili:'🌶️',Kamatis:'🍅'};
const DECK=['Baboy','Baboy','Hipon','Hipon','Gabi','Gabi','Gabi','Sampalok','Sampalok','Kangkong','Kangkong','Sili','Sili','Kamatis','Kamatis','Kamatis'];
const rooms=new Map();
function shuffle(a){for(let i=a.length-1;i>0;i--){let j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
function deck(){return shuffle(DECK.map((name,i)=>({id:Date.now()+'-'+i+'-'+Math.random(),name,emoji:ING[name]})))}
function room(code){return {code,players:[],pot:[],family:FAMILY.map(x=>({...x,isFed:false})),deck:[],current:0,round:0,phase:'lobby',winner:null,log:[],lastResult:null}}
function log(r,x){r.log.unshift(x);r.log=r.log.slice(0,50)}
function state(r,sid){return {code:r.code,round:r.round,phase:r.phase,current:r.current,players:r.players.map(p=>({id:p.id,name:p.name,vp:p.vp,connected:!!io.sockets.sockets.get(p.socketId)})),potCount:r.pot.length,family:r.family.map(m=>({name:m.name,emoji:m.emoji,pref:m.pref,isFed:m.isFed})),myHand:r.players.find(p=>p.socketId===sid)?.hand||null,winner:r.winner,log:r.log,lastResult:r.lastResult}}
function broadcast(r){r.players.forEach(p=>io.to(p.socketId).emit('state',state(r,p.socketId)))}
function draw(r){let p=r.players[r.current];if(!p||p.hand||r.phase!=='turn')return;if(!r.deck.length)r.deck=deck();p.hand=r.deck.pop();log(r,p.name+' drew a hidden card.')}
function startRound(r){r.round++;r.phase='turn';r.pot=[];r.family=FAMILY.map(x=>({...x,isFed:false}));r.deck=deck();r.lastResult=null;r.players.forEach(p=>p.hand=null);log(r,`Round ${r.round} started. ${r.players[r.current].name} goes first.`);draw(r)}
function score(r,idx){r.phase='resolving';const steals=[];r.family.forEach(m=>{if(!m.isFed&&m.pref){let i=r.pot.findIndex(c=>c.name===m.pref);if(i>=0){let c=r.pot.splice(i,1)[0];steals.push(`${m.name} took ${c.name}`)}}});const c={};r.pot.forEach(x=>c[x.name]=(c[x.name]||0)+1);let s=0,b=[];let g=c.Gabi||0;if(g===1){s+=1;b.push('Gabi +1')}else if(g===2){s+=4;b.push('Gabi +4')}else if(g>=3){s+=9;b.push('Gabi +9')}let sa=c.Sampalok||0;if(sa===1){s+=6;b.push('Sampalok +6')}else if(sa>=2){s+=1;b.push('Sampalok +1')}let si=c.Sili||0;if(si){s-=si;b.push(`Sili -${si}`)}let n=r.family.find(x=>x.name==='Atrimitidang Kapitbahay');if(n&&!n.isFed){if(c.Baboy){s-=3;b.push('Kapitbahay -3')}else{s+=3;b.push('Kapitbahay +3')}}steals.forEach(x=>log(r,'Kupit: '+x));let caller=r.players[idx],rw=null;if(s>=12){caller.vp=Math.min(5,caller.vp+2);rw=caller.name;log(r,caller.name+' won the round.')}else{r.players.forEach((p,i)=>{if(i!==idx)p.vp=Math.min(5,p.vp+1)});log(r,caller.name+' lost the round.')}let w=r.players.find(p=>p.vp>=5);r.winner=w?.name||null;r.phase=w?'gameover':'result';r.lastResult={score:s,breakdown:b,roundWinner:rw,winner:r.winner};return r.lastResult}
io.on('connection',s=>{
 s.on('createRoom',({name},cb)=>{let code;do{code=Math.random().toString(36).slice(2,7).toUpperCase()}while(rooms.has(code));let r=room(code);r.players.push({id:s.id,name:(name||'Player 1').slice(0,18),socketId:s.id,vp:0,hand:null});rooms.set(code,r);s.join(code);cb({ok:true,code});broadcast(r)});
 s.on('joinRoom',({code,name},cb)=>{code=(code||'').trim().toUpperCase();let r=rooms.get(code);if(!r)return cb({ok:false,error:'Room not found.'});if(r.phase!=='lobby')return cb({ok:false,error:'That game has already started.'});if(r.players.length>=MAX_PLAYERS)return cb({ok:false,error:'Room is full (8 players maximum).'});r.players.push({id:s.id,name:(name||`Player ${r.players.length+1}`).slice(0,18),socketId:s.id,vp:0,hand:null});s.join(code);cb({ok:true,code});broadcast(r)});
 s.on('startGame',({code},cb)=>{let r=rooms.get(code);if(!r)return cb?.({ok:false,error:'Room not found.'});if(r.players[0].socketId!==s.id)return cb?.({ok:false,error:'Only the host can start.'});if(r.players.length<2)return cb?.({ok:false,error:'Need at least 2 players.'});r.current=0;startRound(r);cb?.({ok:true});broadcast(r)});
 s.on('putInPot',({code},cb)=>{let r=rooms.get(code),p=r&&r.players[r.current];if(!r||r.phase!=='turn'||!p||p.socketId!==s.id||!p.hand)return; r.pot.push(p.hand);p.hand=null;log(r,p.name+' placed a card face-down in the pot.');r.current=(r.current+1)%r.players.length;draw(r);broadcast(r);cb?.({ok:true})});
 s.on('feedFamily',({code,index},cb)=>{let r=rooms.get(code),p=r&&r.players[r.current],m=r&&r.family[index];if(!r||r.phase!=='turn'||!p||p.socketId!==s.id||!p.hand)return;if(!m||m.isFed)return cb?.({ok:false,error:'That family member is already fed.'});m.isFed=true;p.hand=null;log(r,p.name+' fed '+m.name+'.');r.current=(r.current+1)%r.players.length;draw(r);broadcast(r);cb?.({ok:true})});
 s.on('kakainNa',({code},cb)=>{let r=rooms.get(code);if(!r||r.phase!=='turn')return;let idx=r.players.findIndex(p=>p.socketId===s.id);if(idx<0)return;let p=r.players[idx];if(p.hand){r.deck.push(p.hand);p.hand=null}let result=score(r,idx);r.players.forEach(x=>io.to(x.socketId).emit('result',result));broadcast(r);cb?.({ok:true})});
 s.on('nextRound',({code},cb)=>{let r=rooms.get(code);if(!r||r.phase!=='result')return;r.current=(r.current+1)%r.players.length;startRound(r);cb?.({ok:true});broadcast(r)});
 s.on('disconnect',()=>{for(const r of rooms.values()){let p=r.players.find(x=>x.socketId===s.id);if(p){log(r,p.name+' disconnected.');broadcast(r)}}});
});
const PORT=process.env.PORT||3000;server.listen(PORT,'0.0.0.0',()=>console.log('Sinigang Online on '+PORT));

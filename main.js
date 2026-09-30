import * as THREE from 'three';
import { MarchingCubes } from 'three/addons/objects/MarchingCubes.js';

const canvas=document.querySelector('#scene');
const stateEl=document.querySelector('#state');
const energyEl=document.querySelector('#energy');
const tensionEl=document.querySelector('#tension');
const memoryEl=document.querySelector('#memory');
const breathEl=document.querySelector('#breath');
const repeatEl=document.querySelector('#repeat');
const overloadEl=document.querySelector('#overload');
const arpEl=document.querySelector('#arp');

const renderer=new THREE.WebGLRenderer({canvas,antialias:true,preserveDrawingBuffer:false});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.setSize(innerWidth,innerHeight);
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.28;

const scene=new THREE.Scene();
scene.background=new THREE.Color(0xe9e8e3);
scene.fog=new THREE.Fog(0xe9e8e3,7.5,14);

const camera=new THREE.PerspectiveCamera(36,innerWidth/innerHeight,.1,100);
camera.position.set(0,0,7.4);
camera.lookAt(0,0,0);

scene.add(new THREE.HemisphereLight(0xffffff,0x77756f,2.8));
const key=new THREE.PointLight(0xffffff,52,16);
key.position.set(2.8,3.2,4.5);
scene.add(key);
const rim=new THREE.PointLight(0xd9e0ec,30,13);
rim.position.set(-4,1.4,2);
scene.add(rim);
const back=new THREE.PointLight(0xffffff,38,14);
back.position.set(1,-3.2,-3);
scene.add(back);

const organism={
  energy:.04,tension:.025,memory:0,breathPhase:0,bpm:72,
  lastNote:null,repeat:0,lastInteraction:-Infinity,
  overload:0,orientation:new THREE.Vector3(),targetOrientation:new THREE.Vector3(),
  impulses:[],waves:[],scars:[],arpeggiator:false,arpIndex:0,arpTimer:0,
  awakening:0,cohesion:1
};

let audioContext=null,master=null;
function ensureAudio(){
  if(audioContext){
    if(audioContext.state!=='running')audioContext.resume().catch(()=>{});
    return;
  }
  const AudioCtx=window.AudioContext||window.webkitAudioContext;
  if(!AudioCtx)return;
  audioContext=new AudioCtx();
  master=audioContext.createGain();
  master.gain.value=.34;
  const compressor=audioContext.createDynamicsCompressor();
  compressor.threshold.value=-20;
  compressor.knee.value=14;
  compressor.ratio.value=4;
  compressor.attack.value=.004;
  compressor.release.value=.22;
  master.connect(compressor).connect(audioContext.destination);
  audioContext.resume().catch(()=>{});
}
function freq(n){return 440*Math.pow(2,(n-69)/12)}
function tone(n,v=.8){
  ensureAudio();
  if(!audioContext||!master)return;
  const t=audioContext.currentTime;
  const root=audioContext.createOscillator();
  const body=audioContext.createOscillator();
  const filter=audioContext.createBiquadFilter();
  const g=audioContext.createGain();
  root.type='sine';
  body.type='triangle';
  root.frequency.value=freq(n)*.5;
  body.frequency.value=freq(n);
  filter.type='lowpass';
  filter.frequency.setValueAtTime(900+organism.tension*900,t);
  filter.Q.value=1.1;
  g.gain.setValueAtTime(.0001,t);
  g.gain.exponentialRampToValueAtTime(Math.max(.018,v*.16),t+.018);
  g.gain.exponentialRampToValueAtTime(.0001,t+.55);
  root.connect(filter);
  body.connect(filter);
  filter.connect(g).connect(master);
  root.start(t);body.start(t);
  root.stop(t+.6);body.stop(t+.6);
}

const material=new THREE.MeshPhysicalMaterial({
  color:0x050607,
  metalness:1,
  roughness:.075,
  clearcoat:1,
  clearcoatRoughness:.025,
  transmission:0,
  transparent:false,
  opacity:1,
  side:THREE.FrontSide
});

const slime=new MarchingCubes(64,material,false,false,50000);
slime.isolation=.58;
slime.scale.setScalar(2.05);
slime.position.set(0,0,0);
slime.frustumCulled=false;
scene.add(slime);

const fieldBalls=[
  {p:new THREE.Vector3(-.16,.05,0),s:1.15},
  {p:new THREE.Vector3(.17,-.02,.02),s:1.13},
  {p:new THREE.Vector3(0,.16,-.08),s:1.02},
  {p:new THREE.Vector3(0,-.18,.08),s:1.00}
];
const scarAnchors=[];
function addScar(strength=.8){
  const a=Math.random()*Math.PI*2;
  const z=Math.random()*2-1;
  const r=Math.sqrt(Math.max(0,1-z*z));
  const dir=new THREE.Vector3(r*Math.cos(a),z,r*Math.sin(a)).normalize();
  scarAnchors.push({dir,life:1,strength});
  if(scarAnchors.length>28)scarAnchors.shift();
}
function wake(){
  addScar(.95);
  organism.awakening=1;
}

function note(n,v=.85,source='clavier'){
  ensureAudio();
  const now=performance.now()/1000;
  const quiet=now-organism.lastInteraction>60;
  organism.lastInteraction=now;
  organism.repeat=organism.lastNote===n?organism.repeat+1:1;
  organism.lastNote=n;
  organism.energy=Math.min(1.6,organism.energy+v*.48);
  organism.tension=Math.min(1.6,organism.tension+v*.3);
  organism.memory=Math.min(1,organism.memory+.014);
  if(quiet)wake();

  if(organism.repeat>=4){
    organism.overload=Math.min(1.5,organism.overload+.95);
    organism.tension=Math.min(1.6,organism.tension+.58);
    organism.cohesion=Math.max(.42,organism.cohesion-.18);
  }

  const a=n*.31+organism.memory*17+organism.tension*4;
  const p=n*.13+organism.energy*2.7;
  organism.impulses.push({
    d:new THREE.Vector3(Math.cos(a)*Math.cos(p),Math.sin(p),Math.sin(a)*Math.cos(p)).normalize(),
    s:.35+v,age:0
  });
  organism.waves.push({r:0,s:.42+v,age:0,axis:new THREE.Vector3().randomDirection()});
  if(organism.impulses.length>24)organism.impulses.shift();
  if(organism.waves.length>18)organism.waves.shift();
  addScar(.16+v*.24);
  tone(n,v);
  stateEl.textContent=organism.repeat>=4?'SURCHARGE':'PERTURBATION · '+source.toUpperCase();
}

const keys={a:60,z:62,e:64,r:65,t:67,y:69,u:71,q:72,s:74,d:76,f:77,g:79,h:81,j:83};
const held=new Set();

addEventListener('keydown',e=>{
  if(e.repeat)return;
  if(e.code==='Space'){
    e.preventDefault();
    organism.arpeggiator=!organism.arpeggiator;
    ensureAudio();
    return;
  }
  const n=keys[e.key.toLowerCase()];
  if(n==null)return;
  held.add(e.key.toLowerCase());
  note(n,.9);
});
addEventListener('keyup',e=>held.delete(e.key.toLowerCase()));
addEventListener('blur',()=>held.clear());

if(navigator.requestMIDIAccess){
  navigator.requestMIDIAccess().then(a=>{
    for(const input of a.inputs.values()){
      input.onmidimessage=e=>{
        const [s,n,v]=e.data,c=s&0xf0;
        if(c===0x90&&v>0)note(n,v/127,'MIDI');
      };
    }
  }).catch(()=>{});
}

const arp=[60,64,67,72];
const clock=new THREE.Clock();
let elapsed=0;
const tmp=new THREE.Vector3();

function updateChord(){
  const notes=[...held].map(k=>keys[k]).filter(Boolean);
  if(notes.length<2)return;
  const spread=Math.max(...notes)-Math.min(...notes);
  const sum=notes.reduce((a,n)=>a+n,0);
  const gain=.005+organism.tension*.009;
  organism.targetOrientation.x+=Math.sin(sum*.07)*gain;
  organism.targetOrientation.y+=Math.cos(spread*.31)*gain*1.2;
  organism.targetOrientation.z+=Math.sin(spread*.19)*gain;
  organism.targetOrientation.clampLength(0,.42);
}
setInterval(updateChord,45);

function updateField(){
  slime.reset();

  const breath=Math.sin(organism.breathPhase)*.5+.5;
  const stress=Math.min(1,organism.tension*.6+organism.overload*.9);
  const activity=Math.min(1.4,organism.energy+organism.tension*.65);
  const overload=Math.min(1,organism.overload);

  for(let i=0;i<fieldBalls.length;i++){
    const b=fieldBalls[i];
    const p=b.p.clone();
    const phase=elapsed*(.12+i*.025);
    p.x+=Math.sin(phase+i*2.1)*(.035+stress*.055);
    p.y+=Math.cos(phase*.83+i)*(.025+breath*.035);
    p.z+=Math.sin(phase*.71+i*.7)*(.03+activity*.04);
    b.p.lerp(p,1);
    const strength=b.s*(1+breath*.035+activity*.06-overload*.08);
    slime.addBall(b.p.x,b.p.y,b.p.z,strength,12);
  }

  const micro=.035+organism.memory*.045+stress*.045;
  const noiseDirections=[
    new THREE.Vector3(1,.2,.4).normalize(),
    new THREE.Vector3(-.3,1,.15).normalize(),
    new THREE.Vector3(.2,-.25,1).normalize(),
    new THREE.Vector3(-.7,.35,-.5).normalize()
  ];

  for(const impulse of organism.impulses){
    impulse.age+=.016;
    impulse.s*=Math.exp(-.9*.016);
    tmp.copy(impulse.d);
    const travel=Math.min(1.55,impulse.age*(.72+organism.tension*.7));
    const pulse=.5+.5*Math.sin(impulse.age*8.5);
    tmp.multiplyScalar(travel*.72);
    const strength=Math.max(.05,impulse.s)*(.28+pulse*.18);
    slime.addBall(tmp.x,tmp.y,tmp.z,strength,18);
    slime.addBall(-tmp.x*.35,-tmp.y*.35,-tmp.z*.35,strength*.35,18);
  }

  for(const w of organism.waves){
    w.age+=.016;
    w.r+=.016*(.9+w.s);
    w.s*=Math.exp(-.45*.016);
    const axis=w.axis;
    const ring=w.r*.65;
    const phase=elapsed*1.7+w.age*2.4;
    const x=Math.cos(phase)*ring*axis.z+Math.sin(phase)*ring*.45;
    const y=Math.sin(phase*.83)*ring*.55;
    const z=Math.sin(phase)*ring*axis.x;
    slime.addBall(x,y,z,w.s*.22,20);
    slime.addBall(-x*.7,-y*.45,-z*.7,w.s*.13,20);
  }

  for(const scar of scarAnchors){
    scar.life*=Math.exp(-.004);
    const persistent=.05+organism.memory*.16;
    const amount=(scar.strength*.11+persistent)*scar.life;
    const d=scar.dir;
    slime.addBall(d.x*(1.05+amount*2.5),d.y*(1.05+amount*2.5),d.z*(1.05+amount*2.5),amount,17);
  }

  for(let i=0;i<noiseDirections.length;i++){
    const d=noiseDirections[i];
    const phase=elapsed*(.15+i*.06)+organism.memory*8+i;
    const amount=micro*(.45+.55*Math.sin(phase));
    slime.addBall(d.x*.82,d.y*.82,d.z*.82,amount,22);
  }

  if(organism.awakening>0){
    const wakeDir=new THREE.Vector3(Math.sin(organism.memory*17),.55,Math.cos(organism.tension*9)).normalize();
    const a=organism.awakening;
    slime.addBall(wakeDir.x*(.95+a*.35),wakeDir.y*(.95+a*.35),wakeDir.z*(.95+a*.35),.32*a,15);
    organism.awakening=Math.max(0,organism.awakening-.016);
  }

  if(overload>.15){
    const count=4+Math.floor(overload*8);
    for(let i=0;i<count;i++){
      const a=elapsed*(1.4+i*.31)+i*2.2;
      const d=new THREE.Vector3(Math.cos(a),Math.sin(a*.73),Math.sin(a)).normalize();
      const r=.9+Math.sin(a*1.7)*.2;
      const spike=Math.max(0,overload-.15)*.12;
      slime.addBall(d.x*r,d.y*r,d.z*r,spike,10);
    }
  }

  slime.update();
}

function update(dt){
  elapsed+=dt;
  const now=performance.now()/1000;
  const silent=now-organism.lastInteraction;

  organism.breathPhase=(organism.breathPhase+dt*(organism.bpm/60/2)*Math.PI*2)%(Math.PI*2);
  organism.energy=Math.max(0,organism.energy-dt*.055);
  organism.tension=Math.max(0,organism.tension-dt*.032);
  organism.memory=Math.max(0,organism.memory-dt*.000002);
  organism.overload=Math.max(0,organism.overload-dt*.72);
  organism.cohesion=Math.min(1,organism.cohesion+dt*.025);

  const breath=Math.sin(organism.breathPhase)*.5+.5;
  const activity=Math.min(1.3,organism.energy+organism.tension*.7);
  const overload=Math.min(1,organism.overload);
  const breathe=1+breath*.022+activity*.018-overload*.025;
  slime.scale.lerp(new THREE.Vector3(2.05*breathe,2.02*breathe,2.05*breathe),1-Math.exp(-dt*2.8));

  organism.orientation.lerp(organism.targetOrientation,1-Math.exp(-dt*1.15));
  slime.rotation.set(organism.orientation.x,organism.orientation.y,organism.orientation.z);

  updateField();

  energyEl.style.width=Math.min(100,organism.energy/1.4*100)+'%';
  tensionEl.style.width=Math.min(100,organism.tension/1.4*100)+'%';
  memoryEl.style.width=Math.min(100,organism.memory*100)+'%';
  breathEl.textContent=Math.round(organism.bpm)+' BPM';
  repeatEl.textContent=organism.repeat+' / 4';
  overloadEl.style.width=Math.min(100,organism.overload/1.2*100)+'%';
  arpEl.textContent=organism.arpeggiator?'ON':'OFF';

  if(organism.overload>.35)stateEl.textContent='SURCHARGE';
  else if(silent>60)stateEl.textContent='CALME · MÉMOIRE CONSERVÉE';
  else if(organism.tension>.22)stateEl.textContent='RÉSONANCE';
  else if(organism.energy>.16)stateEl.textContent='EXCITATION';
  else stateEl.textContent='RESPIRATION · '+organism.bpm+' BPM';
}

function resize(){
  camera.aspect=innerWidth/innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth,innerHeight);
}
addEventListener('resize',resize);

renderer.setAnimationLoop(()=>{
  const dt=Math.min(clock.getDelta(),.033);
  if(organism.arpeggiator){
    organism.arpTimer+=dt;
    const step=(60/organism.bpm)/2;
    if(organism.arpTimer>=step){
      organism.arpTimer-=step;
      note(arp[organism.arpIndex++%arp.length],.42,'ARPÈGE');
    }
  }
  update(dt);
  key.position.x=Math.sin(elapsed*.18)*3.2;
  key.position.z=3.6+Math.cos(elapsed*.13)*1.2;
  renderer.render(scene,camera);
});

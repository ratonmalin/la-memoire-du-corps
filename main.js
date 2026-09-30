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

const renderer=new THREE.WebGLRenderer({canvas,antialias:true});
renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
renderer.setSize(innerWidth,innerHeight);
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.18;

const scene=new THREE.Scene();
scene.background=new THREE.Color(0xe9e8e3);

const camera=new THREE.PerspectiveCamera(35,innerWidth/innerHeight,.1,100);
camera.position.set(0,0,7.6);
camera.lookAt(0,0,0);

scene.add(new THREE.HemisphereLight(0xffffff,0x66645f,2.4));

const key=new THREE.PointLight(0xffffff,70,15);
key.position.set(3.2,3.5,4.8);
scene.add(key);

const fill=new THREE.PointLight(0xd9e0ec,34,13);
fill.position.set(-3.8,1.2,2.5);
scene.add(fill);

const rim=new THREE.PointLight(0xffffff,42,13);
rim.position.set(1.5,-3.4,-3.5);
scene.add(rim);

const organism={
  energy:.035,tension:.02,memory:0,overload:0,cohesion:1,
  breathPhase:0,bpm:72,lastInteraction:-Infinity,lastNote:null,repeat:0,
  arpeggiator:false,arpIndex:0,arpTimer:0,
  orientation:new THREE.Vector3(),targetOrientation:new THREE.Vector3(),
  waves:[],scars:[]
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
  master.gain.value=.58;
  const compressor=audioContext.createDynamicsCompressor();
  compressor.threshold.value=-18;
  compressor.knee.value=10;
  compressor.ratio.value=5;
  compressor.attack.value=.003;
  compressor.release.value=.18;
  master.connect(compressor).connect(audioContext.destination);
  audioContext.resume().catch(()=>{});
}

function frequency(midi){return 440*Math.pow(2,(midi-69)/12)}

function playNote(midi,velocity=.8){
  ensureAudio();
  if(!audioContext||!master)return;
  const now=audioContext.currentTime;
  const f=frequency(midi);
  const carrier=audioContext.createOscillator();
  const sub=audioContext.createOscillator();
  const shimmer=audioContext.createOscillator();
  const filter=audioContext.createBiquadFilter();
  const gain=audioContext.createGain();

  carrier.type='triangle';
  carrier.frequency.setValueAtTime(f,now);
  carrier.detune.setValueAtTime(organism.tension*18,now);
  sub.type='sine';
  sub.frequency.setValueAtTime(f*.5,now);
  shimmer.type='sine';
  shimmer.frequency.setValueAtTime(f*2.01,now);
  filter.type='lowpass';
  filter.frequency.setValueAtTime(1050+organism.tension*1450,now);
  filter.Q.setValueAtTime(1.8+organism.tension*2,now);
  gain.gain.setValueAtTime(.0001,now);
  gain.gain.exponentialRampToValueAtTime(.045+velocity*.24,now+.025);
  gain.gain.exponentialRampToValueAtTime(.0001,now+.72);

  carrier.connect(filter);
  sub.connect(filter);
  shimmer.connect(filter);
  filter.connect(gain).connect(master);
  carrier.start(now);sub.start(now);shimmer.start(now);
  carrier.stop(now+.76);sub.stop(now+.76);shimmer.stop(now+.76);
}

const material=new THREE.MeshPhysicalMaterial({
  color:0x040506,metalness:1,roughness:.055,clearcoat:1,clearcoatRoughness:.02,
  side:THREE.FrontSide
});

// One continuous implicit surface. Notes deform this field; they never spawn
// separate metaballs, so a note cannot create a visible sphere.
const resolution=58;
const body=new MarchingCubes(resolution,material,false,false,70000);
body.isolation=0;
body.scale.set(2.12,2.12,2.12);
body.frustumCulled=false;
scene.add(body);

const cell=2/(resolution-1);
const seedDirections=Array.from({length:24},(_,i)=>{
  const a=i*2.3999632297;
  const z=1-2*((i*.6180339887)%1);
  const r=Math.sqrt(Math.max(0,1-z*z));
  return new THREE.Vector3(Math.cos(a)*r,z,Math.sin(a)*r);
});

function hashNoise(x,y,z){
  const a=Math.sin(x*127.1+y*311.7+z*74.7)*43758.5453;
  return a-Math.floor(a);
}

function organicNoise(x,y,z){
  return Math.sin(x*3.2+y*1.7+z*2.1)*.5+
    Math.sin(x*7.1-y*4.2+z*5.4)*.24+
    Math.sin(x*13.7+y*9.1-z*8.3)*.10+
    (hashNoise(x*3,y*3,z*3)-.5)*.16;
}

function angularLobe(nx,ny,nz,direction,width){
  const dot=nx*direction.x+ny*direction.y+nz*direction.z;
  return Math.exp((dot-1)/width);
}

function fieldAt(x,y,z){
  const r=Math.sqrt(x*x+y*y+z*z);
  if(r>1.25)return -1;
  const safeR=Math.max(r,.0001);
  const nx=x/safeR,ny=y/safeR,nz=z/safeR;
  const breath=Math.sin(organism.breathPhase)*.5+.5;
  const stress=Math.min(1,organism.tension*.8+organism.overload*.9);

  let radius=.57;
  radius+=organicNoise(nx*1.3,ny*1.1,nz*1.2)*.032;
  radius+=Math.sin(nx*4.7+nz*2.2)*.014;
  radius+=Math.sin(ny*6.1-nx*2.8)*.011;
  radius*=1+breath*.012+organism.energy*.018-organism.overload*.028;

  const grain=
    Math.pow(Math.max(0,Math.sin(nx*9.5+ny*2.1+nz*4.2)),8)*.026+
    Math.pow(Math.max(0,Math.sin(nz*11.2-ny*3.7)),10)*.018;
  radius+=grain*(.7+stress);

  for(const wave of organism.waves){
    const age=wave.age;
    const phase=age*wave.speed;
    const dot=nx*wave.direction.x+ny*wave.direction.y+nz*wave.direction.z;
    const front=Math.exp(-Math.pow((dot-(1-phase*.92))/.075,2));
    const returnFront=Math.exp(-Math.pow((dot+(1-phase*.76))/.11,2));
    const lateral=.65+.35*Math.sin((dot+1)*8+age*7);
    radius+=(front-returnFront*.32)*wave.amount*lateral;
  }

  for(const scar of organism.scars){
    radius+=angularLobe(nx,ny,nz,scar.direction,.028+scar.width)*scar.amount;
  }

  if(organism.overload>.05){
    for(let i=0;i<7;i++){
      const direction=seedDirections[(i+Math.floor(organism.memory*30))%seedDirections.length];
      const lobe=angularLobe(nx,ny,nz,direction,.018);
      radius+=lobe*organism.overload*(.045+.018*Math.sin(i*2.7+performance.now()*.001));
    }
  }

  const coherence=1-Math.min(.22,organism.overload*.13);
  return (radius-safeR)*coherence;
}

function rebuildBody(){
  body.reset();
  for(let iz=0;iz<resolution;iz++){
    const z=-1+iz*cell;
    for(let iy=0;iy<resolution;iy++){
      const y=-1+iy*cell;
      for(let ix=0;ix<resolution;ix++){
        const x=-1+ix*cell;
        body.setCell(ix,iy,iz,fieldAt(x,y,z));
      }
    }
  }
  body.update();
}

function addWave(midi,velocity){
  const stateAngle=midi*.173+organism.memory*8.7+organism.tension*2.4;
  const stateTilt=Math.sin(midi*.097+organism.energy*3.1);
  const direction=new THREE.Vector3(Math.cos(stateAngle),stateTilt*.55,Math.sin(stateAngle)).normalize();

  organism.waves.push({
    direction,
    amount:.052+velocity*.075+organism.tension*.018,
    age:0,
    speed:.78+organism.tension*.34
  });
  if(organism.waves.length>10)organism.waves.shift();
}

function addMemoryScar(){
  const index=Math.floor((organism.memory*97+organism.repeat*11)%seedDirections.length);
  organism.scars.push({
    direction:seedDirections[index].clone(),
    amount:.018+organism.memory*.018,
    width:.018+organism.memory*.028
  });
  if(organism.scars.length>24)organism.scars.shift();
}

function note(midi,velocity=.8,source='clavier'){
  ensureAudio();
  const now=performance.now()*.001;
  const wasQuiet=now-organism.lastInteraction>60;

  organism.lastInteraction=now;
  organism.repeat=organism.lastNote===midi?Math.min(4,organism.repeat+1):1;
  organism.lastNote=midi;
  organism.energy=Math.min(1.25,organism.energy+velocity*.32);
  organism.tension=Math.min(1.2,organism.tension+velocity*.19);
  organism.memory=Math.min(1,organism.memory+.018);

  if(wasQuiet)addMemoryScar();
  addWave(midi,velocity);
  addMemoryScar();
  playNote(midi,velocity);

  if(organism.repeat===4){
    organism.overload=Math.min(1.25,organism.overload+.72);
    organism.tension=Math.min(1.2,organism.tension+.34);
  }

  if(organism.repeat>=4)stateEl.textContent='SURCHARGE';
  else if(organism.repeat===3)stateEl.textContent='ACCUMULATION';
  else if(organism.repeat===2)stateEl.textContent='RÉSONANCE';
  else stateEl.textContent=source==='MIDI'?'EXCITATION · MIDI':'EXCITATION';

  rebuildBody();
}

const keys={a:60,z:62,e:64,r:65,t:67,y:69,u:71,q:72,s:74,d:76,f:77,g:79,h:81,j:83};
const held=new Set();

addEventListener('keydown',event=>{
  if(event.repeat)return;
  if(event.code==='Space'){
    event.preventDefault();
    organism.arpeggiator=!organism.arpeggiator;
    ensureAudio();
    return;
  }
  const midi=keys[event.key.toLowerCase()];
  if(midi==null)return;
  held.add(event.key.toLowerCase());
  note(midi,.9);
});
addEventListener('keyup',event=>held.delete(event.key.toLowerCase()));
addEventListener('blur',()=>held.clear());

if(navigator.requestMIDIAccess){
  navigator.requestMIDIAccess().then(access=>{
    for(const input of access.inputs.values()){
      input.onmidimessage=event=>{
        const [status,midi,velocity]=event.data;
        if((status&0xf0)===0x90&&velocity>0)note(midi,velocity/127,'MIDI');
      };
    }
  }).catch(()=>{});
}

const arp=[60,64,67,71];
const clock=new THREE.Clock();
let elapsed=0;
let lastFieldUpdate=0;

function updateChord(){
  const notes=[...held].map(key=>keys[key]).filter(Boolean);
  if(notes.length<2)return;
  const spread=Math.max(...notes)-Math.min(...notes);
  const sum=notes.reduce((total,midi)=>total+midi,0);
  const amount=.0025+organism.tension*.004;
  organism.targetOrientation.x+=Math.sin(sum*.071)*amount;
  organism.targetOrientation.y+=Math.cos(spread*.29)*amount;
  organism.targetOrientation.z+=Math.sin(spread*.17)*amount;
  organism.targetOrientation.clampLength(0,.32);
}
setInterval(updateChord,70);

function update(dt){
  elapsed+=dt;
  organism.breathPhase=(organism.breathPhase+dt*(organism.bpm/60)*Math.PI)%(Math.PI*2);
  organism.energy=Math.max(0,organism.energy-dt*.045);
  organism.tension=Math.max(0,organism.tension-dt*.025);
  organism.overload=Math.max(0,organism.overload-dt*.38);

  for(const wave of organism.waves)wave.age+=dt;
  organism.waves=organism.waves.filter(wave=>wave.age<2.4);

  organism.orientation.lerp(organism.targetOrientation,1-Math.exp(-dt*.9));
  body.rotation.set(organism.orientation.x,organism.orientation.y,organism.orientation.z);

  const breath=Math.sin(organism.breathPhase)*.5+.5;
  const scale=1+breath*.014+organism.energy*.012-organism.overload*.018;
  const targetScale=new THREE.Vector3(2.12*scale,2.12*scale,2.12*scale);
  body.scale.lerp(targetScale,1-Math.exp(-dt*2.4));

  if(elapsed-lastFieldUpdate>.075){
    rebuildBody();
    lastFieldUpdate=elapsed;
  }

  energyEl.style.width=Math.min(100,organism.energy/1.1*100)+'%';
  tensionEl.style.width=Math.min(100,organism.tension/1.1*100)+'%';
  memoryEl.style.width=Math.min(100,organism.memory*100)+'%';
  overloadEl.style.width=Math.min(100,organism.overload/1.1*100)+'%';
  breathEl.textContent=Math.round(organism.bpm)+' BPM';
  repeatEl.textContent=organism.repeat+' / 4';
  arpEl.textContent=organism.arpeggiator?'ON':'OFF';

  const silent=performance.now()*.001-organism.lastInteraction;
  if(organism.overload>.25)stateEl.textContent='SURCHARGE';
  else if(silent>60)stateEl.textContent='CALME · MÉMOIRE CONSERVÉE';
  else if(organism.tension>.17)stateEl.textContent='RÉSONANCE';
  else if(organism.energy>.10)stateEl.textContent='EXCITATION';
  else stateEl.textContent='RESPIRATION · 72 BPM';
}

addEventListener('resize',()=>{
  camera.aspect=innerWidth/innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth,innerHeight);
});

rebuildBody();

renderer.setAnimationLoop(()=>{
  const dt=Math.min(clock.getDelta(),.033);

  if(organism.arpeggiator){
    organism.arpTimer+=dt;
    const step=(60/organism.bpm)/2;
    if(organism.arpTimer>=step){
      organism.arpTimer-=step;
      note(arp[organism.arpIndex++%arp.length],.36,'ARPÈGE');
    }
  }

  update(dt);
  key.position.x=Math.sin(elapsed*.15)*3.2;
  key.position.z=3.8+Math.cos(elapsed*.11)*1.1;
  renderer.render(scene,camera);
});

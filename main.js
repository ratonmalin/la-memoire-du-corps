import * as THREE from 'three';

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
renderer.setPixelRatio(Math.min(devicePixelRatio,2.5));
renderer.setSize(innerWidth,innerHeight);
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=.92;

const scene=new THREE.Scene();
scene.background=new THREE.Color(0xb9b8b3);

const camera=new THREE.PerspectiveCamera(30,innerWidth/innerHeight,.1,100);
camera.position.set(0,0,8);
camera.lookAt(0,0,0);

const organism={
  energy:.015,tension:.012,memory:0,overload:0,
  breathPhase:0,bpm:36,lastInteraction:-Infinity,lastNote:null,repeat:0,
  arpeggiator:false,arpIndex:0,arpTimer:0,chordPulse:0,
  orientation:new THREE.Vector3(),targetOrientation:new THREE.Vector3()
};

let audioContext=null,master=null;
function ensureAudio(){
  if(audioContext){if(audioContext.state!=='running')audioContext.resume().catch(()=>{});return}
  const AudioCtx=window.AudioContext||window.webkitAudioContext;
  if(!AudioCtx)return;
  audioContext=new AudioCtx();
  master=audioContext.createGain();
  master.gain.value=.48;
  const comp=audioContext.createDynamicsCompressor();
  comp.threshold.value=-20;comp.knee.value=9;comp.ratio.value=5;comp.attack.value=.003;comp.release.value=.2;
  master.connect(comp).connect(audioContext.destination);
}
function frequency(n){return 440*Math.pow(2,(n-69)/12)}
function playNote(n,v=.8){
  ensureAudio(); if(!audioContext||!master)return;
  const t=audioContext.currentTime,f=frequency(n);
  const o=audioContext.createOscillator(),sub=audioContext.createOscillator();
  const filter=audioContext.createBiquadFilter(),g=audioContext.createGain();
  o.type='triangle';o.frequency.value=f;
  sub.type='sine';sub.frequency.value=f*.5;
  filter.type='lowpass';filter.frequency.value=720+organism.tension*1700;filter.Q.value=1.5;
  g.gain.setValueAtTime(.0001,t);
  g.gain.exponentialRampToValueAtTime(.025+v*.13,t+.025);
  g.gain.exponentialRampToValueAtTime(.0001,t+.62);
  o.connect(filter);sub.connect(filter);filter.connect(g).connect(master);
  o.start(t);sub.start(t);o.stop(t+.66);sub.stop(t+.66);
}

// A dense, irregular magnetic lattice. The peaks are part of one continuous
// surface; notes modify their height, never create new objects.
const COUNT=96;
const directions=[];
const baseHeight=new Float32Array(COUNT);
const peakHeight=new Float32Array(COUNT);
for(let i=0;i<COUNT;i++){
  const y=1-2*(i+.5)/COUNT;
  const r=Math.sqrt(Math.max(0,1-y*y));
  const a=i*2.39996322972865;
  const d=new THREE.Vector3(Math.cos(a)*r,y,Math.sin(a)*r).normalize();
  directions.push(d);
  const variation=.72+.28*(.5+.5*Math.sin(i*4.17+1.3));
  baseHeight[i]=.10*variation;
  peakHeight[i]=baseHeight[i];
}
const dirArray=new Float32Array(COUNT*3);
for(let i=0;i<COUNT;i++){dirArray[i*3]=directions[i].x;dirArray[i*3+1]=directions[i].y;dirArray[i*3+2]=directions[i].z}

const peakArray=new Float32Array(COUNT);
const impulseDir=Array.from({length:4},()=>new THREE.Vector3(0,1,0));
const impulseTime=new Float32Array(4).fill(-100);
const impulseAmp=new Float32Array(4);

const vertexShader=`
uniform float uTime;
uniform float uEnergy;
uniform float uTension;
uniform float uMemory;
uniform float uOverload;
uniform float uBreath;
uniform float uChord;
uniform vec3 uNoteDir;
uniform float uNotePulse;

varying vec3 vWorld;
varying vec3 vNormalObject;
varying float vHeight;

float ridge(vec3 n, vec3 d, float width){
  float q=max(dot(n,d),0.0);
  return pow(q,width);
}

float surfaceHeight(vec3 n){
  float h=0.0;
  h += pow(max(dot(n,normalize(vec3(0.72,0.34,0.61))),0.0),22.0)*0.060;
  h += pow(max(dot(n,normalize(vec3(-0.58,0.52,0.62))),0.0),28.0)*0.052;
  h += pow(max(dot(n,normalize(vec3(0.12,-0.82,0.56))),0.0),24.0)*0.046;
  h += pow(max(dot(n,normalize(vec3(-0.62,-0.28,-0.72))),0.0),30.0)*0.040;

  float organic=sin(n.x*4.7+n.y*2.1)+sin(n.z*5.3-n.x*1.7)+sin(n.y*6.1+n.z*2.4);
  h += organic*0.008;

  float q=max(dot(n,uNoteDir),0.0);
  float local=pow(q,30.0);
  float halo=pow(q,8.0);
  h += (local*0.105 + halo*0.020)*uNotePulse;

  h += uMemory*0.012*(0.5+0.5*sin(n.x*3.0+n.z*4.0));
  return h;
}

void main(){
  vec3 n=normalize(position);
  float h=surfaceHeight(n);
  float breath=sin(uBreath)*0.5+0.5;

  float radius=0.76+h;
  radius += breath*0.003;
  radius += uEnergy*0.010;
  radius -= uOverload*0.018;

  vec3 p=n*radius;
  p.x*=1.025;
  p.y*=0.995;
  p.z*=0.975;

  float twist=uChord*0.045*(n.y+0.2);
  float cs=cos(twist), sn=sin(twist);
  p.xz=mat2(cs,-sn,sn,cs)*p.xz;

  vec4 world=modelMatrix*vec4(p,1.0);
  vWorld=world.xyz;
  vNormalObject=n;
  vHeight=h;
  gl_Position=projectionMatrix*viewMatrix*world;
}
`;

const fragmentShader=`
uniform float uTension;
uniform float uOverload;
uniform float uTime;

varying vec3 vWorld;
varying vec3 vNormalObject;
varying float vHeight;

void main(){
  vec3 N=normalize(normalMatrix*vNormalObject);
  vec3 V=normalize(cameraPosition-vWorld);

  float ndv=max(dot(N,V),0.0);
  float fresnel=pow(1.0-ndv,2.6);

  vec3 L1=normalize(vec3(-0.48,0.70,0.82));
  vec3 L2=normalize(vec3(0.72,0.25,0.64));
  vec3 H1=normalize(L1+V);
  vec3 H2=normalize(L2+V);

  float s1=pow(max(dot(N,H1),0.0),55.0);
  float s2=pow(max(dot(N,H2),0.0),80.0);

  vec3 graphite=vec3(0.030,0.034,0.038);
  vec3 reflection=vec3(0.30,0.34,0.38)*fresnel;
  float diffuse=0.5+0.5*max(dot(N,L1),0.0);\n  vec3 highlight=vec3(0.62,0.66,0.70)*s1*0.42;\n  highlight+=vec3(0.16,0.18,0.20)*diffuse;
  highlight+=vec3(0.40,0.46,0.52)*s2*0.22;

  float stress=smoothstep(0.10,0.75,uTension+uOverload);
  vec3 body=graphite+reflection+highlight;
  body+=vec3(0.012,0.016,0.020)*stress*fresnel;

  gl_FragColor=vec4(body,1.0);
}
`;

const uniforms={
  uTime:{value:0},uEnergy:{value:0},uTension:{value:0},uMemory:{value:0},
  uOverload:{value:0},uBreath:{value:0},uChord:{value:0},
  uNoteDir:{value:new THREE.Vector3(0,1,0)},uNotePulse:{value:0}
};

const material=new THREE.ShaderMaterial({uniforms,vertexShader,fragmentShader,side:THREE.FrontSide,flatShading:false});
const geometry=new THREE.SphereGeometry(1,384,256);
const body=new THREE.Mesh(geometry,material);
body.scale.set(1.12,1.10,1.04);
scene.add(body);

let impulseIndex=0;
function addImpulse(midi,velocity){
  const i=impulseIndex++%4;
  const a=midi*.173+organism.memory*6.0;
  const y=Math.sin(midi*.071+organism.tension*2.0)*.48;
  impulseDir[i].set(Math.cos(a),y,Math.sin(a)).normalize();
  impulseTime[i]=clock.elapsedTime;
  impulseAmp[i]=.8+velocity*.55+organism.tension*.25;
  uniforms.uNoteDir.value.copy(impulseDir[i]);
  uniforms.uNotePulse.value=impulseAmp[i];
}

function stimulatePeaks(midi,velocity){
  const a=midi*.173+organism.memory*4.0;
  const target=new THREE.Vector3(Math.cos(a),Math.sin(midi*.11)*.55,Math.sin(a)).normalize();

  // Affect a local cluster, then let the travelling impulse propagate through
  // the continuous surface. No particle/sphere is spawned.
  for(let i=0;i<COUNT;i++){
    const d=directions[i].dot(target);
    const influence=Math.exp((Math.max(d,-1)-1.0)/.11);
    peakArray[i]=Math.min(.28,peakArray[i]+influence*(.032+velocity*.042));
  }
}

function note(midi,velocity=.8,source='clavier'){
  ensureAudio();
  const now=performance.now()*.001;
  const quiet=now-organism.lastInteraction>60;
  organism.lastInteraction=now;

  organism.repeat=organism.lastNote===midi?Math.min(4,organism.repeat+1):1;
  organism.lastNote=midi;
  organism.energy=Math.min(1,organism.energy+velocity*.16);
  organism.tension=Math.min(1,organism.tension+velocity*.075);
  organism.memory=Math.min(1,organism.memory+.010);

  stimulatePeaks(midi,velocity);
  addImpulse(midi,velocity);
  playNote(midi,velocity);

  if(quiet){
    // Interruption leaves a persistent morphological wake: distribute a small
    // amount of memory over a different part of the lattice.
    for(let i=0;i<COUNT;i++)peakArray[i]+=Math.max(0,directions[i].y)*.012;
  }

  if(organism.repeat===4){
    organism.overload=Math.min(1.15,organism.overload+.72);
    organism.tension=Math.min(1,organism.tension+.30);
  }

  if(organism.repeat===4)stateEl.textContent='SURCHARGE';
  else if(organism.repeat===3)stateEl.textContent='ACCUMULATION';
  else if(organism.repeat===2)stateEl.textContent='RÉSONANCE';
  else stateEl.textContent=source==='MIDI'?'EXCITATION · MIDI':'EXCITATION';
}

const keys={a:60,z:62,e:64,r:65,t:67,y:69,u:71,q:72,s:74,d:76,f:77,g:79,h:81,j:83};
const held=new Set();

addEventListener('keydown',e=>{
  if(e.repeat)return;
  if(e.code==='Space'){e.preventDefault();organism.arpeggiator=!organism.arpeggiator;ensureAudio();return}
  const n=keys[e.key.toLowerCase()];
  if(n==null)return;
  held.add(e.key.toLowerCase());
  note(n,.9);
});
addEventListener('keyup',e=>held.delete(e.key.toLowerCase()));
addEventListener('blur',()=>held.clear());

if(navigator.requestMIDIAccess){
  navigator.requestMIDIAccess().then(access=>{
    for(const input of access.inputs.values()){
      input.onmidimessage=e=>{
        const [status,n,v]=e.data;
        if((status&0xf0)===0x90&&v>0)note(n,v/127,'MIDI');
      };
    }
  }).catch(()=>{});
}

const arp=[60,64,67,71];
const clock=new THREE.Clock();

function updateChord(){
  const notes=[...held].map(k=>keys[k]).filter(Boolean);
  if(notes.length<2)return;
  const spread=Math.max(...notes)-Math.min(...notes);
  const sum=notes.reduce((a,n)=>a+n,0);
  const gain=.018+organism.tension*.010;
  organism.targetOrientation.x+=Math.sin(sum*.071)*gain;
  organism.targetOrientation.y+=Math.cos(spread*.29)*gain;
  organism.targetOrientation.z+=Math.sin(spread*.17)*gain;
  organism.targetOrientation.clampLength(0,.72);
  organism.chordPulse=Math.min(1,organism.chordPulse+.16);
  // Chords act on the whole mass: a slow torsional state, not local spikes.
  organism.energy=Math.min(1,organism.energy+.006*notes.length);
  organism.tension=Math.min(1,organism.tension+.004*notes.length);
}
setInterval(updateChord,80);

function fitCamera(){
  const maxBodyScale=Math.max(body.scale.x,body.scale.y,body.scale.z);
  const maxRadius=1.12*maxBodyScale*(.73+.34+organism.overload*.08);
  const fovRad=THREE.MathUtils.degToRad(camera.fov);
  const aspect=Math.max(camera.aspect,.1);
  const verticalFit=maxRadius/Math.tan(fovRad*.5);
  const horizontalFit=maxRadius/Math.tan(Math.atan(Math.tan(fovRad*.5)*aspect));
  const distance=Math.max(verticalFit,horizontalFit)*1.28;
  camera.position.z=THREE.MathUtils.lerp(camera.position.z,distance,0.12);
}

function update(dt){
  uniforms.uTime.value=clock.elapsedTime;

  organism.breathPhase=(organism.breathPhase+dt*(organism.bpm/60)*Math.PI)%(Math.PI*2);
  organism.energy=Math.max(0,organism.energy-dt*.020);
  organism.tension=Math.max(0,organism.tension-dt*.010);
  organism.overload=Math.max(0,organism.overload-dt*.12);

  // Memory never decays. Morphology therefore remains changed after silence.
  for(let i=0;i<COUNT;i++){
    peakArray[i]=Math.max(baseHeight[i],peakArray[i]-dt*.0009);
  }

  uniforms.uEnergy.value=organism.energy;
  uniforms.uTension.value=organism.tension;
  uniforms.uMemory.value=organism.memory;
  uniforms.uOverload.value=organism.overload;
  uniforms.uBreath.value=organism.breathPhase;
  organism.chordPulse=Math.max(0,organism.chordPulse-dt*.035);
  uniforms.uChord.value=organism.chordPulse;
  uniforms.uNotePulse.value=Math.max(0,uniforms.uNotePulse.value-dt*2.8);

  organism.orientation.lerp(organism.targetOrientation,1-Math.exp(-dt*.9));
  organism.targetOrientation.multiplyScalar(Math.exp(-dt*.055));
  body.rotation.set(organism.orientation.x,organism.orientation.y,organism.orientation.z);

  const breath=Math.sin(organism.breathPhase)*.5+.5;
  const s=1+breath*.003+organism.energy*.008-organism.overload*.012;
  body.scale.lerp(new THREE.Vector3(1.12*s,1.10*s,1.04*s),1-Math.exp(-dt*2));

  energyEl.style.width=Math.min(100,organism.energy*100)+'%';
  tensionEl.style.width=Math.min(100,organism.tension*100)+'%';
  memoryEl.style.width=organism.memory*100+'%';
  overloadEl.style.width=Math.min(100,organism.overload/1.05*100)+'%';
  breathEl.textContent='36 BPM';
  repeatEl.textContent=organism.repeat+' / 4';
  arpEl.textContent=organism.arpeggiator?'ON':'OFF';

  const silent=performance.now()*.001-organism.lastInteraction;
  if(organism.overload>.25)stateEl.textContent='SURCHARGE';
  else if(silent>60)stateEl.textContent='CALME · MÉMOIRE CONSERVÉE';
  else if(organism.tension>.10)stateEl.textContent='RÉSONANCE';
  else if(organism.energy>.055)stateEl.textContent='EXCITATION';
  else stateEl.textContent='RESPIRATION · 36 BPM';
}

addEventListener('resize',()=>{
  camera.aspect=innerWidth/innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth,innerHeight);
});

renderer.setAnimationLoop(()=>{
  const dt=Math.min(clock.getDelta(),.033);

  if(organism.arpeggiator){
    organism.arpTimer+=dt;
    const step=(60/organism.bpm)/2;
    if(organism.arpTimer>=step){
      organism.arpTimer-=step;
      note(arp[organism.arpIndex++%arp.length],.34,'ARPÈGE');
    }
  }

  update(dt);
  fitCamera();
  renderer.render(scene,camera);
});

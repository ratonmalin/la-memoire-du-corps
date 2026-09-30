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
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.setSize(innerWidth,innerHeight);
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.08;

const scene=new THREE.Scene();
scene.background=new THREE.Color(0xe9e8e3);

const camera=new THREE.PerspectiveCamera(32,innerWidth/innerHeight,.1,100);
camera.position.set(0,0,7.7);
camera.lookAt(0,0,0);

const organism={
  energy:.025,tension:.018,memory:0,overload:0,
  breathPhase:0,bpm:72,lastInteraction:-Infinity,lastNote:null,repeat:0,
  arpeggiator:false,arpIndex:0,arpTimer:0,
  orientation:new THREE.Vector3(),targetOrientation:new THREE.Vector3(),
  waves:[],scars:[]
};

let audioContext=null,master=null;
function ensureAudio(){
  if(audioContext){if(audioContext.state!=='running')audioContext.resume().catch(()=>{});return}
  const AudioCtx=window.AudioContext||window.webkitAudioContext;
  if(!AudioCtx)return;
  audioContext=new AudioCtx();
  master=audioContext.createGain();
  master.gain.value=.56;
  const compressor=audioContext.createDynamicsCompressor();
  compressor.threshold.value=-18;compressor.knee.value=10;compressor.ratio.value=5;
  compressor.attack.value=.003;compressor.release.value=.18;
  master.connect(compressor).connect(audioContext.destination);
}
function frequency(n){return 440*Math.pow(2,(n-69)/12)}
function playNote(n,v=.8){
  ensureAudio();if(!audioContext||!master)return;
  const t=audioContext.currentTime,f=frequency(n);
  const a=audioContext.createOscillator(),b=audioContext.createOscillator(),air=audioContext.createOscillator();
  const filter=audioContext.createBiquadFilter(),gain=audioContext.createGain();
  a.type='triangle';a.frequency.value=f;
  b.type='sine';b.frequency.value=f*.5;
  air.type='sine';air.frequency.value=f*2.01;
  filter.type='lowpass';filter.frequency.setValueAtTime(900+organism.tension*1700,t);filter.Q.value=1.7;
  gain.gain.setValueAtTime(.0001,t);
  gain.gain.exponentialRampToValueAtTime(.04+v*.22,t+.025);
  gain.gain.exponentialRampToValueAtTime(.0001,t+.7);
  a.connect(filter);b.connect(filter);air.connect(filter);filter.connect(gain).connect(master);
  a.start(t);b.start(t);air.start(t);a.stop(t+.74);b.stop(t+.74);air.stop(t+.74);
}

const peakDirections=[];
for(let i=0;i<34;i++){
  const phi=Math.acos(1-2*(i+.5)/34);
  const theta=Math.PI*(3-Math.sqrt(5))*i;
  peakDirections.push(new THREE.Vector3(
    Math.sin(phi)*Math.cos(theta),
    Math.cos(phi)*.92,
    Math.sin(phi)*Math.sin(theta)
  ).normalize());
}

const scarDirections=[];
for(let i=0;i<24;i++){
  const phi=Math.acos(1-2*(i+.5)/24);
  const theta=Math.PI*(3-Math.sqrt(5))*(i+7);
  scarDirections.push(new THREE.Vector3(Math.sin(phi)*Math.cos(theta),Math.cos(phi),Math.sin(phi)*Math.sin(theta)).normalize());
}

const peakArray=new Float32Array(34*3);
peakDirections.forEach((v,i)=>{peakArray[i*3]=v.x;peakArray[i*3+1]=v.y;peakArray[i*3+2]=v.z});

const scarArray=new Float32Array(24);
const scarStrength=new Float32Array(24);

const vertexShader=\`
uniform float uTime;
uniform float uEnergy;
uniform float uTension;
uniform float uMemory;
uniform float uOverload;
uniform float uBreath;
uniform vec3 uPeaks[34];
uniform vec3 uScars[24];
uniform float uScarStrength[24];
uniform float uWaveStart[6];
uniform float uWaveAmount[6];
uniform vec3 uWaveDirection[6];

varying vec3 vWorld;
varying vec3 vView;

float peakField(vec3 n){
  float h=0.0;
  for(int i=0;i<34;i++){
    float d=max(dot(n,uPeaks[i]),0.0);
    float p=pow(d,28.0);
    h+=p*(0.055+0.018*sin(float(i)*7.31+uMemory*9.0));
  }
  return h;
}

float fineGrain(vec3 n){
  float a=sin(n.x*17.0+n.y*5.0+n.z*9.0);
  float b=sin(n.z*23.0-n.y*11.0+n.x*3.0);
  return pow(max(0.0,a),9.0)*0.012+pow(max(0.0,b),11.0)*0.008;
}

float waveField(vec3 n){
  float h=0.0;
  for(int i=0;i<6;i++){
    float age=uTime-uWaveStart[i];
    if(age<0.0) continue;
    float front=1.0-age*0.92;
    float d=dot(n,uWaveDirection[i]);
    float ring=exp(-pow((d-front)/0.055,2.0));
    float tail=exp(-pow((d-(front+0.10))/0.13,2.0));
    h+=(ring-tail*0.35)*uWaveAmount[i];
  }
  return h;
}

float scarField(vec3 n){
  float h=0.0;
  for(int i=0;i<24;i++){
    float d=max(dot(n,uScars[i]),0.0);
    h+=pow(d,20.0)*uScarStrength[i];
  }
  return h;
}

float displacement(vec3 n){
  float breath=(sin(uBreath)*0.5+0.5);
  float r=0.86;
  r+=peakField(n);
  r+=fineGrain(n)*(0.7+uTension*1.6);
  r+=scarField(n);
  r+=waveField(n);
  r+=breath*0.012;
  r+=uEnergy*0.018;
  if(uOverload>0.0){
    r+=peakField(n)*uOverload*0.85;
    r-=uOverload*0.025;
  }
  return r;
}

void main(){
  vec3 n=normalize(position);
  float r=displacement(n);
  vec3 p=n*r;

  // Slightly flattened compact mass: still one closed body, not a sphere.
  p.x*=1.04;
  p.y*=0.94;
  p.z*=0.82;

  vec4 world=modelMatrix*vec4(p,1.0);
  vWorld=world.xyz;
  vView=(viewMatrix*world).xyz;
  gl_Position=projectionMatrix*viewMatrix*world;
}
\`;

const fragmentShader=\`
uniform vec3 uLightA;
uniform vec3 uLightB;
uniform float uTension;
uniform float uOverload;

varying vec3 vWorld;
varying vec3 vView;

void main(){
  vec3 N=normalize(cross(dFdx(vWorld),dFdy(vWorld)));
  vec3 V=normalize(cameraPosition-vWorld);

  float fresnel=pow(1.0-max(dot(N,V),0.0),4.0);
  vec3 L1=normalize(uLightA-vWorld);
  vec3 L2=normalize(uLightB-vWorld);

  float s1=pow(max(dot(reflect(-L1,N),V),0.0),70.0);
  float s2=pow(max(dot(reflect(-L2,N),V),0.0),120.0);
  float edge=0.5+0.5*dot(N,V);

  vec3 base=vec3(0.008,0.010,0.012);
  vec3 reflected=vec3(0.72,0.76,0.82)*fresnel*0.72;
  vec3 highlights=vec3(1.0)*s1*1.5+vec3(0.82,0.88,1.0)*s2*1.15;
  vec3 body=base*(0.35+edge*0.65)+reflected+highlights;

  float stress=smoothstep(0.2,1.0,uTension+uOverload);
  body+=vec3(0.025,0.032,0.045)*stress*fresnel;

  gl_FragColor=vec4(body,1.0);
}
\`;

const uniforms={
  uTime:{value:0},uEnergy:{value:0},uTension:{value:0},uMemory:{value:0},uOverload:{value:0},
  uBreath:{value:0},uPeaks:{value:peakArray},uScars:{value:scarArray},uScarStrength:{value:scarStrength},
  uWaveStart:{value:new Float32Array(6).fill(-100)},uWaveAmount:{value:new Float32Array(6)},
  uWaveDirection:{value:Array.from({length:6},()=>new THREE.Vector3(0,1,0))},
  uLightA:{value:new THREE.Vector3(3.2,3.4,4.8)},uLightB:{value:new THREE.Vector3(-3.5,1.5,2.2)}
};

const material=new THREE.ShaderMaterial({
  uniforms,vertexShader,fragmentShader,side:THREE.FrontSide
});

const geometry=new THREE.SphereGeometry(1,112,72);
const body=new THREE.Mesh(geometry,material);
body.scale.set(2.16,2.02,1.78);
scene.add(body);

function addScar(){
  const i=Math.floor((organism.memory*97+organism.repeat*11)%scarDirections.length);
  organism.scars.push({index:i,amount:.035+organism.memory*.028});
  if(organism.scars.length>24)organism.scars.shift();
  for(let k=0;k<24;k++)scarArray[k]=0
  organism.scars.forEach((s,k)=>{scarArray[s.index]+=s.amount*.62});
  uniforms.uScars.value=scarDirections;
  uniforms.uScarStrength.value=scarArray;
}

function addWave(midi,velocity){
  const i=organism.waves.length%6;
  const angle=midi*.173+organism.memory*8.7+organism.tension*2.4;
  const tilt=Math.sin(midi*.097+organism.energy*3.1);
  const d=new THREE.Vector3(Math.cos(angle),tilt*.5,Math.sin(angle)).normalize();
  const now=clock.elapsedTime;
  uniforms.uWaveStart.value[i]=now;
  uniforms.uWaveAmount.value[i]=.028+velocity*.045+organism.tension*.012;
  uniforms.uWaveDirection.value[i].copy(d);
  organism.waves.push({slot:i,age:0});
  if(organism.waves.length>6)organism.waves.shift();
}

function note(midi,velocity=.8,source='clavier'){
  ensureAudio();
  const now=performance.now()*.001;
  const quiet=now-organism.lastInteraction>60;
  organism.lastInteraction=now;
  organism.repeat=organism.lastNote===midi?Math.min(4,organism.repeat+1):1;
  organism.lastNote=midi;
  organism.energy=Math.min(1.2,organism.energy+velocity*.28);
  organism.tension=Math.min(1.1,organism.tension+velocity*.16);
  organism.memory=Math.min(1,organism.memory+.018);
  addWave(midi,velocity);
  addScar();
  playNote(midi,velocity);
  if(organism.repeat===4){organism.overload=Math.min(1.15,organism.overload+.68);organism.tension=Math.min(1.1,organism.tension+.28)}
  if(quiet)addScar();

  if(organism.repeat>=4)stateEl.textContent='SURCHARGE';
  else if(organism.repeat===3)stateEl.textContent='ACCUMULATION';
  else if(organism.repeat===2)stateEl.textContent='RÉSONANCE';
  else stateEl.textContent=source==='MIDI'?'EXCITATION · MIDI':'EXCITATION';
}

const keys={a:60,z:62,e:64,r:65,t:67,y:69,u:71,q:72,s:74,d:76,f:77,g:79,h:81,j:83};
const held=new Set();
addEventListener('keydown',e=>{
  if(e.repeat)return;
  if(e.code==='Space'){e.preventDefault();organism.arpeggiator=!organism.arpeggiator;ensureAudio();return}
  const n=keys[e.key.toLowerCase()];if(n==null)return;
  held.add(e.key.toLowerCase());note(n,.9);
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
let elapsed=0;

function updateChord(){
  const notes=[...held].map(k=>keys[k]).filter(Boolean);
  if(notes.length<2)return;
  const spread=Math.max(...notes)-Math.min(...notes);
  const sum=notes.reduce((a,n)=>a+n,0);
  const gain=.0022+organism.tension*.0035;
  organism.targetOrientation.x+=Math.sin(sum*.071)*gain;
  organism.targetOrientation.y+=Math.cos(spread*.29)*gain;
  organism.targetOrientation.z+=Math.sin(spread*.17)*gain;
  organism.targetOrientation.clampLength(0,.28);
}
setInterval(updateChord,80);

function update(dt){
  elapsed+=dt;
  uniforms.uTime.value=elapsed;
  organism.breathPhase=(organism.breathPhase+dt*(organism.bpm/60)*Math.PI)%(Math.PI*2);
  organism.energy=Math.max(0,organism.energy-dt*.042);
  organism.tension=Math.max(0,organism.tension-dt*.022);
  organism.overload=Math.max(0,organism.overload-dt*.32);

  for(const w of organism.waves)w.age+=dt;
  organism.waves=organism.waves.filter(w=>w.age<1.8);

  uniforms.uEnergy.value=organism.energy;
  uniforms.uTension.value=organism.tension;
  uniforms.uMemory.value=organism.memory;
  uniforms.uOverload.value=organism.overload;
  uniforms.uBreath.value=organism.breathPhase;

  organism.orientation.lerp(organism.targetOrientation,1-Math.exp(-dt*.85));
  body.rotation.set(organism.orientation.x,organism.orientation.y,organism.orientation.z);

  const breath=Math.sin(organism.breathPhase)*.5+.5;
  const scale=1+breath*.012+organism.energy*.01-organism.overload*.014;
  const targetScale=new THREE.Vector3(2.16*scale,2.02*scale,1.78*scale);
  body.scale.lerp(targetScale,1-Math.exp(-dt*2.4));

  energyEl.style.width=Math.min(100,organism.energy/1.05*100)+'%';
  tensionEl.style.width=Math.min(100,organism.tension/1.05*100)+'%';
  memoryEl.style.width=organism.memory*100+'%';
  overloadEl.style.width=Math.min(100,organism.overload/1.05*100)+'%';
  breathEl.textContent='72 BPM';
  repeatEl.textContent=organism.repeat+' / 4';
  arpEl.textContent=organism.arpeggiator?'ON':'OFF';

  const silent=performance.now()*.001-organism.lastInteraction;
  if(organism.overload>.25)stateEl.textContent='SURCHARGE';
  else if(silent>60)stateEl.textContent='CALME · MÉMOIRE CONSERVÉE';
  else if(organism.tension>.16)stateEl.textContent='RÉSONANCE';
  else if(organism.energy>.10)stateEl.textContent='EXCITATION';
  else stateEl.textContent='RESPIRATION · 72 BPM';
}

addEventListener('resize',()=>{
  camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);
});

renderer.setAnimationLoop(()=>{
  const dt=Math.min(clock.getDelta(),.033);
  if(organism.arpeggiator){
    organism.arpTimer+=dt;
    const step=(60/organism.bpm)/2;
    if(organism.arpTimer>=step){organism.arpTimer-=step;note(arp[organism.arpIndex++%arp.length],.34,'ARPÈGE')}
  }
  update(dt);
  uniforms.uLightA.value.set(Math.sin(elapsed*.13)*3.2,3.3,4.7);
  uniforms.uLightB.value.set(-3.2,1.4+Math.sin(elapsed*.17),2.4);
  renderer.render(scene,camera);
});

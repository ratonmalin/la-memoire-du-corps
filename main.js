import * as THREE from 'three';

const canvas=document.querySelector('#scene');
const stateEl=document.querySelector('#state');
const energyEl=document.querySelector('#energy');

const renderer=new THREE.WebGLRenderer({canvas,antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.setSize(innerWidth,innerHeight);
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.15;

const scene=new THREE.Scene();
scene.background=new THREE.Color(0x020304);

const camera=new THREE.PerspectiveCamera(38,innerWidth/innerHeight,.1,100);
camera.position.set(0,0,6.4);

scene.add(new THREE.HemisphereLight(0x78808c,0x050505,1.5));
const key=new THREE.PointLight(0xffffff,20,12);
key.position.set(2.5,3,4);
scene.add(key);
const rim=new THREE.PointLight(0x607cff,14,10);
rim.position.set(-3,-1,-2);
scene.add(rim);

const organism={
  energy:.08,tension:.04,memory:0,breathPhase:0,bpm:72,
  lastNote:null,repeat:0,lastInteraction:-Infinity,dormant:false,
  overload:0,orientation:new THREE.Vector3(),targetOrientation:new THREE.Vector3(),
  impulses:[],waves:[],arpeggiator:false,arpIndex:0,arpTimer:0
};

let audioContext=null,master=null;
function audio(){
  if(audioContext)return;
  audioContext=new AudioContext();
  master=audioContext.createGain();
  master.gain.value=.045;
  master.connect(audioContext.destination);
}
function freq(n){return 440*Math.pow(2,(n-69)/12)}
function tone(n,v=.7){
  audio();
  const o=audioContext.createOscillator(),g=audioContext.createGain();
  o.type='sine';o.frequency.value=freq(n);
  g.gain.setValueAtTime(.0001,audioContext.currentTime);
  g.gain.exponentialRampToValueAtTime(Math.max(.002,v*.055),audioContext.currentTime+.02);
  g.gain.exponentialRampToValueAtTime(.0001,audioContext.currentTime+.36);
  o.connect(g).connect(master);o.start();o.stop(audioContext.currentTime+.4);
}

const geometry=new THREE.IcosahedronGeometry(1.72,7);
const base=geometry.attributes.position.array.slice();
const normals=geometry.attributes.normal.array;
const material=new THREE.MeshPhysicalMaterial({
  color:0x14171b,metalness:.92,roughness:.17,clearcoat:1,clearcoatRoughness:.08,
  transmission:.08,thickness:1.4,ior:1.42
});
const slime=new THREE.Mesh(geometry,material);
scene.add(slime);

const bulgeGeometry=new THREE.SphereGeometry(.33,28,20);
const bulges=[];

function memoryBulge(){
  const m=material.clone();
  m.color.setHex(0x272b31);
  const b=new THREE.Mesh(bulgeGeometry,m);
  const a=Math.random()*Math.PI*2;
  b.position.set(Math.cos(a)*1.58,(Math.random()-.5)*.65,Math.sin(a)*1.58);
  b.scale.setScalar(.55+organism.memory);
  scene.add(b);
  bulges.push(b);
}

function note(n,v=.8,source='keyboard'){
  const now=performance.now()/1000;
  const wasDormant=organism.dormant;
  organism.dormant=false;
  organism.lastInteraction=now;
  if(wasDormant)memoryBulge();

  organism.repeat=organism.lastNote===n?organism.repeat+1:1;
  organism.lastNote=n;
  organism.energy=Math.min(1.5,organism.energy+v*.42);
  organism.tension=Math.min(1.5,organism.tension+v*.25);
  organism.memory=Math.min(1,organism.memory+.01);

  if(organism.repeat>=4){
    organism.overload=Math.min(1.4,organism.overload+.9);
    organism.tension=Math.min(1.5,organism.tension+.5);
  }

  const a=((n-48)/36)*Math.PI*2;
  const p=((n%12)/12)*Math.PI;
  organism.impulses.push({
    d:new THREE.Vector3(Math.cos(a)*Math.sin(p),Math.cos(p),Math.sin(a)*Math.sin(p)).normalize(),
    s:.25+v,age:0
  });
  organism.waves.push({r:.1,s:.3+v,age:0});
  if(organism.impulses.length>20)organism.impulses.shift();
  if(organism.waves.length>14)organism.waves.shift();

  tone(n,v);
  stateEl.textContent=organism.repeat>=4?'SURCHARGE':'PERTURBATION · '+source;
}

const keys={a:60,z:62,e:64,r:65,t:67,y:69,u:71,q:72,s:74,d:76,f:77,g:79,h:81,j:83};
const held=new Set();

addEventListener('keydown',e=>{
  if(e.repeat)return;
  if(e.code==='Space'){e.preventDefault();organism.arpeggiator=!organism.arpeggiator;audio();return}
  const n=keys[e.key.toLowerCase()];
  if(n==null)return;
  held.add(e.key);note(n,.85);
});
addEventListener('keyup',e=>held.delete(e.key));
addEventListener('blur',()=>held.clear());

let pointerDown=false;
function touch(e){
  const r=canvas.getBoundingClientRect();
  const x=(e.clientX-r.left)/r.width;
  const y=(e.clientY-r.top)/r.height;
  const n=48+Math.round(Math.max(0,Math.min(1,x))*36);
  note(n,.55+Math.abs(y-.5)*.7,'touch');
}
canvas.addEventListener('pointerdown',e=>{pointerDown=true;canvas.setPointerCapture?.(e.pointerId);touch(e)});
canvas.addEventListener('pointermove',e=>{if(pointerDown)touch(e)});
canvas.addEventListener('pointerup',()=>pointerDown=false);
canvas.addEventListener('pointercancel',()=>pointerDown=false);

if(navigator.requestMIDIAccess){
  navigator.requestMIDIAccess().then(a=>{
    for(const input of a.inputs.values()){
      input.onmidimessage=e=>{
        const [s,n,v]=e.data,c=s&0xf0;
        if(c===0x90&&v>0)note(n,v/127,'midi');
      };
    }
  }).catch(()=>{});
}

const arp=[60,64,67,72];
const clock=new THREE.Clock();
let elapsed=0;

function updateChord(){
  const notes=[...held].map(k=>keys[k]).filter(Boolean);
  if(notes.length<2)return;
  const spread=Math.max(...notes)-Math.min(...notes);
  const sum=notes.reduce((a,n)=>a+n,0);
  organism.targetOrientation.x+=Math.sin(sum*.07)*.007;
  organism.targetOrientation.y+=Math.cos(spread*.31)*.009;
  organism.targetOrientation.z+=Math.sin(spread*.19)*.006;
  organism.targetOrientation.multiplyScalar(.995);
}
setInterval(updateChord,45);

function update(dt){
  elapsed+=dt;
  const now=performance.now()/1000;
  const silent=now-organism.lastInteraction;

  organism.breathPhase=(organism.breathPhase+dt*(organism.bpm/60/2)*Math.PI*2)%(Math.PI*2);
  organism.energy=Math.max(0,organism.energy-dt*.07);
  organism.tension=Math.max(0,organism.tension-dt*.045);
  organism.memory=Math.max(0,organism.memory-dt*.0006);
  organism.overload=Math.max(0,organism.overload-dt*.9);
  if(silent>60)organism.dormant=true;

  const breath=Math.sin(organism.breathPhase)*.5+.5;
  const activity=Math.min(1.4,organism.energy+organism.tension*.7);
  const overload=Math.min(1,organism.overload);
  const scale=.96+breath*.075+activity*.05-overload*.04;
  slime.scale.lerp(new THREE.Vector3(scale,scale*.98,scale),1-Math.exp(-dt*3));

  organism.orientation.lerp(organism.targetOrientation,1-Math.exp(-dt*1.2));
  slime.rotation.set(organism.orientation.x,organism.orientation.y,organism.orientation.z);

  for(const i of organism.impulses){i.age+=dt;i.s*=Math.exp(-dt*.8);i.d.applyAxisAngle(new THREE.Vector3(0,1,0),dt*.1)}
  organism.impulses=organism.impulses.filter(i=>i.s>.015);
  for(const w of organism.waves){w.age+=dt;w.r+=dt*(.8+w.s);w.s*=Math.exp(-dt*.55)}
  organism.waves=organism.waves.filter(w=>w.age<4&&w.s>.03);

  const pos=geometry.attributes.position;
  const v=new THREE.Vector3(),n=new THREE.Vector3();
  for(let i=0;i<pos.count;i++){
    const bx=base[i*3],by=base[i*3+1],bz=base[i*3+2];
    v.set(bx,by,bz);n.set(normals[i*3],normals[i*3+1],normals[i*3+2]);
    let d=Math.sin(elapsed*.7+bx*2.2+by*1.7)*.012+Math.sin(elapsed*1.3+bz*3.1)*.009+breath*.018;
    for(const impulse of organism.impulses){
      const alignment=Math.max(0,n.dot(impulse.d));
      d+=Math.sin(impulse.age*7-alignment*2)*alignment*impulse.s*.17;
    }
    for(const w of organism.waves)d+=Math.sin(w.r*7-v.length()*5)*w.s*.032;
    d+=overload*Math.sin(elapsed*12+bx*5+by*4)*.06;
    d+=organism.memory*.035*Math.sin(bx*3.7+bz*2.1);
    pos.setXYZ(i,bx+n.x*d,by+n.y*d,bz+n.z*d);
  }
  pos.needsUpdate=true;
  geometry.computeVertexNormals();

  energyEl.style.transform='scaleX('+Math.min(1,organism.energy)+')';
  if(organism.dormant)stateEl.textContent='SOMMEIL · MÉMOIRE CONSERVÉE';
  else if(organism.overload>.35)stateEl.textContent='SURCHARGE · DÉCHARGE';
  else stateEl.textContent='RESPIRATION · '+organism.bpm+' BPM';
}

function resize(){
  camera.aspect=innerWidth/innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth,innerHeight);
}
addEventListener('resize',resize);

renderer.setAnimationLoop(()=>{
  const dt=Math.min(clock.getDelta(),.05);
  if(organism.arpeggiator){
    organism.arpTimer+=dt;
    const step=(60/organism.bpm)/2;
    if(organism.arpTimer>=step){
      organism.arpTimer-=step;
      note(arp[organism.arpIndex++%arp.length],.38,'arpège');
    }
  }
  update(dt);
  key.position.x=Math.sin(elapsed*.18)*3.2;
  key.position.z=3.2+Math.cos(elapsed*.13)*1.2;
  renderer.render(scene,camera);
});

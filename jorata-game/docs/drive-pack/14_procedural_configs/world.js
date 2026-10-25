/** Original JORATA world helpers. Tested with bundled Three.js r180. +Y up / -Z forward. */
import * as THREE from 'three';
export const roadStyles={asphalt_two_lane:{width:7.2,material:'asphalt_clean'},countryside:{width:5.2,material:'asphalt_weathered'},mountain:{width:6.6,material:'asphalt_clean'},coastal_highway:{width:7.6,material:'asphalt_clean'},gravel:{width:5.8,material:'gravel'},forest:{width:4.8,material:'dirt_road'}};
export function roadProfile(z){return {x:18*Math.sin(z/74)+8*Math.sin(z/157),y:2.3*Math.sin(z/90)+.65*Math.sin(z/38),dx:18/74*Math.cos(z/74)+8/157*Math.cos(z/157)};}
export function terrainHeight(x,z,biome='green_highlands'){
 const r=roadProfile(z),d=Math.abs(x-r.x);let blend=THREE.MathUtils.clamp((d-4.6)/22,0,1);blend=blend*blend*(3-2*blend);
 let h=6+4*Math.sin(x/43+z/71)+3*Math.cos(x/21-z/67)+2*Math.sin(x/12+z/28);
 if(biome==='alpine')h=10+12*Math.sin(x/38+z/60)**2+5*Math.sin(x/19-z/47);
 if(biome==='coastal')h=x<r.x-22?-11-3*Math.sin(z/36):5+3*Math.sin(x/26+z/58);
 return r.y-.055+blend*h;
}
function geometry(positions,normals,uvs,indices){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));g.setIndex(indices);g.computeBoundingSphere();return g;}
export function buildRoadGeometry({startZ,endZ,width=7.2,offset=0,raise=.025,step=1}){
 if(!(endZ>startZ&&width>0&&step>0))throw new RangeError('Road needs positive length, width and step');
 const p=[],n=[],uv=[],idx=[],segments=Math.ceil((endZ-startZ)/step);
 for(let i=0;i<=segments;i++){const z=THREE.MathUtils.lerp(startZ,endZ,i/segments),r=roadProfile(z);const side=new THREE.Vector3(1,0,-r.dx).normalize();
  for(const lateral of [offset-width/2,offset+width/2]){const x=r.x+side.x*lateral,zz=z+side.z*lateral;const eps=.01,a=roadProfile(z-eps),b=roadProfile(z+eps);const tangent=new THREE.Vector3(b.x-a.x,b.y-a.y,2*eps).normalize();const normal=new THREE.Vector3().crossVectors(tangent,side).normalize();p.push(x,r.y+raise,zz);n.push(...normal);uv.push(lateral*.25,z*.25);}
  if(i<segments){const a=i*2;idx.push(a,a+2,a+3,a,a+3,a+1);}}
 return geometry(p,n,uv,idx);
}
export function buildRoadChunk({startZ,endZ,style='asphalt_two_lane',materials}){
 const {width,material}=roadStyles[style];const g=new THREE.Group();g.name=`road_${startZ}`;
 const add=(geo,mat)=>{const m=new THREE.Mesh(geo,mat);m.receiveShadow=true;g.add(m);};
 add(buildRoadGeometry({startZ,endZ,width}),materials[material]);
 for(const sign of [-1,1]){
  add(buildRoadGeometry({startZ,endZ,width:.7,offset:sign*(width/2+.35),raise:.007}),materials.gravel);
  if(!['gravel','forest'].includes(style))add(buildRoadGeometry({startZ,endZ,width:.09,offset:sign*(width/2-.18),raise:.032}),materials.road_marking);
 }
 if(!['gravel','forest'].includes(style))for(let z=Math.floor(startZ/8)*8;z<endZ;z+=8){const a=Math.max(startZ,z),b=Math.min(endZ,z+3);if(b>a)add(buildRoadGeometry({startZ:a,endZ:b,width:.11,raise:.034,step:.75}),materials.road_marking);}
 return g;
}
/** For authored roads, preserve actual geometric tangents instead of rotating straight tiles. */
export function buildSplineRoad({points,width=7.2,segments=256,shoulder=0}){
 if(points.length<2)throw new Error('At least two spline points required');
 const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)),false,'centripetal'),p=[],n=[],uv=[],idx=[];let length=0,last=null;
 for(let i=0;i<=segments;i++){const t=i/segments,center=curve.getPointAt(t),tangent=curve.getTangentAt(t).normalize(),side=new THREE.Vector3(tangent.z,0,-tangent.x).normalize(),up=new THREE.Vector3().crossVectors(tangent,side).normalize();if(last)length+=center.distanceTo(last);last=center;
  for(const s of [-1,1]){const pos=center.clone().addScaledVector(side,s*(width/2+shoulder));p.push(...pos);n.push(...up);uv.push(s*(width/2+shoulder)*.25,length*.25);}
  if(i<segments){const a=i*2;idx.push(a,a+2,a+3,a,a+3,a+1);}}
 return {geometry:geometry(p,n,uv,idx),curve,length,connectors:{start:{position:curve.getPointAt(0).toArray(),tangent:curve.getTangentAt(0).toArray()},end:{position:curve.getPointAt(1).toArray(),tangent:curve.getTangentAt(1).toArray()}}};
}
export function buildTerrainChunk({startZ,endZ,width=320,step=4,biome='green_highlands',height=terrainHeight}){
 const nx=Math.ceil(width/step),nz=Math.ceil((endZ-startZ)/step),p=[],n=[],uv=[],idx=[];
 for(let j=0;j<=nz;j++){const z=THREE.MathUtils.lerp(startZ,endZ,j/nz);for(let i=0;i<=nx;i++){const x=-width/2+i*width/nx,y=height(x,z,biome),eps=.1;const normal=new THREE.Vector3(height(x-eps,z,biome)-height(x+eps,z,biome),2*eps,height(x,z-eps,biome)-height(x,z+eps,biome)).normalize();p.push(x,y,z);n.push(...normal);uv.push(x*.14,z*.14);if(i<nx&&j<nz){const a=j*(nx+1)+i;idx.push(a,a+nx+1,a+nx+2,a,a+nx+2,a+1);}}}
 return geometry(p,n,uv,idx);
}
export function seededRandom(seed){let s=seed>>>0;return ()=>{s=(s+0x6D2B79F5)>>>0;let t=s;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296;};}
export function scatterChunk({chunkIndex,seed=781,chunkSize=64,width=300,count=60,biome='green_highlands',roadWidth=7.2}){
 const rand=seededRandom(Math.imul(chunkIndex+104729,2654435761)^seed),out=[];
 for(let i=0;i<count;i++){const x=(rand()-.5)*width,z=(chunkIndex+rand())*chunkSize,r=roadProfile(z),eps=.4;const slope=Math.hypot((terrainHeight(x+eps,z,biome)-terrainHeight(x-eps,z,biome))/(2*eps),(terrainHeight(x,z+eps,biome)-terrainHeight(x,z-eps,biome))/(2*eps));
 if(Math.abs(x-r.x)<roadWidth/2+3.2||slope>.9||(biome==='coastal'&&x<r.x-19))continue;
 out.push({position:[x,terrainHeight(x,z,biome),z],rotation:rand()*Math.PI*2,scale:.7+rand()*.6,variant:Math.floor(rand()*3)+1});}return out;
}
/** Shared model resources remain caller-owned. Instancing honors all local model transforms. */
export function instanceStaticModel(template,placements){
 template.updateMatrixWorld(true);const root=new THREE.Group();const local=new THREE.Matrix4(),rotation=new THREE.Quaternion(),scale=new THREE.Vector3(),position=new THREE.Vector3();
 template.traverse(obj=>{if(!obj.isMesh)return;const instance=new THREE.InstancedMesh(obj.geometry,obj.material,placements.length);instance.castShadow=true;instance.receiveShadow=true;instance.userData.sharedGeometry=true;
 placements.forEach((p,i)=>{position.fromArray(p.position);rotation.setFromAxisAngle(new THREE.Vector3(0,1,0),p.rotation);scale.setScalar(p.scale);local.compose(position,rotation,scale);instance.setMatrixAt(i,local.clone().multiply(obj.matrixWorld));});instance.instanceMatrix.needsUpdate=true;instance.computeBoundingSphere();root.add(instance);});return root;
}
/** Fixed maximum chunk count. create(index) must return exclusively owned generated geometry. */
export class ChunkManager{
 constructor(scene,create,{chunkSize=64,behind=2,ahead=4}={}){this.scene=scene;this.create=create;this.chunkSize=chunkSize;this.behind=behind;this.ahead=ahead;this.chunks=new Map();}
 update(z){const center=Math.floor(z/this.chunkSize),wanted=new Set();for(let i=center-this.ahead;i<=center+this.behind;i++){wanted.add(i);if(!this.chunks.has(i)){const g=this.create(i);this.scene.add(g);this.chunks.set(i,g);}}
  for(const [i,g]of this.chunks)if(!wanted.has(i)){this.scene.remove(g);this.disposeChunk(g);this.chunks.delete(i);}return this.chunks.size;}
 disposeChunk(g){const done=new Set();g.traverse(o=>{if(o.isInstancedMesh)o.dispose();if(o.geometry&&!o.userData.sharedGeometry&&!done.has(o.geometry)){done.add(o.geometry);o.geometry.dispose();}});}
 dispose(){for(const g of this.chunks.values()){this.scene.remove(g);this.disposeChunk(g);}this.chunks.clear();}
}
/** Vehicle material changes must clone shared materials before mutation. */
export function rigVehicle(root){
 const nodes={spin:[],steer:[],suspension:[]};root.traverse(n=>{if(n.name.startsWith('spin_'))nodes.spin.push(n);if(n.name.startsWith('steer_front'))nodes.steer.push(n);if(n.name.startsWith('suspension_')){nodes.suspension.push({node:n,base:n.position.y});}});
 root.traverse(n=>{if(n.isMesh&&n.material?.emissive&&(n.name.includes('_lamp')||n.name.includes('turn_signal')))n.material=n.material.clone();});
 let phase=0;return {nodes,update({distance=0,steering=0,radius=.34,suspension=0,pitch=0,roll=0,brake=false,headlights=false,turnSignal=null,time=0}){
  phase-=distance/radius;nodes.spin.forEach(n=>n.rotation.x=phase);nodes.steer.forEach(n=>n.rotation.y=THREE.MathUtils.clamp(steering,-.5,.5));nodes.suspension.forEach(({node,base})=>node.position.y=base+THREE.MathUtils.clamp(suspension,-.04,.06));const body=root.getObjectByName('body_pitch_roll');if(body){body.rotation.x=pitch;body.rotation.z=roll;}
  const wheel=root.getObjectByName('steering_wheel_pivot');if(wheel)wheel.rotation.y=steering*2.5;
  root.traverse(n=>{if(!n.isMesh||!n.material?.emissive)return;const name=n.name;if(name.includes('rear_lamp'))n.material.emissive.setRGB(brake?1:.025,0,0);if(name.includes('front_lamp'))n.material.emissive.setRGB(headlights?1:.03,headlights?.95:.03,headlights?.72:.025);if(name.includes('turn_signal')){const side=name.endsWith('-1')?'left':'right';const on=(turnSignal===side||turnSignal==='hazard')&&Math.sin(time*9)>0;n.material.emissive.setRGB(on?1:0,on?.35:0,0);}});
 }};
}
export function setPaint(root,preset){const keep=new Set(['pearl_white','charcoal_black','silver','deep_navy','forest_green','dark_red','warm_beige']);const cache=new Map();root.traverse(o=>{if(o.isMesh&&keep.has(o.material?.name)){if(!cache.has(o.material)){const m=o.material.clone();m.name=o.material.name;m.color.fromArray(preset.pbrMetallicRoughness.baseColorFactor);m.roughness=preset.pbrMetallicRoughness.roughnessFactor;m.metalness=preset.pbrMetallicRoughness.metallicFactor;cache.set(o.material,m);}o.material=cache.get(o.material);}});return [...cache.values()];}

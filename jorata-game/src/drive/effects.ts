// @ts-nocheck
// Supplied JORATA runtime helper. See public/drive/LICENSE.txt.
import * as THREE from 'three';
/** Real-time gradient sky and drifting procedural clouds. Reuses a single sphere. */
export function createSky(){
 const uniforms={time:{value:0},top:{value:new THREE.Color('#77aabd')},horizon:{value:new THREE.Color('#ccd9d0')},sunDirection:{value:new THREE.Vector3(-.5,.8,.4).normalize()},coverage:{value:.06}};
 const material=new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,uniforms,vertexShader:`varying vec3 vDirection;void main(){vDirection=position;vec4 p=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_Position=p.xyww;}`,fragmentShader:`precision highp float;varying vec3 vDirection;uniform vec3 top,horizon,sunDirection;uniform float time,coverage;
 float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);}
 void main(){vec3 d=normalize(vDirection);float h=max(d.y,0.);vec3 c=mix(horizon,top,pow(h,.5));float sun=pow(max(dot(d,sunDirection),0.),650.);c+=vec3(1.,.8,.48)*sun*.8;vec2 p=d.xz/max(.12,d.y)*1.8+vec2(time*.006,0);float f=noise(p)*.58+noise(p*2.1)*.28+noise(p*4.2)*.14;float cloud=smoothstep(.85-coverage*.55,1.,f)*smoothstep(0.,.2,d.y);c=mix(c,horizon*1.2,cloud*.80);gl_FragColor=vec4(c,1.);#include <tonemapping_fragment>\n#include <colorspace_fragment>}`.replace(';#include',';\n#include')});
 const mesh=new THREE.Mesh(new THREE.SphereGeometry(900,24,12),material);mesh.frustumCulled=false;mesh.renderOrder=-100;
 return {mesh,uniforms,update(time,camera){uniforms.time.value=time;mesh.position.copy(camera.position);},dispose(){mesh.geometry.dispose();material.dispose();}};
}
export function createPrecipitation({count=900,kind='rain',seed=781}={}){
 let s=seed;const rand=()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};const p=new Float32Array(count*3),phase=new Float32Array(count);
 for(let i=0;i<count;i++){p[i*3]=(rand()-.5)*48;p[i*3+1]=rand()*30;p[i*3+2]=(rand()-.5)*48;phase[i]=rand();}
 const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(p,3));geo.setAttribute('phase',new THREE.BufferAttribute(phase,1));const uniforms={time:{value:0},speed:{value:kind==='rain'?20:2.5},snow:{value:kind==='snow'?1:0},viewportHeight:{value:720}};
 const mat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms,vertexShader:`attribute float phase;uniform float time,speed,snow,viewportHeight;void main(){vec3 p=position;p.y=mod(p.y-time*speed,30.);p.x+=sin(time*.6+phase*6.)*snow;vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;gl_PointSize=clamp((snow>.5?.035:.045)*viewportHeight/max(-mv.z,.1),2.,snow>.5?12.:15.);}`,fragmentShader:`uniform float snow;void main(){vec2 q=gl_PointCoord-.5;float a;if(snow>.5)a=smoothstep(.5,.08,length(q));else a=smoothstep(.10,.01,abs(q.x))*smoothstep(.5,.05,abs(q.y));if(a<.02)discard;gl_FragColor=vec4(.80,.89,.92,a*(snow>.5?.7:.48));}`});
 const mesh=new THREE.Points(geo,mat);mesh.frustumCulled=false;return {mesh,update(time,camera){uniforms.time.value=time;uniforms.viewportHeight.value=innerHeight;mesh.position.copy(camera.position);mesh.position.y-=5;},dispose(){geo.dispose();mat.dispose();}};
}
/** Animate lightweight water; geometry displacements and procedural Fresnel specular. */
export function animateWater(material,{amplitude=.06,speed=.8}={}){
 const time={value:0};material=material.clone();material.onBeforeCompile=shader=>{shader.uniforms.jorataTime=time;shader.vertexShader='uniform float jorataTime;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>\nvec4 waveWorld=vec4(position,1.);\n#ifdef USE_INSTANCING\nwaveWorld=instanceMatrix*waveWorld;\n#endif\nwaveWorld=modelMatrix*waveWorld;\ntransformed.y+=sin(waveWorld.x*.17+jorataTime*${speed.toFixed(3)})*${amplitude.toFixed(3)}+sin(waveWorld.z*.21-jorataTime*.6)*${(amplitude*.6).toFixed(3)};`);};material.customProgramCacheKey=()=>`jorata_water_${amplitude}_${speed}`;return {material,update(t){time.value=t;}};
}
/** Wind is a small local bend; use per-instance phase for forests when extending. */
export function addWind(material,{strength=.06}={}){
 const time={value:0};const out=material.clone();out.onBeforeCompile=shader=>{shader.uniforms.jorataWindTime=time;shader.vertexShader='uniform float jorataWindTime;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>\ntransformed.x+=sin(jorataWindTime*1.2+position.y*.5)*max(position.y,0.)*.08*${strength.toFixed(3)};`);};out.customProgramCacheKey=()=>`jorata_wind_${strength}`;return {material:out,update(t){time.value=t;}};
}

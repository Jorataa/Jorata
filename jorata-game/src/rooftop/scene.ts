import Phaser from 'phaser';
import metadata from './metadata.json';
import {Run,type Phase} from './model';
import {levels} from './levels';
import type {Actor,Input} from './movement';
import {Sound} from './audio';
const BASE='/rooftop/assets/';
export interface View {phase:Phase;health:number;progress:number;gap:number;flow:number;score:number;level:number;checkpoint:number;reason:string;loading:number;time:number}
export const snapshot=(r:Run):View=>({phase:r.phase,health:r.health,progress:Math.min(1,r.player.x/r.level.end),gap:Math.round(r.chase.gap(r.player)),flow:r.flow,score:r.score,level:r.index,checkpoint:r.checkpointIndex,reason:r.reason,loading:1,time:r.elapsed});
export class RooftopScene extends Phaser.Scene {
 run=new Run();inputState:Input={jump:false,slide:false,attack:false};soundCues=new Sound();reduced=false;ready=false;accumulator=0;hudTimer=0;effectTimer=0;lastPhase:Phase='menu';
 runner!:Phaser.GameObjects.Sprite;pursuer!:Phaser.GameObjects.Sprite;guards:Phaser.GameObjects.Sprite[]=[];world!:Phaser.GameObjects.Container;backgrounds:Phaser.GameObjects.TileSprite[]=[];fx:Phaser.GameObjects.Sprite[]=[];hints:Phaser.GameObjects.Text[]=[];cameraX=0;
 constructor(private notify:(v:View)=>void,private completed:(r:Run)=>void){super('rooftop');}
 preload(){
  this.load.on('progress',(n:number)=>this.notify({...snapshot(this.run),loading:n}));
  this.load.on('loaderror',(file:{key:string})=>{this.notify({...snapshot(this.run),loading:-1,reason:`Could not load ${file.key}. Reload to try again.`});});
  for(const a of metadata.animations)this.load.spritesheet(`${a.name}-${a.animation}`,BASE+a.spritesheet_path,{frameWidth:a.frame_width,frameHeight:a.frame_height,margin:a.margin,spacing:a.spacing,endFrame:a.frame_count-1});
  for(const o of metadata.objects)this.load.image(o.name,BASE+o.path);
  for(const theme of ['city_day','city_night','industrial_district'])for(const layer of ['sky','distant_city','near_city'])this.load.image(`${theme}-${layer}`,`${BASE}backgrounds/${theme}/${theme}_${layer}.png`);
 }
 create(){
  for(const a of metadata.animations)this.anims.create({key:`${a.name}-${a.animation}`,frames:this.anims.generateFrameNumbers(`${a.name}-${a.animation}`,{start:0,end:a.frame_count-1}),frameRate:a.fps,repeat:a.loop?-1:0});
  for(let i=0;i<3;i++)this.backgrounds.push(this.add.tileSprite(0,0,1100,700,`city_day-${['sky','distant_city','near_city'][i]}`).setOrigin(0).setScrollFactor(0).setDepth(-20+i));
  this.world=this.add.container(0,0);
  this.pursuer=this.add.sprite(-210,420,'pursuer-run').setOrigin(.5,.875).setDepth(5);
  this.runner=this.add.sprite(130,420,'runner-run').setOrigin(.5,.875).setDepth(7);
  for(let i=0;i<18;i++){const s=this.add.sprite(0,0,'landing_dust-animated').setDepth(9).setVisible(false).setActive(false);s.on('animationcomplete',()=>s.setVisible(false).setActive(false));this.fx.push(s);}
  this.buildWorld();this.ready=true;this.notify(snapshot(this.run));
 }
 buildWorld(){
  this.world.removeAll(true);this.guards.forEach(g=>g.destroy());this.guards=[];this.hints=[];
  const l=this.run.level;
  for(const [i,bg] of this.backgrounds.entries())bg.setTexture(`${l.theme}-${['sky','distant_city','near_city'][i]}`);
  for(const [i,r] of l.roofs.entries()){
   // Collision tops are y=16 in the supplied tile; the visual top is placed at roof.y.
   const wall=this.add.tileSprite(r.x,r.y+80,r.w,650,'building_facade').setOrigin(0);this.world.add(wall);
   const roof=this.add.tileSprite(r.x,r.y-16,r.w,96,'rooftop_middle').setOrigin(0);this.world.add(roof);
   if(r.climb)this.world.add(this.add.image(r.x,r.y-16,'ledge_grabbable').setOrigin(0));
   if(i%3===1)this.world.add(this.add.image(r.x+210,r.y,'water_tank').setOrigin(.5,1).setAlpha(.7));
   if(i%3===2)this.world.add(this.add.image(r.x+160,r.y,'antenna').setOrigin(.5,1));
  }
  for(const o of l.obstacles)this.world.add(this.add.image(o.x,o.y,o.kind==='slide'?'slide_barrier':'low_barrier').setOrigin(0,1));
  for(const x of l.checkpoints){const y=l.roofs.find(r=>x>=r.x&&x<r.x+r.w)!.y;this.world.add(this.add.image(x,y,'door').setOrigin(.5,1));this.world.add(this.add.sprite(x,y-55,'checkpoint_glow-animated').play('checkpoint_glow-animated'));this.label(x,y-175,'Checkpoint');}
  const end=l.roofs[l.roofs.length-1];this.world.add(this.add.image(l.end,end.y,'escape_exit').setOrigin(.5,1));this.label(l.end-80,end.y-210,'Escape →');
  this.label(160,l.roofs[0].y-155,'Keep moving.');
  const firstGap=l.roofs[0];this.label(firstGap.x+firstGap.w-190,firstGap.y-145,'Hold jump →');
  for(const [i,o] of l.obstacles.entries())if(i<2||l!==levels[0])this.label(o.x-35,o.y-155,o.kind==='slide'?'Slide ↓':'Jump to vault ↑');
  const guard=l.guards[0];if(guard)this.label(guard.x-100,guard.y-170,'Attack · J / X');
  for(const r of l.roofs.filter(r=>r.climb))this.label(r.x-100,r.y-130,'Hold jump · grab ledge');
  for(const g of this.run.guards)this.guards.push(this.add.sprite(g.x,g.y,'guard-idle').setOrigin(.5,.875).setFlipX(true).setDepth(6));
  this.cameraX=Math.max(-200,this.run.player.x-300);this.cameras.main.setScroll(this.cameraX,0);this.fx.forEach(s=>s.setVisible(false).setActive(false));
 }
 label(x:number,y:number,text:string){const t=this.add.text(x,y,text,{fontFamily:'Manrope, sans-serif',fontSize:this.scale.width<700?'26px':'18px',color:'#e9eee9',backgroundColor:'#17262d',padding:{x:10,y:6}});this.world.add(t);this.hints.push(t);}
 begin(index:number){if(!this.ready)return;this.run=new Run(index);this.run.start();this.accumulator=0;this.inputState={jump:false,slide:false,attack:false};this.buildWorld();this.soundCues.unlock();this.lastPhase='playing';this.notify(snapshot(this.run));}
 retry(){this.run.retry();this.inputState={jump:false,slide:false,attack:false};this.accumulator=0;this.buildWorld();this.notify(snapshot(this.run));}
 pause(){this.run.pause();this.clearInput();this.notify(snapshot(this.run));}
 resume(){this.clearInput();this.soundCues.unlock();this.run.resume();this.notify(snapshot(this.run));}
 clearInput(){this.inputState={jump:false,slide:false,attack:false};}
 effect(name:string,x:number,y:number){const s=this.fx.find(s=>!s.active);if(!s)return;s.setPosition(x,y).setAlpha(1).setScale(1).setVisible(true).setActive(true).play(`${name}-animated`);}
 animate(sprite:Phaser.GameObjects.Sprite,a:Actor,who:string){
  if(a.state==='paused')return;
  let name=a.state==='running'?(a.timer>0?'land':'run'):a.state==='jumping'?'jump':a.state==='falling'?'fall':a.state==='sliding'?'slide':a.state==='vaulting'?'vault':a.state==='climbing'?'climb':a.state==='rolling'?'roll':a.state==='attacking'?(this.run.strike?.kind??'punch'):a.state==='hurt'?'hurt':a.state==='caught'?'caught':'idle';
  if(who==='pursuer'&&name==='slide')name='vault';
  const key=`${who}-${name}`;if(this.anims.exists(key)&&sprite.anims.currentAnim?.key!==key)sprite.play(key);sprite.setPosition(a.x,a.y);
 }
 update(_time:number,delta:number){if(!this.ready)return;
  const r=this.run;this.accumulator=Math.min(.1,this.accumulator+delta/1000);
  while(this.accumulator>=1/120){r.step(1/120,this.inputState);for(const e of r.events){this.soundCues.play(e.kind);if(e.kind==='land')this.effect('landing_dust',e.x,e.y-8);if(e.kind==='hit'){this.effect('hit_spark',e.x,e.y);if(!this.reduced)this.cameras.main.shake(65,.0018);}if(e.kind==='checkpoint')this.effect('checkpoint_glow',e.x,e.y-70);if(e.kind==='escape'&&!this.reduced)this.effect('escape_flash',e.x,e.y-60);if(this.reduced)r.hitStop=0;}r.events.length=0;this.accumulator-=1/120;}
  this.animate(this.runner,r.player,'runner');this.animate(this.pursuer,r.chase.actor,'pursuer');
  // Combat timing uses the exact metadata frame, independent of render frame rate.
  if(r.strike)this.runner.setFrame(Math.min(5,Math.floor(r.strike.elapsed*12)));
  this.runner.setAlpha(r.invulnerable>0?.65:1);
  const animationSpeed=r.phase==='paused'||r.hitStop>0?0:1;
  this.runner.anims.timeScale=animationSpeed;this.pursuer.anims.timeScale=animationSpeed;for(const s of this.guards)s.anims.timeScale=animationSpeed;for(const s of this.fx)s.anims.timeScale=animationSpeed;
  for(const [i,g] of r.guards.entries()){
   const s=this.guards[i];if(!s)continue;const key=`guard-${g.state}`;if(s.anims.currentAnim?.key!==key)s.play(key);s.setPosition(g.x,g.y);if(g.state==='attack')s.setFrame(g.timer<.48?0:Math.min(5,Math.floor((g.timer-.48)*12)));s.setTint(g.state==='attack'&&g.timer<.6?0xffce8b:0xffffff);if(g.hp===0&&g.timer>1.2)s.setAlpha(.4);
  }
  const cam=this.cameras.main,zoom=Math.min(1,this.scale.width/(this.scale.width<700?760:1100));cam.setZoom(zoom);const w=this.scale.width/zoom,h=this.scale.height/zoom;
  // Phaser zoom is centred on the viewport; offset the scroll to retain logical coordinates.
  const target=r.player.x-w*.3;this.cameraX+=(target-this.cameraX)*(this.reduced?1:1-Math.exp(-delta/160));
  cam.setScroll(this.cameraX+(w-this.scale.width)/2,420-h*.68+(h-this.scale.height)/2);
  for(const [i,bg] of this.backgrounds.entries()){bg.setSize(w,h);bg.setPosition(-(w-this.scale.width)/2,-(h-this.scale.height)/2);bg.tileScaleX=bg.tileScaleY=h/1080;bg.tilePositionX=this.cameraX*[.08,.3,.6][i];}
  for(const t of this.hints)t.setVisible(t.x>r.player.x-200&&t.x<r.player.x+w);
  if(r.phase==='playing'&&!this.reduced){this.effectTimer+=delta/1000;if(this.effectTimer>.24){this.effectTimer=0;if(r.player.grounded)this.effect('running_dust',r.player.x-24,r.player.y-8);if(r.flow>4)this.effect('speed_streak',r.player.x-85,r.player.y-45);}}
  if(r.phase!==this.lastPhase){if(r.phase==='complete')this.completed(r);this.lastPhase=r.phase;this.notify(snapshot(r));}
  this.hudTimer+=delta;if(this.hudTimer>90){this.hudTimer=0;this.notify(snapshot(r));}
 }
}

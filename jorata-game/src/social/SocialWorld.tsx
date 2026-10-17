import { useEffect, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { GameCanvas } from '../components/GameCanvas';
import { GameModel } from '../game/model';
import { MATERIALS, PLAYER_HEIGHT, PLAYER_WIDTH, REACH, SPAWN, overlaps, tileAt, type Player } from '../../shared/game';
import { action, check, db } from './client';
import type { Profile } from './types';

export default function SocialWorld({profile}:{profile:Profile}) {
  const [model]=useState(()=>new GameModel());
  const [players,setPlayers]=useState<Player[]>([]),[status,setStatus]=useState('Connecting'),[error,setError]=useState(''),[selected,setSelected]=useState(4),[remove,setRemove]=useState(false);
  const channelRef=useRef<RealtimeChannel|null>(null);
  const peers=useRef(new Map<string,{player:Player;at:number}>());
  useEffect(()=>{
    let active=true;
    const names=new Map<string,Profile>([[profile.id,profile]]);
    model.id=profile.id;
    const color=`hsl(${parseInt(profile.id.slice(0,6),16)%360} 48% 70%)`;
    model.local={id:profile.id,username:profile.display_name,color,...SPAWN,vx:0,vy:0,grounded:false,facing:1};
    function sync(){
      if(!model.local||!active)return;
      const others=[...peers.current.values()].filter(p=>Date.now()-p.at<8000).map(p=>p.player);
      const all=[{...model.local},...others];model.sync(all);setPlayers(all);
    }
    const channel=db().channel('jr-world:meadow',{config:{private:true,presence:{key:profile.id}}});
    channelRef.current=channel;
    channel.on('broadcast',{event:'position'},({payload})=>{
      if(!active||payload.id===profile.id||typeof payload.id!=='string'||!names.has(payload.id))return;
      const {x,y,vx,vy}=payload;
      if(![x,y,vx,vy].every(n=>typeof n==='number'&&Number.isFinite(n))||x<0||x>96-PLAYER_WIDTH||y< -10||y>40||Math.abs(vx)>7||Math.abs(vy)>20)return;
      const known=names.get(payload.id)!;
      const p:Player={id:known.id,username:known.display_name,color:`hsl(${parseInt(known.id.slice(0,6),16)%360} 48% 70%)`,x,y,vx,vy,grounded:payload.grounded===true,facing:payload.facing===-1?-1:1};
      peers.current.set(p.id,{player:p,at:Date.now()});
    });
    channel.on('presence',{event:'sync'},()=>{
      const connected=new Set(Object.keys(channel.presenceState()));
      for(const id of peers.current.keys())if(!connected.has(id))peers.current.delete(id);
      sync();
      void db().from('jr_profiles').select('*').in('id',[...connected]).then(result=>{
        if(active&&!result.error)for(const p of result.data||[])names.set(p.id,p as Profile);
      });
    });
    const tiles=db().channel(`jr-world-tiles:${profile.id}`).on('postgres_changes',{event:'*',schema:'public',table:'jr_world_tiles'},event=>{
      const edit=event.new as {x:number;y:number;tile:number};
      if(active&&Number.isInteger(edit.x)&&Number.isInteger(edit.y)){model.world.tiles[edit.y*model.world.width+edit.x]=edit.tile;model.world.revision++;}
    }).subscribe();
    async function snapshot(){
      const data=check(await db().from('jr_world_tiles').select('*'));
      if(active)for(const tile of data||[])model.world.tiles[tile.y*model.world.width+tile.x]=tile.tile;
    }
    channel.subscribe(async value=>{
      if(!active)return;
      setStatus(value==='SUBSCRIBED'?'Live':'Reconnecting');model.connected=value==='SUBSCRIBED';
      if(value==='SUBSCRIBED')try{await snapshot();await channel.track({user_id:profile.id});sync();}catch(e){setError((e as Error).message);}
    });
    const timer=setInterval(()=>{
      if(!active||!model.connected||!model.local)return;
      if(model.local.y>40)Object.assign(model.local,SPAWN,{vx:0,vy:0});
      sync();
      void channel.send({type:'broadcast',event:'position',payload:{id:profile.id,x:model.local.x,y:model.local.y,vx:model.local.vx,vy:model.local.vy,grounded:model.local.grounded,facing:model.local.facing}});
    },80);
    return()=>{active=false;model.connected=false;clearInterval(timer);peers.current.clear();channelRef.current=null;void db().removeChannel(channel);void db().removeChannel(tiles);};
  },[model,profile.id]);
  function select(id:number){setSelected(id);setRemove(false);model.selected=id;model.mode='place';}
  function toggle(){setRemove(!remove);model.mode=remove?'place':'remove';}
  async function edit(x:number,y:number,rightClick:boolean){
    const p=model.local;if(!p||!model.connected)return;
    const tile=rightClick||model.mode==='remove'?0:model.selected;
    if(Math.hypot(x+.5-p.x-PLAYER_WIDTH/2,y+.5-p.y-PLAYER_HEIGHT/2)>REACH){setError('Move closer to that block.');return;}
    if(tile&&players.some(player=>overlaps(x,y,player))){setError('A player is standing there.');return;}
    if((tile===0&&tileAt(model.world,x,y)===0)||(tile!==0&&tileAt(model.world,x,y)!==0))return;
    try{await action('world_edit',{x,y,tile});setError('');}catch(e){setError((e as Error).message);}
  }
  return <section className="social-managed-world" aria-label="The Meadow social world"><GameCanvas model={model} sendInput={()=>{}} edit={(x,y,remove)=>void edit(x,y,remove)} select={select} onToggleMode={toggle}/><div className="social-world-info"><strong>The Meadow</strong><span role="status">{status} · {players.length} here</span><p>{players.map(p=>p.username).join(' · ')}</p><p>A/D to move · W/Space to jump · Click to build · Right click to remove</p></div><div className="social-world-tools">{MATERIALS.map(m=><button key={m.id} aria-pressed={selected===m.id&&!remove} onClick={()=>select(m.id)}>{m.name}</button>)}<button onClick={toggle} aria-pressed={remove}>Remove</button><button onClick={()=>{if(model.local)Object.assign(model.local,SPAWN,{vx:0,vy:0});}}>Return to spawn</button></div>{error&&<p role="alert" className="social-world-error">{error}</p>}</section>;
}

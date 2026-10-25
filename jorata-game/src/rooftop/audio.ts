import type {EventKind} from './model';
// Local Web Audio cues: no files, account, autoplay, or network requests.
export class Sound {
 context:AudioContext|null=null;muted=false;
 unlock(){this.context??=new AudioContext();void this.context.resume().catch(()=>{});}
 play(kind:EventKind){const c=this.context;if(!c||this.muted||c.state!=='running')return;
 const notes:Record<EventKind,[number,number,number]>={jump:[370,650,.09],land:[100,55,.07],hit:[180,65,.12],hurt:[130,80,.18],checkpoint:[520,840,.25],danger:[220,170,.16],vault:[430,690,.13],climb:[340,570,.15],slide:[170,100,.1],escape:[660,1100,.45]};
 const [from,to,duration]=notes[kind],osc=c.createOscillator(),gain=c.createGain();osc.type=kind==='hit'||kind==='hurt'?'triangle':'sine';osc.frequency.setValueAtTime(from,c.currentTime);osc.frequency.exponentialRampToValueAtTime(to,c.currentTime+duration);gain.gain.setValueAtTime(.055,c.currentTime);gain.gain.exponentialRampToValueAtTime(.001,c.currentTime+duration);osc.connect(gain);gain.connect(c.destination);osc.start();osc.stop(c.currentTime+duration);osc.onended=()=>{osc.disconnect();gain.disconnect();};
 }
 close(){void this.context?.close();this.context=null;}
}

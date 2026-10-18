import { useEffect, useRef, useState } from 'react';
import { SocialDialog } from './SocialDialog';
import { prepareImage } from './media';
const filters:Record<string,string>={Original:'none',Warm:'sepia(.25) saturate(1.2)',Cool:'hue-rotate(20deg) saturate(.8)','Black & white':'grayscale(1)',Vintage:'sepia(.7) contrast(.85)'};
export function PhotoEditor({send,close,initialPhoto}:{send:(photo:Blob)=>Promise<void>;close:()=>void;initialPhoto?:Blob}) {
  const [image,setImage]=useState<HTMLImageElement|null>(null),[filter,setFilter]=useState('Original'),[brightness,setBrightness]=useState(100),[contrast,setContrast]=useState(100),[saturation,setSaturation]=useState(100);
  const [background,setBackground]=useState('None'),[caption,setCaption]=useState(''),[sticker,setSticker]=useState(''),[camera,setCamera]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const canvas=useRef<HTMLCanvasElement>(null),video=useRef<HTMLVideoElement>(null),stream=useRef<MediaStream|null>(null);
  function stop(){stream.current?.getTracks().forEach(track=>track.stop());stream.current=null;setCamera(false);}
  useEffect(()=>()=>{stream.current?.getTracks().forEach(track=>track.stop());},[]);
  useEffect(()=>{if(camera&&video.current){video.current.srcObject=stream.current;void video.current.play().catch(()=>{});}},[camera]);
  async function openCamera(){setError('');try{if(!navigator.mediaDevices?.getUserMedia)throw new Error('Camera requires HTTPS and a supported browser. You can upload a photo instead.');stream.current=await navigator.mediaDevices.getUserMedia({video:{facingMode:'user',width:{ideal:1280}},audio:false});setCamera(true);}catch(e){setError(`Could not open the camera: ${(e as Error).message}`);}}
  async function load(blob:Blob){setError('');try{const prepared=await prepareImage(blob);const url=URL.createObjectURL(prepared);const next=new Image();next.onload=()=>{setImage(next);URL.revokeObjectURL(url);};next.onerror=()=>{URL.revokeObjectURL(url);setError('Could not load this photo.');};next.src=url;}catch(e){setError((e as Error).message);}}
  useEffect(()=>{if(initialPhoto)void load(initialPhoto);},[initialPhoto]);
  function capture(){if(!video.current)return;const c=document.createElement('canvas');c.width=video.current.videoWidth;c.height=video.current.videoHeight;if(!c.width)return;c.getContext('2d')!.drawImage(video.current,0,0);c.toBlob(blob=>{if(blob)void load(blob);},'image/jpeg',.9);stop();}
  useEffect(()=>{
    if(!image||!canvas.current)return;
    const c=canvas.current,framed=background!=='None',border=framed?60:0;c.width=image.width+border*2;c.height=image.height+border*2;
    const ctx=c.getContext('2d')!;ctx.fillStyle=background==='Meadow'?'#dcecaa':background==='Night'?'#29374b':'#f3d4c1';ctx.fillRect(0,0,c.width,c.height);
    ctx.filter=`${filters[filter]} brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%)`;ctx.drawImage(image,border,border);ctx.filter='none';
    if(caption){ctx.font=`600 ${Math.max(20,c.width/25)}px system-ui`;ctx.textAlign='center';ctx.lineWidth=5;ctx.strokeStyle='#17241bd9';ctx.fillStyle='white';ctx.strokeText(caption,c.width/2,c.height-border-25,c.width-40);ctx.fillText(caption,c.width/2,c.height-border-25,c.width-40);}
    if(sticker){ctx.font=`${Math.max(45,c.width/8)}px system-ui`;ctx.textAlign='left';ctx.fillText(sticker,20,Math.max(65,c.width/7));}
  },[image,filter,brightness,contrast,saturation,background,caption,sticker]);
  async function share(){if(!canvas.current)return;setBusy(true);setError('');try{const blob=await new Promise<Blob>((resolve,reject)=>canvas.current!.toBlob(value=>value?resolve(value):reject(new Error('Could not create the photo.')),'image/jpeg',.9));await send(blob);close();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  return <SocialDialog preventClose={busy} title="Photo preview" close={()=>{if(!busy){stop();close();}}}><div className="social-photo-editor"><p className="social-muted">Photos stay on your device until you press Send photo. Backgrounds are decorative frames.</p>
    <div className="social-actions"><button onClick={camera?stop:openCamera}>{camera?'Stop camera':'Use camera'}</button><label className="social-file-label">Choose photo<input aria-label="Choose photo" type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>{const file=e.target.files?.[0];if(file)void load(file);}}/></label></div>
    {camera&&<><video ref={video} muted playsInline aria-label="Camera preview"/><button onClick={capture}>Capture photo</button></>}
    {image&&<><canvas ref={canvas} aria-label="Edited photo preview"/><div className="social-filter-grid"><label>Filter<select aria-label="Filter" value={filter} onChange={e=>setFilter(e.target.value)}>{Object.keys(filters).map(key=><option key={key}>{key}</option>)}</select></label><label>Frame background<select aria-label="Frame background" value={background} onChange={e=>setBackground(e.target.value)}>{['None','Meadow','Night','Peach'].map(key=><option key={key}>{key}</option>)}</select></label>{[['Brightness',brightness,setBrightness],['Contrast',contrast,setContrast],['Saturation',saturation,setSaturation]].map(([label,value,setter])=><label key={String(label)}>{String(label)}<input type="range" min="50" max="150" value={value as number} onChange={e=>(setter as (n:number)=>void)(Number(e.target.value))}/></label>)}<label>Caption<input maxLength={60} value={caption} onChange={e=>setCaption(e.target.value)}/></label><label>Sticker<select aria-label="Sticker" value={sticker} onChange={e=>setSticker(e.target.value)}><option value="">None</option>{['🌿','❤️','⭐','🎉','👋'].map(key=><option key={key}>{key}</option>)}</select></label></div><button className="social-primary" onClick={share} disabled={busy}>{busy?'Sharing…':'Send photo'}</button></>}
    {error&&<p role="alert" className="social-error">{error}</p>}
  </div></SocialDialog>;
}

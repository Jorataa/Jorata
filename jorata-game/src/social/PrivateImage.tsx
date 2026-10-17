import { useEffect, useState } from 'react';
import { check, db } from './client';
export function PrivateImage({path,bucket='jr-media',alt}:{path:string;bucket?:'jr-media'|'jr-avatars';alt:string}) {
  const [url,setUrl]=useState(''),[failed,setFailed]=useState(false);
  useEffect(()=>{
    let alive=true;
    setUrl('');setFailed(false);
    db().storage.from(bucket).createSignedUrl(path,60).then(result=>{
      if(!alive)return;
      try{const data=check(result);if(!data)throw new Error('Unavailable');setUrl(data.signedUrl);}catch{setFailed(true);}
    });
    return ()=>{alive=false;};
  },[path,bucket]);
  return failed?<span className="social-muted">Photo unavailable</span>:url?<img src={url} alt={alt} loading="lazy" className={bucket==='jr-avatars'?'social-avatar-image':'social-message-photo'} onError={()=>setFailed(true)}/>:<span className="social-muted">Loading photo…</span>;
}

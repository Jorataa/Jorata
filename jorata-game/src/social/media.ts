import { check, db } from './client';
export async function prepareImage(file:Blob,maxSize=5*1024*1024,maxDimension=1600):Promise<Blob> {
  if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw new Error('Choose a JPEG, PNG or WebP photo.');
  if(file.size>maxSize)throw new Error(`Choose a photo smaller than ${Math.round(maxSize/1024/1024)} MB.`);
  const bytes=new Uint8Array(await file.slice(0,12).arrayBuffer());
  const jpeg=bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
  const png=bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71;
  const webp=String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP';
  if(!jpeg&&!png&&!webp)throw new Error('That file is not a supported photo.');
  const bitmap=await createImageBitmap(file);
  try {
    if(bitmap.width*bitmap.height>24000000)throw new Error('Choose a photo with fewer than 24 million pixels.');
    const scale=Math.min(1,maxDimension/Math.max(bitmap.width,bitmap.height));
    const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
    const ctx=canvas.getContext('2d')!;ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);
    return await new Promise<Blob>((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('Could not prepare this photo.')),'image/jpeg',0.87));
  }finally{bitmap.close();}
}
export async function uploadImage(file:Blob,bucket:'jr-media'|'jr-avatars',prefix:string) {
  const photo=await prepareImage(file,bucket==='jr-avatars'?2*1024*1024:5*1024*1024,bucket==='jr-avatars'?512:1600);
  const path=`${prefix}/${crypto.randomUUID()}.jpg`;
  check(await db().storage.from(bucket).upload(path,photo,{contentType:'image/jpeg',upsert:false}));
  return path;
}

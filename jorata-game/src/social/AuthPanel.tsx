import { useState, type FormEvent } from 'react';
import { action, check, db, friendlyError } from './client';
import { validateName } from './moderation';
import type { Profile } from './types';
import { uploadImage } from './media';

export function AuthPanel() {
  const [register,setRegister]=useState(false),[email,setEmail]=useState(''),[password,setPassword]=useState('');
  const [username,setUsername]=useState(''),[display,setDisplay]=useState(''),[error,setError]=useState(''),[info,setInfo]=useState(''),[busy,setBusy]=useState(false);
  async function submit(event:FormEvent) {
    event.preventDefault();setError('');setInfo('');setBusy(true);
    try {
      if(register) {
        const invalid=validateName(username,true)||validateName(display)|| (display.trim().length>40 ? 'Display names can have up to 40 characters.':null);
        if(invalid) throw new Error(invalid);
        const data=check(await db().auth.signUp({email:email.trim(),password,options:{data:{username:username.normalize('NFKC').trim().toLowerCase(),display_name:display.normalize('NFKC').trim()},emailRedirectTo:window.location.origin}}));
        if(!data.session) {setInfo('Check your email to confirm your account, then sign in.');setRegister(false);}
      } else check(await db().auth.signInWithPassword({email:email.trim(),password}));
    } catch(e) {setError(friendlyError((e as Error).message));} finally {setBusy(false);}
  }
  async function resetPassword() {
    if(!email.trim()) {setError('Enter your email first.');return;}
    setBusy(true);setError('');
    try {check(await db().auth.resetPasswordForEmail(email.trim(),{redirectTo:window.location.origin+'/?recover=1'}));setInfo('If an account exists, a password reset link will arrive by email.');}
    catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  return <main className="social-auth"><section className="social-auth-card"><a className="social-brand" href="/">✳ JORATA</a><p className="social-kicker">A LITTLE CLOSER, TOGETHER</p><h1>{register?'Find your people.':'Your conversations live here.'}</h1><p>Message a friend. Gather a community.<br/>Make room for a little play.</p><form onSubmit={submit}>
    {register&&<><label>Username<input name="username" required autoComplete="username" maxLength={24} value={username} onChange={e=>setUsername(e.target.value)} placeholder="your_unique_name"/></label><label>Display name<input name="display_name" required maxLength={40} value={display} onChange={e=>setDisplay(e.target.value)}/></label></>}
    <label>Email<input name="email" type="email" required autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)}/></label>
    <label>Password<input name="password" type="password" required minLength={8} autoComplete={register?'new-password':'current-password'} value={password} onChange={e=>setPassword(e.target.value)}/></label>
    {error&&<p role="alert" className="social-error">{error}</p>}{info&&<p role="status" className="social-info">{info}</p>}
    <button className="social-primary" disabled={busy}>{busy?'Please wait…':register?'Create account':'Sign in'}</button></form>
    <button className="social-link" onClick={()=>{setRegister(!register);setError('');setInfo('');}} disabled={busy}>{register?'Already a member? Sign in':'New here? Create an account'}</button>
    {!register&&<button className="social-link" onClick={resetPassword} disabled={busy}>Forgot password?</button>}
  </section></main>;
}

export function ProfileEditor({profile,onSaved,onClose}:{profile:Profile | null;onSaved:()=>Promise<void>;onClose?:()=>void}) {
  const [username,setUsername]=useState(profile?.username||''),[display,setDisplay]=useState(profile?.display_name||''),[bio,setBio]=useState(profile?.bio||'');
  const [image,setImage]=useState<File|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  async function save(e:FormEvent) {
    e.preventDefault();setBusy(true);setError('');
    try {
      const invalid=validateName(username,true)||validateName(display);if(invalid)throw new Error(invalid);
      const user=check(await db().auth.getUser()).user;
      if(!user)throw new Error('Sign in first.');
      const path=image?await uploadImage(image,'jr-avatars',user.id):profile?.avatar_path;
      await action('profile_update',{username,display_name:display,bio,avatar_path:path});await onSaved();onClose?.();
    }catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  return <div className="social-modal" role="dialog" aria-modal="true" aria-labelledby="profile-heading"><section className="social-dialog"><h2 id="profile-heading">{profile?'Your profile':'Complete your profile'}</h2><form onSubmit={save}>
    <label>Username<input required maxLength={24} value={username} onChange={e=>setUsername(e.target.value)}/></label><label>Display name<input required maxLength={40} value={display} onChange={e=>setDisplay(e.target.value)}/></label><label>About you<textarea maxLength={240} value={bio} onChange={e=>setBio(e.target.value)}/></label><label>Profile photo<input type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>setImage(e.target.files?.[0]||null)}/></label>
    {error&&<p role="alert" className="social-error">{error}</p>}<div className="social-actions"><button className="social-primary" disabled={busy}>{busy?'Saving…':'Save profile'}</button>{onClose&&<button type="button" onClick={onClose}>Cancel</button>}</div></form>
  </section></div>;
}

export function PasswordRecovery({done}:{done:()=>void}) {
  const [password,setPassword]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  async function submit(e:FormEvent){e.preventDefault();setBusy(true);try{check(await db().auth.updateUser({password}));history.replaceState({},'',location.pathname);done();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  return <div className="social-modal" role="dialog" aria-modal="true" aria-label="Reset password"><form className="social-dialog" onSubmit={submit}><h2>Choose a new password</h2><label>New password<input type="password" minLength={8} required value={password} onChange={e=>setPassword(e.target.value)}/></label>{error&&<p role="alert">{error}</p>}<button className="social-primary" disabled={busy}>Update password</button></form></div>;
}

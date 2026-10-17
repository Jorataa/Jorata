export function validateName(value: string, username = false): string | null {
  const name = value.normalize('NFKC').trim();
  const substitutions: Record<string,string> = { '0':'o','1':'i','3':'e','4':'a','5':'s','7':'t','@':'a','$':'s','!':'i' };
  const glyphs='аеорсхіјуѕӏαεορχιυ',ascii='aeopcxijyslaeopxiy';
  const canonical=name.toLowerCase().replace(/[аеорсхіјуѕӏαεορχιυ]/g,char=>ascii[glyphs.indexOf(char)]);
  const fold=(text:string)=>text.replace(/[013457@$!]/g,char=>substitutions[char]).replace(/[^a-z0-9]/g,'');
  const folded=fold(canonical),staff=fold(canonical.replace(/[0-9]+$/,''));
  if (/^(admin|administrator|moderator|officialsupport|jorataofficial|joratasupport|system|supportteam|jorata)$/.test(staff) || /(fuck|nigger|nigga|faggot)/.test(folded) || /(^|[^a-z])(shit|bitch|cunt|kike|chink)([^a-z]|$)/i.test(name) || /^(shit|bitch|cunt|kike|chink)$/.test(folded)) return 'Please choose a different name. Avoid offensive words and reserved staff names.';
  if (username && !/^[a-z0-9_]{3,24}$/i.test(name)) return 'Use 3–24 letters, numbers or underscores for your username.';
  if (name.length < 2 || name.length > (username ? 24 : 60) || /[\u0000-\u001f\u007f]/.test(name)) return 'Use a name with 2–60 characters.';
  return null;
}

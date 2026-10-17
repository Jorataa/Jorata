create or replace function private.jr_safe_name(value text) returns text language plpgsql immutable set search_path = '' as $$
declare cleaned text := trim(normalize(coalesce(value,''),NFKC)); folded text;
begin
  folded := regexp_replace(translate(translate(lower(cleaned),'аеорсхіјуѕӏαεορχιυ','aeopcxijyslaeopxiy'),'013457@$!','oieastasi'),'[^a-z0-9]','','g');
  if length(cleaned) < 2 or length(cleaned) > 60 or cleaned ~ '[[:cntrl:]]'
    or folded ~ '^(admin|administrator|moderator|officialsupport|jorataofficial|joratasupport|system|supportteam|jorata)([0-9]+)?$'
    or folded ~ '(fuck|nigger|nigga|faggot)'
    or lower(cleaned) ~ '(^|[^a-z])(shit|bitch|cunt|kike|chink)([^a-z]|$)'
    or folded in ('shit','bitch','cunt','kike','chink') then
    raise exception 'Please choose a different name. Avoid offensive words and reserved staff names.';
  end if;
  return cleaned;
end $$;

import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateName} from '../src/social/moderation.ts';
test('Moderation rejects staff impersonation and obvious Unicode/substitution evasion',()=>{
  for(const name of ['Administrator','ＯｆｆｉｃｉａｌＳｕｐｐｏｒｔ','Аdmin123','f4gg0t','f.u.c.k'])assert.ok(validateName(name),name);
  for(const name of ['Mossy Wanderer','José','Classical Music','Scunthorpe'])assert.equal(validateName(name),null,name);
  assert.equal(validateName('mossy_123',true),null);
  assert.ok(validateName('not a handle',true));
});

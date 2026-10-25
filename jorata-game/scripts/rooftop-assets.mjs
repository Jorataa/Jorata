import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import path from 'node:path';
const root=path.resolve('public/rooftop/assets');
function safe(relative){assert.equal(typeof relative,'string');const target=path.resolve(root,relative);assert.ok(target.startsWith(root+path.sep));assert.ok(!path.isAbsolute(relative)&&!relative.split(/[\\/]/).includes('..'));return target;}
const json=async relative=>JSON.parse(await readFile(safe(relative),'utf8'));
const manifest=await json('metadata/asset_manifest.json');
for(const entry of manifest.files){const data=await readFile(safe(entry.path));assert.equal(data.length,entry.size_bytes,entry.path);assert.equal(createHash('sha256').update(data).digest('hex'),entry.sha256,entry.path);}
const animations=await json('metadata/animations.json');
for(const a of animations.animations){const sheet=await readFile(safe(a.spritesheet_path));assert.equal(sheet.readUInt32BE(16),a.frame_width*a.sheet_columns);assert.equal(sheet.readUInt32BE(20),a.frame_height*a.sheet_rows);assert.ok(a.frame_count<=a.sheet_columns*a.sheet_rows);assert.ok(a.fps>0);assert.ok(a.anchor.x>=0&&a.anchor.y>=0);for(const frame of a.frame_paths)await readFile(safe(frame));}
const collisions=await json('metadata/collisions.json');for(const o of collisions.objects){await readFile(safe(o.path));for(const c of o.colliders){assert.ok(c.x>=0&&c.y>=0&&c.x+c.width<=o.width&&c.y+c.height<=o.height);}}
console.log(`Verified ${manifest.files.length} hashes and paths, ${animations.animations.length} sprite sheet layouts, anchors and timings, ${collisions.objects.length} environment collider contracts.`);

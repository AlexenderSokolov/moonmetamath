import {mkdirSync,readdirSync,copyFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {root,moon,run,version} from './common.mjs';
run(process.execPath,['scripts/toolchain.mjs','verify']);
moon(['build','--target','js','--release','--deny-warn']);
function walk(p){return readdirSync(p,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(join(p,e.name)):[join(p,e.name)]);}
const found=walk(join(root,'_build','js','release')).filter(p=>p.endsWith('moonmetamath.js')&&!p.includes('test'));
if(found.length!==1)throw new Error(`Expected one root JS artifact, got ${JSON.stringify(found)}`);
mkdirSync(join(root,'dist'),{recursive:true});
copyFileSync(found[0],join(root,'dist','moonmetamath-core.mjs'));
writeFileSync(join(root,'dist','build.json'),JSON.stringify({version,source:found[0].slice(root.length+1)},null,2)+'\n');
console.log('Built dist/moonmetamath-core.mjs from MoonBit.');

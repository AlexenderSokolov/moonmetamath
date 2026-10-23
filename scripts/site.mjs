import {mkdirSync,copyFileSync,readdirSync,writeFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {root} from './common.mjs';
const at=process.argv.indexOf('--out');
const out=resolve(root,at<0?'artifacts/site':process.argv[at+1]);
function copy(source,destination){mkdirSync(destination,{recursive:true});for(const e of readdirSync(source,{withFileTypes:true})){const s=join(source,e.name),d=join(destination,e.name);if(e.isDirectory())copy(s,d);else copyFileSync(s,d);}}
copy(join(root,'web'),join(out,'web'));
mkdirSync(join(out,'dist'),{recursive:true});
copyFileSync(join(root,'dist/moonmetamath-core.mjs'),join(out,'dist/moonmetamath-core.mjs'));
const fixtures=join(out,'tests/fixtures/upstream/set-mm');mkdirSync(fixtures,{recursive:true});
for(const name of ['demo0','miu','hol'])copyFileSync(join(root,`tests/fixtures/upstream/set-mm/${name}.mm`),join(fixtures,name+'.mm'));
copyFileSync(join(root,'LICENSE'),join(out,'LICENSE'));
copy(join(root,'LICENSES'),join(out,'LICENSES'));
mkdirSync(join(out,'docs'),{recursive:true});copyFileSync(join(root,'docs/THIRD_PARTY.md'),join(out,'docs/THIRD_PARTY.md'));
writeFileSync(join(out,'index.html'),'<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=web/"><title>MoonMetamath</title><a href="web/">Open MoonMetamath proof lab</a>');
writeFileSync(join(out,'.nojekyll'),'');console.log(`Static site: ${out}`);

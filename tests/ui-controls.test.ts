import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
describe('emulator HTML controls',()=>{
 it('contains the controls referenced by the emulator entry point',()=>{
  const html=readFileSync(join(process.cwd(),'index.html'),'utf8');
  const main=readFileSync(join(process.cwd(),'src/main.ts'),'utf8');
  for(const match of main.matchAll(/querySelector(?:<[^>]+>)?\('#([\w-]+)'\)/g)){
   expect(html, 'missing #'+match[1]).toContain('id="'+match[1]+'"');
  }
 });
});

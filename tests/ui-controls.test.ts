import {describe,it,expect} from 'vitest';
import html from '../index.html?raw';
import main from '../src/main.ts?raw';
describe('emulator HTML controls',()=>{
 it('contains the controls referenced by the emulator entry point',()=>{
  for(const match of main.matchAll(/querySelector(?:<[^>]+>)?\('#([\w-]+)'\)/g)){
   expect(html, 'missing #'+match[1]).toContain('id="'+match[1]+'"');
  }
 });
});

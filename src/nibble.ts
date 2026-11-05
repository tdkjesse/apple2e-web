// DOS 3.3 6-and-2 GCR sector encoding for Disk II nibble tracks.
export const GCR62=new Uint8Array([
 0x96,0x97,0x9a,0x9b,0x9d,0x9e,0x9f,0xa6,0xa7,0xab,0xac,0xad,0xae,0xaf,0xb2,0xb3,
 0xb4,0xb5,0xb6,0xb7,0xb9,0xba,0xbb,0xbc,0xbd,0xbe,0xbf,0xcb,0xcd,0xce,0xcf,0xd3,
 0xd6,0xd7,0xd9,0xda,0xdb,0xdc,0xdd,0xde,0xdf,0xe5,0xe6,0xe7,0xe9,0xea,0xeb,0xec,
 0xed,0xee,0xef,0xf2,0xf3,0xf4,0xf5,0xf6,0xf7,0xf9,0xfa,0xfb,0xfc,0xfd,0xfe,0xff
]);
export const DOS33_PHYSICAL_TO_LOGICAL=[0,7,14,6,13,5,12,4,11,3,10,2,9,1,8,15];
function fourAndFour(n:number){return [((n>>1)|0xaa)&255,(n|0xaa)&255];}
export function encodeSector62(data:Uint8Array):Uint8Array{
 if(data.length!==256)throw new Error('6-and-2 requires 256 bytes');
 const aux=new Uint8Array(86);
 // Disk II boot ROM shifts auxiliary bits into the sector buffer in
 // reverse source-pair order. The low two bits are stored un-swapped.
 const swap=[0,2,1,3];
 for(let i=0;i<86;i++){
  const a=data[i],b=i+86<256?data[i+86]:0,c=i+172<256?data[i+172]:0;
  // The first source byte contributes the low two bits, the second the
  // middle pair, and the third the high pair in the 6-and-2 auxiliary byte.
  aux[i]=(swap[a&3]<<4)|(swap[b&3]<<2)|swap[c&3];
 }
 const out:number[]=[];let previous=0;
 for(let i=85;i>=0;i--){out.push(GCR62[aux[i]^previous]);previous=aux[i];}
 for(let i=0;i<256;i++){const v=data[i]>>2;out.push(GCR62[v^previous]);previous=v;}
 out.push(GCR62[previous]);
 return Uint8Array.from(out);
}
export function encodeTrack(data:Uint8Array,track:number,volume=254):Uint8Array{
 if(data.length!==4096||track<0||track>=35)throw new Error('Expected one 4096-byte track');
 const out:number[]=[];
 for(let physical=0;physical<16;physical++){
  const logical=DOS33_PHYSICAL_TO_LOGICAL[physical];
  for(let i=0;i<16;i++)out.push(0xff);
  out.push(0xd5,0xaa,0x96);
  const checksum=volume^track^physical;
  for(const n of [volume,track,physical,checksum])out.push(...fourAndFour(n));
  out.push(0xde,0xaa,0xeb);
  for(let i=0;i<8;i++)out.push(0xff);
  out.push(0xd5,0xaa,0xad);
  out.push(...encodeSector62(data.subarray(logical*256,(logical+1)*256)));
  out.push(0xde,0xaa,0xeb);
 }
 return Uint8Array.from(out);
}

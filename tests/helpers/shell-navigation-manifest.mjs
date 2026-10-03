import fs from 'node:fs'
import path from 'node:path'
import {createHash} from 'node:crypto'
const directory='docs/design-system/evidence-06',hash=bytes=>createHash('sha256').update(bytes).digest('hex')
const canonical=(file,bytes)=>['.json','.md','.log'].includes(path.extname(file))?Buffer.from(bytes.toString().replaceAll('\r\n','\n')):bytes
if(process.argv.includes('--write')){
 const rows=fs.readdirSync(directory).filter(file=>file!=='manifest.json').sort().map(file=>{const bytes=canonical(file,fs.readFileSync(directory+'/'+file));return{path:file,bytes:bytes.length,sha256:hash(bytes),normalization:['.json','.md','.log'].includes(path.extname(file))?'UTF-8 text, CRLF normalized to LF':'binary, unchanged'}})
 fs.writeFileSync(directory+'/manifest.json',JSON.stringify(rows,null,2)+'\n')
}
const rows=JSON.parse(fs.readFileSync(directory+'/manifest.json','utf8'))
for(const row of rows){const bytes=canonical(row.path,fs.readFileSync(directory+'/'+row.path));if(bytes.length!==row.bytes||hash(bytes)!==row.sha256)throw Error('Evidence hash mismatch '+row.path)}
console.log(JSON.stringify({verifiedFiles:rows.length,textNormalization:'LF',binaryNormalization:'none'}))

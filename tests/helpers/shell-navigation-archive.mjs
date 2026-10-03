import fs from 'node:fs'
import path from 'node:path'
import {createGunzip} from 'node:zlib'
import {createInterface} from 'node:readline'
import {createHash} from 'node:crypto'
const file=process.argv[2]??'docs/design-system/evidence-06/captures.ndjson.gz'
const destination=process.argv[3]?path.resolve(process.argv[3]):null,contents=new Map()
let count=0
// Stream full computed-property records; the decompressed archive exceeds
// Node's single-string limit even though its compressed size is modest.
const lines=createInterface({input:fs.createReadStream(file).pipe(createGunzip()),crlfDelay:Infinity})
for await(const line of lines){
 const row=JSON.parse(line)
 const reference=row.encoding==='reference',bytes=reference?null:row.encoding==='utf8'?Buffer.from(row.content):Buffer.from(row.content,'base64')
 if(reference?!contents.has(row.sha256):createHash('sha256').update(bytes).digest('hex')!==row.sha256)throw Error('Archive integrity failure '+row.path)
 let target
 if(destination){target=path.resolve(destination,row.path);if(!target.startsWith(destination+path.sep))throw Error('Archive path escapes destination');fs.mkdirSync(path.dirname(target),{recursive:true});if(reference)fs.copyFileSync(contents.get(row.sha256),target);else fs.writeFileSync(target,bytes)}
 if(!reference)contents.set(row.sha256,target??true);count++
}
console.log(JSON.stringify({file,verifiedRecords:count,uniquePayloads:contents.size,extracted:destination}))

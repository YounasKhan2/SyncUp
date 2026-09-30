import { api } from '../../../shared/api'
import type { ChatMember } from '../../../shared/types'
import { wrapMediaKeyForMembers } from '../../auth/crypto/crypto'
import { MediaV2CryptoWorker } from './cryptoWorker'
import { putMediaV2Job, type MediaV2UploadJob } from './jobStore'
import { MEDIA_V2_HEADER_BYTES, MEDIA_V2_TAG_BYTES } from './recordCodec'
import { createMediaV2StageWriter, fingerprintMediaV2Source, requestMediaV2Persistence } from './staging'
import { mediaV2UploadManager } from './runtime'
const MIB=1024*1024, RECORD_BYTES=4*MIB, TRANSPORT_BYTES=5*MIB, MAX_VOICE_BYTES=256*MIB
const SUPPORTED=new Set(['audio/webm','audio/ogg','audio/mp4','audio/mpeg'])
type IntentResponse={attachmentId:string;uploadSession:{id:string;chunkSize:number;chunkCount:number;acknowledgedBytes:number}}
export async function prepareVoiceV2(file:File,durationMs:number,chatId:string,members:ChatMember[],currentUserId:string){
 if(file.size<=0||!SUPPORTED.has(file.type))throw new Error('This voice recording format is not supported.')
 if(file.size>MAX_VOICE_BYTES)throw new Error('This voice note is too large to send.')
 const attachmentId=crypto.randomUUID(),rawMediaKey=crypto.getRandomValues(new Uint8Array(32))
 const keyEnvelopes=await wrapMediaKeyForMembers(rawMediaKey,members)
 const recordCount=Math.ceil(file.size/RECORD_BYTES),ciphertextSize=file.size+recordCount*(MEDIA_V2_HEADER_BYTES+MEDIA_V2_TAG_BYTES),chunkCount=Math.ceil(ciphertextSize/TRANSPORT_BYTES)
 void requestMediaV2Persistence().catch(()=>false)
 const intent=await api<IntentResponse>('/api/uploads/v2/intent',{method:'POST',body:JSON.stringify({attachmentId,chatId,filename:file.name,contentType:file.type,mediaKind:'voice',plaintextSize:file.size,ciphertextSize,chunkSize:TRANSPORT_BYTES,chunkCount,encryptionVersion:2,keyEnvelopes,durationMs})})
 const jobId=crypto.randomUUID(),writer=await createMediaV2StageWriter(jobId,ciphertextSize),worker=new MediaV2CryptoWorker()
 try{for(let index=0;index<recordCount;index+=1){const start=index*RECORD_BYTES,plaintext=await file.slice(start,Math.min(file.size,start+RECORD_BYTES)).arrayBuffer();const record=await worker.encrypt({rawKey:rawMediaKey.slice().buffer,attachmentId,mediaKind:'voice',recordIndex:index,recordCount,plaintext});await writer.write(record)}await writer.close()}catch(error){await writer.abort();throw error}finally{worker.terminate();rawMediaKey.fill(0)}
 const now=Date.now(),job:MediaV2UploadJob={id:jobId,attachmentId,uploadSessionId:intent.uploadSession.id,chatId,mediaKind:'voice',filename:file.name,contentType:file.type,plaintextSize:file.size,ciphertextSize,chunkSize:intent.uploadSession.chunkSize,chunkCount:intent.uploadSession.chunkCount,acknowledgedBytes:intent.uploadSession.acknowledgedBytes,state:'queued',stagePath:writer.path,sourceFingerprint:await fingerprintMediaV2Source(file),keyEnvelope:keyEnvelopes[currentUserId],createdAt:now,updatedAt:now,lastError:null}
 await putMediaV2Job(job);await mediaV2UploadManager.track(job);return job
}

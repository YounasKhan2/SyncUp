import assert from 'node:assert/strict'
import test from 'node:test'
import { MEDIA_V2_HEADER_BYTES, MEDIA_V2_TAG_BYTES } from '../client/src/features/media/v2/recordCodec.ts'
import { mediaV2CiphertextSize, mediaV2RecordCount, mediaV2SourceLimit, mediaV2TransportChunkCount } from '../client/src/features/media/v2/manifest.ts'
const MIB=1024*1024, GIB=1024*MIB, overhead=MEDIA_V2_HEADER_BYTES+MEDIA_V2_TAG_BYTES
for(const size of [100*MIB,500*MIB,1*GIB]) test(`manifest stays bounded at ${size/MIB} MiB`,()=>{const records=mediaV2RecordCount(size),cipher=mediaV2CiphertextSize(size,overhead),transport=mediaV2TransportChunkCount(cipher);assert.equal(records,Math.ceil(size/(4*MIB)));assert.equal(transport,Math.ceil(cipher/(5*MIB)));assert.ok(cipher-size===records*overhead);assert.ok(records<=256)})
test('product source limits are frozen',()=>{assert.equal(mediaV2SourceLimit('video','standard'),1*GIB);assert.equal(mediaV2SourceLimit('video','hd'),1*GIB);assert.equal(mediaV2SourceLimit('video','original'),2*GIB);assert.equal(mediaV2SourceLimit('voice'),256*MIB)})
test('invalid manifest sizes fail closed',()=>{for(const value of [0,-1,Number.NaN,Number.MAX_SAFE_INTEGER+1])assert.throws(()=>mediaV2RecordCount(value))})

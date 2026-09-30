import type { MediaV2Transport } from './uploadManager'

export const pendingMediaV2Transport: MediaV2Transport = {
  async uploadNext() {
    throw new Error('Media-v2 transport is not installed yet.')
  },
  async finalize() {
    throw new Error('Media-v2 transport is not installed yet.')
  },
}

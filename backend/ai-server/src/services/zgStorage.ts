import { Indexer, MemData } from '@0gfoundation/0g-storage-ts-sdk';
import { ethers } from 'ethers';
import crypto from 'crypto';

// Use Testnet (Turbo) by default if not specified
const RPC_URL = process.env.OG_RPC_URL || 'https://evmrpc-testnet.0g.ai';
const INDEXER_RPC = process.env.OG_INDEXER_RPC || 'https://indexer-storage-testnet-turbo.0g.ai';

let provider: ethers.JsonRpcProvider | null = null;
let signer: ethers.Wallet | null = null;
let indexer: Indexer | null = null;

function init0G() {
  if (indexer) return;
  const pk = process.env.OG_PRIVATE_KEY;
  if (!pk) {
    console.warn('[0G] OG_PRIVATE_KEY not set. 0G Storage operations will fail.');
    return;
  }
  provider = new ethers.JsonRpcProvider(RPC_URL);
  signer = new ethers.Wallet(pk, provider);
  indexer = new Indexer(INDEXER_RPC);
}

function getMasterKey(): Uint8Array {
  const mk = process.env.FILE_MASTER_KEY;
  if (!mk) {
    throw new Error('FILE_MASTER_KEY not set in environment.');
  }
  // Ensure it's exactly 32 bytes (for AES-256)
  const hash = crypto.createHash('sha256').update(mk).digest();
  return Uint8Array.from(hash);
}

export async function uploadTo0G(dataStr: string, isBase64: boolean = false): Promise<{ rootHash: string; txSeq: number }> {
  init0G();
  if (!indexer || !signer) throw new Error('0G Storage not initialized (missing OG_PRIVATE_KEY)');

  const key = getMasterKey();
  
  const buffer = isBase64 ? Buffer.from(dataStr, 'base64') : Buffer.from(dataStr, 'utf-8');
  const memData = new MemData(buffer);
  
  const [tree, treeErr] = await memData.merkleTree();
  if (treeErr !== null) {
    throw new Error(`Merkle tree error: ${treeErr}`);
  }
  
  const [tx, uploadErr] = await indexer.upload(memData, RPC_URL, signer, {
    encryption: { type: 'aes256', key }
  });
  
  if (uploadErr !== null) {
    throw new Error(`Upload error: ${uploadErr}`);
  }
  
  if ('rootHash' in tx && 'txSeq' in tx) {
    return { rootHash: tx.rootHash as string, txSeq: tx.txSeq as number };
  } else if ('rootHashes' in tx && tx.rootHashes.length > 0) {
    return { rootHash: tx.rootHashes[0] as string, txSeq: (tx.txSeqs?.[0] ?? 0) as number };
  }
  throw new Error('Upload succeeded but no root hash returned');
}

export async function fetchFrom0G(rootHash: string, asBase64: boolean = false): Promise<string> {
  init0G();
  if (!indexer) throw new Error('0G Storage not initialized');

  const key = getMasterKey();

  const [blob, dlErr] = await indexer.downloadToBlob(rootHash, {
    proof: true,
    decryption: { symmetricKey: key },
  });

  if (dlErr !== null) {
    throw new Error(`Download error: ${dlErr}`);
  }

  const arrayBuffer = await blob.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  
  if (asBase64) {
    return buffer.toString('base64');
  }
  return buffer.toString('utf-8');
}

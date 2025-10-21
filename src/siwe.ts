import { SiweMessage } from 'siwe';
export async function createSiweMessage(address: string, chainId: number): Promise<string> {
  const nonce = (await fetch('/siwe/nonce').then(r=>r.json()).catch(()=>null))?.nonce ?? Math.random().toString(36).slice(2);
  const message = new SiweMessage({ domain:'getjoin.io', address, statement:'Sign in with Ethereum', uri:'https://getjoin.io', version:'1', chainId, nonce, issuedAt: new Date().toISOString() });
  return message.prepareMessage();
}
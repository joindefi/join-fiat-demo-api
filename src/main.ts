import './polyfills';
import {apiGet, apiPost} from './api';

// YOUR API_KEY to acccess JOIN API
const API_KEY = 'uat_xxxx'
let customerId: string | null = null;
let sessionId: string | null = null;

const STORAGE_KEYS = {
    sessionId: 'joinSessionId',
    customerId: 'joinCustomerId',
    address: 'joinWalletAddress'
} as const;

const log = (msg:string)=>{
    const el=document.getElementById('log')!;
    el.textContent = `[${new Date().toLocaleTimeString()}] ${msg}\n` + el.textContent;
};

const hydrateFromStorage = () => {
    const cachedSession = localStorage.getItem(STORAGE_KEYS.sessionId);
    const cachedCustomer = localStorage.getItem(STORAGE_KEYS.customerId);
    const cachedAddress = localStorage.getItem(STORAGE_KEYS.address);

    if (cachedSession) {
        sessionId = cachedSession;
        log(`Cached session loaded: ${sessionId}`);
    } else {
        log('No cached session found.');
    }

    if (cachedCustomer) {
        customerId = cachedCustomer;
        log(`Cached customer loaded: ${customerId}`);
    } else {
        log('No cached customer ID found.');
    }

    if (cachedAddress) {
        updateWalletStatus(true, cachedAddress);
        log(`Cached wallet restored: ${cachedAddress.slice(0, 6)}...${cachedAddress.slice(-4)}`);
    } else {
        updateWalletStatus(false);
    }
};

const updateWalletStatus = (connected: boolean, address?: string) => {
    const statusEl = document.getElementById('walletStatus')!;
    const indicator = statusEl.querySelector('.status-indicator')!;
    const text = statusEl.querySelector('span:last-child')!;
    
    if (connected && address) {
        indicator.className = 'status-indicator status-connected';
        text.textContent = `Connected: ${address.slice(0, 6)}...${address.slice(-4)}`;
    } else {
        indicator.className = 'status-indicator status-disconnected';
        text.textContent = 'Wallet not connected';
    }
};

async function connectWallet():Promise<string>{
    const provider=(window as any).ethereum;
    if(!provider) throw new Error('MetaMask not detected');
    const accounts=await provider.request({method:'eth_requestAccounts'});
    if(!accounts?.length) {
        throw new Error('No accounts returned by provider');
    }
    log(`Wallet connected: ${accounts[0]}`);
    updateWalletStatus(true, accounts[0]);
    localStorage.setItem(STORAGE_KEYS.address, accounts[0]);
    return accounts[0];
}

// Force a fresh SIWE signature flow
async function performSiweSignature(): Promise<void> {
    try {
        // Always request fresh wallet connection
        log('Step 1: Connecting wallet...');
        const address = await connectWallet();
        log('Step 1 ✓: Wallet connected: ' + address);

        // Get fresh message from backend
        log('Step 2: Requesting signature message from backend...');
        const initResponse = await apiPost(`/wallets-pro/signature/init`, { address });
        log('Step 2 ✓: Received response: ' + String(initResponse).slice(0, 120));
        
        const message = typeof initResponse === 'string'
            ? initResponse.trim()
            : initResponse?.message;
        if (!message) {
            throw new Error('No message received from backend. Response type: ' + typeof initResponse);
        }
        log('Message to sign: ' + message);
        
        // Request signature from user (this will ALWAYS prompt MetaMask)
        log('Step 3: Requesting signature from MetaMask...');
        const signature = await (window as any).ethereum.request({
            method: 'personal_sign',
            params: [message, address]
        });
        log('Step 3 ✓: Signature obtained: ' + signature.substring(0, 10) + '...');
        
        // Complete the signature verification
        log('Step 4: Completing authentication with backend...');
        const completeRes: {
           customerId: string;
           sessionId?: string;
           joinSessionId?: string;
           success: boolean;
        } = await apiPost(`/wallets-pro/signature`, {
            message: message,
            signature: splitSignature(signature),
            address
        }, {
            'x-join-key': API_KEY
        });
        
        log('Step 4 ✓: Authentication response: ' + JSON.stringify(completeRes));
        
        // Update global state
        sessionId = completeRes.joinSessionId ?? completeRes.sessionId ?? null;
        customerId = completeRes.customerId;

        if (sessionId) {
            localStorage.setItem(STORAGE_KEYS.sessionId, sessionId);
        } else {
            log('⚠ Authentication successful but session ID missing in response.');
            localStorage.removeItem(STORAGE_KEYS.sessionId);
        }

        if (customerId) {
            localStorage.setItem(STORAGE_KEYS.customerId, customerId);
        } else {
            localStorage.removeItem(STORAGE_KEYS.customerId);
            log('Customer ID cleared from cache.');
        }

        log('✓ Authentication successful! SessionID: ' + sessionId);
    } catch (error) {
        console.error('SIWE Error Details:', error);
        log('✗ SIWE signature failed: ' + (error as Error).message);
        throw error;
    }
}

function splitSignature(sig: string) {
    // Remove 0x prefix
    const hex = sig.startsWith('0x') ? sig.slice(2) : sig

    const r = '0x' + hex.slice(0, 64) // first 32 bytes
    const s = '0x' + hex.slice(64, 128) // next 32 bytes
    let v = parseInt(hex.slice(128, 130), 16) // recovery id

    // Normalize v: some wallets return 0/1, others 27/28
    if (v < 27) {
        v += 27
    }
    const recid = v - 27

    return { r, s, recid, encoded: sig }
}

(document.getElementById('btnSignSiwe') as HTMLButtonElement)?.addEventListener(
    'click',
    async()=> {
        // Use the new helper function that forces fresh signature every time
        await performSiweSignature();
    }
);

(document.getElementById('postCreateKYB') as HTMLButtonElement)?.addEventListener(
    'click',
    async()=> {
        if (!sessionId) {
            log('No active session. Please sign in first.');
            return;
        }
        const res=await apiPost(`/bank-pro/kyb`, {
                email: 'youremail@gmail.com',
                redirectUrl: 'http://localhost:5173/',
                businessName: 'DemoKYB',
            },
            {
                'x-join-key': API_KEY,
                'join-session-id': sessionId
            });
        log('PUT /kyb/update: '+JSON.stringify(res));
    }
);

(document.getElementById('btnGetIban') as HTMLButtonElement)?.addEventListener(
    'click',
    async()=> {
        if (!customerId) {
            log('No customer ID available. Complete SIWE/KYB first.');
            return;
        }
        const res=await apiGet(`/bank-pro/account/iban/${customerId}`, {
            'x-join-key': API_KEY
        });
        log('GET /iban: '+JSON.stringify(res));
    }
);

(document.getElementById('getStatusKYB') as HTMLButtonElement)?.addEventListener(
    'click',
    async()=> {
        if (!customerId) {
            log('No customer ID available. Complete SIWE/KYB first.');
            return;
        }
        const res=await apiGet(`/bank-pro/kyb/status/${customerId}`, {
            'x-join-key': API_KEY
        });
        log('POST /verify/kyb: '+JSON.stringify(res));
    }
);

(document.getElementById('postCreateAccount') as HTMLButtonElement)?.addEventListener(
    'click',
    async()=> {
        if (!customerId) {
            log('No customer ID available. Complete SIWE/KYB first.');
            return;
        }
        // AT LEAST ONE of the object must be in the body request
        const res=await apiPost(`/bank-pro/account/${customerId}`, {
            // individualBank optional object
            individualBank: {
                firstName: '',
                lastName: '',
                name: '',
                iban: '',
                bic: '',
                countryCode: '',
            },
            // professionalBank optional object
            professionalBank: {
                businessName: '',
                name: '',
                iban: '',
                bic: '',
                countryCode: '',
            },
            // wallet optional object
            wallet: {
                address: '',
                chain: '' // ethereum; solana; polygon; base; arbitrum; avalanche
            }
        }, {
            'x-join-key': API_KEY
        });
        log('POST /verify/kyb: '+JSON.stringify(res));
    }
);
(document.getElementById('btnGetAllAccount') as HTMLButtonElement)?.addEventListener(
    'click',
    async()=> {
        if (!customerId) {
            log('No customer ID available. Complete SIWE/KYB first.');
            return;
        }
        const res=await apiGet(`/bank-pro/account/${customerId}`, {
            'x-join-key': API_KEY
        });
        log('PUT /kyb/update: '+JSON.stringify(res));
    }
);
(document.getElementById('postCreatePayout') as HTMLButtonElement)?.addEventListener(
    'click',
    async()=> {
        if (!customerId) {
            log('No customer ID available. Complete SIWE/KYB first.');
            return;
        }
        const res = await apiPost(`/bank-pro/payout/${customerId}`, {
            fromWalletAddress: '',
            fromWalletChain: '',
            amountInCents: 1000,
            destinationAccountId: '',
        }, {
            'x-join-key': API_KEY
        });
        log('POST /bank-pro/payout: ' + JSON.stringify(res));
    }
);
(document.getElementById('btnGetAllPayout') as HTMLButtonElement)?.addEventListener(
    'click',
    async()=> {
        if (!customerId) {
            log('No customer ID available. Complete SIWE/KYB first.');
            return;
        }
        const res=await apiGet(`/bank-pro/payout/${customerId}`,
        {
            'x-join-key': API_KEY
        });
        log('PUT /kyb/update: '+JSON.stringify(res));
    }
);
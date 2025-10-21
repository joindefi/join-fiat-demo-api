# JOIN SIWE Demo Client

This Vite + TypeScript demo shows how to walk through JOIN's Sign-In With Ethereum (SIWE) flow, cache the authenticated session locally, and exercise the banking APIs (KYB, IBAN, accounts, payouts) from a simple browser UI.

## Project Structure

- `src/main.ts` – orchestrates the UI, handles SIWE, persists session/customer IDs, and wires button handlers to API calls.
- `src/api.ts` – thin wrapper around `fetch` that targets the JOIN UAT base URL and returns JSON.
- `src/polyfills.ts` – any browser polyfills the demo needs.
- `index.html` – static layout for the demo dashboard.

## Requirements

- Node.js 18+
- npm
- JOIN UAT API key with access to the endpoints used in the demo
- Wallet provider injected in the browser (MetaMask or equivalent)

## Quick Start

```bash
cd siwe-client
npm install
npm run dev
```

Vite will serve the app at `http://localhost:5173`. Make sure your wallet extension is available in that browser profile.

## Configuration

| Value                            | Where to set it                                                          | Notes                                                                |
| -------------------------------- | ------------------------------------------------------------------------ | -------------------------------------------------------------------- |
| JOIN API key                     | `src/main.ts` `API_KEY` constant                                         | Replace the placeholder `uat_*` value with your own key.             |
| Redirect URL                     | `src/main.ts` `redirectUrl` property inside the KYB request body         | Must match an allowed URL in your JOIN dashboard.                    |
| Demo email/business              | `src/main.ts` `email` and `businessName` fields in KYB request           | Update to match the entity you want to test.                         |
| Optional payout/account payloads | `src/main.ts` bodies in `postCreateAccount`, `postCreatePayout` handlers | Update to match the external bank account you want to send money to. |

## SIWE Flow Summary

1. **Connect & Sign with Ethereum** (`btnSignSiwe`)

   - Requests the user's wallet address via `eth_requestAccounts`.
   - Calls `POST /wallets-pro/signature/init` to obtain the SIWE message.
   - Prompts the wallet to sign the message with `personal_sign`.
   - Sends signature to `POST /wallets-pro/signature` (authorized with `x-join-key`).
   - Stores `joinSessionId` and `customerId` in `localStorage` for subsequent requests.

2. **Session Caching**
   - On page load `hydrateFromStorage()` reloads `joinSessionId`, `customerId`, and last wallet address from `localStorage` and updates the UI.
   - The **Clear Cache** button removes cached values and resets the session.

## Banking & KYB Actions

After SIWE succeeds (session cached), the other buttons become usable. Each handler logs requests/responses in the activity panel.

| Button               | Endpoint                                     | Notes                                                                   |
| -------------------- | -------------------------------------------- | ----------------------------------------------------------------------- |
| `Create KYB Process` | `POST /bank-pro/kyb`                         | Requires `join-session-id` header. Uses the demo email/business values. |
| `Check KYB Status`   | `GET /bank-pro/kyb/status/:customerId`       | Needs `customerId` from prior successful KYB.                           |
| `Get IBAN Details`   | `GET /bank-pro/account/iban/:customerId`     | Requires cached `customerId`.                                           |
| `Create Account`     | `POST /bank-pro/account/:customerId`         | Update the data to match your individual/professional bank info.        |
| `View Accounts`      | `GET /bank-pro/account/:customerId`          | Lists stored accounts.                                                  |
| `Create Payout`      | `POST /bank-pro/payout/:customerId`          | Provide real values for wallet, chain, amount, destination account.     |
| `All Payouts`        | `GET /bank-pro/payout/:customerId`           | Lists payouts for the customer.                                         |
| `Payout by ID`       | `GET /bank-pro/payout/:customerId/:payoutId` | Update the hard-coded `payoutId` before using.                          |

All requests automatically include `x-join-key` headers, and any missing prerequisites (session/customer ID) are logged so you know which step to complete first.

## Logs & Troubleshooting

- The **Activity Log** panel prepends each message with a timestamp so you can trace the flow.
- Errors from API calls surface both in the log and in the browser console with stack traces.

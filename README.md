# FortuneProtocol

FortuneProtocol is a full-stack Chainlink VRF v2.5 dApp that returns verifiably random fortunes on Sepolia. The repository contains a Hardhat smart contract project plus a Next.js frontend that lets users connect a wallet, request readings, view reading history, request the daily fortune, and use owner-only admin controls.

## Features

- Paid fortune readings using Chainlink VRF v2.5 randomness
- Native-payment VRF subscription support on Sepolia
- Refunds for readings that remain pending after the timeout
- Public daily fortune request flow
- Owner controls for pausing, fortune packs, fees, treasury, refund timeout, daily fortune settings, and VRF config
- Paginated reading history in the frontend
- Network detection and switching with wallet
- Transaction lifecycle tracking in the UI
- Local test support through `VRFCoordinatorV2PlusMock`

## Tech Stack

- Solidity `0.8.24`
- Hardhat, ethers v6, Chai
- Chainlink contracts
- OpenZeppelin contracts
- Next.js, React, TypeScript
- wagmi and viem

## Project Structure

```text
.
|-- contracts/
|   |-- FortuneProtocol.sol
|   `-- mocks/
|       `-- VRFCoordinatorV2PlusMock.sol
|-- scripts/
|   |-- deploy.js
|   `-- export-abi.js
|-- tests/
|   `-- FortuneProtocol.test.js
|-- deployments/
|   |-- .gitkeep
|   |-- localhost.json
|   `-- sepolia.json
|-- frontend/
|   |-- src/app/
|   |-- src/components/
|   `-- src/lib/
|-- hardhat.config.js
|-- package.json
`-- .env.example
```

## Prerequisites

- Node.js 18 or newer
- Yarn 1.x for the Hardhat project
- npm for the frontend
- A wallet with Sepolia ETH
- A Chainlink VRF v2.5 subscription on Sepolia with native ETH
- An Etherscan API key if you want automatic contract verification

## Install

Install the root Hardhat dependencies:

```bash
yarn install
```

Install the frontend dependencies:

```bash
cd frontend
npm install
cd ..
```

## Environment

Create a root `.env` file from the example:

```bash
cp .env.example .env
```

### Required for Sepolia deployment

```env
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY
PRIVATE_KEY=your_wallet_private_key
SEPOLIA_VRF_COORDINATOR=0x9Ddf47E3f0c76cB38D5b4e4a78C7b2E5E4A5f6A7
SEPOLIA_VRF_SUBSCRIPTION_ID=1234
SEPOLIA_VRF_KEY_HASH=0x787d74caea10b2b357790d5b5247c2f63d1d91572a9846f780606e4d953677ae
TREASURY_ADDRESS=0xYourTreasuryAddress
```

### Optional

```env
ETHERSCAN_API_KEY=your_etherscan_api_key
REPORT_GAS=true
```

**Important:** `TREASURY_ADDRESS` must be set for Sepolia. It does not fall back to `PRIVATE_KEY`. The Hardhat default private key is rejected for Sepolia deployment.

### Frontend environment

Create `frontend/.env.local`:

```env
NEXT_PUBLIC_CONTRACT_ADDRESS=0xYourDeployedFortuneProtocolAddress
NEXT_PUBLIC_SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY
NEXT_PUBLIC_TARGET_CHAIN_ID=11155111
```

- `NEXT_PUBLIC_TARGET_CHAIN_ID` defaults to `11155111` (Sepolia). Use `31337` for local Hardhat.
- If `NEXT_PUBLIC_CONTRACT_ADDRESS` is missing or `0x0`, the frontend shows a setup error.

Do not commit private keys or real API keys.

## Chainlink VRF Setup

1. Open https://vrf.chain.link/.
2. Connect your wallet on Sepolia.
3. Create a VRF v2.5 subscription.
4. Fund the subscription with native Sepolia ETH.
5. Copy the subscription ID into `SEPOLIA_VRF_SUBSCRIPTION_ID`.
6. Confirm the correct VRF coordinator address and key hash for Sepolia at https://docs.chain.link/vrf/v2-5/supported-networks.
7. After deploying `FortuneProtocol`, add the deployed contract address as a consumer for the subscription.

## Contract

### Constructor

```solidity
constructor(
    uint64 subscriptionId,
    address vrfCoordinator,
    bytes32 keyHash,
    address treasury_
)
```

Parameters:
- `subscriptionId` — Chainlink VRF v2.5 subscription ID (must be non-zero)
- `vrfCoordinator` — VRF coordinator address for the target network (must be non-zero)
- `keyHash` — Gas lane key hash (must be non-zero)
- `treasury_` — Address that receives withdrawn funds (must be non-zero)

### Custom Errors

| Error | Description |
|---|---|
| `InvalidVRFConfig()` | One or more VRF config values are zero/invalid |
| `EmptyFortunePack()` | `addPack` or `setPack` called with zero fortunes |
| `InvalidPayment(required, received)` | `msg.value` does not equal the pack price exactly |
| `InvalidPack()` | Pack ID out of range |
| `ReadingNotFound()` | Reading ID does not exist |
| `NotReadingOwner()` | Caller does not own the reading |
| `ReadingNotPending()` | Reading is not in Pending status |
| `RefundTimeoutNotMet()` | Refund timeout has not elapsed |
| `TooManyPending()` | More than 5 pending readings |
| `PackNotActive()` | Pack is deactivated |
| `TransferFailed()` | ETH transfer failed |
| `ZeroAddress()` | Zero address provided |

### Key View Functions

| Function | Description |
|---|---|
| `getReading(readingId)` | Returns a single reading |
| `getUserReadingIds(user)` | Returns all reading IDs for a user |
| `getUserReadingIdsPage(user, offset, limit)` | Returns a paginated slice of reading IDs and total count |
| `getUserReadings(user)` | Returns all full readings for a user |
| `getPendingRefundCount(user)` | Count of refundable pending readings |
| `getPack(packId)` | Returns a fortune pack |
| `getAllPacks()` | Returns all fortune packs |
| `getVRFConfig()` | Returns current VRF configuration |

## Contract Commands

Compile the contracts:

```bash
yarn compile
```

Run the test suite:

```bash
yarn test
```

Run Solhint:

```bash
yarn lint
```

Export the compiled contract ABI into the frontend:

```bash
yarn export:abi
```

## Deployment

### Local (in-memory Hardhat network)

```bash
yarn hardhat run scripts/deploy.js
```

### Local persistent node

Start a node:

```bash
yarn hardhat node
```

Then deploy:

```bash
yarn hardhat run scripts/deploy.js --network localhost
```

### Sepolia

```bash
yarn deploy:sepolia
```

The deployment script:

- Validates required Sepolia environment variables (rejects missing values and the default Hardhat private key)
- Deploys `VRFCoordinatorV2PlusMock` on local networks and creates/funds a mock subscription
- Deploys `FortuneProtocol` with the `(subscriptionId, vrfCoordinator, keyHash, treasury)` constructor
- Adds the contract as a mock subscription consumer locally
- Verifies the Sepolia deployment on Etherscan when `ETHERSCAN_API_KEY` is set
- Saves deployment output to `deployments/sepolia.json` or `deployments/localhost.json`
- Exports the ABI after deployment

If automatic verification fails, run:

```bash
yarn hardhat verify --network sepolia <contract_address> <subscription_id> <vrf_coordinator> <key_hash> <treasury_address>
```

### Deployment Output

```json
{
  "network": "sepolia",
  "chainId": 11155111,
  "contractAddress": "0x...",
  "deployer": "0x...",
  "treasury": "0x...",
  "vrfCoordinator": "0x...",
  "subscriptionId": "1234",
  "keyHash": "0x...",
  "nativePayment": true,
  "transactionHash": "0x...",
  "blockNumber": 1234567,
  "verified": true,
  "timestamp": "2026-07-02T00:00:00.000Z"
}
```

## Frontend

Configure the frontend environment:

```bash
cd frontend
printf "NEXT_PUBLIC_CONTRACT_ADDRESS=<contract_address>\nNEXT_PUBLIC_SEPOLIA_RPC_URL=<rpc_url>\n" > .env.local
```

Start the development server:

```bash
npm run dev
```

Open http://localhost:3000.

Build the frontend:

```bash
cd frontend && npm run build
```

Or use the root-level script that also compiles and exports the ABI:

```bash
yarn frontend:build
```

### Frontend features

- **Config validation**: Shows a setup error if `NEXT_PUBLIC_CONTRACT_ADDRESS` is missing
- **Network switching**: Displays the connected chain; shows a `Switch Network` button when on the wrong chain using `useSwitchChain`; disables write actions until connected and on the target chain
- **Transaction lifecycle**: Tracks states: `idle` → `confirming_wallet` → `submitted` → `waiting_for_vrf` → `fulfilled` / `failed`
- **Reading history**: Uses `getUserReadingIdsPage` with 10-item pages; shows newest first with `Load More`
- **Status display**: Shows Pending, Waiting for VRF, Refundable, Fulfilled, or Refunded
- **Refund**: Only shows `Claim Refund` when the refund timeout has passed
- **Admin panel**: Owner-only gating with loading state; ETH-denominated fee inputs with `parseEther`

## User Flow

1. Connect a wallet in the frontend.
2. The frontend checks the contract address is configured and the wallet is on the correct chain.
3. Select an active fortune pack.
4. Request a reading and confirm the transaction.
5. Follow the transaction lifecycle states in the UI.
6. View the fulfilled fortune in reading history.
7. Claim a refund if the reading remains pending past the refund timeout.

## Package Scripts

| Script | Command |
|---|---|
| `test` | `hardhat test tests/FortuneProtocol.test.js` |
| `export:abi` | `node scripts/export-abi.js` |
| `deploy:sepolia` | Deploy + write deployment JSON + export ABI |
| `frontend:build` | Compile + export ABI + build frontend |

## Tests

The test suite contains 57 Hardhat tests covering deployment, constructor validation, reading requests, VRF fulfillment, paginated reads, refunds, daily fortunes, owner controls, withdrawals, views, event emission, and empty-pack rejection.

Run them with:

```bash
yarn test
```

## Deployment Checklist

1. Sepolia wallet is funded with ETH
2. VRF v2.5 subscription created and funded with native Sepolia ETH
3. Correct VRF coordinator and key hash confirmed from https://docs.chain.link/vrf/v2-5/supported-networks
4. Root `.env` configured with all required values
5. Contract deployed via `yarn deploy:sepolia`
6. Contract added as VRF subscription consumer in the Chainlink VRF app
7. ABI exported (`yarn export:abi` or done automatically by the deploy script)
8. Frontend `frontend/.env.local` updated with the contract address
9. Contract verified on Etherscan

## Threat Model

### Owner privileges
The owner can pause the contract, withdraw all funds, change pack prices, update VRF config, and transfer ownership. The owner should be a trusted account (e.g., a multisig in production). Compromised owner keys could drain contract funds or disrupt service.

### VRF subscription dependency
Reading requests fail if the VRF subscription runs out of native ETH or if the contract is removed as a consumer. The subscription must be monitored and funded periodically.

### Pending/refund behavior
Readings remain `Pending` until the VRF callback arrives. If the callback never arrives (e.g., subscription underfunded), the user can claim a refund after `refundTimeout` (1 day). The frontend computes "Refundable" status from `status == Pending` and `requestedAt + refundTimeout`.

### Treasury withdrawals
Only the owner can withdraw contract funds. Withdrawals go to the `treasury` address (or an arbitrary address via `withdrawTo`). Users rely on the owner to not withdraw before pending readings are fulfilled.

### Frontend trust assumptions
The frontend reads contract state through a public RPC. Users should verify the contract address and ABI independently. The frontend does not hold private keys; all transactions are signed by the user's wallet.

## Troubleshooting

### VRF request fails on Sepolia

Make sure the VRF subscription is funded with native Sepolia ETH and the deployed `FortuneProtocol` address has been added as a subscription consumer.

### Frontend cannot find the contract

Check `frontend/.env.local` and confirm `NEXT_PUBLIC_CONTRACT_ADDRESS` is the latest deployed contract address. Restart `npm run dev` after changing environment variables. The frontend will show a setup error if the address is missing.

### Wallet is on the wrong network

Use the `Switch Network` button in the frontend header. For Sepolia, the target chain ID is `11155111`. For local testing, set `NEXT_PUBLIC_TARGET_CHAIN_ID=31337` and connect to Hardhat.

### Contract verification fails

Confirm `ETHERSCAN_API_KEY` is set and verify with the correct constructor arguments:

```bash
yarn hardhat verify --network sepolia <contract_address> <subscription_id> <vrf_coordinator> <key_hash> <treasury_address>
```

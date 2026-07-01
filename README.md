# FortuneProtocol

FortuneProtocol is a full-stack Chainlink VRF v2.5 dApp that returns verifiably random fortunes on Sepolia. The repository contains a Hardhat smart contract project plus a Next.js frontend that lets users connect a wallet, request readings, view reading history, request the daily fortune, and use owner-only admin controls.

## Features

- Paid fortune readings using Chainlink VRF v2.5 randomness
- Native-payment VRF subscription support on Sepolia
- Refunds for readings that remain pending after the timeout
- Public daily fortune request flow
- Owner controls for pausing, fortune packs, fees, treasury, refund timeout, daily fortune settings, and VRF config
- Next.js frontend with wagmi, viem, and React Query
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
- npm for the frontend, or another package manager if you update the lockfile strategy
- A wallet with Sepolia ETH
- A Chainlink VRF v2.5 subscription on Sepolia
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

Set these values before deploying to Sepolia:

```env
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY
PRIVATE_KEY=your_wallet_private_key
ETHERSCAN_API_KEY=your_etherscan_api_key
SEPOLIA_VRF_COORDINATOR=0x9Ddf47E3f0c76cB38D5b4e4a78C7b2E5E4A5f6A7
SEPOLIA_VRF_SUBSCRIPTION_ID=1234
```

Optional values used by the scripts/config:

```env
TREASURY_ADDRESS=0xYourTreasuryAddress
REPORT_GAS=true
```

The frontend uses a separate `frontend/.env.local` file:

```env
NEXT_PUBLIC_CONTRACT_ADDRESS=0xYourDeployedFortuneProtocolAddress
NEXT_PUBLIC_SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY
```

Do not commit private keys or real API keys.

## Chainlink VRF Setup

1. Open https://vrf.chain.link/.
2. Connect your wallet on Sepolia.
3. Create a VRF v2.5 subscription.
4. Fund the subscription with native Sepolia ETH.
5. Copy the subscription ID into `SEPOLIA_VRF_SUBSCRIPTION_ID`.
6. After deploying `FortuneProtocol`, add the deployed contract address as a consumer for the subscription.

## Contract Commands

Compile the contracts:

```bash
yarn compile
```

Run the test suite:

```bash
yarn hardhat test tests/FortuneProtocol.test.js
```

Run Solhint:

```bash
yarn lint
```

Export the compiled contract ABI into the frontend:

```bash
yarn compile
node scripts/export-abi.js
```

## Deployment

Deploy to the default in-memory Hardhat network:

```bash
yarn hardhat run scripts/deploy.js
```

For a local frontend workflow, run a persistent local node in one terminal:

```bash
yarn hardhat node
```

Then deploy to that local node in another terminal:

```bash
yarn hardhat run scripts/deploy.js --network localhost
```

Deploy to Sepolia:

```bash
yarn deploy:sepolia
```

The deployment script:

- Deploys `VRFCoordinatorV2PlusMock` on local networks
- Creates and funds a mock VRF subscription locally
- Deploys `FortuneProtocol`
- Adds the contract as a mock subscription consumer locally
- Verifies the Sepolia deployment on Etherscan when `ETHERSCAN_API_KEY` is set

On Sepolia, add the deployed contract as a VRF subscription consumer in the Chainlink VRF app after deployment.

If automatic verification fails, run:

```bash
yarn hardhat verify --network sepolia <contract_address> <subscription_id> <vrf_coordinator> <treasury_address>
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
npm run build
```

## Contract Overview

`FortuneProtocol.sol` exposes these main user functions:

- `requestReading(uint32 packId)` requests a paid fortune reading.
- `claimRefund(uint256 readingId)` refunds a pending reading after `refundTimeout`.
- `requestDailyFortune()` requests the public daily fortune.
- `getReading(uint256 readingId)` returns one reading.
- `getUserReadings(address user)` returns all readings for a user.
- `getAllPacks()` returns all fortune packs.

The owner can:

- Pause and unpause requests
- Add or update fortune packs
- Change pack fees
- Update treasury address
- Update refund timeout and daily fortune interval
- Enable or disable daily fortunes
- Update VRF configuration
- Withdraw contract funds

## User Flow

1. Connect a wallet in the frontend.
2. Switch to Sepolia, or to local Hardhat if testing locally.
3. Select an active fortune pack.
4. Request a reading and confirm the transaction.
5. Wait for the VRF request to be fulfilled.
6. View the fulfilled fortune in reading history.
7. Claim a refund if the reading remains pending past the refund timeout.

## Tests

The test suite contains 48 local Hardhat tests covering deployment, reading requests, VRF fulfillment, refunds, daily fortunes, owner controls, withdrawals, views, and event emission.

Run them with:

```bash
yarn hardhat test tests/FortuneProtocol.test.js
```

If you are running Hardhat through npm, the equivalent command is:

```bash
npm exec hardhat -- test tests/FortuneProtocol.test.js
```

## Troubleshooting

### VRF request fails on Sepolia

Make sure the VRF subscription is funded with native Sepolia ETH and the deployed `FortuneProtocol` address has been added as a subscription consumer.

### Frontend cannot find the contract

Check `frontend/.env.local` and confirm `NEXT_PUBLIC_CONTRACT_ADDRESS` is the latest deployed contract address. Restart `npm run dev` after changing environment variables.

### Wallet is on the wrong network

Use Sepolia for deployed contracts. For local testing, use the Hardhat network at `http://127.0.0.1:8545` with chain ID `31337`.

### Contract verification fails

Confirm `ETHERSCAN_API_KEY` is set and verify with the same constructor arguments used during deployment:

```bash
yarn hardhat verify --network sepolia <contract_address> <subscription_id> <vrf_coordinator> <treasury_address>
```

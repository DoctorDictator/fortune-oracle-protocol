# FortuneProtocol — Advanced Chainlink VRF v2.5 Fortune dApp

A full-stack decentralized application that delivers verifiably random fortunes using Chainlink VRF v2.5 on Sepolia.

## Architecture

```
User → FortuneProtocol (VRF v2.5 Consumer) → Chainlink VRF → Random Fortune
                  ↕
         Frontend (Next.js + wagmi + viem)
```

- **FortuneProtocol.sol**: Smart contract that handles paid fortune readings, daily fortunes, admin controls, and VRF v2.5 integration.
- **Frontend**: Next.js TypeScript app with wallet connect, request form, history, daily fortune display, and admin panel.
- **VRF v2.5**: Uses Chainlink's latest VRF standard for cryptographically provable randomness.

## Contracts

### `FortuneProtocol.sol`
Core contract with:
- `requestReading(uint32 packId)` — Pay ETH to request a fortune from a selected pack
- `claimRefund(uint256 readingId)` — Refund if VRF doesn't fulfill within timeout
- `requestDailyFortune()` — Anyone can trigger once per day for a public fortune
- Owner controls: fee/pack management, pause/unpause, treasury withdrawal, VRF config

### VRF v2.5 Integration
- Uses `VRFConsumerBaseV2Plus` from `@chainlink/contracts`
- Native payment support (no LINK required)
- Configurable gas lane, callback gas, confirmations, and number of words
- Subscription-based model — fund subscription with native ETH

## Prerequisites

- Node.js 18+
- Yarn or npm
- MetaMask (or any WalletConnect-compatible wallet)
- Sepolia ETH for gas and VRF subscription funding
- [Chainlink VRF Subscription](https://vrf.chain.link/) on Sepolia

## Setup

### 1. Install Dependencies

```bash
# Install Hardhat project deps
yarn install

# Install frontend deps
cd frontend
npm install
cd ..
```

### 2. Environment Variables

Copy the example env file:

```bash
cp .env.example .env
```

Fill in:
- `SEPOLIA_RPC_URL` — Alchemy/Infura RPC URL
- `PRIVATE_KEY` — Your wallet's private key (with Sepolia ETH)
- `ETHERSCAN_API_KEY` — For contract verification
- `SEPOLIA_VRF_COORDINATOR` — Sepolia VRF v2.5 coordinator address
- `SEPOLIA_VRF_SUBSCRIPTION_ID` — Your VRF subscription ID
- `TREASURY_ADDRESS` — Where contract fees will be withdrawn to

### 3. Chainlink VRF Subscription

1. Go to [vrf.chain.link](https://vrf.chain.link/)
2. Connect wallet on Sepolia
3. Create a new subscription
4. Fund the subscription with ETH (native) — at least 0.1 ETH recommended
5. Note your Subscription ID

### 4. Compile & Test

```bash
# Compile contracts
yarn hardhat compile

# Run tests (48 tests)
yarn hardhat test

# Run coverage
yarn hardhat coverage
```

## Deployment

### Local Hardhat Network

```bash
yarn hardhat run scripts/deploy.js
```

This deploys a mock VRF coordinator, creates a subscription, funds it, and deploys FortuneProtocol.

### Sepolia Testnet

```bash
yarn hardhat run scripts/deploy.js --network sepolia
```

The deploy script will:
1. Deploy FortuneProtocol with your VRF subscription
2. Wait for block confirmations
3. Verify the contract on Etherscan

After deployment:
1. Go to [vrf.chain.link](https://vrf.chain.link/)
2. Add the deployed contract as a consumer to your subscription

### Frontend Setup

1. Copy the deployed contract address
2. Set it in the frontend:

```bash
cd frontend
echo "NEXT_PUBLIC_CONTRACT_ADDRESS=<deployed_address>" >> .env.local
echo "NEXT_PUBLIC_SEPOLIA_RPC_URL=<your_rpc_url>" >> .env.local
```

3. Start the dev server:

```bash
cd frontend
npm run dev
```

## Usage

### User Flow
1. Open the dApp and connect your wallet
2. Ensure you're on Sepolia network
3. Select a fortune pack
4. Click "Read My Fortune" and confirm the transaction
5. Wait for VRF fulfillment (usually 1-2 blocks)
6. View your fortune in the history panel
7. If VRF takes longer than 24h, claim a refund

### Daily Fortune
- Anyone can request a daily public fortune once per day
- The fortune is stored on-chain and displayed on the frontend
- Resets every 24 hours

### Admin Controls
The contract owner can:
- Pause/unpause the contract
- Update reading fees
- Add/edit fortune packs
- Change treasury address
- Update VRF configuration
- Withdraw accumulated fees

## Project Structure

```
.
├── contracts/
│   ├── FortuneProtocol.sol      # Main contract
│   └── mocks/
│       └── VRFCoordinatorV2PlusMock.sol
├── tests/
│   └── FortuneProtocol.test.js  # 48 tests
├── scripts/
│   ├── deploy.js                # Deployment script
│   └── export-abi.js            # ABI export helper
├── frontend/
│   └── src/
│       ├── app/                 # Next.js app
│       ├── components/          # React components
│       └── lib/                 # ABI, config, types
├── hardhat.config.js
├── package.json
└── .env.example
```

## Test Coverage

48 tests covering:
- **Deployment**: Initial state, zero-address rejection
- **Reading Request**: Valid/invalid packs, payment checks, pause state, duplicate limits
- **Fulfillment**: VRF callback, fortune selection randomness
- **Refunds**: Timeout, ownership validation, state checks, fee return
- **Daily Fortune**: Request, fulfillment, interval enforcement, disable/enable
- **Admin**: All owner-only functions, pause/unpause, VRF config, packs, treasury
- **Withdrawals**: Treasury withdraw, custom recipient, unauthorized access
- **Edge Cases**: Multiple readings, fee accumulation, empty user data, refund counts
- **Events**: Correct emission and parameter encoding

## Chainlink Resources

- [VRF v2.5 Documentation](https://docs.chain.link/vrf/v2-5/subscription/get-a-random-number)
- [VRF Supported Networks](https://docs.chain.link/vrf/v2-5/supported-networks)
- [Chainlink Automation](https://docs.chain.link/chainlink-automation)
- [VRF Subscription Manager](https://vrf.chain.link/)

## Troubleshooting

**"Insufficient native balance" on VRF request**
- Fund your VRF subscription with ETH on [vrf.chain.link](https://vrf.chain.link/)

**Contract not verified**
- Ensure `ETHERSCAN_API_KEY` is set in `.env`
- Run `yarn hardhat verify --network sepolia <address> <subId> <coordinator> <treasury>`

**Frontend shows "wrong network"**
- Switch MetaMask to Sepolia network
- Chain ID: 11155111

**Transaction fails with "Only callable by owner"**
- Connect the owner wallet that deployed the contract
- Use `transferOwnership()` if a new owner should take over

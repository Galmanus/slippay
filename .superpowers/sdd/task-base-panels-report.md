# Base Panels Report

**status:** DONE
**commit:** f13aae1
**tsc:** 0 errors
**tests:** 74/74 passed
**build:** `VITE_COMEX_ENABLED=1 npx vite build` exit 0

Files created: ComexBase.tsx (shell), comex/base/Dashboard.tsx, Balance.tsx, Send.tsx, Exchange.tsx.
App.tsx /comex route switched from ComexSolanaProvider+ComexSolana → ComexBaseProvider+ComexBase.
Balance reads via viem publicClient.readContract, Send uses isAddress+balance pre-check+authorizeBasePayment, Exchange wires 4P buy (receiverWallet=Base 0x) and sell (PINNED_4P_RECEIVER gate+authorizeBasePayment+basescan hash). All sends only via authorizeBasePayment gate.

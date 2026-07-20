#!/usr/bin/env node
// Deploy the Slippay-managed DeFindex USDC vault via the official factory
// (portão 1 de docs/cofrinho-defindex-decision.md).
//
// Roles (factory expects Map<u32, Address>): 0=EmergencyManager, 1=FeeReceiver,
// 2=Manager, 3=RebalanceManager — layout confirmed in defindex-io/
// stellar-contracts src/utils/vault.ts (getCreateDeFindexParams).
//
// Run (testnet dry-run first, then mainnet):
//   DEPLOYER_SECRET=$(stellar keys show slippay-deployer) NETWORK=testnet \
//     node scripts/deploy-defindex-vault.mjs
//   DEPLOYER_SECRET=$(stellar keys show slippay-mainnet-deployer) NETWORK=mainnet \
//     node scripts/deploy-defindex-vault.mjs
import * as S from "../apps/web/node_modules/@stellar/stellar-sdk/lib/index.js";

const { rpc, xdr, Keypair, Networks, TransactionBuilder, Operation, Address, nativeToScVal, scValToNative } = S;

const NET = process.env.NETWORK || "testnet";
const CFG = {
  testnet: {
    rpc: "https://soroban-testnet.stellar.org",
    passphrase: Networks.TESTNET,
    factory: "CDSCWE4GLNBYYTES2OCYDFQA2LLY4RBIAX6ZI32VSUXD7GO6HRPO4A32",
    usdcSac: "CAQCFVLOBK5GIULPNZRGATJJMIZL5BSP7X5YJVMGCPTUEPFM4AVSRCJU", // Blend testnet USDC
    strategy: "CALLOM5I7XLQPPOPQMYAHUWW4N7O3JKT42KQ4ASEEVBXDJQNJOALFSUY", // USDC blend strategy
    router: "CCJUD55AG6W5HAI5LRVNKAE5WDP5XGZBUDS5WNTIVDU7O264UZZE7BRD",
    explorer: "https://stellar.expert/explorer/testnet",
  },
  mainnet: {
    rpc: "https://soroban-rpc.mainnet.stellar.gateway.fm",
    passphrase: Networks.PUBLIC,
    factory: "CDKFHFJIET3A73A2YN4KV7NSV32S6YGQMUFH3DNJXLBWL4SKEGVRNFKI",
    usdcSac: "CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75", // Circle USDC
    strategy: "CDB2WMKQQNVZMEBY7Q7GZ5C7E7IAFSNMZ7GGVD6WKTCEWK7XOIAVZSAP", // usdc_blend_autocompound_fixed
    router: "CAG5LRYQ5JVEUI5TEID72EYOVX44TTUJT5BQR2J6J77FH65PCCFAJDDH",
    explorer: "https://stellar.expert/explorer/public",
  },
}[NET];
if (!CFG) throw new Error(`unknown NETWORK ${NET}`);

const DEPLOYER_SECRET = process.env.DEPLOYER_SECRET;
if (!DEPLOYER_SECRET) throw new Error("DEPLOYER_SECRET required");
const deployer = Keypair.fromSecret(DEPLOYER_SECRET);

// All operational roles default to the deployer (Manuel's key); fee receiver
// defaults to the deployer too (on mainnet that IS the Slippay fee account
// GCEYFLGN…, which already holds the USDC trustline).
const MANAGER = process.env.MANAGER || deployer.publicKey();
const FEE_RECEIVER = process.env.FEE_RECEIVER || deployer.publicKey();
const VAULT_FEE_BPS = Number(process.env.VAULT_FEE_BPS || "50"); // 0.5%
// Non-upgradable: nobody (including us) can swap the vault code under users.
// Trade-off named in the decision doc: a vault-code bug means deploying a new
// vault and migrating, not patching in place.
const UPGRADABLE = process.env.UPGRADABLE === "1";

const server = new rpc.Server(CFG.rpc, { allowHttp: false });
const log = (...a) => console.log(...a);

const mapEntry = (k, v) => new xdr.ScMapEntry({ key: k, val: v });
const u32 = (n) => xdr.ScVal.scvU32(n);
const addr = (a) => new Address(a).toScVal();
const str = (s) => nativeToScVal(s, { type: "string" });

async function main() {
  log(`network=${NET} deployer=${deployer.publicKey()}`);
  log(`manager=${MANAGER} feeReceiver=${FEE_RECEIVER} feeBps=${VAULT_FEE_BPS} upgradable=${UPGRADABLE}`);

  const roles = xdr.ScVal.scvMap([
    mapEntry(u32(0), addr(MANAGER)),       // emergency manager
    mapEntry(u32(1), addr(FEE_RECEIVER)),  // vault fee receiver
    mapEntry(u32(2), addr(MANAGER)),       // manager
    mapEntry(u32(3), addr(MANAGER)),       // rebalance manager
  ]);
  const assets = xdr.ScVal.scvVec([
    xdr.ScVal.scvMap([
      mapEntry(xdr.ScVal.scvSymbol("address"), addr(CFG.usdcSac)),
      mapEntry(xdr.ScVal.scvSymbol("strategies"), xdr.ScVal.scvVec([
        xdr.ScVal.scvMap([
          mapEntry(xdr.ScVal.scvSymbol("address"), addr(CFG.strategy)),
          mapEntry(xdr.ScVal.scvSymbol("name"), str("USDC Blend Strategy")),
          mapEntry(xdr.ScVal.scvSymbol("paused"), nativeToScVal(false)),
        ]),
      ])),
    ]),
  ]);
  const nameSymbol = xdr.ScVal.scvMap([
    mapEntry(str("name"), str("Slippay Cofre USDC")),
    mapEntry(str("symbol"), str("SPUSDC")),
  ]);

  const src = await server.getAccount(deployer.publicKey());
  const tx = new TransactionBuilder(src, { fee: "10000000", networkPassphrase: CFG.passphrase })
    .addOperation(Operation.invokeContractFunction({
      contract: CFG.factory,
      function: "create_defindex_vault",
      args: [roles, u32(VAULT_FEE_BPS), assets, addr(CFG.router), nameSymbol, nativeToScVal(UPGRADABLE)],
    }))
    .setTimeout(120).build();

  const sim = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) {
    console.error("SIMULATION FAILED:", sim.error);
    process.exit(1);
  }
  const assembled = rpc.assembleTransaction(tx, sim).build();
  const feeXlm = Number(assembled.fee) / 1e7;
  log(`simulated ok · total fee bid: ${feeXlm} XLM`);
  if (process.env.DRY_RUN === "1") { log("(dry-run, not submitting)"); return; }

  assembled.sign(deployer);
  const sent = await server.sendTransaction(assembled);
  if (sent.status === "ERROR") throw new Error(`send: ${JSON.stringify(sent.errorResult)}`);
  let res = await server.getTransaction(sent.hash);
  for (let i = 0; i < 45 && res.status === "NOT_FOUND"; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    res = await server.getTransaction(sent.hash);
  }
  if (res.status !== "SUCCESS") throw new Error(`settled as ${res.status} (tx ${sent.hash})`);
  const vault = scValToNative(res.returnValue);
  log(`\n✅ Slippay DeFindex vault (${NET}): ${vault}`);
  log(`   tx ${sent.hash}`);
  log(`   ${CFG.explorer}/contract/${vault}`);
}

main().catch((e) => { console.error(e); process.exit(1); });

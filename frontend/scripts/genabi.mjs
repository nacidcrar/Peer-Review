import * as fs from "fs";
import * as path from "path";

const CONTRACT_NAME = "PeerReview";

// <root>/backend
const rel = "../backend";

// <root>/frontend/abi
const outdir = path.resolve("./abi");

if (!fs.existsSync(outdir)) {
  fs.mkdirSync(outdir);
}

const dir = path.resolve(rel);
const dirname = path.basename(dir);

const line =
  "\n===================================================================\n";

if (!fs.existsSync(dir)) {
  console.error(
    `${line}Unable to locate ${rel}. Expecting <root>/${dirname}${line}`
  );
  process.exit(1);
}

if (!fs.existsSync(outdir)) {
  console.error(`${line}Unable to locate ${outdir}.${line}`);
  process.exit(1);
}

const deploymentsDir = path.join(dir, "deployments");

// Network configuration mapping: chainName -> { chainId, displayName }
// This is used for display purposes, but we'll auto-detect all deployments
const networkConfig = {
  localhost: { chainId: 31337, displayName: "hardhat" },
  sepolia: { chainId: 11155111, displayName: "sepolia" },
  hardhat: { chainId: 31337, displayName: "hardhat" },
  anvil: { chainId: 31337, displayName: "hardhat" },
};

function readDeployment(chainName, contractName) {
  const chainDeploymentDir = path.join(deploymentsDir, chainName);
  const contractFile = path.join(chainDeploymentDir, `${contractName}.json`);

  if (!fs.existsSync(chainDeploymentDir) || !fs.existsSync(contractFile)) {
    return undefined;
  }

  try {
    const jsonString = fs.readFileSync(contractFile, "utf-8");
    const obj = JSON.parse(jsonString);
    return obj;
  } catch (error) {
    console.warn(`Warning: Failed to read deployment for ${chainName}: ${error.message}`);
    return undefined;
  }
}

// Auto-detect all deployments by scanning the deployments directory
const deployments = {};
let referenceABI = null;

if (!fs.existsSync(deploymentsDir)) {
  console.log(`⊘ No deployments directory found at ${deploymentsDir}`);
  console.log(`  Run 'npx hardhat deploy --network <network>' to create deployments.`);
} else {
  // Get all network directories in deployments folder
  const networkDirs = fs.readdirSync(deploymentsDir, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name);

  console.log(`Scanning deployments directory for ${CONTRACT_NAME} contract...`);
  console.log(`Found ${networkDirs.length} network deployment(s): ${networkDirs.join(", ")}\n`);

  // Try to read deployment for each detected network
  for (const networkDir of networkDirs) {
    const deployment = readDeployment(networkDir, CONTRACT_NAME);
    
    if (deployment) {
      // Get chainId: priority: deployment.chainId > networkConfig > .chainId file
      let chainId = deployment.chainId;
      
      if (!chainId) {
        // Try network config first
        if (networkConfig[networkDir]) {
          chainId = networkConfig[networkDir].chainId;
        } else {
          // Try to get chainId from .chainId file if it exists
          const networkFile = path.join(deploymentsDir, networkDir, ".chainId");
          if (fs.existsSync(networkFile)) {
            try {
              chainId = parseInt(fs.readFileSync(networkFile, "utf-8").trim());
            } catch (e) {
              console.warn(`Warning: Could not read chainId for ${networkDir}, skipping...`);
              continue;
            }
          } else {
            console.warn(`Warning: Could not determine chainId for ${networkDir}, skipping...`);
            continue;
          }
        }
      }

      // Get display name
      const displayName = networkConfig[networkDir]?.displayName || networkDir;

      deployments[chainId] = {
        address: deployment.address,
        chainId: chainId,
        chainName: displayName,
      };
      
      // Use the first deployment as reference ABI
      if (!referenceABI) {
        referenceABI = deployment.abi;
      } else {
        // Verify ABI consistency across networks
        if (JSON.stringify(referenceABI) !== JSON.stringify(deployment.abi)) {
          console.warn(
            `Warning: ABI mismatch between networks. Using reference ABI from first deployment.`
          );
        }
      }
      console.log(`✓ Found deployment on ${displayName} (${networkDir}, chainId: ${chainId}): ${deployment.address}`);
    } else {
      console.log(`⊘ Skipping ${networkDir} - no ${CONTRACT_NAME} deployment found`);
    }
  }
}

// Check if we have at least one deployment
if (!referenceABI) {
  console.error(
    `${line}No ${CONTRACT_NAME} deployments found.\n\nTo deploy the contract:\n1. Navigate to '${dirname}' directory\n2. Run 'npx hardhat deploy --network <network>'\n\nSupported networks: localhost, sepolia, etc.${line}`
  );
  process.exit(1);
}

// Generate ABI file
const tsCode = `
/*
  This file is auto-generated.
  Command: 'npm run genabi'
*/
export const ${CONTRACT_NAME}ABI = ${JSON.stringify({ abi: referenceABI }, null, 2)} as const;
`;

// Generate addresses file with only deployed networks
const addressesEntries = Object.entries(deployments)
  .map(([chainId, info]) => {
    return `  "${chainId}": { address: "${info.address}", chainId: ${info.chainId}, chainName: "${info.chainName}" }`;
  })
  .join(",\n");

const tsAddresses = `
/*
  This file is auto-generated.
  Command: 'npm run genabi'
*/
export const ${CONTRACT_NAME}Addresses = { 
${addressesEntries}
};
`;

console.log(`\nGenerated ${path.join(outdir, `${CONTRACT_NAME}ABI.ts`)}`);
console.log(`Generated ${path.join(outdir, `${CONTRACT_NAME}Addresses.ts`)}`);

fs.writeFileSync(path.join(outdir, `${CONTRACT_NAME}ABI.ts`), tsCode, "utf-8");
fs.writeFileSync(
  path.join(outdir, `${CONTRACT_NAME}Addresses.ts`),
  tsAddresses,
  "utf-8"
);

console.log(`\n✓ Successfully generated ABI and address files.`);


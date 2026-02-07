import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

// 1. PASTE YOUR ALCHEMY URL HERE (Keep the quotes!)
// It should look like: "https://eth-sepolia.g.alchemy.com/v2/AbCdEfGhIjK..."
const ALCHEMY_API_URL = "https://eth-sepolia.g.alchemy.com/v2/B0RmPl6TsU7EOT1qdwjCv";

// 2. PASTE YOUR METAMASK PRIVATE KEY HERE (Keep the quotes!)
// It should look like: "0x346cd...17181"
const METAMASK_PRIVATE_KEY = "d8da11f00e2e393478221eec28b33d2addb55efc363da0e0e97988590d91fc70"; 

const config: HardhatUserConfig = {
  solidity: "0.8.19",
  networks: {
    sepolia: {
      url: ALCHEMY_API_URL,
      accounts: [METAMASK_PRIVATE_KEY], 
    },
  },
};

export default config;
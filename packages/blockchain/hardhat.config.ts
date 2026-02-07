import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";

dotenv.config();

// Loaded from .env file — never hardcode secrets in source!
const ALCHEMY_API_URL = process.env.ALCHEMY_API_URL || "";
const METAMASK_PRIVATE_KEY = process.env.METAMASK_PRIVATE_KEY || "";

const config: HardhatUserConfig = {
  solidity: "0.8.19",
  networks: {
    sepolia: {
      url: ALCHEMY_API_URL,
      accounts: METAMASK_PRIVATE_KEY ? [METAMASK_PRIVATE_KEY] : [],
    },
  },
};

export default config;
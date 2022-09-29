import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@nomicfoundation/hardhat-chai-matchers";
import "@nomiclabs/hardhat-ethers";
import dotenv from "dotenv";

dotenv.config()

const endpoint = process.env.URL;
const privateKey = process.env.PRIVATE_KEY;
const etherscanKey = process.env.ETHERSCAN_KEY;

const config: HardhatUserConfig = {
  solidity: "0.8.17",
  networks: {
    goerli: {
      url: endpoint,
      accounts: [`0x${privateKey}`],
    },
  },
  etherscan: {
    apiKey: etherscanKey,
  },
};

export default config;

require("@nomiclabs/hardhat-waffle");
require("@nomiclabs/hardhat-etherscan");
require("@nomiclabs/hardhat-truffle5");
require("hardhat-gas-reporter");
require('solidity-coverage');
// let mnemonic = process.env.MNEMONIC
// if (!mnemonic) {
//   mnemonic = '18e14a7b6a307f426a94f8114701e7c8e774e7f9a47e2c2035db29a206321725'
// }


/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
    defaultNetwork: "hardhat",
    networks: {
        hardhat: {
            allowUnlimitedContractSize: false,
        },
        testnet: {
            url: 'https://data-seed-prebsc-1-s1.binance.org:8545',
            chainId: 97,
            // gasPrice: 20000000000,
            accounts: ['a169188d442a35eff327a448d864d82523f95e07a20e76247230ba38c596d0dd'],
        },
        mainnet: {
            url: 'https://bsc-dataseed.binance.org/',
            chainId: 56,
            accounts: ['f8ed8ab1fa0edebd1281d9685752aadbd0e34c9248e67757400c5a4b711a8153']
            // gasPrice: 20000000000,
            // accounts: {mnemonic: mnemonic}
        },
    },
    paths: {
        artifacts: './artifacts',
        cache: './cache',
        sources: './contracts',
        tests: './test',
    },
    solidity: {
        version: "0.8.4",
        settings: {
            metadata: {

                bytecodeHash: "none",
            },
            optimizer: {
                enabled: true,
                runs: 200,
            },
        },
    },
    mocha: {
        timeout: 2000000
    },
    gasReporter: {
        enabled: (process.env.REPORT_GAS) ? true : false,
        currency: 'USD'
    }

};
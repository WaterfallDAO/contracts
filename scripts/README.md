## Overview

uniMainnetTestAddress.json: store contracts address in mainnet.

test_uniLp.js: The js script is used to interact with the contracts.

## Run 

`truffle  exec scripts/test_uniLp.js --network mainnet`

### script function

##### addUniStrategyToTimeLock

*   Adds the transaction which set the vault strategy to the Timelock contract.
*   Note: After this method success executes, there is a wait of two minutes so that by the time the next method executes, the current transaction setting timeout has reached. 

##### approveStrategyToController

*   Use the TimeLock contract approval strategy to take effect in the Controller when the strategy execute time enabled.

##### setStrategyAndVaultInController

*   Enable the strategy for the corresponding vault in Controller contract;

**Note: addUniStrategyToTimeLock, approveStrategyToController and setStrategyAndVaultInController Just call it once for a single Vault.**

##### approveUserLPToVault

*   Users approve Vault to spend their own money.

##### depositToVaultAndEarn

*   Users deposit funds to the vault, and the vault invokes the strategy for investment.





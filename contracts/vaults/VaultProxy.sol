pragma solidity ^0.8.4;

import "./ProxiableVaultLib.sol";


contract VaultProxy {
    constructor(bytes memory _constructData, address _vaultLib) public {

        require(
            bytes32(0x027b9570e9fedc1a80b937ae9a06861e5faef3992491af30b684a64b3fbec7a5) ==
            ProxiableVaultLib(_vaultLib).proxiableUUID(),
            "constructor: _vaultLib not compatible"
        );

        assembly {
        // solium-disable-line
            sstore(0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc, _vaultLib)
        }

        (bool success, bytes memory returnData) = _vaultLib.delegatecall(_constructData);
        // solium-disable-line
        require(success, string(returnData));
    }

    fallback() external payable {
        assembly {
        // solium-disable-line
            let contractLogic := sload(
            0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc
            )
            calldatacopy(0x0, 0x0, calldatasize())
            let success := delegatecall(
            sub(gas(), 10000),
            contractLogic,
            0x0,
            calldatasize(),
            0,
            0
            )
            let retSz := returndatasize()
            returndatacopy(0, 0, retSz)
            switch success
            case 0 {
                revert(0, retSz)
            }
            default {
                return (0, retSz)
            }
        }
    }
}

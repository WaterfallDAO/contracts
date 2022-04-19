pragma solidity ^0.8.4;

interface IMigrationHookHandler {
    enum MigrationOutHook {PreSignal, PostSignal, PreMigrate, PostMigrate, PostCancel}

    function invokeMigrationInCancelHook(
        address _vaultProxy,
        address _prevFundDeployer,
        address _nextVaultAccessor,
        address _nextVaultLib
    ) external;

    function invokeMigrationOutHook(
        MigrationOutHook _hook,
        address _vaultProxy,
        address _nextFundDeployer,
        address _nextVaultAccessor,
        address _nextVaultLib
    ) external;
}

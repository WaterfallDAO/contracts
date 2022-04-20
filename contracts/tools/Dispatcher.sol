pragma solidity ^0.8.4;

import "../../interfaces/IDispatcher.sol";
import "../../interfaces/IMigratableVault.sol";
import "../../interfaces/IMigrationHookHandler.sol";
import "../vaults/VaultProxy.sol";

contract Dispatcher is IDispatcher {
    event CurrentFundDeployerSet(address prevFundDeployer, address nextFundDeployer);

    event MigrationCancelled(
        address indexed vaultProxy,
        address indexed prevFundDeployer,
        address indexed nextFundDeployer,
        address nextVaultAccessor,
        address nextVaultLib,
        uint256 executableTimestamp
    );

    event MigrationExecuted(
        address indexed vaultProxy,
        address indexed prevFundDeployer,
        address indexed nextFundDeployer,
        address nextVaultAccessor,
        address nextVaultLib,
        uint256 executableTimestamp
    );

    event MigrationSignaled(
        address indexed vaultProxy,
        address indexed prevFundDeployer,
        address indexed nextFundDeployer,
        address nextVaultAccessor,
        address nextVaultLib,
        uint256 executableTimestamp
    );

    event MigrationTimelockSet(uint256 prevTimelock, uint256 nextTimelock);

    event NominatedOwnerSet(address indexed nominatedOwner);

    event NominatedOwnerRemoved(address indexed nominatedOwner);

    event OwnershipTransferred(address indexed prevOwner, address indexed nextOwner);

    event MigrationInCancelHookFailed(
        bytes failureReturnData,
        address indexed vaultProxy,
        address indexed prevFundDeployer,
        address indexed nextFundDeployer,
        address nextVaultAccessor,
        address nextVaultLib
    );

    event MigrationOutHookFailed(
        bytes failureReturnData,
        IMigrationHookHandler.MigrationOutHook hook,
        address indexed vaultProxy,
        address indexed prevFundDeployer,
        address indexed nextFundDeployer,
        address nextVaultAccessor,
        address nextVaultLib
    );

    event SharesTokenSymbolSet(string _nextSymbol);

    event VaultProxyDeployed(
        address indexed fundDeployer,
        address indexed owner,
        address vaultProxy,
        address indexed vaultLib,
        address vaultAccessor,
        string fundName
    );

    struct MigrationRequest {
        address nextFundDeployer;
        address nextVaultAccessor;
        address nextVaultLib;
        uint256 executableTimestamp;
    }

    address private currentFundDeployer;
    address private nominatedOwner;
    address private owner;
    uint256 private migrationTimelock;
    string private sharesTokenSymbol;
    mapping(address => address) private vaultProxyToFundDeployer;
    mapping(address => MigrationRequest) private vaultProxyToMigrationRequest;

    modifier onlyCurrentFundDeployer() {
        require(
            msg.sender == currentFundDeployer,
            "Only the current FundDeployer can call this function"
        );
        _;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Only the contract owner can call this function");
        _;
    }

    constructor() public {
        migrationTimelock = 2 days;
        owner = msg.sender;
        sharesTokenSymbol = "ENZF";
    }

    function setSharesTokenSymbol(string calldata _nextSymbol) external override onlyOwner {
        sharesTokenSymbol = _nextSymbol;

        emit SharesTokenSymbolSet(_nextSymbol);
    }

    function claimOwnership() external override {
        address nextOwner = nominatedOwner;
        require(
            msg.sender == nextOwner,
            "claimOwnership: Only the nominatedOwner can call this function"
        );

        delete nominatedOwner;

        address prevOwner = owner;
        owner = nextOwner;

        emit OwnershipTransferred(prevOwner, nextOwner);
    }

    function removeNominatedOwner() external override onlyOwner {
        address removedNominatedOwner = nominatedOwner;
        require(
            removedNominatedOwner != address(0),
            "removeNominatedOwner: There is no nominated owner"
        );

        delete nominatedOwner;

        emit NominatedOwnerRemoved(removedNominatedOwner);
    }


    function setCurrentFundDeployer(address _nextFundDeployer) external override onlyOwner {
        require(
            _nextFundDeployer != address(0),
            "setCurrentFundDeployer: _nextFundDeployer cannot be empty"
        );
        require(
            __isContract(_nextFundDeployer),
            "setCurrentFundDeployer: Non-contract _nextFundDeployer"
        );

        address prevFundDeployer = currentFundDeployer;
        require(
            _nextFundDeployer != prevFundDeployer,
            "setCurrentFundDeployer: _nextFundDeployer is already currentFundDeployer"
        );

        currentFundDeployer = _nextFundDeployer;

        emit CurrentFundDeployerSet(prevFundDeployer, _nextFundDeployer);
    }

    function setNominatedOwner(address _nextNominatedOwner) external override onlyOwner {
        require(
            _nextNominatedOwner != address(0),
            "setNominatedOwner: _nextNominatedOwner cannot be empty"
        );
        require(
            _nextNominatedOwner != owner,
            "setNominatedOwner: _nextNominatedOwner is already the owner"
        );
        require(
            _nextNominatedOwner != nominatedOwner,
            "setNominatedOwner: _nextNominatedOwner is already nominated"
        );

        nominatedOwner = _nextNominatedOwner;

        emit NominatedOwnerSet(_nextNominatedOwner);
    }

    function __isContract(address _who) private view returns (bool isContract_) {
        uint256 size;
        assembly {
            size := extcodesize(_who)
        }

        return size > 0;
    }

    function deployVaultProxy(
        address _vaultLib,
        address _owner,
        address _vaultAccessor,
        string calldata _fundName
    ) external override onlyCurrentFundDeployer returns (address vaultProxy_) {
        require(__isContract(_vaultAccessor), "deployVaultProxy: Non-contract _vaultAccessor");

        bytes memory constructData = abi.encodeWithSelector(
            IMigratableVault.init.selector,
            _owner,
            _vaultAccessor,
            _fundName
        );
        vaultProxy_ = address(new VaultProxy(constructData, _vaultLib));

        address fundDeployer = msg.sender;
        vaultProxyToFundDeployer[vaultProxy_] = fundDeployer;

        emit VaultProxyDeployed(
            fundDeployer,
            _owner,
            vaultProxy_,
            _vaultLib,
            _vaultAccessor,
            _fundName
        );

        return vaultProxy_;
    }


    function cancelMigration(address _vaultProxy, bool _bypassFailure) external override {
        MigrationRequest memory request = vaultProxyToMigrationRequest[_vaultProxy];
        address nextFundDeployer = request.nextFundDeployer;
        require(nextFundDeployer != address(0), "cancelMigration: No migration request exists");
        require(
            msg.sender == nextFundDeployer || IMigratableVault(_vaultProxy).canMigrate(msg.sender),
            "cancelMigration: Not an allowed caller"
        );

        address prevFundDeployer = vaultProxyToFundDeployer[_vaultProxy];
        address nextVaultAccessor = request.nextVaultAccessor;
        address nextVaultLib = request.nextVaultLib;
        uint256 executableTimestamp = request.executableTimestamp;

        delete vaultProxyToMigrationRequest[_vaultProxy];

        __invokeMigrationOutHook(
            IMigrationHookHandler.MigrationOutHook.PostCancel,
            _vaultProxy,
            prevFundDeployer,
            nextFundDeployer,
            nextVaultAccessor,
            nextVaultLib,
            _bypassFailure
        );
        __invokeMigrationInCancelHook(
            _vaultProxy,
            prevFundDeployer,
            nextFundDeployer,
            nextVaultAccessor,
            nextVaultLib,
            _bypassFailure
        );

        emit MigrationCancelled(
            _vaultProxy,
            prevFundDeployer,
            nextFundDeployer,
            nextVaultAccessor,
            nextVaultLib,
            executableTimestamp
        );
    }

    function executeMigration(address _vaultProxy, bool _bypassFailure) external override {
        MigrationRequest memory request = vaultProxyToMigrationRequest[_vaultProxy];
        address nextFundDeployer = request.nextFundDeployer;
        require(
            nextFundDeployer != address(0),
            "executeMigration: No migration request exists for _vaultProxy"
        );
        require(
            msg.sender == nextFundDeployer,
            "executeMigration: Only the target FundDeployer can call this function"
        );
        require(
            nextFundDeployer == currentFundDeployer,
            "executeMigration: The target FundDeployer is no longer the current FundDeployer"
        );
        uint256 executableTimestamp = request.executableTimestamp;
        require(
            block.timestamp >= executableTimestamp,
            "executeMigration: The migration timelock has not elapsed"
        );

        address prevFundDeployer = vaultProxyToFundDeployer[_vaultProxy];
        address nextVaultAccessor = request.nextVaultAccessor;
        address nextVaultLib = request.nextVaultLib;

        __invokeMigrationOutHook(
            IMigrationHookHandler.MigrationOutHook.PreMigrate,
            _vaultProxy,
            prevFundDeployer,
            nextFundDeployer,
            nextVaultAccessor,
            nextVaultLib,
            _bypassFailure
        );

        // Upgrade the VaultProxy to a new VaultLib and update the accessor via the new VaultLib
        IMigratableVault(_vaultProxy).setVaultLib(nextVaultLib);
        IMigratableVault(_vaultProxy).setAccessor(nextVaultAccessor);

        // Update the FundDeployer that migrated the VaultProxy
        vaultProxyToFundDeployer[_vaultProxy] = nextFundDeployer;

        // Remove the migration request
        delete vaultProxyToMigrationRequest[_vaultProxy];

        __invokeMigrationOutHook(
            IMigrationHookHandler.MigrationOutHook.PostMigrate,
            _vaultProxy,
            prevFundDeployer,
            nextFundDeployer,
            nextVaultAccessor,
            nextVaultLib,
            _bypassFailure
        );

        emit MigrationExecuted(
            _vaultProxy,
            prevFundDeployer,
            nextFundDeployer,
            nextVaultAccessor,
            nextVaultLib,
            executableTimestamp
        );
    }

    function setMigrationTimelock(uint256 _nextTimelock) external override onlyOwner {
        uint256 prevTimelock = migrationTimelock;
        require(
            _nextTimelock != prevTimelock,
            "setMigrationTimelock: _nextTimelock is the current timelock"
        );

        migrationTimelock = _nextTimelock;

        emit MigrationTimelockSet(prevTimelock, _nextTimelock);
    }

    function signalMigration(
        address _vaultProxy,
        address _nextVaultAccessor,
        address _nextVaultLib,
        bool _bypassFailure
    ) external override onlyCurrentFundDeployer {
        require(
            __isContract(_nextVaultAccessor),
            "signalMigration: Non-contract _nextVaultAccessor"
        );

        address prevFundDeployer = vaultProxyToFundDeployer[_vaultProxy];
        require(prevFundDeployer != address(0), "signalMigration: _vaultProxy does not exist");

        address nextFundDeployer = msg.sender;
        require(
            nextFundDeployer != prevFundDeployer,
            "signalMigration: Can only migrate to a new FundDeployer"
        );

        __invokeMigrationOutHook(
            IMigrationHookHandler.MigrationOutHook.PreSignal,
            _vaultProxy,
            prevFundDeployer,
            nextFundDeployer,
            _nextVaultAccessor,
            _nextVaultLib,
            _bypassFailure
        );

        uint256 executableTimestamp = block.timestamp + migrationTimelock;
        vaultProxyToMigrationRequest[_vaultProxy] = MigrationRequest({
        nextFundDeployer : nextFundDeployer,
        nextVaultAccessor : _nextVaultAccessor,
        nextVaultLib : _nextVaultLib,
        executableTimestamp : executableTimestamp
        });

        __invokeMigrationOutHook(
            IMigrationHookHandler.MigrationOutHook.PostSignal,
            _vaultProxy,
            prevFundDeployer,
            nextFundDeployer,
            _nextVaultAccessor,
            _nextVaultLib,
            _bypassFailure
        );

        emit MigrationSignaled(
            _vaultProxy,
            prevFundDeployer,
            nextFundDeployer,
            _nextVaultAccessor,
            _nextVaultLib,
            executableTimestamp
        );
    }

    function __invokeMigrationInCancelHook(
        address _vaultProxy,
        address _prevFundDeployer,
        address _nextFundDeployer,
        address _nextVaultAccessor,
        address _nextVaultLib,
        bool _bypassFailure
    ) private {
        (bool success, bytes memory returnData) = _nextFundDeployer.call(
            abi.encodeWithSelector(
                IMigrationHookHandler.invokeMigrationInCancelHook.selector,
                _vaultProxy,
                _prevFundDeployer,
                _nextVaultAccessor,
                _nextVaultLib
            )
        );
        if (!success) {
            require(
                _bypassFailure,
                string(abi.encodePacked("MigrationOutCancelHook: ", returnData))
            );

            emit MigrationInCancelHookFailed(
                returnData,
                _vaultProxy,
                _prevFundDeployer,
                _nextFundDeployer,
                _nextVaultAccessor,
                _nextVaultLib
            );
        }
    }

    function __invokeMigrationOutHook(
        IMigrationHookHandler.MigrationOutHook _hook,
        address _vaultProxy,
        address _prevFundDeployer,
        address _nextFundDeployer,
        address _nextVaultAccessor,
        address _nextVaultLib,
        bool _bypassFailure
    ) private {
        (bool success, bytes memory returnData) = _prevFundDeployer.call(
            abi.encodeWithSelector(
                IMigrationHookHandler.invokeMigrationOutHook.selector,
                _hook,
                _vaultProxy,
                _nextFundDeployer,
                _nextVaultAccessor,
                _nextVaultLib
            )
        );
        if (!success) {
            require(
                _bypassFailure,
                string(abi.encodePacked(__migrationOutHookFailureReasonPrefix(_hook), returnData))
            );

            emit MigrationOutHookFailed(
                returnData,
                _hook,
                _vaultProxy,
                _prevFundDeployer,
                _nextFundDeployer,
                _nextVaultAccessor,
                _nextVaultLib
            );
        }
    }

    function __migrationOutHookFailureReasonPrefix(IMigrationHookHandler.MigrationOutHook _hook)
    private
    pure
    returns (string memory failureReasonPrefix_)
    {
        if (_hook == IMigrationHookHandler.MigrationOutHook.PreSignal) {
            return "MigrationOutHook.PreSignal: ";
        }
        if (_hook == IMigrationHookHandler.MigrationOutHook.PostSignal) {
            return "MigrationOutHook.PostSignal: ";
        }
        if (_hook == IMigrationHookHandler.MigrationOutHook.PreMigrate) {
            return "MigrationOutHook.PreMigrate: ";
        }
        if (_hook == IMigrationHookHandler.MigrationOutHook.PostMigrate) {
            return "MigrationOutHook.PostMigrate: ";
        }
        if (_hook == IMigrationHookHandler.MigrationOutHook.PostCancel) {
            return "MigrationOutHook.PostCancel: ";
        }

        return "";
    }


    function getCurrentFundDeployer()
    external
    view
    override
    returns (address currentFundDeployer_)
    {
        return currentFundDeployer;
    }


    function getFundDeployerForVaultProxy(address _vaultProxy)
    external
    view
    override
    returns (address fundDeployer_)
    {
        return vaultProxyToFundDeployer[_vaultProxy];
    }

    function getMigrationRequestDetailsForVaultProxy(address _vaultProxy)
    external
    view
    override
    returns (
        address nextFundDeployer_,
        address nextVaultAccessor_,
        address nextVaultLib_,
        uint256 executableTimestamp_
    )
    {
        MigrationRequest memory r = vaultProxyToMigrationRequest[_vaultProxy];
        if (r.executableTimestamp > 0) {
            return (
            r.nextFundDeployer,
            r.nextVaultAccessor,
            r.nextVaultLib,
            r.executableTimestamp
            );
        }
    }

    function getMigrationTimelock() external view override returns (uint256 migrationTimelock_) {
        return migrationTimelock;
    }


    function getNominatedOwner() external view override returns (address nominatedOwner_) {
        return nominatedOwner;
    }


    function getOwner() external view override returns (address owner_) {
        return owner;
    }


    function getSharesTokenSymbol()
    external
    view
    override
    returns (string memory sharesTokenSymbol_)
    {
        return sharesTokenSymbol;
    }

    function getTimelockRemainingForMigrationRequest(address _vaultProxy)
    external
    view
    override
    returns (uint256 secondsRemaining_)
    {
        uint256 executableTimestamp = vaultProxyToMigrationRequest[_vaultProxy]
        .executableTimestamp;
        if (executableTimestamp == 0) {
            return 0;
        }

        if (block.timestamp >= executableTimestamp) {
            return 0;
        }

        return executableTimestamp - block.timestamp;
    }


    function hasExecutableMigrationRequest(address _vaultProxy)
    external
    view
    override
    returns (bool hasExecutableRequest_)
    {
        uint256 executableTimestamp = vaultProxyToMigrationRequest[_vaultProxy]
        .executableTimestamp;

        return executableTimestamp > 0 && block.timestamp >= executableTimestamp;
    }

    function hasMigrationRequest(address _vaultProxy)
    external
    view
    override
    returns (bool hasMigrationRequest_)
    {
        return vaultProxyToMigrationRequest[_vaultProxy].executableTimestamp > 0;
    }
}

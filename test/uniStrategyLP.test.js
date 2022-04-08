const {BN, expectRevert, time} = require("@openzeppelin/test-helpers");
const Controller = artifacts.require("Controller");
const MockERC20 = artifacts.require("MockERC20")
const TimeLock = artifacts.require("Timelock");
const bamVault = artifacts.require("Vault");
const MockUni = artifacts.require("MockUni");
const MockHarvestPool = artifacts.require("MockHarvestPool");
const UniStrategyLP = artifacts.require("UniStrategyLP");
const MockOneSplit = artifacts.require("MockOneSplitAudit");
const {toWei} = web3.utils;
const {BigNumber} = require('ethers');

function encodeParameters(types, values) {
    const abi = new ethers.utils.AbiCoder();
    return abi.encode(types, values);
}

contract("UniStrategyLP", ([owner, alice, rewardAddr]) => {
    beforeEach(async () => {
        dai = await MockERC20.new("DAI", "DAI", 18);
        usdt = await MockERC20.new("USDT", "USDT", 18);
        tusd = await MockERC20.new("tusd", "tusd", 18);
        weth = await MockERC20.new("weth", "weth", 18);
        usdc = await MockERC20.new("TUSD", "TUSD", 18);
        uni = await MockUni.new("uni", "uni", dai.address, usdt.address);
        timeLock = await TimeLock.new(owner, '43200');
        oneSplit = await MockOneSplit.new();
        controller = await Controller.new(rewardAddr, timeLock.address, oneSplit.address);

        vault = await bamVault.new(dai.address, controller.address, "test", "test", timeLock.address);
        harvestPool = await MockHarvestPool.new(dai.address, usdc.address);


        strategy = await UniStrategyLP.new(
            controller.address, "testStrtagety", dai.address,
            weth.address, usdt.address, usdc.address,
            uni.address, harvestPool.address,
            [usdc.address, weth.address], [weth.address, dai.address], timeLock.address);
        //console.log("strategy", strategy.address);
        assert.equal(await strategy.getName(), "testStrtagety");

        let eta = (await time.latest()).add(time.duration.days(1));
        await timeLock.queueTransaction(
            controller.address, '0', 'approveStrategy(address,address)',
            encodeParameters(['address', 'address'],
                [dai.address, strategy.address]), eta, {from: owner}
        );
        await time.increase(time.duration.days(1));
        await timeLock.executeTransaction(
            controller.address, '0', 'approveStrategy(address,address)',
            encodeParameters(['address', 'address'],
                [dai.address, strategy.address]), eta, {from: owner}
        );

        eta = (await time.latest()).add(time.duration.days(1));
        await timeLock.queueTransaction(
            strategy.address, '0', 'setGovernance(address)',
            encodeParameters(['address'],
                [owner]), eta, {from: owner}
        );
        await time.increase(time.duration.days(1));
        await timeLock.executeTransaction(
            strategy.address, '0', 'setGovernance(address)',
            encodeParameters(['address'],
                [owner]), eta, {from: owner}
        );
        assert.equal(await strategy.governance(), owner);

        eta = (await time.latest()).add(time.duration.days(1));
        await timeLock.queueTransaction(
            strategy.address, '0', 'setTimelock(address)',
            encodeParameters(['address'],
                [timeLock.address]), eta, {from: owner}
        );
        await time.increase(time.duration.days(1));
        await timeLock.executeTransaction(
            strategy.address, '0', 'setTimelock(address)',
            encodeParameters(['address'],
                [timeLock.address]), eta, {from: owner}
        );


        eta = (await time.latest()).add(time.duration.days(1));
        await timeLock.queueTransaction(
            strategy.address, '0', 'setController(address)',
            encodeParameters(['address'],
                [controller.address]), eta, {from: owner}
        );
        await time.increase(time.duration.days(1));
        await timeLock.executeTransaction(
            strategy.address, '0', 'setController(address)',
            encodeParameters(['address'],
                [controller.address]), eta, {from: owner}
        );
        assert.equal(await strategy.controller(), controller.address);

        eta = (await time.latest()).add(time.duration.days(1));
        await timeLock.queueTransaction(
            vault.address, '0', 'setGovernance(address)',
            encodeParameters(['address'],
                [owner]), eta, {from: owner}
        );

        await time.increase(time.duration.days(1));
        await timeLock.executeTransaction(
            vault.address, '0', 'setGovernance(address)',
            encodeParameters(['address'],
                [owner]), eta, {from: owner}
        );
        assert.equal(await vault.governance(), owner);

        eta = (await time.latest()).add(time.duration.days(1));
        await timeLock.queueTransaction(
            vault.address, '0', 'setTimelock(address)',
            encodeParameters(['address'],
                [timeLock.address]), eta, {from: owner}
        );
        await time.increase(time.duration.days(1));
        await timeLock.executeTransaction(
            vault.address, '0', 'setTimelock(address)',
            encodeParameters(['address'],
                [timeLock.address]), eta, {from: owner}
        );
        assert.equal(await vault.timelock(), timeLock.address);

        eta = (await time.latest()).add(time.duration.days(1));
        await timeLock.queueTransaction(
            vault.address, '0', 'setController(address)',
            encodeParameters(['address'],
                [controller.address]), eta, {from: owner}
        );
        await time.increase(time.duration.days(1));
        await timeLock.executeTransaction(
            vault.address, '0', 'setController(address)',
            encodeParameters(['address'],
                [controller.address]), eta, {from: owner}
        );

        assert.equal(await vault.controller(), controller.address);

        await controller.setVault(dai.address, vault.address);
        await controller.setStrategy(dai.address, strategy.address);
        assert.equal(await controller.vaults(dai.address), vault.address)
        assert.equal(await controller.strategies(dai.address), strategy.address)


    });
    it("test strategy", async () => {
        assert.equal(await strategy.withdrawalFee(), 0);
        assert.equal(await strategy.performanceFee(), 500);
        await strategy.setWithdrawalFee(300);
        await strategy.setPerformanceFee(600);
        assert.equal(await strategy.withdrawalFee(), 300);
        assert.equal(await strategy.performanceFee(), 600);

        await strategy.SetPathWeth([usdc.address, weth.address]);
        await strategy.SetPathUnderlying([weth.address, dai.address]);

        await dai.mint(owner, toWei('1'));
        await dai.approve(vault.address, toWei('100'));

        assert.equal(await dai.balanceOf(vault.address), 0);
        assert.equal(await dai.balanceOf(owner), "1000000000000000000");

        await vault.deposit(1000);
        assert.equal(await dai.balanceOf(vault.address), 1000);
        assert.equal(await dai.balanceOf(owner), "999999999999999000");

        await vault.earn()
        assert.equal(await controller.balanceOf(dai.address), 950)
        assert.equal(await strategy.balanceOfWant(), 0);
        assert.equal(await dai.balanceOf(rewardAddr), 0);

        await strategy.harvest()
        assert.equal(await controller.balanceOf(dai.address), "1040")
        assert.equal(await strategy.balanceOfWant(), 0);
        assert.equal(await dai.balanceOf(rewardAddr), 5);


        await strategy.harvest()
        //  console.log("farm:"+await usdc.balanceOf(owner))
        assert.equal(await controller.balanceOf(dai.address), "1182")
        assert.equal(await strategy.balanceOfWant(), 0);
        assert.equal(await dai.balanceOf(rewardAddr), 14);

        await controller.withdrawAll(dai.address);

        await vault.withdraw(300);
        assert.equal(await dai.balanceOf(vault.address), "863")
        assert.equal(await dai.balanceOf(owner), "999999999999999369")

        await vault.withdraw(200);
        assert.equal(await dai.balanceOf(vault.address), 617);
        assert.equal(await dai.balanceOf(owner), "999999999999999615");

        await vault.withdrawAll();
        assert.equal(await dai.balanceOf(vault.address), 0);
        assert.equal(await dai.balanceOf(owner), "1000000000000000232");


    });
    it("test strategy withdraw asset", async () => {
        await tusd.mint(strategy.address, 1000);
        assert.equal(await tusd.balanceOf(strategy.address), 1000);
        assert.equal(await tusd.balanceOf(controller.address), 0);
        await controller.inCaseStrategyTokenGetStuck(strategy.address, tusd.address);
        assert.equal(await tusd.balanceOf(strategy.address), 0);
        assert.equal(await tusd.balanceOf(controller.address), 1000);

    });


});




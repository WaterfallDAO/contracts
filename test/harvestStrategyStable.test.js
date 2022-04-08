const {BN, expectRevert, time} = require("@openzeppelin/test-helpers");
const Controller = artifacts.require("Controller");
const MockERC20 = artifacts.require("MockERC20")
const TimeLock = artifacts.require("Timelock");
const MockHarvestVault = artifacts.require("MockHarvestVault");
const MockUni = artifacts.require("MockUni");
const MockHarvestPool = artifacts.require("MockHarvestPool");
const HarvestStrategyStablecoin = artifacts.require("HarvestStrategyStablecoin");
const {toWei} = web3.utils;
const {BigNumber} = require('ethers');
const MockOneSplit = artifacts.require("MockOneSplitAudit");

function encodeParameters(types, values) {
    const abi = new ethers.utils.AbiCoder();
    return abi.encode(types, values);
}

contract("HarvestStrategyStablecoin", ([owner, alice, rewardAddr]) => {
    beforeEach(async () => {
        dai = await MockERC20.new("DAI", "DAI", 18);
        usdt = await MockERC20.new("USDT", "USDT", 18);
        usdc = await MockERC20.new("USDC", "USDC", 18);
        lp = await MockERC20.new("lp", "lp", 18);
        uni = await MockUni.new("uni", "uni", dai.address, usdc.address);
        timeLock = await TimeLock.new(owner, '43200');
        oneSplit = await MockOneSplit.new();
        controller = await Controller.new(rewardAddr, timeLock.address, oneSplit.address);

        //vault = await wtfVault.new(dai.address, controller.address, "test", "test", timeLock.address);

        vault = await MockHarvestVault.new(dai.address, lp.address);
        harvestPool = await MockHarvestPool.new(lp.address, usdc.address);


        strategy = await HarvestStrategyStablecoin.new(
            controller.address, "testStrtagety", dai.address,
            vault.address, harvestPool.address, usdc.address,
            uni.address, [usdc.address, dai.address], timeLock.address);
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


        //await controller.setVault(uni.address, vault.address);
        await controller.setStrategy(dai.address, strategy.address);
        // assert.equal(await controller.vaults(uni.address), vault.address)
        assert.equal(await controller.strategies(dai.address), strategy.address);
        assert.equal(await strategy.want(), dai.address);

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

    });
    it("test strategy", async () => {
        await harvestPool.setStrategy(strategy.address);
        assert.equal(await strategy.want(), dai.address)

        assert.equal(await strategy.withdrawalFee(), 0);
        assert.equal(await strategy.performanceFee(), 500);
        await strategy.setWithdrawalFee(300);
        await strategy.setPerformanceFee(600);
        assert.equal(await strategy.withdrawalFee(), 300);
        assert.equal(await strategy.performanceFee(), 600);
        await strategy.setPath([usdc.address, dai.address]);

        await dai.mint(owner, toWei('1'));
        //await dai.mint(strategy.address, 1000);
        await dai.approve(vault.address, toWei('100'));

        await vault.deposit(1000);
        console.log("lp:" + await lp.balanceOf(strategy.address))
        await lp.approve(harvestPool.address, toWei('100'))

        await harvestPool.stake(1000);

        assert.equal(await dai.balanceOf(vault.address), 1000);
        assert.equal(await lp.balanceOf(owner), 0);

        await harvestPool.earn();

        //await harvestPool.getReward();
        await strategy.harvest();

        await strategy.deposit()

        // console.log("lp:" + await lp.balanceOf(strategy.address))
        // console.log("usdc:" + await usdc.balanceOf(owner))
        //
        console.log("strategy:" + await strategy.balanceOfWant())

        console.log("balanceOfPool:" + await strategy.balanceOfPool())
        console.log("balanceOf:" + await strategy.balanceOf())


    });

});



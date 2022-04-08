const {BN, expectRevert, time} = require("@openzeppelin/test-helpers");
const Controller = artifacts.require("Controller");
const MockERC20 = artifacts.require("MockERC20")
const TimeLock = artifacts.require("Timelock");
const wtfVault = artifacts.require("Vault");
const MockHarvestVault = artifacts.require("MockHarvestVault");
const MockUni = artifacts.require("MockUni");
const MockHarvestPool = artifacts.require("MockHarvestPool");
const HarvestStrategyUniLP = artifacts.require("HarvestStrategyUniLP");
const MockOneSplit = artifacts.require("MockOneSplitAudit");
const {toWei} = web3.utils;
const {BigNumber} = require('ethers');

function encodeParameters(types, values) {
    const abi = new ethers.utils.AbiCoder();
    return abi.encode(types, values);
}

contract("HarvestStrategyUniLP", ([owner, alice, rewardAddr]) => {
    beforeEach(async () => {
        dai = await MockERC20.new("DAI", "DAI", 18);
        usdt = await MockERC20.new("USDT", "USDT", 18);
        weth = await MockERC20.new("weth", "weth", 18);
        lp = await MockERC20.new("lp", "lp", 18);
        usdc = await MockERC20.new("usdc", "usdc", 18);
        uni = await MockUni.new("uni", "uni", weth.address, usdc.address);
        timeLock = await TimeLock.new(owner, '43200');
        oneSplit = await MockOneSplit.new();
        controller = await Controller.new(rewardAddr, timeLock.address, oneSplit.address);

        //vault = await wtfVault.new(dai.address, controller.address, "test", "test", timeLock.address);
        // harvestPool = await MockHarvestPool.new(dai.address, usdc.address);

        harvestPool = await MockHarvestPool.new(lp.address, usdc.address);
        vault = await MockHarvestVault.new(dai.address, lp.address);
        assert.equal(await uni.token0(), weth.address)


        strategy = await HarvestStrategyUniLP.new(
            controller.address, "testStrtagety", uni.address,
            vault.address, harvestPool.address, usdc.address,
            uni.address, [usdc.address, weth.address],
            [weth.address, dai.address], timeLock.address);
        //console.log("strategy", strategy.address);
        assert.equal(await strategy.getName(), "testStrtagety");

        let eta = (await time.latest()).add(time.duration.days(1));
        await timeLock.queueTransaction(
            controller.address, '0', 'approveStrategy(address,address)',
            encodeParameters(['address', 'address'],
                [uni.address, strategy.address]), eta, {from: owner}
        );
        await time.increase(time.duration.days(1));
        await timeLock.executeTransaction(
            controller.address, '0', 'approveStrategy(address,address)',
            encodeParameters(['address', 'address'],
                [uni.address, strategy.address]), eta, {from: owner}
        );
        //await controller.setVault(uni.address, vault.address);
        await controller.setStrategy(uni.address, strategy.address);
        // assert.equal(await controller.vaults(uni.address), vault.address)
        assert.equal(await controller.strategies(uni.address), strategy.address);
        assert.equal(await strategy.want(), uni.address);

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
        //console.log("strategy", strategy.address);

        assert.equal(await strategy.withdrawalFee(), 0);
        assert.equal(await strategy.performanceFee(), 500);
        await strategy.setWithdrawalFee(300);
        await strategy.setPerformanceFee(600);
        assert.equal(await strategy.withdrawalFee(), 300);
        assert.equal(await strategy.performanceFee(), 600);
        await strategy.SetPathWeth([usdc.address, weth.address]);
        await strategy.SetPathUnderlying([weth.address, dai.address]);
        console.log("vault:" + await vault.balanceOf(owner))

        await strategy.deposit()

        //   console.log("reward:"+await usdc.balanceOf(owner))
        await strategy.harvest()
        // console.log("strategy:" + await usdc.balanceOf(strategy.address))
        // console.log("reward:" + await usdc.balanceOf(owner))
        // console.log("owner:" + await dai.balanceOf(owner))

        await strategy.harvest()
        // console.log("strategy:" + await usdc.balanceOf(strategy.address))
        // console.log("reward:" + await usdc.balanceOf(owner))
        // console.log("owner:" + await dai.balanceOf(owner))
        //
        console.log("strategy:" + await strategy.balanceOfWant())

        console.log("balanceOfPool:" + await strategy.balanceOfPool())
        console.log("balanceOf:" + await strategy.balanceOf())

        // assert.equal(await harvestPool.balanceOf(owner), 1000)


    });
});




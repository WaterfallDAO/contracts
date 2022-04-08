const {BN, expectRevert, time} = require("@openzeppelin/test-helpers");
const Controller = artifacts.require("Controller");
const MockERC20 = artifacts.require("MockERC20")
const TimeLock = artifacts.require("Timelock");
const wtfVault = artifacts.require("Vault");
const MockCurve2Deposit = artifacts.require("MockCurve2Deposit");
const MockCurveGauge = artifacts.require("MockCurveGauge");
const MockUni = artifacts.require("MockUni");
const MockMinter = artifacts.require("MockMinter");
const StrategyCurve2TokenPool = artifacts.require("StrategyCurve2TokenPool");
const {toWei} = web3.utils;
const {BigNumber} = require('ethers');
const MockOneSplit = artifacts.require("MockOneSplitAudit");


function encodeParameters(types, values) {
    const abi = new ethers.utils.AbiCoder();
    return abi.encode(types, values);
}

contract("StrategyCurve2TokenPool", ([owner, alice, rewardAddr]) => {
    beforeEach(async () => {
        dai = await MockERC20.new("DAI", "DAI", 18);
        usdt = await MockERC20.new("USDT", "USDT", 18);
        usdc = await MockERC20.new("USDC", "USDC", 18);
        tusd = await MockERC20.new("TUSD", "TUSD", 18);
        ycrv = await MockERC20.new("Curve", "YCRV", 18);
        crv = await MockERC20.new("CURVE", "crv", 18);
        uni = await MockUni.new("uni", "uni", dai.address, usdc.address);
        timeLock = await TimeLock.new(owner, '43200');
        oneSplit = await MockOneSplit.new();
        controller = await Controller.new(rewardAddr, timeLock.address, oneSplit.address);

        vault = await wtfVault.new(dai.address, controller.address, "test", "test", timeLock.address);
        gauge = await MockCurveGauge.new(crv.address, ycrv.address);
        minter = await MockMinter.new(crv.address);

        curveDeposit = await MockCurve2Deposit.new(
            [dai.address, usdc.address],
            ycrv.address);

        strategy = await StrategyCurve2TokenPool.new(controller.address, 0,
            [dai.address, usdc.address], curveDeposit.address,
            gauge.address, ycrv.address, crv.address, uni.address, minter.address, timeLock.address);
        //console.log("strategy", strategy.address);
        assert.equal(await strategy.getName(), "");

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
        assert.equal(await strategy.timelock(), timeLock.address);

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

        assert.equal(await controller.vaults(dai.address), vault.address);
        assert.equal(await controller.strategies(dai.address), strategy.address);
        assert.equal(await vault.controller(), controller.address);
        assert.equal(await strategy.timelock(), timeLock.address);


    });
    it("test strategy", async () => {
        assert.equal(await strategy.withdrawalFee(), 0);
        assert.equal(await strategy.performanceFee(), 500);
        await strategy.setWithdrawalFee(300);
        await strategy.setPerformanceFee(600);
        assert.equal(await strategy.withdrawalFee(), 300);
        assert.equal(await strategy.performanceFee(), 600);

        await dai.mint(owner, toWei('1'));
        await dai.approve(vault.address, toWei('100'));

        assert.equal(await dai.balanceOf(vault.address), 0);
        assert.equal(await dai.balanceOf(owner), "1000000000000000000");

        await vault.deposit(1000);
        assert.equal(await dai.balanceOf(vault.address), 1000);
        assert.equal(await dai.balanceOf(owner), "999999999999999000");

        assert.equal(await controller.balanceOf(dai.address), 0);
        assert.equal(await strategy.balanceOfPool(), 0);

        await vault.earn();
        assert.equal(await dai.balanceOf(vault.address), 50);
        assert.equal(await gauge.balanceOf(strategy.address), 950);
        assert.equal(await strategy.balanceOfPool(), 950);
        assert.equal(await controller.balanceOf(dai.address), 950);


        await strategy.harvest(0, [crv.address, dai.address]);
        assert.equal(await dai.balanceOf(vault.address), 50);
        assert.equal(await controller.balanceOf(dai.address), "1173");
        assert.equal(await strategy.balanceOfPool(), "1173");
        assert.equal(await dai.balanceOf(rewardAddr), 14);

        await strategy.harvest(0, [crv.address, dai.address]);
        assert.equal(await dai.balanceOf(vault.address), 50);
        assert.equal(await controller.balanceOf(dai.address), "1449");
        assert.equal(await strategy.balanceOfPool(), "1449");
        assert.equal(await dai.balanceOf(rewardAddr), 31);

        await vault.withdraw(500);
        assert.equal(await dai.balanceOf(owner), "999999999999999728");
        assert.equal(await dai.balanceOf(vault.address), 0);
        assert.equal(await controller.balanceOf(dai.address), "751");

        await vault.withdraw(500);
        assert.equal(await dai.balanceOf(owner), "1000000000000000456");
        assert.equal(await dai.balanceOf(vault.address), 0);
        assert.equal(await controller.balanceOf(dai.address), 1);


    });
    it("test strategy withdraw asset", async () => {
        await usdt.mint(strategy.address, 1000);
        assert.equal(await usdt.balanceOf(strategy.address), 1000);
        assert.equal(await usdt.balanceOf(controller.address), 0);
        await controller.inCaseStrategyTokenGetStuck(strategy.address, usdt.address);
        assert.equal(await usdt.balanceOf(strategy.address), 0);
        assert.equal(await usdt.balanceOf(controller.address), 1000);


    });
    it("test strategy withdrawAll", async () => {
        await dai.mint(owner, toWei('1'));
        await dai.approve(vault.address, toWei('100'));

        await vault.deposit(1000);
        assert.equal(await dai.balanceOf(vault.address), 1000);
        assert.equal(await controller.balanceOf(dai.address), 0);
        await vault.earn();
        assert.equal(await dai.balanceOf(vault.address), 50);

        assert.equal(await controller.balanceOf(dai.address), 950);

        await controller.withdrawAll(dai.address)
        assert.equal(await dai.balanceOf(vault.address), 1000);
        assert.equal(await controller.balanceOf(dai.address), 0);


    });


});



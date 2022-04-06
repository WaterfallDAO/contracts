const {BN, expectRevert, time} = require("@openzeppelin/test-helpers");
const Controller = artifacts.require("Controller");
const MockERC20 = artifacts.require("MockERC20")
const TimeLock = artifacts.require("Timelock");
const wtfVault = artifacts.require("Vault");
const MockCurveDeposit = artifacts.require("MockCurveDeposit");
const MockCurveGauge = artifacts.require("MockCurveGauge");
const MockUni = artifacts.require("MockUni");
const MockMinter = artifacts.require("MockMinter");
const MockConverter = artifacts.require("MockConverter");
const MockOneSplit = artifacts.require("MockOneSplitAudit");
const StrategyCurve3TokenPool = artifacts.require("StrategyCurve3TokenPool");
const {toWei} = web3.utils;
const {BigNumber} = require('ethers');
const zeroAddress = "0x0000000000000000000000000000000000000000";

function encodeParameters(types, values) {
    const abi = new ethers.utils.AbiCoder();
    return abi.encode(types, values);
}

contract("Controller", ([owner, alice, rewardAddr, bob]) => {
    beforeEach(async () => {
        dai = await MockERC20.new("DAI", "DAI", 18);
        usdt = await MockERC20.new("USDT", "USDT", 18);
        usdc = await MockERC20.new("USDC", "USDC", 18);
        tusd = await MockERC20.new("TUSD", "TUSD", 18);
        ycrv = await MockERC20.new("Curve", "YCRV", 18);
        crv = await MockERC20.new("CURVE", "crv", 18);
        uni = await MockUni.new("uni", "uni", dai.address, usdt.address);
        timeLock = await TimeLock.new(owner, '43200');
        oneSplit = await MockOneSplit.new();
        controller = await Controller.new(rewardAddr, timeLock.address, oneSplit.address);
        converter = await MockConverter.new(usdc.address, dai.address);


        vault = await wtfVault.new(dai.address, controller.address, "test", "test", timeLock.address);
        gauge = await MockCurveGauge.new(crv.address, ycrv.address);
        minter = await MockMinter.new(crv.address);

        curveDeposit = await MockCurveDeposit.new(
            [dai.address, usdc.address, usdt.address],
            ycrv.address);

        strategy = await StrategyCurve3TokenPool.new(controller.address, "testStrategy", 0,
            [dai.address, usdc.address, usdt.address], curveDeposit.address,
            gauge.address, ycrv.address, crv.address, uni.address, minter.address, timeLock.address);
        // console.log("strategy", strategy.address);
        assert.equal(await strategy.getName(), "testStrategy");


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
            controller.address, '0', 'setGovernance(address)',
            encodeParameters(['address'],
                [owner]), eta, {from: owner}
        );
        await time.increase(time.duration.days(1));
        await timeLock.executeTransaction(
            controller.address, '0', 'setGovernance(address)',
            encodeParameters(['address'],
                [owner]), eta, {from: owner}
        );
        assert.equal(await controller.governance(), owner);

        eta = (await time.latest()).add(time.duration.days(1));
        await timeLock.queueTransaction(
            controller.address, '0', 'setTimelock(address)',
            encodeParameters(['address'],
                [timeLock.address]), eta, {from: owner}
        );
        await time.increase(time.duration.days(1));
        await timeLock.executeTransaction(
            controller.address, '0', 'setTimelock(address)',
            encodeParameters(['address'],
                [timeLock.address]), eta, {from: owner}
        );
        assert.equal(await controller.timelock(), timeLock.address)


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
        assert.equal(await controller.strategies(dai.address), strategy.address);


    });
    it("test revokeStrategy", async () => {
        let strategies = await controller.approvedStrategies(dai.address, strategy.address);
        assert.equal(strategies, true);

        await controller.revokeStrategy(dai.address, strategy.address);
        strategies = await controller.approvedStrategies(dai.address, strategy.address);
        assert.equal(strategies, false);

    });
    it("test inCaseStrategyTokenGetStuck", async () => {
        await tusd.mint(strategy.address, 1000);
        assert.equal(await tusd.balanceOf(strategy.address), 1000);
        assert.equal(await tusd.balanceOf(controller.address), 0);
        await controller.inCaseStrategyTokenGetStuck(strategy.address, tusd.address);
        assert.equal(await tusd.balanceOf(strategy.address), 0);
        assert.equal(await tusd.balanceOf(controller.address), 1000);


    });
    it("test withdrawAll", async () => {
        await dai.mint(owner, toWei('1'));
        await dai.approve(vault.address, toWei('100'));

        await vault.deposit(1000);
        await vault.earn();
        assert.equal(await dai.balanceOf(vault.address), 50);
        assert.equal(await controller.balanceOf(dai.address), 950);


        await controller.withdrawAll(dai.address)
        assert.equal(await dai.balanceOf(vault.address), 1000);
        assert.equal(await controller.balanceOf(dai.address), 0);


    });
    it("test setRewards", async () => {
        await dai.mint(owner, toWei('1'));
        await dai.approve(vault.address, toWei('100'));
        await controller.setRewards(alice);
        assert.equal(await controller.rewards(), alice);

        await vault.deposit(1000);
        await vault.earn();
        assert.equal(await dai.balanceOf(vault.address), 50);
        assert.equal(await controller.balanceOf(dai.address), 950);

        assert.equal(await dai.balanceOf(alice), 0);
        await strategy.harvest(0, [crv.address, dai.address]);
        assert.equal(await dai.balanceOf(alice), 11);
        await strategy.harvest(0, [crv.address, dai.address]);
        assert.equal(await dai.balanceOf(alice), 25);


    });
    it("test inCaseTokensGetStuck", async () => {
        await usdt.approve(controller.address, toWei('100'));
        await usdt.mint(controller.address, 5000);

        assert.equal(await usdt.balanceOf(controller.address), 5000);
        assert.equal(await usdt.balanceOf(owner), 0);

        await controller.inCaseTokensGetStuck(usdt.address, 1000);
        assert.equal(await usdt.balanceOf(controller.address), 4000);
        assert.equal(await usdt.balanceOf(owner), 1000);


    });
    it("test setSplit and setOneSplit", async () => {
        assert.equal(await controller.split(), 500);
        await controller.setSplit(600);
        assert.equal(await controller.split(), 600);
        assert.equal(await controller.onesplit(), oneSplit.address);
        await controller.setOneSplit(bob);
        assert.equal(await controller.onesplit(), bob);


    });
    it("test setConverter ", async () => {
        await controller.setConverter(usdc.address, dai.address, converter.address);
        assert.equal(await controller.converters(usdc.address, dai.address), converter.address);


    });
    it("test yearn", async () => {
        assert.equal(await controller.balanceOf(dai.address), 0);
        await dai.approve(vault.address, toWei('100'));
        await dai.mint(owner, toWei('1'));
        //await tusd.mint()

        await vault.deposit(1000);
        await vault.earn();
        assert.equal(await controller.balanceOf(dai.address), 950);

        await controller.yearn(strategy.address, tusd.address, 1);
        // console.log("controller:"+await controller.balanceOf(tusd.address))


    });


});

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


        vault = await wtfVault.new(dai.address, controller.address, "test", "test", timeLock.address);
        gauge = await MockCurveGauge.new(crv.address, ycrv.address);
        minter = await MockMinter.new(crv.address);
        convert = await MockConverter.new(usdc.address, dai.address);

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
    it("test earn", async () => {
        await controller.setConverter(usdc.address, dai.address, convert.address);
        await controller.revokeStrategy(dai.address, strategy.address);

        strategy1 = await StrategyCurve3TokenPool.new(controller.address, "testStrategy", 1,
            [dai.address, usdc.address, usdt.address], curveDeposit.address,
            gauge.address, ycrv.address, crv.address, uni.address, minter.address, timeLock.address);

        let eta = (await time.latest()).add(time.duration.days(1));
        await timeLock.queueTransaction(
            controller.address, '0', 'approveStrategy(address,address)',
            encodeParameters(['address', 'address'],
                [usdc.address, strategy1.address]), eta, {from: owner}
        );
        await time.increase(time.duration.days(1));
        await timeLock.executeTransaction(
            controller.address, '0', 'approveStrategy(address,address)',
            encodeParameters(['address', 'address'],
                [usdc.address, strategy1.address]), eta, {from: owner}
        );
        await controller.setStrategy(usdc.address, strategy1.address);
        assert.equal(await strategy1.want(), usdc.address);
        assert.equal(await strategy1.controller(), controller.address);

        assert.equal(await controller.strategies(usdc.address), strategy1.address);
        assert.equal(await controller.strategies(dai.address), strategy.address);

        await dai.mint(owner, toWei('1'));
        await dai.approve(vault.address, toWei('100'));
        await usdc.mint(owner, toWei('1'));

        await usdc.approve(controller.address, toWei('100'));
        await usdc.mint(controller.address, 1000);
        await controller.earn(usdc.address, 1000);

        await dai.approve(controller.address, toWei('100'));
        await dai.mint(controller.address, 2000);
        await controller.earn(dai.address, 2000);

        assert.equal(await controller.balanceOf(usdc.address), 0);
        assert.equal(await strategy1.balanceOfPool(), 0);

        assert.equal(await controller.balanceOf(dai.address), 1998);
        assert.equal(await strategy.balanceOfPool(), 1998);


    });


});



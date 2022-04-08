const {BN, expectRevert, time} = require("@openzeppelin/test-helpers");
const Controller = artifacts.require("Controller");
const MockERC20 = artifacts.require("MockERC20")
const TimeLock = artifacts.require("Timelock");
const bamVault = artifacts.require("Vault");
const MockCurveDeposit = artifacts.require("MockCurveDeposit");
const MockCurveGauge = artifacts.require("MockCurveGauge");
const MockUni = artifacts.require("MockUni");
const MockMinter = artifacts.require("MockMinter");
const StrategyCurve3TokenPool = artifacts.require("StrategyCurve3TokenPool");
const Fof = artifacts.require("Fof");
const Fund = artifacts.require("Fund");
const {toWei} = web3.utils;
const {BigNumber} = require('ethers');
const BamFundERC20 = artifacts.require("WTFFundERC20");
const MockOneSplit = artifacts.require("MockOneSplitAudit");

function encodeParameters(types, values) {
    const abi = new ethers.utils.AbiCoder();
    return abi.encode(types, values);
}

contract("StrategyCurve3TokenPool", ([owner, alice, rewardAddr]) => {
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

        vault = await bamVault.new(dai.address, controller.address, "test", "test", timeLock.address);
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
        // console.log("eta:"+eta)
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


        await usdt.mint(owner, toWei('1'));
        await usdc.mint(owner, toWei('1'));

        assert.equal(await vault.controller(), controller.address);


        fof = await Fof.new(dai.address);
        await fof.setVault(vault.address);
        assert.equal(await fof.vault(), vault.address);

        fund = await Fund.new("bamFA", "bamFA", "bamFB", "bamFB", dai.address, 10, fof.address, {from: owner});

        await fof.setFund(fund.address);
        assert.equal(await fof.fund(), fund.address);
        await fund.setNumerator(100);
        await fund.initialize();
        //await usdt.approve(fof.address,toWei('100'));
        await usdt.approve(fund.address, toWei('1000'));
        await usdt.mint(owner, toWei('1'));
        bamTokenAAddr = await fund.tokenA();
        tokenA = await BamFundERC20.at(bamTokenAAddr);
        assert.equal(tokenA.address, bamTokenAAddr);

        bamTokenBAddr = await fund.tokenB();
        tokenB = await BamFundERC20.at(bamTokenBAddr);
        assert.equal(tokenB.address, bamTokenBAddr);

        await tokenA.approve(fund.address, toWei('1000'));
        await tokenB.approve(fund.address, toWei('1000'));
        assert.equal(await tokenA.balanceOf(owner), 0);
        assert.equal(await tokenB.balanceOf(owner), 0);

        await dai.mint(alice, toWei('1'));
        await dai.approve(fund.address, toWei('1000'));
        await dai.approve(fund.address, toWei('1000'), {from: alice})

        assert.equal(await strategy.timelock(), timeLock.address);
        await vault.setMin(9000);
        assert.equal(await vault.min(), 9000);


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
        let share = await vault.getPricePerFullShare();
        assert.equal(share, 0);
        assert.equal(await dai.balanceOf(vault.address), 0);
        assert.equal(await dai.balanceOf(owner), "1000000000000000000");

        await vault.deposit(1000);
        assert.equal(await dai.balanceOf(vault.address), 1000);
        assert.equal(await dai.balanceOf(owner), "999999999999999000");

        let totalSupply = await vault.totalSupply();
        let total = 1000 * toWei('1') / totalSupply;

        share = await vault.getPricePerFullShare();
        assert.equal(share, total);

        assert.equal(await controller.balanceOf(dai.address), 0);
        assert.equal(await strategy.balanceOfPool(), 0);
        let vaultAmount = await dai.balanceOf(vault.address);
        let amount = vaultAmount * 9000 / 10000;

        await vault.earn();
        assert.equal(await dai.balanceOf(vault.address), 100);
        assert.equal(await controller.balanceOf(dai.address), amount);
        assert.equal(await strategy.balanceOfPool(), amount);

        await strategy.harvest(0, [crv.address, dai.address]);
        assert.equal(await dai.balanceOf(vault.address), 100);
        assert.equal(await controller.balanceOf(dai.address), "1112");
        assert.equal(await strategy.balanceOfPool(), "1112");
        assert.equal(await dai.balanceOf(rewardAddr), 13);

        await strategy.harvest(1, [crv.address, usdc.address]);
        assert.equal(await dai.balanceOf(vault.address), 100);
        assert.equal(await controller.balanceOf(dai.address), "1374");
        assert.equal(await strategy.balanceOfPool(), "1374");
        assert.equal(await usdc.balanceOf(rewardAddr), 16);

        await strategy.harvest(2, [crv.address, usdt.address]);
        assert.equal(await dai.balanceOf(vault.address), 100);
        assert.equal(await controller.balanceOf(dai.address), "1697");
        assert.equal(await strategy.balanceOfPool(), "1697");
        assert.equal(await usdt.balanceOf(rewardAddr), 20);

        await vault.withdraw(500);
        assert.equal(await dai.balanceOf(owner), "999999999999999874");
        assert.equal(await dai.balanceOf(vault.address), 0);
        assert.equal(await controller.balanceOf(dai.address), "900");
        await vault.withdraw(500);

        assert.equal(await dai.balanceOf(owner), "1000000000000000747");
        assert.equal(await dai.balanceOf(vault.address), 0);
        assert.equal(await controller.balanceOf(dai.address), "1");


    });
    it("test depositAll", async () => {
        await dai.mint(owner, "10000");
        await dai.approve(vault.address, toWei('100'));
        assert.equal(await dai.balanceOf(vault.address), 0);
        assert.equal(await dai.balanceOf(owner), "10000");

        await vault.depositAll();
        assert.equal(await dai.balanceOf(vault.address), "10000");
        assert.equal(await dai.balanceOf(owner), 0);

        assert.equal(await controller.balanceOf(dai.address), 0);
        assert.equal(await strategy.balanceOfPool(), 0);

        await vault.earn();
        assert.equal(await dai.balanceOf(vault.address), "1000");
        assert.equal(await controller.balanceOf(dai.address), "8991");
        assert.equal(await strategy.balanceOfPool(), "8991");

        await strategy.harvest(0, [crv.address, dai.address]);
        assert.equal(await dai.balanceOf(vault.address), "1000");
        assert.equal(await controller.balanceOf(dai.address), "11124");
        assert.equal(await strategy.balanceOfPool(), "11124");
        assert.equal(await dai.balanceOf(rewardAddr), 112);

        await strategy.harvest(0, [crv.address, dai.address]);
        assert.equal(await dai.balanceOf(vault.address), "1000");
        assert.equal(await controller.balanceOf(dai.address), "13764");
        assert.equal(await strategy.balanceOfPool(), "13764");
        assert.equal(await dai.balanceOf(rewardAddr), 251);

        await vault.withdrawAll();
        assert.equal(await dai.balanceOf(owner), "14763");
        assert.equal(await dai.balanceOf(vault.address), 0);
        assert.equal(await controller.balanceOf(dai.address), "14");


    });
    it("multiple deposit", async () => {
        await dai.mint(owner, toWei('1'));
        await dai.approve(vault.address, toWei('100'));

        assert.equal(await dai.balanceOf(vault.address), 0);
        assert.equal(await dai.balanceOf(owner), "1000000000000000000");

        await vault.deposit(1000);
        assert.equal(await dai.balanceOf(vault.address), 1000);
        assert.equal(await dai.balanceOf(owner), "999999999999999000");

        await vault.deposit(2000);
        assert.equal(await dai.balanceOf(vault.address), 3000);
        assert.equal(await dai.balanceOf(owner), "999999999999997000");


    });
    it("test convertToCoinAmount", async () => {
        let amountUsdc = await strategy.convertToCoinAmount(1, toWei('1'));
        let amount = toWei('1') / 10 ** 12;
        assert.equal(amountUsdc, amount);

        let amountUsdt = await strategy.convertToCoinAmount(2, toWei('2'));
        let amount1 = toWei('2') / 10 ** 12;
        assert.equal(amountUsdt, amount1);


    });


});



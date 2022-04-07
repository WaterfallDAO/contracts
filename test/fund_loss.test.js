const {BN, expectRevert, time} = require("@openzeppelin/test-helpers");
const Controller = artifacts.require("Controller");
const MockERC20 = artifacts.require("MockERC20")
const TimeLock = artifacts.require("Timelock");
const wtfVault = artifacts.require("Vault");
const MockCurveDeposit = artifacts.require("MockCurveDeposit");
const MockCurveGauge = artifacts.require("MockCurveGauge");
const MockUni = artifacts.require("MockUni");
const MockMinter = artifacts.require("MockMinter");
const StrategyCurve3TokenPool = artifacts.require("StrategyCurve3TokenPool");
const Fof = artifacts.require("Fof");
const Fund = artifacts.require("Fund");
const {toWei} = web3.utils;
const MockOneSplit = artifacts.require("MockOneSplitAudit");
const {BigNumber} = require('ethers');
const BamFundERC20 = artifacts.require("WTFFundERC20");

function encodeParameters(types, values) {
    const abi = new ethers.utils.AbiCoder();
    return abi.encode(types, values);
}


contract('Fund', ([owner, alice, rewardAddr]) => {
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

        curveDeposit = await MockCurveDeposit.new(
            [dai.address, usdc.address, usdt.address],
            ycrv.address);

        strategy = await StrategyCurve3TokenPool.new(controller.address, "testStrategy", 0,
            [dai.address, usdc.address, usdt.address], curveDeposit.address,
            gauge.address, ycrv.address, crv.address, uni.address, minter.address, timeLock.address);
        // console.log("strategy", strategy.address);

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
        await controller.setVault(dai.address, vault.address);
        assert.equal(await controller.vaults(dai.address), vault.address)

        await controller.setStrategy(dai.address, strategy.address);
        assert.equal(await controller.strategies(dai.address), strategy.address)

        // await usdt.mint(owner, toWei('1'));
        // await usdc.mint(owner, toWei('1'));
        assert.equal(await vault.controller(), controller.address);
        fof = await Fof.new(dai.address);
        await fof.setVault(vault.address);
        assert.equal(await fof.vault(), vault.address);

        fund = await Fund.new("wtfFA", "wtfFA", "wtfFB", "wtfFB", dai.address, 10, fof.address, {from: owner});

        await fof.setFund(fund.address);
        assert.equal(await fof.fund(), fund.address);
        await fund.setNumerator(100);
        await fund.initialize();
        await usdt.approve(fund.address, toWei('1000'));
        //await usdt.mint(owner, toWei('1'));
        wtfTokenAAddr = await fund.tokenA();
        tokenA = await BamFundERC20.at(wtfTokenAAddr);
        assert.equal(tokenA.address, wtfTokenAAddr);

        wtfTokenBAddr = await fund.tokenB();
        tokenB = await BamFundERC20.at(wtfTokenBAddr);
        assert.equal(tokenB.address, wtfTokenBAddr);

        await tokenA.approve(fund.address, toWei('1000'));
        await tokenB.approve(fund.address, toWei('1000'));
        await tokenA.approve(fund.address, toWei('1000'), {from: alice});
        await tokenB.approve(fund.address, toWei('1000'), {from: alice});

        assert.equal(await tokenA.balanceOf(owner), 0)
        assert.equal(await tokenB.balanceOf(owner), 0)
        await dai.mint(owner, toWei('1'));
        await dai.mint(alice, toWei('1'));
        await dai.approve(fund.address, toWei('1000'));
        await dai.approve(fund.address, toWei('1000'), {from: alice})

        assert.equal(await strategy.controller(), controller.address);
        assert.equal(await strategy.timelock(), timeLock.address);
        await fund.setGovernance(owner);
        await fund.setCycle(10);
        await fund.setFof(fof.address);


    });

    it("test lossB = amount", async () => {
        await dai.approve(fund.address, toWei('1000'));
        await dai.approve(fund.address, toWei('1000'));
        await fund.deposit(0, 1000);
        assert.equal(await dai.balanceOf(fund.address), 1000)

        let stratBlock = await time.latestBlock();
        // console.log("block:" + stratBlock);
        await time.advanceBlockTo(parseInt(stratBlock) + 10);
        assert.equal(await fund.isPending(), true);

        let fund0 = await fund.fund_(0);
        assert.equal(fund0[0], 1000);//currentStake
        assert.equal(fund0[1], 1000);//currentLPToken
        assert.equal(fund0[2], 1000);//mirrorStake
        assert.equal(fund0[3], 0);//currentRedeem
        assert.equal(fund0[4], 0);//totalRedeem
        assert.equal(fund0[5], 0);//currentAmount
        // console.log("lastBillingCycle:" + fund0[6])
        assert.equal(fund0[7], 0);//status

        await fund.deposit(1, 2000);
        assert.equal(await dai.balanceOf(fund.address), 3000);
        assert.equal(await dai.balanceOf(vault.address), 0);

        let fund1 = await fund.fund_(1);
        assert.equal(fund1[0], 2000);//currentStake
        assert.equal(fund1[1], 2000);//currentLPToken
        assert.equal(fund1[2], 2000);//mirrorStake
        assert.equal(fund1[3], 0);//currentRedeem
        assert.equal(fund1[4], 0);//totalRedeem
        assert.equal(fund1[5], 0);//currentAmount
        //console.log("lastBillingCycle:" + fund1[6]);
        assert.equal(fund1[7], 0);//status

        await fund.startInvest();
        await fund.earn(1, 1);
        assert.equal(await dai.balanceOf(fund.address), 0);
        assert.equal(await dai.balanceOf(vault.address), 3000);
        assert.equal(await fof.balance(), 3000);
        assert.equal(await controller.balanceOf(dai.address), 0);

        fund0 = await fund.fund_(0);
        assert.equal(fund0[0], 0);//currentStake
        assert.equal(fund0[1], 0);//currentLPToken
        assert.equal(fund0[2], 0);//mirrorStake
        assert.equal(fund0[3], 0);//currentRedeem
        assert.equal(fund0[4], 0);//totalRedeem
        assert.equal(fund0[5], 1000);//currentAmount
        // console.log("lastBillingCycle:" + fund0[6])
        assert.equal(fund0[7], 2);//status

        fund1 = await fund.fund_(1);
        assert.equal(fund1[0], 0);//currentStake
        assert.equal(fund1[1], 0);//currentLPToken
        assert.equal(fund1[2], 0);//mirrorStake
        assert.equal(fund1[3], 0);//currentRedeem
        assert.equal(fund1[4], 0);//totalRedeem
        assert.equal(fund1[5], 2000);//currentAmount
        // console.log("lastBillingCycle:" + fund0[6])
        assert.equal(fund1[7], 2);//status

        await vault.earn();

        assert.equal(await dai.balanceOf(vault.address), "150");
        assert.equal(await vault.balanceOf(fof.address), 3000);
        assert.equal(await dai.balanceOf(fof.address), 0);
        assert.equal(await controller.balanceOf(dai.address), "2848");
        //await controller.withdrawAll(dai.address)

        await fund.startPending();
        fund0 = await fund.fund_(0);
        assert.equal(fund0[0], 0);//currentStake
        assert.equal(fund0[1], 0);//currentLPToken
        assert.equal(fund0[2], 0);//mirrorStake
        assert.equal(fund0[3], 0);//currentRedeem
        assert.equal(fund0[4], 0);//totalRedeem
        assert.equal(fund0[5], 1000);//currentAmount
        // console.log("lastBillingCycle:" + fund0[6])
        assert.equal(fund0[7], 0);//status

        fund1 = await fund.fund_(1);
        assert.equal(fund1[0], 0);//currentStake
        assert.equal(fund1[1], 0);//currentLPToken
        assert.equal(fund1[2], 0);//mirrorStake
        assert.equal(fund1[3], 0);//currentRedeem
        assert.equal(fund1[4], 0);//totalRedeem
        assert.equal(fund1[5], 2000);//currentAmount
        // console.log("lastBillingCycle:" + fund0[6])
        assert.equal(fund1[7], 0);//status

        assert.equal(await dai.balanceOf(vault.address), "150")
        assert.equal(await vault.balanceOf(fof.address), "3000")
        assert.equal(await dai.balanceOf(fof.address), 0);
        assert.equal(await controller.balanceOf(dai.address), "2848");

        stratBlock = await time.latestBlock();
        // console.log("block:" + stratBlock);
        await time.advanceBlockTo(parseInt(stratBlock) + 10);
        await fund.startSettle();

        await fund.settle();


    });
    it("test lossA >= fundB.currentAmount", async () => {
        await dai.approve(fund.address, toWei('1000'));
        await fund.deposit(0, "10000000");
        await fund.deposit(1, "500");
        assert.equal(await dai.balanceOf(fund.address), "10000500");

        let stratBlock = await time.latestBlock();
        // console.log("block:" + stratBlock);
        await time.advanceBlockTo(parseInt(stratBlock) + 10);
        assert.equal(await fund.isPending(), true);

        let fund0 = await fund.fund_(0);
        assert.equal(fund0[0], "10000000");//currentStake
        assert.equal(fund0[1], "10000000");//currentLPToken
        assert.equal(fund0[2], "10000000");//mirrorStake
        assert.equal(fund0[3], 0);//currentRedeem
        assert.equal(fund0[4], 0);//totalRedeem
        assert.equal(fund0[5], 0);//currentAmount
        // console.log("lastBillingCycle:" + fund0[6])
        assert.equal(fund0[7], 0);//status

        let fund1 = await fund.fund_(1);
        assert.equal(fund1[0], "500");//currentStake
        assert.equal(fund1[1], "500");//currentLPToken
        assert.equal(fund1[2], "500");//mirrorStake
        assert.equal(fund1[3], 0);//currentRedeem
        assert.equal(fund1[4], 0);//totalRedeem
        assert.equal(fund1[5], 0);//currentAmount
        //console.log("lastBillingCycle:" + fund1[6]);
        assert.equal(fund1[7], 0);//status

        await fund.startInvest();
        await fund.earn(1, 1);

        fund0 = await fund.fund_(0);
        assert.equal(fund0[0], 0);//currentStake
        assert.equal(fund0[1], 0);//currentLPToken
        assert.equal(fund0[2], 0);//mirrorStake
        assert.equal(fund0[3], 0);//currentRedeem
        assert.equal(fund0[4], 0);//totalRedeem
        assert.equal(fund0[5], "10000000");//currentAmount
        // console.log("lastBillingCycle:" + fund0[6])
        assert.equal(fund0[7], 2);//status

        fund1 = await fund.fund_(1);
        assert.equal(fund1[0], 0);//currentStake
        assert.equal(fund1[1], 0);//currentLPToken
        assert.equal(fund1[2], 0);//mirrorStake
        assert.equal(fund1[3], 0);//currentRedeem
        assert.equal(fund1[4], 0);//totalRedeem
        assert.equal(fund1[5], "500");//currentAmount
        // console.log("lastBillingCycle:" + fund0[6])
        assert.equal(fund1[7], 2);//status

        await vault.earn();
        assert.equal(await dai.balanceOf(rewardAddr), 0);

        assert.equal(await dai.balanceOf(vault.address), "500025");
        assert.equal(await vault.balanceOf(fof.address), "10000500");
        assert.equal(await dai.balanceOf(fof.address), 0);
        assert.equal(await controller.balanceOf(dai.address), "9490984");

        stratBlock = await time.latestBlock();
        // console.log("block:" + stratBlock);
        await time.advanceBlockTo(parseInt(stratBlock) + 10);
        await fund.startSettle();

        await fund.settle();


    });


});

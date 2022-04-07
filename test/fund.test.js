const {BN, expectRevert, time} = require("@openzeppelin/test-helpers");
const Controller = artifacts.require("Controller");
const MockERC20 = artifacts.require("MockERC20")
const TimeLock = artifacts.require("Timelock");
const WtfVault = artifacts.require("Vault");
const MockCurveDeposit = artifacts.require("MockCurveDeposit");
const MockCurveGauge = artifacts.require("MockCurveGauge");
const MockUni = artifacts.require("MockUni");
const MockMinter = artifacts.require("MockMinter");
const StrategyCurve3TokenPool = artifacts.require("StrategyCurve3TokenPool");
const Fof = artifacts.require("Fof");
const Fund = artifacts.require("Fund");
const MockOneSplit = artifacts.require("MockOneSplitAudit");
const {toWei} = web3.utils;
const {BigNumber} = require('ethers');
const WtfFundERC20 = artifacts.require("WTFFundERC20");

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

        vault = await WtfVault.new(dai.address, controller.address, "test", "test", timeLock.address);
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

        fund = await Fund.new("FA", "FA", "FB", "FB", dai.address, 10, fof.address, {from: owner});

        await fof.setFund(fund.address);
        assert.equal(await fof.fund(), fund.address);
        await fund.setNumerator(100);
        await fund.initialize();
        await usdt.approve(fund.address, toWei('1000'));
        //await usdt.mint(owner, toWei('1'));
        wtfTokenAAddr = await fund.tokenA();
        wtfTokenA = await WtfFundERC20.at(wtfTokenAAddr);
        assert.equal(wtfTokenA.address, wtfTokenAAddr);

        wtfTokenBAddr = await fund.tokenB();
        wtfTokenB = await WtfFundERC20.at(wtfTokenBAddr);
        assert.equal(wtfTokenB.address, wtfTokenBAddr);

        await wtfTokenA.approve(fund.address, toWei('1000'));
        await wtfTokenB.approve(fund.address, toWei('1000'));
        await wtfTokenA.approve(fund.address, toWei('1000'), {from: alice});
        await wtfTokenB.approve(fund.address, toWei('1000'), {from: alice});

        assert.equal(await wtfTokenA.balanceOf(owner), 0)
        assert.equal(await wtfTokenB.balanceOf(owner), 0)
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
    it('test fund baseInfo', async () => {
        assert.equal(await fund.cycle(), 10);
        assert.equal(await fund.DENOMINATOR(), 1000);
        assert.equal(await fund.numerator(), 100);
        assert.equal(await fund.governance(), owner);
        assert.equal(await fund.token(), dai.address);
        assert.equal(await fund.fof(), fof.address);
        assert.equal(await fund.tokenA(), wtfTokenA.address);
        assert.equal(await fund.tokenB(), wtfTokenB.address);


    });
    it('deposit and withdraw', async () => {
        //assert.equal(await fund.isPending(), false);
        assert.equal(await fund.getPoolStatus(), 0);
        assert.equal(await dai.balanceOf(fund.address), 0);

        let wtfABef = await wtfTokenA.balanceOf(owner);
        assert.equal(wtfABef, 0);

        await fund.deposit(0, 1000);
        let wtfAAft = await wtfTokenA.balanceOf(owner);
        assert.equal(wtfAAft, 1000)
        assert.equal(await dai.balanceOf(fund.address), 1000);

        let stratBlock = await time.latestBlock();
        // console.log("block:" + stratBlock);
        await time.advanceBlockTo(parseInt(stratBlock) + 10);
        assert.equal(await fund.isPending(), true);

        let info = await fund.getLength();
        assert.equal(info[0], 1);//stakeA
        assert.equal(info[1], 0);//stakeB
        assert.equal(info[2], 0);//redeemA
        assert.equal(info[3], 0);//redeemB

        let fund0 = await fund.fund_(0);
        assert.equal(fund0[0], 1000);//currentStake
        assert.equal(fund0[1], 1000);//currentLPToken
        assert.equal(fund0[2], 1000);//mirrorStake
        assert.equal(fund0[3], 0);//currentRedeem
        assert.equal(fund0[4], 0);//totalRedeem
        assert.equal(fund0[5], 0);//currentAmount
        //console.log("lastBillingCycle:" + fund0[6])
        assert.equal(fund0[7], 0);//status

        let wtfBBef = await wtfTokenB.balanceOf(owner);
        assert.equal(wtfBBef, 0);

        await fund.deposit(1, 2000);
        let wtfBAft = await wtfTokenB.balanceOf(owner);
        assert.equal(wtfBAft, 2000)
        assert.equal(await dai.balanceOf(fund.address), 3000);

        let fund1 = await fund.fund_(1)
        assert.equal(fund1[0], 2000);//currentStake
        assert.equal(fund1[1], 2000);//currentLPToken
        assert.equal(fund1[2], 2000);//mirrorStake
        assert.equal(fund1[3], 0);//currentRedeem
        assert.equal(fund1[4], 0);//totalRedeem
        assert.equal(fund1[5], 0);//currentAmount

        //console.log("lastBillingCycle:" + fund1[6]);
        assert.equal(fund1[7], 0);//status

        let userInfo = await fund.account_(owner, 0);
        assert.equal(userInfo[0], 1000);//stake
        assert.equal(userInfo[1], 0);//redeem
        assert.equal(userInfo[2], 0);//redeemReserve

        let userInfo1 = await fund.account_(owner, 1);
        assert.equal(userInfo1[0], 2000);//stake
        assert.equal(userInfo1[1], 0);//redeem
        assert.equal(userInfo1[2], 0);//redeemReserve

        info = await fund.getLength();
        assert.equal(info[0], 1);//stakeA
        assert.equal(info[1], 1);//stakeB
        assert.equal(info[2], 0);//redeemA
        assert.equal(info[3], 0);//redeemB

        await expectRevert(fund.withdraw(0, "1000", {from: alice}), "Insufficient balance");
        await fund.withdraw(0, 1000);
        fund0 = await fund.fund_(0);

        assert.equal(fund0[0], 0);//currentStake
        assert.equal(fund0[1], 0);//currentLPToken
        assert.equal(fund0[2], 0);//mirrorStake
        await expectRevert(fund.withdraw(0, 100), "Insufficient balance");
        assert.equal(await dai.balanceOf(fund.address), 2000);
        assert.equal(await wtfTokenA.balanceOf(owner), 0);

        await fund.withdraw(1, 2000);
        fund1 = await fund.fund_(1);
        assert.equal(fund1[0], 0);//currentStake
        assert.equal(fund1[1], 0);//currentLPToken
        assert.equal(fund1[2], 0);//mirrorStake

        assert.equal(await dai.balanceOf(fund.address), 0);
        assert.equal(await wtfTokenB.balanceOf(owner), 0);


    });
    it('handleWithdrawFundA and handleWithdrawFundB', async () => {
        //assert.equal(await fund.isPending(), false);
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
        assert.equal(await fof.balance(), 3000);

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

        await fund.startPending();
        await fund.withdraw(0, 1000);
        await fund.withdraw(1, 2000);

        fund0 = await fund.fund_(0);
        assert.equal(fund0[0], 0);//currentStake
        assert.equal(fund0[1], 0);//currentLPToken
        assert.equal(fund0[2], 0);//mirrorStake
        assert.equal(fund0[3], 1000);//currentRedeem
        assert.equal(fund0[4], 0);//totalRedeem
        assert.equal(fund0[5], 1000);//currentAmount
        //console.log("lastBillingCycle:" + fund0[6]);
        assert.equal(fund0[7], 0);//status

        fund1 = await fund.fund_(1);
        assert.equal(fund1[0], 0);//currentStake
        assert.equal(fund1[1], 0);//currentLPToken
        assert.equal(fund1[2], 0);//mirrorStake
        assert.equal(fund1[3], 2000);//currentRedeem
        assert.equal(fund1[4], 0);//totalRedeem
        assert.equal(fund1[5], 2000);//currentAmount
        //console.log("lastBillingCycle:" + fund1[6]);
        assert.equal(fund1[7], 0);//status

        stratBlock = await time.latestBlock();
        // console.log("block:" + stratBlock);
        await time.advanceBlockTo(parseInt(stratBlock) + 10);

        await fund.startSettle();
        await fund.handleWithdrawFundA(1);
        assert.equal(await dai.balanceOf(fund.address), 1000);
        assert.equal(await fof.balance(), 2000);

        await fund.handleWithdrawFundB(1);
        assert.equal(await dai.balanceOf(fund.address), 3000);
        assert.equal(await fof.balance(), 0);

        fund0 = await fund.fund_(0);
        assert.equal(fund0[0], 0);//currentStake
        assert.equal(fund0[1], 0);//currentLPToken
        assert.equal(fund0[2], 0);//mirrorStake
        assert.equal(fund0[3], 0);//currentRedeem
        assert.equal(fund0[4], 1000);//totalRedeem
        assert.equal(fund0[5], 0);//currentAmount
        // console.log("lastBillingCycle:" + fund0[6]);
        assert.equal(fund0[7], 1);//status

        fund1 = await fund.fund_(1);
        assert.equal(fund1[0], 0);//currentStake
        assert.equal(fund1[1], 0);//currentLPToken
        assert.equal(fund1[2], 0);//mirrorStake
        assert.equal(fund1[3], 0);//currentRedeem
        assert.equal(fund1[4], 2000);//totalRedeem
        assert.equal(fund1[5], 0);//currentAmount
        //console.log("lastBillingCycle:" + fund1[6]);
        assert.equal(fund1[7], 1);//status

        let daiBef = await dai.balanceOf(owner);
        await fund.startPending();
        let amountA = daiBef.add(fund0[4]);
        await fund.claim(0);

        let daiAftA = await dai.balanceOf(owner);
        assert.equal(daiAftA.toString(), amountA);
        assert.equal(await dai.balanceOf(fund.address), 2000);
        assert.equal(await fof.balance(), 0);

        let amountB = daiBef.add(fund0[4]).add(fund1[4]);
        await fund.claim(1);

        let daiAftB = await dai.balanceOf(owner);
        assert.equal(daiAftB.toString(), amountB);
        assert.equal(await dai.balanceOf(fund.address), 0);
        assert.equal(await fof.balance(), 0);


    });
    it("test settle", async () => {
        //assert.equal(await fund.isPending(), false);
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
        assert.equal(await dai.balanceOf(rewardAddr), 0)

        await strategy.harvest(0, [crv.address, dai.address]);
        assert.equal(await dai.balanceOf(rewardAddr), 35);
        await strategy.harvest(0, [crv.address, dai.address]);
        assert.equal(await dai.balanceOf(rewardAddr), 79);

        assert.equal(await dai.balanceOf(vault.address), 150);

        await fund.startPending();
        await fund.withdraw(0, 500);
        await fund.withdraw(1, 1000);
        assert.equal(await dai.balanceOf(fof.address), 0)

        stratBlock = await time.latestBlock();
        //console.log("block:" + stratBlock);
        await time.advanceBlockTo(parseInt(stratBlock) + 10);

        await fund.startSettle();
        await fund.handleWithdrawFundA(1);
        assert.equal(await dai.balanceOf(vault.address), 0);

        fund0 = await fund.fund_(0);
        assert.equal(fund0[0], 0);//currentStake
        assert.equal(fund0[1], 0);//currentLPToken
        assert.equal(fund0[2], 0);//mirrorStake
        assert.equal(fund0[3], 0);//currentRedeem
        assert.equal(fund0[4], 500);//totalRedeem
        assert.equal(fund0[5], 500);//currentAmount
        // console.log("lastBillingCycle:" + fund0[6])
        assert.equal(fund0[7], 1);//status
        assert.equal(await dai.balanceOf(fof.address), 251);

        await fund.handleWithdrawFundB(1);

        fund1 = await fund.fund_(1);
        assert.equal(fund1[0], 0);//currentStake
        assert.equal(fund1[1], 0);//currentLPToken
        assert.equal(fund1[2], 0);//mirrorStake
        assert.equal(fund1[3], 0);//currentRedeem
        assert.equal(fund1[4], 1000);//totalRedeem
        assert.equal(fund1[5], 1000);//currentAmount
        // console.log("lastBillingCycle:" + fund0[6])
        assert.equal(fund1[7], 1);//status
        assert.equal(await dai.balanceOf(fof.address), 376);

        stratBlock = await time.latestBlock();
        // console.log("block:" + stratBlock);
        await time.advanceBlockTo(parseInt(stratBlock) + 10);
        await fund.startSettle();

        let vault0 = await fof.vaultLP(0);
        let vault1 = await fof.vaultLP(1);
        assert.equal(vault0, 583);
        assert.equal(vault1, 1168);
        assert.equal(await vault.balanceOf(fof.address), 1751);

        let hold0 = await fof.hold(0);
        let hold1 = await fof.hold(1);
        assert.equal(hold0, 500);
        assert.equal(hold1, 1000);

        await fund.settle();
        vault0 = await fof.vaultLP(0);
        vault1 = await fof.vaultLP(1);
        assert.equal(vault0, 554);
        assert.equal(vault1, 1197);
        assert.equal(await vault.balance(), 2637);
        assert.equal(await controller.balanceOf(dai.address), 2637);

        hold0 = await fof.hold(0);
        hold1 = await fof.hold(1);
        assert.equal(hold0, 954);
        assert.equal(hold1, 2059);

        fund0 = await fund.fund_(0);
        assert.equal(fund0[0], 0);//currentStake
        assert.equal(fund0[1], 0);//currentLPToken
        assert.equal(fund0[2], 0);//mirrorStake
        assert.equal(fund0[3], 0);//currentRedeem
        assert.equal(fund0[4], 500);//totalRedeem
        assert.equal(fund0[5], 954);//currentAmount
        // console.log("lastBillingCycle:" + fund0[6])
        assert.equal(fund0[7], 1);//status

        fund1 = await fund.fund_(1);
        assert.equal(fund1[0], 0);//currentStake
        assert.equal(fund1[1], 0);//currentLPToken
        assert.equal(fund1[2], 0);//mirrorStake
        assert.equal(fund1[3], 0);//currentRedeem
        assert.equal(fund1[4], 1000);//totalRedeem
        assert.equal(fund1[5], 2059);//currentAmount
        // console.log("lastBillingCycle:" + fund0[6])
        assert.equal(fund1[7], 1);//status


    });
    it("two users deposit and withdraw", async () => {
        await dai.approve(fund.address, toWei('1000'));
        await dai.approve(fund.address, toWei('1000'), {from: alice});
        await fund.deposit(0, 1000);
        await fund.deposit(0, 2000, {from: alice});
        assert.equal(await dai.balanceOf(fund.address), 3000);

        let stratBlock = await time.latestBlock();
        // console.log("block:" + stratBlock);
        await time.advanceBlockTo(parseInt(stratBlock) + 10);
        assert.equal(await fund.isPending(), true);

        let fund0 = await fund.fund_(0);
        assert.equal(fund0[0], 3000);//currentStake
        assert.equal(fund0[1], 3000);//currentLPToken
        assert.equal(fund0[2], 3000);//mirrorStake
        assert.equal(fund0[3], 0);//currentRedeem
        assert.equal(fund0[4], 0);//totalRedeem
        assert.equal(fund0[5], 0);//currentAmount
        // console.log("lastBillingCycle:" + fund0[6])
        assert.equal(fund0[7], 0);//status

        await fund.deposit(1, 2000);
        await fund.deposit(1, 3000, {from: alice});
        assert.equal(await dai.balanceOf(fund.address), 8000);

        let fund1 = await fund.fund_(1);
        assert.equal(fund1[0], 5000);//currentStake
        assert.equal(fund1[1], 5000);//currentLPToken
        assert.equal(fund1[2], 5000);//mirrorStake
        assert.equal(fund1[3], 0);//currentRedeem
        assert.equal(fund1[4], 0);//totalRedeem
        assert.equal(fund1[5], 0);//currentAmount
        //console.log("lastBillingCycle:" + fund1[6]);
        assert.equal(fund1[7], 0);//status

        let userInfo = await fund.account_(owner, 0);
        assert.equal(userInfo[0], 1000);//stake
        assert.equal(userInfo[1], 0);//redeem
        assert.equal(userInfo[2], 0);//redeemReserve


        let userInfo1 = await fund.account_(alice, 0);
        assert.equal(userInfo1[0], 2000);//stake
        assert.equal(userInfo1[1], 0);//redeem
        assert.equal(userInfo1[2], 0);//redeemReserve

        await fund.startInvest();
        await fund.earn(2, 2);
        assert.equal(await dai.balanceOf(fund.address), 0);
        assert.equal(await fof.balance(), 8000);

        fund0 = await fund.fund_(0);
        assert.equal(fund0[0], 0);//currentStake
        assert.equal(fund0[1], 0);//currentLPToken
        assert.equal(fund0[2], 0);//mirrorStake
        assert.equal(fund0[3], 0);//currentRedeem
        assert.equal(fund0[4], 0);//totalRedeem
        assert.equal(fund0[5], 3000);//currentAmount
        // console.log("lastBillingCycle:" + fund0[6])
        assert.equal(fund0[7], 2);//status

        fund1 = await fund.fund_(1);
        assert.equal(fund1[0], 0);//currentStake
        assert.equal(fund1[1], 0);//currentLPToken
        assert.equal(fund1[2], 0);//mirrorStake
        assert.equal(fund1[3], 0);//currentRedeem
        assert.equal(fund1[4], 0);//totalRedeem
        assert.equal(fund1[5], 5000);//currentAmount
        // console.log("lastBillingCycle:" + fund0[6])
        assert.equal(fund1[7], 2);//status

        await fund.startPending();
        await fund.withdraw(0, 1000);
        await fund.withdraw(1, 2000);

        await fund.withdraw(0, 2000, {from: alice});
        await fund.withdraw(1, 3000, {from: alice});

        fund0 = await fund.fund_(0);
        assert.equal(fund0[0], 0);//currentStake
        assert.equal(fund0[1], 0);//currentLPToken
        assert.equal(fund0[2], 0);//mirrorStake
        assert.equal(fund0[3], 3000);//currentRedeem
        assert.equal(fund0[4], 0);//totalRedeem
        assert.equal(fund0[5], 3000);//currentAmount
        //console.log("lastBillingCycle:" + fund0[6]);
        assert.equal(fund0[7], 0);//status

        fund1 = await fund.fund_(1);
        assert.equal(fund1[0], 0);//currentStake
        assert.equal(fund1[1], 0);//currentLPToken
        assert.equal(fund1[2], 0);//mirrorStake
        assert.equal(fund1[3], 5000);//currentRedeem
        assert.equal(fund1[4], 0);//totalRedeem
        assert.equal(fund1[5], 5000);//currentAmount
        //console.log("lastBillingCycle:" + fund1[6]);
        assert.equal(fund1[7], 0);//status
        //
        stratBlock = await time.latestBlock();
        // console.log("block:" + stratBlock);
        await time.advanceBlockTo(parseInt(stratBlock) + 10);

        await fund.startSettle();
        await fund.handleWithdrawFundA(2);
        assert.equal(await dai.balanceOf(fund.address), 3000);
        assert.equal(await fof.balance(), 5000);

        await fund.handleWithdrawFundB(2);
        assert.equal(await dai.balanceOf(fund.address), 8000);
        assert.equal(await fof.balance(), 0);


        fund0 = await fund.fund_(0);
        assert.equal(fund0[0], 0);//currentStake
        assert.equal(fund0[1], 0);//currentLPToken
        assert.equal(fund0[2], 0);//mirrorStake
        assert.equal(fund0[3], 0);//currentRedeem
        assert.equal(fund0[4], 3000);//totalRedeem
        assert.equal(fund0[5], 0);//currentAmount
        // console.log("lastBillingCycle:" + fund0[6]);
        assert.equal(fund0[7], 1);//status

        fund1 = await fund.fund_(1);
        assert.equal(fund1[0], 0);//currentStake
        assert.equal(fund1[1], 0);//currentLPToken
        assert.equal(fund1[2], 0);//mirrorStake
        assert.equal(fund1[3], 0);//currentRedeem
        assert.equal(fund1[4], 5000);//totalRedeem
        assert.equal(fund1[5], 0);//currentAmount
        //console.log("lastBillingCycle:" + fund1[6]);
        assert.equal(fund1[7], 1);//status

        assert.equal(await dai.balanceOf(owner), "999999999999997000");
        assert.equal(await dai.balanceOf(alice), "999999999999995000");

        await fund.startPending();
        await fund.claim(0);
        assert.equal(await dai.balanceOf(owner), "999999999999998000");

        await fund.claim(1);
        assert.equal(await dai.balanceOf(owner), "1000000000000000000");

        await fund.claim(0, {from: alice});
        assert.equal(await dai.balanceOf(alice), "999999999999997000");

        await fund.claim(1, {from: alice});
        assert.equal(await dai.balanceOf(alice), "1000000000000000000");


    });


});

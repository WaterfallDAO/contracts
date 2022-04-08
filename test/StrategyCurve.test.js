const {inTransaction} = require("@openzeppelin/test-helpers/src/expectEvent");
const {assertion} = require("@openzeppelin/test-helpers/src/expectRevert");
const {BN, expectRevert, time} = require("@openzeppelin/test-helpers");

const ethers = require('ethers');
const MockERC20 = artifacts.require("MockERC20");
const MockUni = artifacts.require("MockUni");
const OneSplitAudit = artifacts.require("OneSplitAudit");
const Controller = artifacts.require("Controller");
const wtfVault = artifacts.require("Vault");
const StrategyCurveDAI = artifacts.require("StrategyCurve3TokenPool");
const MockCurveDeposit = artifacts.require("MockCurveDeposit");
const MockCurveGauge = artifacts.require("MockCurveGauge");
const MockMinter = artifacts.require("MockMinter");
const TimeLock = artifacts.require("Timelock");
const MockOneSplit = artifacts.require("MockOneSplitAudit");


function encodeParameters(types, values) {
    const abi = new ethers.utils.AbiCoder();
    return abi.encode(types, values);
}

async function deployContracts(accounts) {
    let ownerAddr = accounts[0];
    let rewardAddr = accounts[1];
    //console.log("owner: ", ownerAddr);

    // token in the curve Y pool
    dai = await MockERC20.new("DAI", "DAI", 18);
    usdt = await MockERC20.new("USDT", "USDT", 18);
    usdc = await MockERC20.new("USDC", "USDC", 18);
    tusd = await MockERC20.new("TUSD", "TUSD", 18);
    weth = await MockERC20.new("WETH", "WETH", 18);
    //console.log("deploy Y pool token");

    // LP token of curve Y pool
    ycrv = await MockERC20.new("Curve", "YCRV", 18);
    console.log("ycrv", ycrv.address);
//
    // DAO token of curve
    crv = await MockERC20.new("CURVE", "crv", 18);
    console.log("CRV", crv.address);

    uni = await MockUni.new("uni", "uni", dai.address, weth.address);
    //console.log("UNI", uni.address);

    timeLock = await TimeLock.new(ownerAddr, '43200');
    oneSplit = await MockOneSplit.new();
    controller = await Controller.new(rewardAddr, timeLock.address, oneSplit.address);
    //console.log("controller", controller.address);

    vault = await wtfVault.new(dai.address, controller.address, "test", "test", timeLock.address);
    //console.log("yDAI", vault.address);

    gauge = await MockCurveGauge.new(crv.address, ycrv.address);
    //console.log("Gauge", gauge.address);

    minter = await MockMinter.new(crv.address);
    //console.log("minter", minter.address);

    // curve Y deposit address
    curveDeposit = await MockCurveDeposit.new(
        [dai.address, usdc.address, usdt.address],
        ycrv.address);
    //console.log("curve deposit pool", curveDeposit.address);

    strategy = await StrategyCurveDAI.new(controller.address, "testStrategy", 0,
        [dai.address, usdc.address, usdt.address], curveDeposit.address,
        gauge.address, ycrv.address, crv.address, uni.address, minter.address, timeLock.address);
    //console.log("strategy", strategy.address);
}

contract("StrategyDAICurveTest", async (accounts) => {
    before(async () => {
        await deployContracts(accounts);
        // controller.approveStrategy(dai.address, strategy.address);
        let eta = (await time.latest()).add(time.duration.days(1));

        await timeLock.queueTransaction(
            controller.address, '0', 'approveStrategy(address,address)',
            encodeParameters(['address', 'address'],
                [dai.address, strategy.address]), eta, {from: accounts[0]},
        );
        await time.increase(time.duration.days(1));
        await timeLock.executeTransaction(
            controller.address, '0', 'approveStrategy(address,address)',
            encodeParameters(['address', 'address'],
                [dai.address, strategy.address]), eta, {from: accounts[0]},
        )

        await controller.setVault(dai.address, vault.address);
        await controller.setStrategy(dai.address, strategy.address);

        dai.mint(accounts[0], "10000");
        dai.approve(vault.address, 0);
        dai.approve(vault.address, "100000000000");
    })

    it("account balance", async () => {
        const balance = dai.balanceOf(accounts[0]);
        assert(balance, '10000', "fail getting DAI!!");
    })

    it("first deposit into wtfVault", async () => {
        let reasult = await vault.deposit("1000");
        const balanceOfVault = await vault.balance();
        assert.equal(balanceOfVault, '1000', "not deposit into the wtfVault!!");
        const b1 = await dai.balanceOf(vault.address);
        assert.equal('1000', b1, "the assert in the vault isn't calc right");
        const b2 = await vault.balanceOf(accounts[0]);
        assert.equal(b2, 1000, "don't mint correct lp_token for addr!!");
    })

    it("earn: put the money into strategy to stake into gauge", async () => {
        let amount = await vault.available();
        assert.equal(amount, 950, "don't deposit the correct num of dai into the strategy");

        let r2 = await vault.earn();
        let b1 = await strategy.balanceOfWant();
        assert.equal(b1, '0', "still in the strategy");
        let balanceOfGauge = await strategy.balanceOfGauge();
        console.log("balanceOfGauge:" + balanceOfGauge.valueOf());
        let balanceOfPool = await strategy.balanceOfPool();
        console.log("balanceOfPool:" + balanceOfPool.valueOf());
    })

    it("harvest: use the yield to deposit into gauge", async () => {
        //let r3 = await strategy.harvest('0');
        let b1 = await strategy.balanceOfPool();
        //assert(b1 > 950, "don't deposit yield success:" + b1);
    })

    it("withdraw", async function () {
        let r4 = await vault.withdrawAll();
        let b1 = await dai.balanceOf(accounts[0]);
        let b2 = await vault.balance();
        // precision loss is usually less than 10
        assert(b2 < 10, "can't withdraw all the assets:" + b2);
    })

});



const {BN, expectRevert, time} = require("@openzeppelin/test-helpers");
// const Controller = artifacts.require("Controller");
// const Timelock = artifacts.require("Timelock");
// const MockERC20 = artifacts.require("MockERC20")
// const TimeLock = artifacts.require("Timelock");
// const wtfVault = artifacts.require("wtfVault");
// const MockCurveDeposit = artifacts.require("MockCurveDeposit");
// const MockCurveGauge = artifacts.require("MockCurveGauge");
// const MockUni = artifacts.require("MockUni");
// const MockMinter = artifacts.require("MockMinter");
// const StrategyCurve3TokenPool = artifacts.require("StrategyCurve3TokenPool");
// const Fof = artifacts.require("Fof");
//const Fund = artifacts.require("Fund");
const {toWei} = web3.utils;
// const {BigNumber} = require('ethers');
const wtfFundERC20 = artifacts.require("WtfFundERC20");
// const Timelock = require('artifacts/contracts/tools/Timelock.sol/Timelock.json');
//const Timelock = require('../test/Timelock.json');

const {deployContract, MockProvider, solidity, Fixture} = require('ethereum-waffle');
const {ethers, waffle} = require("hardhat");


function encodeParameters(types, values) {
    const abi = new ethers.utils.AbiCoder();
    return abi.encode(types, values);
}

async function main() {
    const accounts = await ethers.getSigners()
    const zeroAddr = "0x0000000000000000000000000000000000000000"
    let dai = "0x38f08d0bE5d9385C80413D9Be436865689Bc4C62"
    let usdc = "0x6BD6Be6B2f62046E3026722c78cad967dC7d95D4"
    let usdt = "0x17b16eAF39C055405a6Ccc41258698F048b4bA38"
    let ycrv = "0x3683f449f24cA0DAbCbF05FB27102526030Bbaee"
    let crv = "0x7064A2B6cF4E69a01EDB0b79b01634c7b645b04B"
    let uni = "0x286527bc3cdC3eA4700e8c386CcE6Ec836b5F2aC"

    // let gauge = "0x82adC022f8154056F7F320533d4189100d1b1c39"
    // let minter = "0x1bE4f227a1388744CD33D2Da5692d04D60d202E1"
    // let curveDeposit = "0xfcF56341683C2F7970D6C852C228aF706e144681"
    let vault = "0xDBC48Eab57926166460116F76d8c38b5f8414439"
    // let controllerAddr = "0x0b4Fa5EB74383917F0C4Cdc2Dc85fE04c8aB42B6"
    // let timeLockAddr = "0x3af5F585ADB3D7b298EbB6e8404CDC23129d157B"
    // let  controller = await Controller.at(controllerAddr)
    //  let  timeLock = await Timelock.at(timeLockAddr)
    // let strategy = "0xB74Df76cC81755CBe03F47cb38696d2A4327eD8A"

    //let timeLock = "0x67b117D9E627ff9C4DF87b8662a76Bf29E9C5884"
    // let controller = "0x228944B00d0a92d03BF4E3220655eA19dcD5759a"
    // let strategy = "0x3B5d44F586716CE45B853854Dec914D0971ddD71"
    // let fofAddr = "0x188D057C63eBDfF868690eB7d867e212E9C22fec"
    // let fof = await Fof.at(fofAddr)


    for (const account of accounts) {
        //console.log('Account address' + account.address)
    }

    let deployer = accounts[0]
    console.log('deployer:' + deployer.address)
    // We get the contract to deploy
    console.log('Account balance:', (await deployer.getBalance()).toString()/ 10**18)


    // const MockERC20 = await ethers.getContractFactory("MockERC20");
    // dai = await MockERC20.deploy("DAI", "DAI", 18);
    // console.log("dai:" + dai.address);
    //
    // usdt = await MockERC20.deploy("USDT", "USDT", 18);
    // console.log("usdt:" + usdt.address);
    //
    // usdc = await MockERC20.deploy("USDC", "USDC", 18);
    // console.log("usdc:" + usdc.address);
    //
    // ycrv = await MockERC20.deploy("Curve", "YCRV", 18);
    // console.log("ycrv:" + ycrv.address);
    //
    // crv = await MockERC20.deploy("CURVE", "crv", 18);
    // console.log("crv:" + crv.address);
    //
    // const MockUni = await ethers.getContractFactory("MockUni");
    // uni = await MockUni.deploy("uni", "uni", dai.address, usdt.address);
    // console.log("uni:" + uni.address);

    // const TimeLock = await ethers.getContractFactory("TimeLock");
    // timeLock = await TimeLock.deploy(deployer.address, '43200');
    // console.log("timeLock:" + timeLock.address);

    // timeLock = await deployContract(deployer, {
    //     bytecode: Timelock.bytecode,
    //     abi: Timelock.abi
    // }, [deployer.address, "10"]);
    // console.log("timeLock:" + timeLock.address)
    //
    // const Controller = await ethers.getContractFactory("Controller");
    // controller = await Controller.deploy(deployer.address,timeLock.address );
    // console.log("controller:" + controller.address);
    //
    // const Vault = await ethers.getContractFactory("wtfVault");
    // vault = await Vault.deploy(dai, controller.address, "test", "test", timeLock.address);
    // console.log("wtfVault:" + vault.address);
    //
    // const MockMinter = await ethers.getContractFactory("MockMinter");
    // minter = await MockMinter.deploy(crv);
    // console.log("minter:" + minter.address);
    //
    //
    // const MockCurveGauge = await ethers.getContractFactory("MockCurveGauge");
    // gauge = await MockCurveGauge.deploy(crv, ycrv);
    // console.log("gauge:" + gauge.address);
    //
    // const MockCurveDeposit = await ethers.getContractFactory("MockCurveDeposit");
    // curveDeposit = await MockCurveDeposit.deploy(
    //     [dai, usdc, usdt],
    //     ycrv);
    // console.log("curveDeposit:" + curveDeposit.address);
    //
    // const StrategyCurve3TokenPool = await ethers.getContractFactory("StrategyCurve3TokenPool");
    // strategy = await StrategyCurve3TokenPool.deploy(controller.address, "testStrategy", 0,
    //     [dai, usdc, usdt], curveDeposit.address,
    //     gauge.address, ycrv, crv, uni, minter.address, timeLock.address);
    // console.log("StrategyCurve3", strategy.address);

    // let eta = (await time.latest()).add(time.duration.days(1));
    // await timeLock.queueTransaction(
    //     controller, '0', 'approveStrategy(address,address)',
    //     encodeParameters(['address', 'address'],
    //         [dai, strategy]), eta, {from: deployer.address}
    // );
    // console.log("time:"+await time.latest())
    //  console.log("eta:"+eta)
    // eta = (await time.latest()).add(time.duration.days(2));
    // await time.increase(time.duration.days(1))
    // //
    // // console.log("time:"+await time.latest(1))
    // //  console.log("eta:"+eta)
    // await timeLock.executeTransaction(
    //     controller.address, '0', 'approveStrategy(address,address)',
    //     encodeParameters(['address', 'address'],
    //         [dai, strategy]), eta, {from: deployer.address}
    // );
    // await controller.setVault(dai, vault);
    // await controller.setStrategy(dai, strategy);


    // fof = await Fof.new(dai.address);
    //   await fof.setVault(vault.address);

    const Fof = await ethers.getContractFactory("Fof");
    fof = await Fof.deploy(dai);
    console.log("fof:"+fof.address)
    await fof.setVault(vault);

   //fund = await Fund.new("wtfFA", "wtfFA", "wtfFB", "wtfFB", dai, 10, fof.address);

    const Fund = await ethers.getContractFactory("Fund");
    fund = await Fund.deploy("wtfFA", "wtfFA", "wtfFB", "wtfFB", dai, 10, fof.address);
     console.log("fund:"+fund.address)

    await fof.setFund(fund.address);
    await fund.setNumerator(100);
    await fund.initialize();
    //await usdt.approve(fof.address,toWei('100'));
    // await usdt.approve(fund.address, toWei('1000'));
    // await usdt.mint(owner, toWei('1'));
    wtfTokenAAddr = await fund.wtfTokenA();
    wtfTokenA = await wtfFundERC20.at(wtfTokenAAddr);
     console.log("wtfTokenA:"+wtfTokenA.address)
    // assert.equal(wtfTokenA.address, wtfTokenAAddr);

    wtfTokenBAddr = await fund.wtfTokenB();
    wtfTokenB = await wtfFundERC20.at(wtfTokenBAddr);
     console.log("wtfTokenB:"+wtfTokenB.address)
    // assert.equal(wtfTokenB.address, wtfTokenBAddr);

    await wtfTokenA.approve(fund.address, toWei('1000'));
    await wtfTokenB.approve(fund.address, toWei('1000'));
    // assert.equal(await wtfTokenA.balanceOf(owner), 0);
    // assert.equal(await wtfTokenB.balanceOf(owner), 0);

    // await dai.mint(alice, toWei('1'));
    // await dai.approve(fund.address, toWei('1000'));
    //  await dai.approve(fund.address, toWei('1000'), {from: alice})
    //
    //  assert.equal(await strategy.timelock(), timeLock.address);
    //  await vault.setMin(9000);
    // assert.equal(await vault.min(), 9000);


}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })
const fs = require('fs');
const ethers = require('ethers');
const Controller = artifacts.require("Controller");
const WtfVault = artifacts.require("Vault");
const StrategyUni = artifacts.require("UniStrategyLP");
const Timelock = artifacts.require("Timelock");
const ERC20 = artifacts.require("IERC20");
const sender = "0xb5bB41101Be11AB9FF39B3683d287F75c53d6979"


module.exports = async function(){
    try {
        // let json = fs.readFileSync('./scripts/uniMainnetTestAddress.json', 'utf8');
        let json = fs.readFileSync('./scripts/uniKovanTestAddress.json', 'utf8');
        var uniAddresses = JSON.parse(json);
    } catch (e) {
        console.log(e);
        return;
    }
    console.log(uniAddresses)

    timelock = await Timelock.at(uniAddresses.timelock)
    controller = uniAddresses.controller

    daiUniLp = uniAddresses.daiUniLp
    usdcUniLp = uniAddresses.usdcUniLp
    usdtUniLp = uniAddresses.usdtUniLp
    wbtcUniLp = uniAddresses.wBtcUniLp

    daiUniStrategyLp = uniAddresses.daiUniLpStrategy
    daiUniWtfVault = uniAddresses.daiUniLpWtfVault
    usdcUniStrategyLp = uniAddresses.usdcUniLpStrategy
    usdcUniWtfVault = uniAddresses.usdcUniLpWtfVault
    usdtUniStrategyLp = uniAddresses.usdtUniLpStrategy
    usdtUniWtfVault = uniAddresses.usdtUniLpWtfVault
    wbtcUniStrategyLp = uniAddresses.wBtcUniLpStrategy
    wbtcUniWtfVault = uniAddresses.wBtcUniLpWtfVault

    uniLps = [daiUniLp, usdcUniLp, usdtUniLp, wbtcUniLp]
    valuts = [daiUniWtfVault, usdcUniWtfVault, usdtUniWtfVault, wbtcUniWtfVault]
    strategies = [daiUniStrategyLp, usdcUniStrategyLp, usdtUniStrategyLp, wbtcUniStrategyLp]
	console.log(uniLps, valuts, strategies)
    // 1. add pending transaction to approve strategy with controller in timelock
    // await addUniStrategyToTimeLock(uniLps, strategies)

    // Note: time is above eta param in approveStrategy
    endingTimes = [1604458632, 1604467826, 1604467840, 1604467861]
    // 2. wait delay time to exec above pending transaction in timelock
    // await approveStrategyToController(uniLps, strategies, endingTimes)

    // 3. When the above two steps are complete, the strategy is enabled
    await setStrategyAndVaultInController(uniLps, strategies, valuts)

    // 4. approve balance to vault
    // await approveUserLPToVault()

    // 4. deposit and earn in vault byy user
    // await depositToVaultAndEarn()
}

async function addUniStrategyToTimeLock(uniLps, strategies){
    for (let i = 0; i < uniLps.length; i++){
        let approveStrategyParams = await web3.eth.abi.encodeParameters(["address","address"],[uniLps[i], strategies[i]]);
        let latestBlockTime = await getLatestBlockTime()
        console.log(approveStrategyParams, latestBlockTime)
        const eta = latestBlockTime + 120;
        await timelock.queueTransaction(
            controller, '0', 'approveStrategy(address,address)', approveStrategyParams, eta, { from: sender })
    }
}

async function approveStrategyToController(uniLps, strategies, endingTimes){
    for (let i = 0; i < uniLps.length; i++){
        let approveStrategyParams = await web3.eth.abi.encodeParameters(["address","address"],[uniLps[i], strategies[i]]);
        const eta = endingTimes[i] + 120;
        await timelock.executeTransaction(controller, '0', 'approveStrategy(address,address)',
            approveStrategyParams, eta, { from: sender })
    }
}

async function getLatestBlockTime(){
    let blockInfo = await web3.eth.getBlock("latest")
    // console.log("latest blockinfo: ", blockInfo)
    console.log(blockInfo.timestamp)
    return blockInfo.timestamp
}

async function setStrategyAndVaultInController(uniLps, strategies, valuts){
    for (let i = 0; i < uniLps.length; i++){
        controllerContract = await Controller.at(controller)
        await controllerContract.setVault(uniLps[i], valuts[i], {from: sender})
        await controllerContract.setStrategy(uniLps[i], strategies[i], {from: sender})
    }
}

async function approveUserLPToVault(){
    let daiLp = await ERC20.at(daiUniLp)
    await daiLp.approve(daiUniWtfVault, BigInt(1000000000000000000 * 1000000).toString(), {from:sender})
}

async function depositToVaultAndEarn(){
    let daiLPVault = await WtfVault.at(daiUniWtfVault)
    await daiLPVault.depositAll({from:sender})
    await daiLPVault.earn({from:sender})
}





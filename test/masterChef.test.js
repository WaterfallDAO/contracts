const {time} = require('@openzeppelin/test-helpers');
const {deployContract, MockProvider, solidity, Fixture} = require('ethereum-waffle');

const {ethers, waffle} = require("hardhat");
const {expect} = require("chai");
const {toWei} = web3.utils;
const {BigNumber} = require('ethers');
const Factory = require('./mock/cake/SwapFactory.json');

contract('MasterChef', () => {
    beforeEach(async () => {
        [owner, dev, addr1] = await ethers.getSigners();
        const RewardToken = await ethers.getContractFactory("wtf");
        reward = await RewardToken.deploy();

        const MockToken = await ethers.getContractFactory("MockERC20");
        usdc = await MockToken.deploy("usdc", "usdc", 18);
        busd = await MockToken.deploy("busd", "busd", 18);
        await usdc.mint(owner.address, toWei('10'));
        await busd.mint(owner.address, toWei('10'));

        factory = await deployContract(owner, {
            bytecode: Factory.bytecode,
            abi: Factory.abi,
        }, [owner.address]);

        await factory.createPair(usdc.address, reward.address);
        let lastBlock = await time.latestBlock();

        const MasterChef = await ethers.getContractFactory("MasterChef");
        masterChef = await MasterChef.deploy(reward.address, "100000", parseInt(lastBlock), "10");
        await reward.addMinter(masterChef.address);

    });
    it('should baseInfo correct', async () => {
        expect(await masterChef.minTokenReward()).to.be.eq(toWei('0.375'));
        await masterChef.setMinTokenReward("100000");
        expect(await masterChef.minTokenReward()).to.be.eq("100000");

        expect(await masterChef.swapToken()).to.be.eq(reward.address);
        expect(await masterChef.tokenPerBlock()).to.be.eq("100000");

    });
    it('should setPause correct', async () => {
        await masterChef.setPause();
        expect(await masterChef.paused()).to.be.eq(true);

    });
    it('should manage pool correct', async () => {
        let pairAddress1 = await factory.getPair(usdc.address, reward.address);
        await masterChef.add("200", pairAddress1, true);
        await masterChef.add("200", busd.address, true);
        expect(await masterChef.poolLength()).to.be.eq(2);
        expect(await masterChef.totalAllocPoint()).to.be.eq("400");
        await masterChef.set(0, "300", true);
        expect(await masterChef.totalAllocPoint()).to.be.eq("500");

    });
    it('should deposit correct', async () => {
        await busd.approve(masterChef.address, toWei('10'));
        await masterChef.add("200", busd.address, true);
        await masterChef.deposit(0, "100000");
        expect(await busd.balanceOf(masterChef.address)).to.be.eq("100000");
        let userInfo = await masterChef.userInfo(0, owner.address);
        expect(userInfo.amount).to.be.eq("100000");

    });
    it('should pending correct', async () => {
        await busd.approve(masterChef.address, toWei('10'));
        await masterChef.add("200", busd.address, false);
        //user.amount == 0
        expect(await masterChef.pending(0, owner.address)).to.be.eq(0);
        await masterChef.deposit(0, "100000");

        //user.amount > 0 && block.number == pool.lastRewardBlock
        expect(await masterChef.pending(0, owner.address)).to.be.eq(0);

        //user.amount > 0 && block.number > pool.lastRewardBlock
        let lockBlock = await time.latestBlock();
        await time.advanceBlockTo(parseInt(lockBlock) + 2);

        let poolInfo = await masterChef.poolInfo(0);
        let userInfo = await masterChef.userInfo(0, owner.address);
        let totalAllocPoint = await masterChef.totalAllocPoint();
        let tokenPerBlock = await masterChef.tokenPerBlock();
        let mul = await (await time.latestBlock() - poolInfo.lastRewardBlock);

        let tokenReward = tokenPerBlock * mul * poolInfo.allocPoint / totalAllocPoint;
        let lpSupply = await busd.balanceOf(masterChef.address);
        let accTokenPerShare = poolInfo.accTokenPerShare + tokenReward * "1000000000000" / lpSupply;
        let currPending2 = userInfo.amount * accTokenPerShare / "1000000000000" - userInfo.rewardDebt;
        expect(await masterChef.pending(0, owner.address)).to.be.eq(currPending2);

    });
    it('should withdraw correct', async () => {
        await busd.approve(masterChef.address, toWei('10'));
        expect(await busd.balanceOf(owner.address)).to.be.eq(toWei('10'))

        await masterChef.add("200", busd.address, true);
        await masterChef.deposit(0, "100000");
        await masterChef.withdraw(0, "100000");
        expect(await busd.balanceOf(owner.address)).to.be.eq(toWei('10'));

    });
    it('should emergencyWithdraw correct', async () => {
        expect(await busd.balanceOf(owner.address)).to.be.eq(toWei('10'));
        expect(await busd.balanceOf(dev.address)).to.be.eq(0);

        await busd.approve(masterChef.address, toWei('10'));
        await busd.mint(dev.address, "200000");
        await busd.connect(dev).approve(masterChef.address, "200000");
        await masterChef.add("200", busd.address, true);
        await masterChef.deposit(0, "100000");
        await masterChef.connect(dev).deposit(0, "200000");
        expect(await busd.balanceOf(masterChef.address)).to.be.eq("300000");

        await masterChef.connect(dev).emergencyWithdraw(0);
        expect(await busd.balanceOf(masterChef.address)).to.be.eq("100000");
        expect(await busd.balanceOf(dev.address)).to.be.eq("200000");
        expect(await busd.balanceOf(owner.address)).to.be.eq(BigNumber.from(toWei('10')).sub("100000"));

        await masterChef.emergencyWithdraw(0);
        expect(await busd.balanceOf(masterChef.address)).to.be.eq(0);
        expect(await busd.balanceOf(owner.address)).to.be.eq(toWei('10'));

    });
    it('should allow dev and only dev to update dev', async () => {
        expect((await masterChef.operator())).to.be.eq(owner.address);
        expect((await reward.operator())).to.be.eq(owner.address);

        await expect(reward.connect(dev).addMinter(dev.address)).to.be.revertedWith('not operator');

        await expect(masterChef.connect(dev).add("1", reward.address, true)).to.be.revertedWith('not operator');
        await expect(masterChef.connect(dev).set("0", "1", true)).to.be.revertedWith('not operator');

        await masterChef.setOperator(dev.address);
        expect((await masterChef.operator())).to.be.eq(dev.address);
        expect((await masterChef.owner())).to.be.eq(owner.address);

        await masterChef.transferOwnership(dev.address);
        expect((await masterChef.owner())).to.be.eq(dev.address);

        expect(await masterChef.period()).to.be.eq("10");
        await masterChef.connect(dev).setHalvingPeriod("15");

        expect(await masterChef.period()).to.be.eq("15");
        await masterChef.connect(dev).setHalvingPeriod("145");
        expect(await masterChef.period()).to.be.eq("145");

    });

});
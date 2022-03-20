// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "../../../interfaces/maker/Maker.sol";
import "../../../interfaces/uniswap/Uni.sol";

import "../../../interfaces/yearn/Strategy.sol";
import "../../../interfaces/yearn/Vault.sol";

contract DebugStrategyMkrDaiDelegate {
    using SafeERC20 for IERC20;
    using Address for address;
    using SafeMath for uint256;

    uint256 public constant MAX = 2 ** 256 - 1;
    address public constant want = address(0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2);
    address public constant dai = address(0x6B175474E89094C44Da98b954EedeAC495271d0F);

    address public cdp_manager = address(0x5ef30b9986345249bc32d8928B7ee64DE9435E39);
    address public vat = address(0x35D1b3F3D7966A1DFe207aa4514C12a259A0492B);
    address public mcd_join_eth_a = address(0x2F0b23f53734252Bda2277357e97e1517d6B042A);
    address public mcd_join_dai = address(0x9759A6Ac90977b93B58547b4A71c78317f391A28);
    address public mcd_spot = address(0x65C79fcB50Ca1594B025960e539eD7A9a6D434A3);
    address public jug = address(0x19c0976f590D67707E62397C87829d896Dc0f1F1);

    address public eth_price_oracle = address(0xCF63089A8aD2a9D8BD6Bb8022f3190EB7e1eD0f1);

    address public constant unirouter = address(0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D);
    // address public constant want = address(0xd0A1E359811322d97991E03f863a0C30C2cF029C);
    // address public constant dai = address(0x4F96Fe3b7A6Cf9725f59d353F723c1bDb64CA6Aa);

    // address public cdp_manager = address(0x1476483dD8C35F25e568113C5f70249D3976ba21);
    // address public vat = address(0xbA987bDB501d131f766fEe8180Da5d81b34b69d9);
    // address public mcd_join_eth_a = address(0x775787933e92b709f2a3C70aa87999696e74A9F8);
    // address public mcd_join_dai = address(0x5AA71a3ae1C0bd6ac27A1f28e1415fFFB6F15B8c);
    // address public mcd_spot = address(0x3a042de6413eDB15F2784f2f97cC68C7E9750b2D);
    // address public jug = address(0xcbB7718c9F39d05aEEDE1c472ca8Bf804b2f1EaD);

    // address public eth_price_oracle = address(0xCF63089A8aD2a9D8BD6Bb8022f3190EB7e1eD0f1);

    // address public constant unirouter = address(0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D);

    uint256 public c = 20000;
    uint256 public c_safe = 30000;
    uint256 public constant c_base = 10000;

    uint256 public performanceFee = 500;
    uint256 public constant performanceMax = 10000;

    uint256 public withdrawalFee = 0;
    uint256 public constant withdrawalMax = 10000;

    bytes32 public constant ilk = "ETH-A";
    string private name;

    address public vault = address(0x154c6CCCeBD2d7A9DAbE9101faFfb39948630c88);
    uint256 public cdpId;

    constructor(string memory _name) public {
        name = _name;
        cdpId = ManagerLike(cdp_manager).open(ilk, address(this));
        _approveAll();
    }

    function getName() external view returns (string memory) {
        return name;
    }

    function setWithdrawalFee(uint256 _withdrawalFee) external {
        
        withdrawalFee = _withdrawalFee;
    }

    function setPerformanceFee(uint256 _performanceFee) external {
        
        performanceFee = _performanceFee;
    }

    // function setVault(address _tokenAddr) public {
    //     require(_tokenAddr == want, "token doesn't match");
    //     vault = msg.sender;
    // }

    function setBorrowCollateralizationRatio(uint256 _c) external {
        
        c = _c;
    }

    function setWithdrawCollateralizationRatio(uint256 _c_safe) external {
        
        c_safe = _c_safe;
    }

    function setOracle(address _oracle) external {
        
        eth_price_oracle = _oracle;
    }

    // optional
    function setMCDValue(
        address _manager,
        address _ethAdapter,
        address _daiAdapter,
        address _spot,
        address _jug
    ) external {
        
        cdp_manager = _manager;
        vat = ManagerLike(_manager).vat();
        mcd_join_eth_a = _ethAdapter;
        mcd_join_dai = _daiAdapter;
        mcd_spot = _spot;
        jug = _jug;
    }

    function _approveAll() public {
        IERC20(want).approve(mcd_join_eth_a, MAX);
        IERC20(dai).approve(mcd_join_dai, MAX);
        IERC20(dai).approve(vault, MAX);
        IERC20(dai).approve(unirouter, MAX);
    }

    function deposit() public {
        uint256 _want = IERC20(want).balanceOf(address(this));
        if (_want > 0) {
            uint256 p = _getPrice();
            uint256 _draw = _want.mul(p).mul(c_base).div(c).div(1e18);
            // approve adapter to use want amount
            require(_checkDebtCeiling(_draw), "debt ceiling is reached!");
            _lockWETHAndDrawDAI(_want, _draw);
        }
        // approve vault use DAI
        Vault(vault).depositAll();
    }

    function _getPrice() public view returns (uint256 p) {
        return 370 * 1e18;
        // (uint256 _read, ) = OSMedianizer(eth_price_oracle).read();
        // (uint256 _foresight, ) = OSMedianizer(eth_price_oracle).foresight();
        // p = _foresight < _read ? _foresight : _read;
    }

    function _checkDebtCeiling(uint256 _amt) public view returns (bool) {
        (, , , uint256 _line, ) = VatLike(vat).ilks(ilk);
        uint256 _debt = getTotalDebtAmount().add(_amt);
        if (_line.div(1e27) < _debt) {
            return false;
        }
        return true;
    }

    function _lockWETHAndDrawDAI(uint256 wad, uint256 wadD) public {
        address urn = ManagerLike(cdp_manager).urns(cdpId);

        // GemJoinLike(mcd_join_eth_a).gem().approve(mcd_join_eth_a, wad);
        GemJoinLike(mcd_join_eth_a).join(urn, wad);
        ManagerLike(cdp_manager).frob(cdpId, toInt(wad), _getDrawDart(urn, wadD));
        ManagerLike(cdp_manager).move(cdpId, address(this), wadD.mul(1e27));
        if (VatLike(vat).can(address(this), address(mcd_join_dai)) == 0) {
            VatLike(vat).hope(mcd_join_dai);
        }
        DaiJoinLike(mcd_join_dai).exit(address(this), wadD);
    }

    function _getDrawDart(address urn, uint256 wad) public returns (int256 dart) {
        uint256 rate = JugLike(jug).drip(ilk);
        uint256 _dai = VatLike(vat).dai(urn);

        // If there was already enough DAI in the vat balance, just exits it without adding more debt
        if (_dai < wad.mul(1e27)) {
            dart = toInt(wad.mul(1e27).sub(_dai).div(rate));
            dart = uint256(dart).mul(rate) < wad.mul(1e27) ? dart + 1 : dart;
        }
    }

    function toInt(uint256 x) public pure returns (int256 y) {
        y = int256(x);
        require(y >= 0, "int-overflow");
    }

    // Withdraw partial funds, normally used with a vault withdrawal
    function withdraw(uint256 _amount) external {
        uint256 _balance = IERC20(want).balanceOf(address(this));
        if (_balance < _amount) {
            _amount = _withdrawSome(_amount.sub(_balance));
            _amount = _amount.add(_balance);
        }
        IERC20(want).safeTransfer(msg.sender, _amount);
    }

    function _withdrawSome(uint256 _amount) public returns (uint256) {
        if (getTotalDebtAmount() != 0 && getmVaultRatio(_amount) < c_safe.mul(1e2)) {
            uint256 p = _getPrice();
            _wipe(_withdrawDaiLeast(_amount.mul(p).div(1e18)));
        }

        _freeWETH(_amount);

        return _amount;
    }

    function _freeWETH(uint256 wad) public {
        ManagerLike(cdp_manager).frob(cdpId, -toInt(wad), 0);
        ManagerLike(cdp_manager).flux(cdpId, address(this), wad);
        GemJoinLike(mcd_join_eth_a).exit(address(this), wad);
    }

    function _wipe(uint256 wad) public {
        // wad in DAI
        address urn = ManagerLike(cdp_manager).urns(cdpId);

        DaiJoinLike(mcd_join_dai).join(urn, wad);
        ManagerLike(cdp_manager).frob(cdpId, 0, _getWipeDart(VatLike(vat).dai(urn), urn));
    }

    function _getWipeDart(uint256 _dai, address urn) public view returns (int256 dart) {
        (, uint256 rate, , , ) = VatLike(vat).ilks(ilk);
        (, uint256 art) = VatLike(vat).urns(ilk, urn);

        dart = toInt(_dai / rate);
        dart = uint256(dart) <= art ? -dart : -toInt(art);
    }

    // Withdraw all funds, normally used when migrating strategies
    function withdrawAll() external returns (uint256 balance) {
        
        _withdrawAll();

        _swap(IERC20(dai).balanceOf(address(this)));
        balance = IERC20(want).balanceOf(address(this));
        IERC20(want).safeTransfer(msg.sender, balance);
    }

    function _withdrawAll() public {
        Vault(vault).withdrawAll(); // get Dai
        _wipe(getTotalDebtAmount().add(1)); // in case of edge case
        _freeWETH(balanceOfmVault());
    }

    function balanceOf() public view returns (uint256) {
        return balanceOfWant().add(balanceOfmVault());
    }

    function balanceOfWant() public view returns (uint256) {
        return IERC20(want).balanceOf(address(this));
    }

    function balanceOfmVault() public view returns (uint256) {
        uint256 ink;
        address urnHandler = ManagerLike(cdp_manager).urns(cdpId);
        (ink, ) = VatLike(vat).urns(ilk, urnHandler);
        return ink;
    }

    function harvest() public {
        uint256 v = getUnderlyingDai();
        uint256 d = getTotalDebtAmount();
        require(v > d, "profit is not realized yet!");
        uint256 profit = v.sub(d);

        uint256 _before = IERC20(want).balanceOf(address(this));
        _swap(_withdrawDaiMost(profit));
        uint256 _after = IERC20(want).balanceOf(address(this));

        uint256 _want = _after.sub(_before);
        if (_want > 0) {
            deposit();
        }
    }

    function shouldDraw() external view returns (bool) {
        uint256 _safe = c.mul(1e2);
        uint256 _current = getmVaultRatio(0);
        if (_current > c_base.mul(c_safe).mul(1e2)) {
            _current = c_base.mul(c_safe).mul(1e2);
        }
        return (_current > _safe);
    }

    function drawAmount() public view returns (uint256) {
        uint256 _safe = c.mul(1e2);
        uint256 _current = getmVaultRatio(0);
        if (_current > c_base.mul(c_safe).mul(1e2)) {
            _current = c_base.mul(c_safe).mul(1e2);
        }
        if (_current > _safe) {
            uint256 _eth = balanceOfmVault();
            uint256 _diff = _current.sub(_safe);
            uint256 _draw = _eth.mul(_diff).div(_safe).mul(c_base).mul(1e2).div(_current);
            return _draw.mul(_getPrice()).div(1e18);
        }
        return 0;
    }

    function draw() external {
        uint256 _drawD = drawAmount();
        if (_drawD > 0) {
            _lockWETHAndDrawDAI(0, _drawD);
            Vault(vault).depositAll();
        }
    }

    function shouldRepay() external view returns (bool) {
        uint256 _safe = c.mul(1e2);
        uint256 _current = getmVaultRatio(0);
        _current = _current.mul(105).div(100); // 5% buffer to avoid deposit/rebalance loops
        return (_current < _safe);
    }

    function repayAmount() public view returns (uint256) {
        uint256 _safe = c.mul(1e2);
        uint256 _current = getmVaultRatio(0);
        _current = _current.mul(105).div(100); // 5% buffer to avoid deposit/rebalance loops
        if (_current < _safe) {
            uint256 d = getTotalDebtAmount();
            uint256 diff = _safe.sub(_current);
            return d.mul(diff).div(_safe);
        }
        return 0;
    }

    function repay() external {
        uint256 free = repayAmount();
        if (free > 0) {
            _wipe(_withdrawDaiLeast(free));
        }
    }

    function forceRebalance(uint256 _amount) external {
        _wipe(_withdrawDaiLeast(_amount));
    }

    function getTotalDebtAmount() public view returns (uint256) {
        uint256 art;
        uint256 rate;
        address urnHandler = ManagerLike(cdp_manager).urns(cdpId);
        (, art) = VatLike(vat).urns(ilk, urnHandler);
        (, rate, , , ) = VatLike(vat).ilks(ilk);
        return art.mul(rate).div(1e27);
    }

    function getmVaultRatio(uint256 amount) public view returns (uint256) {
        uint256 spot; // ray
        uint256 liquidationRatio; // ray
        uint256 denominator = getTotalDebtAmount();

        if (denominator == 0) {
            return MAX;
        }

        (, , spot, , ) = VatLike(vat).ilks(ilk);
        (, liquidationRatio) = SpotLike(mcd_spot).ilks(ilk);
        uint256 delayedCPrice = spot.mul(liquidationRatio).div(1e27); // ray

        uint256 _balance = balanceOfmVault();
        if (_balance < amount) {
            _balance = 0;
        } else {
            _balance = _balance.sub(amount);
        }

        uint256 numerator = _balance.mul(delayedCPrice).div(1e18); // ray
        return numerator.div(denominator).div(1e3);
    }

    function getUnderlyingDai() public view returns (uint256) {
        return IERC20(vault).balanceOf(address(this)).mul(Vault(vault).getPricePerFullShare()).div(1e18);
    }

    function _withdrawDaiMost(uint256 _amount) public returns (uint256) {
        uint256 _shares = _amount.mul(1e18).div(Vault(vault).getPricePerFullShare());

        if (_shares > IERC20(vault).balanceOf(address(this))) {
            _shares = IERC20(vault).balanceOf(address(this));
        }

        uint256 _before = IERC20(dai).balanceOf(address(this));
        Vault(vault).withdraw(_shares);
        uint256 _after = IERC20(dai).balanceOf(address(this));
        return _after.sub(_before);
    }

    function _withdrawDaiLeast(uint256 _amount) public returns (uint256) {
        uint256 _shares = _amount.mul(1e18).div(Vault(vault).getPricePerFullShare()).mul(withdrawalMax).div(
            withdrawalMax.sub(withdrawalFee)
        );

        if (_shares > IERC20(vault).balanceOf(address(this))) {
            _shares = IERC20(vault).balanceOf(address(this));
        }

        uint256 _before = IERC20(dai).balanceOf(address(this));
        Vault(vault).withdraw(_shares);
        uint256 _after = IERC20(dai).balanceOf(address(this));
        return _after.sub(_before);
    }

    function _swap(uint256 _amountIn) public {
        address[] memory path = new address[](2);
        path[0] = address(dai);
        path[1] = address(want);

        // approve unirouter to use dai
        Uni(unirouter).swapExactTokensForTokens(_amountIn, 0, path, address(this), block.timestamp.add(1 days));
    }
}
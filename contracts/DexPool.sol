// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract DexPool is ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable tokenA;
    IERC20 public immutable tokenB;
    uint256 public reserveA;
    uint256 public reserveB;

    constructor(address addressA, address addressB) {
        require(addressA != address(0) && addressB != address(0), "Zero address");
        require(addressA != addressB, "Tokens must differ");
        tokenA = IERC20(addressA);
        tokenB = IERC20(addressB);
    }

    function addLiquidity(uint256 amountA, uint256 amountB) external nonReentrant {
        require(amountA > 0 && amountB > 0, "Amounts must be positive");
        tokenA.safeTransferFrom(msg.sender, address(this), amountA);
        tokenB.safeTransferFrom(msg.sender, address(this), amountB);
        reserveA += amountA;
        reserveB += amountB;
    }

    function getFeeBps(uint256 amountIn) public view returns (uint256) {
        require(reserveA > 0 && reserveB > 0, "Pool is empty");
        return amountIn > reserveA / 20 ? 100 : 10;
    }

    function getAmountOut(uint256 amountIn) public view returns (uint256) {
        require(amountIn > 0, "Amount must be positive");
        uint256 amountWithFee = amountIn * (10000 - getFeeBps(amountIn));
        return amountWithFee * reserveB / (reserveA * 10000 + amountWithFee);
    }

    function swapAforB(uint256 amountIn, uint256 minAmountOut)
        external nonReentrant returns (uint256 amountOut)
    {
        amountOut = getAmountOut(amountIn);
        require(amountOut > 0, "Output is zero");
        require(amountOut >= minAmountOut, "Output below minimum");

        reserveA += amountIn;
        reserveB -= amountOut;
        tokenA.safeTransferFrom(msg.sender, address(this), amountIn);
        tokenB.safeTransfer(msg.sender, amountOut);
    }
}

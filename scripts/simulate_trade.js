import { network } from "hardhat";

const connection = await network.create();
const { ethers } = connection;
const tokens = ethers.parseEther;
const display = ethers.formatEther;

try {
  const [owner, trader] = await ethers.getSigners();

  const tokenA = await ethers.deployContract("AssetToken", ["MoiseienkoCoin", "MSC", 100000]);
  const tokenB = await ethers.deployContract("AssetToken", ["MockFiat", "MFT", 100000]);
  await tokenA.waitForDeployment();
  await tokenB.waitForDeployment();
  console.log("Local Hardhat simulation");
  console.log("Owner:", owner.address);
  console.log("Trader:", trader.address);
  console.log("MoiseienkoCoin:", await tokenA.getAddress());
  console.log("MockFiat:", await tokenB.getAddress());

  console.log("Supply per token:", display(await tokenA.totalSupply()));

  const pool = await ethers.deployContract("DexPool", [await tokenA.getAddress(), await tokenB.getAddress()]);
  await pool.waitForDeployment();
  const poolAddress = await pool.getAddress();

  console.log("\nPool:", poolAddress);
  await (await tokenA.transfer(trader.address, tokens("5000"))).wait();
  await (await tokenB.transfer(trader.address, tokens("5000"))).wait();
  console.log("Trader MSC:", display(await tokenA.balanceOf(trader.address)));
  console.log("Trader MFT:", display(await tokenB.balanceOf(trader.address)));

  await (await tokenA.approve(poolAddress, tokens("1000"))).wait();
  await (await tokenB.approve(poolAddress, tokens("2000"))).wait();
  await (await pool.addLiquidity(tokens("1000"), tokens("2000"))).wait();

  const reserveA = await pool.reserveA();
  const reserveB = await pool.reserveB();
  const kBefore = reserveA * reserveB;
  console.log("\nInitial reserves:", display(reserveA), "MSC /", display(reserveB), "MFT");
  console.log("Initial spot rate: 1 MSC = 2 MFT");
  console.log("Fee for 50 MSC:", Number(await pool.getFeeBps(tokens("50"))) / 100, "%");
  console.log("Fee for 51 MSC:", Number(await pool.getFeeBps(tokens("51"))) / 100, "%");

  const amountIn = tokens("50");
  const quotedOut = await pool.getAmountOut(amountIn);
  const beforeB = await tokenB.balanceOf(trader.address);
  await (await tokenA.connect(trader).approve(poolAddress, amountIn)).wait();
  const tx = await pool.connect(trader).swapAforB(amountIn, quotedOut);
  const receipt = await tx.wait();
  const received = (await tokenB.balanceOf(trader.address)) - beforeB;
  const afterA = await pool.reserveA();
  const afterB = await pool.reserveB();

  console.log("\nSold:", display(amountIn), "MSC");
  console.log("Received:", display(received), "MFT");
  console.log("Effective rate:", Number(display(received)) / 50, "MFT per MSC");
  console.log("Final reserves:", display(afterA), "MSC /", display(afterB), "MFT");
  console.log("k before (token units):", ethers.formatUnits(kBefore, 36));
  console.log("k after (token units):", ethers.formatUnits(afterA * afterB, 36));
  console.log("k increased:", afterA * afterB > kBefore);
  console.log("Trader MSC:", display(await tokenA.balanceOf(trader.address)));
  console.log("Trader MFT:", display(await tokenB.balanceOf(trader.address)));
  console.log("Transaction hash (local only):", tx.hash);
  console.log("Status:", receipt.status);
} finally {
  await connection.close();
}

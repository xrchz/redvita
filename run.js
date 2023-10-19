import { ethers } from 'ethers'
import { writeFileSync } from 'node:fs'

const collateralAssetsMainnet = [
  '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
  '0xae78736Cd615f374D3085123A210448E74Fc6393',
  '0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0',
  '0xB9D7DdDca9a4AC480991865EfEf82E01273F79C3',
  '0xf951E335afb289353dc249e82926178EaC7DEd78',
  '0xac3E018457B222d93114458476f3E3416Abbe38F'
]
const collateralAssetsArbitrum = [
  '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
  '0xEC70Dcb4A1EFa46b8F2D97C310C9c4790ba5ffA8',
  '0x5979D7b546E38E414F7E9822514be443A4800529',
  '0x8ffDf2DE812095b1D19CB146E4c004587C0A0692',
  '',
  '0x95aB45875cFFdba1E5f451B950bC2E42c0053f39'
]
const WETH = 0
const rETH = 1
const wstETH = 2
const swETH = 4
const sfrxETH = 5

const vesselManagerAddressMainnet = '0xc49B737fa56f9142974a54F6C66055468eC631d0'
const vesselManagerAddressArbitrum = '0x15f74458aE0bFdAA1a96CA1aa779D715Cc1Eefe4'
const sortedVesselsAddressMainnet = '0xF31D88232F36098096d1eB69f0de48B53a1d18Ce'
const sortedVesselsAddressArbitrum = '0xc49B737fa56f9142974a54F6C66055468eC631d0'

const ethereum = true
// const ethereum = false

const univuln = '0xb7995A51733FF820bbEEFb28770b688B10c1FcFb'
const arbitrumGraiWhale = '0xe9b31F8DaaB3D2855CbA7327A4A94b2fCBd594C1'
const sender = ethereum ? univuln : arbitrumGraiWhale

async function run() {
  // await liquitySim('0.99', '1000', '0.25', sender)
  // await gravitaSim(rETH, '1745', '10000', '0.05', sender)
  // await gravitaSim(wstETH, '1800', '10000', '0.05', sender)
  // await gravitaSim(swETH, '1600', '40000', '0.05', sender)
  // await gravitaSim(sfrxETH, '1680', '10000', '0.8', sender)
  // await gravitaSim(WETH, '1570', '40000', '0.05', sender)
}

const collateralAssets = ethereum ? collateralAssetsMainnet : collateralAssetsArbitrum
const vmAddress = ethereum ? vesselManagerAddressMainnet : vesselManagerAddressArbitrum
const svAddress = ethereum ? sortedVesselsAddressMainnet : sortedVesselsAddressArbitrum
const forkProvider = new ethers.JsonRpcProvider('http://localhost:8549')
const provider = forkProvider

const vesselManager = new ethers.Contract(vmAddress,
  ['function getApproxHint(address asset,uint256 cr,uint256 n, uint256 seed) view returns (address last,uint256,uint256)',
   'function getRedemptionHints(address asset, uint256 amount, uint256 price, uint256 maxN) view returns (address first,uint256 cr,uint256)',
   'function redeemCollateral(address asset, uint256 amount, address upper, address lower, address first, uint256 cr, uint256 maxN, uint256 maxFee)'],
  provider)
const sortedVessels = new ethers.Contract(svAddress,
  ['function findInsertPosition(address asset, uint256 cr, address prev, address next) view returns (address upper, address lower)'],
  provider)

const liquityManager = new ethers.Contract(
  '0xA39739EF8b0231DbFA0DcdA07d7e29faAbCf4bb2',
  ['function redeemCollateral(uint256 amount, address first, address upper, address lower, uint256 cr, uint256 maxN, uint256 maxFee)'],
  provider)
const liquityHints = new ethers.Contract(
  '0xE84251b93D9524E0d2e621Ba7dc7cb3579F997C0',
  ['function getApproxHint(uint256 cr,uint256 n, uint256 seed) view returns (address last,uint256,uint256)',
   'function getRedemptionHints(uint256 amount, uint256 price, uint256 maxN) view returns (address first,uint256 cr,uint256)'],
  provider)
const liquitySorted = new ethers.Contract(
  '0x8FdD3fbFEb32b28fb73555518f8b361bCeA741A6',
  ['function findInsertPosition(uint256 cr, address prev, address next) view returns (address upper, address lower)'],
  provider)

async function getRedeemParams(i, USDPrice, debtMax, feePerc) {
  const asset = collateralAssets[i]
  const debtAmount = ethers.parseEther(debtMax)
  const hints = await vesselManager.getRedemptionHints(asset, debtAmount, ethers.parseEther(USDPrice), 0n)
  const approx = await vesselManager.getApproxHint(asset, hints.cr, 100n, 100n)
  const posn = await sortedVessels.findInsertPosition(asset, hints.cr, hints.first, approx.last)
  return [asset, debtAmount, posn.upper, posn.lower, hints.first, hints.cr, 0n, ethers.parseEther(feePerc)]
}

const f500 = ethers.zeroPadValue(ethers.toBeHex(500), 3)
function getPath(asset) {
  if (ethereum) {
    if (asset == wstETH) {
      const path = ethers.concat([
        '0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0', // wstETH
        f500,
        '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC
        f500,
        '0x15f74458aE0bFdAA1a96CA1aa779D715Cc1Eefe4', // GRAI
      ])
      return path
    }
    else if (asset == rETH) {
      const path = ethers.concat([
        '0xae78736Cd615f374D3085123A210448E74Fc6393', // rETH
        ethers.zeroPadValue(ethers.toBeHex(100), 3),
        '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', // WETH
        f500,
        '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC
        f500,
        '0x15f74458aE0bFdAA1a96CA1aa779D715Cc1Eefe4', // GRAI
      ])
      return path
    }
    else {
      console.error(`No path for asset ${asset}`)
      process.exit(1)
    }
  }
  else {
    if (asset == rETH) {
      const path = ethers.concat([
        '0xEC70Dcb4A1EFa46b8F2D97C310C9c4790ba5ffA8', // rETH
        f500,
        '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1', // WETH
        f500,
        '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', // USDC
        f500,
        '0x894134a25a5faC1c2C26F1d8fBf05111a3CB9487', // GRAI
      ])
      return path
    }
    else {
      console.error(`No path for asset ${asset} on arbitrum`)
      process.exit(1)
    }
  }
}

async function getLiquityRedeemParams(debtMax, USDPrice, feePerc) {
  const lusdAmount = ethers.parseEther(debtMax)
  const hints = await liquityHints.getRedemptionHints(
    lusdAmount, ethers.parseEther(USDPrice), 0n)
  const approx = await liquityHints.getApproxHint(hints.cr, 100n, 100n)
  const posn = await liquitySorted.findInsertPosition(hints.cr, hints.first, approx.last)
  return [lusdAmount, hints.first, posn.upper, posn.lower, hints.cr, 0n, ethers.parseEther(feePerc)]
}

async function gravitaSim(asset, price, amount, fee, sender) {
  const vesselManagerAddress = await vesselManager.getAddress()
  console.log(await provider.getBlockNumber())
  console.log(vesselManagerAddress)
  const params = await getRedeemParams(asset, price, amount, fee)
  console.log(params.map(x => x.toString()))
  // const txData = vesselManager.interface.encodeFunctionData('redeemCollateral', params)
  // console.log(txData)

  // const vmFork = new ethers.Contract(vesselManagerAddress, vesselManager.interface, forkProvider)
  const vmFork = vesselManager
  await forkProvider.send('anvil_impersonateAccount', [sender])
  const signer = await forkProvider.getSigner(sender)
  const tx = await vmFork.connect(signer).redeemCollateral(...params)
  const receipt = await tx.wait()
  console.log(`Got receipt status ${receipt.status}`)
  await forkProvider.send('anvil_stopImpersonatingAccount', [sender])
  const TransferInterface = new ethers.Interface(['event Transfer(address indexed _from, address indexed _to, uint256 _amount)'])
  console.log(receipt.logs
    .map(l => ({address: l.address, log: TransferInterface.parseLog(l)}))
    .filter(l => l.log && (l.log.args[0] == sender || l.log.args[1] == sender))
    .map(l => ({address: l.address, from: l.log.args[0], to: l.log.args[1], amount: ethers.formatEther(l.log.args[2])}))
  )
  console.log(`path: ${getPath(asset)}`)
  return

  const result = await tenderlyProvider.send('tenderly_simulateTransaction', [
    {
      from: sender,
      to: vesselManagerAddress,
      data: txData
    },
    'pending'
  ])
  const resultJson = JSON.stringify(result)
  console.log(result.status)
  writeFileSync('result.json', resultJson)
}

async function liquitySim(price, amount, fee, sender) {
  const managerAddress = await liquityManager.getAddress()
  console.log(await provider.getBlockNumber())
  console.log(managerAddress)
  const params = await getLiquityRedeemParams(amount, price, fee)
  console.log(params.map(x => x.toString()))
  const txData = liquityManager.interface.encodeFunctionData('redeemCollateral', params)
  console.log(txData)

  if (!ethereum) return

  const result = await tenderlyProvider.send('tenderly_simulateTransaction', [
    {
      from: sender,
      to: managerAddress,
      data: txData
    },
    'pending'
  ])
  const resultJson = JSON.stringify(result)
  console.log(result.status)
  writeFileSync('result.json', resultJson)
}

await run()

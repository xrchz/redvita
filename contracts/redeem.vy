#pragma version ^0.3.0

MAX_COLLATERALS: constant(uint8) = 8
MAX_PATH: constant(uint8) = 6
NARGS: constant(uint8) = 8
NSWAP: constant(uint8) = 4

interface Token:
  def balanceOf(_who: address) -> uint256: view
  def transfer(_to: address, _amount: uint256) -> bool: nonpayable
  def approve(_spender: address, _amount: uint256) -> bool: nonpayable

interface Admin:
  def getValidCollateral() -> DynArray[address, MAX_COLLATERALS]: view

interface VesselManagerOperations:
  def redeemCollateral(
      _asset: address,
      _debtTokenAmount: uint256,
      _upperPartialRedemptionHint: address,
      _lowerPartialRedemptionHint: address,
      _firstRedemptionHint: address,
      _partialRedemptionHintNICR: uint256,
      _maxIterations: uint256,
      _maxFeePercentage: uint256): nonpayable

interface Permit:
  def approve(_token: address, _spender: address, _amount: uint256, _expiration: uint256): nonpayable

interface Vault:
  def flashLoan(
      _recipient: address,
      _tokens: DynArray[address, 1],
      _amounts: DynArray[uint256, 1],
      _data: Bytes[(NARGS + MAX_PATH) * 32]): nonpayable

interface Router:
  def execute(
    _command: Bytes[1],              # extra NARGS below due to Vyper slice typing bug
    _inputs: DynArray[Bytes[(NSWAP + (NARGS + 2 + MAX_PATH)) * 32], 1]): nonpayable

vesselManager: immutable(VesselManagerOperations)
vault: immutable(Vault)
universalRouter: immutable(Router)
debtToken: immutable(Token)
owner: constant(address) = 0x65FE89a480bdB998F4116DAf2A9360632554092c
permit2: immutable(Permit)

@external
def __init__(m: address, d: address, v: address, u: address, p: address, a: address):
  vesselManager = VesselManagerOperations(m)
  debtToken = Token(d)
  vault = Vault(v)
  universalRouter = Router(u)
  permit2 = Permit(p)
  admin: Admin = Admin(a)
  assets: DynArray[address, MAX_COLLATERALS] = admin.getValidCollateral()
  for asset in assets:
    assetToken: Token = Token(asset)
    assert assetToken.approve(permit2.address, max_value(uint256)), "a"

@external
def redeem(
    _asset: address,
    _debtTokenAmount: uint256,
    _upperPartialRedemptionHint: address,
    _lowerPartialRedemptionHint: address,
    _firstRedemptionHint: address,
    _partialRedemptionHintNICR: uint256,
    _maxIterations: uint256,
    _maxFeePercentage: uint256,
    _path: Bytes[MAX_PATH * 32]):
  data: Bytes[(NARGS + MAX_PATH) * 32] = concat(
    convert(_asset, bytes32),
    convert(_debtTokenAmount, bytes32),
    convert(_upperPartialRedemptionHint, bytes32),
    convert(_lowerPartialRedemptionHint, bytes32),
    convert(_firstRedemptionHint, bytes32),
    convert(_partialRedemptionHintNICR, bytes32),
    convert(_maxIterations, bytes32),
    convert(_maxFeePercentage, bytes32),
    _path)
  vault.flashLoan(self, [debtToken.address], [_debtTokenAmount], data)
  assetToken: Token = Token(_asset)
  balance: uint256 = assetToken.balanceOf(self)
  if balance != 0:
    assert assetToken.transfer(owner, balance), "a"
  balance = debtToken.balanceOf(self)
  if balance != 0:
    assert debtToken.transfer(owner, balance), "d"

@external
def receiveFlashLoan(
  _tokens: DynArray[address, 1],
  _amounts: DynArray[uint256, 1],
  _data: Bytes[(NARGS + MAX_PATH) * 32]):
  assert msg.sender == vault.address, "v"
  assert _tokens[0] == debtToken.address, "t"
  asset: address = extract32(_data, 0 * 32, output_type=address)
  assetToken: Token = Token(asset)
  assetBalance: uint256 = assetToken.balanceOf(self)
  vesselManager.redeemCollateral(
    asset,
    extract32(_data, 1 * 32, output_type=uint256),
    extract32(_data, 2 * 32, output_type=address),
    extract32(_data, 3 * 32, output_type=address),
    extract32(_data, 4 * 32, output_type=address),
    extract32(_data, 5 * 32, output_type=uint256),
    extract32(_data, 6 * 32, output_type=uint256),
    extract32(_data, 7 * 32, output_type=uint256))
  permit2.approve(assetToken.address, vault.address, assetBalance, 0)
  pathLength: uint256 = len(_data) - NARGS * 32
  universalRouter.execute(b"\x01", [
    concat(
      convert(self, bytes32),
      convert(_amounts[0], bytes32),
      convert(assetBalance, bytes32),
      convert(convert(5 * 32, uint256), bytes32),
      convert(True, bytes32),
      convert(pathLength, bytes32),
      slice(_data, NARGS * 32, pathLength) # assume already padded to multiple of 32 bytes
    )])
  debtToken.transfer(vault.address, _amounts[0])

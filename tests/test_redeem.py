import pytest
from ape import reverts

addresses = {
        'ethereum': {
            'vesselManager': '0xc49B737fa56f9142974a54F6C66055468eC631d0',
            'debtToken': '0x15f74458aE0bFdAA1a96CA1aa779D715Cc1Eefe4',
            'vault': '0xBA12222222228d8Ba445958a75a0704d566BF2C8',
            'universalRouter': '0x3F6328669a86bef431Dc6F9201A5B90F7975a023',
            'permit2': '0x000000000022D473030F116dDEE9F6B43aC78BA3',
            'admin': '0xf7Cc67326F9A1D057c1e4b110eF6c680B13a1f53',
        },
        'arbitrum': {
            'vesselManager': '0x15f74458aE0bFdAA1a96CA1aa779D715Cc1Eefe4',
            'debtToken': '0x894134a25a5faC1c2C26F1d8fBf05111a3CB9487',
            'vault': '0xBA12222222228d8Ba445958a75a0704d566BF2C8',
            'universalRouter': '0xeC8B0F7Ffe3ae75d7FfAb09429e3675bb63503e4',
            'permit2': '0x000000000022D473030F116dDEE9F6B43aC78BA3',
            'admin': '0x4928c8F8c20A1E3C295DddBe05095A9aBBdB3d14',
        },
}

@pytest.fixture
def redeem(project, networks, accounts):
    addr = addresses[networks.ecosystem.name]
    return project.redeem.deploy(
                addr['vesselManager'],
                addr['debtToken'],
                addr['vault'],
                addr['universalRouter'],
                addr['permit2'],
                addr['admin'], sender=accounts[0])

def test_flashloan_auth(accounts, redeem):
    with reverts('v'):
        redeem.receiveFlashLoan([accounts[0]], [0], b'', sender=accounts[1])

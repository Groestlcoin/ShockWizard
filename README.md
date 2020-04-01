<div align="center" style="display: flex; width: 100%; align-items: center; justify-content: center; flex-direction: column">
  <span style="font-size: 24px;font-weight: bold;">GROESTLCOIN S H O C K W I Z A R D</span><br>
  <img src="https://shockwallet.app/wizardSS_homepage.png" style="margin-bottom: 5px" /><br>
  <span style="font-size: 22px;font-weight: bold;">Run your own node and wallet server in a few clicks.</span>
  <div style="margin-top: 10px;">
    <a href="https://ci.appveyor.com/project/Emad-salah/wizard-q98nu">
      <img src="https://ci.appveyor.com/api/projects/status/xede0f6xagl1bjf6?svg=true" />
    </a>
  </div>
</div>

# Introduction

Groestlcoin ShockWizard is a Desktop Installer that makes deploying and managing your own Groestlcoin+LND node, and configuring as your [Groestlcoin ShockWallet](https://github.com/Groestlcoin/shocknet-wallet) server, as simple as a few clicks. 

There are automatic builds for most operating systems:
- ~~[MacOS](https://github.com/Groestlcoin/ShockWizard/releases)~~ Mac wanted
- [Windows](https://github.com/Groestlcoin/ShockWizard/releases)
- [Linux](https://github.com/Groestlcoin/ShockWizard/releases) (*headless systems should follow the API readme*)

ShockWallet utilizes [ShockAPI](https://github.com/Groestlcoin/shocknet-api) which comes configured with this package. The wizard supports both Neutrino and Groestlcoin Core.



# Install

Browse to [Releases](https://github.com/Groestlcoin/ShockWizard/releases) and download->run the correct file for your operating system. 

*Full Groestlcoin Core installations should budget at least 400GB of disk space*

Windows users should install "as Administrator" 


# Using with Groestlcoin ShockWallet
- The end of the wizard will provide you with a scan-able QR code. 
- Scan with Groestlcoin ShockWallet to automatically connect
- This method will configure the app to automatically switch between your internal and external* IP addresses when you leave your home network.

**Port `9835` is used by default and may require a Firewall/NAT Forwarding Rule to be set on your router.*

## Packaging from Source

To package apps for the local platform:

```bash
$ yarn package
```


<hr></hr>

**If you find any issues with this project, or would like to suggest an enhancement, please [tell us](https://github.com/Groestlcoin/ShockWizard/issues).**

[ISC License](https://opensource.org/licenses/ISC)
© 2020 [Shock Network, Inc.](http://shock.network)
© 2020 [Groestlcoin Developers](https://groestlcoin.org)

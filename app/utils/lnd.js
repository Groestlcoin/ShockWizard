import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawn } from 'child_process';
import localForage from 'localforage';
import { ipcRenderer } from 'electron';
import logger from 'electron-log';
import Downloader from './downloader';
import { getFolderPath, getDataDir, getUserPlatform } from './os';

const regexExpressions = {
  blockHeightLength: {
    regex: /(?:Syncing to block height)\s([0-9])+/g,
    phrases: ['Syncing to block height'],
    replace: ['Syncing to block height '],
    key: 'downloadedBlockHeightsLength'
  },
  currentHeight: {
    regex: /(?:\(height\s)([0-9])+/g,
    phrases: ['Verified', 'filter headers in the last'],
    replace: ['(height '],
    key: 'downloadedBlocks',
    condition: (downloadedBlocks, downloadedBlockHeightsLength) =>
      downloadedBlocks !== downloadedBlockHeightsLength || downloadedBlocks === 0
  },
  syncedBlocks: {
    phrases: ['Fully caught up with cfheaders at height'],
    key: 'downloadedBlocks',
    value: async () => localForage.getItem('downloadedBlockHeightsLength')
  },
  walletLocked: {
    phrases: ['Waiting for wallet encryption password'],
    key: 'walletUnlocked',
    value: () => false
  },
  walletUnlocked: {
    phrases: ['Opened wallet'],
    key: 'walletUnlocked',
    value: () => true
  }
};

let child = null;
let dataListener = null;

const getLndDirectory = () => {
  const platform = os.platform();
  const homeDir = os.homedir();
  if (platform.toLowerCase() === 'darwin') {
    return `${homeDir}/Library/Application Support/Lnd-grs`;
  }

  if (platform.toLowerCase() === 'linux') {
    return `${homeDir}/.lnd-grs`;
  }

  return path.resolve(process.env.APPDATA, '../Local/Lnd-grs'); // Windows not implemented yet
};

const lndDirectory = getLndDirectory();

const download = async ({ version, os: operatingSystem }, progressCallback) => {
  logger.info('Downloading LND...');
  const folderPath = await getFolderPath();
  const fileName = `lnd-${operatingSystem}-amd64-${version}.${
    operatingSystem === 'linux' ? 'tar.gz' : 'zip'
  }`;
  const LNDExists =
    fs.existsSync(path.resolve(folderPath, 'lnd', 'lnd.exe')) ||
    fs.existsSync(path.resolve(folderPath, 'lnd', 'lnd'));
  if (!LNDExists) {
    logger.info("LND doesn't exist");
    await Downloader.downloadRelease(
      {
        version,
        user: 'Groestlcoin',
        repo: 'lnd',
        fileName
      },
      progressCallback
    );
    return true;
  }
  logger.info('LND already exists');
  progressCallback({
    app: 'lnd',
    progress: 100
  });
};

const getStatuses = async () => {
  const keys = await localForage.keys();
  const statuses = await Promise.all(
    keys.map(async key => ({
      [key]: await localForage.getItem(key)
    }))
  );
  return statuses.reduce(
    (collectedStatuses, status) => ({
      ...collectedStatuses,
      ...status
    }),
    {}
  );
};

const setStatus = async (key, value) => {
  await localForage.setItem(key, value);
  ipcRenderer.send('statusUpdate', await getStatuses());
  return value;
};

const getChild = () => {
  return child;
};

const processLine = async line => {
  await Promise.all(
    Object.entries(regexExpressions).map(async ([key, conditions]) => {
      const downloadedBlockHeightsLength = await localForage.getItem(
        'downloadedBlockHeightsLength'
      );
      if (conditions.phrases) {
        const unmatchedPhrases = conditions.phrases.filter(phrase => !line.includes(phrase))[0];
        if (unmatchedPhrases) {
          return false;
        }
      }

      if (conditions.condition) {
        if (key === 'currentHeight') {
          const downloadedBlocks = await localForage.getItem('downloadedBlocks');
          const matched = conditions.condition(downloadedBlocks, downloadedBlockHeightsLength);
          if (!matched) {
            return false;
          }
        }
      }

      if (conditions.regex) {
        const matchedRegex = line.match(conditions.regex);

        if (matchedRegex && matchedRegex.length > 0) {
          const value = conditions.replace.reduce(
            (conditionValue, replaceValue) => conditionValue.replace(replaceValue, ''),
            matchedRegex[0]
          );
          await setStatus(conditions.key, parseInt(value, 10));
          if (key === 'currentHeight' && downloadedBlockHeightsLength === value) {
            const walletUnlocked = await localForage.getItem('walletUnlocked');
            // eslint-disable-next-line no-new
            new Notification('Network sync is complete!', {
              body: `Node has completed initial sync with the Groestlcoin network! ${
                walletUnlocked ? '' : 'Connect with Groestlcoin ShockWallet to interact with it'
              }`
            });
          }
          return { key: conditions.key, value };
        }
        return false;
      }

      if (conditions.value) {
        const value = await conditions.value();
        await setStatus(conditions.key, value);
        if (key === 'syncedBlocks') {
          const [walletUnlocked, networkType, dataDir] = await Promise.all([
            localForage.getItem('walletUnlocked'),
            localForage.getItem('networkType'),
            getDataDir()
          ]);

          // eslint-disable-next-line no-new
          new Notification('Network sync is complete!', {
            body: `Node has completed initial sync with the Groestlcoin network! ${
              walletUnlocked ? '' : 'Connect with Groestlcoin ShockWallet to interact with it'
            }`
          });

          const serverConfig = {
            serverhost: '0.0.0.0',
            lndCertPath: `${lndDirectory}/tls.cert`,
            macaroonPath: `${dataDir}/chain/groestlcoin/${
              networkType ? networkType : 'testnet'
            }/admin.macaroon`
          };

          logger.info('ShockAPI Macaroon Path:', serverConfig.macaroonPath);

          ipcRenderer.send('startServer', serverConfig);
        } else if (key === 'walletUnlocked') {
          const downloadedBlocks = await localForage.getItem('downloadedBlocks');
          // eslint-disable-next-line no-new
          new Notification('Wallet is successfully unlocked!', {
            body: `The LND instance is now unlocked! ${
              downloadedBlocks >= downloadedBlockHeightsLength
                ? ''
                : 'Please wait while the node syncs with the Groestlcoin network'
            }`
          });
          if (downloadedBlocks >= downloadedBlockHeightsLength) {
            const [networkType, dataDir] = await Promise.all([
              localForage.getItem('networkType'),
              getDataDir()
            ]);
            const serverConfig = {
              serverhost: '0.0.0.0',
              lndCertPath: `${lndDirectory}/tls.cert`,
              macaroonPath: `${dataDir}/chain/groestlcoin/${
                networkType ? networkType : 'testnet'
              }/admin.macaroon`
            };
            // ipcRenderer.send('startServer', serverConfig);
          }
        }
        return { key: conditions.key, value };
      }
    })
  );
  if (dataListener) {
    dataListener(line);
  }
};

const start = async () => {
  const folderPath = await getFolderPath();
  const os = getUserPlatform();
  const lndExe = path.resolve(folderPath, 'lnd', `lnd${os !== 'linux' ? '.exe' : ''}`);
  const networkType = await localForage.getItem('networkType');
  const networkUrl = await localForage.getItem('networkUrl');
  const lndType = (await localForage.getItem('lndType')) || 'neutrino';
  const dataDir = await getDataDir();
  child = spawn(lndExe, [
    '--groestlcoin.active',
    `--groestlcoin.${networkType || 'testnet'}`,
    '--debuglevel=info',
    `--groestlcoin.node=${lndType}`,
    `--datadir=${dataDir}`,
    ...(lndType === 'groestlcoind'
      ? [
          `--groestlcoind.dir=${dataDir}`,
          '--groestlcoind.zmqpubrawtx=tcp://127.0.0.1:28333',
          '--groestlcoind.zmqpubrawblock=tcp://127.0.0.1:28332',
          '--groestlcoind.rpcuser=test',
          '--groestlcoind.rpcpass=test',
          '--groestlcoind.rpchost=localhost'
        ]
      : [`--neutrino.connect=${networkUrl}`])
  ]);
  ipcRenderer.send('lndPID', child.pid);
  child.stdout.on('data', data => {
    const line = data.toString();
    processLine(line);
  });
  child.stderr.on('data', data => {
    logger.error(data.toString());
    const error = data.toString().split(':');
    // eslint-disable-next-line no-new
    new Notification('LND Error', {
      body: error.length > 1 ? error.slice(1, error.length).join(':') : error[0]
    });
  });
};

const terminate = () => {
  if (child) {
    child.kill('SIGINT');
  }
};

const onData = callback => {
  dataListener = callback;
};

const offData = () => {
  dataListener = null;
};

export default {
  download,
  start,
  getChild,
  terminate,
  onData,
  offData
};

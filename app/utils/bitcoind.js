import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import localForage from 'localforage';
import logger from 'electron-log';
import { ipcRenderer } from 'electron';
import Downloader from './downloader';
import { getFolderPath, getUserPlatform } from './os';

const regexExpressions = {
  progress: {
    regex: /(?:progress=)([0-9.])+/g,
    phrases: ['UpdateTip'],
    replace: ['progress='],
    key: 'progress',
    default: 0
  }
};

let child = null;
let dataListener = null;

const saveBitcoindConfig = ({ config, bitcoindPath }) =>
  new Promise((resolve, reject) => {
    const configText = Object.entries(config)
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');

    fs.writeFile(bitcoindPath, configText, (err, data) => (err ? reject(err) : resolve(data)));
  });
  //https://github.com/Groestlcoin/groestlcoin/releases/v2.18.2/groestlcoin-2.18.2-x86_64-linux-gnu.tar.gz
  //https://github.com/Groestlcoin/groestlcoin/releases/download/v2.18.2/groestlcoin-2.18.2-x86_64-linux-gnu.tar.gz
  const download = async ({ version, os, osArchitecture }, progressCallback) => {
  const folderPath = await getFolderPath();
  const fileName = `groestlcoin-${version}-${osArchitecture}.${os === 'linux' ? 'tar.gz' : 'zip'}`;
  if (!fs.existsSync(path.resolve(folderPath, 'groestlcoind'))) {
    await Downloader.downloadFile(
      {
        downloadUrl: `http://github.com/Groestlcoin/groestlcoin/releases/download/v${version}/${fileName}`,
        fileName: 'groestlcoind',
        extractedFolderName: `groestlcoin-${version}`
      },
      progressCallback
    );
    return true;
  }
  progressCallback({
    app: 'groestlcoind',
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
  await localForage.setItem(`bitcoind_${key}`, value);
  ipcRenderer.send('bitcoindStatusUpdate', await getStatuses());
  return value;
};

const processLine = async line => {
  await Promise.all(
    Object.entries(regexExpressions).map(async ([key, conditions]) => {
      const downloadedBlockHeightsLength = await localForage.getItem(
        'bitcoind_downloadedBlockHeightsLength'
      );
      if (conditions.phrases) {
        const unmatchedPhrases = conditions.phrases.filter(phrase => !line.includes(phrase))[0];
        if (unmatchedPhrases) {
          return false;
        }
      }

      if (conditions.regex) {
        const matchedRegex = line.match(conditions.regex);

        if (matchedRegex && matchedRegex.length > 0) {
          const value = conditions.replace.reduce(
            (conditionValue, replaceValue) => conditionValue.replace(replaceValue, ''),
            matchedRegex[0]
          );
          await setStatus(conditions.key, parseFloat(value, 10));
          return { key: conditions.key, value };
        }
        return false;
      }

      if (conditions.value) {
        const value = await conditions.value();
        await setStatus(conditions.key, value);
        if (key === 'syncedBlocks') {
          const walletUnlocked = await localForage.getItem('bitcoind_walletUnlocked');
          // eslint-disable-next-line no-new
          new Notification('Network sync is complete!', {
            body: `Node has completed initial sync with the Groestlcoin network! ${
              walletUnlocked ? '' : 'Connect with Groestlcoin ShockWallet to interact with it'
            }`
          });github.com/Groestlcoin/groestlcoin
        } else if (key === 'walletUnlocked') {
          const downloadedBlocks = await localForage.getItem('bitcoind_downloadedBlocks');
          // eslint-disable-next-line no-new
          new Notification('Wallet is successfully unlocked!', {
            body: `The LND instance is now unlocked! ${
              downloadedBlocks >= downloadedBlockHeightsLength
                ? ''
                : 'Please wait while the node syncs with the Groestlcoin network'
            }`
          });
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
  const [folderPath, networkType, lndType] = await Promise.all([
    getFolderPath(),
    localForage.getItem('networkType'),
    localForage.getItem('lndType')
  ]);
  const os = getUserPlatform();
  const bitcoindExe = path.resolve(
    folderPath,
    'groestlcoind',
    'bin',
    `groestlcoind${os === 'windows' ? '.exe' : ''}`
  );
  const dataDir = path.resolve(folderPath, 'groestlcoind', 'data');
  if (lndType !== 'groestlcoind') {
    return;
  }
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  child = spawn(bitcoindExe, [
    `--testnet=${networkType === 'mainnet' ? 0 : 1}`,
    `--datadir=${dataDir}`
  ]);
  ipcRenderer.send('bitcoindPID', child.pid);
  await saveBitcoindConfig({
    config: {
      testnet: networkType === 'mainnet' ? 0 : 1,
      datadir: dataDir,
      server: 1,
      listen: 0,
      zmqpubrawtx: 'tcp://127.0.0.1:29000',
      zmqpubrawblock: 'tcp://127.0.0.1:29000',
      rpcuser: 'test',
      rpcpass: 'test'
    },
    bitcoindPath: path.resolve(folderPath, 'groestlcoind', 'data', 'groestlcoin.conf')
  });
  child.stdout.on('data', data => {
    const line = data.toString();
    processLine(line);
  });
  child.stderr.on('data', data => {
    logger.error(data.toString());
    const error = data.toString().split(':');
    // eslint-disable-next-line no-new
    new Notification('Groestlcoind Error', {
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
  terminate,
  onData,
  offData
};

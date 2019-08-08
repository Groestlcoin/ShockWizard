import os from 'os';
import path from 'path';
import fs from 'fs';
import { remote } from 'electron';
import localForage from 'localforage';

export const getUserPlatform = (shortNames = false) => {
  const platform = os.platform();
  if (platform === 'win32' && !shortNames) {
    return 'windows';
  }

  if (platform === 'win32' && shortNames) {
    return 'win64';
  }

  return platform;
};

export const getFolderPath = async () => {
  const folderPath = await localForage.getItem('installLocation');
  console.log(folderPath);
  return (
    folderPath ||
    path.resolve(
      remote.process.execPath
        .split('/')
        .slice(0, -1)
        .join('/'),
      'executables'
    )
  );
};

export const getDataDir = async () => {
  const lndType = await localForage.getItem('lndType');
  const folderPath = await getFolderPath();
  if (lndType === 'bitcoind') {
    const dataDir = path.resolve(folderPath, 'bitcoind', 'data');
    return dataDir;
  }

  const dataDir = path.resolve(folderPath, 'lnd', 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  return dataDir;
};

export const isIPAddress = address => {
  const IPMatches = address.match(
    /\b(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g
  );
  return IPMatches ? !!IPMatches[0] : false;
};

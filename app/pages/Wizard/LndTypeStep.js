/* eslint-disable jsx-a11y/label-has-for */
/* eslint-disable jsx-a11y/label-has-associated-control */
import React, { Component } from 'react';
import localForage from 'localforage';
import logger from 'electron-log';
import styles from './css/index.css';

export default class LndTypeStep extends Component {
  state = {
    lndType: 'neutrino'
  };

  componentDidMount = () => {
    this.setOption('lndType', 'neutrino');
  };

  componentWillUnmount = () => {
    const { lndType } = this.state;
    this.setOption('lndType', lndType);
  };

  setOption = async (key, value) => {
    await localForage.setItem(key, value);
    logger.info(key, value);
    this.setState({
      [key]: value
    });
  };

  render() {
    const { lndType } = this.state;
    return (
      <div className={styles.container}>
        <div className={styles.wizardStepContainer}>
          <div className={styles.lndTypeContainer}>
            <p className={styles.stepTitle}>BLOCK DOWNLOAD METHOD</p>
            <div className={styles.stepChoices}>
              <label className={styles.stepChoice}>
                <input
                  type="radio"
                  name="lnd-type"
                  value="neutrino"
                  onChange={e => this.setOption('lndType', e.target.value)}
                  checked={lndType === 'neutrino'}
                />
                <span className={styles.checkmark} />
                <div className={styles.choiceInfoContainer}>
                  <b>Neutrino</b>
                  <p className={styles.radioDesc}>
                    A privacy preserving protocol for reading compressed blockchain data. Groestlcoin 
                    Shock Network provides default public Neutrino servers on Mainnet or Testnet.
                    Alternatively, you can specify different servers.
                  </p>
                </div>
              </label>
              <label className={styles.stepChoice}>
                <input
                  type="radio"
                  name="lnd-type"
                  value="groestlcoind"
                  onChange={e => this.setOption('lndType', e.target.value)}
                  checked={lndType === 'groestlcoind'}
                />
                <span className={styles.checkmark} />
                <div className={styles.choiceInfoContainer}>
                  <b>Groestlcoin Core</b>
                  <p className={styles.radioDesc}>
                    Discerning users that require a fully-validating, trustless node, should opt to
                    install Groestlcoin Core. This currently requires at minimum 3GB of disk space,
                    and may require from 1-5 hours to fully synchronize.
                  </p>
                </div>
              </label>
            </div>
          </div>
        </div>
      </div>
    );
  }
}

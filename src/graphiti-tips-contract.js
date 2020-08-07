import Web3Eth from 'web3-eth';
import Web3EthContract from 'web3-eth-contract';
import { numberToHex } from 'web3-utils';
import { Transaction } from 'ethereumjs-tx';
import { privateToAddress, bufferToHex } from 'ethereumjs-util';

const ABI = [
  {
    inputs: [
      {
        internalType: 'bytes32',
        name: 'wallId',
        type: 'bytes32',
      },
      {
        internalType: 'uint256',
        name: 'threshold',
        type: 'uint256',
      },
      {
        internalType: 'address[]',
        name: 'userList',
        type: 'address[]',
      },
      {
        internalType: 'uint256[]',
        name: 'amountList',
        type: 'uint256[]',
      },
      {
        internalType: 'bytes32[]',
        name: 'rList',
        type: 'bytes32[]',
      },
      {
        internalType: 'bytes32[]',
        name: 'sList',
        type: 'bytes32[]',
      },
      {
        internalType: 'uint8[]',
        name: 'vList',
        type: 'uint8[]',
      },
    ],
    name: 'claimTips',
    outputs: [
      {
        internalType: 'bool',
        name: '',
        type: 'bool',
      },
    ],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: 'tokenAddr',
        type: 'address',
      },
    ],
    stateMutability: 'nonpayable',
    type: 'constructor',
  },
  {
    inputs: [],
    name: 'token',
    outputs: [
      {
        internalType: 'contract IERC20',
        name: '',
        type: 'address',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
];

class Contract {
  constructor(params = {}) {
    const {
      address = '0x1420c884E438990514624E0bAA80693CE7Dcf48d',
      url = 'https://ropsten.infura.io/v3/d42215f0720e4b8c8a7af1a22cb07b5b',
    } = params;

    this._address = address;
    this._eth = new Web3Eth(url);
    this._contract = new Web3EthContract(ABI);
  }

  async claimTips(params, options = {}) {
    const { wallId, threshold, userList, amountList, rList, sList, vList } = params;
    const { privKey, isTestnet = true } = options;

    const from = bufferToHex(privateToAddress(privKey));
    const data = this._contract.methods.claimTips(wallId, threshold, userList, amountList, rList, sList, vList).encodeABI();
    const [gasPrice, nonce] = await Promise.all([
      this._eth.getGasPrice().then(numberToHex),
      this._eth.getTransactionCount(from).then(numberToHex),
    ]);
    const txParams = {
      nonce,
      gasPrice,
      to: this._address,
      value: '0x00',
      data,
    };
    const gas = await this._eth.estimateGas(txParams);

    txParams.gas = gas;

    const tx = new Transaction(txParams, { chain: isTestnet ? 'ropsten' : 'mainnet', hardfork: 'petersburg' });
    tx.sign(privKey);
    const serializedTx = tx.serialize();

    return this._eth.sendSignedTransaction(bufferToHex(serializedTx));
  }
}

export default Contract;

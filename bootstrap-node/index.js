'use strict';

const {
  SIGNALING_SERVER_PORT = 13579,
  TCP_PORT = 9091,
  WS_PORT = 9092,
} = process.env;

const Libp2p = require('libp2p');
const TCP = require('libp2p-tcp');
const Websockets = require('libp2p-websockets');
const wrtc = require('wrtc');
const WebrtcStar = require('libp2p-webrtc-star');
const { NOISE } = require('libp2p-noise');
const Secio = require('libp2p-secio');
const Mplex = require('libp2p-mplex');
const Gossipsub = require('libp2p-gossipsub');
const MDNS = require('libp2p-mdns');
const KademliaDHT = require('libp2p-kad-dht');

const PeerId = require('peer-id');

const runSignalingServer = require('./run-signaling-server');
const id = require('./id.json');

Promise.all([
  runSignalingServer(SIGNALING_SERVER_PORT),
  PeerId.createFromJSON(id),
])
  .then(async ([signalingServerAddr, peerId]) => {
    const addrs = [
      `/ip4/0.0.0.0/tcp/${TCP_PORT}`,
      `/ip4/0.0.0.0/tcp/${WS_PORT}/ws`,
      signalingServerAddr,
    ];

    return createBootstrapNode(peerId, addrs);
  })
  .then(async (libp2p) => {
    await libp2p.start();

    console.log('Node started with addresses:');
    libp2p.transportManager
      .getAddrs()
      .forEach((addr) => console.log(addr.toString()));

    console.log('\n');

    console.log('Node supports protocols:');
    libp2p.upgrader.protocols.forEach((_, protocol) => console.log(protocol));
  });

const createBootstrapNode = (peerId, listenAddrs) => {
  return Libp2p.create({
    peerId,
    addresses: {
      listen: listenAddrs,
    },
    modules: {
      transport: [WebrtcStar, TCP, Websockets],
      streamMuxer: [Mplex],
      connEncryption: [NOISE, Secio],
      peerDiscovery: [MDNS],
      dht: KademliaDHT,
      pubsub: Gossipsub,
    },
    config: {
      transport: {
        [WebrtcStar.prototype[Symbol.toStringTag]]: {
          wrtc,
        },
      },
      relay: {
        enabled: true,
        hop: {
          enabled: true,
          active: false,
        },
      },
      dht: {
        enabled: true,
        randomWalk: {
          enabled: true,
        },
      },
    },
  });
};

'use strict';

// Libp2p Core
const Libp2p = require('libp2p');

// Transports
const TCP = require('libp2p-tcp');
const Websockets = require('libp2p-websockets');
const WebrtcStar = require('libp2p-webrtc-star');

// wrtc for node to supplement WebrtcStar
const wrtc = require('wrtc');

// Signaling Server for webrtc
// const SignalingServer = require('libp2p-webrtc-star/src/sig-server');    // uncomment if hosting Local SS

// Stream Multiplexers
const Mplex = require('libp2p-mplex');

// Encryption
const { NOISE } = require('libp2p-noise');
const Secio = require('libp2p-secio');

// Discovery
const MDNS = require('libp2p-mdns');

// DHT
const KademliaDHT = require('libp2p-kad-dht');

// PubSub
const Gossipsub = require('libp2p-gossipsub');

const PeerId = require('peer-id');
const idJSON = require('../id.json');
const GraffitiGossip = require('./graffiti-gossip-protocol');

// const { SIGNALING_SERVER_PORT = 15555, TCP_PORT = 63785, WS_PORT = 63786 } = process.env;    // Local SS
const { TCP_PORT = 63785, WS_PORT = 63786 } = process.env; // Hosted SS

(async () => {
  const peerId = await PeerId.createFromJSON(idJSON);

  // Wildcard listen on TCP and Websocket
  const addrs = [`/ip4/0.0.0.0/tcp/${TCP_PORT}`, `/ip4/0.0.0.0/tcp/${WS_PORT}/ws`];

  // const signalingServer = await SignalingServer.start({ port: SIGNALING_SERVER_PORT });    // uncomment if hosting Local SS

  // const ssAddr = `/ip4/${signalingServer.info.host}/tcp/${signalingServer.info.port}/ws/p2p-webrtc-star`;    // Local SS
  const ssAddr = `/dns4/wrtc-star1.par.dwebops.pub/tcp/443/wss/p2p-webrtc-star`; // Hosted SS

  // console.info(`Signaling server running at ${ssAddr}`);    // uncomment if hosting Local SS
  addrs.push(`${ssAddr}/p2p/${peerId.toB58String()}`);

  // Create the node
  const libp2p = await createBootstrapNode(peerId, addrs);

  // Start the node
  await libp2p.start();
  console.log('Node started with addresses:');
  libp2p.transportManager.getAddrs().forEach(ma => console.log(ma.toString()));
  console.log('\nNode supports protocols:');
  libp2p.upgrader.protocols.forEach((_, p) => console.log(p));

  // Create the Pubsub based graffiti gossip extension
  const graffitiGossip = new GraffitiGossip(libp2p, GraffitiGossip.TOPIC, ({ from, message }) => {
    const fromMe = from === libp2p.peerId.toB58String();
    let user = from.substring(0, 6);

    if (graffitiGossip.userHandles.has(from)) {
      user = graffitiGossip.userHandles.get(from);
    }

    console.info(
      `${fromMe ? GraffitiGossip.CLEARLINE : ''}${user}(${new Date(message.created).toLocaleTimeString()}) (${message.id}): ${
        message.data
      }`,
    );
  });

  // Set up our input handler
  process.stdin.on('data', async message => {
    // Remove trailing newline
    message = message.slice(0, -1);
    // If there was a command, exit early
    if (graffitiGossip.checkCommand(message)) return;

    try {
      // Publish the message
      await graffitiGossip.sendPath(message);
    } catch (err) {
      console.error('Could not publish message', err);
    }
  });
})();

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

const stop = () => {
  console.log('Received signal to shut down...');
  process.exit(0);
};

process.on('SIGINT', stop);
process.on('SIGTERM', stop);

'use strict';

const SignalingServer = require('libp2p-webrtc-star/src/sig-server');

module.exports = (port) =>
  SignalingServer.start({ port }).then(
    (server) =>
      `/ip4/${server.info.host}/tcp/${server.info.port}/ws/p2p-webrtc-star`,
  );

'use strict';

const pipe = require('it-pipe');

const dataStore = require('./data-store');
const { Request } = require('./proto');

const onMessageGeneratorWith = source =>
  (async function* () {
    for await (const message of source) {
      const svgPaths = [];
    }
  })();

module.exports = {
  get protocol() {
    return '/libp2p/grifiti/1.0.0';
  },

  handle({ connection, stream }) {
    //TODO
    // return pipe(stream, onMessageGeneratorWith).catch(console.error);
  },

  send({ message, stream }) {
    //TODO
  },
};

'use strict';

import { Request } from './proto';

const pipe = require('it-pipe');
const dataStore = require('./data-store');

const onSyncReqGeneratorWith = source =>
  (async function* () {
    for await (const { data } of source) {
      const { type } = Request.decode(data);

      if (type !== Request.Type.SYNC) return;

      const raws = await dataStore.all().then(messages => messages.map(message => Request.encode(message)));
      for (const raw of raws) yield raw;
    }
  })();

export default {
  get protocol() {
    return '/graffiti/direct/1.0.0';
  },

  handle({ connection, stream }) {
    const peerShortId = connection.remotePeer.toB58String().slice(0, 8);
    console.info(`Received direct message from peer ${peerShortId}`);

    return pipe(stream, onSyncReqGeneratorWith, stream).catch(console.error);
  },

  send({ message, stream, cb }) {
    const raw = Request.encode(message);

    return pipe([raw], stream, async source => {
      for await (const { data } of source) {
        cb(Request.decode(data));
      }
    }).catch(console.error);
  },
};

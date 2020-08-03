'use strict';

import pipe from 'it-pipe';

import { Request } from './proto';
import Message from './message';
import dataStore from './data-store';

const onSyncReqGeneratorWith = connection => source =>
  (async function* () {
    const peerShortId = connection.remotePeer.toB58String().slice(0, 8);

    for await (const message of source) {
      console.log('forawait -> message', message);
      console.info(`Received direct message from peer ${peerShortId}`);

      const { data } = message;
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
    return pipe(stream, onSyncReqGeneratorWith(connection), stream).catch(console.error);
  },

  sendSync({ stream, cb }) {
    const { payload } = new Message(Request.Type.SYNC);
    const raw = Request.encode(payload);

    return pipe([raw], stream, async source => {
      for await (const { data } of source) {
        cb(Request.decode(data));
      }
    }).catch(console.error);
  },
};

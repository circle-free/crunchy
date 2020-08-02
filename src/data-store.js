const { MemoryDatastore } = require('interface-datastore');
const { Adapter } = require('interface-datastore');
const localforage = require('localforage');

class LocalForageDatastore extends Adapter {
  constructor() {
    super();

    this.store = localforage.createInstance({
      name: 'messageStore',
    });
  }

  open() {
    return;
  }

  close() {
    return;
  }

  async put(key, val) {
    return this.store.setItem(key.toString(), val);
  }

  async get(key) {
    return this.store.getItem(key.toString());
  }

  async has(key) {
    return this.store.getItem(key.toString()).then(Boolean);
  }

  async delete(key) {
    return this.store.removeItem(key.toString());
  }

  async _all() {
    return this.store.keys().then(keys => Promise.all(keys.map(key => this.get(key))));
  }
}

module.exports = LocalForageDatastore;

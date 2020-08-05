const { Adapter } = require('interface-datastore');
const localforage = require('localforage');

class LocalForageDatastore extends Adapter {
  constructor(name) {
    super();

    this.store = localforage.createInstance({ name });
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

  async all() {
    const keys = await this.store.keys();
    const values = await Promise.all(keys.map(async key => this.get(key)));
    return keys.map((key, i) => ({ key, value: values[i] }));
  }

  async keys() {
    return this.store.keys();
  }
}

export default LocalForageDatastore;

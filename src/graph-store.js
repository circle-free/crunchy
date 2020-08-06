const { Adapter } = require('interface-datastore');

class GraphDatastore extends Adapter {
  constructor(graph) {
    super();

    this.graph = graph;
  }

  open() {
    return;
  }

  close() {
    return;
  }

  async put(key, val) {
    return this.graph.setNode(key, val);
  }

  async get(key) {
    return this.graph.node(key);
  }

  async has(key) {
    return this.graph.hasNode(key);
  }

  async delete(key) {
    return this.graph.removeNode(key);
  }

  async all() {
    const keys = this.graph.nodes();
    return keys.map(key => ({ key, value: this.graph.node(key) }));
  }

  async keys() {
    return this.graph.nodes();
  }
}

export default GraphDatastore;

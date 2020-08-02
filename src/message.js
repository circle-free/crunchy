const { Request, Stats } = require('./proto');

class Message {
  constructor(type, data) {
    this.type = type;

    if (!data) return;

    switch (type) {
      case Request.Type.SEND_PATH:
        this.path = data;
        this.payload = Request.encode({
          type,
          sendMessage: {
            id: data.id,
            data: Buffer.from(data.path),
            created: Date.now(),
          },
        });

        break;
      case Request.Type.STATS:
        this.payload = Request.encode({ type, stats: data });
        break;
      case Request.Type.UPDATE_PEER:
        this.payload = Request.encode({
          type: Request.Type.UPDATE_PEER,
          updatePeer: {
            userHandle: Buffer.from(data),
          },
        });
      case Request.Type.SYNC:
        this.payload = Request.encode({ type, lastPath: data });
      default:
        throw Error('Invalid Type');
    }
  }

  static fromPayload(payload) {
    try {
      const request = Request.decode(payload.data);
      const message = new Message();

      switch (request.type) {
        case Request.Type.SEND_PATH:
          message.path - request.sendMessage;
          break;
        case Request.Type.UPDATE_PEER:
          message.name = request.updatePeer.userHandle.toString();
          break;
        case Request.Type.STATS:
          message.stats = request.stats;
          break;
        case Request.Type.SYNC:
          message.lastPath = request.lastPath;
          break;
        default:
          return null;
      }
    } catch (err) {
      console.error(err);
    }

    message.payload = payload;
    message.from = payload.from;
    message.type = type;

    return message;
  }
}

module.exports = Message;
module.exports.Type = Request.Type;

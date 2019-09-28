"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const Base58 = __importStar(require("bs58"));
const Misc_1 = require("./Misc");
const NetworkPeer_1 = __importStar(require("./NetworkPeer"));
const MapSet_1 = __importDefault(require("./MapSet"));
const Queue_1 = __importDefault(require("./Queue"));
class Network {
    constructor(selfId) {
        this.onDiscovery = (peerInfo) => __awaiter(this, void 0, void 0, function* () {
            const discoveryId = Misc_1.encodeDiscoveryId(peerInfo.topic);
            // We want hyperswarm to dedupe without including the topic,
            // so we delete it here:
            delete peerInfo.topic;
            const host = createHost(peerInfo);
            this.hosts.add(host, discoveryId);
            const peer = this.peersByHost.get(host);
            if (peer && peer.connection) {
                peer.connection.addDiscoveryId(discoveryId);
            }
        });
        this.onConnection = (socket, details) => __awaiter(this, void 0, void 0, function* () {
            const conn = yield NetworkPeer_1.PeerConnection.fromSocket(socket, this.selfId, details);
            const peer = this.getOrCreatePeer(conn.peerId);
            const host = details.peer ? createHost(details.peer) : null;
            if (host)
                this.peersByHost.set(host, peer);
            if (peer.addConnection(conn)) {
                if (host)
                    conn.addDiscoveryIds(this.hosts.get(host));
                conn.messages.subscribe(this.inboxQ.push);
                conn.discoveryQ.subscribe((discoveryId) => {
                    this.join(discoveryId);
                    this.peerDiscoveryIds.add(discoveryId, peer.id);
                    this.discoveryQ.push({
                        discoveryId,
                        connection: conn,
                        peer,
                    });
                });
            }
        });
        this.selfId = selfId;
        this.joined = new Set();
        this.pending = new Set();
        this.peers = new Map();
        this.discoveryQ = new Queue_1.default('Network:discoveryQ');
        this.inboxQ = new Queue_1.default('Network:receiveQ');
        this.peerDiscoveryIds = new MapSet_1.default();
        this.hosts = new MapSet_1.default();
        this.peersByHost = new Map();
        this.joinOptions = { announce: true, lookup: true };
    }
    join(discoveryId) {
        if (this.swarm) {
            if (this.joined.has(discoveryId))
                return;
            this.joined.add(discoveryId);
            this.swarm.join(decodeId(discoveryId), this.joinOptions);
            this.pending.delete(discoveryId);
        }
        else {
            this.pending.add(discoveryId);
        }
    }
    leave(discoveryId) {
        this.pending.delete(discoveryId);
        if (!this.joined.has(discoveryId))
            return;
        if (this.swarm)
            this.swarm.leave(decodeId(discoveryId));
        this.joined.delete(discoveryId);
    }
    sendToDiscoveryId(discoveryId, msg) {
        this.peerDiscoveryIds.get(discoveryId).forEach((peerId) => {
            this.sendToPeer(peerId, msg);
        });
    }
    sendToPeer(peerId, msg) {
        const peer = this.peers.get(peerId);
        if (peer && peer.connection) {
            peer.connection.messages.send(msg);
        }
    }
    setSwarm(swarm, joinOptions) {
        if (this.swarm)
            throw new Error('Swarm already exists!');
        if (joinOptions)
            this.joinOptions = joinOptions;
        this.swarm = swarm;
        this.swarm.on('connection', this.onConnection);
        this.swarm.on('peer', this.onDiscovery);
        for (const discoveryId of this.pending) {
            this.join(discoveryId);
        }
    }
    getOrCreatePeer(peerId) {
        return Misc_1.getOrCreate(this.peers, peerId, () => new NetworkPeer_1.default(this.selfId, peerId));
    }
    close() {
        return __awaiter(this, void 0, void 0, function* () {
            this.peers.forEach((peer) => {
                peer.close();
            });
            return new Promise((res) => {
                this.swarm ? this.swarm.destroy(res) : res();
            });
        });
    }
}
exports.default = Network;
function decodeId(id) {
    return Base58.decode(id);
}
function createHost({ host, port }) {
    return `${host}:${port}`;
}
//# sourceMappingURL=Network.js.map
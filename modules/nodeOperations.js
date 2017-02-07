import WebTorrent from 'webtorrent/webtorrent.min'

/*  The things we have to do:
      Connect to the socket server
      Next, wait for a peer to come online
      Once a peer comes online, send them a WebRTC offer
      If we receive an offer, send them an answer and any other signal that is produced
      Once communication is established, we check to see who the peer identifies himself as.
      If the user is in the list of trusted peers, we ask for the pass phrase that was exchanged last time we connected
      If the pass phrase is correct, then mark as trusted
      Otherwise, mark as untrusted and only allow them to see public content
*/

let _channel, _ipAddress, _socket, _identity
let _nodes = new Map()    //  key: socketId; value: { identity, torrents }
let _webTorrentClient = new WebTorrent()

function _triggerAnEventOnTheChannel (eventName, payload) {
  if (_channel && _channel.trigger) {
    _channel.trigger(eventName, payload)
  }
}

//  Socket stuff
function _aSocketDisconnected (data) {
  if (_nodes.has(data.sourceSocketId)) {
    _nodes.delete(data.sourceSocketId)
    _triggerAnEventOnTheChannel('node-operations-nodes-changed')
  }
}

function _aSocketsIdentityChanged (data) {
  if (_nodes.has(data.sourceSocketId)) {
    _nodes.get(data.sourceSocketId).identity.handle = data.newHandle
    _triggerAnEventOnTheChannel('node-operations-nodes-changed')
  }
}

function _aSocketJoinedThisRoom (data) {
  //  Record it's details into our memory
  _nodes.set(data.sourceSocketId, { identity: data.identity, torrents: new Map() })

  //  Send the node this node's handle and icon
  _socket.emit('aSocketSentItsIdentityDetails', { targetSocketId: data.sourceSocketId, identity: _identity })

  //  Trigger an event
  _triggerAnEventOnTheChannel('node-operations-nodes-changed')
}

function _aSocketLeftThisRoom (data) {
  if (_nodes.has(data.sourceSocketId)) {
    _nodes.delete(data.sourceSocketId)
    _triggerAnEventOnTheChannel('node-operations-nodes-changed')
  }
}

function _aSocketSentItsIdentityDetails (data) {
  if (!_nodes.has(data.sourceSocketId)) {
    _nodes.set(data.sourceSocketId, { identity: data.identity, torrents: new Map() })
  } else {
    _nodes.get(data.sourceSocketId).identity = data.identity
  }
  _triggerAnEventOnTheChannel('node-operations-nodes-changed')
}

function _aTransferRequestWasSent (data) {
  if (_nodes.has(data.sourceSocketId)) {
    let node = _nodes.get(data.sourceSocketId)
    if (!node.torrents.has(data.magnetURI)) {
      node.torrents.set(data.magnetURI, { progress: 0 })

      _webTorrentClient.add(data.magnetURI, (torrent) => {
        torrent.on('download', (bytes) => {
          _triggerAnEventOnTheChannel('node-operations-download-progressing', { nodeId: data.sourceSocketId, progress: torrent.progress })
        })

        torrent.on('done', () => {
          _socket.emit('aTransferWasCompleted', { targetSocketId: data.sourceSocketId, magnetURI: data.magnetURI })
          _triggerAnEventOnTheChannel('node-operations-download-progressing', { nodeId: data.sourceSocketId, progress: 1 })

          //  Now, download each of the files to the browser
          torrent.files.forEach((file) => {
            file.getBlobURL((err, url) => {
              if (err) throw err
              var a = document.createElement('a')
              a.download = file.name
              a.href = url
              document.body.appendChild(a)
              a.click()
              document.body.removeChild(a)
            })
          })
        })
      })
    }
  }
}

function _aTransferWasCompleted (data) {
  // _webTorrentClient.remove(data.magnetURI)  //  We remove the torrent so that we are not, even accidentally, sending it to someone else
  // _nodes.get(data.sourceSocketId).torrents.delete(data.magnetURI)
  _triggerAnEventOnTheChannel('node-operations-transfer-completed', { nodeId: data.sourceSocketId })
}

//  Public functions
export function broadcastNewHandle (data) {
  data.ipAddress = _ipAddress
  _socket.emit('aSocketsIdentityChanged', data)
}

export function disconnect () {
  _socket.emit('aSocketLeftThisRoom', { ipAddress: _ipAddress })
}

export function getNodes () {
  //  Return a subset of the details of each node. Not everything needs to be sent to the outside world.
  let nodes = []
  for (let [key, value] of _nodes.entries()) {
    nodes.push({ nodeId: key, identity: value.identity })
  }
  return nodes
}

export function initialise (ipAddress = '', channel, identity = { handle: '', icon: '' }) {
  _channel = channel  //  A way for us to notify the outside world of events
  _identity = identity
  _ipAddress = ipAddress  //  Keep a record of this; we need it whenever we have to address the entire room

  _socket = window.io('http://redd-space-server.herokuapp.com', { reconnection: false })
  // _socket = window.io('http://localhost:5000', { reconnection: false })
  _socket.on('connect', () => {
    _socket.on('aSocketDisconnected', _aSocketDisconnected)
    _socket.on('aSocketsIdentityChanged', _aSocketsIdentityChanged)
    _socket.on('aSocketJoinedThisRoom', _aSocketJoinedThisRoom)
    _socket.on('aSocketLeftThisRoom', _aSocketLeftThisRoom)
    _socket.on('aSocketSentItsIdentityDetails', _aSocketSentItsIdentityDetails)
    _socket.on('aTransferRequestWasSent', _aTransferRequestWasSent)
    _socket.on('aTransferWasCompleted', _aTransferWasCompleted)

    _socket.emit('aSocketJoinedThisRoom', { ipAddress, identity })
  })

  _webTorrentClient = new WebTorrent()
  _webTorrentClient.on('error', (error) => {
    console.log('WebTorrent client had an error: ', error, error.stack)
  })
}

export function transmitFiles (data) {
  //  So, the things we need to do here is to generate a magnet link and send it to the other side
  //  Firstly, check if the file name exists in the list of torrents
  let torrentAlreadyPresent = false
  for (let torrent of _webTorrentClient.torrents) {
    for (let file of data.files) {
      if (torrent.name === file.name) {
        torrentAlreadyPresent = torrent
        break
      }
    }
  }

  if (!torrentAlreadyPresent) {
    _triggerAnEventOnTheChannel('node-operations-transfer-preparing', { nodeId: data.nodeId })
    _webTorrentClient.seed(data.files, (torrent) => {
      //  We've started seeding the files
      //  Once we receive a 'completed' event from the other side, we can remove the torrent
      //  That means that we have to keep track of which torrent has been seeded and remove things when they are done
      torrent.on('error', (error) => { console.log('WebTorrent torrent had an error: ', error) })

      _socket.emit('aTransferRequestWasSent', { targetSocketId: data.nodeId, magnetURI: torrent.magnetURI })
      _triggerAnEventOnTheChannel('node-operations-transfer-started', { nodeId: data.nodeId }) //  This notifies the local node components that the transfer has started
    })
  } else {
    window.alert('That file is either being transferred right now or has been transferred already.')
  }
}

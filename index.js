import 'components/app'
import localforage from 'localforage'
import * as utility from 'modules/utility.js'
import * as nodeOperations from 'modules/nodeOperations.js'
import WebTorrent from 'webtorrent/webtorrent.min'

//  Set up the state of the app and mount the main riot tag with it
let channel = window.riot.observable()
let tags = window.riot.mount('app', { channel, identity: { handle: '', icon: '' }, nodes: [] })
let app = tags[0]

//  Get the handle from the database if it is there
localforage.getItem('identity')
.then((result) => {
  let identity
  if (result) {
    identity = result
  } else {
    identity = {}
    identity.handle = utility.assignARandomHandle()
    identity.icon = utility.assignARandomIcon()
  }
  return identity
})
.then((identity) => {
  //  Now, send it to the components
  let newState = { ...app.opts, identity }
  app.opts = newState
  app.update()
  return identity
})
.then((identity) => {
  localforage.setItem('identity', identity)
})

//  Get the ipAddress
//  Connect to the socket server and start listening
if (WebTorrent.WEBRTC_SUPPORT) {
  utility.getMyIPAddress()
  .then((ipAddress) => {
    return nodeOperations.initialise(ipAddress, channel, app.opts.identity)
  })
} else {
  app.opts.wrongBrowser = true
  app.update()
}

//  Now, catch all the events and do something
channel.on('identity-display-handle-changed', (data) => {
  nodeOperations.broadcastNewHandle(data)
})

channel.on('node-files-selected', (data) => {
  nodeOperations.transmitFiles(data)
})

channel.on('node-operations-nodes-changed', () => {
  app.opts = { ...app.opts, nodes: nodeOperations.getNodes() }
  app.update()
})

window.addEventListener('beforeunload', (e) => {
  nodeOperations.disconnect()
})

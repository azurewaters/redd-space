import 'components/node'

window.riot.tag(
  'nodes',

  `
  <node each="{ _nodes }"
    channel="{ parent.opts.channel }"
    nodeid="{ this.nodeId }"
    identity="{ this.identity }"
    if="{ _nodes && _nodes.length > 0 }"
  ></node>
  `,

  `
  nodes {
    display: flex;
    flex-flow: row wrap;
    justify-content: space-around;
    width: 100%;
  }
  `,

  function (opts) {
    this._nodes = this.opts.nodes

    this.on('update', (e) => {
      this._nodes = this.opts.nodes
    })
  }
)

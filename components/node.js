window.riot.tag(
  'node',

  `<div id="outerCircle">
    <div id="innerCircle" class="{ draggedOver: _draggedOver }" onclick="{ _innerCircleClicked }">
      <img id="icon" src="images/{ opts.identity.icon }"/>
      <div id="handle">{ opts.identity.handle }</div>
      <div id="progress" if="{ (this._progress > 0 && this._progress < 100) }">{ this._progress } % downloaded</div>
      <div id="status" if="{ this._status !== '' }">{ this._status }</div>
      <input id="filesSelector" type="file" onchange="{ _filesSelected }" />
    </div>
  </div>`,

  `node {
    margin: 2rem;
  }

  node.highlighted #innerCircle {
    background-color: #4c6277;
    border: solid 5px #ffffff;
  }

  node.highlighted #innerCircle #handle {
    color: #b0b3b4;
    text-transform: uppercase;
  }

  node.highlighted #outerCircle {
    background-color: rgba(255, 255, 255, 0.2);
    max-height: 500px;
    max-width: 500px;
  }

  node #filesSelector {
    display: none;
  }

  node #handle {
    color: #4d6277;
    font-family: Dosis;
    font-size: 24px;
    font-weight: bold;
    letter-spacing: 2.4px;
    overflow: hidden;
    text-align: center;
    text-transform: uppercase;
  }

  node #icon {
    height: auto%;
    width: 50%;
  }

  node #innerCircle {
    align-items: center;
    background-color: #e6e5e6;
    border: solid 1px #ffffff;
    border-radius: 50%;
    box-shadow: 0 5px 10px 0 rgba(0, 0, 0, 0.5);
    cursor: pointer;
    display: flex;
    flex-direction: column;
    height: 280px;
    justify-content: space-between;
    overflow: hidden;
    padding: 15%;
    width: 280px;
  }

  node #outerCircle {
    align-items: center;
    background-color: rgba(255, 255, 255, 0.1);
    border-radius: 50%;
    display: flex;
    height: 400px;
    justify-content: center;
    width: 400px;
  }

  node #progress, node #status {
    color: #454545;
    font-family: Dosis;
    font-size: 10px;
  }
  `,

  'class="{ highlighted: _beingDraggedOver }"',

  function (opts) {
    this._beingDraggedOver = false
    this._fileBeingTransferred = ''
    this._progress = 0

    this._draggedAndLeft = (e) => {
      e.stopPropagation()
      e.preventDefault()
      this._beingDraggedOver = false
      this.update()
    }

    this._draggedOver = (e) => {
      e.stopPropagation()
      e.preventDefault()
      this._beingDraggedOver = true
      this.update()
    }

    this._dropped = (e) => {
      e.preventDefault()
      if (e.dataTransfer.files.length > 0) {
        //  Trigger an event
        this._letTheOuterWorldKnowFilesHaveBeenSelected(e.dataTransfer.files)
      }
      this._beingDraggedOver = false
      this.update()
    }

    this._filesSelected = (e) => {
      if (e.target.files.length > 0) {
        this._letTheOuterWorldKnowFilesHaveBeenSelected(e.target.files)
      }
    }

    this._innerCircleClicked = () => {
      //  This is where we open up the file selection dialog
      //  Point is, how does it work?
      //  We allow the person to drag files in, and then throw an event
      //  Likewise, we open up the file selection dialog, and then throw an event
      this.root.querySelector('#filesSelector').click()
    }

    this._letTheOuterWorldKnowFilesHaveBeenSelected = (files) => {
      let data = { nodeId: this.opts.nodeid, files }
      opts.channel.trigger('node-files-selected', data)
    }

    this.on('mount', () => {
      this.root.addEventListener('drop', this._dropped)
      this.root.addEventListener('dragover', this._draggedOver)
      this.root.addEventListener('dragleave', this._draggedAndLeft)

      this.opts.channel.on('node-operations-download-progressing', (data) => {
        if (this.opts.nodeid === data.nodeId) {
          let currentProgress = Math.round(data.progress * 100)
          if (this._progress !== currentProgress) {
            this._progress = currentProgress
            this.update()
          }
        }
      })

      this.opts.channel.on('node-operations-transfer-preparing', (data) => {
        if (this.opts.nodeid === data.nodeId) {
          this._status = 'Preparing'
          this.update()
        }
      })

      this.opts.channel.on('node-operations-transfer-started', (data) => {
        if (this.opts.nodeid === data.nodeId) {
          this._status = 'Transferring'
          this.update()
        }
      })

      this.opts.channel.on('node-operations-transfer-completed', (data) => {
        if (this.opts.nodeid === data.nodeId) {
          this._status = 'Transfer completed'
          this.update()
          window.setTimeout(() => {
            //  Clear the status after 5 seconds
            this._status = ''
            this.update()
          }, 5000)
        }
      })
    })
  }
)

import localforage from 'localforage'

window.riot.tag(
  'identityDisplay',

  `
  <label>YOUR HANDLE IS</label>
  <input id="handle" type="text" value="{ opts.identity.handle }" onkeypress="{ _keypressed }"/>
  `,

  `
  identityDisplay {
    align-items: flex-end;
    display: flex;
    flex-direction: column;
  }

  identityDisplay label {
    color: #e6e5e6;
    font-family: Raleway;
    font-size: 8px;
    font-stretch: normal;
    font-style: normal;
    font-weight: bold;
    height: 10px;
    letter-spacing: normal;
    line-height: normal;
    text-align: right;
  }

  identityDisplay #handle {
    background: transparent;
    border: none;
    color: #ffffff;
    font-family: Dosis;
    font-size: 24px;
    font-weight: bold;
    height: 31px;
    letter-spacing: normal;
    line-height: normal;
    text-align: right;
    text-transform: uppercase;
  }

  identityDisplay #handle:hover, identityDisplay #handle:focus {
    background-color: white;
    color: #4d6277;
  }
  `,

  function (opts) {
    this._keypressed = (e) => {
      if (e.key === 'Enter') {
        let handleInput = document.getElementById('handle')
        let newHandle = handleInput.value.toLowerCase()
        if (newHandle !== '') {
          localforage.setItem('identity', { ...this.opts.identity, handle: newHandle })
          handleInput.blur()
          this.opts.channel.trigger('identity-display-handle-changed', { newHandle })
        } else {
          handleInput.value = this.opts.identity.handle
        }
      }
    }
  }
)

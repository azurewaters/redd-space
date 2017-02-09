import 'components/identityDisplay'
import 'components/nodes'

window.riot.tag(
  'app',

  `
  <div id="header">
    <div id="leftBit"><span id="logo">REDD<br>SPACE</span><span id="tagline">FILE TRANSFER. DONE.[BETA]</span></div>
    <identityDisplay channel="{ opts.channel }" identity="{ opts.identity }"></identityDisplay>
  </div>

  <div id="body">
    <nodes channel="{ opts.channel }" nodes="{ opts.nodes }" if="{ opts && opts.nodes && opts.nodes.length > 0 }"></nodes>

    <div class="sign" if="{ (opts && opts.nodes && opts.nodes.length === 0 && !opts.wrongBrowser) }">
      <img class="signImage" src="images/waiting-white.svg">
      <div class="signMessage">WAITING FOR OTHER USERS</div>
    </div>

    <div class="sign" if="{ opts && opts.wrongBrowser }">
      <img class="signImage" src="images/wrong-red.svg">
      <div class="signMessage">INCOMPATIBLE BROWSER</div>
    </div>

  </div>

  <div id="footer">
    <div id="unconnectedMessage" class="messageText" if="{ opts && opts.status === 0 }">YOU CAN TRANSFER FILES AS SOON AS THE OTHER PERSON NAVIGATES TO THIS PAGE</div>
    <div id="transferInstructions" class="messageText" if="{ opts && opts.status === 1 }">BEGIN A TRANSFER BY DRAGGING FILES ONTO THE RECIPIENT OR WAIT FOR THEM TO TRANSFER A FILE TO YOU</div>
    <div id="receivingAFileMessage" class="messageText" if="{ opts && opts.status === 2 }">YOU ARE RECEIVING A FILE. THE FILE WILL BE SAVED TO YOUR BROWSER'S DOWNLOADS FOLDER. LEAVING THIS PAGE WILL TERMINATE THE TRANSFER.</div>
    <div id="sendingAFileMessage" class="messageText" if="{ opts && opts.status === 3 }">LEAVING THIS PAGE WILL TERMINATE THE TRANSFER</div>
    <div id="transferCompleteMessage" class="messageText" if="{ opts && opts.status === 4 }">TRANSFER COMPLETE</div>
    <div id="transferFailedMessage" class="messageText" if="{ opts && opts.status === 5 }">THE TRANSFER TO ONE USER FAILED FOR SOME REASON. GO AHEAD AND GIVE IT ANOTHER SHOT.</div>
    <div id="wrongBrowserMessage" class="messageText" if="{ opts && opts.status === 6 }">FILE TRANSFER REQUIRES TECHNOLOGIES AVAILABLE ON CHROME, FIREFOX OR OPERA.</div>

    <div id="credits"><a href="http://redd.in" target="_blank">DESIGNED BY REDD</a></div>
  </div>
  `,

  `
  app {
    background-color: #fc4349;
    display: block;
    height: 100%;
    min-height: 10rem;
    position: absolute;
    width: 100%;
  }

  app.connected {
    background-color: #8ed3f2;
  }

  app .sign .signMessage {
    color: #ff7a7e;
    font-family: 'Dosis';
    font-size: 24px;
    font-stretch: normal;
    font-style: normal;
    font-weight: bold;
    height: 31px;
    letter-spacing: normal;
    line-height: normal;
    margin-top: 0.625rem;
    text-align: center;
    width: 100%;
  }

  identityDisplay {
    margin-bottom: 0.625rem;
  }

  app .sign {
    align-items: center;
    display: flex;
    flex-direction: column;
    height: 100%;
    justify-content: center;
    width: 100%;
  }

  #body {
    bottom: 24px;
    left: 0;
    overflow: auto;
    position: absolute;
    right: 0;
    top: 72px;
  }

  #footer {
    bottom: 0;
    font-family: "Dosis";
    font-size: 8px;
    font-weight: 600;
    font-style: normal;
    font-stretch: normal;
    line-height: normal;
    letter-spacing: 0.8px;
    position: absolute;
    text-align: center;
    width: 100%;
  }

  #footer #credits {
    align-items: center;
    background-color: #e6e5e6;
    box-shadow: 0 -1px 4px 0 rgba(0, 0, 0, 0.25);
    color: #b0b3b4;
    display: flex;
    flex-direction: column;
    height: 1.5rem;
    justify-content: center;
  }

  #footer #credits a {
    color: #b0b3b4;
    text-decoration: none;
  }

  #footer .messageText {
    align-items: center;
    background-color: #ff7a7e;
    color: #d0021b;
    display: flex;
    flex-direction: column;
    height: 1.5rem;
    justify-content: center;
    text-transform: uppercase;
  }

  #header {
    align-items: flex-end;
    display: flex;
    justify-content: space-between;
    padding: 0.75rem;
    position: absolute;
    top: 0;
    width: 100%;
  }

  #logo {
    color: #ffffff;
    height: 60px;
    font-family: Dosis;
    font-size: 48px;
    font-weight: 300;
    font-style: normal;
    font-stretch: normal;
    line-height: normal;
    letter-spacing: normal;
    text-align: left;
    width: 123px;
  }

  #tagline {
    color: #ffffff;
    height: 11px;
    font-family: Raleway;
    font-size: 10px;
    font-weight: 500;
    font-style: normal;
    font-stretch: normal;
    line-height: normal;
    letter-spacing: 1px;
    padding-left: 0.625rem;
    text-align: left;
    width: 213px;
  }

  #waitingImage {
    height: 240px;
    width: 240px;
  }
  `,

  'class="{ connected : (!opts.wrongBrowser && (opts.nodes && opts.nodes.length > 0)) }"'
  ,

  function (opts) {}
)

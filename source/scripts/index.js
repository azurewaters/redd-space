//  Initialise the application
const mainNode = document.querySelector('main')
const main = window.Elm.Main.init({ node: mainNode })
const firebase = window.firebase

//  Start listening to messages coming from Elm
main.ports.filesChosenToJS.subscribe(transferFiles)

//  Tell Elm whenever the connection state changes
let connectionRef = firebase.database().ref('.info/connected')
connectionRef.on('value', (snapshot) => {
  if (snapshot.val() === true) {
    firebase.auth()
      .signInAnonymously()
      .then(() => {
        setUp()
      })
  } else {
    main.ports.userHasGoneOfflineFromJS.send(true)
  }
})

//  Functions
function getAName () {
  let adjectives = ['adaptable', 'adventurous', 'affectionate', 'ambitious', 'amiable', 'compassionate', 'considerate', 'courageous', 'courteous', 'diligent', 'empathetic', 'exuberant', 'frank', 'generous', 'gregarious', 'impartial', 'intuitive', 'inventive', 'passionate', 'persistent', 'philosophical', 'practical', 'rational', 'reliable', 'resourceful', 'sensible', 'sincere', 'sympathetic', 'unassuming', 'witty']
  let birds = ['albatross', 'avocet', 'budgerigar', 'cassowary', 'chicken', 'crane', 'duck', 'eagle', 'emu', 'falcon', 'flamingo', 'frigatebird', 'goose', 'grouse', 'heron', 'hummingbird', 'ibis', 'kakapo', 'kingfisher', 'kiwi', 'macaw', 'magpie', 'moorhen', 'nightingale', 'ostrich', 'parrot', 'peacock', 'pelican', 'penguin', 'pheasant', 'puffin', 'quail', 'quetzal', 'robin', 'sparrow', 'swan', 'toucan', 'turkey', 'uguisu', 'umbrellabird', 'vulture', 'woodpecker']

  let countOfAdjectives = adjectives.length
  let countOfBirds = birds.length

  let randomAdjectiveIndex = Math.floor(Math.random() * countOfAdjectives)
  let randomBirdIndex = Math.floor(Math.random() * countOfBirds)

  let randomAdjective = adjectives[randomAdjectiveIndex]
  let randomBird = birds[randomBirdIndex]

  return randomAdjective + ' ' + randomBird
}

function getANewAndUniqueUserName (listOfUsersNames) {
  //  This is where we think up a new name for the current user
  let newName = getAName()

  while (listOfUsersNames.indexOf(newName) > -1) {
    newName = getAName()
  }

  return newName
}

function getIPAddress (e) {
  return window.fetch('https://api.ipify.org', { mode: 'cors' })
    .then((response) => {
      return response.text()
    })
}

function getOtherUsersNames (ipAddressWithUnderscoresInsteadOfDots) {
  //  This is where we get the names of the other users under this IP Address
  return firebase
    .database()
    .ref(ipAddressWithUnderscoresInsteadOfDots + '/users')
    .once('value')
    .then((snapshot) => {
      let usersNames = []
      snapshot.forEach((childSnapshot) => {
        usersNames.push(childSnapshot.key)
      })

      return usersNames
    })
    .catch((error) => {
      console.log(error)
    })
}

function newMessageReceived (data) {
  //  We just received a message from someone
  //  Send it to Elm
  //  Delete the message from the database
  let message = data.val()

  //  Now, get the download URL from firebase and then send the rest of the data to Elm
  let instructionToDownloadAFile = {}
  instructionToDownloadAFile.fileName = message.fileName
  instructionToDownloadAFile.from = message.sendersUserId

  //  Now, retrieve the downloadURL
  return firebase
    .storage()
    .ref(message.ipAddress + '/' + message.receiversUserId + '/' + message.sendersUserId + '/' + message.fileName)
    .getDownloadURL()
    .then((downloadURL) => {
      instructionToDownloadAFile.downloadURL = downloadURL
      main.ports.instructionToDownloadAFileReceivedFromJS.send(instructionToDownloadAFile)
      data.ref.remove()
    })
    .catch((error) => {
      console.log(error)
    })
}

function registerTheUser (ipAddressWithUnderscoresInsteadOfDots, newAndUniqueUserName) {
  return firebase.database()
    .ref(ipAddressWithUnderscoresInsteadOfDots + '/users')
    .push({ ipAddress: ipAddressWithUnderscoresInsteadOfDots, name: newAndUniqueUserName })
    .then((u) => {
      return u.key
    })
}

function setUp () {
  //  To begin, we have to get the IP Address
  //    then, get the names of all the other users
  //    think up a name for ourselves that's unique
  //    register ourselves
  //    send the data over to Elm
  getIPAddress()
    .then((ipAddress) => {
      main.ports.ipAddressFromJS.send(ipAddress)

      let ipAddressWithUnderscoresInsteadOfDots = ipAddress.replace(/\./gi, '_')
      getOtherUsersNames(ipAddressWithUnderscoresInsteadOfDots)
        .then((listOfOtherUsersNames) => {
          let newAndUniqueUserName = getANewAndUniqueUserName(listOfOtherUsersNames)
          if (newAndUniqueUserName) {
            registerTheUser(ipAddressWithUnderscoresInsteadOfDots, newAndUniqueUserName)
              .then((userID) => {
                let user =
                  { filesToBeDownloaded: [],
                    id: userID,
                    messageToDisplay: '',
                    name: newAndUniqueUserName
                  }
                main.ports.userFromJS.send(user)

                //  Make sure that the data under this user is deleted when the user disconnects
                firebase.database().ref(ipAddressWithUnderscoresInsteadOfDots + '/users/' + user.id).onDisconnect().remove()
                
                //  Now, make sure that we are updated about any user that comes or goes
                firebase.database().ref(ipAddressWithUnderscoresInsteadOfDots + '/users').on('child_added', userAdded)
                firebase.database().ref(ipAddressWithUnderscoresInsteadOfDots + '/users').on('child_removed', userRemoved)
                firebase.database().ref(ipAddressWithUnderscoresInsteadOfDots + '/messages').orderByChild('receiversUserId').equalTo(user.id).on('child_added', newMessageReceived)
              })
          }
        })
    })
    .catch((error) => {
      console.log('An error occurred: ', error)
    })
}

function transferFiles (detailsOfFilesUploadTransaction) {
  /*  Multiple files have been chosen
      Transfer them to Firebase storage
        Get the files that have been chosen
        Put them in firebase's storage
        Report the progress to the user
      Once the upload has completed, let the other side know what has been uploaded
  */
  const ipAddressWithUnderscoresInsteadOfDots = detailsOfFilesUploadTransaction.ipAddress.replace(/\./gi, '_')
  const correspondingInput = document.getElementById(detailsOfFilesUploadTransaction.inputsId)
  const numberOfFilesToUpload = correspondingInput.files.length
  let overallUploadProgress = []
  for (let fileNumber = 0; fileNumber < numberOfFilesToUpload; fileNumber++) {
    let fileToBeUploaded = correspondingInput.files[fileNumber]

    //  Start the upload
    let storageRef = firebase.storage().ref()
      .child(ipAddressWithUnderscoresInsteadOfDots)
      .child(detailsOfFilesUploadTransaction.receiversUserId)
      .child(detailsOfFilesUploadTransaction.sendersUserId)
      .child(fileToBeUploaded.name)
    let metadata = { contentType: 'application/octet-stream' }
    let uploadTask = storageRef.put(fileToBeUploaded, metadata)

    //  Handle events during the transfer
    uploadTask.on('state_changed', (taskSnapshot) => {
      switch (taskSnapshot.state) {
        case firebase.storage.TaskState.PAUSED:
          //  Let Elm know that the file upload was paused
          break

        case firebase.storage.TaskState.RUNNING:
          //  The upload is proceeding normally
          let progress = (taskSnapshot.bytesTransferred / taskSnapshot.totalBytes) * 100
          overallUploadProgress[fileNumber] = progress
          let dataToBeSentToElm =
            { overallUploadProgress: 100 * overallUploadProgress.reduce((accumulator, currentValue) => { return accumulator + currentValue }) / (numberOfFilesToUpload * 100),
              receiversUserId: detailsOfFilesUploadTransaction.receiversUserId
            }
          main.ports.filesUploadProgressFromJS.send(dataToBeSentToElm)
          break
      }
    },
    (error) => {
      //  Let Elm know that there was an error, depending on what the error was
      //  And, reset the file input
      console.log(error)
    }
    , () => {
      let messageToSend = {
        fileName: fileToBeUploaded.name,
        ipAddress: ipAddressWithUnderscoresInsteadOfDots,
        receiversUserId: detailsOfFilesUploadTransaction.receiversUserId,
        sendersUserId: detailsOfFilesUploadTransaction.sendersUserId,
        text: 'File is ready to be downloaded'
      }
      firebase.database()
        .ref(ipAddressWithUnderscoresInsteadOfDots + '/messages')
        .push(messageToSend)
    })
  }
}

function userAdded (data) {
  //  A user has been added
  //  Let Elm know
  let newUser =
    { filesToBeDownloaded: [],
      id: data.key,
      messageToDisplay: '',
      name: data.val().name
    }

  main.ports.otherUserCameInFromJS.send(newUser)
}

function userRemoved (data) {
  //  A user left
  //  Let Elm know
  main.ports.otherUserLeftFromJS.send(data.key)
}

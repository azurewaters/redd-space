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
    console.log('Came into setup')
    // setUp()
    firebase.auth().signInAnonymously().then((e) => { console.log('signed in', e) })
    setUp()
  } else {
    //  We will have to terminate all incomplete transfers and shut the app down
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

function getANewAndUniqueName (listOfUsersNames) {
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

function getOtherUsersNames (ipAddress) {
  //  This is where we get the names of the other users under this IP Address
  return firebase
    .database()
    .ref(ipAddress.replace(/\./gi, '_') + '/users')
    .once('value')
    .then((snapshot) => {
      let usersNames = []
      snapshot.forEach((childSnapshot) => {
        usersNames.push(childSnapshot.key)
      })

      return usersNames
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
  instructionToDownloadAFile.from = message.sendersUserName

  //  Now, retrieve the downloadURL
  return firebase
    .storage()
    .ref(message.ipAddressWithUnderscoresInsteadOfDots + '/' + message.receiversUserName + '/' + message.sendersUserName + '/' + message.fileName)
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

function registerTheUser (ipAddress, newAndUniqueName) {
  console.log('registerTheUser')
  return firebase.database().ref(ipAddress.replace(/\./gi, '_') + '/users/' + newAndUniqueName).set(true)
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
      getOtherUsersNames(ipAddress)
        .then((listOfOtherUsersNames) => {
          let newAndUniqueUserName = getANewAndUniqueName(listOfOtherUsersNames)
          if (newAndUniqueUserName) {
            registerTheUser(ipAddress, newAndUniqueUserName)
              .then(() => {
                main.ports.userNameFromJS.send(newAndUniqueUserName)

                //  Make sure that the data under this user is deleted when the user disconnects
                let escapedIPAddress = ipAddress.replace(/\./gi, '_')
                firebase.database().ref(escapedIPAddress + '/users/' + newAndUniqueUserName).onDisconnect().remove()
                firebase.database().ref(escapedIPAddress + '/messages/' + newAndUniqueUserName).onDisconnect().remove()

                //  Now, make sure that we are updated about any user that comes or goes
                firebase.database().ref(escapedIPAddress + '/users').on('child_added', userAdded)
                firebase.database().ref(escapedIPAddress + '/users').on('child_removed', userRemoved)
                firebase.database().ref(escapedIPAddress + '/messages/' + newAndUniqueUserName).on('child_added', newMessageReceived)
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
  const correspondingInput = document.getElementById(detailsOfFilesUploadTransaction.inputsId)
  const numberOfFilesToUpload = correspondingInput.files.length
  let overallUploadProgress = []
  for (let fileNumber = 0; fileNumber < numberOfFilesToUpload; fileNumber++) {
    let fileToBeUploaded = correspondingInput.files[fileNumber]

    //  Start the upload
    let storageRef = firebase.storage().ref()
      .child(detailsOfFilesUploadTransaction.ipAddress.replace(/\./gi, '_'))
      .child(detailsOfFilesUploadTransaction.receiversUserName)
      .child(detailsOfFilesUploadTransaction.sendersUserName)
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
              receiversUserName: detailsOfFilesUploadTransaction.receiversUserName
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
        ipAddressWithUnderscoresInsteadOfDots: detailsOfFilesUploadTransaction.ipAddress.replace(/\./gi, '_'),
        receiversUserName: detailsOfFilesUploadTransaction.receiversUserName,
        sendersUserName: detailsOfFilesUploadTransaction.sendersUserName,
        text: 'File is ready to be downloaded'
      }
      firebase.database()
        .ref(detailsOfFilesUploadTransaction.ipAddress.replace(/\./gi, '_') + '/messages/' + detailsOfFilesUploadTransaction.receiversUserName)
        .push(messageToSend)
    })
  }
}

function userAdded (data) {
  //  A user has been added
  //  Let Elm know
  main.ports.otherUserCameInFromJS.send(data.key)
}

function userRemoved (data) {
  //  A user left
  //  Let Elm know
  main.ports.otherUserLeftFromJS.send(data.key)
}

const functions = require('firebase-functions')
const firebase = require('firebase-admin')

firebase.initializeApp(functions.config().firebase)

exports.cleanUpFilesAfterEveryoneExits = functions.database.ref('/{ipAddressWithUnderscoreSeparators}').onDelete((snapshot, eventContext) => {
  //  First check whether there are any users still under this IPAddress' node
  //  If there aren't any, delete all the files in Storage, under the folder with this IP Address
  return firebase
    .database()
    .ref('/' + eventContext.params.ipAddressWithUnderscoreSeparators)
    .once('value', (snapshot) => {
      if (!snapshot.exists()) {
        //  Now that there are no other nodes under the ipAddress node
        //  we can delete the files in storage
        let bucket = firebase.storage().bucket()
        return bucket.deleteFiles({ prefix: eventContext.params.ipAddressWithUnderscoreSeparators })
      } else {
        return false
      }
    }, (error) => {
      console.log('There was an error retrieving the data', error)
    })
})

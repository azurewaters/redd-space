const functions = require('firebase-functions')
const cors = require('cors')({ origin: true }) //  Enable cross origin requests. ONLY FOR TESTING.

exports.getMyIPAddress = functions.https.onRequest((request, response) => {
  return cors(request, response, () => {
    const remoteIPAddress = request.connection.remoteAddress
    response.status(200).send(remoteIPAddress)
  })
})

//	Initialise the application
const main = Elm.Main.init()

//	Subscribe to ports and add event handlers
main.ports.clickThisElement.subscribe(clickThisElement)
main.ports.registerABatchOfFiles.subscribe(registerABatchOfFiles)
main.ports.uploadTheseFiles.subscribe(uploadTheseFiles)

//	Reference for filesChooser
const filesChooser = document.getElementById("filesChooser")
if (filesChooser) {
	filesChooser.addEventListener("change", sendFilesInformationToElm)
}

//	Other variables
let uploadTasks = new Map()

//	Functions
function clickThisElement (idOfElement) {
	let element = document.getElementById(idOfElement)
	if (element) {
		element.click()
	}
}

function getTheCorrespondingFileFromTheFilesChoosersFiles (file) {
	//	Get the file object from the list of files
	for (var i = filesChooser.files.length - 1; i >= 0; i--) {
		let currentFile = filesChooser.files[i]
		if (currentFile.name == file.name && currentFile.size == file.size) { return currentFile }
	}
}

// function getTheFileNameFromTheRefencePath (referencePath) {
// 	//	The referencepath is something like batchId/filename
// 	//	So, we just have to break it up at the "/", and take the latter part
// 	let slashPosition = String.referencepath.indexOf("/")
// 	if (slashPosition > -1) {
// 		let fileName = String.substring(slashPosition + 1)
// 	} else {
// 		return ""
// 	}
// }

function registerABatchOfFiles (listOfFiles) {
	firebase
	.firestore()
	.collection("batchesOfFiles")
	.add({ createdOn: firebase.firestore.FieldValue.serverTimestamp() })	//	Register the batch of files
	.then((documentReference) => {
		
		//	Write the details of the files to the server
		let promisesToAddFileDetailsToFirestore =
			listOfFiles.map((file) => {
				documentReference.collection("files").add({ name: file.name, size: file.size })
			})

		Promise
		.all(promisesToAddFileDetailsToFirestore)
		.then((result) => {
			//	Once the files have been written to the firestore, we have to send the batch id to Elm
			main.ports.batchId.send(documentReference.id)
		})

	})
}

function sendFilesInformationToElm (e) {

	//	Read the files, put their information into an array and send them to Elm
	if (filesChooser && filesChooser.files.length > 0) {

		let filesData = []
		for (var i = filesChooser.files.length - 1; i >= 0; i--) {
			let currentFile = filesChooser.files[i]
			let fileData = { name: currentFile.name, size: currentFile.size }
			filesData.push(fileData)
		}

		if (filesData.length > 0) { main.ports.chosenFiles.send(filesData) }

	}

}

function uploadTaskCompleted () {
	console.log("uploadTaskCompleted")
}

function uploadTaskErrored (error) {
	console.log(error)
}

function uploadTaskStateChanged (snapshot) {

	let progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100
	let name = snapshot.ref.name
	let state = snapshot.state
	
	main.ports.filesUploadStatusChanged.send({ fileName: fileName, uploadProgress: progress, uploadState: state })

}

function uploadTheseFiles (batchId, filesList) {

	filesList.forEach((file) => { uploadThisFile (batchId, file) })

}

function uploadThisFile (batchId, file) {

	let fileObjectToUpload = getTheCorrespondingFileFromTheFilesChoosersFiles(file)
	if (fileObjectToUpload) {

		let metadata = { type: fileObjectToUpload.type }
		let uploadTask = firebase.storage().ref().child(batchId + "/" + file.name).put(file, metadata)
		uploadTask.on(firebase.storage.TaskEvent.STATE_CHANGED, uploadTaskStateChanged, uploadTaskErrored, uploadTaskCompleted)
		
		//	Store this task in the global list
		uploadTasks.set(file.name, uploadTask)

	}

}
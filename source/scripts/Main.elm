port module Main exposing (..)

import Browser
import Html exposing (a, button, div, Html, img, input, main_, section, span, text)
import Html.Attributes exposing (..)
import Html.Events exposing (..)
import Json.Encode exposing (..)
import Json.Decode exposing (Decoder, field, int, map, map3, string)


main =
    Browser.element
        { init = init
        , update = update
        , subscriptions = subscriptions
        , view = view
        }



-- Init


type alias DetailsOfFilesUploadTransaction =
    { inputsId : String
    , ipAddress : String
    , receiversUserName : String
    , sendersUserName : String
    }


type alias FileToBeDownloaded =
    { downloadURL : String
    , fileName : String
    }


type alias FilesUploadProgress =
    { overallUploadProgress : Float
    , receiversUserName : String
    }


type alias InstructionToDownloadAFile =
    { fileToBeDownloaded : FileToBeDownloaded
    , from : String
    }


type alias IPAddress =
    String


type Model
    = Loading
    | Connected IPAddress
    | Ready IPAddress OtherUsers ThisUsersName
    | Disconnected


type alias OtherUsers =
    List User


type alias ThisUsersName =
    String


type alias User =
    { filesToBeDownloaded : List FileToBeDownloaded
    , messageToDisplay : String
    , name : String
    }


init : () -> ( Model, Cmd Msg )
init _ =
    ( Loading, Cmd.none )



-- Update


type Msg
    = AUserCameIn String
    | AUserLeft String
    | FileChosen String
    | FilesUploadProgressReceived FilesUploadProgress
    | IPAddressReceived String
    | NoOp
    | ReceivedADownloadFileInstruction InstructionToDownloadAFile
    | UserHasGoneOffline
    | UsersNameReceived String


update : Msg -> Model -> ( Model, Cmd Msg )
update msg model =
    case msg of
        AUserCameIn userName ->
            let
                newModel =
                    case model of
                        Ready ipAddress otherUsers thisUsersName ->
                            if userName /= thisUsersName then
                                Ready ipAddress (((User [] "" userName) :: otherUsers) |> List.sortBy .name) thisUsersName
                            else
                                model

                        _ ->
                            model
            in
                ( newModel, Cmd.none )

        AUserLeft userName ->
            let
                newModel =
                    case model of
                        Ready ipAddress otherUsers thisUsersName ->
                            Ready ipAddress (List.filter (\user -> user.name /= userName) otherUsers) thisUsersName

                        _ ->
                            model
            in
                ( newModel, Cmd.none )

        FileChosen inputsId ->
            let
                receiversUserName =
                    String.replace "_" " " (String.replace "fileChooser_" "" inputsId)

                commandToInvoke =
                    case model of
                        Ready ipAddress otherUsers thisUsersName ->
                            let
                                detailsOfFilesUploadTransaction : DetailsOfFilesUploadTransaction
                                detailsOfFilesUploadTransaction =
                                    { inputsId = inputsId
                                    , ipAddress = ipAddress
                                    , receiversUserName = receiversUserName
                                    , sendersUserName = thisUsersName
                                    }
                            in
                                filesChosenToJS detailsOfFilesUploadTransaction

                        _ ->
                            Cmd.none
            in
                ( model, commandToInvoke )

        FilesUploadProgressReceived filesUploadProgress ->
            let
                newModel =
                    case model of
                        Ready ipAddress otherUsers thisUsersName ->
                            let
                                updateMessageToDisplayIfUserNamesMatch : User -> User
                                updateMessageToDisplayIfUserNamesMatch user =
                                    if user.name == filesUploadProgress.receiversUserName then
                                        let
                                            newMessageToDisplay =
                                                case (Basics.round filesUploadProgress.overallUploadProgress) of
                                                    100 ->
                                                        "Upload complete"

                                                    _ ->
                                                        (filesUploadProgress.overallUploadProgress |> Basics.round |> String.fromInt) ++ "% uploaded"
                                        in
                                            { user | messageToDisplay = newMessageToDisplay }
                                    else
                                        user

                                newOtherUsers =
                                    List.map updateMessageToDisplayIfUserNamesMatch otherUsers
                            in
                                Ready ipAddress newOtherUsers thisUsersName

                        _ ->
                            model
            in
                ( newModel, Cmd.none )

        IPAddressReceived newIPAddress ->
            ( Connected newIPAddress, Cmd.none )

        NoOp ->
            ( model, Cmd.none )

        ReceivedADownloadFileInstruction receivedMessage ->
            --  Add to the list of files that can be downloaded from a user
            let
                updateUsersFilesToBeDownloadedIfTheUserNameMatches : String -> FileToBeDownloaded -> User -> User
                updateUsersFilesToBeDownloadedIfTheUserNameMatches userNameToMatch fileToBeDownloaded user =
                    if user.name == userNameToMatch then
                        { user | filesToBeDownloaded = fileToBeDownloaded :: user.filesToBeDownloaded }
                    else
                        user

                newModel =
                    case model of
                        Ready ipAddress otherUsers thisUsersName ->
                            let
                                curriedUpdateUsersFilesToBeDownloadedIfTheUserNameMatches =
                                    updateUsersFilesToBeDownloadedIfTheUserNameMatches receivedMessage.from receivedMessage.fileToBeDownloaded

                                updatedOtherUsers =
                                    List.map curriedUpdateUsersFilesToBeDownloadedIfTheUserNameMatches otherUsers
                            in
                                Ready ipAddress updatedOtherUsers thisUsersName

                        _ ->
                            model
            in
                ( newModel, Cmd.none )

        UserHasGoneOffline ->
            ( Disconnected, Cmd.none )

        UsersNameReceived newThisUsersName ->
            let
                newModel =
                    case model of
                        Connected ipAddress ->
                            Ready ipAddress [] newThisUsersName

                        _ ->
                            model
            in
                ( newModel, Cmd.none )


port filesChosenToJS : DetailsOfFilesUploadTransaction -> Cmd msg



-- View


classToApply : Model -> Html.Attribute msg
classToApply model =
    case model of
        Ready _ _ _ ->
            class "readyState"

        _ ->
            class "notReadyState"


view : Model -> Html Msg
view model =
    main_
        [ classToApply model ]
        [ section [ id "header" ] (viewHeader model)
        , section [ id "body" ] [ viewBody model ]
        , section [ id "footer" ] [ a [ href "https://www.redd.in", target "_blank" ] [ text "DESIGNED BY REDD" ] ]
        ]


viewBody : Model -> Html Msg
viewBody model =
    case model of
        Loading ->
            viewSimpleMessage "LOADING..."

        Connected ipAddress ->
            viewSimpleMessage "REGISTERING..."

        Ready ipAddress otherUsers usersName ->
            section
                [ id "readyStateComponentsContainer" ]
                (viewOtherUsers otherUsers)

        Disconnected ->
            viewSimpleMessage "WAITING TO CONNECT TO THE NETWORK..."


viewDownloadableFiles : List FileToBeDownloaded -> List (Html Msg)
viewDownloadableFiles filesToBeDownloaded =
    case filesToBeDownloaded of
        [] ->
            []

        _ ->
            div [ class "titleOfTheSection" ] [ text "The Following Files Were Sent To You" ] :: (List.map viewDownloadableFileLink filesToBeDownloaded)


viewDownloadableFileLink : FileToBeDownloaded -> Html Msg
viewDownloadableFileLink fileToBeDownloaded =
    a
        [ class "downloadableFileLink"
        , download fileToBeDownloaded.fileName
        , href fileToBeDownloaded.downloadURL
        , target "_blank"
        ]
        [ text fileToBeDownloaded.fileName ]


viewHeader model =
    [ div [ id "nameAndBylineContainer" ]
        [ div [ id "productName" ] [ text "REDD SPACE" ]
        , div [ class "label", id "productByline" ] [ text "FILE TRANSFER. DONE. [BETA]" ]
        ]
    , div [ id "usersNameContainer" ] (viewUsersName model)
    ]


viewOtherUser : User -> Html Msg
viewOtherUser user =
    let
        idOfTheInput =
            "fileChooser_" ++ (String.replace " " "_" user.name)
    in
        div [ class "otherUser", id user.name ]
            [ div
                [ class "innerBox" ]
                [ div
                    [ class "otherUsersName" ]
                    [ text (String.toUpper user.name) ]
                , div
                    [ class "chooseFilesButton" ]
                    [ input
                        [ class "fileChooser"
                        , id idOfTheInput
                        , multiple True
                        , onFilesChosen FileChosen
                        , type_ "file"
                        ]
                        []
                    , text "Send files"
                    ]
                , div [ class "message" ] [ text user.messageToDisplay ]
                , section
                    [ class "listOfDownloadableFiles" ]
                    (viewDownloadableFiles user.filesToBeDownloaded)
                ]
            ]


viewOtherUsers : List User -> List (Html Msg)
viewOtherUsers otherUsers =
    if List.isEmpty otherUsers then
        [ div
            [ id "waitingMessage" ]
            [ img [ src "images/waiting-white.svg" ] []
            , text "WAITING FOR OTHER USERS TO JOIN"
            ]
        ]
    else
        List.map viewOtherUser otherUsers


viewSimpleMessage : String -> Html Msg
viewSimpleMessage messageToDisplay =
    section
        [ id "notReadyStateComponentsContainer" ]
        [ text messageToDisplay ]


viewUsersName : Model -> List (Html Msg)
viewUsersName model =
    case model of
        Ready ipAddress otherUsers thisUsersName ->
            [ div [ class "label", id "usersNameLabel" ] [ text "YOUR HANDLE IS" ]
            , div [ id "usersName" ] [ text (String.toUpper thisUsersName) ]
            ]

        _ ->
            []



-- Subscriptions


decodeFilesUploadProgress : Json.Decode.Value -> Msg
decodeFilesUploadProgress receivedValue =
    let
        resultOfDecoding =
            Json.Decode.decodeValue filesUploadProgressDecoder receivedValue
    in
        case resultOfDecoding of
            Ok filesUploadProgress ->
                FilesUploadProgressReceived filesUploadProgress

            Err error ->
                NoOp


decodeInstructionToDownloadAFile : Json.Decode.Value -> Msg
decodeInstructionToDownloadAFile receivedValue =
    let
        resultOfDecoding =
            Json.Decode.decodeValue instructionToDownloadAFileDecoder receivedValue
    in
        case resultOfDecoding of
            Ok message ->
                ReceivedADownloadFileInstruction message

            Err error ->
                NoOp


decodeIPAddress : Json.Decode.Value -> Msg
decodeIPAddress receivedValue =
    let
        resultOfDecoding =
            Json.Decode.decodeValue string receivedValue
    in
        case resultOfDecoding of
            Ok newIPAddress ->
                IPAddressReceived newIPAddress

            Err error ->
                NoOp


decodeNameOfOtherUserWhoCameInOrLeft : (String -> Msg) -> Json.Decode.Value -> Msg
decodeNameOfOtherUserWhoCameInOrLeft msg receivedValue =
    let
        resultOfDecoding =
            Json.Decode.decodeValue Json.Decode.string receivedValue
    in
        case resultOfDecoding of
            Ok nameOfOtherUser ->
                msg nameOfOtherUser

            Err error ->
                NoOp


decodeNameOfOtherUserWhoCameIn : Json.Decode.Value -> Msg
decodeNameOfOtherUserWhoCameIn receivedValue =
    decodeNameOfOtherUserWhoCameInOrLeft AUserCameIn receivedValue


decodeNameOfOtherUserWhoLeft : Json.Decode.Value -> Msg
decodeNameOfOtherUserWhoLeft receivedValue =
    decodeNameOfOtherUserWhoCameInOrLeft AUserLeft receivedValue


decodeUserHasGoneOffline : Json.Decode.Value -> Msg
decodeUserHasGoneOffline receivedValue =
    let
        resultOfDecoding =
            Json.Decode.decodeValue Json.Decode.bool receivedValue
    in
        case resultOfDecoding of
            Ok offline ->
                if offline then
                    UserHasGoneOffline
                else
                    NoOp

            Err error ->
                NoOp


decodeUserNameFromJS : Json.Decode.Value -> Msg
decodeUserNameFromJS receivedValue =
    let
        resultOfDecoding =
            Json.Decode.decodeValue Json.Decode.string receivedValue
    in
        case resultOfDecoding of
            Ok newUsersName ->
                UsersNameReceived newUsersName

            Err error ->
                NoOp


port filesUploadProgressFromJS : (Json.Decode.Value -> msg) -> Sub msg


port ipAddressFromJS : (Json.Decode.Value -> msg) -> Sub msg


port instructionToDownloadAFileReceivedFromJS : (Json.Decode.Value -> msg) -> Sub msg


port otherUserCameInFromJS : (Json.Decode.Value -> msg) -> Sub msg


port otherUserLeftFromJS : (Json.Decode.Value -> msg) -> Sub msg


port userHasGoneOfflineFromJS : (Json.Decode.Value -> msg) -> Sub msg


port userNameFromJS : (Json.Decode.Value -> msg) -> Sub msg


subscriptions : Model -> Sub Msg
subscriptions model =
    Sub.batch
        [ filesUploadProgressFromJS decodeFilesUploadProgress
        , instructionToDownloadAFileReceivedFromJS decodeInstructionToDownloadAFile
        , ipAddressFromJS decodeIPAddress
        , otherUserCameInFromJS decodeNameOfOtherUserWhoCameIn
        , otherUserLeftFromJS decodeNameOfOtherUserWhoLeft
        , userHasGoneOfflineFromJS decodeUserHasGoneOffline
        , userNameFromJS decodeUserNameFromJS
        ]



-- Custom events


onFilesChosen : (String -> msg) -> Html.Attribute msg
onFilesChosen message =
    Html.Events.on "change" (Json.Decode.map message inputsTargetIdDecoder)



-- Decoders


downloadURLDecoder : Decoder String
downloadURLDecoder =
    Json.Decode.field "downloadURL" Json.Decode.string


fileNameDecoder : Decoder String
fileNameDecoder =
    Json.Decode.field "fileName" Json.Decode.string


fileToBeDownloadedDecoder : Decoder FileToBeDownloaded
fileToBeDownloadedDecoder =
    Json.Decode.map2 FileToBeDownloaded downloadURLDecoder fileNameDecoder


filesUploadProgressDecoder : Decoder FilesUploadProgress
filesUploadProgressDecoder =
    Json.Decode.map2 FilesUploadProgress overallUploadProgressDecoder receiversUserNameDecoder


fromDecoder : Decoder String
fromDecoder =
    Json.Decode.field "from" Json.Decode.string


inputsTargetIdDecoder : Decoder String
inputsTargetIdDecoder =
    Json.Decode.field "target" (Json.Decode.field "id" Json.Decode.string)


instructionToDownloadAFileDecoder : Decoder InstructionToDownloadAFile
instructionToDownloadAFileDecoder =
    Json.Decode.map2 InstructionToDownloadAFile fileToBeDownloadedDecoder fromDecoder


overallUploadProgressDecoder : Decoder Float
overallUploadProgressDecoder =
    Json.Decode.field "overallUploadProgress" Json.Decode.float


receiversUserNameDecoder : Decoder String
receiversUserNameDecoder =
    Json.Decode.field "receiversUserName" Json.Decode.string


totalBytesTransferredDecoder : Decoder Int
totalBytesTransferredDecoder =
    Json.Decode.field "totalBytesTransferred" Json.Decode.int


totalBytesDecoder : Decoder Int
totalBytesDecoder =
    Json.Decode.field "totalBytes" Json.Decode.int


userNameDecoder : Decoder String
userNameDecoder =
    Json.Decode.string


usersNamesDecoder : Decoder (List String)
usersNamesDecoder =
    Json.Decode.list userNameDecoder

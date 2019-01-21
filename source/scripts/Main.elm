port module Main exposing (..)

import Browser
import Debug exposing (..)
import Html exposing (a, button, div, Html, input, main_, section, span, text)
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


type alias FileReadyToBeDownloaded =
    { downloadURL : String
    , fileName : String
    }


type alias IPAddress =
    String


type alias MessageReceivedFromAnotherPerson =
    { fileReadyToBeDownloaded : FileReadyToBeDownloaded
    , from : String
    , text : String
    }


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
    { filesReadyToBeDownloaded : List FileReadyToBeDownloaded
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
    | IPAddressReceived String
    | NoOp
    | ReceivedADownloadFileInstruction MessageReceivedFromAnotherPerson
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
                                Ready ipAddress (((User [] userName) :: otherUsers) |> List.sortBy .name) thisUsersName
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

        IPAddressReceived newIPAddress ->
            ( Connected newIPAddress, Cmd.none )

        NoOp ->
            ( model, Cmd.none )

        ReceivedADownloadFileInstruction receivedMessage ->
            --  Add to the list of files that can be downloaded from a user
            let
                updateUsersFilesToBeDownloadedIfTheUserNameMatches : String -> FileReadyToBeDownloaded -> User -> User
                updateUsersFilesToBeDownloadedIfTheUserNameMatches userNameToMatch fileReadyToBeDownloaded user =
                    if user.name == userNameToMatch then
                        { user | filesReadyToBeDownloaded = fileReadyToBeDownloaded :: user.filesReadyToBeDownloaded }
                    else
                        user

                modelToUpdateTo =
                    case model of
                        Ready ipAddress otherUsers thisUsersName ->
                            let
                                curriedUpdateUsersFilesToBeDownloadedIfTheUserNameMatches =
                                    updateUsersFilesToBeDownloadedIfTheUserNameMatches receivedMessage.from receivedMessage.fileReadyToBeDownloaded

                                updatedOtherUsers =
                                    List.map curriedUpdateUsersFilesToBeDownloadedIfTheUserNameMatches otherUsers
                            in
                                Ready ipAddress updatedOtherUsers thisUsersName

                        _ ->
                            model
            in
                ( modelToUpdateTo, Cmd.none )

        UserHasGoneOffline ->
            let
                newModel =
                    Disconnected
            in
                ( newModel, Cmd.none )

        UsersNameReceived newThisUsersName ->
            let
                modelToUpdateTo =
                    case model of
                        Connected ipAddress ->
                            Ready ipAddress [] newThisUsersName

                        _ ->
                            model
            in
                ( modelToUpdateTo, Cmd.none )


port filesChosenToJS : DetailsOfFilesUploadTransaction -> Cmd msg



-- View


view : Model -> Html Msg
view model =
    case model of
        Loading ->
            section [] [ text "Loading" ]

        Connected ipAddress ->
            section [] [ text ("Connected to " ++ ipAddress) ]

        Ready ipAddress otherUsers usersName ->
            section []
                [ viewUser usersName
                , section [ id "otherUsers" ] (viewOtherUsers otherUsers)
                ]

        Disconnected ->
            section [] [ text "You are not online!" ]


viewDownloadableFiles : List FileReadyToBeDownloaded -> List (Html Msg)
viewDownloadableFiles filesReadyToBeDownloaded =
    List.map viewDownloadableFileLink filesReadyToBeDownloaded


viewDownloadableFileLink : FileReadyToBeDownloaded -> Html Msg
viewDownloadableFileLink fileReadyToBeDownloaded =
    a [ download fileReadyToBeDownloaded.fileName, href fileReadyToBeDownloaded.downloadURL, target "_blank" ] [ text fileReadyToBeDownloaded.fileName ]


viewOtherUser : User -> Html Msg
viewOtherUser user =
    let
        idOfTheInput =
            "fileChooser_" ++ (String.replace " " "_" user.name)
    in
        div [ id user.name ]
            [ text user.name
            , input
                [ id idOfTheInput
                , multiple True
                , onFileSelected FileChosen
                , type_ "file"
                ]
                [ text "Choose a file to send" ]
            , section [] (viewDownloadableFiles user.filesReadyToBeDownloaded)
            ]


viewOtherUsers : List User -> List (Html Msg)
viewOtherUsers otherUsers =
    if List.isEmpty otherUsers then
        [ div [] [ text "Nobody else is here" ] ]
    else
        List.map viewOtherUser otherUsers


viewTitle : String -> Html Msg
viewTitle thisUsersName =
    section
        [ id "pageTitleContainer" ]
        [ section [ class "productName" ] [ text "REDD SPACE" ]
        , section [ class "productByline" ] [ text "File Transfer. Done. [BETA]" ]
        , section
            [ id "usersNameContainer" ]
            [ section [] [ text "Your handle is" ]
            , section [] [ text thisUsersName ]
            ]
        ]



-- Subscriptions


decodeIPAddressFromJS : Value -> Msg
decodeIPAddressFromJS receivedValue =
    let
        resultsOfDecoding =
            Json.Decode.decodeValue string receivedValue
    in
        case resultsOfDecoding of
            Ok newIPAddress ->
                IPAddressReceived newIPAddress

            Err error ->
                Debug.log (Json.Decode.errorToString error) NoOp


decodeMessageReceivedFromAnotherPerson : Json.Decode.Value -> Msg
decodeMessageReceivedFromAnotherPerson receivedValue =
    let
        resultsOfDecoding =
            Json.Decode.decodeValue messageReceivedFromAnotherPersonDecoder receivedValue
    in
        case resultsOfDecoding of
            Ok message ->
                ReceivedADownloadFileInstruction message

            Err error ->
                Debug.log (Json.Decode.errorToString error) NoOp


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
                Debug.log (Json.Decode.errorToString error) NoOp


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
                    Debug.log "User has gone offline, but we received a False value" NoOp

            Err error ->
                Debug.log (Json.Decode.errorToString error) NoOp


decodeUserNameFromJS : Json.Decode.Value -> Msg
decodeUserNameFromJS receivedValue =
    let
        resultsOfDecoding =
            Json.Decode.decodeValue Json.Decode.string receivedValue
    in
        case resultsOfDecoding of
            Ok newUsersName ->
                UsersNameReceived newUsersName

            Err error ->
                Debug.log (Json.Decode.errorToString error) NoOp


port ipAddressFromJS : (Json.Decode.Value -> msg) -> Sub msg


port messageReceivedFromAnotherPersonFromJS : (Json.Decode.Value -> msg) -> Sub msg


port otherUserCameInFromJS : (Json.Decode.Value -> msg) -> Sub msg


port otherUserLeftFromJS : (Json.Decode.Value -> msg) -> Sub msg


port userHasGoneOffline : (Json.Decode.Value -> msg) -> Sub msg


port userNameFromJS : (Json.Decode.Value -> msg) -> Sub msg


subscriptions : Model -> Sub Msg
subscriptions model =
    Sub.batch
        [ ipAddressFromJS decodeIPAddressFromJS
        , messageReceivedFromAnotherPersonFromJS decodeMessageReceivedFromAnotherPerson
        , otherUserCameInFromJS decodeNameOfOtherUserWhoCameIn
        , otherUserLeftFromJS decodeNameOfOtherUserWhoLeft
        , userHasGoneOffline decodeUserHasGoneOffline
        , userNameFromJS decodeUserNameFromJS
        ]



-- Custom events


onFileSelected : (String -> msg) -> Html.Attribute msg
onFileSelected message =
    Html.Events.on "input" (Json.Decode.map message inputsTargetIdDecoder)



-- Decoders


downloadURLDecoder : Decoder String
downloadURLDecoder =
    Json.Decode.field "downloadURL" Json.Decode.string


fileNameDecoder : Decoder String
fileNameDecoder =
    Json.Decode.field "fileName" Json.Decode.string


fileReadyToBeDownloadedDecoder : Decoder FileReadyToBeDownloaded
fileReadyToBeDownloadedDecoder =
    Json.Decode.map2 FileReadyToBeDownloaded downloadURLDecoder fileNameDecoder


fromDecoder : Decoder String
fromDecoder =
    Json.Decode.field "from" Json.Decode.string


inputsTargetIdDecoder : Decoder String
inputsTargetIdDecoder =
    Json.Decode.field "target" (Json.Decode.field "id" Json.Decode.string)


messageReceivedFromAnotherPersonDecoder : Decoder MessageReceivedFromAnotherPerson
messageReceivedFromAnotherPersonDecoder =
    Json.Decode.map3 MessageReceivedFromAnotherPerson fileReadyToBeDownloadedDecoder fromDecoder textDecoder


textDecoder : Decoder String
textDecoder =
    Json.Decode.field "text" Json.Decode.string


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

port module Main exposing (..)

import Browser
import Browser.Navigation
import Html exposing (..)
import Html.Attributes exposing (..)
import Html.Events exposing (onClick, onInput)
import Json.Encode as Encode exposing (Value)
import Json.Decode as Decode exposing (Decoder, Value, field, int, string, map3)
import Url
import Url.Parser exposing (Parser, (</>), int, map, oneOf, parse, s, top, string)


main : Program () Model Msg
main =
    Browser.application
        { init = init
        , view = view
        , update = update
        , subscriptions = subscriptions
        , onUrlChange = UrlChanged
        , onUrlRequest = LinkClicked
        }



-- Model


type UploadState
    = Running
    | Paused
    | Success
    | Cancelled
    | Error


type alias File =
    { name : String
    , size : Int
    , percentageUploaded : Float
    , state : UploadState
    }


type alias FilesUploadStatus =
    { fileName : String
    , uploadProgress : Float
    , uploadState : String
    }


type alias Model =
    { batchId : Maybe String
    , currentPage : Page
    , key : Browser.Navigation.Key
    , listOfFiles : List File
    , textToDisplay : String
    , url : Url.Url
    }


init : () -> Url.Url -> Browser.Navigation.Key -> ( Model, Cmd Msg )
init flags url key =
    ( Model Nothing (getPageToDisplayUsingUrl url) key [] "" url, Cmd.none )



-- Page


type Page
    = Home
    | PageNotFound
    | UploadFiles


getPageToDisplayUsingUrl : Url.Url -> Page
getPageToDisplayUsingUrl url =
    Maybe.withDefault PageNotFound (Url.Parser.parse pathParser url)


pathParser : Parser (Page -> a) a
pathParser =
    oneOf
        [ map Home (s "~charan" </> s "redd-space" </> s "public")
        , map Home top
        ]



-- Update


type Msg
    = ChooseFilesClicked
    | FilesMayHaveBeenChosen (Result Decode.Error (List File))
    | FilesUploadStatusHasChanged (Result Decode.Error FilesUploadStatus)
    | LinkClicked Browser.UrlRequest
    | TheBatchOfFilesMayHaveBeenRegistered (Result Decode.Error String)
    | UrlChanged Url.Url


update : Msg -> Model -> ( Model, Cmd Msg )
update msg model =
    case msg of
        ChooseFilesClicked ->
            ( model, clickThisElement "filesChooser" )

        FilesMayHaveBeenChosen result ->
            case result of
                Err error ->
                    ( { model | textToDisplay = "There was an error choosing the files. Please try again." }, Cmd.none )

                Ok listOfFiles ->
                    ( { model | currentPage = UploadFiles, listOfFiles = listOfFiles }, registerABatchOfFiles listOfFiles )

        FilesUploadStatusHasChanged result ->
            case result of
                Err error ->
                    ( { model | textToDisplay = "There was a problem in interpreting the status of the file's upload" }, Cmd.none )

                Ok filesUploadStatus ->
                    ( model, Cmd.none )

        LinkClicked urlRequest ->
            case urlRequest of
                Browser.Internal url ->
                    ( { model | currentPage = getPageToDisplayUsingUrl url }, Browser.Navigation.pushUrl model.key (Url.toString url) )

                Browser.External href ->
                    ( model, Browser.Navigation.load href )

        TheBatchOfFilesMayHaveBeenRegistered result ->
            case result of
                Err error ->
                    ( { model | textToDisplay = "There was a problem registering the files. Maybe there is no internet connection?" }, Cmd.none )

                Ok id ->
                    ( { model | batchId = Just id }, uploadTheseFiles model.listOfFiles )

        UrlChanged url ->
            ( { model | currentPage = getPageToDisplayUsingUrl url, url = url }, Cmd.none )


port clickThisElement : String -> Cmd msg


port registerABatchOfFiles : List File -> Cmd msg


port uploadTheseFiles : String -> List File -> Cmd msg



-- Subscriptions


decodeBatchId : Decode.Value -> Msg
decodeBatchId value =
    TheBatchOfFilesMayHaveBeenRegistered (Decode.decodeValue Decode.string value)


decodeFile : Decode.Value -> Msg
decodeFile value =
    FilesMayHaveBeenChosen (Decode.decodeValue (Decode.list fileDecoder) value)


decodeFilesUploadStatus : Decode.Value -> Msg
decodeFilesUploadStatus value =
    FilesUploadStatusHasChanged (Decode.decodeValue filesUploadStatusDecoder value)


fileDecoder : Decode.Decoder File
fileDecoder =
    Decode.map2 produceAFileWithZeroProgress nameDecoder sizeDecoder


filesUploadStatusDecoder : Decode.Decoder FilesUploadStatus
filesUploadStatusDecoder =
    Decode.map3 FilesUploadStatus fileNameDecoder uploadProgressDecoder uploadStateDecoder


fileNameDecoder : Decode.Decoder String
fileNameDecoder =
    Decode.field "fileName" Decode.string


nameDecoder : Decode.Decoder String
nameDecoder =
    Decode.field "name" Decode.string


produceAFileWithZeroProgress : String -> Int -> File
produceAFileWithZeroProgress name size =
    File name size 0


sizeDecoder : Decode.Decoder Int
sizeDecoder =
    Decode.field "size" Decode.int


uploadProgressDecoder : Decode.Decoder Float
uploadProgressDecoder =
    Decode.field "uploadProgress" Decode.float


uploadStateDecoder : Decode.Decoder String
uploadStateDecoder =
    Decode.field "uploadState" Decode.string


port batchId : (Json.Encode.Value -> msg) -> Sub msg


port chosenFiles : (Json.Encode.Value -> msg) -> Sub msg


port filesUploadStatusChanged : (Json.Encode.Value -> msg) -> Sub msg


subscriptions : Model -> Sub Msg
subscriptions model =
    Sub.batch
        [ batchId decodeBatchId
        , chosenFiles decodeFile
        , filesUploadStatusChanged decodeFilesUploadStatus
        ]



-- View


getTheRightPage : Model -> Html Msg
getTheRightPage model =
    case model.currentPage of
        Home ->
            viewHome model

        UploadFiles ->
            viewUploadFiles model

        PageNotFound ->
            viewPageNotFound model


view : Model -> Browser.Document Msg
view model =
    { title = "Redd Space"
    , body =
        [ main_ [] [ getTheRightPage model ]
        ]
    }


viewFileListing : File -> Html Msg
viewFileListing file =
    div [] [ span [] [ text file.name ], span [] [ text (String.fromFloat file.percentageUploaded) ] ]


viewHome : Model -> Html Msg
viewHome model =
    section
        []
        [ input [ id "filesChooser", type_ "file", multiple True ] []
        , button [ onClick ChooseFilesClicked ] [ text "Choose Files You Want To Send" ]
        , text model.textToDisplay
        ]


viewUploadFiles model =
    section
        []
        [ div [] [ text ("There are " ++ String.fromInt (List.length model.listOfFiles) ++ " files") ]
        , div [] (List.map viewFileListing model.listOfFiles)
        ]


viewPageNotFound : Model -> Html Msg
viewPageNotFound model =
    section
        []
        [ text "The page you are looking for is not on this site."
        , a [ href "./" ] [ text "home" ]
        ]

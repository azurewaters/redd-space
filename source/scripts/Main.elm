port module Main exposing (..)

import Browser
import Html exposing (a, button, div, Html, input, main_, section, span, text)
import Html.Attributes exposing (..)
import Html.Events exposing (onClick, onInput)
import Http


main : Program (Maybe Model) Model Msg
main =
    Browser.element
        { init = init
        , view = view
        , update = update
        , subscriptions = subscriptions
        }



-- Model


type alias Model =
    { connected : Bool
    , me : Maybe String
    , myPublicIPAddress : Maybe String
    , others : Maybe (List String)
    }


emptyModel : Model
emptyModel =
    { connected = False
    , me = Nothing
    , myPublicIPAddress = Nothing
    , others = Nothing
    }


init : Maybe Model -> ( Model, Cmd Msg )
init maybeModel =
    ( Maybe.withDefault emptyModel maybeModel, getMyPublicIPAddress True )



-- Update


type Msg
    = GotMyPublicIPAddress (Result Http.Error String)


update : Msg -> Model -> ( Model, Cmd Msg )
update msg model =
    case msg of
        NoOp ->
            ( model, Cmd.none )



-- Subscriptions


subscriptions : Model -> Sub Msg
subscriptions model =
    Sub.none



-- View


view : Model -> Html Msg
view model =
    case model.connected of
        True ->
            viewDefault model

        False ->
            viewDisconnected


viewDefault model =
    text "Loading..."


viewDisconnected : Html Msg
viewDisconnected =
    text "You are disconnected!"



-- HTTP


getMyPublicIPAddress : Cmd Msg
getMyPublicIPAddress =
    Http.get
        { url = ""
        , expect = Http.expectString GotMyPublicIPAddress
        }

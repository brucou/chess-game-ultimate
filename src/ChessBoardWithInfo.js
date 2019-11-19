import Chessboard from "chessboardjsx";
import h from "react-hyperscript";
import hyperscript from "hyperscript-helpers";
import { IS_WHITE_TURN } from "./properties"
import { format } from "./helpers"

const { strong, div, figure, figcaption, img, span } = hyperscript(h);

function InfoArea(props) {
  const { status, turn } = props;
  const bgColor = turn === IS_WHITE_TURN ? 'white' : 'black';
  return div(".game-info", [
    div(".turn", [strong("Turn")]),
    div("#player-turn-box", { style: { 'backgroundColor': bgColor } }, []),
    div(".game-status", [status])
  ])
}

function ActionArea(props) {
  const { next } = props;
  return figure({ onClick: ev => next({ UNDO: void 0 }) }, [
    img(".undo", { src: "https://img.icons8.com/carbon-copy/52/000000/undo.png", alt: "undo" }),
    figcaption([
      strong("Undo")
    ])
  ])
}

function ClockArea(props) {
  const { next, gameDuration, isPaused } = props;
  const spanClass = isPaused ? ".blinking" : ".still.clock";
  return span(spanClass, { onClick: _ => {next({ CLOCK_CLICKED: void 0 })} }, format(gameDuration))
}

function ChessBoardWithInfo(props) {
  const { draggable, width, position, boardStyle, squareStyles, onSquareClick, turn, status, undo, next, gameDuration , isPaused } = props;
  const chessBoardProps = { draggable, width, position, boardStyle, squareStyles, onSquareClick, undo };
  const infoAreaProps = { turn, status };
  const actionAreaProps = { next };
  const clockAreaProps = { next, gameDuration, isPaused };

  return div(".game", [
    div(".game-board", [
      h(Chessboard, chessBoardProps)
    ]),
    div(".info", [
      div(".action", [
        h(InfoArea, infoAreaProps),
        h(ActionArea, actionAreaProps)
      ]),
      h(ClockArea, clockAreaProps)
    ])
  ])
}

export default ChessBoardWithInfo



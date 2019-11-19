import { ACTION_IDENTITY, DEEP, historyState, INIT_EVENT, COMMAND_RENDER } from "kingly"
import { memoize, squareStyling } from "./helpers"
import { INITIAL_BLACK_PIECES_POS, INITIAL_WHITE_PIECES_POS, IS_BLACK_TURN, IS_WHITE_TURN } from "./properties"

// State monikers
const WHITE_TURN = "WHITE_TURN";
const BLACK_TURN = "BLACK_TURN";
const WHITE_PLAYS = "WHITE_PLAYS";
const WHITE_PIECE_SELECTED = "WHITE_PIECE_SELECTED";
const BLACK_PLAYS = "BLACK_PLAYS";
const BLACK_PIECE_SELECTED = "BLACK_PIECE_SELECTED";
const GAME_OVER = "GAME_OVER";
const GAME_ON = "GAME_ON";
const UPDATING_CLOCK = "UPDATING_CLOCK";
const PAUSED_CLOCK = "PAUSED";
// State the machine is in before the game starts
// In a real app, the game would start for instance triggered by a url change
const OFF = "OFF";

// Event monikers
const START = "START";
const BOARD_CLICKED = "CLICKED";
const UNDO = "UNDO";
const UNDO_MOVE = "UNDO_MOVE";
const TICK = "TICK";
const CLOCK_CLICKED = "CLOCK_CLICKED";

// Commands
const MOVE_PIECE = "MOVE_PIECE";
const SET_TIMER = "SET_TIMER";
const CANCEL_TIMER = "CANCEL_TIMER";

// State update
// Basically {a, b: {c, d}}, [{b:{e}]} -> {a, b:{e}}
// All Object.assign caveats apply
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/assign
function updateState(extendedState, extendedStateUpdates) {
  const extendedStateCopy = Object.assign({}, extendedState);
  return extendedStateUpdates.reduce((acc, x) => Object.assign(acc, x), extendedStateCopy);
}

// Helpers
const events = [CLOCK_CLICKED, TICK, UNDO, BOARD_CLICKED, START];
const states = {
  [OFF]: "",
  [GAME_ON]: {
    [WHITE_TURN]: {
      [WHITE_PLAYS]: "",
      [WHITE_PIECE_SELECTED]: ""
    },
    [BLACK_TURN]: {
      [BLACK_PLAYS]: "",
      [BLACK_PIECE_SELECTED]: ""
    }
  },
  [UPDATING_CLOCK]: "",
  [PAUSED_CLOCK]: "",
  [GAME_OVER]: "",
};
const initialControlState = OFF;
const initialExtendedState = {
  draggable: false,
  width: 200,
  // Initial positions of the black and white pieces
  position: 'start',
  whitePiecesPos: INITIAL_WHITE_PIECES_POS,
  blackPiecesPos: INITIAL_BLACK_PIECES_POS,
  // square with the currently clicked piece
  pieceSquare: "",
  // Visual clues
  boardStyle: {
    borderRadius: "5px",
    boxShadow: `0 5px 15px rgba(0, 0, 0, 0.5)`
  },
  squareStyles: {},
  status: "",
  turn: IS_WHITE_TURN,
  gameDuration: 0
};
const transitions = [
  { from: OFF, event: START, to: GAME_ON, action: ACTION_IDENTITY },
  { from: GAME_ON, event: INIT_EVENT, to: WHITE_TURN, action: resetAndStartTimer },
  { from: WHITE_TURN, event: INIT_EVENT, to: WHITE_PLAYS, action: displayInitScreen },
  { from: GAME_ON, event: TICK, to: UPDATING_CLOCK, action: updateAndDisplayClock },
  { from: UPDATING_CLOCK, event: void 0, to: historyState(DEEP, GAME_ON), action: ACTION_IDENTITY },
  { from: GAME_ON, event: CLOCK_CLICKED, to: PAUSED_CLOCK, action: pauseClock },
  { from: PAUSED_CLOCK, event: CLOCK_CLICKED, to: historyState(DEEP, GAME_ON), action: resumeClock },
  {
    from: WHITE_PLAYS, event: BOARD_CLICKED, guards: [
      { predicate: isWhitePieceClicked, to: WHITE_PIECE_SELECTED, action: highlightWhiteSelectedPiece }
    ]
  },
  {
    from: WHITE_PIECE_SELECTED, event: BOARD_CLICKED, guards: [
      { predicate: isWhitePieceClicked, to: WHITE_PIECE_SELECTED, action: highlightWhiteSelectedPiece },
      { predicate: isLegalNonWinningWhiteMove, to: BLACK_PLAYS, action: moveWhitePiece },
      { predicate: isLegalWinningWhiteMove, to: GAME_OVER, action: endWhiteGame },
    ]
  },
  {
    from: BLACK_PLAYS, event: BOARD_CLICKED, guards: [
      { predicate: isBlackPieceClicked, to: BLACK_PIECE_SELECTED, action: highlightBlackSelectedPiece }
    ]
  },
  {
    from: BLACK_PIECE_SELECTED, event: BOARD_CLICKED, guards: [
      { predicate: isBlackPieceClicked, to: BLACK_PIECE_SELECTED, action: highlightBlackSelectedPiece },
      { predicate: isLegalNonWinningBlackMove, to: WHITE_PLAYS, action: moveBlackPiece },
      { predicate: isLegalWinningBlackMove, to: GAME_OVER, action: endBlackGame },
    ]
  },
  {
    from: WHITE_TURN, event: UNDO, guards: [
      { predicate: isMoveHistoryNotEmpty, to: BLACK_PLAYS, action: undoMove },
    ]
  },
  {
    from: BLACK_TURN, event: UNDO, guards: [
      { predicate: isMoveHistoryNotEmpty, to: WHITE_PLAYS, action: undoMove },
    ]
  },
];

const gameFsmDef = {
  initialControlState,
  initialExtendedState,
  states,
  events,
  transitions,
  updateState
};

export default gameFsmDef

// Helpers

// Guards
function isWhitePieceClicked(extendedState, eventData) {
  const { whitePiecesPos } = extendedState;
  const square = eventData;

  return whitePiecesPos.indexOf(square) > -1
}

function isBlackPieceClicked(extendedState, eventData) {
  const { blackPiecesPos } = extendedState;
  const square = eventData;

  return blackPiecesPos.indexOf(square) > -1
}

function isLegalNonWinningMove(extendedState, eventData, settings) {
  const { chessEngine } = settings;
  const { pieceSquare } = extendedState;
  const square = eventData;

  const move = chessEngine.move({
    from: pieceSquare,
    to: square,
    promotion: "q" // always promote to a queen for example simplicity
  });
  const isLegalMove = move != null;
  const hasWon = chessEngine.game_over();
  isLegalMove && chessEngine.undo();

  return isLegalMove && !hasWon
}

function isLegalNonWinningWhiteMove(extendedState, eventData, settings) {
  return isLegalNonWinningMove(extendedState, eventData, settings)
}

function isLegalNonWinningBlackMove(extendedState, eventData, settings) {
  return isLegalNonWinningMove(extendedState, eventData, settings)
}

function isLegalWinningMove(extendedState, eventData, settings) {
  const { chessEngine } = settings;
  const { pieceSquare } = extendedState;
  const square = eventData;

  const move = chessEngine.move({
    from: pieceSquare,
    to: square,
    promotion: "q" // always promote to a queen for example simplicity
  });
  const isLegalMove = move != null;
  const hasWon = chessEngine.game_over();
  // undo the effect! We may run this again in the next guard
  // Anyways no effect in guards please!!
  isLegalMove && chessEngine.undo();

  return isLegalMove && hasWon
}

function isLegalWinningWhiteMove(extendedState, eventData, settings) {
  return isLegalWinningMove(extendedState, eventData, settings)
}

function isLegalWinningBlackMove(extendedState, eventData, settings) {
  return isLegalWinningMove(extendedState, eventData, settings)
}

function isMoveHistoryNotEmpty(extendedState, eventData, settings) {
  const { whitePiecesPos } = extendedState;
  const isInitialPosition = INITIAL_WHITE_PIECES_POS.every(pos => whitePiecesPos.indexOf(pos) > -1);

  return !isInitialPosition
}

// Event handlers
const onSquareClickFactory = memoize(function (eventEmitter) {
  return function onSquareClick(square) {
    eventEmitter.next({ [BOARD_CLICKED]: square })
  }
})

// Actions
function displayInitScreen(extendedState, eventData, settings) {
  const { draggable, width, position, boardStyle, squareStyles, turn, status, gameDuration } = extendedState;
  const { eventEmitter } = settings;
  const onSquareClick = onSquareClickFactory(eventEmitter);

  return {
    updates: [],
    outputs: [{
      command: COMMAND_RENDER,
      params: { draggable, width, position, boardStyle, squareStyles, onSquareClick, turn, status, gameDuration }
    }],
  }
}

function highlightWhiteSelectedPiece(extendedState, eventData, settings) {
  const { draggable, width, position, boardStyle, turn, status, } = extendedState;
  const { eventEmitter } = settings;
  const square = eventData;
  const onSquareClick = onSquareClickFactory(eventEmitter);
  const squareStyles = squareStyling({ pieceSquare: square });

  return {
    updates: [
      { squareStyles },
      { pieceSquare: square },
    ],
    outputs: [{
      command: COMMAND_RENDER,
      params: { draggable, width, position, boardStyle, squareStyles, onSquareClick, turn, status, }
    }],
  }
}

function highlightBlackSelectedPiece(extendedState, eventData, settings) {
  return highlightWhiteSelectedPiece(extendedState, eventData, settings)
}

function moveWhitePiece(extendedState, eventData, settings) {
  const { draggable, width, boardStyle, pieceSquare: fromSquare, whitePiecesPos: wPP, blackPiecesPos: bPP, status, } = extendedState;
  const { eventEmitter, chessEngine } = settings;
  const square = eventData;
  const onSquareClick = onSquareClickFactory(eventEmitter);
  const squareStyles = '';
  // remove old white piece position and add new one
  const whitePiecesPos = wPP.filter(x => x !== fromSquare).concat([square]);
  // remove old black piece position if any - case when a white piece gobbles a black one
  const blackPiecesPos = bPP.filter(x => x !== square);

  // Use the chess engine to get the Forsyth–Edwards Notation (`fen`)
  chessEngine.move({ from: fromSquare, to: square, promotion: "q" });
  const position = chessEngine.fen();
  chessEngine.undo();

  // As the move is over, reset the piece
  const pieceSquare = "";
  const turn = IS_BLACK_TURN;

  return {
    updates: [
      { pieceSquare },
      { position },
      { squareStyles },
      { whitePiecesPos },
      { blackPiecesPos },
      { turn },
    ],
    outputs: [
      {
        command: COMMAND_RENDER,
        params: { draggable, width, position, boardStyle, squareStyles, onSquareClick, turn, status, }
      },
      {
        command: MOVE_PIECE,
        params: { from: fromSquare, to: square }
      }
    ]
  }
}

function moveBlackPiece(extendedState, eventData, settings) {
  const { draggable, width, boardStyle, pieceSquare: fromSquare, whitePiecesPos: wPP, blackPiecesPos: bPP, status } = extendedState;
  const { eventEmitter, chessEngine } = settings;
  const square = eventData;
  const onSquareClick = onSquareClickFactory(eventEmitter);
  const squareStyles = '';
  // remove old black piece position and add new one
  const blackPiecesPos = bPP.filter(x => x !== fromSquare).concat([square]);
  // remove old white piece position if any - case when a black piece gobbles a white one
  const whitePiecesPos = wPP.filter(x => x !== square);

  // Use the chess engine to get the Forsyth–Edwards Notation (`fen`)
  chessEngine.move({ from: fromSquare, to: square, promotion: "q" });
  const position = chessEngine.fen();
  chessEngine.undo();

  const pieceSquare = "";
  const turn = IS_WHITE_TURN;

  return {
    updates: [
      { pieceSquare },
      { position },
      { squareStyles },
      { whitePiecesPos },
      { blackPiecesPos },
      { turn: IS_WHITE_TURN },
    ],
    outputs: [
      {
        command: COMMAND_RENDER,
        params: { draggable, width, position, boardStyle, squareStyles, onSquareClick, turn, status }
      },
      {
        command: MOVE_PIECE,
        params: { from: fromSquare, to: square }
      }
    ]
  }
}

function endWhiteGame(extendedState, eventData, settings) {
  const { updates, outputs: o } = moveWhitePiece(extendedState, eventData, settings);
  const { turn } = extendedState;

  const status = turn === IS_WHITE_TURN ? "White wins!" : "Black wins!";
  const renderCommand = o[0];
  const renderParams = renderCommand.params;
  const updatedRenderParams = Object.assign({}, renderParams, { status });
  const updatedOutputs = [{ command: COMMAND_RENDER, params: updatedRenderParams }].concat([o[1]]);

  return {
    updates,
    outputs: updatedOutputs
  }
}

function endBlackGame(extendedState, eventData, settings) {
  const { updates, outputs: o } = moveWhitePiece(extendedState, eventData, settings);
  const { turn } = extendedState;

  const status = turn === IS_WHITE_TURN ? "White wins!" : "Black wins!";

  return {
    updates,
    outputs: Object.assign({}, o, { status })
  }
}

// chessEngine.ascii() output
// 0: "   +------------------------+"
// 1: " 8 | r  n  b  q  k  b  n  r |"
// 2: " 7 | p  p  p  p  p  p  p  p |"
// 3: " 6 | .  .  .  .  .  .  .  . |"
// 4: " 5 | .  .  .  .  .  .  .  . |"
// 5: " 4 | .  .  .  .  .  .  .  . |"
// 6: " 3 | .  .  .  .  .  .  .  . |"
// 7: " 2 | P  P  P  P  P  P  P  P |"
// 8: " 1 | R  N  B  Q  K  B  N  R |"
// 9: "   +------------------------+"
// 10: "     a  b  c  d  e  f  g  h"
// 11: ""
function undoMove(extendedState, eventData, settings) {
  const { eventEmitter, chessEngine } = settings;
  const { draggable, width, boardStyle, turn: oldTurn } = extendedState;
  const squareStyles = '';
  const onSquareClick = onSquareClickFactory(eventEmitter);

  // Get the last move, undo it, get the fen position, redo the move
  // so any effects performed on the chess engine is cancelled

  const { from, to } = chessEngine.undo();
  const position = chessEngine.fen();

  const rowLetters = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  const columnDigits = [8, 7, 6, 5, 4, 3, 2, 1];
  const board = chessEngine.ascii().split('\n').splice(1, 8).map(
    row => row.replace(/\s/g, '').split('').splice(2, 8).join('')
  );
  const { whitePiecesPos, blackPiecesPos } = board.reduce((acc, row, rowIndex) => {
    const { whitePiecesPos, blackPiecesPos } = acc;
    const blackRow = row.split('').map((c, index) => {
      return (c < 'z' && c > 'a')
        ? rowLetters[index] + columnDigits[rowIndex]
        : ''
    });
    const whiteRow = row.split('').map((c, index) => {
      return (c < 'Z' && c > 'A')
        ? rowLetters[index] + columnDigits[rowIndex]
        : ''
    });

    return {
      whitePiecesPos: whitePiecesPos.concat(whiteRow.filter(x => x)),
      blackPiecesPos: blackPiecesPos.concat(blackRow.filter(x => x))
    }
  }, { whitePiecesPos: [], blackPiecesPos: [] });

  chessEngine.move({ from, to });

  const turn = oldTurn === IS_WHITE_TURN ? IS_BLACK_TURN : IS_WHITE_TURN;

  return {
    updates: [
      { whitePiecesPos },
      { blackPiecesPos },
      { position },
      { status: '' },
      { turn }
    ],
    outputs: [{
      command: UNDO_MOVE,
      params: void 0
    },
      {
        command: COMMAND_RENDER,
        params: { draggable, width, position, boardStyle, squareStyles, onSquareClick, turn, status: '', undo: true }
      }
    ]
  }
}

function resetAndStartTimer(extendedState, eventData, settings) {
  return {
    updates: [],
    outputs: [{
      command: SET_TIMER,
      params: 1000
    }]
  }
}

function updateAndDisplayClock(extendedState, eventData, settings) {
  const { gameDuration } = extendedState;

  return {
    updates: [
      { gameDuration: gameDuration + 1 }
    ],
    outputs: [{
      command: COMMAND_RENDER,
      params: { gameDuration: gameDuration + 1 }
    }, {
      command: SET_TIMER,
      params: 1000
    }]
  }
}

function pauseClock(extendedState, eventData, settings) {
  return {
    updates: [],
    outputs: [{
      command: COMMAND_RENDER,
      params: { isPaused: true }
    }, {
      // Concurrency is a bitch. Once we start playing with timers, we have to make sure
      // we de-activate them in a timely manner
      command: CANCEL_TIMER,
      params: void 0
    }]
  }
}

function resumeClock(extendedState, eventData, settings) {
  return {
    updates: [],
    outputs: [{
      command: COMMAND_RENDER,
      params: { isPaused: false }
    }, {
      command: SET_TIMER,
      params: 1000
    }
    ]
  }
}

import { render } from "react-dom";
import h from "react-hyperscript";
import { getEventEmitterAdapter, Machine } from "react-state-driven";
import { createStateMachine, COMMAND_RENDER } from "kingly";
import ChessBoardWithInfo from './ChessBoardWithInfo';
import emitonoff from "emitonoff";
import Chess from "chess.js";
import gameFsmDef from "./fsm";
import "./index.css";

const eventEmitter = getEventEmitterAdapter(emitonoff);
const chessEngine = new Chess();
const gameFsm = createStateMachine(gameFsmDef, {
  debug: { console, checkContracts: null },
  // Injecting necessary dependencies
  eventEmitter,
  chessEngine
});
const merge = (o1, o2) => {return Object.assign({}, o1, o2)}

// Helpers
const timerFactory = () => {
  let timerId = void 0;
  return {
    setTimer: function setTimer(next, delay, effectHandlers) {
      const { setTimer: sT } = effectHandlers;
      timerId = sT(1000, _ => next({ TICK: void 0 }));
    },
    cancelTimer: function cancelTimer(next, delay, effectHandlers) {
      const { cancelTimer: cT } = effectHandlers;
      cT(timerId);
    },
  }
}
const {setTimer, cancelTimer} = timerFactory();

render(
  h(
    Machine, {
      fsm: gameFsm,
      eventHandler: eventEmitter,
      commandHandlers: {
        MOVE_PIECE: function (next, { from, to }, effectHandlers) {
          const { chessEngine } = effectHandlers;
          chessEngine.move({
            from,
            to,
            promotion: "q" // always promote to a queen for example simplicity
          });
        },
        UNDO_MOVE: function (next, _, effectHandlers) {
          const { chessEngine } = effectHandlers;
          chessEngine.undo();
        },
        SET_TIMER: setTimer,
        CANCEL_TIMER: cancelTimer
      },
      effectHandlers: {
        [COMMAND_RENDER]: (machineComponent, renderWith, params, next) => {
          const newProps = merge(machineComponent.state.props, params);
          machineComponent.setState(
            {
              render: h(renderWith, Object.assign({}, newProps, { next }), []),
              props: newProps
            },
          );
        },
        chessEngine,
        setTimer: (d, fn) => setTimeout(fn, d),
        cancelTimer: id => clearTimeout(id)
      },
      renderWith: ChessBoardWithInfo,
      options: { initialEvent: { START: void 0 } }
    },
    []
  ),
  document.getElementById("root")
);

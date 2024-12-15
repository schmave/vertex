import React from "react";
import { createGame } from "./main";
import testPuzzle from "./test.json";
import puzzleDates from "./puzzle-dates.json";

type State = {
  selectedPuzzle?: string;
};

type Props = {
  onHide: () => any;
};

export default class PuzzlePicker extends React.PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      selectedPuzzle: undefined,
    };
  }

  onSelect = async () => {
    if (this.state.selectedPuzzle) {
      let response = await fetch(this.state.selectedPuzzle);
      createGame(await response.json());
    } else {
      createGame(testPuzzle);
    }
    this.props.onHide();
  };

  render() {
    return (
      <div id="overlay">
        <div className="container">
          <span>Vertex Archive</span>
          <select
            name="puzzle"
            id="select"
            onChange={(e) => {
              this.setState({ selectedPuzzle: e.target.value });
            }}
          >
            <option value="">Choose a puzzle</option>
            {puzzleDates.map((date) => {
              const splits = date.split("-");
              return (
                <option value={`/data/${date}.json`}>
                  {splits[0]}: {date}
                </option>
              );
            })}
          </select>
          <button onClick={this.onSelect}>Select</button>
        </div>
      </div>
    );
  }
}

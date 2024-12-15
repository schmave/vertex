import React from "react";
import { createGame } from "./main";
import testPuzzle from "./test.json";
import puzzleDates from "./puzzle-dates.json";
import dayjs, { Dayjs } from "dayjs";

type State = {
  selectedPuzzle?: string;
  chosenYear: number;
};

type Props = {
  onHide: () => any;
};

export default class PuzzlePicker extends React.PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      chosenYear: 2021,
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

  getClosestPuzzle = () => {
    let bestDiff = 10000000000,
      best: Dayjs;

    const target = dayjs().set("year", this.state.chosenYear);

    for (const i in puzzleDates) {
      const thisDate = dayjs(puzzleDates[i]);
      if (thisDate.year() === this.state.chosenYear) {
        const diff = Math.abs(thisDate.diff(target, "day"));
        if (diff < bestDiff) {
          bestDiff = diff;
          best = thisDate;
        }
      }
    }

    return best;
  };

  render() {
    return (
      <div id="overlay">
        <div className="puzzle-picker">
          <span>Vertex Archive</span>
          <div>
            Best puzzle is {this.getClosestPuzzle().format("MMMM D, YYYY")}
          </div>
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

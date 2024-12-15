import React from "react";
import { createGame } from "./main";
import testPuzzle from "./test.json";

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

  fetchPuzzles = async () => {
    const select = document.getElementById("select") as HTMLSelectElement;
    const response = await fetch(
      "https://api.github.com/repos/Q726kbXuN/vertex/git/trees/master?recursive=1"
    ); // THANK YOU
    const data = await response.json();
    const puzzles = data.tree.filter((file: { path: string; url: string }) =>
      file.path.startsWith("data/")
    );
    puzzles.reverse().forEach((puzzle: { path: string; url: string }) => {
      const path = puzzle.path.split("/")[3];
      if (path) {
        const year = parseInt(path.split("-")[0]);
        const option = document.createElement("option");
        option.value = puzzle.url;
        option.innerText = path.split(".")[0];
        select.children[2 * (2024 - year) + 2].append(option);
      }
    });
  };

  onSelect = async () => {
    if (this.state.selectedPuzzle) {
      let response = await fetch(this.state.selectedPuzzle);
      let data = await response.json();
      createGame(JSON.parse(atob(data.content)));
    } else {
      createGame(testPuzzle);
    }
    this.props.onHide();
  };

  componentDidMount(): void {
    this.fetchPuzzles();
  }

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
            <hr />
            <optgroup label="2024"></optgroup>
            <hr />
            <optgroup label="2023"></optgroup>
            <hr />
            <optgroup label="2022"></optgroup>
            <hr />
            <optgroup label="2021"></optgroup>
            <hr />
            <optgroup label="2020"></optgroup>
            <hr />
            <optgroup label="2019"></optgroup>
          </select>
          <button onClick={this.onSelect}>Select</button>
        </div>
      </div>
    );
  }
}

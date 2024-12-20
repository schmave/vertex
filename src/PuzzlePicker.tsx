import React from 'react';
import { createGame } from './main';
import testPuzzle from './test.json';
import puzzleDates from './puzzle-dates.json';
import dayjs, { Dayjs } from 'dayjs';
import './PuzzlePicker.scss';

type State = {
  chosenDate: Dayjs;
  chosenYear: number;
};

type Props = {
  onHide: () => any;
};

const MIN_YEAR = 2019;
const MAX_YEAR = 2024;
const YEAR_KEY = 'picker-year';

export default class PuzzlePicker extends React.PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);

    const yearFromStorage = localStorage.getItem(YEAR_KEY);
    const chosenYear = yearFromStorage
      ? parseInt(yearFromStorage, 10)
      : MIN_YEAR;

    this.state = {
      chosenYear,
      chosenDate: this.getClosestPuzzle(chosenYear),
    };
  }

  onSelect = async () => {
    if (this.state.chosenDate) {
      let response = await fetch(
        `./data/${this.state.chosenDate.format('YYYY-MM-DD')}.json`
      );
      createGame(await response.json());
    } else {
      createGame(testPuzzle);
    }
    try {
      if (window.location.host.indexOf('localhost') === -1) {
        await document.documentElement.requestFullscreen({
          navigationUI: 'hide',
        });
      }
    } catch (e) {
      console.log('Exception from requestFullScreen', e);
    }
    this.props.onHide();
  };

  getClosestPuzzle = (year: number) => {
    let bestDiff = 10000000000,
      best: Dayjs | null = null;

    const startingDate =
      this.state?.chosenDate ||
      dayjs().hour(0).minute(0).second(0).millisecond(0);

    const target = startingDate.year(year);

    for (const i in puzzleDates) {
      const thisDate = dayjs(puzzleDates[i]);
      if (thisDate.year() === target.year()) {
        const diff = Math.abs(thisDate.diff(target, 'day'));
        if (diff < bestDiff) {
          bestDiff = diff;
          best = thisDate;
        }
      }
    }

    return best!;
  };

  adjustYear = (delta: number) => {
    const newYear = this.state.chosenYear + delta;
    if (newYear < MIN_YEAR || newYear > MAX_YEAR) {
      return;
    }
    this.setState({
      chosenYear: newYear,
      chosenDate: this.getClosestPuzzle(newYear),
    });
    localStorage.setItem(YEAR_KEY, newYear.toString());
  };

  adjustDate = (delta: number) => {
    const existingI = puzzleDates.indexOf(
      this.state.chosenDate.format('YYYY-MM-DD')
    );
    const newI = existingI + delta;
    if (newI < 0 || newI >= puzzleDates.length) {
      return;
    }

    this.setState({ chosenDate: dayjs(puzzleDates[newI]) });
  };

  render() {
    const { chosenYear, chosenDate } = this.state;
    return (
      <div id="overlay">
        <div className="puzzle-picker">
          <h1>Vertex Archive</h1>
          <div className="row">
            <button
              disabled={chosenYear === MIN_YEAR}
              onClick={() => this.adjustYear(-1)}
            >
              &lt;&lt; Prev Year
            </button>
            <div>{chosenDate.format('MMMM D, YYYY')}</div>
            <button
              disabled={chosenYear === MAX_YEAR}
              onClick={() => this.adjustYear(1)}
            >
              Next Year &gt;&gt;
            </button>
          </div>
          <div className="row">
            <button className="date" onClick={() => this.adjustDate(-1)}>
              &lt; Prev puzzle
            </button>
            <button className="date" onClick={() => this.adjustDate(1)}>
              Next puzzle &gt;
            </button>
          </div>
          <button onClick={this.onSelect}>Play!</button>
        </div>
      </div>
    );
  }
}

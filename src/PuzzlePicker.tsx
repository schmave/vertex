import React from 'react';
import { createGame, goFullscreen } from './main';
import testPuzzle from './test.json';
import puzzleDirectory from './puzzle-toc.json';
import dayjs, { Dayjs } from 'dayjs';
import './PuzzlePicker.scss';

interface PuzzleInfo {
  date: string;
  id: string;
  numShapes: number;
  puzzleConstructor: string;
  theme: string;
}

type State = {
  chosenDate: Dayjs;
  chosenYear: number;
  chosenPuzzle: PuzzleInfo;
};

type Props = {
  onHide: () => any;
};

const MIN_YEAR = 2019;
const MAX_YEAR = 2024;
const YEAR_KEY = 'picker-year';
const LAST_PUZZLE_KEY = 'picker-date';

const getClass = (year: number) => `y-${year}`;

function findPuzzle(date: Dayjs): PuzzleInfo {
  return puzzleDirectory.find(
    (puzzle) => puzzle.date === date.format('YYYY-MM-DD')
  )!;
}

export default class PuzzlePicker extends React.PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);

    const yearFromStorage = localStorage.getItem(YEAR_KEY);
    const chosenYear = yearFromStorage
      ? parseInt(yearFromStorage, 10)
      : MIN_YEAR;

    const dateFromStorage = localStorage.getItem(LAST_PUZZLE_KEY);
    const chosenDate = dateFromStorage
      ? dayjs(dateFromStorage)
      : this.getClosestPuzzle(chosenYear);

    this.state = {
      chosenYear,
      chosenDate,
      chosenPuzzle: findPuzzle(chosenDate),
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
        await goFullscreen();
      }
    } catch (e) {
      console.log('Exception from requestFullScreen', e);
    }
    this.props.onHide();
  };

  getClosestPuzzle = (year: number) => {
    let bestDiff = 10000000000,
      best: Dayjs | null = null;

    const startingDate = dayjs().hour(0).minute(0).second(0).millisecond(0);

    const target = startingDate.year(year);

    puzzleDirectory.forEach((puzzle) => {
      const thisDate = dayjs(puzzle.date);
      if (thisDate.year() === target.year()) {
        const diff = Math.abs(thisDate.diff(target, 'day'));
        if (diff < bestDiff) {
          bestDiff = diff;
          best = thisDate;
        }
      }
    });

    return best!;
  };

  setDate = (newDate: Dayjs) => {
    this.setState({
      chosenYear: newDate.year(),
      chosenDate: newDate,
      chosenPuzzle: findPuzzle(newDate),
    });
    localStorage.setItem(YEAR_KEY, newDate.year().toString());
    localStorage.setItem(LAST_PUZZLE_KEY, newDate.format('YYYY-MM-DD'));
  };

  setYear = (newYear: number) => {
    this.setDate(this.getClosestPuzzle(newYear));
  };

  adjustDate = (delta: number) => {
    const existingI = puzzleDirectory.findIndex(
      (puzzle) => puzzle.date === this.state.chosenDate.format('YYYY-MM-DD')
    );
    const newI = existingI + delta;
    if (newI < 0 || newI >= puzzleDirectory.length) {
      return;
    }

    this.setDate(dayjs(puzzleDirectory[newI].date));
  };

  render() {
    const { chosenYear, chosenDate, chosenPuzzle } = this.state;

    const years = [];
    for (let y = MIN_YEAR; y <= MAX_YEAR; y++) {
      years.push(y);
    }

    return (
      <div id="overlay">
        <div className="puzzle-picker">
          <h1>Vertex Archive</h1>
          <div style={{ textAlign: 'center' }}>
            <div>Jump to {dayjs().format('MMM. DD')} in the year:</div>
            <div className="row">
              {years.map((y) => (
                <button
                  key={y}
                  style={{ color: 'white' }}
                  className={getClass(y)}
                  onClick={() => this.setYear(y)}
                >
                  {y}
                </button>
              ))}
            </div>
          </div>
          <div className="row">
            <button className="date" onClick={() => this.adjustDate(-1)}>
              &lt;&lt;
            </button>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                minWidth: 200,
              }}
            >
              <div>
                {chosenDate.format('MMMM D')},{' '}
                <span
                  className={getClass(chosenYear)}
                  style={{ padding: '2px', color: 'white' }}
                >
                  {chosenYear}
                </span>
              </div>
              <i>{chosenPuzzle.theme}</i>
            </div>
            <button className="date" onClick={() => this.adjustDate(1)}>
              &gt;&gt;
            </button>
          </div>
          <button
            style={{
              fontSize: '1.3em',
              backgroundColor: 'white',
            }}
            onClick={this.onSelect}
          >
            Open Drawing
          </button>
        </div>
      </div>
    );
  }
}

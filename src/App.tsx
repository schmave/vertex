import { useState } from 'react';
import PuzzlePicker from './PuzzlePicker';

const App = () => {
  const [showPicker, setShowPicker] = useState(true);
  return showPicker && <PuzzlePicker onHide={() => setShowPicker(false)} />;
};

export default App;

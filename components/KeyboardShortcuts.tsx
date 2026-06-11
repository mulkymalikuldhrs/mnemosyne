import React from 'react';

const KeyboardShortcuts = () => {
  const handleKeyDown = (event: any) => {
    if (event.ctrlKey && event.key === 's') {
      // Save markdown
      event.preventDefault();
    } else if (event.ctrlKey && event.key === 'p') {
      // Preview markdown
      event.preventDefault();
    }
  };

  return (
    <div>
      <h2>Keyboard Shortcuts</h2>
      <ul>
        <li>Ctrl + S: Save markdown</li>
        <li>Ctrl + P: Preview markdown</li>
      </ul>
    </div>
  );
};

export default KeyboardShortcuts;
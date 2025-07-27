import React, { useState } from 'react';

function Popup() {
  const [output, setOutput] = useState('');

  // This runs when you click "Check for Errors".
  const handleCheckErrors = () => {
    setOutput('Checked for errors! (demo)');
  };

  // This runs when you click "Ask for Advice".
  const handleAskAdvice = async () => {
    setOutput('Getting advice from the AI...');
    // Later, you’ll connect this to your backend!
  };

  return (
    <div style={{ padding: 16 }}>
      <h3>SPIKE AI Error Advisor</h3>
      <button onClick={handleCheckErrors} style={{marginRight: 8}}>Check for Errors</button>
      <button onClick={handleAskAdvice}>Ask for Advice</button>
      <div style={{marginTop: 16}}>{output}</div>
    </div>
  );
}

export default Popup;

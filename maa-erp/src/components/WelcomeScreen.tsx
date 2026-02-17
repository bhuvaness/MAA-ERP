import React from 'react';

interface Props {
  onBeginSetup: () => void;
}

const WelcomeScreen: React.FC<Props> = ({ onBeginSetup }) => {
  return (
    <div className="welcome-state">
      <div className="welcome-viki-avatar">V</div>
      <h2>Welcome to MAA Platform</h2>
      <p>I'm <strong>Viki</strong>, your business assistant. Let's get your business registered and ready to operate.</p>
      <button className="welcome-cta" onClick={onBeginSetup}>Set up my business →</button>
      <div className="welcome-hint">Takes about 3 minutes · You can skip steps</div>
    </div>
  );
};

export default WelcomeScreen;

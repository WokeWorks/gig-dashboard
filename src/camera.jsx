import { Icon } from './ui.jsx';

const { useState, useEffect } = React;

// Full-screen clock-in check on the phone: location, then a live face, then done.
export function CameraSheet({ out, onDone, onCancel }) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (step >= 3) return;
    const t = setTimeout(() => setStep(step + 1), step === 1 ? 1700 : 1100);
    return () => clearTimeout(t);
  }, [step]);
  useEffect(() => { if (step === 3) { const t = setTimeout(onDone, 700); return () => clearTimeout(t); } }, [step]);
  const msg = ['Checking you are at the location', 'Blink to show it\'s really you', 'Saving', out ? 'Clocked out' : 'Clocked in'][step];
  return (
    <div className="pk-camera">
      <div className="pk-cam-top"><button className="pk-cam-x" onClick={onCancel}>Cancel</button></div>
      <div className={'pk-oval' + (step === 3 ? ' ok' : '')}>{step === 3 && <Icon name="check" size={56} stroke={2.6} />}</div>
      <div className="pk-cam-msg">{msg}</div>
      <div className="pk-cam-steps">
        <span className={step > 0 ? 'done' : 'now'}><Icon name="pin" size={15} /> 42 m from site, inside 120 m</span>
        <span className={step > 1 ? 'done' : step === 1 ? 'now' : ''}><Icon name="face" size={15} /> Live face, match 0.91</span>
      </div>
    </div>
  );
}

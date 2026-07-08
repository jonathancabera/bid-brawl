import { useState, useEffect } from 'react';

const msRemaining = (endTime: string): number => new Date(endTime).getTime() - Date.now();

const durationFormatter = new Intl.DurationFormat('en', { style: 'narrow' });

export default function AuctionTimeCountdown({ endTime }: { endTime: string }) {
  const [remaining, setRemaining] = useState(() => msRemaining(endTime));

  useEffect(() => {
    const intervalId = setInterval(() => {
      setRemaining(msRemaining(endTime));
    }, 1000);
    return () => clearInterval(intervalId);
  }, [endTime]);

  if (remaining <= 0) {
    return <span>Auction ended</span>;
  }

  const totalSeconds = Math.floor(remaining / 1000);
  const duration = {
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
  };

  return <span>{durationFormatter.format(duration)}</span>;
}

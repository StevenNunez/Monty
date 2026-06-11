import React, { Fragment, useRef, useState } from 'react';
import { cn } from '../lib/utils';

interface InteractiveLogoProps {
  text?: string;
  className?: string;
  variant?: 'header' | 'footer-small' | 'footer-giant';
}

export default function InteractiveLogo({
  text = 'Teo Labs',
  className,
  variant = 'header'
}: InteractiveLogoProps) {
  return (
    <span className={cn("flex select-none", className)}>
      {text.split('').map((char, index) => (
        <Fragment key={index}>
          <AnimatedLetter char={char} index={index} variant={variant} />
        </Fragment>
      ))}
    </span>
  );
}

function AnimatedLetter({
  char,
  index,
  variant
}: {
  char: string;
  index: number;
  variant: 'header' | 'footer-small' | 'footer-giant'
}) {
  const [isHovered, setIsHovered] = useState(false);
  const [mouseX, setMouseX] = useState(0);
  const letterRef = useRef<HTMLSpanElement>(null);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (letterRef.current) {
      const rect = letterRef.current.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      setMouseX(x);
    }
  };

  if (char === ' ') {
    return <span className={cn("inline-block", variant === 'footer-giant' ? "w-[0.3em]" : "w-[0.2em]")} />;
  }

  const getStyle = (): React.CSSProperties => {
    const intensity = variant === 'footer-giant' ? 8 : 4;
    const skew = variant === 'footer-giant' ? 15 : 10;
    const transform = isHovered
      ? `translateY(${Math.sin(index * 0.5 + mouseX * 3) * intensity}px) skewX(${mouseX * skew}deg)`
      : 'translateY(0) skewX(0)';

    const style: React.CSSProperties = {
      transform,
      transition: isHovered ? 'transform 0.1s ease-out' : 'transform 0.3s ease-out',
      fontWeight: isHovered || variant === 'footer-giant' ? '700' : '600',
    };

    if (variant === 'footer-giant') {
      style.textShadow = isHovered
        ? `${-4 - mouseX * 10}px 0 0 rgba(255, 0, 0, 0.6), ${4 - mouseX * 10}px 0 0 rgba(0, 255, 255, 0.6)`
        : '-3px 0 0 rgba(255, 0, 0, 0.5), 3px 0 0 rgba(0, 255, 255, 0.5)';
    }

    return style;
  };

  const getClassName = () => {
    if (variant === 'footer-giant') {
      return "inline-block relative cursor-default";
    }
    return "inline-block relative cursor-default bg-gradient-to-r from-blue-600 via-purple-500 to-green-500 bg-clip-text text-transparent";
  };

  return (
    <span
      ref={letterRef}
      className={getClassName()}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => { setIsHovered(false); setMouseX(0); }}
      onMouseMove={handleMouseMove}
      style={getStyle()}
    >
      {char}
    </span>
  );
}

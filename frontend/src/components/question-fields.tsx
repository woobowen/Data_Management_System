import { motion } from 'framer-motion';

import { cn } from '../lib/cn';
import type { QuestionValue } from '../state/survey-engine';

type QuestionFieldsProps = {
  question: QuestionValue;
  value: unknown;
  rawValue: unknown;
  isErasing: boolean;
  disabled: boolean;
  onImmediateChange: (value: unknown) => void;
  onCommit: (value: unknown) => void;
  onCompositionStart: () => void;
  onCompositionEnd: (value: string) => void;
  onErase: () => void;
  onEraseStop: () => void;
};

function getTilt(seed: string, offset = 0) {
  let hash = 0;
  const source = `${seed}:${offset}`;
  for (let index = 0; index < source.length; index += 1) {
    hash = (hash * 33 + source.charCodeAt(index)) % 3600;
  }
  return ((hash % 120) - 60) / 100;
}

function EmbossOption({
  selected,
  children,
  onClick,
  tilt,
}: {
  selected: boolean;
  children: React.ReactNode;
  onClick: () => void;
  tilt: number;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      initial={{ opacity: 0, filter: 'blur(4px)', y: 10 }}
      animate={{ opacity: 1, filter: 'blur(0px)', y: 0 }}
      transition={{ duration: 0.55 }}
      style={{ rotate: `${tilt}deg` }}
      className={cn(
        'w-full rounded-[1.8rem] px-6 py-5 text-left transition duration-150',
        selected ? 'paper-deboss' : 'paper-emboss hover:-translate-y-0.5',
      )}
    >
      <span className="font-hand text-[1.95rem] leading-[1.35] ink-text">{children}</span>
    </motion.button>
  );
}

export function QuestionFields(props: QuestionFieldsProps) {
  const {
    question,
    value,
    rawValue,
    isErasing,
    disabled,
    onImmediateChange,
    onCommit,
    onCompositionStart,
    onCompositionEnd,
    onErase,
    onEraseStop,
  } = props;

  if (question.type === 'single_choice') {
    return (
      <div className="grid gap-4">
        {(question.options || []).map((option, index) => (
          <EmbossOption
            key={option.optionId}
            selected={value === option.optionId}
            onClick={() => onCommit(option.optionId)}
            tilt={getTilt(option.optionId, index)}
          >
            {option.text}
          </EmbossOption>
        ))}
      </div>
    );
  }

  if (question.type === 'multi_choice') {
    const selectedValues = Array.isArray(value) ? value : [];
    return (
      <div className="grid gap-4">
        {(question.options || []).map((option, index) => {
          const selected = selectedValues.includes(option.optionId);
          return (
            <EmbossOption
              key={option.optionId}
              selected={selected}
              onClick={() => {
                const nextValue = selected
                  ? selectedValues.filter((item) => item !== option.optionId)
                  : [...selectedValues, option.optionId];
                onCommit(nextValue);
              }}
              tilt={getTilt(option.optionId, index)}
            >
              {option.text}
            </EmbossOption>
          );
        })}
      </div>
    );
  }

  if (question.type === 'number') {
    return (
      <motion.label
        initial={{ opacity: 0, filter: 'blur(4px)', y: 8 }}
        animate={{ opacity: 1, filter: 'blur(0px)', y: 0 }}
        transition={{ duration: 0.65 }}
        className="block"
      >
        <span className="mb-4 block font-hand text-[1.65rem] text-ink/68">请写下数字</span>
        <input
          type="number"
          disabled={disabled}
          value={typeof rawValue === 'number' || typeof rawValue === 'string' ? rawValue : typeof value === 'number' ? value : ''}
          onChange={(event) => {
            const nextValue = event.target.value;
            onImmediateChange(nextValue);
            if (nextValue === '') {
              onCommit(undefined);
              return;
            }
            const parsed = Number(nextValue);
            if (!Number.isNaN(parsed)) {
              onCommit(parsed);
            }
          }}
          className="ink-input paper-entry w-full rounded-[2rem] px-6 py-5 font-hand text-[2.25rem] text-ink outline-none"
        />
      </motion.label>
    );
  }

  return (
    <motion.label
      initial={{ opacity: 0, filter: 'blur(4px)', y: 8 }}
      animate={{ opacity: 1, filter: 'blur(0px)', y: 0 }}
      transition={{ duration: 0.7 }}
      className="block"
    >
      <span className="mb-4 block font-hand text-[1.65rem] text-ink/68">请写下文字</span>
      <textarea
        disabled={disabled}
        data-erasing={isErasing}
        value={typeof rawValue === 'string' ? rawValue : typeof value === 'string' ? value : ''}
        onChange={(event) => {
          const nextValue = event.target.value;
          onImmediateChange(nextValue);
          if (nextValue.length < String(rawValue ?? value ?? '').length) {
            onErase();
          } else {
            onEraseStop();
          }
        }}
        onBlur={(event) => onCommit(event.target.value)}
        onCompositionStart={onCompositionStart}
        onCompositionEnd={(event) => onCompositionEnd(event.currentTarget.value)}
        placeholder="让墨水慢慢渗进纸页……"
        className="ink-input parchment-smudge min-h-48 w-full resize-none rounded-[2rem] px-6 py-6 font-hand text-[2rem] leading-[1.72] text-ink outline-none"
      />
    </motion.label>
  );
}

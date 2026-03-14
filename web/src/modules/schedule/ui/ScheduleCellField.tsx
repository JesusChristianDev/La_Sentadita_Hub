'use client';

import { Eraser, Minus, Plus } from 'lucide-react';
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import {
  buildCellDraftValue,
  canAddSplitToCellDraft,
  isStatusCellDraftValue,
  removeSplitFromCellDraft,
  splitCellDraftValue,
} from './scheduleCellHelpers';

export type ScheduleCellSuggestion = {
  hint: string;
  label: string;
  value: string;
};

type SuggestionPopoverPosition = {
  left: number;
  top: number;
  width: number;
};

type ScheduleCellFieldProps = {
  autoTag?: boolean;
  compact?: boolean;
  employeeName: string;
  error?: string;
  isEmptyPending: boolean;
  isLockedByMe: boolean;
  isReadOnlyCell: boolean;
  label: string;
  onCommit: (nextRawValue?: string) => void;
  onDropTemplate: (templateText: string) => void;
  onReset: () => void;
  onValueChange: (nextValue: string) => void;
  placeholder: string;
  statusClassName: string;
  suggestions: ScheduleCellSuggestion[];
  value: string;
};

function rankSuggestion(
  suggestion: ScheduleCellSuggestion,
  query: string,
): number {
  const normalizedValue = suggestion.value.toLowerCase();
  const normalizedLabel = suggestion.label.toLowerCase();
  const normalizedHint = suggestion.hint.toLowerCase();

  if (normalizedValue === query) return 0;
  if (normalizedValue.startsWith(query)) return 1;
  if (normalizedLabel.startsWith(query)) return 2;
  if (normalizedHint.startsWith(query)) return 3;
  if (normalizedValue.includes(query)) return 4;
  if (normalizedLabel.includes(query)) return 5;
  return 6;
}

export function ScheduleCellField({
  autoTag,
  compact = false,
  employeeName,
  error,
  isEmptyPending,
  isLockedByMe,
  isReadOnlyCell,
  label,
  onCommit,
  onDropTemplate,
  onReset,
  onValueChange,
  placeholder,
  statusClassName,
  suggestions,
  value,
}: ScheduleCellFieldProps) {
  const suggestionsId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const primaryInputRef = useRef<HTMLInputElement>(null);
  const secondaryInputRef = useRef<HTMLInputElement>(null);
  const focusSecondaryRef = useRef(false);
  const [suggestionPopoverPosition, setSuggestionPopoverPosition] =
    useState<SuggestionPopoverPosition | null>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [activeField, setActiveField] = useState<'primary' | 'secondary'>('primary');
  const [isSplitExpanded, setIsSplitExpanded] = useState(() => {
    return Boolean(splitCellDraftValue(value).secondary);
  });

  const { primary, secondary } = useMemo(() => splitCellDraftValue(value), [value]);
  const hasSecondary = Boolean(secondary);

  const filteredSuggestions = useMemo(() => {
    if (activeField !== 'primary') return [];

    const query = primary.trim().toLowerCase();
    if (!query) return [];

    return suggestions
      .filter((suggestion) => {
        const normalizedValue = suggestion.value.toLowerCase();
        const normalizedLabel = suggestion.label.toLowerCase();
        const normalizedHint = suggestion.hint.toLowerCase();

        return (
          normalizedValue.includes(query) ||
          normalizedLabel.includes(query) ||
          normalizedHint.includes(query)
        );
      })
      .sort((left, right) => rankSuggestion(left, query) - rankSuggestion(right, query))
      .slice(0, 6);
  }, [activeField, primary, suggestions]);

  const showSuggestions =
    isFocused &&
    activeField === 'primary' &&
    !isReadOnlyCell &&
    filteredSuggestions.length > 0;
  const activeSuggestionId =
    showSuggestions && filteredSuggestions[highlightedIndex]
      ? `${suggestionsId}-option-${highlightedIndex}`
      : undefined;
  const baseInputClassName = compact ? 'min-h-10 text-sm' : 'min-h-11 text-sm';
  const showSplitField =
    hasSecondary || (isSplitExpanded && Boolean(primary) && !isStatusCellDraftValue(primary));
  const canAddSplit =
    !autoTag &&
    !isReadOnlyCell &&
    isLockedByMe &&
    !showSplitField &&
    canAddSplitToCellDraft(value);
  const canClear =
    !autoTag && !isReadOnlyCell && isLockedByMe && Boolean(value.trim());

  useEffect(() => {
    if (!focusSecondaryRef.current || !secondaryInputRef.current) return;

    secondaryInputRef.current.focus();
    focusSecondaryRef.current = false;
  }, [showSplitField]);

  useLayoutEffect(() => {
    if (!showSuggestions || !primaryInputRef.current || typeof window === 'undefined') return;

    const updatePosition = () => {
      if (!primaryInputRef.current) return;

      const rect = primaryInputRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const desiredWidth = Math.min(Math.max(rect.width, 220), 320);
      const width = Math.min(desiredWidth, viewportWidth - 24);
      const left = Math.min(
        Math.max(12, rect.left),
        Math.max(12, viewportWidth - width - 12),
      );
      const estimatedHeight = Math.min(300, 16 + filteredSuggestions.length * 56);
      const shouldOpenUpward = rect.bottom + 8 + estimatedHeight > viewportHeight - 12;
      const top = shouldOpenUpward
        ? Math.max(12, rect.top - estimatedHeight - 8)
        : rect.bottom + 8;

      setSuggestionPopoverPosition({
        left,
        top,
        width,
      });
    };

    updatePosition();

    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [filteredSuggestions.length, showSuggestions]);

  const actionButtonClassName = compact
    ? 'inline-flex h-7 w-7 items-center justify-center rounded-full border border-accent/35 bg-accent/14 text-foreground shadow-[0_10px_18px_-16px_rgba(245,158,11,0.95)] transition hover:border-accent-strong hover:bg-accent/18 hover:text-foreground'
    : 'inline-flex min-h-7 items-center gap-1.5 rounded-full border border-accent/35 bg-accent/12 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-foreground shadow-[0_10px_18px_-16px_rgba(245,158,11,0.95)] transition hover:border-accent-strong hover:bg-accent/18 hover:text-foreground';
  const destructiveActionButtonClassName = compact
    ? 'inline-flex h-7 w-7 items-center justify-center rounded-full border border-rose-400/35 bg-rose-500/12 text-foreground shadow-[0_10px_18px_-16px_rgba(244,63,94,0.95)] transition hover:border-rose-300/70 hover:bg-rose-500/18 hover:text-foreground'
    : 'inline-flex min-h-7 items-center gap-1.5 rounded-full border border-rose-400/35 bg-rose-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-foreground shadow-[0_10px_18px_-16px_rgba(244,63,94,0.95)] transition hover:border-rose-300/70 hover:bg-rose-500/18 hover:text-foreground';

  function selectSuggestion(index: number) {
    const suggestion = filteredSuggestions[index];
    if (!suggestion) return;

    const nextParts = splitCellDraftValue(suggestion.value);
    setIsSplitExpanded(Boolean(nextParts.secondary));
    onValueChange(suggestion.value);
    setIsFocused(false);
    setHighlightedIndex(0);
    onCommit(suggestion.value);
  }

  function handleBlur() {
    setTimeout(() => {
      if (containerRef.current?.contains(document.activeElement)) return;

      setIsFocused(false);
      setHighlightedIndex(0);

      if (!isLockedByMe || autoTag) return;
      onCommit();
    }, 80);
  }

  function handleAddSplit() {
    setIsSplitExpanded(true);
    focusSecondaryRef.current = true;
  }

  function handleRemoveSplit() {
    setIsSplitExpanded(false);
    onValueChange(removeSplitFromCellDraft(value));
    primaryInputRef.current?.focus();
  }

  function handleClearCell() {
    setIsSplitExpanded(false);
    setHighlightedIndex(0);
    onValueChange('');
    onCommit('');
    primaryInputRef.current?.focus();
  }

  return (
    <div ref={containerRef} className={`relative grid ${compact ? 'gap-1.5' : 'gap-2'}`}>
      <input
        ref={primaryInputRef}
        aria-activedescendant={activeSuggestionId}
        aria-autocomplete="list"
        aria-controls={showSuggestions ? suggestionsId : undefined}
        aria-expanded={showSuggestions}
        aria-haspopup="listbox"
        aria-invalid={Boolean(error)}
        aria-label={`${employeeName}, ${label}`}
        className={`${baseInputClassName} w-full rounded-2xl border px-3 py-2 font-semibold shadow-sm outline-none transition ${statusClassName}`}
        disabled={autoTag}
        onBlur={handleBlur}
        onChange={(event) => {
          const nativeInputEvent = event.nativeEvent as InputEvent;
          const shouldPreserveRaw =
            typeof nativeInputEvent.inputType === 'string' &&
            nativeInputEvent.inputType.startsWith('delete');
          const nextValue = buildCellDraftValue({
            primary: event.target.value,
            secondary: showSplitField ? secondary : '',
          }, { preserveRaw: shouldPreserveRaw });
          const nextPrimary = splitCellDraftValue(nextValue).primary;

          if (!nextPrimary || isStatusCellDraftValue(nextPrimary)) {
            setIsSplitExpanded(false);
          }

          onValueChange(nextValue);
          setHighlightedIndex(0);
        }}
        onDragOver={(event) => {
          if (!isLockedByMe || autoTag) return;
          event.preventDefault();
        }}
        onDrop={(event) => {
          if (!isLockedByMe || autoTag) return;
          event.preventDefault();
          const templateText = event.dataTransfer.getData(
            'application/x-schedule-template-text',
          );
          if (!templateText) return;
          setIsSplitExpanded(Boolean(splitCellDraftValue(templateText).secondary));
          onDropTemplate(templateText);
        }}
        onFocus={() => {
          setIsFocused(true);
          setActiveField('primary');
          setHighlightedIndex(0);
        }}
        onKeyDown={(event) => {
          if (showSuggestions && event.key === 'ArrowDown') {
            event.preventDefault();
            setHighlightedIndex((current) =>
              current >= filteredSuggestions.length - 1 ? 0 : current + 1,
            );
            return;
          }

          if (showSuggestions && event.key === 'ArrowUp') {
            event.preventDefault();
            setHighlightedIndex((current) =>
              current <= 0 ? filteredSuggestions.length - 1 : current - 1,
            );
            return;
          }

          if (showSuggestions && event.key === 'Enter') {
            event.preventDefault();
            selectSuggestion(highlightedIndex);
            return;
          }

          if (event.key === 'Enter') {
            event.preventDefault();

            if (showSplitField && secondaryInputRef.current) {
              secondaryInputRef.current.focus();
              return;
            }

            onCommit();
            return;
          }

          if (event.key === 'Escape') {
            event.preventDefault();

            if (showSuggestions) {
              setIsFocused(false);
              setHighlightedIndex(0);
              return;
            }

            onReset();
          }
        }}
        placeholder={placeholder}
        readOnly={!isLockedByMe && !autoTag}
        role="combobox"
        title={
          isReadOnlyCell || autoTag
            ? undefined
            : 'Escribe un horario como 9-17 o un estado como Libre, Vacaciones, Baja o Ausencia.'
        }
        value={primary}
      />

      {showSplitField ? (
        <input
          ref={secondaryInputRef}
          aria-label={`${employeeName}, ${label}, segundo tramo`}
          className={`${baseInputClassName} w-full rounded-2xl border px-3 py-2 font-semibold shadow-sm outline-none transition ${statusClassName}`}
          disabled={autoTag}
          onBlur={handleBlur}
          onChange={(event) => {
            const nativeInputEvent = event.nativeEvent as InputEvent;
            const shouldPreserveRaw =
              typeof nativeInputEvent.inputType === 'string' &&
              nativeInputEvent.inputType.startsWith('delete');
            onValueChange(
              buildCellDraftValue({
                primary,
                secondary: event.target.value,
              }, { preserveRaw: shouldPreserveRaw }),
            );
          }}
          onFocus={() => {
            setIsFocused(true);
            setActiveField('secondary');
            setHighlightedIndex(0);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              onCommit();
              return;
            }

            if (event.key === 'Escape') {
              event.preventDefault();
              onReset();
            }
          }}
          placeholder="17-21"
          readOnly={!isLockedByMe && !autoTag}
          title={
            isReadOnlyCell || autoTag
              ? undefined
              : 'Segundo tramo del turno partido.'
          }
          value={secondary}
        />
      ) : null}

      {!autoTag ? (
        <div className={`flex flex-wrap items-center ${compact ? 'gap-1.5' : 'gap-2'} text-muted`}>
          {canAddSplit ? (
            <button
              aria-label="Agregar segundo tramo"
              className={actionButtonClassName}
              onMouseDown={(event) => {
                event.preventDefault();
              }}
              onClick={handleAddSplit}
              title="Agregar tramo"
              type="button"
            >
              <Plus className="h-3.5 w-3.5" />
              {compact ? null : <span>Agregar tramo</span>}
            </button>
          ) : null}
          {showSplitField && !autoTag && !isReadOnlyCell && isLockedByMe ? (
            <button
              aria-label="Quitar segundo tramo"
              className={destructiveActionButtonClassName}
              onMouseDown={(event) => {
                event.preventDefault();
              }}
              onClick={handleRemoveSplit}
              title="Quitar tramo"
              type="button"
            >
              <Minus className="h-3.5 w-3.5" />
              {compact ? null : <span>Quitar tramo</span>}
            </button>
          ) : null}
          {canClear ? (
            <button
              aria-label="Limpiar celda"
              className={destructiveActionButtonClassName}
              onMouseDown={(event) => {
                event.preventDefault();
              }}
              onClick={handleClearCell}
              title="Limpiar"
              type="button"
            >
              <Eraser className="h-3.5 w-3.5" />
              {compact ? null : <span>Limpiar</span>}
            </button>
          ) : null}
        </div>
      ) : null}

      {showSuggestions && suggestionPopoverPosition && typeof document !== 'undefined'
        ? createPortal(
            <div
              className="fixed z-[130] grid max-h-[18rem] gap-1 overflow-y-auto rounded-[1rem] border border-border/80 bg-[linear-gradient(180deg,rgba(30,31,36,0.98)_0%,rgba(17,18,22,0.99)_100%)] p-2 shadow-[0_20px_44px_-28px_rgba(0,0,0,0.92)]"
              id={suggestionsId}
              role="listbox"
              style={{
                left: suggestionPopoverPosition.left,
                top: suggestionPopoverPosition.top,
                width: suggestionPopoverPosition.width,
              }}
            >
              {filteredSuggestions.map((suggestion, index) => (
                <button
                  id={`${suggestionsId}-option-${index}`}
                  aria-selected={index === highlightedIndex}
                  key={`${suggestion.value}-${suggestion.label}`}
                  className={`rounded-[0.9rem] px-3 py-2 text-left transition ${
                    index === highlightedIndex
                      ? 'bg-accent/12 text-foreground'
                      : 'bg-transparent text-muted hover:bg-background/30 hover:text-foreground'
                  }`}
                  onMouseDown={(event) => {
                    event.preventDefault();
                  }}
                  onClick={() => selectSuggestion(index)}
                  role="option"
                  type="button"
                >
                  <span className="block text-sm font-semibold">{suggestion.value}</span>
                  <span className="mt-0.5 block text-xs">{suggestion.label}</span>
                </button>
              ))}
            </div>,
            document.body,
          )
        : null}

      {autoTag ? (
        <span className="text-[11px] uppercase tracking-[0.24em] text-muted">Auto</span>
      ) : error ? (
        <span
          className={`text-xs ${isEmptyPending ? 'text-orange-200' : 'text-red-300'}`}
        >
          {error}
        </span>
      ) : null}
    </div>
  );
}

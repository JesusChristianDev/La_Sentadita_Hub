'use client';

import { Check, ChevronDown } from 'lucide-react';
import type {
  ChangeEvent,
  CSSProperties,
  KeyboardEvent,
  ReactNode,
  SelectHTMLAttributes,
} from 'react';
import {
  Children,
  forwardRef,
  Fragment,
  isValidElement,
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';

import { useMobileOverlay } from '@/shared/hooks/useMobileOverlay';
import { MOBILE_VIEWPORT_MEDIA_QUERY } from '@/shared/responsive';

import { cx } from './cx';

type SelectProps = SelectHTMLAttributes<HTMLSelectElement>;

type FlatOption = {
  disabled: boolean;
  groupLabel?: string;
  label: string;
  value: string;
};

type OptionElementProps = {
  children?: ReactNode;
  disabled?: boolean;
  label?: string;
  value?: string | number | readonly string[];
};

function normalizeSelectValue(value: SelectProps['defaultValue'] | SelectProps['value']) {
  if (Array.isArray(value)) {
    return value[0] ? String(value[0]) : '';
  }

  return value == null ? '' : String(value);
}

function readNodeText(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') {
    return String(node);
  }

  if (Array.isArray(node)) {
    return node.map((child) => readNodeText(child)).join('');
  }

  if (isValidElement<{ children?: ReactNode }>(node)) {
    return readNodeText(node.props.children);
  }

  return '';
}

function readOptions(children: ReactNode, groupLabel?: string): FlatOption[] {
  const options: FlatOption[] = [];

  Children.forEach(children, (child) => {
    if (!isValidElement<OptionElementProps>(child)) return;

    if (child.type === 'option') {
      const label = readNodeText(child.props.children).trim();
      const rawValue = child.props.value;
      const value =
        rawValue != null
          ? Array.isArray(rawValue)
            ? String(rawValue[0] ?? '')
            : String(rawValue)
          : label;

      options.push({
        disabled: Boolean(child.props.disabled),
        groupLabel,
        label: label || value,
        value,
      });
      return;
    }

    if (child.type === 'optgroup') {
      const nextGroupLabel =
        typeof child.props.label === 'string' ? child.props.label : groupLabel;

      options.push(...readOptions(child.props.children, nextGroupLabel));
    }
  });

  return options;
}

function getFirstEnabledOptionIndex(options: FlatOption[]) {
  return options.findIndex((option) => !option.disabled);
}

function getNextEnabledOptionIndex(
  options: FlatOption[],
  startIndex: number,
  direction: 1 | -1,
) {
  if (!options.length) {
    return -1;
  }

  let index = startIndex;

  for (let step = 0; step < options.length; step += 1) {
    index += direction;

    if (index < 0) {
      index = options.length - 1;
    } else if (index >= options.length) {
      index = 0;
    }

    if (!options[index]?.disabled) {
      return index;
    }
  }

  return -1;
}

function getLastEnabledOptionIndex(options: FlatOption[]) {
  return getNextEnabledOptionIndex(options, 0, -1);
}

function getTypeaheadMatchIndex(
  options: FlatOption[],
  query: string,
  startIndex: number,
) {
  const normalizedQuery = query.trim().toLocaleLowerCase();

  if (!normalizedQuery) {
    return -1;
  }

  for (let step = 1; step <= options.length; step += 1) {
    const index = (startIndex + step + options.length) % options.length;
    const option = options[index];

    if (!option || option.disabled) {
      continue;
    }

    if (option.label.toLocaleLowerCase().startsWith(normalizedQuery)) {
      return index;
    }
  }

  return -1;
}

function getFocusableElements() {
  const selector = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled]):not([type="hidden"])',
    'select:not([disabled]):not([data-select-hidden="true"])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
  ].join(',');

  return Array.from(document.querySelectorAll<HTMLElement>(selector)).filter((element) => {
    if (element.dataset.selectHidden === 'true') {
      return false;
    }

    if (element.getAttribute('aria-hidden') === 'true') {
      return false;
    }

    const styles = window.getComputedStyle(element);
    if (styles.display === 'none' || styles.visibility === 'hidden') {
      return false;
    }

    return element.getClientRects().length > 0;
  });
}

const NativeSelectFallback = forwardRef<HTMLSelectElement, SelectProps>(
  function NativeSelectFallback(
    {
      'aria-describedby': ariaDescribedby,
      'aria-invalid': ariaInvalid,
      'aria-label': ariaLabel,
      'aria-labelledby': ariaLabelledby,
      autoFocus,
      children,
      className,
      defaultValue,
      disabled,
      form,
      id,
      multiple,
      name,
      onChange,
      required,
      size,
      title,
      value,
      ...nativeProps
    },
    forwardedRef,
  ) {
    return (
      <div className={cx('select-field', className)} data-disabled={disabled ? 'true' : 'false'}>
        <select
          {...nativeProps}
          ref={forwardedRef}
          aria-describedby={ariaDescribedby}
          aria-invalid={ariaInvalid}
          aria-label={ariaLabel}
          aria-labelledby={ariaLabelledby}
          autoFocus={autoFocus}
          className="select-field__control"
          defaultValue={defaultValue}
          disabled={disabled}
          form={form}
          id={id}
          multiple={multiple}
          name={name}
          onChange={onChange}
          required={required}
          size={size}
          title={title}
          value={value}
        >
          {children}
        </select>
        <span className="select-field__icon" aria-hidden="true">
          <ChevronDown className="h-4 w-4" strokeWidth={2.2} />
        </span>
      </div>
    );
  },
);

const CustomSelect = forwardRef<HTMLSelectElement, SelectProps>(function CustomSelect(
  {
    'aria-describedby': ariaDescribedby,
    'aria-invalid': ariaInvalid,
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledby,
    autoFocus,
    children,
    className,
    defaultValue,
    disabled = false,
    form,
    id,
    name,
    onChange,
    required = false,
    title,
    value,
    ...nativeProps
  },
  forwardedRef,
) {
  const options = readOptions(children);
  const normalizedDefaultValue = normalizeSelectValue(defaultValue);
  const isControlled = value !== undefined;
  const [internalValue, setInternalValue] = useState(() => normalizedDefaultValue);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [isMobileSheet, setIsMobileSheet] = useState(false);
  const [panelSide, setPanelSide] = useState<'bottom' | 'top'>('bottom');
  const [panelStyle, setPanelStyle] = useState<CSSProperties>({});
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listboxRef = useRef<HTMLDivElement>(null);
  const nativeSelectRef = useRef<HTMLSelectElement>(null);
  const typeaheadBufferRef = useRef('');
  const typeaheadTimeoutRef = useRef<number | null>(null);
  const reactId = useId();
  const triggerId = id ?? `select-trigger-${reactId}`;
  const listboxId = `${triggerId}-listbox`;
  const selectedValue = isControlled ? normalizeSelectValue(value) : internalValue;
  const selectedOptionExists = options.some((option) => option.value === selectedValue);
  const firstOptionValue = options[0]?.value ?? '';
  const resolvedValue = selectedOptionExists ? selectedValue : firstOptionValue;
  const selectedIndex = options.findIndex((option) => option.value === resolvedValue);
  const selectedOption = selectedIndex >= 0 ? options[selectedIndex] : null;
  const firstEnabledOptionIndex = getFirstEnabledOptionIndex(options);
  const lastEnabledOptionIndex = getLastEnabledOptionIndex(options);
  const hasSelectableOption = firstEnabledOptionIndex >= 0;
  const hasDefaultValueOption = options.some(
    (option) => option.value === normalizedDefaultValue,
  );
  const isPlaceholder = Boolean(selectedOption?.disabled) || !selectedOption;
  const defaultActiveIndex =
    selectedIndex >= 0 && !selectedOption?.disabled ? selectedIndex : firstEnabledOptionIndex;

  useImperativeHandle(
    forwardedRef,
    () => nativeSelectRef.current as HTMLSelectElement,
    [],
  );

  const {
    backdropProps,
    closeOverlay,
    overlayRef,
    panelProps,
    prepareToOpen,
    shouldRenderOverlay,
  } = useMobileOverlay({
    enabled: isMobileSheet,
    onOpenChange: setOpen,
    open,
    restoreFocusRef: triggerRef,
  });

  const closeMenu = useCallback(
    ({
      armGuard = false,
      focusTrigger = false,
    }: {
      armGuard?: boolean;
      focusTrigger?: boolean;
    } = {}) => {
      closeOverlay({ armGuard, restoreFocus: focusTrigger });
    },
    [closeOverlay],
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia(MOBILE_VIEWPORT_MEDIA_QUERY);

    const syncMobileSheet = (matches: boolean) => {
      setIsMobileSheet(matches);
    };

    syncMobileSheet(mediaQuery.matches);

    const handleChange = (event: MediaQueryListEvent) => {
      syncMobileSheet(event.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  useEffect(() => {
    return () => {
      if (typeaheadTimeoutRef.current != null) {
        window.clearTimeout(typeaheadTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!disabled || !open) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setOpen(false);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [disabled, open]);

  useEffect(() => {
    if (isControlled) {
      return;
    }

    const formElement = nativeSelectRef.current?.form;
    if (!formElement) {
      return;
    }

    const handleReset = () => {
      window.setTimeout(() => {
        setInternalValue(hasDefaultValueOption ? normalizedDefaultValue : firstOptionValue);
      }, 0);
    };

    formElement.addEventListener('reset', handleReset);
    return () => formElement.removeEventListener('reset', handleReset);
  }, [
    firstOptionValue,
    hasDefaultValueOption,
    isControlled,
    normalizedDefaultValue,
  ]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const animationFrameId = window.requestAnimationFrame(() => {
      listboxRef.current?.focus();
    });

    return () => window.cancelAnimationFrame(animationFrameId);
  }, [open]);

  useEffect(() => {
    if (!open || activeIndex < 0) {
      return;
    }

    document
      .getElementById(`${listboxId}-option-${activeIndex}`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, listboxId, open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const updatePanelPosition = () => {
      if (isMobileSheet) {
        setPanelSide('bottom');
        setPanelStyle({});
        return;
      }

      const trigger = triggerRef.current;
      if (!trigger) {
        return;
      }

      const rect = trigger.getBoundingClientRect();
      const viewportPadding = 12;
      const width = Math.min(
        Math.max(rect.width, 200),
        window.innerWidth - viewportPadding * 2,
      );
      const left = Math.min(
        Math.max(rect.left, viewportPadding),
        window.innerWidth - width - viewportPadding,
      );
      const spaceBelow = window.innerHeight - rect.bottom - viewportPadding;
      const spaceAbove = rect.top - viewportPadding;
      const shouldOpenUp = spaceBelow < 240 && spaceAbove > spaceBelow;
      const maxHeight = Math.max(
        160,
        Math.min(336, (shouldOpenUp ? spaceAbove : spaceBelow) - 8),
      );

      setPanelSide(shouldOpenUp ? 'top' : 'bottom');
      setPanelStyle(
        shouldOpenUp
          ? {
              bottom: window.innerHeight - rect.top + 8,
              left,
              maxHeight,
              width,
            }
          : {
              left,
              maxHeight,
              top: rect.bottom + 8,
              width,
            },
      );
    };

    updatePanelPosition();

    window.addEventListener('resize', updatePanelPosition);
    window.addEventListener('scroll', updatePanelPosition, true);
    return () => {
      window.removeEventListener('resize', updatePanelPosition);
      window.removeEventListener('scroll', updatePanelPosition, true);
    };
  }, [isMobileSheet, open]);

  useEffect(() => {
    if (!open || isMobileSheet) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;

      if (triggerRef.current?.contains(target) || listboxRef.current?.contains(target)) {
        return;
      }

      closeMenu();
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [closeMenu, isMobileSheet, open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return;
      }

      event.preventDefault();
      closeMenu({ armGuard: isMobileSheet, focusTrigger: true });
    };

    window.addEventListener('keydown', handleEscape);
    return () => {
      window.removeEventListener('keydown', handleEscape);
    };
  }, [closeMenu, isMobileSheet, open]);

  const clearTypeahead = () => {
    if (typeaheadTimeoutRef.current != null) {
      window.clearTimeout(typeaheadTimeoutRef.current);
    }

    typeaheadBufferRef.current = '';
    typeaheadTimeoutRef.current = null;
  };

  const queueTypeahead = (key: string) => {
    const query = `${typeaheadBufferRef.current}${key.toLocaleLowerCase()}`;

    typeaheadBufferRef.current = query;
    if (typeaheadTimeoutRef.current != null) {
      window.clearTimeout(typeaheadTimeoutRef.current);
    }

    typeaheadTimeoutRef.current = window.setTimeout(() => {
      typeaheadBufferRef.current = '';
      typeaheadTimeoutRef.current = null;
    }, 420);

    return query;
  };

  const moveFocusFromTrigger = (backwards: boolean) => {
    const trigger = triggerRef.current;
    if (!trigger) {
      return;
    }

    window.requestAnimationFrame(() => {
      const focusableElements = getFocusableElements();
      const triggerIndex = focusableElements.indexOf(trigger);

      if (triggerIndex < 0) {
        return;
      }

      const nextElement = backwards
        ? focusableElements[triggerIndex - 1]
        : focusableElements[triggerIndex + 1];

      nextElement?.focus();
    });
  };

  const commitSelection = (nextValue: string) => {
    const targetOption = options.find(
      (option) => option.value === nextValue && !option.disabled,
    );
    if (!targetOption) {
      return;
    }

    if (!isControlled) {
      setInternalValue(nextValue);
    }

    if (nativeSelectRef.current) {
      nativeSelectRef.current.value = nextValue;
      nativeSelectRef.current.dispatchEvent(new Event('change', { bubbles: true }));
    }

    clearTypeahead();
    closeMenu({ armGuard: isMobileSheet, focusTrigger: true });
  };

  const handleNativeChange = (event: ChangeEvent<HTMLSelectElement>) => {
    if (!isControlled) {
      setInternalValue(event.target.value);
    }

    onChange?.(event);
  };

  const moveActiveOption = (direction: 1 | -1) => {
    prepareToOpen();
    setOpen(true);
    setActiveIndex((currentIndex) => {
      const fallbackIndex =
        defaultActiveIndex >= 0
          ? defaultActiveIndex
          : direction === 1
            ? -1
            : 0;

      return getNextEnabledOptionIndex(
        options,
        currentIndex >= 0 ? currentIndex : fallbackIndex,
        direction,
      );
    });
  };

  const moveToEdgeOption = (edge: 'first' | 'last') => {
    prepareToOpen();
    setOpen(true);
    setActiveIndex(edge === 'first' ? firstEnabledOptionIndex : lastEnabledOptionIndex);
  };

  const toggleMenu = () => {
    if (!hasSelectableOption) {
      return;
    }

    if (open) {
      closeMenu();
      return;
    }

    prepareToOpen();
    setOpen(true);
    setActiveIndex(defaultActiveIndex);
  };

  const handleTypeahead = (key: string, keepMenuOpen: boolean) => {
    const query = queueTypeahead(key);
    const startIndex = keepMenuOpen ? activeIndex : selectedIndex;
    const matchIndex = getTypeaheadMatchIndex(options, query, startIndex);

    if (matchIndex < 0) {
      return;
    }

    if (keepMenuOpen) {
      setActiveIndex(matchIndex);
      return;
    }

    commitSelection(options[matchIndex].value);
  };

  const handleTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (disabled || !hasSelectableOption) {
      return;
    }

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        moveActiveOption(1);
        return;
      case 'ArrowUp':
        event.preventDefault();
        moveActiveOption(-1);
        return;
      case 'Home':
        event.preventDefault();
        moveToEdgeOption('first');
        return;
      case 'End':
        event.preventDefault();
        moveToEdgeOption('last');
        return;
      case 'Enter':
      case ' ':
        event.preventDefault();
        toggleMenu();
        return;
      default:
        if (event.key.length === 1 && /\S/.test(event.key)) {
          event.preventDefault();
          handleTypeahead(event.key, open);
        }
    }
  };

  const handleListboxKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!open) {
      return;
    }

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setActiveIndex((currentIndex) =>
          getNextEnabledOptionIndex(options, currentIndex, 1),
        );
        return;
      case 'ArrowUp':
        event.preventDefault();
        setActiveIndex((currentIndex) =>
          getNextEnabledOptionIndex(options, currentIndex, -1),
        );
        return;
      case 'Home':
        event.preventDefault();
        setActiveIndex(firstEnabledOptionIndex);
        return;
      case 'End':
        event.preventDefault();
        setActiveIndex(lastEnabledOptionIndex);
        return;
      case 'Enter':
      case ' ':
        event.preventDefault();
        if (activeIndex >= 0) {
          commitSelection(options[activeIndex].value);
        }
        return;
      case 'Tab':
        event.preventDefault();
        closeMenu({ armGuard: isMobileSheet });
        moveFocusFromTrigger(event.shiftKey);
        return;
      default:
        if (event.key.length === 1 && /\S/.test(event.key)) {
          event.preventDefault();
          handleTypeahead(event.key, true);
        }
    }
  };

  const listboxSurface = (
    <div
      ref={listboxRef}
      id={listboxId}
      aria-activedescendant={
        activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined
      }
      aria-labelledby={ariaLabelledby}
      aria-label={ariaLabel}
      className={cx(
        'select-dropdown__surface',
        isMobileSheet && 'max-h-[min(70dvh,32rem)] rounded-[1.75rem]',
      )}
      role="listbox"
      tabIndex={-1}
      onKeyDown={handleListboxKeyDown}
    >
      <ul className="select-dropdown__list">
        {options.map((option, index) => {
          const showGroupLabel =
            option.groupLabel &&
            option.groupLabel !== options[index - 1]?.groupLabel;
          const isSelected = option.value === resolvedValue;
          const isActive = index === activeIndex;

          return (
            <Fragment key={`${option.groupLabel ?? 'default'}-${option.value}`}>
              {showGroupLabel ? (
                <li className="select-dropdown__group" aria-hidden="true">
                  {option.groupLabel}
                </li>
              ) : null}

              <li
                id={`${listboxId}-option-${index}`}
                aria-disabled={option.disabled || undefined}
                aria-selected={isSelected}
                className={cx(
                  'select-dropdown__option',
                  isActive && 'is-active',
                  isSelected && 'is-selected',
                  option.disabled && 'is-disabled',
                )}
                role="option"
                tabIndex={-1}
                onClick={() => {
                  if (option.disabled) {
                    return;
                  }

                  commitSelection(option.value);
                }}
                onMouseDown={(event) => {
                  event.preventDefault();
                }}
                onMouseEnter={() => {
                  if (option.disabled) {
                    return;
                  }

                  setActiveIndex(index);
                }}
              >
                <span className="select-dropdown__text">{option.label}</span>
                <span className="select-dropdown__check" aria-hidden="true">
                  {isSelected ? <Check className="h-4 w-4" strokeWidth={2.3} /> : null}
                </span>
              </li>
            </Fragment>
          );
        })}
      </ul>
    </div>
  );

  return (
    <>
      <div
        className={cx('select-field', className)}
        data-disabled={disabled ? 'true' : 'false'}
        data-open={open ? 'true' : 'false'}
      >
        <select
          {...nativeProps}
          ref={nativeSelectRef}
          data-select-hidden="true"
          aria-hidden="true"
          aria-invalid={ariaInvalid}
          className="select-field__native"
          disabled={disabled}
          form={form}
          name={name}
          onChange={handleNativeChange}
          required={required}
          tabIndex={-1}
          value={resolvedValue}
        >
          {children}
        </select>

        <button
          id={triggerId}
          ref={triggerRef}
          type="button"
          aria-controls={open ? listboxId : undefined}
          aria-describedby={ariaDescribedby}
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-label={ariaLabel}
          aria-labelledby={ariaLabelledby}
          autoFocus={autoFocus}
          className="select-field__control"
          disabled={disabled || !hasSelectableOption}
          onClick={toggleMenu}
          onKeyDown={handleTriggerKeyDown}
          title={title}
        >
          <span
            className="select-field__value"
            data-placeholder={isPlaceholder ? 'true' : 'false'}
          >
            {selectedOption?.label ?? 'Selecciona una opcion'}
          </span>
        </button>

        <span className="select-field__icon" aria-hidden="true">
          <ChevronDown className="h-4 w-4" strokeWidth={2.2} />
        </span>
      </div>

      {(open || shouldRenderOverlay) && typeof document !== 'undefined'
        ? createPortal(
            isMobileSheet ? (
              <div
                ref={overlayRef}
                className="pointer-events-auto fixed inset-0 z-[1300]"
              >
                <div
                  aria-hidden="true"
                  className={cx(
                    'absolute inset-0',
                    open ? 'bg-black/60 backdrop-blur-sm' : 'bg-transparent',
                  )}
                  {...backdropProps}
                />
                {open ? (
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-4 py-6">
                    <div
                      className="pointer-events-auto relative z-[1] w-full max-w-[28rem]"
                      {...panelProps}
                    >
                      <div className="mb-3 flex justify-center">
                        <span className="h-1.5 w-16 rounded-full bg-white/14" />
                      </div>
                      <div className="max-h-[min(78dvh,36rem)] overflow-hidden">
                        {listboxSurface}
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="select-dropdown" data-side={panelSide} style={panelStyle}>
                {listboxSurface}
              </div>
            ),
            document.body,
          )
        : null}
    </>
  );
});

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  props,
  forwardedRef,
) {
  if (props.multiple || (props.size != null && props.size > 1)) {
    return <NativeSelectFallback {...props} ref={forwardedRef} />;
  }

  return <CustomSelect {...props} ref={forwardedRef} />;
});

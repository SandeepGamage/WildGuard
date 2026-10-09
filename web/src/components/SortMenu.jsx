import { useEffect, useId, useRef, useState } from 'react';
import { CheckIcon, SortIcon } from './Icons';

/**
 * "Sort" button with a menu of sort options (menu button pattern). Escape or a click
 * outside closes it, arrow keys move between options, and the chosen one is ticked.
 * @param {{ label: string, buttonLabel: string, options: Array<{ value: string, label: string }>,
 *   value: string, onChange: (value: string) => void }} props
 *   `label` names the menu; `buttonLabel` is the text on the button (e.g. "Sort: Newest first").
 */
export function SortMenu({ label, buttonLabel, options, value, onChange }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const buttonRef = useRef(null);
  const itemRefs = useRef([]);
  const menuId = useId();

  useEffect(() => {
    if (!open) return undefined;
    const selected = Math.max(
      0,
      options.findIndex((option) => option.value === value),
    );
    itemRefs.current[selected]?.focus();
    const closeOnOutside = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('mousedown', closeOnOutside);
    return () => document.removeEventListener('mousedown', closeOnOutside);
  }, [open, options, value]);

  const close = () => {
    setOpen(false);
    buttonRef.current?.focus();
  };

  const choose = (next) => {
    onChange(next);
    close();
  };

  const onMenuKeyDown = (event) => {
    const items = itemRefs.current.filter(Boolean);
    const index = items.indexOf(document.activeElement);
    const focusAt = (i) => items[(i + items.length) % items.length]?.focus();
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      focusAt(index + 1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      focusAt(index - 1);
    } else if (event.key === 'Home') {
      event.preventDefault();
      focusAt(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      focusAt(items.length - 1);
    } else if (event.key === 'Tab') {
      setOpen(false);
    }
  };

  return (
    <div className="sort-menu" ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        className="btn btn-secondary"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' && !open) {
            event.preventDefault();
            setOpen(true);
          }
        }}
      >
        <SortIcon size={16} />
        {buttonLabel}
      </button>
      {open ? (
        <ul className="sort-menu-list" role="menu" id={menuId} aria-label={label} onKeyDown={onMenuKeyDown}>
          {options.map((option, index) => {
            const selected = option.value === value;
            return (
              <li key={option.value} role="none">
                <button
                  ref={(element) => {
                    itemRefs.current[index] = element;
                  }}
                  type="button"
                  role="menuitemradio"
                  aria-checked={selected}
                  tabIndex={-1}
                  className={selected ? 'sort-menu-item selected' : 'sort-menu-item'}
                  onClick={() => choose(option.value)}
                >
                  <span className="sort-menu-check" aria-hidden="true">
                    {selected ? <CheckIcon size={14} /> : null}
                  </span>
                  {option.label}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

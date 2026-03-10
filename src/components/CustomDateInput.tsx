import React from 'react';
import { normalizeDateInput, isValidDate } from '../utils/dateUtils';

interface CustomDateInputProps {
    value?: string;
    onClick?: () => void;
    onChange?: (e: any) => void;
    onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
    onCommit?: () => void;
    placeholder?: string;
    className?: string;
    required?: boolean;
    disabled?: boolean;
}

export const CustomDateInput = React.forwardRef<HTMLInputElement, CustomDateInputProps>((props, ref) => {
    const { value, onClick, onChange, onBlur: parentOnBlur, onCommit, placeholder, className, required, disabled } = props;
    const [localValue, setLocalValue] = React.useState(value || '');
    const isFocused = React.useRef(false);

    React.useEffect(() => {
        // Only update localValue from props if the input is NOT focused
        // This prevents the DatePicker from wiping the user's typing
        if (!isFocused.current) {
            setLocalValue(value || '');
        }
    }, [value]);

    const handleFocus = () => {
        isFocused.current = true;
    };

    const handleLocalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setLocalValue(e.target.value);
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
        isFocused.current = false;
        const input = e.target;
        const rawValue = input.value;
        const normalized = normalizeDateInput(rawValue);

        if (rawValue !== normalized) {
            // Check if normalized date is physically valid (e.g., Nov 31st is invalid)
            const parts = normalized.split('.');
            if (parts.length === 3) {
                const day = parseInt(parts[0], 10);
                const month = parseInt(parts[1], 10);
                const year = parseInt(parts[2], 10);
                const dateObj = new Date(year, month - 1, day);
                
                if (!isValidDate(dateObj, day, month, year)) {
                    alert(`Ungültiges Datum: Der ${normalized} existiert nicht.`);
                    setLocalValue(value || ''); // Revert to previous valid value
                    return;
                }
            }

            setLocalValue(normalized);
            // Trigger onChange so DatePicker parses the normalized value
            if (onChange) {
                const event = {
                    target: { ...input, value: normalized },
                    currentTarget: { ...input, value: normalized },
                    type: 'change',
                    persist: () => {},
                    preventDefault: () => {},
                    stopPropagation: () => {}
                } as any;
                onChange(event);
            }
        } else if (rawValue !== value && rawValue !== '') {
            // Check validation even for non-normalized but changed values
            const parts = rawValue.split('.');
            if (parts.length === 3) {
                const day = parseInt(parts[0], 10);
                const month = parseInt(parts[1], 10);
                const year = parseInt(parts[2], 10);
                const dateObj = new Date(year, month - 1, day);
                if (!isValidDate(dateObj, day, month, year)) {
                    alert(`Ungültiges Datum: Der ${rawValue} existiert nicht.`);
                    setLocalValue(value || '');
                    return;
                }
            }

            if (onChange) {
                const event = {
                    target: input,
                    currentTarget: input,
                    type: 'change',
                    persist: () => {},
                    preventDefault: () => {},
                    stopPropagation: () => {}
                } as any;
                onChange(event);
            }
        }
        
        if (parentOnBlur) {
            parentOnBlur(e);
        }
        if (onCommit) {
            // Use a small timeout to ensure DatePicker's internal state has updated
            setTimeout(() => {
                onCommit();
            }, 50);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation();
            e.currentTarget.blur();
        }
    };

    return (
        <input
            ref={ref}
            value={localValue}
            onClick={onClick}
            onChange={handleLocalChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className={className}
            required={required}
            disabled={disabled}
            type="text"
        />
    );
});
